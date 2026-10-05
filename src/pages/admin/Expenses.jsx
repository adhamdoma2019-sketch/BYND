import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import {
  listExpenses,
  createExpense,
  deleteExpense,
} from '../../firebase/expenses.service';

const CATEGORIES = [
  'materials',
  'printing',
  'packaging',
  'shipping',
  'ads',
  'other',
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Expenses() {
  const { t } = useTranslation();
  const { tenant } = useTenant();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: 'materials',
    description: '',
    amount: '',
    date: todayStr(),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
      setError('Enter a valid amount.');
      return;
    }
    if (!form.date) {
      setError('Pick a date.');
      return;
    }

    setSaving(true);
    try {
      await createExpense(tenant.id, form);
      setForm({
        category: 'materials',
        description: '',
        amount: '',
        date: todayStr(),
      });
      await refresh();
    } catch {
      setError('Could not save the expense. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this expense?')) return;
    await deleteExpense(id);
    await refresh();
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen px-6 py-10">
      <h1 className="mb-8 font-display text-2xl font-semibold">
        {t('admin.expenses')}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid max-w-2xl gap-4 rounded-md border border-ink/10 bg-paper-soft p-6 sm:grid-cols-2"
      >
        <label className="text-sm text-ink-soft">
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-ink-soft">
          Amount (EGP)
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <label className="text-sm text-ink-soft">
          Date
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <label className="text-sm text-ink-soft">
          Description (optional)
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. 2 boxes of paper"
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        {error && <p className="col-span-full text-sm text-rust">{error}</p>}

        <div className="col-span-full">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
          >
            {saving ? 'Saving...' : t('common.save')}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : (
        <>
          <div className="mb-4 flex justify-between text-lg font-medium">
            <span>{t('admin.totalExpenses')}</span>
            <span>{total} EGP</span>
          </div>
          {expenses.length === 0 ? (
            <p className="text-ink-soft">No expenses logged yet.</p>
          ) : (
            <div className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium capitalize">{exp.category}</p>
                    <p className="text-sm text-ink-soft">
                      {exp.date} {exp.description && '· ' + exp.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{exp.amount} EGP</span>
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
