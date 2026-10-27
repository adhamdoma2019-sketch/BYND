// Couriers (shipping companies or the team's own delivery people): who delivers an
// order, what they earn, and how much cash they owe the shop. Pure maths, unit-tested.
//
// Each order keeps a SNAPSHOT of the courier at the moment it was assigned
// (order.courier = { id, name, kind, collectsCash, fee, returnFeePercent }), so later
// changes to a courier's prices never rewrite old orders.
//
//   delivered order  -> courier earns `fee`; if collectsCash, they hold the order total
//   returned order   -> courier earns fee x returnFeePercent / 100; they hold no cash
//   any other status -> nothing counted yet (open) / nothing (cancelled)
//
//   balance = cash collected - fees earned - handovers recorded
//   balance > 0  -> the courier owes the shop    balance < 0 -> the shop owes the courier
//
// A handover (settlement) is a signed amount: + = courier gave cash to the shop,
// - = the shop paid the courier. Entries are never edited: a mistake is fixed with a new entry.

export const COURIER_KINDS = ['company', 'own'];

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? round2(n) : null;
};

// The fee this courier charges for a delivery area: its own price for the area,
// else its "other areas" price, else 0.
export function feeForZone(courier, zoneId) {
  const own = money(courier?.fees?.[zoneId]);
  if (own !== null && courier?.fees && Object.prototype.hasOwnProperty.call(courier.fees, zoneId)) return own;
  return money(courier?.defaultFee) ?? 0;
}

// What is saved in the order when a courier is assigned. `fee` can be typed by hand.
export function courierSnapshot(courier, fee, now = new Date()) {
  const f = money(fee);
  return {
    id: courier.id,
    name: String(courier.name || '').slice(0, 80),
    kind: COURIER_KINDS.includes(courier.kind) ? courier.kind : 'own',
    collectsCash: courier.collectsCash !== false,
    fee: f === null ? 0 : f,
    returnFeePercent: returnPercent(courier.returnFeePercent),
    assignedAt: now.toISOString(),
  };
}

export function returnPercent(v) {
  if (v === undefined || v === null || v === '') return 100; // default: the full fee
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.min(100, Math.max(0, round2(n)));
}

// Checks a courier form and returns { ok, errors[], value } (value = what is saved).
export function cleanCourierForm(form, zones = []) {
  const errors = [];
  const name = String(form.name || '').trim();
  if (!name) errors.push('name');
  if (name.length > 80) errors.push('name');
  const kind = COURIER_KINDS.includes(form.kind) ? form.kind : 'own';

  const fees = {};
  for (const z of zones) {
    const raw = form.fees?.[z.id];
    if (raw === '' || raw === undefined || raw === null) continue; // empty = use "other areas"
    const m = money(raw);
    if (m === null) errors.push('fee');
    else fees[z.id] = m;
  }
  let defaultFee = 0;
  if (form.defaultFee !== '' && form.defaultFee !== undefined && form.defaultFee !== null) {
    const m = money(form.defaultFee);
    if (m === null) errors.push('fee');
    else defaultFee = m;
  }
  let pct = 100;
  if (form.returnFeePercent !== '' && form.returnFeePercent !== undefined && form.returnFeePercent !== null) {
    const n = Number(form.returnFeePercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) errors.push('percent');
    else pct = round2(n);
  }
  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    value: {
      name,
      kind,
      collectsCash: form.collectsCash !== false,
      defaultFee,
      fees,
      returnFeePercent: pct,
      active: form.active !== false,
    },
  };
}

// ----- what one order is worth to its courier -----

export function orderCourierFee(order) {
  const c = order?.courier;
  if (!c) return 0;
  const fee = money(c.fee) ?? 0;
  if (order.status === 'delivered') return fee;
  if (order.status === 'returned') return round2((fee * returnPercent(c.returnFeePercent)) / 100);
  return 0;
}

export function orderCashHeld(order) {
  if (!order?.courier || order.courier.collectsCash === false) return 0;
  return order.status === 'delivered' ? round2(order.totalAmount) : 0;
}

const lastDate = (order, status) => {
  const entry = [...(order.statusHistory || [])].reverse().find((h) => h.status === status);
  return entry?.timestamp ? new Date(entry.timestamp) : null;
};

// The day that decides which month an order's courier fee belongs to.
export function courierFeeDate(order) {
  const d = lastDate(order, order.status === 'returned' ? 'returned' : 'delivered');
  if (d) return d;
  if (order.createdAt?.seconds) return new Date(order.createdAt.seconds * 1000);
  return null;
}

// ----- one courier's statement -----

export function courierStatement(courierId, orders, settlements) {
  const mine = orders.filter((o) => o.courier?.id === courierId && !o.deleted);
  const s = {
    assigned: mine.length,
    open: 0,
    delivered: 0,
    returned: 0,
    cancelled: 0,
    cash: 0,
    fees: 0,
    settled: 0,
    balance: 0,
  };
  for (const o of mine) {
    if (o.status === 'delivered') s.delivered += 1;
    else if (o.status === 'returned') s.returned += 1;
    else if (o.status === 'cancelled') s.cancelled += 1;
    else s.open += 1;
    s.cash += orderCashHeld(o);
    s.fees += orderCourierFee(o);
  }
  for (const x of settlements) {
    if (x.courierId === courierId) s.settled += Number(x.amount) || 0;
  }
  s.cash = round2(s.cash);
  s.fees = round2(s.fees);
  s.settled = round2(s.settled);
  s.balance = round2(s.cash - s.fees - s.settled);
  return s;
}

// Checks a handover typed in the screen. direction: 'in' (courier gave cash) | 'out' (shop paid courier).
export function cleanSettlement({ amount, direction, note }) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'amount' };
  if (n > 10000000) return { ok: false, error: 'amount' };
  const signed = direction === 'out' ? -round2(n) : round2(n);
  return { ok: true, value: { amount: signed, note: String(note || '').trim().slice(0, 200) } };
}
