// Price preview for the checkout page: the same maths as a real order
// (subtotal, promo discount, shipping, total) but nothing is saved.
// The page asks for a new quote whenever the cart, delivery area or promo
// code changes, so the customer always sees what they will really pay.

import { OrderError } from './errors.js';
import { computeTotals } from './pricing.js';
import { resolveSelections } from './options.js';

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

  const lines = items.map((item) => {
    const snap = productSnaps[productIds.indexOf(item.productId)];
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
    // The price includes what the customer's choices add (color, extension...).
    const choice = resolveSelections(product, item.selections);
    return {
      unitPrice: (Number(product.price) || 0) + choice.priceDelta,
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
