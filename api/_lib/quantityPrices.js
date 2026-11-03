// Quantity prices ("the more you buy, the less each one costs") and the
// minimum / maximum a customer can order of one product.
//
// IMPORTANT: this file exists TWICE and both copies must be identical:
//   src/utils/quantityPrices.js   (the browser: shows the price)
//   api/_lib/quantityPrices.js    (the server: the REAL price of an order)
// A test fails if they ever differ. It has no imports on purpose.
//
// A product stores `priceTiers: [{ minQty, price }]`, for example
//   price 100 (normal), tiers [{ minQty: 5, price: 90 }, { minQty: 10, price: 85 }]
//   1-4 pieces = 100 each, 5-9 = 90 each, 10 or more = 85 each.
// By default the count is the TOTAL of that product in the order (all colours together).
// A product can instead count the pieces SEPARATELY for each choice of one colour / choice option
// (`tierGroupOption`: the id of that option), so "3 or more of the SAME colour" gets the step price.
// Extras of a choice (e.g. +50 for a plate) are added on top, per piece.

export const MAX_TIERS = 6; // price steps on one product (besides the normal price)
export const SAFETY_MAX_QTY = 500; // most pieces of one product in one order (stops typing mistakes and abuse)

const toNumber = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

// The valid price steps, sorted: quantity is a whole number of 2 or more, each step
// has a bigger quantity AND a lower price than the one before (the first one is
// compared with the normal price). Anything else is ignored.
export function cleanTiers(raw, basePrice) {
  if (!Array.isArray(raw)) return [];
  const rows = raw
    .map((r) => ({ minQty: toNumber(r?.minQty), price: toNumber(r?.price) }))
    .filter((r) => Number.isInteger(r.minQty) && r.minQty >= 2 && Number.isFinite(r.price) && r.price >= 0)
    .sort((a, b) => a.minQty - b.minQty);
  const out = [];
  let lastQty = 1;
  let lastPrice = Number(basePrice);
  for (const r of rows) {
    if (r.minQty <= lastQty) continue; // same quantity twice
    if (Number.isFinite(lastPrice) && r.price >= lastPrice) continue; // not cheaper than the step before
    out.push({ minQty: r.minQty, price: r.price });
    lastQty = r.minQty;
    lastPrice = r.price;
    if (out.length >= MAX_TIERS) break;
  }
  return out;
}

// For the product form: what is wrong with the rows the owner typed? '' = fine.
// Rows with both boxes empty are ignored. Codes: 'incomplete' | 'qty' | 'price' | 'order' | 'many'.
export function tiersProblem(rows, basePrice) {
  const filled = (Array.isArray(rows) ? rows : []).filter(
    (r) => String(r?.minQty ?? '').trim() !== '' || String(r?.price ?? '').trim() !== ''
  );
  if (filled.length > MAX_TIERS) return 'many';
  let lastQty = 1;
  let lastPrice = Number(basePrice);
  const sorted = filled
    .map((r) => ({ minQty: toNumber(r.minQty), price: toNumber(r.price), raw: r }))
    .sort((a, b) => (a.minQty || 0) - (b.minQty || 0));
  for (const r of sorted) {
    if (Number.isNaN(r.minQty) || Number.isNaN(r.price)) return 'incomplete';
    if (!Number.isInteger(r.minQty) || r.minQty < 2) return 'qty';
    if (!Number.isFinite(r.price) || r.price < 0) return 'price';
    if (r.minQty <= lastQty) return 'order';
    if (Number.isFinite(lastPrice) && r.price >= lastPrice) return 'price';
    lastQty = r.minQty;
    lastPrice = r.price;
  }
  return '';
}

// The price step that applies to this many pieces of a product (null = the normal price).
export function tierFor(product, totalQty) {
  const tiers = cleanTiers(product?.priceTiers, product?.price);
  let found = null;
  for (const t of tiers) if (totalQty >= t.minQty) found = t;
  return found;
}

// The price of ONE piece (before the extras of the customer's choices) when the order has
// `totalQty` pieces of this product.
export function unitBasePrice(product, totalQty) {
  const tier = tierFor(product, totalQty);
  return tier ? tier.price : Number(product?.price) || 0;
}

// The shop's limits for one product. min: 1 = none. max: never above SAFETY_MAX_QTY.
export function orderLimits(product) {
  const rawMin = Number(product?.minQty);
  const min = Number.isInteger(rawMin) && rawMin >= 2 ? Math.min(rawMin, SAFETY_MAX_QTY) : 1;
  const rawMax = Number(product?.maxQty);
  const max =
    Number.isInteger(rawMax) && rawMax >= 1 ? Math.min(Math.max(rawMax, min), SAFETY_MAX_QTY) : SAFETY_MAX_QTY;
  return { min, max };
}

// Is this total OK for the product? null = fine, otherwise { code, min } or { code, max }.
export function checkTotalQty(product, totalQty) {
  const { min, max } = orderLimits(product);
  if (totalQty < min) return { code: 'BELOW_MIN', min };
  if (totalQty > max) return { code: 'TOO_MANY', max };
  return null;
}

// "15" for a step that is 15% cheaper than the normal price (whole numbers, rounded down so we never over-promise).
export function savingPercent(basePrice, price) {
  const base = Number(basePrice);
  if (!(base > 0) || !(Number(price) < base)) return 0;
  return Math.floor(((base - Number(price)) / base) * 100);
}

// ----- Counting the price steps: together (default) or separately for each choice of one option -----

// The option (a colour or choice list of the product) whose choices are counted separately.
// '' = all pieces of the product count together. Anything that is not a colour / choice option of the product is ignored.
export function tierGroupOption(product) {
  const id = product?.tierGroupOption;
  if (!id || !Array.isArray(product?.options)) return '';
  const option = product.options.find((o) => o && o.id === id);
  return option && (option.type === 'color' || option.type === 'choice') ? id : '';
}

// The group a line belongs to for the price steps: the value chosen in that option ('' = no group / not chosen).
export function groupKeyOf(optionId, selections) {
  if (!optionId) return '';
  const chosen = selections?.[optionId];
  return typeof chosen === 'string' ? chosen : '';
}

// Pieces per group. `lines` = [{ selections, quantity }] of ONE product. Returns a Map(groupKey -> pieces).
export function groupQuantities(optionId, lines) {
  const out = new Map();
  for (const line of lines) {
    const key = groupKeyOf(optionId, line.selections);
    out.set(key, (out.get(key) || 0) + (Number(line.quantity) || 0));
  }
  return out;
}

// ----- Package price: "every N pieces cost P" (a fixed price for a full package) -----
//
// A product stores `packageQty` (N, a whole number of 2 or more) and `packagePrice` (P).
// Example: normal price 200, package 3 for 500 -> 1 = 200, 2 = 400, 3 = 500, 4 = 700, 5 = 900, 6 = 1000.
// Pieces that do not fill a package cost the normal price. The pieces are counted together or
// separately for each choice of one option, exactly like the quantity prices (`tierGroupOption`).
// A product uses EITHER price steps OR a package price: when a valid package is set the steps are ignored.
// The package price is exact: the lines of a group always add up to the package total (see packageAddition).

const cents = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// The valid package of a product ({ qty, price }) or null. It must be cheaper than buying the same pieces one by one.
export function cleanPackage(product) {
  const qty = toNumber(product?.packageQty);
  const price = toNumber(product?.packagePrice);
  const base = Number(product?.price);
  if (!Number.isInteger(qty) || qty < 2 || qty > SAFETY_MAX_QTY) return null;
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(base) || !(price < qty * base)) return null;
  return { qty, price: cents(price) };
}

// For the product form: what is wrong with the package the owner typed? '' = fine (or nothing typed).
// Codes: 'incomplete' | 'qty' | 'price' | 'notCheaper'.
export function packageProblem(qtyText, priceText, basePrice) {
  const q = String(qtyText ?? '').trim();
  const p = String(priceText ?? '').trim();
  if (q === '' && p === '') return '';
  if (q === '' || p === '') return 'incomplete';
  const qty = Number(q);
  const price = Number(p);
  if (!Number.isInteger(qty) || qty < 2 || qty > SAFETY_MAX_QTY) return 'qty';
  if (!Number.isFinite(price) || price < 0) return 'price';
  if (!(price < qty * Number(basePrice))) return 'notCheaper';
  return '';
}

// What `pieces` pieces cost (before the extras of the choices) when they are in ONE group.
export function packageGroupTotal(pkg, basePrice, pieces) {
  const n = Math.max(0, Math.floor(Number(pieces) || 0));
  const packs = Math.floor(n / pkg.qty);
  return cents(packs * pkg.price + (n - packs * pkg.qty) * (Number(basePrice) || 0));
}

// Packages and the pieces left over for `pieces` pieces of one group.
export function packageProgress(pkg, pieces) {
  const n = Math.max(0, Math.floor(Number(pieces) || 0));
  const packages = Math.floor(n / pkg.qty);
  const rest = n - packages * pkg.qty;
  return { packages, rest, missing: rest === 0 ? 0 : pkg.qty - rest };
}

// What it costs to ADD `newLines` ([{ selections, quantity }]) to `existingLines` (the same product,
// already in the cart; pass [] for a whole order). Returns, for each new line, { baseTotal, packages }:
//   baseTotal = its share of the extra cost (before the choices' extras), `packages` = full packages
//   in its group after adding. The shares of one group add up to EXACTLY the group's extra cost
//   (cumulative rounding), so a package of 3 for 500 is always 500.00 and never 500.01.
export function packageAddition(pkg, basePrice, groupOptionId, existingLines, newLines) {
  const before = groupQuantities(groupOptionId, existingLines || []);
  const adding = groupQuantities(groupOptionId, newLines);
  const given = new Map(); // group -> pieces of the new lines already handed their share
  return newLines.map((line) => {
    const key = groupKeyOf(groupOptionId, line.selections);
    const had = before.get(key) || 0;
    const add = adding.get(key) || 0;
    const extra = cents(packageGroupTotal(pkg, basePrice, had + add) - packageGroupTotal(pkg, basePrice, had));
    const done = given.get(key) || 0;
    const now = done + (Number(line.quantity) || 0);
    given.set(key, now);
    const share = add > 0 ? cents(cents((extra * now) / add) - cents((extra * done) / add)) : 0;
    return { baseTotal: share, packages: Math.floor((had + add) / pkg.qty) };
  });
}

// What a line costs: its exact total when it has one (package prices), else price x quantity.
export function lineAmount(line) {
  if (line && line.lineTotal !== undefined && line.lineTotal !== null && Number.isFinite(Number(line.lineTotal))) {
    return cents(line.lineTotal);
  }
  return cents((Number(line?.unitPrice) || 0) * (Number(line?.quantity) || 0));
}

