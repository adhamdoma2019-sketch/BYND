// Update 26: "show this option only when ..." and up to 10 options per product.
// Checks the SERVER (the real gate) and the browser copy, the product form, and the "My PRs" blueprint.
import assert from 'node:assert/strict';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import { getQuote } from '../api/_lib/quote.js';
import * as S from '../api/_lib/options.js';
import * as B from '../src/utils/productOptions.js';
import { formToOptions, optionsToForm, newOption } from '../src/utils/productOptionsForm.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// productForm.js / preview.js import without file endings (the browser build allows it): bundle them first.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'tests', `.oc-${process.pid}.cjs`);
await build({ stdin: { contents: `export * from ${JSON.stringify(root + '/src/utils/productForm.js')}; export * from ${JSON.stringify(root + '/src/utils/preview.js')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', define: { 'import.meta.env': '{}' } });
const { productFields, applyProductDraft } = createRequire(import.meta.url)(outfile);
fs.rmSync(outfile, { force: true });
// the real option editor (admin), rendered on the server with the i18n stub
const edFile = path.join(root, 'tests', `.oe-${process.pid}.cjs`);
await build({ stdin: { contents: `export { default } from ${JSON.stringify(root + '/src/components/admin/OptionsEditor.jsx')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile: edFile, logLevel: 'error', jsx: 'automatic', define: { 'import.meta.env': '{}' },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const useTranslation=()=>({t:(k)=>k});', loader: 'js' }));
    b.onResolve({ filter: /ImageField$/ }, (a) => ({ path: a.path, namespace: 'stub2' }));
    b.onLoad({ filter: /.*/, namespace: 'stub2' }, () => ({ contents: 'export default ()=>null;', loader: 'js' }));
  } }] });
const req = createRequire(import.meta.url);
const OptionsEditor = req(edFile).default;
fs.rmSync(edFile, { force: true });
const React = req('react'); const { renderToString } = req('react-dom/server');

function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${col}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return { store, collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }), getAll: async (...r) => r.map(snap),
    async runTransaction(fn) { const w = []; const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, o) => w.push(['s', r, d, o]) };
      const out = await fn(tx); for (const [k, r, d, o] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (o?.merge ? { ...(store.get(r.path) || {}), ...d } : d)); return out; } };
}
const L = (en) => ({ en, ar: en });
const val = (id, en, priceDelta = 0) => ({ id, label: L(en), priceDelta });

// ----- the agreed "My PRs" blueprint -----
const sport = { id: 'sport', type: 'choice', label: L('Sport'), required: true, values: [val('run', 'Running'), val('cyc', 'Cycling'), val('swim', 'Swimming')] };
const setO = { id: 'set', type: 'choice', label: L('Set'), required: true, values: [val('std', 'Standard'), val('cus', 'Custom', 40)] };
const name = { id: 'name', type: 'text', label: L('Name on top'), required: false, maxLength: 15, values: [] };
const dist = { id: 'dist', type: 'text', label: L('Custom distances'), required: true, maxLength: 60, values: [], showWhen: { optionId: 'set', valueId: 'cus' } };
const xrun = { id: 'xrun', type: 'choice', label: L('Extra plate (running)'), required: false, showWhen: { optionId: 'sport', valueId: 'run' }, values: [val('r10', '10 km', 100), val('r21', 'Half marathon', 120)] };
const xcyc = { id: 'xcyc', type: 'choice', label: L('Extra plate (cycling)'), required: false, showWhen: { optionId: 'sport', valueId: 'cyc' }, values: [val('c20', '20 km', 90)] };
const xswim = { id: 'xswim', type: 'choice', label: L('Extra plate (swimming)'), required: true, showWhen: { optionId: 'sport', valueId: 'swim' }, values: [val('s100', '100 m', 80)] };
const prs = { tenantId: 'bynd', name: L('My PRs'), price: 500, stock: 0, isPreorder: true, isActive: true, deleted: false, options: [sport, setO, name, dist, xrun, xcyc, xswim] };
const world = (product = prs) => makeDb({ 'tenants/bynd': { slug: 'bynd', isActive: true }, 'products/prs': product,
  'productCosts/prs': { tenantId: 'bynd', costPrice: 200, optionCosts: { 'xrun.r10': 30, 'xcyc.c20': 25, 'set.cus': 10 } } });
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items) => validateInput({ tenantId: 'bynd', customer: cust, items });
const rejects = async (p, code) => { try { await p; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); return e; } };
const orderOf = (db, r) => db.store.get(`orders/${r.orderId}`);
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. the rule itself: server and browser agree on every combination
const sports = [undefined, 'run', 'cyc', 'swim', 'nonsense']; const sets = [undefined, 'std', 'cus'];
for (const sp of sports) for (const st of sets) for (const extra of [{}, { xrun: 'r10', xcyc: 'c20', dist: 'x', name: 'Ann' }]) {
  const sel = { ...(sp ? { sport: sp } : {}), ...(st ? { set: st } : {}), ...extra };
  assert.deepEqual(S.visibleOptions(prs, sel).map((o) => o.id), B.visibleOptions(prs, sel).map((o) => o.id));
  assert.deepEqual(S.stripHidden(prs, sel), B.stripHidden(prs, sel));
}
assert.deepEqual(S.visibleOptions(prs, {}).map((o) => o.id), ['sport', 'set', 'name']);
assert.deepEqual(S.visibleOptions(prs, { sport: 'run', set: 'cus' }).map((o) => o.id), ['sport', 'set', 'name', 'dist', 'xrun']);
ok('server and browser show exactly the same options for every combination (Running+Custom shows distances + the running plate only)');

// 2. a hidden option is never charged, never saved, never needed
let db = world();
let r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { sport: 'cyc', set: 'std', xrun: 'r10', xswim: 's100', dist: 'junk' } }]));
let line = orderOf(db, r).items[0];
assert.equal(line.unitPrice, 500); assert.equal(line.unitCost, 200);                  // nothing of the hidden extras counted
assert.deepEqual(line.options.map((o) => o.id), ['sport', 'set']);                    // ...and none saved on the order
ok('a hidden running plate / swimming plate / distances sent by a hacker change neither price, cost nor the saved order');

// 3. visible required options are still required; hidden required ones are not
await rejects(placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { sport: 'swim', set: 'std' } }])), 'BAD_OPTION');   // swimming plate is required when swimming
await rejects(placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { sport: 'run', set: 'cus' } }])), 'BAD_OPTION');    // custom distances required when Custom
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { sport: 'run', set: 'std' } }]));                         // no swimming plate asked for running
assert.equal(orderOf(db, r).items[0].unitPrice, 500);
ok('required stays required when the option is shown, and is not asked when hidden');

// 4. a real order: Running + Custom + a plate + name
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 2, selections: { sport: 'run', set: 'cus', dist: '5 km, 10 km, 21 km', xrun: 'r21', name: 'Ahmed' } }]));
line = orderOf(db, r).items[0];
assert.equal(line.unitPrice, 500 + 40 + 120); assert.equal(line.unitCost, 200 + 10);
assert.deepEqual(line.options.map((o) => o.id), ['sport', 'set', 'name', 'dist', 'xrun']);
assert.equal(line.options[3].value, '5 km, 10 km, 21 km');
ok('Running + Custom set + Half-marathon plate + name: price 660 each, cost 210, all five answers saved');

// 5. quote = order for the same cart
const cart = [{ productId: 'prs', quantity: 2, selections: { sport: 'cyc', set: 'cus', dist: 'a', xcyc: 'c20', xrun: 'r10' } }];
const q = await getQuote(db, { tenantId: 'bynd', items: mk(cart).items, zoneId: '', promoCode: '' });
r = await placeOrder(db, mk(cart));
assert.equal(q.subtotal, orderOf(db, r).subtotal); assert.equal(q.subtotal, 2 * (500 + 40 + 90));
ok('the price preview (/api/quote) and the real order agree, and both ignore the hidden running plate');

// 6. the condition can only follow an option ABOVE it, that is itself visible
const loop = { ...prs, options: [{ ...sport, showWhen: { optionId: 'set', valueId: 'cus' } }, setO] };     // sport waits for a LATER option
assert.deepEqual(S.visibleOptions(loop, { sport: 'run', set: 'cus' }).map((o) => o.id), ['set']);
const orphan = { ...prs, options: [sport, { ...xrun, showWhen: { optionId: 'ghost', valueId: 'run' } }] };
assert.deepEqual(S.visibleOptions(orphan, { sport: 'run' }).map((o) => o.id), ['sport']);
const chain = { ...prs, options: [sport, { ...setO, showWhen: { optionId: 'sport', valueId: 'run' } }, { ...dist }] };
assert.deepEqual(S.visibleOptions(chain, { sport: 'cyc', set: 'cus' }).map((o) => o.id), ['sport']);          // set hidden -> distances hidden too
assert.deepEqual(S.visibleOptions(chain, { sport: 'run', set: 'cus' }).map((o) => o.id), ['sport', 'set', 'dist']);
const deadValue = { ...prs, options: [sport, { ...xrun, showWhen: { optionId: 'sport', valueId: 'gone' } }] };
assert.deepEqual(S.visibleOptions(deadValue, { sport: 'gone' }).map((o) => o.id), ['sport']);
ok('a rule pointing at a later option, a missing option or a deleted value just hides the option; chains work (hidden controller hides the next)');

// 7. an option that counts stock is never hidden (defence on the server too)
const counted = { ...prs, isPreorder: false, stock: 5, countedOptions: ['xrun'], optionStock: { 'xrun.r10': 3, 'xrun.r21': 3 } };
assert.deepEqual(S.visibleOptions(counted, { sport: 'cyc' }).map((o) => o.id), ['sport', 'set', 'name', 'xrun', 'xcyc']);
ok('a stock-counted option is always shown even if an old rule is still stored on it');

// 8. form -> saved product: the rule is kept, and cleaned when it no longer makes sense
const toForm = (opts) => optionsToForm(opts);
let saved = formToOptions(toForm(prs.options));
assert.deepEqual(saved.map((o) => o.showWhen || null), prs.options.map((o) => o.showWhen || null));
assert.deepEqual(optionsToForm(saved).map((o) => [o.showWhenOption, o.showWhenValue]), prs.options.map((o) => [o.showWhen?.optionId || '', o.showWhen?.valueId || '']));
const form = toForm(prs.options);
let f = form.map((o) => (o.id === 'xrun' ? { ...o, showWhenValue: 'deleted-value' } : o)); // value no longer exists
assert.equal(formToOptions(f).find((o) => o.id === 'xrun').showWhen, undefined);
f = form.filter((o) => o.id !== 'sport');                                                  // controller removed
assert.equal(formToOptions(f).find((o) => o.id === 'xrun').showWhen, undefined);
f = [form[4], form[0], ...form.slice(1, 4)];                                               // controller moved BELOW the option
assert.equal(formToOptions(f).find((o) => o.id === 'xrun').showWhen, undefined);
f = form.map((o) => (o.id === 'sport' ? { ...o, type: 'text', values: [] } : o));          // controller is no longer a list
assert.equal(formToOptions(f).find((o) => o.id === 'xrun').showWhen, undefined);
f = form.map((o) => (o.id === 'xrun' ? { ...o, showWhenOption: 'sport', showWhenValue: '' } : o)); // half-filled rule
assert.equal(formToOptions(f).find((o) => o.id === 'xrun').showWhen, undefined);
assert.equal(newOption().showWhenOption, '');
ok('the form keeps a good rule (round trip) and drops a rule whose option / value is gone, moved below, not a list, or half-filled');

// 9. the saved product record (also used by the live preview)
const formData = (extra = {}) => ({ nameEn: 'My PRs', price: 500, isPreorder: true, options: toForm(prs.options), ...extra });
let rec = productFields(formData());
assert.deepEqual(rec.options.find((o) => o.id === 'dist').showWhen, { optionId: 'set', valueId: 'cus' });
rec = productFields(formData({ isPreorder: false, countedOptions: ['xrun'] }));
assert.equal(rec.options.find((o) => o.id === 'xrun').showWhen, undefined); assert.equal(rec.options.find((o) => o.id === 'xrun').required, true);
assert.deepEqual(rec.options.find((o) => o.id === 'xcyc').showWhen, { optionId: 'sport', valueId: 'cyc' });
const pv = applyProductDraft(null, productFields(formData()), 'bynd');
assert.deepEqual(B.visibleOptions(pv, { sport: 'swim' }).map((o) => o.id), ['sport', 'set', 'name', 'xswim']);
ok('Save keeps the rule, drops it from a stock-counted option, and the preview product follows it');

// 10. up to 10 options (was 6); the answers limit is 20 keys
assert.equal(S.MAX_OPTIONS, 10); assert.equal(B.MAX_OPTIONS, 10);
const ten = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, type: 'text', label: L('T' + i), required: false, maxLength: 20, values: [] }));
assert.equal(formToOptions(optionsToForm(ten)).length, 10);
const bigProduct = { ...prs, options: ten.slice(0, 10) };
db = world(bigProduct);
const sel = Object.fromEntries(ten.slice(0, 10).map((o, i) => [o.id, 'v' + i]));
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: sel }]));
assert.equal(orderOf(db, r).items[0].options.length, 10);
assert.equal(Object.keys(S.cleanSelections(Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['k' + i, 'x'])))).length, 20);
ok('10 options per product work end to end (11th and 12th are dropped); the server reads up to 20 answers (10 options + typed texts)');

// 11. old products without any rule behave exactly as before
const plain = { ...prs, options: [sport, setO, name] };
db = world(plain);
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { sport: 'run', set: 'cus', name: 'Z' } }]));
assert.equal(orderOf(db, r).items[0].unitPrice, 540);
assert.deepEqual(S.visibleOptions(plain, {}).map((o) => o.id), ['sport', 'set', 'name']);
ok('products without a rule are unchanged');

// 12. the quantity-price group follows only visible answers
const grp = { ...prs, options: [sport, xrun, xcyc], priceTiers: [{ minQty: 2, price: 400 }], tierGroupOption: 'xrun' };
db = world(grp);
r = await placeOrder(db, mk([{ productId: 'prs', quantity: 1, selections: { sport: 'cyc', xrun: 'r10' } }, { productId: 'prs', quantity: 1, selections: { sport: 'cyc', xrun: 'r21' } }]));
assert.deepEqual(orderOf(db, r).items.map((l) => l.unitPrice), [400, 400]);   // the hidden group answers are ignored: both pieces are in ONE group
ok('hidden answers cannot split or mix the quantity-price groups');

// 13. the admin option editor: the "show only when" block appears only where it can work
const formOpts = optionsToForm(prs.options);
const edit = (opts, countedIds = []) => renderToString(React.createElement(OptionsEditor, { options: opts, onChange() {}, countedIds }));
let html = edit(formOpts);
assert.equal((html.match(/options\.showWhenTitle/g) || []).length, 6);                  // every option except the first can have a rule
assert.ok(!html.includes('options.showWhenCounted'));
assert.match(html, /options\.showWhenValue/);                                            // options that already have a rule show the value box
html = edit(formOpts, ['xrun']);
assert.equal((html.match(/options\.showWhenTitle/g) || []).length, 5); assert.match(html, /options\.showWhenCounted/);   // a counted option shows the note instead
html = edit([formOpts[2], formOpts[3]]);                                                 // no colour/choice list above: nothing to offer
assert.ok(!html.includes('options.showWhenTitle'));
const tenOpts = optionsToForm(ten.slice(0, 10)); assert.ok(!edit(tenOpts).includes('options.add'));       // the "+ Add option" button is gone at 10
assert.ok(edit(tenOpts.slice(0, 9)).includes('options.add'));
ok('admin editor renders: the rule box shows only where a list sits above, counted options get a note, the add button stops at 10');

console.log(`\nALL ${n} OPTION-CONDITION CHECK GROUPS PASSED`);
