import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Globe2,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  BUSINESS_OPPORTUNITY_TYPES,
  type BusinessOpportunity,
  type BusinessOpportunitySource,
  type BusinessOpportunityType,
  createBusinessOpportunity,
  listBusinessOpportunities,
} from "@/services/businessBoard";

type BusinessFormState = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  title: string;
  summary: string;
  opportunityType: BusinessOpportunityType;
  sector: string;
  originCountry: string;
  targetCountry: string;
  website: string;
};

const DEFAULT_FORM: BusinessFormState = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  title: "",
  summary: "",
  opportunityType: "partner",
  sector: "",
  originCountry: "FR",
  targetCountry: "",
  website: "",
};

const TYPE_LABELS = {
  buyer: { fr: "Recherche achat", en: "Buyer request" },
  seller: { fr: "Offre de vente", en: "Seller offer" },
  distributor: { fr: "Distribution", en: "Distribution" },
  partner: { fr: "Partenariat", en: "Partnership" },
  investor: { fr: "Investissement", en: "Investment" },
  service: { fr: "Service", en: "Service" },
} as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

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
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const publishLink = `/register?next=${encodeURIComponent("/coin-business#publier")}`;
  const [items, setItems] = React.useState<BusinessOpportunity[]>([]);
  const [source, setSource] = React.useState<BusinessOpportunitySource>("demo");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState<BusinessFormState>(DEFAULT_FORM);

  usePageMeta("Le coin business | Export Navigator", "Publiez et consultez des propositions d'affaires export.", {
    brandSuffix: "Export Navigator",
    canonicalUrl: "https://www.exportfrancefacile.com/coin-business",
    socialImageUrl: "https://www.exportfrancefacile.com/images/og-home.jpg",
    socialImageAlt: "Le coin business Export Navigator",
  });

  const loadBoard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listBusinessOpportunities(18);
      setItems(result.items);
      setSource(result.source);
    } catch (err: any) {
      setError(err?.message || (isEn ? "Unable to load opportunities." : "Impossible de charger les opportunites."));
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  React.useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  React.useEffect(() => {
    setForm((prev) => ({
      ...prev,
      contactEmail: prev.contactEmail || user?.email || "",
      contactName:
        prev.contactName ||
        String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim(),
      companyName: prev.companyName || String(user?.user_metadata?.company_name || "").trim(),
    }));
  }, [user?.email, user?.user_metadata]);

  const stats = React.useMemo(() => getSummaryStats(items), [items]);

  const copy = React.useMemo(
    () =>
      isEn
        ? {
            heroEyebrow: "Business corner",
            heroTitle: "Turn visits into business leads and let every account publish an opportunity.",
            heroBody:
              "This public board showcases buyer requests, partnership offers and distribution signals. Publishing is reserved to free accounts to drive account creation without adding friction to browsing.",
            primaryCta: "Browse opportunities",
            secondaryCta: isAuthenticated ? "Publish my opportunity" : "Create free account",
            statsTotal: "Live opportunities",
            statsBuyers: "Buyer requests",
            statsPartners: "Partners / distributors",
            boardTitle: "Latest opportunities",
            boardBody: "Updated in reverse chronological order so visitors immediately see fresh business signals.",
            boardEmpty: "No opportunity published yet. Publish the first one to seed the board.",
            publishTitle: "Publish your opportunity",
            publishBody:
              "Free accounts can publish a business proposition visible on the public board: sourcing, buyer demand, distribution search or partnership.",
            publishLockedTitle: "Create a free account to publish",
            publishLockedBody:
              "Browsing stays public. Publishing is reserved to registered users so the board stays actionable and traceable.",
            lockedPrimary: "Create free account",
            lockedSecondary: "Already have an account? Sign in",
            demoBanner: "Demo mode active until the Supabase migration is applied. New publications are stored locally.",
            errorTitle: "Unable to load the board",
            tipsTitle: "What works best",
            tips: [
              "State clearly what you want: buy, sell, distribute, partner or source.",
              "Name one geography and one sector to improve relevance.",
              "Add a contact email that you actually monitor.",
            ],
            trustTitle: "Why this converts better",
            trustBody:
              "Visitors can browse freely, while publishing requires a free account. That creates a visible reason to register without blocking discovery.",
            formCompany: "Company *",
            formContact: "Contact name *",
            formEmail: "Contact email *",
            formType: "Opportunity type *",
            formTitle: "Title *",
            formSummary: "Business summary *",
            formSector: "Sector",
            formOrigin: "Origin country",
            formTarget: "Target country",
            formWebsite: "Website",
            formSubmit: "Publish opportunity",
            formSubmitting: "Publishing...",
            successTitle: "Opportunity published",
            successBodyServer: "Your opportunity is now visible on the board.",
            successBodyDemo: "Stored in local demo mode until the database migration is applied.",
            validation: {
              company: "Add a company name.",
              contact: "Add the contact name.",
              email: "Add a valid email.",
              title: "Write a title with at least 12 characters.",
              summary: "Write a summary with at least 40 characters.",
            },
            publishedOn: "Published on",
            target: "Target",
            origin: "Origin",
            contact: "Contact",
            details: "Board overview",
            retry: "Retry",
            openWorkspace: "Open my space",
          }
        : {
            heroEyebrow: "Le coin business",
            heroTitle: "Transformez les visites en pistes business et laissez chaque compte publier une opportunite.",
            heroBody:
              "Ce board public affiche des recherches d'acheteurs, des offres de partenariat et des signaux de distribution. La consultation reste libre, la publication est reservee aux comptes gratuits pour stimuler la creation de compte.",
            primaryCta: "Voir les opportunites",
            secondaryCta: isAuthenticated ? "Publier ma proposition" : "Creer un compte gratuit",
            statsTotal: "Opportunites visibles",
            statsBuyers: "Recherches d'acheteurs",
            statsPartners: "Partenaires / distributeurs",
            boardTitle: "Dernieres propositions",
            boardBody: "Affichage du plus recent au plus ancien pour donner des signaux business immediats aux visiteurs.",
            boardEmpty: "Aucune opportunite publiee pour le moment. Publiez la premiere pour lancer le board.",
            publishTitle: "Publier une proposition",
            publishBody:
              "Les comptes gratuits peuvent publier une proposition d'affaires visible sur le board public: sourcing, recherche d'acheteurs, distribution ou partenariat.",
            publishLockedTitle: "Creez un compte gratuit pour publier",
            publishLockedBody:
              "La consultation reste publique. La publication est reservee aux utilisateurs inscrits pour garder un board exploitable et tracable.",
            lockedPrimary: "Creer un compte gratuit",
            lockedSecondary: "J'ai deja un compte",
            demoBanner: "Mode demo actif tant que la migration Supabase n'est pas appliquee. Les nouvelles publications sont stockees localement.",
            errorTitle: "Impossible de charger le board",
            tipsTitle: "Ce qui fonctionne le mieux",
            tips: [
              "Dites clairement ce que vous cherchez: acheter, vendre, distribuer, sourcer ou nouer un partenariat.",
              "Precisez au moins une zone geographique et un secteur.",
              "Ajoutez un email suivi en continu pour accelerer les contacts.",
            ],
            trustTitle: "Pourquoi ca convertit mieux",
            trustBody:
              "Les visiteurs decouvrent librement les opportunites. Pour publier, ils ont une vraie raison de creer un compte gratuit sans etre bloques trop tot.",
            formCompany: "Entreprise *",
            formContact: "Nom du contact *",
            formEmail: "Email du contact *",
            formType: "Type de proposition *",
            formTitle: "Titre *",
            formSummary: "Resume business *",
            formSector: "Secteur",
            formOrigin: "Pays d'origine",
            formTarget: "Pays cible",
            formWebsite: "Site web",
            formSubmit: "Publier la proposition",
            formSubmitting: "Publication...",
            successTitle: "Proposition publiee",
            successBodyServer: "Votre proposition est maintenant visible sur le board.",
            successBodyDemo: "Enregistree en mode demo local tant que la migration base n'est pas appliquee.",
            validation: {
              company: "Ajoutez le nom de l'entreprise.",
              contact: "Ajoutez le nom du contact.",
              email: "Ajoutez un email valide.",
              title: "Redigez un titre d'au moins 12 caracteres.",
              summary: "Redigez un resume d'au moins 40 caracteres.",
            },
            publishedOn: "Publie le",
            target: "Cible",
            origin: "Origine",
            contact: "Contacter",
            details: "Vue du board",
            retry: "Recharger",
            openWorkspace: "Ouvrir mon espace",
          },
    [isAuthenticated, isEn]
  );

  const handleField =
    <K extends keyof BusinessFormState>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.companyName.trim()) {
      toast({ title: copy.errorTitle, description: copy.validation.company });
      return;
    }
    if (!form.contactName.trim()) {
      toast({ title: copy.errorTitle, description: copy.validation.contact });
      return;
    }
    if (!isValidEmail(form.contactEmail)) {
      toast({ title: copy.errorTitle, description: copy.validation.email });
      return;
    }
    if (form.title.trim().length < 12) {
      toast({ title: copy.errorTitle, description: copy.validation.title });
      return;
    }
    if (form.summary.trim().length < 40) {
      toast({ title: copy.errorTitle, description: copy.validation.summary });
      return;
    }

    try {
      setSubmitting(true);
      const result = await createBusinessOpportunity({
        company_name: form.companyName,
        contact_name: form.contactName,
        contact_email: form.contactEmail,
        title: form.title,
        summary: form.summary,
        opportunity_type: form.opportunityType,
        sector: form.sector,
        origin_country: form.originCountry,
        target_country: form.targetCountry,
        website: form.website,
      });

      toast({
        title: copy.successTitle,
        description: result.source === "server" ? copy.successBodyServer : copy.successBodyDemo,
      });

      setForm((prev) => ({
        ...DEFAULT_FORM,
        companyName: prev.companyName,
        contactName: prev.contactName,
        contactEmail: prev.contactEmail,
      }));

      await loadBoard();
    } catch (err: any) {
      toast({
        title: copy.errorTitle,
        description: err?.message || copy.errorTitle,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="space-y-8">
        <div className="overflow-hidden rounded-[32px] border border-[#d6c8b2] bg-[linear-gradient(140deg,rgba(255,247,237,0.96)_0%,rgba(255,255,255,0.98)_45%,rgba(236,245,255,0.96)_100%)] p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.85fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e6d7bf] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-700">
                <BriefcaseBusiness className="h-3.5 w-3.5 text-[#b45309]" />
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
                  {isAuthenticated ? (
                    <a href="#publier">{copy.secondaryCta}</a>
                  ) : (
                    <Link to={publishLink}>{copy.secondaryCta}</Link>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <Card className="border-[#e6d7bf] bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsTotal}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-[#e6d7bf] bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsBuyers}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.buyerCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-[#e6d7bf] bg-white/90 shadow-sm">
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
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">{copy.details}</p>
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
                    <Card key={`business-card-skeleton-${index}`} className="border-[#d6c8b2] bg-white/95 shadow-sm">
                      <CardContent className="space-y-4 p-6">
                        <div className="h-4 w-28 rounded-full bg-slate-200" />
                        <div className="h-7 w-4/5 rounded-full bg-slate-200" />
                        <div className="h-4 w-full rounded-full bg-slate-100" />
                        <div className="h-4 w-11/12 rounded-full bg-slate-100" />
                        <div className="h-10 rounded-2xl bg-slate-100" />
                      </CardContent>
                    </Card>
                  ))
                : items.map((item) => (
                    <Card key={item.id} className="border-[#d6c8b2] bg-white/95 shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-800">
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
              <Card className="border-dashed border-[#d6c8b2] bg-white/80 shadow-sm">
                <CardContent className="px-6 py-12 text-center text-sm text-slate-600">
                  <Sparkles className="mx-auto mb-3 h-5 w-5 text-slate-500" />
                  {copy.boardEmpty}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card id="publier" className="border-[#d6c8b2] bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-950">
                  {isAuthenticated ? copy.publishTitle : copy.publishLockedTitle}
                </CardTitle>
                <CardDescription className="text-slate-600">
                  {isAuthenticated ? copy.publishBody : copy.publishLockedBody}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isAuthenticated ? (
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formCompany}</label>
                        <Input
                          value={form.companyName}
                          onChange={handleField("companyName")}
                          placeholder={isEn ? "Company name" : "Nom de l'entreprise"}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formContact}</label>
                        <Input
                          value={form.contactName}
                          onChange={handleField("contactName")}
                          placeholder={isEn ? "Your name" : "Votre nom"}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formEmail}</label>
                        <Input
                          type="email"
                          value={form.contactEmail}
                          onChange={handleField("contactEmail")}
                          placeholder="vous@entreprise.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formType}</label>
                        <select
                          value={form.opportunityType}
                          onChange={handleField("opportunityType")}
                          className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {BUSINESS_OPPORTUNITY_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {TYPE_LABELS[type][isEn ? "en" : "fr"]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formTitle}</label>
                      <Input
                        value={form.title}
                        onChange={handleField("title")}
                        placeholder={
                          isEn
                            ? "Example: Looking for distributor in West Africa for packaged food"
                            : "Exemple: Recherche distributeur Afrique de l'Ouest pour produits agro"
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formSummary}</label>
                      <Textarea
                        value={form.summary}
                        onChange={handleField("summary")}
                        placeholder={
                          isEn
                            ? "Describe what you offer or seek, expected scope, timing and any useful qualification criteria."
                            : "Expliquez ce que vous proposez ou recherchez, le perimetre, le timing et les criteres utiles."
                        }
                        className="min-h-[132px]"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formSector}</label>
                        <Input value={form.sector} onChange={handleField("sector")} placeholder={isEn ? "Sector" : "Secteur"} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formWebsite}</label>
                        <Input value={form.website} onChange={handleField("website")} placeholder="https://..." />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formOrigin}</label>
                        <Input value={form.originCountry} onChange={handleField("originCountry")} placeholder="FR" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">{copy.formTarget}</label>
                        <Input value={form.targetCountry} onChange={handleField("targetCountry")} placeholder="AE" />
                      </div>
                    </div>

                    <Button type="submit" className="h-11 w-full rounded-full" disabled={submitting}>
                      {submitting ? copy.formSubmitting : copy.formSubmit}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                        <span>{copy.publishBody}</span>
                      </div>
                    </div>
                    <Button asChild className="h-11 w-full rounded-full">
                      <Link to={publishLink}>{copy.lockedPrimary}</Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 w-full rounded-full">
                      <Link to={`/login?next=${encodeURIComponent("/coin-business#publier")}`}>{copy.lockedSecondary}</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#d6c8b2] bg-white/95 shadow-sm">
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

            <Card className="border-[#d6c8b2] bg-[#0a1d3a] text-white shadow-sm">
              <CardHeader>
                <CardTitle>{copy.trustTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-100">
                <p>{copy.trustBody}</p>
                <Button asChild variant="secondary" className="rounded-full bg-white text-slate-950 hover:bg-slate-100">
                  <Link to={isAuthenticated ? "/app/control-tower" : publishLink}>
                    {isAuthenticated ? copy.openWorkspace : copy.lockedPrimary}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
