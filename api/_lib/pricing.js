// All the money maths for an order in ONE place (used both for the checkout
// preview and for the real order, so they can never disagree):
//
//   subtotal  = sum of price x quantity
//   discount  = promo code (if valid)
//   shipping  = the chosen zone's price (+ extra per product), or free when the
//               order is above the zone's "free shipping above" amount
//   total     = subtotal - discount + shipping

import { OrderError } from './errors.js';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const todayUtc = (now) => now.toISOString().slice(0, 10);

// Checks a promo code document and returns the discount, or throws a
// PROMO_* error. `promo` is the stored document (or null if it doesn't exist).
export function evaluatePromo(promo, { tenantId, subtotal, now = new Date() }) {
  if (!promo || promo.tenantId !== tenantId || promo.isActive !== true) {
    throw new OrderError(400, 'PROMO_INVALID', "This promo code isn't valid.");
  }
  // The expiry date itself is still valid ("expires on 2026-12-31" = last day).
  if (promo.expiresAt && todayUtc(now) > promo.expiresAt) {
    throw new OrderError(400, 'PROMO_EXPIRED', 'This promo code has expired.');
  }
  if (
    promo.usageLimit !== null &&
    promo.usageLimit !== undefined &&
    (Number(promo.usedCount) || 0) >= Number(promo.usageLimit)
  ) {
    throw new OrderError(400, 'PROMO_LIMIT', 'This promo code has reached its usage limit.');
  }
  const minOrder = Number(promo.minOrder) || 0;
  if (minOrder > 0 && subtotal < minOrder) {
    throw new OrderError(
      400,
      'PROMO_MIN_ORDER',
      `This code needs an order of at least ${minOrder}.`,
      { minOrder }
    );
  }

  const value = Number(promo.value) || 0;
  const discount =
    promo.type === 'percent'
      ? round2((subtotal * Math.min(Math.max(value, 0), 100)) / 100)
      : Math.min(Math.max(value, 0), subtotal);

  return { code: promo.code, type: promo.type, value, discount: round2(discount) };
}

// lines: [{ unitPrice, quantity, shippingExtra }]
// strict = true for real orders (problems throw); false for the checkout
// preview (problems are reported but totals are still returned).
export function computeTotals({ tenant, lines, zoneId, promo, promoCode, strict }) {
  const subtotal = round2(
    lines.reduce((sum, l) => sum + Number(l.unitPrice) * Number(l.quantity), 0)
  );

  // ----- promo code -----
  let promoApplied = null;
  let promoError = null;
  if (promoCode) {
    try {
      promoApplied = evaluatePromo(promo, { tenantId: tenant.id, subtotal });
    } catch (e) {
      if (strict || !(e instanceof OrderError)) throw e;
      promoError = { code: e.code, meta: e.meta };
    }
  }
  const discount = promoApplied ? promoApplied.discount : 0;
  const afterDiscount = round2(subtotal - discount);

  // ----- shipping -----
  const zones = (tenant.shipping?.zones || []).filter((z) => z.active !== false);
  let zone = null;
  let zoneProblem = null;
  let shippingFee = 0;
  if (zones.length > 0) {
    zone = zones.find((z) => z.id === zoneId) || null;
    if (!zone) {
      zoneProblem = zoneId ? 'BAD_ZONE' : 'ZONE_REQUIRED';
      if (strict) {
        throw new OrderError(400, zoneProblem, 'Please choose your delivery area.');
      }
    } else {
      const freeAbove = Number(zone.freeAbove) || 0;
      if (freeAbove > 0 && afterDiscount >= freeAbove) {
        shippingFee = 0;
      } else {
        const extras = lines.reduce(
          (sum, l) => sum + (Number(l.shippingExtra) || 0) * Number(l.quantity),
          0
        );
        shippingFee = round2((Number(zone.price) || 0) + extras);
      }
    }
  }

  return {
    subtotal,
    discount,
    shippingFee,
    total: round2(afterDiscount + shippingFee),
    promo: promoApplied,
    promoError,
    zone: zone ? { id: zone.id, name: zone.name, price: Number(zone.price) || 0 } : null,
    zoneProblem,
  };
}
