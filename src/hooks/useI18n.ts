import { createContext, useContext, useEffect, useState } from 'react';
import { createI18n, getInitialLanguage, saveLanguage, type I18n, type Language } from '../i18n/i18n';
import { useValidationMessages } from './useValidationMessages';

const I18NS: Record<Language, I18n> = { en: createI18n('en'), de: createI18n('de') };

export interface I18nContextValue extends I18n {
  setLanguage: (language: Language) => void;
}

// App fills this in. Without it, for example in a component's test, everything is in English
export const I18nContext = createContext<I18nContextValue>({ ...I18NS.en, setLanguage: () => {} });

export function useI18n() {
  return useContext(I18nContext);
}

// The visitor's language, remembered in this browser
export function useLanguage(): I18nContextValue {
  const [language, setLanguageState] = useState(getInitialLanguage);
  const i18n = I18NS[language];

  // Screen readers pronounce the page in its language
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useValidationMessages(i18n);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    saveLanguage(newLanguage);
  };

  return { ...i18n, setLanguage };
}
