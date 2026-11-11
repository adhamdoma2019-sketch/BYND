// Design step 6: ready-made example walls the customer can start from with one tap.
// Pure and tested. Only examples that fit the product's limits (the shop's minimum and the
// largest wall it allows) are offered, so an example can never break an order rule: every example
// is one connected piece, built with the same layout rules as everything else.
import { resizeLayout, isConnected, WALL_MAX } from './wallLayout.js';

export const SAMPLE_DEFS = [
  { id: 'starter', n: 7, kind: 'flower' }, // a middle piece with its six neighbours
  { id: 'flower', n: 19, kind: 'flower' }, // a big hexagon: two rings
  { id: 'row', n: 8, kind: 'row' }, // one wide row
];

export function sampleCells(def) {
  if (def.kind === 'row') {
    const start = -Math.floor(def.n / 2);
    return Array.from({ length: def.n }, (_, i) => ({ q: start + i, r: 0 }));
  }
  return resizeLayout([], def.n, { min: 1, max: WALL_MAX });
}

// The examples that fit `min` .. `cap` pieces, each with its pieces.
export function availableSamples(min = 1, cap = WALL_MAX) {
  return SAMPLE_DEFS.filter((d) => d.n >= min && d.n <= cap)
    .map((d) => ({ ...d, cells: sampleCells(d) }))
    .filter((d) => d.cells.length === d.n && isConnected(d.cells));
}

// ---------------------------------------------------------------------------------------------
// "Arrange" button: tidy, different arrangements of the SAME number of pieces, one per tap.
// Every arrangement is exactly `n` pieces in one connected piece with no holes (rows of the honeycomb
// laid out like a neat brick wall, or the compact flower). Pure and tested.
// ---------------------------------------------------------------------------------------------

export function shapeSignature(cells) {
  if (!cells.length) return '';
  const mq = Math.min(...cells.map((c) => c.q));
  const mr = Math.min(...cells.map((c) => c.r));
  return cells.map((c) => `${c.q - mq},${c.r - mr}`).sort().join('|');
}

function centred(cells) {
  const mq = Math.round(cells.reduce((s, c) => s + c.q, 0) / cells.length);
  const mr = Math.round(cells.reduce((s, c) => s + c.r, 0) / cells.length);
  return cells.map((c) => ({ q: c.q - mq, r: c.r - mr }));
}

// `k` rows of (nearly) equal length, stacked like a brick wall. Row r is shifted by floor(r/2) so the
// block looks straight on screen (pointy-top honeycomb); the first piece of every row touches the row below.
function rowsPattern(n, k) {
  const base = Math.floor(n / k);
  const extra = n % k;
  const out = [];
  for (let r = 0; r < k; r += 1) {
    const w = base + (r < extra ? 1 : 0);
    for (let c = 0; c < w; c += 1) out.push({ q: c - Math.floor(r / 2), r });
  }
  return centred(out);
}

// The tidy arrangements of `n` pieces, in the order they are offered. Duplicates are removed.
export function arrangementsFor(n) {
  if (!Number.isInteger(n) || n < 3 || n > WALL_MAX) return [];
  const defs = [{ id: 'compact', cells: centred(resizeLayout([], n, { min: 1, max: WALL_MAX })) }];
  for (let k = 2; k <= Math.min(6, Math.floor(n / 2)); k += 1) defs.push({ id: `rows${k}`, cells: rowsPattern(n, k) });
  if (n <= 12) defs.push({ id: 'row', cells: rowsPattern(n, 1) });
  if (n >= 6 && n <= 30) defs.push({ id: 'tall', cells: rowsPattern(n, Math.ceil(n / 2)) });
  const seen = new Set();
  return defs.filter((d) => {
    if (d.cells.length !== n || !isConnected(d.cells)) return false;
    const sig = shapeSignature(d.cells);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

// The arrangement to show next: the one after `lastId` in the list that is not the wall's current shape.
// Returns { id, cells } or null when there is nothing different to offer.
export function nextArrangement(cells, lastId) {
  const list = arrangementsFor(cells.length);
  if (list.length === 0) return null;
  const now = shapeSignature(cells);
  const start = list.findIndex((d) => d.id === lastId);
  for (let i = 1; i <= list.length; i += 1) {
    const cand = list[(start + i + list.length) % list.length];
    if (shapeSignature(cand.cells) !== now) return cand;
  }
  return null;
}

// Colours kept tidy: the same number of each colour, grouped in palette order (bands), unpainted last.
export function groupedColours(colours, paletteIds) {
  const order = [...paletteIds];
  const rank = (c) => (order.includes(c) ? order.indexOf(c) : order.length + (c ? 1 : 2));
  return [...colours].sort((a, b) => rank(a) - rank(b));
}
