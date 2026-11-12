import { productStatus } from './storefront.js';

// Update 42: how the shop lists its products (home "featured" + the separate Products page).
// Pure rules, no screen code, so they are tested on their own.

// How many products the home page shows before "View all products".
export const FEATURED_COUNT = 4;

// Update 57: the shop chooses how many products the home page shows (Admin > Settings > Banner).
// 0 = none (only a "Shop all products" button), otherwise 2 / 4 / 6 / 8; a shop that never chose gets 4 (as before).
export const HOME_COUNT_CHOICES = [0, 2, 4, 6, 8];
export const MAX_HOME_COUNT = 12;
export function cleanHomeCount(value) {
  if (value === '' || value === null || value === undefined) return FEATURED_COUNT;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= MAX_HOME_COUNT ? n : FEATURED_COUNT;
}
export function homeProductCount(tenant) {
  return cleanHomeCount(tenant?.homeProductCount);
}

// The shop's normal order, with one premium touch: products a customer cannot buy right now
// (sold out) go to the END, so the first things a visitor sees are things they can order.
// Everything else keeps the order it came in (a stable sort, nothing is re-arranged).
export function displayOrder(products) {
  const list = Array.isArray(products) ? products.filter(Boolean) : [];
  const buyableFirst = [];
  const soldOut = [];
  for (const p of list) (productStatus(p) === 'soldOut' ? soldOut : buyableFirst).push(p);
  return [...buyableFirst, ...soldOut];
}

// Home page: the first FEATURED_COUNT products of the display order.
// The home page picks: the products the shop ticked as "featured" first (if they can be bought), then the
// others in the shop's order, sold-out ones last. Nothing ticked = the first ones, as before.
export function featuredProducts(products, count = FEATURED_COUNT) {
  const list = Array.isArray(products) ? products.filter(Boolean) : [];
  const ticked = list.filter((p) => p.featured === true && productStatus(p) !== 'soldOut');
  const rest = list.filter((p) => !(p.featured === true && productStatus(p) !== 'soldOut'));
  return [...ticked, ...displayOrder(rest)].slice(0, count);
}

// ----- categories (update 59): the shop writes a category on each product; the Products page shows
// one chip per category that exists (and "All") when there are at least two. -----
export function categoryKey(product) {
  return String(product?.category?.en || product?.category?.ar || '').trim().toLowerCase();
}
export function categoryLabel(product, language) {
  const c = product?.category || {};
  const pick = language === 'ar' ? c.ar || c.en : c.en || c.ar;
  return String(pick || '').trim();
}
export function categoriesOf(products, language) {
  const out = [];
  const seen = new Map();
  for (const p of Array.isArray(products) ? products : []) {
    const key = categoryKey(p);
    if (!key) continue;
    if (seen.has(key)) {
      seen.get(key).count += 1;
    } else {
      const entry = { key, label: categoryLabel(p, language), count: 1 };
      seen.set(key, entry);
      out.push(entry);
    }
  }
  return out;
}
export function filterByCategory(products, key) {
  const list = Array.isArray(products) ? products : [];
  return key ? list.filter((p) => categoryKey(p) === key) : list;
}

// The "View all products" button only exists when there is more than the home page shows
// (a shop with 4 products or fewer gets no pointless extra page link).
export function hasMoreThanFeatured(products, count = FEATURED_COUNT) {
  return Array.isArray(products) && products.length > count;
}

export const SORT_MODES = ['featured', 'priceLow', 'priceHigh'];

// Sort for the Products page. Unknown mode = the normal order. Sold-out products stay at the end
// in every mode (a cheap sold-out item must not sit first). Equal prices keep their normal order.
export function sortProducts(products, mode = 'featured') {
  const ordered = displayOrder(products);
  if (mode !== 'priceLow' && mode !== 'priceHigh') return ordered;
  const price = (p) => (Number.isFinite(Number(p.price)) ? Number(p.price) : 0);
  const dir = mode === 'priceLow' ? 1 : -1;
  const isOut = (p) => productStatus(p) === 'soldOut';
  const indexed = ordered.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => {
    const outDiff = Number(isOut(a.p)) - Number(isOut(b.p));
    if (outDiff !== 0) return outDiff;
    const diff = (price(a.p) - price(b.p)) * dir;
    return diff !== 0 ? diff : a.i - b.i;
  });
  return indexed.map((x) => x.p);
}
