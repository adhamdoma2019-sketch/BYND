// Update 46 (part 2): the cart's - / + buttons and Remove are big enough for a thumb.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/components/storefront/CartDrawer.jsx', import.meta.url), 'utf8');
const buttons = src.match(/<button[\s\S]*?className="[^"]*"\s*>/g) || [];
const qty = buttons.filter((b) => /updateQuantity/.test(b));
assert.equal(qty.length, 2, 'two quantity buttons');
for (const b of qty) {
  assert.ok(/h-11 w-11/.test(b), 'quantity button is 44 px square');
  assert.ok(/aria-label=/.test(b), 'quantity button has a screen-reader label');
  assert.ok(!/px-2 text-sm/.test(b), 'old tiny button style is gone');
}
assert.ok(src.includes('min-h-[44px] px-2 text-sm text-rust'), 'Remove is 44 px tall');
console.log('ALL 3 TAP-TARGET CHECKS PASSED');
