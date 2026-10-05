import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTenant } from '../../firebase/tenants.service';
import { listStorefrontProducts } from '../../firebase/products.service';
import { useCart } from '../../context/CartContext';
import StorefrontHeader from '../../components/storefront/StorefrontHeader';
import { useLanguage } from '../../context/LanguageContext';
import { usePageMeta } from '../../utils/usePageMeta';
import ProductCard from '../../components/storefront/ProductCard';
import CartDrawer from '../../components/storefront/CartDrawer';

export default function StorefrontHome() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { language } = useLanguage();

  const [tenant, setTenant] = useState(null);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      const tenantData = await getTenant(slug);
      if (cancelled) return;
      if (!tenantData) {
        setStatus('not-found');
        return;
      }
      setTenant(tenantData);
      const productList = await listStorefrontProducts(tenantData.id);
      if (cancelled) return;
      setProducts(productList);
      setStatus('found');
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const shopName = tenant
    ? tenant.name?.[language] || tenant.name?.en || tenant.slug
    : undefined;
  usePageMeta(shopName, shopName ? `${shopName} — ${t('storefront.heroTagline')}` : undefined);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        {t('common.loading')}
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Shop not found</h1>
        <p className="mt-2 max-w-sm text-ink-soft">
          There's no shop at this address. Double-check the link.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <main className="px-6 py-12">
        <h1 className="mb-8 text-center font-display text-3xl font-semibold sm:text-4xl">
          {t('storefront.heroTagline')}
        </h1>

        {products.length === 0 ? (
          <p className="text-center text-ink-soft">
            No products available yet.
          </p>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onAddToCart={(prod) => addItem(prod, 1)}
              />
            ))}
          </div>
        )}
      </main>

      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
