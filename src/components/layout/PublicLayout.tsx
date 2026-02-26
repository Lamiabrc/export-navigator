import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import { TricolorBanner } from "@/components/layout/TricolorBanner";
import { useI18n } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import type { LanguageCode } from "@/i18n/translations";
import { footerNav, isPathActive, publicNav } from "@/config/navigation";
import { getBannerContent } from "@/config/bannerContent";
import SupportChatWidget from "@/components/support/SupportChatWidget";

type PublicLayoutProps = {
  children?: React.ReactNode;
  hideBanner?: boolean;
  hideFooter?: boolean;
};

const flags: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7),
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7),
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
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
    <div className="rounded-3xl border border-slate-700/70 bg-[#081225]/78 p-6 shadow-xl shadow-black/25">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white">
        {isFr ? "Reseaux sociaux" : "Social networks"}
      </div>
      <div className="mt-2 text-sm text-white">
        {isFr
          ? "Suivez MPL Export Conseil pour les actualites et contenus export."
          : "Follow MPL Export Conseil for export updates and insights."}
      </div>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 text-sm font-medium text-white hover:text-white hover:underline"
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

export function PublicLayout({ children, hideBanner = false, hideFooter = false }: PublicLayoutProps) {
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
  const [mobileResourcesOpen, setMobileResourcesOpen] = React.useState(false);

  const mainFooterLinks = React.useMemo(() => footerNav.filter((item) => !item.legal), []);
  const legalFooterLinks = React.useMemo(() => footerNav.filter((item) => item.legal), []);

  const resourceLinks = React.useMemo(
    () => [
      { to: "/guides/incoterms", label: isFr ? "Incoterms" : "Incoterms" },
      { to: "/methodologie", label: isFr ? "Methodologie" : "Methodology" },
      { to: "/veille", label: isFr ? "Veille" : "Watch" },
      { to: "/prospection", label: isFr ? "Prospection" : "Prospection" },
      { to: "/services", label: isFr ? "Offre" : "Offer" },
      { to: "/about", label: isFr ? "A propos" : "About" },
      { to: "/pricing#plans", label: isFr ? "Payer en ligne" : "Pay online" },
    ],
    [isFr]
  );

  const registerLabel = isFr ? "Creer un compte gratuit" : "Create free account";
  const loginLabel = isFr ? "Connexion" : "Sign in";
  const appLabel = isFr ? "Tour de controle" : "Control Tower";

  const phoneRaw = "0676435551";
  const phonePretty = "06 76 43 55 51";
  const emailMain = "contact@exportfrancefacile.com";

  const resolvePublicLabel = React.useCallback(
    (item: (typeof publicNav)[number]) => {
      const translated = item.tKey ? String((t(item.tKey) as string) || "").trim() : "";
      if (translated && translated !== item.tKey) return translated;
      return item.labels[lang];
    },
    [lang, t]
  );

  const resolveFooterLabel = React.useCallback(
    (item: (typeof footerNav)[number]) => item.labels[lang],
    [lang]
  );

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
    setMobileResourcesOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="public-cinematic-shell relative min-h-screen overflow-x-hidden bg-[hsl(var(--background))] text-foreground">
      {!isHome ? <CinematicBackdrop variant="public" className="z-0 opacity-30" /> : null}
      {!isHome ? <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-[#f8efe2]/85 via-[#f5ecde]/90 to-[#f2e6d6]" /> : null}

      <header className="relative z-20 border-b border-[#d6c8b2] bg-[#eadfce]/95 backdrop-blur-xl">
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
            {publicNav.map((link) => {
              const label = resolvePublicLabel(link);
              const active = isPathActive(location.pathname, link.to);
              const badge = link.badge?.[lang];
              return (
                <Link key={link.id} to={link.to} className={cx("transition-colors hover:text-black", active && "text-black")} aria-label={label}>
                  <span className={cx("inline-flex items-center gap-1", active && "border-b-2 border-blue-700 pb-1")}>
                    {label}
                    {badge ? (
                      <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">{badge}</span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <div
              role="group"
              aria-label={(t("header.languageAria") as string) || "Langue"}
              className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 shadow-sm"
            >
              {(["fr", "en"] as LanguageCode[]).map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => setLang(code)}
                  className={cx(
                    "flex items-center gap-1 rounded-full px-2 py-1 transition",
                    lang === code ? "bg-blue-800 text-white" : "text-slate-900 hover:text-black"
                  )}
                >
                  <span aria-hidden="true">{flags[code]}</span>
                  <span>{code.toUpperCase()}</span>
                </button>
              ))}
            </div>

            {isAuthenticated ? (
              <Link to="/app/control-tower" className="inline-flex rounded-full border border-slate-500/60 bg-[#0a1d3a] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#0d2a54]">
                {appLabel}
              </Link>
            ) : (
              <>
                <Link to={`/register?next=${authNextParam}`} className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]">
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
            {!isAuthenticated ? (
              <Link to={`/register?next=${authNextParam}`} className="inline-flex rounded-full bg-[#DC2626] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white">
                {registerLabel}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? (isFr ? "Fermer le menu" : "Close menu") : (isFr ? "Ouvrir le menu" : "Open menu")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#cdbda4] bg-[#f8efe2] text-slate-900"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="md:hidden border-t border-[#d6c8b2] bg-[#eadfce]/95 px-4 py-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-full border border-[#cdbda4] bg-[#f8efe2] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                {(["fr", "en"] as LanguageCode[]).map((code) => (
                  <button
                    key={`mob-${code}`}
                    type="button"
                    onClick={() => setLang(code)}
                    className={cn(
                      "rounded-full px-2 py-1",
                      lang === code ? "bg-blue-800 text-white" : "text-slate-900"
                    )}
                  >
                    {flags[code]} {code.toUpperCase()}
                  </button>
                ))}
              </div>

              {isAuthenticated ? (
                <Link to="/app/control-tower" className="rounded-full border border-slate-500/60 bg-[#0a1d3a] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {appLabel}
                </Link>
              ) : (
                <Link to={`/login?next=${authNextParam}`} className="text-xs font-semibold text-slate-900 underline">
                  {loginLabel}
                </Link>
              )}
            </div>

            <nav className="grid grid-cols-1 gap-2">
              {publicNav.map((link) => {
                const active = isPathActive(location.pathname, link.to);
                const label = resolvePublicLabel(link);
                const badge = link.badge?.[lang];
                return (
                  <Link
                    key={`${link.id}-drawer`}
                    to={link.to}
                    className={cn(
                      "flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold",
                      active ? "border-blue-800 bg-blue-800 text-white" : "border-[#cdbda4] bg-[#f8efe2] text-slate-900"
                    )}
                  >
                    <span>{label}</span>
                    {badge ? (
                      <span className="rounded-full border border-emerald-700/30 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">{badge}</span>
                    ) : null}
                  </Link>
                );
              })}

              <div className="rounded-xl border border-[#cdbda4] bg-[#f8efe2]">
                <button
                  type="button"
                  onClick={() => setMobileResourcesOpen((prev) => !prev)}
                  className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-900"
                >
                  <span>{isFr ? "Ressources" : "Resources"}</span>
                  {mobileResourcesOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                {mobileResourcesOpen ? (
                  <div className="grid grid-cols-1 gap-2 border-t border-[#d6c8b2] p-2">
                    {resourceLinks.map((item) => (
                      <Link
                        key={`mobile-resource-${item.to}`}
                        to={item.to}
                        className="flex min-h-11 items-center rounded-lg border border-[#cdbda4] bg-white px-3 py-2 text-sm font-medium text-slate-900"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </nav>
          </div>
        ) : null}

        <div className="h-[2px] bg-gradient-to-r from-[#1e3a8a] via-[#8fd8ff] to-[#c81e33]" />
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto w-full",
          isHome ? "max-w-none px-0 py-0" : "max-w-[90rem] px-4 py-8 text-foreground sm:px-6 md:px-10 md:py-10"
        )}
      >
        {isHome || hideBanner ? null : (
          <div className="mb-6">
            <TricolorBanner title={banner.title} question={banner.question} />
          </div>
        )}
        {children ?? <Outlet />}
      </main>

      {isAuthenticated ? (
        <Link
          to="/app/control-tower"
          className="fixed bottom-6 left-4 z-[80] inline-flex items-center rounded-full border border-slate-500/70 bg-[#0a1d3a] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/25 hover:bg-[#0d2a54] md:left-6"
        >
          {isFr ? "Retour tour de controle" : "Back to Control Tower"}
        </Link>
      ) : null}

      {hideFooter ? null : (
        <footer className="relative z-10 border-t border-slate-700/70 bg-[#040a15]/90">
          <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 py-8 sm:px-6 md:px-10 md:py-10 lg:grid-cols-[1fr_0.95fr]">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-white">MPL Export Navigator</div>
              <div className="text-sm text-white">
                Outil d'aide a la decision export - par MPL Export Conseil (audit, conformite, veille personnalisee).
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-white">
                {mainFooterLinks.map((item) => (
                  <Link key={item.id} to={item.to} className="hover:text-white hover:underline">
                    {resolveFooterLabel(item)}
                  </Link>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-white">
                <a href={`tel:${phoneRaw}`} className="hover:text-white hover:underline">{phonePretty}</a>
                <a href={`mailto:${emailMain}`} className="hover:text-white hover:underline">{emailMain}</a>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-white/90">
                {legalFooterLinks.map((item) => (
                  <Link key={item.id} to={item.to} className="hover:text-white hover:underline">
                    {resolveFooterLabel(item)}
                  </Link>
                ))}
              </div>

              <div className="text-xs text-white">(c) {new Date().getFullYear()} MPL Export Conseil - outil d'aide a la decision.</div>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-white md:mt-2">
                {siteDisclaimers.map((text, index) => (
                  <span key={`foot-disclaimer-${index}`} className="leading-snug">{text}</span>
                ))}
              </div>
            </div>

            <FooterSocial />
          </div>
        </footer>
      )}

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
