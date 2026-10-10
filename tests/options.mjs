import assert from 'node:assert/strict';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import { getQuote } from '../api/_lib/quote.js';
import { resolveSelections } from '../api/_lib/options.js';
import { resolveChoice, itemKey } from '../src/utils/productOptions.js';
import { formToOptions, formToOptionCosts, optionsToForm, optionsAreValid } from '../src/utils/productOptionsForm.js';
import { buildOrderMessage } from '../api/_lib/telegram.js';

function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}` });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store, collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, o) => w.push(['s', r, d, o]) };
      const out = await fn(tx); for (const [k, r, d, o] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (o?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
}
// ----- a board product customised by color, activity, extension and engraving -----
const options = [
  { id: 'col', type: 'color', label: { en: 'Color', ar: 'اللون' }, required: true, values: [
    { id: 'black', label: { en: 'Black', ar: 'أسود' }, color: '#111111', priceDelta: 0 },
    { id: 'gold', label: { en: 'Gold', ar: 'ذهبي' }, color: '#d4af37', priceDelta: 50 } ] },
  { id: 'act', type: 'choice', label: { en: 'Activity', ar: 'النشاط' }, required: true, values: [
    { id: 'run', label: { en: 'Running', ar: 'الجري' }, priceDelta: 0 },
    { id: 'cyc', label: { en: 'Cycling', ar: 'الدراجات' }, priceDelta: 20 } ] },
  { id: 'ext', type: 'addon', label: { en: 'Extension tile', ar: 'قطعة إضافية' }, required: false, values: [{ id: 'yes', label: { en: 'Extension tile', ar: 'قطعة إضافية' }, priceDelta: 150 }] },
  { id: 'txt', type: 'text', label: { en: 'Engraving', ar: 'نقش' }, required: false, maxLength: 10, values: [] },
];
const product = { tenantId: 'bynd', name: { en: 'Board', ar: 'لوحة' }, price: 850, stock: 5, isActive: true, deleted: false, options };
const base = () => ({
  'tenants/bynd': { slug: 'bynd', isActive: true },
  'products/board': product,
  'productCosts/board': { tenantId: 'bynd', costPrice: 350, optionCosts: { 'col.gold': 30, 'act.cyc': 5, 'ext.yes': 60 } },
  'products/plain': { tenantId: 'bynd', name: { en: 'Plain' }, price: 100, stock: 5, isActive: true, deleted: false },
});
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items) => validateInput({ tenantId: 'bynd', customer: cust, items });
const rejects = async (p, code, extra) => { try { await p; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); if (extra) extra(e); } };
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. price: base + choices; cost snapshot includes the private extra costs
let db = makeDb(base());
let r = await placeOrder(db, mk([{ productId: 'board', quantity: 2, selections: { col: 'gold', act: 'cyc', ext: true, txt: 'ABCDEFGHIJKLMNOP' } }]));
let o = db.store.get(`orders/${r.orderId}`); let line = o.items[0];
assert.equal(line.unitPrice, 850 + 50 + 20 + 150); assert.equal(r.totalAmount, 2140);
assert.equal(line.unitCost, 350 + 30 + 5 + 60);
assert.deepEqual(line.options.map((x) => x.id), ['col', 'act', 'ext', 'txt']);
assert.deepEqual(line.options[0].value, { en: 'Gold', ar: 'ذهبي' }); assert.equal(line.options[0].color, '#d4af37');
assert.equal(line.options[3].value, 'ABCDEFGHIJ'); // cut to the shop's limit of 10 characters
ok('unit price = 850+50+20+150, private cost snapshot = 445, choices saved (text cut to max length)');

// 2. required options enforced; unknown value rejected; nothing changes on failure
const before = JSON.stringify([...db.store]);
await rejects(placeOrder(db, mk([{ productId: 'board', quantity: 1, selections: { col: 'black' } }])), 'BAD_OPTION', (e) => assert.deepEqual(e.meta.customLabel, options[1].label));
await rejects(placeOrder(db, mk([{ productId: 'board', quantity: 1, selections: {} }])), 'BAD_OPTION');
await rejects(placeOrder(db, mk([{ productId: 'board', quantity: 1, selections: { col: 'pink', act: 'run' } }])), 'BAD_OPTION');
assert.equal(JSON.stringify([...db.store]), before);
ok('missing required / invalid choice rejected, nothing saved');

// 3. the browser can't set prices: only ids are accepted, unknown keys ignored
r = await placeOrder(db, mk([{ productId: 'board', quantity: 1, selections: { col: 'black', act: 'run', price: '1', unitPrice: 1, hack: true } }]));
assert.equal(db.store.get(`orders/${r.orderId}`).items[0].unitPrice, 850); assert.equal(db.store.get(`orders/${r.orderId}`).items[0].options.length, 2);
ok('forged price fields ignored');

// 4. stock counted per PRODUCT across lines with different choices
db = makeDb(base());
r = await placeOrder(db, mk([
  { productId: 'board', quantity: 2, selections: { col: 'black', act: 'run' } },
  { productId: 'board', quantity: 2, selections: { col: 'gold', act: 'run' } } ]));
assert.equal(db.store.get(`orders/${r.orderId}`).items.length, 2); assert.equal(db.store.get('products/board').stock, 1);
await rejects(placeOrder(db, mk([
  { productId: 'board', quantity: 1, selections: { col: 'black', act: 'run' } },
  { productId: 'board', quantity: 1, selections: { col: 'gold', act: 'run' } } ])), 'OUT_OF_STOCK');
assert.equal(db.store.get('products/board').stock, 1);
ok('two lines of the same product with different colors: stock reduced by 4 in total; oversell blocked');

// 5. identical lines merge, different choices stay apart
const merged = mk([{ productId: 'board', quantity: 1, selections: { col: 'black', act: 'run' } }, { productId: 'board', quantity: 2, selections: { act: 'run', col: 'black' } }, { productId: 'board', quantity: 1, selections: { col: 'gold', act: 'run' } }]);
assert.equal(merged.items.length, 2); assert.equal(merged.items.find((i) => i.selections.col === 'black').quantity, 3);
ok('identical lines merge (order of choices does not matter)');

// 6. products without options are unaffected
db = makeDb(base());
r = await placeOrder(db, mk([{ productId: 'plain', quantity: 1 }])); assert.deepEqual(db.store.get(`orders/${r.orderId}`).items[0].options, []);
ok('products without options work as before');

// 7. quote == order, with options + promo + shipping
const zones = [{ id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' }, price: 50, active: true }];
db = makeDb({ ...base(), 'tenants/bynd': { slug: 'bynd', isActive: true, shipping: { zones } }, 'promoCodes/bynd__TEN': { tenantId: 'bynd', code: 'TEN', type: 'percent', value: 10, isActive: true, usedCount: 0 } });
const items = [{ productId: 'board', quantity: 1, selections: { col: 'gold', act: 'cyc', ext: true } }];
const q = await getQuote(db, { ...mk(items), zoneId: 'cairo', promoCode: 'TEN' });
const real = await placeOrder(db, { ...mk(items), zoneId: 'cairo', promoCode: 'TEN' });
assert.equal(q.subtotal, 1070); assert.equal(q.discount, 107); assert.equal(q.total, real.totalAmount); assert.equal(real.totalAmount, 1070 - 107 + 50);
await rejects(getQuote(db, { ...mk([{ productId: 'board', quantity: 1, selections: { col: 'black' } }]) }), 'BAD_OPTION');
ok('quote total equals order total with options + promo + shipping');

// 8. browser and server agree on prices and on what is missing
const cases = [{ col: 'gold', act: 'cyc', ext: true }, { col: 'black', act: 'run' }, { col: 'gold', act: 'run', txt: 'Hi' }];
for (const sel of cases) assert.equal(resolveChoice(product, sel).priceDelta, resolveSelections(product, sel).priceDelta);
assert.deepEqual(resolveChoice(product, { col: 'black' }).missing.map((x) => x.id), ['act']);
assert.deepEqual(resolveChoice(product, {}).missing.map((x) => x.id), ['col', 'act']);
assert.notEqual(itemKey('board', { col: 'black' }), itemKey('board', { col: 'gold' })); assert.equal(itemKey('board', { a: '1', b: '2' }), itemKey('board', { b: '2', a: '1' }));
ok('browser and server price rules agree; cart line keys differ per choice');

// 9. admin form <-> saved product round trip, private costs kept apart
const form = optionsToForm(options, { 'col.gold': 30, 'act.cyc': 5, 'ext.yes': 60 });
assert.ok(optionsAreValid(form));
const saved = formToOptions(form); const costs = formToOptionCosts(form);
assert.deepEqual(costs, { 'col.gold': 30, 'act.cyc': 5, 'ext.yes': 60 });
assert.ok(!JSON.stringify(saved).includes('"cost')); // no cost data inside the public product
assert.equal(saved[0].values[1].priceDelta, 50); assert.equal(saved[2].values[0].priceDelta, 150); assert.equal(saved[3].maxLength, 10);
assert.equal(optionsAreValid([{ id: 'x', type: 'color', labelEn: 'C', labelAr: '', required: true, values: [{ id: 'v', labelEn: '', labelAr: '', priceDelta: '', costDelta: '' }] }]), false);
ok('admin form round trip; costs never stored in the public product; incomplete options rejected');

// 10. alert text shows the choices
const msg = buildOrderMessage({ order: { ...db.store.get(`orders/${real.orderId}`) }, orderNumberLabel: 'BYND-1' }, 'en');
assert.ok(msg.includes('Color: Gold') && msg.includes('Activity: Cycling') && msg.includes('Extension tile: ✓'));
ok('Telegram alert lists each choice');
console.log(`\nALL ${n} OPTION CHECK GROUPS PASSED`);
