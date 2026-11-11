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
