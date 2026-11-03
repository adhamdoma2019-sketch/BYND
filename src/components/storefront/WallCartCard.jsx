import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { keyOf } from '../../context/CartContext';
import OptionSummary from './OptionSummary';
import WallPicture from './WallPicture';
import { formatPrice } from '../../utils/format';
import { lineAmount } from '../../utils/quantityPrices';
import { wallPieces, wallMoney } from '../../utils/wallGroups';

// One planned wall in the cart or at checkout: picture, the colour lines, the total.
// `onRemove` = the Remove button (cart); without it the card is read-only (checkout).
export default function WallCartCard({ lines, onRemove }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const first = lines[0];
  return (
    <div className="flex items-start justify-between gap-3" data-cart-wall>
      <div className="flex min-w-0 gap-3">
        <WallPicture
          cells={lines.find((l) => l.wallCells)?.wallCells}
          className="h-16 w-16 shrink-0"
          label={t('wall.title')}
        />
        <div className="min-w-0">
          <p className="font-medium">{first.name?.[language] || first.name?.en}</p>
          <p className="text-sm text-ink-soft">{t('wall.cartTitle', { n: wallPieces(lines) })}</p>
          <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
            {lines.map((l) => {
              const col = (l.optionLabels || []).find((o) => o.type === 'color');
              const colName = col ? (typeof col.value === 'object' ? col.value[language] || col.value.en : col.value) : '';
              return (
                <li key={keyOf(l)} className="flex items-center gap-1.5">
                  {col?.color && (
                    <span className="inline-block h-3 w-3 rounded-full border border-ink/30" style={{ backgroundColor: col.color }} />
                  )}
                  {l.packageSize > 0
                    ? t('wall.cartLinePackage', { n: l.quantity, name: colName, price: formatPrice(lineAmount(l), language) })
                    : t('wall.cartLine', { n: l.quantity, name: colName, price: formatPrice(l.unitPrice, language) })}
                </li>
              );
            })}
          </ul>
          <OptionSummary labels={(first.optionLabels || []).filter((o) => o.type !== 'color')} />
          <p className="mt-1 text-sm font-medium">{formatPrice(wallMoney(lines), language)}</p>
        </div>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-sm text-rust hover:underline">
          {t('storefront.remove')}
        </button>
      )}
    </div>
  );
}
