import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { LanguageCode } from "@/i18n/translations";
import { navLinks } from "@/config/navLinks";
import { cn } from "@/lib/utils";

const FLAGS: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7),
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7),
};

export function MarketingHeader() {
  const { lang, t, setLang } = useI18n();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isEN = lang === "en";

  const navLabel = (key: string, fallback: string) => {
    const candidate = t(key) as string;
    if (!candidate || candidate === key) return fallback;
    return candidate;
  };

  const ctaLabel = isEN ? "Contact us" : "Nous contacter";
  const appLabel = isEN ? "My workspace" : "Mon espace";
  const loginLabel = isEN ? "Sign in" : "Connexion";

  return (
    <header className="sticky top-0 z-50 border-b border-[hsl(var(--mkt-blue-100))] bg-white/95 backdrop-blur-md">
      <div className="mkt-container">
        <div className="flex h-16 items-center justify-between gap-4 lg:h-20">
          {/* Brand */}
          <BrandLogo
            href="/"
            size="md"
            imageClassName="h-9 w-auto lg:h-10"
            textClassName="text-[12px] lg:text-[13px]"
            title="MPL Export Navigator"
            subtitle="par MPL Export Conseil"
            location="Conseil Export"
            className="group shrink-0"
          />

          {/* Desktop Nav */}
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
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
                  className={cn(
                    "relative px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-[hsl(var(--mkt-primary))]"
                      : "text-[hsl(var(--mkt-ink-muted))] hover:text-[hsl(var(--mkt-ink))]"
                  )}
                >
                  {label}
                  {isActive && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[hsl(var(--mkt-primary))]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <div className="hidden items-center rounded-full border border-[hsl(var(--mkt-blue-100))] bg-white p-0.5 sm:flex">
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition",
                    lang === code
                      ? "bg-[hsl(var(--mkt-primary))] text-white"
                      : "text-[hsl(var(--mkt-ink-muted))] hover:text-[hsl(var(--mkt-ink))]"
                  )}
                  aria-label={`Switch to ${code.toUpperCase()}`}
                >
                  <span aria-hidden="true">{FLAGS[code]}</span>
                  <span>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {/* CTA */}
            <Link
              to="/contact?offer=diagnostic"
              className="mkt-btn mkt-btn-primary hidden text-xs sm:inline-flex"
            >
              {ctaLabel}
            </Link>

            {/* Login / App */}
            {isAuthenticated ? (
              <Link
                to="/app/control-tower"
                className="hidden text-sm font-medium text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))] lg:inline-flex"
              >
                {appLabel}
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden text-sm font-medium text-[hsl(var(--mkt-ink-muted))] transition hover:text-[hsl(var(--mkt-ink))] lg:inline-flex"
              >
                {loginLabel}
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[hsl(var(--mkt-ink))] transition hover:bg-[hsl(var(--mkt-surface-muted))] lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tricolor line */}
      <div className="mkt-divider-tricolor" />

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-[hsl(var(--mkt-blue-100))] bg-white lg:hidden">
          <nav className="mkt-container flex flex-col gap-1 py-4">
            {navLinks.map((link) => {
              const label = navLabel(link.key, link.fallback);
              const isActive =
                link.to === "/"
                  ? location.pathname === "/"
                  : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);

              return (
                <Link
                  key={`${link.key}-mobile`}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-[hsl(var(--mkt-primary)/0.1)] text-[hsl(var(--mkt-primary))]"
                      : "text-[hsl(var(--mkt-ink))] hover:bg-[hsl(var(--mkt-surface-muted))]"
                  )}
                >
                  {label}
                </Link>
              );
            })}

            <div className="my-2 h-px bg-[hsl(var(--mkt-blue-100))]" />

            {/* Language */}
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-xs text-[hsl(var(--mkt-ink-muted))]">
                {isEN ? "Language" : "Langue"}
              </span>
              <div className="flex gap-1 rounded-full border border-[hsl(var(--mkt-blue-100))] p-0.5">
                {(["fr", "en"] as LanguageCode[]).map((code) => (
                  <button
                    key={`${code}-mobile`}
                    type="button"
                    onClick={() => setLang(code)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      lang === code
                        ? "bg-[hsl(var(--mkt-primary))] text-white"
                        : "text-[hsl(var(--mkt-ink-muted))]"
                    )}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Link
              to="/contact?offer=diagnostic"
              onClick={() => setMobileOpen(false)}
              className="mkt-btn mkt-btn-primary mx-4 mt-2"
            >
              {ctaLabel}
            </Link>

            {/* Login / App */}
            {isAuthenticated ? (
              <Link
                to="/app/control-tower"
                onClick={() => setMobileOpen(false)}
                className="mx-4 mt-2 rounded-lg py-3 text-center text-sm font-medium text-[hsl(var(--mkt-ink-muted))]"
              >
                {appLabel}
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="mx-4 mt-2 rounded-lg py-3 text-center text-sm font-medium text-[hsl(var(--mkt-ink-muted))]"
              >
                {loginLabel}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
