import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import LanguageSwitch from '../shared/LanguageSwitch';

// Top bar shared by the shop pages: shop name, language switch, cart button.
export default function StorefrontHeader({ tenant, onCartClick }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { itemCount } = useCart();
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;

  return (
    <header className="flex items-center justify-between border-b border-ink/10 px-4 py-4 sm:px-6">
      <Link
        to={`/store/${tenant.slug}`}
        className="font-display text-lg font-medium tracking-wide"
      >
        {shopName}
      </Link>
      <div className="flex items-center gap-3">
        <LanguageSwitch />
        <button
          onClick={onCartClick}
          className="relative rounded border border-ink/15 px-3 py-1.5 text-sm hover:border-brass"
        >
          {t('nav.cart')}
          {itemCount > 0 && (
            <span className="absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brass text-xs text-paper">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
