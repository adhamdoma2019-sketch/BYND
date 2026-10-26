import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import StorefrontHeader from '../../components/storefront/StorefrontHeader';
import StorefrontFooter from '../../components/storefront/StorefrontFooter';
import CartDrawer from '../../components/storefront/CartDrawer';
import { usePageMeta } from '../../utils/usePageMeta';
import { policyBody } from '../../utils/storefront';

// A text page the shop wrote itself (privacy, returns, shipping, terms).
// The text is shown as plain text (never as HTML), so nothing in it can run as code.
export default function PolicyPage() {
  const { slug, pageId } = useParams();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useStorefront();
  const [cartOpen, setCartOpen] = useState(false);

  const body = policyBody(tenant, pageId, language);
  const title = body ? t(`policies.${pageId}`) : '';
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  usePageMeta(title ? `${title} — ${shopName}` : undefined, undefined);

  return (
    <div className="min-h-screen">
      <StorefrontHeader tenant={tenant} onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <Link to={`/store/${slug}`} className="text-sm text-brass-dark hover:underline">
          {t('storefront.backToShop')}
        </Link>

        {body ? (
          <>
            <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <div className="mt-6 whitespace-pre-line leading-relaxed text-ink-soft">{body}</div>
          </>
        ) : (
          <p className="mt-10 text-ink-soft">{t('storefront.pageNotFound')}</p>
        )}
      </main>

      <StorefrontFooter tenant={tenant} />
      {cartOpen && <CartDrawer onClose={() => setCartOpen(false)} />}
    </div>
  );
}
