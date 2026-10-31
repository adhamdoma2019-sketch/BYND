// Live preview: how the Settings page and the shop (shown in a frame beside it) talk.
// Plain functions with no screens in them, so they can be tested (tests/settings-preview.mjs).
//
// Safety: the shop only listens to drafts when it is (a) opened with ?preview, (b) inside a frame,
// and (c) the message comes from the page around it on the SAME site. A draft only changes what
// is shown in that one frame: nothing is saved and nothing is written anywhere.

export const PREVIEW_DRAFT = 'shop-preview-draft';
export const PREVIEW_READY = 'shop-preview-ready';
export const PREVIEW_PRODUCT = 'shop-preview-product';

// Only these parts of the shop record can be replaced by a draft.
export const DRAFT_KEYS = ['theme', 'appearance', 'contact', 'brand', 'hero', 'highlights', 'pages'];

// Is this shop page the preview frame? (opened with ?preview AND inside another page)
export function isPreviewMode(search, inFrame) {
  if (!inFrame) return false;
  try {
    return new URLSearchParams(search || '').has('preview');
  } catch {
    return false;
  }
}

// A message from the admin page to the shop frame. Returns { draft | product, mode, language } or null.
//   type PREVIEW_DRAFT   = unsaved shop settings (Admin > Settings)
//   type PREVIEW_PRODUCT = an unsaved product (Admin > Products) + which view to show
export function acceptDraftMessage(event, { origin, parent }) {
  if (!event || event.origin !== origin || event.source !== parent) return null;
  const d = event.data;
  if (!d || typeof d !== 'object') return null;
  const common = {
    mode: d.mode === 'light' || d.mode === 'dark' ? d.mode : null, // null = what the shop setting says
    language: d.language === 'ar' ? 'ar' : d.language === 'en' ? 'en' : null,
  };
  if (d.type === PREVIEW_DRAFT && typeof d.draft === 'object' && d.draft) {
    return { draft: cleanDraft(d.draft), ...common };
  }
  if (d.type === PREVIEW_PRODUCT && typeof d.product === 'object' && d.product) {
    return { product: cleanProductDraft(d.product), view: d.view === 'card' ? 'card' : 'page', ...common };
  }
  return null;
}

// A message from the shop frame saying "I am ready, send me the draft". Returns true/false.
export function acceptReadyMessage(event, { origin, frameWindow }) {
  return Boolean(
    event && event.origin === origin && event.source === frameWindow && event.data?.type === PREVIEW_READY
  );
}

const isHttps = (u) => /^https:\/\//i.test(String(u || '').trim());

// Keeps only the allowed parts, and drops picture links that are not https yet
// (while someone is still typing a link, nothing broken is shown).
export function cleanDraft(draft) {
  const out = {};
  DRAFT_KEYS.forEach((k) => {
    if (draft[k] !== undefined) out[k] = draft[k];
  });
  if (out.brand) {
    out.brand = {
      logoUrl: isHttps(out.brand.logoUrl) ? out.brand.logoUrl : '',
      logoDarkUrl: isHttps(out.brand.logoDarkUrl) ? out.brand.logoDarkUrl : '',
    };
  }
  if (out.hero && Array.isArray(out.hero.slides)) {
    out.hero = {
      ...out.hero,
      slides: out.hero.slides.map((s) => ({ ...s, imageUrl: isHttps(s.imageUrl) ? s.imageUrl : '' })),
    };
  }
  return out;
}

// The saved shop record with the draft on top. The saved record itself is never changed.
export function applyDraft(tenant, draft) {
  if (!tenant || !draft) return tenant;
  return { ...tenant, ...cleanDraft(draft) };
}

// ----- Product preview (Admin > Products) -----

// Only these parts of a product can come from a draft. Stock numbers, id, shop and "active" always
// stay as saved, and private costs are never part of a product record at all.
export const PRODUCT_DRAFT_KEYS = [
  'name', 'description', 'price', 'priceTiers', 'tierGroupOption', 'minQty', 'maxQty', 'shippingExtra', 'imageUrl', 'images',
  'relatedIds', 'isPreorder', 'backorder', 'countedOptions', 'preorderStyle', 'comingSoon', 'options',
  'preorderMessage',
];

export function cleanProductDraft(draft) {
  const out = {};
  PRODUCT_DRAFT_KEYS.forEach((k) => {
    if (draft[k] !== undefined) out[k] = draft[k];
  });
  out.imageUrl = isHttps(out.imageUrl) ? out.imageUrl : '';
  out.images = (Array.isArray(out.images) ? out.images : []).filter(isHttps);
  out.options = (Array.isArray(out.options) ? out.options : []).map((o) => ({
    ...o,
    values: (Array.isArray(o?.values) ? o.values : []).map((v) => ({
      ...v,
      ...(v && v.imageUrl !== undefined ? { imageUrl: isHttps(v.imageUrl) ? v.imageUrl : '' } : {}),
    })),
  }));
  return out;
}

// How many pieces a draft pretends to have when the product is new (nothing is stocked yet), so a
// product that counts stock does not show every colour as sold out.
export const PREVIEW_PLENTY = 99;

// The product as the preview shows it: saved product (if any) with the draft on top.
// `saved` = the stored product or null (new product).
export function applyProductDraft(saved, draft, tenantId) {
  const fields = cleanProductDraft(draft);
  if (saved) {
    return { ...saved, ...fields, isActive: true, deleted: false }; // id, shop, stock and optionStock stay as saved
  }
  const optionStock = {};
  (fields.countedOptions || []).forEach((id) => {
    const option = (fields.options || []).find((o) => o.id === id);
    (option?.values || []).forEach((v) => {
      optionStock[`${id}.${v.id}`] = PREVIEW_PLENTY;
    });
  });
  return { id: 'new', tenantId, isActive: true, deleted: false, stock: PREVIEW_PLENTY, optionStock, ...fields };
}
