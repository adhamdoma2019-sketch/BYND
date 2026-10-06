// The customer details a shop can ask for at checkout, and the shop's rules
// for each one (shown? required?). The shop sets these in Admin > Settings.
//
// IMPORTANT: DEFAULT_FIELD_SETTINGS must match src/utils/checkoutFields.js
// (a test checks that they are identical).

import { OrderError } from './errors.js';

export const FIELD_LIMITS = {
  name: 100,
  phone: 30,
  email: 100,
  country: 60,
  city: 80,
  area: 80,
  street: 200,
  building: 40,
  floor: 20,
  apartment: 20,
  landmark: 120,
  notes: 500,
};
export const FIELD_KEYS = Object.keys(FIELD_LIMITS);

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

// Name and phone can never be switched off: we can't deliver without them.
const LOCKED = ['name', 'phone'];

export function resolveFieldSettings(saved) {
  const result = {};
  for (const key of FIELD_KEYS) {
    const base = DEFAULT_FIELD_SETTINGS[key];
    const mine = saved?.[key] || {};
    const show = typeof mine.show === 'boolean' ? mine.show : base.show;
    const required = typeof mine.required === 'boolean' ? mine.required : base.required;
    result[key] = LOCKED.includes(key)
      ? { show: true, required: true }
      : { show, required: show && required };
  }
  return result;
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

// Trims and limits the length of everything the browser sent.
export function cleanCustomerInput(raw) {
  const out = {};
  for (const key of FIELD_KEYS) out[key] = cleanText(raw?.[key], FIELD_LIMITS[key]);
  return out;
}

// Applies the SHOP'S rules to what the customer entered.
// Hidden fields are dropped, required fields must be filled.
export function applyCustomerRules(customer, tenant) {
  const settings = resolveFieldSettings(tenant?.checkout?.fields);

  if (customer.name.length < 2) {
    throw new OrderError(400, 'BAD_NAME', 'Please enter your name.');
  }
  if (!/^[0-9+\s()-]{7,30}$/.test(customer.phone)) {
    throw new OrderError(400, 'BAD_PHONE', 'Please enter a valid phone number.');
  }

  const out = {};
  for (const key of FIELD_KEYS) {
    if (!settings[key].show) continue;
    const value = customer[key];
    if (settings[key].required && !value) {
      throw new OrderError(400, 'BAD_FIELD', `Please fill in: ${key}`, { field: key });
    }
    if (value) out[key] = value;
  }

  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) {
    throw new OrderError(400, 'BAD_EMAIL', 'Please enter a valid email address.');
  }

  // One readable line for lists and printing (the parts are kept too).
  out.address = [out.street, out.building, out.area, out.city, out.country]
    .filter(Boolean)
    .join(', ');
  return out;
}
