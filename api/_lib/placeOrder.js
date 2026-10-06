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
import { cleanCustomerInput, applyCustomerRules } from './fields.js';
import { computeTotals } from './pricing.js';

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

  // Merge duplicate lines of the same product so stock is counted correctly.
  const merged = new Map();
  for (const item of body.items) {
    const productId = cleanText(item?.productId, 100);
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      throw new OrderError(400, 'BAD_ITEM', 'Invalid item in cart.');
    }
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  if (merged.size > MAX_LINES) {
    throw new OrderError(400, 'BAD_ITEM', 'Too many different items.');
  }
  const items = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
  if (items.some((i) => i.quantity > MAX_QTY)) {
    throw new OrderError(400, 'TOO_MANY', `You can order up to ${MAX_QTY} of each item.`, {
      max: MAX_QTY,
    });
  }

  return {
    tenantId,
    customer: cleanCustomerInput(body.customer),
    items,
    zoneId: cleanText(body.zoneId, 60),
    promoCode: cleanPromoCode(body.promoCode),
  };
}

export async function placeOrder(db, { tenantId, customer, items, zoneId, promoCode }) {
  const tenantRef = db.collection('tenants').doc(tenantId);
  const counterRef = db.collection('counters').doc(tenantId);
  const orderRef = db.collection('orders').doc();
  const productRefs = items.map((i) => db.collection('products').doc(i.productId));
  // Private cost prices live in their own collection (customers can't read it).
  const costRefs = items.map((i) => db.collection('productCosts').doc(i.productId));
  const promoRef = promoCode
    ? db.collection('promoCodes').doc(`${tenantId}__${promoCode}`)
    : null;

  return db.runTransaction(async (tx) => {
    const refs = [tenantRef, counterRef, ...productRefs, ...costRefs];
    if (promoRef) refs.push(promoRef);
    const [tenantSnap, counterSnap, ...rest] = await tx.getAll(...refs);
    const productSnaps = rest.slice(0, items.length);
    const costSnaps = rest.slice(items.length, items.length * 2);
    const promoSnap = promoRef ? rest[items.length * 2] : null;

    if (!tenantSnap.exists || tenantSnap.data().isActive === false) {
      throw new OrderError(404, 'NO_SHOP', 'This shop is not available.');
    }
    const tenant = { id: tenantId, ...tenantSnap.data() };

    // The shop's rules about which customer details are needed.
    const cleanCustomer = applyCustomerRules(customer, tenant);

    // Build the order lines from the REAL product data in the database.
    const orderItems = items.map((item, index) => {
      const snap = productSnaps[index];
      const product = snap.exists ? snap.data() : null;

      if (
        !product ||
        product.tenantId !== tenantId ||
        product.isActive !== true ||
        product.deleted === true
      ) {
        throw new OrderError(
          409,
          'UNAVAILABLE',
          'Sorry, one of the items in your cart is no longer available.'
        );
      }

      // Preorder products can be ordered even with no stock, so they skip the
      // stock check and never change the stock number.
      const isPreorder = product.isPreorder === true;
      const stock = Number(product.stock) || 0;
      if (!isPreorder && stock < item.quantity) {
        const name = product.name?.en || 'this item';
        throw new OrderError(
          409,
          'OUT_OF_STOCK',
          stock > 0
            ? `Sorry, only ${stock} of "${name}" left in stock.`
            : `Sorry, "${name}" is out of stock.`,
          { name, stock }
        );
      }

      const unitPrice = Number(product.price) || 0;

      // Cost snapshot: copied into the order so later cost changes never
      // rewrite past profit. null means "no cost was set for this product".
      const costDoc = costSnaps[index];
      const costData = costDoc.exists ? costDoc.data() : null;
      const unitCost =
        costData &&
        costData.tenantId === tenantId &&
        costData.costPrice !== null &&
        costData.costPrice !== undefined &&
        Number.isFinite(Number(costData.costPrice))
          ? Number(costData.costPrice)
          : null;

      return {
        productId: item.productId,
        name: product.name, // snapshot: old orders keep the old name/price
        quantity: item.quantity,
        unitPrice,
        unitCost,
        subtotal: unitPrice * item.quantity,
        isPreorder,
        shippingExtra: Number(product.shippingExtra) || 0,
        _newStock: isPreorder ? null : stock - item.quantity,
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
    orderItems.forEach((line, index) => {
      if (line.isPreorder) return; // preorders don't use stock
      tx.update(productRefs[index], {
        stock: line._newStock,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (totals.promo) {
      tx.update(promoRef, {
        usedCount: (Number(promoSnap.data().usedCount) || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    tx.set(orderRef, {
      tenantId,
      orderNumber,
      orderNumberLabel,
      orderType,
      customer: cleanCustomer,
      items: orderItems.map(({ _newStock, shippingExtra, ...line }) => line),
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
    });

    tx.set(counterRef, { current: orderNumber }, { merge: true });

    return {
      orderId: orderRef.id,
      orderNumber,
      orderNumberLabel,
      totalAmount: totals.total,
      orderType,
    };
  });
}
