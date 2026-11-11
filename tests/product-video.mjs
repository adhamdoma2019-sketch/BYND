// Step 10: a short product video as the FIRST item of the photo strip.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ----- 1. links -----
const tmp = path.join(os.tmpdir(), 'bynd-images-video.tmp.mjs');
fs.writeFileSync(tmp, read('utils/images.js').replace(/import\.meta\.env\./g, '({})?.'));
const { optimizedVideo, videoPoster, MAX_VIDEO_MB } = await import(pathToFileURL(tmp).href);
const cv = 'https://res.cloudinary.com/demo/video/upload/v123/clip.mp4';
assert.equal(optimizedVideo(cv), 'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto,c_limit,w_900/v123/clip.mp4');
assert.equal(optimizedVideo('https://res.cloudinary.com/demo/video/upload/w_300/v1/c.mp4'), 'https://res.cloudinary.com/demo/video/upload/w_300/v1/c.mp4');
assert.equal(optimizedVideo('https://example.com/a.mp4'), 'https://example.com/a.mp4');
assert.equal(optimizedVideo(''), '');
ok('Cloudinary videos get auto format + quality + a size limit; other links and links with their own settings are left alone');
assert.equal(videoPoster(cv), 'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto,c_limit,w_900/v123/clip.jpg');
assert.equal(videoPoster('https://res.cloudinary.com/demo/video/upload/w_300/v1/c.mov'), 'https://res.cloudinary.com/demo/video/upload/so_0,f_jpg,q_auto,c_limit,w_900/v1/c.jpg');
assert.equal(videoPoster('https://example.com/a.mp4'), ''); assert.equal(videoPoster(''), '');
ok('poster = the first frame as a small JPEG for Cloudinary videos, nothing for other links (the page then uses the first photo)');
assert.equal(MAX_VIDEO_MB, 40);
ok('the upload limit is 40 MB');

// ----- 2. saved product + preview -----
// (the loader of section 3 is used: productForm.js imports other files without ".js")
// ----- 3. the gallery with a video -----
async function load(file, extra = {}) {
  const outfile = path.join(root, 'tests', `.pv-${process.pid}-${Math.random().toString(36).slice(2)}.cjs`);
  await build({
    stdin: { contents: `import * as M from ${JSON.stringify(root + '/src/' + file)}; module.exports = M;`, resolveDir: root, loader: 'js' },
    bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', jsx: 'automatic',
    define: { 'import.meta.env': '{}' }, external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],
    plugins: [{ name: 's', setup(b) {
      b.onResolve({ filter: /^react-i18next$/ }, (a) => ({ path: a.path, namespace: 'st' }));
      b.onLoad({ filter: /.*/, namespace: 'st' }, () => ({ contents: "export const useTranslation=()=>({t:(k,o)=>k+(o&&o.n!==undefined?'['+o.n+'/'+o.total+']':'')});", loader: 'js' }));
    } }],
  });
  const m = createRequire(import.meta.url)(outfile); fs.rmSync(outfile, { force: true }); return m;
}
const R = createRequire(import.meta.url);
const React = R('react'); const { renderToString } = R('react-dom/server');
const PF = await load('utils/productForm.js');
const baseForm = { nameEn: 'x', nameAr: '', descriptionEn: '', descriptionAr: '', price: '10', priceTiers: [], minQty: '', maxQty: '', stock: '1', sku: '', shippingExtra: '', imageUrl: '', images: [], relatedIds: [], options: [], preorderMessageEn: '', preorderMessageAr: '' };
const keep = (v) => PF.productFields({ ...baseForm, videoUrl: v }).videoUrl;
assert.equal(keep('https://v.test/a.mp4'), 'https://v.test/a.mp4');
assert.equal(keep('  https://v.test/a.mp4  '), 'https://v.test/a.mp4');
assert.equal(keep('http://v.test/a.mp4'), ''); assert.equal(keep('javascript:alert(1)'), ''); assert.equal(keep(''), ''); assert.equal(keep(undefined), '');
assert.equal(keep('https://v.test/' + 'a'.repeat(600)).length, 500);
ok('the saved product keeps only an https video link (cut at 500 characters); anything else is dropped');
const PV = await load('utils/preview.js');
assert.ok(PV.PRODUCT_DRAFT_KEYS.includes('videoUrl'));
assert.equal(PV.cleanProductDraft({ videoUrl: 'https://v.test/a.mp4' }).videoUrl, 'https://v.test/a.mp4');
assert.equal(PV.cleanProductDraft({ videoUrl: 'http://v.test/a.mp4' }).videoUrl, '');
ok('the live product preview shows the video too (https only)');
const Gallery = (await load('components/storefront/ProductGallery.jsx')).default;
const pics = ['https://x.test/a.jpg', 'https://x.test/b.jpg'];
const video = { src: 'https://v.test/a.mp4', poster: 'https://v.test/a.jpg' };
let html = renderToString(React.createElement(Gallery, { pictures: pics, shown: pics[0], onShow() {}, name: 'Hex', texts: [], video }));
assert.equal((html.match(/data-gallery-slide/g) || []).length, 3);
assert.ok(html.indexOf('data-gallery-video') < html.indexOf('<img'), 'the video slide comes first');
assert.match(html, /<video[^>]*controls/); assert.match(html, /<video[^>]*playsInline|<video[^>]*playsinline/i); assert.match(html, /<video[^>]*preload="none"/);
assert.match(html, /<video[^>]*poster="https:\/\/v\.test\/a\.jpg"/); assert.match(html, /<video[^>]*src="https:\/\/v\.test\/a\.mp4"/);
ok('video first, then the photos; the video has controls, plays inline on phones, loads nothing until played, and shows a poster');
const tabs = [...html.matchAll(/role="tab" aria-selected="(true|false)" aria-label="([^"]*)"/g)].map((m) => [m[1], m[2]]);
assert.deepEqual(tabs, [['true', 'storefront.galleryVideo'], ['false', 'storefront.galleryPhoto[1/2]'], ['false', 'storefront.galleryPhoto[2/2]']]);
ok('three dots (video + 2 photos); the strip opens on the video; photos are numbered 1 of 2, 2 of 2');
html = renderToString(React.createElement(Gallery, { pictures: [], shown: '', onShow() {}, name: 'Hex', texts: [], video }));
assert.match(html, /data-gallery-video/); assert.doesNotMatch(html, /<img/); assert.doesNotMatch(html, /role="tab"/);
ok('a product with only a video (no photos) still shows the video');
html = renderToString(React.createElement(Gallery, { pictures: pics, shown: pics[1], onShow() {}, name: 'Hex', texts: [] }));
assert.doesNotMatch(html, /<video/); assert.deepEqual([...html.matchAll(/role="tab" aria-selected="(true|false)"/g)].map((m) => m[1]), ['false', 'true']);
ok('a product without a video works exactly as before');
const page = read('pages/storefront/ProductPage.jsx');
assert.ok(/video=\{galleryVideo\}/.test(page) && /shownImage \|\| galleryVideo/.test(page) && /optimizedVideo\(videoSrc\)/.test(page) && /\^https:/.test(page.slice(page.indexOf('videoSrc'), page.indexOf('videoSrc') + 120)));
ok('the product page passes an https video to the gallery');

// ----- 4. the admin field -----
const VF = (await load('components/admin/VideoField.jsx')).default;
html = renderToString(React.createElement(VF, { label: 'Video', help: 'help', value: '', onChange() {} }));
assert.match(html, /data-video-field/); assert.doesNotMatch(html, /<video/);
html = renderToString(React.createElement(VF, { label: 'Video', help: 'help', value: 'https://res.cloudinary.com/demo/video/upload/v1/a.mp4', onChange() {} }));
assert.match(html, /<video[^>]*controls/); assert.match(html, /w_480/);
html = renderToString(React.createElement(VF, { label: 'Video', help: '', value: 'javascript:alert(1)', onChange() {} }));
assert.doesNotMatch(html, /<video/);
ok('admin: a video box with link + upload; a small player appears for an https link only');
const products = read('pages/admin/Products.jsx');
assert.ok(/<VideoField/.test(products) && /videoUrl: p\.videoUrl \|\| ''/.test(products) && /videoUrl: ''/.test(products));
const en = JSON.parse(read('i18n/en.json')); const ar = JSON.parse(read('i18n/ar.json'));
for (const [g, k] of [['upload', 'chooseVideo'], ['upload', 'notVideo'], ['upload', 'videoTooBig'], ['upload', 'videoFailed'], ['upload', 'videoNotSetUp'], ['products', 'videoUrl'], ['products', 'videoHelp'], ['storefront', 'galleryVideo']]) assert.ok(en[g][k] && ar[g][k], k);
ok('the product form has the video box (loaded, saved) and all texts exist in English and Arabic');
console.log('ALL ' + n + ' PRODUCT-VIDEO CHECKS PASSED');
