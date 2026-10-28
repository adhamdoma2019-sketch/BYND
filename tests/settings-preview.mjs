// Live preview in Admin > Settings: the form -> shop conversion (the same one "Save settings" uses),
// the safety rules of the draft messages, and a server-side render of the preview pane.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'tests', `.preview-${process.pid}.cjs`);
const stubs = {
  'react-i18next': `export const useTranslation=()=>({t:(k)=>k});`,
};
await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(root + '/src/utils/settingsForm.js')};
      export * from ${JSON.stringify(root + '/src/utils/preview.js')};
      export { default as PreviewPane } from ${JSON.stringify(root + '/src/components/admin/PreviewPane.jsx')};
    `,
    resolveDir: root, loader: 'js',
  },
  bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
  define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: stubs[a.path], loader: 'js' }));
    b.onResolve({ filter: /context\/LanguageContext$/ }, (a) => ({ path: a.path, namespace: 'stub2' }));
    b.onLoad({ filter: /.*/, namespace: 'stub2' }, () => ({ contents: "export const useLanguage=()=>({language:'ar'});", loader: 'js' }));
  } }],
});
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToString } = require('react-dom/server');
const m = require(outfile);
fs.rmSync(outfile, { force: true });

let n = 0; const ok = (l) => console.log('  ok', ++n, l);

const blankForm = () => ({
  accent: 'copper',
  appearance: { mode: 'auto', font: 'serif', radius: 'soft', annEnabled: false, annTextEn: '', annTextAr: '', annLink: '', annMore: [] },
  contact: { whatsapp: '', phone: '', email: '', instagram: '', facebook: '', tiktok: '', addressEn: '', addressAr: '', floatingWhatsapp: false },
  logoUrl: '', logoDarkUrl: '', slides: [], seconds: 5, fade: 'normal', autoplay: true, heroTextStyle: 'card',
  highlights: [], pages: m.pagesToForm(undefined),
});

// ===== 1. The form -> shop conversion =====
let f = blankForm();
f.appearance.annEnabled = true; f.appearance.annTextEn = '  Free delivery ';
f.appearance.annMore = [{ textEn: '', textAr: '', link: '' }, { textEn: 'Second', textAr: '', link: '#products' }];
f.highlights = [{ titleEn: 'Quality', titleAr: '', textEn: '', textAr: 'نص' }, { titleEn: '', titleAr: '', textEn: 'x', textAr: '' }];
f.contact.addressEn = ' Cairo '; f.contact.phone = ' 0100 ';
f.logoUrl = ' https://a/logo.png ';
f.pages.privacy = { en: ' Hello ', ar: '' };
f.seconds = 999;
let s = m.buildPublicSettings(f);
assert.deepEqual(s.theme, { accent: 'copper' });
assert.equal(s.appearance.announcement.text.en, 'Free delivery');
assert.equal(s.appearance.announcement.text.ar, 'Free delivery'); // Arabic empty -> English is used
assert.equal(s.appearance.announcement.more.length, 1); // the empty message is dropped
assert.equal(s.appearance.announcement.more[0].text.ar, 'Second');
assert.equal(s.highlights.length, 1); // no title = dropped
assert.deepEqual(s.highlights[0].title, { en: 'Quality', ar: 'Quality' });
assert.deepEqual(s.highlights[0].text, { en: 'نص', ar: 'نص' });
assert.equal(s.contact.address.ar, 'Cairo'); assert.equal(s.contact.phone, '0100');
assert.equal(s.brand.logoUrl, 'https://a/logo.png');
assert.deepEqual(s.pages.privacy.body, { en: 'Hello', ar: 'Hello' });
assert.ok(s.hero.intervalSeconds <= 60 && s.hero.intervalSeconds >= 1); // kept inside the safe limits
ok('form -> shop: trimmed, empty entries dropped, Arabic falls back to English, timing kept in limits');

// ===== 2. Saved shop -> form -> shop gives the same shop back (nothing is lost) =====
const saved = {
  theme: { accent: 'lime' },
  appearance: { mode: 'dark', font: 'serif', radius: 'sharp', announcement: { enabled: true, text: { en: 'A', ar: 'ا' }, link: '', more: [{ text: { en: 'B', ar: 'ب' }, link: '#products' }] } },
  contact: { whatsapp: '010', phone: '', email: '', instagram: '', facebook: '', tiktok: '', address: { en: 'X', ar: 'س' }, floatingWhatsapp: true },
  brand: { logoUrl: 'https://a/1.png', logoDarkUrl: 'https://a/2.png' },
  hero: { slides: [{ imageUrl: 'https://a/s.png', headline: { en: 'H', ar: 'ع' }, subtext: { en: 'S', ar: 'ن' }, cta: { en: 'C', ar: 'ك' }, productId: 'p1' }], intervalSeconds: 7, fade: 'slow', autoplay: false, textStyle: 'plain' },
  highlights: [{ title: { en: 'T', ar: 'ت' }, text: { en: 'U', ar: 'ث' } }],
  pages: m.formToPages(m.pagesToForm({ privacy: { body: { en: 'P', ar: 'ب' } } })),
};
const form = {
  accent: saved.theme.accent,
  appearance: { mode: 'dark', font: 'serif', radius: 'sharp', annEnabled: true, annTextEn: 'A', annTextAr: 'ا', annLink: '', annMore: saved.appearance.announcement.more.map(m.moreToForm) },
  contact: { whatsapp: '010', phone: '', email: '', instagram: '', facebook: '', tiktok: '', addressEn: 'X', addressAr: 'س', floatingWhatsapp: true },
  logoUrl: 'https://a/1.png', logoDarkUrl: 'https://a/2.png',
  slides: saved.hero.slides.map(m.slideToForm), seconds: 7, fade: 'slow', autoplay: false, heroTextStyle: 'plain',
  highlights: saved.highlights.map(m.highlightToForm), pages: m.pagesToForm(saved.pages),
};
assert.deepEqual(m.buildPublicSettings(form), saved);
ok('saved shop -> form -> shop: identical (opening Settings and saving without a change changes nothing)');

// ===== 3. Is this the preview frame? =====
assert.equal(m.isPreviewMode('?preview=1', true), true);
assert.equal(m.isPreviewMode('?preview', true), true);
assert.equal(m.isPreviewMode('?preview=1', false), false); // opened alone: a normal shop
assert.equal(m.isPreviewMode('', true), false);
assert.equal(m.isPreviewMode('?x=1', true), false);
ok('preview mode only with ?preview AND inside a frame');

// ===== 4. Messages: only from the page around it, on the same site =====
const parent = {}; const other = {}; const origin = 'https://shop.example';
const good = { origin, source: parent, data: { type: m.PREVIEW_DRAFT, draft: s, mode: 'dark', language: 'ar' } };
const a1 = m.acceptDraftMessage(good, { origin, parent });
assert.ok(a1); assert.equal(a1.mode, 'dark'); assert.equal(a1.language, 'ar');
assert.equal(m.acceptDraftMessage({ ...good, origin: 'https://evil.example' }, { origin, parent }), null);
assert.equal(m.acceptDraftMessage({ ...good, source: other }, { origin, parent }), null);
assert.equal(m.acceptDraftMessage({ ...good, data: { type: 'other', draft: s } }, { origin, parent }), null);
assert.equal(m.acceptDraftMessage({ ...good, data: { type: m.PREVIEW_DRAFT, draft: null } }, { origin, parent }), null);
assert.equal(m.acceptDraftMessage({ ...good, data: { type: m.PREVIEW_DRAFT, draft: s, mode: 'weird', language: 'fr' } }, { origin, parent }).mode, null);
assert.equal(m.acceptDraftMessage({ ...good, data: { type: m.PREVIEW_DRAFT, draft: s, language: 'fr' } }, { origin, parent }).language, null);
assert.equal(m.acceptDraftMessage(null, { origin, parent }), null);
const fw = {};
assert.equal(m.acceptReadyMessage({ origin, source: fw, data: { type: m.PREVIEW_READY } }, { origin, frameWindow: fw }), true);
assert.equal(m.acceptReadyMessage({ origin, source: other, data: { type: m.PREVIEW_READY } }, { origin, frameWindow: fw }), false);
assert.equal(m.acceptReadyMessage({ origin: 'https://evil.example', source: fw, data: { type: m.PREVIEW_READY } }, { origin, frameWindow: fw }), false);
ok('messages: wrong site, wrong sender, wrong type or no draft are ignored; unknown mode/language become "shop setting"');

// ===== 5. What a draft may change =====
const dirty = { ...s, checkout: { x: 1 }, ownerUid: 'u', isActive: false, shipping: { zones: [] }, id: 'other', slug: 'other',
  brand: { logoUrl: 'http://insecure/x.png', logoDarkUrl: 'https://ok/y.png' },
  hero: { ...s.hero, slides: [{ imageUrl: 'javascript:alert(1)', headline: { en: 'h' } }, { imageUrl: 'https://ok/z.png' }] } };
const clean = m.cleanDraft(dirty);
['checkout', 'ownerUid', 'isActive', 'shipping', 'id', 'slug'].forEach((k) => assert.equal(clean[k], undefined, k));
assert.equal(clean.brand.logoUrl, ''); assert.equal(clean.brand.logoDarkUrl, 'https://ok/y.png');
assert.equal(clean.hero.slides[0].imageUrl, ''); assert.equal(clean.hero.slides[1].imageUrl, 'https://ok/z.png');
const tenant = { id: 'bynd', slug: 'bynd', ownerUid: 'u1', isActive: true, name: { en: 'BYND' }, theme: { accent: 'copper' }, checkout: { a: 1 } };
const shown = m.applyDraft(tenant, dirty);
assert.equal(shown.id, 'bynd'); assert.equal(shown.slug, 'bynd'); assert.equal(shown.ownerUid, 'u1'); assert.equal(shown.isActive, true);
assert.deepEqual(shown.checkout, { a: 1 });
assert.equal(shown.theme.accent, 'copper'); assert.equal(tenant.theme.accent, 'copper'); // original untouched
assert.equal(m.applyDraft(null, s), null); assert.equal(m.applyDraft(tenant, null), tenant);
ok('draft: only look/banner/top bar/logo/highlights/pages/contact can change; id, owner, checkout, shipping and non-https pictures cannot');

// ===== 6. The preview pane (server render) =====
const html = renderToString(React.createElement(m.PreviewPane, { slug: 'bynd', draft: s }));
assert.match(html, /<iframe[^>]*src="\/store\/bynd\?preview=1"/);
assert.match(html, /English/); assert.match(html, /العربية/);
assert.match(html, /settingsPage\.previewLight/); assert.match(html, /settingsPage\.previewDark/); assert.match(html, /settingsPage\.previewModeShop/);
assert.match(html, /settingsPage\.previewNote/);
assert.doesNotMatch(html, /settingsPage\.previewClose/); // no close button beside the form
const html2 = renderToString(React.createElement(m.PreviewPane, { slug: 'bynd', draft: s, onClose() {} }));
assert.match(html2, /settingsPage\.previewClose/); // full-screen on a phone has one
assert.match(html, /aria-pressed="true"[^>]*>العربية/); // starts in the admin's language (Arabic in this test)
ok('preview pane: real shop address in a frame, language + light/dark switches, close button only on phones');

console.log('ALL ' + n + ' SETTINGS-PREVIEW CHECK GROUPS PASSED');
