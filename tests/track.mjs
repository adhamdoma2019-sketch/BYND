// "Track my order" (update 17): who may see what, and the guessing limits.
import assert from 'node:assert/strict';
import { trackOrder, parseOrderNumber, publicTimeline } from '../api/_lib/track.js';
import { LIMITS } from '../api/_lib/rateLimit.js';

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// a tiny pretend Firestore: orders (equality filters) + the rateLimits counters
function makeDb(orders, { broken = false } = {}) {
  const limits = new Map();
  return {
    limits,
    collection(name) {
      if (name === 'orders') {
        const filters = [];
        const q = {
          where(field, _op, value) { filters.push([field, value]); return q; },
          limit() { return q; },
          async get() {
            const docs = orders.filter((o) => filters.every(([f, v]) => o[f] === v)).slice(0, 1)
              .map((o) => ({ data: () => structuredClone(o) }));
            return { empty: docs.length === 0, docs };
          },
        };
        return q;
      }
      return { doc: (id) => ({ id, get: async () => { if (broken) throw new Error('down'); return { exists: limits.has(id), data: () => structuredClone(limits.get(id)) }; } }) };
    },
    async runTransaction(fn) {
      if (broken) throw new Error('down');
      return fn({
        getAll: async (r) => [{ exists: limits.has(r.id), data: () => structuredClone(limits.get(r.id)) }],
        set: (r, d) => limits.set(r.id, d),
        update: (r, d) => limits.set(r.id, { ...limits.get(r.id), ...d }),
      });
    },
  };
}

const secretOrder = {
  tenantId: 'bynd', orderNumber: 1001, orderNumberLabel: 'BYND-1001', orderType: 'normal', deleted: false,
  customer: { name: 'Mona Secret', phone: '010 1234 5678', address: 'Secret street 5' }, // old order: phone as typed
  items: [{ name: { en: 'Hidden item' }, unitPrice: 999 }], totalAmount: 999, status: 'shipped',
  statusHistory: [
    { status: 'pending', timestamp: '2026-10-20T10:00:00.000Z', updatedBy: 'customer' },
    { status: 'confirmed', timestamp: '2026-10-20T12:00:00.000Z', updatedBy: 'owner-uid-123' },
    { status: 'shipped', timestamp: '2026-10-21T09:30:00.000Z', updatedBy: 'staff-uid-456' },
  ],
};
const orders = [secretOrder, { ...secretOrder, tenantId: 'other', orderNumber: 1001, orderNumberLabel: 'OTH-1001' },
  { ...secretOrder, orderNumber: 1002, orderNumberLabel: 'BYND-1002', deleted: true }];
const wrong = (e) => e.code === 'TRACK_NOT_FOUND' && e.status === 404;

// ---- order numbers
assert.equal(parseOrderNumber('BYND-1001'), 1001); assert.equal(parseOrderNumber(' bynd 1001 '), 1001);
assert.equal(parseOrderNumber('#1001'), 1001); assert.equal(parseOrderNumber('١٠٠١'), 1001); assert.equal(parseOrderNumber('1001'), 1001);
for (const bad of ['', 'abc', '0', null, undefined, '12345678901234']) assert.equal(parseOrderNumber(bad), 0, String(bad));
ok('order numbers can be typed as BYND-1001, 1001, #1001 or in Arabic digits');

// ---- the right details work, whichever way the phone is written
const db = makeDb(orders);
for (const phone of ['01012345678', '+20 10 1234 5678', '010 1234 5678', '٠١٠١٢٣٤٥٦٧٨', '201012345678']) {
  const r = await trackOrder(db, { tenantId: 'bynd', orderNumber: 'BYND-1001', phone });
  assert.equal(r.status, 'shipped'); assert.equal(r.orderNumberLabel, 'BYND-1001'); assert.equal(r.history.length, 3);
}
ok('the right order number + phone shows the order (old orders saved with spaces are found too)');

// ---- only status + dates leave the server
const r = await trackOrder(db, { tenantId: 'bynd', orderNumber: '1001', phone: '01012345678' });
const text = JSON.stringify(r);
for (const secret of ['Mona', 'Secret', 'street', 'Hidden item', '999', 'owner-uid', 'staff-uid', '1234 5678', 'customer'])
  assert.ok(!text.includes(secret), `leaked: ${secret}`);
assert.deepEqual(Object.keys(r).sort(), ['history', 'orderNumberLabel', 'orderType', 'status']);
assert.deepEqual(Object.keys(r.history[0]).sort(), ['status', 'timestamp']);
ok('only the status, order type and dates are returned: no name, address, items, prices or staff ids');

const messy = publicTimeline({ status: 'weird', statusHistory: [{ status: 'pending', timestamp: 5 }, { status: 'nope', timestamp: 'x' }, null, { status: 'delivered', timestamp: '2026-01-01T00:00:00Z' }] });
assert.equal(messy.status, 'pending'); assert.deepEqual(messy.history, [{ status: 'delivered', timestamp: '2026-01-01T00:00:00Z' }]);
ok('damaged or unknown history lines are ignored instead of breaking the page');

// ---- every mismatch gives the SAME answer
const attempts = [
  { tenantId: 'bynd', orderNumber: '1001', phone: '01099999999' }, // wrong phone
  { tenantId: 'bynd', orderNumber: '4040', phone: '01012345678' }, // no such order
  { tenantId: 'bynd', orderNumber: '1002', phone: '01012345678' }, // deleted order
  { tenantId: 'nobody', orderNumber: '1001', phone: '01012345678' }, // other / unknown shop
  { tenantId: 'bynd', orderNumber: '1001', phone: '' },
  { tenantId: 'bynd', orderNumber: '', phone: '01012345678' },
  { tenantId: 'bynd', orderNumber: '1001', phone: '12345' },
  { tenantId: undefined, orderNumber: '1001', phone: '01012345678' },
  { tenantId: { $ne: '' }, orderNumber: '1001', phone: '01012345678' },
];
for (const a of attempts) await assert.rejects(() => trackOrder(makeDb(orders), a), wrong, JSON.stringify(a));
ok('wrong phone, unknown number, deleted order, other shop and broken input all give the identical "not found"');

const otherShop = await trackOrder(makeDb(orders), { tenantId: 'other', orderNumber: '1001', phone: '01012345678' });
assert.equal(otherShop.orderNumberLabel, 'OTH-1001');
ok('order numbers are looked up inside the shop only');

// ---- guessing limits
const guessDb = makeDb(orders);
for (let i = 0; i < LIMITS.trackOrder.limit; i++)
  await assert.rejects(() => trackOrder(guessDb, { tenantId: 'bynd', orderNumber: '1001', phone: `0101111000${i}` }), wrong);
await assert.rejects(
  () => trackOrder(guessDb, { tenantId: 'bynd', orderNumber: '1001', phone: '01012345678' }),
  (e) => e.code === 'RATE_LIMITED' && e.status === 429,
);
ok(`after ${LIMITS.trackOrder.limit} wrong tries on one order number, even more guesses are refused`);

const other = await trackOrder(guessDb, { tenantId: 'bynd', orderNumber: '1002x', phone: '1' }).catch((e) => e.code);
assert.equal(other, 'TRACK_NOT_FOUND');
const fine = makeDb(orders);
for (let i = 0; i < 3; i++) await trackOrder(fine, { tenantId: 'bynd', orderNumber: '1001', phone: '01012345678' });
assert.equal(fine.limits.size, 0);
ok('correct lookups never use up the guess limit');

assert.equal((await trackOrder(makeDb(orders, { broken: true }), { tenantId: 'bynd', orderNumber: '1001', phone: '01012345678' })).status, 'shipped');
ok('if the counters are unreachable, real customers can still track (protection fails open)');

assert.ok(LIMITS.trackIp.limit >= 10 && LIMITS.trackOrder.limit <= 20);
ok('limits are sensible (generous per connection, strict per order number)');

console.log(`\nALL ${n} ORDER-TRACKING CHECK GROUPS PASSED`);
