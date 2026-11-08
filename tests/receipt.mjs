// Update 34: the customer's receipt. Server builds it from the saved order; the browser shows it and makes a picture,
// a PDF and an email draft. (Drawing is checked against a fake canvas; the real look needs a phone screenshot.)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { placeOrder, validateInput } from '../api/_lib/placeOrder.js';
import { buildReceipt } from '../api/_lib/receipt.js';
import * as R from '../src/utils/receipt.js';
import * as RI from '../src/utils/receiptImage.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const bundle = async (entry, stubs = {}, name = 'x') => {
  const outfile = path.join(root, 'tests', `.rc-${name}-${process.pid}.cjs`);
  await build({ stdin: { contents: entry, resolveDir: root, loader: 'js' }, bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error',
    jsx: 'automatic', define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => { for (const k of Object.keys(stubs)) if (new RegExp(k).test(a.path)) return { path: a.path, namespace: 'stub' }; return null; });
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => { for (const [k, v] of Object.entries(stubs)) if (new RegExp(k).test(a.path)) return { contents: v, loader: 'js', resolveDir: root }; });
    } }] });
  const m = req(outfile); fs.rmSync(outfile, { force: true }); return m;
};

const L = (en, ar = en) => ({ en, ar });
const colour = { id: 'col', type: 'color', label: L('Colour', 'اللون'), required: true, values: [
  { id: 'blk', label: L('Black', 'أسود'), color: '#111111', priceDelta: 0 }, { id: 'blu', label: L('Blue', 'أزرق'), color: '#2244ff', priceDelta: 0 }] };
const product = { tenantId: 'bynd', name: L('Hexagon', 'سداسي'), price: 200, stock: 0, isPreorder: true, isActive: true, deleted: false,
  options: [colour], packageQty: 3, packagePrice: 500, tierGroupOption: 'col', imageUrl: 'https://x/y.jpg' };
const world = () => {
  const store = new Map(Object.entries({ 'tenants/bynd': { slug: 'bynd', isActive: true, checkout: { fields: { email: { show: true, required: false } } } }, 'products/p1': product, 'productCosts/p1': { tenantId: 'bynd', costPrice: 80, optionCosts: {} } }));
  let auto = 0;
  const ref = (cc, id) => ({ col: cc, id, path: `${cc}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${cc}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store, collection: (cc) => ({ doc: (id) => ref(cc, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, op) => w.push(['s', r, d, op]) };
      const out = await fn(tx); for (const [k, r, d, op] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (op?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
};
const cust = { name: 'Ali Hassan', phone: '01000000000', city: 'Cairo', street: 'Nile Street', email: 'ali@gmail.com' };
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. the server builds the receipt from the SAVED order (exact money, nothing private)
let db = world();
const placed = await placeOrder(db, validateInput({ tenantId: 'bynd', customer: cust, items: [{ productId: 'p1', quantity: 4, selections: { col: 'blk' } }] }));
const rc = buildReceipt(placed._order);
assert.equal(rc.orderNumberLabel, placed.orderNumberLabel); assert.equal(rc.totalAmount, 700); assert.equal(rc.items[0].amount, 700);   // 3 for 500 + 1 for 200
assert.equal(rc.items[0].quantity, 4); assert.deepEqual(rc.items[0].options[0].value, L('Black', 'أسود')); assert.equal(rc.items[0].options[0].color, '#111111');
assert.equal(rc.items[0].madeToOrder, true); assert.equal(rc.customer.name, 'Ali Hassan'); assert.equal(rc.customer.email, 'ali@gmail.com');
assert.match(rc.customer.address, /Nile Street/); assert.match(rc.placedAt, /^\d{4}-\d\d-\d\dT/); assert.equal(rc.paymentMethod, 'COD');
const raw = JSON.stringify(rc);
for (const secret of ['unitCost', 'stockKeys', 'productId', 'tenantId', 'imageUrl', '"80"', 'costPrice']) assert.ok(!raw.includes(secret), 'receipt must not contain ' + secret);
assert.equal(buildReceipt(null).items.length, 0);                                        // never crashes on a strange order
ok('the receipt is built from the saved order: exact line total (package), choices, customer, and no costs / ids / stock data');

// 2. the real /api/create-order handler sends it back (pretend database, real order code)
const handlerDb = world();
const handlerMod = await bundle(`export { default } from ${JSON.stringify(root + '/api/create-order.js')};`, {
  '_lib/db\\.js$': `export const getDb = () => globalThis.__db;`,
  '@vercel/functions': `export const waitUntil = () => {};`,
  '_lib/notify\\.js$': `export const notifyNewOrder = async () => {};`,
}, 'handler');
globalThis.__db = handlerDb;
const resBox = {}; const res = { status(c) { resBox.status = c; return this; }, json(b) { resBox.body = b; return this; }, setHeader() {} };
await handlerMod.default({ method: 'POST', headers: { 'x-real-ip': '1.2.3.4' }, body: { tenantId: 'bynd', customer: cust, items: [{ productId: 'p1', quantity: 3, selections: { col: 'blu' } }] } }, res);
assert.equal(resBox.status, 200); assert.ok(resBox.body.receipt, 'the answer carries the receipt'); assert.equal(resBox.body.receipt.totalAmount, 500);
assert.equal(resBox.body.receipt.orderNumberLabel, resBox.body.orderNumberLabel); assert.equal(resBox.body._order, undefined);   // the internal copy never leaves the server
const bot = {}; await handlerMod.default({ method: 'POST', headers: {}, body: { website: 'spam' } }, { status() { return this; }, json(b) { bot.b = b; }, setHeader() {} });
assert.equal(bot.b.receipt, undefined);                                                  // the bot trap gets nothing real
ok('/api/create-order answers with the receipt (3 for 500 = 500), keeps the internal order copy private, bots get nothing');

// 3. the receipt rows (English + Arabic)
const tt = (k, o) => `${k}${o && o.url !== undefined ? '<' + o.url + '>' : ''}`;
const rows = R.receiptModel({ ...rc, discount: 50, promoCode: 'WELCOME', shippingFee: 40, zoneName: 'Cairo' }, { language: 'en', shopName: 'BYND', t: tt, trackUrl: 'https://s/store/bynd/track' });
const kinds = rows.map((r) => r.kind); assert.equal(kinds[0], 'title'); assert.ok(kinds.includes('total') && kinds.includes('note'));
assert.deepEqual(rows.find((r) => r.kind === 'item').details, ['Colour: Black']); assert.equal(rows.find((r) => r.kind === 'item').name, 'Hexagon × 4');
// wording follows the product's own style: no style set = 'Preorder' (same as the cart and checkout)
assert.equal(rc.items[0].madeStyle, 'preorder');
assert.equal(rows.find((r) => r.kind === 'item').tag, 'receipt.preorder');
{ // a product the shop calls 'made to order' says so on the saved order line and on the receipt
  const dbM = world(); dbM.store.set('products/p1', { ...product, preorderStyle: 'madeToOrder' });
  const placedM = await placeOrder(dbM, validateInput({ tenantId: 'bynd', customer: cust, items: [{ productId: 'p1', quantity: 1, selections: { col: 'blk' } }] }));
  assert.equal(placedM._order.items[0].madeStyle, 'madeToOrder');
  const rcM = buildReceipt(placedM._order);
  assert.equal(rcM.items[0].madeStyle, 'madeToOrder');
  assert.equal(R.receiptModel(rcM, { language: 'en', shopName: 'BYND', t: tt, trackUrl: '' }).find((r) => r.kind === 'item').tag, 'receipt.madeToOrder');
  // a normal in-stock line carries no wording style at all
  assert.equal(placed._order.items[0].isPreorder, true);
}
assert.equal(rows.find((r) => r.kind === 'total').value, '700 EGP');
assert.ok(rows.some((r) => r.kind === 'pair' && r.label === 'checkout.discount (WELCOME)' && r.value === '− 50 EGP'));
assert.ok(rows.some((r) => r.kind === 'pair' && /checkout\.shipping \(Cairo\)/.test(r.label) && r.value === '40 EGP'));
assert.match(rows.find((r) => r.kind === 'note').text, /https:\/\/s\/store\/bynd\/track/);
const free = R.receiptModel(rc, { language: 'ar', shopName: '', t: tt });
assert.equal(free[0].kind, 'subtitle'); assert.equal(free.find((r) => r.kind === 'item').name, 'سداسي × 4'); assert.deepEqual(free.find((r) => r.kind === 'item').details, ['اللون: أسود']);
assert.ok(free.some((r) => r.kind === 'pair' && r.value === 'checkout.free')); assert.equal(free.find((r) => r.kind === 'total').value, '700 ج.م');
assert.equal(R.receiptDate('2026-11-05T12:30:00.000Z').length, 16); assert.equal(R.receiptDate(''), '');
ok('receipt rows: shop name, order number, items with choices, discount / shipping / free, total, track note; Arabic uses Arabic names + currency');

// 4. email draft
const mail = R.mailtoLink({ to: 'ali@gmail.com', subject: 'Your order BYND-1001', rows });
assert.ok(mail.startsWith('mailto:ali%40gmail.com?subject=Your%20order%20BYND-1001&body=')); assert.ok(mail.includes('%0D%0A')); assert.ok(mail.includes(encodeURIComponent('Hexagon × 4')));
assert.ok(R.mailtoLink({ subject: 's', rows }).startsWith('mailto:?subject=s'));                       // no email known: the customer types it
const many = Array.from({ length: 40 }, (_, i) => ({ kind: 'item', name: `Item ${i} × 1`, amount: '100 EGP', details: ['Colour: Black', 'Name on top: Adham Doma'], tag: '' }));
const longMail = R.mailtoLink({ subject: 's', rows: many });
assert.ok(longMail.length <= 1900 || !longMail.includes('Name%20on%20top'), 'a long receipt is shortened'); assert.ok(longMail.includes('Item%2039'));
assert.ok(!R.receiptText(many, { compact: true }).includes('Name on top')); assert.ok(R.receiptText(many).includes('Name on top'));
ok('email draft: opens the customer\'s own mail app, new lines kept, email pre-filled when known, very long receipts are shortened');

// 5. PDF structure
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0xff, 0xd9]);
const pdf = R.pdfFromJpeg(jpeg, 1440, 1800); const s = Buffer.from(pdf).toString('latin1');
assert.ok(s.startsWith('%PDF-1.4')); assert.ok(s.trimEnd().endsWith('%%EOF'));
const startxref = Number(s.match(/startxref\n(\d+)/)[1]); assert.equal(s.slice(startxref, startxref + 4), 'xref');
const offs = [...s.slice(startxref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1])); assert.equal(offs.length, 5);
offs.forEach((o, i) => assert.equal(s.slice(o, o + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`));      // every xref entry points at its object
assert.match(s, /\/Length 11 >>/); assert.match(s, /\/Filter \/DCTDecode/); assert.match(s, /\/MediaBox \[0 0 595\.28 841\.89\]/);   // short receipt = A4
const longPdf = Buffer.from(R.pdfFromJpeg(jpeg, 720, 4000)).toString('latin1'); assert.match(longPdf, /\/MediaBox \[0 0 595\.28 3307\.11\]/);   // long receipt = taller page, nothing cut
assert.ok(Buffer.from(pdf).includes(Buffer.from(jpeg)));
const b64 = 'data:image/jpeg;base64,' + Buffer.from(jpeg).toString('base64'); globalThis.atob ??= (x) => Buffer.from(x, 'base64').toString('binary');
assert.deepEqual([...R.dataUrlToBytes(b64)], [...jpeg]);
ok('PDF: valid structure (xref offsets, lengths, picture embedded); short receipt = A4, long receipt = taller page');

// 6. drawing against a fake canvas
const fake = () => { const calls = []; return { calls, fillText(t, x, y) { calls.push({ t, x, y, align: this.textAlign, dir: this.direction }); }, fillRect() {}, measureText: (t) => ({ width: String(t).length * 8 }) }; };
const manyRows = R.receiptModel({ ...rc, customer: { ...rc.customer, address: 'x'.repeat(10) + ' ' + 'long street name '.repeat(8) } }, { language: 'en', shopName: 'BYND Shop', t: tt, trackUrl: 'https://s/t' });
const dry = fake(); const h1 = RI.paintReceipt(dry, manyRows, { draw: false }); assert.equal(dry.calls.length, 0);   // measuring draws nothing
const ltr = fake(); const h2 = RI.paintReceipt(ltr, manyRows, { rtl: false }); assert.equal(h1, h2); assert.ok(h2 > 300);
assert.ok(ltr.calls.every((c) => c.x >= 0 && c.x <= 720)); assert.ok(ltr.calls.some((c) => c.t === 'BYND Shop' && c.align === 'center'));
assert.equal(ltr.calls.find((c) => c.t === 'checkout.orderNumber').align, 'left'); assert.equal(ltr.calls.find((c) => c.t === rc.orderNumberLabel).align, 'right');
const rtl = fake(); RI.paintReceipt(rtl, manyRows, { rtl: true });
assert.equal(rtl.calls.find((c) => c.t === 'checkout.orderNumber').align, 'right'); assert.equal(rtl.calls.find((c) => c.t === rc.orderNumberLabel).align, 'left'); assert.equal(rtl.calls[0].dir, 'rtl');
assert.ok(ltr.calls.filter((c) => /long street name/.test(c.t)).length > 1);                            // a long address wraps onto several lines
assert.ok(ltr.calls.every((c) => c.t.length * 8 <= 720 - 72 + 1));                                     // no line is wider than the page
assert.deepEqual(RI.wrapText({ measureText: (t) => ({ width: t.length * 8 }) }, 'a'.repeat(100), 160).every((l) => l.length <= 20), true);   // a huge word is cut
ok('drawing: height is measured first, English reads left-to-right, Arabic mirrors (labels right, amounts left), long text wraps, nothing leaves the page');

// 7. the real screen components
const cardStubs = {
  'react-i18next': `export const useTranslation=()=>({t:(k,o)=>k+(o&&o.number?'['+o.number+']':'')});`,
  'LanguageContext': `export const useLanguage=()=>({language:globalThis.__lang||'en'});`,
  'react-router-dom': `import React from 'react'; export const useParams=()=>({slug:'bynd'}); export const useLocation=()=>({state:globalThis.__state}); export const Link=({children,...p})=>React.createElement('a',p,children);`,
  'StorefrontContext': `export const useStorefront=()=>({tenant:{name:{en:'BYND'},theme:{accent:'#aa8800'}}});`,
  'WallPicture': `export default ()=>null;`,
};
const { default: Thanks } = await bundle(`export { default } from ${JSON.stringify(root + '/src/pages/storefront/OrderConfirmation.jsx')};`, cardStubs, 'thanks');
const React = req('react'); const { renderToString } = req('react-dom/server');
globalThis.__state = { orderNumberLabel: 'BYND-1001', totalAmount: 700, receipt: rc };
let html = renderToString(React.createElement(Thanks));
assert.match(html, /data-receipt-card/); assert.match(html, /data-receipt-png/); assert.match(html, /data-receipt-pdf/); assert.match(html, /href="mailto:ali%40gmail\.com\?subject=receipt\.emailSubject%5BBYND-1001%5D/);
assert.match(html, /receipt\.savePicture/); assert.match(html, /receipt\.emailHint/); assert.match(html, /Hexagon × <!-- -->4|Hexagon × 4/);
globalThis.__state = { orderNumberLabel: 'BYND-1001', totalAmount: 700 };                                  // e.g. an old tab / a bot answer: no receipt
html = renderToString(React.createElement(Thanks)); assert.doesNotMatch(html, /data-receipt/); assert.match(html, /checkout\.orderPlaced/);
globalThis.__state = undefined; assert.doesNotThrow(() => renderToString(React.createElement(Thanks)));
assert.match(fs.readFileSync(path.join(root, 'src/pages/storefront/Checkout.jsx'), 'utf8'), /receipt: result\.receipt \|\| null/);   // checkout hands it to the thank-you page
// update 41: slim header on the page, no repeated order number / total above the receipt, wording follows the products
globalThis.__state = { orderNumberLabel: 'BYND-1001', totalAmount: 700, orderType: 'preorder', receipt: rc };
html = renderToString(React.createElement(Thanks));
assert.match(html, /data-checkout-header/); assert.doesNotMatch(html, /mt-4 text-lg font-medium/);          // receipt shown: the number is not repeated above it
assert.match(html, /checkout\.preorderPlacedBody/); assert.doesNotMatch(html, /checkout\.madeToOrderPlacedBody/);   // this product has no 'made to order' style
globalThis.__state = { orderNumberLabel: 'BYND-1001', totalAmount: 700, orderType: 'preorder', receipt: { ...rc, items: rc.items.map((i) => ({ ...i, madeStyle: 'madeToOrder' })) } };
html = renderToString(React.createElement(Thanks)); assert.match(html, /checkout\.madeToOrderPlacedBody/);
globalThis.__state = { orderNumberLabel: 'BYND-1001', totalAmount: 700 };
html = renderToString(React.createElement(Thanks)); assert.match(html, /mt-4 text-lg font-medium/);          // no receipt: number + total stay
ok('thank-you page: receipt card with the three buttons (picture, PDF, email link) when the order has a receipt; unchanged without one; checkout passes it on');

console.log('\nALL ' + n + ' RECEIPT CHECK GROUPS PASSED');
