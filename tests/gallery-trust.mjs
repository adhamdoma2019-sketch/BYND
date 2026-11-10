// Design step 3: the swipeable gallery, the folded price boxes' safety, bigger chips, and the trust strip
// (which may only show facts the shop really has). Pure checks + a server render of the real gallery and strip.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { trustItems } from '../src/utils/trust.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ----- 1. trust items: only real facts -----
assert.deepEqual(trustItems({}).map((i) => i.id), ['cash']);
ok('a shop with no delivery areas, no returns page and no WhatsApp shows only cash on delivery');
const zone = (price, active) => ({ id: 'z' + price, price, ...(active === false ? { active: false } : {}) });
assert.deepEqual(trustItems({ shipping: { zones: [zone(60), zone(45), zone(90)] } }).find((i) => i.id.startsWith('fee')), { id: 'feeFrom', price: 45 });
ok('delivery: "from" the cheapest area');
assert.equal(trustItems({ shipping: { zones: [zone(0), zone(0)] } })[1].id, 'feeFree');
assert.equal(trustItems({ shipping: { zones: [zone(0), zone(50)] } })[1].id, 'feeSome');
ok('delivery: free everywhere / free in some areas are told apart');
assert.equal(trustItems({ shipping: { zones: [zone(30, false), zone(80)] } })[1].price, 80);
assert.equal(trustItems({ shipping: { zones: [zone(30, false)] } }).length, 1);
ok('switched-off areas are ignored');
assert.deepEqual(trustItems({}, { hasReturns: true, hasWhatsapp: true }).map((i) => i.id), ['cash', 'returns', 'whatsapp']);
assert.deepEqual(trustItems({}, { hasReturns: false, hasWhatsapp: false }).map((i) => i.id), ['cash']);
ok('returns and WhatsApp appear only when the shop has them');

// ----- 2. server render of the real gallery and strip -----
const stubs = {
  'react-i18next': `export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?'['+o.n+']':'')});`,
  'react-router-dom': `import React from 'react'; export const Link=({to,children,...r})=>React.createElement('a',{href:to,...r},children);`,
};
async function load(file, extra = {}) {
  const outfile = path.join(root, 'tests', `.gt-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  await build({
    stdin: { contents: `export { default } from ${JSON.stringify(root + '/src/components/storefront/' + file)};`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /^(react-i18next|react-router-dom)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: root }));
      b.onResolve({ filter: /LanguageContext$/ }, () => ({ path: 'lang', namespace: 'stub3' }));
      b.onLoad({ filter: /.*/, namespace: 'stub3' }, () => ({ contents: "export const useLanguage=()=>({language:globalThis.__lang||'en'});", loader: 'js' }));
    } }],
  });
  const require = createRequire(import.meta.url);
  const mod = require(outfile).default; fs.rmSync(outfile, { force: true }); return mod;
}
const React = createRequire(import.meta.url)('react');
const { renderToString } = createRequire(import.meta.url)('react-dom/server');

const Gallery = await load('ProductGallery.jsx');
const pics = ['https://x.test/a.jpg', 'https://x.test/b.jpg', 'https://x.test/c.jpg'];
let html = renderToString(React.createElement(Gallery, { pictures: pics, shown: pics[1], onShow() {}, name: 'Hex', texts: [] }));
assert.equal((html.match(/data-gallery-slide/g) || []).length, 3);
assert.equal((html.match(/role="tab"/g) || []).length, 3);
assert.match(html, /aria-selected="true"[^>]*aria-label="storefront\.galleryPhoto/);
assert.ok(/snap-x/.test(html) && /snap-mandatory/.test(html));
assert.ok(/<img[^>]*loading="lazy"/.test(html), 'later slides load lazily');
assert.equal((html.match(/<img/g) || []).length, 3);
ok('gallery: one slide and one dot per photo, swipe strip, later photos load lazily');
// the dot of the shown photo is the 2nd one
const tabs = [...html.matchAll(/role="tab" aria-selected="(true|false)"/g)].map((m) => m[1]);
assert.deepEqual(tabs, ['false', 'true', 'false']);
ok('gallery: opens on the picture that is shown (e.g. the picked colour)');
html = renderToString(React.createElement(Gallery, { pictures: [pics[0]], shown: pics[0], onShow() {}, name: 'Hex', texts: [] }));
assert.ok(!/role="tab"/.test(html) && !/galleryNext/.test(html));
ok('gallery: one photo = no dots, no arrows');
html = renderToString(React.createElement(Gallery, { pictures: pics, shown: pics[0], onShow() {}, name: 'Hex',
  texts: [{ id: 't', text: 'MY NAME', y: 50, size: 8, color: '#fff', bold: false }] }));
assert.equal((html.match(/MY NAME/g) || []).length, 3);
ok('gallery: the customer\'s typed words are drawn on every photo');
assert.ok(/h-11 w-7/.test(html), 'each dot has a 44 px tall tap area');

const Strip = await load('TrustStrip.jsx');
const shop = { slug: 'bynd', name: { en: 'BYND' }, shipping: { zones: [{ id: 'c', price: 50 }] }, contact: { whatsapp: '01012345678' },
  pages: { returns: { body: { en: 'Returns text' } } }, defaultCountryCode: '20' };
html = renderToString(React.createElement(Strip, { tenant: shop }));
assert.match(html, /trust\.cash/); assert.match(html, /trust\.feeFrom/); assert.match(html, /trust\.returns/); assert.match(html, /trust\.whatsapp/);
assert.match(html, /href="\/store\/bynd\/page\/returns"/); assert.match(html, /href="https:\/\/wa\.me\//); assert.match(html, /rel="noopener noreferrer"/);
ok('trust strip: a shop with areas, a returns page and WhatsApp shows four real items with working links');
html = renderToString(React.createElement(Strip, { tenant: { slug: 'x', name: { en: 'X' } } }));
assert.match(html, /trust\.cash/); assert.ok(!/trust\.returns|trust\.whatsapp|trust\.fee/.test(html));
ok('trust strip: a bare shop shows only cash on delivery (nothing invented)');

// ----- 3. tap sizes + wording -----
const picker = fs.readFileSync(path.join(root, 'src/components/storefront/OptionPicker.jsx'), 'utf8');
assert.ok(/h-11 w-11/.test(picker) && !/h-9 w-9/.test(picker));
assert.ok(/min-h-\[44px\] rounded border px-4 py-2/.test(picker));
ok('colour swatches and choice chips are at least 44 px');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/en.json'), 'utf8'));
assert.equal(en.storefront.pkgNowOne, '1 piece: {{price}}');
const wd = fs.readFileSync(path.join(root, 'src/components/storefront/WallDesigner.jsx'), 'utf8');
assert.ok(/needColour \? 'text-rust' : 'text-ink-faint'/.test(wd));
ok('update 47 fixes (singular "1 piece", quiet "no colour yet" chip) are in');
console.log('ALL ' + n + ' GALLERY-AND-TRUST CHECKS PASSED');
