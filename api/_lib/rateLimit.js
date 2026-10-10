// Simple spam protection that works on Vercel (where every request may run on a
// different server, so a counter kept in memory would be useless): counters are
// kept in Firestore (collection "rateLimits", which only the server can touch).
//
// A counter = how many times something happened in the current time window.
// Keys are hashed, so no phone number or IP address is stored in readable form.
//
// If the counters can't be reached for any reason, orders are NOT blocked
// (the protection "fails open"): a real customer is never turned away because of it.

import crypto from 'node:crypto';

export const hashKey = (value) =>
  crypto.createHash('sha256').update(`bynd-rate|${String(value)}`).digest('hex').slice(0, 32);

// The visitor's address as seen by Vercel (it overwrites what the browser claims).
export function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0];
  return String(req.headers?.['x-real-ip'] || forwarded || req.socket?.remoteAddress || 'unknown').trim();
}

// Limits (see README of the update for the reasoning):
export const LIMITS = {
  // Many people on a mobile network can share one address, so this is generous.
  orderIp: { limit: 40, windowMs: 60 * 60 * 1000 }, // 40 order attempts / hour / address
  // One person rarely needs more than a few orders a day.
  orderPhone: { limit: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 orders / day / phone number
  promoIp: { limit: 60, windowMs: 10 * 60 * 1000 }, // 60 promo-code checks / 10 min / address
};

// Is there still room? (Does not count.)  Fails open.
export async function hasRoom(db, key, { limit, windowMs }, now = Date.now()) {
  try {
    const snap = await db.collection('rateLimits').doc(key).get();
    if (!snap.exists) return true;
    const d = snap.data();
    if (now - d.windowStart >= windowMs) return true;
    return (Number(d.count) || 0) < limit;
  } catch {
    return true;
  }
}

// Counts one use. Never throws.
export async function countUse(db, key, { windowMs }, now = Date.now()) {
  try {
    const ref = db.collection('rateLimits').doc(key);
    await db.runTransaction(async (tx) => {
      const [snap] = await tx.getAll(ref);
      const d = snap.exists ? snap.data() : null;
      if (!d || now - d.windowStart >= windowMs) {
        // expireAt lets Firestore's free "TTL" setting clean old counters up by itself.
        tx.set(ref, { count: 1, windowStart: now, expireAt: new Date(now + windowMs * 2) });
      } else {
        tx.update(ref, { count: (Number(d.count) || 0) + 1 });
      }
    });
  } catch {
    // counters are best-effort
  }
}

export const phoneDigits = (phone) => String(phone || '').replace(/\D/g, '').slice(-12);
