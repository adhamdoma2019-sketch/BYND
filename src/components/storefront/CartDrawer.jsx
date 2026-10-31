import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useCart, keyOf } from '../../context/CartContext';
import OptionSummary from './OptionSummary';
import WallPicture from './WallPicture';
import { optimizedImage } from '../../utils/images';
import { formatPrice } from '../../utils/format';

export default function CartDrawer({ onClose }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, removeWall, subtotal } = useCart();

  // The lines of one planned wall are shown together as one wall; every other line stays as it is.
  const rows = [];
  for (const item of items) {
    if (!item.wallId) rows.push({ item });
    else {
      const row = rows.find((r) => r.wallId === item.wallId);
      if (row) row.lines.push(item);
      else rows.push({ wallId: item.wallId, lines: [item] });
    }
  }

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
              {rows.map((row) =>
                row.wallId ? (
                  <div key={row.wallId} className="flex items-start justify-between gap-3" data-cart-wall>
                    <div className="flex min-w-0 gap-3">
                      <WallPicture
                        cells={row.lines.find((l) => l.wallCells)?.wallCells}
                        className="h-16 w-16 shrink-0"
                        label={t('wall.title')}
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{row.lines[0].name?.[language] || row.lines[0].name?.en}</p>
                        <p className="text-sm text-ink-soft">
                          {t('wall.cartTitle', { n: row.lines.reduce((n, l) => n + l.quantity, 0) })}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
                          {row.lines.map((l) => {
                            const col = (l.optionLabels || []).find((o) => o.type === 'color');
                            const colName = col ? (typeof col.value === 'object' ? col.value[language] || col.value.en : col.value) : '';
                            return (
                              <li key={keyOf(l)} className="flex items-center gap-1.5">
                                {col?.color && (
                                  <span
                                    className="inline-block h-3 w-3 rounded-full border border-ink/30"
                                    style={{ backgroundColor: col.color }}
                                  />
                                )}
                                {t('wall.cartLine', { n: l.quantity, name: colName, price: formatPrice(l.unitPrice, language) })}
                              </li>
                            );
                          })}
                        </ul>
                        <OptionSummary labels={(row.lines[0].optionLabels || []).filter((o) => o.type !== 'color')} />
                        <p className="mt-1 text-sm font-medium">
                          {formatPrice(row.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0), language)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeWall(row.wallId)}
                      className="text-sm text-rust hover:underline"
                    >
                      {t('storefront.remove')}
                    </button>
                  </div>
                ) : (
                (({ item }) => (
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
                      {formatPrice(item.unitPrice, language)}
                      {item.tierMinQty > 0 && (
                        <span className="ms-2 rounded bg-sage/20 px-1.5 py-0.5 text-xs text-sage-dark">
                          {t('storefront.qtyPriceApplied')}
                        </span>
                      )}
                      {item.isPreorder && (
                        <span className="ms-2 rounded bg-ink px-1.5 py-0.5 text-xs text-paper">
                          {t('storefront.preorder')}
                        </span>
                      )}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(keyOf(item), item.quantity - 1)
                        }
                        className="rounded border border-ink/15 px-2 text-sm hover:border-brass"
                      >
                        −
                      </button>
                      <span className="text-sm">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(keyOf(item), item.quantity + 1)
                        }
                        disabled={item.quantity >= item.maxStock}
                        className="rounded border border-ink/15 px-2 text-sm hover:border-brass disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(keyOf(item))}
                    className="text-sm text-rust hover:underline"
                  >
                    {t('storefront.remove')}
                  </button>
                </div>
                ))(row)
                )
              )}
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
