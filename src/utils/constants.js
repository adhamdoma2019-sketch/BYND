// Shared numbers used by several screens.
// MAX_ORDER_QTY must match MAX_QTY in api/_lib/placeOrder.js (the server enforces it).
export const MAX_ORDER_QTY = 20;
export const LOW_STOCK_THRESHOLD = 3;

// Home-page banner slideshow (editable in Admin > Settings).
export const HERO_DEFAULT_SECONDS = 6;
export const HERO_MIN_SECONDS = 3;
export const HERO_MAX_SECONDS = 30;
// Fade speed choices -> length of the cross-fade in milliseconds.
export const HERO_FADE_MS = { fast: 500, normal: 1000, slow: 2000 };
