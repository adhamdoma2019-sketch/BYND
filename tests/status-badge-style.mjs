// Update 44: the "Preorder / Made to order" tags are quiet outlined pills, not loud filled ones;
// and the home page does not stack two big gaps above the footer.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// 1) Every line that draws the status tag must not use the filled "bg-ink ... text-paper" style.
const spots = [
  ['src/components/storefront/ProductCard.jsx', 'storefront.${status}'],
  ['src/components/storefront/CartDrawer.jsx', 'storefront.preorder'],
  ['src/pages/storefront/Checkout.jsx', 'storefront.preorder'],
  ['src/pages/storefront/ProductPage.jsx', 'storefront.${madeStyle}'],
];
for (const [file, marker] of spots) {
  const lines = read(file).split('\n');
  const i = lines.findIndex((l) => l.includes(marker));
  assert.ok(i > 0, `${file}: tag not found`);
  const around = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
  assert.ok(!/bg-ink\b/.test(around), `${file}: status tag is a loud filled pill again`);
  assert.ok(/border-ink\//.test(around), `${file}: status tag should be an outlined pill`);
}
console.log('  ok  status tags are quiet outlined pills');

// 2) Home page: no big bottom padding on <main> on top of the footer's own top space.
const home = read('src/pages/storefront/StorefrontHome.jsx');
assert.ok(/<main className="[^"]*\bpb-0\b/.test(home), 'home main must not add bottom padding');
assert.ok(/footer className="mt-14/.test(read('src/components/storefront/StorefrontFooter.jsx')));
console.log('  ok  home page has one gap above the footer, not two');
console.log('ALL 2 STATUS-BADGE CHECKS PASSED');
