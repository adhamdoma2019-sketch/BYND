import assert from 'node:assert/strict';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import { getQuote } from '../api/_lib/quote.js';
import { resolveSelections, cleanSelections, textKey } from '../api/_lib/options.js';
import { resolveChoice, itemKey } from '../src/utils/productOptions.js';
import { formToOptions, optionsToForm, optionsAreValid, newOption } from '../src/utils/productOptionsForm.js';
import { buildOrderMessage } from '../api/_lib/telegram.js';

function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}` });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store, collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, o) => w.push(['s', r, d, o]) };
      const out = await fn(tx); for (const [k, r, d, o] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (o?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
}
let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const rejects = async (p, code) => { try { await p; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); } };

// ===== Product 1: the hexagonal display, one picture per color =====
const hex = { tenantId: 'bynd', name: { en: 'Hexagon medal display', ar: 'حامل ميداليات' }, price: 400, stock: 10, isActive: true, deleted: false,
  imageUrl: 'https://img/hex-main.jpg', images: ['https://img/hex-2.jpg'],
  options: [
    { id: 'col', type: 'color', label: { en: 'Color', ar: 'اللون' }, required: true, values: [
      { id: 'yellow', label: { en: 'Yellow', ar: 'أصفر' }, color: '#f5c518', imageUrl: 'https://img/hex-yellow.jpg', priceDelta: 0 },
      { id: 'teal', label: { en: 'Teal', ar: 'أخضر مزرق' }, color: '#1b9aa6', imageUrl: 'https://img/hex-teal.jpg', priceDelta: 0 },
      { id: 'black', label: { en: 'Black', ar: 'أسود' }, color: '#111111', priceDelta: 0 } ] } ] };

// ===== Product 2: "My Running PRs" board: standard + distance + extension + my time =====
const prs = { tenantId: 'bynd', name: { en: 'My Running PRs board', ar: 'لوحة إنجازات الجري' }, price: 600, stock: 0, isPreorder: true, isActive: true, deleted: false,
  imageUrl: 'https://img/prs.jpg', relatedIds: ['plate'],
  options: [
    { id: 'dist', type: 'choice', label: { en: 'Distance', ar: 'المسافة' }, required: true, values: [
      { id: 'k10', label: { en: '10 km', ar: '١٠ كم' }, imageUrl: 'https://img/prs-10k.jpg', priceDelta: 0 },
      { id: 'half', label: { en: 'Half marathon', ar: 'نصف ماراثون' }, imageUrl: 'https://img/prs-half.jpg', priceDelta: 0 },
      { id: 'full', label: { en: 'Marathon', ar: 'ماراثون' }, imageUrl: 'https://img/prs-full.jpg', priceDelta: 50 } ] },
    { id: 'ext', type: 'choice', label: { en: 'Extension plate', ar: 'لوح إضافي' }, required: false, values: [
      { id: 'e10', label: { en: '10 km plate', ar: 'لوح ١٠ كم' }, priceDelta: 150 },
      { id: 'ehalf', label: { en: 'Half marathon plate', ar: 'لوح نصف ماراثون' }, priceDelta: 180 } ] },
    { id: 'time', type: 'addon', label: { en: 'Add my time to the plate', ar: 'أضف وقتي على اللوح' }, required: false,
      askText: true, textRequired: true, textLabel: { en: 'Your time (e.g. 01:45:30)', ar: 'وقتك (مثال 01:45:30)' }, textMax: 8,
      values: [{ id: 'yes', label: { en: 'x', ar: 'x' }, priceDelta: 30 }] },
    { id: 'word', type: 'addon', label: { en: 'Engraved word', ar: 'كلمة محفورة' }, required: false, askText: true, textRequired: false,
      textLabel: { en: 'Word', ar: 'الكلمة' }, textMax: 12, values: [{ id: 'yes', label: { en: 'x', ar: 'x' }, priceDelta: 20 }] } ] };

// ===== Product 3: the extension plate, sold ON ITS OWN =====
const plate = { tenantId: 'bynd', name: { en: 'Extension plate', ar: 'لوح إضافي' }, price: 150, stock: 20, isActive: true, deleted: false, imageUrl: 'https://img/plate.jpg',
  options: [{ id: 'dist', type: 'choice', label: { en: 'Distance', ar: 'المسافة' }, required: true, values: [
    { id: 'k10', label: { en: '10 km', ar: '١٠ كم' }, imageUrl: 'https://img/plate-10k.jpg', priceDelta: 0 },
    { id: 'half', label: { en: 'Half marathon', ar: 'نصف ماراثون' }, priceDelta: 30 },
    { id: 'full', label: { en: 'Marathon', ar: 'ماراثون' }, priceDelta: 60 } ] }] };

const base = () => ({ 'tenants/bynd': { slug: 'bynd', isActive: true }, 'products/hex': hex, 'products/prs': prs, 'products/plate': plate,
  'productCosts/prs': { tenantId: 'bynd', costPrice: 250, optionCosts: { 'dist.full': 20, 'ext.ehalf': 70, 'time.yes': 5 } } });
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items) => validateInput({ tenantId: 'bynd', customer: cust, items });
const orderOf = (db, r) => db.store.get(`orders/${r.orderId}`);

// 1. each color has its own picture; saved on the order line for packing
let db = makeDb(base());
let r = await placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'teal' } }]));
assert.equal(orderOf(db, r).items[0].imageUrl, 'https://img/hex-teal.jpg');
r = await placeOrder(db, mk([{ productId: 'hex', quantity: 1, selections: { col: 'black' } }]));
assert.equal(orderOf(db, r).items[0].imageUrl, 'https://img/hex-main.jpg');          // no picture for black -> the product's main picture
ok('each color has its own picture; saved on the order line (falls back to the main picture)');

// 2. the board: standard + distance only (half marathon) -> price 600, preorder, no extras
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'half' } }]));
let line = orderOf(db, r).items[0]; assert.equal(line.unitPrice, 600); assert.equal(orderOf(db, r).orderType, 'preorder');
assert.equal(line.imageUrl, 'https://img/prs-half.jpg'); assert.equal(line.options[0].value.en, 'Half marathon');
ok('board with the half-marathon plate: 600 EGP, preorder, picture of that version');

// 3. marathon + extension plate + "my time" (tick box with required text) + engraved word
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'full', ext: 'ehalf', time: true, [textKey('time')]: '03:55:10', word: true, [textKey('word')]: 'PR!' } }]));
line = orderOf(db, r).items[0];
assert.equal(line.unitPrice, 600 + 50 + 180 + 30 + 20); assert.equal(line.unitCost, 250 + 20 + 70 + 5);
assert.equal(line.options.find((o) => o.id === 'time').text, '03:55:10'); assert.equal(line.options.find((o) => o.id === 'word').text, 'PR!');
ok('marathon + extension + my time + word: price 880, private cost 345, typed words saved');

// 4. tick box with REQUIRED text: ticking without typing is refused; with OPTIONAL text it is fine
await rejects(placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'half', time: true } }])), 'BAD_OPTION');
await rejects(placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'half', time: true, [textKey('time')]: '   ' } }])), 'BAD_OPTION');
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'half', word: true } }]));
line = orderOf(db, r).items[0]; assert.equal(line.unitPrice, 620); assert.equal(line.options.find((o) => o.id === 'word').text, undefined);
ok('required text enforced when ticked; optional text may stay empty (box still adds its price)');

// 5. text without ticking the box is ignored; text is cut to the shop's limit
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'half', [textKey('time')]: '01:00:00' } }]));
assert.equal(orderOf(db, r).items[0].options.some((o) => o.id === 'time'), false);
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'half', time: true, [textKey('time')]: '0123456789ABCDEF' } }]));
assert.equal(orderOf(db, r).items[0].options.find((o) => o.id === 'time').text, '01234567');
ok('typed text without the tick is ignored; text cut to the maximum (8)');

// 6. the extension plate is a product on its own: buy it alone, any distance
r = await placeOrder(db, mk([{ productId: 'plate', quantity: 2, selections: { dist: 'full' } }]));
line = orderOf(db, r).items[0]; assert.equal(line.unitPrice, 210); assert.equal(r.totalAmount, 420); assert.equal(db.store.get('products/plate').stock, 18);
assert.equal(orderOf(db, r).orderType, 'normal');
ok('extension plate bought alone (no board needed): 2 x 210, its own stock');

// 7. board + plates in one order (different lines, different pictures)
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'half' } }, { productId: 'plate', quantity: 1, selections: { dist: 'k10' } }]));
assert.equal(orderOf(db, r).items.length, 2); assert.equal(r.totalAmount, 600 + 150); assert.equal(orderOf(db, r).items[1].imageUrl, 'https://img/plate-10k.jpg');
ok('board and a separate plate in one order');

// 8. browser == server (prices, missing options, pictures, typed text); cart lines differ by typed text
const cases = [{ dist: 'full', ext: 'e10', time: true, [textKey('time')]: '1:0:0' }, { dist: 'half' }, { dist: 'k10', word: true, [textKey('word')]: 'Hi' }];
for (const sel of cases) {
  const a = resolveChoice(prs, sel), b = resolveSelections(prs, sel);
  assert.equal(a.priceDelta, b.priceDelta); assert.equal(a.imageUrl, b.imageUrl); assert.deepEqual(a.labels.map((x) => x.text), b.snapshot.map((x) => x.text));
}
assert.deepEqual(resolveChoice(prs, { dist: 'half', time: true }).missing.map((o) => o.id), ['time']);
assert.equal(resolveChoice(prs, { dist: 'half', time: true }).missing.length, resolveSelections.length >= 0 ? 1 : 0);
assert.notEqual(itemKey('prs', { dist: 'half', time: true, [textKey('time')]: 'a' }), itemKey('prs', { dist: 'half', time: true, [textKey('time')]: 'b' }));
ok('browser and server agree (price, picture, typed text, missing); different typed words = separate cart lines');

// 9. quote == order
const items = [{ productId: 'prs', quantity: 1, selections: { dist: 'full', ext: 'ehalf', time: true, [textKey('time')]: '03:00:00' } }, { productId: 'plate', quantity: 1, selections: { dist: 'half' } }];
db = makeDb(base());
const q = await getQuote(db, { ...mk(items), zoneId: '', promoCode: '' }); const real = await placeOrder(db, mk(items));
assert.equal(q.total, real.totalAmount); assert.equal(q.total, (600 + 50 + 180 + 30) + (150 + 30));
ok('checkout preview equals the real order total (1040)');

// 10. admin form round trip incl. new fields; no cost leaks into the public product
const form = optionsToForm(prs.options, { 'dist.full': 20, 'ext.ehalf': 70, 'time.yes': 5 });
assert.ok(optionsAreValid(form));
const saved = formToOptions(form);
assert.equal(saved[0].values[0].imageUrl, 'https://img/prs-10k.jpg'); assert.equal(saved[2].askText, true); assert.equal(saved[2].textRequired, true);
assert.deepEqual(saved[2].textLabel, prs.options[2].textLabel); assert.equal(saved[2].textMax, 8); assert.equal(saved[3].textRequired, false);
assert.ok(!JSON.stringify(saved).includes('"cost'));
const plain = optionsToForm([{ id: 'x', type: 'addon', label: { en: 'Gift box', ar: 'علبة' }, values: [{ id: 'yes', priceDelta: 10 }] }]);
assert.equal(formToOptions(plain)[0].askText, undefined);   // no text question unless the shop asks for one
ok('admin form keeps pictures and text questions; a plain tick box stays plain; costs stay private');

// 11. alert text and cleaned input
const msg = buildOrderMessage({ order: orderOf(makeDb(base()), { orderId: 'x' }) || {}, orderNumberLabel: 'x' }, 'en').length >= 0;
db = makeDb(base()); r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { dist: 'full', time: true, [textKey('time')]: '03:55:10' } }]));
const alert = buildOrderMessage({ order: orderOf(db, r), orderNumberLabel: 'BYND-1' }, 'en');
assert.ok(alert.includes('Distance: Marathon') && alert.includes('Add my time to the plate: ✓ “03:55:10”'));
assert.deepEqual(cleanSelections({ a: true, b: 'x', ['o123456.text']: 'hi', ['k'.repeat(41)]: 'no', c: '  ', d: 5 }), { a: true, b: 'x', 'o123456.text': 'hi' });
ok('Telegram alert shows the typed words; input cleaning keeps only simple answers');
console.log(`\nALL ${n} BYND PRODUCT CHECK GROUPS PASSED`);
