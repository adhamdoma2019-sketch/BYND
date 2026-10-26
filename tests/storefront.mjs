import assert from 'node:assert/strict';
import { placeOrder, validateInput, OrderError } from '../api/_lib/placeOrder.js';
import { getQuote } from '../api/_lib/quote.js';
import {
  pickLogo,
  announcementMessages,
  highlightsOf,
  policyBody,
  availablePolicyPages,
  productStatus,
  isBuyable,
  tracksStock,
  MAX_ANNOUNCEMENTS,
  MAX_HIGHLIGHTS,
  MAX_PAGE_CHARS,
} from '../src/utils/storefront.js';

let n = 0;
const ok = (label) => console.log('  ok', ++n, label);

// ===== 1. Logo for light / dark =====
assert.equal(pickLogo({ logoUrl: 'https://a/main.png', logoDarkUrl: 'https://a/dark.png' }, 'dark'), 'https://a/dark.png');
assert.equal(pickLogo({ logoUrl: 'https://a/main.png', logoDarkUrl: 'https://a/dark.png' }, 'light'), 'https://a/main.png');
assert.equal(pickLogo({ logoUrl: 'https://a/main.png' }, 'dark'), 'https://a/main.png'); // no dark logo: main is used
assert.equal(pickLogo({ logoDarkUrl: 'https://a/dark.png' }, 'light'), 'https://a/dark.png'); // only a dark logo: still shown
assert.equal(pickLogo({}, 'dark'), '');
assert.equal(pickLogo(undefined, 'light'), '');
ok('logo: dark logo on dark screens, main logo otherwise, always falls back');

// ===== 2. Top bar messages =====
const bar = (extra = {}) => ({ announcement: { enabled: true, text: { en: 'Free delivery', ar: 'توصيل مجاني' }, link: '#products', ...extra } });
assert.deepEqual(announcementMessages(bar(), 'en'), [{ text: 'Free delivery', link: '#products' }]);
assert.deepEqual(announcementMessages(bar(), 'ar'), [{ text: 'توصيل مجاني', link: '#products' }]);
assert.deepEqual(announcementMessages({ announcement: { enabled: false, text: { en: 'x' } } }, 'en'), []);
assert.deepEqual(announcementMessages(undefined, 'en'), []);
assert.deepEqual(announcementMessages({}, 'en'), []);
ok('top bar: the original single message still works, off = nothing');

const more = [
  { text: { en: 'Second' }, link: '' },
  { text: { en: '' }, link: '' }, // empty message is skipped
  { text: { en: 'Third', ar: 'الثالثة' } },
  { text: { en: 'Fourth' } },
  { text: { en: 'Fifth (too many)' } },
];
const list = announcementMessages(bar({ more }), 'en');
assert.deepEqual(list.map((m) => m.text), ['Free delivery', 'Second', 'Third', 'Fourth']);
assert.ok(list.length <= MAX_ANNOUNCEMENTS);
assert.equal(announcementMessages(bar({ more }), 'ar')[2].text, 'الثالثة');
assert.equal(announcementMessages(bar({ more: 'not a list' }), 'en').length, 1);
ok('top bar: several messages, empty ones skipped, never more than 4');

// ===== 3. Highlights =====
const tenant = {
  highlights: [
    { title: { en: 'Quality', ar: 'جودة' }, text: { en: 'Made with care', ar: 'مصنوع بعناية' } },
    { title: { en: '' }, text: { en: 'no title = skipped' } },
    { title: { en: 'Returns' } },
    { title: { en: 'Support' } },
    { title: { en: 'Fast' } },
    { title: { en: 'Too many' } },
  ],
};
const h = highlightsOf(tenant, 'en');
assert.deepEqual(h[0], { title: 'Quality', text: 'Made with care' });
assert.deepEqual(h[1], { title: 'Returns', text: '' });
assert.ok(h.length <= MAX_HIGHLIGHTS);
assert.equal(highlightsOf(tenant, 'ar')[0].title, 'جودة');
assert.deepEqual(highlightsOf({}, 'en'), []);
assert.deepEqual(highlightsOf({ highlights: 'oops' }, 'en'), []);
ok('highlights: only what the shop wrote, skips empty titles, max 4');

// ===== 4. Policy pages =====
const pages = {
  pages: {
    privacy: { body: { en: 'We keep your details safe.', ar: 'نحافظ على بياناتك.' } },
    returns: { body: { en: '   ' } },
    shipping: { body: { en: 'x'.repeat(MAX_PAGE_CHARS + 500) } },
  },
};
assert.equal(policyBody(pages, 'privacy', 'en'), 'We keep your details safe.');
assert.equal(policyBody(pages, 'privacy', 'ar'), 'نحافظ على بياناتك.');
assert.equal(policyBody(pages, 'returns', 'en'), '');
assert.equal(policyBody(pages, 'shipping', 'en').length, MAX_PAGE_CHARS);
assert.equal(policyBody(pages, '__proto__', 'en'), '');
assert.equal(policyBody(pages, 'secret', 'en'), ''); // only the four known pages exist
assert.deepEqual(availablePolicyPages(pages, 'en'), ['privacy', 'shipping']);
assert.deepEqual(availablePolicyPages({}, 'en'), []);
ok('policy pages: a page exists only when it has text; unknown names and huge texts are limited');

// ===== 5. Product status =====
assert.equal(productStatus({ stock: 5 }), 'inStock');
assert.equal(productStatus({ stock: 0 }), 'soldOut');
assert.equal(productStatus({}), 'soldOut');
assert.equal(productStatus({ isPreorder: true, stock: 0 }), 'preorder');
assert.equal(productStatus({ isPreorder: true, preorderStyle: 'madeToOrder' }), 'madeToOrder');
assert.equal(productStatus({ isPreorder: true, preorderStyle: 'anything else' }), 'preorder');
assert.equal(productStatus({ comingSoon: true, stock: 9 }), 'comingSoon');
assert.equal(productStatus({ comingSoon: true, isPreorder: true }), 'comingSoon'); // coming soon wins
assert.equal(isBuyable('inStock'), true);
assert.equal(isBuyable('preorder'), true);
assert.equal(isBuyable('madeToOrder'), true);
assert.equal(isBuyable('soldOut'), false);
assert.equal(isBuyable('comingSoon'), false);
ok('product status: coming soon / pre-order / made to order / sold out / in stock');

assert.equal(tracksStock({ stock: 0 }), true);
assert.equal(tracksStock({ isPreorder: true }), false);
assert.equal(tracksStock({ comingSoon: true, stock: 0 }), false);
ok('stock reports ignore preorder and coming-soon products');

// ===== 6. The SERVER refuses coming-soon products (the browser can't be trusted) =====
function makeDb(initial) {
  const store = new Map(Object.entries(initial)); let auto = 0;
  const ref = (col, id) => ({ col, id, path: `${col}/${id}`, collection: (sub) => ({ doc: (sid) => ref(`${col}/${id}/${sub}`, sid ?? `auto${++auto}`) }) });
  const snap = (r) => ({ exists: store.has(r.path), data: () => structuredClone(store.get(r.path)) });
  return {
    store,
    collection: (c) => ({ doc: (id) => ref(c, id ?? `auto${++auto}`) }),
    getAll: async (...r) => r.map(snap),
    async runTransaction(fn) {
      const w = [];
      const tx = { getAll: async (...r) => r.map(snap), update: (r, d) => w.push(['u', r, d]), set: (r, d, o) => w.push(['s', r, d, o]) };
      const out = await fn(tx);
      for (const [k, r, d, o] of w) store.set(r.path, k === 'u' ? { ...store.get(r.path), ...d } : (o?.merge ? { ...(store.get(r.path) || {}), ...d } : d));
      return out;
    },
  };
}
const rejects = async (p, code) => {
  try { await p; assert.fail('should reject ' + code); } catch (e) { assert.ok(e instanceof OrderError, e.stack); assert.equal(e.code, code); }
};
const shop = () => ({
  'tenants/bynd': { slug: 'bynd', isActive: true },
  'products/real': { tenantId: 'bynd', name: { en: 'Real' }, price: 400, stock: 10, isActive: true, deleted: false },
  'products/soon': { tenantId: 'bynd', name: { en: 'Soon' }, price: 700, stock: 10, isActive: true, deleted: false, comingSoon: true },
  'products/soonpre': { tenantId: 'bynd', name: { en: 'SoonPre' }, price: 700, stock: 0, isPreorder: true, isActive: true, deleted: false, comingSoon: true },
  'products/made': { tenantId: 'bynd', name: { en: 'Made' }, price: 300, stock: 0, isPreorder: true, preorderStyle: 'madeToOrder', isActive: true, deleted: false },
});
const cust = { name: 'Ali', phone: '01000000000', city: 'Cairo', street: '1 Nile St' };
const mk = (items) => validateInput({ tenantId: 'bynd', customer: cust, items });

let db = makeDb(shop());
await rejects(placeOrder(db, mk([{ productId: 'soon', quantity: 1 }])), 'UNAVAILABLE');
await rejects(placeOrder(db, mk([{ productId: 'soonpre', quantity: 1 }])), 'UNAVAILABLE');
await rejects(placeOrder(db, mk([{ productId: 'real', quantity: 1 }, { productId: 'soon', quantity: 1 }])), 'UNAVAILABLE');
assert.equal(db.store.get('products/real').stock, 10, 'nothing changed after the refusal');
assert.equal([...db.store.keys()].filter((k) => k.startsWith('orders/')).length, 0, 'no order was saved');
ok('server: an order with a coming-soon product is refused and nothing is saved or taken from stock');

await rejects(getQuote(db, { tenantId: 'bynd', items: mk([{ productId: 'soon', quantity: 1 }]).items, zoneId: '', promoCode: '' }), 'UNAVAILABLE');
ok('server: the price preview refuses it too');

const good = await placeOrder(db, mk([{ productId: 'real', quantity: 2 }]));
assert.equal(good.totalAmount, 800);
assert.equal(db.store.get('products/real').stock, 8);
ok('server: normal products still sell');

const made = await placeOrder(db, mk([{ productId: 'made', quantity: 3 }]));
assert.equal(db.store.get(`orders/${made.orderId}`).orderType, 'preorder');
assert.equal(db.store.get('products/made').stock, 0);
ok('server: made-to-order works like a preorder (no stock needed, stock stays 0)');

console.log(`ALL ${n} STOREFRONT CHECKS PASSED`);
