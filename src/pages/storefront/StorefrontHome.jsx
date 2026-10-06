import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listStorefrontProducts } from '../../firebase/products.service';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import StorefrontHeader from '../../components/storefront/StorefrontHeader';
import StorefrontFooter from '../../components/storefront/StorefrontFooter';
import Hero from '../../components/storefront/Hero';
import ProductCard from '../../components/storefront/ProductCard';
import CartDrawer from '../../components/storefront/CartDrawer';
import { usePageMeta } from '../../utils/usePageMeta';
import {
  HERO_DEFAULT_SECONDS,
  HERO_MIN_SECONDS,
  HERO_MAX_SECONDS,
  HERO_FADE_MS,
} from '../../utils/constants';

const MAX_SLIDES = 5;

export default function StorefrontHome() {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { language } = useLanguage();
  const { tenant } = useStorefront();

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listStorefrontProducts(tenant.id)
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant.id]);

  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  usePageMeta(shopName, `${shopName} — ${t('storefront.heroDefaultHeadline')}`);

  // Banner slides: the ones the shop set up in Admin > Settings. If none yet,
  // we show the first product photo so the page never looks empty.
  const slides = useMemo(() => {
    const pick = (obj) => obj?.[language] || obj?.en || '';
    const configured = (tenant.hero?.slides || [])
      .filter((s) => s.imageUrl || s.headline?.en || s.headline?.ar)
      .slice(0, MAX_SLIDES)
      .map((s) => ({
        imageUrl: s.imageUrl || '',
        headline: pick(s.headline),
        subtext: pick(s.subtext),
        ctaLabel: pick(s.cta) || t('storefront.shopNow'),
        to: s.productId ? `/store/${tenant.slug}/product/${s.productId}` : '#products',
      }));
    if (configured.length > 0) return configured;

    const firstWithImage = products.find((p) => p.imageUrl);
    return [
      {
        imageUrl: firstWithImage?.imageUrl || '',
        headline: t('storefront.heroDefaultHeadline'),
        subtext: '',
        ctaLabel: t('storefront.shopNow'),
        to: '#products',
      },
    ];
  }, [tenant, products, language, t]);

  // Slideshow timing chosen in Admin > Settings (with safe limits).
  const seconds = Math.min(
    HERO_MAX_SECONDS,
    Math.max(HERO_MIN_SECONDS, Number(tenant.hero?.intervalSeconds) || HERO_DEFAULT_SECONDS)
  );
  const fadeMs = HERO_FADE_MS[tenant.hero?.fade] || HERO_FADE_MS.normal;

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <Hero slides={slides} intervalMs={seconds * 1000} fadeMs={fadeMs} />

      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <h2
          id="products"
          className="font-display mb-8 scroll-mt-20 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {t('storefront.collection')}
        </h2>

        {productsLoading ? (
          <p className="text-ink-soft">{t('common.loading')}</p>
        ) : products.length === 0 ? (
          <p className="text-ink-soft">{t('storefront.noProducts')}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onAddToCart={(prod) => {
                  addItem(prod, 1);
                  setCartOpen(true);
                }}
              />
            ))}
          </div>
        )}

        <section className="mt-20 grid gap-8 border-t border-ink/10 pt-14 sm:grid-cols-3">
          {[
            ['01', 'step1'],
            ['02', 'step2'],
            ['03', 'step3'],
          ].map(([num, key]) => (
            <div key={num}>
              <span className="font-display text-sm font-semibold tracking-widest text-brass">
                {num}
              </span>
              <h3 className="font-display mt-2 text-xl font-semibold">
                {t(`storefront.${key}Title`)}
              </h3>
              <p className="mt-2 text-ink-soft">{t(`storefront.${key}Body`)}</p>
            </div>
          ))}
        </section>
      </main>

      <StorefrontFooter tenant={tenant} />
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
