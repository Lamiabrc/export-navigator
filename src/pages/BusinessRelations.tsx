import * as React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Globe2,
  Handshake,
  Mail,
  PhoneCall,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
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

type IntroFormState = {
  firstName: string;
  email: string;
  company: string;
  message: string;
};

const DEFAULT_BUSINESS_FORM: BusinessFormState = {
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

const DEFAULT_INTRO_FORM: IntroFormState = {
  firstName: "",
  email: "",
  company: "",
  message: "",
};

const TYPE_LABELS = {
  buyer: { fr: "Recherche achat", en: "Buyer request" },
  seller: { fr: "Offre de vente", en: "Seller offer" },
  distributor: { fr: "Distribution", en: "Distribution" },
  partner: { fr: "Partenariat", en: "Partnership" },
  investor: { fr: "Investissement", en: "Investment" },
  service: { fr: "Service", en: "Service" },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RAW = "0676435551";
const PHONE_PRETTY = "06 76 43 55 51";
const CONTACT_EMAIL = "contact@exportfrancefacile.com";

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

export default function BusinessRelations() {
  const { lang } = useI18n();
  const isEn = lang === "en";
  const locale = isEn ? "en-US" : "fr-FR";
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = React.useState<BusinessOpportunity[]>([]);
  const [source, setSource] = React.useState<BusinessOpportunitySource>("demo");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [businessSubmitting, setBusinessSubmitting] = React.useState(false);
  const [introSubmitting, setIntroSubmitting] = React.useState(false);
  const [businessForm, setBusinessForm] = React.useState<BusinessFormState>(DEFAULT_BUSINESS_FORM);
  const [introForm, setIntroForm] = React.useState<IntroFormState>(DEFAULT_INTRO_FORM);

  const copy = React.useMemo(
    () =>
      isEn
        ? {
            heroTitle: "Business relationships, contact requests and introductions in one place.",
            heroBody:
              "Use this space from the control tower to publish a business opportunity, browse active requests and ask MPL for a direct introduction.",
            statsTotal: "Visible opportunities",
            statsBuyers: "Buyer requests",
            statsPartners: "Partners / distributors",
            boardTitle: "Live opportunities",
            boardBody: "Fresh requests and offers visible from your workspace.",
            publishTitle: "Publish a business opportunity",
            publishBody: "Post a buyer request, partnership search, sourcing need or distribution offer.",
            introTitle: "Request a business introduction",
            introBody:
              "Send MPL a quick brief when you want a contact, a callback or a targeted business introduction.",
            demoBanner: "Demo mode active until the database migration is applied. New opportunities are stored locally.",
            quickPublish: "Publish now",
            quickContact: "Request introduction",
            quickOpen: "Open public board",
            formCompany: "Company *",
            formContact: "Contact *",
            formEmail: "Email *",
            formType: "Type *",
            formTitle: "Title *",
            formSummary: "Business summary *",
            formSector: "Sector",
            formOrigin: "Origin country",
            formTarget: "Target country",
            formWebsite: "Website",
            formPublishIdle: "Publish opportunity",
            formPublishLoading: "Publishing...",
            introName: "Your name *",
            introMessage: "What kind of introduction or contact do you need? *",
            introIdle: "Send request",
            introLoading: "Sending...",
            successBusinessServer: "Your opportunity is now visible on the board.",
            successBusinessDemo: "Stored in local demo mode until the database migration is applied.",
            successIntro: "Your contact request has been sent to MPL.",
            errorLoad: "Unable to load business opportunities.",
            validation: {
              company: "Add a company name.",
              contact: "Add the contact name.",
              email: "Add a valid email.",
              title: "Write a title with at least 12 characters.",
              summary: "Write a summary with at least 40 characters.",
              introMessage: "Describe the contact or introduction you need.",
              introName: "Add your name.",
            },
            publishedOn: "Published on",
            target: "Target",
            origin: "Origin",
            contact: "Contact",
            empty: "No visible opportunity yet. Publish the first one from this workspace.",
            tipsTitle: "Recommended uses",
            tips: [
              "Publish offers and requests with a clear business objective.",
              "Use the contact request form when you need MPL to introduce or qualify a lead.",
              "Keep one monitored email and one target geography in every request.",
            ],
            directTitle: "Direct contact",
            retry: "Retry",
          }
        : {
            heroTitle: "Mise en relation, demandes business et contact dans un seul espace.",
            heroBody:
              "Depuis la tour de controle, publiez une opportunite, consultez les demandes actives et demandez a MPL une mise en relation ciblee.",
            statsTotal: "Opportunites visibles",
            statsBuyers: "Recherches d'acheteurs",
            statsPartners: "Partenaires / distributeurs",
            boardTitle: "Opportunites live",
            boardBody: "Les demandes et offres les plus recentes visibles directement depuis votre espace.",
            publishTitle: "Publier une opportunite business",
            publishBody: "Diffusez un besoin acheteur, une recherche de partenaire, du sourcing ou une offre de distribution.",
            introTitle: "Demander une mise en relation",
            introBody:
              "Envoyez un brief court a MPL si vous avez besoin d'un contact, d'un rappel ou d'une mise en relation business ciblee.",
            demoBanner: "Mode demo actif tant que la migration base n'est pas appliquee. Les nouvelles opportunites sont stockees localement.",
            quickPublish: "Publier maintenant",
            quickContact: "Demander une mise en relation",
            quickOpen: "Ouvrir le board public",
            formCompany: "Entreprise *",
            formContact: "Contact *",
            formEmail: "Email *",
            formType: "Type *",
            formTitle: "Titre *",
            formSummary: "Resume business *",
            formSector: "Secteur",
            formOrigin: "Pays d'origine",
            formTarget: "Pays cible",
            formWebsite: "Site web",
            formPublishIdle: "Publier l'opportunite",
            formPublishLoading: "Publication...",
            introName: "Votre nom *",
            introMessage: "Quel contact ou quelle mise en relation cherchez-vous ? *",
            introIdle: "Envoyer la demande",
            introLoading: "Envoi...",
            successBusinessServer: "Votre opportunite est maintenant visible sur le board.",
            successBusinessDemo: "Enregistree en mode demo local tant que la migration base n'est pas appliquee.",
            successIntro: "Votre demande de contact a bien ete transmise a MPL.",
            errorLoad: "Impossible de charger les opportunites business.",
            validation: {
              company: "Ajoutez le nom de l'entreprise.",
              contact: "Ajoutez le nom du contact.",
              email: "Ajoutez un email valide.",
              title: "Redigez un titre d'au moins 12 caracteres.",
              summary: "Redigez un resume d'au moins 40 caracteres.",
              introMessage: "Precisez le contact ou la mise en relation voulue.",
              introName: "Ajoutez votre nom.",
            },
            publishedOn: "Publie le",
            target: "Cible",
            origin: "Origine",
            contact: "Contacter",
            empty: "Aucune opportunite visible pour le moment. Publiez la premiere depuis cet espace.",
            tipsTitle: "Usages recommandes",
            tips: [
              "Publiez des demandes et offres avec un objectif commercial clair.",
              "Utilisez la demande de contact quand vous voulez que MPL qualifie ou introduise un lead.",
              "Gardez un email suivi et une cible geographique dans chaque demande.",
            ],
            directTitle: "Contact direct",
            retry: "Recharger",
          },
    [isEn]
  );

  const loadBoard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listBusinessOpportunities(12);
      setItems(result.items);
      setSource(result.source);
    } catch (err: any) {
      setError(err?.message || copy.errorLoad);
    } finally {
      setLoading(false);
    }
  }, [copy.errorLoad]);

  React.useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  React.useEffect(() => {
    const email = user?.email || "";
    const displayName = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim();
    const companyName = String(user?.user_metadata?.company_name || "").trim();

    setBusinessForm((prev) => ({
      ...prev,
      contactEmail: prev.contactEmail || email,
      contactName: prev.contactName || displayName,
      companyName: prev.companyName || companyName,
    }));
    setIntroForm((prev) => ({
      ...prev,
      email: prev.email || email,
      firstName: prev.firstName || displayName,
      company: prev.company || companyName,
    }));
  }, [user?.email, user?.user_metadata]);

  const stats = React.useMemo(() => getSummaryStats(items), [items]);

  const handleBusinessField =
    <K extends keyof BusinessFormState>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setBusinessForm((prev) => ({ ...prev, [key]: value }));
    };

  const handleIntroField =
    <K extends keyof IntroFormState>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setIntroForm((prev) => ({ ...prev, [key]: value }));
    };

  const submitBusiness = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!businessForm.companyName.trim()) {
      toast({ title: copy.publishTitle, description: copy.validation.company });
      return;
    }
    if (!businessForm.contactName.trim()) {
      toast({ title: copy.publishTitle, description: copy.validation.contact });
      return;
    }
    if (!EMAIL_RE.test(businessForm.contactEmail.trim())) {
      toast({ title: copy.publishTitle, description: copy.validation.email });
      return;
    }
    if (businessForm.title.trim().length < 12) {
      toast({ title: copy.publishTitle, description: copy.validation.title });
      return;
    }
    if (businessForm.summary.trim().length < 40) {
      toast({ title: copy.publishTitle, description: copy.validation.summary });
      return;
    }

    try {
      setBusinessSubmitting(true);
      const result = await createBusinessOpportunity({
        company_name: businessForm.companyName,
        contact_name: businessForm.contactName,
        contact_email: businessForm.contactEmail,
        title: businessForm.title,
        summary: businessForm.summary,
        opportunity_type: businessForm.opportunityType,
        sector: businessForm.sector,
        origin_country: businessForm.originCountry,
        target_country: businessForm.targetCountry,
        website: businessForm.website,
      });

      toast({
        title: copy.publishTitle,
        description: result.source === "server" ? copy.successBusinessServer : copy.successBusinessDemo,
      });

      setBusinessForm((prev) => ({
        ...DEFAULT_BUSINESS_FORM,
        companyName: prev.companyName,
        contactName: prev.contactName,
        contactEmail: prev.contactEmail,
      }));

      await loadBoard();
    } catch (err: any) {
      toast({
        title: copy.publishTitle,
        description: err?.message || copy.errorLoad,
        variant: "destructive",
      });
    } finally {
      setBusinessSubmitting(false);
    }
  };

  const submitIntro = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!introForm.firstName.trim()) {
      toast({ title: copy.introTitle, description: copy.validation.introName });
      return;
    }
    if (!EMAIL_RE.test(introForm.email.trim())) {
      toast({ title: copy.introTitle, description: copy.validation.email });
      return;
    }
    if (introForm.message.trim().length < 20) {
      toast({ title: copy.introTitle, description: copy.validation.introMessage });
      return;
    }

    try {
      setIntroSubmitting(true);
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: introForm.firstName.trim(),
          email: introForm.email.trim(),
          company: introForm.company.trim(),
          subject: "Autre",
          topic: "Mise en relation business",
          offerType: "export",
          scenarioSummary: "Demande depuis espace mise en relation de l'app",
          source: "app-business-relations",
          locale,
          message: introForm.message.trim(),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "Envoi impossible");
      }

      toast({
        title: copy.introTitle,
        description: copy.successIntro,
      });

      setIntroForm((prev) => ({
        ...DEFAULT_INTRO_FORM,
        firstName: prev.firstName,
        email: prev.email,
        company: prev.company,
      }));
    } catch (err: any) {
      toast({
        title: copy.introTitle,
        description: err?.message || copy.errorLoad,
        variant: "destructive",
      });
    } finally {
      setIntroSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_40%,#eef6ff_100%)] p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-700">
                <Handshake className="h-3.5 w-3.5 text-[#0f766e]" />
                {isEn ? "Business relations" : "Mise en relation business"}
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{copy.heroTitle}</h1>
                <p className="max-w-3xl text-sm text-slate-700 sm:text-base">{copy.heroBody}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Button asChild className="h-11 rounded-full">
                  <a href="#publier">
                    {copy.quickPublish}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-full bg-white">
                  <a href="#contact-business">{copy.quickContact}</a>
                </Button>
                <Button asChild variant="outline" className="h-11 rounded-full bg-white">
                  <Link to="/coin-business">
                    {copy.quickOpen}
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <Card className="border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsTotal}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsBuyers}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.buyerCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="border-slate-200 bg-white/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardDescription>{copy.statsPartners}</CardDescription>
                  <CardTitle className="text-3xl text-slate-950">{stats.partnerCount}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          </div>

          {source === "demo" ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {copy.demoBanner}
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.92fr]">
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{copy.boardTitle}</CardTitle>
                <CardDescription>{copy.boardBody}</CardDescription>
              </CardHeader>
            </Card>

            {error ? (
              <Card className="border-red-200 bg-red-50 text-red-900">
                <CardContent className="flex items-center justify-between gap-4 p-6">
                  <div>{error}</div>
                  <Button variant="outline" onClick={() => void loadBoard()}>
                    {copy.retry}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4">
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card key={`business-relation-skeleton-${index}`} className="border-slate-200 bg-white/95 shadow-sm">
                      <CardContent className="space-y-4 p-6">
                        <div className="h-4 w-24 rounded-full bg-slate-200" />
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
                              <Badge variant="secondary" className="bg-slate-100 text-slate-800">
                                {TYPE_LABELS[item.opportunity_type][isEn ? "en" : "fr"]}
                              </Badge>
                              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                                {copy.publishedOn} {formatDate(item.created_at, locale)}
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
                  {copy.empty}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card id="publier" className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{copy.publishTitle}</CardTitle>
                <CardDescription>{copy.publishBody}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitBusiness}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formCompany}</label>
                      <Input value={businessForm.companyName} onChange={handleBusinessField("companyName")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formContact}</label>
                      <Input value={businessForm.contactName} onChange={handleBusinessField("contactName")} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formEmail}</label>
                      <Input type="email" value={businessForm.contactEmail} onChange={handleBusinessField("contactEmail")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formType}</label>
                      <select
                        value={businessForm.opportunityType}
                        onChange={handleBusinessField("opportunityType")}
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
                    <Input value={businessForm.title} onChange={handleBusinessField("title")} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{copy.formSummary}</label>
                    <Textarea value={businessForm.summary} onChange={handleBusinessField("summary")} className="min-h-[128px]" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formSector}</label>
                      <Input value={businessForm.sector} onChange={handleBusinessField("sector")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formWebsite}</label>
                      <Input value={businessForm.website} onChange={handleBusinessField("website")} placeholder="https://..." />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formOrigin}</label>
                      <Input value={businessForm.originCountry} onChange={handleBusinessField("originCountry")} placeholder="FR" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formTarget}</label>
                      <Input value={businessForm.targetCountry} onChange={handleBusinessField("targetCountry")} placeholder="AE" />
                    </div>
                  </div>

                  <Button type="submit" className="h-11 w-full rounded-full" disabled={businessSubmitting}>
                    <BriefcaseBusiness className="mr-2 h-4 w-4" />
                    {businessSubmitting ? copy.formPublishLoading : copy.formPublishIdle}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card id="contact-business" className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{copy.introTitle}</CardTitle>
                <CardDescription>{copy.introBody}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="space-y-4" onSubmit={submitIntro}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.introName}</label>
                      <Input value={introForm.firstName} onChange={handleIntroField("firstName")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">{copy.formEmail}</label>
                      <Input type="email" value={introForm.email} onChange={handleIntroField("email")} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{copy.formCompany}</label>
                    <Input value={introForm.company} onChange={handleIntroField("company")} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{copy.introMessage}</label>
                    <Textarea value={introForm.message} onChange={handleIntroField("message")} className="min-h-[116px]" />
                  </div>

                  <Button type="submit" variant="outline" className="h-11 w-full rounded-full" disabled={introSubmitting}>
                    <Send className="mr-2 h-4 w-4" />
                    {introSubmitting ? copy.introLoading : copy.introIdle}
                  </Button>
                </form>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    {copy.directTitle}
                  </div>
                  <div className="grid gap-2">
                    <a
                      href={`tel:${PHONE_RAW}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <PhoneCall className="h-4 w-4" />
                      {PHONE_PRETTY}
                    </a>
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Mise en relation business")}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4" />
                      {CONTACT_EMAIL}
                    </a>
                    <Link
                      to="/contact?offer=diagnostic"
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Users className="h-4 w-4" />
                      {copy.quickContact}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-[#0a1d3a] text-white shadow-sm">
              <CardHeader>
                <CardTitle>{copy.tipsTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-100">
                {copy.tips.map((tip) => (
                  <div key={tip} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-200" />
                    <span>{tip}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
