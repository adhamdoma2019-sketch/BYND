import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { CartProvider } from '../../context/CartContext';
import { StorefrontContext } from '../../context/StorefrontContext';
import { useLanguage } from '../../context/LanguageContext';
import { getTenant } from '../../firebase/tenants.service';
import AnnouncementBar from '../../components/storefront/AnnouncementBar';
import FloatingWhatsApp from '../../components/storefront/FloatingWhatsApp';
import {
  FONT_PRESETS,
  RADIUS_PRESETS,
  DEFAULT_ACCENT,
  DEFAULT_FONT,
  DEFAULT_RADIUS,
  accentVars,
  fontHref,
  resolveMode,
} from '../../utils/theme';
import { PREVIEW_READY, acceptDraftMessage, applyDraft, isPreviewMode } from '../../utils/preview';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not important
  }
};

// What the shop chose for its look (with safe defaults).
function lookOf(tenant) {
  const a = tenant?.appearance || {};
  return {
    mode: ['light', 'dark', 'auto'].includes(a.mode) ? a.mode : 'auto',
    accent: tenant?.theme?.accent || DEFAULT_ACCENT,
    font: FONT_PRESETS[a.font] ? a.font : DEFAULT_FONT,
    radius: RADIUS_PRESETS[a.radius] ? a.radius : DEFAULT_RADIUS,
  };
}

// Puts the look on the page: light/dark, accent colour (readable text guaranteed),
// heading font and corner style.
function applyLook(root, look, mode) {
  root.setAttribute('data-mode', mode);
  root.style.colorScheme = mode;
  Object.entries(accentVars(look.accent, mode)).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty('--font-display', FONT_PRESETS[look.font].display);
  const r = RADIUS_PRESETS[look.radius];
  root.style.setProperty('--radius-sm', r.sm);
  root.style.setProperty('--radius-md', r.md);
  root.style.setProperty('--radius-lg', r.lg);

  // Only the chosen heading font is downloaded.
  const id = `font-${look.font}`;
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = fontHref(look.font);
    document.head.appendChild(link);
  }
}

// Is this page the live preview frame inside Admin > Settings? (opened with ?preview, inside a frame)
function detectPreview() {
  try {
    return isPreviewMode(window.location.search, window.self !== window.top);
  } catch {
    return false;
  }
}

const THEME_VARS = ['--brass', '--brass-dark', '--brass-light', '--on-brass', '--font-display', '--radius-sm', '--radius-md', '--radius-lg'];

// Wraps every shop page: loads the shop once and gives the page its look.
export default function StorefrontLayout() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  // Live preview (Admin > Settings): the page shows unsaved values sent by the admin page and
  // never writes anything to the browser's storage, so it cannot change the real choices.
  const preview = useMemo(detectPreview, []);
  const [draftMsg, setDraftMsg] = useState(null); // unsaved shop settings (Admin > Settings)
  const [previewProduct, setPreviewProduct] = useState(null); // unsaved product { product, view } (Admin > Products)
  const [tenant, setTenant] = useState(null);
  const [status, setStatus] = useState('loading');

  // The last look is remembered, so the page doesn't flash a different colour while loading.
  const [look, setLook] = useState(() => {
    try {
      return { ...lookOf(null), ...JSON.parse(read(`look:${slug}`) || '{}') };
    } catch {
      return lookOf(null);
    }
  });
  const [visitorMode, setVisitorMode] = useState(() => (preview ? null : read(`mode:${slug}`)));
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  );

  // Follow the phone's light/dark setting live.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  // The shop as shown: in the preview the unsaved draft sits on top of the saved shop.
  const shownTenant = useMemo(
    () => (preview && draftMsg ? applyDraft(tenant, draftMsg.draft) : tenant),
    [preview, draftMsg, tenant]
  );
  const shownLook = useMemo(
    () => (preview && draftMsg && shownTenant ? lookOf(shownTenant) : look),
    [preview, draftMsg, shownTenant, look]
  );
  const mode = resolveMode(shownLook.mode, visitorMode, systemDark);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-store');
    return () => {
      root.classList.remove('theme-store');
      root.removeAttribute('data-mode');
      root.style.removeProperty('color-scheme');
      THEME_VARS.forEach((v) => root.style.removeProperty(v));
    };
  }, []);

  useLayoutEffect(() => {
    applyLook(document.documentElement, shownLook, mode);
  }, [shownLook, mode]);

  // ----- Live preview only -----
  const seen = useRef({ mode: undefined, language: undefined });
  const languageNow = useRef(language);
  languageNow.current = language;
  useEffect(() => {
    if (!preview) return undefined;
    // The preview must not remember its language in the browser (that would also change the admin's).
    if (i18n.services?.languageDetector) i18n.services.languageDetector.cacheUserLanguage = () => {};

    function onMessage(event) {
      const msg = acceptDraftMessage(event, { origin: window.location.origin, parent: window.parent });
      if (!msg) return;
      if (msg.draft) setDraftMsg(msg);
      if (msg.product) setPreviewProduct({ product: msg.product, view: msg.view });
      // The switches of the admin page are applied when they change, so the buttons inside the
      // preview keep working until the admin page's switch is used again.
      if (msg.mode !== seen.current.mode) {
        seen.current.mode = msg.mode;
        setVisitorMode(msg.mode);
      }
      if (msg.language !== seen.current.language) {
        seen.current.language = msg.language;
        if (msg.language && msg.language !== languageNow.current) setLanguage(msg.language);
      }
    }
    // Links in the preview do nothing: it only shows the home page.
    function blockLinks(event) {
      if (event.target?.closest?.('a[href]')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener('message', onMessage);
    document.addEventListener('click', blockLinks, true);
    // Tell the admin page that the preview is ready for its draft.
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', blockLinks, true);
    };
  }, [preview, setLanguage]);

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
        const chosen = lookOf(data);
        setLook(chosen);
        if (!preview) write(`look:${slug}`, JSON.stringify(chosen));
        setStatus('found');
      } catch {
        if (!cancelled) setStatus('not-found');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, preview]);

  // The visitor's own light/dark choice (saved on their phone).
  const toggleMode = useCallback(() => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setVisitorMode(next);
    if (!preview) write(`mode:${slug}`, next);
  }, [mode, slug, preview]);

  const value = useMemo(
    () => ({ tenant: shownTenant, mode, toggleMode, preview, previewProduct: preview ? previewProduct : null }),
    [shownTenant, mode, toggleMode, preview, previewProduct]
  );

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
        <Link to="/" className="mt-4 text-brass-dark hover:underline">
          ←
        </Link>
      </div>
    );
  }

  return (
    <CartProvider slug={preview ? '__preview__' : slug}>
      <StorefrontContext.Provider value={value}>
        <AnnouncementBar tenant={shownTenant} />
        <Outlet />
        <FloatingWhatsApp tenant={shownTenant} />
      </StorefrontContext.Provider>
    </CartProvider>
  );
}
