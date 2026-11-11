// Design step 6 (wall designer studio): example walls, undo, named colour chips, one clear price line.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { availableSamples, SAMPLE_DEFS } from '../src/utils/wallSamples.js';
import { isConnected, keyOf, WALL_MAX } from '../src/utils/wallLayout.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ----- 1. examples: pure rules -----
const all = availableSamples(1, WALL_MAX);
assert.deepEqual(all.map((s) => [s.id, s.cells.length]), [['starter', 7], ['flower', 19], ['row', 8]]);
for (const s of all) {
  assert.ok(isConnected(s.cells), s.id + ' is one connected piece');
  assert.equal(new Set(s.cells.map(keyOf)).size, s.cells.length, s.id + ' has no overlap');
  assert.ok(s.cells.every((c) => Number.isInteger(c.q) && Number.isInteger(c.r)));
}
ok('three examples (7 / 19 / 8 pieces): each one connected piece, no overlap, whole-number places');
assert.deepEqual(availableSamples(10, 60).map((s) => s.id), ['flower']);
assert.deepEqual(availableSamples(1, 6), []);
assert.deepEqual(availableSamples(8, 19).map((s) => s.id), ['flower', 'row']);
ok('only examples that fit the shop\'s minimum and the largest allowed wall are offered');
const rowCells = all.find((s) => s.id === 'row').cells;
assert.ok(rowCells.every((c) => c.r === 0) && Math.min(...rowCells.map((c) => c.q)) === -4);
ok('the row is a straight line, centred on the middle');
assert.ok(SAMPLE_DEFS.every((d) => d.n <= WALL_MAX));
ok('no example is bigger than the safety limit');

// ----- 2. server render of the real designer and the colour chips -----
async function load(file) {
  const outfile = path.join(root, 'tests', `.ws-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  await build({
    stdin: { contents: `import * as M from ${JSON.stringify(root + '/src/' + file)}; module.exports = M;`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 's', setup(b) {
      b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'st' }));
      b.onLoad({ filter: /.*/, namespace: 'st', }, () => ({ contents: "export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?'['+o.n+']':'')});", loader: 'js' }));
      b.onResolve({ filter: /LanguageContext$/ }, () => ({ path: 'lang', namespace: 'st3' }));
      b.onLoad({ filter: /.*/, namespace: 'st3' }, () => ({ contents: "export const useLanguage=()=>({language:'en'});", loader: 'js' }));
    } }],
  });
  const m = createRequire(import.meta.url)(outfile); fs.rmSync(outfile, { force: true }); return m;
}
const R = createRequire(import.meta.url);
const React = R('react'); const { renderToString } = R('react-dom/server');
const WD = (await load('components/storefront/WallDesigner.jsx')).default;
const palette = [{ id: 'k', label: 'Black', color: '#111111' }, { id: 'b', label: 'Blue', color: '#0000ff' }];
let html = renderToString(React.createElement(WD, { quantity: 7, min: 1, max: 60, onQuantity() {}, palette, paint: 'k', totalText: '1,000 EGP' }));
assert.equal((html.match(/data-cell/g) || []).length, 7);
assert.match(html, /data-wall-samples/);
for (const k of ['starter', 'flower', 'row']) assert.ok(html.includes(`wall.sample_${k}`), k);
assert.match(html, /data-wall-undo[^>]*disabled|disabled[^>]*data-wall-undo/);
ok('the designer shows the three examples and a disabled Undo before any change');
assert.match(html, /data-wall-summary/); assert.match(html, /wall\.pieces\[7\]/); assert.match(html, /wall\.total\[1,000 EGP\]|wall\.total/);
assert.match(html, /data-wall-legend/);
ok('one summary block: number of pieces, total price and the colour mix');
html = renderToString(React.createElement(WD, { quantity: 1, min: 1, max: 60, onQuantity() {}, palette, paint: 'k' }));
assert.match(html, /wall\.piecesOne/);
ok('one piece says "1 piece"');
html = renderToString(React.createElement(WD, { quantity: 12, min: 12, max: 14, onQuantity() {} }));
assert.ok(!html.includes('wall.sample_flower'), '19 > the shop maximum of 14');
ok('examples that do not fit the product\'s limits are not shown');

const OP = (await load('components/storefront/OptionPicker.jsx')).default;
const colour = { id: 'c', type: 'color', label: { en: 'Colour' }, required: true, values: [
  { id: 'k', label: { en: 'Black' }, color: '#111111' }, { id: 'b', label: { en: 'Blue' }, color: '#0000ff' }] };
html = renderToString(React.createElement(OP, { option: colour, value: 'k', onChange() {}, named: true }));
assert.match(html, /data-colour-chips/); assert.ok(html.includes('Black') && html.includes('Blue'));
assert.ok(/aria-checked="true"/.test(html) && (html.match(/aria-checked/g) || []).length === 2);
assert.ok((html.match(/min-h-\[44px\]/g) || []).length === 2);
assert.match(html, /background-color:#0000ff/);
ok('named colour chips: swatch + name, 44 px tall, the picked one is marked');
html = renderToString(React.createElement(OP, { option: colour, value: 'k', onChange() {} }));
assert.ok(!/data-colour-chips/.test(html) && !/py-1\.5 ps-2/.test(html) && (html.match(/h-11 w-11/g) || []).length === 2);
ok('the normal product page keeps its round swatches');
html = renderToString(React.createElement(OP, { option: colour, value: '', onChange() {}, named: true, leftOf: (id) => (id === 'b' ? 0 : 5) }));
assert.match(html, /disabled=""[^>]*>|line-through/); assert.ok(/storefront\.soldOutShort/.test(html));
ok('a sold-out colour is crossed out and cannot be picked in the chips');

// ----- 3. wiring -----
const page = read('pages/storefront/ProductPage.jsx');
assert.ok(/option=\{\{ \.\.\.wallColorOpt, required: true \}\}\n\s*named/.test(page));
ok('the wall\'s paint box uses the named chips');
const wd = read('components/storefront/WallDesigner.jsx');
assert.ok(/setHistory\(\(h\) => h\.slice\(0, -1\)\)/.test(wd) && /slice\(-29\)/.test(wd), 'Undo keeps at most 30 steps');
assert.ok(/if \(draft === null\) record\(cells\)/.test(wd));
ok('undo keeps at most 30 steps; typing in the count box is one step');
const en = JSON.parse(read('i18n/en.json')); const ar = JSON.parse(read('i18n/ar.json'));
for (const k of ['samples', 'sample_starter', 'sample_flower', 'sample_row', 'undo', 'pieces', 'piecesOne']) assert.ok(en.wall[k] && ar.wall[k], k);
ok('all new texts exist in English and Arabic');
console.log('ALL ' + n + ' WALL-STUDIO CHECKS PASSED');
