import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import ar from './ar.json';

i18n
  .use(LanguageDetector) // auto-detects browser language
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    detection: {
      // Check localStorage first (user's manual toggle), then browser setting.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'shopAppLanguage',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
