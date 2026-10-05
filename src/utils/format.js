// Money formatting lives here so the currency and number style can be
// changed in ONE place later (for example per shop).
export const DEFAULT_CURRENCY = 'EGP';

const CURRENCY_LABEL = {
  EGP: { en: 'EGP', ar: 'ج.م' },
};

export function formatPrice(amount, language = 'en', currency = DEFAULT_CURRENCY) {
  const n = Number(amount) || 0;
  const text = n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const label = CURRENCY_LABEL[currency]?.[language] || currency;
  return `${text} ${label}`;
}
