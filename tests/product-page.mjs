// Renders the REAL shop product page (on the server, with pretend data) and checks what a customer would see.
// This catches mistakes that unit tests of the pure rules cannot, such as a page using a value before it exists.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'tests', `.page-${process.pid}.cjs`);

const stubs = {
  'react-router-dom': `import React from 'react'; export const useParams=()=>({slug:'bynd',productId:'p1'}); export const useNavigate=()=>()=>{}; export const Link=({children,...p})=>React.createElement('a',p,children);`,
  'react-i18next': `export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?'['+o.n+']':'')});`,
};
await build({
  stdin: { contents: `export { default } from ${JSON.stringify(root + '/src/pages/storefront/ProductPage.jsx')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^(react-router-dom|react-i18next)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: root }));
    b.onResolve({ filter: /(context\/(Cart|Language|Storefront)Context|storefront\/(StorefrontHeader|StorefrontFooter|CartDrawer)|usePageMeta|products\.service)$/ }, (a) => ({ path: a.path, namespace: 'stub2' }));
    b.onLoad({ filter: /.*/, namespace: 'stub2' }, (a) => {
      const p = a.path;
      let c = 'export default ()=>null;';
      if (/CartContext/.test(p)) c = 'export const useCart=()=>({addItem(){},items:[]}); export default ()=>null;';
      if (/LanguageContext/.test(p)) c = "export const useLanguage=()=>({language:'en'});";
      if (/StorefrontContext/.test(p)) c = "export const useStorefront=()=>({tenant:{id:'bynd',slug:'bynd',name:{en:'BYND'}}});";
      if (/usePageMeta/.test(p)) c = 'export const usePageMeta=()=>{};';
      if (/products\.service/.test(p)) c = 'export const getProduct=async()=>null; export const listStorefrontProducts=async()=>[];';
      return { contents: c, loader: 'js' };
    });
    // Effects do not run on the server, so the page is handed an already-loaded product and choices.
    b.onLoad({ filter: /ProductPage\.jsx$/ }, (a) => {
      let s = fs.readFileSync(a.path, 'utf8');
      const before = s;
      s = s.replace('useState(null);\n  const [status', 'useState(globalThis.__product);\n  const [status')
        .replace("useState('loading')", "useState('found')")
        .replace('const [selections, setSelections] = useState({})', 'const [selections, setSelections] = useState(globalThis.__sel || {})');
      if (s === before) throw new Error('product-page test: the page changed shape, update this test');
      return { contents: s, loader: 'jsx' };
    });
  } }],
});
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToString } = require('react-dom/server');
const Page = require(outfile).default;
fs.rmSync(outfile, { force: true });

const col = { id: 'col', type: 'color', label: { en: 'Color' }, required: true, values: [
  { id: 'black', label: { en: 'Black' }, color: '#222' }, { id: 'blue', label: { en: 'Blue' }, color: '#00f' } ] };
const base = { id: 'p1', tenantId: 'bynd', isActive: true, deleted: false, name: { en: 'Test 1' }, price: 500, stock: 3,
  options: [col], countedOptions: ['col'], optionStock: { 'col.black': 3, 'col.blue': 0 } };
function view(product, sel = {}) {
  globalThis.__product = product; globalThis.__sel = sel;
  const html = renderToString(React.createElement(Page));
  const swatches = [...html.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((m) => /disabled/.test(m[0]));
  const main = html.slice(html.indexOf('<h1'));
  return { html, swatches, strike: /rotate-45/.test(html),
    outOfStockBadge: /rounded bg-rust\/15[^>]*>storefront\.outOfStock/.test(html),
    button: (html.match(/<button[^>]*class="mt-6[^>]*>([^<]*)</) || [])[1], main };
}
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

let v = view(base);
assert.deepEqual(v.swatches, [false, true]); assert.ok(v.strike); assert.match(v.html, /storefront\.onlyLeft\[3\]/);
ok('counted product: the sold-out colour is crossed out and cannot be picked; the other colour can');

v = view(base, { col: 'blue' });
assert.equal(v.button, 'storefront.outOfStock'); assert.ok(v.outOfStockBadge); assert.doesNotMatch(v.html, /storefront\.onlyLeft/);
ok('a sold-out colour that is somehow chosen shows "out of stock" and the buy button is off');

v = view(base, { col: 'black' });
assert.equal(v.button, 'storefront.addToCart'); assert.match(v.html, /storefront\.onlyLeft\[3\]/);
ok('an available colour can be added to the cart');

v = view({ ...base, backorder: true }, { col: 'blue' });
assert.deepEqual(v.swatches, [false, false]); assert.equal(v.button, 'storefront.preorderNow'); assert.doesNotMatch(v.html, /rounded bg-rust\/15/);
ok('stock first, then made to order: a sold-out colour can still be ordered (made-to-order wording)');

v = view({ ...base, backorder: true, preorderStyle: 'madeToOrder' }, { col: 'blue' });
assert.equal(v.button, 'storefront.madeToOrderNow');
ok('"made to order" wording is used when the shop chose it');

v = view({ ...base, countedOptions: [] }, { col: 'blue' });
assert.deepEqual(v.swatches, [false, false]); assert.ok(!v.strike); assert.match(v.html, /storefront\.onlyLeft\[3\]/); assert.equal(v.button, 'storefront.addToCart');
ok('a product that does not count by option looks and works exactly as before');

// ---- update 19: quantity prices and limits ----
const tiered = { ...base, options: [], countedOptions: [], optionStock: {}, stock: 50, priceTiers: [{ minQty: 5, price: 450 }, { minQty: 10, price: 400 }] };
v = view(tiered);
assert.match(v.html, /storefront\.qtyPricesTitle/);
for (const x of ['fromQty\\[1\\]', 'fromQty\\[5\\]', 'fromQty\\[10\\]', 'savePercent\\[10\\]', 'savePercent\\[20\\]']) assert.match(v.html, new RegExp('storefront\\.' + x));
assert.doesNotMatch(v.html, /line-through/);                     // 1 piece = the normal price, nothing crossed out
assert.match(v.html, /<input[^>]*type="number"[^>]*value="1"/);   // typed quantity box
ok('a product with quantity prices shows the price table (1+, 5+, 10+ with the saving) and a quantity box');

v = view({ ...tiered, minQty: 10 });
assert.match(v.html, /<input[^>]*type="number"[^>]*value="10"/); assert.match(v.html, /storefront\.minOrderNote\[10\]/);
assert.match(v.html, /line-through/);                              // starts at 10 pieces -> the 10+ price, the normal price crossed out
ok('with a minimum of 10 the box starts at 10 (so the 10+ price shows) and the minimum is explained');

v = view({ ...tiered, stock: 6, minQty: 10 });
assert.match(v.html, /storefront\.minNotInStock\[10\]/); assert.match(v.html, /<button disabled=""[^>]*>storefront\.addToCart/); assert.doesNotMatch(v.html, /type="number"/); // button off, no quantity box
ok('stock below the shop minimum: the product explains it and cannot be added');

v = view({ ...tiered, maxQty: 25 });
assert.match(v.html, /storefront\.maxOrderNote\[25\]/);
v = view({ ...tiered, priceTiers: [] }); assert.doesNotMatch(v.html, /storefront\.qtyPricesTitle/); assert.doesNotMatch(v.html, /storefront\.minOrderNote/);
ok('a maximum is shown; a product without steps or limits shows none of this');

console.log(`\nALL ${n} PRODUCT-PAGE CHECKS PASSED`);
