// Product OPTIONS on the shop side: a color, an activity or sport, an extension,
// a custom text... The customer's choices are { optionId: valueId | text | true }.
//
// The server (api/_lib/options.js) works out the real price again from the
// product record, so nothing here can be used to get a lower price. This file
// only shows the customer what they will pay.
// IMPORTANT: the price rules must match api/_lib/options.js (a test compares them).

export const OPTION_TYPES = ['color', 'choice', 'addon', 'text'];
export const MAX_OPTIONS = 6;
export const MAX_VALUES = 20;
const DEFAULT_TEXT_LENGTH = 60;

// The text typed for a ticked tick box is kept under "<optionId>.text".
export const textKey = (optionId) => `${optionId}.text`;

// Same choices => same text (used to tell cart lines apart).
export function selectionSignature(selections) {
  return Object.keys(selections || {})
    .sort()
    .map((k) => `${k}=${selections[k]}`)
    .join('&');
}

// One cart line = a product + its choices.
export const itemKey = (productId, selections) =>
  `${productId}|${selectionSignature(selections)}`;

// Drops empty answers.
export function cleanSelections(selections) {
  const out = {};
  for (const [key, value] of Object.entries(selections || {})) {
    if (value === true) out[key] = true;
    else if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}

export const hasOptions = (product) =>
  (product?.options || []).some((o) => o && OPTION_TYPES.includes(o.type));

// Works out, for the customer's choices:
//   priceDelta  how much the choices add to the price
//   missing     options the customer still has to choose (required ones)
//   labels      what to show/save: [{ id, label, type, value, color?, text? }]
//   imageUrl    picture of the choice made (a color / choice can have its own picture)
export function resolveChoice(product, selections) {
  const options = (product?.options || [])
    .filter((o) => o && OPTION_TYPES.includes(o.type))
    .slice(0, MAX_OPTIONS);

  let priceDelta = 0;
  let imageUrl = '';
  const missing = [];
  const labels = [];

  for (const option of options) {
    const chosen = selections?.[option.id];
    const label = option.label || { en: option.id, ar: option.id };

    if (option.type === 'text') {
      const text = typeof chosen === 'string' ? chosen.trim() : '';
      if (!text) {
        if (option.required) missing.push(option);
        continue;
      }
      const max = Number(option.maxLength) > 0 ? Number(option.maxLength) : DEFAULT_TEXT_LENGTH;
      labels.push({ id: option.id, label, type: 'text', value: text.slice(0, max) });
      continue;
    }

    if (option.type === 'addon') {
      if (chosen !== true) continue;
      priceDelta += Number(option.values?.[0]?.priceDelta) || 0;
      const entry = { id: option.id, label, type: 'addon', value: true };
      // A tick box can also ask for a word / comment (the shop decides).
      if (option.askText) {
        const raw = selections?.[textKey(option.id)];
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (!text && option.textRequired) missing.push(option);
        const max = Number(option.textMax) > 0 ? Number(option.textMax) : DEFAULT_TEXT_LENGTH;
        if (text) entry.text = text.slice(0, max);
      }
      labels.push(entry);
      continue;
    }

    const value = (option.values || []).find((v) => v.id === chosen);
    if (!value) {
      if (option.required || chosen) missing.push(option);
      continue;
    }
    priceDelta += Number(value.priceDelta) || 0;
    if (typeof value.imageUrl === 'string' && value.imageUrl) imageUrl = value.imageUrl;
    labels.push({
      id: option.id,
      label,
      type: option.type,
      value: { en: value.label?.en || '', ar: value.label?.ar || value.label?.en || '' },
      ...(option.type === 'color' && value.color ? { color: value.color } : {}),
    });
  }

  return { priceDelta, missing, labels, imageUrl };
}
