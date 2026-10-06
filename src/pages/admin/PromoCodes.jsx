import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  listPromoCodes,
  createPromoCode,
  setPromoActive,
  promoDocId,
} from '../../firebase/promos.service';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { formatPrice } from '../../utils/format';

const emptyForm = {
  code: '',
  type: 'percent',
  value: '',
  minOrder: '',
  expiresAt: '',
  usageLimit: '',
};

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

export default function PromoCodes() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useTenant();

  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!tenant) return;
    setLoading(true);
    setCodes(await listPromoCodes(tenant.id));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');

    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      setError(t('promos.badCode'));
      return;
    }
    const value = Number(form.value);
    if (!value || value <= 0 || (form.type === 'percent' && value > 100)) {
      setError(t('promos.badValue'));
      return;
    }
    if (form.minOrder !== '' && Number(form.minOrder) < 0) {
      setError(t('promos.badMin'));
      return;
    }
    if (form.usageLimit !== '' && Number(form.usageLimit) < 1) {
      setError(t('promos.badLimit'));
      return;
    }
    if (codes.some((c) => c.id === promoDocId(tenant.id, code))) {
      setError(t('promos.exists'));
      return;
    }

    setSaving(true);
    try {
      await createPromoCode(tenant.id, { ...form, code });
      setForm(emptyForm);
      await refresh();
    } catch {
      setError(t('promos.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(promo) {
    await setPromoActive(promo.id, !promo.isActive);
    await refresh();
  }

  const describe = (c) =>
    c.type === 'percent' ? `${c.value}%` : formatPrice(c.value, language);

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <h1 className="font-display text-2xl font-semibold">{t('promos.title')}</h1>
      <p className="mb-8 mt-1 max-w-xl text-sm text-ink-soft">{t('promos.help')}</p>

      <form
        onSubmit={handleCreate}
        className="mb-8 grid max-w-2xl gap-4 rounded-md border border-ink/10 bg-paper-soft p-6 sm:grid-cols-2"
      >
        <label className="text-sm text-ink-soft">
          {t('promos.code')}
          <input
            type="text"
            dir="ltr"
            placeholder="WELCOME10"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className={inputClass + ' uppercase'}
          />
          <span className="mt-1 block text-xs text-ink-faint">{t('promos.codeHint')}</span>
        </label>

        <label className="text-sm text-ink-soft">
          {t('promos.type')}
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className={inputClass}
          >
            <option value="percent">{t('promos.percent')}</option>
            <option value="fixed">{t('promos.fixed')}</option>
          </select>
        </label>

        <label className="text-sm text-ink-soft">
          {t('promos.value')}
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-ink-soft">
          {t('promos.minOrder')}
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.minOrder}
            onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-ink-soft">
          {t('promos.expires')}
          <input
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-ink-soft">
          {t('promos.limit')}
          <input
            type="number"
            min="1"
            step="1"
            value={form.usageLimit}
            onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
            className={inputClass}
          />
        </label>

        {error && <p className="col-span-full text-sm text-rust">{error}</p>}

        <div className="col-span-full">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
          >
            {saving ? t('common.saving') : t('promos.add')}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : codes.length === 0 ? (
        <p className="text-ink-soft">{t('promos.none')}</p>
      ) : (
        <div className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
          {codes.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium" dir="ltr">
                  {c.code}{' '}
                  <span className="text-ink-soft">· {describe(c)}</span>
                </p>
                <p className="text-sm text-ink-soft">
                  {c.usageLimit
                    ? t('promos.usedOf', { n: c.usedCount || 0, max: c.usageLimit })
                    : t('promos.used', { n: c.usedCount || 0 })}
                  {c.minOrder > 0 &&
                    ` · ${t('promos.minShort', { amount: formatPrice(c.minOrder, language) })}`}
                  {c.expiresAt && ` · ${t('promos.until', { date: c.expiresAt })}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    'rounded px-2 py-0.5 text-xs ' +
                    (c.isActive ? 'bg-sage/15 text-sage-dark' : 'bg-ink/10 text-ink-soft')
                  }
                >
                  {c.isActive ? t('promos.active') : t('promos.inactive')}
                </span>
                <button
                  onClick={() => toggle(c)}
                  className="text-sm text-brass hover:underline"
                >
                  {c.isActive ? t('promos.deactivate') : t('promos.activate')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
