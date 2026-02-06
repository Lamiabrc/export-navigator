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

  const filteredGuides = guides.filter((guide) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      guide.title.toLowerCase().includes(q) ||
      guide.intro.toLowerCase().includes(q)
    );
  });

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
