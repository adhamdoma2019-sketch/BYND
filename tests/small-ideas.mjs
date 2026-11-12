// Update 59: the four "small ideas": proper Arabic number forms, the featured tick, product categories,
// and saving the designed wall as a picture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import i18next from 'i18next';
import { arabicCount, fixArabicCounts, ARABIC_COUNT_KEYS, arabicCountsProcessor } from '../src/utils/arabicCount.js';
import { featuredProducts, categoryKey, categoryLabel, categoriesOf, filterByCategory } from '../src/utils/productList.js';
import { wallPictureSvg, WALL_PICTURE_NEUTRAL } from '../src/utils/wallPicture.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const en = JSON.parse(read('i18n/en.json')); const ar = JSON.parse(read('i18n/ar.json'));
let n = 0; const ok = (l) => console.log('  ok', ++n, l);

// ----- 1. Arabic number forms -----
assert.deepEqual([0, 1, 2, 3, 10, 11, 25, 100].map((x) => arabicCount(x, 'pieces')), ['0 قطع', 'قطعة واحدة', 'قطعتين', '3 قطع', '10 قطع', '11 قطعة', '25 قطعة', '100 قطعة']);
assert.deepEqual([1, 2, 3, 10, 11].map((x) => arabicCount(x, 'products')), ['منتج واحد', 'منتجين', '3 منتجات', '10 منتجات', '11 منتجًا']);
assert.equal(arabicCount('x', 'pieces'), 'x'); assert.equal(arabicCount(2.5, 'pieces'), '2.5'); assert.equal(arabicCount(-1, 'pieces'), '-1'); assert.equal(arabicCount(3, 'nope'), '3');
ok('Arabic counted nouns: 1 = واحدة, 2 = dual, 3-10 = plural, 11+ = singular (pieces and products); odd input is left as it is');
assert.equal(fixArabicCounts('أي 2 قطع بسعر 500'), 'أي قطعتين بسعر 500');
assert.equal(fixArabicCounts('أضف 1 قطع أخرى من 12 قطع'), 'أضف قطعة واحدة أخرى من 12 قطعة');
assert.equal(fixArabicCounts('12+ قطعة'), '12+ قطعة'); assert.equal(fixArabicCounts('5+ قطعة'), '5+ قطع');
assert.equal(fixArabicCounts('قطعة واحدة وقطع كثيرة'), 'قطعة واحدة وقطع كثيرة');
ok('the rewrite fixes the noun after a number, handles "N+", and leaves text without a number alone');
const inst = i18next.createInstance(); inst.use(arabicCountsProcessor);
await inst.init({ lng: 'ar', fallbackLng: 'en', postProcess: ['arabicCounts'], resources: { ar: { translation: ar }, en: { translation: en } }, interpolation: { escapeValue: false } });
assert.equal(inst.t('storefront.pkgLine', { n: 2, price: '500' }), 'أي قطعتين بسعر 500');
assert.equal(inst.t('storefront.pkgLine', { n: 11, price: '500' }), 'أي 11 قطعة بسعر 500');
assert.equal(inst.t('wall.pieces', { n: 7 }), '7 قطع'); assert.equal(inst.t('wall.pieces', { n: 19 }), '19 قطعة');
assert.equal(inst.t('storefront.productCount', { n: 2 }), 'منتجين'); assert.equal(inst.t('storefront.productCount', { n: 12 }), '12 منتجًا');
assert.equal(inst.t('storefront.pkgMore', { n: 2, pkg: 3, price: '500' }), 'أضف قطعتين أخرى لتكمل باقة جديدة من 3 قطع بسعر 500.');
assert.equal(inst.t('errors.TOO_MANY', { max: 500 }), 'يمكنك طلب حتى 500 قطعة من المنتج الواحد.');
ok('with the REAL translation library and the real ar.json: pieces / products read correctly for 2, 7, 11, 19, 500');
assert.equal(inst.t('dash.lowStock', { n: 3 }), ar.dash.lowStock.replace('{{n}}', '3'));
ok('a text that is not on the list (the admin\'s "3 منتج منخفض") is left exactly as written');
assert.equal(inst.t('storefront.pkgLine', { n: 2, price: '500', lng: 'en' }), 'Any 2 pieces for 500');
ok('English is never touched');
for (const k of ARABIC_COUNT_KEYS) {
  const get = (d) => k.split('.').reduce((o, x) => o?.[x], d);
  assert.ok(typeof get(ar) === 'string' && typeof get(en) === 'string', 'listed key missing: ' + k);
  assert.ok(/\{\{(n|min|max)\}\}/.test(get(ar)), 'no number placeholder in ' + k);
}
ok('every listed text exists in both languages and has a number placeholder (' + ARABIC_COUNT_KEYS.length + ' texts)');
const i18nSrc = read('i18n/i18n.js');
assert.ok(/\.use\(arabicCountsProcessor\)/.test(i18nSrc) && /postProcess: \['arabicCounts'\]/.test(i18nSrc));
ok('the shop\'s translation setup uses the Arabic counts');

// ----- 2. featured + categories -----
const mk = (id, extra = {}) => ({ id, name: { en: id }, price: 100, stock: 5, isActive: true, ...extra });
const list = [mk('a'), mk('b'), mk('c'), mk('d'), mk('e')];
assert.deepEqual(featuredProducts(list, 3).map((p) => p.id), ['a', 'b', 'c']);
ok('nothing ticked: the first ones, as before');
const f = [mk('a'), mk('b'), mk('c', { featured: true }), mk('d'), mk('e', { featured: true })];
assert.deepEqual(featuredProducts(f, 3).map((p) => p.id), ['c', 'e', 'a']);
assert.deepEqual(featuredProducts(f, 1).map((p) => p.id), ['c']);
ok('ticked products first (in the shop\'s order), the rest fill the home page');
const sold = [mk('a'), mk('b', { featured: true, stock: 0 }), mk('c', { featured: true })];
assert.deepEqual(featuredProducts(sold, 3).map((p) => p.id), ['c', 'a', 'b']);
ok('a sold-out featured product is not pushed to the front');
assert.deepEqual(featuredProducts(null, 4), []); assert.deepEqual(featuredProducts([null, mk('a')], 4).map((p) => p.id), ['a']);
ok('empty / broken lists are safe');

const cp = [mk('a', { category: { en: 'Plates', ar: 'لوحات' } }), mk('b', { category: { en: ' plates ', ar: 'لوحات' } }), mk('c', { category: { en: 'Displays', ar: 'حوامل' } }), mk('d'), mk('e', { category: { en: '', ar: 'حوامل' } })];
assert.equal(categoryKey(cp[0]), 'plates'); assert.equal(categoryKey(cp[1]), 'plates'); assert.equal(categoryKey(cp[3]), ''); assert.equal(categoryKey(cp[4]), 'حوامل');
assert.equal(categoryLabel(cp[0], 'ar'), 'لوحات'); assert.equal(categoryLabel(cp[0], 'en'), 'Plates'); assert.equal(categoryLabel(cp[4], 'en'), 'حوامل');
ok('a category is matched ignoring case and spaces; the label follows the language and falls back to the other one');
const cats = categoriesOf(cp, 'en');
assert.deepEqual(cats.map((c) => [c.label, c.count]), [['Plates', 2], ['Displays', 1], ['حوامل', 1]]);
assert.deepEqual(categoriesOf([mk('x')], 'en'), []); assert.deepEqual(categoriesOf(null, 'en'), []);
ok('one chip per category in first-seen order with its product count; products without a category make no chip');
assert.deepEqual(filterByCategory(cp, 'plates').map((p) => p.id), ['a', 'b']);
assert.equal(filterByCategory(cp, '').length, 5); assert.deepEqual(filterByCategory(cp, 'nope'), []);
ok('filtering by a category keeps only its products; no choice = all');

const PF = await (async () => {
  const outfile = path.join(root, 'tests', `.si-${process.pid}.cjs`);
  await build({ stdin: { contents: `import * as M from ${JSON.stringify(root + '/src/utils/productForm.js')}; module.exports = M;`, resolveDir: root, loader: 'js' }, bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error', define: { 'import.meta.env': '{}' } });
  const m = createRequire(import.meta.url)(outfile); fs.rmSync(outfile, { force: true }); return m;
})();
const form = { nameEn: 'x', nameAr: '', descriptionEn: '', descriptionAr: '', price: '10', priceTiers: [], minQty: '', maxQty: '', stock: '1', sku: '', shippingExtra: '', imageUrl: '', images: [], relatedIds: [], options: [], preorderMessageEn: '', preorderMessageAr: '' };
let rec = PF.productFields({ ...form, categoryEn: '  Plates ', categoryAr: '', featured: true });
assert.deepEqual(rec.category, { en: 'Plates', ar: 'Plates' }); assert.equal(rec.featured, true);
rec = PF.productFields({ ...form, categoryEn: '', categoryAr: 'لوحات' });
assert.deepEqual(rec.category, { en: 'لوحات', ar: 'لوحات' }); assert.equal(rec.featured, false);
rec = PF.productFields({ ...form });
assert.deepEqual(rec.category, { en: '', ar: '' }); assert.equal(rec.featured, false);
assert.equal(PF.productFields({ ...form, categoryEn: 'x'.repeat(90) }).category.en.length, 40);
assert.equal(PF.productFields({ ...form, featured: 'yes' }).featured, false);
ok('the saved product keeps a category (each language falls back to the other, cut at 40) and a real true/false featured');
const products = read('pages/admin/Products.jsx');
assert.ok(/data-category-featured/.test(products) && /categoryEn: p\.category\?\.en \|\| ''/.test(products) && /featured: p\.featured === true/.test(products));
for (const [g, k] of [['products', 'categoryEn'], ['products', 'categoryAr'], ['products', 'categoryHelp'], ['products', 'featuredCheck'], ['products', 'featuredHelp'], ['storefront', 'allCategories'], ['storefront', 'categories']]) assert.ok(en[g][k] && ar[g][k], k);
ok('the product form has the category boxes and the featured tick (loaded and saved); texts in both languages');

// ----- 3. wall picture -----
const palette = [{ id: 'k', label: 'Black', color: '#111111' }, { id: 'b', label: 'Blue', color: '#0000ff' }];
const cells = [{ q: 0, r: 0, c: 'k' }, { q: 1, r: 0, c: 'b' }, { q: 0, r: 1, c: '' }, { q: 1, r: 1, c: 'zzz' }];
const svg = wallPictureSvg(cells, palette);
assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.match(svg, /fill="#ffffff"/);
assert.equal((svg.match(/<polygon/g) || []).length, 4);
assert.ok(svg.includes('fill="#111111"') && svg.includes('fill="#0000ff"'));
assert.equal((svg.match(new RegExp('fill="' + WALL_PICTURE_NEUTRAL + '"', 'g')) || []).length, 2);
ok('the picture has one hexagon per piece in its colour, a white background; unpainted / unknown colours use the neutral colour');
assert.ok(!/<script|onload|javascript:/i.test(wallPictureSvg(cells, [{ id: 'k', color: '"><script>alert(1)</script>' }])));
assert.equal((wallPictureSvg([{ q: 0, r: 0, c: 'k' }], [{ id: 'k', color: 'red"/><x' }]).match(new RegExp(WALL_PICTURE_NEUTRAL, 'g')) || []).length, 1);
ok('a colour that is not a plain #hex code can never get into the picture');
assert.doesNotThrow(() => wallPictureSvg([], palette)); assert.doesNotThrow(() => wallPictureSvg(null, null));
ok('an empty wall does not crash');
const wd = read('components/storefront/WallDesigner.jsx');
assert.ok(/data-wall-save-picture/.test(wd) && /onClick=\{savePicture\}/.test(wd) && /downloadBlob\(blob, 'my-wall\.png'\)/.test(wd) && /say\('wall\.pictureFailed'\)/.test(wd));
assert.ok(/min-h-\[44px\][^"]*"\s+data-wall-save-picture|data-wall-save-picture/.test(wd));
for (const k of ['savePicture', 'pictureFailed']) assert.ok(en.wall[k] && ar.wall[k], k);
ok('the designer has a "Save this wall as a picture" button (44 px) with an error message; texts in both languages');
console.log('ALL ' + n + ' SMALL-IDEAS CHECKS PASSED');
