import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useStorefront } from '../../context/StorefrontContext';
import LanguageSwitch from '../shared/LanguageSwitch';
import { optimizedImage } from '../../utils/images';
import { pickLogo } from '../../utils/storefront';

// A slim top bar for the checkout and the thank-you page. These pages are on purpose
// "focused" (no menu, no cart: nothing pulls the customer away), but they still show whose
// shop this is, let the customer switch language, and give one clear way back.
export default function CheckoutHeader({ slug }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant, mode } = useStorefront();
  const shopName = tenant?.name?.[language] || tenant?.name?.en || tenant?.slug || '';
  const logoUrl = tenant ? pickLogo(tenant.brand, mode) : '';

  return (
    <header className="flex items-center justify-between gap-3 border-b border-ink/10 bg-paper px-4 py-3 sm:px-8" data-checkout-header>
      <Link to={`/store/${slug}`} aria-label={shopName} className="min-w-0">
        {logoUrl ? (
          <img src={optimizedImage(logoUrl, 400)} alt={shopName} className="h-8 w-auto" />
        ) : (
          <span className="font-display block truncate text-xl font-bold uppercase tracking-[0.2em]">{shopName}</span>
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        <Link to={`/store/${slug}`} className="text-sm text-brass-dark hover:underline">
          {t('storefront.backToShop')}
        </Link>
        <LanguageSwitch />
      </div>
    </header>
  );
}
