import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import StorefrontHeader from '../../components/storefront/StorefrontHeader';
import StorefrontFooter from '../../components/storefront/StorefrontFooter';
import CartDrawer from '../../components/storefront/CartDrawer';
import { usePageMeta } from '../../utils/usePageMeta';
import { trackOrder } from '../../firebase/orders.service';
import TrackResult from '../../components/storefront/TrackResult';

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

// "Track my order": the customer enters the order number and the phone number used on
// the order. They only ever see the status and the dates (never names, addresses or prices).
export default function TrackOrder() {
  const { slug } = useParams();
  const { state } = useLocation();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useStorefront();
  const [cartOpen, setCartOpen] = useState(false);

  const [orderNumber, setOrderNumber] = useState(state?.orderNumberLabel || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  usePageMeta(`${t('track.title')} — ${shopName}`, undefined);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!orderNumber.trim() || !phone.trim()) {
      setError(t('track.fillBoth'));
      return;
    }
    setBusy(true);
    try {
      setResult(await trackOrder({ tenantId: tenant.id, orderNumber, phone }));
    } catch (err) {
      setResult(null);
      setError(t(`errors.${err.code}`, { defaultValue: t('errors.generic') }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to={`/store/${slug}`} className="text-sm text-brass-dark hover:underline">
          {t('storefront.backToShop')}
        </Link>
        <h1 className="font-display mt-6 text-3xl font-bold tracking-tight">{t('track.title')}</h1>
        <p className="mt-3 text-ink-soft">{t('track.intro')}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm text-ink-soft">
            {t('track.orderNumber')}
            <input
              type="text"
              dir="ltr"
              autoComplete="off"
              placeholder={t('track.orderNumberExample')}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-ink-soft">
            {t('track.phone')}
            <input
              type="tel"
              dir="ltr"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </label>
          <p className="text-xs text-ink-faint">{t('track.privacyNote')}</p>
          {error && (
            <p role="alert" className="text-sm text-rust">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-ink py-3 text-sm font-semibold uppercase tracking-wider text-paper transition hover:bg-brass hover:text-on-brass disabled:opacity-60"
          >
            {busy ? t('track.checking') : t('track.submit')}
          </button>
        </form>

        {result && <TrackResult result={result} tenant={tenant} language={language} />}
      </main>

      <StorefrontFooter tenant={tenant} />
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
