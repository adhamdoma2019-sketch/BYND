import assert from 'node:assert/strict';
import { hashKey, clientIp, hasRoom, countUse, phoneDigits, LIMITS } from '../api/_lib/rateLimit.js';

// a tiny fake Firestore with just what the counters use
function makeDb({ broken = false } = {}) {
  const store = new Map();
  const ref = (id) => ({ id });
  return {
    store,
    collection: () => ({
      doc: (id) => ({
        id,
        get: async () => { if (broken) throw new Error('down'); return { exists: store.has(id), data: () => structuredClone(store.get(id)) }; },
      }),
    }),
    async runTransaction(fn) {
      if (broken) throw new Error('down');
      const tx = {
        getAll: async (r) => [{ exists: store.has(r.id), data: () => structuredClone(store.get(r.id)) }],
        set: (r, d) => store.set(r.id, d),
        update: (r, d) => store.set(r.id, { ...store.get(r.id), ...d }),
      };
      return fn(tx);
    },
  };
}
let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const HOUR = 60 * 60 * 1000; const t0 = 1_000_000;
const rule = { limit: 3, windowMs: HOUR };

const db = makeDb();
assert.equal(await hasRoom(db, 'k', rule, t0), true);
for (let i = 0; i < 3; i++) { assert.equal(await hasRoom(db, 'k', rule, t0 + i), true); await countUse(db, 'k', rule, t0 + i); }
assert.equal(await hasRoom(db, 'k', rule, t0 + 10), false);
assert.equal(db.store.get('k').count, 3); assert.ok(db.store.get('k').expireAt instanceof Date);
ok('counts uses and blocks after the limit; counters get an expiry date for automatic clean-up');

assert.equal(await hasRoom(db, 'k', rule, t0 + HOUR + 1), true);
await countUse(db, 'k', rule, t0 + HOUR + 1);
assert.equal(db.store.get('k').count, 1);
ok('a new time window starts again from zero');

const other = makeDb(); await countUse(other, 'a', rule, t0); await countUse(other, 'a', rule, t0); await countUse(other, 'a', rule, t0);
assert.equal(await hasRoom(other, 'a', rule, t0), false); assert.equal(await hasRoom(other, 'b', rule, t0), true);
ok('each key (phone / connection) has its own counter');

const broken = makeDb({ broken: true });
assert.equal(await hasRoom(broken, 'k', rule, t0), true); await countUse(broken, 'k', rule, t0);
ok('if the counters are unreachable, nobody is blocked (fails open) and nothing crashes');

const key = hashKey('01026409664');
assert.ok(/^[0-9a-f]{32}$/.test(key) && !key.includes('0102') && hashKey('01026409664') === key && hashKey('01026409665') !== key);
ok('keys are hashed: no phone number or address stored in readable form');

assert.equal(clientIp({ headers: { 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' } }), '1.2.3.4');
assert.equal(clientIp({ headers: { 'x-forwarded-for': '5.6.7.8, 10.0.0.1' } }), '5.6.7.8');
assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '::1' } }), '::1'); assert.equal(clientIp({ headers: {} }), 'unknown');
assert.equal(phoneDigits('+20 102 640 9664'), '201026409664'); assert.equal(phoneDigits('0102-640-9664'), '01026409664'); assert.equal(phoneDigits(''), '');
ok('connection address and phone number read correctly in common formats');

assert.ok(LIMITS.orderPhone.limit <= 10 && LIMITS.orderIp.limit >= LIMITS.orderPhone.limit && LIMITS.promoIp.limit >= 20);
ok('limits are sensible: strict per phone, generous per connection (shared mobile networks)');
console.log(`\nALL ${n} SPAM-PROTECTION CHECK GROUPS PASSED`);
