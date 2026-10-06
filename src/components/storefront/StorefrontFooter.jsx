import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';

export default function StorefrontFooter({ tenant }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const shopName = tenant.name?.[language] || tenant.name?.en || tenant.slug;

  return (
    <footer className="mt-20 border-t border-ink/10 px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <span className="font-display text-lg font-bold uppercase tracking-[0.2em]">
          {shopName}
        </span>
        <p className="text-sm text-ink-faint">
          {t('storefront.footerNote')} · © {new Date().getFullYear()} {shopName}
        </p>
      </div>
    </footer>
  );
}
