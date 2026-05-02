import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Import translations
import enTranslation from "./locales/en/translation.json";
import zhTranslation from "./locales/zh/translation.json";

const resources = {
  en: {
    translation: enTranslation,
  },
  zh: {
    translation: zhTranslation,
  },
};

// Get saved language or default to English
// We'll initialize this dynamically in main.tsx after config service is ready
let initialLanguage = "en";

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // react already safes from xss
  },
});

export const setInitialLanguage = (lng: string) => {
  initialLanguage = lng;
  i18n.changeLanguage(lng);
};

export default i18n;
