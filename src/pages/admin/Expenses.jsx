import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  listExpenses,
  createExpense,
  deleteExpense,
} from '../../firebase/expenses.service';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { useAudit } from '../../hooks/useAudit';
import { formatPrice } from '../../utils/format';

// Categories offered for NEW expenses. Older records may use others
// (printing, ads...), which still display correctly.
const CATEGORIES = [
  'manufacturing',
  'materials',
  'packaging',
  'marketing',
  'shipping',
  'software',
  'other',
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

export default function Expenses() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useTenant();
  const log = useAudit(); // records who changed what (Activity log)

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: 'manufacturing',
    description: '',
    amount: '',
    date: todayStr(),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const categoryLabel = (c) => t(`expenses.cat.${c}`, { defaultValue: c });

  async function refresh() {
    if (!tenant) return;
    setLoading(true);
    const data = await listExpenses(tenant.id);
    setExpenses(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.amount || Number(form.amount) <= 0) {
      setError(t('expenses.badAmount'));
      return;
    }
    if (!form.date) {
      setError(t('expenses.pickDate'));
      return;
    }

    setSaving(true);
    try {
      await createExpense(tenant.id, form);
      log({
        action: 'expense.create',
        entityType: 'expense',
        entityLabel: `${t(`expenses.cat.${form.category}`, { defaultValue: form.category })} ${form.amount}`,
        changes: [{ field: 'amount', to: String(form.amount) }],
      });
      setForm({
        category: 'manufacturing',
        description: '',
        amount: '',
        date: todayStr(),
      });
      await refresh();
    } catch {
      setError(t('expenses.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('expenses.confirmDelete'))) return;
    const removed = expenses.find((x) => x.id === id);
    await deleteExpense(id);
    log({
      action: 'expense.delete',
      entityType: 'expense',
      entityId: id,
      entityLabel: removed
        ? `${t(`expenses.cat.${removed.category}`, { defaultValue: removed.category })} ${removed.amount}`
        : '',
    });
    await refresh();
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <h1 className="mb-8 font-display text-2xl font-semibold">
        {t('admin.expenses')}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid max-w-2xl gap-4 rounded-md border border-ink/10 bg-paper-soft p-6 sm:grid-cols-2"
      >
        <label className="text-sm text-ink-soft">
          {t('expenses.category')}
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-ink-soft">
          {t('expenses.amount')}
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-ink-soft">
          {t('expenses.date')}
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="text-sm text-ink-soft">
          {t('expenses.description')}
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('expenses.descPh')}
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
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : (
        <>
          <div className="mb-4 flex justify-between text-lg font-medium">
            <span>{t('admin.totalExpenses')}</span>
            <span>{formatPrice(total, language)}</span>
          </div>
          {expenses.length === 0 ? (
            <p className="text-ink-soft">{t('expenses.none')}</p>
          ) : (
            <div className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{categoryLabel(exp.category)}</p>
                    <p className="text-sm text-ink-soft">
                      {exp.date} {exp.description && '· ' + exp.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{formatPrice(exp.amount, language)}</span>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="text-sm text-rust hover:underline"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
