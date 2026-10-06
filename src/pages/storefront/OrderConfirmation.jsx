import { useLocation, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../utils/format';

export default function OrderConfirmation() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { t } = useTranslation();
  const { language } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-semibold">
        {t('checkout.orderPlaced')}
      </h1>
      <p className="mt-3 max-w-sm text-ink-soft">
        {t('checkout.orderPlacedBody')}
      </p>
      {state?.orderType === 'preorder' && (
        <p className="mt-3 max-w-sm rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
          {t('checkout.preorderPlacedBody')}
        </p>
      )}
      {state?.orderNumberLabel && (
        <p className="mt-4 text-lg font-medium text-ink">
          {t('checkout.orderNumber')}: {state.orderNumberLabel}
        </p>
      )}
      {state?.totalAmount !== undefined && (
        <p className="mt-1 text-ink-soft">
          {t('checkout.total')}: {formatPrice(state.totalAmount, language)}
        </p>
      )}
      <Link to={`/store/${slug}`} className="mt-8 text-brass hover:underline">
        {t('storefront.backToShop')}
      </Link>
    </div>
  );
}
