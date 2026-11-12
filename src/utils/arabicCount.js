// Proper Arabic counted nouns for the customer-facing texts that count pieces and products:
//   1: قطعة واحدة · 2: قطعتين · 3-10: 3 قطع · 11+: 11 قطعة     (products: منتج واحد / منتجين / 3 منتجات / 11 منتجًا)
// The Arabic texts in ar.json keep a plain "{{n}} قطع" (so the English / Arabic text check still works);
// after the number is filled in, this post-processor rewrites the noun that follows it. It only touches
// the texts listed in ARABIC_COUNT_KEYS (a text such as "3 منتج منخفض" in the admin has an adjective that
// would no longer agree, so it is left alone). English is never touched. Pure and tested.
const WORDS = {
  pieces: { one: 'قطعة واحدة', two: 'قطعتين', few: 'قطع', many: 'قطعة' },
  products: { one: 'منتج واحد', two: 'منتجين', few: 'منتجات', many: 'منتجًا' },
};

export function arabicCount(value, noun) {
  const n = Number(value);
  const w = WORDS[noun];
  if (!w || !Number.isInteger(n) || n < 0) return String(value);
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  if (n >= 3 && n <= 10) return `${n} ${w.few}`;
  if (n === 0) return `0 ${w.few}`;
  return `${n} ${w.many}`;
}

// "5 قطع" / "11 قطعة" / "3+ قطع" / "منتجات" ... -> the right form for the number in front of it.
export function fixArabicCounts(text) {
  return String(text).replace(/(\d+)(\+?)\s*(قطعة|قطع|منتجات|منتج)(?![\u0600-\u06FF])/g, (all, num, plus, word) => {
    const noun = word.startsWith('قطع') ? 'pieces' : 'products';
    if (plus) return `${num}+ ${Number(num) <= 10 ? WORDS[noun].few : WORDS[noun].many}`;
    return arabicCount(Number(num), noun);
  });
}

export const ARABIC_COUNT_KEYS = [
  'storefront.productCount', 'storefront.fromQty', 'storefront.fromQtySame', 'storefront.minOrderNote',
  'storefront.maxOrderNote', 'storefront.minNotInStock', 'storefront.pkgLine', 'storefront.pkgLineSame',
  'storefront.pkgNow', 'storefront.pkgMore', 'storefront.pkgMoreSame', 'storefront.pkgMoreColour',
  'storefront.pkgHintCart', 'storefront.pkgHintCartSame', 'storefront.cardPackage', 'storefront.cardTier',
  'wall.maxNote', 'wall.colourLimit', 'wall.cartTitle', 'wall.pieces', 'errors.TOO_MANY', 'errors.BELOW_MIN',
  'settingsPage.homeProductsOption', 'products.packageList',
];

// i18next post-processor: use with  i18n.use(arabicCountsProcessor)  and  postProcess: ['arabicCounts'].
export const arabicCountsProcessor = {
  type: 'postProcessor',
  name: 'arabicCounts',
  process(value, key, options, translator) {
    const lng = translator?.language || options?.lng || '';
    const k = Array.isArray(key) ? key[0] : key;
    if (!String(lng).startsWith('ar') || typeof value !== 'string' || !ARABIC_COUNT_KEYS.includes(String(k).replace(/^translation:/, ''))) return value;
    return fixArabicCounts(value);
  },
};
