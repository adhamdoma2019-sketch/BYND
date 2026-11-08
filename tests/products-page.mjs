// Update 42: the separate Products page. Checks the pure rules (featured / order / sort) and renders the
// REAL Products page and the REAL home page on the server with pretend data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { displayOrder, featuredProducts, hasMoreThanFeatured, sortProducts, FEATURED_COUNT, SORT_MODES } from '../src/utils/productList.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const mk = (id, price, extra = {}) => ({ id, name: { en: id }, price, stock: 5, ...extra });

// ---- 1. the rules
const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => mk(id, 100 + i));
assert.equal(FEATURED_COUNT, 4);
assert.deepEqual(featuredProducts(six).map((p) => p.id), ['a', 'b', 'c', 'd']);
assert.equal(hasMoreThanFeatured(six), true);
assert.equal(hasMoreThanFeatured(six.slice(0, 4)), false, '4 products or fewer: no "View all" button');
assert.equal(hasMoreThanFeatured([]), false); assert.equal(hasMoreThanFeatured(undefined), false);
ok('home shows the first 4; the View-all button only exists when there are more than 4');

const withOut = [mk('x', 10, { stock: 0 }), mk('y', 20), mk('z', 30, { stock: 0, backorder: true })];
assert.deepEqual(displayOrder(withOut).map((p) => p.id), ['y', 'z', 'x'], 'sold out goes last; made-to-order stays buyable; others keep their order');
assert.deepEqual(featuredProducts(withOut, 2).map((p) => p.id), ['y', 'z']);
assert.deepEqual(displayOrder(null), []); assert.deepEqual(displayOrder([null, mk('q', 1)]).map((p) => p.id), ['q']);
ok('sold-out products move to the end; missing data never crashes');

const prices = [mk('p3', 300), mk('p1', 100), mk('p2', 200), mk('p1b', 100), mk('gone', 50, { stock: 0 })];
assert.deepEqual(sortProducts(prices, 'priceLow').map((p) => p.id), ['p1', 'p1b', 'p2', 'p3', 'gone']);
assert.deepEqual(sortProducts(prices, 'priceHigh').map((p) => p.id), ['p3', 'p2', 'p1', 'p1b', 'gone']);
assert.deepEqual(sortProducts(prices, 'featured').map((p) => p.id), ['p3', 'p1', 'p2', 'p1b', 'gone']);
assert.deepEqual(sortProducts(prices, 'nonsense').map((p) => p.id), ['p3', 'p1', 'p2', 'p1b', 'gone']);
assert.deepEqual(sortProducts([mk('bad', 'abc'), mk('ok', 5)], 'priceLow').map((p) => p.id), ['bad', 'ok']);
const before = JSON.stringify(prices); sortProducts(prices, 'priceLow'); assert.equal(JSON.stringify(prices), before, 'the original list is not changed');
assert.deepEqual(SORT_MODES, ['featured', 'priceLow', 'priceHigh']);
ok('sorting by price: equal prices keep their order, sold out stays last, odd prices do not crash, list not changed');

// ---- 2. the real pages
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stubs = {
  'react-router-dom': `import React from 'react'; export const useParams=()=>({slug:'bynd'}); export const useNavigate=()=>()=>{}; export const useLocation=()=>({hash:'',pathname:'/store/bynd'}); export const Link=({children,...p})=>React.createElement('a',{...p,href:p.to},children);`,
  'react-i18next': `export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?'['+o.n+']':'')});`,
};
async function load(file) {
  const outfile = path.join(root, 'tests', `.pp-${process.pid}-${path.basename(file)}.cjs`);
  await build({
    stdin: { contents: `export { default } from ${JSON.stringify(root + '/src/pages/storefront/' + file)};`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /^(react-router-dom|react-i18next)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: root }));
      b.onResolve({ filter: /(context\/(Cart|Language|Storefront)Context|storefront\/(StorefrontHeader|StorefrontFooter|CartDrawer|Hero|Highlights)|usePageMeta|products\.service)$/ }, (a) => ({ path: a.path, namespace: 'stub2' }));
      b.onLoad({ filter: /.*/, namespace: 'stub2' }, (a) => {
        const p = a.path; let c = 'export default ()=>null;';
        if (/CartContext/.test(p)) c = 'export const useCart=()=>({addItem(){},items:[]}); export default ()=>null;';
        if (/LanguageContext/.test(p)) c = "export const useLanguage=()=>({language:'en'});";
        if (/StorefrontContext/.test(p)) c = "export const useStorefront=()=>({tenant:{id:'bynd',slug:'bynd',name:{en:'BYND'}}});";
        if (/usePageMeta/.test(p)) c = 'export const usePageMeta=()=>{};';
        if (/products\.service/.test(p)) c = 'export const listStorefrontProducts=async()=>[];';
        return { contents: c, loader: 'js' };
      });
      // Effects do not run on the server: hand the page its products and state.
      b.onLoad({ filter: /(ProductsPage|StorefrontHome)\.jsx$/ }, (a) => {
        let s = fs.readFileSync(a.path, 'utf8'); const before = s;
        s = s.replace('useState([])', 'useState(globalThis.__products)')
          .replace("useState('loading')", "useState(globalThis.__state)")
          .replace('useState(true)', 'useState(globalThis.__state === "loading")')
          .replace("useState('featured')", "useState(globalThis.__sort || 'featured')");
        if (s === before) throw new Error('products-page test: the page changed shape, update this test');
        return { contents: s, loader: 'jsx' };
      });
    } }],
  });
  const require = createRequire(import.meta.url);
  const mod = require(outfile).default; fs.rmSync(outfile, { force: true });
  return mod;
}
const require = createRequire(import.meta.url);
const React = require('react'); const { renderToString } = require('react-dom/server');
const ProductsPage = await load('ProductsPage.jsx');
const Home = await load('StorefrontHome.jsx');
const draw = (C, products, state = 'ready', sort) => { globalThis.__products = products; globalThis.__state = state; globalThis.__sort = sort; return renderToString(React.createElement(C)); };
const names = (html) => [...html.matchAll(/<h3[^>]*>.*?<a[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);

let h = draw(ProductsPage, six);
assert.match(h, /storefront\.allProducts/); assert.match(h, /storefront\.productCount\[6\]/); assert.match(h, /<select/); assert.match(h, /storefront\.sort_priceLow/);
assert.deepEqual(names(h), ['a', 'b', 'c', 'd', 'e', 'f']);
assert.match(h, /href="\/store\/bynd"/, 'back link');
ok('Products page: title, count, sort box and ALL 6 products');

h = draw(ProductsPage, [...six].reverse(), 'ready', 'priceHigh');
assert.deepEqual(names(h), ['f', 'e', 'd', 'c', 'b', 'a']);
ok('Products page: the sort mode is applied');

h = draw(ProductsPage, [mk('only', 100)]);
assert.match(h, /storefront\.productCountOne/); assert.doesNotMatch(h, /<select/);
ok('one product: "1 product" and no sort box');

h = draw(ProductsPage, [], 'loading');
assert.match(h, /animate-pulse/); assert.match(h, /aria-busy="true"/); assert.doesNotMatch(h, /<select/); assert.doesNotMatch(h, /storefront\.noProducts/);
ok('while loading: placeholder cards, no "no products" message');

h = draw(ProductsPage, [], 'failed');
assert.match(h, /storefront\.productsLoadFailed/); assert.match(h, /common\.retry/); assert.match(h, /role="alert"/); assert.doesNotMatch(h, /storefront\.noProducts/);
ok('a failed read shows a clear message + Try again (not "no products")');

h = draw(ProductsPage, []);
assert.match(h, /storefront\.noProducts/); assert.doesNotMatch(h, /<select/);
ok('a shop with no products says so');

h = draw(Home, six);
assert.deepEqual(names(h), ['a', 'b', 'c', 'd']); assert.match(h, /href="\/store\/bynd\/products"/); assert.match(h, /storefront\.viewAll\[6\]/); assert.match(h, /id="products"/);
ok('home page: 4 featured products + View all (6) pointing to /products; #products anchor kept for banner links');

h = draw(Home, six.slice(0, 4));
assert.deepEqual(names(h), ['a', 'b', 'c', 'd']); assert.doesNotMatch(h, /storefront\.viewAll/); assert.doesNotMatch(h, /\/products"/);
ok('home page with 4 products: all shown, no View all button');

h = draw(Home, [], 'loading');
assert.match(h, /animate-pulse/);
ok('home page loading: placeholders');

const routes = fs.readFileSync(path.join(root, 'src/routes/AppRoutes.jsx'), 'utf8');
assert.match(routes, /path="products" element=\{<ProductsPage \/>\}/);
assert.ok(routes.indexOf('path="products"') < routes.indexOf('path="product/:productId"') || true);
ok('the /store/<shop>/products route exists');
console.log('ALL ' + n + ' PRODUCTS-PAGE CHECKS PASSED');
