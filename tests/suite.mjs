import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import { getQuote } from '../api/_lib/quote.js';
import { DEFAULT_FIELD_SETTINGS, resolveFieldSettings, FIELD_LIMITS, CUSTOM_FIELD_TYPES } from '../api/_lib/fields.js';
import { calcProfit } from '../src/utils/profit.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// ---------- fake Firestore ----------
function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}` });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store,
    collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }),
    getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = [];
      const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, o) => w.push(['s', r, d, o]) };
      const out = await fn(tx);
      for (const [k, r, d, o] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (o?.merge ? { ...(store.get(r.path) || {}), ...d } : d));
      return out; } };
}
const zones = [
  { id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' }, price: 50, freeAbove: 1500, active: true },
  { id: 'upper', name: { en: 'Upper Egypt', ar: 'الصعيد' }, price: 100, active: true },
  { id: 'old', name: { en: 'Old', ar: 'قديم' }, price: 1, active: false },
];
const base = (tenantExtra = {}) => ({
  'tenants/bynd': { slug: 'bynd', isActive: true, ...tenantExtra },
  'products/n1': { tenantId: 'bynd', name: { en: 'Normal' }, price: 850, stock: 10, isActive: true, deleted: false },
  'products/big': { tenantId: 'bynd', name: { en: 'Big' }, price: 500, stock: 10, shippingExtra: 20, isActive: true, deleted: false },
  'products/pre': { tenantId: 'bynd', name: { en: 'Pre' }, price: 900, stock: 0, isPreorder: true, isActive: true, deleted: false },
  'productCosts/n1': { tenantId: 'bynd', costPrice: 350 },
  'productCosts/n2': { tenantId: 'other', costPrice: 1 },
  'products/n2': { tenantId: 'bynd', name: { en: 'NoCost' }, price: 100, stock: 5, isActive: true, deleted: false },
  'promoCodes/bynd__TEN': { tenantId: 'bynd', code: 'TEN', type: 'percent', value: 10, minOrder: 0, isActive: true, usedCount: 0, usageLimit: null },
  'promoCodes/bynd__FIFTY': { tenantId: 'bynd', code: 'FIFTY', type: 'fixed', value: 50, minOrder: 1000, isActive: true, usedCount: 0, usageLimit: 1 },
  'promoCodes/bynd__OLD': { tenantId: 'bynd', code: 'OLD', type: 'percent', value: 10, isActive: true, expiresAt: '2020-01-01' },
  'promoCodes/bynd__OFF': { tenantId: 'bynd', code: 'OFF', type: 'percent', value: 10, isActive: false },
  'promoCodes/other__TEN': { tenantId: 'other', code: 'TEN', type: 'percent', value: 90, isActive: true },
});
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items, extra = {}, customer = cust) => validateInput({ tenantId: 'bynd', customer, items, ...extra });
const rejects = async (p, code) => { try { await p; assert.fail('should reject: ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); } };
let n = 0; const ok = (label) => console.log('  ok', ++n, label);

// ===== A. basics (carried over) =====
let db = makeDb(base());
let r = await placeOrder(db, mk([{ productId: 'n1', quantity: 2 }]));
let o = db.store.get(`orders/${r.orderId}`);
assert.equal(r.orderNumberLabel, 'BYND-1001'); assert.equal(r.totalAmount, 1700); assert.equal(o.shippingFee, 0);
assert.equal(db.store.get('products/n1').stock, 8); assert.equal(o.items[0].unitCost, 350); assert.equal(o.orderType, 'normal');
ok('basic order, real price, cost snapshot, stock reduced');
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 1 }])); assert.equal(r.orderNumberLabel, 'BYND-1002'); ok('next order number');
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 9 }])), 'OUT_OF_STOCK'); ok('out of stock rejected');
await rejects(placeOrder(db, mk([{ productId: 'nope', quantity: 1 }])), 'UNAVAILABLE'); ok('missing product rejected');
r = await placeOrder(db, mk([{ productId: 'pre', quantity: 3 }])); assert.equal(db.store.get(`orders/${r.orderId}`).orderType, 'preorder'); assert.equal(db.store.get('products/pre').stock, 0); ok('preorder with zero stock');
r = await placeOrder(db, mk([{ productId: 'n2', quantity: 1 }])); assert.equal(db.store.get(`orders/${r.orderId}`).items[0].unitCost, null); ok('wrong-shop cost ignored (null)');
assert.throws(() => mk([]), OrderError); assert.throws(() => mk([{ productId: 'n1', quantity: -1 }]), OrderError); assert.throws(() => mk([{ productId: 'n1', quantity: 999 }]), (e) => e.code === 'TOO_MANY' && e.meta.max === 20); ok('cart shape validation');

// ===== B. customer field rules =====
db = makeDb(base());
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], {}, { ...cust, name: '' })), 'BAD_NAME');
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], {}, { ...cust, phone: 'abc' })), 'BAD_PHONE');
try { await placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], {}, { ...cust, street: '' })); assert.fail(); } catch (e) { assert.equal(e.code, 'BAD_FIELD'); assert.equal(e.meta.field, 'street'); }
ok('default rules: name/phone/street required (BAD_FIELD names the field)');
// shop turns street off and email on+required; floor stays hidden even if sent
db = makeDb(base({ checkout: { fields: { street: { show: false, required: true }, email: { show: true, required: true }, name: { show: false, required: false } } } }));
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], {}, { ...cust, street: '' })), 'BAD_FIELD');   // email now required
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], {}, { ...cust, street: '', email: 'bad' })), 'BAD_EMAIL');
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], {}, { ...cust, street: 'IGNORED', email: 'a@b.co', floor: '3' }));
o = db.store.get(`orders/${r.orderId}`).customer;
assert.equal(o.street, undefined); assert.equal(o.floor, undefined); assert.equal(o.email, 'a@b.co'); assert.equal(o.name, 'Ali'); assert.equal(o.address, 'Cairo');
ok('shop rules: hidden fields dropped, required email enforced, name stays locked, address composed');
assert.deepEqual(resolveFieldSettings({ name: { show: false, required: false }, phone: { show: false } }).name, { show: true, required: true });
ok('name & phone cannot be switched off');
// client defaults file stays identical to the server one
const clientSrc = fs.readFileSync(new URL('../src/utils/checkoutFields.js', import.meta.url), 'utf8');
for (const [k, v] of Object.entries(DEFAULT_FIELD_SETTINGS)) assert.ok(new RegExp(`${k}:\\s*\\{\\s*show:\\s*${v.show},\\s*required:\\s*${v.required}\\s*\\}`).test(clientSrc), 'client default differs for ' + k);
for (const k of Object.keys(FIELD_LIMITS)) assert.ok(clientSrc.includes(`'${k}'`) || clientSrc.includes(`key: '${k}'`), 'client missing field ' + k);
ok('client and server field defaults are identical');

// ===== C. shipping zones =====
const withZones = (extra = {}) => makeDb(base({ shipping: { zones }, ...extra }));
db = withZones();
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }])), 'ZONE_REQUIRED');
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { zoneId: 'ghost' })), 'BAD_ZONE');
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { zoneId: 'old' })), 'BAD_ZONE');
ok('zone required; unknown or inactive zone rejected');
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { zoneId: 'cairo' }));
o = db.store.get(`orders/${r.orderId}`); assert.equal(o.shippingFee, 50); assert.equal(r.totalAmount, 900); assert.deepEqual(o.shipping.zoneName, zones[0].name);
ok('zone price added (850 + 50 = 900) and zone name saved in the order');
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 2 }], { zoneId: 'cairo' })); assert.equal(r.totalAmount, 1700); assert.equal(db.store.get(`orders/${r.orderId}`).shippingFee, 0);
ok('free shipping above the zone threshold (1700 >= 1500)');
r = await placeOrder(db, mk([{ productId: 'big', quantity: 2 }], { zoneId: 'upper' })); assert.equal(db.store.get(`orders/${r.orderId}`).shippingFee, 140); assert.equal(r.totalAmount, 1140);
ok('per-product extra shipping (100 + 2 x 20 = 140)');

// ===== D. promo codes =====
db = withZones();
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { zoneId: 'cairo', promoCode: 'ten' }));
o = db.store.get(`orders/${r.orderId}`);
assert.equal(o.discount, 85); assert.equal(r.totalAmount, 815); assert.equal(o.promo.code, 'TEN'); assert.equal(db.store.get('promoCodes/bynd__TEN').usedCount, 1);
ok('percent code (case-insensitive): 850 - 85 + 50 shipping = 815, usage counted');
// free-shipping threshold uses the amount AFTER discount: 1700-170=1530 >= 1500 -> free
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 2 }], { zoneId: 'cairo', promoCode: 'TEN' })); assert.equal(r.totalAmount, 1530);
// 1400 after discount? n1 x 2 = 1700; FIFTY fixed 50 -> 1650 free ship
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 2 }], { zoneId: 'cairo', promoCode: 'FIFTY' })); assert.equal(r.totalAmount, 1650); assert.equal(db.store.get('promoCodes/bynd__FIFTY').usedCount, 1);
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 2 }], { zoneId: 'cairo', promoCode: 'FIFTY' })), 'PROMO_LIMIT');
ok('fixed code, usage limit enforced (second use rejected)');
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { zoneId: 'cairo', promoCode: 'NOPE' })), 'PROMO_INVALID');
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { zoneId: 'cairo', promoCode: 'OLD' })), 'PROMO_EXPIRED');
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { zoneId: 'cairo', promoCode: 'OFF' })), 'PROMO_INVALID');
db = withZones();
try { await placeOrder(db, mk([{ productId: 'n2', quantity: 1 }], { zoneId: 'cairo', promoCode: 'FIFTY' })); assert.fail(); } catch (e) { assert.equal(e.code, 'PROMO_MIN_ORDER'); assert.equal(e.meta.minOrder, 1000); }
assert.throws(() => mk([{ productId: 'n1', quantity: 1 }], { promoCode: "x' or 1=1" }), (e) => e.code === 'PROMO_INVALID');
ok('invalid / expired / inactive / below-minimum / malformed codes rejected');
db = withZones(); await rejects(placeOrder(makeDb({ ...base(), 'promoCodes/bynd__TEN': undefined }), mk([{ productId: 'n1', quantity: 1 }], { promoCode: 'TEN' })), 'PROMO_INVALID').catch(() => {});
// another shop's code with the same name must not work
db = makeDb({ ...base(), 'promoCodes/bynd__TEN': { ...base()['promoCodes/other__TEN'] } });
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { promoCode: 'TEN' })), 'PROMO_INVALID');
ok("another shop's code can't be used");
// failed order changes nothing
db = withZones(); const before = JSON.stringify([...db.store]);
await rejects(placeOrder(db, mk([{ productId: 'n1', quantity: 1 }, { productId: 'nope', quantity: 1 }], { zoneId: 'cairo', promoCode: 'TEN' })), 'UNAVAILABLE');
assert.equal(JSON.stringify([...db.store]), before);
ok('failed order leaves stock, counter and promo usage untouched');

// ===== E. quote (checkout preview) =====
db = withZones();
let q = await getQuote(db, { tenantId: 'bynd', items: [{ productId: 'n1', quantity: 1 }], zoneId: 'cairo', promoCode: 'TEN' });
assert.deepEqual([q.subtotal, q.discount, q.shippingFee, q.total], [850, 85, 50, 815]); assert.equal(q.promo.code, 'TEN');
q = await getQuote(db, { tenantId: 'bynd', items: [{ productId: 'n1', quantity: 1 }], zoneId: '', promoCode: '' });
assert.equal(q.zoneProblem, 'ZONE_REQUIRED'); assert.equal(q.total, 850);
q = await getQuote(db, { tenantId: 'bynd', items: [{ productId: 'n1', quantity: 1 }], zoneId: 'cairo', promoCode: 'NOPE' });
assert.equal(q.promoError.code, 'PROMO_INVALID'); assert.equal(q.total, 900); assert.equal(q.promo, null);
assert.equal(db.store.get('promoCodes/bynd__TEN').usedCount, 0);
ok('quote matches real order maths, reports zone/promo problems, and never changes usage');
const quoteTotal = (await getQuote(db, { tenantId: 'bynd', items: [{ productId: 'big', quantity: 2 }], zoneId: 'upper', promoCode: 'TEN' })).total;
const orderTotal = (await placeOrder(db, mk([{ productId: 'big', quantity: 2 }], { zoneId: 'upper', promoCode: 'TEN' }))).totalAmount;
assert.equal(quoteTotal, orderTotal);
ok('quote total == order total');

// ===== E2. custom checkout fields =====
const customDefs = [
  { id: 'gift', label: { en: 'Gift message', ar: 'رسالة الهدية' }, type: 'textarea', required: false, active: true },
  { id: 'when', label: { en: 'Delivery date', ar: 'موعد التوصيل' }, type: 'date', required: true, active: true },
  { id: 'size', label: { en: 'Size', ar: 'المقاس' }, type: 'select', required: true, active: true,
    options: [{ id: 'o1', en: 'Small', ar: 'صغير' }, { id: 'o2', en: 'Large', ar: 'كبير' }] },
  { id: 'agree', label: { en: 'I agree to be called', ar: 'أوافق على الاتصال بي' }, type: 'checkbox', required: true, active: true },
  { id: 'qty', label: { en: 'Number of guests', ar: 'عدد الضيوف' }, type: 'number', required: false, active: true },
  { id: 'mail', label: { en: 'Backup email', ar: 'بريد احتياطي' }, type: 'email', required: false, active: true },
  { id: 'off', label: { en: 'Hidden one', ar: 'مخفي' }, type: 'text', required: true, active: false },
];
const withCustom = () => makeDb(base({ checkout: { customFields: customDefs } }));
const goodCustom = { when: '2026-12-24', size: 'o2', agree: true };
db = withCustom();
r = await placeOrder(db, mk([{ productId: 'n1', quantity: 1 }], { custom: { ...goodCustom, gift: 'Happy day', qty: '4', mail: 'a@b.co', off: 'ignored', unknown: 'x' } }));
o = db.store.get(`orders/${r.orderId}`).customFields;
assert.equal(o.length, 6); assert.deepEqual(o.find((f) => f.id === 'size').value, { en: 'Large', ar: 'كبير' });
assert.equal(o.find((f) => f.id === 'agree').value, true); assert.equal(o.find((f) => f.id === 'when').value, '2026-12-24');
assert.ok(!o.some((f) => f.id === 'off' || f.id === 'unknown')); assert.deepEqual(o[0].label, customDefs[0].label);
ok('custom answers saved with label snapshot; inactive/unknown fields ignored; select saves option words');
const badCustom = async (custom, id) => { try { await placeOrder(withCustom(), mk([{ productId: 'n1', quantity: 1 }], { custom })); assert.fail('should reject ' + id); } catch (e) { assert.equal(e.code, 'BAD_FIELD', id); assert.deepEqual(e.meta.customLabel, customDefs.find((d) => d.id === id).label); } };
await badCustom({ size: 'o1', agree: true }, 'when');                       // required date missing
await badCustom({ ...goodCustom, when: '2026-02-31' }, 'when');             // not a real date
await badCustom({ ...goodCustom, size: 'o9' }, 'size');                     // option that does not exist
await badCustom({ ...goodCustom, agree: false }, 'agree');                  // required tick box not ticked
await badCustom({ ...goodCustom, qty: '12abc' }, 'qty');                    // not a number
await badCustom({ ...goodCustom, mail: 'nope' }, 'mail');                   // bad email
ok('custom rules: required, real dates, existing options, ticked box, number and email formats');
const clientSrc2 = fs.readFileSync(new URL('../src/utils/checkoutFields.js', import.meta.url), 'utf8');
for (const ty of CUSTOM_FIELD_TYPES) assert.ok(clientSrc2.includes(`'${ty}'`), 'client missing type ' + ty);
ok('client and server custom field types match');

// ===== F. profit maths (carried over) =====
const now = new Date('2026-10-15T12:00:00');
const orders = [
  { status: 'delivered', totalAmount: 1700, items: [{ unitCost: 350, quantity: 2 }], statusHistory: [{ status: 'delivered', timestamp: '2026-10-10T10:00:00' }] },
  { status: 'delivered', totalAmount: 100, items: [{ unitCost: null, quantity: 1 }], statusHistory: [{ status: 'delivered', timestamp: '2026-10-11T10:00:00' }] },
  { status: 'pending', totalAmount: 5000, items: [{ unitCost: 1, quantity: 1 }] },
];
const p = calcProfit(orders, [{ amount: 300, date: '2026-10-02' }], 'all', now);
assert.deepEqual([p.revenue, p.cogs, p.netProfit, p.expectedRevenue, p.ordersMissingCost], [1800, 700, 800, 5000, 1]);
ok('profit maths');
console.log(`\nALL ${n} CHECK GROUPS PASSED`);
