import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import { TricolorBanner } from "@/components/layout/TricolorBanner";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { LanguageCode } from "@/i18n/translations";
import { navLinks } from "@/config/navLinks";
import { getBannerContent } from "@/config/bannerContent";
import SupportChatWidget from "@/components/support/SupportChatWidget";

const flags: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7),
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7),
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

function FooterSocial() {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const links = [
    { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61587254986176", icon: "/facebook.svg" },
    { label: "YouTube", href: "https://www.youtube.com/channel/UCxRRjAnotPJahv9SzaPJsAw", icon: "/youtube.svg" },
    { label: "LinkedIn", href: "https://www.linkedin.com/company/mpl-conseil-export/?viewAsMember=true", icon: "/linkedin.svg" },
  ];

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        {isFr ? "Réseaux sociaux" : "Social networks"}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">
        {isFr
          ? "Suivez MPL Export Conseil pour les actualités et contenus export."
          : "Follow MPL Export Conseil for export updates and insights."}
      </div>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary hover:underline"
            >
              <img src={link.icon} alt={link.label} className="h-5 w-5" />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <Button asChild className="bg-[#DC2626] text-white hover:bg-[#B0231D]">
          <Link to="/contact?offer=diagnostic">{isFr ? "Nous contacter" : "Contact us"}</Link>
        </Button>
      </div>
    </div>
  );
}

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const { isAuthenticated } = useAuth();
  const isFr = lang === "fr";
  const banner = getBannerContent(location.pathname);
  const siteDisclaimers = (t("disclaimers") as string[]) ?? [];
  const nextPath = `${location.pathname}${location.search}` || "/";
  const authNext = nextPath === "/" ? "/app/control-tower" : nextPath;
  const authNextParam = encodeURIComponent(authNext);
  const isHome = location.pathname === "/";

  const [supportReady, setSupportReady] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navLabel = (key: string, fallback: string) => {
    const candidate = (t(key) as string) ?? "";
    if (!candidate || candidate === key) return fallback;
    return candidate;
  };

  const ctaLabel = isFr ? "Demander un devis" : "Request a quote";
  const payLabel = isFr ? "Payer" : "Pay";

  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

  React.useEffect(() => {
    const handler = () => {
      setSupportReady(true);
      setSupportOpen(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("support-widget:open", handler as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("support-widget:open", handler as EventListener);
      }
    };
  }, []);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white text-foreground">
      <CinematicBackdrop variant="public" className="z-0 opacity-20" />
      <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-white/85 via-white/90 to-white" />

      <header className="relative z-20 border-b border-blue-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-3 px-4 py-3 md:px-6">
          <BrandLogo
            href="/"
            size="md"
            imageClassName="h-9 w-auto md:h-10"
            textClassName="text-[12px] md:text-[13px]"
            title="MPL Export Navigator"
            subtitle="par MPL Export Conseil"
            location="Conseil Export"
            className="group"
          />

          <nav className="hidden flex-1 items-center justify-center gap-4 text-sm font-semibold text-blue-900/70 md:flex">
            {navLinks.map((link) => {
              const label = navLabel(link.key, link.fallback);
              const active = isActivePath(location.pathname, link.to);
              return (
                <Link key={link.key} to={link.to} className={cx("transition-colors hover:text-blue-900", active && "text-blue-900")} aria-label={label}>
                  <span className={cx(active && "border-b-2 border-blue-900 pb-1")}>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
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
                >
                  <span aria-hidden="true">{flags[code]}</span>
                  <span>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <Link to="/app/control-tower" className="inline-flex rounded-full bg-blue-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-blue-800">
                Tour de contrôle
              </Link>
            ) : (
              <>
                <Link to={`/register?next=${authNextParam}`} className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]">
                  {ctaLabel}
                </Link>
                <Link to="/pricing#plans" className="inline-flex rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-900 transition hover:border-blue-300">
                  {isFr ? "Payer en ligne" : "Pay online"}
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {!isAuthenticated ? (
              <>
                <Link to={`/register?next=${authNextParam}`} className="inline-flex rounded-full bg-[#DC2626] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {ctaLabel}
                </Link>
                <Link to="/pricing#plans" className="inline-flex rounded-full border border-blue-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-900">
                  {payLabel}
                </Link>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? (isFr ? "Fermer le menu" : "Close menu") : (isFr ? "Ouvrir le menu" : "Open menu")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-900"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="md:hidden border-t border-blue-100 bg-white/95 px-4 py-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-900/70">
                {(["fr", "en"] as LanguageCode[]).map((code) => (
                  <button
                    key={`mob-${code}`}
                    type="button"
                    onClick={() => setLang(code)}
                    className={cn(
                      "rounded-full px-2 py-1",
                      lang === code ? "bg-blue-900 text-white" : "text-blue-900"
                    )}
                  >
                    {flags[code]} {code.toUpperCase()}
                  </button>
                ))}
              </div>

              {isAuthenticated ? (
                <Link to="/app/control-tower" className="rounded-full bg-blue-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Tour de contrôle
                </Link>
              ) : (
                <Link to={`/login?next=${authNextParam}`} className="text-xs font-semibold text-blue-900/80 underline">
                  {isFr ? "Connexion" : "Sign in"}
                </Link>
              )}
            </div>

            <nav className="grid grid-cols-1 gap-2">
              {navLinks.map((link) => {
                const active = isActivePath(location.pathname, link.to);
                const label = navLabel(link.key, link.fallback);
                return (
                  <Link
                    key={`${link.key}-drawer`}
                    to={link.to}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-semibold",
                      active ? "border-blue-900 bg-blue-900 text-white" : "border-blue-200 bg-white text-blue-900"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}

        <div className="h-1 bg-gradient-to-r from-blue-700 via-white to-red-600" />
      </header>

      <main className={cn(
        "relative z-10 mx-auto w-full",
        isHome ? "max-w-none px-0 py-0" : "max-w-[90rem] px-4 py-8 sm:px-6 md:px-10 md:py-10"
      )}>
        {isHome ? null : (
          <div className="mb-6">
            <TricolorBanner title={banner.title} question={banner.question} />
          </div>
        )}
        {children ?? <Outlet />}
      </main>

      {isAuthenticated ? (
        <Link
          to="/app/control-tower"
          className="fixed bottom-6 left-4 z-[80] inline-flex items-center rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-900 shadow-lg hover:bg-blue-50 md:left-6"
        >
          Retour tour de contrôle
        </Link>
      ) : null}

      <footer className="relative z-10 border-t border-blue-100 bg-white/85">
        <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 py-8 sm:px-6 md:px-10 md:py-10 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">MPL Export Navigator</div>
            <div className="text-sm text-muted-foreground">
              Outil d’aide à la décision export — par MPL Export Conseil (audit, conformité, veille personnalisée).
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link to="/methodologie" className="hover:text-foreground hover:underline">Méthodologie</Link>
              <Link to="/about" className="hover:text-foreground hover:underline">À propos</Link>
              <Link to="/guides" className="hover:text-foreground hover:underline">Guides</Link>
              <Link to="/veille" className="hover:text-foreground hover:underline">Veille</Link>
              <Link to="/contact" className="hover:text-foreground hover:underline">Contact</Link>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <a href={`tel:${phoneRaw}`} className="hover:text-foreground hover:underline">{phonePretty}</a>
              <a href={`mailto:${emailMain}`} className="hover:text-foreground hover:underline">{emailMain}</a>
            </div>

            <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} MPL Export Conseil — outil d’aide à la décision.</div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground md:mt-2">
              {siteDisclaimers.map((text, index) => (
                <span key={`foot-disclaimer-${index}`} className="leading-snug">{text}</span>
              ))}
            </div>
          </div>

          <FooterSocial />
        </div>
      </footer>

      {supportReady ? (
        <SupportChatWidget open={supportOpen} onOpenChange={setSupportOpen} />
      ) : (
        <button
          type="button"
          onClick={() => {
            setSupportReady(true);
            setSupportOpen(true);
          }}
          className="fixed bottom-6 right-4 z-[90] inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a] md:right-6"
          aria-label={isFr ? "Ouvrir MPL Export Expert" : "Open MPL Export Expert"}
        >
          {isFr ? "MPL Export Expert" : "MPL Export Expert"}
        </button>
      )}
    </div>
  );
}
