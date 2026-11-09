import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useCart, keyOf } from '../../context/CartContext';
import OptionSummary from './OptionSummary';
import WallCartCard from './WallCartCard';
import { groupCartRows } from '../../utils/wallGroups';
import { optimizedImage } from '../../utils/images';
import { formatPrice } from '../../utils/format';
import { lineAmount } from '../../utils/quantityPrices';
import { packageHintFor } from '../../utils/cartPricing';
import { madeWording } from '../../utils/storefront';

export default function CartDrawer({ onClose }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, removeWall, subtotal } = useCart();

  // The lines of one planned wall are shown together as one wall; every other line stays as it is.
  const rows = groupCartRows(items);

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
              {rows.map((row) => {
                if (row.wallId) {
                  return <WallCartCard key={row.wallId} lines={row.lines} onRemove={() => removeWall(row.wallId)} />;
                }
                const { item } = row;
                return (
                <div
                  key={keyOf(item)}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="flex gap-3">
                    {item.imageUrl && (
                      <img
                        src={optimizedImage(item.imageUrl, 160)}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded object-cover"
                      />
                    )}
                    <div>
                    <p className="font-medium">
                      {item.name?.[language] || item.name?.en}
                    </p>
                    <OptionSummary labels={item.optionLabels} />
                    <p className="text-sm text-ink-soft">
                      {item.packageSize > 0 ? formatPrice(lineAmount(item), language) : formatPrice(item.unitPrice, language)}
                      {item.packageSize > 0 && (
                        <span className="ms-2 rounded bg-sage/20 px-1.5 py-0.5 text-xs text-sage-dark">
                          {t('storefront.pkgApplied')}
                        </span>
                      )}
                      {item.tierMinQty > 0 && (
                        <span className="ms-2 rounded bg-sage/20 px-1.5 py-0.5 text-xs text-sage-dark">
                          {t('storefront.qtyPriceApplied')}
                        </span>
                      )}
                      {item.isPreorder && (
                        <span className="ms-2 rounded border border-ink/25 px-1.5 py-0.5 text-[11px] text-ink-soft">
                          {t(item.madeStyle === 'madeToOrder' ? 'storefront.madeToOrder' : 'storefront.preorder')}
                        </span>
                      )}
                    </p>
                    {(() => {
                      // Package price: how many more pieces complete the next package.
                      const hint = packageHintFor(items, item);
                      if (!hint) return null;
                      const groupName = (item.optionLabels || []).find((o) => o.id === item.tierGroup)?.label;
                      const option = (groupName?.[language] || groupName?.en || '').toLowerCase();
                      return (
                        <p className="mt-1 text-xs text-brass-dark" data-package-hint>
                          {item.tierGroup
                            ? t('storefront.pkgHintCartSame', { n: hint.missing, option, pkg: hint.qty, price: formatPrice(hint.price, language) })
                            : t('storefront.pkgHintCart', { n: hint.missing, pkg: hint.qty, price: formatPrice(hint.price, language) })}
                        </p>
                      );
                    })()}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(keyOf(item), item.quantity - 1)
                        }
                        aria-label="-"
                        className="flex h-9 w-9 items-center justify-center rounded border border-ink/15 text-base hover:border-brass"
                      >
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(keyOf(item), item.quantity + 1)
                        }
                        disabled={item.quantity >= item.maxStock}
                        aria-label="+"
                        className="flex h-9 w-9 items-center justify-center rounded border border-ink/15 text-base hover:border-brass disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(keyOf(item))}
                    className="px-1 py-2 text-sm text-rust hover:underline"
                  >
                    {t('storefront.remove')}
                  </button>
                </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-ink/10 pt-4">
              {items.some((i) => i.isPreorder) && (
                <p className="mb-3 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-xs text-brass-dark">
                  {t(madeWording(items.filter((i) => i.isPreorder)) === 'madeToOrder' ? 'storefront.madeToOrderCartNotice' : 'storefront.preorderCartNotice')}
                </p>
              )}
              <div className="flex justify-between font-medium">
                <span>{t('storefront.subtotal')}</span>
                <span>{formatPrice(subtotal, language)}</span>
              </div>
              <button
                onClick={goToCheckout}
                className="mt-4 w-full rounded bg-ink py-2.5 text-paper transition hover:bg-brass hover:text-on-brass"
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
