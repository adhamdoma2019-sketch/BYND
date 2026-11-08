// Duplicate-order protection (update 38).
// The checkout page makes a random one-time code for every order attempt and sends it with the order.
// If the answer gets lost (bad connection) and the customer presses "Place order" again, the browser sends the SAME
// code: the server then returns the order it already saved instead of creating a second one.
// The code is remembered in the server-only collection `orderTokens` (nobody can read it from a browser;
// Firestore refuses everything that has no rule). Old entries clean themselves up if the free "TTL" setting is on.

import crypto from 'node:crypto';

export const TOKEN_KEEP_MS = 30 * 24 * 60 * 60 * 1000; // remembered for 30 days

// A good code = 16-64 letters / digits / - / _ . Anything else (or nothing) = no protection, the order works as before.
export function cleanOrderToken(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : '';
}

// One document per shop + code. The code itself is never stored, only a hash of it.
export function tokenRef(db, tenantId, token) {
  const hash = crypto.createHash('sha256').update(`bynd-order|${token}`).digest('hex').slice(0, 40);
  return db.collection('orderTokens').doc(`${tenantId}__${hash}`);
}

// What the customer's screen needs, taken from an order that is already saved.
export function savedResult(orderId, order) {
  return {
    orderId,
    orderNumber: order.orderNumber,
    orderNumberLabel: order.orderNumberLabel,
    totalAmount: order.totalAmount,
    orderType: order.orderType,
    duplicate: true,
    _order: order,
  };
}

// Quick look BEFORE the spam limits: has this code already produced an order? Fails open (null = go on as normal).
export async function findSavedOrder(db, tenantId, token) {
  if (!token) return null;
  try {
    const tSnap = await tokenRef(db, tenantId, token).get();
    if (!tSnap.exists) return null;
    const orderId = tSnap.data().orderId;
    if (!orderId) return null;
    const oSnap = await db.collection('orders').doc(orderId).get();
    return oSnap.exists ? savedResult(orderId, oSnap.data()) : null;
  } catch {
    return null;
  }
}
