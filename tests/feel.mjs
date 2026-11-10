// Design step 5 (feel): "Added to cart" note, soft photo fade-in, cart drawer slide, badge bump and
// skeleton pages, all switched off for people who asked their phone for reduced motion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ----- render real pieces on the server -----
async function load(file) {
  const outfile = path.join(root, 'tests', `.feel-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  await build({
    stdin: { contents: `import * as M from ${JSON.stringify(root + '/src/components/storefront/' + file)}; module.exports = M;`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 's', setup(b) {
      b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'st' }));
      b.onLoad({ filter: /.*/, namespace: 'st' }, () => ({ contents: 'export const useTranslation=()=>({t:(k)=>k});', loader: 'js' }));
    } }],
  });
  const m = createRequire(import.meta.url)(outfile); fs.rmSync(outfile, { force: true }); return m;
}
const R = createRequire(import.meta.url);
const React = R('react'); const { renderToString } = R('react-dom/server');

const Fade = (await load('FadeImage.jsx')).default;
let html = renderToString(React.createElement(Fade, { src: 'a.jpg', alt: 'x', className: 'w-full' }));
assert.ok(/opacity-0/.test(html) && /transition-opacity/.test(html) && /class="w-full /.test(html));
ok('a photo starts see-through and fades in; the caller\'s classes are kept');

const Toast = (await load('AddedToast.jsx')).default;
html = renderToString(React.createElement(Toast, { trigger: 0, onView() {} }));
assert.equal(html, '');
ok('the "Added to cart" note is not shown before anything was added');
const toastSrc = read('components/storefront/AddedToast.jsx');
assert.ok(/role="status"/.test(toastSrc) && /aria-live="polite"/.test(toastSrc) && /min-h-\[44px\]/.test(toastSrc) && /storefront\.viewCart/.test(toastSrc));
assert.ok(/setTimeout\(\(\) => setVisible\(false\), seconds \* 1000\)/.test(toastSrc) && /clearTimeout\(timer\)/.test(toastSrc));
ok('the note is announced politely, goes away by itself, and its "View cart" button is 44 px');

const Sk = await load('PageSkeletons.jsx');
for (const [C, name] of [[Sk.ShopSkeleton, 'shop'], [Sk.ProductPageSkeleton, 'product']]) {
  html = renderToString(React.createElement(C, { label: 'Loading' }));
  assert.ok(/role="status"/.test(html) && /aria-busy="true"/.test(html) && /aria-label="Loading"/.test(html) && /animate-pulse/.test(html), name);
}
ok('skeleton pages are announced as loading and pulse');

// ----- wiring -----
for (const f of ['pages/storefront/StorefrontHome.jsx', 'pages/storefront/ProductsPage.jsx', 'pages/storefront/ProductPage.jsx']) {
  const s = read(f);
  assert.ok(/<AddedToast trigger=\{added\} hidden=\{cartOpen\} onView=\{\(\) => setCartOpen\(true\)\}/.test(s), f);
  assert.ok(/setAdded\(\(n\) => n \+ 1\)/.test(s), f);
}
const page = read('pages/storefront/ProductPage.jsx');
assert.equal((page.match(/setAdded\(\(n\) => n \+ 1\)/g) || []).length, 2, 'normal add and wall add');
assert.ok(!/setCartOpen\(true\);\n    \}\n    addItem|imageUrl: choice\.imageUrl \|\| pictures\[0\] \|\| '',\n    \}\);\n    setCartOpen/.test(page), 'adding no longer forces the drawer open');
ok('adding from the home page, the Products page and the product page (normal and wall) shows the note instead of covering the page');
assert.ok(/ProductPageSkeleton label/.test(page) && /ShopSkeleton label/.test(read('pages/storefront/StorefrontLayout.jsx')));
assert.ok(!/common\.loading[^)]*\)\}\n\s*<\/div>/.test(page));
ok('the product page and the shop start-up show skeletons, not the word Loading');
const card = read('components/storefront/ProductCard.jsx'); const pt = read('components/storefront/PictureText.jsx');
assert.ok(/<FadeImage/.test(card) && /<FadeImage/.test(pt) && /bg-paper-dim/.test(card));
ok('product cards and the gallery photos fade in (cards have a soft grey behind the photo)');
const drawer = read('components/storefront/CartDrawer.jsx'); const hdr = read('components/storefront/StorefrontHeader.jsx');
assert.ok(/drawer-slide/.test(drawer) && /backdrop-in/.test(drawer) && /badge-bump/.test(hdr) && /itemCount > lastCount\.current/.test(hdr));
ok('the cart drawer slides in (from the end side, mirrored in Arabic) and the badge bumps only when something is added');

// ----- reduced motion -----
const css = read('index.css');
const rm = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
for (const c of ['.toast-in', '.drawer-slide', '.backdrop-in', '.badge-bump']) assert.ok(rm.includes(c), c);
assert.ok(/html\[dir='rtl'\] \.drawer-slide \{ --drawer-dir: -1; \}/.test(css));
assert.ok(/animation-duration: 0\.01ms !important/.test(css) && /transition-duration: 0\.01ms !important/.test(css));
ok('every new motion has a reduced-motion switch (plus the global one); the drawer mirrors in Arabic');

// ----- texts -----
const en = JSON.parse(read('i18n/en.json')); const ar = JSON.parse(read('i18n/ar.json'));
assert.equal(en.storefront.addedToCart, 'Added to cart'); assert.ok(ar.storefront.addedToCart && ar.storefront.viewCart);
ok('texts exist in English and Arabic');
console.log('ALL ' + n + ' FEEL CHECKS PASSED');
