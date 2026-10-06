import { useEffect, useLayoutEffect, useState } from 'react';
import { useParams, Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CartProvider } from '../../context/CartContext';
import { StorefrontContext } from '../../context/StorefrontContext';
import { getTenant } from '../../firebase/tenants.service';

export const DEFAULT_ACCENT = 'copper';

function readCachedAccent(slug) {
  try {
    return localStorage.getItem(`accent:${slug}`) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

// Wraps every shop page: loads the shop once, and switches the whole page
// to the dark storefront theme with the accent colour the shop chose.
export default function StorefrontLayout() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const [tenant, setTenant] = useState(null);
  const [status, setStatus] = useState('loading');
  // Remembered from the last visit so the colour doesn't "flash" on load.
  const [accent, setAccent] = useState(() => readCachedAccent(slug));

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-store');
    return () => {
      root.classList.remove('theme-store');
      root.removeAttribute('data-accent');
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus('loading');
      try {
        const data = await getTenant(slug);
        if (cancelled) return;
        if (!data || data.isActive === false) {
          setStatus('not-found');
          return;
        }
        setTenant(data);
        const chosen = data.theme?.accent || DEFAULT_ACCENT;
        setAccent(chosen);
        try {
          localStorage.setItem(`accent:${slug}`, chosen);
        } catch {
          // not important
        }
        setStatus('found');
      } catch {
        if (!cancelled) setStatus('not-found');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

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
        <Link to="/" className="mt-4 text-brass hover:underline">
          ←
        </Link>
      </div>
    );
  }

  return (
    <CartProvider slug={slug}>
      <StorefrontContext.Provider value={{ tenant }}>
        <Outlet />
      </StorefrontContext.Provider>
    </CartProvider>
  );
}
