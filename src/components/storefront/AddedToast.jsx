import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Design step 5: a small confirmation under the top bar after "Add to cart": "Added to cart - View cart".
// It does not cover the page (the customer keeps shopping) and goes away by itself.
// `trigger` is a number that changes on every add (0 = nothing added yet); `hidden` hides it
// while the cart drawer is open.
export default function AddedToast({ trigger, hidden = false, onView, seconds = 4 }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return undefined;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), seconds * 1000);
    return () => clearTimeout(timer);
  }, [trigger, seconds]);

  if (!visible || hidden) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[4.25rem] z-40 flex justify-center px-4"
      role="status"
      aria-live="polite"
      data-added-toast
    >
      <div className="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md border border-ink/10 bg-paper-soft py-1 ps-4 pe-1 shadow-lg">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-sage-dark" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span className="min-w-0 flex-1 text-sm font-medium">{t('storefront.addedToCart')}</span>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onView();
          }}
          className="min-h-[44px] shrink-0 rounded px-3 text-sm font-semibold text-brass-dark hover:underline"
        >
          {t('storefront.viewCart')}
        </button>
      </div>
    </div>
  );
}
