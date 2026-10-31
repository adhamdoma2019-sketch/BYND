// Wall designer, saved with the order (update 29).
//
// The browser sends, next to the order lines, the wall(s) the customer planned:
//   walls: [{ id, productId, cells: [{ q, r, c }] }]      (c = id of a colour of the product)
// and each order line that belongs to a wall carries its wallId.
// This file checks that what was planned is REAL (it is the server that decides): the product has the wall
// designer switched on, at most 60 pieces, ONE connected piece, valid colours, and the number of pieces of
// each colour equals the quantity of the order lines of that colour. What is saved in the order is built
// from the product's own data (colour names and codes come from the product, not from the browser).
import { OrderError } from './errors.js';
import { WALL_MAX, keyOf, isConnected } from './wallLayout.js';

const MAX_WALLS = 10; // walls in one order
const BAD = () => new OrderError(400, 'BAD_WALL', 'This wall design is not valid. Please plan the wall again.');

export const cleanWallId = (value) => {
  const id = String(value ?? '').trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : '';
};

// The wall's colour list = the product's FIRST colour option (same rule as src/utils/wallColors.js).
export function wallColorOption(product) {
  return (
    (product?.options || []).find(
      (o) => o && o.type === 'color' && !o.showWhen && Array.isArray(o.values) && o.values.length > 0
    ) || null
  );
}

// Checks only the SHAPE of what the browser sent (the real checks are in buildWalls).
export function cleanWallsInput(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > MAX_WALLS) throw BAD();
  return raw.map((w) => {
    const id = cleanWallId(w?.id);
    const productId = String(w?.productId ?? '').trim().slice(0, 100);
    if (!id || !productId || !Array.isArray(w?.cells) || w.cells.length < 1 || w.cells.length > WALL_MAX) throw BAD();
    const cells = w.cells.map((c) => {
      const q = Number(c?.q);
      const r = Number(c?.r);
      if (!Number.isInteger(q) || !Number.isInteger(r) || Math.abs(q) > 200 || Math.abs(r) > 200) throw BAD();
      return { q, r, c: String(c?.c ?? '').slice(0, 60) };
    });
    return { id, productId, cells };
  });
}

// items: the order lines ({ productId, quantity, selections, wallId }) after the hidden answers were removed.
// productInfo: Map productId -> { product }. Returns the walls to save in the order.
export function buildWalls(walls, items, productInfo) {
  const byId = new Map();
  for (const w of walls) {
    if (byId.has(w.id)) throw BAD(); // two walls with the same id
    byId.set(w.id, w);
  }
  // every line that says it belongs to a wall needs that wall (for the same product)
  for (const item of items) {
    if (!item.wallId) continue;
    const w = byId.get(item.wallId);
    if (!w || w.productId !== item.productId) throw BAD();
  }

  return walls.map((w) => {
    const info = productInfo.get(w.productId);
    const product = info?.product;
    if (!product || product.wallDesigner !== true) throw BAD();

    const lines = items.filter((i) => i.wallId === w.id);
    if (lines.length === 0) throw BAD();

    const keys = new Set(w.cells.map(keyOf));
    if (keys.size !== w.cells.length || !isConnected(w.cells)) throw BAD();
    const pieces = lines.reduce((s, l) => s + l.quantity, 0);
    if (pieces !== w.cells.length) throw BAD();

    const colorOpt = wallColorOption(product);
    let cells = w.cells.map(({ q, r }) => ({ q, r }));
    let colors = [];
    if (colorOpt) {
      const byColour = new Map(colorOpt.values.map((v) => [v.id, v]));
      const counts = new Map();
      for (const c of w.cells) {
        if (!byColour.has(c.c)) throw BAD();
        counts.set(c.c, (counts.get(c.c) || 0) + 1);
      }
      const ordered = new Map();
      for (const l of lines) {
        const id = l.selections?.[colorOpt.id];
        ordered.set(id, (ordered.get(id) || 0) + l.quantity);
      }
      // the same colours, the same numbers
      if (ordered.size !== counts.size) throw BAD();
      for (const [id, n] of counts) if (ordered.get(id) !== n) throw BAD();

      cells = w.cells.map(({ q, r, c }) => ({ q, r, c, h: byColour.get(c).color || '' }));
      colors = colorOpt.values
        .filter((v) => counts.has(v.id))
        .map((v) => ({ id: v.id, label: v.label || {}, color: v.color || '', count: counts.get(v.id) }));
    }
    return {
      id: w.id,
      productId: w.productId,
      productName: product.name || {},
      count: w.cells.length,
      cells,
      colors,
    };
  });
}
