import * as React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CinematicBackdrop } from "@/components/cinematic/CinematicBackdrop";
import { TricolorBanner } from "@/components/layout/TricolorBanner";
import { useI18n } from "@/contexts/LanguageContext";
import type { LanguageCode } from "@/i18n/translations";
import { navLinks } from "@/config/navLinks";
import { getBannerContent } from "@/config/bannerContent";
import SupportChatWidget from "@/components/support/SupportChatWidget";

type RssItem = { title: string; link: string; pubDate?: string };

// Encoding-safe flags (avoid broken emoji bytes)
const flags: Record<LanguageCode, string> = {
  fr: String.fromCodePoint(0x1f1eb, 0x1f1f7),
  en: String.fromCodePoint(0x1f1ec, 0x1f1e7),
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function safeExternalUrl(url?: string) {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
}

/**
 * "Active" rules:
 * - exact match for root pages
 * - prefix match for sections like /guides/... or /veille/...
 */
function isActivePath(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  if (pathname === to) return true;
  return pathname.startsWith(`${to}/`);
}

function FooterRss() {
  const [items, setItems] = React.useState<RssItem[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        setStatus("loading");

        const res = await fetch("/api/rss", {
          signal: controller.signal,
          headers: { Accept: "application/xml,text/xml,application/rss+xml,*/*" },
        });

        const text = await res.text();
        if (!res.ok) throw new Error(text || "RSS error");

        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "application/xml");
        const parseError = xml.querySelector("parsererror");
        if (parseError) throw new Error("RSS XML invalide");

        const nodes = Array.from(xml.querySelectorAll("item")).slice(0, 6);
        const parsed = nodes
          .map((n) => {
            const title = (n.querySelector("title")?.textContent || "").trim();
            const link = (n.querySelector("link")?.textContent || "").trim();
            const pubDate = (n.querySelector("pubDate")?.textContent || "").trim();
            return { title, link, pubDate };
          })
          .filter((x) => x.title && safeExternalUrl(x.link));

        if (!cancelled) {
          setItems(parsed);
          setStatus("ok");
        }
      } catch (e: any) {
        if (cancelled) return;
        if (e?.name === "AbortError") return;
        setStatus("error");
      }
    };

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Veille export (RSS)
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Sanctions, douanes, conformité, marchés — mises à jour en continu.
          </div>
        </div>

        <Button asChild variant="outline" className="shrink-0">
          <a href="/api/rss" target="_blank" rel="noreferrer">
            Ouvrir le flux
          </a>
        </Button>
      </div>

      <div className="mt-4">
        {status === "loading" && (
          <div className="space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-foreground">
            Le flux RSS n’est pas lisible pour le moment. Vérifie que{" "}
            <span className="font-semibold">/api/rss</span> renvoie bien un XML RSS (status 200 + content-type xml).
          </div>
        )}

        {status === "ok" && items.length === 0 && (
          <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-foreground">
            Aucun item RSS à afficher (flux vide).
          </div>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => {
              const href = safeExternalUrl(it.link);
              return (
                <li key={it.link} className="flex items-start justify-between gap-4">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {it.title}
                    </a>
                  ) : (
                    <div className="min-w-0 text-sm font-medium text-foreground">{it.title}</div>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(it.pubDate)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/veille">Voir la veille</Link>
        </Button>
        <Button
          asChild
          className="bg-[#DC2626] text-white hover:bg-[#B0231D]"
        >
          <Link to="/contact?offer=diagnostic">Demander un diagnostic</Link>
        </Button>
      </div>
    </div>
  );
}

export function PublicLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const banner = getBannerContent(location.pathname);
  const siteDisclaimers = (t("disclaimers") as string[]) ?? [];
  const nextPath = `${location.pathname}${location.search}` || "/";
  const nextParam = encodeURIComponent(nextPath);
  const [supportReady, setSupportReady] = React.useState(false);
  const [supportOpen, setSupportOpen] = React.useState(false);

  const navLabel = (key: string, fallback: string) => {
    const candidate = (t(key) as string) ?? "";
    if (!candidate || candidate === key) return fallback;
    return candidate;
  };

  const ctaLabel = (() => {
    const candidate = (t("header.cta") as string) ?? "";
    if (!candidate || candidate === "header.cta") return "Créer un compte gratuit";
    return candidate;
  })();

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

  return (
    <div className="relative min-h-screen bg-white text-foreground">
      {/* Backdrop “light-friendly” */}
      <CinematicBackdrop variant="public" className="z-0 opacity-20" />
      <div className="pointer-events-none absolute inset-0 -z-0 bg-gradient-to-b from-white/85 via-white/90 to-white" />

      <header className="relative z-10 border-b border-blue-100 bg-white/85 backdrop-blur">
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

            {/* CTA */}
            <Link
              to={`/register?next=${nextParam}`}
              className="inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-[#B0231D]"
            >
              {ctaLabel}
            </Link>

            <Link
              to={`/login?next=${nextParam}`}
              className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-blue-900/70 transition hover:text-blue-900 md:inline-flex"
            >
              Connexion
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-blue-100 bg-white/80">
          <div className="mx-auto max-w-6xl overflow-x-auto px-4 py-2">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-blue-900/70">
              {navLinks.map((link) => {
                const active = isActivePath(location.pathname, link.to);
                const label = navLabel(link.key, link.fallback);
                return (
                  <Link
                    key={`${link.key}-m`}
                    to={link.to}
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-2 transition",
                      active
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

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
        <div className="mb-6">
          <TricolorBanner title={banner.title} question={banner.question} />
        </div>
        {children ?? <Outlet />}
      </main>

      <footer className="relative z-10 border-t border-blue-100 bg-white/85">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:px-10 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">MPL Export Navigator</div>
            <div className="text-sm text-muted-foreground">
              Outil d’aide à la décision export — par MPL Export Conseil (audit, conformité, veille personnalisée).
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link to="/methodologie" className="hover:text-foreground hover:underline">
                Méthodologie
              </Link>
              <Link to="/about" className="hover:text-foreground hover:underline">
                À propos
              </Link>
              <Link to="/guides" className="hover:text-foreground hover:underline">
                Guides
              </Link>
              <Link to="/veille" className="hover:text-foreground hover:underline">
                Veille
              </Link>
              <Link to="/contact" className="hover:text-foreground hover:underline">
                Contact
              </Link>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <a href={`tel:${phoneRaw}`} className="hover:text-foreground hover:underline">
                {phonePretty}
              </a>
              <a href={`mailto:${emailMain}`} className="hover:text-foreground hover:underline">
                {emailMain}
              </a>
            </div>

            <div className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} MPL Export Conseil — outil d’aide à la décision.
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground md:mt-2">
              {siteDisclaimers.map((text, index) => (
                <span key={`foot-disclaimer-${index}`} className="leading-snug">
                  {text}
                </span>
              ))}
            </div>
          </div>

          {/* RSS visible sur toutes les pages publiques */}
          <FooterRss />
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
          className="fixed bottom-6 right-6 z-[90] inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a]"
          aria-label="Ouvrir l'aide IA"
        >
          Aide IA
        </button>
      )}
    </div>
  );
}
