// Update 45: render check for the REAL checkout page (it had none: only the build compiled it).
// Draws it on the server with pretend data and checks what the customer would see: empty cart, one / several
// delivery areas, made-to-order wording, a wall as ONE card, package totals, Arabic, a shop with missing settings.
// (Typing, the server quote and the order button are not run here: effects do not run on the server.)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const stubs = {
  'react-router-dom': `import React from 'react'; export const useParams=()=>({slug:'bynd'}); export const useNavigate=()=>()=>{}; export const useLocation=()=>({hash:'',pathname:'/store/bynd/checkout'}); export const Link=({children,to,...p})=>React.createElement('a',{...p,href:to},children);`,
  'react-i18next': `export const useTranslation=()=>({t:(k,o)=>k+(o&&o.amount!==undefined?'['+o.amount+']':'')});`,
};
const outfile = path.join(root, 'tests', `.co-${process.pid}.cjs`);
await build({
  stdin: { contents: `export { default } from ${JSON.stringify(root + '/src/pages/storefront/Checkout.jsx')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 'stubs', setup(b) {
    b.onLoad({ filter: /pages[\\/]storefront[\\/]Checkout\.jsx$/ }, (a) => {
      let src = fs.readFileSync(a.path, 'utf8'); const before = src;
      src = src.replace('const [quote, setQuote] = useState(null);', 'const [quote, setQuote] = useState(globalThis.__quote || null);')
        .replace('const [quoteFailed, setQuoteFailed] = useState(false);', 'const [quoteFailed, setQuoteFailed] = useState(globalThis.__failed === true);');
      if (src === before || !src.includes('globalThis.__failed')) throw new Error('checkout test: the page changed shape, update this test');
      return { contents: src, loader: 'jsx' };
    });
    b.onResolve({ filter: /^(react-router-dom|react-i18next)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: root }));
    b.onResolve({ filter: /(context\/(Cart|Language|Storefront)Context|orders\.service|shared\/LanguageSwitch|storefront\/WallCartCard)$/ }, (a) => ({ path: a.path, namespace: 'stub2' }));
    b.onLoad({ filter: /.*/, namespace: 'stub2' }, (a) => {
      const p = a.path; let c = 'export default ()=>null;';
      if (/CartContext/.test(p)) c = "export const keyOf=(i)=>i.productId+'|'+JSON.stringify(i.selections||{}); export const useCart=()=>({items:globalThis.__items,subtotal:globalThis.__items.reduce((s,i)=>s+Number(i.lineTotal??i.unitPrice*i.quantity),0),clearCart(){}});";
      if (/LanguageContext/.test(p)) c = "export const useLanguage=()=>({language:globalThis.__lang||'en'});";
      if (/StorefrontContext/.test(p)) c = "export const useStorefront=()=>({tenant:globalThis.__tenant,mode:'light'});";
      if (/orders\.service/.test(p)) c = 'export const createOrder=async()=>({}); export const getQuote=async()=>({});';
      if (/WallCartCard/.test(p)) c = "import React from 'react'; export default ({lines})=>React.createElement('div',{'data-wall-card':lines.length});";
      return { contents: c, loader: 'js' };
    });
  } }],
});
const require = createRequire(import.meta.url);
const Checkout = require(outfile).default; fs.rmSync(outfile, { force: true });
const React = require('react'); const { renderToString } = require('react-dom/server');

const zone = (id, price = 50, extra = {}) => ({ id, name: { en: 'Zone ' + id, ar: 'منطقة ' + id }, price, active: true, ...extra });
const shop = (extra = {}) => ({ id: 'bynd', slug: 'bynd', name: { en: 'BYND' }, shipping: { zones: [zone('z1')] }, ...extra });
const line = (extra = {}) => ({ productId: 'p1', name: { en: 'Hexagon', ar: 'سداسي' }, quantity: 2, unitPrice: 200, optionLabels: [], ...extra });
const draw = (items, tenant = shop(), lang = 'en', quote = null, failed = false) => { globalThis.__quote = quote; globalThis.__failed = failed; globalThis.__items = items; globalThis.__tenant = tenant; globalThis.__lang = lang; return renderToString(React.createElement(Checkout)).replace(/<!-- -->/g, ''); };

// 1. empty cart
let h = draw([]);
assert.match(h, /data-checkout-header/); assert.match(h, /storefront\.emptyCart/); assert.match(h, /href="\/store\/bynd"/);
assert.doesNotMatch(h, /<form/); assert.doesNotMatch(h, /checkout\.placeOrder/);
ok('empty cart: slim header, "cart is empty", a way back, no form');

// 2. normal order, one delivery area
h = draw([line()]);
assert.match(h, /<form/); assert.match(h, /checkout\.title/); assert.match(h, /data-checkout-top-total/); assert.match(h, /Hexagon × (<!-- -->)?2/);
assert.match(h, /checkoutFields\.name/); assert.match(h, /checkoutFields\.phone/); assert.match(h, /<input[^>]*type="tel"[^>]*dir="ltr"|<input[^>]*dir="ltr"[^>]*type="tel"/);
assert.match(h, /<button type="submit"[^>]*>checkout\.placeOrder<\/button>/); assert.doesNotMatch(h, /<button type="submit" disabled/);
assert.match(h, /checkout\.cod/); assert.match(h, /400/, 'the total of 2 x 200 is shown');
assert.match(h, /<option value="z1" selected/, 'one active area is pre-selected');
ok('normal order: form, top total, name / phone boxes (phone typed left-to-right), COD line, Place order enabled, the only area pre-selected');

// 3. several areas -> nothing pre-selected; an inactive area is not offered
h = draw([line()], shop({ shipping: { zones: [zone('z1'), zone('z2'), zone('z3', 10, { active: false })] } }));
assert.match(h, /<option value="" selected/); assert.doesNotMatch(h, /<option value="z1" selected/); assert.match(h, /Zone z2/); assert.doesNotMatch(h, /Zone z3/);
ok('several areas: customer must choose (empty choice selected); switched-off areas are not offered');

// 4. the hidden bot trap is there and hidden
assert.match(h, /aria-hidden="true"[^>]*><label>Website<input[^>]*name="website"[^>]*tabindex="-1"/i);
ok('hidden trap field exists, out of sight and out of the tab order');

// 5. made-to-order / preorder notice follows the product wording
h = draw([line({ isPreorder: true, madeStyle: 'madeToOrder' })]);
assert.match(h, /storefront\.madeToOrderCartNotice/); assert.match(h, /storefront\.madeToOrder/); assert.doesNotMatch(h, /storefront\.preorderCartNotice/);
h = draw([line({ isPreorder: true })]);
assert.match(h, /storefront\.preorderCartNotice/); assert.doesNotMatch(h, /storefront\.madeToOrderCartNotice/);
h = draw([line({ isPreorder: true, madeStyle: 'madeToOrder' }), line({ productId: 'p2', isPreorder: true })]);
assert.match(h, /storefront\.preorderCartNotice/, 'a mix says Preorder');
h = draw([line()]); assert.doesNotMatch(h, /CartNotice/);
ok('notice: "made to order" only when every such line says so; none for normal products');

// 6. package line: the EXACT line total is used, not unit x quantity
h = draw([line({ quantity: 3, unitPrice: 166.67, lineTotal: 500, packageSize: 3 })]);
assert.match(h, /500/); assert.doesNotMatch(h, /500\.01|500\.0[1-9]/); assert.match(h, /storefront\.pkgApplied/);
ok('package price: the exact line total (500) and the "package price" note');

// 7. a wall = ONE card, not plain lines
h = draw([line({ wallId: 'w1', quantity: 3 }), line({ wallId: 'w1', productId: 'p1', selections: { color: 'blue' }, quantity: 2 }), line({ productId: 'p9', name: { en: 'Plate' } })]);
assert.equal((h.match(/data-wall-card/g) || []).length, 1); assert.match(h, /data-wall-card="2"/); assert.match(h, /Plate × 2/);
ok('wall: both colour lines show as ONE wall card; other products stay normal rows');

// 8. Arabic: Arabic names, phone / email aligned like other boxes, nothing crashes
h = draw([line()], shop({ checkout: { fields: { email: { show: true, required: false } } }, shipping: { zones: [zone('z1'), zone('z2')] } }), 'ar');
assert.match(h, /سداسي × (<!-- -->)?2/); assert.match(h, /منطقة z2/); assert.match(h, /rtl:text-right/); assert.match(h, /type="email"[^>]*dir="ltr"|dir="ltr"[^>]*type="email"/);
ok('Arabic: Arabic product and area names, email / phone boxes typed left-to-right but aligned with the others');

// 9. the shop's own extra questions
h = draw([line()], shop({ checkout: { customFields: [
  { id: 'c1', type: 'select', label: { en: 'Gift wrap' }, options: [{ id: 'o1', en: 'Yes please' }], active: true },
  { id: 'c2', type: 'text', label: { en: 'Hidden one' }, active: false },
  { id: 'c3', type: 'weird', label: { en: 'Unknown type' }, active: true },
] } }));
assert.match(h, /Gift wrap/); assert.match(h, /Yes please/); assert.doesNotMatch(h, /Hidden one/); assert.doesNotMatch(h, /Unknown type/);
ok('shop questions: active ones of a known type are asked; switched-off or unknown ones are not');

// 10. missing data never crashes (old carts, a shop with no settings)
assert.doesNotThrow(() => draw([{ productId: 'x', quantity: 1, unitPrice: 10 }], { id: 'bynd', slug: 'bynd' }));
assert.doesNotThrow(() => draw([line({ name: undefined, optionLabels: undefined })], { id: 'bynd', slug: 'bynd', shipping: null, checkout: null }, 'ar'));
h = draw([line()], { id: 'bynd', slug: 'bynd' }); assert.doesNotMatch(h, /id="zone"/, 'no areas set up = no area box');
ok('missing data: an old cart line or a shop with no settings does not crash; no areas = no area box');

// 11. nothing private reaches the page
h = draw([line({ unitCost: 80, stockKeys: ['a'], tierGroup: 'x' })]);
assert.doesNotMatch(h, /unitCost|stockKeys|>80<|\b80\.00/);
ok('the page never prints costs or stock keys');

// 12. update 45: the delivery fee is never shown as "Free" before it is really known
const totalsBox = (html) => html.slice(html.indexOf('storefront.subtotal'));
h = draw([line()]);                                                    // one area chosen, the server has not answered yet
assert.doesNotMatch(totalsBox(h), /checkout\.free/); assert.match(totalsBox(h), /checkout\.shipping<\/span><span>—<\/span>/);
assert.match(h, /class="opacity-60"/); assert.doesNotMatch(h, /data-fee-unknown/);
h = draw([line()], shop(), 'en', null, true);                          // the server could not be asked
assert.doesNotMatch(totalsBox(h), /checkout\.free/); assert.match(totalsBox(h), /checkout\.shipping<\/span><span>—<\/span>/);
assert.match(h, /data-fee-unknown/); assert.match(h, /checkout\.feeUnknown/); assert.doesNotMatch(h, /class="opacity-60"/);
h = draw([line()], shop(), 'en', { subtotal: 400, discount: 0, shippingFee: 0, total: 400 });   // answer: really free
assert.match(totalsBox(h), /checkout\.free/); assert.doesNotMatch(h, /class="opacity-60"/); assert.doesNotMatch(h, /data-fee-unknown/);
h = draw([line()], shop(), 'en', { subtotal: 400, discount: 0, shippingFee: 50, total: 450 });   // answer: 50
assert.match(totalsBox(h), /50 EGP/); assert.match(totalsBox(h), /450 EGP/); assert.doesNotMatch(totalsBox(h), /checkout\.free/);
h = draw([line()], shop({ shipping: { zones: [zone('z1'), zone('z2')] } }));                    // no area chosen yet: a dash, no waiting look, no note
assert.match(totalsBox(h), /checkout\.shipping<\/span><span>—<\/span>/); assert.doesNotMatch(h, /class="opacity-60"|data-fee-unknown/);
h = draw([line()], { id: 'bynd', slug: 'bynd' });                      // a shop without delivery areas: no shipping row at all
assert.doesNotMatch(h, /checkout\.shipping|class="opacity-60"/);
ok('delivery fee: waiting or failed = a dash (never "Free") + dimmed totals / an honest note; known = real fee or a real "Free"');


// 13. design step 1: the promo box is folded behind a link; the fee hint appears only while no area is chosen
h = draw([line()]);
assert.match(h, /data-promo-link/); assert.match(h, /checkout\.promoLink/); assert.doesNotMatch(h, /id="promo"/);
h = draw([line()], shop(), 'en', { subtotal: 400, discount: 40, shippingFee: 50, total: 410, promo: { code: 'WELCOME' } });
assert.doesNotMatch(h, /data-promo-link/); assert.match(h, /checkout\.promoApplied/);   // a working code stays visible (can be removed)
h = draw([line()], shop({ shipping: { zones: [zone('z1'), zone('z2')] } }));
assert.match(h, /data-fee-hint/); assert.match(h, /checkout\.chooseAreaForFee/);
h = draw([line()]);                                                    // the only area is pre-selected: no hint
assert.doesNotMatch(h, /data-fee-hint/);
h = draw([line()], { id: 'bynd', slug: 'bynd' });                      // no delivery areas: no hint
assert.doesNotMatch(h, /data-fee-hint/);
ok('design step 1: promo folded behind "Have a promo code?" (an applied code stays visible); fee hint only while no area is chosen');

console.log('ALL ' + n + ' CHECKOUT-PAGE CHECKS PASSED');
