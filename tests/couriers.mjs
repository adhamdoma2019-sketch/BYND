import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  feeForZone,
  courierSnapshot,
  cleanCourierForm,
  orderCourierFee,
  orderCashHeld,
  courierStatement,
  cleanSettlement,
  returnPercent,
} from '../src/utils/couriers.js';
import { calcProfit } from '../src/utils/profit.js';

let n = 0;
const ok = (l) => console.log('  ok', ++n, l);

const zones = [{ id: 'cairo' }, { id: 'giza' }];

// ---- fee per area ----
const bosta = { id: 'c1', name: 'Bosta', kind: 'company', collectsCash: true, defaultFee: 60, fees: { cairo: 45, giza: 0 }, returnFeePercent: 50 };
assert.equal(feeForZone(bosta, 'cairo'), 45);
assert.equal(feeForZone(bosta, 'giza'), 0);      // an explicit 0 is a real price, not "empty"
assert.equal(feeForZone(bosta, 'alex'), 60);     // unknown area -> "other areas" fee
assert.equal(feeForZone({ name: 'x' }, 'cairo'), 0);
ok('fee per area: own price (even 0), else "other areas", else 0');

// ---- snapshot ----
const snap = courierSnapshot(bosta, '45', new Date('2026-10-27T10:00:00Z'));
assert.deepEqual(
  [snap.id, snap.name, snap.fee, snap.collectsCash, snap.returnFeePercent, snap.kind],
  ['c1', 'Bosta', 45, true, 50, 'company']
);
assert.equal(courierSnapshot(bosta, 'abc').fee, 0);
assert.equal(courierSnapshot(bosta, -5).fee, 0);
assert.equal(courierSnapshot({ ...bosta, collectsCash: false }, 10).collectsCash, false);
assert.equal(returnPercent(undefined), 100);
assert.equal(returnPercent(''), 100);
assert.equal(returnPercent(150), 100);
assert.equal(returnPercent(-3), 0);
ok('order keeps a snapshot of the courier; bad fee -> 0; return share defaults to 100 and stays between 0 and 100');

// ---- form checks ----
let f = cleanCourierForm({ name: '  Ali  ', kind: 'own', collectsCash: false, defaultFee: '30', fees: { cairo: '40', giza: '' }, returnFeePercent: '0' }, zones);
assert.equal(f.ok, true);
assert.deepEqual(f.value, { name: 'Ali', kind: 'own', collectsCash: false, defaultFee: 30, fees: { cairo: 40 }, returnFeePercent: 0, active: true });
assert.equal(cleanCourierForm({ name: ' ' }, zones).ok, false);
assert.ok(cleanCourierForm({ name: 'A', fees: { cairo: '-1' } }, zones).errors.includes('fee'));
assert.ok(cleanCourierForm({ name: 'A', fees: { cairo: 'abc' } }, zones).errors.includes('fee'));
assert.ok(cleanCourierForm({ name: 'A', returnFeePercent: '120' }, zones).errors.includes('percent'));
assert.equal(cleanCourierForm({ name: 'A' }, zones).value.returnFeePercent, 100);
assert.equal(cleanCourierForm({ name: 'A', kind: 'weird' }, zones).value.kind, 'own');
ok('courier form: trims the name, empty area = use other-areas fee, rejects negative / text fees and a percentage over 100');

// ---- one order ----
const courier = { id: 'c1', name: 'Bosta', collectsCash: true, fee: 45, returnFeePercent: 50 };
const mk = (status, extra = {}) => ({ id: status + Math.random(), status, totalAmount: 500, courier, ...extra });
assert.equal(orderCourierFee(mk('delivered')), 45);
assert.equal(orderCourierFee(mk('returned')), 22.5);
assert.equal(orderCourierFee(mk('cancelled')), 0);
assert.equal(orderCourierFee(mk('shipped')), 0);
assert.equal(orderCourierFee({ status: 'delivered', totalAmount: 100 }), 0);     // no courier
assert.equal(orderCashHeld(mk('delivered')), 500);
assert.equal(orderCashHeld(mk('returned')), 0);
assert.equal(orderCashHeld(mk('shipped')), 0);
assert.equal(orderCashHeld(mk('delivered', { courier: { ...courier, collectsCash: false } })), 0);
ok('one order: fee when delivered, return share when returned, nothing when open/cancelled; cash only when the courier collects');

// ---- statement ----
const orders = [
  mk('delivered'),
  mk('delivered'),
  mk('returned'),
  mk('cancelled'),
  mk('shipped'),
  mk('delivered', { courier: { ...courier, id: 'c2', name: 'Ali' } }),   // someone else's
  mk('delivered', { courier: { ...courier, collectsCash: false } }),      // shop collected this one
];
let s = courierStatement('c1', orders, []);
assert.deepEqual(
  [s.assigned, s.delivered, s.returned, s.cancelled, s.open],
  [6, 3, 1, 1, 1]
);
assert.equal(s.cash, 1000);                       // 2 delivered orders with courier cash
assert.equal(s.fees, 45 * 3 + 22.5);              // 3 delivered + 1 returned share
assert.equal(s.balance, 1000 - 157.5);
ok('statement: counts, cash held, fees earned, balance = cash - fees');

const settlements = [
  { courierId: 'c1', amount: 800 },
  { courierId: 'c1', amount: -50 },    // shop paid the courier 50
  { courierId: 'c2', amount: 999 },    // other courier: ignored
];
s = courierStatement('c1', orders, settlements);
assert.equal(s.settled, 750);
assert.equal(s.balance, 1000 - 157.5 - 750);
ok('handovers reduce the balance (signed: courier -> shop is +, shop -> courier is -); other couriers ignored');

// shop collects the cash: the shop owes the courier the fees
const shopCash = [mk('delivered', { courier: { ...courier, collectsCash: false } })];
s = courierStatement('c1', shopCash, []);
assert.equal(s.balance, -45);
s = courierStatement('c1', shopCash, [{ courierId: 'c1', amount: -45 }]);
assert.equal(s.balance, 0);
ok('shop collects the cash: balance is negative (you owe the courier) until you record paying them');

assert.equal(courierStatement('c1', [{ ...mk('delivered'), deleted: true }], []).assigned, 0);
ok('deleted orders are ignored');

// ---- handover form ----
assert.deepEqual(cleanSettlement({ amount: '100.456', direction: 'in', note: ' hi ' }), { ok: true, value: { amount: 100.46, note: 'hi' } });
assert.equal(cleanSettlement({ amount: '100', direction: 'out' }).value.amount, -100);
assert.equal(cleanSettlement({ amount: '0', direction: 'in' }).ok, false);
assert.equal(cleanSettlement({ amount: '-5', direction: 'in' }).ok, false);
assert.equal(cleanSettlement({ amount: 'abc', direction: 'in' }).ok, false);
ok('handover form: positive amounts only, direction gives the sign, rounded to 2 decimals');

// ---- profit ----
const now = new Date('2026-10-27T12:00:00Z');
const day = (d) => ({ status: 'delivered', timestamp: d });
const profitOrders = [
  { status: 'delivered', totalAmount: 500, items: [{ unitCost: 100, quantity: 1 }], statusHistory: [day('2026-10-05T10:00:00Z')], courier },
  { status: 'delivered', totalAmount: 300, items: [{ unitCost: 100, quantity: 1 }], statusHistory: [day('2026-09-20T10:00:00Z')], courier },
  { status: 'returned', totalAmount: 200, items: [], statusHistory: [{ status: 'returned', timestamp: '2026-10-10T10:00:00Z' }], courier },
  { status: 'delivered', totalAmount: 100, items: [{ unitCost: 10, quantity: 1 }], statusHistory: [day('2026-10-06T10:00:00Z')] }, // no courier
];
let p = calcProfit(profitOrders, [{ amount: 50, date: '2026-10-02' }], 'thisMonth', now);
assert.equal(p.courierFeesTotal, 45 + 22.5);
assert.equal(p.revenue, 600);
assert.equal(p.netProfit, 600 - 110 - 50 - 67.5);
p = calcProfit(profitOrders, [], 'lastMonth', now);
assert.equal(p.courierFeesTotal, 45);
p = calcProfit(profitOrders, [], 'all', now);
assert.equal(p.courierFeesTotal, 45 + 45 + 22.5);
p = calcProfit([{ status: 'delivered', totalAmount: 100, items: [], statusHistory: [day('2026-10-06T10:00:00Z')] }], [], 'all', now);
assert.equal(p.courierFeesTotal, 0);
assert.equal(p.netProfit, 100);
ok('profit: courier fees (delivered + returned share) are taken off net profit, in the month of delivery / return; no courier = no change');

// ---- rules text (the rules cannot be emulator-tested here, but the shape is checked) ----
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const block = (name) => {
  const i = rules.indexOf(`match /${name} {`);
  assert.ok(i > -1, name + ' block missing');
  return rules.slice(i, rules.indexOf('\n    }\n', i));
};
const c = block('couriers/{courierId}');
assert.ok(/allow read: if canManage\(resource\.data\.tenantId\)/.test(c));
assert.ok(/allow delete: if false/.test(c));
assert.ok(!/staff/.test(c));
const sl = block('courierSettlements/{entryId}');
assert.ok(/allow read: if canManage/.test(sl));
assert.ok(/allow update, delete: if false/.test(sl));
assert.ok(/createdByUid == request\.auth\.uid/.test(sl));
ok('rules text: couriers and handovers only for owner/manager, handovers add-only');

// ---- the staff role cannot open the page or assign couriers ----
const { can, canManageCouriers } = await import('../src/utils/roles.js');
assert.equal(can('staff', 'couriers'), false);
assert.equal(can('manager', 'couriers'), true);
assert.equal(canManageCouriers('staff'), false);
assert.equal(canManageCouriers('owner'), true);
ok('roles: owner and manager manage couriers, staff does not');

console.log(`ALL ${n} COURIER CHECK GROUPS PASSED`);
