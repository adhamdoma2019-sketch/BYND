// The shop's contact details (WhatsApp, phone, email, social pages) turned into SAFE links.
// Only https:// addresses (or plain handles) are accepted, so nobody can sneak in a
// "javascript:" link through the settings.

import { whatsappLink } from './phone.js';

const clean = (v) => String(v ?? '').trim();

// "@bynd" or "bynd" or "https://instagram.com/bynd" -> a safe https link (or '').
function social(value, base, handlePrefix = '') {
  const v = clean(value);
  if (!v) return '';
  if (/^https:\/\//i.test(v)) {
    try {
      return new URL(v).href;
    } catch {
      return '';
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return ''; // any other scheme (javascript:, http:, mailto:...)
  const handle = v.replace(/^@/, '').replace(/[^\w.-]/g, '');
  return handle ? `${base}${handlePrefix}${handle}` : '';
}

export const instagramUrl = (v) => social(v, 'https://instagram.com/');
export const facebookUrl = (v) => social(v, 'https://facebook.com/');
export const tiktokUrl = (v) => social(v, 'https://www.tiktok.com/', '@');

// contact = tenant.contact; returns the links that can be shown.
export function contactLinks(contact, { countryCode = '20', message = '' } = {}) {
  const c = contact || {};
  const wa = whatsappLink(c.whatsapp, countryCode);
  const phone = clean(c.phone).replace(/[^\d+]/g, '');
  const email = clean(c.email);
  return {
    whatsapp: wa ? (message ? `${wa}?text=${encodeURIComponent(message)}` : wa) : '',
    phone: phone ? `tel:${phone}` : '',
    phoneText: clean(c.phone),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : '',
    emailText: email,
    instagram: instagramUrl(c.instagram),
    facebook: facebookUrl(c.facebook),
    tiktok: tiktokUrl(c.tiktok),
  };
}

// A top-bar link may be a full https address or a place on this page ("#products").
export function safeBarLink(value) {
  const v = clean(value);
  if (v.startsWith('#') && /^#[\w-]+$/.test(v)) return v;
  if (/^https:\/\//i.test(v)) {
    try {
      return new URL(v).href;
    } catch {
      return '';
    }
  }
  return '';
}
