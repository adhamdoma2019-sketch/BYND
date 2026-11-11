// Design step 7 (home page) + the wall "Arrange" button:
//  - tidy arrangements of the wall (exact count, one connected piece, a different one every tap)
//  - the brand story strip (shown only when the shop wrote it, https photos only)
//  - the "From" price on shop cards, the shorter banner, the Settings story form
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { arrangementsFor, nextArrangement, shapeSignature, groupedColours } from '../src/utils/wallSamples.js';
import { isConnected, keyOf, WALL_MAX, resizeLayout } from '../src/utils/wallLayout.js';
import { storyOf, cardPrice } from '../src/utils/storefront.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ----- 1. tidy arrangements -----
for (let k = 3; k <= WALL_MAX; k += 1) {
  const list = arrangementsFor(k);
  assert.ok(list.length >= 2, `size ${k} has at least two arrangements`);
  const sigs = new Set();
  for (const a of list) {
    assert.equal(a.cells.length, k, `${a.id} of ${k}`);
    assert.equal(new Set(a.cells.map(keyOf)).size, k, `${a.id} of ${k}: no overlap`);
    assert.ok(a.cells.every((c) => Number.isInteger(c.q) && Number.isInteger(c.r)));
    assert.ok(isConnected(a.cells), `${a.id} of ${k}: one connected piece`);
    sigs.add(shapeSignature(a.cells));
  }
  assert.equal(sigs.size, list.length, `size ${k}: no two arrangements are the same shape`);
}
ok('every wall size from 3 to 60: each arrangement has exactly that many pieces, no overlap, one connected piece, all different');
assert.deepEqual(arrangementsFor(2), []); assert.deepEqual(arrangementsFor(1), []); assert.deepEqual(arrangementsFor(61), []);
assert.deepEqual(arrangementsFor(2.5), []);
ok('1-2 pieces (or more than the limit) have nothing to arrange');

// each tap gives a DIFFERENT shape, and the cycle visits every arrangement
for (const size of [3, 7, 12, 19, 37, 60]) {
  let cells = resizeLayout([], size, { min: 1, max: 60 });
  let last = '';
  const seen = new Set();
  for (let i = 0; i < arrangementsFor(size).length * 2; i += 1) {
    const pick = nextArrangement(cells, last);
    assert.ok(pick, `size ${size}`);
    assert.notEqual(shapeSignature(pick.cells), shapeSignature(cells), 'a tap always changes the shape');
    seen.add(pick.id); last = pick.id; cells = pick.cells;
  }
  assert.equal(seen.size, arrangementsFor(size).length, `size ${size}: the taps cycle through every arrangement`);
}
ok('every tap changes the shape; repeated taps cycle through all arrangements');
assert.equal(nextArrangement([{ q: 0, r: 0 }, { q: 1, r: 0 }], ''), null);
ok('nothing to offer for 2 pieces (the button is disabled)');

// colours stay tidy and the counts stay the same
const mix = ['b', 'k', 'b', '', 'k', 'k'];
const bands = groupedColours(mix, ['k', 'b']);
assert.deepEqual(bands, ['k', 'k', 'k', 'b', 'b', '']);
assert.deepEqual([...bands].sort(), [...mix].sort());
ok('colours become tidy bands in palette order with the same count of each');

// ----- 2. story -----
assert.equal(storyOf({}, 'en'), null);
assert.equal(storyOf({ story: { title: { en: '', ar: '' }, text: { en: '', ar: '' }, images: [] } }, 'en'), null);
assert.equal(storyOf({ story: { images: ['http://insecure/x.png', ''] } }, 'en'), null);
ok('no story written (or only unsafe / empty photo links) = no story at all');
const t = { story: { title: { en: 'Our story', ar: 'قصتنا' }, text: { en: 'Made by athletes', ar: 'صنعها رياضيون' },
  images: ['https://a/1.png', 'http://bad/2.png', 'https://a/3.png', '', 'https://a/4.png', 'https://a/5.png', 'https://a/6.png'] } };
let s = storyOf(t, 'en');
assert.equal(s.title, 'Our story'); assert.equal(s.text, 'Made by athletes');
assert.deepEqual(s.images, ['https://a/1.png', 'https://a/3.png', 'https://a/4.png', 'https://a/5.png']);
assert.equal(storyOf(t, 'ar').title, 'قصتنا');
ok('story: the right language, only https photos, at most 4');
assert.equal(storyOf({ story: { title: { en: 'x'.repeat(200) }, text: { en: 'y'.repeat(900) } } }, 'en').title.length, 60);
assert.equal(storyOf({ story: { title: { en: 'x'.repeat(200) }, text: { en: 'y'.repeat(900) } } }, 'en').text.length, 400);
ok('story: title and text are cut to their limits');

const R = createRequire(import.meta.url);
const React = R('react'); const { renderToString } = R('react-dom/server');
async function load(file) {
  const outfile = path.join(root, 'tests', `.h7-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  await build({
    stdin: { contents: `import * as M from ${JSON.stringify(root + '/src/' + file)}; module.exports = M;`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 's', setup(b) {
      b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'st' }));
      b.onLoad({ filter: /.*/, namespace: 'st' }, () => ({ contents: "export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?'['+o.n+']':'')});", loader: 'js' }));
      b.onResolve({ filter: /LanguageContext$/ }, () => ({ path: 'lang', namespace: 'st3' }));
      b.onLoad({ filter: /.*/, namespace: 'st3' }, () => ({ contents: "export const useLanguage=()=>({language:'en'});", loader: 'js' }));
    } }],
  });
  const m = R(outfile); fs.rmSync(outfile, { force: true }); return m;
}
const Strip = (await load('components/storefront/StoryStrip.jsx')).default;
assert.equal(renderToString(React.createElement(Strip, { story: null })), '');
let html = renderToString(React.createElement(Strip, { story: { title: 'Our story', text: 'Line one', images: [] } }));
assert.ok(html.includes('Our story') && html.includes('Line one') && !/<img/.test(html) && !/data-story-photos/.test(html));
ok('story strip: nothing without a story; text only when there are no photos');
html = renderToString(React.createElement(Strip, { story: { title: 'T', text: '', images: ['https://a/1.png', 'https://a/2.png', 'https://a/3.png', 'https://a/4.png'] } }));
assert.equal((html.match(/<img/g) || []).length, 4); assert.match(html, /grid-cols-2 sm:grid-cols-4/); assert.equal((html.match(/loading="lazy"/g) || []).length, 4);
html = renderToString(React.createElement(Strip, { story: { title: '', text: 'x', images: ['https://a/1.png'] } }));
assert.equal((html.match(/<img/g) || []).length, 1); assert.match(html, /aspect-\[16\/10\]/);
ok('story strip: 4 photos in a grid (lazy), 1 photo as one wide picture');
const home = read('pages/storefront/StorefrontHome.jsx');
assert.ok(/<StoryStrip story=\{storyOf\(tenant, language\)\} \/>/.test(home));
ok('the home page shows the story strip under the products');

// ----- 3. "From" price -----
assert.deepEqual(cardPrice({ price: 200 }), { amount: 200, from: false });
assert.deepEqual(cardPrice({ price: 200, options: [{ type: 'color', required: true, values: [{ priceDelta: 0 }, { priceDelta: 0 }] }] }), { amount: 200, from: false });
ok('no extras: the plain price, no "From"');
const prs = { price: 500, options: [
  { id: 'sport', type: 'choice', required: true, values: [{ priceDelta: 0 }, { priceDelta: 0 }] },
  { id: 'name', type: 'addon', required: false, values: [{ priceDelta: 50 }] },
  { id: 'custom', type: 'text', required: false, showWhen: { optionId: 'sport', valueId: 'a' }, values: [{ priceDelta: 30 }] },
] };
assert.deepEqual(cardPrice(prs), { amount: 500, from: true });
ok('an optional add-on costs extra: "From" the base price');
assert.deepEqual(cardPrice({ price: 500, options: [{ type: 'choice', required: true, values: [{ priceDelta: 90 }, { priceDelta: 40 }] }] }), { amount: 540, from: true });
assert.deepEqual(cardPrice({ price: 500, options: [{ type: 'choice', required: true, showWhen: { optionId: 'x', valueId: 'y' }, values: [{ priceDelta: 90 }] }] }), { amount: 500, from: true });
assert.deepEqual(cardPrice({ price: 100, options: [{ type: 'choice', required: true, values: [{ priceDelta: -30 }, { priceDelta: 20 }] }] }), { amount: 100, from: true });
ok('"From" = the base price plus the cheapest REQUIRED choice; conditional options and negative extras are ignored');
const card = read('components/storefront/ProductCard.jsx');
assert.ok(/data-card-price/.test(card) && /storefront\.priceFrom/.test(card) && /cardPrice\(product\)/.test(card));
ok('the shop card prints "From ..." only when the product has extras');

// ----- 4. banner + Settings -----
const hero = read('components/storefront/Hero.jsx');
assert.ok(!/72svh|80vh/.test(hero) && (hero.match(/min-h-\[58svh\]/g) || []).length === 2 && (hero.match(/sm:min-h-\[66vh\]/g) || []).length === 2);
ok('the banner is shorter (58% of a phone screen, 66% of a big one)');
const settings = read('pages/admin/Settings.jsx');
assert.ok(/data-story-form/.test(settings) && /\.\.\.story\.images\]/.test(settings) && /story: publicSettings\.story/.test(settings) && /changed\.push\('story'\)/.test(settings));
assert.equal((settings.match(/storyPhotoN/g) || []).length, 1);
assert.ok(/'highlights', 'story', 'pages'/.test(read('utils/preview.js')));
ok('Settings > Content has the story form (4 photo boxes, https check, saved, logged, live preview)');

// ----- 5. the Arrange button in the designer -----
const WD = (await load('components/storefront/WallDesigner.jsx')).default;
const palette = [{ id: 'k', label: 'Black', color: '#111111' }, { id: 'b', label: 'Blue', color: '#0000ff' }];
html = renderToString(React.createElement(WD, { quantity: 12, min: 1, max: 60, onQuantity() {}, palette, paint: 'k' }));
const tag = (h) => (h.match(/<button[^>]*data-wall-arrange[^>]*>/) || [''])[0];
assert.ok(tag(html) && !/ disabled=""/.test(tag(html)));
assert.ok(html.includes('wall.arrange'));
html = renderToString(React.createElement(WD, { quantity: 2, min: 1, max: 60, onQuantity() {}, palette, paint: 'k' }));
assert.ok(/ disabled=""/.test(tag(html)));
ok('the Arrange button is in the designer, enabled from 3 pieces, disabled below');
assert.ok(/grid-cols-2 gap-2 border-t border-ink\/10 p-2 sm:grid-cols-4/.test(read('components/storefront/WallDesigner.jsx')));
ok('the four buttons are 2 x 2 on a phone and one row on a bigger screen');

const en = JSON.parse(read('i18n/en.json')); const ar = JSON.parse(read('i18n/ar.json'));
for (const [a, k] of [['wall', 'arrange'], ['storefront', 'priceFrom'], ['settingsPage', 'storyTitle'], ['settingsPage', 'storyHelp'], ['settingsPage', 'storyPhotoN']]) assert.ok(en[a][k] && ar[a][k], k);
ok('new texts exist in English and Arabic');
console.log('ALL ' + n + ' STEP-7 AND ARRANGE CHECKS PASSED');
