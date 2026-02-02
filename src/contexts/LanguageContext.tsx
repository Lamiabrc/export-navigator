import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { translations as baseTranslations, LanguageCode, getNestedValue } from "@/i18n/translations";
import { marketingTranslations } from "@/i18n/marketingTranslations";

type LanguageContextValue = {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string) => string | string[] | undefined;
};

type PersistMode = "none" | "session" | "local";

/**
 * ✅ Nouveau projet : on ne persiste rien par défaut (visiteurs)
 * - "none"    : rien stocké
 * - "session" : stocké jusqu’à fermeture onglet
 * - "local"   : stocké durablement
 */
const DEFAULT_PERSIST: PersistMode = "none";

const STORAGE_KEY = "mpl-export-lang";
// compat ancienne clé (si tu l’avais déjà en prod)
const LEGACY_STORAGE_KEY = "export-navigator-lang";

function safeStorageGet(mode: PersistMode, key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (mode === "local") return window.localStorage.getItem(key);
    if (mode === "session") return window.sessionStorage.getItem(key);
    return null;
  } catch {
    return null;
  }
}

function safeStorageSet(mode: PersistMode, key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (mode === "local") window.localStorage.setItem(key, value);
    if (mode === "session") window.sessionStorage.setItem(key, value);
  } catch {
    // ignore (private mode / blocked storage)
  }
}

const deepMerge = <T extends Record<string, any>>(base: T, extra?: Partial<T>): T => {
  if (!extra) return base;

  const copy: any = Array.isArray(base) ? [...base] : { ...base };

  for (const key of Object.keys(extra)) {
    const baseValue = (base as any)[key];
    const extraValue = (extra as any)[key];

    if (
      typeof baseValue === "object" &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof extraValue === "object" &&
      extraValue !== null &&
      !Array.isArray(extraValue)
    ) {
      copy[key] = deepMerge(baseValue, extraValue);
    } else {
      copy[key] = extraValue;
    }
  }

  return copy as T;
};

const mergedTranslations: Record<LanguageCode, Record<string, any>> = {
  fr: deepMerge(baseTranslations.fr, marketingTranslations.fr),
  en: deepMerge(baseTranslations.en, marketingTranslations.en),
};

function getPreferredLang(persist: PersistMode): LanguageCode {
  if (typeof window === "undefined") return "fr";

  // 1) migration legacy (si existant)
  const legacy = safeStorageGet("local", LEGACY_STORAGE_KEY) || safeStorageGet("session", LEGACY_STORAGE_KEY);
  if (legacy === "fr" || legacy === "en") return legacy;

  // 2) stockage selon mode choisi
  const stored = safeStorageGet(persist, STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;

  // 3) navigateur
  const navigatorLang = window.navigator.language?.slice(0, 2).toLowerCase();
  if (navigatorLang === "en") return "en";

  return "fr";
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider = ({
  children,
  persist = DEFAULT_PERSIST,
}: {
  children: ReactNode;
  persist?: PersistMode;
}) => {
  const [lang, setLangState] = useState<LanguageCode>(() => getPreferredLang(persist));

  useEffect(() => {
    // ✅ persistance optionnelle (par défaut none)
    safeStorageSet(persist, STORAGE_KEY, lang);

    // ✅ HTML lang (SEO/accessibilité) — safe
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang, persist]);

  const t = useCallback(
    (key: string) => {
      const value = getNestedValue(mergedTranslations[lang], key);
      if (value !== undefined) return value;

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
