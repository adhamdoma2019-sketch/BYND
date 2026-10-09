// Converts product options between the admin form and the saved product.
//
// Form shape:   { id, type, labelEn, labelAr, required, maxLength,
//                 values: [{ id, labelEn, labelAr, color, priceDelta, costDelta }] }
// Saved shape:  { id, type, label:{en,ar}, required, maxLength,
//                 values: [{ id, label:{en,ar}, color, priceDelta }] }
// The shop's private extra COST of each choice is saved apart, in
// productCosts/{productId}.optionCosts as { "<optionId>.<valueId>": cost }.

import { OPTION_TYPES, MAX_OPTIONS, MAX_VALUES } from './productOptions.js';

const rid = () => Math.random().toString(36).slice(2, 8);

export const newValue = (type) => ({
  id: 'v' + rid(),
  labelEn: '',
  labelAr: '',
  color: type === 'color' ? '#222222' : '',
  imageUrl: '',
  priceDelta: '',
  costDelta: '',
});

export const newOption = () => ({
  id: 'o' + rid(),
  type: 'color',
  labelEn: '',
  labelAr: '',
  required: true,
  maxLength: '',
  askText: false,
  textRequired: false,
  textLabelEn: '',
  textLabelAr: '',
  textMax: '',
  values: [newValue('color')],
});

// saved product -> form
export function optionsToForm(options, optionCosts = {}) {
  return (options || []).map((o) => ({
    id: o.id,
    type: o.type,
    labelEn: o.label?.en || '',
    labelAr: o.label?.ar || '',
    required: o.required === true,
    maxLength: o.maxLength || '',
    askText: o.askText === true,
    textRequired: o.textRequired === true,
    textLabelEn: o.textLabel?.en || '',
    textLabelAr: o.textLabel?.ar || '',
    textMax: o.textMax || '',
    values: (o.values || []).map((v) => ({
      id: v.id,
      labelEn: v.label?.en || '',
      labelAr: v.label?.ar || '',
      color: v.color || '',
      imageUrl: v.imageUrl || '',
      priceDelta: v.priceDelta || '',
      costDelta: optionCosts[`${o.id}.${v.id}`] || '',
    })),
  }));
}

const num = (x) => (x === '' || x === undefined || x === null ? 0 : Number(x));

// Is the form complete enough to save?
export function optionsAreValid(form) {
  return (form || []).every((o) => {
    if (!(o.labelEn.trim() || o.labelAr.trim())) return false;
    if (o.type === 'color' || o.type === 'choice') {
      const named = o.values.filter((v) => v.labelEn.trim() || v.labelAr.trim());
      if (named.length === 0) return false;
    }
    return o.values.every(
      (v) => !(Number(v.priceDelta) < 0) && !(Number(v.costDelta) < 0)
    );
  });
}

// form -> what is saved on the product (public)
export function formToOptions(form) {
  return (form || [])
    .filter((o) => OPTION_TYPES.includes(o.type))
    .slice(0, MAX_OPTIONS)
    .map((o) => {
      const label = {
        en: o.labelEn.trim() || o.labelAr.trim(),
        ar: o.labelAr.trim() || o.labelEn.trim(),
      };
      if (o.type === 'text') {
        return {
          id: o.id,
          type: 'text',
          label,
          required: o.required,
          maxLength: Number(o.maxLength) > 0 ? Number(o.maxLength) : 60,
          values: [],
        };
      }
      if (o.type === 'addon') {
        const v = o.values[0] || newValue('addon');
        const base = {
          id: o.id,
          type: 'addon',
          label,
          required: false,
          values: [{ id: v.id, label, priceDelta: num(v.priceDelta) }],
        };
        // Optional: ask the customer to type a word / comment when the box is ticked.
        if (o.askText) {
          base.askText = true;
          base.textRequired = o.textRequired === true;
          base.textLabel = {
            en: o.textLabelEn.trim() || o.textLabelAr.trim() || label.en,
            ar: o.textLabelAr.trim() || o.textLabelEn.trim() || label.ar,
          };
          base.textMax = Number(o.textMax) > 0 ? Number(o.textMax) : 60;
        }
        return base;
      }
      return {
        id: o.id,
        type: o.type,
        label,
        required: o.required,
        values: o.values
          .filter((v) => v.labelEn.trim() || v.labelAr.trim())
          .slice(0, MAX_VALUES)
          .map((v) => ({
            id: v.id,
            label: {
              en: v.labelEn.trim() || v.labelAr.trim(),
              ar: v.labelAr.trim() || v.labelEn.trim(),
            },
            ...(o.type === 'color' ? { color: v.color || '#222222' } : {}),
            ...(v.imageUrl && v.imageUrl.trim() ? { imageUrl: v.imageUrl.trim() } : {}),
            priceDelta: num(v.priceDelta),
          })),
      };
    });
}

// form -> the private cost of each choice
export function formToOptionCosts(form) {
  const costs = {};
  for (const o of form || []) {
    if (o.type === 'text') continue;
    const values = o.type === 'addon' ? o.values.slice(0, 1) : o.values;
    for (const v of values) {
      if (o.type !== 'addon' && !(v.labelEn.trim() || v.labelAr.trim())) continue;
      const cost = num(v.costDelta);
      if (cost) costs[`${o.id}.${v.id}`] = cost;
    }
  }
  return costs;
}
