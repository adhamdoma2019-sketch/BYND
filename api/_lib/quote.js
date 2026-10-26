// Price preview for the checkout page: the same maths as a real order
// (subtotal, promo discount, shipping, total) but nothing is saved.
// The page asks for a new quote whenever the cart, delivery area or promo
// code changes, so the customer always sees what they will really pay.

import { OrderError } from './errors.js';
import { computeTotals } from './pricing.js';
import { resolveSelections } from './options.js';
import { checkTotalQty, tierFor } from './quantityPrices.js';

export async function getQuote(db, { tenantId, items, zoneId, promoCode }) {
  const tenantRef = db.collection('tenants').doc(tenantId);
  const productIds = [...new Set(items.map((i) => i.productId))];
  const productRefs = productIds.map((id) => db.collection('products').doc(id));
  const promoRef = promoCode
    ? db.collection('promoCodes').doc(`${tenantId}__${promoCode}`)
    : null;

  const refs = [tenantRef, ...productRefs];
  if (promoRef) refs.push(promoRef);
  const [tenantSnap, ...rest] = await db.getAll(...refs);
  const productSnaps = rest.slice(0, items.length);
  const promoSnap = promoRef ? rest[productIds.length] : null;

  if (!tenantSnap.exists || tenantSnap.data().isActive === false) {
    throw new OrderError(404, 'NO_SHOP', 'This shop is not available.');
  }
  const tenant = { id: tenantId, ...tenantSnap.data() };

  // How many of each product are in the cart (quantity prices and limits look at the total).
  const totalQty = new Map();
  for (const item of items) {
    totalQty.set(item.productId, (totalQty.get(item.productId) || 0) + item.quantity);
  }

  const lines = items.map((item) => {
    const snap = productSnaps[productIds.indexOf(item.productId)];
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
    const total = totalQty.get(item.productId) || 0;
    const problem = checkTotalQty(product, total);
    const name = product.name?.en || 'this item';
    if (problem?.code === 'BELOW_MIN') {
      throw new OrderError(400, 'BELOW_MIN', `"${name}" needs at least ${problem.min} pieces.`, {
        name,
        min: problem.min,
      });
    }
    if (problem?.code === 'TOO_MANY') {
      throw new OrderError(400, 'TOO_MANY', `You can order up to ${problem.max} of "${name}".`, {
        name,
        max: problem.max,
      });
    }
    // The price includes the quantity price (if any) and what the customer's choices add (color, extension...).
    const choice = resolveSelections(product, item.selections);
    const tier = tierFor(product, total);
    return {
      unitPrice: (tier ? tier.price : Number(product.price) || 0) + choice.priceDelta,
      tiered: Boolean(tier),
      quantity: item.quantity,
      shippingExtra: Number(product.shippingExtra) || 0,
    };
  });

  const totals = computeTotals({
    tenant,
    lines,
    zoneId,
    promo: promoSnap && promoSnap.exists ? promoSnap.data() : null,
    promoCode,
    strict: false,
  });

  return {
    subtotal: totals.subtotal,
    discount: totals.discount,
    shippingFee: totals.shippingFee,
    total: totals.total,
    promo: totals.promo
      ? { code: totals.promo.code, type: totals.promo.type, value: totals.promo.value }
      : null,
    promoError: totals.promoError,
    zoneProblem: totals.zoneProblem,
  };
}
