import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es';
import en from './locales/en';

const LANG_STORAGE_KEY = 'platform_language';

const getInitialLanguage = (): 'es' | 'en' => {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'es' || stored === 'en') return stored;
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  if (lng === 'es' || lng === 'en') {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  }
});

export default i18n;
