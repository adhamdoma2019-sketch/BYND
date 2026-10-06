import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { listProducts } from '../../firebase/products.service';
import { updateTenantSettings } from '../../firebase/tenants.service';

// The colour choices. To add a new one: add it here AND in src/index.css.
const ACCENTS = [
  { id: 'copper', label: 'Copper', color: '#D98B4A' },
  { id: 'lime', label: 'Lime', color: '#C8F03C' },
  { id: 'ice', label: 'Ice blue', color: '#6CB8F5' },
  { id: 'white', label: 'White (monochrome)', color: '#FFFFFF' },
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
  const { tenant, reloadTenant } = useTenant();

  const [accent, setAccent] = useState('copper');
  const [logoUrl, setLogoUrl] = useState('');
  const [slides, setSlides] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenant) return;
    setAccent(tenant.theme?.accent || 'copper');
    setLogoUrl(tenant.brand?.logoUrl || '');
    setSlides((tenant.hero?.slides || []).map(slideToForm));
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
      setError('Image links must start with https://');
      return;
    }

    setSaving(true);
    try {
      await updateTenantSettings(tenant.id, {
        theme: { accent },
        brand: { logoUrl: logoUrl.trim() },
        hero: { slides: slides.map(formToSlide) },
      });
      reloadTenant();
      setMessage('Saved. Open your storefront to see the changes.');
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!tenant) return null;

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <Link to="/admin" className="text-sm text-brass hover:underline">
          ← Dashboard
        </Link>
      </div>

      <form onSubmit={handleSave} className="max-w-3xl space-y-10">
        {/* ---------- Colour ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">Accent color</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Used for buttons, highlights and links on your shop. The shop is
            always dark; only this color changes.
          </p>
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
                {a.label}
              </label>
            ))}
          </div>
        </section>

        {/* ---------- Logo ---------- */}
        <section>
          <h2 className="font-display text-lg font-medium">Logo (optional)</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Paste a link to your logo image (a transparent PNG or SVG works
            best). Until you add one, the shop name is shown as text.
          </p>
          <label className="mt-3 block text-sm text-ink-soft">
            Logo image link
            <input
              type="url"
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
            Home page banner
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            The big picture at the top of your shop. Add one slide for a still
            banner, or up to {MAX_SLIDES} for a slideshow that changes by
            itself. Change the pictures here whenever you like. If you add
            none, the first product photo is used.
          </p>

          <div className="mt-4 space-y-5">
            {slides.map((s, i) => (
              <div
                key={i}
                className="rounded-md border border-ink/10 bg-paper-soft p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium">Slide {i + 1}</p>
                  <div className="flex gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => moveSlide(i, -1)}
                      disabled={i === 0}
                      className="text-brass hover:underline disabled:opacity-40"
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlide(i, 1)}
                      disabled={i === slides.length - 1}
                      className="text-brass hover:underline disabled:opacity-40"
                    >
                      ↓ Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSlide(i)}
                      className="text-rust hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="col-span-full text-sm text-ink-soft">
                    Picture link
                    <input
                      type="url"
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
                    Headline (English)
                    <input
                      type="text"
                      value={s.headlineEn}
                      onChange={(e) => updateSlide(i, 'headlineEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    العنوان (Arabic)
                    <input
                      type="text"
                      dir="rtl"
                      value={s.headlineAr}
                      onChange={(e) => updateSlide(i, 'headlineAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    Small text (English, optional)
                    <input
                      type="text"
                      value={s.subtextEn}
                      onChange={(e) => updateSlide(i, 'subtextEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    النص الصغير (Arabic)
                    <input
                      type="text"
                      dir="rtl"
                      value={s.subtextAr}
                      onChange={(e) => updateSlide(i, 'subtextAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    Button text (English)
                    <input
                      type="text"
                      placeholder="Shop now"
                      value={s.ctaEn}
                      onChange={(e) => updateSlide(i, 'ctaEn', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm text-ink-soft">
                    نص الزر (Arabic)
                    <input
                      type="text"
                      dir="rtl"
                      placeholder="تسوّق الآن"
                      value={s.ctaAr}
                      onChange={(e) => updateSlide(i, 'ctaAr', e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="col-span-full text-sm text-ink-soft">
                    Where the button goes
                    <select
                      value={s.productId}
                      onChange={(e) => updateSlide(i, 'productId', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Scroll down to all products</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          Open product: {p.name?.en}
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
              + Add slide
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
              Open storefront ↗
            </a>
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-ink px-6 py-2.5 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
