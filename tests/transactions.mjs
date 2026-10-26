// Tests the REAL stock-changing code (orders cancel/return, restock, adjust, new products)
// against a small pretend Firestore. The pretend database behaves like the real one in the
// way that matters most here: inside a transaction, every read must happen BEFORE the first write.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const FAKE_FIRESTORE = `
  const store = () => globalThis.__store;
  let counter = 0;
  const makeRef = (p) => ({ path: p, id: p.split('/').pop() });
  export const collection = (_db, ...segs) => ({ segs });
  export const doc = (a, col, id) =>
    a && a.segs && col === undefined ? makeRef(a.segs.join('/') + '/auto' + (++counter)) : makeRef(col + '/' + id);
  export const serverTimestamp = () => ({ __ts: true });
  export const arrayUnion = (...items) => ({ __union: items });
  export const query = () => ({}); export const where = () => ({}); export const orderBy = () => ({}); export const limit = () => ({});
  export const getDocs = async () => ({ docs: [] }); export const getDoc = async () => ({ exists: () => false });
  export const updateDoc = async () => {}; export const setDoc = async () => {}; export const addDoc = async () => {};
  function merge(cur, patch) {
    const next = { ...cur };
    for (const [k, v] of Object.entries(patch)) next[k] = v && v.__union ? [...(cur[k] || []), ...v.__union] : v;
    return next;
  }
  function apply(writes) {
    for (const [kind, ref, data, opts] of writes) {
      const cur = store().get(ref.path) || {};
      store().set(ref.path, kind === 'set' && !(opts && opts.merge) ? { ...data } : merge(cur, data));
    }
  }
  export function writeBatch() {
    const writes = [];
    return { set: (ref, data, opts) => writes.push(['set', ref, data, opts]), update: (ref, data) => writes.push(['update', ref, data]), commit: async () => apply(writes) };
  }
  export async function runTransaction(_db, fn) {
    const writes = []; let wrote = false;
    const tx = {
      async get(ref) {
        if (wrote) throw new Error('Firestore rule broken: a read came after a write');
        const has = store().has(ref.path);
        return { exists: () => has, id: ref.id, data: () => structuredClone(store().get(ref.path)) };
      },
      update(ref, patch) { wrote = true; writes.push(['update', ref, patch]); },
      set(ref, data, opts) { wrote = true; writes.push(['set', ref, data, opts]); },
    };
    const out = await fn(tx);
    apply(writes);
    return out;
  }`;

const out = path.join(os.tmpdir(), `stock-code-${process.pid}.mjs`);
await build({
  stdin: {
    contents: ['orders.service', 'stock.service', 'products.service']
      .map((f) => `export * from ${JSON.stringify(path.join(root, 'src/firebase', f + '.js'))};`)
      .join('\n'),
    resolveDir: root,
    loader: 'js',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  plugins: [{
    name: 'fake-firebase',
    setup(b) {
      b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'fake-firestore', namespace: 'fake' }));
      b.onResolve({ filter: /\/config$/ }, () => ({ path: 'fake-config', namespace: 'fake' }));
      b.onLoad({ filter: /fake-firestore/, namespace: 'fake' }, () => ({ contents: FAKE_FIRESTORE, loader: 'js' }));
      b.onLoad({ filter: /fake-config/, namespace: 'fake' }, () => ({ contents: 'export const db = {};', loader: 'js' }));
    },
  }],
});
const svc = await import(pathToFileURL(out).href);
fs.rmSync(out, { force: true });
const { cancelOrder, returnOrder, restockProduct, adjustStock, createProduct, updateProduct } = svc;

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const rejects = async (p, code) => { try { await p; assert.fail('should reject ' + code); } catch (e) { assert.equal(e.code, code, e.message); } };
const lines = (s) => [...s].filter(([k]) => k.startsWith('tenants/bynd/stockMovements/')).map(([, v]) => v);
const actor = { uid: 'u1', name: 'Mona', email: 'm@x.co' };

// =============== orders: cancel and return ===============
const fresh = () => {
  globalThis.__store = new Map([
    ['products/board', { tenantId: 'bynd', stock: 1, name: { en: 'Board' } }], ['products/plate', { tenantId: 'bynd', stock: 10, name: { en: 'Plate' } }], ['products/pre', { tenantId: 'bynd', stock: 0 }],
    ['orders/o1', { tenantId: 'bynd', orderNumberLabel: 'BYND-1001', status: 'pending', items: [
      { productId: 'board', quantity: 2, name: { en: 'Board' } }, { productId: 'board', quantity: 3, name: { en: 'Board' } },
      { productId: 'plate', quantity: 1, name: { en: 'Plate' } }, { productId: 'pre', quantity: 5, isPreorder: true }], statusHistory: [] }],
    ['orders/shipped', { tenantId: 'bynd', orderNumber: 7, status: 'shipped', items: [{ productId: 'plate', quantity: 4, name: { en: 'Plate' } }], statusHistory: [] }],
    ['orders/done', { tenantId: 'bynd', status: 'delivered', items: [{ productId: 'plate', quantity: 2 }], statusHistory: [] }],
  ]);
  return globalThis.__store;
};

let s = fresh();
await cancelOrder('o1', actor);
assert.equal(s.get('orders/o1').status, 'cancelled');
assert.equal(s.get('products/board').stock, 1 + 5);       // BOTH lines come back (2 + 3), not just one of them
assert.equal(s.get('products/plate').stock, 11); assert.equal(s.get('products/pre').stock, 0);
let h = lines(s); assert.equal(h.length, 2);
let boardLine = h.find((x) => x.productId === 'board');
assert.deepEqual([boardLine.type, boardLine.delta, boardLine.stockAfter, boardLine.orderLabel, boardLine.actorUid, boardLine.productName.en], ['cancel', 5, 6, 'BYND-1001', 'u1', 'Board']);
ok('cancel: same product on two lines is put back in full (1 + 2 + 3 = 6); preorder untouched; one history line per product');

await rejects(cancelOrder('o1', actor), 'ALREADY_CANCELLED'); await rejects(cancelOrder('done', actor), 'ALREADY_DELIVERED'); await rejects(cancelOrder('nope', actor), 'NOT_FOUND');
assert.equal(s.get('products/board').stock, 6); assert.equal(lines(s).length, 2);
ok('cancel again / delivered / missing order refused: no stock change, no extra history');

s = fresh(); await returnOrder('shipped', { restock: true, actor });
assert.equal(s.get('orders/shipped').status, 'returned'); assert.equal(s.get('products/plate').stock, 14); assert.equal(s.get('orders/shipped').statusHistory.at(-1).restocked, true);
h = lines(s); assert.deepEqual([h.length, h[0].type, h[0].delta, h[0].stockAfter, h[0].orderLabel], [1, 'return', 4, 14, '#7']);
ok('return a shipped parcel and restock: stock +4 with a "return" history line');

s = fresh(); await returnOrder('done', { restock: false, actor });
assert.equal(s.get('orders/done').status, 'returned'); assert.equal(s.get('products/plate').stock, 10); assert.equal(lines(s).length, 0);
ok('return as damaged: stock unchanged, no history line');
await rejects(returnOrder('done', { restock: true, actor }), 'ALREADY_RETURNED'); await rejects(returnOrder('o1', { restock: true, actor }), 'NOT_RETURNABLE');
await rejects(returnOrder('nope', { restock: true, actor }), 'NOT_FOUND'); await rejects(cancelOrder('done', actor), 'ALREADY_RETURNED');
ok('no double return, no return before shipping, no cancel after a return');

// =============== restock ===============
const shelf = () => {
  globalThis.__store = new Map([
    ['products/a', { tenantId: 'bynd', stock: 10, name: { en: 'Board' } }],
    ['productCosts/a', { tenantId: 'bynd', costPrice: 100, optionCosts: { 'col.gold': 30 } }],
    ['products/nocost', { tenantId: 'bynd', stock: 0, name: { en: 'Plate' } }],
    ['products/other', { tenantId: 'someone-else', stock: 5, name: { en: 'X' } }],
  ]);
  globalThis.__counter = 0; return globalThis.__store;
};
s = shelf();
let r = await restockProduct('bynd', 'a', { quantity: 10, totalCost: 1200, note: 'Batch 3', recordExpense: true, expenseCategory: 'manufacturing' }, actor);
assert.deepEqual([r.before, r.after, r.costBefore, r.costAfter], [10, 20, 100, 110]);
assert.equal(s.get('products/a').stock, 20); assert.equal(s.get('productCosts/a').costPrice, 110); assert.deepEqual(s.get('productCosts/a').optionCosts, { 'col.gold': 30 });
const mv = lines(s)[0]; assert.deepEqual([mv.type, mv.delta, mv.stockAfter, mv.unitCost, mv.totalCost, mv.note, mv.actorName], ['restock', 10, 20, 120, 1200, 'Batch 3', 'Mona']);
const expense = [...s].find(([k]) => k.startsWith('expenses/'))[1];
assert.deepEqual([expense.amount, expense.category, expense.tenantId, expense.deleted], [1200, 'manufacturing', 'bynd', false]); assert.ok(expense.description.includes('Board') && expense.description.includes('Batch 3'));
ok('restock 10 @120: stock 20, cost price averages to 110 (private option costs kept), history line, expense of 1200');

s = shelf();
await restockProduct('bynd', 'a', { quantity: 5, totalCost: '', recordExpense: true }, actor);
assert.equal(s.get('products/a').stock, 15); assert.equal(s.get('productCosts/a').costPrice, 100); assert.equal([...s].filter(([k]) => k.startsWith('expenses/')).length, 0);
await restockProduct('bynd', 'a', { quantity: 5, totalCost: 500, updateCost: false, recordExpense: false }, actor);
assert.equal(s.get('productCosts/a').costPrice, 100); assert.equal(s.get('products/a').stock, 20);
assert.equal(lines(s).at(-1).unitCost, 100);
ok('no cost given: only the stock changes (no expense); "keep cost price" and "no expense" respected');

s = shelf();
await restockProduct('bynd', 'nocost', { quantity: 4, totalCost: 600, recordExpense: false }, actor);
assert.deepEqual([s.get('products/nocost').stock, s.get('productCosts/nocost').costPrice, s.get('productCosts/nocost').tenantId], [4, 150, 'bynd']);
ok('first batch of a product with no cost yet: the cost price is created (150)');

await rejects(restockProduct('bynd', 'a', { quantity: 0, totalCost: 10 }, actor), 'BAD_QUANTITY');
await rejects(restockProduct('bynd', 'a', { quantity: 2, totalCost: -5 }, actor), 'BAD_COST');
await rejects(restockProduct('bynd', 'other', { quantity: 2, totalCost: 5 }, actor), 'NOT_FOUND');
await rejects(restockProduct('bynd', 'ghost', { quantity: 2, totalCost: 5 }, actor), 'NOT_FOUND');
assert.equal(s.get('products/other').stock, 5);
ok('bad quantity / cost refused; another shop\'s product can\'t be touched');

// =============== adjust (stocktake, damaged) ===============
s = shelf();
await adjustStock('bynd', 'a', { mode: 'count', value: 7, note: 'Monthly count' }, actor);
assert.equal(s.get('products/a').stock, 7); let l = lines(s).at(-1); assert.deepEqual([l.type, l.delta, l.stockAfter, l.note], ['adjustment', -3, 7, 'Monthly count']);
await adjustStock('bynd', 'a', { mode: 'remove', value: 2, note: 'Cracked' }, actor);
assert.equal(s.get('products/a').stock, 5); l = lines(s).at(-1); assert.deepEqual([l.type, l.delta, l.stockAfter], ['damaged', -2, 5]);
await adjustStock('bynd', 'a', { mode: 'count', value: 9 }, actor); assert.equal(s.get('products/a').stock, 9); assert.equal(lines(s).at(-1).delta, 4);
await rejects(adjustStock('bynd', 'a', { mode: 'remove', value: 20 }, actor), 'TOO_MANY'); await rejects(adjustStock('bynd', 'a', { mode: 'count', value: 9 }, actor), 'NO_CHANGE');
await rejects(adjustStock('bynd', 'other', { mode: 'count', value: 1 }, actor), 'NOT_FOUND');
assert.equal(s.get('products/a').stock, 9); assert.equal(lines(s).length, 3);
ok('stocktake sets the real count (relative to NOW), damaged removes; can\'t remove more than exists; each change leaves one history line');

// =============== new products and edits ===============
globalThis.__store = new Map(); globalThis.__counter = 0;
const form = { nameEn: 'Board', nameAr: 'لوحة', price: 400, costPrice: 150, stock: 5, isPreorder: false, options: [], images: [], relatedIds: [], isActive: true };
const id = await createProduct('bynd', form, actor);
s = globalThis.__store; assert.equal(s.get(`products/${id}`).stock, 5); assert.equal(s.get(`productCosts/${id}`).costPrice, 150);
h = lines(s); assert.deepEqual([h.length, h[0].type, h[0].delta, h[0].stockAfter, h[0].productId], [1, 'initial', 5, 5, id]);
await createProduct('bynd', { ...form, stock: 0 }, actor); await createProduct('bynd', { ...form, isPreorder: true, stock: 9 }, actor);
assert.equal(lines(s).length, 1);
ok('a new product with starting stock gets an "initial" history line; zero stock or preorder: none');

s.set(`products/${id}`, { ...s.get(`products/${id}`), stock: 2 });   // sales happened since the form was opened
await updateProduct('bynd', id, { ...form, stock: 99, price: 450, isActive: true });
assert.equal(s.get(`products/${id}`).stock, 2); assert.equal(s.get(`products/${id}`).price, 450);
ok('editing a product can no longer overwrite its stock (stock 2 stays 2 even though the form said 99)');

// =============== stock counted per colour / option ===============
const optsC = [
  { id: 'col', type: 'color', label: { en: 'Colour', ar: 'اللون' }, required: true, values: [{ id: 'gold', label: { en: 'Gold', ar: 'ذهبي' } }, { id: 'black', label: { en: 'Black', ar: 'أسود' } }] },
  { id: 'dist', type: 'choice', label: { en: 'Plate', ar: 'اللوح' }, required: true, values: [{ id: 'k10', label: { en: '10 km', ar: '١٠' } }, { id: 'half', label: { en: 'Half', ar: 'نصف' } }] },
];
const counted = () => {
  globalThis.__store = new Map([
    ['products/hex', { tenantId: 'bynd', name: { en: 'Hex' }, stock: 3, countedOptions: ['col', 'dist'], options: optsC,
      optionStock: { 'col.gold': 3, 'col.black': 0, 'dist.k10': 2, 'dist.half': 5 } }],
    ['productCosts/hex', { tenantId: 'bynd', costPrice: 100, optionCosts: {} }],
    ['products/plain', { tenantId: 'bynd', name: { en: 'Plain' }, stock: 4 }],
  ]);
  globalThis.__counter = 0; return globalThis.__store;
};
const optStock = (st) => st.get('products/hex').optionStock;

// ---- Add stock goes to ONE colour / plate ----
s = counted();
await rejects(restockProduct('bynd', 'hex', { quantity: 2 }, actor), 'NEED_OPTION');
await rejects(restockProduct('bynd', 'hex', { quantity: 2, optionKey: 'col.zzz' }, actor), 'NEED_OPTION');
assert.equal(lines(s).length, 0);
let rr = await restockProduct('bynd', 'hex', { quantity: 4, optionKey: 'col.black', totalCost: 800 }, actor);
assert.deepEqual([rr.before, rr.after], [0, 4]);
assert.deepEqual([optStock(s)['col.black'], optStock(s)['col.gold'], s.get('products/hex').stock], [4, 3, 7]);   // colours 7, plates 7
let mvo = lines(s).at(-1);
assert.deepEqual([mvo.type, mvo.delta, mvo.stockAfter, mvo.optionChanges[0].key, mvo.optionChanges[0].label.en, mvo.optionChanges[0].delta, mvo.optionChanges[0].after], ['restock', 4, 7, 'col.black', 'Colour: Black', 4, 4]);
assert.equal(s.get('productCosts/hex').costPrice, 157.14);      // (3 x 100 + 4 x 200) / 7: the cost averages over the COLOUR total
ok('Add stock for a colour: only that colour goes up, the product number follows, history names the colour; cost averages over the colours');

await restockProduct('bynd', 'hex', { quantity: 3, optionKey: 'dist.k10', totalCost: 300 }, actor);
assert.equal(optStock(s)['dist.k10'], 5); assert.equal(s.get('productCosts/hex').costPrice, 157.14);
ok('Add stock for a plate (not the main option) never changes the product cost price');

// ---- Adjust ----
await adjustStock('bynd', 'hex', { mode: 'count', value: 1, optionKey: 'dist.half' }, actor);
assert.deepEqual([optStock(s)['dist.half'], s.get('products/hex').stock], [1, 6]);      // plates 5 + 1 = 6 is now the smaller total
mvo = lines(s).at(-1); assert.deepEqual([mvo.type, mvo.delta, mvo.stockAfter, mvo.optionChanges[0].delta, mvo.optionChanges[0].after], ['adjustment', -4, 6, -4, 1]);
await rejects(adjustStock('bynd', 'hex', { mode: 'remove', value: 9, optionKey: 'col.gold' }, actor), 'TOO_MANY');
await rejects(adjustStock('bynd', 'hex', { mode: 'count', value: 1 }, actor), 'NEED_OPTION');
await adjustStock('bynd', 'hex', { mode: 'remove', value: 1, optionKey: 'col.gold', note: 'Cracked' }, actor);
assert.equal(optStock(s)['col.gold'], 2); assert.equal(lines(s).at(-1).type, 'damaged');
ok('stocktake / damaged work on the chosen colour or plate; "which one?" is required; cannot remove more than that colour has');

// ---- cancel / return give units back to the same numbers ----
s = counted();
s.set('orders/o9', { tenantId: 'bynd', orderNumberLabel: 'BYND-1009', status: 'pending', statusHistory: [], items: [
  { productId: 'hex', quantity: 2, stockKeys: ['col.gold', 'dist.k10'], name: { en: 'Hex' } },
  { productId: 'hex', quantity: 1, name: { en: 'Hex' } },                      // an older line: no record of which colour
  { productId: 'hex', quantity: 5, isPreorder: true, backorder: true, stockKeys: [] },   // made to order: never goes back
  { productId: 'plain', quantity: 1, name: { en: 'Plain' } } ] });
await cancelOrder('o9', actor);
assert.deepEqual([optStock(s)['col.gold'], optStock(s)['dist.k10'], optStock(s)['col.black'], optStock(s)['dist.half']], [5, 4, 0, 5]);
assert.equal(s.get('products/hex').stock, 5); assert.equal(s.get('products/plain').stock, 5);
let hx = lines(s).find((x) => x.productId === 'hex'); assert.deepEqual([hx.type, hx.delta, hx.stockAfter, hx.optionChanges.length, hx.orderLabel], ['cancel', 2, 5, 2, 'BYND-1009']);
assert.equal(lines(s).find((x) => x.productId === 'plain').optionChanges, undefined);
ok('cancel: units go back to the colour and plate the order used; old lines without a record and made-to-order lines are not put back');

s = counted();
s.set('orders/o8', { tenantId: 'bynd', status: 'shipped', statusHistory: [], items: [{ productId: 'hex', quantity: 1, stockKeys: ['col.gold', 'dist.half'] }] });
s.set('orders/o7', { tenantId: 'bynd', status: 'shipped', statusHistory: [], items: [{ productId: 'hex', quantity: 1, stockKeys: ['col.gold', 'dist.half'] }] });
await returnOrder('o8', { restock: true, actor }); assert.deepEqual([optStock(s)['col.gold'], optStock(s)['dist.half']], [4, 6]);
await returnOrder('o7', { restock: false, actor }); assert.deepEqual([optStock(s)['col.gold'], optStock(s)['dist.half']], [4, 6]);
ok('return: restock puts the colour/plate back, "damaged" leaves it');

// ---- if the shop stops counting by option, an old order goes back into the one number ----
s = counted(); s.set('products/hex', { ...s.get('products/hex'), countedOptions: [] });
s.set('orders/o6', { tenantId: 'bynd', status: 'pending', statusHistory: [], items: [{ productId: 'hex', quantity: 2, stockKeys: ['col.gold'] }] });
await cancelOrder('o6', actor); assert.equal(s.get('products/hex').stock, 5);
ok('counting switched off later: the cancelled units are simply added to the product stock');

// ---- new products and edits ----
const fopts = [{ id: 'col', type: 'color', labelEn: 'Colour', labelAr: '', required: false, maxLength: '', values: [
  { id: 'gold', labelEn: 'Gold', labelAr: '', color: '#d4af37', imageUrl: '', priceDelta: '', costDelta: '' },
  { id: 'black', labelEn: 'Black', labelAr: '', color: '#111111', imageUrl: '', priceDelta: '', costDelta: '' }] }];
globalThis.__store = new Map(); globalThis.__counter = 0; s = globalThis.__store;
const cid = await createProduct('bynd', { ...form, stock: 5, options: fopts, countedOptions: ['col'] }, actor);
let cp = s.get(`products/${cid}`);
assert.deepEqual([cp.stock, cp.optionStock, cp.countedOptions, cp.options[0].required], [0, {}, ['col'], true]); assert.equal(lines(s).length, 0);
ok('new product counted by colour: every number starts at 0, no starting-stock line, the colour becomes required');

globalThis.__store = new Map([['products/old', { tenantId: 'bynd', name: { en: 'Old' }, stock: 5 }]]); s = globalThis.__store;
await updateProduct('bynd', 'old', { ...form, options: fopts, countedOptions: ['col'], isActive: true }, actor);
cp = s.get('products/old'); assert.deepEqual([cp.stock, cp.optionStock], [0, {}]);
mvo = lines(s).at(-1); assert.deepEqual([mvo.type, mvo.delta, mvo.stockAfter], ['adjustment', -5, 0]);
ok('switching an existing product to colour counting: the single number is replaced and a history line says so');

s.set('products/old', { ...s.get('products/old'), stock: 7, optionStock: { 'col.gold': 3, 'col.black': 4 } });
const goldOnly = [{ ...fopts[0], values: [fopts[0].values[0]] }];
await updateProduct('bynd', 'old', { ...form, options: goldOnly, countedOptions: ['col'], isActive: true }, actor);
assert.equal(s.get('products/old').stock, 3); assert.equal(lines(s).at(-1).delta, -4);
ok('removing a colour from the product recalculates the product number (7 -> 3)');

s.set('products/old', { ...s.get('products/old'), stock: 3 });
await updateProduct('bynd', 'old', { ...form, options: fopts, countedOptions: ['col'], isPreorder: true, isActive: true }, actor);
assert.deepEqual([s.get('products/old').countedOptions, s.get('products/old').stock], [[], 3]);
ok('a made-to-order product stops counting (and its stock number is left alone)');

console.log(`\nALL ${n} STOCK-CODE CHECK GROUPS PASSED`);
