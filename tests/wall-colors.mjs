// Update 28: colours on the wall. The palette, stock limits per colour, colouring new pieces,
// the cart lines of a coloured wall (one per colour) with the right prices, and a real order from them.
import assert from 'node:assert/strict';
import * as C from '../src/utils/wallColors.js';
import * as W from '../src/utils/wallLayout.js';
import { placeOrder, validateInput } from '../api/_lib/placeOrder.js';

const L = (en) => ({ en, ar: en });
const blk = { id: 'blk', label: L('Black'), color: '#111111', priceDelta: 0 };
const blu = { id: 'blu', label: L('Blue'), color: '#2244ff', priceDelta: 10 };
const colour = { id: 'col', type: 'color', label: L('Colour'), required: true, values: [blk, blu] };
const wallProduct = {
  id: 'wall', tenantId: 'bynd', name: L('Hexagon'), price: 100, stock: 0, isPreorder: true, isActive: true, deleted: false,
  wallDesigner: true, options: [colour], priceTiers: [{ minQty: 3, price: 80 }], tierGroupOption: 'col',
};
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. which option is the wall's colour list
assert.equal(C.wallColorOption(wallProduct).id, 'col');
assert.equal(C.wallColorOption({ options: [{ id: 'x', type: 'choice', values: [{ id: 'a' }] }] }), null);
assert.equal(C.wallColorOption({ options: [{ ...colour, showWhen: { optionId: 'z', valueId: 'y' } }] }), null);
assert.equal(C.wallColorOption({ options: [{ ...colour, values: [] }] }), null);
assert.equal(C.wallColorOption({}), null);
assert.deepEqual(C.wallPalette(wallProduct, 'en').map((p) => [p.id, p.label, p.color]), [['blk', 'Black', '#111111'], ['blu', 'Blue', '#2244ff']]);
assert.equal(C.wallPalette({ options: [] }), null);
ok('the wall uses the first colour list (not one with a "show only when" rule, not an empty one); no colour list = no palette');

// 2. how many pieces of a colour can be ordered
const counted = { ...wallProduct, isPreorder: false, countedOptions: ['col'], optionStock: { 'col.blk': 4, 'col.blu': 0 }, stock: 0 };
assert.equal(C.colourLimit(wallProduct, {}, colour, 'blk'), Infinity);                      // made to order
assert.equal(C.colourLimit(counted, {}, colour, 'blk'), 4);
assert.equal(C.colourLimit(counted, {}, colour, 'blu'), 0);                                 // sold out
assert.equal(C.colourLimit({ ...counted, backorder: true }, {}, colour, 'blu'), Infinity);  // stock first, then made to order
assert.equal(C.colourLimit({ ...counted, countedOptions: [] }, {}, colour, 'blu'), Infinity); // stock not counted per colour
assert.equal(C.defaultPaint(counted, colour), 'blk');
assert.equal(C.defaultPaint({ ...counted, optionStock: { 'col.blk': 0, 'col.blu': 3 } }, colour), 'blu');   // first colour that is not sold out
assert.equal(C.defaultPaint({ ...counted, optionStock: { 'col.blk': 0, 'col.blu': 0 } }, colour), 'blk');   // all sold out: still gives one
ok('colour limits: made to order = no limit, counted = what is left, sold out = 0; the starting colour skips a sold-out colour');

// 3. colouring pieces
const ids = ['blk', 'blu'];
const bare = W.resizeLayout([], 6);
let col = C.assignColours(bare, ids, () => Infinity, 'blu');
assert.ok(col.every((c) => c.c === 'blu'));
col = C.assignColours(bare, ids, (id) => (id === 'blu' ? 4 : Infinity), 'blu');           // only 4 blue exist: the rest become black
assert.equal(C.colourCounts(col).get('blu'), 4); assert.equal(C.colourCounts(col).get('blk'), 2);
const half = [{ q: 0, r: 0, c: 'blk' }, { q: 1, r: 0 }, { q: 2, r: 0, c: 'gone' }];          // a colour that no longer exists is replaced
const fixed = C.assignColours(half, ids, () => Infinity, 'blu');
assert.deepEqual(fixed.map((c) => c.c), ['blk', 'blu', 'blu']);
assert.equal(fixed[0], half[0]);                                                              // coloured pieces are left alone
const shuffled = C.shuffleColours(['blk', 'blk', 'blu', 'blu', 'blu'], () => 0.3);
assert.deepEqual([...shuffled].sort(), ['blk', 'blk', 'blu', 'blu', 'blu']);
assert.deepEqual(C.shuffleColours(['a', 'b', 'c'], () => 0.5), C.shuffleColours(['a', 'b', 'c'], () => 0.5));
// the layout rules keep the colour of pieces that stay
const grown = W.resizeLayout([{ q: 0, r: 0, c: 'blk' }], 3);
assert.equal(grown[0].c, 'blk');
ok('colouring: picked colour while it has room, then the next; unknown colours are replaced; shuffle keeps the same mix; resizing keeps colours');

// 4. a coloured wall -> cart lines
const wallOf = (blk3, blu3) => [...Array(blk3).fill({ c: 'blk' }), ...Array(blu3).fill({ c: 'blu' })].map((x, i) => ({ q: i, r: 0, ...x }));
let res = C.wallLines({ product: wallProduct, selections: {}, cells: wallOf(3, 3), cartItems: [], colorOpt: colour });
assert.deepEqual(res.lines.map((l) => [l.colorId, l.quantity]), [['blk', 3], ['blu', 3]]);
assert.deepEqual(res.lines.map((l) => l.unitPrice), [80, 90]);                               // same-colour offer for both + blue's 10 extra
assert.equal(res.subtotal, 3 * 80 + 3 * 90); assert.equal(res.total, 6); assert.deepEqual(res.missing, []);
assert.deepEqual(res.lines.map((l) => l.selections.col), ['blk', 'blu']);
res = C.wallLines({ product: wallProduct, selections: {}, cells: wallOf(2, 1), cartItems: [], colorOpt: colour });
assert.deepEqual(res.lines.map((l) => l.unitPrice), [100, 110]);                             // 2 black + 1 blue: no colour reaches 3
// pieces already in the cart count for the same colour
const inCart = [{ productId: 'wall', quantity: 1, selections: { col: 'blk' } }];
res = C.wallLines({ product: wallProduct, selections: {}, cells: wallOf(2, 1), cartItems: inCart, colorOpt: colour });
assert.deepEqual(res.lines.map((l) => l.unitPrice), [80, 110]);
// prices counted for the whole product (no colour grouping)
const together = { ...wallProduct, tierGroupOption: '' };
res = C.wallLines({ product: together, selections: {}, cells: wallOf(2, 1), cartItems: [], colorOpt: colour });
assert.deepEqual(res.lines.map((l) => l.unitPrice), [80, 90]);
// another required option has to be chosen once for the whole wall
const withPlate = { ...wallProduct, options: [colour, { id: 'plate', type: 'choice', label: L('Plate'), required: true, values: [{ id: 'p1', label: L('10 km'), priceDelta: 20 }] }] };
res = C.wallLines({ product: withPlate, selections: {}, cells: wallOf(1, 1), cartItems: [], colorOpt: colour });
assert.deepEqual(res.missing.map((o) => o.id), ['plate']);
res = C.wallLines({ product: withPlate, selections: { plate: 'p1' }, cells: wallOf(1, 1), cartItems: [], colorOpt: colour });
assert.deepEqual(res.lines.map((l) => l.unitPrice), [120, 130]); assert.deepEqual(res.missing, []);
ok('cart lines of a wall: one per colour, same-colour offer, the colour\'s own extra, pieces already in the cart, other options once for the whole wall');

// 5. the server accepts exactly these lines and prices them the same way
const store = new Map(Object.entries({ 'tenants/bynd': { slug: 'bynd', isActive: true }, 'products/wall': wallProduct, 'productCosts/wall': { tenantId: 'bynd', costPrice: 30, optionCosts: {} } }));
let auto = 0;
const ref = (cc, id) => ({ col: cc, id, path: `${cc}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${cc}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
const db = { store, collection: (cc) => ({ doc: (id) => ref(cc, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
  async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, op) => w.push(['s', r, d, op]) };
    const out = await fn(tx); for (const [k, r, d, op] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (op?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const lines = C.wallLines({ product: wallProduct, selections: {}, cells: wallOf(3, 4), cartItems: [], colorOpt: colour }).lines;
const placed = await placeOrder(db, validateInput({ tenantId: 'bynd', customer: cust, items: lines.map((l) => ({ productId: 'wall', quantity: l.quantity, selections: l.selections })) }));
const order = db.store.get(`orders/${placed.orderId}`);
assert.deepEqual(order.items.map((l) => [l.quantity, l.unitPrice]), lines.map((l) => [l.quantity, l.unitPrice]));
assert.equal(order.subtotal, lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
ok('a 3 black + 4 blue wall becomes a real order with exactly the prices the page showed (as plain lines; the wall itself is checked in wall-orders.mjs)');

console.log(`\nALL ${n} WALL-COLOUR CHECK GROUPS PASSED`);
