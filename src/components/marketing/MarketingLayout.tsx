import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useI18n } from "@/contexts/LanguageContext";
import { usePlan } from "@/auth/PlanContext";
import type { LanguageCode } from "@/i18n/translations";

type NavLink = { key: string; to: string; fallback: string };

const navLinks: NavLink[] = [
  { key: "header.menu.home", to: "/", fallback: "Accueil" },
  { key: "header.menu.tool", to: "/tool", fallback: "Outil" },
  // On garde /services mais on affiche "Offre" pour cohérence business
  { key: "header.menu.services", to: "/services", fallback: "Offre" },
  // On garde /watch mais on affiche "Veille"
  { key: "header.menu.watch", to: "/watch", fallback: "Veille" },
  // Guides / Méthodologie : si ton routing est /guide ou /guides, adapte ici
  { key: "header.menu.guides", to: "/guides", fallback: "Guides" },
  { key: "header.menu.methodologie", to: "/methodologie", fallback: "Méthodologie" },
  { key: "header.menu.contact", to: "/contact", fallback: "Contact" },
];

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
          <Link to="/" className="group flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-wide text-slate-900">
              Export Navigator
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 group-hover:text-slate-700">
              par MPL Export Conseil
            </span>
          </Link>

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

      <footer className="border-t border-slate-200 bg-white/80 py-8 text-center text-xs font-medium text-slate-500">
        {t("footer.copy")}
      </footer>
    </div>
  );
};
