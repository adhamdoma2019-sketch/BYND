// GO-LIVE REHEARSAL (update 60): attack / abuse checks on the REAL order code. (copied helper from duplicate-orders.mjs)
// Update 38: duplicate-order protection. Pressing "Place order" again after a lost answer must give back the SAME order
// (no second order, no second stock deduction, no second alert, no extra phone count). Real order code + real handler,
// pretend database (its transactions run one after the other, like Firestore retries them).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { placeOrder, validateInput } from '../api/_lib/placeOrder.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const bundle = async (entry, stubs = {}) => {
  const outfile = path.join(root, 'tests', `.dup-${process.pid}.cjs`);
  await build({ stdin: { contents: entry, resolveDir: root, loader: 'js' }, bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error',
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => { for (const k of Object.keys(stubs)) if (new RegExp(k).test(a.path)) return { path: a.path, namespace: 'stub' }; return null; });
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => { for (const [k, v] of Object.entries(stubs)) if (new RegExp(k).test(a.path)) return { contents: v, loader: 'js', resolveDir: root }; });
    } }] });
  const m = req(outfile); fs.rmSync(outfile, { force: true }); return m;
};

const L = (en, ar = en) => ({ en, ar });
const world = () => {
  const store = new Map(Object.entries({
    'tenants/bynd': { slug: 'bynd', isActive: true },
    'tenants/other': { slug: 'other', isActive: true },
    'products/p1': { tenantId: 'bynd', name: L('Plate', 'لوحة'), price: 100, stock: 5, isActive: true, deleted: false },
    'productCosts/p1': { tenantId: 'bynd', costPrice: 40, optionCosts: {} },
  }));
  let auto = 0; let chain = Promise.resolve();
  const ref = (cc, id) => ({ col: cc, id, path: `${cc}/${id}`,
    get: async () => snap(ref(cc, id)), collection: (sub) => ({ doc: (sid) => ref(`${cc}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  const db = { store, collection: (cc) => ({ doc: (id) => ref(cc, id ?? `auto${++auto}`) }),
    runTransaction(fn) {
      const run = async () => { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, op) => w.push(['s', r, d, op]) };
        const out = await fn(tx); for (const [k, r, d, op] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (op?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; };
      const p = chain.then(run, run); chain = p.catch(() => {}); return p; } };
  return db;
};

const world2 = () => {
  const db = world();
  const s = db.store;
  s.set('products/inactive', { tenantId: 'bynd', name: L('Off'), price: 10, stock: 5, isActive: false, deleted: false });
  s.set('products/deleted', { tenantId: 'bynd', name: L('Gone'), price: 10, stock: 5, isActive: true, deleted: true });
  s.set('products/soon', { tenantId: 'bynd', name: L('Soon'), price: 10, stock: 5, isActive: true, deleted: false, comingSoon: true });
  s.set('products/foreign', { tenantId: 'other', name: L('Other shop'), price: 10, stock: 5, isActive: true, deleted: false });
  s.set('products/last', { tenantId: 'bynd', name: L('Last one'), price: 50, stock: 1, isActive: true, deleted: false });
  s.set('tenants/closed', { slug: 'closed', isActive: false });
  return db;
};
const cust = { name: 'Ali Hassan', phone: '01000000000', city: 'Cairo', street: 'Nile Street' };
const mk = (items, extra = {}) => ({ tenantId: 'bynd', customer: cust, items, ...extra });
const ordersIn = (db) => [...db.store.keys()].filter((k) => /^orders\/[^/]+$/.test(k));
const refused = async (db, body) => { try { await placeOrder(db, validateInput(body)); } catch (e) { return e.code || 'ERR'; } return null; };
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. the browser can NOT set prices, totals or costs
let db = world2();
const r = await placeOrder(db, validateInput(mk([{ productId: 'p1', quantity: 2, selections: {}, unitPrice: 1, price: 1, lineTotal: 1, packageSize: 2, unitCost: 0, tierMinQty: 1 }], { totalAmount: 1, shippingFee: 0, discount: 999 })));
assert.equal(r.totalAmount, 200, 'price comes from the product, not from the browser');
const saved = db.store.get(`orders/${r.orderId}`);
assert.equal(saved.items[0].unitPrice, 100); assert.equal(saved.items[0].unitCost, 40); assert.equal(saved.items[0].lineTotal, undefined);
ok('edited price / total / discount / cost sent by the browser are ignored (200 = 2 x 100)');

// 2. products that must never be sold
for (const id of ['inactive', 'deleted', 'soon', 'foreign', 'missing-id']) {
  db = world2();
  const code = await refused(db, mk([{ productId: id, quantity: 1, selections: {} }]));
  assert.ok(code, `${id} must be refused`); assert.equal(ordersIn(db).length, 0);
}
ok('switched-off, deleted, coming-soon, another shop\'s and unknown products are refused; nothing saved');

// 3. odd quantities
for (const q of [0, -1, 1.5, NaN, 501, 1e9, '2; DROP', null, {}]) {
  db = world2();
  const code = await refused(db, mk([{ productId: 'p1', quantity: q, selections: {} }]));
  assert.ok(code, `quantity ${String(q)} must be refused`); assert.equal(ordersIn(db).length, 0); assert.equal(db.store.get('products/p1').stock, 5);
}
ok('zero, negative, fractional, NaN, huge and text quantities are refused; stock untouched');

// 4. empty cart, no shop, closed shop, junk body
db = world2();
assert.ok(await refused(db, mk([])));
assert.ok(await refused(db, { customer: cust, items: [{ productId: 'p1', quantity: 1, selections: {} }] }));
assert.ok(await refused(db, mk([{ productId: 'p1', quantity: 1, selections: {} }], { tenantId: 'closed' })));
assert.ok(await refused(db, mk([{ productId: 'p1', quantity: 1, selections: {} }], { tenantId: 'nope' })));
assert.throws(() => validateInput(null)); assert.throws(() => validateInput('x'));
assert.equal(ordersIn(db).length, 0);
ok('empty cart, missing shop, switched-off shop, unknown shop and junk bodies are refused');

// 5. overselling: more than the stock, and two buyers for the last piece at the same moment
db = world2();
assert.ok(await refused(db, mk([{ productId: 'p1', quantity: 6, selections: {} }]))); assert.equal(db.store.get('products/p1').stock, 5);
db = world2();
const race = await Promise.allSettled([placeOrder(db, validateInput(mk([{ productId: 'last', quantity: 1, selections: {} }]))), placeOrder(db, validateInput(mk([{ productId: 'last', quantity: 1, selections: {} }])))]);
assert.equal(race.filter((x) => x.status === 'fulfilled').length, 1, 'exactly one buyer gets the last piece');
assert.equal(db.store.get('products/last').stock, 0); assert.equal(ordersIn(db).length, 1);
ok('more than the stock is refused; two buyers for the last piece = exactly one order, stock 0 (never negative)');

// 6. promo guessing and fake delivery area
db = world2();
for (const code of ['11', 'FREE', "' OR 1=1", '<script>']) assert.ok(await refused(db, mk([{ productId: 'p1', quantity: 1, selections: {} }], { promoCode: code })), `promo ${code}`);
// a shop WITH delivery areas: a missing or invented area is refused, a real one is priced by the server
db.store.set('tenants/bynd', { slug: 'bynd', isActive: true, shipping: { zones: [{ id: 'cairo', name: 'Cairo', price: 60, active: true }] } });
assert.equal(await refused(db, mk([{ productId: 'p1', quantity: 1, selections: {} }], { zoneId: 'no-such-area' })), 'BAD_ZONE');
assert.equal(await refused(db, mk([{ productId: 'p1', quantity: 1, selections: {} }])), 'ZONE_REQUIRED');
assert.equal(ordersIn(db).length, 0);
const withZone = await placeOrder(db, validateInput(mk([{ productId: 'p1', quantity: 1, selections: {} }], { zoneId: 'cairo', shippingFee: 0 })));
assert.equal(withZone.totalAmount, 160, '100 + 60 delivery, the browser cannot set the fee');
ok('odd promo codes and invented delivery areas are refused; the real area fee is added by the server');

// 7. fake customer data
for (const bad of [{ ...cust, name: '12345' }, { ...cust, name: 'aaaaaa' }, { ...cust, phone: '123' }, { ...cust, phone: '01999999999' }, { ...cust, city: '' }]) {
  db = world2();
  assert.ok(await refused(db, { tenantId: 'bynd', customer: bad, items: [{ productId: 'p1', quantity: 1, selections: {} }] }), JSON.stringify(bad));
  assert.equal(ordersIn(db).length, 0);
}
ok('digit-only names, repeated letters, short or non-Egyptian-mobile phones and a missing city are refused');

// 8. money is exact and what the customer is told contains no private data
db = world2();
const good = await placeOrder(db, validateInput(mk([{ productId: 'p1', quantity: 3, selections: {} }])));
assert.equal(good.totalAmount, 300);
const publicText = JSON.stringify(good.receipt || {});
assert.ok(!/unitCost|costPrice|stockKeys|tenantId/.test(publicText), 'receipt has no private fields');
assert.equal(db.store.get('products/p1').stock, 2);
ok('a normal order totals exactly, stock goes 5 -> 2, the receipt shows no cost / stock / shop ids');
