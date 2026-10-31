// Update 30: the wall designer on phones. Two-finger zoom maths, the grouping of a wall's cart lines,
// and the shared wall card (cart + checkout).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as P from '../src/utils/pinch.js';
import * as G from '../src/utils/wallGroups.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. pinch maths
assert.equal(P.clamp(5, 1, 3), 3); assert.equal(P.clamp(0, 1, 3), 1); assert.equal(P.clamp(2, 1, 3), 2);
assert.equal(P.fingerDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
assert.deepEqual(P.fingerMiddle({ x: 0, y: 10 }, { x: 10, y: 30 }), { x: 5, y: 20 });
assert.equal(P.pinchZoom(1, 100, 200, 0.6, 4), 2);                      // fingers twice as far apart = twice as big
assert.equal(P.pinchZoom(2, 200, 100, 0.6, 4), 1);                      // half as far = half as big
assert.equal(P.pinchZoom(1, 100, 1000, 0.6, 4), 4);                     // never above the limit
assert.equal(P.pinchZoom(1, 100, 1, 0.6, 4), 0.6);                      // never below the limit
assert.equal(P.pinchZoom(1.5, 0, 50, 0.6, 4), 1.5); assert.equal(P.pinchZoom(1.5, 50, 0, 0.6, 4), 1.5);   // bad numbers: no jump
assert.equal(P.pinchZoom(9, 0, 0, 0.6, 4), 4);
ok('pinch: zoom follows the distance between the fingers, stays between the limits, ignores bad numbers');

// 2. the spot between the fingers stays under them
const before = { scroll: { left: 100, top: 40 }, point: { x: 250, y: 300 }, box: { left: 50, top: 100 }, oldSize: { w: 600, h: 400 } };
const after = P.scrollAfterZoom({ ...before, newSize: { w: 1200, h: 800 } });          // twice as big
// the point inside the picture: (100 + 200) / 600 = 0.5 across, (40 + 200) / 400 = 0.6 down
assert.deepEqual(after, { left: 400, top: 280 });
assert.equal((after.left + 200) / 1200, 0.5); assert.equal((after.top + 200) / 800, 0.6);   // same spot under the fingers
assert.deepEqual(P.scrollAfterZoom({ ...before, newSize: { w: 300, h: 200 } }), { left: 0, top: 0 });    // never a negative scroll
assert.deepEqual(P.scrollAfterZoom({ scroll: { left: 0, top: 0 }, point: { x: 10, y: 10 }, box: { left: 0, top: 0 }, oldSize: { w: 0, h: 0 }, newSize: { w: 100, h: 100 } }), { left: 40, top: 40 });
ok('after zooming the scroll position is chosen so the spot between the fingers stays where it was');

// 3. cart rows
const line = (o) => ({ productId: 'p', quantity: 1, unitPrice: 10, ...o });
const items = [line({ id: 'a' }), line({ wallId: 'w1', quantity: 2, unitPrice: 80 }), line({ id: 'b' }), line({ wallId: 'w1', quantity: 3, unitPrice: 90 }), line({ wallId: 'w2', quantity: 1 })];
const rows = G.groupCartRows(items);
assert.equal(rows.length, 4); assert.ok(rows[0].item && !rows[0].wallId); assert.equal(rows[1].wallId, 'w1'); assert.equal(rows[1].lines.length, 2);
assert.ok(rows[2].item); assert.equal(rows[3].wallId, 'w2');
assert.equal(G.wallPieces(rows[1].lines), 5); assert.equal(G.wallMoney(rows[1].lines), 2 * 80 + 3 * 90);
assert.deepEqual(G.groupCartRows([]), []); assert.deepEqual(G.groupCartRows(undefined), []);
ok('cart rows: the lines of one wall are grouped where its first line is; pieces and money of a wall add up');

// 4. the shared wall card (as used in the cart AND at checkout), rendered on the server
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests', `.wp-${process.pid}.cjs`);
await build({ stdin: { contents: `export { default } from ${JSON.stringify(root + '/src/components/storefront/WallCartCard.jsx')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile: out, logLevel: 'error', jsx: 'automatic', define: { 'import.meta.env': '{}' },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 's', setup(b) {
    b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'st' }));
    b.onLoad({ filter: /.*/, namespace: 'st' }, () => ({ loader: 'js', contents: 'export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?"["+o.n+"]":"")});' }));
    b.onResolve({ filter: /context\/LanguageContext$/ }, (a) => ({ path: a.path, namespace: 'st2' }));
    b.onLoad({ filter: /.*/, namespace: 'st2' }, () => ({ loader: 'js', contents: "export const useLanguage=()=>({language:'en'});" }));
  } }] });
const req = createRequire(import.meta.url);
const Card = req(out).default; fs.rmSync(out, { force: true });
const React = req('react'); const { renderToString } = req('react-dom/server');
const wallLines = [
  { productId: 'p', quantity: 3, unitPrice: 80, name: { en: 'Hexagon' }, wallId: 'w1', key: 'a', selections: { col: 'blk' }, optionLabels: [{ type: 'color', value: { en: 'Black' }, color: '#111111' }], wallCells: [{ q: 0, r: 0, c: 'blk', h: '#111111' }, { q: 1, r: 0, c: 'blk', h: '#111111' }, { q: 2, r: 0, c: 'blu', h: '#2244ff' }] },
  { productId: 'p', quantity: 2, unitPrice: 110, name: { en: 'Hexagon' }, wallId: 'w1', key: 'b', selections: { col: 'blu' }, optionLabels: [{ type: 'color', value: { en: 'Blue' }, color: '#2244ff' }] },
];
let html = renderToString(React.createElement(Card, { lines: wallLines }));
assert.match(html, /data-cart-wall/); assert.match(html, /wall\.cartTitle\[5\]/); assert.equal((html.match(/<polygon/g) || []).length, 3);
assert.match(html, /wall\.cartLine\[3\]/); assert.match(html, /wall\.cartLine\[2\]/); assert.doesNotMatch(html, /storefront\.remove/);       // checkout: read-only
html = renderToString(React.createElement(Card, { lines: wallLines, onRemove() {} }));
assert.match(html, /storefront\.remove/);                                                                                                         // cart: with Remove
ok('the wall card: picture, pieces, colour lines, total; read-only without onRemove (checkout), with Remove in the cart');

console.log(`\nALL ${n} WALL-PHONE CHECK GROUPS PASSED`);
