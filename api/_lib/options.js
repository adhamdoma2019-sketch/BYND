// Product OPTIONS: the choices a customer makes on a product page
// (a color, an activity or sport, an extension, a custom text...).
//
// A product stores its options (public) as:
//   { id, type: 'color'|'choice'|'addon'|'text', label:{en,ar}, required, maxLength,
//     values: [{ id, label:{en,ar}, color, imageUrl, priceDelta }],
//     // a tick box (addon) can also ask the customer to type something when ticked:
//     askText, textRequired, textLabel:{en,ar}, textMax }
// A choice or color can have its own picture (imageUrl): the product photo changes
// when the customer picks it.
// The shop's private extra COST of each choice is kept apart, in
// productCosts/{productId}.optionCosts  { "<optionId>.<valueId>": cost }.
//
// The browser only says WHICH choices were made (ids / text). Prices are always
// worked out here from the product record, never trusted from the browser.
//
// IMPORTANT: the price rules must match src/utils/productOptions.js
// (a test compares the two).

import { OrderError } from './errors.js';

export const OPTION_TYPES = ['color', 'choice', 'addon', 'text'];
export const MAX_OPTIONS = 10;
export const MAX_VALUES = 20;
const DEFAULT_TEXT_LENGTH = 60;

// The text typed for a ticked tick box is kept under "<optionId>.text".
export const textKey = (optionId) => `${optionId}.text`;

// ----- "Show this option only when ..." -----
// An option can carry  showWhen: { optionId, valueId }  = "show me only when that colour / choice
// option (ABOVE me in the list) has that value chosen". A hidden option is ignored completely:
// never required, never priced, never stored. The condition can follow a chain (A shows B shows C).
// An option that counts its own stock is never hidden (the stock needs its choice).
// IMPORTANT: this must work the same here and in src/utils/productOptions.js (a test compares them).
export function visibleOptions(product, selections) {
  const counted = new Set(Array.isArray(product?.countedOptions) ? product.countedOptions : []);
  const shown = [];
  for (const o of (product?.options || [])
    .filter((x) => x && OPTION_TYPES.includes(x.type))
    .slice(0, MAX_OPTIONS)) {
    const rule = o.showWhen;
    let ok = true;
    if (rule && rule.optionId && !counted.has(o.id)) {
      // the controlling option must come earlier in the list AND be visible itself
      const ctrl = shown.find((c) => c.id === rule.optionId);
      ok =
        Boolean(ctrl) &&
        (ctrl.type === 'color' || ctrl.type === 'choice') &&
        (ctrl.values || []).some((v) => v.id === rule.valueId) &&
        selections?.[ctrl.id] === rule.valueId;
    }
    if (ok) shown.push(o);
  }
  return shown;
}

// The choices without the answers of hidden options (also their typed text).
export function stripHidden(product, selections) {
  const shown = new Set(visibleOptions(product, selections).map((o) => o.id));
  const out = {};
  for (const [key, value] of Object.entries(selections || {})) {
    const optionId = key.endsWith('.text') ? key.slice(0, -5) : key;
    const isOption = (product?.options || []).some((o) => o && o.id === optionId);
    if (isOption && !shown.has(optionId)) continue;
    out[key] = value;
  }
  return out;
}

// Keeps only simple answers from the browser: { optionId: valueId | text | true }.
export function cleanSelections(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw).slice(0, 20)) {
    if (key.length > 40) continue;
    if (value === true) out[key] = true;
    else if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 120);
  }
  return out;
}

// Same choices => same text, so identical lines can be merged.
export function selectionSignature(selections) {
  return Object.keys(selections)
    .sort()
    .map((k) => `${k}=${selections[k]}`)
    .join('&');
}

const fail = (option) =>
  new OrderError(400, 'BAD_OPTION', `Please choose: ${option.label?.en || option.id}`, {
    customLabel: option.label || { en: option.id, ar: option.id },
  });

// Checks the choices against the product's options.
// Returns { priceDelta, costDelta, snapshot, imageUrl } where snapshot is saved in
// the order and imageUrl is the picture of the choice made (if the choice has one).
export function resolveSelections(product, selections, optionCosts) {
  const options = visibleOptions(product, selections);

  let priceDelta = 0;
  let costDelta = 0;
  let imageUrl = '';
  const snapshot = [];

  for (const option of options) {
    const chosen = selections?.[option.id];
    const label = option.label || { en: option.id, ar: option.id };

    if (option.type === 'text') {
      const text = typeof chosen === 'string' ? chosen.trim() : '';
      if (!text) {
        if (option.required) throw fail(option);
        continue;
      }
      const max = Number(option.maxLength) > 0 ? Number(option.maxLength) : DEFAULT_TEXT_LENGTH;
      snapshot.push({ id: option.id, label, type: 'text', value: text.slice(0, max) });
      continue;
    }

    if (option.type === 'addon') {
      // A tick box: ticked adds the extension's price.
      if (chosen !== true) continue;
      const value = option.values?.[0] || {};
      priceDelta += Number(value.priceDelta) || 0;
      costDelta += Number(optionCosts?.[`${option.id}.${value.id}`]) || 0;
      const entry = { id: option.id, label, type: 'addon', value: true };
      // A tick box can also ask for a word / comment (the shop decides).
      if (option.askText) {
        const raw = selections?.[textKey(option.id)];
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (!text && option.textRequired) throw fail(option);
        const max = Number(option.textMax) > 0 ? Number(option.textMax) : DEFAULT_TEXT_LENGTH;
        if (text) entry.text = text.slice(0, max);
      }
      snapshot.push(entry);
      continue;
    }

    // color / choice: the browser sends the id of the chosen value.
    if (typeof chosen !== 'string' || !chosen) {
      if (option.required) throw fail(option);
      continue;
    }
    const value = (option.values || []).find((v) => v.id === chosen);
    if (!value) throw fail(option);
    priceDelta += Number(value.priceDelta) || 0;
    costDelta += Number(optionCosts?.[`${option.id}.${value.id}`]) || 0;
    if (typeof value.imageUrl === 'string' && value.imageUrl) imageUrl = value.imageUrl;
    snapshot.push({
      id: option.id,
      label,
      type: option.type,
      value: { en: value.label?.en || '', ar: value.label?.ar || value.label?.en || '' },
      ...(option.type === 'color' && value.color ? { color: value.color } : {}),
    });
  }

  return { priceDelta, costDelta, snapshot, imageUrl };
}
