import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import { listOrders } from '../../firebase/orders.service';
import { listProducts, listProductCosts } from '../../firebase/products.service';
import { listExpenses } from '../../firebase/expenses.service';
import { calcDashboard, daysSince } from '../../utils/stats';
import { can, canSeeCosts } from '../../utils/roles';
import { formatPrice } from '../../utils/format';
import { statusBadgeClass } from '../../utils/orderRules';

function Tile({ label, value, tone, to }) {
  const color =
    tone === 'good' ? 'text-sage-dark' : tone === 'bad' ? 'text-rust' : 'text-ink';
  const body = (
    <>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</p>
    </>
  );
  const cls = 'rounded-md border border-ink/10 bg-paper-soft p-4';
  return to ? (
    <Link to={to} className={cls + ' transition hover:border-brass'}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// The numbers a shop owner wants first: what needs doing, sales and profit, stock.
export default function DashboardStats() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant, role } = useTenant();
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('thisMonth');

  const showMoney = can(role, 'pnl');
  const showStock = can(role, 'products');
  const money = (n) => formatPrice(n, language);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    async function load() {
      // Each person only loads what their role may see.
      const [orders, products, expenses, costs] = await Promise.all([
        listOrders(tenant.id),
        showStock ? listProducts(tenant.id) : [],
        showMoney ? listExpenses(tenant.id) : [],
        canSeeCosts(role) ? listProductCosts(tenant.id) : {},
      ]);
      if (!cancelled) setData({ orders, products, expenses, costs });
    }
    load().catch(() => !cancelled && setData({ orders: [], products: [], expenses: [], costs: {} }));
    return () => {
      cancelled = true;
    };
  }, [tenant, role, showMoney, showStock]);

  const stats = useMemo(
    () => (data ? calcDashboard({ ...data, period }) : null),
    [data, period]
  );

  // Reminder for owners: download a backup now and then.
  const lastBackup = tenant ? localStorage.getItem(`backup:${tenant.id}`) : null;
  const days = daysSince(lastBackup);
  const backupDue = role === 'owner' && (days === null || days >= 7);

  if (!stats) return <p className="mt-8 text-ink-soft">{t('common.loading')}</p>;
  const { counts, sales, inventory, recent } = stats;
  const when = (o) =>
    o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB')
      : '';

  return (
    <div className="mt-6 max-w-3xl space-y-8">
      {backupDue && (
        <Link
          to="/admin/settings"
          className="block rounded border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-brass-dark transition hover:border-brass"
        >
          {days === null ? t('stats.backupNever') : t('stats.backupDue', { days })}{' '}
          <span className="underline">{t('stats.backupGo')}</span>
        </Link>
      )}

      {/* ----- what needs doing ----- */}
      <section>
        <h2 className="font-display text-lg font-medium">{t('stats.operations')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Tile label={t('stats.pending')} value={counts.pending} tone={counts.pending > 0 ? 'good' : undefined} to="/admin/orders" />
          <Tile label={t('stats.inProgress')} value={counts.inProgress} to="/admin/orders" />
          <Tile label={t('stats.delivered')} value={counts.delivered} to="/admin/orders" />
          <Tile label={t('stats.cancelled')} value={counts.cancelled} to="/admin/orders" />
          <Tile label={t('stats.returned')} value={counts.returned} tone={counts.returned > 0 ? 'bad' : undefined} to="/admin/orders" />
        </div>
      </section>

      {/* ----- sales and profit (owners and managers) ----- */}
      {showMoney && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium">{t('stats.money')}</h2>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded border border-ink/15 bg-white px-3 py-1.5 text-sm"
              aria-label={t('pnl.period')}
            >
              <option value="thisMonth">{t('pnl.thisMonth')}</option>
              <option value="lastMonth">{t('pnl.lastMonth')}</option>
              <option value="all">{t('pnl.allTime')}</option>
            </select>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label={t('stats.sales')} value={money(sales.revenue)} />
            <Tile label={t('stats.ordersPlaced')} value={stats.ordersInPeriod} />
            <Tile label={t('pnl.grossProfit')} value={money(sales.grossProfit)} tone={sales.grossProfit >= 0 ? 'good' : 'bad'} />
            <Tile label={t('stats.expenses')} value={money(sales.expensesTotal)} />
            <Tile label={t('pnl.netProfit')} value={money(sales.netProfit)} tone={sales.netProfit >= 0 ? 'good' : 'bad'} />
            <Tile label={t('pnl.openOrders')} value={money(sales.expectedRevenue)} />
          </div>
          {sales.ordersMissingCost > 0 && (
            <p className="mt-3 text-xs text-brass-dark">
              {t('pnl.missingCost', { n: sales.ordersMissingCost })}
            </p>
          )}
        </section>
      )}

      {/* ----- stock ----- */}
      {showStock && (
        <section>
          <h2 className="font-display text-lg font-medium">{t('stats.inventory')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label={t('stats.units')} value={inventory.units} />
            {canSeeCosts(role) && (
              <Tile
                label={t('stats.stockValue')}
                value={money(inventory.valueAtCost) + (inventory.valueKnown ? '' : '*')}
              />
            )}
            <Tile
              label={t('stats.lowStock')}
              value={inventory.lowStock.length}
              tone={inventory.lowStock.length > 0 ? 'bad' : 'good'}
              to="/admin/products"
            />
          </div>
          {canSeeCosts(role) && !inventory.valueKnown && (
            <p className="mt-2 text-xs text-ink-faint">{t('stats.valueNote')}</p>
          )}
          {inventory.lowStock.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              {inventory.lowStock.slice(0, 5).map((p) => (
                <li key={p.id} className="flex justify-between rounded border border-ink/10 bg-white px-3 py-2">
                  <span>{p.name?.[language] || p.name?.en}</span>
                  <span className={Number(p.stock) <= 0 ? 'text-rust' : 'text-brass-dark'}>
                    {Number(p.stock) <= 0 ? t('storefront.outOfStock') : p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ----- latest orders ----- */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">{t('stats.recent')}</h2>
          {recent.length > 0 && (
            <Link to="/admin/orders" className="text-sm text-brass hover:underline">
              {t('stats.viewAll')}
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">{t('stats.noOrders')}</p>
        ) : (
          <div className="mt-3 divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
            {recent.map((o) => (
              <Link
                key={o.id}
                to="/admin/orders"
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition hover:bg-paper-soft"
              >
                <span>
                  <strong>{o.orderNumberLabel || `#${o.orderNumber}`}</strong>{' '}
                  <span className="text-ink-soft">{o.customer?.name}</span>
                  <span className="ms-2 text-xs text-ink-faint">{when(o)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-ink-soft">{money(o.totalAmount)}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${statusBadgeClass(o.status)}`}>
                    {t(`admin.status.${o.status}`, { defaultValue: o.status })}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
