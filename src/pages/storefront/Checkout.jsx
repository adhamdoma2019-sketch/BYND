import { lineAmount } from '../../utils/quantityPrices';
import { wallPictures } from '../../utils/wallOrder';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createOrder, getQuote } from '../../firebase/orders.service';
import { useCart, keyOf } from '../../context/CartContext';
import OptionSummary from '../../components/storefront/OptionSummary';
import WallCartCard from '../../components/storefront/WallCartCard';
import { groupCartRows } from '../../utils/wallGroups';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import { formatPrice } from '../../utils/format';
import { checkPhone, checkEmail, checkField } from '../../utils/contactChecks';
import { filterTyped } from '../../utils/typingFilter';
import { makeTokenKeeper } from '../../utils/orderToken';
import { madeWording } from '../../utils/storefront';
import CheckoutHeader from '../../components/storefront/CheckoutHeader';
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
  const [quoteBusy, setQuoteBusy] = useState(false); // waiting for the server's answer
  const [quoteFailed, setQuoteFailed] = useState(false); // the server could not be asked
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const tokenKeeper = useRef(null); // one-time order code: the same while the order content is the same (no double orders)
  if (!tokenKeeper.current) tokenKeeper.current = makeTokenKeeper();
  const [removedFrom, setRemovedFrom] = useState(''); // box where digits / symbols were just refused (name, country, city)
  const [website, setWebsite] = useState(''); // trap for bots (kept out of sight)
  const [touched, setTouched] = useState({}); // which boxes the customer already left

  // Friendly checks while typing (the server checks everything again).
  const countryCode = tenant.defaultCountryCode || '20';
  const phoneBad = form.phone.trim() !== '' && !checkPhone(form.phone, countryCode).ok;
  const emailCheck = checkEmail(form.email);
  const emailBad = form.email.trim() !== '' && !emailCheck.ok;
  // Name / city / street ... must look real (letters, no symbols, no "aaaa").
  const fieldBad = (key) => !checkField(key, form[key]).ok;

  // Ask the server for the real total whenever the cart, area or code changes.
  const requestId = useRef(0);
  useEffect(() => {
    if (items.length === 0) return undefined;
    const id = ++requestId.current;
    setQuoteBusy(true);
    const timer = setTimeout(async () => {
      try {
        const q = await getQuote({ tenantId: tenant.id, items, zoneId, promoCode: appliedCode });
        if (id === requestId.current) {
          setQuote(q);
          setQuoteFailed(false);
        }
      } catch {
        if (id === requestId.current) {
          setQuote(null);
          setQuoteFailed(true);
        }
      } finally {
        if (id === requestId.current) setQuoteBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [tenant.id, items, zoneId, appliedCode]);

  // A code is letters, numbers, - and _ only (the same rule as the server).
  const promoShapeBad = promoInput.trim() !== '' && !/^[A-Za-z0-9_-]+$/.test(promoInput.trim());

  function applyPromo() {
    setError('');
    if (promoShapeBad) return;
    setAppliedCode(promoInput.trim().toUpperCase());
  }

  // Typing in the box after a code was tried: forget the old try, so a wrong code can never block the order.
  function changePromo(value) {
    setPromoInput(value);
    setError('');
    if (appliedCode && value.trim().toUpperCase() !== appliedCode) setAppliedCode('');
  }

  function removePromo() {
    setAppliedCode('');
    setPromoInput('');
    setError('');
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
    for (const f of visibleFields) {
      if (fieldBad(f.key)) {
        setError(t('errors.BAD_FIELD_FORMAT', { field: t(`checkoutFields.${f.key}`) }));
        return;
      }
    }
    if (!checkPhone(form.phone, countryCode).ok) {
      setError(t('errors.BAD_PHONE'));
      return;
    }
    if (form.email.trim() && !checkEmail(form.email).ok) {
      setError(t('errors.BAD_EMAIL'));
      return;
    }
    for (const f of customFields) {
      const answer = custom[f.id];
      const empty = f.type === 'checkbox' ? answer !== true : !String(answer || '').trim();
      if (!empty && f.type === 'phone' && !checkPhone(answer, countryCode).ok) {
        setError(t('errors.BAD_PHONE'));
        return;
      }
      if (!empty && f.type === 'email' && !checkEmail(answer).ok) {
        setError(t('errors.BAD_EMAIL'));
        return;
      }
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
    if (promoShapeBad) {
      setError(t('checkout.promoShapeBad'));
      return;
    }
    if (appliedCode && quote?.promoError) {
      setError(promoErrorText(quote.promoError));
      return;
    }
    if (appliedCode && (quoteBusy || quoteFailed || !quote?.promo)) {
      setError(t(quoteFailed ? 'checkout.promoCheckFailed' : 'checkout.promoChecking'));
      return;
    }

    setSubmitting(true);
    try {
      const pictures = wallPictures(items); // (the cart is emptied right after the order)
      const promoToSend = quote?.promo ? appliedCode : '';
      const result = await createOrder({
        tenantId: tenant.id,
        customer: form,
        custom,
        website,
        items,
        zoneId,
        promoCode: promoToSend,
        orderToken: tokenKeeper.current.get({ shop: tenant.id, form, custom, items, zoneId, promo: promoToSend }),
      });
      tokenKeeper.current.reset();
      clearCart();
      navigate(`/store/${slug}/thank-you`, {
        state: {
          orderId: result.orderId,
          orderNumberLabel: result.orderNumberLabel,
          orderType: result.orderType,
          totalAmount: result.totalAmount,
          receipt: result.receipt || null, // what was really saved (from the server): the receipt on the thank-you page
          walls: pictures, // small pictures of the planned walls for the thank-you page
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
      <div className="min-h-screen">
        <CheckoutHeader slug={slug} />
        <div className="flex flex-col items-center px-4 pt-24 text-center">
          <p className="text-ink-soft">{t('storefront.emptyCart')}</p>
          <Link to={`/store/${slug}`} className="mt-4 text-brass-dark hover:underline">
            {t('storefront.backToShop')}
          </Link>
        </div>
      </div>
    );
  }

  const money = (n) => formatPrice(n, language);
  const chosenZone = zones.find((z) => z.id === zoneId);
  const shown = quote || { subtotal, discount: 0, shippingFee: 0, total: subtotal };

  return (
    <div className="min-h-screen pb-28 md:pb-12">
    <CheckoutHeader slug={slug} />
    <div className="mx-auto max-w-lg px-4 pt-6">
      <h1 className="font-display text-2xl font-semibold">{t('checkout.title')}</h1>

      {/* ----- items ----- */}
      <div className="mt-6 rounded-md border border-ink/10 bg-paper-soft p-4">
        {groupCartRows(items).map((row) => {
          if (row.wallId) {
            return (
              <div key={row.wallId} className="py-2">
                <WallCartCard lines={row.lines} />
              </div>
            );
          }
          const { item } = row;
          return (
          <div key={keyOf(item)} className="flex justify-between py-1 text-sm">
            <span>
              {item.name?.[language] || item.name?.en} × {item.quantity}
              {item.isPreorder && (
                <span className="ms-2 rounded border border-ink/25 px-1.5 py-0.5 text-[11px] text-ink-soft">
                  {t(item.madeStyle === 'madeToOrder' ? 'storefront.madeToOrder' : 'storefront.preorder')}
                </span>
              )}
              <OptionSummary labels={item.optionLabels} />
              {item.tierMinQty > 0 && (
                <span className="mt-0.5 block text-xs text-sage-dark">{t('storefront.qtyPriceApplied')}</span>
              )}
              {item.packageSize > 0 && (
                <span className="mt-0.5 block text-xs text-sage-dark">{t('storefront.pkgApplied')}</span>
              )}
            </span>
            <span>{money(lineAmount(item))}</span>
          </div>
          );
        })}
        <div className="mt-2 flex justify-between border-t border-ink/10 pt-2 text-sm font-semibold" data-checkout-top-total>
          <span>{t('checkout.total')}</span>
          <span>{money(shown.total)}</span>
        </div>
      </div>

      {items.some((i) => i.isPreorder) && (
        <p className="mt-4 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
          {t(madeWording(items.filter((i) => i.isPreorder)) === 'madeToOrder' ? 'storefront.madeToOrderCartNotice' : 'storefront.preorderCartNotice')}
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
            <div key={f.key}>
            <label className="block text-sm text-ink-soft">
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
                  onChange={(e) => {
                    const typed = filterTyped(f.key, e.target.value);
                    setRemovedFrom(typed.changed ? f.key : '');
                    setForm({ ...form, [f.key]: typed.value });
                  }}
                  onBlur={() => {
                    setRemovedFrom('');
                    setTouched({ ...touched, [f.key]: true });
                  }}
                  className={`${inputClass} ${f.type === 'email' || f.type === 'tel' ? 'rtl:text-right' : ''}`}
                />
              )}
            </label>
            {removedFrom === f.key && (
              <p className="mt-1 text-xs text-ink-soft" role="status">{t('checkout.lettersOnly')}</p>
            )}
            {!['phone', 'email'].includes(f.key) && touched[f.key] && fieldBad(f.key) && (
              <p className="mt-1 text-xs text-rust">
                {t('errors.BAD_FIELD_FORMAT', { field: t(`checkoutFields.${f.key}`) })}
              </p>
            )}
            {f.key === 'phone' && touched.phone && phoneBad && (
              <p className="mt-1 text-xs text-rust">{t('errors.BAD_PHONE')}</p>
            )}
            {f.key === 'email' && touched.email && emailBad && (
              <p className="mt-1 text-xs text-rust">{t('errors.BAD_EMAIL')}</p>
            )}
            {f.key === 'email' && touched.email && emailCheck.suggestion && (
              <p className="mt-1 text-xs text-brass-dark">
                {t('checkout.emailDidYouMean', { email: emailCheck.suggestion })}{' '}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, email: emailCheck.suggestion })}
                  className="font-semibold underline"
                >
                  {t('checkout.emailUseThis')}
                </button>
              </p>
            )}
            </div>
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
                  className={`${inputClass} ${['email', 'phone', 'number'].includes(f.type) ? 'rtl:text-right' : ''}`}
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
                onChange={(e) => changePromo(e.target.value)}
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
          {promoShapeBad && <p className="mt-1 text-sm text-rust">{t('checkout.promoShapeBad')}</p>}
          {appliedCode && !quote?.promo && quoteBusy && (
            <p className="mt-1 text-sm text-ink-soft">{t('checkout.promoChecking')}</p>
          )}
          {appliedCode && !quoteBusy && quoteFailed && (
            <p className="mt-1 text-sm text-rust">{t('checkout.promoCheckFailed')}</p>
          )}
          {appliedCode && !quoteBusy && !quoteFailed && !quote?.promo && quote?.promoError && (
            <p className="mt-1 text-sm text-rust">
              {promoErrorText(quote.promoError)}{' '}
              <button type="button" onClick={removePromo} className="underline">
                {t('checkout.promoRemove')}
              </button>
            </p>
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

        {/* Hidden trap: people never see or fill this; bots do. */}
        <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden opacity-0">
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-ink py-3 text-sm font-semibold uppercase tracking-wider text-paper transition hover:bg-brass hover:text-on-brass disabled:opacity-60"
        >
          {submitting ? t('checkout.placingOrder') : t('checkout.placeOrder')}
        </button>
      </form>
    </div>
    </div>
  );
}
