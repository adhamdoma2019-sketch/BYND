import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { PREVIEW_DRAFT, acceptReadyMessage } from '../../utils/preview';

// The live preview: a phone-shaped frame showing the REAL shop home page.
// The shop page (opened with ?preview) gets the unsaved form values from here and shows them
// instead of the saved ones. Nothing is saved from here.
export default function PreviewPane({ slug, draft, onClose }) {
  const { t } = useTranslation();
  const { language: adminLanguage } = useLanguage();
  const frameRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [language, setLanguage] = useState(adminLanguage === 'ar' ? 'ar' : 'en');
  const [mode, setMode] = useState(null); // null = what the shop's Look setting says

  // Always the newest values, so a message never sends old ones.
  const latest = useRef({ draft, mode, language });
  latest.current = { draft, mode, language };

  const send = useCallback(() => {
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    const { draft: d, mode: m, language: l } = latest.current;
    target.postMessage({ type: PREVIEW_DRAFT, draft: d, mode: m, language: l }, window.location.origin);
  }, []);

  // The shop frame says "ready" once it has loaded: then it gets the draft.
  useEffect(() => {
    function onMessage(event) {
      if (
        acceptReadyMessage(event, {
          origin: window.location.origin,
          frameWindow: frameRef.current?.contentWindow,
        })
      ) {
        setReady(true);
        send();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [send]);

  // Every change in the form (or a switch here) reaches the frame a moment later.
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setTimeout(send, 150);
    return () => clearTimeout(timer);
  }, [draftKey, mode, language, ready, send]);

  const pill = (active) =>
    'rounded px-3 py-1.5 text-sm transition ' +
    (active ? 'bg-ink text-paper' : 'border border-ink/15 text-ink-soft hover:border-brass');

  return (
    <div className="mx-auto w-full max-w-[400px]" data-testid="live-preview">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-medium">{t('settingsPage.previewTitle')}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setReady(false);
              setReloadKey((n) => n + 1);
            }}
            className="rounded border border-ink/15 px-3 py-1.5 text-sm text-ink-soft hover:border-brass"
          >
            {t('settingsPage.previewReload')}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-ink px-3 py-1.5 text-sm text-paper"
            >
              {t('settingsPage.previewClose')}
            </button>
          )}
        </div>
      </div>

      {/* switches: language and light/dark of the preview only */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex gap-1" role="group" aria-label={t('settingsPage.previewLanguage')}>
          <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} className={pill(language === 'en')}>
            English
          </button>
          <button type="button" onClick={() => setLanguage('ar')} aria-pressed={language === 'ar'} className={pill(language === 'ar')}>
            العربية
          </button>
        </div>
        <div className="flex gap-1" role="group" aria-label={t('settingsPage.previewMode')}>
          <button type="button" onClick={() => setMode(null)} aria-pressed={mode === null} className={pill(mode === null)}>
            {t('settingsPage.previewModeShop')}
          </button>
          <button type="button" onClick={() => setMode('light')} aria-pressed={mode === 'light'} className={pill(mode === 'light')}>
            {t('settingsPage.previewLight')}
          </button>
          <button type="button" onClick={() => setMode('dark')} aria-pressed={mode === 'dark'} className={pill(mode === 'dark')}>
            {t('settingsPage.previewDark')}
          </button>
        </div>
      </div>

      {/* the phone */}
      <div
        className="relative mx-auto w-full max-w-[375px] overflow-hidden rounded-[2.25rem] border-[10px] border-ink bg-white shadow-xl"
        style={{ height: 'min(720px, calc(100vh - 13rem))' }}
      >
        <iframe
          key={reloadKey}
          ref={frameRef}
          title={t('settingsPage.previewTitle')}
          src={`/store/${encodeURIComponent(slug)}?preview=1`}
          className="h-full w-full border-0"
        />
        {!ready && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-ink-soft">
            {t('common.loading')}
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-ink-faint">{t('settingsPage.previewNote')}</p>
    </div>
  );
}
