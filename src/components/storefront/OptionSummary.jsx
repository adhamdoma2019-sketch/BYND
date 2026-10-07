import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';

// Shows what the customer chose on a product: "Color: Black · Activity: Running".
// Works for the cart and for saved orders (same shape).
export default function OptionSummary({ labels }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (!labels || labels.length === 0) return null;

  return (
    <ul className="mt-0.5 space-y-0.5 text-xs text-ink-faint">
      {labels.map((o) => (
        <li key={o.id} className="flex items-center gap-1.5">
          {o.color && (
            <span
              className="inline-block h-3 w-3 rounded-full border border-ink/30"
              style={{ backgroundColor: o.color }}
            />
          )}
          <span>
            {o.label?.[language] || o.label?.en}:{' '}
            {o.type === 'addon'
              ? t('orders.yes')
              : typeof o.value === 'object'
                ? o.value[language] || o.value.en
                : o.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
