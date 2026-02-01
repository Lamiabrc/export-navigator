import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { translations as baseTranslations, LanguageCode, getNestedValue } from "@/i18n/translations";
import { marketingTranslations } from "@/i18n/marketingTranslations";

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

const deepMerge = <T extends Record<string, any>>(base: T, extra?: Partial<T>): T => {
  if (!extra) {
    return base;
  }

  const copy = Array.isArray(base) ? [...base] : { ...base };

  for (const key of Object.keys(extra)) {
    const baseValue = (base as Record<string, any>)[key];
    const extraValue = extra[key];

    if (
      typeof baseValue === "object" &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof extraValue === "object" &&
      extraValue !== null &&
      !Array.isArray(extraValue)
    ) {
      (copy as Record<string, any>)[key] = deepMerge(baseValue, extraValue);
    } else {
      (copy as Record<string, any>)[key] = extraValue;
    }
  }

  return copy;
};

const mergedTranslations: Record<LanguageCode, Record<string, any>> = {
  fr: deepMerge(baseTranslations.fr, marketingTranslations.fr),
  en: deepMerge(baseTranslations.en, marketingTranslations.en),
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LanguageCode>(() => getPreferredLang());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key: string) => {
      const value = getNestedValue(mergedTranslations[lang], key);
      if (value !== undefined) {
        return value;
      }

      return getNestedValue(mergedTranslations.en, key) ?? key;
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
