import { useTranslation } from 'react-i18next';

const input =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

// Contact details shown in the shop's footer, plus the optional round WhatsApp button.
export default function ContactFields({ value, onChange }) {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...value, ...patch });
  const field = (key, label, props = {}) => (
    <label className="text-sm text-ink-soft">
      {label}
      <input
        type="text"
        dir="ltr"
        value={value[key]}
        onChange={(e) => set({ [key]: e.target.value })}
        className={input}
        {...props}
      />
    </label>
  );

  return (
    <div>
      <h2 className="font-display text-lg font-medium">{t('contact.title')}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t('contact.help')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {field('whatsapp', t('contact.whatsappNumber'), { placeholder: '01012345678', inputMode: 'tel' })}
        {field('phone', t('contact.phone'), { placeholder: '+20 ...', inputMode: 'tel' })}
        {field('email', t('contact.email'), { type: 'email' })}
        {field('instagram', 'Instagram', { placeholder: '@yourshop' })}
        {field('facebook', 'Facebook', { placeholder: 'yourshop' })}
        {field('tiktok', 'TikTok', { placeholder: '@yourshop' })}
        <label className="text-sm text-ink-soft">
          {t('contact.addressEn')}
          <input
            type="text"
            dir="ltr"
            value={value.addressEn}
            onChange={(e) => set({ addressEn: e.target.value })}
            className={input}
          />
        </label>
        <label className="text-sm text-ink-soft">
          {t('contact.addressAr')}
          <input
            type="text"
            dir="rtl"
            value={value.addressAr}
            onChange={(e) => set({ addressAr: e.target.value })}
            className={input}
          />
        </label>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={value.floatingWhatsapp}
          onChange={(e) => set({ floatingWhatsapp: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          {t('contact.floating')}
          <span className="block text-xs text-ink-faint">{t('contact.floatingHint')}</span>
        </span>
      </label>
    </div>
  );
}
