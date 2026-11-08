// Wall designer (update 29): a saved wall (order.walls[i]) as text and as a picture file for the team.
import { toPixel, hexPoints, viewBoxFor } from './wallLayout.js';

const pick = (obj, language) => (obj && (obj[language] || obj.en)) || '';

// "3 × Black, 3 × Blue"
export function wallColorsText(wall, language) {
  return (wall.colors || []).map((c) => `${c.count} × ${pick(c.label, language)}`).join(', ');
}

// For the Excel export: the number of pieces, the mix, and every piece (q,r = colour) so the wall can be rebuilt.
export function wallsToText(order, language, t) {
  return (order.walls || [])
    .map((w) => {
      const names = new Map((w.colors || []).map((c) => [c.id, pick(c.label, language)]));
      const mix = wallColorsText(w, language);
      const pieces = (w.cells || []).map((c) => `${c.q},${c.r}${c.c ? `=${names.get(c.c) || c.c}` : ''}`).join('; ');
      return `${t(w.count === 1 ? 'wall.cartTitleOne' : 'wall.cartTitle', { n: w.count })}${mix ? ` (${mix})` : ''}: ${pieces}`;
    })
    .join(' | ');
}

// A standalone picture (SVG file) of the wall: white background, so it can be printed or sent.
export function wallToSvg(wall, { size = 30 } = {}) {
  const cells = wall.cells || [];
  const vb = viewBoxFor(cells, [], size, 10);
  const polys = cells
    .map((c) => {
      const p = toPixel(c, size);
      return `<polygon points="${hexPoints(p.x, p.y, size - 1)}" fill="${c.h || '#d9c8a9'}" stroke="#222222" stroke-width="2"/>`;
    })
    .join('');
  const w = Math.round(vb.w * 2);
  const h = Math.round(vb.h * 2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">` +
    `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#ffffff"/>${polys}</svg>`
  );
}
