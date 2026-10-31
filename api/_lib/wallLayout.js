// Wall designer (update 27): the layout logic of the honeycomb wall, with NO screen code, so it can be tested.
//
// A wall is a list of cells { q, r } on a honeycomb grid (axial coordinates, "pointy-top" hexagons).
// Rules: the wall is always ONE connected piece, a new piece must touch an existing one, and a piece can only
// be taken away if the rest stays in one piece. The number of cells = the quantity the customer orders.

export const WALL_MAX = 60; // safety limit of pieces in one wall (phones get slow, and a real wall has a size)

// the six neighbours of a hexagon
const DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

export const keyOf = (c) => `${c.q},${c.r}`;

export function neighbours(c) {
  return DIRS.map(([dq, dr]) => ({ q: c.q + dq, r: c.r + dr }));
}

// steps between two cells on the grid
export function distance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// how many of the six neighbours of `c` are in the wall
function touching(set, c) {
  return neighbours(c).filter((n) => set.has(keyOf(n))).length;
}

// Is the whole wall one connected piece? (an empty wall or a single piece counts as connected)
export function isConnected(cells) {
  if (cells.length <= 1) return true;
  const set = new Set(cells.map(keyOf));
  const seen = new Set([keyOf(cells[0])]);
  const todo = [cells[0]];
  while (todo.length) {
    const cur = todo.pop();
    for (const n of neighbours(cur)) {
      const k = keyOf(n);
      if (set.has(k) && !seen.has(k)) {
        seen.add(k);
        todo.push(n);
      }
    }
  }
  return seen.size === set.size;
}

// The empty places where a new piece may go (touching the wall). An empty wall offers the middle.
export function freeSpots(cells) {
  if (!cells.length) return [{ q: 0, r: 0 }];
  const set = new Set(cells.map(keyOf));
  const out = new Map();
  for (const c of cells) {
    for (const n of neighbours(c)) {
      const k = keyOf(n);
      if (!set.has(k) && !out.has(k)) out.set(k, n);
    }
  }
  return [...out.values()];
}

export function canAdd(cells, spot, max = WALL_MAX) {
  if (cells.length >= max) return false;
  if (!cells.length) return true;
  const set = new Set(cells.map(keyOf));
  return !set.has(keyOf(spot)) && touching(set, spot) > 0;
}

// A piece can be taken away only if at least one stays and the rest is still ONE piece.
export function canRemove(cells, cell, min = 1) {
  if (cells.length <= Math.max(min, 1)) return false;
  const rest = cells.filter((c) => keyOf(c) !== keyOf(cell));
  return rest.length === cells.length - 1 && isConnected(rest);
}

export function addCell(cells, spot, max = WALL_MAX) {
  return canAdd(cells, spot, max) ? [...cells, { q: spot.q, r: spot.r }] : cells;
}

export function removeCell(cells, cell, min = 1) {
  return canRemove(cells, cell, min) ? cells.filter((c) => keyOf(c) !== keyOf(cell)) : cells;
}

// The middle of the grid. Walls grow outward from here ring by ring, so 7 pieces = a flower, 19 = a big hexagon.
const MIDDLE = { q: 0, r: 0 };

// The "nicest" place for one more piece: the one touching the most pieces (compact wall), then nearest the middle of the grid.
export function bestSpot(cells) {
  const spots = freeSpots(cells);
  if (spots.length === 1) return spots[0];
  const set = new Set(cells.map(keyOf));
  const d = (s) => distance(s, MIDDLE);
  return [...spots].sort(
    (a, b) => touching(set, b) - touching(set, a) || d(a) - d(b) || a.r - b.r || a.q - b.q
  )[0];
}

// The "nicest" piece to take away: an edge piece (fewest neighbours), the farthest from the middle.
export function bestRemoval(cells, min = 1) {
  const set = new Set(cells.map(keyOf));
  const d = (s) => distance(s, MIDDLE);
  const options = cells.filter((c) => canRemove(cells, c, min));
  if (!options.length) return null;
  return options.sort(
    (a, b) => touching(set, a) - touching(set, b) || d(b) - d(a) || b.r - a.r || b.q - a.q
  )[0];
}

// Make the wall exactly `n` pieces: grow or shrink in the nicest way. Keeps what the customer already built.
export function resizeLayout(cells, n, { min = 1, max = WALL_MAX } = {}) {
  const target = Math.max(min, Math.min(max, Math.floor(Number(n)) || min));
  let out = cells.map((c) => ({ ...c })); // (keeps the colour of a piece, if it has one)
  while (out.length < target) out = [...out, bestSpot(out)];
  while (out.length > target) {
    const gone = bestRemoval(out, min);
    if (!gone) break;
    out = out.filter((c) => keyOf(c) !== keyOf(gone));
  }
  return out;
}

// "Random": a new wall with `n` pieces. Grows from the middle; a place touching several pieces is more likely,
// so the result looks like a wall and not like a snake. `rand` is Math.random (a test passes a fixed one).
export function randomLayout(n, rand = Math.random, { max = WALL_MAX } = {}) {
  const target = Math.max(1, Math.min(max, Math.floor(Number(n)) || 1));
  let out = [{ q: 0, r: 0 }];
  while (out.length < target) {
    const set = new Set(out.map(keyOf));
    const spots = freeSpots(out);
    const weights = spots.map((s) => touching(set, s) ** 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let pick = rand() * total;
    let chosen = spots[spots.length - 1];
    for (let i = 0; i < spots.length; i += 1) {
      pick -= weights[i];
      if (pick < 0) {
        chosen = spots[i];
        break;
      }
    }
    out = [...out, chosen];
  }
  return out;
}

// ----- drawing helpers (pointy-top hexagons, `size` = distance from the middle to a corner) -----

export function toPixel(c, size) {
  return { x: size * Math.sqrt(3) * (c.q + c.r / 2), y: size * 1.5 * c.r };
}

export function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// The picture frame that fits the cells + the free spots around them.
export function viewBoxFor(cells, spots, size, pad = 6) {
  const all = [...cells, ...spots];
  if (!all.length) return { x: -size, y: -size, w: size * 2, h: size * 2 };
  const px = all.map((c) => toPixel(c, size));
  const w2 = (size * Math.sqrt(3)) / 2;
  const minX = Math.min(...px.map((p) => p.x)) - w2 - pad;
  const maxX = Math.max(...px.map((p) => p.x)) + w2 + pad;
  const minY = Math.min(...px.map((p) => p.y)) - size - pad;
  const maxY = Math.max(...px.map((p) => p.y)) + size + pad;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
