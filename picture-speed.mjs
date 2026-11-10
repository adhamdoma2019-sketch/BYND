// Design step 4: pictures are resized, compressed, never enlarged, offered in several sizes (srcset),
// and the first picture of a page is loaded with priority. Non-Cloudinary links are left alone.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const tmp = path.join(os.tmpdir(), 'bynd-images-speed.tmp.mjs');
fs.writeFileSync(tmp, fs.readFileSync(new URL('../src/utils/images.js', import.meta.url), 'utf8').replace(/import\.meta\.env\./g, '({})?.'));
const { optimizedImage, imageSrcSet, pickWidth, HERO_WIDTHS, CARD_WIDTHS, GALLERY_WIDTHS } = await import(pathToFileURL(tmp).href);
const read = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
let n = 0; const ok = (l) => console.log('  ok', ++n, l);
const cl = 'https://res.cloudinary.com/demo/image/upload/v123/a.jpg';

assert.equal(optimizedImage(cl, 700), 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_700/v123/a.jpg');
assert.equal(optimizedImage('https://res.cloudinary.com/demo/image/upload/w_300/v1/a.jpg', 700), 'https://res.cloudinary.com/demo/image/upload/w_300/v1/a.jpg');
ok('Cloudinary links: auto format + quality, never enlarged; links that already have settings are kept');

const ss = imageSrcSet(cl, CARD_WIDTHS);
assert.equal(ss.split(', ').length, 3);
assert.ok(ss.startsWith('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_400/v123/a.jpg 400w'));
assert.ok(ss.endsWith('w_1000/v123/a.jpg 1000w'));
ok('srcset: one entry per width, smallest first, with the width descriptor');
assert.equal(imageSrcSet('https://example.com/a.jpg', CARD_WIDTHS), undefined);
assert.equal(imageSrcSet('', CARD_WIDTHS), undefined);
assert.equal(imageSrcSet('https://res.cloudinary.com/demo/image/upload/w_300/v1/a.jpg', CARD_WIDTHS), undefined);
ok('other sites\' pictures, empty links and pictures with their own settings get no srcset');

for (const w of [HERO_WIDTHS, CARD_WIDTHS, GALLERY_WIDTHS]) assert.deepEqual([...w].sort((a, b) => a - b), w);
assert.equal(pickWidth(HERO_WIDTHS, 390), 1400 > 390 * 1 ? HERO_WIDTHS.find((x) => x >= 390) : 0); // no window here: dpr 1
assert.equal(pickWidth(HERO_WIDTHS, 5000), 1800);
ok('the width lists are sorted; the picker never goes above the biggest size');

const card = read('components/storefront/ProductCard.jsx');
assert.ok(/srcSet=\{imageSrcSet\(product\.imageUrl, CARD_WIDTHS\)\}/.test(card) && /sizes="[^"]*100vw"/.test(card) && /loading="lazy"/.test(card));
const hero = read('components/storefront/Hero.jsx');
assert.ok(/srcSet=\{imageSrcSet\(slide\.imageUrl, HERO_WIDTHS\)\}/.test(hero) && /sizes="100vw"/.test(hero));
assert.ok(/fetchpriority=\{i === 0 \? 'high' : undefined\}/.test(hero), 'first banner picture has priority');
assert.ok(/pickWidth\(HERO_WIDTHS\)/.test(hero) && !/optimizedImage\(slides\[next\]\.imageUrl, 1800\)/.test(hero), 'the next banner picture is prepared at the size this screen needs');
const pt = read('components/storefront/PictureText.jsx');
assert.ok(/fetchpriority=\{eager \? 'high' : undefined\}/.test(pt) && /srcSet=\{srcSet\}/.test(pt));
const gal = read('components/storefront/ProductGallery.jsx');
assert.ok(/imageSrcSet\(url, GALLERY_WIDTHS\)/.test(gal) && /eager=\{i === 0\}/.test(gal));
ok('cards, banner and gallery use srcset; first banner / gallery picture has priority; cards load lazily');
console.log('ALL ' + n + ' PICTURE-SPEED CHECKS PASSED');
