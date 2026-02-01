import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { useI18n } from "@/contexts/LanguageContext";
import type { LanguageCode } from "@/i18n/translations";

const navLinks: Array<{ key: string; to: string }> = [
  { key: "header.menu.home", to: "/" },
  { key: "header.menu.tool", to: "/tool" },
  { key: "header.menu.services", to: "/services" },
  { key: "header.menu.watch", to: "/watch" },
  { key: "header.menu.about", to: "/about" },
  { key: "header.menu.contact", to: "/contact" },
];

const flags: Record<LanguageCode, string> = {
  fr: "🇫🇷",
  en: "🇬🇧",
};

export const MarketingLayout = ({ children }: { children: ReactNode }) => {
  const { lang, t, setLang } = useI18n();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-neutral-900/5 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <Link to="/" className="text-lg font-semibold tracking-wide text-slate-900">
            Export Navigator
          </Link>

          <nav className="flex flex-1 items-center justify-center gap-4 text-sm font-medium text-slate-600">
            {navLinks.map((link) => {
              const label = ((t(link.key) as string) ?? link.key) as string;
              return (
                <Link
                  key={link.key}
                  to={link.to}
                  className="transition-colors hover:text-slate-900"
                  aria-label={label}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label={t("header.languageAria") as string}
              className="flex items-center rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 shadow-sm"
            >
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => setLang(code)}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 transition ${
                    lang === code ? "bg-slate-900 text-white" : "text-slate-600"
                  }`}
                  aria-label={t("header.languageLabel") as string}
                >
                  <span aria-hidden="true">{flags[code]}</span>
                  <span>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <Link
              to="/contact"
              className="hidden rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-slate-700 md:inline-flex"
            >
              {t("header.cta")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white/80 py-8 text-center text-xs font-medium text-slate-500">
        {t("footer.copy")}
      </footer>
    </div>
  );
};
