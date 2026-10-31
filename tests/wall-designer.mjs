// Update 27: wall designer (step 1). The honeycomb layout rules, the saved product setting, the preview,
// and an order of a wall product (the number of pieces = the quantity, so quantity prices apply).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as W from '../src/utils/wallLayout.js';
import { placeOrder, validateInput } from '../api/_lib/placeOrder.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'tests', `.wd-${process.pid}.cjs`);
await build({ stdin: { contents: `export * from ${JSON.stringify(root + '/src/utils/productForm.js')}; export * from ${JSON.stringify(root + '/src/utils/preview.js')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', define: { 'import.meta.env': '{}' } });
const { productFields, cleanProductDraft } = createRequire(import.meta.url)(outfile);
fs.rmSync(outfile, { force: true });

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const keys = (cells) => cells.map(W.keyOf).sort().join('|');
const lcg = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// 1. the grid itself
const o = { q: 0, r: 0 };
assert.equal(W.neighbours(o).length, 6); assert.equal(new Set(W.neighbours(o).map(W.keyOf)).size, 6);
assert.ok(W.neighbours(o).every((c) => W.distance(o, c) === 1));
assert.equal(W.distance({ q: 2, r: -1 }, { q: -1, r: 2 }), 3);
assert.deepEqual(W.freeSpots([]), [{ q: 0, r: 0 }]); assert.equal(W.freeSpots([o]).length, 6);
assert.equal(W.freeSpots([o, { q: 1, r: 0 }]).length, 8);
ok('grid: six neighbours, distances, the free places around one and two pieces (6 and 8)');

// 2. growing and shrinking: always exactly n pieces, always ONE piece, builds on what is already there
let prev = [];
for (let k = 1; k <= W.WALL_MAX; k += 1) {
  const cur = W.resizeLayout(prev, k);
  assert.equal(cur.length, k); assert.ok(W.isConnected(cur), 'grow ' + k);
  assert.equal(new Set(cur.map(W.keyOf)).size, k);
  for (const c of prev) assert.ok(cur.some((x) => W.keyOf(x) === W.keyOf(c)));   // nothing the customer built moves away
  prev = cur;
}
for (let k = W.WALL_MAX; k >= 1; k -= 1) { prev = W.resizeLayout(prev, k); assert.equal(prev.length, k); assert.ok(W.isConnected(prev), 'shrink ' + k); }
assert.equal(W.resizeLayout([], 999).length, W.WALL_MAX); assert.equal(W.resizeLayout([], 0).length, 1); assert.equal(W.resizeLayout([], 'x').length, 1);
assert.equal(W.resizeLayout([], 2, { min: 5 }).length, 5);
ok('resize: every size from 1 to 60 is exact and connected, growing and shrinking; out-of-range numbers are clamped; the minimum is respected');

// 3. a compact wall: 7 pieces = one piece surrounded by six
const seven = W.resizeLayout([], 7);
assert.ok(seven.some((c) => W.neighbours(c).every((x) => seven.some((y) => W.keyOf(y) === W.keyOf(x)))));
ok('7 pieces form a flower (one in the middle, six around) = a compact wall, not a line');

// 4. adding: only next to the wall, not on a taken place, not over the maximum
const two = [o, { q: 1, r: 0 }];
assert.ok(W.canAdd(two, { q: 0, r: 1 })); assert.ok(!W.canAdd(two, { q: 5, r: 5 })); assert.ok(!W.canAdd(two, o));
assert.equal(W.addCell(two, { q: 5, r: 5 }).length, 2); assert.equal(W.addCell(two, { q: 0, r: 1 }).length, 3);
assert.ok(!W.canAdd(W.resizeLayout([], 60), W.freeSpots(W.resizeLayout([], 60))[0]));
assert.ok(!W.canAdd(W.resizeLayout([], 5), W.freeSpots(W.resizeLayout([], 5))[0], 5));
ok('adding works only next to the wall, never on a taken place, never above the maximum');

// 5. removing: never splits the wall in two, never below the minimum
const line = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
assert.ok(!W.canRemove(line, { q: 1, r: 0 }));                       // the middle one would split the wall
assert.ok(W.canRemove(line, { q: 0, r: 0 })); assert.ok(W.canRemove(line, { q: 2, r: 0 }));
assert.equal(W.removeCell(line, { q: 1, r: 0 }).length, 3);
assert.ok(!W.canRemove([o], o)); assert.ok(!W.canRemove(line, { q: 0, r: 0 }, 3));
assert.equal(W.removeCell(line, { q: 2, r: 0 }).length, 2);
ok('removing: the middle of a line is refused (the wall would split), the ends are fine, one piece / the shop minimum cannot go');

// 6. random
for (const seed of [1, 7, 42, 99]) for (const k of [1, 2, 9, 16, 33, 60]) {
  const r = W.randomLayout(k, lcg(seed));
  assert.equal(r.length, k); assert.ok(W.isConnected(r)); assert.equal(new Set(r.map(W.keyOf)).size, k);
}
assert.notEqual(keys(W.randomLayout(30, lcg(1))), keys(W.randomLayout(30, lcg(2))));
assert.equal(keys(W.randomLayout(30, lcg(5))), keys(W.randomLayout(30, lcg(5))));
assert.equal(W.randomLayout(500, lcg(1)).length, 60); assert.equal(W.randomLayout(0, lcg(1)).length, 1);
ok('random: exact size, one connected piece, different for different dice, the same for the same dice, limited to 60');

// 7. drawing helpers
const a = W.toPixel({ q: 0, r: 0 }, 20); const b = W.toPixel({ q: 1, r: 0 }, 20); const c = W.toPixel({ q: 0, r: 1 }, 20);
assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 20 * Math.sqrt(3)) < 1e-9);       // neighbours sit exactly one hexagon apart
assert.ok(Math.abs(Math.hypot(c.x - a.x, c.y - a.y) - 20 * Math.sqrt(3)) < 1e-9);
assert.equal(W.hexPoints(0, 0, 20).split(' ').length, 6);
const wall = W.resizeLayout([], 16); const vb = W.viewBoxFor(wall, W.freeSpots(wall), 20);
for (const cell of [...wall, ...W.freeSpots(wall)]) { const p = W.toPixel(cell, 20); assert.ok(p.x > vb.x && p.x < vb.x + vb.w && p.y > vb.y && p.y < vb.y + vb.h); }
ok('drawing: neighbours are exactly one hexagon apart, and the picture frame holds every piece and every free place');

// 8. product setting: saved only when ticked; the preview may carry it
const form = { nameEn: 'Wall', price: 100, options: [] };
assert.equal(productFields({ ...form, wallDesigner: true }).wallDesigner, true);
assert.equal(productFields({ ...form, wallDesigner: false }).wallDesigner, false);
assert.equal(productFields({ ...form }).wallDesigner, false); assert.equal(productFields({ ...form, wallDesigner: 'yes' }).wallDesigner, false);
assert.equal(cleanProductDraft({ wallDesigner: true, id: 'hack', isActive: false }).wallDesigner, true);
assert.equal(cleanProductDraft({ wallDesigner: true, id: 'hack' }).id, undefined);
ok('product setting: saved only when really ticked (true), old products default to off, the live preview carries it');

// 9. an order of a wall product: pieces = quantity, quantity prices apply
const store = new Map(Object.entries({ 'tenants/bynd': { slug: 'bynd', isActive: true },
  'products/wall': { tenantId: 'bynd', name: { en: 'Hexagon', ar: 'x' }, price: 100, stock: 0, isPreorder: true, isActive: true, deleted: false, options: [], wallDesigner: true, priceTiers: [{ minQty: 10, price: 80 }] },
  'productCosts/wall': { tenantId: 'bynd', costPrice: 30, optionCosts: {} } }));
let auto = 0;
const ref = (col, id) => ({ col, id, path: `${col}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${col}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
const db = { store, collection: (cc) => ({ doc: (id) => ref(cc, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
  async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, op) => w.push(['s', r, d, op]) };
    const out = await fn(tx); for (const [k, r, d, op] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (op?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const res = await placeOrder(db, validateInput({ tenantId: 'bynd', customer: cust, items: [{ productId: 'wall', quantity: W.resizeLayout([], 12).length, selections: {} }] }));
const orderLine = db.store.get(`orders/${res.orderId}`).items[0];
assert.equal(orderLine.quantity, 12); assert.equal(orderLine.unitPrice, 80);
ok('an order of a 12-piece wall: quantity 12, the "from 10 pieces" price (80 each) applies');

console.log(`\nALL ${n} WALL-DESIGNER CHECK GROUPS PASSED`);
