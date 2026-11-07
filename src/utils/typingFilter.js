// Update 36: while the customer TYPES, the name / country / city boxes accept letters only.
// Allowed: letters of any language (Arabic, English, ...), spaces, and  . ' ’ -  (as in "Abd El-Rahman", "O'Brien").
// Digits and symbols are simply not accepted (also when pasted).
// The same letters-only rule is still checked at the end (checkField here, and on the server),
// so this is a convenience for the customer, never the only gate.
const LETTERS_ONLY_BOXES = new Set(['name', 'country', 'city']);
const NOT_ALLOWED = /[^\p{L}\p{M}\s.'’-]/gu;

// Returns { value, changed }: the text to keep in the box, and whether something was removed.
export function filterTyped(key, raw) {
  const text = String(raw ?? '');
  if (!LETTERS_ONLY_BOXES.has(key)) return { value: text, changed: false };
  const value = text.replace(NOT_ALLOWED, '').replace(/[\r\n\t]+/g, ' ');
  return { value, changed: value !== text };
}
