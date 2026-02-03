import * as React from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/LanguageContext";

const LANGUAGE_SELECTION_KEY = "export-navigator-language-selected";

export function LanguageChooser() {
  const { setLang, t } = useI18n();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LANGUAGE_SELECTION_KEY);
    if (!stored) {
      setOpen(true);
    }
  }, []);

  const handleSelect = (code: "fr" | "en") => {
    setLang(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_SELECTION_KEY, "1");
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{t("languagePrompt.title")}</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{t("languagePrompt.body")}</h2>
        <div className="mt-6 flex gap-3">
          <Button className="flex-1" onClick={() => handleSelect("fr")}>
            Français
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => handleSelect("en")}>
            English
          </Button>
        </div>
      </div>
    </div>
  );
}
