import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Globe2,
  Handshake,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { type BusinessOpportunity, type BusinessOpportunitySource, listBusinessOpportunities } from "@/services/businessBoard";

const TYPE_LABELS = {
  buyer: { fr: "Recherche achat", en: "Buyer request" },
  seller: { fr: "Offre de vente", en: "Seller offer" },
  distributor: { fr: "Distribution", en: "Distribution" },
  partner: { fr: "Partenariat", en: "Partnership" },
  investor: { fr: "Investissement", en: "Investment" },
  service: { fr: "Service", en: "Service" },
} as const;

function formatDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getSummaryStats(items: BusinessOpportunity[]) {
  return {
    total: items.length,
    buyerCount: items.filter((item) => item.opportunity_type === "buyer").length,
    partnerCount: items.filter((item) => item.opportunity_type === "partner" || item.opportunity_type === "distributor").length,
  };
}

export default function BusinessCorner() {
  const { lang } = useI18n();
  const isEn = lang === "en";
  const { isAuthenticated } = useAuth();
  const [items, setItems] = React.useState<BusinessOpportunity[]>([]);
  const [source, setSource] = React.useState<BusinessOpportunitySource>("demo");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  usePageMeta("Business France-Maghreb | Export Navigator", "Annonces qualifiees et accompagnement import-export France-Maghreb.", {
    brandSuffix: "Export Navigator",
    canonicalUrl: "https://www.exportfrancefacile.com/coin-business",
    socialImageUrl: "https://www.exportfrancefacile.com/images/og-home.jpg",
    socialImageAlt: "Business France-Maghreb Export Navigator",
  });

  const loadBoard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listBusinessOpportunities(18);
      setItems(result.items);
      setSource(result.source);
    } catch (err: any) {
      setError(err?.message || (isEn ? "Unable to load announcements." : "Impossible de charger les annonces."));
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  React.useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const stats = React.useMemo(() => getSummaryStats(items), [items]);

  const copy = isEn
    ? {
        heroEyebrow: "France-Maghreb business",
        heroTitle: "Curated announcements plus practical import-export support.",
        heroBody:
          "MPL publishes selected buyer, supplier, distributor and service opportunities. Visitors can browse and request support; publishing and analysis stay private.",
        primaryCta: "View announcements",
        secondaryCta: "Request support",
        adminCta: "Open private workspace",
        statsTotal: "Announcements",
        statsBuyers: "Buyer requests",
        statsPartners: "Partners / distributors",
        boardTitle: "Qualified announcements",
        boardBody: "Selected opportunities for trade between France, Morocco, Algeria and Tunisia.",
        boardEmpty: "No announcement yet. MPL can qualify and publish the first France-Maghreb opportunity.",
        demoBanner: "Demo announcements are shown until the live business board is connected.",
        errorTitle: "Unable to load the board",
        retry: "Retry",
        publishedOn: "Published on",
        target: "Target",
        origin: "Origin",
        contact: "Contact",
        supportTitle: "Support offer",
        supportBody:
          "Send your project to frame the market, product, Incoterm, costs, documents and next action before committing.",
        trustTitle: "Private management",
        trustBody:
          "Only the MPL admin access can publish announcements and analyze opportunities. The public page stays simple and conversion-oriented.",
        tipsTitle: "What MPL can help with",
        tips: [
          "Qualify a buyer, supplier, distributor or service need.",
          "Estimate landed cost, margin, documents and logistics risk.",
          "Prepare the next contact or negotiation step.",
        ],
      }
    : {
        heroEyebrow: "Business France-Maghreb",
        heroTitle: "Des annonces qualifiees et un accompagnement import-export concret.",
        heroBody:
          "MPL publie les opportunites selectionnees: acheteurs, fournisseurs, distributeurs et prestataires. Les visiteurs consultent et demandent un accompagnement; la publication et l'analyse restent privees.",
        primaryCta: "Voir les annonces",
        secondaryCta: "Demander un accompagnement",
        adminCta: "Ouvrir l'espace prive",
        statsTotal: "Annonces",
        statsBuyers: "Recherches d'acheteurs",
        statsPartners: "Partenaires / distributeurs",
        boardTitle: "Annonces qualifiees",
        boardBody: "Opportunites selectionnees pour commercer entre France, Maroc, Algerie et Tunisie.",
        boardEmpty: "Aucune annonce pour le moment. MPL peut qualifier et publier la premiere opportunite France-Maghreb.",
        demoBanner: "Des annonces de demonstration sont affichees tant que le board business live n'est pas connecte.",
        errorTitle: "Impossible de charger le board",
        retry: "Recharger",
        publishedOn: "Publie le",
        target: "Cible",
        origin: "Origine",
        contact: "Contacter",
        supportTitle: "Offre d'accompagnement",
        supportBody:
          "Envoyez votre projet pour cadrer marche, produit, Incoterm, couts, documents et prochaine action avant de vous engager.",
        trustTitle: "Gestion privee",
        trustBody:
          "Seul l'acces administrateur MPL peut publier des annonces et analyser les opportunites. La page publique reste simple et orientee demande d'accompagnement.",
        tipsTitle: "Ce que MPL peut cadrer",
        tips: [
          "Qualifier un besoin acheteur, fournisseur, distributeur ou prestataire.",
          "Estimer cout rendu, marge, documents et risques logistiques.",
          "Preparer la prochaine prise de contact ou negociation.",
        ],
      };

  return (
    <PublicLayout>
      <section className="space-y-8">
        <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-[linear-gradient(140deg,rgba(240,253,244,0.96)_0%,rgba(255,255,255,0.98)_48%,rgba(239,246,255,0.96)_100%)] p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.85fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800">
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                {copy.heroEyebrow}
              </div>
              <div className="space-y-3">
                <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {copy.heroTitle}
                </h1>
                <p className="max-w-3xl text-sm text-slate-700 sm:text-base">{copy.heroBody}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-11 rounded-full px-5">
                  <a href="#board">
                    {copy.primaryCta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-full border-slate-300 bg-white px-5">
                  <Link to="/contact">{copy.secondaryCta}</Link>
                </Button>
                {isAuthenticated ? (
                  <Button asChild variant="secondary" className="h-11 rounded-full px-5">
                    <Link to="/app/mise-en-relation">{copy.adminCta}</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <Card className="border-emerald-100 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsTotal}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsBuyers}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.buyerCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-emerald-100 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsPartners}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.partnerCount}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </div>

          {source === "demo" ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {copy.demoBanner}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div id="board" className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Board</p>
              <h2 className="text-2xl font-semibold text-slate-950">{copy.boardTitle}</h2>
              <p className="text-sm text-slate-600">{copy.boardBody}</p>
            </div>

            {error ? (
              <Card className="border-red-200 bg-red-50 text-red-900">
                <CardHeader>
                  <CardTitle>{copy.errorTitle}</CardTitle>
                  <CardDescription className="text-red-800">{error}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="rounded-full" onClick={() => void loadBoard()}>
                    {copy.retry}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4">
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card key={`business-card-skeleton-${index}`} className="border-slate-200 bg-white/95 shadow-sm">
                      <CardContent className="space-y-4 p-6">
                        <div className="h-4 w-28 rounded-full bg-slate-200" />
                        <div className="h-7 w-4/5 rounded-full bg-slate-200" />
                        <div className="h-4 w-full rounded-full bg-slate-100" />
                        <div className="h-4 w-11/12 rounded-full bg-slate-100" />
                      </CardContent>
                    </Card>
                  ))
                : items.map((item) => (
                    <Card key={item.id} className="border-slate-200 bg-white/95 shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
                                {TYPE_LABELS[item.opportunity_type][isEn ? "en" : "fr"]}
                              </Badge>
                              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                                {copy.publishedOn} {formatDate(item.created_at, isEn ? "en-US" : "fr-FR")}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                              <p className="text-sm text-slate-600">{item.summary}</p>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {item.company_name}
                              </span>
                              {item.origin_country ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                                  <Globe2 className="h-3.5 w-3.5" />
                                  {copy.origin} {item.origin_country}
                                </span>
                              ) : null}
                              {item.target_country ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                                  <Globe2 className="h-3.5 w-3.5" />
                                  {copy.target} {item.target_country}
                                </span>
                              ) : null}
                              {item.sector ? <span className="rounded-full bg-slate-100 px-3 py-1">{item.sector}</span> : null}
                            </div>
                          </div>

                          <div className="flex min-w-[220px] flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-semibold text-slate-900">{item.contact_name}</div>
                            <a
                              href={`mailto:${item.contact_email}`}
                              className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-950 hover:underline"
                            >
                              <Mail className="h-4 w-4" />
                              {item.contact_email}
                            </a>
                            {item.website ? (
                              <a
                                href={item.website}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-950 hover:underline"
                              >
                                <Globe2 className="h-4 w-4" />
                                {item.website.replace(/^https?:\/\//i, "")}
                              </a>
                            ) : null}
                            <Button asChild size="sm" className="mt-2 rounded-full">
                              <a href={`mailto:${item.contact_email}`}>{copy.contact}</a>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
            </div>

            {!loading && !error && items.length === 0 ? (
              <Card className="border-dashed border-slate-300 bg-white/80 shadow-sm">
                <CardContent className="px-6 py-12 text-center text-sm text-slate-600">
                  <Sparkles className="mx-auto mb-3 h-5 w-5 text-slate-500" />
                  {copy.boardEmpty}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="border-emerald-100 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-950">{copy.supportTitle}</CardTitle>
                <CardDescription className="text-slate-600">{copy.supportBody}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button asChild className="h-11 w-full rounded-full">
                  <Link to="/contact">
                    <Handshake className="mr-2 h-4 w-4" />
                    {copy.secondaryCta}
                  </Link>
                </Button>
                {isAuthenticated ? (
                  <Button asChild variant="outline" className="h-11 w-full rounded-full">
                    <Link to="/app/mise-en-relation">{copy.adminCta}</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-emerald-100 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-950">{copy.tipsTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {copy.tips.map((tip) => (
                  <div key={tip} className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-700" />
                    <span>{tip}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-emerald-900 bg-[#0a1d3a] text-white shadow-sm">
              <CardHeader>
                <CardTitle>{copy.trustTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-100">
                <p>{copy.trustBody}</p>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-200" />
                  <span>{isEn ? "No public profile creation is required." : "Aucune creation de profil public n'est demandee."}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
