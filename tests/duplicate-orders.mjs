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
import { cleanOrderToken, tokenRef } from '../api/_lib/orderToken.js';
import { makeTokenKeeper, randomToken } from '../src/utils/orderToken.js';

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
const cust = { name: 'Ali Hassan', phone: '01000000000', city: 'Cairo', street: 'Nile Street' };
const input = (extra = {}) => validateInput({ tenantId: 'bynd', customer: cust, items: [{ productId: 'p1', quantity: 2, selections: {} }], ...extra });
const ordersIn = (db) => [...db.store.keys()].filter((k) => /^orders\/[^/]+$/.test(k));
let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8';

// 1. same code twice (even at the very same moment) = ONE order, ONE stock deduction
let db = world();
const first = await placeOrder(db, input({ orderToken: TOKEN }));
const second = await placeOrder(db, input({ orderToken: TOKEN }));
assert.equal(first.duplicate, undefined); assert.equal(second.duplicate, true);
assert.equal(second.orderId, first.orderId); assert.equal(second.orderNumberLabel, first.orderNumberLabel); assert.equal(second.totalAmount, 200);
assert.equal(ordersIn(db).length, 1); assert.equal(db.store.get('products/p1').stock, 3, 'stock taken once, not twice');
db = world();
const both = await Promise.all([placeOrder(db, input({ orderToken: TOKEN })), placeOrder(db, input({ orderToken: TOKEN }))]);
assert.equal(both[0].orderId, both[1].orderId); assert.equal(ordersIn(db).length, 1); assert.equal(db.store.get('products/p1').stock, 3);
assert.equal(db.store.get('counters/bynd').current, 1001);
ok('the same one-time code twice (after each other, or two taps at once) = one order, stock taken once, order number used once');

// 2. different codes / no code = separate orders (nothing changes for old behaviour)
db = world();
await placeOrder(db, input({ orderToken: TOKEN })); await placeOrder(db, input({ orderToken: 'z'.repeat(20) }));
assert.equal(ordersIn(db).length, 2);
db = world(); await placeOrder(db, input()); await placeOrder(db, input()); assert.equal(ordersIn(db).length, 2);
ok('another code, or no code at all, still makes a new order');

// 3. the code is only a safe shape; a code is per shop; the raw code is never stored
assert.equal(cleanOrderToken('short'), ''); assert.equal(cleanOrderToken('x'.repeat(65)), ''); assert.equal(cleanOrderToken('has space has space1'), '');
assert.equal(cleanOrderToken(undefined), ''); assert.equal(cleanOrderToken({}), ''); assert.equal(cleanOrderToken(` ${TOKEN} `), TOKEN);
assert.equal(input({ orderToken: '../../etc/passwd!!' }).orderToken, '');
db = world();
const a = tokenRef(db, 'bynd', TOKEN), b = tokenRef(db, 'other', TOKEN);
assert.notEqual(a.path, b.path); assert.ok(!a.path.includes(TOKEN));
await placeOrder(db, input({ orderToken: TOKEN }));
assert.ok(!JSON.stringify([...db.store.entries()].filter(([k]) => k.startsWith('orderTokens/'))).includes(TOKEN));
const tokenDoc = db.store.get(a.path); assert.equal(tokenDoc.tenantId, 'bynd'); assert.ok(tokenDoc.expireAt instanceof Date && tokenDoc.expireAt > new Date());
ok('a bad-shaped code is ignored, the same code in another shop is a different entry, the code itself is never stored (only a hash), old entries get an expiry date');

// 4. the real handler: a retry returns the same order + receipt, counts nothing, alerts nobody
const handlerDb = world();
let alerts = 0;
const mod = await bundle(`export { default } from ${JSON.stringify(root + '/api/create-order.js')};`, {
  '_lib/db\\.js$': `export const getDb = () => globalThis.__db;`,
  '@vercel/functions': `export const waitUntil = () => {};`,
  '_lib/notify\\.js$': `export const notifyNewOrder = async () => { globalThis.__alerts = (globalThis.__alerts || 0) + 1; };`,
});
handlerDb.store.set('products/p1', { ...handlerDb.store.get('products/p1'), stock: 100 });
globalThis.__db = handlerDb;
const call = async (body, ip = '1.2.3.4') => { const box = {}; await mod.default({ method: 'POST', headers: { 'x-real-ip': ip }, body }, { status(c) { box.status = c; return this; }, json(x) { box.body = x; return this; }, setHeader() {} }); return box; };
const body = { tenantId: 'bynd', customer: cust, items: [{ productId: 'p1', quantity: 2, selections: {} }], orderToken: TOKEN };
const r1 = await call(body); const limitsAfter1 = JSON.stringify([...handlerDb.store.entries()].filter(([k]) => k.startsWith('rateLimits/')));
const r2 = await call(body);
assert.equal(r1.status, 200); assert.equal(r2.status, 200);
assert.equal(r2.body.orderId, r1.body.orderId); assert.equal(r2.body.orderNumberLabel, r1.body.orderNumberLabel);
assert.deepEqual(r2.body.receipt, r1.body.receipt); assert.equal(r2.body._order, undefined);
assert.equal(ordersIn(handlerDb).length, 1); assert.equal(handlerDb.store.get('products/p1').stock, 98);
assert.equal(JSON.stringify([...handlerDb.store.entries()].filter(([k]) => k.startsWith('rateLimits/'))), limitsAfter1, 'a retry counts nothing against the limits');
assert.equal(globalThis.__alerts, 1, 'the team is alerted once');
// a customer who is already at the phone limit still gets their own order back on a retry
for (let i = 0; i < 6; i++) await call({ ...body, orderToken: undefined }, '9.9.9.9');
const blocked = await call({ ...body, orderToken: undefined });
assert.equal(blocked.status, 429);
const retryAtLimit = await call(body);
assert.equal(retryAtLimit.status, 200); assert.equal(retryAtLimit.body.orderId, r1.body.orderId);
ok('/api/create-order: a retry gets the same order number + receipt back, no second order / stock / alert / limit count, and works even when the phone limit is used up');

// 5. the browser keeper: same content = same code; any change = new code; reset = new code
let i = 0; const keeper = makeTokenKeeper(() => `tok-${++i}`);
const p1 = { items: [{ id: 'p1', q: 2 }], form: { name: 'Ali' } };
assert.equal(keeper.get(p1), 'tok-1'); assert.equal(keeper.get(structuredClone(p1)), 'tok-1');
assert.equal(keeper.get({ ...p1, form: { name: 'Ali H' } }), 'tok-2'); assert.equal(keeper.get({ items: [{ id: 'p1', q: 3 }], form: { name: 'Ali H' } }), 'tok-3');
keeper.reset(); assert.equal(keeper.get(p1), 'tok-4');
const real = randomToken(); assert.equal(cleanOrderToken(real), real); assert.notEqual(randomToken(), real);
assert.ok(cleanOrderToken(randomToken({})), 'the fallback (no crypto) also makes a valid code');
ok('browser: same cart + details keep the code, any change makes a new one, reset starts over, codes pass the server check (also without crypto)');

// 6. wiring: checkout sends the code and clears the keeper only after success; the service passes it on
const checkout = fs.readFileSync(path.join(root, 'src/pages/storefront/Checkout.jsx'), 'utf8');
assert.match(checkout, /orderToken: tokenKeeper\.current\.get\(/); assert.ok(checkout.indexOf('tokenKeeper.current.reset()') > checkout.indexOf('await createOrder('));
assert.match(fs.readFileSync(path.join(root, 'src/firebase/orders.service.js'), 'utf8'), /orderToken: orderToken \|\| ''/);
ok('the checkout page sends the code with the order and forgets it only after a successful order');

console.log('\nALL 6 DUPLICATE-ORDER CHECK GROUPS PASSED');
