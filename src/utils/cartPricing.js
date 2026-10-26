// The price of each cart line, worked out from the WHOLE cart.
//
// Quantity prices count all lines of the same product together (6 gold + 4 black =
// 10 pieces), so a line's price depends on the other lines. The cart keeps, for each
// line, the product's normal price, the extras of the chosen options and the price steps;
// this function turns them into the price per piece to show.
// (The server works out the real price again when the order is placed.)
import { tierFor } from './quantityPrices.js';

export function priceCartLines(items) {
  const totals = new Map();
  for (const i of items) totals.set(i.productId, (totals.get(i.productId) || 0) + (Number(i.quantity) || 0));
  return items.map((i) => {
    // Old carts (before update 19) have no price steps: keep their saved price.
    if (!Array.isArray(i.tiers) || i.basePrice === undefined) return i;
    const tier = tierFor({ price: i.basePrice, priceTiers: i.tiers }, totals.get(i.productId) || 0);
    const base = tier ? tier.price : Number(i.basePrice) || 0;
    return { ...i, unitPrice: base + (Number(i.priceDelta) || 0), tierMinQty: tier ? tier.minQty : 0 };
  });
}

// How many pieces of a product the cart holds in all its lines.
export function productCountInCart(items, productId) {
  return items.reduce((n, i) => (i.productId === productId ? n + (Number(i.quantity) || 0) : n), 0);
}
