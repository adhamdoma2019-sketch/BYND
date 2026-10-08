// Helpers for the activity log ("who changed what, and when").

const short = (v) => (v === undefined || v === null ? '' : String(v).slice(0, 120));

// Compares two flat objects and lists what changed: [{ field, from, to }].
export function diffFields(before, after) {
  const changes = [];
  for (const key of Object.keys(after)) {
    if (short(before?.[key]) !== short(after[key])) {
      changes.push({ field: key, from: short(before?.[key]), to: short(after[key]) });
    }
  }
  return changes;
}

// For things where only "this part changed" is worth saying (no values).
export const fieldsOnly = (names) => names.map((field) => ({ field }));

// Text form of a value where the ORDER of keys doesn't matter (Firestore returns
// keys in its own order), so "did this change?" comparisons don't give false alarms.
const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]))
      : v;
export const stable = (v) => JSON.stringify(sortKeys(v ?? null));

