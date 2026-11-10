import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import LanguageSwitch from '../shared/LanguageSwitch';
import StorefrontMenu from './StorefrontMenu';
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
  // The cart badge gives a small bump when something is added (never on the first paint).
  const lastCount = useRef(itemCount);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (itemCount > lastCount.current) setBump((b) => b + 1);
    lastCount.current = itemCount;
  }, [itemCount]);
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;
  // The shop can give a second logo for dark screens (see Admin > Settings > Look).
  const logoUrl = pickLogo(tenant.brand, mode);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-1 border-b border-ink/10 bg-paper px-3 py-2 sm:gap-3 sm:px-8 sm:py-3">
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        <StorefrontMenu tenant={tenant} />
        <Link to={`/store/${tenant.slug}`} aria-label={shopName} className="flex min-h-[44px] min-w-0 items-center px-1">
          {logoUrl ? (
            <img src={optimizedImage(logoUrl, 400)} alt={shopName} className="h-8 w-auto max-w-full object-contain" />
          ) : (
            <span className="font-display block truncate text-lg font-bold uppercase tracking-[0.12em] sm:text-xl sm:tracking-[0.2em]">
              {shopName}
            </span>
          )}
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <LanguageSwitch />
        {/* light / dark switch: remembered on the visitor's phone */}
        <button
          onClick={toggleMode}
          aria-label={mode === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          title={mode === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          className="flex h-11 w-11 items-center justify-center rounded border border-ink/15 hover:border-brass"
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
        {/* cart: a bag icon (the strongest button of the bar) with a count badge when it holds something */}
        <button
          onClick={onCartClick}
          aria-label={itemCount > 0 ? `${t('nav.cart')} (${itemCount})` : t('nav.cart')}
          title={t('nav.cart')}
          className="relative flex h-11 w-11 items-center justify-center rounded border border-ink bg-ink text-paper transition hover:border-brass hover:bg-brass hover:text-on-brass"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 7h12l1 13H5L6 7Z" />
            <path d="M9 7a3 3 0 0 1 6 0" />
          </svg>
          {itemCount > 0 && (
            <span key={bump} className={'absolute -end-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-paper bg-brass px-1 text-[11px] font-semibold leading-none text-on-brass' + (bump > 0 ? ' badge-bump' : '')}>
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
