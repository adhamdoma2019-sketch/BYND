import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../utils/format';

export default function CartDrawer({ onClose }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, subtotal } = useCart();

  function goToCheckout() {
    onClose();
    navigate('/store/' + slug + '/checkout');
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-sm flex-col bg-paper-soft p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">
            {t('storefront.yourCart')}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-soft hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p className="mt-8 text-ink-soft">{t('storefront.emptyCart')}</p>
        ) : (
          <>
            <div className="mt-6 flex-1 space-y-4 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="font-medium">
                      {item.name?.[language] || item.name?.en}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {formatPrice(item.unitPrice, language)}
                      {item.isPreorder && (
                        <span className="ms-2 rounded bg-ink px-1.5 py-0.5 text-xs text-paper">
                          {t('storefront.preorder')}
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="rounded border border-ink/15 px-2 text-sm hover:border-brass"
                      >
                        −
                      </button>
                      <span className="text-sm">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        disabled={item.quantity >= item.maxStock}
                        className="rounded border border-ink/15 px-2 text-sm hover:border-brass disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-sm text-rust hover:underline"
                  >
                    {t('storefront.remove')}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-ink/10 pt-4">
              {items.some((i) => i.isPreorder) && (
                <p className="mb-3 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-brass-dark">
                  {t('storefront.preorderCartNotice')}
                </p>
              )}
              <div className="flex justify-between font-medium">
                <span>{t('storefront.subtotal')}</span>
                <span>{formatPrice(subtotal, language)}</span>
              </div>
              <button
                onClick={goToCheckout}
                className="mt-4 w-full rounded bg-ink py-2.5 text-paper transition hover:bg-brass"
              >
                {t('storefront.checkout')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
