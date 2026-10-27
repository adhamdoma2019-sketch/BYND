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

// ---- update 21: cash to collect, exports with courier columns, daily report ----
const { expectedCash, localDay, courierDayReport, round2 } = await import('../src/utils/couriers.js');
const { ordersToCsv, courierDayToCsv } = await import('../src/utils/exports.js');

const codCourier = { id: 'c1', name: 'Bosta', collectsCash: true, fee: 45, returnFeePercent: 50 };
const shopCashCourier = { id: 'c2', name: 'Ali (own)', collectsCash: false, fee: 20, returnFeePercent: 100 };
assert.equal(expectedCash({ courier: codCourier, status: 'shipped', totalAmount: 500 }), 500);
assert.equal(expectedCash({ courier: codCourier, status: 'delivered', totalAmount: 500 }), 500);
assert.equal(expectedCash({ courier: codCourier, status: 'cancelled', totalAmount: 500 }), 0);
assert.equal(expectedCash({ courier: codCourier, status: 'returned', totalAmount: 500 }), 0);
assert.equal(expectedCash({ courier: shopCashCourier, status: 'shipped', totalAmount: 500 }), 0);
assert.equal(expectedCash({ status: 'shipped', totalAmount: 500 }), 0);
ok('cash to collect: open/delivered orders of a cash-collecting courier only; cancelled, returned, shop-cash, no courier = 0');

assert.equal(localDay(new Date(2026, 9, 27, 23, 30)), '2026-10-27');
assert.equal(localDay(new Date(2026, 0, 5, 0, 5)), '2026-01-05');
assert.equal(localDay('not a date'), '');
ok('localDay: the shop team\'s own calendar day, zero-padded');

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();
const hist = (status, iso) => [{ status: 'pending', timestamp: at(2026, 10, 1) }, { status, timestamp: iso }];
const o1 = { id: 'o1', orderNumberLabel: 'BYND-1001', status: 'delivered', totalAmount: 500, courier: codCourier, statusHistory: hist('delivered', at(2026, 10, 27, 9)), shipping: { zoneName: { en: 'Cairo', ar: 'القاهرة' } } };
const o2 = { id: 'o2', orderNumberLabel: 'BYND-1002', status: 'returned', totalAmount: 300, courier: codCourier, statusHistory: hist('returned', at(2026, 10, 27, 20)) };
const o3 = { id: 'o3', orderNumberLabel: 'BYND-1003', status: 'delivered', totalAmount: 200, courier: codCourier, statusHistory: hist('delivered', at(2026, 10, 26, 20)) }; // other day
const o4 = { id: 'o4', orderNumberLabel: 'BYND-1004', status: 'delivered', totalAmount: 400, courier: shopCashCourier, statusHistory: hist('delivered', at(2026, 10, 27, 15)) };
const o5 = { id: 'o5', orderNumberLabel: 'BYND-1005', status: 'cancelled', totalAmount: 100, courier: codCourier, statusHistory: hist('cancelled', at(2026, 10, 27, 10)) };
const o6 = { id: 'o6', orderNumberLabel: 'BYND-1006', status: 'shipped', totalAmount: 100, courier: codCourier, statusHistory: hist('shipped', at(2026, 10, 27, 10)) };
const o7 = { id: 'o7', orderNumberLabel: 'BYND-1007', status: 'delivered', totalAmount: 100, statusHistory: hist('delivered', at(2026, 10, 27, 10)) }; // no courier
const o8 = { id: 'o8', orderNumberLabel: 'BYND-1008', status: 'delivered', totalAmount: 100, courier: codCourier, deleted: true, statusHistory: hist('delivered', at(2026, 10, 27, 10)) };
const people = [{ id: 'c1', name: 'Bosta' }, { id: 'c2', name: 'Ali (own)' }];
const sets = [
  { courierId: 'c1', courierName: 'Bosta', amount: 300, date: '2026-10-27' },
  { courierId: 'c1', courierName: 'Bosta', amount: -50, date: '2026-10-27' },
  { courierId: 'c1', courierName: 'Bosta', amount: 999, date: '2026-10-26' },
  { courierId: 'c3', courierName: 'Only paid', amount: -70, date: '2026-10-27' }, // no orders that day
];
const rep = courierDayReport([o1, o2, o3, o4, o5, o6, o7, o8], people, sets, '2026-10-27');
assert.deepEqual(rep.map((r) => r.name), ['Ali (own)', 'Bosta', 'Only paid']);
const bosta27 = rep.find((r) => r.courierId === 'c1');
assert.equal(bosta27.delivered, 1);
assert.equal(bosta27.returned, 1);
assert.equal(bosta27.cash, 500);        // only the delivered order holds cash
assert.equal(bosta27.fees, 45 + 22.5);  // full fee + 50% for the return
assert.equal(bosta27.handedIn, 300);
assert.equal(bosta27.paidOut, 50);
assert.deepEqual(bosta27.orders.map((x) => x.order.id), ['o1', 'o2']);
const ali27 = rep.find((r) => r.courierId === 'c2');
assert.equal(ali27.cash, 0);            // the shop collects the cash for this courier
assert.equal(ali27.fees, 20);
const paidOnly = rep.find((r) => r.courierId === 'c3');
assert.equal(paidOnly.paidOut, 70);
assert.equal(paidOnly.orders.length, 0);
assert.equal(courierDayReport([o1], people, [], '2026-10-28').length, 0);
ok('daily report: groups by courier, uses the delivered/returned date, skips open/cancelled/deleted/no-courier orders, handovers of that day only, courier with only a handover still listed');

// the day report must agree with the all-time statement
const all = courierStatement('c1', [o1, o2, o3, o5, o6], []);
const day26 = courierDayReport([o1, o2, o3, o5, o6], people, [], '2026-10-26')[0];
assert.equal(round2(bosta27.cash + day26.cash), all.cash);
assert.equal(round2(bosta27.fees + day26.fees), all.fees);
ok('daily report adds up to the courier statement (cash and fees)');

// ---- order export: courier columns, fee only for owner/manager ----
const tt = (key, o) => ({ 'exports.courier': 'Courier', 'exports.courierCash': 'Cash the courier collects', 'exports.courierFee': 'Courier fee', 'exports.cashCollected': 'Cash collected', 'exports.orderNo': 'Order', 'exports.status': 'Status', 'exports.zone': 'Delivery area' }[key] || o?.defaultValue || key);
const manager = ordersToCsv([o6, o7], { language: 'en', t: tt, includeCourierFee: true }).split('\r\n');
const staff = ordersToCsv([o6, o7], { language: 'en', t: tt }).split('\r\n');
assert.ok(manager[0].includes('Courier,Cash the courier collects,Courier fee'));
assert.ok(staff[0].includes('Courier,Cash the courier collects'));
assert.ok(!staff[0].includes('Courier fee'));
assert.ok(manager[1].includes(',Bosta,100,45,'));       // courier, cash, fee
assert.ok(staff[1].includes(',Bosta,100,') && !staff[1].includes(',Bosta,100,45'));
assert.ok(manager[2].includes(',,,,') || manager[2].includes(',,,'));  // order without a courier: empty cells
assert.equal(staff.length, 3);
ok('order export: courier + cash columns for everyone, fee column only when allowed (staff file has no fee)');

const dayCsv = courierDayToCsv(rep, { language: 'en', t: tt }).split('\r\n');
assert.equal(dayCsv.length, 1 + 3); // header + o1, o2 (Bosta) + o4 (Ali)
assert.ok(dayCsv.some((l) => l.startsWith('Bosta,BYND-1001,')) && dayCsv.some((l) => l.includes('BYND-1002')));
ok('daily report file: one line per delivered/returned order');

// the Orders page must ask for the fee column only for people who may manage couriers
const ordersPage = readFileSync(new URL('../src/pages/admin/Orders.jsx', import.meta.url), 'utf8');
assert.ok(ordersPage.includes('includeCourierFee: canCourier'));
ok('Orders page passes the fee permission to the export');

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
