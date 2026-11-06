// Update 35: words typed by the customer, shown ON the product picture (centred; height, size, colour set by the shop).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as PT from '../src/utils/pictureText.js';
import { formToOptions, optionsToForm, newOption } from '../src/utils/productOptionsForm.js';
import { applyProductDraft } from '../src/utils/preview.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. what is saved on the option
assert.equal(PT.cleanOverlay(undefined), null); assert.equal(PT.cleanOverlay({ enabled: false, y: 10 }), null);
assert.deepEqual(PT.cleanOverlay({ enabled: true }), { enabled: true, y: 50, size: 8, color: '#d4af37', bold: true });   // defaults: centred, NOT white
assert.equal(PT.cleanOverlay({ enabled: true, y: 500 }).y, 100); assert.equal(PT.cleanOverlay({ enabled: true, y: -5 }).y, 0);
assert.equal(PT.cleanOverlay({ enabled: true, size: 99 }).size, 30); assert.equal(PT.cleanOverlay({ enabled: true, size: 0.1 }).size, 2);
assert.equal(PT.cleanOverlay({ enabled: true, y: 'abc', size: '' }).y, 50);
assert.equal(PT.cleanOverlay({ enabled: true, color: '#FFFFFF' }).color, '#FFFFFF');                 // white is a free choice
assert.equal(PT.cleanOverlay({ enabled: true, color: 'red; background:url(x)' }).color, '#d4af37');   // nothing odd can be saved as a colour
assert.equal(PT.cleanOverlay({ enabled: true, bold: false }).bold, false);
ok('overlay settings: defaults (centred, gold not white), limits, any hex colour incl. white, bad colour text refused');

// 2. long words shrink to fit
assert.equal(PT.fitSize(8, 'ab'), 8); assert.ok(PT.fitSize(8, 'x'.repeat(30)) < 8); assert.equal(PT.fitSize(8, ''), 8);
assert.ok(PT.fitSize(8, 'x'.repeat(30)) * 30 * 0.62 <= 88.0001);
ok('a long text gets smaller so it stays inside the picture');

// 3. the texts to draw
const txt = { id: 'dist', type: 'text', label: { en: 'Distance' }, maxLength: 10, values: [], overlay: { enabled: true, y: 40, size: 9, color: '#ff0000', bold: true } };
const noShow = { id: 'nm', type: 'text', label: { en: 'Name' }, maxLength: 15, values: [] };
const set = { id: 'set', type: 'choice', label: { en: 'Set' }, required: true, values: [{ id: 'std', label: { en: 'Standard' } }, { id: 'cus', label: { en: 'Custom' } }] };
const cond = { ...txt, showWhen: { optionId: 'set', valueId: 'cus' } };
const addon = { id: 'ad', type: 'addon', label: { en: 'Name' }, askText: true, textMax: 5, values: [{ id: 'on', label: { en: 'Name' }, priceDelta: 50 }], overlay: { enabled: true } };
const prod = (options) => ({ id: 'p', options });
assert.deepEqual(PT.pictureTexts(prod([txt]), { dist: '  12 km ' }), [{ id: 'dist', text: '12 km', y: 40, size: 9, color: '#ff0000', bold: true }]);
assert.deepEqual(PT.pictureTexts(prod([txt]), {}), []); assert.deepEqual(PT.pictureTexts(prod([txt]), { dist: '   ' }), []);
assert.deepEqual(PT.pictureTexts(prod([noShow]), { nm: 'Sam' }), []);                                    // the shop did not switch it on
assert.equal(PT.pictureTexts(prod([txt]), { dist: '12345678901234' })[0].text, '1234567890');           // never longer than the allowed length
assert.deepEqual(PT.pictureTexts(prod([set, cond]), { set: 'std', dist: '7 km' }), []);                 // hidden option: nothing is drawn
assert.equal(PT.pictureTexts(prod([set, cond]), { set: 'cus', dist: '7 km' }).length, 1);
assert.equal(PT.pictureTexts(prod([addon]), { ad: true, 'ad.text': 'Omar' })[0].text, 'Omar');          // a tick box that asks for a word
assert.deepEqual(PT.pictureTexts(prod([addon]), { 'ad.text': 'Omar' }), []);                            // box not ticked
assert.equal(PT.pictureTexts(prod([addon]), { ad: true, 'ad.text': 'Omar123' })[0].text, 'Omar1');
assert.equal(PT.pictureTexts(prod([{ ...set, overlay: { enabled: true } }]), { set: 'std' }).length, 0); // a colour / choice list never draws
ok('texts to draw: only switched-on text boxes / tick boxes with a word, trimmed, within the length, hidden options draw nothing');

// 4. form <-> saved product
const f = { ...newOption(), type: 'text', labelEn: 'Distance', overlayOn: true, overlayY: '62', overlaySize: '11', overlayColor: '#112233', overlayBold: false };
let saved = formToOptions([f]);
assert.deepEqual(saved[0].overlay, { enabled: true, y: 62, size: 11, color: '#112233', bold: false });
const back = optionsToForm(saved)[0];
assert.equal(back.overlayOn, true); assert.equal(back.overlayY, '62'); assert.equal(back.overlaySize, '11'); assert.equal(back.overlayColor, '#112233'); assert.equal(back.overlayBold, false);
assert.deepEqual(formToOptions([back]), saved);                                                          // saving again changes nothing
assert.equal(formToOptions([{ ...f, overlayOn: false }])[0].overlay, undefined);
assert.equal(formToOptions([{ ...f, type: 'choice', values: [{ id: 'v', labelEn: 'A', labelAr: '', priceDelta: '', costDelta: '' }] }])[0].overlay, undefined); // a list cannot show typed words
const ad = { ...newOption(), type: 'addon', labelEn: 'Name', values: [{ id: 'v', labelEn: 'Name', labelAr: '', priceDelta: '50', costDelta: '' }], overlayOn: true };
assert.equal(formToOptions([{ ...ad, askText: false }])[0].overlay, undefined);                          // tick box without a word: nothing to show
assert.ok(formToOptions([{ ...ad, askText: true }])[0].overlay);
assert.equal(optionsToForm([{ id: 'x', type: 'text', label: { en: 'A' }, values: [] }])[0].overlayOn, false);   // old products: off
ok('the product form keeps the settings (and loads them back), an old product has it off, only text / ask-a-word options can have it');

// 5. through the real product record and the live preview
const formFile = path.join(root, 'tests', `.pf-${process.pid}.mjs`);
await build({ entryPoints: [path.join(root, 'src/utils/productForm.js')], bundle: true, format: 'esm', platform: 'node', outfile: formFile, logLevel: 'error' });
const { productFields } = await import(formFile); fs.rmSync(formFile, { force: true });
const rec = productFields({ nameEn: 'P', price: '100', options: [f], isPreorder: true });
assert.equal(rec.options[0].overlay.y, 62);
const draft = applyProductDraft({ id: 'p', name: { en: 'x' } }, { options: rec.options });
assert.equal(draft.options[0].overlay.color, '#112233');
ok('the saved product and the live preview carry the settings');

// 6. the picture component, rendered
const outfile = path.join(root, 'tests', `.pt-${process.pid}.cjs`);
await build({
  entryPoints: [path.join(root, 'src/components/storefront/PictureText.jsx')], bundle: true, format: 'cjs', platform: 'node', outfile,
  logLevel: 'error', jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
});
const require = createRequire(import.meta.url);
const React = require('react'); const { renderToString } = require('react-dom/server');
const Comp = require(outfile).default; fs.rmSync(outfile, { force: true });
let html = renderToString(React.createElement(Comp, { src: 'https://x/a.jpg', alt: 'A', texts: [] }));
assert.match(html, /<img/); assert.doesNotMatch(html, /data-picture-text-line/);
html = renderToString(React.createElement(Comp, { src: 'https://x/a.jpg', alt: 'A', texts: [{ id: 'd', text: '12 KM', y: 40, size: 10, color: '#ff0000', bold: true }] }));
assert.match(html, /data-picture-text-line/); assert.match(html, />12 KM</); assert.match(html, /top:40%/); assert.match(html, /color:#ff0000/);
assert.match(html, /font-size:40px/); assert.match(html, /inset-inline:0/); assert.match(html, /text-align:center/);   // 400 px fallback x 10% ; centred sideways
assert.match(html, /pointer-events:none/);
html = renderToString(React.createElement(Comp, { src: 's', alt: 'A', texts: [{ id: 'd', text: '<b>x</b>', y: 50, size: 8, color: '#d4af37', bold: false }] }));
assert.doesNotMatch(html, /<b>x<\/b>/);                                                                   // typed words are never treated as HTML
ok('picture component: no words = just the picture; words are centred at the chosen height / size / colour; never HTML');

console.log(`\nALL ${n} PICTURE-TEXT CHECKS PASSED`);
