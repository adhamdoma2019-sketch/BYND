import { useLocation, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../utils/format';
import WallPicture from '../../components/storefront/WallPicture';
import ReceiptCard from '../../components/storefront/ReceiptCard';
import CheckoutHeader from '../../components/storefront/CheckoutHeader';
import { useStorefront } from '../../context/StorefrontContext';
import { madeWording } from '../../utils/storefront';
import OrderProgress from '../../components/storefront/OrderProgress';
import WhatsAppOrderButton from '../../components/storefront/WhatsAppOrderButton';

export default function OrderConfirmation() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useStorefront();
  const accent = /^#[0-9a-fA-F]{6}$/.test(tenant?.theme?.accent || '') ? tenant.theme.accent : '';
  const shopName = tenant?.name?.[language] || tenant?.name?.en || '';
  const trackUrl = typeof window !== 'undefined' ? `${window.location.origin}/store/${slug}/track` : '';
  // The receipt already shows the order number and the total: show them above it only when there is no receipt.
  const hasReceipt = Boolean(state?.receipt);
  // "Preorder" or "Made to order" wording, as the shop set it on the products (same as the cart and the receipt).
  const madeLines = (state?.receipt?.items || []).filter((i) => i.madeToOrder);
  const orderNote =
    madeWording(madeLines) === 'madeToOrder' ? 'checkout.madeToOrderPlacedBody' : 'checkout.preorderPlacedBody';

  return (
    <div className="min-h-screen">
      <CheckoutHeader slug={slug} />
      <div className="flex flex-col items-center px-4 pb-16 pt-10 text-center">
        <h1 className="font-display text-2xl font-semibold">{t('checkout.orderPlaced')}</h1>
        <p className="mt-3 max-w-sm text-ink-soft">{t('checkout.orderPlacedBody')}</p>
        {state?.orderType === 'preorder' && (
          <p className="mt-3 max-w-sm rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
            {t(orderNote)}
          </p>
        )}
        <div className="mt-6 w-full max-w-md" data-thankyou-progress>
          <OrderProgress status="pending" />
        </div>
        <section className="mt-6 w-full max-w-md rounded-md border border-ink/10 bg-paper-soft p-4 text-start" data-whats-next>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">{t('next.title')}</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {['step1', state?.orderType === 'preorder' ? 'step2Made' : 'step2', 'step3'].map((k, i) => (
              <li key={k} className="flex gap-3">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass/15 text-xs font-bold text-brass-dark">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-ink-soft">{t(`next.${k}`)}</span>
              </li>
            ))}
          </ol>
        </section>
        {!hasReceipt && state?.orderNumberLabel && (
          <p className="mt-4 text-lg font-medium text-ink">
            {t('checkout.orderNumber')}: {state.orderNumberLabel}
          </p>
        )}
        {!hasReceipt && state?.totalAmount !== undefined && (
          <p className="mt-1 text-ink-soft">
            {t('checkout.total')}: {formatPrice(state.totalAmount, language)}
          </p>
        )}
        {(state?.walls || []).length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-4" data-thankyou-walls>
            {state.walls.map((w) => (
              <WallPicture key={w.id} cells={w.cells} className="h-28 w-28" label={t('wall.title')} />
            ))}
          </div>
        )}
        {state?.receipt && (
          <ReceiptCard receipt={state.receipt} shopName={shopName} accent={accent} trackUrl={trackUrl} />
        )}
        <Link
          to={`/store/${slug}/track`}
          state={{ orderNumberLabel: state?.orderNumberLabel }}
          className="mt-6 flex min-h-[44px] w-full max-w-md items-center justify-center rounded bg-ink px-4 py-3 text-center text-sm font-semibold text-paper transition hover:bg-brass hover:text-on-brass"
        >
          {t('track.linkAfterOrder')}
        </Link>
        <WhatsAppOrderButton tenant={tenant} orderNumber={state?.orderNumberLabel} className="mt-3" />
        <Link to={`/store/${slug}`} className="mt-4 inline-flex min-h-[44px] items-center text-brass-dark hover:underline">
          {t('storefront.backToShop')}
        </Link>
      </div>
    </div>
  );
}
