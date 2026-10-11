import assert from 'node:assert/strict';
import { ALL_STATUSES, STATUS_FLOW, nextStatus, canReturnStatus, canCancelStatus, stockToRestore, statusBadgeClass } from '../src/utils/orderRules.js';
import { calcProfit } from '../src/utils/profit.js';
import { calcDashboard, daysSince } from '../src/utils/stats.js';
import { csvCell, toCsv } from '../src/utils/csv.js';
import { ordersToCsv, productsToCsv, expensesToCsv } from '../src/utils/exports.js';
import { backupToJson } from '../src/utils/backup.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const ts = (iso) => ({ seconds: Math.floor(new Date(iso).getTime() / 1000), nanoseconds: 0 });

// ---- statuses ----
assert.deepEqual(ALL_STATUSES, [...STATUS_FLOW, 'cancelled', 'returned']);
assert.equal(nextStatus('pending'), 'confirmed'); assert.equal(nextStatus('shipped'), 'delivered'); assert.equal(nextStatus('delivered'), null); assert.equal(nextStatus('returned'), null);
assert.ok(canReturnStatus('shipped') && canReturnStatus('delivered') && !canReturnStatus('pending') && !canReturnStatus('processing') && !canReturnStatus('cancelled') && !canReturnStatus('returned'));
assert.ok(canCancelStatus('pending') && canCancelStatus('shipped') && !canCancelStatus('delivered') && !canCancelStatus('cancelled') && !canCancelStatus('returned'));
assert.ok(statusBadgeClass('returned').includes('rust') && statusBadgeClass('delivered').includes('sage'));
ok('statuses: a parcel can come back only after shipping; cancelling only before delivery');

// ---- stock to put back: one total per product, never for preorder lines ----
const order = { items: [
  { productId: 'board', quantity: 2, isPreorder: false }, { productId: 'board', quantity: 3, isPreorder: false },   // same product, two colors
  { productId: 'plate', quantity: 1 }, { productId: 'pre', quantity: 4, isPreorder: true } ] };
assert.deepEqual(stockToRestore(order), [{ productId: 'board', quantity: 5 }, { productId: 'plate', quantity: 1 }]);
assert.deepEqual(stockToRestore({ items: [] }), []); assert.deepEqual(stockToRestore({}), []);
ok('stock to restore: same product on two lines = one total (5); preorder lines excluded');

// ---- profit: returned orders are not income and not "money on its way" ----
const now = new Date('2026-10-15T12:00:00');
const orders = [
  { status: 'delivered', totalAmount: 1000, items: [{ unitCost: 300, quantity: 1 }], statusHistory: [{ status: 'delivered', timestamp: '2026-10-10T10:00:00' }], createdAt: ts('2026-10-09T10:00:00') },
  { status: 'returned', totalAmount: 900, items: [{ unitCost: 300, quantity: 1 }], statusHistory: [{ status: 'delivered', timestamp: '2026-10-11T10:00:00' }, { status: 'returned', timestamp: '2026-10-12T10:00:00' }], createdAt: ts('2026-10-10T10:00:00') },
  { status: 'shipped', totalAmount: 500, items: [{ unitCost: 100, quantity: 1 }], createdAt: ts('2026-10-14T10:00:00') },
  { status: 'pending', totalAmount: 200, items: [{ unitCost: 50, quantity: 1 }], createdAt: ts('2026-10-15T09:00:00') },
  { status: 'cancelled', totalAmount: 700, items: [], createdAt: ts('2026-09-30T09:00:00') } ];
const p = calcProfit(orders, [{ amount: 100, date: '2026-10-02' }], 'thisMonth', now);
assert.deepEqual([p.revenue, p.cogs, p.grossProfit, p.netProfit, p.expectedRevenue], [1000, 300, 700, 600, 700]);
ok('returned orders drop out of revenue; open money = shipped + pending only (700)');

// ---- dashboard ----
const products = [
  { id: 'a', name: { en: 'A' }, stock: 10, isActive: true }, { id: 'b', name: { en: 'B' }, stock: 2, isActive: true },
  { id: 'c', name: { en: 'C' }, stock: 0, isActive: true }, { id: 'pre', name: { en: 'Pre' }, stock: 0, isPreorder: true, isActive: true }, { id: 'nocost', name: { en: 'N' }, stock: 5, isActive: true } ];
const costs = { a: 100, b: 50, c: 10, pre: 5 };
const d = calcDashboard({ orders, products, costs, expenses: [{ amount: 100, date: '2026-10-02' }, { amount: 40, date: '2026-09-02' }], period: 'thisMonth', now });
assert.deepEqual(d.counts, { pending: 1, inProgress: 1, delivered: 1, cancelled: 1, returned: 1, total: 5 });
assert.equal(d.sales.revenue, 1000); assert.equal(d.sales.expensesTotal, 100); assert.equal(d.sales.netProfit, 600);
assert.equal(d.ordersInPeriod, 4);                                       // created this month (one was in September)
assert.equal(d.inventory.units, 17);                                     // preorder product doesn't count
assert.equal(d.inventory.valueAtCost, 10 * 100 + 2 * 50 + 0 * 10); assert.equal(d.inventory.valueKnown, false);   // 'nocost' has stock but no cost
assert.deepEqual(d.inventory.lowStock.map((x) => x.id), ['c', 'b']);     // sorted: out of stock first; preorder never listed
assert.deepEqual(d.recent.map((o) => o.status), ['pending', 'shipped', 'returned', 'delivered', 'cancelled']);   // newest first
const all = calcDashboard({ orders, products, costs, expenses: [{ amount: 40, date: '2026-09-02' }], period: 'all', now });
assert.equal(all.ordersInPeriod, 5); assert.equal(all.sales.expensesTotal, 40);
assert.equal(calcDashboard({ orders: [], products: [], now }).inventory.valueKnown, true);
ok('dashboard numbers: counts by status, sales/profit for the period, stock units and value, low stock, newest orders first');

assert.equal(daysSince(null, now), null); assert.equal(daysSince('2026-10-08T12:00:00', now), 7); assert.equal(daysSince('garbage', now), null);
ok('backup reminder: days since the last backup');

// ---- spreadsheet files ----
assert.equal(csvCell('a,b'), '"a,b"'); assert.equal(csvCell('say "hi"'), '"say ""hi"""'); assert.equal(csvCell('l1\nl2'), '"l1\nl2"');
assert.equal(csvCell(null), ''); assert.equal(csvCell(850), '850'); assert.equal(csvCell(-50), '-50'); assert.equal(csvCell(NaN), '');
assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`); assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)"); assert.equal(csvCell('-cmd|x'), "'-cmd|x");
assert.equal(csvCell('+20 102 640 9664'), '+20 102 640 9664'); assert.equal(csvCell('01026409664'), '01026409664');
assert.ok(toCsv([{ header: 'م', value: (r) => r.a }], [{ a: 'مرحبا' }]).startsWith('\uFEFFم\r\nمرحبا'.slice(0, 3)));
ok('CSV: quotes/commas/new lines escaped, formulas defused, phone numbers untouched, Arabic-safe BOM');

const t = (key, opts) => ({ 'orders.yes': 'Yes', 'orders.preorder': 'Preorder', 'admin.status.shipped': 'Shipped' }[key] || opts?.defaultValue || key);
const row = { orderNumberLabel: 'BYND-1007', createdAt: ts('2026-10-14T10:05:00'), status: 'shipped', orderType: 'preorder',
  customer: { name: 'Ali', phone: '+20 100', city: 'Cairo', address: '1 Nile St, Cairo', notes: 'call first' },
  items: [{ quantity: 2, name: { en: 'Board', ar: 'لوحة' }, options: [{ label: { en: 'Distance', ar: 'المسافة' }, type: 'choice', value: { en: 'Marathon', ar: 'ماراثون' } }, { label: { en: 'My time', ar: 'وقتي' }, type: 'addon', text: '03:55:10' }] }],
  subtotal: 1700, discount: 170, promo: { code: 'TEN' }, shipping: { zoneName: { en: 'Cairo', ar: 'القاهرة' } }, shippingFee: 50, totalAmount: 1580, customFields: [{ label: { en: 'Gift', ar: 'هدية' }, type: 'text', value: 'yes!' }] };
const csv = ordersToCsv([row], { language: 'en', t }); const lines = csv.split('\r\n');
assert.equal(lines.length, 2); assert.ok(lines[1].startsWith('BYND-1007,'));
assert.ok(csv.includes('2 × Board (Distance: Marathon, My time: Yes ""03:55:10"")') && csv.includes('1580') && csv.includes('TEN') && csv.includes('Gift: yes!') && csv.includes('Shipped') && csv.includes('Preorder') && csv.includes('2026-10-14 10:05'));
assert.ok(ordersToCsv([row], { language: 'ar', t }).includes('2 × لوحة (المسافة: ماراثون'));
const pc = productsToCsv([{ id: 'a', sku: 'S1', name: { en: 'A' }, price: 400, stock: 3, isActive: true }, { id: 'p', name: { en: 'P' }, price: 600, isPreorder: true, isActive: true }], { a: 150 }, { language: 'en', t, includeCost: true });
assert.ok(pc.includes('S1,A,400,150,3') && pc.split('\r\n')[2].startsWith(',P,600,,,Yes,Yes')); assert.ok(!productsToCsv([], {}, { language: 'en', t, includeCost: false }).includes('exports.cost'));
assert.ok(expensesToCsv([{ date: '2026-10-02', category: 'packaging', description: 'Boxes, tape', amount: 120 }], { t }).includes('"Boxes, tape",120'));
ok('exports: orders (items + choices + totals, English/Arabic), products (cost only for managers), expenses');

// ---- backup file ----
const json = JSON.parse(backupToJson({ orders: [{ createdAt: { seconds: 1760000000, nanoseconds: 0 } }], shop: { name: 'BYND' } }));
assert.equal(json.orders[0].createdAt, new Date(1760000000 * 1000).toISOString()); assert.equal(json.shop.name, 'BYND');
ok('backup file: Firestore dates become readable text');
console.log(`\nALL ${n} OPERATIONS CHECK GROUPS PASSED`);
