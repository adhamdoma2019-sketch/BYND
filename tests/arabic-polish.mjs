// Design step 8 (Arabic polish): wording consistency, no hard-coded English on shop screens,
// every {{placeholder}} of an English text also exists in its Arabic text (and the other way round).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const en = JSON.parse(read('i18n/en.json')); const ar = JSON.parse(read('i18n/ar.json'));
let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const flat = (d, p = '') => Object.entries(d).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, String(v)]]));
const E = Object.fromEntries(flat(en)); const A = Object.fromEntries(flat(ar));

// 1. placeholders
const vars = (s) => [...s.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');
const bad = Object.keys(E).filter((k) => k in A && vars(E[k]) !== vars(A[k]));
assert.deepEqual(bad, [], 'placeholders differ: ' + bad.join(', '));
ok('every English text and its Arabic text use exactly the same {{placeholders}} (' + Object.keys(E).length + ' texts)');

// 2. grammar traps: "الـ" glued to a placeholder, a stray English letter run in shop texts
const glued = Object.entries(A).filter(([, v]) => /الـ\{\{/.test(v)).map(([k]) => k);
assert.deepEqual(glued, [], 'الـ + {{variable}} breaks when the name already starts with ال: ' + glued.join(', '));
ok('no Arabic text glues "الـ" onto a variable (the name may already start with ال)');
for (const g of ['storefront', 'checkout', 'wall', 'receipt', 'trust', 'menu', 'track', 'errors', 'checkoutFields', 'progress', 'next']) {
  for (const [k, v] of Object.entries(A).filter(([key]) => key.startsWith(g + '.'))) {
    const stripped = v.replace(/\{\{[^}]+\}\}/g, '').replace(/\b(PDF|WhatsApp)\b/g, '');
    if (['track.orderNumberExample'].includes(k)) continue;
    assert.ok(!/[A-Za-z]{2,}/.test(stripped), `English words inside the Arabic text ${k}: ${v}`);
  }
}
ok('customer-facing Arabic texts contain no English words (only PDF / placeholders)');

// 3. one word for "wall", one phrase for "made to order", one for WhatsApp
assert.ok(!/جدار/.test(JSON.stringify(ar)), 'use حائط everywhere');
assert.equal(A['wall.title'], 'صمّم حائطك');
ok('"wall" is حائط in every Arabic text');
assert.equal(A['storefront.madeToOrder'], 'يُصنع عند الطلب');
assert.equal(A['storefront.madeToOrderShort'], A['storefront.madeToOrder']);
assert.equal(A['receipt.madeToOrder'], A['storefront.madeToOrder']);
assert.ok(!/يُصنع حسب الطلب|يُصنع عند الطلب\.? *$/.test(A['checkout.madeToOrderPlacedBody']));
ok('"made to order" says the same thing on the product, the colour tag and the receipt, and the order message no longer repeats "order"');
assert.equal(A['menu.chat'], A['contact.whatsappLabel']);
ok('the WhatsApp links say the same thing in the menu and in the shop footer');
assert.equal(A['storefront.qtyInCartSame'], 'لديك بالفعل {{n}} بنفس {{option}} في سلتك، وهي تُحتسب أيضًا.');
assert.ok(!/قطعاً/.test(JSON.stringify(ar)));
ok('fixed the broken sentence in the cart hint and the spelling of قطعًا');

// 4. no hard-coded English or one-way arrows left in shop screens
const shopFiles = [];
for (const d of ['components/storefront', 'pages/storefront', 'components/shared']) for (const f of fs.readdirSync(path.join(root, d))) if (f.endsWith('.jsx')) shopFiles.push(`${d}/${f}`);
for (const f of shopFiles) {
  // the hidden bot-trap box of the checkout (off-screen, aria-hidden) is meant for bots and keeps a plain English label
  const s = read(f).replace(/\{\/\* Hidden trap[\s\S]*?<\/label>/, '');
  assert.ok(!/(aria-label|placeholder|title|alt)="[A-Za-z][A-Za-z ]+"/.test(s), `${f}: literal English attribute`);
  assert.ok(!/>\s*[A-Za-z][A-Za-z ,.!?']{3,}\s*</.test(s), `${f}: literal English text`);
  if (f !== 'components/storefront/ProductGallery.jsx') assert.ok(!/[←→]/.test(s), `${f}: a one-way arrow does not mirror in Arabic`);
}
ok('no shop screen has hard-coded English text, English screen-reader labels or one-way arrows (the gallery arrows are rotated for Arabic)');
assert.ok(/rtl:rotate-180/.test(read('components/storefront/ProductGallery.jsx')));
ok('the gallery arrows are mirrored for Arabic');

// 5. the cart close button and shop-not-found screen
const cart = read('components/storefront/CartDrawer.jsx');
assert.ok(/h-11 w-11[^"]*"\s+aria-label=\{t\('common\.close'\)\}/.test(cart));
const lay = read('pages/storefront/StorefrontLayout.jsx');
assert.ok(/storefront\.shopNotFound/.test(lay) && !/Shop not found/.test(lay));
assert.ok(/common\.language/.test(read('components/shared/LanguageSwitch.jsx')));
ok('cart close button is 44 px with a translated label; shop-not-found and the language button are translated');
for (const k of ['common.close', 'common.language', 'storefront.shopNotFound', 'storefront.shopNotFoundBody']) assert.ok(E[k] && A[k], k);
ok('new texts exist in English and Arabic');
console.log('ALL ' + n + ' ARABIC-POLISH CHECKS PASSED');
