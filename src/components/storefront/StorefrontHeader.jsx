import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import LanguageSwitch from '../shared/LanguageSwitch';
import { useStorefront } from '../../context/StorefrontContext';
import { optimizedImage } from '../../utils/images';
import { pickLogo } from '../../utils/storefront';

// Top bar shared by the shop pages: logo / shop name, language switch, cart.
// The logo comes from Admin > Settings (one for light screens, optionally another for
// dark ones); until one is set, the shop name is shown as a text wordmark.
export default function StorefrontHeader({ tenant, onCartClick }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { itemCount } = useCart();
  const { mode, toggleMode } = useStorefront();
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  // The shop can give a second logo for dark screens (see Admin > Settings > Look).
  const logoUrl = pickLogo(tenant.brand, mode);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/10 bg-paper px-4 py-3 sm:px-8">
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
        {/* light / dark switch: remembered on the visitor's phone */}
        <button
          onClick={toggleMode}
          aria-label={mode === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          title={mode === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          className="flex h-9 w-9 items-center justify-center rounded border border-ink/15 hover:border-brass"
        >
          {mode === 'dark' ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          )}
        </button>
        <button
          onClick={onCartClick}
          className="relative rounded border border-ink/15 px-3 py-1.5 text-sm hover:border-brass hover:text-brass-dark"
        >
          {t('nav.cart')}
          {itemCount > 0 && (
            <span className="absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brass text-xs font-semibold text-on-brass">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
