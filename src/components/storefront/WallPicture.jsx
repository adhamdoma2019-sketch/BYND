import { toPixel, hexPoints, viewBoxFor } from '../../utils/wallLayout';

// A small picture of a wall (no tapping): used in the cart and, later, in the order screens.
// cells: [{ q, r, h }]  h = the colour of the piece as a hex code (optional)
const SIZE = 22;

export default function WallPicture({ cells, className = '', label }) {
  const list = Array.isArray(cells) ? cells : [];
  if (!list.length) return null;
  const vb = viewBoxFor(list, [], SIZE, 4);
  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className={className}
      role="img"
      aria-label={label}
      dir="ltr"
    >
      {list.map((c) => {
        const p = toPixel(c, SIZE);
        return (
          <polygon
            key={`${c.q},${c.r}`}
            points={hexPoints(p.x, p.y, SIZE - 1)}
            style={c.h ? { fill: c.h } : undefined}
            className={c.h ? 'stroke-ink' : 'fill-brass/25 stroke-ink'}
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}
