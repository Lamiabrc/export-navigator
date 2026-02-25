import { Link, useParams } from "react-router-dom";
import { ArrowRight, AlertTriangle, BookOpen, Search } from "lucide-react";
import { useState } from "react";

import { PremiumMarketingLayout } from "@/components/marketing/PremiumMarketingLayout";
import { SectionPremium } from "@/components/marketing/SectionPremium";
import { CTAStripPremium } from "@/components/marketing/CTAStripPremium";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/contexts/LanguageContext";
import { getFeaturedGuides, getGuideBySlug, GUIDES as guides } from "@/data/guides";
import { cn } from "@/lib/utils";
import { countryFunnel, exportAnswer, hsFunnel } from "@/services/supabaseAI";
import type { CountrySuggestion, ExportAnswerResult, HsSuggestion } from "@/types/supabaseAI";

export default function Guide() {
  const params = useParams();
  const slug = params.slug || "";
  const { lang } = useI18n();
  const isFr = lang === "fr";

  // If we have a slug, show the guide detail
  if (slug) {
    return <GuideDetail slug={slug} />;
  }

  // Otherwise show the guide listing
  return <GuideListing />;
}

function GuideListing() {
  const { lang } = useI18n();
  const isFr = lang === "fr";
  const [search, setSearch] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [guideCountry, setGuideCountry] = useState<CountrySuggestion | null>(null);
  const [guideHs, setGuideHs] = useState<HsSuggestion | null>(null);
  const [guideAnswer, setGuideAnswer] = useState<ExportAnswerResult | null>(null);

  const filteredGuides = guides.filter((guide) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      guide.title.toLowerCase().includes(q) ||
      guide.intro.toLowerCase().includes(q)
    );
  });

  const runTargetedGuide = async () => {
    if (!countryQuery.trim() || !productQuery.trim()) return;
    setLoadingGuide(true);
    setGuideError(null);
    try {
      const [countryRes, hsRes] = await Promise.all([countryFunnel(countryQuery, lang, false), hsFunnel(productQuery, lang)]);
      const country = countryRes.suggestions[0] || null;
      const hs = hsRes.suggestions[0] || null;

      if (!country || !hs) {
        setGuideError(isFr ? "Pays ou produit non detecte. Precisez votre saisie." : "Country or product not detected. Please refine.");
        setGuideAnswer(null);
        return;
      }

      const answer = await exportAnswer(country.iso2, hs.hs_code, lang);
      setGuideCountry(country);
      setGuideHs(hs);
      setGuideAnswer(answer);
    } catch (err: any) {
      setGuideError(String(err?.message || (isFr ? "Guide indisponible." : "Guide unavailable.")));
      setGuideAnswer(null);
    } finally {
      setLoadingGuide(false);
    }
  };

  return (
    <PremiumMarketingLayout>
      {/* Hero */}
      <section className="mkt-section-dark mkt-section-hero">
        <div className="mkt-container">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {isFr ? "Ressources" : "Resources"}
            </p>
            <h1 className="mkt-display mkt-display-xl mt-4 text-white">
              {isFr ? "Guides pratiques export" : "Practical export guides"}
            </h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {isFr
                ? "Incoterms, DDP, documents, conformité : tout ce qu'il faut savoir pour exporter sereinement."
                : "Incoterms, DDP, documents, compliance: everything you need to know to export with confidence."}
            </p>
          </div>
        </div>
      </section>

      {/* Search & List */}
      <SectionPremium
        eyebrow={isFr ? "Tous les guides" : "All guides"}
        title={isFr ? "Explorez nos ressources" : "Explore our resources"}
      >
        <div className="mb-8 rounded-3xl border border-[hsl(var(--mkt-primary)/0.2)] bg-[hsl(var(--mkt-primary)/0.05)] p-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-[hsl(var(--mkt-primary))]">
            {isFr ? "Guide export cible" : "Targeted export guide"}
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))]">
            {isFr
              ? "Saisissez un pays et un produit. Le guide vous donne points de vigilance, regles et recommandations."
              : "Enter a country and a product. The guide returns watch points, rules and recommendations."}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input
              type="text"
              placeholder={isFr ? "Pays destination (ex: Chili)" : "Destination country (e.g. Chile)"}
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
            />
            <Input
              type="text"
              placeholder={isFr ? "Produit / HS (ex: fraises)" : "Product / HS (e.g. strawberries)"}
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void runTargetedGuide()}
              disabled={loadingGuide}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium text-white",
                "bg-[hsl(var(--mkt-primary))] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {loadingGuide ? (isFr ? "Analyse..." : "Analyzing...") : isFr ? "Generer" : "Generate"}
            </button>
          </div>

          {guideError ? <p className="mt-3 text-sm text-rose-700">{guideError}</p> : null}

          {guideAnswer ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/60 bg-white p-4">
                <p className="text-xs font-semibold tracking-[0.2em] text-[hsl(var(--mkt-primary))]">
                  {isFr ? "Cadrage" : "Scope"}
                </p>
                <p className="mt-2 text-sm text-[hsl(var(--mkt-ink))]">
                  {isFr ? "Destination" : "Destination"}: {guideCountry?.label} ({guideCountry?.iso2})
                </p>
                <p className="text-sm text-[hsl(var(--mkt-ink))]">
                  HS: {guideHs?.hs_code} - {guideHs?.label}
                </p>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white p-4">
                <p className="text-xs font-semibold tracking-[0.2em] text-[hsl(var(--mkt-primary))]">
                  {isFr ? "Points de vigilance" : "Watch points"}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[hsl(var(--mkt-ink))]">
                  {Array.isArray(guideAnswer.product_rules) && guideAnswer.product_rules.length ? (
                    guideAnswer.product_rules.slice(0, 4).map((rule, idx) => (
                      <li key={String(rule.id || idx)}>{String(rule.summary || rule.title || rule.name || "Rule")}</li>
                    ))
                  ) : (
                    <li>
                      {isFr
                        ? "Completer incoterm, paiement et transport dans l'assistant pour un dossier complet."
                        : "Complete incoterm, payment and transport in the assistant for a full brief."}
                    </li>
                  )}
                </ul>

                {Array.isArray(guideAnswer.update_sources) && guideAnswer.update_sources.length ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold tracking-[0.2em] text-[hsl(var(--mkt-primary))]">
                      {isFr ? "Sources et traites a verifier" : "Sources and treaties to verify"}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[hsl(var(--mkt-ink-muted))]">
                      {guideAnswer.update_sources.slice(0, 4).map((src, idx) => (
                        <li key={`${src.url || src.label || idx}`}>
                          {src.url ? (
                            <a href={src.url} target="_blank" rel="noreferrer" className="underline">
                              {src.label || src.source_key || src.url}
                            </a>
                          ) : (
                            src.label || src.source_key || "Source"
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Search */}
        <div className="mb-8 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--mkt-ink-muted))]" />
            <Input
              type="text"
              placeholder={isFr ? "Rechercher un guide..." : "Search guides..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Grid */}
        {filteredGuides.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-[hsl(var(--mkt-ink-muted))]" />
            <p className="mt-4 text-[hsl(var(--mkt-ink-muted))]">
              {isFr ? "Aucun guide trouvé." : "No guides found."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredGuides.map((guide) => (
              <Link
                key={guide.slug}
                to={`/guides/${guide.slug}`}
                className="mkt-card group flex flex-col p-6"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--mkt-primary)/0.1)] text-[hsl(var(--mkt-primary))] transition group-hover:bg-[hsl(var(--mkt-primary))] group-hover:text-white">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-[hsl(var(--mkt-ink))] group-hover:text-[hsl(var(--mkt-primary))] transition">
                  {guide.title}
                </h3>

                <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))] flex-1">
                  {guide.intro}
                </p>

                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[hsl(var(--mkt-primary))]">
                  {isFr ? "Lire le guide" : "Read guide"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionPremium>

      {/* CTA */}
      <CTAStripPremium
        eyebrow={isFr ? "Besoin d'aide ?" : "Need help?"}
        title={isFr ? "Demandez un diagnostic export" : "Request an export diagnostic"}
        primaryCta={{
          label: isFr ? "Nous contacter" : "Contact us",
          to: "/contact?offer=diagnostic",
        }}
        secondaryCta={{
          label: isFr ? "Lancer une analyse" : "Start analysis",
          to: "/analyse",
        }}
      />
    </PremiumMarketingLayout>
  );
}

function GuideDetail({ slug }: { slug: string }) {
  const { lang } = useI18n();
  const isFr = lang === "fr";

  const content = getGuideBySlug(slug);
  const suggestions = getFeaturedGuides(3, slug);

  if (!content) {
    return (
      <PremiumMarketingLayout>
        <SectionPremium
          eyebrow={isFr ? "Erreur" : "Error"}
          title={isFr ? "Guide introuvable" : "Guide not found"}
        >
          <p className="text-[hsl(var(--mkt-ink-muted))]">
            {isFr
              ? "Le guide demandé n'existe pas ou a été déplacé."
              : "The requested guide doesn't exist or has been moved."}
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link to="/analyse" className="mkt-btn mkt-btn-primary">
              {isFr ? "Lancer l'analyse" : "Start analysis"}
            </Link>
            <Link to="/guides" className="mkt-btn mkt-btn-outline">
              {isFr ? "Voir les guides" : "View guides"}
            </Link>
          </div>
        </SectionPremium>
      </PremiumMarketingLayout>
    );
  }

  const mistakes = Array.isArray(content.mistakes) ? content.mistakes : [];
  const ctaUrl = content.incoterm
    ? `/analyse?incoterm=${encodeURIComponent(content.incoterm)}`
    : "/analyse";

  return (
    <PremiumMarketingLayout>
      {/* Hero */}
      <section className="mkt-section-dark mkt-section-hero">
        <div className="mkt-container">
          <div className="mx-auto max-w-3xl">
            <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              {isFr ? "Guide pratique" : "Practical guide"}
            </p>
            <h1 className="mkt-display mkt-display-lg mt-4 text-white">
              {content.title}
            </h1>
            <p className="mt-6 text-lg" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
              {content.intro}
            </p>
          </div>
        </div>
      </section>

      {/* Mistakes */}
      {mistakes.length > 0 && (
        <SectionPremium
          eyebrow={isFr ? "Points de vigilance" : "Watch points"}
          title={isFr ? "Erreurs fréquentes" : "Common mistakes"}
        >
          <div className="space-y-4">
            {mistakes.map((mistake, i) => (
              <div
                key={i}
                className="mkt-card flex items-start gap-4 p-5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-[hsl(var(--mkt-ink))]">{mistake}</p>
              </div>
            ))}
          </div>
        </SectionPremium>
      )}

      {/* CTA */}
      <section className="mkt-section mkt-section-muted">
        <div className="mkt-container">
          <div className="mkt-section-dark rounded-3xl p-8 md:p-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="mkt-eyebrow" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                  {isFr ? "Passez à l'action" : "Take action"}
                </p>
                <h2 className="mkt-display mkt-display-sm mt-2 text-white">
                  {content.ctaLabel}
                </h2>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link to={ctaUrl} className="mkt-btn mkt-btn-primary">
                  {isFr ? "Lancer l'analyse" : "Start analysis"}
                </Link>
                <Link to="/contact" className="mkt-btn mkt-btn-light">
                  {isFr ? "Demander une revue" : "Request a review"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <SectionPremium
          eyebrow={isFr ? "À découvrir" : "Discover more"}
          title={isFr ? "Autres guides" : "Other guides"}
        >
          <div className="grid gap-6 md:grid-cols-3">
            {suggestions.map((suggestion) => (
              <Link
                key={suggestion.slug}
                to={`/guides/${suggestion.slug}`}
                className="mkt-card group flex flex-col p-6"
              >
                <h3 className="text-lg font-semibold text-[hsl(var(--mkt-ink))] group-hover:text-[hsl(var(--mkt-primary))] transition">
                  {suggestion.title}
                </h3>
                <p className="mt-2 text-sm text-[hsl(var(--mkt-ink-muted))] flex-1">
                  {suggestion.intro}
                </p>
                <p className="mt-4 text-sm font-medium text-[hsl(var(--mkt-primary))]">
                  {suggestion.ctaLabel}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link to="/guides" className="mkt-btn mkt-btn-outline">
              {isFr ? "Voir tous les guides" : "View all guides"}
            </Link>
          </div>
        </SectionPremium>
      )}
    </PremiumMarketingLayout>
  );
}
