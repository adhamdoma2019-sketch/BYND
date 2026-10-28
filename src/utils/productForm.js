// Turns the product form into the product record that is stored (and shown in the shop).
// A plain function with no database in it: "Save product" AND the live product preview both use it,
// so what you see in the preview is exactly what will be saved.
import { formToOptions } from './productOptionsForm';
import { COUNTABLE_TYPES, MAX_COUNTED } from './optionStock';
import { cleanTiers, SAFETY_MAX_QTY } from './quantityPrices';

// Which options count their own stock: only a colour list or a choice list that has values,
// never on a made-to-order product (it uses no stock), at most MAX_COUNTED.
function countedIdsOf(data, options) {
  if (data.isPreorder === true) return [];
  const ids = Array.isArray(data.countedOptions) ? data.countedOptions : [];
  return options
    .filter((o) => ids.includes(o.id) && COUNTABLE_TYPES.includes(o.type) && (o.values || []).length > 0)
    .slice(0, MAX_COUNTED)
    .map((o) => o.id);
}

// A whole number between min and max, or 0 when the box is empty / not valid.
function wholeNumber(value, min, max) {
  const n = Number(value);
  return value !== '' && value !== null && value !== undefined && Number.isInteger(n) && n >= min
    ? Math.min(n, max)
    : 0;
}

// Fields shared by "create" and "update".
export function productFields(data) {
  const isPreorder = data.isPreorder === true;
  // "Stock first, then made to order": sells from stock, and when it is gone customers can still order.
  const backorder = !isPreorder && data.backorder === true;
  const usesMessage = isPreorder || backorder;
  const savedOptions = formToOptions(data.options);
  const countedOptions = countedIdsOf(data, savedOptions);
  // A customer must choose every counted option (we need to know which number to reduce).
  const options = savedOptions.map((o) => (countedOptions.includes(o.id) ? { ...o, required: true } : o));
  return {
    name: { en: data.nameEn, ar: data.nameAr || data.nameEn },
    description: {
      en: data.descriptionEn || '',
      ar: data.descriptionAr || data.descriptionEn || '',
    },
    price: Number(data.price),
    // Quantity prices: [{ minQty, price }] "from X pieces each costs Y" (only valid, cheaper-and-bigger steps are kept).
    priceTiers: cleanTiers(data.priceTiers, data.price),
    // Optional limits per order for the whole product (0 = no limit of the shop's own).
    minQty: wholeNumber(data.minQty, 2, SAFETY_MAX_QTY),
    maxQty: wholeNumber(data.maxQty, 1, SAFETY_MAX_QTY),
    // Preorder products don't need stock.
    stock: data.stock === '' || data.stock === undefined ? 0 : Number(data.stock),
    sku: data.sku || '',
    // Extra shipping per unit (for big/heavy items). Added to the zone price.
    shippingExtra:
      data.shippingExtra === '' || data.shippingExtra === undefined
        ? 0
        : Number(data.shippingExtra),
    imageUrl: data.imageUrl || '',
    // More pictures of the product (shown as thumbnails on the product page).
    images: (data.images || [])
      .map((u) => String(u || '').trim())
      .filter(Boolean)
      .slice(0, 8),
    // Other products offered on this product's page (e.g. extension plates).
    relatedIds: (data.relatedIds || []).slice(0, 6),
    isPreorder,
    backorder,
    countedOptions,
    // How a no-stock product is labelled for customers: 'preorder' or 'madeToOrder'.
    // Same behaviour either way (orderable without stock); only the wording differs.
    preorderStyle: usesMessage && data.preorderStyle === 'madeToOrder' ? 'madeToOrder' : 'preorder',
    // Shown in the shop but can't be ordered yet (the server refuses orders for it too).
    comingSoon: data.comingSoon === true,
    options, // colors, activity, extension... (public)
    preorderMessage: {
      en: usesMessage ? data.preorderMessageEn || '' : '',
      ar: usesMessage ? data.preorderMessageAr || data.preorderMessageEn || '' : '',
    },
  };
}
