// The look of the shop: light / dark, the accent colour, fonts and corner style.
//
// Anyone can pick ANY accent colour. This file makes sure text on it stays readable:
//   brass        the accent itself (buttons, highlights)
//   on-brass     text placed ON the accent (white or black, whichever reads better)
//   brass-dark   the accent as TEXT on the page (links, small labels), adjusted until readable
// Tested for every preset and for awkward colours (see tests/theme.mjs).

export const ACCENT_PRESETS = {
  copper: '#D98B4A',
  lime: '#C8F03C',
  ice: '#6CB8F5',
  rose: '#E5566D',
  violet: '#8B6CF0',
  emerald: '#2FB67C',
  gold: '#E0B341',
  // "monochrome": white on dark pages, near-black on light pages (see resolveAccentHex)
  white: '#FFFFFF',
};
export const DEFAULT_ACCENT = 'copper';
const MONO_LIGHT = '#18181B';

// Page background of each mode (must match src/index.css).
export const PAPER = { dark: [12, 12, 14], light: [250, 249, 246] };

export const FONT_PRESETS = {
  modern: { display: "'Space Grotesk', 'Work Sans', sans-serif", google: 'family=Space+Grotesk:wght@500;600;700' },
  elegant: { display: "'Playfair Display', Georgia, serif", google: 'family=Playfair+Display:wght@500;600;700' },
  sport: { display: "'Barlow Condensed', 'Oswald', sans-serif", google: 'family=Barlow+Condensed:wght@500;600;700' },
  clean: { display: "'Inter', system-ui, sans-serif", google: 'family=Inter:wght@500;600;700' },
  classic: { display: "'Spectral', Georgia, serif", google: 'family=Spectral:wght@500;600' },
};
export const DEFAULT_FONT = 'modern';

export const RADIUS_PRESETS = {
  sharp: { sm: '0px', md: '0px', lg: '0px' },
  soft: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem' },
  round: { sm: '0.5rem', md: '0.9rem', lg: '1.4rem' },
};
export const DEFAULT_RADIUS = 'soft';

export const MODES = ['auto', 'light', 'dark'];

// ---------------- colour maths ----------------
export function parseHex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
export const toHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// The accent as TEXT on the page: nudge its lightness until it reads well (4.5 : 1).
function readableTone(base, paper, mode) {
  if (contrast(base, paper) >= 4.5) return base;
  const [h, s, l0] = rgbToHsl(base);
  let l = l0;
  for (let i = 0; i < 60; i++) {
    l = mode === 'light' ? Math.max(0, l - 0.02) : Math.min(1, l + 0.02);
    const candidate = hslToRgb([h, s, l]).map(Math.round);
    if (contrast(candidate, paper) >= 4.5) return candidate;
  }
  return mode === 'light' ? [0, 0, 0] : [255, 255, 255];
}

// Text colour to put ON the accent: white, a soft black, or pure black (always >= 4.5 : 1).
function onAccent(base) {
  for (const candidate of [[255, 255, 255], [18, 18, 20], [0, 0, 0]]) {
    if (contrast(candidate, base) >= 4.5) return candidate;
  }
  return [0, 0, 0];
}

export function resolveAccentHex(accent, mode = 'dark') {
  if (accent === 'white') return mode === 'light' ? MONO_LIGHT : ACCENT_PRESETS.white;
  if (ACCENT_PRESETS[accent]) return ACCENT_PRESETS[accent];
  const rgb = parseHex(accent);
  return rgb ? toHex(rgb) : ACCENT_PRESETS[DEFAULT_ACCENT];
}

export function deriveAccent(accent, mode) {
  const base = parseHex(resolveAccentHex(accent, mode));
  const paper = PAPER[mode] || PAPER.dark;
  const mix = base.map((v) => v + (255 - v) * 0.35); // a lighter tint for decoration
  return {
    brass: base,
    brassDark: readableTone(base, paper, mode),
    brassLight: mix.map(Math.round),
    onBrass: onAccent(base),
  };
}

// CSS variables to set on the page for this accent + mode.
export function accentVars(accent, mode) {
  const d = deriveAccent(accent, mode);
  const css = (rgb) => rgb.map((v) => Math.round(v)).join(' ');
  return {
    '--brass': css(d.brass),
    '--brass-dark': css(d.brassDark),
    '--brass-light': css(d.brassLight),
    '--on-brass': css(d.onBrass),
  };
}

// Is the accent so close to the page colour that buttons would be hard to see? (admin warning)
export const accentTooFaint = (accent, mode) =>
  contrast(parseHex(resolveAccentHex(accent, mode)), PAPER[mode] || PAPER.dark) < 1.8;

// ---------------- light / dark ----------------
// The visitor's own choice wins; otherwise the shop's default; "auto" follows the phone.
export function resolveMode(shopMode, visitorMode, systemPrefersDark) {
  if (visitorMode === 'light' || visitorMode === 'dark') return visitorMode;
  if (shopMode === 'light' || shopMode === 'dark') return shopMode;
  return systemPrefersDark ? 'dark' : 'light';
}

export const fontHref = (fontId) =>
  FONT_PRESETS[fontId] ? `https://fonts.googleapis.com/css2?${FONT_PRESETS[fontId].google}&display=swap` : null;
