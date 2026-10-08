import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import { listProducts } from '../../firebase/products.service';
import { updateTenantSettings } from '../../firebase/tenants.service';
import AdminTopBar from '../../components/admin/AdminTopBar';
import ImageField from '../../components/admin/ImageField';
import { useAudit } from '../../hooks/useAudit';
import { fieldsOnly, stable } from '../../utils/audit';
import { getTenantPrivate, saveTenantPrivate } from '../../firebase/private.service';
import { findTelegramChats, sendTelegramTest } from '../../firebase/telegram.service';
import {
  HERO_DEFAULT_SECONDS,
  HERO_MIN_SECONDS,
  HERO_MAX_SECONDS,
  HERO_FADE_MS,
} from '../../utils/constants';
import {
  CHECKOUT_FIELDS,
  resolveFieldSettings,
  CUSTOM_FIELD_TYPES,
  MAX_CUSTOM_FIELDS,
  parseOptions,
  optionsToText,
} from '../../utils/checkoutFields';

// The colour choices. To add a new one: add it here, in the texts
// (settingsPage.<id>) AND in src/index.css.
const ACCENTS = [
  { id: 'copper', color: '#D98B4A' },
  { id: 'lime', color: '#C8F03C' },
  { id: 'ice', color: '#6CB8F5' },
  { id: 'white', color: '#FFFFFF' },
];

const MAX_SLIDES = 5;

const emptySlide = () => ({
  imageUrl: '',
  headlineEn: '',
  headlineAr: '',
  subtextEn: '',
  subtextAr: '',
  ctaEn: '',
  ctaAr: '',
  productId: '',
});

function slideToForm(s) {
  return {
    imageUrl: s.imageUrl || '',
    headlineEn: s.headline?.en || '',
    headlineAr: s.headline?.ar || '',
    subtextEn: s.subtext?.en || '',
    subtextAr: s.subtext?.ar || '',
    ctaEn: s.cta?.en || '',
    ctaAr: s.cta?.ar || '',
    productId: s.productId || '',
  };
}

function formToSlide(f) {
  return {
    imageUrl: f.imageUrl.trim(),
    headline: { en: f.headlineEn.trim(), ar: f.headlineAr.trim() || f.headlineEn.trim() },
    subtext: { en: f.subtextEn.trim(), ar: f.subtextAr.trim() || f.subtextEn.trim() },
    cta: { en: f.ctaEn.trim(), ar: f.ctaAr.trim() || f.ctaEn.trim() },
    productId: f.productId || '',
  };
}

const newZoneId = () => 'z' + Math.random().toString(36).slice(2, 8);

const emptyZone = () => ({
  id: newZoneId(),
  nameEn: '',
  nameAr: '',
  price: '',
  freeAbove: '',
  active: true,
});

function zoneToForm(z) {
  return {
    id: z.id,
    nameEn: z.name?.en || '',
    nameAr: z.name?.ar || '',
    price: z.price ?? '',
    freeAbove: z.freeAbove ? z.freeAbove : '',
    active: z.active !== false,
  };
}

function formToZone(f) {
  return {
    id: f.id,
    name: { en: f.nameEn.trim() || f.nameAr.trim(), ar: f.nameAr.trim() || f.nameEn.trim() },
    price: Number(f.price),
    freeAbove: f.freeAbove === '' ? null : Number(f.freeAbove),
    active: f.active,
  };
}

const emptyCustomField = () => ({
  id: 'c' + Math.random().toString(36).slice(2, 8),
  labelEn: '',
  labelAr: '',
  type: 'text',
  optionsText: '',
  required: false,
  active: true,
});

function customToForm(f) {
  return {
    id: f.id,
    labelEn: f.label?.en || '',
    labelAr: f.label?.ar || '',
    type: f.type,
    optionsText: optionsToText(f.options),
    required: f.required === true,
    active: f.active !== false,
  };
}

function formToCustom(f) {
  return {
    id: f.id,
    label: {
      en: f.labelEn.trim() || f.labelAr.trim(),
      ar: f.labelAr.trim() || f.labelEn.trim(),
    },
    type: f.type,
    options: f.type === 'select' ? parseOptions(f.optionsText) : [],
    required: f.required,
    active: f.active,
  };
}

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

export default function Settings() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant, reloadTenant } = useTenant();
  const log = useAudit(); // records who changed what (Activity log)

  const [accent, setAccent] = useState('copper');
  const [logoUrl, setLogoUrl] = useState('');
  const [slides, setSlides] = useState([]);
  const [seconds, setSeconds] = useState(HERO_DEFAULT_SECONDS);
  const [fade, setFade] = useState('normal');
  const [autoplay, setAutoplay] = useState(true);
  const [products, setProducts] = useState([]);
  const [fieldSettings, setFieldSettings] = useState(() => resolveFieldSettings(undefined));
  const [zones, setZones] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [countryCode, setCountryCode] = useState('20');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [notifyLanguage, setNotifyLanguage] = useState('en');
  const [chats, setChats] = useState(null); // null = not searched yet
  const [alertMessage, setAlertMessage] = useState('');
  const [alertBusy, setAlertBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenant) return;
    setAccent(tenant.theme?.accent || 'copper');
    setLogoUrl(tenant.brand?.logoUrl || '');
    setSlides((tenant.hero?.slides || []).map(slideToForm));
    setSeconds(tenant.hero?.intervalSeconds || HERO_DEFAULT_SECONDS);
    setFade(tenant.hero?.fade || 'normal');
    setAutoplay(tenant.hero?.autoplay !== false);
    setFieldSettings(resolveFieldSettings(tenant.checkout?.fields));
    setZones((tenant.shipping?.zones || []).map(zoneToForm));
    setCustomFields((tenant.checkout?.customFields || []).map(customToForm));
    setCountryCode(tenant.defaultCountryCode || '20');
    getTenantPrivate(tenant.id).then((p) => {
      setTelegramChatId(p.telegramChatId || '');
      setNotifyLanguage(p.notifyLanguage === 'ar' ? 'ar' : 'en');
    });
    listProducts(tenant.id).then(setProducts);
  }, [tenant]);

  function updateSlide(index, field, value) {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function moveSlide(index, direction) {
    setSlides((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function setFieldFlag(key, flag, value) {
    setFieldSettings((prev) => {
      const next = { ...prev[key], [flag]: value };
      if (flag === 'show' && !value) next.required = false; // hidden can't be required
      return { ...prev, [key]: next };
    });
  }

  // Telegram: show a readable message for what the helper answered.
  function alertErrorText(result) {
    if (result.error === 'NOT_CONFIGURED') return t('settingsPage.alertNotConfigured');
    return t('settingsPage.alertTestFail');
  }

  async function handleFindChats() {
    setAlertMessage('');
    setAlertBusy(true);
    const result = await findTelegramChats();
    setAlertBusy(false);
    if (!result.ok) {
      setChats(null);
      setAlertMessage(alertErrorText(result));
      return;
    }
    setChats(result.chats);
  }

  async function handleSendTest() {
    setAlertMessage('');
    setAlertBusy(true);
    const result = await sendTelegramTest(telegramChatId, notifyLanguage);
    setAlertBusy(false);
    setAlertMessage(result.ok ? t('settingsPage.alertTestOk') : alertErrorText(result));
  }

  function updateCustom(index, field, value) {
    setCustomFields((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  }

  function moveCustom(index, direction) {
    setCustomFields((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function updateZone(index, field, value) {
    setZones((prev) => prev.map((z, i) => (i === index ? { ...z, [field]: value } : z)));
  }

  function removeSlide(index) {
    setSlides((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const urls = [logoUrl, ...slides.map((s) => s.imageUrl)].filter((u) => u.trim());
    if (urls.some((u) => !/^https:\/\//i.test(u.trim()))) {
      setError(t('settingsPage.errHttps'));
      return;
    }

    if (
      zones.some(
        (z) =>
          !(z.nameEn.trim() || z.nameAr.trim()) ||
          z.price === '' ||
          Number(z.price) < 0 ||
          (z.freeAbove !== '' && Number(z.freeAbove) < 0)
      )
    ) {
      setError(t('settingsPage.errZone'));
      return;
    }

    if (
      customFields.some(
        (f) =>
          !(f.labelEn.trim() || f.labelAr.trim()) ||
          (f.type === 'select' && parseOptions(f.optionsText).length === 0)
      )
    ) {
      setError(t('settingsPage.errCustom'));
      return;
    }

    // Keep the timing inside safe limits.
    const safeSeconds = Math.min(
      HERO_MAX_SECONDS,
      Math.max(HERO_MIN_SECONDS, Number(seconds) || HERO_DEFAULT_SECONDS)
    );

    setSaving(true);
    try {
      await saveTenantPrivate(tenant.id, { telegramChatId, notifyLanguage });
      await updateTenantSettings(tenant.id, {
        defaultCountryCode: String(countryCode).replace(/\D/g, '') || '20',
        theme: { accent },
        brand: { logoUrl: logoUrl.trim() },
        hero: {
          slides: slides.map(formToSlide),
          intervalSeconds: safeSeconds,
          fade,
          autoplay,
        },
        checkout: {
          fields: fieldSettings,
          customFields: customFields.map(formToCustom),
        },
        shipping: { zones: zones.map(formToZone) },
      });
      // Note which parts of the settings were changed (compared with what was saved before).
      const saved = stable;
      const changed = [];
      if ((tenant.theme?.accent || 'copper') !== accent) changed.push('accent');
      if ((tenant.brand?.logoUrl || '') !== logoUrl.trim()) changed.push('logo');
      if (saved(tenant.hero?.slides || []) !== saved(slides.map(formToSlide)) ||
          (tenant.hero?.intervalSeconds || HERO_DEFAULT_SECONDS) !== safeSeconds ||
          (tenant.hero?.fade || 'normal') !== fade ||
          (tenant.hero?.autoplay !== false) !== autoplay) changed.push('banner');
      if (saved(resolveFieldSettings(tenant.checkout?.fields)) !== saved(fieldSettings)) changed.push('checkoutForm');
      if (saved(tenant.checkout?.customFields || []) !== saved(customFields.map(formToCustom))) changed.push('customFields');
      if (saved(tenant.shipping?.zones || []) !== saved(zones.map(formToZone))) changed.push('shipping');
      if ((tenant.defaultCountryCode || '20') !== (String(countryCode).replace(/\D/g, '') || '20')) changed.push('phoneCode');
      if (changed.length > 0) {
        log({
          action: 'settings.update',
          entityType: 'settings',
          entityLabel: '',
          changes: fieldsOnly(changed),
        });
      }
      setSeconds(safeSeconds);
      reloadTenant();
      setMessage(t('settingsPage.saved'));
    } catch {
      setError(t('settingsPage.errSave'));
    } finally {
      setSaving(false);
    }
  }

  if (!tenant) return null;

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <h1 className="mb-8 font-display text-2xl font-semibold">
        {t('admin.settings')}
      </h1>

      <form onSubmit={handleSave} className="max-w-3xl space-y-10">
        {/* ---------- Colour ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">
            {t('settingsPage.accentTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t('settingsPage.accentHelp')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {ACCENTS.map((a) => (
              <label
                key={a.id}
                className={
                  'flex cursor-pointer items-center gap-3 rounded border px-4 py-3 text-sm ' +
                  (accent === a.id ? 'border-ink bg-paper-soft' : 'border-ink/15')
                }
              >
                <input
                  type="radio"
                  name="accent"
                  value={a.id}
                  checked={accent === a.id}
                  onChange={() => setAccent(a.id)}
                  className="sr-only"
                />
                <span
                  className="h-6 w-6 rounded-full border border-ink/20"
                  style={{ backgroundColor: a.color }}
                />
                {t(`settingsPage.${a.id}`)}
              </label>
            ))}
          </div>
        </section>

        {/* ---------- Logo ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">
            {t('settingsPage.logoTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t('settingsPage.logoHelp')}</p>
          <div className="mt-3">
            <ImageField
              label={t('settingsPage.logoLink')}
              value={logoUrl}
              onChange={setLogoUrl}
            />
          </div>
        </section>

        {/* ---------- Banner slides ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">
            {t('settingsPage.bannerTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t('settingsPage.bannerHelp', { max: MAX_SLIDES })}
          </p>

          {/* Timing */}
          <div className="mt-4 rounded-md border border-ink/10 bg-paper-soft p-4">
            <p className="text-sm font-medium">{t('settingsPage.timingTitle')}</p>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
              />
              {t('settingsPage.autoplay')}
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink-soft">
                {t('settingsPage.stayFor')}
                <input
                  type="number"
                  min={HERO_MIN_SECONDS}
                  max={HERO_MAX_SECONDS}
                  step="1"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="text-sm text-ink-soft">
                {t('settingsPage.fadeSpeed')}
                <select
                  value={fade}
                  onChange={(e) => setFade(e.target.value)}
                  className={inputClass}
                >
                  {Object.keys(HERO_FADE_MS).map((key) => (
                    <option key={key} value={key}>
                      {t(
                        `settingsPage.fade${key.charAt(0).toUpperCase() + key.slice(1)}`
                      )}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              {t('settingsPage.timingNote')}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {slides.map((s, i) => (
              <div
                key={i}
                className="rounded-md border border-ink/10 bg-paper-soft p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {t('settingsPage.slide', { n: i + 1 })}
                  </p>
                  <div className="flex gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => moveSlide(i, -1)}
                      disabled={i === 0}
                      className="text-brass hover:underline disabled:opacity-40"
                    >
                      {t('settingsPage.up')}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlide(i, 1)}
                      disabled={i === slides.length - 1}
                      className="text-brass hover:underline disabled:opacity-40"
                    >
                      {t('settingsPage.down')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSlide(i)}
                      className="text-rust hover:underline"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="col-span-full">
                    <ImageField
                      label={t('settingsPage.picLink')}
                      value={s.imageUrl}
                      onChange={(url) => updateSlide(i, 'imageUrl', url)}
                    />
                  </div>
                  {s.imageUrl && (
                    <img
                      src={s.imageUrl}
                      alt=""
                      className="col-span-full h-32 w-full rounded object-cover"
                    />
                  )}

                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.headEn')}
                    <input
                      type="text"
                      dir="ltr"
                      value={s.headlineEn}
                      onChange={(e) => updateSlide(i, 'headlineEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.headAr')}
                    <input
                      type="text"
                      dir="rtl"
                      value={s.headlineAr}
                      onChange={(e) => updateSlide(i, 'headlineAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.subEn')}
                    <input
                      type="text"
                      dir="ltr"
                      value={s.subtextEn}
                      onChange={(e) => updateSlide(i, 'subtextEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.subAr')}
                    <input
                      type="text"
                      dir="rtl"
                      value={s.subtextAr}
                      onChange={(e) => updateSlide(i, 'subtextAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.ctaEn')}
                    <input
                      type="text"
                      dir="ltr"
                      placeholder={t('settingsPage.ctaPhEn')}
                      value={s.ctaEn}
                      onChange={(e) => updateSlide(i, 'ctaEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.ctaAr')}
                    <input
                      type="text"
                      dir="rtl"
                      placeholder={t('settingsPage.ctaPhAr')}
                      value={s.ctaAr}
                      onChange={(e) => updateSlide(i, 'ctaAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="col-span-full text-sm text-ink-soft">
                    {t('settingsPage.goes')}
                    <select
                      value={s.productId}
                      onChange={(e) => updateSlide(i, 'productId', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t('settingsPage.goesAll')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {t('settingsPage.goesProduct', {
                            name: p.name?.[language] || p.name?.en,
                          })}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>

          {slides.length < MAX_SLIDES && (
            <button
              type="button"
              onClick={() => setSlides((prev) => [...prev, emptySlide()])}
              className="mt-4 rounded border border-ink/15 px-4 py-2 text-sm hover:border-brass"
            >
              {t('settingsPage.addSlide')}
            </button>
          )}
        </section>

        {/* ---------- Checkout form ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">
            {t('settingsPage.checkoutTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t('settingsPage.checkoutHelp')}</p>
          <div className="mt-4 overflow-x-auto rounded-md border border-ink/10 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-start text-ink-soft">
                  <th className="px-4 py-2 text-start font-medium">{t('settingsPage.colField')}</th>
                  <th className="px-4 py-2 text-center font-medium">{t('settingsPage.colShow')}</th>
                  <th className="px-4 py-2 text-center font-medium">{t('settingsPage.colRequired')}</th>
                </tr>
              </thead>
              <tbody>
                {CHECKOUT_FIELDS.map((f) => {
                  const s = fieldSettings[f.key];
                  return (
                    <tr key={f.key} className="border-b border-ink/5 last:border-0">
                      <td className="px-4 py-2">{t(`checkoutFields.${f.key}`)}</td>
                      <td className="px-4 py-2 text-center">
                        {f.locked ? (
                          <span className="text-xs text-ink-faint">{t('settingsPage.always')}</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={s.show}
                            onChange={(e) => setFieldFlag(f.key, 'show', e.target.checked)}
                            aria-label={`${t('settingsPage.colShow')} ${t(`checkoutFields.${f.key}`)}`}
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {f.locked ? (
                          <span className="text-xs text-ink-faint">{t('settingsPage.always')}</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={s.required}
                            disabled={!s.show}
                            onChange={(e) => setFieldFlag(f.key, 'required', e.target.checked)}
                            aria-label={`${t('settingsPage.colRequired')} ${t(`checkoutFields.${f.key}`)}`}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ----- the shop's own extra fields ----- */}
          <h3 className="mt-8 font-display text-base font-medium">
            {t('settingsPage.customTitle')}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">{t('settingsPage.customHelp')}</p>

          <div className="mt-4 space-y-4">
            {customFields.map((f, i) => (
              <div key={f.id} className="rounded-md border border-ink/10 bg-paper-soft p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">{t('settingsPage.fieldN', { n: i + 1 })}</p>
                  <div className="flex gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => moveCustom(i, -1)}
                      disabled={i === 0}
                      className="text-brass hover:underline disabled:opacity-40"
                    >
                      {t('settingsPage.up')}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCustom(i, 1)}
                      disabled={i === customFields.length - 1}
                      className="text-brass hover:underline disabled:opacity-40"
                    >
                      {t('settingsPage.down')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomFields((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-rust hover:underline"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.labelEn')}
                    <input
                      type="text"
                      dir="ltr"
                      value={f.labelEn}
                      onChange={(e) => updateCustom(i, 'labelEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.labelAr')}
                    <input
                      type="text"
                      dir="rtl"
                      value={f.labelAr}
                      onChange={(e) => updateCustom(i, 'labelAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.fieldType')}
                    <select
                      value={f.type}
                      onChange={(e) => updateCustom(i, 'type', e.target.value)}
                      className={inputClass}
                    >
                      {CUSTOM_FIELD_TYPES.map((ty) => (
                        <option key={ty} value={ty}>
                          {t(`settingsPage.type_${ty}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-col justify-end gap-2 text-sm text-ink-soft">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateCustom(i, 'required', e.target.checked)}
                      />
                      {t('settingsPage.colRequired')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={f.active}
                        onChange={(e) => updateCustom(i, 'active', e.target.checked)}
                      />
                      {t('settingsPage.fieldActive')}
                    </label>
                  </div>
                  {f.type === 'select' && (
                    <label className="col-span-full text-sm text-ink-soft">
                      {t('settingsPage.optionsLabel')}
                      <textarea
                        rows={4}
                        value={f.optionsText}
                        onChange={(e) => updateCustom(i, 'optionsText', e.target.value)}
                        className={inputClass}
                      />
                      <span className="mt-1 block text-xs text-ink-faint">
                        {t('settingsPage.optionsHint')}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          {customFields.length < MAX_CUSTOM_FIELDS && (
            <button
              type="button"
              onClick={() => setCustomFields((prev) => [...prev, emptyCustomField()])}
              className="mt-4 rounded border border-ink/15 px-4 py-2 text-sm hover:border-brass"
            >
              {t('settingsPage.addField')}
            </button>
          )}
        </section>

        {/* ---------- Shipping zones ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">
            {t('settingsPage.shippingTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t('settingsPage.shippingHelp')}</p>

          <div className="mt-4 space-y-4">
            {zones.map((z, i) => (
              <div key={z.id} className="rounded-md border border-ink/10 bg-paper-soft p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">{t('settingsPage.zoneN', { n: i + 1 })}</p>
                  <button
                    type="button"
                    onClick={() => setZones((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-sm text-rust hover:underline"
                  >
                    {t('common.remove')}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.zoneNameEn')}
                    <input
                      type="text"
                      dir="ltr"
                      value={z.nameEn}
                      onChange={(e) => updateZone(i, 'nameEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.zoneNameAr')}
                    <input
                      type="text"
                      dir="rtl"
                      value={z.nameAr}
                      onChange={(e) => updateZone(i, 'nameAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.zonePrice')}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={z.price}
                      onChange={(e) => updateZone(i, 'price', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    {t('settingsPage.zoneFreeAbove')}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={z.freeAbove}
                      onChange={(e) => updateZone(i, 'freeAbove', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="col-span-full flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={z.active}
                      onChange={(e) => updateZone(i, 'active', e.target.checked)}
                    />
                    {t('settingsPage.zoneActive')}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setZones((prev) => [...prev, emptyZone()])}
            className="mt-4 rounded border border-ink/15 px-4 py-2 text-sm hover:border-brass"
          >
            {t('settingsPage.addZone')}
          </button>
        </section>

        {/* ---------- Order alerts + WhatsApp ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">
            {t('settingsPage.alertsTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t('settingsPage.alertsHelp')}</p>
          <p className="mt-1 text-sm text-ink-soft">{t('settingsPage.alertsSteps')}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink-soft">
              {t('settingsPage.chatId')}
              <input
                type="text"
                dir="ltr"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm text-ink-soft">
              {t('settingsPage.alertLang')}
              <select
                value={notifyLanguage}
                onChange={(e) => setNotifyLanguage(e.target.value)}
                className={inputClass}
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleFindChats}
              disabled={alertBusy}
              className="rounded border border-ink/15 px-4 py-2 text-sm hover:border-brass disabled:opacity-60"
            >
              {t('settingsPage.findChats')}
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={alertBusy || !telegramChatId.trim()}
              className="rounded border border-ink/15 px-4 py-2 text-sm hover:border-brass disabled:opacity-60"
            >
              {t('settingsPage.sendTest')}
            </button>
          </div>

          {chats && (
            <div className="mt-3 text-sm">
              {chats.length === 0 ? (
                <p className="text-ink-soft">{t('settingsPage.noChats')}</p>
              ) : (
                <>
                  <p className="text-ink-soft">{t('settingsPage.pickChat')}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {chats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setTelegramChatId(c.id);
                          setChats(null);
                        }}
                        className="rounded border border-ink/15 bg-white px-3 py-1.5 hover:border-brass"
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {alertMessage && <p className="mt-3 text-sm text-ink-soft">{alertMessage}</p>}

          <label className="mt-6 block max-w-xs text-sm text-ink-soft">
            {t('settingsPage.phoneCode')}
            <input
              type="text"
              dir="ltr"
              inputMode="numeric"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-faint">
              {t('settingsPage.phoneCodeHint')}
            </span>
          </label>
        </section>

        {error && <p className="text-sm text-rust">{error}</p>}
        {message && (
          <p className="text-sm text-sage-dark">
            {message}{' '}
            <a
              href={`/store/${tenant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {t('settingsPage.openStore')}
            </a>
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-ink px-6 py-2.5 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
        >
          {saving ? t('common.saving') : t('settingsPage.saveBtn')}
        </button>
      </form>
    </div>
  );
}
