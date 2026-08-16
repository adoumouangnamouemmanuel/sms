import { DEFAULT_LOCALE } from '@edutrack/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ar } from './ar';
import { en } from './en';
import { fr } from './fr';

// Each locale file already exports the `translation` object it was split
// from, so the resource entry is the file itself.
const resources = {
  fr,
  ar,
  en,
};

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
