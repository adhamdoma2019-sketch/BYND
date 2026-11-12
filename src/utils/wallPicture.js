// The customer can save the wall they designed as a picture (PNG): a white background, every piece in
// its colour. Built from the SAME SVG drawing the team gets in Admin > Orders (wallToSvg), so what the
// customer saves is what the team sees. Colours come from the product's palette (unpainted pieces
// use the neutral colour). Nothing is sent anywhere: the picture is made in the phone.
import { wallToSvg } from './wallExport.js';

export const WALL_PICTURE_NEUTRAL = '#d9c8a9';

export function wallPictureSvg(cells, palette = []) {
  const colour = new Map((palette || []).map((p) => [p.id, p.color]));
  const pieces = (Array.isArray(cells) ? cells : []).map((c) => ({
    q: c.q,
    r: c.r,
    h: /^#[0-9a-fA-F]{3,8}$/.test(colour.get(c.c) || '') ? colour.get(c.c) : WALL_PICTURE_NEUTRAL,
  }));
  return wallToSvg({ cells: pieces });
}

// Browser only: draws the SVG on a canvas and returns a PNG blob.
export function svgToPngBlob(svg, scale = 1) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
        canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('NO_BLOB'))), 'image/png');
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('IMAGE_FAILED'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
