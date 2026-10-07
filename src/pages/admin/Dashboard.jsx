import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { listProducts } from '../../firebase/products.service';
import { listOrders } from '../../firebase/orders.service';
import LanguageSwitch from '../../components/shared/LanguageSwitch';
import { LOW_STOCK_THRESHOLD } from '../../utils/constants';


export default function Dashboard() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { logout } = useAuth();
  const { tenant, loading } = useTenant();
  const storefrontUrl = tenant ? '/store/' + tenant.slug : '';

  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function checkStock() {
      if (!tenant) return;
      const products = await listProducts(tenant.id);
      setLowStockCount(
        // Preorder products are meant to have no stock, so they don't count.
        products.filter((p) => !p.isPreorder && p.stock <= LOW_STOCK_THRESHOLD)
          .length
      );
    }
    async function checkOrders() {
      if (!tenant) return;
      const orders = await listOrders(tenant.id);
      setPendingCount(orders.filter((o) => o.status === 'pending').length);
    }
    checkStock();
    checkOrders();
  }, [tenant]);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
        <div>
          <span className="font-display text-lg font-medium">
            {t('admin.dashboard')}
          </span>
          {tenant && (
            <p className="text-xs text-ink-faint">
              {tenant.name?.[language] || tenant.name?.en} ·{' '}
              <span dir="ltr">{window.location.host}/store/{tenant.slug}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <button
            onClick={logout}
            className="rounded border border-ink/15 px-3 py-1.5 text-sm text-ink-soft hover:border-rust hover:text-rust"
          >
            {t('admin.signOut')}
          </button>
        </div>
      </header>

      <main className="px-6 py-12">
        {loading ? (
          <p className="text-ink-soft">{t('common.loading')}</p>
        ) : (
          <>
            <p className="text-ink-soft">
              <Trans
                i18nKey="dash.managing"
                values={{ name: tenant?.name?.[language] || tenant?.name?.en }}
                components={{ b: <strong /> }}
              />
            </p>

            {pendingCount > 0 && (
              <Link
                to="/admin/orders"
                className="mt-4 block max-w-3xl rounded border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-sage-dark transition hover:border-sage"
              >
                {t('dash.pending', { n: pendingCount })}
              </Link>
            )}

            {lowStockCount > 0 && (
              <Link
                to="/admin/products"
                className="mt-4 block max-w-3xl rounded border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-brass-dark transition hover:border-brass"
              >
                {t('dash.lowStock', { n: lowStockCount })}
              </Link>
            )}

            <div className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                to="/admin/orders"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  {t('admin.orders')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t('dash.ordersDesc')}
                </p>
              </Link>

              <Link
                to="/admin/products"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  {t('admin.products')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t('dash.productsDesc')}
                </p>
              </Link>

              <Link
                to="/admin/expenses"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  {t('admin.expenses')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t('dash.expensesDesc')}
                </p>
              </Link>

              <Link
                to="/admin/pnl"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  {t('pnl.title')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t('dash.pnlDesc')}
                </p>
              </Link>

              <Link
                to="/admin/promos"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  {t('promos.title')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">{t('dash.promosDesc')}</p>
              </Link>

              <Link
                to="/admin/settings"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  {t('admin.settings')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {t('dash.settingsDesc')}
                </p>
              </Link>

              {tenant && (
                <a
                  href={storefrontUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
                >
                  <h2 className="font-display text-lg font-medium">
                    {t('dash.viewStore')}
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    {t('dash.viewStoreDesc')}
                  </p>
                </a>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
