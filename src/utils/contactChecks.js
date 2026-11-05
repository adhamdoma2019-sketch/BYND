// Phone and email checks used at checkout (the browser's copy).
//
// IMPORTANT: this file and api/_lib/contactChecks.js must stay identical below
// the marker line (a test compares them). The server is the real gate; this copy
// only shows the message earlier, while the customer types.

// ---- shared rules (keep identical in both copies) ----

// Customers on Arabic phones often type ٠١٠١٢٣٤٥٦٧٨ - turn those into 0101234567 first.
export function toLatinDigits(value) {
  return String(value ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const LOOSE_PHONE = /^[0-9+\s().-]{7,30}$/;

// Checks a phone number for the shop's country.
// Egypt (code 20): a mobile number = 01 + 0/1/2/5 + 8 digits, written with or without
// +20 / 0020 / spaces. It is returned in one standard form: 01012345678.
// Any other country: only a simple check (7 to 30 digits and symbols), kept as typed.
// Returns { ok, value }.
export function checkPhone(raw, countryCode = '20') {
  const text = toLatinDigits(raw).trim();
  if (!LOOSE_PHONE.test(text) || text.slice(1).includes('+')) return { ok: false, value: text };
  if (String(countryCode || '20') !== '20') return { ok: true, value: text };

  let digits = text.replace(/\D/g, '');
  if (digits.startsWith('0020')) digits = digits.slice(4);
  else if (text.startsWith('+') && digits.startsWith('20')) digits = digits.slice(2);
  else if (digits.length === 12 && digits.startsWith('20')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`; // forgot the first 0
  return /^01[0125]\d{8}$/.test(digits) ? { ok: true, value: digits } : { ok: false, value: text };
}

// Common spelling mistakes in email domains -> the domain people meant.
const DOMAIN_FIXES = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmil.com': 'gmail.com',
  'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.comm': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotamil.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com', 'hotmail.comm': 'hotmail.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yhoo.com': 'yahoo.com',
  'yahou.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahoo.comm': 'yahoo.com',
  'outlok.com': 'outlook.com', 'outloook.com': 'outlook.com', 'outlock.com': 'outlook.com',
  'outlook.con': 'outlook.com', 'outlook.comm': 'outlook.com',
  'iclould.com': 'icloud.com', 'icoud.com': 'icloud.com', 'icloud.con': 'icloud.com',
};
const TLD_FIXES = { con: 'com', cmo: 'com', vom: 'com', comm: 'com', ocm: 'com' };

function suggestDomain(domain) {
  if (DOMAIN_FIXES[domain]) return DOMAIN_FIXES[domain];
  const parts = domain.split('.');
  const fixedTld = TLD_FIXES[parts[parts.length - 1]];
  return fixedTld ? [...parts.slice(0, -1), fixedTld].join('.') : '';
}

const EMAIL_SHAPE = /^([\p{L}\p{N}._%+'-]+)@((?:[\p{L}\p{N}-]+\.)+\p{L}{2,})$/u;

// Checks the SHAPE of an email (it cannot prove the address really exists).
// `suggestion` is a "did you mean ...?" address for common typos; it never blocks anything.
// Returns { ok, value, suggestion }.
export function checkEmail(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  const match = EMAIL_SHAPE.exec(value);
  const ok =
    Boolean(match) &&
    value.length <= 100 &&
    !value.includes('..') &&
    !match[1].startsWith('.') &&
    !match[1].endsWith('.') &&
    !match[2].split('.').some((label) => label.startsWith('-') || label.endsWith('-'));
  if (!ok) return { ok: false, value, suggestion: '' };
  const fixed = suggestDomain(match[2]);
  return { ok: true, value, suggestion: fixed ? `${match[1]}@${fixed}` : '' };
}

// ----- Address and name boxes: is what the customer typed believable? -----
// Returns { ok, value }. Empty text is "ok" here (the shop's own "required" rule handles empty boxes).
// name / country / city: letters only (any language) with spaces and . ' -  (no digits, no symbols)
// area / landmark: letters and numbers, at least 2 letters
// street: letters and numbers, at least 2 letters and 3 characters
// building / floor / apartment: letters or numbers (like 12, 4B, 3/2), no symbols-only text
// notes: free text (only the length limit applies)
// Everywhere: no run of 4+ identical characters ("aaaa", "xxxx") and no code-like symbols (< > { } [ ] \ | ^ ~ ` $ % * = + @ #).
const LETTER = /\p{L}/gu;
const SYMBOLS = /[<>{}[\]\\|^~`$%*=+@#_]/u;
const PATTERNS = {
  name: /^[\p{L}\p{M}\s.'’-]+$/u,
  country: /^[\p{L}\p{M}\s.'’-]+$/u,
  city: /^[\p{L}\p{M}\s.'’-]+$/u,
  area: /^[\p{L}\p{M}\p{N}\s.'’,/()&-]+$/u,
  landmark: /^[\p{L}\p{M}\p{N}\s.'’,/()&-]+$/u,
  street: /^[\p{L}\p{M}\p{N}\s.'’,/()&#-]+$/u,
  building: /^[\p{L}\p{M}\p{N}\s.\/-]+$/u,
  floor: /^[\p{L}\p{M}\p{N}\s.\/-]+$/u,
  apartment: /^[\p{L}\p{M}\p{N}\s.\/-]+$/u,
};
const MIN_LETTERS = { name: 2, country: 2, city: 2, area: 2, landmark: 2, street: 2 };

export function checkField(key, raw) {
  const value = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: true, value };
  const pattern = PATTERNS[key];
  if (!pattern) return { ok: true, value }; // notes and unknown boxes: no format rule
  if (SYMBOLS.test(value) || !pattern.test(value)) return { ok: false, value };
  if (/(.)\1{3,}/u.test(value)) return { ok: false, value };
  const letters = (value.match(LETTER) || []).length;
  if (letters < (MIN_LETTERS[key] || 0)) return { ok: false, value };
  if (key === 'street' && value.length < 3) return { ok: false, value };
  if (['building', 'floor', 'apartment'].includes(key) && !/[\p{L}\p{N}]/u.test(value)) {
    return { ok: false, value };
  }
  return { ok: true, value };
}
