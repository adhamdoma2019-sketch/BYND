// Tests the real cancel / return code (src/firebase/orders.service.js) against a small
// pretend Firestore. The pretend database behaves like the real one in the way that
// matters here: inside a transaction, every read must happen BEFORE the first write.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const FAKE_FIRESTORE = `
  const store = () => globalThis.__store;
  export const doc = (_db, col, id) => ({ path: col + '/' + id });
  export const serverTimestamp = () => ({ __ts: true });
  export const arrayUnion = (...items) => ({ __union: items });
  export const collection = () => ({}); export const query = () => ({}); export const where = () => ({});
  export const getDocs = async () => ({ docs: [] }); export const updateDoc = async () => {};
  export async function runTransaction(_db, fn) {
    const writes = []; let wrote = false;
    const tx = {
      async get(ref) {
        if (wrote) throw new Error('Firestore rule broken: a read came after a write');
        const has = store().has(ref.path);
        return { exists: () => has, data: () => structuredClone(store().get(ref.path)) };
      },
      update(ref, patch) { wrote = true; writes.push([ref, patch]); },
    };
    const out = await fn(tx);
    for (const [ref, patch] of writes) {
      const cur = store().get(ref.path) || {}; const next = { ...cur };
      for (const [k, v] of Object.entries(patch)) next[k] = v && v.__union ? [...(cur[k] || []), ...v.__union] : v;
      store().set(ref.path, next);
    }
    return out;
  }`;

const out = path.join(os.tmpdir(), `orders-service-${process.pid}.mjs`);
await build({
  entryPoints: [path.join(root, 'src/firebase/orders.service.js')],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  plugins: [{
    name: 'fake-firebase',
    setup(b) {
      b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'fake-firestore', namespace: 'fake' }));
      b.onResolve({ filter: /\/config$/ }, () => ({ path: 'fake-config', namespace: 'fake' }));
      b.onLoad({ filter: /fake-firestore/, namespace: 'fake' }, () => ({ contents: FAKE_FIRESTORE, loader: 'js' }));
      b.onLoad({ filter: /fake-config/, namespace: 'fake' }, () => ({ contents: 'export const db = {};', loader: 'js' }));
    },
  }],
});
const { cancelOrder, returnOrder } = await import(pathToFileURL(out).href);
fs.rmSync(out, { force: true });

let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const fresh = () => {
  globalThis.__store = new Map([
    ['products/board', { stock: 1 }], ['products/plate', { stock: 10 }], ['products/pre', { stock: 0 }],
    ['orders/o1', { status: 'pending', items: [
      { productId: 'board', quantity: 2 }, { productId: 'board', quantity: 3 },      // same product, two colors
      { productId: 'plate', quantity: 1 }, { productId: 'pre', quantity: 5, isPreorder: true } ], statusHistory: [] }],
    ['orders/shipped', { status: 'shipped', items: [{ productId: 'plate', quantity: 4 }], statusHistory: [] }],
    ['orders/done', { status: 'delivered', items: [{ productId: 'plate', quantity: 2 }], statusHistory: [] }],
  ]);
  return globalThis.__store;
};
const rejects = async (p, code) => { try { await p; assert.fail('should reject ' + code); } catch (e) { assert.equal(e.code, code, e.message); } };

let s = fresh();
await cancelOrder('o1');
assert.equal(s.get('orders/o1').status, 'cancelled');
assert.equal(s.get('products/board').stock, 1 + 5);      // BOTH lines come back (2 + 3), not just one of them
assert.equal(s.get('products/plate').stock, 11); assert.equal(s.get('products/pre').stock, 0);
assert.equal(s.get('orders/o1').statusHistory.at(-1).status, 'cancelled');
ok('cancel: the same product on two lines is put back in full (1 + 2 + 3 = 6); preorder lines untouched');

await rejects(cancelOrder('o1'), 'ALREADY_CANCELLED'); await rejects(cancelOrder('done'), 'ALREADY_DELIVERED'); await rejects(cancelOrder('nope'), 'NOT_FOUND');
assert.equal(s.get('products/board').stock, 6);
ok('cancel again / delivered / missing order refused, stock unchanged');

s = fresh();
await returnOrder('shipped', { restock: true });
assert.equal(s.get('orders/shipped').status, 'returned'); assert.equal(s.get('products/plate').stock, 14);
assert.equal(s.get('orders/shipped').statusHistory.at(-1).restocked, true);
ok('return a shipped parcel, put items back: stock +4, history remembers "restocked"');

s = fresh();
await returnOrder('done', { restock: false });
assert.equal(s.get('orders/done').status, 'returned'); assert.equal(s.get('products/plate').stock, 10);
assert.equal(s.get('orders/done').statusHistory.at(-1).restocked, false);
ok('return a delivered order as damaged: stock unchanged, status returned');

await rejects(returnOrder('done', { restock: true }), 'ALREADY_RETURNED');
assert.equal(s.get('products/plate').stock, 10);
await rejects(returnOrder('o1', { restock: true }), 'NOT_RETURNABLE');
await rejects(returnOrder('nope', { restock: true }), 'NOT_FOUND');
await rejects(cancelOrder('done'), 'ALREADY_RETURNED');
ok('no double return, no return before shipping, no cancel after a return (stock can never be added twice)');
console.log(`\nALL ${n} ORDER-TRANSACTION CHECK GROUPS PASSED`);
