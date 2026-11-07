import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { contactLinks } from '../../utils/contact';
import { availablePolicyPages } from '../../utils/storefront';

// Update 36: the shop's menu. A button in the top bar opens a panel with the places a visitor
// looks for: Home, Products, About (only when the shop wrote it), Track my order, the other
// text pages (privacy, returns, ...) and a WhatsApp link (only when the shop gave a number).
// Nothing here is invented: every entry exists because the shop has it.
export function MenuPanel({ tenant, onClose, closeRef }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const base = `/store/${tenant.slug}`;
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;

  const pages = availablePolicyPages(tenant, language);
  const hasAbout = pages.includes('about');
  const otherPages = pages.filter((id) => id !== 'about');
  const links = contactLinks(tenant.contact, {
    countryCode: tenant.defaultCountryCode || '20',
    message: t('contact.whatsappHello', { shop: shopName }),
  });

  const isHome = pathname === base || pathname === `${base}/`;
  const item = (active) =>
    'block rounded px-3 py-3 text-lg font-display transition hover:bg-paper-dim ' +
    (active ? 'font-semibold text-brass-dark' : 'text-ink');

  // "Products" is a place on the home page: already there = scroll, elsewhere = go there and scroll.
  function onProducts(e) {
    onClose();
    if (isHome) {
      e.preventDefault();
      setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        id="shop-menu"
        role="dialog"
        aria-modal="true"
        aria-label={t('menu.title')}
        className="menu-slide absolute inset-y-0 start-0 flex w-80 max-w-[85vw] flex-col bg-paper-soft p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-bold uppercase tracking-[0.2em]">{shopName}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('menu.close')}
            className="flex h-9 w-9 items-center justify-center rounded border border-ink/15 text-ink-soft hover:border-brass hover:text-ink"
          >
            ✕
          </button>
        </div>

        <nav aria-label={t('menu.title')} className="mt-6 flex-1 space-y-1 overflow-y-auto">
          <Link to={base} onClick={onClose} className={item(isHome)} aria-current={isHome ? 'page' : undefined}>
            {t('menu.home')}
          </Link>
          <Link to={`${base}#products`} onClick={onProducts} className={item(false)}>
            {t('menu.products')}
          </Link>
          {hasAbout && (
            <Link
              to={`${base}/page/about`}
              onClick={onClose}
              className={item(pathname === `${base}/page/about`)}
              aria-current={pathname === `${base}/page/about` ? 'page' : undefined}
            >
              {t('policies.about')}
            </Link>
          )}
          <Link
            to={`${base}/track`}
            onClick={onClose}
            className={item(pathname === `${base}/track`)}
            aria-current={pathname === `${base}/track` ? 'page' : undefined}
          >
            {t('track.footerLink')}
          </Link>

          {otherPages.length > 0 && (
            <div className="mt-4 border-t border-ink/10 pt-4">
              <p className="px-3 pb-1 text-xs uppercase tracking-wider text-ink-faint">{t('menu.info')}</p>
              {otherPages.map((id) => (
                <Link
                  key={id}
                  to={`${base}/page/${id}`}
                  onClick={onClose}
                  className={'block rounded px-3 py-2 text-sm transition hover:bg-paper-dim ' + (pathname === `${base}/page/${id}` ? 'font-semibold text-brass-dark' : 'text-ink-soft')}
                >
                  {t(`policies.${id}`)}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {links.whatsapp && (
          <a
            href={links.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block rounded border border-ink/15 py-3 text-center text-sm font-semibold transition hover:border-brass hover:text-brass-dark"
          >
            {t('menu.chat')}
          </a>
        )}
      </div>
    </div>
  );
}

// The button + the panel. The panel is drawn on the page itself (not inside the sticky top bar),
// so it always sits above the page; Escape closes it, Tab stays inside it, and the page behind
// does not scroll while it is open.
export default function StorefrontMenu({ tenant }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const openerRef = useRef(null);
  const closeRef = useRef(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const opener = openerRef.current;
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = document.getElementById('shop-menu');
      const focusable = panel ? [...panel.querySelectorAll('a[href], button')] : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('menu.open')}
        aria-expanded={open}
        aria-controls="shop-menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-ink/15 hover:border-brass"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(<MenuPanel tenant={tenant} onClose={close} closeRef={closeRef} />, document.body)}
    </>
  );
}
