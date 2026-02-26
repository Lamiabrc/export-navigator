import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { LanguageCode } from "@/i18n/translations";
import { cn } from "@/lib/utils";
import { isPathActive, publicNav } from "@/config/navigation";

const FLAGS: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7),
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7),
};

export function MarketingHeader() {
  const { lang, t, setLang } = useI18n();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const nextPath = `${location.pathname}${location.search}` || "/";
  const authNext = nextPath === "/" ? "/app/control-tower" : nextPath;
  const authNextParam = encodeURIComponent(authNext);

  const isEN = lang === "en";
  const registerLabel = isEN ? "Create free account" : "Creer un compte gratuit";
  const loginLabel = isEN ? "Sign in" : "Connexion";
  const appLabel = isEN ? "My workspace" : "Mon espace";

  const navLabel = (item: (typeof publicNav)[number]) => {
    const translated = item.tKey ? String((t(item.tKey) as string) || "").trim() : "";
    if (translated && translated !== item.tKey) return translated;
    return item.labels[lang];
  };

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#d6c8b2] bg-[#eadfce]/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3 px-4 py-2 md:px-6">
        <BrandLogo
          href="/"
          size="sm"
          imageClassName="h-8 w-auto rounded-md bg-white p-1 md:h-9"
          textClassName="text-[11px] md:text-[12px]"
          titleClassName="text-black"
          subtitleClassName="text-black/80"
          locationClassName="text-black/70"
          title="MPL Export Navigator"
          subtitle="par MPL Export Conseil"
          location="Conseil Export"
          className="group rounded-xl bg-white/95 px-3 py-2 shadow-lg shadow-black/20"
        />

        <nav className="hidden flex-1 items-center justify-center gap-4 text-sm font-semibold text-slate-900 md:flex">
          {publicNav.map((item) => {
            const label = navLabel(item);
            const active = isPathActive(location.pathname, item.to);
            const badge = item.badge?.[lang];
            return (
              <Link key={item.id} to={item.to} className="transition-colors hover:text-black" aria-label={label}>
                <span className={cn("inline-flex items-center gap-1", active && "border-b-2 border-blue-700 pb-1 text-black")}>
                  {label}
                  {badge ? (
                    <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                      {badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm">
            {(["fr", "en"] as LanguageCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 transition",
                  lang === code ? "bg-blue-800 text-white" : "text-slate-900 hover:text-black"
                )}
              >
                <span aria-hidden="true">{FLAGS[code]}</span>
                <span>{code.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {isAuthenticated ? (
            <Link
              to="/app/control-tower"
              className="inline-flex rounded-full border border-slate-500/60 bg-[#0a1d3a] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#0d2a54]"
            >
              {appLabel}
            </Link>
          ) : (
            <>
              <Link
                to={`/register?next=${authNextParam}`}
                className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]"
              >
                {registerLabel}
              </Link>
              <Link
                to={`/login?next=${authNextParam}`}
                className="inline-flex rounded-full border border-slate-500/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-900 transition hover:bg-slate-50"
              >
                {loginLabel}
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#cdbda4] bg-[#f8efe2] text-slate-900"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? (isEN ? "Close menu" : "Fermer le menu") : (isEN ? "Open menu" : "Ouvrir le menu")}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="h-[2px] bg-gradient-to-r from-[#1e3a8a] via-[#8fd8ff] to-[#c81e33]" />

      {mobileOpen ? (
        <div className="border-t border-[#d6c8b2] bg-[#eadfce]/95 px-4 py-3 shadow-lg md:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  key={`mob-${code}`}
                  type="button"
                  onClick={() => setLang(code)}
                  className={cn("rounded-full px-2 py-1", lang === code ? "bg-blue-800 text-white" : "text-slate-900")}
                >
                  {FLAGS[code]} {code.toUpperCase()}
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <Link
                to="/app/control-tower"
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-slate-500/60 bg-[#0a1d3a] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white"
              >
                {appLabel}
              </Link>
            ) : (
              <Link
                to={`/login?next=${authNextParam}`}
                onClick={() => setMobileOpen(false)}
                className="text-xs font-semibold text-slate-900 underline"
              >
                {loginLabel}
              </Link>
            )}
          </div>

          {!isAuthenticated ? (
            <Link
              to={`/register?next=${authNextParam}`}
              onClick={() => setMobileOpen(false)}
              className="mb-3 inline-flex rounded-full bg-[#DC2626] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white"
            >
              {registerLabel}
            </Link>
          ) : null}

          <nav className="grid grid-cols-1 gap-2">
            {publicNav.map((item) => {
              const label = navLabel(item);
              const active = isPathActive(location.pathname, item.to);
              const badge = item.badge?.[lang];
              return (
                <Link
                  key={`${item.id}-mobile`}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold",
                    active ? "border-blue-800 bg-blue-800 text-white" : "border-[#cdbda4] bg-[#f8efe2] text-slate-900"
                  )}
                >
                  <span>{label}</span>
                  {badge ? (
                    <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
