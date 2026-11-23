// Update 61: single-shop mode (the shop is the whole site: https://<name>.vercel.app/, no /store/<name> in the address).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { shopPath, shopBase, singleShop, setSingleShopForTests } from '../src/utils/shopPaths.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. link helper, both modes
assert.equal(singleShop(), ''); // no setting = several-shops mode, exactly as before
assert.equal(shopPath('bynd'), '/store/bynd'); assert.equal(shopPath('bynd', '/products'), '/store/bynd/products');
assert.equal(shopPath('bynd', 'track'), '/store/bynd/track'); assert.equal(shopPath('bynd', '?preview=1'), '/store/bynd?preview=1');
assert.equal(shopPath('bynd', '/product/p1?preview=1'), '/store/bynd/product/p1?preview=1'); assert.equal(shopBase('bynd'), '/store/bynd');
setSingleShopForTests('bynd');
assert.equal(shopPath('bynd'), '/'); assert.equal(shopPath('bynd', '/products'), '/products'); assert.equal(shopPath('bynd', ''), '/');
assert.equal(shopPath('bynd', 'track'), '/track'); assert.equal(shopPath('bynd', '?preview=1'), '/?preview=1');
assert.equal(shopPath('bynd', '/product/p1?preview=1'), '/product/p1?preview=1'); assert.equal(shopBase('bynd'), '');
assert.equal(shopPath('BYND', '/checkout'), '/checkout', 'capital letters in the setting do not matter');
assert.equal(shopPath('other', '/products'), '/store/other/products', 'a different shop keeps its normal address');
setSingleShopForTests('');
ok('shop links: /store/<name>/... normally; /, /products, /product/<id>, /checkout, /track ... in single-shop mode; other shops unchanged');

// 2. no screen builds a /store/ address by hand any more
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const hits = walk(path.join(root, 'src')).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/shopPaths\.js$|AppRoutes\.jsx$/.test(f))
  .filter((f) => fs.readFileSync(f, 'utf8').split('\n').some((l) => /['"`]\/store\//.test(l) && !l.trim().startsWith('//')));
assert.deepEqual(hits, [], 'hand-written /store/ links left: ' + hits.join(', '));
ok('no screen writes a /store/<name> address by hand (all go through shopPath)');

// 3. the REAL route list, drawn with a server router, in both modes (pages are small stand-ins)
const bundle = async (single) => {
  const outfile = path.join(root, 'tests', `.single-${single ? 1 : 0}-${process.pid}.cjs`);
  const stub = (name) => `import React from 'react'; import {Outlet} from 'react-router-dom'; export default function X(){ return React.createElement('div',null,'[${name}]',React.createElement(Outlet)); }`;
  await build({
    stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { StaticRouter } from 'react-router-dom/server'; import AppRoutes from './src/routes/AppRoutes.jsx';
      export const draw = (url) => renderToStaticMarkup(React.createElement(StaticRouter, { location: url }, React.createElement(AppRoutes)));`, resolveDir: root, loader: 'jsx' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    define: { 'import.meta.env.VITE_SINGLE_SHOP': single ? '"bynd"' : '""', 'import.meta.env': '{}' },
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /(pages\/|ProtectedRoute)/ }, (a) => ({ path: a.path.split('/').pop(), namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stub(a.path), loader: 'js', resolveDir: root }));
    } }],
  });
  const m = req(outfile); fs.rmSync(outfile, { force: true }); return m;
};
const single = await bundle(true); const multi = await bundle(false);
const shown = (m, url) => m.draw(url).replace(/<[^>]+>/g, '');
// (a page that is loaded only when opened, like Track, draws the "…" waiting mark on the server; a wrong address draws nothing)
for (const [url, page] of [['/', 'StorefrontHome'], ['/products', 'ProductsPage'], ['/product/p1', 'ProductPage'], ['/checkout', 'Checkout'], ['/thank-you', 'OrderConfirmation'], ['/page/about', 'PolicyPage']]) {
  const html = shown(single, url);
  assert.ok(html.includes('[StorefrontLayout]') && html.includes(`[${page}]`), `single mode ${url}: ${html.slice(0, 120)}`);
}
assert.equal(shown(single, '/track'), '…', 'single mode /track is a real page'); assert.equal(shown(single, '/nonsense/page'), '', 'a wrong address is not a page');
ok('single-shop mode: /, /products, /product/<id>, /checkout, /thank-you, /page/<id>, /track all open the right page');
assert.equal(shown(single, '/admin/login'), '…'); assert.equal(shown(single, '/admin'), '[ProtectedRoute]'); assert.equal(shown(single, '/admin/orders'), '[ProtectedRoute]'); assert.ok(!shown(single, '/admin').includes('Storefront'));
ok('single-shop mode: the admin addresses are untouched');
for (const [oldUrl, wantPage] of [['/store/bynd', 'StorefrontHome'], ['/store/bynd/products', 'ProductsPage'], ['/store/bynd/track', 'TrackOrder'], ['/store/bynd/product/p1', 'ProductPage']]) {
  // a saved old link is sent to the new address (StaticRouter shows the redirect as an empty page + no crash)
  assert.doesNotThrow(() => single.draw(oldUrl));
}
ok('single-shop mode: old /store/<name>/... links do not crash (they are redirected)');
assert.ok(shown(multi, '/store/bynd').includes('[StorefrontHome]') && shown(multi, '/store/bynd/products').includes('[ProductsPage]') && shown(multi, '/').includes('[Landing]'));
assert.equal(shown(multi, '/products'), '', '/products is not a page when the setting is off'); assert.equal(shown(multi, '/store/bynd/track'), '…');
ok('several-shops mode (no setting): exactly as before (/ = landing page, /store/<name>/... = the shop)');
