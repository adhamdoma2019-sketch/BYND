// Design step 2: every button a customer taps in the shop's top bar, menu, cart, hero and product/wall
// controls is at least 44 px (11 in Tailwind units), and the top bar stays usable on a 320 px phone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

const header = read('components/storefront/StorefrontHeader.jsx');
assert.equal((header.match(/h-11 w-11/g) || []).length, 2, 'theme + cart buttons are 44 px');
assert.ok(!/h-9 w-9/.test(header));
assert.ok(/min-h-\[44px\]/.test(read('components/shared/LanguageSwitch.jsx')));
ok('top bar: theme, cart and language buttons are 44 px');

// narrow phone: tighter gaps and a smaller wordmark below the sm breakpoint, so the name still fits
assert.ok(/gap-1 sm:gap-3/.test(header) && /px-3 py-2 sm:gap-3 sm:px-8 sm:py-3/.test(header));
assert.ok(/text-lg[^"]*tracking-\[0\.12em\][^"]*sm:text-xl sm:tracking-\[0\.2em\]/.test(header));
assert.ok(/max-w-full object-contain/.test(header), 'a wide logo shrinks instead of pushing the buttons out');
ok('top bar: narrow-phone spacing, smaller wordmark, wide logos shrink');

const menu = read('components/storefront/StorefrontMenu.jsx');
assert.equal((menu.match(/h-11 w-11/g) || []).length, 2);
assert.ok(!/h-9 w-9/.test(menu));
ok('menu button and menu close button are 44 px');

const co = read('components/storefront/CheckoutHeader.jsx');
assert.equal((co.match(/min-h-\[44px\]/g) || []).length, 2, 'logo link and Back to shop');
ok('checkout top bar: Back to shop and the logo are 44 px tall');

const hero = read('components/storefront/Hero.jsx');
assert.ok(/flex h-11 w-6 items-center justify-center/.test(hero));
ok('hero dots have a 44 px tap area (the visible dot stays small)');
assert.ok(/before:-inset-1\.5/.test(read('components/storefront/AnnouncementBar.jsx')));
ok('top-bar message arrows keep their look but get a 44 px tap area');

const cart = read('components/storefront/CartDrawer.jsx');
assert.ok(!/h-9 w-9/.test(cart) && /min-h-\[44px\] px-2 text-sm text-rust/.test(cart));
const page = read('pages/storefront/ProductPage.jsx');
assert.ok(!/h-10 w-10/.test(page) && (page.match(/h-11 w-11/g) || []).length >= 2 && /h-11 w-20/.test(page));
const wall = read('components/storefront/WallDesigner.jsx');
assert.ok(!/\bh-9\b|\bh-10\b/.test(wall));
ok('cart, product quantity box and wall designer controls are 44 px');
console.log('ALL ' + n + ' TAP-TARGET (STEP 2) CHECKS PASSED');
