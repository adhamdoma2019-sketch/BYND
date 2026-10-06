import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createOrder } from '../../firebase/orders.service';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import { formatPrice } from '../../utils/format';

export default function Checkout() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { items, subtotal, clearCart } = useCart();

  const { tenant } = useStorefront();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Please fill in your name, phone, and address.');
      return;
    }
    if (items.length === 0) {
      setError('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrder({
        tenantId: tenant.id,
        customer: form,
        items,
        paymentMethod: 'COD',
      });
      clearCart();
      navigate(`/store/${slug}/thank-you`, {
        state: {
          orderId: result.orderId,
          orderNumberLabel: result.orderNumberLabel,
          orderType: result.orderType,
        },
      });
    } catch (err) {
      setError(
        err.message ||
          'Something went wrong placing your order. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-ink-soft">{t('storefront.emptyCart')}</p>
        <Link to={`/store/${slug}`} className="mt-4 text-brass hover:underline">
          {t('storefront.backToShop')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <h1 className="font-display text-2xl font-semibold">
        {t('checkout.title')}
      </h1>

      <div className="mt-6 rounded-md border border-ink/10 bg-paper-soft p-4">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex justify-between py-1 text-sm"
          >
            <span>
              {item.name?.[language] || item.name?.en} × {item.quantity}
              {item.isPreorder && (
                <span className="ms-2 rounded bg-ink px-1.5 py-0.5 text-xs text-paper">
                  {t('storefront.preorder')}
                </span>
              )}
            </span>
            <span>{formatPrice(item.unitPrice * item.quantity, language)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-ink/10 pt-2 font-medium">
          <span>{t('storefront.subtotal')}</span>
          <span>{formatPrice(subtotal, language)}</span>
        </div>
      </div>

      {items.some((i) => i.isPreorder) && (
        <p className="mt-4 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
          {t('storefront.preorderCartNotice')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm text-ink-soft">
          {t('checkout.name')}
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <label className="block text-sm text-ink-soft">
          {t('checkout.phone')}
          <input
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <label className="block text-sm text-ink-soft">
          {t('checkout.address')}
          <textarea
            required
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <label className="block text-sm text-ink-soft">
          {t('checkout.notes')}
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <div className="rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink-soft">
          {t('checkout.paymentMethod')}: <strong>{t('checkout.cod')}</strong>
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-ink py-2.5 text-paper transition hover:bg-brass disabled:opacity-60"
        >
          {submitting ? t('checkout.placingOrder') : t('checkout.placeOrder')}
        </button>
      </form>
    </div>
  );
}
