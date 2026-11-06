// Text typed by the customer, shown ON the product picture (update 35).
// Example: a "Custom distance" text box whose words appear in the empty spot of the plate photo.
// The shop decides, per text option and in the product form: the height of the text (% from the top
// of the picture), its size (% of the picture width) and its colour. It is always centred sideways:
// the customer can never move it. Display only: the order keeps the typed text exactly as before,
// and the server needs no change (prices and stock are not affected).

import { visibleOptions, textKey } from './productOptions.js';

export const OVERLAY_DEFAULTS = { y: 50, size: 8, color: '#d4af37', bold: true };
export const OVERLAY_LIMITS = { yMin: 0, yMax: 100, sizeMin: 2, sizeMax: 30 };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const numOr = (x, d) => (x === '' || x === null || x === undefined || !Number.isFinite(Number(x)) ? d : Number(x));

// What is saved on the option (or null = the text is not shown on the picture).
export function cleanOverlay(raw) {
  if (!raw || raw.enabled !== true) return null;
  return {
    enabled: true,
    y: clamp(numOr(raw.y, OVERLAY_DEFAULTS.y), OVERLAY_LIMITS.yMin, OVERLAY_LIMITS.yMax),
    size: clamp(numOr(raw.size, OVERLAY_DEFAULTS.size), OVERLAY_LIMITS.sizeMin, OVERLAY_LIMITS.sizeMax),
    color: /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? raw.color : OVERLAY_DEFAULTS.color,
    bold: raw.bold !== false,
  };
}

// Only a text box (or a tick box that asks for a word) can show its words on the picture.
export const canShowOnPicture = (option) =>
  option?.type === 'text' || (option?.type === 'addon' && option?.askText === true);

// A long text gets smaller so it always fits inside the picture (about 88% of its width).
export function fitSize(size, text) {
  const len = [...String(text || '')].length;
  if (!len) return size;
  return Math.min(size, 88 / (len * 0.62));
}

// The texts to draw for the customer's current choices: [{ id, text, y, size, color, bold }].
export function pictureTexts(product, selections) {
  const out = [];
  for (const option of visibleOptions(product, selections)) {
    const overlay = cleanOverlay(option.overlay);
    if (!overlay || !canShowOnPicture(option)) continue;
    let raw = '';
    if (option.type === 'text') raw = selections?.[option.id];
    else if (selections?.[option.id] === true) raw = selections?.[textKey(option.id)];
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) continue;
    const max = Number((option.type === 'text' ? option.maxLength : option.textMax)) > 0
      ? Number(option.type === 'text' ? option.maxLength : option.textMax)
      : 60;
    out.push({ id: option.id, text: text.slice(0, max), y: overlay.y, size: overlay.size, color: overlay.color, bold: overlay.bold });
  }
  return out;
}
