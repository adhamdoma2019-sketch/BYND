import { productStatus } from './storefront.js';

// Update 42: how the shop lists its products (home "featured" + the separate Products page).
// Pure rules, no screen code, so they are tested on their own.

// How many products the home page shows before "View all products".
export const FEATURED_COUNT = 4;

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
export function featuredProducts(products, count = FEATURED_COUNT) {
  return displayOrder(products).slice(0, count);
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
