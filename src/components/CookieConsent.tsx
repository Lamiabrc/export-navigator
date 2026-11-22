import * as React from "react";
import { Link } from "react-router-dom";

import { useI18n } from "@/contexts/LanguageContext";
import { Switch } from "@/components/ui/switch";

type ConsentDetails = {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

const STORAGE_KEY = "export-navigator-consent";

function readConsent(): ConsentDetails | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ConsentDetails;
  } catch {
    return null;
  }
}

function applyConsent(payload: ConsentDetails) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* stockage indisponible : on applique quand même pour la session */
  }
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.("consent", "update", {
    analytics_storage: payload.analytics ? "granted" : "denied",
    ad_storage: payload.marketing ? "granted" : "denied",
    ad_user_data: payload.marketing ? "granted" : "denied",
    ad_personalization: payload.marketing ? "granted" : "denied",
  });
}

/**
 * Bandeau cookies compact : une ligne en bas d'écran, choix égal entre accepter et refuser,
 * réglage fin seulement sur demande. Rien n'est coché par défaut.
 */
export function CookieConsent() {
  const { lang } = useI18n();
  const isFr = lang !== "en";
  const [visible, setVisible] = React.useState(false);
  const [details, setDetails] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  React.useEffect(() => {
    if (!readConsent()) {
      // Laisse la page s'afficher avant de proposer le choix.
      const timer = window.setTimeout(() => setVisible(true), 1200);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const decide = (nextAnalytics: boolean, nextMarketing: boolean) => {
    applyConsent({ analytics: nextAnalytics, marketing: nextMarketing, timestamp: new Date().toISOString() });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={isFr ? "Choix des cookies" : "Cookie choices"}
      className="fixed inset-x-2 bottom-2 z-50 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur-md sm:inset-x-auto sm:left-4 sm:max-w-xl"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-slate-700">
          {isFr
            ? "Cookies de mesure d'audience, uniquement avec votre accord."
            : "Audience-measurement cookies, only with your consent."}{" "}
          <Link to="/cookies" className="underline">
            {isFr ? "En savoir plus" : "Learn more"}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => decide(false, false)} className="rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50">
            {isFr ? "Refuser" : "Decline"}
          </button>
          <button type="button" onClick={() => decide(true, true)} className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800">
            {isFr ? "Accepter" : "Accept"}
          </button>
        </div>
      </div>
      {details ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span>{isFr ? "Statistiques anonymes" : "Anonymous statistics"}</span>
            <Switch checked={analytics} onCheckedChange={setAnalytics} />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span>{isFr ? "Marketing" : "Marketing"}</span>
            <Switch checked={marketing} onCheckedChange={setMarketing} />
          </label>
          <button type="button" onClick={() => decide(analytics, marketing)} className="rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-800 sm:col-span-2">
            {isFr ? "Enregistrer mes choix" : "Save my choices"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setDetails(true)} className="mt-2 text-xs text-slate-500 underline">
          {isFr ? "Personnaliser" : "Customise"}
        </button>
      )}
    </div>
  );
}
