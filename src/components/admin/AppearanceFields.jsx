import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ACCENT_PRESETS,
  FONT_PRESETS,
  RADIUS_PRESETS,
  MODES,
  deriveAccent,
  accentTooFaint,
  parseHex,
  resolveAccentHex,
  fontHref,
} from '../../utils/theme';
import { MAX_ANNOUNCEMENTS } from '../../utils/storefront';

const input =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';
const rgb = (c) => `rgb(${c.join(',')})`;

// The shop's look: light/dark, accent colour (any colour), heading font, corners, and a top bar message.
export default function AppearanceFields({ accent, onAccent, value, onChange }) {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...value, ...patch });

  // Load the preview fonts here (admin only), so each font card is shown in its own font.
  useEffect(() => {
    Object.keys(FONT_PRESETS).forEach((id) => {
      if (document.getElementById(`preview-font-${id}`)) return;
      const link = document.createElement('link');
      link.id = `preview-font-${id}`;
      link.rel = 'stylesheet';
      link.href = fontHref(id);
      document.head.appendChild(link);
    });
  }, []);

  const isPreset = Boolean(ACCENT_PRESETS[accent]);
  const hexForPicker = resolveAccentHex(accent, 'dark');
  const customText = isPreset ? '' : accent;
  const faintLight = accentTooFaint(accent, 'light');
  const faintDark = accentTooFaint(accent, 'dark');

  const chip = (selected) =>
    'cursor-pointer rounded border px-4 py-3 text-sm ' + (selected ? 'border-ink bg-paper-soft' : 'border-ink/15');

  return (
    <div className="space-y-8">
      {/* ----- light / dark ----- */}
      <div>
        <h2 className="font-display text-lg font-medium">{t('appearance.modeTitle')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('appearance.modeHelp')}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {MODES.map((m) => (
            <label key={m} className={chip(value.mode === m)}>
              <input
                type="radio"
                name="mode"
                checked={value.mode === m}
                onChange={() => set({ mode: m })}
                className="sr-only"
              />
              <span className="font-medium">{t(`appearance.mode_${m}`)}</span>
              <span className="block text-xs text-ink-faint">{t(`appearance.mode_${m}_help`)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ----- accent colour ----- */}
      <div>
        <h2 className="font-display text-lg font-medium">{t('settingsPage.accentTitle')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('appearance.accentHelp')}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(ACCENT_PRESETS).map(([id, color]) => (
            <label key={id} className={chip(accent === id) + ' flex items-center gap-3'}>
              <input
                type="radio"
                name="accent"
                checked={accent === id}
                onChange={() => onAccent(id)}
                className="sr-only"
              />
              <span
                className="h-6 w-6 rounded-full border border-ink/20"
                style={{ backgroundColor: color }}
              />
              {t(`settingsPage.${id}`)}
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-ink-soft">
            {t('appearance.customColor')}
            <input
              type="color"
              value={hexForPicker}
              onChange={(e) => onAccent(e.target.value.toUpperCase())}
              className="mt-1 block h-10 w-16 cursor-pointer rounded border border-ink/15 bg-white"
            />
          </label>
          <label className="text-sm text-ink-soft">
            {t('appearance.hexCode')}
            <input
              type="text"
              dir="ltr"
              placeholder="#D98B4A"
              value={customText}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (parseHex(v)) onAccent(v.startsWith('#') ? v.toUpperCase() : `#${v.toUpperCase()}`);
              }}
              className={input + ' w-32'}
            />
          </label>
        </div>

        {/* how it looks on a dark page and on a light page */}
        <div className="mt-4 flex flex-wrap gap-4">
          {['dark', 'light'].map((m) => {
            const d = deriveAccent(accent, m);
            return (
              <div
                key={m}
                className="rounded-md border border-ink/15 p-3"
                style={{ backgroundColor: m === 'dark' ? 'rgb(12,12,14)' : 'rgb(250,249,246)' }}
              >
                <p className="mb-2 text-xs" style={{ color: m === 'dark' ? '#bbb' : '#555' }}>
                  {t(`appearance.preview_${m}`)}
                </p>
                <span
                  className="inline-block rounded px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: rgb(d.brass), color: rgb(d.onBrass) }}
                >
                  {t('appearance.previewButton')}
                </span>
                <span className="ms-3 text-sm font-medium" style={{ color: rgb(d.brassDark) }}>
                  {t('appearance.previewLink')}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-faint">{t('appearance.readableNote')}</p>
        {(faintLight || faintDark) && (
          <p className="mt-2 text-xs text-brass-dark">
            {faintLight && faintDark
              ? t('appearance.faintBoth')
              : faintLight
                ? t('appearance.faintLight')
                : t('appearance.faintDark')}
          </p>
        )}
      </div>

      {/* ----- heading font ----- */}
      <div>
        <h2 className="font-display text-lg font-medium">{t('appearance.fontTitle')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('appearance.fontHelp')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {Object.entries(FONT_PRESETS).map(([id, f]) => (
            <label key={id} className={chip(value.font === id)}>
              <input
                type="radio"
                name="font"
                checked={value.font === id}
                onChange={() => set({ font: id })}
                className="sr-only"
              />
              <span className="block text-xl font-semibold" style={{ fontFamily: f.display }} dir="ltr">
                Aa — Every achievement
              </span>
              <span className="block text-xs text-ink-faint">{t(`appearance.font_${id}`)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ----- corners ----- */}
      <div>
        <h2 className="font-display text-lg font-medium">{t('appearance.radiusTitle')}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(RADIUS_PRESETS).map(([id, r]) => (
            <label key={id} className={chip(value.radius === id)}>
              <input
                type="radio"
                name="radius"
                checked={value.radius === id}
                onChange={() => set({ radius: id })}
                className="sr-only"
              />
              <span
                className="mb-2 block h-10 w-24 border-2 border-ink/40"
                style={{ borderRadius: r.lg }}
              />
              {t(`appearance.radius_${id}`)}
            </label>
          ))}
        </div>
      </div>

      {/* ----- announcement bar ----- */}
      <div>
        <h2 className="font-display text-lg font-medium">{t('appearance.barTitle')}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t('appearance.barHelp')}</p>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={value.annEnabled}
            onChange={(e) => set({ annEnabled: e.target.checked })}
          />
          {t('appearance.barShow')}
        </label>
        {value.annEnabled && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-ink-soft">
              {t('appearance.barTextEn')}
              <input
                type="text"
                dir="ltr"
                maxLength={120}
                value={value.annTextEn}
                onChange={(e) => set({ annTextEn: e.target.value })}
                className={input}
              />
            </label>
            <label className="text-sm text-ink-soft">
              {t('appearance.barTextAr')}
              <input
                type="text"
                dir="rtl"
                maxLength={120}
                value={value.annTextAr}
                onChange={(e) => set({ annTextAr: e.target.value })}
                className={input}
              />
            </label>
            <label className="col-span-full text-sm text-ink-soft">
              {t('appearance.barLink')}
              <input
                type="text"
                dir="ltr"
                placeholder="https://..."
                value={value.annLink}
                onChange={(e) => set({ annLink: e.target.value })}
                className={input}
              />
              <span className="mt-1 block text-xs text-ink-faint">{t('appearance.barLinkHint')}</span>
            </label>

            {/* More messages: they change by themselves, with arrows */}
            <div className="col-span-full">
              <p className="text-sm font-medium">{t('appearance.barMoreTitle')}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {t('appearance.barMoreHelp', { max: MAX_ANNOUNCEMENTS - 1 })}
              </p>
              <div className="mt-3 space-y-3">
                {value.annMore.map((m, i) => {
                  const update = (patch) =>
                    set({ annMore: value.annMore.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
                  return (
                    <div key={i} className="rounded-md border border-ink/10 bg-paper-soft p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">{t('appearance.barMessageN', { n: i + 2 })}</span>
                        <button
                          type="button"
                          onClick={() => set({ annMore: value.annMore.filter((_, idx) => idx !== i) })}
                          className="text-sm text-rust hover:underline"
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm text-ink-soft">
                          {t('appearance.barTextEn')}
                          <input
                            type="text"
                            dir="ltr"
                            maxLength={120}
                            value={m.textEn}
                            onChange={(e) => update({ textEn: e.target.value })}
                            className={input}
                          />
                        </label>
                        <label className="text-sm text-ink-soft">
                          {t('appearance.barTextAr')}
                          <input
                            type="text"
                            dir="rtl"
                            maxLength={120}
                            value={m.textAr}
                            onChange={(e) => update({ textAr: e.target.value })}
                            className={input}
                          />
                        </label>
                        <label className="col-span-full text-sm text-ink-soft">
                          {t('appearance.barLink')}
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="https://..."
                            value={m.link}
                            onChange={(e) => update({ link: e.target.value })}
                            className={input}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
              {value.annMore.length < MAX_ANNOUNCEMENTS - 1 && (
                <button
                  type="button"
                  onClick={() => set({ annMore: [...value.annMore, { textEn: '', textAr: '', link: '' }] })}
                  className="mt-3 rounded border border-ink/15 px-4 py-2 text-sm hover:border-brass"
                >
                  {t('appearance.barAddMessage')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
