import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { translations, LanguageCode, getNestedValue } from "@/i18n/translations";

type LanguageContextValue = {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string) => string | string[] | undefined;
};

const STORAGE_KEY = "export-navigator-lang";

const getPreferredLang = (): LanguageCode => {
  if (typeof window === "undefined") {
    return "fr";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") {
    return stored;
  }

  const navigatorLang = window.navigator.language?.slice(0, 2).toLowerCase();
  if (navigatorLang === "en") {
    return "en";
  }

  return "fr";
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LanguageCode>(() => getPreferredLang());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: string) => {
      const value = getNestedValue(translations[lang], key);
      if (value !== undefined) {
        return value;
      }

      return getNestedValue(translations.en, key) ?? key;
    },
    [lang],
  );

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
    }),
    [lang, setLang, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }

  return context;
};
