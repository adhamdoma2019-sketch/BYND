import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createOrder, getQuote } from '../../firebase/orders.service';
import { useCart, keyOf } from '../../context/CartContext';
import OptionSummary from '../../components/storefront/OptionSummary';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import { formatPrice } from '../../utils/format';
import {
  CHECKOUT_FIELDS,
  resolveFieldSettings,
  CUSTOM_FIELD_TYPES,
  MAX_CUSTOM_FIELDS,
} from '../../utils/checkoutFields';

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

// Turns a server error (code + data) into a message in the customer's language.
function useErrorText() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  return (err) => {
    const meta = { ...(err.meta || {}) };
    if (meta.customLabel) meta.field = meta.customLabel[language] || meta.customLabel.en;
    else if (meta.field) meta.field = t(`checkoutFields.${meta.field}`);
    if (meta.minOrder !== undefined) meta.min = formatPrice(meta.minOrder, language);
    const key =
      err.code === 'OUT_OF_STOCK' && err.meta?.stock > 0 ? 'OUT_OF_STOCK_PARTIAL' : err.code;
    return t(`errors.${key}`, { ...meta, defaultValue: t('errors.generic') });
  };
}

export default function Checkout() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { items, subtotal, clearCart } = useCart();
  const { tenant } = useStorefront();
  const errorText = useErrorText();

  // What the shop wants to ask for (set in Admin > Settings).
  const fieldSettings = resolveFieldSettings(tenant.checkout?.fields);
  const visibleFields = CHECKOUT_FIELDS.filter((f) => fieldSettings[f.key].show);

  const zones = (tenant.shipping?.zones || []).filter((z) => z.active !== false);

  // Extra questions the shop added itself (Admin > Settings).
  const customFields = (tenant.checkout?.customFields || [])
    .filter((f) => f.active !== false && CUSTOM_FIELD_TYPES.includes(f.type))
    .slice(0, MAX_CUSTOM_FIELDS);

  const [form, setForm] = useState(() =>
    Object.fromEntries(CHECKOUT_FIELDS.map((f) => [f.key, '']))
  );
  const [custom, setCustom] = useState({});
  const [zoneId, setZoneId] = useState(() => (zones.length === 1 ? zones[0].id : ''));
  const [promoInput, setPromoInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Ask the server for the real total whenever the cart, area or code changes.
  const requestId = useRef(0);
  useEffect(() => {
    if (items.length === 0) return undefined;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const q = await getQuote({ tenantId: tenant.id, items, zoneId, promoCode: appliedCode });
        if (id === requestId.current) setQuote(q);
      } catch {
        if (id === requestId.current) setQuote(null);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [tenant.id, items, zoneId, appliedCode]);

  function applyPromo() {
    setError('');
    setAppliedCode(promoInput.trim().toUpperCase());
  }

  function removePromo() {
    setAppliedCode('');
    setPromoInput('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (items.length === 0) {
      setError(t('errors.EMPTY_CART'));
      return;
    }
    // Quick checks here; the server checks everything again.
    for (const f of visibleFields) {
      if (fieldSettings[f.key].required && !form[f.key].trim()) {
        setError(t('errors.BAD_FIELD', { field: t(`checkoutFields.${f.key}`) }));
        return;
      }
    }
    for (const f of customFields) {
      const answer = custom[f.id];
      const empty = f.type === 'checkbox' ? answer !== true : !String(answer || '').trim();
      if (f.required && empty) {
        setError(
          t('errors.BAD_FIELD', { field: f.label?.[language] || f.label?.en || '' })
        );
        return;
      }
    }
    if (zones.length > 0 && !zoneId) {
      setError(t('errors.ZONE_REQUIRED'));
      return;
    }
    if (appliedCode && quote?.promoError) {
      setError(promoErrorText(quote.promoError));
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrder({
        tenantId: tenant.id,
        customer: form,
        custom,
        items,
        zoneId,
        promoCode: quote?.promo ? appliedCode : '',
      });
      clearCart();
      navigate(`/store/${slug}/thank-you`, {
        state: {
          orderId: result.orderId,
          orderNumberLabel: result.orderNumberLabel,
          orderType: result.orderType,
          totalAmount: result.totalAmount,
        },
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  function promoErrorText(promoError) {
    return errorText({ code: promoError.code, meta: promoError.meta });
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

  const money = (n) => formatPrice(n, language);
  const chosenZone = zones.find((z) => z.id === zoneId);
  const shown = quote || { subtotal, discount: 0, shippingFee: 0, total: subtotal };

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <Link to={`/store/${slug}`} className="text-sm text-brass hover:underline">
        {t('storefront.backToShop')}
      </Link>
      <h1 className="font-display mt-4 text-2xl font-semibold">{t('checkout.title')}</h1>

      {/* ----- items ----- */}
      <div className="mt-6 rounded-md border border-ink/10 bg-paper-soft p-4">
        {items.map((item) => (
          <div key={keyOf(item)} className="flex justify-between py-1 text-sm">
            <span>
              {item.name?.[language] || item.name?.en} × {item.quantity}
              {item.isPreorder && (
                <span className="ms-2 rounded bg-ink px-1.5 py-0.5 text-xs text-paper">
                  {t('storefront.preorder')}
                </span>
              )}
              <OptionSummary labels={item.optionLabels} />
            </span>
            <span>{money(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
      </div>

      {items.some((i) => i.isPreorder) && (
        <p className="mt-4 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
          {t('storefront.preorderCartNotice')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* ----- customer details (the shop chooses which fields) ----- */}
        {visibleFields.map((f) => {
          const required = fieldSettings[f.key].required;
          const label = (
            <>
              {t(`checkoutFields.${f.key}`)}
              {required ? (
                <span className="text-rust"> *</span>
              ) : (
                <span className="text-ink-faint"> ({t('checkout.optional')})</span>
              )}
            </>
          );
          return (
            <label key={f.key} className="block text-sm text-ink-soft">
              {label}
              {f.type === 'textarea' ? (
                <textarea
                  rows={2}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <input
                  type={f.type}
                  autoComplete={f.autoComplete}
                  dir={f.type === 'email' || f.type === 'tel' ? 'ltr' : undefined}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className={inputClass}
                />
              )}
            </label>
          );
        })}

        {/* ----- the shop's own extra questions ----- */}
        {customFields.map((f) => {
          const label = f.label?.[language] || f.label?.en || '';
          const mark = f.required ? (
            <span className="text-rust"> *</span>
          ) : (
            <span className="text-ink-faint"> ({t('checkout.optional')})</span>
          );
          const value = custom[f.id] ?? (f.type === 'checkbox' ? false : '');
          const set = (v) => setCustom({ ...custom, [f.id]: v });

          if (f.type === 'checkbox') {
            return (
              <label key={f.id} className="flex items-start gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => set(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  {label}
                  {mark}
                </span>
              </label>
            );
          }
          return (
            <label key={f.id} className="block text-sm text-ink-soft">
              {label}
              {mark}
              {f.type === 'textarea' ? (
                <textarea
                  rows={2}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className={inputClass}
                />
              ) : f.type === 'select' ? (
                <select value={value} onChange={(e) => set(e.target.value)} className={inputClass}>
                  <option value="">{t('checkout.choose')}</option>
                  {(f.options || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o[language] || o.en}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    { text: 'text', number: 'number', email: 'email', phone: 'tel', date: 'date' }[
                      f.type
                    ]
                  }
                  step={f.type === 'number' ? 'any' : undefined}
                  dir={['email', 'phone', 'number'].includes(f.type) ? 'ltr' : undefined}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className={inputClass}
                />
              )}
            </label>
          );
        })}

        {/* ----- delivery area: a drop-down list (only if the shop set up zones) ----- */}
        {zones.length > 0 && (
          <div>
            <label className="block text-sm text-ink-soft" htmlFor="zone">
              {t('checkout.deliveryArea')} <span className="text-rust">*</span>
            </label>
            <select
              id="zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t('checkout.chooseArea')}</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name?.[language] || z.name?.en} — {money(z.price)}
                </option>
              ))}
            </select>
            {chosenZone && Number(chosenZone.freeAbove) > 0 && (
              <p className="mt-1 text-xs text-ink-faint">
                {t('checkout.freeAbove', { amount: money(chosenZone.freeAbove) })}
              </p>
            )}
          </div>
        )}

        {/* ----- promo code ----- */}
        <div>
          <label className="block text-sm text-ink-soft" htmlFor="promo">
            {t('checkout.promoLabel')}
          </label>
          {quote?.promo ? (
            <div className="mt-1 flex items-center justify-between rounded border border-sage/40 bg-sage/10 px-3 py-2 text-sm text-sage-dark">
              <span>{t('checkout.promoApplied', { code: quote.promo.code })}</span>
              <button type="button" onClick={removePromo} className="underline">
                {t('checkout.promoRemove')}
              </button>
            </div>
          ) : (
            <div className="mt-1 flex gap-2">
              <input
                id="promo"
                type="text"
                dir="ltr"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPromo();
                  }
                }}
                className="w-full rounded border border-ink/15 bg-white px-3 py-2 uppercase text-ink outline-none focus-visible:border-brass"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={!promoInput.trim()}
                className="rounded border border-ink/15 px-4 text-sm hover:border-brass disabled:opacity-50"
              >
                {t('checkout.promoApply')}
              </button>
            </div>
          )}
          {appliedCode && quote?.promoError && (
            <p className="mt-1 text-sm text-rust">{promoErrorText(quote.promoError)}</p>
          )}
        </div>

        {/* ----- totals (calculated by the server) ----- */}
        <div className="space-y-1 rounded-md border border-ink/10 bg-paper-soft p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-soft">{t('storefront.subtotal')}</span>
            <span>{money(shown.subtotal)}</span>
          </div>
          {shown.discount > 0 && (
            <div className="flex justify-between text-sage-dark">
              <span>{t('checkout.discount')}</span>
              <span>− {money(shown.discount)}</span>
            </div>
          )}
          {zones.length > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-soft">{t('checkout.shipping')}</span>
              <span>
                {!chosenZone
                  ? '—'
                  : shown.shippingFee === 0
                    ? t('checkout.free')
                    : money(shown.shippingFee)}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-semibold">
            <span>{t('checkout.total')}</span>
            <span>{money(shown.total)}</span>
          </div>
        </div>

        <div className="rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink-soft">
          {t('checkout.paymentMethod')}: <strong>{t('checkout.cod')}</strong>
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-ink py-3 text-sm font-semibold uppercase tracking-wider text-paper transition hover:bg-brass disabled:opacity-60"
        >
          {submitting ? t('checkout.placingOrder') : t('checkout.placeOrder')}
        </button>
      </form>
    </div>
  );
}
