import type { UiLang } from "@/lib/constants";

export function sanitizeOptionalComment(input: string, maxLength = 600) {
  return String(input || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeCompactText(input: string, maxLength = 180) {
  return String(input || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function toFriendlyErrorMessage(error: unknown, lang: UiLang) {
  const raw = String((error as { message?: string })?.message || error || "").toLowerCase();

  if (!raw.trim()) {
    return lang === "en"
      ? "The operation could not be completed. Please try again."
      : "Operation impossible pour le moment. Merci de reessayer.";
  }

  if (
    raw.includes("network") ||
    raw.includes("failed to fetch") ||
    raw.includes("timeout") ||
    raw.includes("abort")
  ) {
    return lang === "en"
      ? "Network issue detected. Please check your connection and retry."
      : "Probleme reseau detecte. Verifiez votre connexion puis recommencez.";
  }

  if (
    raw.includes("invalid token") ||
    raw.includes("auth") ||
    raw.includes("permission") ||
    raw.includes("rls") ||
    raw.includes("jwt")
  ) {
    return lang === "en"
      ? "Your session has expired. Please sign in again."
      : "Votre session a expire. Merci de vous reconnecter.";
  }

  if (
    raw.includes("function") ||
    raw.includes("rpc") ||
    raw.includes("unaccent") ||
    raw.includes("does not exist") ||
    raw.includes("sqlstate")
  ) {
    return lang === "en"
      ? "A data service is temporarily unavailable. Please retry in a moment."
      : "Un service de donnees est temporairement indisponible. Merci de reessayer dans un instant.";
  }

  return lang === "en"
    ? "Unable to process this request right now. Please try again."
    : "Impossible de traiter votre demande pour le moment. Merci de reessayer.";
}
