import { useEffect, useMemo } from "react";
import { useI18n } from "@/contexts/LanguageContext";

type MetaOptions = {
  /**
   * Contexte (optionnel) pour adapter le message au positionnement France ↔ Monde.
   * - si country vide => message “relations & traités…”
   * - si hsCode vide => message “conditions générales…”
   */
  countryCode?: string | null;
  hsCode?: string | null;

  /**
   * Optionnel : suffix marque (sinon fallback sur MPL Export Conseil)
   */
  brandSuffix?: string;

  /**
   * Optionnel : url canonique (sinon on met window.location.href)
   */
  canonicalUrl?: string;
};

function ensureMeta(name: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  return el;
}

function ensureMetaProperty(property: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  return el;
}

function ensureLink(rel: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  return el;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

export const usePageMeta = (titleKey: string, descriptionKey: string, options: MetaOptions = {}) => {
  const { t, lang } = useI18n();

  const {
    countryCode,
    hsCode,
    brandSuffix = "MPL Export Conseil",
    canonicalUrl,
  } = options;

  const computed = useMemo(() => {
    const rawTitle = asString(t(titleKey));
    const rawDesc = asString(t(descriptionKey));

    const hasCountry = Boolean(countryCode && String(countryCode).trim().length > 0);
    const hasHs = Boolean(hsCode && String(hsCode).replace(/[^0-9]/g, "").trim().length > 0);

    // ✅ Si pays vide => message “relations & traités → on doit connaître le pays”
    const countryHint =
      !hasCountry
        ? "L’export est une affaire de relations, accords et traités : indique la destination pour une réponse fiable."
        : "";

    // ✅ Si produit/HS vide => “conditions générales”
    const hsHint =
      !hasHs
        ? "Sans code produit (HS), on applique des conditions générales : ajoute un HS pour affiner droits, taxes et contrôles."
        : "";

    // On compose une description “safe” (SEO) sans exploser la longueur
    const pieces = [rawDesc, countryHint, hsHint].filter(Boolean);
    const finalDesc = pieces.join(" ").trim().slice(0, 160);

    // Titre brandé
    const finalTitle = rawTitle ? `${rawTitle} — ${brandSuffix}` : brandSuffix;

    return { title: finalTitle, description: finalDesc };
  }, [brandSuffix, countryCode, descriptionKey, hsCode, t, titleKey]);

  useEffect(() => {
    // Title
    if (computed.title) document.title = computed.title;

    // Meta description
    const desc = ensureMeta("description");
    desc.setAttribute("content", computed.description || "");

    // Language
    document.documentElement.lang = lang;

    // Canonical
    const canon = ensureLink("canonical");
    canon.setAttribute("href", canonicalUrl || window.location.href);

    // Open Graph (partage LinkedIn / WhatsApp)
    ensureMetaProperty("og:title").setAttribute("content", computed.title);
    ensureMetaProperty("og:description").setAttribute("content", computed.description || "");
    ensureMetaProperty("og:type").setAttribute("content", "website");
    ensureMetaProperty("og:locale").setAttribute("content", lang === "fr" ? "fr_FR" : "en_US");
    ensureMetaProperty("og:url").setAttribute("content", canonicalUrl || window.location.href);

    // Twitter
    ensureMeta("twitter:card").setAttribute("content", "summary");
    ensureMeta("twitter:title").setAttribute("content", computed.title);
    ensureMeta("twitter:description").setAttribute("content", computed.description || "");
  }, [canonicalUrl, computed.description, computed.title, lang]);
};
