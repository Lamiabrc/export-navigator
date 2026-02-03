import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/contexts/LanguageContext";
import { usePlan } from "@/auth/PlanContext";
import type { LanguageCode } from "@/i18n/translations";
import { navLinks } from "@/config/navLinks";
import { GdprGuarantee } from "@/components/GdprGuarantee";

// ✅ Encoding-safe flags (avoid broken emoji bytes)
const flags: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7), // 🇫🇷
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7), // 🇬🇧
};

const planOptions = [
  { label: "FREE", value: "FREE" },
  { label: "PRO", value: "PRO" },
  { label: "VIP", value: "VIP" },
];

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export const MarketingLayout = ({ children }: { children: ReactNode }) => {
  const { lang, t, setLang } = useI18n();
  const { plan, setPlan } = usePlan();
  const location = useLocation();

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          {/* BRAND */}
          <BrandLogo
            href="/"
            size="md"
            imageClassName="h-10 w-auto"
            textClassName="text-[13px]"
            title="Export Navigator"
            subtitle="par MPL Export Conseil"
            location="Conseil Export"
            className="group"
          />

          {/* NAV */}
          <nav className="hidden flex-1 items-center justify-center gap-4 text-sm font-semibold text-slate-600 md:flex">
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
                    "transition-colors hover:text-slate-900",
                    isActive && "text-slate-900"
                  )}
                  aria-label={label}
                >
                  <span className={cx(isActive && "border-b-2 border-slate-900 pb-1")}>
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
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm"
            >
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => setLang(code)}
                  className={cx(
                    "flex items-center gap-1 rounded-full px-2 py-1 transition",
                    lang === code ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                  aria-label={navLabel("header.languageLabel", "Changer la langue")}
                >
                  <span aria-hidden="true">{flags[code]}</span>
                  <span>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {/* Plan */}
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.35em] text-slate-600 shadow-sm md:flex">
              <span>Plan</span>
              <select
                value={plan}
                onChange={(event) => setPlan(event.target.value as typeof plan)}
                className="bg-transparent text-[11px] font-bold uppercase tracking-[0.35em] outline-none"
                aria-label="Select plan"
              >
                {planOptions.map((option) => (
                  <option key={option.value} value={option.value} className="text-slate-900">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* CTA (unique, cohérent, visible) */}
            <Link
              to="/contact?offer=diagnostic"
              className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        {/* Mobile nav (simple, sans burger) */}
        <div className="md:hidden border-t border-slate-200 bg-white/80">
          <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-2">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-600">
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
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <div className="border-t border-slate-200 bg-white/80 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <GdprGuarantee />
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-white/80 py-8 text-center text-xs font-medium text-slate-500">
        {t("footer.copy")}
      </footer>
    </div>
  );
};
