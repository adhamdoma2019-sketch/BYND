import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { listProducts } from '../../firebase/products.service';
import LanguageSwitch from '../../components/shared/LanguageSwitch';
import { LOW_STOCK_THRESHOLD } from '../../utils/constants';


export default function Dashboard() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { tenant, loading } = useTenant();
  const storefrontUrl = tenant ? '/store/' + tenant.slug : '';

  const [lowStockCount, setLowStockCount] = useState(0);

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
    checkStock();
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
              {tenant.name?.en} · {window.location.host}/store/{tenant.slug}
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
              Managing <strong>{tenant?.name?.en}</strong>.
            </p>

            {lowStockCount > 0 && (
              <Link
                to="/admin/products"
                className="mt-4 block max-w-3xl rounded border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-brass-dark transition hover:border-brass"
              >
                ⚠ {lowStockCount} product(s) low or out of stock — review
                Products
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
                  See and update incoming orders.
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
                  Add, edit, and manage what's for sale.
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
                  Log costs like materials and shipping.
                </p>
              </Link>

              <Link
                to="/admin/pnl"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  Profit &amp; Loss
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Sales, cost and profit at a glance.
                </p>
              </Link>

              <Link
                to="/admin/settings"
                className="rounded-md border border-ink/10 bg-paper-soft p-5 transition hover:border-brass"
              >
                <h2 className="font-display text-lg font-medium">
                  {t('admin.settings')}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Colors, logo and the home page banner.
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
                    View storefront ↗
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    See what customers see.
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
