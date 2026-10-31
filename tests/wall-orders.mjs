// Update 29: the planned wall travels with the order. The SERVER checks it against the real product and saves it;
// the browser side builds the payload; the team sees it (picture file, text for Excel, Telegram line).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import * as SW from '../api/_lib/wall.js';
import * as WO from '../src/utils/wallOrder.js';
import * as WE from '../src/utils/wallExport.js';
import * as BW from '../src/utils/wallColors.js';
import * as W from '../src/utils/wallLayout.js';
import { buildOrderMessage } from '../api/_lib/telegram.js';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// the real admin screen that shows the walls (server render with the i18n stub)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const compFile = path.join(root, 'tests', `.ow-${process.pid}.cjs`);
await build({ stdin: { contents: `export { default } from ${JSON.stringify(root + '/src/components/admin/OrderWalls.jsx')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile: compFile, logLevel: 'error', jsx: 'automatic', define: { 'import.meta.env': '{}' },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?"["+o.n+"]":"")});', loader: 'js' }));
  } }] });
const req = createRequire(import.meta.url);
const OrderWalls = req(compFile).default;
fs.rmSync(compFile, { force: true });
const React = req('react'); const { renderToString } = req('react-dom/server');

// the real createOrder() of the browser, with a pretend network: what exactly goes to /api/create-order?
const svcFile = path.join(root, 'tests', `.os-${process.pid}.cjs`);
await build({ stdin: { contents: `export { createOrder } from ${JSON.stringify(root + '/src/firebase/orders.service.js')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile: svcFile, logLevel: 'error', define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'stub', setup(b) {
    b.onResolve({ filter: /^firebase\/firestore$/ }, (a) => ({ path: a.path, namespace: 'fs' }));
    b.onLoad({ filter: /.*/, namespace: 'fs' }, () => ({ contents: 'export const doc=()=>{}, collection=()=>{}, query=()=>{}, where=()=>{}, getDocs=()=>{}, updateDoc=()=>{}, arrayUnion=()=>{}, runTransaction=()=>{}, serverTimestamp=()=>{};', loader: 'js' }));
    b.onResolve({ filter: /\.\/config$/ }, (a) => ({ path: a.path, namespace: 'cfg' }));
    b.onLoad({ filter: /.*/, namespace: 'cfg' }, () => ({ contents: 'export const db = {};', loader: 'js' }));
  } }] });
const { createOrder } = req(svcFile);
fs.rmSync(svcFile, { force: true });

const L = (en, ar = en) => ({ en, ar });
const colour = { id: 'col', type: 'color', label: L('Colour'), required: true, values: [
  { id: 'blk', label: L('Black', 'أسود'), color: '#111111', priceDelta: 0 }, { id: 'blu', label: L('Blue', 'أزرق'), color: '#2244ff', priceDelta: 10 }] };
const product = { tenantId: 'bynd', name: L('Hexagon', 'سداسي'), price: 100, stock: 0, isPreorder: true, isActive: true, deleted: false,
  wallDesigner: true, options: [colour], priceTiers: [{ minQty: 3, price: 80 }], tierGroupOption: 'col' };
const world = (p = product) => {
  const store = new Map(Object.entries({ 'tenants/bynd': { slug: 'bynd', isActive: true }, 'products/wall': p, 'productCosts/wall': { tenantId: 'bynd', costPrice: 30, optionCosts: {} } }));
  let auto = 0;
  const ref = (cc, id) => ({ col: cc, id, path: `${cc}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${cc}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store, collection: (cc) => ({ doc: (id) => ref(cc, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, op) => w.push(['s', r, d, op]) };
      const out = await fn(tx); for (const [k, r, d, op] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (op?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
};
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const rejects = async (p, code) => { try { await p; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, String(e.stack)); assert.equal(e.code, code); } };

// a cart of a 3 black + 2 blue wall, as the browser keeps it
const cells = (b, u) => W.resizeLayout([], b + u).map((c, i) => ({ ...c, c: i < b ? 'blk' : 'blu' }));
const cartOf = (b, u, id = 'w1') => {
  const cs = cells(b, u);
  const lines = BW.wallLines({ product, selections: {}, cells: cs, cartItems: [], colorOpt: colour }).lines;
  return lines.map((l, i) => ({ productId: 'wall', quantity: l.quantity, selections: l.selections, wallId: id,
    ...(i === 0 ? { wallCells: cs.map(({ q, r, c }) => ({ q, r, c, h: colour.values.find((v) => v.id === c).color })) } : {}) }));
};
const body = (cart) => { const { lines, walls } = WO.wallParts(cart); return { tenantId: 'bynd', customer: cust, items: lines, walls }; };
const order = (db, r) => db.store.get(`orders/${r.orderId}`);

// 1. a normal wall order is saved with its pieces and colours
let db = world();
let r = await placeOrder(db, validateInput(body(cartOf(3, 2))));
let o = order(db, r);
assert.equal(o.walls.length, 1); const w = o.walls[0];
assert.equal(w.count, 5); assert.equal(w.cells.length, 5); assert.deepEqual(w.productName, product.name);
assert.deepEqual(w.colors.map((c) => [c.id, c.count, c.color]), [['blk', 3, '#111111'], ['blu', 2, '#2244ff']]);
assert.deepEqual(w.cells.map((c) => c.h), cells(3, 2).map((c) => (c.c === 'blk' ? '#111111' : '#2244ff')));
assert.ok(o.items.every((l) => l.wallId === w.id));
assert.deepEqual(o.items.map((l) => [l.quantity, l.unitPrice]), [[3, 80], [2, 110]]);                // same-colour offer for black only
ok('a 3 black + 2 blue wall is saved with the order: pieces, colours (names + codes taken from the product), lines marked with the wall');

// 2. a product without a colour list: the shape is saved without colours
const plain = { ...product, options: [], tierGroupOption: '' };
db = world(plain);
r = await placeOrder(db, validateInput({ tenantId: 'bynd', customer: cust, items: [{ productId: 'wall', quantity: 4, selections: {}, wallId: 'w9' }], walls: [{ id: 'w9', productId: 'wall', cells: W.resizeLayout([], 4) }] }));
o = order(db, r); assert.equal(o.walls[0].count, 4); assert.deepEqual(o.walls[0].colors, []); assert.ok(o.walls[0].cells.every((c) => c.c === undefined && c.h === undefined));
ok('a wall of a product without colours is saved as a shape only');

// 3. everything that is not a real wall is refused
const bad = async (mutate, label) => {
  db = world();
  const b = body(cartOf(3, 2)); mutate(b);
  await rejects((async () => placeOrder(db, validateInput(b)))(), 'BAD_WALL');
  assert.equal([...db.store.keys()].filter((k) => k.startsWith('orders/')).length, 0, label);        // nothing was saved
};
await bad((b) => { b.walls[0].cells.pop(); }, 'fewer pieces than ordered');
await bad((b) => { b.walls[0].cells.push({ q: 9, r: 9, c: 'blk' }); }, 'more pieces than ordered + split');
await bad((b) => { b.walls[0].cells[4] = { q: 50, r: 50, c: 'blu' }; }, 'a piece far away: the wall would be in two parts');
await bad((b) => { b.walls[0].cells[1] = { ...b.walls[0].cells[0] }; }, 'two pieces on one place');
await bad((b) => { b.walls[0].cells.forEach((c) => { c.c = 'blk'; }); }, 'colours do not match the lines');
await bad((b) => { b.walls[0].cells[0].c = 'nope'; }, 'a colour that does not exist');
await bad((b) => { b.walls.length = 0; }, 'lines say they are a wall but no wall was sent');
await bad((b) => { b.walls[0].productId = 'other'; }, 'the wall is for another product');
await bad((b) => { b.walls.push({ ...b.walls[0] }); }, 'same wall twice');
await bad((b) => { b.walls[0].cells = Array.from({ length: 61 }, (_, i) => ({ q: i, r: 0, c: 'blk' })); }, 'more than 60 pieces');
await bad((b) => { b.walls[0].cells[0].q = 1.5; }, 'not a whole number');
await bad((b) => { b.walls = 'x'; }, 'not a list');
await bad((b) => { b.items.forEach((i) => { i.wallId = 'zzz'; }); }, 'lines point to a wall that was not sent');
// a product that does not have the wall designer switched on
db = world({ ...product, wallDesigner: false });
await rejects((async () => placeOrder(db, validateInput(body(cartOf(3, 2)))))(), 'BAD_WALL');
// a wall with no lines at all
db = world();
await rejects((async () => placeOrder(db, validateInput({ tenantId: 'bynd', customer: cust, items: [{ productId: 'wall', quantity: 1, selections: { col: 'blk' } }], walls: [{ id: 'w1', productId: 'wall', cells: [{ q: 0, r: 0, c: 'blk' }] }] })))(), 'BAD_WALL');
ok('a wall that is not real is refused and nothing is saved: wrong counts, split in two, overlapping, unknown colour, colour mix that differs from the lines, missing / duplicate / foreign wall, over 60, bad numbers, product without designer');

// 4. two walls of the same colours are two walls (lines not merged), and normal lines can be ordered beside a wall
db = world();
const two = [...cartOf(2, 1, 'wa'), ...cartOf(1, 1, 'wb'), { productId: 'wall', quantity: 1, selections: { col: 'blk' } }];
r = await placeOrder(db, validateInput(body(two))); o = order(db, r);
assert.equal(o.walls.length, 2); assert.deepEqual(o.walls.map((x) => x.count), [3, 2]);
assert.equal(o.items.filter((l) => l.wallId === 'wa').length, 2); assert.equal(o.items.filter((l) => l.wallId === 'wb').length, 2);
assert.equal(o.items.filter((l) => !l.wallId).length, 1);
ok('two walls in one order stay two walls (their lines are not merged), and a plain line next to a wall is fine');

// 5. price: the order still prices every line on the server (a wall cannot change a price)
db = world();
const cheat = body(cartOf(2, 2)); cheat.items.forEach((i) => { i.unitPrice = 1; i.price = 1; });
r = await placeOrder(db, validateInput(cheat)); o = order(db, r);
assert.deepEqual(o.items.map((l) => l.unitPrice), [100, 110]);                                       // 2 + 2 of each colour: no step reached
ok('prices still come only from the server (prices sent by the browser are ignored)');

// 6. the browser side: what is sent and what is shown after ordering
const cart = cartOf(3, 2);
const parts = WO.wallParts([...cart, { productId: 'p2', quantity: 1, selections: {} }]);
assert.equal(parts.walls.length, 1); assert.equal(parts.walls[0].cells.length, 5);
assert.deepEqual(Object.keys(parts.walls[0].cells[0]).sort(), ['c', 'q', 'r']);                       // no colour codes (h) are sent: the server uses the product's
assert.ok(parts.lines.filter((l) => l.wallId).length === 2 && !parts.lines[2].wallId);
const oldCart = cart.map(({ wallCells, ...rest }) => rest);                                           // an old cart without pieces
const oldParts = WO.wallParts(oldCart); assert.equal(oldParts.walls.length, 0); assert.ok(oldParts.lines.every((l) => !l.wallId));
const pics = WO.wallPictures(cart); assert.equal(pics.length, 1); assert.equal(pics[0].cells.length, 5); assert.ok(pics[0].cells.every((c) => c.h));
ok('browser payload: lines carry the wallId, the wall carries pieces + colour ids only; an old cart without pieces is sent as plain lines');

// 7. what the team gets
db = world(); r = await placeOrder(db, validateInput(body(cartOf(3, 2)))); o = order(db, r);
const t = (k, v) => (k === 'wall.cartTitle' ? `Wall of ${v.n} pieces` : k);
const text = WE.wallsToText(o, 'en', t);
assert.match(text, /^Wall of 5 pieces \(3 × Black, 2 × Blue\): /); assert.equal((text.match(/=/g) || []).length, 5); assert.match(text, /=Black/); assert.match(text, /=Blue/);
assert.match(WE.wallsToText(o, 'ar', t), /أسود/); assert.equal(WE.wallsToText({}, 'en', t), '');
const svg = WE.wallToSvg(o.walls[0]);
assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/); assert.equal((svg.match(/<polygon/g) || []).length, 5);
assert.match(svg, /#111111/); assert.match(svg, /#2244ff/); assert.match(svg, /<rect[^>]*fill="#ffffff"/);
const msg = buildOrderMessage({ order: o, orderNumberLabel: 'BYND-1001' }, 'en');
assert.match(msg, /🧱 Wall: 5 pieces — 3 × Black, 2 × Blue/);
assert.match(buildOrderMessage({ order: o, orderNumberLabel: 'BYND-1001' }, 'ar'), /جدار: 5 قطعة — 3 × أسود, 2 × أزرق/);
assert.doesNotMatch(buildOrderMessage({ order: { ...o, walls: undefined }, orderNumberLabel: 'BYND-1001' }, 'en'), /🧱/);
ok('the team gets: Excel text (pieces + every piece with its colour), a picture file (SVG), and a Telegram line in English and Arabic');

// 8. the server copy of the layout rules is identical to the browser's
assert.equal(fs.readFileSync(new URL('../api/_lib/wallLayout.js', import.meta.url), 'utf8'), fs.readFileSync(new URL('../src/utils/wallLayout.js', import.meta.url), 'utf8'));
for (const p of [product, plain, { options: [] }, {}, { options: [{ ...colour, showWhen: { optionId: 'a', valueId: 'b' } }] }, { options: [{ ...colour, values: [] }] }]) {
  assert.equal(SW.wallColorOption(p)?.id, BW.wallColorOption(p)?.id);
}
ok('the server copy of the wall layout file is identical to the browser file, and both pick the same colour list');

// 9. the admin order screen: picture, count, colours, download button; nothing for an order without a wall
const html = renderToString(React.createElement(OrderWalls, { order: o, language: 'en' }));
assert.match(html, /data-order-walls/); assert.match(html, /orders\.wallTitle/); assert.match(html, /Hexagon/);
assert.equal((html.match(/<polygon/g) || []).length, 5); assert.match(html, /fill:#111111/); assert.match(html, /fill:#2244ff/);
assert.match(html, /wall\.legendItem\[3\]/); assert.match(html, /wall\.legendItem\[2\]/); assert.match(html, /orders\.wallDownload/);
assert.equal(renderToString(React.createElement(OrderWalls, { order: { items: [] }, language: 'en' })), '');
assert.match(renderToString(React.createElement(OrderWalls, { order: o, language: 'ar' })), /سداسي/);
ok('admin order screen: the wall picture with its pieces and colours, the mix, a download button; nothing shown for an order without a wall');

// 10. what the browser really sends when the customer places the order
let sent = null;
globalThis.fetch = async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return { ok: true, json: async () => ({ orderId: 'x' }) }; };
await createOrder({ tenantId: 'bynd', customer: cust, custom: {}, items: cartOf(3, 2), zoneId: '', promoCode: '' });
assert.equal(sent.url, '/api/create-order'); assert.equal(sent.body.walls.length, 1); assert.equal(sent.body.walls[0].cells.length, 5);
assert.ok(sent.body.items.every((i) => i.wallId === sent.body.walls[0].id));
assert.ok(sent.body.items.every((i) => !('wallCells' in i) && !('unitPrice' in i)));        // no pictures, no prices travel with the lines
await createOrder({ tenantId: 'bynd', customer: cust, custom: {}, items: [{ productId: 'wall', quantity: 2, selections: { col: 'blk' }, unitPrice: 1 }], zoneId: '', promoCode: '' });
assert.deepEqual(sent.body.walls, []); assert.ok(!('wallId' in sent.body.items[0]));
ok('createOrder() sends the lines with their wallId and the wall next to them; a normal order sends no walls');

console.log(`\nALL ${n} WALL-ORDER CHECK GROUPS PASSED`);
