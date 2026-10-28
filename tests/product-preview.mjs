// Live product preview (Admin > Products): the form -> product conversion (shared with Save),
// the safety rules for product drafts, and a server render of the preview pane in product mode.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'tests', `.pp-${process.pid}.cjs`);
await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(root + '/src/utils/productForm.js')};
      export * from ${JSON.stringify(root + '/src/utils/preview.js')};
      export { default as PreviewPane } from ${JSON.stringify(root + '/src/components/admin/PreviewPane.jsx')};
    `,
    resolveDir: root, loader: 'js',
  },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const useTranslation=()=>({t:(k)=>k});', loader: 'js' }));
    b.onResolve({ filter: /context\/LanguageContext$/ }, (a) => ({ path: a.path, namespace: 'stub2' }));
    b.onLoad({ filter: /.*/, namespace: 'stub2' }, () => ({ contents: "export const useLanguage=()=>({language:'en'});", loader: 'js' }));
  } }],
});
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToString } = require('react-dom/server');
const m = require(outfile);
fs.rmSync(outfile, { force: true });

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

const form = {
  nameEn: '  Medal display ', nameAr: '', descriptionEn: 'Hex', descriptionAr: '',
  price: '300', priceTiers: [{ minQty: '3', price: '250' }], minQty: '', maxQty: '10', stock: '5', sku: 'MD', shippingExtra: '',
  imageUrl: 'https://x/main.jpg', images: [' https://x/2.jpg ', ''], relatedIds: ['r1'],
  isPreorder: false, backorder: true, countedOptions: ['oc'], preorderStyle: 'madeToOrder', comingSoon: false,
  preorderMessageEn: 'Ships in 10 days', preorderMessageAr: '',
  options: [{ id: 'oc', type: 'color', labelEn: 'Colour', labelAr: '', required: false, maxLength: '', askText: false, textRequired: false, textLabelEn: '', textLabelAr: '',
    values: [{ id: 'v1', labelEn: 'Gold', labelAr: '', color: '#c90', imageUrl: 'https://x/gold.jpg', priceDelta: '', costDelta: '' },
             { id: 'v2', labelEn: 'Black', labelAr: '', color: '#111', imageUrl: '', priceDelta: '20', costDelta: '' }] }],
};

// 1. the shared conversion
const rec = m.productFields(form);
assert.deepEqual(rec.name, { en: '  Medal display ', ar: '  Medal display ' }); // same as before the move: Arabic falls back to English
assert.equal(rec.price, 300); assert.equal(rec.maxQty, 10); assert.equal(rec.minQty, 0);
assert.deepEqual(rec.priceTiers, [{ minQty: 3, price: 250 }]);
assert.deepEqual(rec.images, ['https://x/2.jpg']);
assert.deepEqual(rec.countedOptions, ['oc']);
assert.equal(rec.options[0].required, true); // a counted option must always be chosen
assert.equal(rec.backorder, true); assert.equal(rec.preorderStyle, 'madeToOrder');
assert.equal(rec.preorderMessage.ar, 'Ships in 10 days');
assert.equal(rec.options[0].values[1].priceDelta, 20);
assert.equal(m.productFields({ ...form, isPreorder: true }).countedOptions.length, 0); // made to order counts nothing
ok('form -> product conversion (the one Save uses): fallbacks, quantity steps, counted option required, made to order counts nothing');

// 2. messages
const origin = 'https://shop.example'; const parent = {}; const other = {};
const msg = (extra = {}, source = parent, o = origin) => ({ origin: o, source, data: { type: m.PREVIEW_PRODUCT, product: rec, view: 'card', mode: 'dark', language: 'ar', ...extra } });
const got = m.acceptDraftMessage(msg(), { origin, parent });
assert.ok(got.product); assert.equal(got.view, 'card'); assert.equal(got.mode, 'dark'); assert.equal(got.language, 'ar'); assert.equal(got.draft, undefined);
assert.equal(m.acceptDraftMessage(msg({ view: 'weird' }), { origin, parent }).view, 'page');
assert.equal(m.acceptDraftMessage(msg({}, other), { origin, parent }), null);
assert.equal(m.acceptDraftMessage(msg({}, parent, 'https://evil.example'), { origin, parent }), null);
assert.equal(m.acceptDraftMessage(msg({ product: null }), { origin, parent }), null);
// shop-settings messages still work
const shopMsg = m.acceptDraftMessage({ origin, source: parent, data: { type: m.PREVIEW_DRAFT, draft: { theme: { accent: 'lime' } }, mode: null, language: 'en' } }, { origin, parent });
assert.equal(shopMsg.draft.theme.accent, 'lime'); assert.equal(shopMsg.product, undefined);
ok('product messages: only from the admin page of the same site; unknown view = page; shop-settings messages still accepted');

// 3. what a product draft may change
const dirty = { ...rec, id: 'x', tenantId: 'other', isActive: false, deleted: true, stock: 0, optionStock: { 'oc.v1': 0 }, sku: 'Z', costPrice: 5,
  imageUrl: 'http://insecure/a.jpg', images: ['https://ok/1.jpg', 'javascript:1'],
  options: [{ ...rec.options[0], values: [{ ...rec.options[0].values[0], imageUrl: 'http://bad/x.jpg' }, rec.options[0].values[1]] }] };
const clean = m.cleanProductDraft(dirty);
['id', 'tenantId', 'isActive', 'deleted', 'stock', 'optionStock', 'sku', 'costPrice'].forEach((k) => assert.equal(clean[k], undefined, k));
assert.equal(clean.imageUrl, ''); assert.deepEqual(clean.images, ['https://ok/1.jpg']);
assert.equal(clean.options[0].values[0].imageUrl, ''); assert.equal(clean.options[0].values[1].imageUrl, undefined);
ok('product draft: no id / shop / stock / cost fields; only https pictures (also colour pictures)');

// 4. saved product + draft
const saved = { id: 'p1', tenantId: 'bynd', isActive: false, stock: 4, optionStock: { 'oc.v1': 3, 'oc.v2': 1 }, sku: 'OLD', name: { en: 'Old', ar: 'قديم' }, price: 100 };
const shown = m.applyProductDraft(saved, rec, 'bynd');
assert.equal(shown.id, 'p1'); assert.equal(shown.tenantId, 'bynd'); assert.equal(shown.stock, 4); assert.deepEqual(shown.optionStock, { 'oc.v1': 3, 'oc.v2': 1 });
assert.equal(shown.price, 300); assert.equal(shown.isActive, true); // an inactive saved product can still be previewed
assert.equal(saved.price, 100); assert.equal(saved.isActive, false); // the saved record is untouched
const fresh = m.applyProductDraft(null, rec, 'bynd');
assert.equal(fresh.id, 'new'); assert.equal(fresh.tenantId, 'bynd'); assert.equal(fresh.stock, m.PREVIEW_PLENTY);
assert.deepEqual(fresh.optionStock, { 'oc.v1': m.PREVIEW_PLENTY, 'oc.v2': m.PREVIEW_PLENTY });
ok('saved product keeps its stock numbers; a new product shows plenty in stock; saved record never changed');

// 5. the pane in product mode
const html = renderToString(React.createElement(m.PreviewPane, { slug: 'bynd', product: rec, productId: 'p1' }));
assert.match(html, /<iframe[^>]*src="\/store\/bynd\/product\/p1\?preview=1"/);
assert.match(html, /products\.previewViewPage/); assert.match(html, /products\.previewViewCard/); assert.match(html, /products\.previewNote/);
assert.match(html, /settingsPage\.previewLight/);
const htmlNew = renderToString(React.createElement(m.PreviewPane, { slug: 'bynd', product: rec, productId: 'new' }));
assert.match(htmlNew, /product\/new\?preview=1/);
const htmlShop = renderToString(React.createElement(m.PreviewPane, { slug: 'bynd', draft: {} }));
assert.doesNotMatch(htmlShop, /products\.previewViewCard/); assert.match(htmlShop, /\/store\/bynd\?preview=1/);
ok('preview pane: product page address, page / shop-list switch; the settings preview has no such switch');

console.log('ALL ' + n + ' PRODUCT-PREVIEW CHECK GROUPS PASSED');
