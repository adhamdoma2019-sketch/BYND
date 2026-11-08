// Update 43: mixed Arabic / English text keeps its own direction
// (e.g. "5 KM" must not turn into "KM 5" on an Arabic page).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

const picker = read('src/components/storefront/OptionPicker.jsx');
assert.ok(picker.includes('<bdi>{valueName(v)}</bdi>'), 'choice buttons isolate the value name');
assert.ok(picker.includes('<bdi>{valueName(chosen)}</bdi>'), 'colour name isolated');
ok('option values are wrapped in <bdi> (5 KM stays 5 KM in Arabic)');

const page = read('src/pages/storefront/ProductPage.jsx');
assert.ok(page.includes('\\u2068') && page.includes('\\u2069'), 'missing-option names use direction isolates');
ok('"please choose" message isolates each option name');

const footer = read('src/components/storefront/StorefrontFooter.jsx');
assert.ok(footer.includes('<bdi>© '), 'copyright isolated');
ok('footer copyright stays "© 2026 Shop" in Arabic');

console.log('ALL 3 BIDI-TEXT CHECKS PASSED');
