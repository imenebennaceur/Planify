import React, { createContext, useContext, useMemo } from 'react';

const DEFAULT_LANGUAGE = 'fr';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  locale: 'fr-FR',
  isFrench: true,
  setLanguage: () => {},
  toggleLanguage: () => {}
});

function normalizeLanguage(value) {
  return String(value || '').toLowerCase() === 'en' ? 'en' : 'fr';
}

export function LanguageProvider({ language, setLanguage, children }) {
  const normalized = normalizeLanguage(language);

  const value = useMemo(() => {
    const isFrench = normalized === 'fr';
    return {
      language: normalized,
      locale: isFrench ? 'fr-FR' : 'en-US',
      isFrench,
      setLanguage: typeof setLanguage === 'function' ? setLanguage : () => {},
      toggleLanguage:
        typeof setLanguage === 'function'
          ? () => setLanguage((current) => (normalizeLanguage(current) === 'fr' ? 'en' : 'fr'))
          : () => {}
    };
  }, [normalized, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export const LANGUAGE_DEFAULT = DEFAULT_LANGUAGE;
