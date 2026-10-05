import { useLanguage } from '../../context/LanguageContext';

export default function LanguageSwitch() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="rounded border border-ink/15 px-3 py-1.5 text-sm text-ink-soft transition hover:border-brass hover:text-brass"
      aria-label="Toggle language"
    >
      {language === 'en' ? 'العربية' : 'English'}
    </button>
  );
}
