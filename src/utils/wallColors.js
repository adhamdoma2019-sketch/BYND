// Wall designer, colours (update 28): the colour of each piece, and how a coloured wall becomes cart lines.
//
// A piece is { q, r, c } where `c` is the id of a value of the product's colour option.
// The product's colour option for the wall = its FIRST colour list that has values and no "show only when" rule.
// A wall with 3 black + 3 blue pieces is added to the cart as TWO lines (black x3, blue x3). The server, the stock
// per colour and the quantity prices (also "the same colour offer") already work with lines like that.
import { resolveChoice } from './productOptions.js';
import { cleanPackage, lineAmount, packageAddition, tierGroupOption, unitBasePrice } from './quantityPrices.js';
import { groupCountInCart, productCountInCart } from './cartPricing.js';
import { isOptionCounted, leftForSelections } from './optionStock.js';

export function wallColorOption(product) {
  return (
    (product?.options || []).find(
      (o) => o && o.type === 'color' && !o.showWhen && Array.isArray(o.values) && o.values.length > 0
    ) || null
  );
}

// The palette the customer paints with.
export function wallPalette(product, language = 'en') {
  const opt = wallColorOption(product);
  if (!opt) return null;
  return opt.values.map((v) => ({
    id: v.id,
    label: v.label?.[language] || v.label?.en || '',
    color: v.color || '#999999',
  }));
}

// How many pieces of this colour can be ordered (Infinity = no limit: made to order, or stock not counted per colour).
export function colourLimit(product, selections, colorOpt, valueId) {
  if (!product || product.isPreorder === true || product.backorder === true) return Infinity;
  if (!isOptionCounted(product)) return Infinity;
  const left = leftForSelections(product, { ...(selections || {}), [colorOpt.id]: valueId });
  return left === null ? Infinity : Math.max(Number(left) || 0, 0);
}

export function colourCounts(cells) {
  const m = new Map();
  for (const c of cells) if (c.c) m.set(c.c, (m.get(c.c) || 0) + 1);
  return m;
}

// Give every piece without a (valid) colour one: the picked colour while it has room, else the next colour with room.
// Update 33: when NO colour is picked (`paint` is not in the palette) the pieces stay unpainted (c = ''): a wall never
// starts in a colour the customer did not choose.
export function assignColours(cells, paletteIds, limitOf, paint) {
  const valid = new Set(paletteIds);
  const counts = new Map();
  for (const c of cells) if (valid.has(c.c)) counts.set(c.c, (counts.get(c.c) || 0) + 1);
  return cells.map((c) => {
    if (valid.has(c.c)) return c;
    if (!valid.has(paint)) return c.c ? { ...c, c: '' } : c; // nothing picked yet: unpainted
    const pick = [paint, ...paletteIds].find((id) => valid.has(id) && (counts.get(id) || 0) < limitOf(id)) || paint;
    counts.set(pick, (counts.get(pick) || 0) + 1);
    return { ...c, c: pick };
  });
}

// True while at least one piece has no colour yet (the wall cannot be added to the cart then).
export const hasUnpainted = (cells) => (cells || []).some((c) => !c.c);

// Same number of pieces of each colour, mixed up (used by "Random").
export function shuffleColours(colours, rand = Math.random) {
  const a = [...colours];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The cart lines of a coloured wall, with the price of each (the server works the real price out again).
export function wallLines({ product, selections, cells, cartItems = [], colorOpt }) {
  const counts = colourCounts(cells);
  const total = cells.length;
  const groupOption = tierGroupOption(product);
  const inCart = productCountInCart(cartItems, product.id);
  const pkg = cleanPackage(product);
  const colours = colorOpt.values.filter((v) => counts.has(v.id));
  // Package price: the pieces of the wall are added to what the cart already holds of this product.
  const shares = pkg
    ? packageAddition(
        pkg,
        Number(product.price) || 0,
        groupOption,
        cartItems
          .filter((i) => i.productId === product.id)
          .map((i) => ({ selections: i.selections, quantity: i.quantity })),
        colours.map((v) => ({ selections: { ...(selections || {}), [colorOpt.id]: v.id }, quantity: counts.get(v.id) }))
      )
    : null;
  const lines = colours.map((v, idx) => {
    const quantity = counts.get(v.id);
    const sel = { ...(selections || {}), [colorOpt.id]: v.id };
    const choice = resolveChoice(product, sel);
    if (shares) {
      // exact line total (its share of the packages + the colour's extra per piece)
      const lineTotal = Math.round((shares[idx].baseTotal + choice.priceDelta * quantity) * 100) / 100;
      return {
        colorId: v.id,
        quantity,
        selections: sel,
        choice,
        lineTotal,
        unitPrice: Math.round((lineTotal / quantity) * 100) / 100,
        packageSize: shares[idx].packages > 0 ? pkg.qty : 0,
      };
    }
    // pieces that count together for the price step
    const together = !groupOption
      ? inCart + total
      : groupCountInCart(cartItems, product.id, groupOption, sel) + (groupOption === colorOpt.id ? quantity : total);
    const unitPrice = unitBasePrice(product, together) + choice.priceDelta;
    return { colorId: v.id, quantity, selections: sel, choice, unitPrice };
  });
  return {
    lines,
    total,
    subtotal: lines.reduce((s, l) => s + lineAmount(l), 0),
    missing: lines[0]?.choice.missing || [],
  };
}
