// The business logic for placing an order. It runs on the SERVER (never in the
// customer's browser), so customers cannot change prices, discounts, shipping
// or stock.
//
// Flow: check the input -> in ONE database transaction: read the real product
// prices and stock, the shop's rules, the promo code; reject if something is
// unavailable; reduce stock; take the next order number; save the order.
// A transaction means that if two people buy the last item at the same moment,
// only one of them succeeds.

import { FieldValue } from 'firebase-admin/firestore';
import { OrderError } from './errors.js';
import {
  cleanCustomerInput,
  applyCustomerRules,
  cleanCustomInput,
  applyCustomFields,
} from './fields.js';
import { computeTotals } from './pricing.js';
import { cleanSelections, selectionSignature, resolveSelections } from './options.js';
import {
  isOptionCounted,
  keysForSelections,
  countedRows,
  derivedStock,
  applyDeltas,
  rowText,
} from './optionStock.js';

export { OrderError };

const MAX_LINES = 20; // different products in one order
const MAX_QTY = 20; // quantity of one product in one order
const FIRST_ORDER_NUMBER = 1001;

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function cleanPromoCode(value) {
  const code = cleanText(value, 40).toUpperCase();
  if (!code) return '';
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw new OrderError(400, 'PROMO_INVALID', "This promo code isn't valid.");
  }
  return code;
}

// Checks the SHAPE of what the browser sent and returns a clean version.
// (The shop's own rules about customer details are applied later.)
export function validateInput(body) {
  if (!body || typeof body !== 'object') {
    throw new OrderError(400, 'BAD_REQUEST', 'Invalid request.');
  }

  const tenantId = cleanText(body.tenantId, 100);
  if (!tenantId) throw new OrderError(400, 'BAD_REQUEST', 'Missing shop.');

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new OrderError(400, 'EMPTY_CART', 'Your cart is empty.');
  }

  // Each line = a product + the customer's choices (color, extension...).
  // Identical lines are merged; the same product with DIFFERENT choices stays
  // as separate lines.
  const merged = new Map();
  for (const item of body.items) {
    const productId = cleanText(item?.productId, 100);
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      throw new OrderError(400, 'BAD_ITEM', 'Invalid item in cart.');
    }
    const selections = cleanSelections(item?.selections);
    const key = `${productId}|${selectionSignature(selections)}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { productId, quantity, selections });
  }
  if (merged.size > MAX_LINES) {
    throw new OrderError(400, 'BAD_ITEM', 'Too many different items.');
  }
  const items = [...merged.values()];
  if (items.some((i) => i.quantity > MAX_QTY)) {
    throw new OrderError(400, 'TOO_MANY', `You can order up to ${MAX_QTY} of each item.`, {
      max: MAX_QTY,
    });
  }

  return {
    tenantId,
    customer: cleanCustomerInput(body.customer),
    custom: cleanCustomInput(body.custom),
    items,
    zoneId: cleanText(body.zoneId, 60),
    promoCode: cleanPromoCode(body.promoCode),
  };
}

export async function placeOrder(db, { tenantId, customer, custom, items, zoneId, promoCode }) {
  const tenantRef = db.collection('tenants').doc(tenantId);
  const counterRef = db.collection('counters').doc(tenantId);
  const orderRef = db.collection('orders').doc();
  // Several lines can be the same product (different choices): read each product once.
  const productIds = [...new Set(items.map((i) => i.productId))];
  const productRefs = productIds.map((id) => db.collection('products').doc(id));
  // Private cost prices live in their own collection (customers can't read it).
  const costRefs = productIds.map((id) => db.collection('productCosts').doc(id));
  const promoRef = promoCode
    ? db.collection('promoCodes').doc(`${tenantId}__${promoCode}`)
    : null;

  return db.runTransaction(async (tx) => {
    const refs = [tenantRef, counterRef, ...productRefs, ...costRefs];
    if (promoRef) refs.push(promoRef);
    const [tenantSnap, counterSnap, ...rest] = await tx.getAll(...refs);
    const productSnaps = rest.slice(0, productIds.length);
    const costSnaps = rest.slice(productIds.length, productIds.length * 2);
    const promoSnap = promoRef ? rest[productIds.length * 2] : null;

    if (!tenantSnap.exists || tenantSnap.data().isActive === false) {
      throw new OrderError(404, 'NO_SHOP', 'This shop is not available.');
    }
    const tenant = { id: tenantId, ...tenantSnap.data() };

    // The shop's rules about which customer details are needed.
    const cleanCustomer = applyCustomerRules(customer, tenant);
    // ... and the extra questions the shop added itself.
    const customFields = applyCustomFields(custom, tenant);

    // Check each product once; count how many of it are ordered in total.
    const productInfo = new Map();
    productIds.forEach((id, index) => {
      const snap = productSnaps[index];
      const product = snap.exists ? snap.data() : null;
      if (
        !product ||
        product.tenantId !== tenantId ||
        product.isActive !== true ||
        product.deleted === true ||
        product.comingSoon === true // announced only: can't be ordered yet
      ) {
        throw new OrderError(
          409,
          'UNAVAILABLE',
          'Sorry, one of the items in your cart is no longer available.'
        );
      }
      const costDoc = costSnaps[index];
      const costData = costDoc.exists && costDoc.data().tenantId === tenantId ? costDoc.data() : null;
      productInfo.set(id, { product, costData, totalQty: 0, index });
    });
    items.forEach((item) => {
      productInfo.get(item.productId).totalQty += item.quantity;
    });

    // How each product sells:
    //   made to order / preorder  never uses stock;
    //   counted stock             one number per product, or one per colour / plate when the
    //                             shop counts by option;
    //   stock first, then made to order ("backorder")
    //                             uses stock while there is some, otherwise the line is made to order.
    // The real check happens line by line below (lines of one product share the same numbers).
    for (const info of productInfo.values()) {
      const stock = Number(info.product.stock) || 0;
      info.isPreorder = info.product.isPreorder === true;
      info.backorder = info.product.backorder === true && !info.isPreorder;
      info.stock = stock;
      info.remaining = stock; // plain products: what is left while we go through the lines
      info.counted = !info.isPreorder && isOptionCounted(info.product);
      info.optionLeft = { ...(info.product.optionStock || {}) }; // counted products
      info.optionDelta = {}; // key -> units taken by this order (negative)
      info.deducted = 0; // units taken from stock by this order
    }

    // Build the order lines from the REAL product data in the database.
    const orderItems = items.map((item) => {
      const info = productInfo.get(item.productId);
      const { product, costData } = info;

      // The customer's choices (color, extension...) -> price and cost changes.
      const choice = resolveSelections(product, item.selections, costData?.optionCosts);

      // Stock: does this line come from the shelf, or is it made to order?
      let madeToOrder = info.isPreorder;
      let stockKeys = [];
      if (!info.isPreorder) {
        const name = product.name?.en || 'this item';
        if (info.counted) {
          const { keys, missing } = keysForSelections(product, item.selections);
          if (missing.length > 0) {
            const label = missing[0].label || { en: missing[0].id, ar: missing[0].id };
            throw new OrderError(400, 'BAD_OPTION', `Please choose: ${label.en}`, {
              customLabel: label,
            });
          }
          const short = keys.find((k) => (Number(info.optionLeft[k.key]) || 0) < item.quantity);
          if (!short) {
            for (const k of keys) {
              info.optionLeft[k.key] = (Number(info.optionLeft[k.key]) || 0) - item.quantity;
              info.optionDelta[k.key] = (info.optionDelta[k.key] || 0) - item.quantity;
            }
            info.deducted += item.quantity;
            stockKeys = keys.map((k) => k.key);
          } else if (info.backorder) {
            madeToOrder = true; // sold out in this colour / size: made on request
          } else {
            const left = Math.max(Number(info.optionLeft[short.key]) || 0, 0);
            const what = `${name} (${short.value.label?.en || short.value.id})`;
            throw new OrderError(
              409,
              'OUT_OF_STOCK',
              left > 0
                ? `Sorry, only ${left} of \"${what}\" left in stock.`
                : `Sorry, \"${what}\" is out of stock.`,
              { name: what, stock: left }
            );
          }
        } else if (info.remaining >= item.quantity) {
          info.remaining -= item.quantity;
          info.deducted += item.quantity;
        } else if (info.backorder) {
          madeToOrder = true;
        } else {
          const left = Math.max(info.remaining, 0);
          throw new OrderError(
            409,
            'OUT_OF_STOCK',
            left > 0
              ? `Sorry, only ${left} of \"${name}\" left in stock.`
              : `Sorry, \"${name}\" is out of stock.`,
            { name, stock: left }
          );
        }
      }
      const unitPrice = (Number(product.price) || 0) + choice.priceDelta;

      // Cost snapshot: copied into the order so later cost changes never
      // rewrite past profit. null means "no cost was set for this product".
      const baseCost =
        costData &&
        costData.costPrice !== null &&
        costData.costPrice !== undefined &&
        Number.isFinite(Number(costData.costPrice))
          ? Number(costData.costPrice)
          : null;
      const unitCost = baseCost === null ? null : baseCost + choice.costDelta;

      return {
        productId: item.productId,
        name: product.name, // snapshot: old orders keep the old name/price
        quantity: item.quantity,
        unitPrice,
        unitCost,
        subtotal: unitPrice * item.quantity,
        isPreorder: madeToOrder,
        // (backorder: true = this line is made to order because the stock ran out)
        ...(madeToOrder && !info.isPreorder ? { backorder: true } : {}),
        // which counted numbers this line took a unit from (needed to give them back on cancel/return)
        stockKeys,
        options: choice.snapshot, // [{ id, label, type, value }] what the customer chose
        // Picture of what was chosen (for packing): the choice's own picture, else the product's.
        imageUrl: choice.imageUrl || product.imageUrl || '',
        shippingExtra: Number(product.shippingExtra) || 0,
      };
    });

    // Subtotal, promo discount, shipping and total (same maths as the preview).
    const totals = computeTotals({
      tenant,
      lines: orderItems,
      zoneId,
      promo: promoSnap && promoSnap.exists ? promoSnap.data() : null,
      promoCode,
      strict: true,
    });

    // Order number: BYND-1001, BYND-1002 ... (unique, never reused)
    const last = counterSnap.exists ? counterSnap.data().current : FIRST_ORDER_NUMBER - 1;
    const orderNumber = last + 1;
    const prefix = String(tenant.orderPrefix || tenant.slug || 'ORD').toUpperCase();
    const orderNumberLabel = `${prefix}-${orderNumber}`;

    // An order containing any preorder item is a "preorder" order.
    const orderType = orderItems.some((i) => i.isPreorder) ? 'preorder' : 'normal';

    // Writes (all-or-nothing).
    // Stock goes down once per product, by the units this order took from the shelf.
    for (const [id, info] of productInfo) {
      if (info.isPreorder || info.deducted === 0) continue; // nothing taken from stock
      let stockAfter = info.remaining;
      const update = { updatedAt: FieldValue.serverTimestamp() };
      let optionChanges = null;
      if (info.counted) {
        const newMap = applyDeltas(info.product.optionStock, info.optionDelta);
        stockAfter = derivedStock(info.product, newMap);
        update.optionStock = newMap;
        const rows = countedRows(info.product);
        optionChanges = Object.entries(info.optionDelta).map(([key, delta]) => ({
          key,
          label: rowText(rows.find((r) => r.key === key) || { optionLabel: {}, valueLabel: { en: key } }),
          delta,
          after: Number(newMap[key]) || 0,
        }));
      }
      update.stock = stockAfter;
      tx.update(productRefs[info.index], update);
      // ...and a line in the stock history (same shape the admin writes).
      tx.set(db.collection('tenants').doc(tenantId).collection('stockMovements').doc(), {
        tenantId,
        productId: id,
        productName: info.product.name || {},
        type: 'sale',
        delta: -info.deducted,
        stockAfter,
        ...(optionChanges ? { optionChanges } : {}),
        unitCost: null,
        totalCost: null,
        note: '',
        orderId: orderRef.id,
        orderLabel: orderNumberLabel,
        actorUid: 'customer',
        actorName: '',
        at: FieldValue.serverTimestamp(),
      });
    }

    if (totals.promo) {
      tx.update(promoRef, {
        usedCount: (Number(promoSnap.data().usedCount) || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const orderDoc = {
      tenantId,
      orderNumber,
      orderNumberLabel,
      orderType,
      customer: cleanCustomer,
      customFields, // [{ id, label, type, value }] answers to the shop's extra questions
      items: orderItems.map(({ shippingExtra, ...line }) => line),
      subtotal: totals.subtotal,
      discount: totals.discount,
      promo: totals.promo, // { code, type, value, discount } or null
      shipping: totals.zone
        ? { zoneId: totals.zone.id, zoneName: totals.zone.name, fee: totals.shippingFee }
        : null,
      shippingFee: totals.shippingFee,
      totalAmount: totals.total,
      paymentMethod: 'COD',
      status: 'pending',
      statusHistory: [
        { status: 'pending', timestamp: new Date().toISOString(), updatedBy: 'customer' },
      ],
      deleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(orderRef, orderDoc);

    tx.set(counterRef, { current: orderNumber }, { merge: true });

    return {
      orderId: orderRef.id,
      orderNumber,
      orderNumberLabel,
      totalAmount: totals.total,
      orderType,
      // Used only by the server for the Telegram alert; removed before replying.
      _order: orderDoc,
    };
  });
}
