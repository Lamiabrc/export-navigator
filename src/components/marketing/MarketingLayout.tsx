import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/contexts/LanguageContext";
import type { LanguageCode } from "@/i18n/translations";
import { navLinks } from "@/config/navLinks";
import { GdprGuarantee } from "@/components/GdprGuarantee";

// ✅ Encoding-safe flags (avoid broken emoji bytes)
const flags: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7), // 🇫🇷
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7), // 🇬🇧
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export const MarketingLayout = ({ children }: { children: ReactNode }) => {
  const { lang, t, setLang } = useI18n();
  const location = useLocation();
  const isEN = lang === "en";

  const navLabel = (key: string, fallback: string) => {
    const candidate = (t(key) as string) ?? "";
    // si la trad n’existe pas, beaucoup de systèmes renvoient la key elle-même
    if (!candidate || candidate === key) return fallback;
    return candidate;
  };

  const ctaLabel = (() => {
    const candidate = (t("header.cta") as string) ?? "";
    if (!candidate || candidate === "header.cta") return "Demander un diagnostic";
    return candidate;
  })();
  const heroDisclaimers = (t("heroLanding.disclaimers") as string[]) ?? [];
  const globalDisclaimers = (t("disclaimers") as string[]) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          {/* BRAND */}
          <BrandLogo
            href="/"
            size="md"
            imageClassName="h-10 w-auto"
            textClassName="text-[13px]"
            title="MPL Export Navigator"
            subtitle="par MPL Export Conseil"
            location="Conseil Export"
            className="group"
          />

          {/* NAV */}
          <nav className="hidden flex-1 items-center justify-center gap-4 text-sm font-semibold text-blue-900/70 md:flex">
            {navLinks.map((link) => {
              const label = navLabel(link.key, link.fallback);
              const isActive =
                link.to === "/"
                  ? location.pathname === "/"
                  : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);

              return (
                <Link
                  key={link.key}
                  to={link.to}
                  className={cx(
                    "transition-colors hover:text-blue-900",
                    isActive && "text-blue-900"
                  )}
                  aria-label={label}
                >
                  <span className={cx(isActive && "border-b-2 border-blue-900 pb-1")}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* Language */}
            <div
              role="group"
              aria-label={navLabel("header.languageAria", "Langue")}
              className="flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-900/70 shadow-sm"
            >
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => setLang(code)}
                  className={cx(
                    "flex items-center gap-1 rounded-full px-2 py-1 transition",
                    lang === code ? "bg-blue-900 text-white" : "text-blue-900/70 hover:text-blue-900"
                  )}
                  aria-label={navLabel("header.languageLabel", "Changer la langue")}
                >
                  <span aria-hidden="true">{flags[code]}</span>
                  <span>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {/* CTA (unique, cohérent, visible) */}
            <Link
              to="/contact?offer=diagnostic"
              className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]"
            >
              {ctaLabel}
            </Link>

            <Link
              to="/login"
              className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-blue-900/70 transition hover:text-blue-900 md:inline-flex"
            >
              {isEN ? "Sign in" : "Connexion"}
            </Link>
          </div>
        </div>

        {/* Mobile nav (simple, sans burger) */}
        <div className="md:hidden border-t border-blue-100 bg-white/80">
          <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-2">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-blue-900/70">
              {navLinks.map((link) => {
                const label = navLabel(link.key, link.fallback);
                const isActive =
                  link.to === "/"
                    ? location.pathname === "/"
                    : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
                return (
                  <Link
                    key={`${link.key}-m`}
                    to={link.to}
                    className={cx(
                      "whitespace-nowrap rounded-full border px-3 py-2 transition",
                      isActive
                        ? "border-blue-900 bg-blue-900 text-white"
                        : "border-blue-200 bg-white text-blue-900/80 hover:border-blue-300"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tricolore */}
        <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
      </header>

      <main className="flex-1">{children}</main>

      <div className="border-t border-blue-100 bg-white/85 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <GdprGuarantee />

          {(globalDisclaimers.length > 0 || heroDisclaimers.length > 0) && (
            <div className="mt-6 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
              {[...heroDisclaimers, ...globalDisclaimers]
                .filter(Boolean)
                .map((text, index) => (
                  <p key={`${text}-${index}`} className="text-xs text-slate-500">
                    {text}
                  </p>
                ))}
            </div>
          )}
        </div>
      </div>
      <footer className="border-t border-blue-100 bg-white/85 py-8 text-center text-xs font-medium text-slate-500">
        {t("footer.copy")}
      </footer>
    </div>
  );
};
