import { useLocation, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function OrderConfirmation() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-2xl font-semibold">
        {t('checkout.orderPlaced')}
      </h1>
      <p className="mt-3 max-w-sm text-ink-soft">
        {t('checkout.orderPlacedBody')}
      </p>
      {state?.orderId && (
        <p className="mt-4 text-sm text-ink-faint">
          {t('checkout.orderNumber')}: {state.orderId}
        </p>
      )}
      <Link to={`/store/${slug}`} className="mt-8 text-brass hover:underline">
        ← Back to shop
      </Link>
    </div>
  );
}
