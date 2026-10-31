// Wall designer (update 29): what the browser sends with an order, and the pictures shown after ordering.

// The cart lines that belong to a planned wall carry a wallId; the FIRST line of each wall also keeps the pieces
// (wallCells: [{ q, r, c, h }]). The order gets the lines (with their wallId) and the walls ({ id, productId, cells }).
// A wall whose pieces are missing (an old cart) is sent as normal lines.
export function wallParts(items) {
  const walls = new Map();
  for (const i of items || []) {
    if (i.wallId && Array.isArray(i.wallCells) && i.wallCells.length > 0 && !walls.has(i.wallId)) {
      walls.set(i.wallId, {
        id: i.wallId,
        productId: i.productId,
        cells: i.wallCells.map(({ q, r, c }) => ({ q, r, c: c || '' })),
      });
    }
  }
  const lines = (items || []).map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    selections: i.selections || {},
    ...(walls.has(i.wallId) ? { wallId: i.wallId } : {}),
  }));
  return { lines, walls: [...walls.values()] };
}

// Small pictures for the "order placed" page (taken from the cart before it is emptied).
export function wallPictures(items) {
  const out = [];
  for (const i of items || []) {
    if (i.wallId && Array.isArray(i.wallCells) && i.wallCells.length > 0) {
      out.push({ id: i.wallId, cells: i.wallCells.map(({ q, r, h }) => ({ q, r, h: h || '' })) });
    }
  }
  return out;
}
