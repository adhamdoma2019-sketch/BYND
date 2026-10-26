// Stock PER OPTION (for example per colour, or per distance plate).
//
// A product can say "count my stock by these options" (product.countedOptions = ['col','dist']).
// Then every value of those options has its own number, saved on the product as
//   product.optionStock = { "<optionId>.<valueId>": number }
// and product.stock becomes the most you could sell right now: the SMALLEST of the
// per-option totals (so the old screens, reports and warnings keep working).
//
// Only a colour list or a choice list can be counted. A customer must pick one value of
// each counted option, and one order line uses ONE unit from each of them.
//
// IMPORTANT: src/utils/optionStock.js and api/_lib/optionStock.js must be exact copies (a test compares them).

export const COUNTABLE_TYPES = ['color', 'choice'];
export const MAX_COUNTED = 2;

export const stockKey = (optionId, valueId) => `${optionId}.${valueId}`;

const n = (x) => Math.max(Number(x) || 0, 0);

// The options of this product that are really counted (exist, right type, have values).
export function countedOptions(product) {
  const ids = Array.isArray(product?.countedOptions) ? product.countedOptions : [];
  if (ids.length === 0) return [];
  return (product.options || [])
    .filter(
      (o) =>
        o &&
        ids.includes(o.id) &&
        COUNTABLE_TYPES.includes(o.type) &&
        Array.isArray(o.values) &&
        o.values.length > 0
    )
    .slice(0, MAX_COUNTED);
}

export const isOptionCounted = (product) => countedOptions(product).length > 0;

// Every counted number of the product, in screen order:
// [{ key, optionId, valueId, optionLabel, valueLabel, left, primary }]
export function countedRows(product) {
  const stock = product?.optionStock || {};
  const rows = [];
  countedOptions(product).forEach((o, index) => {
    for (const v of o.values) {
      const key = stockKey(o.id, v.id);
      rows.push({
        key,
        optionId: o.id,
        valueId: v.id,
        optionLabel: o.label || { en: o.id, ar: o.id },
        valueLabel: v.label || { en: v.id, ar: v.id },
        left: n(stock[key]),
        primary: index === 0,
      });
    }
  });
  return rows;
}

// Total of one option (all its values together).
export function optionTotal(product, optionId, optionStock = product?.optionStock) {
  const o = countedOptions(product).find((x) => x.id === optionId);
  if (!o) return 0;
  return o.values.reduce((sum, v) => sum + n((optionStock || {})[stockKey(o.id, v.id)]), 0);
}

// The product's own stock number when options are counted: the smallest option total.
// Returns null when the product does not count by option.
export function derivedStock(product, optionStock = product?.optionStock) {
  const counted = countedOptions(product);
  if (counted.length === 0) return null;
  return Math.min(...counted.map((o) => optionTotal(product, o.id, optionStock)));
}

// What the customer's choices use: { keys: [{ key, option, value }], missing: [option] }.
// `missing` = counted options the customer has not chosen yet.
export function keysForSelections(product, selections) {
  const keys = [];
  const missing = [];
  for (const o of countedOptions(product)) {
    const chosen = selections?.[o.id];
    const value = typeof chosen === 'string' ? o.values.find((v) => v.id === chosen) : null;
    if (!value) {
      missing.push(o);
      continue;
    }
    keys.push({ key: stockKey(o.id, value.id), option: o, value });
  }
  return { keys, missing };
}

// How many of this combination are left (smallest of the chosen numbers).
// null = not known yet (a counted option is not chosen) or the product is not counted by option.
export function leftForSelections(product, selections) {
  if (!isOptionCounted(product)) return null;
  const { keys, missing } = keysForSelections(product, selections);
  if (missing.length > 0 || keys.length === 0) return null;
  const stock = product.optionStock || {};
  return Math.min(...keys.map((k) => n(stock[k.key])));
}

// Short text for the history: { en: "Colour: Gold", ar: "اللون: ذهبي" }
export function rowText(row) {
  return {
    en: `${row.optionLabel?.en || ''}: ${row.valueLabel?.en || ''}`,
    ar: `${row.optionLabel?.ar || row.optionLabel?.en || ''}: ${row.valueLabel?.ar || row.valueLabel?.en || ''}`,
  };
}

// Adds (or removes, with a negative delta) units on some keys. Returns the new map.
export function applyDeltas(optionStock, deltas) {
  const next = { ...(optionStock || {}) };
  for (const [key, delta] of Object.entries(deltas)) {
    next[key] = Math.max(n(next[key]) + Number(delta), 0);
  }
  return next;
}
