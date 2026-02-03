import * as React from "react";

import { useI18n } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
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

function writeConsent(payload: ConsentDetails) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function CookieConsent() {
  const { t } = useI18n();
  const [visible, setVisible] = React.useState(true);
  const [analytics, setAnalytics] = React.useState(true);
  const [marketing, setMarketing] = React.useState(false);

  React.useEffect(() => {
    const stored = readConsent();
    if (stored) {
      setAnalytics(stored.analytics);
      setMarketing(stored.marketing);
      setVisible(false);
    }
  }, []);

  const acceptAll = () => {
    const payload: ConsentDetails = {
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    };
    writeConsent(payload);
    setAnalytics(true);
    setMarketing(true);
    setVisible(false);
  };

  const savePreferences = () => {
    const payload: ConsentDetails = {
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    };
    writeConsent(payload);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl backdrop-blur-md sm:inset-x-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("gdpr.consentTitle")}</p>
          <p className="mt-1 text-sm text-slate-700">{t("gdpr.consentBody")}</p>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:mt-0">
          <Button onClick={acceptAll} className="w-full sm:w-auto">
            {t("gdpr.actions.accept")}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={savePreferences}>
            {t("gdpr.actions.save")}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span>{t("gdpr.options.analytics")}</span>
          <Switch checked={analytics} onCheckedChange={(value) => setAnalytics(value)} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span>{t("gdpr.options.marketing")}</span>
          <Switch checked={marketing} onCheckedChange={(value) => setMarketing(value)} />
        </label>
      </div>
    </div>
  );
}
