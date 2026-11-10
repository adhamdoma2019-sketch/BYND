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

// ---- update 26: "show this option only when ..." ----
const sport = { id: 'sport', type: 'choice', label: { en: 'Sport' }, required: true, values: [{ id: 'run', label: { en: 'Running' } }, { id: 'cyc', label: { en: 'Cycling' } }] };
const setOpt = { id: 'set', type: 'choice', label: { en: 'Set' }, required: true, values: [{ id: 'std', label: { en: 'Standard' } }, { id: 'cus', label: { en: 'Custom' } }] };
const runExtra = { id: 'xrun', type: 'choice', label: { en: 'Running extra' }, required: true, showWhen: { optionId: 'sport', valueId: 'run' }, values: [{ id: 'k10', label: { en: 'Ten km' }, priceDelta: 100 }] };
const cycExtra = { id: 'xcyc', type: 'choice', label: { en: 'Cycling extra' }, required: true, showWhen: { optionId: 'sport', valueId: 'cyc' }, values: [{ id: 'k20', label: { en: 'Twenty km' }, priceDelta: 100 }] };
const cond = { ...base, options: [sport, setOpt, runExtra, cycExtra], countedOptions: [], optionStock: {}, stock: 50 };
v = view(cond);
assert.doesNotMatch(v.html, /Running extra/); assert.doesNotMatch(v.html, /Cycling extra/); assert.match(v.html, />Sport</); assert.match(v.html, />Set</);
v = view(cond, { sport: 'run' });
assert.match(v.html, /Running extra/); assert.doesNotMatch(v.html, /Cycling extra/);
v = view(cond, { sport: 'cyc', xrun: 'k10' });
assert.match(v.html, /Cycling extra/); assert.doesNotMatch(v.html, /Running extra/);
ok('product page: an option appears only when the choice it depends on is picked (and the other sport\'s option stays hidden)');

// ---- update 27: wall designer ----
const wallBase = { ...base, options: [], countedOptions: [], optionStock: {}, stock: 100 };
v = view(wallBase);
assert.doesNotMatch(v.html, /data-wall-designer/); assert.match(v.html, /aria-label="storefront\.quantity"/);   // switch off = the normal quantity box
v = view({ ...wallBase, wallDesigner: true });
assert.match(v.html, /data-wall-designer/); assert.match(v.html, /wall\.title/);
assert.doesNotMatch(v.html, /aria-label="storefront\.quantity"/);                                      // the designer replaces the quantity box
assert.equal((v.html.match(/data-cell/g) || []).length, 1); assert.ok((v.html.match(/data-spot/g) || []).length >= 6);
v = view({ ...wallBase, wallDesigner: true, minQty: 5 });
assert.equal((v.html.match(/data-cell/g) || []).length, 5);                                              // the wall starts at the shop's minimum
assert.match(v.html, /wall\.maxNote\[60\]/);
ok('product page: the wall designer replaces the quantity box only when switched on; the wall starts at the shop minimum; at most 60 pieces');

// ---- update 28: wall with colours ----
const wcol = { id: 'col', type: 'color', label: { en: 'Colour' }, required: true, values: [{ id: 'blk', label: { en: 'Black' }, color: '#111111' }, { id: 'blu', label: { en: 'Blue' }, color: '#2244ff' }] };
const wallC = { ...wallBase, wallDesigner: true, options: [wcol] };
v = view(wallC, { col: 'blk' });
assert.match(v.html, /data-wall-paint-hint/); assert.match(v.html, /fill:#111111/); assert.match(v.html, /data-wall-legend/);
assert.match(v.html, /wall\.legendItem\[1\]/); assert.match(v.html, /wall\.total/);
v = view(wallC);                                               // update 33: nothing picked yet = nothing painted
assert.match(v.html, /data-wall-designer/); assert.match(v.html, /wall\.noColourYet/); assert.doesNotMatch(v.html, /fill:#111111|fill:#2244ff/);
assert.doesNotMatch(v.html, /data-wall-legend/); assert.doesNotMatch(v.html, /aria-checked="true"/);          // no colour is ticked
// the colour choices sit INSIDE the wall block (before the canvas), not in the options list above it
const wallPart = v.html.slice(v.html.indexOf('data-wall-designer'));
assert.match(wallPart, /role="radiogroup"/); assert.ok(wallPart.indexOf('role="radiogroup"') < wallPart.indexOf('data-cell'));
assert.doesNotMatch(v.html.slice(0, v.html.indexOf('data-wall-designer')), /role="radiogroup"/);
v = view(wallC, { col: 'blk' });
assert.match(v.html, /wall\.paintingWith/); assert.doesNotMatch(v.html, /wall\.noColourYet/);
assert.equal((v.html.match(/aria-checked="true"/g) || []).length, 1);                                       // exactly the picked colour
v = view({ ...wallC, minQty: 4 }, { col: 'blu' });
assert.match(v.html, /fill:#2244ff/); assert.match(v.html, /wall\.legendItem\[4\]/);
// stock per colour: the wall can have as many pieces as the colours hold together; all sold out = no designer
const stockedC = { ...wallC, isPreorder: false, countedOptions: ['col'], optionStock: { 'col.blk': 2, 'col.blu': 3 }, stock: 2 };
v = view(stockedC, { col: 'blk' });
assert.match(v.html, /wall\.maxNote\[5\]/);
v = view({ ...stockedC, optionStock: { 'col.blk': 0, 'col.blu': 0 }, stock: 0 }, { col: 'blk' });
assert.doesNotMatch(v.html, /data-wall-designer/);
ok('product page: a coloured wall paints with the picked colour, shows the mix, the limit is the stock of all colours together');

// ---- update 31: package price ("every 3 pieces cost 500") ----
const pk = { ...base, price: 200, options: [col], countedOptions: [], optionStock: {}, stock: 100, packageQty: 3, packagePrice: 500 };
v = view(pk);
assert.match(v.html, /data-package/); assert.match(v.html, /storefront\.pkgLine\[3\]/); assert.match(v.html, /storefront\.pkgSave/);
assert.match(v.html, /storefront\.pkgNowOne\[1\]/); assert.match(v.html, /data-package-hint/); assert.match(v.html, /storefront\.pkgMore\[2\]/); // 1 piece: 2 more complete a package
assert.doesNotMatch(v.html, /storefront\.qtyPricesTitle/);                       // a package replaces the price table
v = view({ ...pk, minQty: 3 });
assert.match(v.html, /storefront\.pkgNow\[3\]/); assert.doesNotMatch(v.html, /data-package-hint/); // a full package: nothing missing
v = view({ ...pk, tierGroupOption: 'col' }, { col: 'black' });
assert.match(v.html, /storefront\.pkgLineSame\[3\]/); assert.match(v.html, /storefront\.pkgHintSame/);
v = view({ ...pk, packageQty: 0, packagePrice: 0 }); assert.doesNotMatch(v.html, /data-package/);
v = view({ ...pk, packagePrice: 650 }); assert.doesNotMatch(v.html, /data-package/);   // dearer than one by one: ignored
ok('product page: the package box (3 pieces for 500, what you save, what is missing) shows only for a valid package and replaces the price table');
// a coloured wall with a package price: each colour is counted by itself, the page says what the picked colour still needs
const wallPk = { ...wallC, price: 200, packageQty: 3, packagePrice: 500, tierGroupOption: 'col' };
v = view(wallPk, { col: 'blk' });
assert.match(v.html, /data-wall-designer/); assert.match(v.html, /data-package/); assert.match(v.html, /storefront\.pkgMoreColour\[2\]/);
ok('product page: a coloured wall with a package price renders and says how many more of the colour complete a package');

// ---- update 35: typed words shown on the product picture ----
const typed = { ...base, imageUrl: 'https://x/plate.jpg', options: [{ id: 'dist', type: 'text', label: { en: 'Distance' }, maxLength: 12, values: [], overlay: { enabled: true, y: 45, size: 9, color: '#ff0000', bold: true } }], countedOptions: [], optionStock: {}, stock: 50 };
v = view(typed, { dist: '12 KM' });
assert.match(v.html, /data-picture-text-line/); assert.match(v.html, />12 KM</); assert.match(v.html, /top:45%/);
v = view(typed, {}); assert.doesNotMatch(v.html, /data-picture-text-line/);
v = view({ ...typed, options: [{ ...typed.options[0], overlay: undefined }] }, { dist: '12 KM' }); assert.doesNotMatch(v.html, /data-picture-text-line/);
ok('product page: the typed words appear on the picture only when the shop switched it on and the customer typed something');

// ---- update 40: one buy button at a time on phones, no empty gap ----
v = view(base);
assert.match(v.html, /fixed inset-x-0 bottom-0/);          // before the page can measure anything the bar stays (old behaviour)
assert.match(v.html, /h-24 md:hidden/);                      // the room for the bar sits under the footer, not above it
assert.doesNotMatch(v.html, /pb-28/);                        // the old gap above the footer is gone
const src = fs.readFileSync(path.join(root, 'src/pages/storefront/ProductPage.jsx'), 'utf8');
assert.match(src, /IntersectionObserver/); assert.match(src, /!buyBtnInView/);
ok('product page: the phone buy bar hides while the normal buy button is in view; no empty gap above the footer');

console.log(`\nALL ${n} PRODUCT-PAGE CHECKS PASSED`);
