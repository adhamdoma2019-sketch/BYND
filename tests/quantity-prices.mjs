// Update 19: quantity prices (price per piece drops as the quantity grows) + minimum / maximum per order.
// Covers the shared rules (browser + server copy), the cart, the real server order code and the price preview.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import { getQuote } from '../api/_lib/quote.js';
import * as Q from '../src/utils/quantityPrices.js';
import { groupCountInCart, priceCartLines, productCountInCart } from '../src/utils/cartPricing.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ---------- the browser copy and the server copy must be identical ----------
assert.equal(fs.readFileSync('src/utils/quantityPrices.js', 'utf8'), fs.readFileSync('api/_lib/quantityPrices.js', 'utf8'));
ok('browser and server copies of quantityPrices.js are identical');

// ---------- the rules ----------
const steps = [{ minQty: 5, price: 90 }, { minQty: 10, price: 85 }];
assert.deepEqual(Q.cleanTiers(steps, 100), steps);
assert.deepEqual(Q.cleanTiers([{ minQty: '10', price: '85' }, { minQty: '5', price: '90' }], 100), [{ minQty: 5, price: 90 }, { minQty: 10, price: 85 }]); // typed text, any order
assert.deepEqual(Q.cleanTiers([{ minQty: 5, price: 100 }], 100), []);                 // not cheaper than the normal price
assert.deepEqual(Q.cleanTiers([{ minQty: 5, price: 90 }, { minQty: 10, price: 95 }], 100), [{ minQty: 5, price: 90 }]); // dearer than the step before
assert.deepEqual(Q.cleanTiers([{ minQty: 5, price: 90 }, { minQty: 5, price: 80 }], 100), [{ minQty: 5, price: 90 }]);  // same quantity twice
assert.deepEqual(Q.cleanTiers([{ minQty: 1, price: 50 }, { minQty: 2.5, price: 50 }, { minQty: 'x', price: 1 }, { minQty: 3, price: -1 }, null], 100), []); // 1 is the normal price; no fractions, text or negatives
assert.deepEqual(Q.cleanTiers('nope', 100), []); assert.deepEqual(Q.cleanTiers(undefined, 100), []);
assert.equal(Q.cleanTiers(Array.from({ length: 12 }, (_, i) => ({ minQty: i + 2, price: 90 - i })), 100).length, Q.MAX_TIERS);
ok('only valid price steps are kept: bigger quantity and lower price each time, whole numbers, at most 6');

const p = { price: 100, priceTiers: steps };
assert.equal(Q.unitBasePrice(p, 1), 100); assert.equal(Q.unitBasePrice(p, 4), 100);
assert.equal(Q.unitBasePrice(p, 5), 90); assert.equal(Q.unitBasePrice(p, 9), 90);
assert.equal(Q.unitBasePrice(p, 10), 85); assert.equal(Q.unitBasePrice(p, 400), 85);
assert.equal(Q.unitBasePrice({ price: 100 }, 50), 100);                                // old product, no steps
assert.equal(Q.tierFor(p, 4), null); assert.equal(Q.tierFor(p, 7).minQty, 5);
// if the normal price is later set lower than a step, that step stops counting (never a dearer "discount")
assert.equal(Q.unitBasePrice({ price: 80, priceTiers: steps }, 10), 80);
ok('the price of one piece follows the quantity (4 -> 100, 5 -> 90, 10 -> 85); old products unchanged');

assert.equal(Q.tiersProblem([{ minQty: '5', price: '90' }, { minQty: '', price: '' }], 100), '');
assert.equal(Q.tiersProblem([{ minQty: '5', price: '' }], 100), 'incomplete');
assert.equal(Q.tiersProblem([{ minQty: '1', price: '50' }], 100), 'qty');
assert.equal(Q.tiersProblem([{ minQty: '5', price: '100' }], 100), 'price');
assert.equal(Q.tiersProblem([{ minQty: '5', price: '90' }, { minQty: '10', price: '95' }], 100), 'price');
assert.equal(Q.tiersProblem([{ minQty: '5', price: '90' }, { minQty: '5', price: '80' }], 100), 'order');
assert.equal(Q.tiersProblem(Array.from({ length: 7 }, (_, i) => ({ minQty: i + 2, price: 50 - i })), 100), 'many');
ok('the product form tells the owner what is wrong with the rows');

assert.deepEqual(Q.orderLimits({}), { min: 1, max: 500 });
assert.deepEqual(Q.orderLimits({ minQty: 10, maxQty: 50 }), { min: 10, max: 50 });
assert.deepEqual(Q.orderLimits({ minQty: 0, maxQty: 0 }), { min: 1, max: 500 });
assert.deepEqual(Q.orderLimits({ minQty: 20, maxQty: 5 }), { min: 20, max: 20 });        // a max below the min is lifted to the min
assert.deepEqual(Q.orderLimits({ minQty: 9999, maxQty: 9999 }), { min: 500, max: 500 }); // never above the safety limit
assert.equal(Q.checkTotalQty({ minQty: 10 }, 9).code, 'BELOW_MIN'); assert.equal(Q.checkTotalQty({ minQty: 10 }, 10), null);
assert.equal(Q.checkTotalQty({ maxQty: 50 }, 51).code, 'TOO_MANY'); assert.equal(Q.checkTotalQty({}, 501).code, 'TOO_MANY'); assert.equal(Q.checkTotalQty({}, 500), null);
assert.equal(Q.savingPercent(100, 85), 15); assert.equal(Q.savingPercent(100, 100), 0); assert.equal(Q.savingPercent(0, 5), 0); assert.equal(Q.savingPercent(300, 199), 33);
ok('minimum / maximum per order, safety limit of 500, saving percent');

// ---------- the cart (browser) ----------
const line = (key, productId, quantity, extra = {}) => ({ key, productId, quantity, unitPrice: 100, basePrice: 100, priceDelta: 0, tiers: steps, ...extra });
let cart = priceCartLines([line('a', 'hex', 3, { priceDelta: 0 }), line('b', 'hex', 2, { priceDelta: 20 }), line('c', 'other', 2, { basePrice: 40, unitPrice: 40, tiers: [] })]);
assert.deepEqual(cart.map((l) => l.unitPrice), [90, 110, 40]);          // 3 + 2 = 5 pieces of hex -> 90 (+20 for the second line)
assert.deepEqual(cart.map((l) => l.tierMinQty), [5, 5, 0]);
cart = priceCartLines([line('a', 'hex', 3), line('c', 'other', 20, { tiers: [] })]);
assert.deepEqual(cart.map((l) => l.unitPrice), [100, 100]);             // other products' pieces do not count
assert.equal(priceCartLines([{ key: 'old', productId: 'x', quantity: 9, unitPrice: 77 }])[0].unitPrice, 77); // a cart saved before this update keeps its price
assert.equal(productCountInCart([line('a', 'hex', 3), line('b', 'hex', 4), line('c', 'z', 9)], 'hex'), 7);
ok('cart: lines of one product count together (3 + 2 = 5 -> tier price), other products do not, old carts keep their price');

// ---------- the server: real orders ----------
function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${col}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store, collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, o) => w.push(['s', r, d, o]) };
      const out = await fn(tx); for (const [k, r, d, o] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (o?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
}
const colour = { id: 'col', type: 'color', label: { en: 'Colour', ar: 'اللون' }, required: true, values: [
  { id: 'gold', label: { en: 'Gold', ar: 'ذهبي' }, color: '#d4af37', priceDelta: 0 },
  { id: 'black', label: { en: 'Black', ar: 'أسود' }, color: '#111', priceDelta: 0 } ] };
const plate = { id: 'plate', type: 'addon', label: { en: 'Plate', ar: 'لوح' }, required: false, values: [{ id: 'yes', label: { en: 'x', ar: 'x' }, priceDelta: 30 }] };
const hex = (extra = {}) => ({ tenantId: 'bynd', name: { en: 'Hex', ar: 'هكس' }, price: 100, stock: 0, isActive: true, deleted: false,
  isPreorder: true, options: [colour, plate], priceTiers: steps, ...extra });
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items, extra = {}) => validateInput({ tenantId: 'bynd', customer: cust, items, ...extra });
const world = (products, tenant = {}, promos = {}) => makeDb({ 'tenants/bynd': { slug: 'bynd', isActive: true, ...tenant },
  ...Object.fromEntries(Object.entries(products).map(([k, v]) => [`products/${k}`, v])),
  ...Object.fromEntries(Object.entries(promos).map(([k, v]) => [`promoCodes/bynd__${k}`, { tenantId: 'bynd', code: k, isActive: true, usedCount: 0, ...v }])) });
const rejects = async (pr, code) => { try { await pr; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); return e; } };
const orderOf = (db, r) => db.store.get(`orders/${r.orderId}`);

// 1. colours count together; extras are added on top; the order keeps which step was used
let db = world({ hex: hex() });
let r = await placeOrder(db, mk([
  { productId: 'hex', quantity: 6, selections: { col: 'gold' } },
  { productId: 'hex', quantity: 4, selections: { col: 'black', plate: true } } ]));
let o = orderOf(db, r);
assert.deepEqual(o.items.map((l) => l.unitPrice), [85, 115]);          // 10 pieces -> 85; the plate adds 30
assert.deepEqual(o.items.map((l) => l.tierMinQty), [10, 10]);
assert.equal(o.subtotal, 6 * 85 + 4 * 115); assert.equal(o.totalAmount, 970);
ok('6 gold + 4 black = 10 pieces: all at the 10+ price (85), the plate adds 30 per piece');

// 2. below the first step: normal price, no tier on the line
db = world({ hex: hex() });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 4, selections: { col: 'gold' } }]));
o = orderOf(db, r); assert.equal(o.items[0].unitPrice, 100); assert.equal('tierMinQty' in o.items[0], false); assert.equal(o.subtotal, 400);
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 5, selections: { col: 'gold' } }]));
assert.equal(orderOf(db, r).items[0].unitPrice, 90);
ok('4 pieces cost the normal price, 5 pieces the 5+ price');

// 3. the customer cannot choose the price: extra fields in the request are ignored
db = world({ hex: hex() });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'gold' }, unitPrice: 1, tierMinQty: 99, basePrice: 1, tiers: [{ minQty: 2, price: 0 }] }]));
assert.equal(orderOf(db, r).items[0].unitPrice, 100);
ok('prices, steps or amounts sent by the browser are ignored (the server reads the real product)');

// 4. minimum per order counts all lines of the product; nothing is saved when refused
db = world({ hex: hex({ minQty: 10 }) });
let e = await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 9, selections: { col: 'gold' } }])), 'BELOW_MIN');
assert.equal(e.meta.min, 10); assert.equal(e.meta.name, 'Hex');
await rejects(getQuote(db, mk([{ productId: 'hex', quantity: 9, selections: { col: 'gold' } }])), 'BELOW_MIN');
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 5, selections: { col: 'gold' } }, { productId: 'hex', quantity: 5, selections: { col: 'black' } }]));
assert.equal(orderOf(db, r).items.length, 2);
assert.equal([...db.store.keys()].filter((k) => k.startsWith('orders/')).length, 1);
ok('minimum per order: 9 refused (order and preview), 5 + 5 accepted, nothing saved on a refusal');

// 5. maximum per order, and the 500 safety limit (also in the first check of the request)
db = world({ hex: hex({ maxQty: 50 }) });
e = await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 30, selections: { col: 'gold' } }, { productId: 'hex', quantity: 21, selections: { col: 'black' } }])), 'TOO_MANY');
assert.equal(e.meta.max, 50);
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 50, selections: { col: 'gold' } }])); assert.equal(orderOf(db, r).items[0].unitPrice, 85);
db = world({ hex: hex() });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 100, selections: { col: 'gold' } }])); // more than the old limit of 20
assert.equal(orderOf(db, r).subtotal, 8500);
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 500, selections: { col: 'gold' } }])); assert.equal(orderOf(db, r).subtotal, 42500);
assert.throws(() => mk([{ productId: 'hex', quantity: 501, selections: { col: 'gold' } }]), (x) => x.code === 'TOO_MANY' && x.meta.max === 500);
await rejects(placeOrder(db, { ...mk([{ productId: 'hex', quantity: 1, selections: { col: 'gold' } }]), items: [{ productId: 'hex', quantity: 300, selections: { col: 'gold' } }, { productId: 'hex', quantity: 300, selections: { col: 'black' } }] }), 'TOO_MANY');
ok('maximum per order (lines add up), 100 and 500 pieces are fine, 501 (or 300 + 300 in two lines) is refused');

// 6. counted stock still limits big orders
db = world({ hex: hex({ isPreorder: false, stock: 12, countedOptions: ['col'], optionStock: { 'col.gold': 8, 'col.black': 4 } }) });
e = await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 9, selections: { col: 'gold' } }])), 'OUT_OF_STOCK');
assert.equal(e.meta.stock, 8);
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 8, selections: { col: 'gold' } }, { productId: 'hex', quantity: 4, selections: { col: 'black' } }]));
assert.equal(orderOf(db, r).items[0].unitPrice, 85); assert.equal(db.store.get('products/hex').stock, 0);
ok('big orders still cannot take more than the stock of a colour; the tier price uses the whole order');

// 7. cost snapshot stays per piece (profit goes down with the tier price)
db = world({ hex: hex() }); db.store.set('productCosts/hex', { tenantId: 'bynd', costPrice: 60, optionCosts: { 'plate.yes': 10 } });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 10, selections: { col: 'gold', plate: true } }]));
o = orderOf(db, r); assert.deepEqual([o.items[0].unitPrice, o.items[0].unitCost], [115, 70]);
ok('cost per piece is unchanged by the tier price (profit per piece = 115 - 70)');

// 8. the preview gives the same numbers as the real order
const cart2 = [{ productId: 'hex', quantity: 6, selections: { col: 'gold' } }, { productId: 'hex', quantity: 4, selections: { col: 'black', plate: true } }];
db = world({ hex: hex() });
const qt = await getQuote(db, mk(cart2)); r = await placeOrder(db, mk(cart2));
assert.equal(qt.subtotal, orderOf(db, r).subtotal); assert.equal(qt.total, r.totalAmount); assert.equal(qt.subtotal, 970);
ok('the checkout preview and the real order agree');

// 9. promo codes: on by default; the shop can keep them off quantity-priced items
const tenantOff = { checkout: { promoOnQuantityPrices: false } };
const mixed = [{ productId: 'hex', quantity: 10, selections: { col: 'gold' } }, { productId: 'mug', quantity: 2 }]; // hex 850 (tier) + mug 100
const mug = { tenantId: 'bynd', name: { en: 'Mug' }, price: 50, stock: 5, isActive: true, deleted: false };
db = world({ hex: hex(), mug }, {}, { TEN: { type: 'percent', value: 10 } });
let qq = await getQuote(db, { ...mk(mixed), promoCode: 'TEN' }); assert.equal(qq.subtotal, 950); assert.equal(qq.discount, 95);
db = world({ hex: hex(), mug }, tenantOff, { TEN: { type: 'percent', value: 10 } });
qq = await getQuote(db, { ...mk(mixed), promoCode: 'TEN' }); assert.equal(qq.discount, 10);               // 10% of the mugs only
r = await placeOrder(db, mk(mixed, { promoCode: 'TEN' })); assert.equal(orderOf(db, r).discount, 10); assert.equal(r.totalAmount, 940);
db = world({ hex: hex(), mug }, tenantOff, { FIVE: { type: 'fixed', value: 500 } });
qq = await getQuote(db, { ...mk(mixed), promoCode: 'FIVE' }); assert.equal(qq.discount, 100);              // a fixed amount cannot exceed what is eligible
// every item has a quantity price -> the code is refused with its own message (preview reports it, order refuses)
db = world({ hex: hex() }, tenantOff, { TEN: { type: 'percent', value: 10 } });
const only = [{ productId: 'hex', quantity: 10, selections: { col: 'gold' } }];
qq = await getQuote(db, { ...mk(only), promoCode: 'TEN' }); assert.equal(qq.promoError.code, 'PROMO_NOT_ON_QTY'); assert.equal(qq.discount, 0);
await rejects(placeOrder(db, mk(only, { promoCode: 'TEN' })), 'PROMO_NOT_ON_QTY');
// below the first step the item is NOT quantity-priced, so the code works
qq = await getQuote(db, { ...mk([{ productId: 'hex', quantity: 2, selections: { col: 'gold' } }]), promoCode: 'TEN' }); assert.equal(qq.discount, 20);
// "minimum order" of a code still looks at the whole subtotal
db = world({ hex: hex(), mug }, tenantOff, { BIG: { type: 'percent', value: 10, minOrder: 900 } });
qq = await getQuote(db, { ...mk(mixed), promoCode: 'BIG' }); assert.equal(qq.discount, 10);
ok('promo codes: apply to everything by default; with the shop setting off only to items without a quantity price');

// 10. products without any of this behave exactly as before
db = world({ mug }); r = await placeOrder(db, mk([{ productId: 'mug', quantity: 3 }]));
o = orderOf(db, r); assert.equal(o.items[0].unitPrice, 50); assert.equal('tierMinQty' in o.items[0], false); assert.equal(o.totalAmount, 150);
ok('an old product without steps or limits is unchanged');

// ---------- same-colour offer (update 25): price steps counted separately for each colour / choice ----------
const prod3 = (extra = {}) => hex({ priceTiers: [{ minQty: 3, price: 80 }], ...extra });

// the helpers
assert.equal(Q.tierGroupOption({ tierGroupOption: 'col', options: [colour] }), 'col');
assert.equal(Q.tierGroupOption({ tierGroupOption: 'col', options: [{ ...colour, type: 'choice' }] }), 'col');
assert.equal(Q.tierGroupOption({ tierGroupOption: 'plate', options: [colour, plate] }), '');   // a tick box cannot be the group
assert.equal(Q.tierGroupOption({ tierGroupOption: 'gone', options: [colour] }), '');           // an option that no longer exists
assert.equal(Q.tierGroupOption({ tierGroupOption: 'col' }), ''); assert.equal(Q.tierGroupOption({ options: [colour] }), ''); assert.equal(Q.tierGroupOption(null), '');
assert.equal(Q.groupKeyOf('col', { col: 'gold', x: 'y' }), 'gold'); assert.equal(Q.groupKeyOf('', { col: 'gold' }), ''); assert.equal(Q.groupKeyOf('col', {}), ''); assert.equal(Q.groupKeyOf('col', { col: true }), '');
assert.deepEqual([...Q.groupQuantities('col', [{ selections: { col: 'gold' }, quantity: 2 }, { selections: { col: 'black' }, quantity: 1 }, { selections: { col: 'gold', plate: true }, quantity: 1 }])], [['gold', 3], ['black', 1]]);
assert.deepEqual([...Q.groupQuantities('', [{ selections: { col: 'gold' }, quantity: 2 }, { selections: { col: 'black' }, quantity: 1 }])], [['', 3]]);
ok('same-colour helpers: only a colour / choice option of the product can be the group; pieces are summed per choice');

// the cart (browser)
const t3 = [{ minQty: 3, price: 80 }];
const gline = (key, q, col, extra = {}) => ({ key, productId: 'hex', quantity: q, unitPrice: 100, basePrice: 100, priceDelta: 0, tiers: t3, tierGroup: 'col', selections: { col }, ...extra });
cart = priceCartLines([gline('a', 3, 'gold'), gline('b', 3, 'black')]);
assert.deepEqual(cart.map((l) => l.unitPrice), [80, 80]); assert.deepEqual(cart.map((l) => l.tierMinQty), [3, 3]);
cart = priceCartLines([gline('a', 2, 'gold'), gline('b', 1, 'black')]);
assert.deepEqual(cart.map((l) => l.unitPrice), [100, 100]); assert.deepEqual(cart.map((l) => l.tierMinQty), [0, 0]);
cart = priceCartLines([gline('a', 2, 'gold'), gline('b', 1, 'gold', { selections: { col: 'gold', plate: true }, priceDelta: 30 }), gline('c', 1, 'black')]);
assert.deepEqual(cart.map((l) => l.unitPrice), [80, 110, 100]);   // 2 + 1 gold lines (different extras) = 3 gold -> step; black alone: no step
cart = priceCartLines([{ ...gline('a', 2, 'gold'), tierGroup: '' }, { ...gline('b', 1, 'black'), tierGroup: '' }]);
assert.deepEqual(cart.map((l) => l.unitPrice), [80, 80]);          // a product that counts together behaves as before
assert.equal(groupCountInCart([gline('a', 2, 'gold'), gline('b', 4, 'black'), { ...gline('c', 5, 'gold'), productId: 'z' }], 'hex', 'col', { col: 'gold' }), 2);
assert.equal(groupCountInCart([gline('a', 2, 'gold'), gline('b', 4, 'black')], 'hex', '', { col: 'gold' }), 6); // no group = all pieces of the product
ok('cart: 3 gold + 3 black both get the step, 2 gold + 1 black do not, same colour in two lines counts together');

// the server: real orders
db = world({ hex: prod3({ tierGroupOption: 'col' }) });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 3, selections: { col: 'gold' } }, { productId: 'hex', quantity: 3, selections: { col: 'black' } }]));
o = orderOf(db, r);
assert.deepEqual(o.items.map((l) => l.unitPrice), [80, 80]); assert.deepEqual(o.items.map((l) => l.tierMinQty), [3, 3]); assert.equal(o.subtotal, 480);
ok('server: 3 gold + 3 black = both lines at the step price (80)');

db = world({ hex: prod3({ tierGroupOption: 'col' }) });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 2, selections: { col: 'gold' } }, { productId: 'hex', quantity: 1, selections: { col: 'black' } }]));
o = orderOf(db, r);
assert.deepEqual(o.items.map((l) => l.unitPrice), [100, 100]); assert.ok(o.items.every((l) => l.tierMinQty === undefined)); assert.equal(o.subtotal, 300);
ok('server: 2 gold + 1 black = no discount (3 pieces, but not of the same colour)');

db = world({ hex: prod3({ tierGroupOption: 'col' }) });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 2, selections: { col: 'gold' } }, { productId: 'hex', quantity: 1, selections: { col: 'gold', plate: true } }, { productId: 'hex', quantity: 2, selections: { col: 'black' } }]));
o = orderOf(db, r);
assert.deepEqual(o.items.map((l) => l.unitPrice), [80, 110, 100]);  // gold (2 + 1 with a plate) = 3 -> step, the plate adds 30; black 2 -> normal
ok('server: the same colour in two lines (with and without the plate) counts together');

db = world({ hex: prod3({ tierGroupOption: 'col', minQty: 4 }) });
await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 2, selections: { col: 'gold' } }, { productId: 'hex', quantity: 1, selections: { col: 'black' } }])), 'BELOW_MIN');
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 3, selections: { col: 'gold' } }, { productId: 'hex', quantity: 1, selections: { col: 'black' } }]));
assert.deepEqual(orderOf(db, r).items.map((l) => l.unitPrice), [80, 100]);
db = world({ hex: prod3({ tierGroupOption: 'col', maxQty: 5 }) });
await rejects(placeOrder(db, mk([{ productId: 'hex', quantity: 3, selections: { col: 'gold' } }, { productId: 'hex', quantity: 3, selections: { col: 'black' } }])), 'TOO_MANY');
ok('server: minimum / maximum per order still look at ALL pieces of the product');

// the price preview (quote) gives the same totals as the order
const cartG = [{ productId: 'hex', quantity: 3, selections: { col: 'gold' } }, { productId: 'hex', quantity: 2, selections: { col: 'black', plate: true } }];
db = world({ hex: prod3({ tierGroupOption: 'col' }) });
const qg = await getQuote(db, mk(cartG)); r = await placeOrder(db, mk(cartG));
assert.equal(qg.subtotal, orderOf(db, r).subtotal); assert.equal(orderOf(db, r).subtotal, 3 * 80 + 2 * 130);
ok('quote = order: 3 gold at 80, 2 black with a plate at 100 + 30');

// a product that does not use the setting, or whose setting points at nothing, counts together as before
db = world({ hex: prod3() });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 2, selections: { col: 'gold' } }, { productId: 'hex', quantity: 1, selections: { col: 'black' } }]));
assert.deepEqual(orderOf(db, r).items.map((l) => l.unitPrice), [80, 80]);
db = world({ hex: prod3({ tierGroupOption: 'plate' }) });
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 2, selections: { col: 'gold' } }, { productId: 'hex', quantity: 1, selections: { col: 'black' } }]));
assert.deepEqual(orderOf(db, r).items.map((l) => l.unitPrice), [80, 80]);
ok('no setting (or a setting that points to a tick box) = all pieces count together, as before');

console.log(`\nALL ${n} QUANTITY-PRICE CHECK GROUPS PASSED`);
