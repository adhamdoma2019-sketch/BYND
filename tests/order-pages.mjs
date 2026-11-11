// Design step 9: thank-you and Track pages: the progress line, "what happens next" in plain words,
// and the WhatsApp button about this order.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const R = createRequire(import.meta.url);
const React = R('react'); const { renderToString } = R('react-dom/server');

async function load(entry, stubs) {
  const outfile = path.join(root, 'tests', `.op-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  await build({
    stdin: { contents: `import * as M from ${JSON.stringify(root + '/src/' + entry)}; module.exports = M;`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 's', setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => { for (const k of Object.keys(stubs)) if (new RegExp(k).test(a.path)) return { path: a.path, namespace: 'stub' }; return null; });
      b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => { for (const [k, v] of Object.entries(stubs)) if (new RegExp(k).test(a.path)) return { contents: v, loader: 'js', resolveDir: root }; });
    } }],
  });
  const m = R(outfile); fs.rmSync(outfile, { force: true }); return m;
}
const stubs = {
  '^react-i18next$': `export const useTranslation=()=>({t:(k,o)=>k+(o&&o.order?'['+o.order+']':'')});`,
  'LanguageContext$': `export const useLanguage=()=>({language:globalThis.__lang||'en'});`,
  '^react-router-dom$': `import React from 'react'; export const useParams=()=>({slug:'bynd'}); export const useLocation=()=>({state:globalThis.__state}); export const Link=({children,...p})=>React.createElement('a',p,children);`,
  'StorefrontContext$': `export const useStorefront=()=>({tenant:globalThis.__tenant});`,
  'WallPicture$': `export default ()=>null;`,
  'ReceiptCard$': `export default ()=>null;`,
};

// ----- 1. the progress line -----
const P = await load('components/storefront/OrderProgress.jsx', stubs);
const states = (status) => {
  const html = renderToString(React.createElement(P.default, { status }));
  return [...html.matchAll(/data-state="(done|current|todo)"/g)].map((m) => m[1]);
};
assert.deepEqual(['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map(P.progressIndex), [0, 1, 1, 2, 3]);
assert.equal(P.progressIndex('cancelled'), -1); assert.equal(P.progressIndex('returned'), -1); assert.equal(P.progressIndex('nonsense'), -1);
ok('statuses map to the four steps (being prepared sits inside Confirmed); cancelled / returned / unknown have no step');
assert.deepEqual(states('pending'), ['current', 'todo', 'todo', 'todo']);
assert.deepEqual(states('confirmed'), ['done', 'current', 'todo', 'todo']);
assert.deepEqual(states('processing'), ['done', 'current', 'todo', 'todo']);
assert.deepEqual(states('shipped'), ['done', 'done', 'current', 'todo']);
assert.deepEqual(states('delivered'), ['done', 'done', 'done', 'done']);
ok('the line shows done / current / still to come for every status; a delivered order is all done');
for (const s of ['cancelled', 'returned']) assert.equal(renderToString(React.createElement(P.default, { status: s })), '');
ok('cancelled and returned orders show no progress line');
let html = renderToString(React.createElement(P.default, { status: 'shipped' }));
assert.match(html, /aria-label="progress\.label"/); assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
assert.ok(/start-\[-50%\]/.test(html) && !/\bleft-|\bright-/.test(html), 'logical positions: the line mirrors in Arabic');
for (const k of ['received', 'confirmed', 'shipped', 'delivered']) assert.ok(html.includes('progress.' + k));
ok('accessible (one current step, a label) and mirrored for Arabic (no left / right positions)');

// ----- 2. the thank-you page -----
globalThis.__tenant = { name: { en: 'BYND' }, slug: 'bynd', theme: { accent: '#aa8800' }, contact: { whatsapp: '01012345678' }, defaultCountryCode: '20' };
const Thanks = (await load('pages/storefront/OrderConfirmation.jsx', stubs)).default;
globalThis.__state = { orderNumberLabel: 'BYND-1001', totalAmount: 700 };
html = renderToString(React.createElement(Thanks));
assert.match(html, /data-thankyou-progress/); assert.match(html, /data-progress-current="0"/);
assert.match(html, /data-whats-next/); assert.equal((html.match(/next\.step/g) || []).length, 3);
assert.ok(html.includes('next.step1') && html.includes('next.step2') && html.includes('next.step3') && !html.includes('next.step2Made'));
ok('thank-you page: "Received" is the current step and three plain steps say what happens next');
globalThis.__state = { orderNumberLabel: 'BYND-1001', totalAmount: 700, orderType: 'preorder' };
html = renderToString(React.createElement(Thanks));
assert.ok(html.includes('next.step2Made') && !/next\.step2[^M]/.test(html.replace('next.step2Made', '')));
ok('a made-to-order / preorder order says "we make it and tell you when it is ready" instead of "we prepare it"');
assert.match(html, /data-whatsapp-order/);
const href = decodeURIComponent((html.match(/data-whatsapp-order[^>]*>/) || [html.match(/<a[^>]*href="(https:\/\/wa\.me[^"]*)"[^>]*data-whatsapp-order/)?.[0] || ''])[0] + (html.match(/href="(https:\/\/wa\.me[^"]*)"/) || [])[1]);
assert.ok(/wa\.me\/2001012345678|wa\.me\/201012345678/.test(href), 'Egyptian number in international form: ' + href.slice(0, 80));
assert.ok(href.includes('contact.whatsappOrder[BYND-1001]'), 'the order number is in the message: ' + href);
ok('WhatsApp button: opens the shop\'s number with a message that carries the order number');
globalThis.__tenant = { ...globalThis.__tenant, contact: {} };
html = renderToString(React.createElement(Thanks));
assert.doesNotMatch(html, /data-whatsapp-order/); assert.match(html, /data-thankyou-progress/);
ok('no WhatsApp number set = no WhatsApp button (nothing is invented)');
globalThis.__state = undefined; assert.doesNotThrow(() => renderToString(React.createElement(Thanks)));
ok('the thank-you page still opens without order data (e.g. after the tab was closed)');

// ----- 3. the track result -----
globalThis.__tenant = { name: { en: 'BYND' }, slug: 'bynd', contact: { whatsapp: '01012345678' }, defaultCountryCode: '20' };
const T = (await load('components/storefront/TrackResult.jsx', stubs)).default;
const render = (result) => renderToString(React.createElement(T, { result, tenant: globalThis.__tenant, language: 'en' }));
const hist = [{ status: 'pending', timestamp: '2026-11-10T10:00:00.000Z' }, { status: 'confirmed', timestamp: '2026-11-10T12:00:00.000Z' }];
for (const [status, next] of [['pending', 'pending'], ['confirmed', 'confirmed'], ['processing', 'processing'], ['shipped', 'shipped']]) {
  html = render({ orderNumberLabel: 'BYND-1001', status, orderType: 'normal', history: hist });
  assert.match(html, /data-progress/); assert.ok(html.includes(`track.next.${next}`), status); assert.match(html, /data-whatsapp-order/);
}
ok('track result: progress line + "next:" sentence for every open status, history dates, WhatsApp button');
html = render({ orderNumberLabel: 'BYND-1001', status: 'delivered', history: hist });
assert.match(html, /data-progress-current="3"/); assert.doesNotMatch(html, /data-track-next/);
ok('a delivered order has all steps done and no "next" sentence');
for (const status of ['cancelled', 'returned']) {
  html = render({ orderNumberLabel: 'BYND-1001', status, history: hist });
  assert.doesNotMatch(html, /data-progress/); assert.doesNotMatch(html, /data-track-next/); assert.ok(html.includes(`track.status.${status}`));
}
ok('cancelled / returned: the status in words only, no progress line');
html = render({ orderNumberLabel: 'BYND-1001', status: 'pending' });
assert.doesNotThrow(() => render({ orderNumberLabel: 'X', status: 'pending', history: undefined }));
assert.doesNotMatch(html, /track\.timeline/);
ok('a result without history still draws');
const page = read('pages/storefront/TrackOrder.jsx');
assert.ok(/<TrackResult result=\{result\} tenant=\{tenant\} language=\{language\} \/>/.test(page));
ok('the Track page uses the result component');

// ----- 4. texts -----
const en = JSON.parse(read('i18n/en.json')); const ar = JSON.parse(read('i18n/ar.json'));
for (const d of [en, ar]) {
  for (const k of ['label', 'received', 'confirmed', 'shipped', 'delivered']) assert.ok(d.progress[k], 'progress.' + k);
  for (const k of ['title', 'step1', 'step2', 'step2Made', 'step3']) assert.ok(d.next[k], 'next.' + k);
  for (const k of ['pending', 'confirmed', 'processing', 'shipped']) assert.ok(d.track.next[k], 'track.next.' + k);
  assert.ok(d.contact.whatsappOrder.includes('{{order}}') && d.contact.whatsappOrder.includes('{{shop}}') && d.contact.whatsappOrderButton);
}
ok('all new texts exist in English and Arabic (the WhatsApp message has the shop and the order number)');
console.log('ALL ' + n + ' ORDER-PAGE CHECKS PASSED');
