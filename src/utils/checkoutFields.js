// The customer details a shop can ask for at checkout.
// Each shop decides (in Admin > Settings) which fields are SHOWN and which
// are REQUIRED. The server applies the same rules, so they can't be bypassed.
//
// IMPORTANT: DEFAULT_FIELD_SETTINGS must match api/_lib/fields.js
// (a test checks that they are identical).

// Order = order shown on the checkout form.
export const CHECKOUT_FIELDS = [
  { key: 'name', type: 'text', autoComplete: 'name', locked: true },
  { key: 'phone', type: 'tel', autoComplete: 'tel', locked: true },
  { key: 'email', type: 'email', autoComplete: 'email' },
  { key: 'country', type: 'text', autoComplete: 'country-name' },
  { key: 'city', type: 'text', autoComplete: 'address-level2' },
  { key: 'area', type: 'text', autoComplete: 'address-level3' },
  { key: 'street', type: 'text', autoComplete: 'street-address' },
  { key: 'building', type: 'text' },
  { key: 'floor', type: 'text' },
  { key: 'apartment', type: 'text' },
  { key: 'landmark', type: 'text' },
  { key: 'notes', type: 'textarea' },
];

export const DEFAULT_FIELD_SETTINGS = {
  name: { show: true, required: true },
  phone: { show: true, required: true },
  email: { show: false, required: false },
  country: { show: false, required: false },
  city: { show: true, required: true },
  area: { show: true, required: false },
  street: { show: true, required: true },
  building: { show: true, required: false },
  floor: { show: false, required: false },
  apartment: { show: false, required: false },
  landmark: { show: false, required: false },
  notes: { show: true, required: false },
};

// Combines what the shop saved with the defaults.
// Name and phone are always shown and required.
export function resolveFieldSettings(saved) {
  const result = {};
  for (const { key, locked } of CHECKOUT_FIELDS) {
    const base = DEFAULT_FIELD_SETTINGS[key];
    const mine = saved?.[key] || {};
    const show = typeof mine.show === 'boolean' ? mine.show : base.show;
    const required = typeof mine.required === 'boolean' ? mine.required : base.required;
    result[key] = locked ? { show: true, required: true } : { show, required: show && required };
  }
  return result;
}
