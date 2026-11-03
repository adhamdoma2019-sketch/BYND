import { lineAmount } from './quantityPrices.js';
// The cart lines of one planned wall are shown together as ONE wall (cart drawer, checkout); other lines stay as they are.
// Returns rows: { item } for a normal line, { wallId, lines: [...] } for a wall (in the order of the cart).
export function groupCartRows(items) {
  const rows = [];
  for (const item of items || []) {
    if (!item.wallId) rows.push({ item });
    else {
      const row = rows.find((r) => r.wallId === item.wallId);
      if (row) row.lines.push(item);
      else rows.push({ wallId: item.wallId, lines: [item] });
    }
  }
  return rows;
}

// pieces and money of a wall's lines
export const wallPieces = (lines) => lines.reduce((n, l) => n + l.quantity, 0);
export const wallMoney = (lines) => lines.reduce((s, l) => s + lineAmount(l), 0);
