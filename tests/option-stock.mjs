// Stock counted PER OPTION (per colour, per distance plate...) and "stock first, then made to order".
// Covers the shared rules (browser + server copy) and the real server order code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import * as S from '../src/utils/optionStock.js';
import { stockToRestoreDetailed, stockToRestore } from '../src/utils/orderRules.js';
import { productStatus } from '../src/utils/storefront.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ---------- the browser copy and the server copy must be identical ----------
assert.equal(fs.readFileSync('src/utils/optionStock.js', 'utf8'), fs.readFileSync('api/_lib/optionStock.js', 'utf8'));
ok('browser and server copies of optionStock.js are identical');

// ---------- fixtures ----------
const colour = { id: 'col', type: 'color', label: { en: 'Colour', ar: 'اللون' }, required: true, values: [
  { id: 'gold', label: { en: 'Gold', ar: 'ذهبي' }, color: '#d4af37', priceDelta: 0 },
  { id: 'black', label: { en: 'Black', ar: 'أسود' }, color: '#111', priceDelta: 0 },
  { id: 'teal', label: { en: 'Teal', ar: 'تركوازي' }, color: '#1b9aa6', priceDelta: 0 } ] };
const plate = { id: 'dist', type: 'choice', label: { en: 'Plate', ar: 'اللوح' }, required: true, values: [
  { id: 'k10', label: { en: '10 km', ar: '١٠ كم' }, priceDelta: 0 },
  { id: 'half', label: { en: 'Half marathon', ar: 'نصف ماراثون' }, priceDelta: 30 } ] };
const word = { id: 'word', type: 'addon', label: { en: 'Word', ar: 'كلمة' }, required: false, values: [{ id: 'yes', label: { en: 'x', ar: 'x' }, priceDelta: 20 }] };
const hexc = () => ({ tenantId: 'bynd', name: { en: 'Hex', ar: 'هكس' }, price: 400, stock: 7, isActive: true, deleted: false,
  countedOptions: ['col'], options: [colour, word], optionStock: { 'col.gold': 2, 'col.black': 0, 'col.teal': 5 } });

// ---------- pure rules ----------
let p = hexc();
assert.deepEqual(S.countedOptions(p).map((o) => o.id), ['col']);
assert.equal(S.derivedStock(p), 7);
assert.equal(S.derivedStock({ ...p, countedOptions: [] }), null);
assert.equal(S.isOptionCounted({ ...p, countedOptions: ['word'] }), false);          // a tick box cannot be counted
assert.equal(S.isOptionCounted({ ...p, countedOptions: ['nope'] }), false);          // unknown option ignored
assert.equal(S.countedOptions({ ...p, options: [colour, plate, { ...plate, id: 'p2' }], countedOptions: ['col', 'dist', 'p2'] }).length, 2); // max 2
ok('which options count, and the product number is the sum of the colours');

const two = { ...p, options: [colour, plate], countedOptions: ['col', 'dist'], optionStock: { 'col.gold': 3, 'dist.k10': 1, 'dist.half': 1 } };
assert.equal(S.derivedStock(two), 2);                                 // colours: 3, plates: 2  -> the smaller one
assert.equal(S.optionTotal(two, 'col'), 3); assert.equal(S.optionTotal(two, 'dist'), 2);
assert.equal(S.derivedStock({ ...two, optionStock: { 'col.gone': 9, 'col.gold': 1, 'dist.k10': 4 } }), 1); // numbers of removed values are ignored
ok('two counted options: the product number is the smaller total; removed values are ignored');

assert.deepEqual(S.keysForSelections(two, { col: 'gold', dist: 'k10' }).keys.map((k) => k.key), ['col.gold', 'dist.k10']);
assert.equal(S.keysForSelections(two, { col: 'gold' }).missing[0].id, 'dist');
assert.equal(S.keysForSelections(two, { col: 'zzz', dist: 'k10' }).missing[0].id, 'col');
assert.equal(S.leftForSelections(two, { col: 'gold' }), null);
assert.equal(S.leftForSelections(two, { col: 'gold', dist: 'half' }), 1);
assert.equal(S.leftForSelections(two, { col: 'black', dist: 'half' }), 0);
assert.equal(S.leftForSelections({ ...p, countedOptions: [] }, { col: 'gold' }), null);
assert.deepEqual(S.rowText(S.countedRows(p)[0]), { en: 'Colour: Gold', ar: 'اللون: ذهبي' });
assert.deepEqual(S.applyDeltas({ a: 1 }, { a: -5, b: 2 }), { a: 0, b: 2 });
ok('chosen combination, how many left, label text, numbers never go below 0');

assert.equal(productStatus({ stock: 0 }), 'soldOut');
assert.equal(productStatus({ stock: 0, backorder: true }), 'preorder');
assert.equal(productStatus({ stock: 0, backorder: true, preorderStyle: 'madeToOrder' }), 'madeToOrder');
assert.equal(productStatus({ stock: 3, backorder: true }), 'inStock');
ok('shop status: "stock first, then made to order" turns into made to order only when the stock is gone');

const order = { items: [
  { productId: 'a', quantity: 2, stockKeys: ['col.gold', 'dist.k10'] }, { productId: 'a', quantity: 1, stockKeys: ['col.gold'] },
  { productId: 'a', quantity: 4 }, { productId: 'b', quantity: 9, isPreorder: true } ] };
assert.deepEqual(stockToRestoreDetailed(order), [{ productId: 'a', quantity: 7, plainQuantity: 4, keys: { 'col.gold': 3, 'dist.k10': 2 } }]);
assert.deepEqual(stockToRestore(order), [{ productId: 'a', quantity: 7 }, { productId: 'b', quantity: 9 }].slice(0, 1));
ok('what goes back on cancel/return: per product, per counted number, never for made-to-order lines');

// ---------- the server: placing orders ----------
function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${col}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store, collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, o) => w.push(['s', r, d, o]) };
      const out = await fn(tx); for (const [k, r, d, o] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (o?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
}
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items) => validateInput({ tenantId: 'bynd', customer: cust, items });
const base = (products) => ({ 'tenants/bynd': { slug: 'bynd', isActive: true }, ...Object.fromEntries(Object.entries(products).map(([k, v]) => [`products/${k}`, v])) });
const rejects = async (pr, code) => { try { await pr; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); return e; } };
const moves = (db) => [...db.store].filter(([k]) => k.startsWith('tenants/bynd/stockMovements/')).map(([, v]) => v);
const orderOf = (db, r) => db.store.get(`orders/${r.orderId}`);

// 1. a sale takes one unit from the chosen colour and updates the product number
let db = makeDb(base({ hex: hexc() }));
let r = await placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'gold' } }]));
let pr = db.store.get('products/hex');
assert.deepEqual([pr.optionStock['col.gold'], pr.optionStock['col.teal'], pr.stock], [1, 5, 6]);
let line = orderOf(db, r).items[0]; assert.deepEqual(line.stockKeys, ['col.gold']); assert.equal(line.isPreorder, false);
let mv = moves(db); assert.equal(mv.length, 1);
assert.deepEqual([mv[0].type, mv[0].delta, mv[0].stockAfter, mv[0].optionChanges[0].key, mv[0].optionChanges[0].label.en, mv[0].optionChanges[0].delta, mv[0].optionChanges[0].after], ['sale', -1, 6, 'col.gold', 'Colour: Gold', -1, 1]);
ok('a sale reduces only the chosen colour, updates the product total, saves which number it used and a history line');

// 2. a sold-out colour cannot be ordered even if other colours have stock; nothing changes
db = makeDb(base({ hex: hexc() }));
let e = await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'black' } }])), 'OUT_OF_STOCK');
assert.equal(e.meta.stock, 0); assert.match(e.meta.name, /Black/);
e = await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 3, selections: { col: 'gold' } }])), 'OUT_OF_STOCK');
assert.equal(e.meta.stock, 2);
assert.deepEqual(db.store.get('products/hex').optionStock, hexc().optionStock); assert.equal(moves(db).length, 0);
ok('sold-out colour / more than the colour has: refused with the real number, nothing changes');

// 3. two lines of the same colour share that colour's number
db = makeDb(base({ hex: hexc() }));
await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'gold' } }, { productId: 'hex', quantity: 2, selections: { col: 'gold', word: true } }])), 'OUT_OF_STOCK');
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'gold' } }, { productId: 'hex', quantity: 1, selections: { col: 'gold', word: true } }]));
assert.equal(db.store.get('products/hex').optionStock['col.gold'], 0); assert.equal(moves(db).length, 1); assert.equal(moves(db)[0].delta, -2);
ok('two lines of the same colour use the same number (1 + 2 > 2 refused; 1 + 1 accepted, one history line)');

// 4. two counted options: both go down, and either one being empty blocks the order
const prs = () => ({ ...hexc(), options: [colour, plate], countedOptions: ['col', 'dist'], stock: 2, optionStock: { 'col.gold': 3, 'dist.k10': 2, 'dist.half': 0 } });
db = makeDb(base({ prs: prs() }));
await rejects(placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { col: 'gold', dist: 'half' } }])), 'OUT_OF_STOCK');
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 2, selections: { col: 'gold', dist: 'k10' } }]));
pr = db.store.get('products/prs'); assert.deepEqual([pr.optionStock['col.gold'], pr.optionStock['dist.k10'], pr.stock], [1, 0, 0]);
assert.deepEqual(orderOf(db, r).items[0].stockKeys, ['col.gold', 'dist.k10']); assert.equal(moves(db)[0].optionChanges.length, 2);
ok('colour + plate counted: one order lowers both; an empty plate blocks the order');

// 5. a counted option the customer did not choose is refused (older products where it was not required)
db = makeDb(base({ hex: { ...hexc(), options: [{ ...colour, required: false }, word] } }));
await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: {} }])), 'BAD_OPTION');
ok('a counted option that is not chosen is refused');

// 6. stock first, then made to order: plain product
const back = (stock) => ({ tenantId: 'bynd', name: { en: 'Board', ar: 'لوحة' }, price: 600, stock, backorder: true, isActive: true, deleted: false, options: [] });
db = makeDb(base({ board: back(2) }));
r = await placeOrder(db, mk([{ productId: 'board', quantity: 2 }]));
assert.equal(db.store.get('products/board').stock, 0); assert.equal(orderOf(db, r).orderType, 'normal'); assert.equal(orderOf(db, r).items[0].isPreorder, false);
r = await placeOrder(db, mk([{ productId: 'board', quantity: 1 }]));
assert.equal(db.store.get('products/board').stock, 0); assert.equal(orderOf(db, r).orderType, 'preorder');
assert.deepEqual([orderOf(db, r).items[0].isPreorder, orderOf(db, r).items[0].backorder], [true, true]); assert.equal(moves(db).length, 1);
ok('stock first: sells from stock, then the next order becomes made to order and leaves the stock alone');

db = makeDb(base({ board: back(3) }));
r = await placeOrder(db, mk([{ productId: 'board', quantity: 5 }]));
assert.equal(db.store.get('products/board').stock, 3); assert.equal(orderOf(db, r).items[0].isPreorder, true); assert.equal(moves(db).length, 0);
ok('asking for more than is in stock: that whole line is made to order, stock untouched');

// 7. stock first + counted colours
db = makeDb(base({ hex: { ...hexc(), backorder: true } }));
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 2, selections: { col: 'black' } }]));
let it = orderOf(db, r).items[0]; assert.deepEqual([it.isPreorder, it.backorder, it.stockKeys], [true, true, []]);
assert.deepEqual(db.store.get('products/hex').optionStock, hexc().optionStock); assert.equal(moves(db).length, 0);
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'teal' } }]));
assert.equal(db.store.get('products/hex').optionStock['col.teal'], 4); assert.equal(orderOf(db, r).items[0].isPreorder, false);
ok('stock first + colours: a sold-out colour is made to order, other colours still come from stock');

// 8. made to order products never use stock, even if counting was left on
db = makeDb(base({ hex: { ...hexc(), isPreorder: true } }));
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 4, selections: { col: 'black' } }]));
assert.equal(orderOf(db, r).items[0].isPreorder, true); assert.deepEqual(db.store.get('products/hex').optionStock, hexc().optionStock); assert.equal(moves(db).length, 0);
ok('made-to-order products never touch stock');

console.log(`\nALL ${n} OPTION-STOCK CHECK GROUPS PASSED`);
