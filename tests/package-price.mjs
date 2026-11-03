// Update 31: package price ("every 3 pieces cost 500").
// Covers the shared maths (browser + server copy), real orders and the price preview on the server,
// the cart, the wall designer lines and the product form. The money must be EXACT (never 500.01).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import { getQuote } from '../api/_lib/quote.js';
import * as Q from '../src/utils/quantityPrices.js';
import { priceCartLines, packageHintFor } from '../src/utils/cartPricing.js';
import { wallLines, wallColorOption } from '../src/utils/wallColors.js';
import { wallMoney } from '../src/utils/wallGroups.js';

// productForm.js / preview.js import without file endings (the browser build allows it): bundle them first.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'tests', `.pk-${process.pid}.cjs`);
await build({ stdin: { contents: `export * from ${JSON.stringify(root + '/src/utils/productForm.js')}; export * from ${JSON.stringify(root + '/src/utils/preview.js')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', define: { 'import.meta.env': '{}' } });
const { productFields, PRODUCT_DRAFT_KEYS } = createRequire(import.meta.url)(outfile);
fs.rmSync(outfile, { force: true });

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ---------- the shared maths ----------
assert.equal(fs.readFileSync('src/utils/quantityPrices.js', 'utf8'), fs.readFileSync('api/_lib/quantityPrices.js', 'utf8'));
ok('browser and server copies of quantityPrices.js are identical');

const pkg = { qty: 3, price: 500 };
assert.deepEqual(Q.cleanPackage({ price: 200, packageQty: 3, packagePrice: 500 }), pkg);
assert.deepEqual(Q.cleanPackage({ price: 200, packageQty: '3', packagePrice: '500' }), pkg);          // typed text
assert.equal(Q.cleanPackage({ price: 200, packageQty: 3, packagePrice: 600 }), null);               // not cheaper than 3 x 200
assert.equal(Q.cleanPackage({ price: 200, packageQty: 3, packagePrice: 700 }), null);
assert.equal(Q.cleanPackage({ price: 200, packageQty: 1, packagePrice: 100 }), null);               // a package is 2 pieces or more
assert.equal(Q.cleanPackage({ price: 200, packageQty: 2.5, packagePrice: 100 }), null);
assert.equal(Q.cleanPackage({ price: 200, packageQty: 3, packagePrice: -5 }), null);
assert.equal(Q.cleanPackage({ price: 200, packageQty: 501, packagePrice: 1 }), null);
assert.equal(Q.cleanPackage({ price: 200 }), null);                                                   // old product: no package
assert.equal(Q.cleanPackage({ price: 200, packageQty: 0, packagePrice: 0 }), null);
ok('a package is valid only when it is 2+ whole pieces and cheaper than buying one by one');

assert.equal(Q.packageProblem('', '', 200), '');
assert.equal(Q.packageProblem('3', '', 200), 'incomplete');
assert.equal(Q.packageProblem('', '500', 200), 'incomplete');
assert.equal(Q.packageProblem('1', '100', 200), 'qty');
assert.equal(Q.packageProblem('3', '-1', 200), 'price');
assert.equal(Q.packageProblem('3', '600', 200), 'notCheaper');
assert.equal(Q.packageProblem('3', '500', 200), '');
ok('the product form tells the owner what is wrong with the package boxes');

// 1 = 200, 2 = 400, 3 = 500, 4 = 700, 5 = 900, 6 = 1000, 7 = 1200
assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 9].map((k) => Q.packageGroupTotal(pkg, 200, k)), [0, 200, 400, 500, 700, 900, 1000, 1200, 1500]);
assert.deepEqual(Q.packageProgress(pkg, 4), { packages: 1, rest: 1, missing: 2 });
assert.deepEqual(Q.packageProgress(pkg, 6), { packages: 2, rest: 0, missing: 0 });
assert.deepEqual(Q.packageProgress(pkg, 0), { packages: 0, rest: 0, missing: 0 });
ok('the owner\'s numbers: 1 = 200, 2 = 400, 3 = 500, 4 = 700, 5 = 900, 6 = 1000');

// exactness: lines of one group ALWAYS add up to the group's total, even when the package does not divide evenly
const sumShares = (r) => Math.round(r.reduce((s, x) => s + x.baseTotal, 0) * 100) / 100;
const odd = { qty: 3, price: 100 }; // 33.333... per piece
for (const split of [[1, 1, 1], [2, 1], [1, 2], [3], [1, 1, 1, 1], [2, 2, 2], [5, 1]]) {
  const lines = split.map((q) => ({ selections: { col: 'a' }, quantity: q }));
  const total = split.reduce((a, b) => a + b, 0);
  const r = Q.packageAddition(odd, 40, 'col', [], lines);
  assert.equal(sumShares(r), Q.packageGroupTotal(odd, 40, total), JSON.stringify(split));
}
assert.equal(sumShares(Q.packageAddition(pkg, 200, 'col', [], [{ selections: { col: 'a' }, quantity: 3 }])), 500);
ok('exact money: the lines of a group add up to the group total (3 pieces = 500.00, never 500.01), even for odd packages');

// adding to what is already in the cart: 2 black in the cart + 1 black completes the package (100 more, not 200)
let r = Q.packageAddition(pkg, 200, 'col', [{ selections: { col: 'black' }, quantity: 2 }], [{ selections: { col: 'black' }, quantity: 1 }]);
assert.deepEqual(r, [{ baseTotal: 100, packages: 1 }]);
// ... but a blue piece does not complete the black package (counted by colour)
r = Q.packageAddition(pkg, 200, 'col', [{ selections: { col: 'black' }, quantity: 2 }], [{ selections: { col: 'blue' }, quantity: 1 }]);
assert.deepEqual(r, [{ baseTotal: 200, packages: 0 }]);
// ... but it does when the product counts all pieces together
r = Q.packageAddition(pkg, 200, '', [{ selections: { col: 'black' }, quantity: 2 }], [{ selections: { col: 'blue' }, quantity: 1 }]);
assert.deepEqual(r, [{ baseTotal: 100, packages: 1 }]);
assert.equal(Q.lineAmount({ unitPrice: 33.33, quantity: 3, lineTotal: 100 }), 100);
assert.equal(Q.lineAmount({ unitPrice: 90, quantity: 4 }), 360);
ok('adding to the cart: same colour completes the package, another colour does not (unless the shop counts all together)');

// ---------- the server ----------
function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${col}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (rf) => ({ exists: store.has(rf.path), data: () => structuredClone(store.get(rf.path)) });
  return { store, collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }), getAll: async (...rs) => rs.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...rs) => rs.map(snap), update: (rf, d) => w.push(['u', rf, d]), set: (rf, d, o) => w.push(['s', rf, d, o]) };
      const out = await fn(tx); for (const [k, rf, d, o] of w) store.set(rf.path, k === 'u' ? { ...store.get(rf.path), ...d } : (o?.merge ? { ...(store.get(rf.path) || {}), ...d } : d)); return out; } };
}
const L = (en) => ({ en, ar: en });
const colour = { id: 'col', type: 'color', label: L('Colour'), required: true, values: [
  { id: 'black', label: L('Black'), color: '#111', priceDelta: 0 },
  { id: 'blue', label: L('Blue'), color: '#22f', priceDelta: 0 } ] };
const plate = { id: 'plate', type: 'addon', label: L('Plate'), required: false, values: [{ id: 'yes', label: L('x'), priceDelta: 30 }] };
const hex = (extra = {}) => ({ tenantId: 'bynd', name: L('Hexagon'), price: 200, stock: 0, isActive: true, deleted: false, isPreorder: true,
  options: [colour, plate], packageQty: 3, packagePrice: 500, tierGroupOption: 'col', ...extra });
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items, extra = {}) => validateInput({ tenantId: 'bynd', customer: cust, items, ...extra });
const world = (products, tenant = {}, promos = {}) => makeDb({ 'tenants/bynd': { slug: 'bynd', isActive: true, ...tenant },
  ...Object.fromEntries(Object.entries(products).map(([k, v]) => [`products/${k}`, v])),
  ...Object.fromEntries(Object.entries(promos).map(([k, v]) => [`promoCodes/bynd__${k}`, { tenantId: 'bynd', code: k, isActive: true, usedCount: 0, ...v }])) });
const orderOf = (db, res) => db.store.get(`orders/${res.orderId}`);
const rejects = async (pr, code) => { try { await pr; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); return e; } };
const buy = async (items, product = hex(), tenant = {}, promos = {}, extra = {}) => {
  const db = world({ hex: product }, tenant, promos);
  const res = await placeOrder(db, mk(items, extra));
  return { db, res, o: orderOf(db, res) };
};
const black = (q, extra = {}) => ({ productId: 'hex', quantity: q, selections: { col: 'black', ...extra } });
const blue = (q, extra = {}) => ({ productId: 'hex', quantity: q, selections: { col: 'blue', ...extra } });

// 1. the owner's numbers in real orders
for (const [qty, total] of [[1, 200], [2, 400], [3, 500], [4, 700], [5, 900], [6, 1000], [7, 1200]]) {
  const { o } = await buy([black(qty)]);
  assert.equal(o.subtotal, total, `${qty} black`);
  assert.equal(o.totalAmount, total);
  assert.equal(o.items[0].subtotal, total);
  assert.equal(o.items[0].lineTotal, total);
}
const full = (await buy([black(3)])).o;
assert.equal(full.items[0].packageSize, 3);
assert.equal(full.items[0].unitPrice, 166.67);        // only for display: the exact amount is the line total
assert.equal('packageSize' in (await buy([black(2)])).o.items[0], false);
ok('real orders: 1 = 200, 2 = 400, 3 = 500 (exactly), 4 = 700, 5 = 900, 6 = 1000, 7 = 1200');

// 2. same colour: 3 black + 3 blue = 2 packages; 2 black + 1 blue = no package
let t = await buy([black(3), blue(3)]);
assert.equal(t.o.subtotal, 1000); assert.deepEqual(t.o.items.map((l) => l.lineTotal), [500, 500]);
t = await buy([black(2), blue(1)]);
assert.equal(t.o.subtotal, 600); assert.deepEqual(t.o.items.map((l) => l.lineTotal), [400, 200]);
t = await buy([black(3), blue(1)]);
assert.equal(t.o.subtotal, 700);
t = await buy([black(4), blue(2)]);
assert.equal(t.o.subtotal, 700 + 400);
ok('"same colour" setting: 3 black + 3 blue = 1000, 2 black + 1 blue = 600 (no package), 3 black + 1 blue = 700');

// 3. the shop can change the policy: any 3 pieces count (setting '' = all together), no code change
t = await buy([black(2), blue(1)], hex({ tierGroupOption: '' }));
assert.equal(t.o.subtotal, 500); assert.equal(t.o.items.reduce((s, l) => s + l.lineTotal, 0), 500);
t = await buy([black(2), blue(2)], hex({ tierGroupOption: '' }));
assert.equal(t.o.subtotal, 700);
ok('policy "any 3 pieces": 2 black + 1 blue = 500, 2 black + 2 blue = 700 (just a different setting)');

// 4. the lines of one group share the package exactly (same colour, different extras)
t = await buy([black(1), black(2, { plate: true })]);
assert.equal(t.o.subtotal, 500 + 2 * 30);                // one package + the plate on 2 pieces
assert.equal(Math.round(t.o.items.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100, 560);
t = await buy([black(3, { plate: true })]);
assert.equal(t.o.subtotal, 590);
ok('extras are added per piece on top of the package (3 black with a plate = 500 + 90)');

// 5. an odd package never drifts by a cent
t = await buy([black(3)], hex({ price: 40, packageQty: 3, packagePrice: 100 }));
assert.equal(t.o.subtotal, 100); assert.equal(t.o.totalAmount, 100); assert.equal(t.o.items[0].lineTotal, 100);
t = await buy([black(1), black(1, { plate: true }), blue(1)], hex({ price: 40, packageQty: 3, packagePrice: 100, tierGroupOption: '' }));
assert.equal(Math.round(t.o.items.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100, 130); // 100 + one plate (30)
assert.equal(t.o.subtotal, 130);
ok('odd packages (3 for 100) are exact in the order total');

// 6. the quote (checkout preview) = the real order
for (const items of [[black(3)], [black(4)], [black(3), blue(3)], [black(2), blue(1)], [black(1), black(2, { plate: true })]]) {
  const db = world({ hex: hex() });
  const q = await getQuote(db, mk(items));
  const res = await placeOrder(db, mk(items));
  assert.equal(q.subtotal, orderOf(db, res).subtotal);
  assert.equal(q.total, orderOf(db, res).totalAmount);
}
ok('the checkout preview shows exactly what the real order costs');

// 7. the browser cannot change the price
t = await buy([{ ...black(3), unitPrice: 1, lineTotal: 1, packageSize: 99, tierMinQty: 5, basePrice: 1, pkg: { qty: 2, price: 1 } }]);
assert.equal(t.o.subtotal, 500);
ok('prices, line totals or packages sent by the browser are ignored');

// 8. a product with a package ignores price steps (package OR steps), old products are unchanged
t = await buy([black(5)], hex({ priceTiers: [{ minQty: 5, price: 10 }] }));
assert.equal(t.o.subtotal, 900); assert.equal('tierMinQty' in t.o.items[0], false);
t = await buy([black(10)], hex({ packageQty: 0, packagePrice: 0, priceTiers: [{ minQty: 5, price: 150 }] }));
assert.equal(t.o.subtotal, 1500);
t = await buy([black(3)], hex({ packageQty: undefined, packagePrice: undefined }));
assert.equal(t.o.subtotal, 600); assert.equal('lineTotal' in t.o.items[0], false);
t = await buy([black(3)], hex({ packageQty: 3, packagePrice: 650 })); // a package dearer than buying one by one is ignored
assert.equal(t.o.subtotal, 600);
ok('a package replaces price steps; no package (or an invalid one) = the old behaviour');

// 9. promo codes: a package counts like a quantity price (the shop setting decides)
const tenantNoPromo = { checkout: { promoOnQuantityPrices: false } };
const promo = { TEN: { type: 'percent', value: 10 } };
t = await buy([black(3)], hex(), {}, promo, { promoCode: 'TEN' });
assert.equal(t.o.discount, 50); assert.equal(t.o.totalAmount, 450);
await rejects(placeOrder(world({ hex: hex() }, tenantNoPromo, promo), mk([black(3)], { promoCode: 'TEN' })), 'PROMO_NOT_ON_QTY');
t = await buy([black(2)], hex(), tenantNoPromo, promo, { promoCode: 'TEN' });
assert.equal(t.o.discount, 40);
t = await buy([black(3), blue(1)], hex(), tenantNoPromo, promo, { promoCode: 'TEN' });
assert.equal(t.o.discount, 20);                                  // only the blue piece (no package) is eligible
ok('promo codes: allowed on packages by default; when the shop switches that off, only pieces outside a package get the discount');

// ---------- the cart (browser) ----------
const cl = (key, q, selections, extra = {}) => ({ key, productId: 'hex', quantity: q, selections, unitPrice: 200, basePrice: 200, priceDelta: 0, tiers: [], tierGroup: 'col', pkg, ...extra });
let cart = priceCartLines([cl('a', 3, { col: 'black' }), cl('b', 3, { col: 'blue' })]);
assert.deepEqual(cart.map((l) => l.lineTotal), [500, 500]);
assert.deepEqual(cart.map((l) => l.packageSize), [3, 3]);
assert.equal(wallMoney(cart), 1000);
cart = priceCartLines([cl('a', 2, { col: 'black' }), cl('b', 1, { col: 'blue' })]);
assert.deepEqual(cart.map((l) => l.lineTotal), [400, 200]);
assert.deepEqual(cart.map((l) => l.packageSize), [0, 0]);
cart = priceCartLines([cl('a', 4, { col: 'black' })]);
assert.equal(cart[0].lineTotal, 700); assert.equal(cart[0].unitPrice, 175);
cart = priceCartLines([cl('a', 2, { col: 'black' }), cl('b', 1, { col: 'blue' })].map((l) => ({ ...l, tierGroup: '' })));
assert.deepEqual(cart.map((l) => l.lineTotal), [333.33, 166.67]);          // shares of one package of 500 ...
assert.equal(Math.round(cart.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100, 500); // ... that add up exactly
cart = priceCartLines([cl('a', 2, { col: 'black' }, { priceDelta: 30 })]);
assert.equal(cart[0].lineTotal, 460);
assert.equal(priceCartLines([{ key: 'old', productId: 'x', quantity: 2, unitPrice: 77 }])[0].unitPrice, 77);  // old carts unchanged
ok('cart: package lines get exact totals (3 black + 3 blue = 1000, 2 + 1 = 600, any-3 = 500 shared exactly)');

const items4 = [cl('a', 4, { col: 'black' }), cl('b', 3, { col: 'blue' })];
assert.deepEqual(packageHintFor(items4, items4[0]), { missing: 2, qty: 3, price: 500 });
assert.equal(packageHintFor(items4, items4[1]), null);
assert.equal(packageHintFor([{ productId: 'x', quantity: 1 }], { productId: 'x' }), null);
ok('cart hint: "add 2 more black to complete another package", nothing when the package is full');

// ---------- the wall designer lines ----------
const wallProduct = { ...hex(), id: 'hex', wallDesigner: true, options: [colour] };
const colorOpt = wallColorOption(wallProduct);
const cells = (b, u) => [...Array.from({ length: b }, (_, i) => ({ q: i, r: 0, c: 'black' })), ...Array.from({ length: u }, (_, i) => ({ q: i, r: 1, c: 'blue' }))];
let w = wallLines({ product: wallProduct, selections: {}, cells: cells(3, 3), cartItems: [], colorOpt });
assert.deepEqual(w.lines.map((l) => l.lineTotal), [500, 500]); assert.equal(w.subtotal, 1000);
assert.deepEqual(w.lines.map((l) => l.packageSize), [3, 3]);
w = wallLines({ product: wallProduct, selections: {}, cells: cells(2, 1), cartItems: [], colorOpt });
assert.equal(w.subtotal, 600);
w = wallLines({ product: wallProduct, selections: {}, cells: cells(4, 0), cartItems: [], colorOpt });
assert.equal(w.subtotal, 700);
// 2 black are already in the cart: one more black completes the package (adds 100, not 200)
w = wallLines({ product: wallProduct, selections: {}, cells: cells(1, 0), cartItems: [{ productId: 'hex', selections: { col: 'black' }, quantity: 2 }], colorOpt });
assert.equal(w.subtotal, 100);
ok('wall designer: a coloured wall is priced per colour package (3 + 3 = 1000), pieces already in the cart count');

// the wall lines go through the real server and cost exactly the same
{
  const lines = wallLines({ product: wallProduct, selections: {}, cells: cells(3, 3), cartItems: [], colorOpt }).lines;
  const db = world({ hex: wallProduct });
  const wid = 'w1';
  const body = lines.map((l) => ({ productId: 'hex', quantity: l.quantity, selections: l.selections, wallId: wid }));
  const walls = [{ id: wid, productId: 'hex', cells: cells(3, 3).map(({ q, r, c }) => ({ q, r, c })) }];
  const res = await placeOrder(db, mk(body, { walls }));
  const o = orderOf(db, res);
  assert.equal(o.subtotal, 1000);
  assert.equal(o.subtotal, lines.reduce((s, l) => s + l.lineTotal, 0));
  assert.equal(o.walls.length, 1);
}
ok('a wall order costs on the server exactly what the designer showed (1000)');

// ---------- the product form ----------
const form = (extra = {}) => ({ nameEn: 'Hex', nameAr: 'هكس', price: '200', packageQty: '3', packagePrice: '500', priceTiers: [], options: [], ...extra });
let rec = productFields(form());
assert.equal(rec.packageQty, 3); assert.equal(rec.packagePrice, 500); assert.deepEqual(rec.priceTiers, []);
rec = productFields(form({ priceTiers: [{ minQty: '5', price: '150' }] }));
assert.deepEqual(rec.priceTiers, []);                                  // package wins over steps
rec = productFields(form({ packagePrice: '650' }));
assert.equal(rec.packageQty, 0); assert.equal(rec.packagePrice, 0);   // dearer than one by one: dropped
rec = productFields(form({ packageQty: '', packagePrice: '', priceTiers: [{ minQty: '5', price: '150' }] }));
assert.equal(rec.packageQty, 0); assert.equal(rec.priceTiers.length, 1);
rec = productFields(form({ options: [{ id: 'col', type: 'color', labelEn: 'Colour', labelAr: 'اللون', required: true, values: [{ id: 'a', labelEn: 'A', labelAr: 'أ', color: '#000' }] }], tierGroupOption: 'col' }));
assert.equal(rec.tierGroupOption, 'col');
rec = productFields(form({ packageQty: '', packagePrice: '', tierGroupOption: 'col' }));
assert.equal(rec.tierGroupOption, '');                                 // the "how counted" setting only matters with steps or a package
assert.ok(PRODUCT_DRAFT_KEYS.includes('packageQty') && PRODUCT_DRAFT_KEYS.includes('packagePrice'));
ok('the product form saves the package (and drops steps or an invalid package); the live preview knows the new fields');

console.log(`\nALL ${n} PACKAGE-PRICE CHECK GROUPS PASSED`);
