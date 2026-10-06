import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import { listProducts } from '../../firebase/products.service';
import { updateTenantSettings } from '../../firebase/tenants.service';
import AdminTopBar from '../../components/admin/AdminTopBar';
import {
  HERO_DEFAULT_SECONDS,
  HERO_MIN_SECONDS,
  HERO_MAX_SECONDS,
  HERO_FADE_MS,
} from '../../utils/constants';

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

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

export default function Settings() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant, reloadTenant } = useTenant();

  const [accent, setAccent] = useState('copper');
  const [logoUrl, setLogoUrl] = useState('');
  const [slides, setSlides] = useState([]);
  const [seconds, setSeconds] = useState(HERO_DEFAULT_SECONDS);
  const [fade, setFade] = useState('normal');
  const [products, setProducts] = useState([]);
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

    // Keep the timing inside safe limits.
    const safeSeconds = Math.min(
      HERO_MAX_SECONDS,
      Math.max(HERO_MIN_SECONDS, Number(seconds) || HERO_DEFAULT_SECONDS)
    );

    setSaving(true);
    try {
      await updateTenantSettings(tenant.id, {
        theme: { accent },
        brand: { logoUrl: logoUrl.trim() },
        hero: {
          slides: slides.map(formToSlide),
          intervalSeconds: safeSeconds,
          fade,
        },
      });
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
          <label className="mt-3 block text-sm text-ink-soft">
            {t('settingsPage.logoLink')}
            <input
              type="url"
              dir="ltr"
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className={inputClass}
            />
          </label>
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
                  <label className="col-span-full text-sm text-ink-soft">
                    {t('settingsPage.picLink')}
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="https://..."
                      value={s.imageUrl}
                      onChange={(e) => updateSlide(i, 'imageUrl', e.target.value)}
                      className={inputClass}
                    />
                  </label>
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
