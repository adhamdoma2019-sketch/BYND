// Shared numbers used by several screens.
// MAX_ORDER_QTY = SAFETY_MAX_QTY in quantityPrices.js (the server enforces it; a shop can set a lower limit per product).
export const MAX_ORDER_QTY = 500;
export const LOW_STOCK_THRESHOLD = 3;

// Home-page banner slideshow (editable in Admin > Settings).
export const HERO_DEFAULT_SECONDS = 6;
export const HERO_MIN_SECONDS = 3;
export const HERO_MAX_SECONDS = 30;
// Fade speed choices -> length of the cross-fade in milliseconds.
export const HERO_FADE_MS = { fast: 500, normal: 1000, slow: 2000 };
