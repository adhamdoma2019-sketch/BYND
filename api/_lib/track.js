// Order tracking for customers (no login). The customer must know BOTH the order
// number and the phone number used on the order, because order numbers are sequential
// (BYND-1001, 1002 ...) and anyone could guess the next one.
//
// Only the status and the dates are returned: never the name, address, items or prices.
// Every mismatch gives the SAME answer ("not found"), so nobody can use this to find out
// which order numbers exist or which phone belongs to an order.

import { OrderError } from './errors.js';
import { toLatinDigits } from './contactChecks.js';
import { hashKey, hasRoom, countUse, phoneDigits, LIMITS } from './rateLimit.js';

const KNOWN_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];

const notFound = () =>
  new OrderError(404, 'TRACK_NOT_FOUND', 'We could not find an order with these details.');

// "BYND-1001", "bynd 1001", "#1001", "١٠٠١" -> 1001
export function parseOrderNumber(raw) {
  const match = /(?:^|\D)(\d{1,9})\s*$/.exec(toLatinDigits(raw).trim()); // a longer run of digits is not an order number
  const number = match ? Number(match[1]) : 0;
  return number > 0 ? number : 0;
}

// What the customer is allowed to see.
export function publicTimeline(order) {
  const history = (Array.isArray(order.statusHistory) ? order.statusHistory : [])
    .filter((h) => KNOWN_STATUSES.includes(h?.status) && typeof h?.timestamp === 'string')
    .slice(-30)
    .map((h) => ({ status: h.status, timestamp: h.timestamp }));
  return {
    orderNumberLabel: String(order.orderNumberLabel || ''),
    orderType: order.orderType === 'preorder' ? 'preorder' : 'normal',
    status: KNOWN_STATUSES.includes(order.status) ? order.status : 'pending',
    history,
  };
}

export async function trackOrder(db, { tenantId, orderNumber, phone }) {
  const number = parseOrderNumber(orderNumber);
  const tail = phoneDigits(phone);
  if (typeof tenantId !== 'string' || !tenantId || tenantId.length > 100 || !number || tail.length < 7) {
    throw notFound();
  }

  // Wrong guesses for one order number are limited, so the phone number cannot be
  // guessed by trying many numbers (even from many different connections).
  const orderKey = `track-ord-${hashKey(`${tenantId}|${number}`)}`;
  if (!(await hasRoom(db, orderKey, LIMITS.trackOrder))) {
    throw new OrderError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.');
  }

  const snap = await db
    .collection('orders')
    .where('tenantId', '==', tenantId)
    .where('orderNumber', '==', number)
    .limit(1)
    .get();
  const order = snap.empty ? null : snap.docs[0].data();

  // Old orders keep the phone exactly as typed, so compare the digits, not the text.
  if (!order || order.deleted === true || phoneDigits(order.customer?.phone) !== tail) {
    await countUse(db, orderKey, LIMITS.trackOrder);
    throw notFound();
  }
  return publicTimeline(order);
}
