// Update 36: letters-only typing in the name box, the shop menu, and the About page.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { filterTyped } from '../src/utils/typingFilter.js';
import { checkField } from '../src/utils/contactChecks.js';
import { POLICY_PAGES, availablePolicyPages, policyBody } from '../src/utils/storefront.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// 1. the name / country / city boxes refuse digits and symbols while typing (also when pasted)
for (const key of ['name', 'country', 'city']) {
  assert.deepEqual(filterTyped(key, 'Ali Hassan'), { value: 'Ali Hassan', changed: false });
  assert.deepEqual(filterTyped(key, 'Ali123'), { value: 'Ali', changed: true });
  assert.equal(filterTyped(key, 'A<b>l$i#_@').value, 'Abli');
}
assert.equal(filterTyped('name', 'محمد ١٢٣ أحمد').value, 'محمد  أحمد');            // Arabic letters kept, Arabic digits refused
assert.equal(filterTyped('name', "Abd El-Rahman O'Brien Jr.").changed, false);       // - ' . and spaces are fine
assert.equal(filterTyped('name', 'عبد الرحمن').changed, false);
assert.equal(filterTyped('name', 'Ali\nHassan').value, 'Ali Hassan');                // a pasted line break becomes a space
assert.equal(filterTyped('name', '1234567').value, '');
ok('name / country / city accept letters (any language), spaces and . \' - only; digits and symbols are removed');

// 2. other boxes are left alone (street numbers, building, notes ...)
for (const key of ['street', 'building', 'floor', 'apartment', 'area', 'landmark', 'notes', 'phone', 'email']) {
  assert.deepEqual(filterTyped(key, '12 B-3/2 @x'), { value: '12 B-3/2 @x', changed: false });
}
assert.equal(filterTyped('name', undefined).value, '');
ok('only the three letters-only boxes are filtered');

// 3. whatever the filter keeps is something the final check also accepts (the two rules cannot disagree)
const samples = ['Ali', 'Mona Samir', 'محمد علي', "D'Angelo", 'Ana-Maria', 'x9y8z7 hello', '<script>alert(1)</script>', 'Ahmed 😀 Ali', 'Åsa Öberg'];
for (const s of samples) {
  const kept = filterTyped('name', s).value;
  assert.ok(/^[\p{L}\p{M}\s.'’-]*$/u.test(kept), 'only allowed characters remain: ' + kept);
  const letters = (kept.match(/\p{L}/gu) || []).length;
  if (letters >= 2 && !/(.)\1{3,}/u.test(kept) && !/[<>{}[\]\\|^~`$%*=+@#_]/u.test(kept)) assert.equal(checkField('name', kept).ok, true, kept);
}
assert.equal(checkField('name', 'Ali123').ok, false);                                 // the final (and server) check still refuses digits
ok('everything the filter keeps passes the final name check; digits still fail it');

// 4. the About page: a text page like the others, listed first, shown only when written
assert.deepEqual(POLICY_PAGES.slice(0, 2), ['about', 'privacy']);
const shop = { slug: 'bynd', name: { en: 'BYND', ar: 'بيند' }, pages: { about: { body: { en: 'We make medal walls.', ar: '' } }, terms: { body: { en: 'Terms text', ar: 'شروط' } } } };
assert.deepEqual(availablePolicyPages(shop, 'en'), ['about', 'terms']);
assert.deepEqual(availablePolicyPages(shop, 'ar'), ['about', 'terms']);                // only English written = the Arabic visitor sees the English text (as for every text page)
assert.deepEqual(availablePolicyPages({ slug: 'x', pages: { about: { body: { en: '', ar: '' } } } }, 'en'), []);
assert.equal(policyBody(shop, 'about', 'en'), 'We make medal walls.');
assert.equal(policyBody({ slug: 'x' }, 'about', 'en'), '');
ok('About is a text page: listed first, only when the shop wrote text, and nothing is invented');

// 5. Settings keeps the About text: form -> saved shop record -> form again (real code, bundled)
const sfOut = path.join(root, 'tests', `.sf-${process.pid}.cjs`);
await build({ stdin: { contents: `export * from ${JSON.stringify(root + '/src/utils/settingsForm.js')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile: sfOut, logLevel: 'error', define: { 'import.meta.env': '{}' } });
const SF = req(sfOut); fs.rmSync(sfOut, { force: true });
const formBoxes = SF.pagesToForm({});
assert.ok('about' in formBoxes, 'Settings gets an About box'); assert.deepEqual(Object.keys(formBoxes), POLICY_PAGES);
formBoxes.about = { en: '  About text  ', ar: '' };
const saved = SF.formToPages(formBoxes);
assert.equal(saved.about.body.en, 'About text');
assert.deepEqual(SF.pagesToForm(saved).about, { en: 'About text', ar: 'About text' });   // one language written = shown in both (as for every text page)
assert.deepEqual(saved.privacy.body, { en: '', ar: '' });                              // an empty page stays empty (not listed anywhere)
ok('Settings: the About box is saved and read back like the other text pages; empty pages stay empty');

// 6. the real menu panel, rendered
const stubs = {
  'react-router-dom': `import React from 'react'; export const useLocation=()=>({pathname:globalThis.__path||'/store/bynd'}); export const Link=({children,to,...p})=>React.createElement('a',{href:to,...p},children);`,
  'react-i18next': `export const useTranslation=()=>({t:(k)=>k});`,
};
const outfile = path.join(root, 'tests', `.menu-${process.pid}.cjs`);
await build({
  stdin: { contents: `export { MenuPanel } from ${JSON.stringify(root + '/src/components/storefront/StorefrontMenu.jsx')};`, resolveDir: root, loader: 'js' },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic', define: { 'import.meta.env': '{}' },
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^(react-router-dom|react-i18next)$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onResolve({ filter: /LanguageContext$/ }, (a) => ({ path: a.path, namespace: 'lang' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js', resolveDir: root }));
    b.onLoad({ filter: /.*/, namespace: 'lang' }, () => ({ contents: `export const useLanguage=()=>({language:globalThis.__lang||'en'});`, loader: 'js' }));
  } }],
});
const { MenuPanel } = req(outfile); fs.rmSync(outfile, { force: true });
const draw = (tenant, pathname = '/store/bynd', language = 'en') => { globalThis.__path = pathname; globalThis.__lang = language; return renderToStaticMarkup(React.createElement(MenuPanel, { tenant, onClose() {} })); };

const bare = draw({ slug: 'bynd', name: { en: 'BYND' } });
assert.match(bare, /menu\.home/); assert.match(bare, /menu\.products/); assert.match(bare, /track\.footerLink/);
assert.match(bare, /href="\/store\/bynd#products"/); assert.match(bare, /href="\/store\/bynd\/track"/);
assert.ok(!bare.includes('policies.about'), 'no About link until the shop wrote it'); assert.ok(!bare.includes('menu.info'));
assert.ok(!bare.includes('menu.chat'), 'no WhatsApp entry without a number');
assert.match(bare, /aria-modal="true"/); assert.match(bare, /menu\.close/); assert.match(bare, /start-0/);       // logical side: works in Arabic too
const full = draw({ ...shop, contact: { whatsapp: '01000000000' } });
assert.match(full, /policies\.about/); assert.match(full, /href="\/store\/bynd\/page\/about"/);
assert.match(full, /policies\.terms/); assert.match(full, /menu\.info/); assert.match(full, /menu\.chat/); assert.match(full, /wa\.me/);
assert.ok(!full.includes('policies.privacy'), 'a page without text is not listed');
assert.match(draw({ slug: 'bynd', name: { en: 'BYND' } }, '/store/bynd/track'), /aria-current="page"[^>]*>track\.footerLink|track\.footerLink/);
const onHome = draw({ slug: 'bynd', name: { en: 'BYND' } }, '/store/bynd'); assert.match(onHome, /aria-current="page"/);
ok('the menu lists Home, Products, Track (always) and About / text pages / WhatsApp only when the shop has them; marks the current page');

console.log(`ALL ${n} MENU-AND-TYPING CHECKS PASSED`);
