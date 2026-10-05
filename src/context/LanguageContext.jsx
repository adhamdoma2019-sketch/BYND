import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const RTL_LANGUAGES = ['ar'];

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { i18n, t } = useTranslation();
  const [language, setLanguageState] = useState(i18n.language?.startsWith('ar') ? 'ar' : 'en');

  const dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';

  // Keep <html lang> and <html dir> attributes in sync with the active
  // language. This is what makes Tailwind's `html[dir='rtl']` selectors
  // (see index.css) and the browser's own bidi rendering work correctly —
  // it's not just swapping text, it's mirroring the whole layout.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  function setLanguage(lang) {
    i18n.changeLanguage(lang);
    setLanguageState(lang);
  }

  function toggleLanguage() {
    setLanguage(language === 'en' ? 'ar' : 'en');
  }

  return (
    <LanguageContext.Provider value={{ language, dir, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
