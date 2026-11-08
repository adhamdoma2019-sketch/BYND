import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { listStorefrontProducts } from '../../firebase/products.service';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import StorefrontHeader from '../../components/storefront/StorefrontHeader';
import StorefrontFooter from '../../components/storefront/StorefrontFooter';
import Hero from '../../components/storefront/Hero';
import Highlights from '../../components/storefront/Highlights';
import ProductGrid, { ProductGridSkeleton } from '../../components/storefront/ProductGrid';
import CartDrawer from '../../components/storefront/CartDrawer';
import { usePageMeta } from '../../utils/usePageMeta';
import { highlightsOf } from '../../utils/storefront';
import { featuredProducts, hasMoreThanFeatured } from '../../utils/productList';
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
  const { hash } = useLocation();

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

  // Coming from another page through the menu's "Products": scroll to the collection once it is there.
  useEffect(() => {
    if (hash === '#products' && !productsLoading) {
      document.getElementById('products')?.scrollIntoView();
    }
  }, [hash, productsLoading]);

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

  // The shop's own highlights: ticks inside the banner card + cards under the banner.
  const highlights = highlightsOf(tenant, language);

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <Hero
        slides={slides}
        intervalMs={seconds * 1000}
        fadeMs={fadeMs}
        autoplay={tenant.hero?.autoplay !== false}
        textStyle={tenant.hero?.textStyle === 'plain' ? 'plain' : 'card'}
        points={highlights.slice(0, 3).map((h) => h.title)}
      />

      <Highlights items={highlights} />

      <main className="mx-auto max-w-6xl px-5 pb-0 pt-14 sm:px-8 sm:pt-20">
        <h2
          id="products"
          className="font-display mb-8 scroll-mt-20 text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {t('storefront.collection')}
        </h2>

        {productsLoading ? (
          <ProductGridSkeleton count={4} label={t('common.loading')} />
        ) : products.length === 0 ? (
          <p className="text-ink-soft">{t('storefront.noProducts')}</p>
        ) : (
          <>
            {/* Only a few featured products here; the rest are on the Products page (update 42). */}
            <ProductGrid
              products={featuredProducts(products)}
              onAddToCart={(prod) => {
                addItem(prod, 1);
                setCartOpen(true);
              }}
            />
            {hasMoreThanFeatured(products) && (
              <div className="mt-10 text-center">
                <Link
                  to={`/store/${tenant.slug}/products`}
                  className="inline-block rounded border border-ink px-8 py-3 text-sm font-semibold uppercase tracking-wider transition hover:bg-ink hover:text-paper"
                >
                  {t('storefront.viewAll', { n: products.length })}
                </Link>
              </div>
            )}
          </>
        )}

        {/* "How it works": only when the shop hasn't written its own highlights. */}
        {highlights.length === 0 && (
        <section className="mt-20 grid gap-8 border-t border-ink/10 pt-14 sm:grid-cols-3">
          {[
            ['01', 'step1'],
            ['02', 'step2'],
            ['03', 'step3'],
          ].map(([num, key]) => (
            <div key={num}>
              <span className="font-display text-sm font-semibold tracking-widest text-brass-dark">
                {num}
              </span>
              <h3 className="font-display mt-2 text-xl font-semibold">
                {t(`storefront.${key}Title`)}
              </h3>
              <p className="mt-2 text-ink-soft">{t(`storefront.${key}Body`)}</p>
            </div>
          ))}
        </section>
        )}
      </main>

      <StorefrontFooter tenant={tenant} />
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
