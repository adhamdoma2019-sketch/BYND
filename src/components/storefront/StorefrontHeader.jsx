import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import LanguageSwitch from '../shared/LanguageSwitch';
import { optimizedImage } from '../../utils/images';

// Top bar shared by the shop pages: logo / shop name, language switch, cart.
// The logo comes from Admin > Settings; until one is set, the shop name is
// shown as a text wordmark.
export default function StorefrontHeader({ tenant, onCartClick }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { itemCount } = useCart();
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  const logoUrl = tenant.brand?.logoUrl;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/10 bg-paper/85 px-4 py-3 backdrop-blur sm:px-8">
      <Link to={`/store/${tenant.slug}`} aria-label={shopName}>
        {logoUrl ? (
          <img src={optimizedImage(logoUrl, 400)} alt={shopName} className="h-8 w-auto" />
        ) : (
          <span className="font-display text-xl font-bold uppercase tracking-[0.2em]">
            {shopName}
          </span>
        )}
      </Link>
      <div className="flex items-center gap-3">
        <LanguageSwitch />
        <button
          onClick={onCartClick}
          className="relative rounded border border-ink/15 px-3 py-1.5 text-sm hover:border-brass hover:text-brass"
        >
          {t('nav.cart')}
          {itemCount > 0 && (
            <span className="absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brass text-xs font-semibold text-paper">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
