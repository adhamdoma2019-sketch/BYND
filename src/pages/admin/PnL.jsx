import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { listOrders } from '../../firebase/orders.service';
import { listExpenses } from '../../firebase/expenses.service';

export default function PnL() {
  const { t } = useTranslation();
  const { tenant } = useTenant();

  const [revenue, setRevenue] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!tenant) return;
      setLoading(true);
      const [orders, expenses] = await Promise.all([
        listOrders(tenant.id),
        listExpenses(tenant.id),
      ]);

      const rev = orders
        .filter((o) => o.status !== 'cancelled')
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const exp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      setRevenue(rev);
      setExpensesTotal(exp);
      setLoading(false);
    }
    load();
  }, [tenant]);

  const net = revenue - expensesTotal;

  return (
    <div className="min-h-screen px-6 py-10">
      <h1 className="mb-8 font-display text-2xl font-semibold">
        Profit &amp; Loss
      </h1>

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : (
        <div className="max-w-md space-y-4 rounded-md border border-ink/10 bg-white p-6">
          <div className="flex justify-between text-lg">
            <span className="text-ink-soft">{t('admin.revenue')}</span>
            <span className="font-medium text-sage-dark">{revenue} EGP</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-ink-soft">{t('admin.totalExpenses')}</span>
            <span className="font-medium text-rust">− {expensesTotal} EGP</span>
          </div>
          <div className="flex justify-between border-t border-ink/10 pt-4 text-xl font-semibold">
            <span>{t('admin.netProfit')}</span>
            <span className={net >= 0 ? 'text-sage-dark' : 'text-rust'}>
              {net} EGP
            </span>
          </div>
        </div>
      )}

      <p className="mt-6 max-w-md text-sm text-ink-faint">
        Revenue counts all non-cancelled orders. Expenses come from what you've
        logged in the Expenses screen.
      </p>
    </div>
  );
}
