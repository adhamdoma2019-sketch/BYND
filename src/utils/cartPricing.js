// The price of each cart line, worked out from the WHOLE cart.
//
// Quantity prices count all lines of the same product together (6 gold + 4 black =
// 10 pieces), or, when the product counts each colour / choice separately (`tierGroup`: the id of
// that option), the lines with the same colour / choice (6 gold = 6, 4 black = 4).
// Either way a line's price depends on the other lines. The cart keeps, for each
// line, the product's normal price, the extras of the chosen options and the price steps;
// this function turns them into the price per piece to show.
// (The server works out the real price again when the order is placed.)
import { groupKeyOf, lineAmount, packageAddition, packageProgress, tierFor } from './quantityPrices.js';

export { lineAmount };

const cents = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const groupOf = (i) => `${i.productId}|${groupKeyOf(i.tierGroup, i.selections)}`;

export function priceCartLines(items) {
  // Package price ("every 3 pieces cost 500"): the lines of one product share the package total exactly.
  const byProduct = new Map(); // productId -> [index of its package lines]
  items.forEach((i, k) => {
    if (i.pkg && i.basePrice !== undefined) byProduct.set(i.productId, [...(byProduct.get(i.productId) || []), k]);
  });
  const pkgShare = new Map(); // index -> { baseTotal, packages }
  for (const idxs of byProduct.values()) {
    const first = items[idxs[0]];
    const shares = packageAddition(
      first.pkg,
      Number(first.basePrice) || 0,
      first.tierGroup,
      [],
      idxs.map((k) => items[k])
    );
    idxs.forEach((k, j) => pkgShare.set(k, shares[j]));
  }
  const totals = new Map(); // pieces per product (or per product + colour when counted separately)
  for (const i of items) totals.set(groupOf(i), (totals.get(groupOf(i)) || 0) + (Number(i.quantity) || 0));
  return items.map((i, k) => {
    const share = pkgShare.get(k);
    if (share) {
      const q = Number(i.quantity) || 0;
      const lineTotal = cents(share.baseTotal + (Number(i.priceDelta) || 0) * q);
      return {
        ...i,
        lineTotal,
        unitPrice: q > 0 ? cents(lineTotal / q) : i.unitPrice,
        tierMinQty: 0,
        packageSize: share.packages > 0 ? i.pkg.qty : 0,
      };
    }
    // Old carts (before update 19) have no price steps: keep their saved price.
    if (!Array.isArray(i.tiers) || i.basePrice === undefined) return i;
    const tier = tierFor({ price: i.basePrice, priceTiers: i.tiers }, totals.get(groupOf(i)) || 0);
    const base = tier ? tier.price : Number(i.basePrice) || 0;
    return { ...i, unitPrice: base + (Number(i.priceDelta) || 0), tierMinQty: tier ? tier.minQty : 0 };
  });
}

// How many pieces of a product the cart holds in all its lines.
export function productCountInCart(items, productId) {
  return items.reduce((n, i) => (i.productId === productId ? n + (Number(i.quantity) || 0) : n), 0);
}

// Pieces already in the cart that count together with a new piece: the same product and, when the
// product counts a colour / choice option separately, the same choice in that option.
export function groupCountInCart(items, productId, optionId, selections) {
  const key = groupKeyOf(optionId, selections);
  return items.reduce(
    (n, i) =>
      i.productId === productId && groupKeyOf(optionId, i.selections) === key ? n + (Number(i.quantity) || 0) : n,
    0
  );
}

// Package price hint for a cart line: how many more pieces (of the same colour / choice, when the product counts
// them separately) complete the next package. null = the line has no package price or nothing is missing.
export function packageHintFor(items, item) {
  if (!item?.pkg) return null;
  const pieces = items.reduce(
    (n, i) =>
      i.productId === item.productId && groupKeyOf(item.tierGroup, i.selections) === groupKeyOf(item.tierGroup, item.selections)
        ? n + (Number(i.quantity) || 0)
        : n,
    0
  );
  const { missing } = packageProgress(item.pkg, pieces);
  return missing > 0 ? { missing, qty: item.pkg.qty, price: item.pkg.price } : null;
}
