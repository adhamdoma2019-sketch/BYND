import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitch from '../components/shared/LanguageSwitch';

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="absolute end-4 top-4">
        <LanguageSwitch />
      </div>
      <span className="font-display text-2xl font-medium tracking-wide">The Workshop</span>
      <p className="mt-3 max-w-md text-ink-soft">{t('landing.body')}</p>
      <div className="mt-8 flex gap-3">
        <Link
          to="/admin/signup"
          className="rounded bg-ink px-5 py-2.5 text-paper transition hover:bg-brass"
        >
          {t('landing.create')}
        </Link>
        <Link
          to="/admin/login"
          className="rounded border border-ink/15 px-5 py-2.5 text-ink-soft transition hover:border-brass hover:text-brass"
        >
          {t('admin.login')}
        </Link>
      </div>
    </div>
  );
}
