// Update 37: admin pages never wait for ever, and staff are limited by the database rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ---- 1. the shared "could not load + Try again" box ----
const tmp = fs.mkdtempSync(path.join(root, 'tests', '.tmp-'));
const stubs = { 'react-i18next': `export const useTranslation=()=>({t:(k)=>k});` };
const stubPlugin = { name: 'stubs', setup(b) {
  b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], resolveDir: root }));
} };
const out1 = path.join(tmp, 'le.cjs');
await build({ entryPoints: [path.join(root, 'src/components/admin/LoadError.jsx')], bundle: true, platform: 'node', format: 'cjs', outfile: out1,
  jsx: 'automatic', loader: { '.jsx': 'jsx' }, external: ['react', 'react/jsx-runtime'], plugins: [stubPlugin], logLevel: 'error' });
const LoadError = req(out1).default;
const plain = renderToStaticMarkup(React.createElement(LoadError, { onRetry() {} }));
assert.match(plain, /role="alert"/); assert.match(plain, /common\.loadError/); assert.match(plain, /<button[^>]*>common\.retry<\/button>/);
const custom = renderToStaticMarkup(React.createElement(LoadError, { message: 'MSG', retryLabel: 'AGAIN', onRetry() {} }));
assert.ok(custom.includes('MSG') && custom.includes('AGAIN') && !custom.includes('common.loadError'));
assert.ok(!renderToStaticMarkup(React.createElement(LoadError, { message: 'x' })).includes('<button'), 'no button when there is nothing to retry');
ok('LoadError shows the general or a specific sentence and a Try again button');

// ---- 2. no admin page can wait for ever on a failed read ----
const pagesDir = path.join(root, 'src/pages/admin');
const needs = [];
for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith('.jsx'))) {
  const src = fs.readFileSync(path.join(pagesDir, f), 'utf8');
  const readsData = /\b(listOrders|listProducts|listExpenses|listPromoCodes|listAudit|listMovements|listCouriers|listTeam|getTenantPrivate)\s*\(/.test(src);
  if (!readsData) continue;
  needs.push(f);
  assert.ok(src.includes("components/admin/LoadError"), f + ' reads data but has no LoadError');
  assert.ok(/<LoadError\b/.test(src), f + ' imports LoadError but never shows it');
  assert.ok(/onRetry=/.test(src), f + ' shows no Try again');
  assert.ok(/catch/.test(src), f + ' has no catch around its reads');
}
assert.deepEqual(needs.sort(), ['Activity.jsx', 'Couriers.jsx', 'Expenses.jsx', 'Orders.jsx', 'PnL.jsx', 'Products.jsx', 'PromoCodes.jsx', 'Settings.jsx', 'StockHistory.jsx', 'Team.jsx']);
const stats = read('src/components/admin/DashboardStats.jsx');
assert.ok(/<LoadError\b/.test(stats) && /setFailed\(true\)/.test(stats), 'dashboard numbers: a failed read shows an error, never zeros');
assert.ok(!/setData\(\{ orders: \[\]/.test(stats.split('catch')[1] || ''), 'the dashboard no longer invents empty data when the read fails');
ok('every admin page that reads data shows LoadError with Try again (10 pages + the dashboard numbers)');

// ---- 3. the shop / user record: a failed read ends the waiting ----
const ctx = read('src/context/TenantContext.jsx');
assert.ok(/catch\s*{[\s\S]*setLoadFailed\(true\)[\s\S]*setLoading\(false\)/.test(ctx), 'TenantContext ends loading when a read fails');
assert.ok(/loadFailed,/.test(ctx), 'TenantContext shares loadFailed');
const guard = read('src/routes/ProtectedRoute.jsx');
assert.ok(guard.includes('<LoadError onRetry={reloadTenant}') && guard.includes("t('admin.shopMissing')"));
assert.ok(guard.indexOf('<Navigate') < guard.indexOf('loadFailed)'), 'a signed-out person is still sent to the login first');
ok('a failed shop/user read shows Try again; a missing shop record says so instead of waiting');

// ---- 4. Settings never wipes the Telegram setup after a failed read ----
const settings = read('src/pages/admin/Settings.jsx');
assert.ok(settings.includes('if (alertsLoaded || alertsTouched)') && /saveTenantPrivate\(tenant\.id/.test(settings));
assert.ok(settings.includes('privateLoadFailed') && !/setTelegramChatId\(e\.target/.test(settings));
ok('Settings saves the alert settings only when they were loaded (or typed on purpose)');

// ---- 5. staff: the rule text ----
const rules = read('firestore.rules');
const ordersBlock = rules.slice(rules.indexOf('match /orders/{orderId}'), rules.indexOf('match /expenses/{expenseId}'));
assert.ok(ordersBlock.includes('canManage(resource.data.tenantId)') && ordersBlock.includes('staffMayUpdateOrder(resource.data.tenantId)'));
assert.ok(!/belongsTo\(resource\.data\.tenantId\)\s*&&\s*request\.resource\.data\.diff/.test(ordersBlock), 'the old "staff may write any status" clause is gone');
const fn = rules.slice(rules.indexOf('function staffMayUpdateOrder'), rules.indexOf('// ---------- Shops'));
for (const piece of [
  "hasOnly(['status', 'statusHistory', 'updatedAt', 'customer'])",
  "hasOnly(['name', 'phone', 'address', 'notes'])",
  'nextOrderStatus(before.status)',
  'oldHistory.size() + 1',
  'after.status == before.status',
]) assert.ok(fn.includes(piece), 'rule keeps: ' + piece);
const flow = rules.slice(rules.indexOf('function nextOrderStatus'), rules.indexOf('function staffMayUpdateOrder'));
const pairs = [...flow.matchAll(/status == '(\w+)' \? '(\w+)'/g), ...flow.matchAll(/: status == '(\w+)' \? '(\w+)'/g)];
const map = Object.fromEntries(pairs.map((m) => [m[1], m[2]]));
assert.deepEqual(map, { pending: 'confirmed', confirmed: 'processing', processing: 'shipped', shipped: 'delivered' });
assert.ok(!/'(cancelled|returned)'/.test(flow.replace(/\/\/.*$/gm, '')), 'cancelled / returned are never a next step');
// the rule's chain must be the same as the shop's own status flow
const { STATUS_FLOW, nextStatus } = await import('../src/utils/orderRules.js');
for (const s of STATUS_FLOW) assert.equal(map[s] || null, nextStatus(s), 'rule and screen agree on the step after ' + s);
assert.equal(nextStatus('cancelled'), null); assert.equal(nextStatus('returned'), null);
ok('the staff rule allows one step forward, names exactly the keys the screens write, and matches the shop status flow');

// ---- 6. what the screens really write (the keys the rule must accept) ----
const out2 = path.join(tmp, 'svc.cjs');
await build({ stdin: { contents: `export { updateOrderStatus, updateOrderCustomer } from ${JSON.stringify(root + '/src/firebase/orders.service.js')};`, resolveDir: root, loader: 'js' },
  bundle: true, platform: 'node', format: 'cjs', outfile: out2, logLevel: 'error',
  plugins: [{ name: 'fb', setup(b) {
    b.onResolve({ filter: /^firebase\/firestore$/ }, (a) => ({ path: a.path, namespace: 'fb' }));
    b.onResolve({ filter: /\/config$/ }, (a) => ({ path: 'config', namespace: 'fb' }));
    b.onLoad({ filter: /.*/, namespace: 'fb' }, (a) => ({ resolveDir: root, contents: a.path === 'config'
      ? 'export const db = {}; export const auth = {};'
      : `export const doc=(...a)=>({path:a.slice(1).join('/')}); export const collection=()=>({}); export const query=()=>({}); export const where=()=>({});
         export const getDocs=async()=>({docs:[]}); export const runTransaction=async()=>{}; export const serverTimestamp=()=>({__ts:true});
         export const arrayUnion=(...v)=>({__union:v}); export const updateDoc=async(ref,data)=>{ (globalThis.__writes ||= []).push({ref,data}); };` }));
  } }] });
const svc = req(out2);
globalThis.__writes = [];
await svc.updateOrderStatus('o1', 'confirmed');
const w1 = globalThis.__writes.pop().data;
assert.deepEqual(Object.keys(w1).sort(), ['status', 'statusHistory', 'updatedAt']);
assert.equal(w1.status, 'confirmed');
assert.equal(w1.statusHistory.__union.length, 1, 'exactly one history line is added');
assert.equal(w1.statusHistory.__union[0].status, 'confirmed', 'and it names the new status');
await svc.updateOrderCustomer('o1', { name: 'A', phone: '1', address: 'x', notes: '' });
const w2 = globalThis.__writes.pop().data;
const custKeys = Object.keys(w2).filter((k) => k.startsWith('customer.')).map((k) => k.slice(9)).sort();
assert.deepEqual(custKeys, ['address', 'name', 'notes', 'phone']);
assert.deepEqual(Object.keys(w2).filter((k) => !k.startsWith('customer.')), ['updatedAt']);
ok('moving an order writes status + one history line + updatedAt; editing a customer writes only name / phone / address / notes');

// ---- 7. the Orders screen: moving an order on can fail without freezing it ----
const orders = read('src/pages/admin/Orders.jsx');
const advance = orders.slice(orders.indexOf('async function handleAdvance'), orders.indexOf('// Returned parcels'));
assert.ok(/try\s*{[\s\S]*updateOrderStatus[\s\S]*}\s*catch/.test(advance) && advance.includes("t('orders.advanceFailed')") && advance.includes('await refresh()'));
assert.ok(advance.includes('nextStatus(order.status)'), 'the screen only ever offers the next step');
ok('a refused / failed status change shows a message, refreshes the list and releases the button');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`ALL ${n} ADMIN-LOAD-AND-STAFF CHECK GROUPS PASSED`);
