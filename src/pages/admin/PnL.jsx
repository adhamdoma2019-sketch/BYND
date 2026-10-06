import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import { listOrders } from '../../firebase/orders.service';
import { listExpenses } from '../../firebase/expenses.service';
import { calcProfit } from '../../utils/profit';
import { formatPrice } from '../../utils/format';
import AdminTopBar from '../../components/admin/AdminTopBar';

// One line of the report. `strong` lines are the totals (gross / net profit).
function Row({ label, value, tone, strong }) {
  const toneClass =
    tone === 'good' ? 'text-sage-dark' : tone === 'bad' ? 'text-rust' : 'text-ink';
  return (
    <div
      className={
        'flex justify-between ' +
        (strong
          ? 'border-t border-ink/10 pt-4 text-xl font-semibold'
          : 'text-lg')
      }
    >
      <span className={strong ? '' : 'text-ink-soft'}>{label}</span>
      <span className={(strong ? '' : 'font-medium ') + toneClass}>{value}</span>
    </div>
  );
}

export default function PnL() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useTenant();

  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!tenant) return;
      setLoading(true);
      const [o, e] = await Promise.all([
        listOrders(tenant.id),
        listExpenses(tenant.id),
      ]);
      setOrders(o);
      setExpenses(e);
      setLoading(false);
    }
    load();
  }, [tenant]);

  const r = useMemo(
    () => calcProfit(orders, expenses, period),
    [orders, expenses, period]
  );
  const money = (n) => formatPrice(n, language);

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold">{t('pnl.title')}</h1>
        <label className="text-sm text-ink-soft">
          {t('pnl.period')}{' '}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="ms-2 rounded border border-ink/15 bg-white px-3 py-1.5 text-ink"
          >
            <option value="all">{t('pnl.allTime')}</option>
            <option value="thisMonth">{t('pnl.thisMonth')}</option>
            <option value="lastMonth">{t('pnl.lastMonth')}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : (
        <>
          <div className="max-w-md space-y-4 rounded-md border border-ink/10 bg-white p-6">
            <Row label={t('pnl.revenue')} value={money(r.revenue)} tone="good" />
            <Row
              label={t('pnl.cogs')}
              value={`− ${money(r.cogs)}`}
              tone="bad"
            />
            <Row
              strong
              label={t('pnl.grossProfit')}
              value={money(r.grossProfit)}
              tone={r.grossProfit >= 0 ? 'good' : 'bad'}
            />
            <Row
              label={t('pnl.expenses')}
              value={`− ${money(r.expensesTotal)}`}
              tone="bad"
            />
            <Row
              strong
              label={t('pnl.netProfit')}
              value={money(r.netProfit)}
              tone={r.netProfit >= 0 ? 'good' : 'bad'}
            />
          </div>

          {r.ordersMissingCost > 0 && (
            <p className="mt-4 max-w-md rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
              {t('pnl.missingCost', { n: r.ordersMissingCost })}
            </p>
          )}

          <div className="mt-4 max-w-md rounded-md border border-ink/10 bg-paper-soft px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">{t('pnl.openOrders')}</span>
              <span className="font-medium">{money(r.expectedRevenue)}</span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">{t('pnl.openOrdersNote')}</p>
          </div>

          <p className="mt-6 max-w-md text-sm text-ink-faint">{t('pnl.note')}</p>
        </>
      )}
    </div>
  );
}
