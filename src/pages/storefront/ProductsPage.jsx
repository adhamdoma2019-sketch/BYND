import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listStorefrontProducts } from '../../firebase/products.service';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import { useCart } from '../../context/CartContext';
import StorefrontHeader from '../../components/storefront/StorefrontHeader';
import StorefrontFooter from '../../components/storefront/StorefrontFooter';
import CartDrawer from '../../components/storefront/CartDrawer';
import AddedToast from '../../components/storefront/AddedToast';
import ProductGrid, { ProductGridSkeleton, ProductsLoadError } from '../../components/storefront/ProductGrid';
import { usePageMeta } from '../../utils/usePageMeta';
import { SORT_MODES, sortProducts } from '../../utils/productList';

// Update 42: ALL the shop's products on their own page (/store/<shop>/products).
// The home page only shows a few featured ones. A sort box (normal order / price) is shown
// when there is something to sort. Built so categories can be added above the grid later.
export default function ProductsPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useStorefront();
  const { addItem } = useCart();

  const [products, setProducts] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | failed
  const [sort, setSort] = useState('featured');
  const [cartOpen, setCartOpen] = useState(false);
  const [added, setAdded] = useState(0); // counts adds: the "Added to cart" note shows after each one

  const load = useCallback(() => {
    let cancelled = false;
    setState('loading');
    listStorefrontProducts(tenant.id)
      .then((list) => {
        if (cancelled) return;
        setProducts(Array.isArray(list) ? list : []);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  useEffect(() => load(), [load]);

  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  usePageMeta(`${t('storefront.allProducts')} — ${shopName}`, undefined);

  const shown = useMemo(() => sortProducts(products, sort), [products, sort]);

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to={`/store/${tenant.slug}`} className="text-sm text-brass-dark hover:underline">
          {t('storefront.backToShop')}
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-6">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              {t('storefront.allProducts')}
            </h1>
            {state === 'ready' && products.length > 0 && (
              <p className="mt-2 text-ink-soft">
                {products.length === 1
                  ? t('storefront.productCountOne')
                  : t('storefront.productCount', { n: products.length })}
              </p>
            )}
          </div>

          {state === 'ready' && products.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <span>{t('storefront.sortBy')}</span>
              <select
                value={sort}
                onChange={(e) => setSort(SORT_MODES.includes(e.target.value) ? e.target.value : 'featured')}
                className="rounded border border-ink/15 bg-paper px-3 py-2 text-sm text-ink focus:border-brass focus:outline-none"
              >
                {SORT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(`storefront.sort_${m}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mt-8 min-h-[40vh]">
          {state === 'loading' && <ProductGridSkeleton label={t('common.loading')} />}

          {state === 'failed' && (
            <ProductsLoadError
              message={t('storefront.productsLoadFailed')}
              retryLabel={t('common.retry')}
              onRetry={load}
            />
          )}

          {state === 'ready' && products.length === 0 && (
            <p className="py-10 text-center text-ink-soft">{t('storefront.noProducts')}</p>
          )}

          {state === 'ready' && products.length > 0 && (
            <ProductGrid
              products={shown}
              onAddToCart={(prod) => {
                addItem(prod, 1);
                setAdded((n) => n + 1);
              }}
            />
          )}
        </div>
      </main>

      <StorefrontFooter tenant={tenant} />
      <AddedToast trigger={added} hidden={cartOpen} onView={() => setCartOpen(true)} />
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
