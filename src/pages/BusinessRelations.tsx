import * as React from "react";
import { Link } from "react-router-dom";
import { Bot, BriefcaseBusiness, Building2, Globe2, Handshake, Loader2, Mail, PhoneCall, Send, Users } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  BUSINESS_OPPORTUNITY_TYPES,
  archiveBusinessOpportunity,
  type BusinessOpportunity,
  type BusinessOpportunitySource,
  type BusinessOpportunityType,
  createBusinessOpportunity,
  listBusinessOpportunities,
} from "@/services/businessBoard";
import { createBusinessRelation, listBusinessRelations, type BusinessRelation, type BusinessRelationDirection } from "@/services/businessRelations";

type PublishForm = {
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

type IntroForm = {
  firstName: string;
  email: string;
  company: string;
  message: string;
};

type RelationForm = {
  direction: BusinessRelationDirection;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
};

type DealMessage = { id: string; role: "user" | "assistant"; content: string };
type DealResult = {
  verdict: "forte_opportunite" | "a_creuser" | "risque_eleve";
  score: number;
  provider: "chatgpt" | "heuristic" | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RAW = "0676435551";
const PHONE_PRETTY = "06 76 43 55 51";
const CONTACT_EMAIL = "contact@exportfrancefacile.com";

const DEFAULT_PUBLISH: PublishForm = {
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

const DEFAULT_INTRO: IntroForm = {
  firstName: "",
  email: "",
  company: "",
  message: "",
};

const DEFAULT_RELATION: RelationForm = {
  direction: "outbound",
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
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

const RELATION_SOURCE_LABELS = {
  manual: { fr: "Manuel", en: "Manual" },
  board_request: { fr: "Board entrant", en: "Board inbound" },
  board_outreach: { fr: "Board sortant", en: "Board outreach" },
  intro_request: { fr: "MPL", en: "MPL" },
} as const;

const RELATION_STATUS_LABELS = {
  new: { fr: "Nouveau", en: "New" },
  contacted: { fr: "Contacte", en: "Contacted" },
  qualified: { fr: "Qualifie", en: "Qualified" },
  closed: { fr: "Clos", en: "Closed" },
} as const;

const DEAL_VERDICT_LABELS = {
  forte_opportunite: { fr: "Forte opportunite", en: "Strong opportunity" },
  a_creuser: { fr: "A creuser", en: "Worth exploring" },
  risque_eleve: { fr: "Risque eleve", en: "High risk" },
} as const;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function BusinessRelations() {
  const { lang } = useI18n();
  const isEn = lang === "en";
  const locale = isEn ? "en-US" : "fr-FR";
  const { user } = useAuth();
  const { toast } = useToast();

  const [board, setBoard] = React.useState<BusinessOpportunity[]>([]);
  const [boardSource, setBoardSource] = React.useState<BusinessOpportunitySource>("demo");
  const [boardLoading, setBoardLoading] = React.useState(true);
  const [relations, setRelations] = React.useState<BusinessRelation[]>([]);
  const [relationsSource, setRelationsSource] = React.useState<"server" | "demo">("demo");
  const [relationsLoading, setRelationsLoading] = React.useState(true);
  const [publishForm, setPublishForm] = React.useState<PublishForm>(DEFAULT_PUBLISH);
  const [introForm, setIntroForm] = React.useState<IntroForm>(DEFAULT_INTRO);
  const [relationForm, setRelationForm] = React.useState<RelationForm>(DEFAULT_RELATION);
  const [publishSubmitting, setPublishSubmitting] = React.useState(false);
  const [introSubmitting, setIntroSubmitting] = React.useState(false);
  const [relationSubmitting, setRelationSubmitting] = React.useState(false);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = React.useState("");
  const [dealDraft, setDealDraft] = React.useState("");
  const [dealSubmitting, setDealSubmitting] = React.useState(false);
  const [dealResult, setDealResult] = React.useState<DealResult | null>(null);
  const [dealMessages, setDealMessages] = React.useState<DealMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: isEn
        ? "Select an opportunity or describe a deal. I will tell you if it is worth pursuing and why."
        : "Selectionnez une opportunite ou decrivez un deal. Je vous dirai si cela vaut le coup et pourquoi.",
    },
  ]);

  const selectedOpportunity = React.useMemo(() => board.find((item) => item.id === selectedOpportunityId) || null, [board, selectedOpportunityId]);
  const inbound = React.useMemo(() => relations.filter((item) => item.direction === "inbound"), [relations]);
  const outbound = React.useMemo(() => relations.filter((item) => item.direction === "outbound"), [relations]);
  const userEmail = String(user?.email || "").trim().toLowerCase();

  const isOwnedOpportunity = React.useCallback(
    (item: BusinessOpportunity) => item.user_id === user?.id || (!!userEmail && item.contact_email === userEmail),
    [user?.id, userEmail]
  );

  const fillFromUser = React.useCallback(() => {
    const email = user?.email || "";
    const name = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim();
    const company = String(user?.user_metadata?.company_name || "").trim();
    setPublishForm((prev) => ({ ...prev, companyName: prev.companyName || company, contactName: prev.contactName || name, contactEmail: prev.contactEmail || email }));
    setIntroForm((prev) => ({ ...prev, firstName: prev.firstName || name, email: prev.email || email, company: prev.company || company }));
    setRelationForm((prev) => ({ ...prev, companyName: prev.companyName || company, contactName: prev.contactName || name, contactEmail: prev.contactEmail || email }));
  }, [user?.email, user?.user_metadata]);

  const loadBoard = React.useCallback(async () => {
    setBoardLoading(true);
    try {
      const result = await listBusinessOpportunities(12);
      setBoard(result.items);
      setBoardSource(result.source);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const loadRelations = React.useCallback(async () => {
    setRelationsLoading(true);
    try {
      const result = await listBusinessRelations(24);
      setRelations(result.items);
      setRelationsSource(result.source);
    } finally {
      setRelationsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fillFromUser();
  }, [fillFromUser]);

  React.useEffect(() => {
    void Promise.all([loadBoard(), loadRelations()]);
  }, [loadBoard, loadRelations]);

  const savePublishField =
    <K extends keyof PublishForm>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setPublishForm((prev) => ({ ...prev, [key]: event.target.value }));

  const saveIntroField =
    <K extends keyof IntroForm>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setIntroForm((prev) => ({ ...prev, [key]: event.target.value }));

  const saveRelationField =
    <K extends keyof RelationForm>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setRelationForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submitPublish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!publishForm.companyName.trim() || !publishForm.contactName.trim()) return;
    if (!EMAIL_RE.test(publishForm.contactEmail.trim())) return;
    if (publishForm.title.trim().length < 12 || publishForm.summary.trim().length < 40) return;
    try {
      setPublishSubmitting(true);
      await createBusinessOpportunity({
        company_name: publishForm.companyName,
        contact_name: publishForm.contactName,
        contact_email: publishForm.contactEmail,
        title: publishForm.title,
        summary: publishForm.summary,
        opportunity_type: publishForm.opportunityType,
        sector: publishForm.sector,
        origin_country: publishForm.originCountry,
        target_country: publishForm.targetCountry,
        website: publishForm.website,
      });
      toast({ title: isEn ? "Opportunity published" : "Opportunite publiee" });
      setPublishForm((prev) => ({ ...DEFAULT_PUBLISH, companyName: prev.companyName, contactName: prev.contactName, contactEmail: prev.contactEmail }));
      await loadBoard();
    } catch {
      toast({ title: isEn ? "Unable to publish" : "Publication impossible", variant: "destructive" });
    } finally {
      setPublishSubmitting(false);
    }
  };

  const submitRelation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!relationForm.companyName.trim() || !relationForm.contactName.trim()) return;
    if (relationForm.contactEmail.trim() && !EMAIL_RE.test(relationForm.contactEmail.trim())) return;
    if (relationForm.message.trim().length < 10) return;
    try {
      setRelationSubmitting(true);
      await createBusinessRelation({
        direction: relationForm.direction,
        relation_source: "manual",
        company_name: relationForm.companyName,
        contact_name: relationForm.contactName,
        contact_email: relationForm.contactEmail,
        contact_phone: relationForm.contactPhone,
        message: relationForm.message,
      });
      toast({ title: isEn ? "Contact saved" : "Contact enregistre" });
      setRelationForm((prev) => ({ ...DEFAULT_RELATION, direction: prev.direction, companyName: prev.companyName, contactName: prev.contactName, contactEmail: prev.contactEmail }));
      await loadRelations();
    } catch {
      toast({ title: isEn ? "Unable to save contact" : "Enregistrement impossible", variant: "destructive" });
    } finally {
      setRelationSubmitting(false);
    }
  };

  const submitIntro = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!introForm.firstName.trim() || !EMAIL_RE.test(introForm.email.trim()) || introForm.message.trim().length < 20) return;
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
      if (!response.ok) throw new Error("contact_failed");
      toast({ title: isEn ? "Request sent" : "Demande envoyee" });
      setIntroForm((prev) => ({ ...DEFAULT_INTRO, firstName: prev.firstName, email: prev.email, company: prev.company }));
    } catch {
      toast({ title: isEn ? "Unable to send request" : "Envoi impossible", variant: "destructive" });
    } finally {
      setIntroSubmitting(false);
    }
  };

  const logOutreach = async (item: BusinessOpportunity) => {
    try {
      await createBusinessRelation({
        direction: "outbound",
        relation_source: "board_outreach",
        company_name: item.company_name,
        contact_name: item.contact_name,
        contact_email: item.contact_email,
        opportunity_id: item.id,
        opportunity_title: item.title,
        message: item.summary.slice(0, 300),
      });
      toast({ title: isEn ? "Outreach saved" : "Contact sortant enregistre" });
      await loadRelations();
    } catch {
      toast({ title: isEn ? "Unable to save outreach" : "Enregistrement impossible", variant: "destructive" });
    }
  };

  const archiveOpportunity = async (item: BusinessOpportunity) => {
    const confirmed = window.confirm(
      isEn
        ? "Remove this opportunity from the live board?"
        : "Retirer cette opportunite du board live ?"
    );
    if (!confirmed) return;

    try {
      setArchivingId(item.id);
      await archiveBusinessOpportunity(item.id);
      if (selectedOpportunityId === item.id) {
        setSelectedOpportunityId("");
        setDealResult(null);
      }
      toast({ title: isEn ? "Opportunity removed" : "Opportunite retiree" });
      await loadBoard();
    } catch {
      toast({ title: isEn ? "Unable to remove opportunity" : "Retrait impossible", variant: "destructive" });
    } finally {
      setArchivingId(null);
    }
  };

  const runDealReview = async (preset?: string, item?: BusinessOpportunity | null) => {
    const target = item || selectedOpportunity;
    const question = (preset || dealDraft || (isEn ? "Is this a good business opportunity?" : "Est-ce une bonne affaire ?")).trim();
    const nextUser = { id: uid(), role: "user" as const, content: question };
    setDealMessages((prev) => [...prev, nextUser]);
    setDealDraft("");
    setDealSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch("/api/business-deal-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lang,
          opportunity: target
            ? {
                title: target.title,
                summary: target.summary,
                company_name: target.company_name,
                opportunity_type: target.opportunity_type,
                sector: target.sector,
                origin_country: target.origin_country,
                target_country: target.target_country,
                website: target.website,
              }
            : null,
          messages: [...dealMessages, nextUser].slice(-8).map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      if (!response.ok) throw new Error("deal_review_failed");
      const result = (await response.json().catch(() => ({}))) as { answer_markdown?: string; verdict?: DealResult["verdict"]; score?: number; provider?: DealResult["provider"] };
      setDealResult({ verdict: result.verdict || "a_creuser", score: Number(result.score || 0), provider: result.provider || null });
      setDealMessages((prev) => [...prev, { id: uid(), role: "assistant", content: String(result.answer_markdown || "") }]);
    } catch {
      setDealMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: isEn ? "Unable to review this deal right now." : "Impossible d'analyser ce deal pour le moment." },
      ]);
    } finally {
      setDealSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_42%,#eef6ff_100%)] p-6 shadow-sm">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-700">
              <Handshake className="h-3.5 w-3.5 text-[#0f766e]" />
              {isEn ? "Business cockpit" : "Cockpit business"}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {isEn
                ? "Inbound contacts, outbound contacts and AI deal review in one private space."
                : "Contacts entrants, contacts sortants et revue IA des affaires dans un seul espace prive."}
            </h1>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button asChild className="rounded-full"><a href="#relations">{isEn ? "Open contacts" : "Voir les contacts"}</a></Button>
              <Button asChild variant="outline" className="rounded-full bg-white"><a href="#deal-ai">{isEn ? "Analyze a deal" : "Analyser une affaire"}</a></Button>
              <Button asChild variant="outline" className="rounded-full bg-white"><Link to="/coin-business">{isEn ? "Public board" : "Board public"}</Link></Button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.92fr]">
          <div className="space-y-6">
            <Card id="relations" className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Business contacts" : "Contacts business"}</CardTitle>
                <CardDescription>{isEn ? "People who contacted you and people you contacted." : "Les gens qui vous contactent et ceux que vous contactez."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {relationsSource === "demo" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {isEn ? "Demo mode active until migrations are applied." : "Mode demo actif tant que les migrations ne sont pas appliquees."}
                  </div>
                ) : null}
                <Tabs defaultValue="inbound">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="inbound">{isEn ? "Inbound" : "Entrants"} ({inbound.length})</TabsTrigger>
                    <TabsTrigger value="outbound">{isEn ? "Outbound" : "Sortants"} ({outbound.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="inbound" className="space-y-3 pt-4">
                    {relationsLoading ? <div className="text-sm text-slate-500">{isEn ? "Loading..." : "Chargement..."}</div> : null}
                    {!relationsLoading && !inbound.length ? <div className="text-sm text-slate-500">{isEn ? "No inbound contact yet." : "Aucun contact entrant pour le moment."}</div> : null}
                    {inbound.map((relation) => (
                      <Card key={relation.id} className="border-slate-200 bg-slate-50">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{RELATION_SOURCE_LABELS[relation.relation_source][isEn ? "en" : "fr"]}</Badge>
                            <Badge variant="outline">{RELATION_STATUS_LABELS[relation.relation_status][isEn ? "en" : "fr"]}</Badge>
                            <span className="text-xs text-slate-500">{formatDate(relation.created_at, locale)}</span>
                          </div>
                          <div className="font-semibold text-slate-950">{relation.company_name}</div>
                          <div className="text-sm text-slate-600">{relation.message}</div>
                          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                            <span>{relation.contact_name}</span>
                            {relation.contact_email ? <a href={`mailto:${relation.contact_email}`}>{relation.contact_email}</a> : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="outbound" className="space-y-3 pt-4">
                    {relationsLoading ? <div className="text-sm text-slate-500">{isEn ? "Loading..." : "Chargement..."}</div> : null}
                    {!relationsLoading && !outbound.length ? <div className="text-sm text-slate-500">{isEn ? "No outbound contact yet." : "Aucun contact sortant pour le moment."}</div> : null}
                    {outbound.map((relation) => (
                      <Card key={relation.id} className="border-slate-200 bg-slate-50">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{RELATION_SOURCE_LABELS[relation.relation_source][isEn ? "en" : "fr"]}</Badge>
                            <Badge variant="outline">{RELATION_STATUS_LABELS[relation.relation_status][isEn ? "en" : "fr"]}</Badge>
                            <span className="text-xs text-slate-500">{formatDate(relation.created_at, locale)}</span>
                          </div>
                          <div className="font-semibold text-slate-950">{relation.company_name}</div>
                          <div className="text-sm text-slate-600">{relation.message}</div>
                          <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                            <span>{relation.contact_name}</span>
                            {relation.contact_email ? <a href={`mailto:${relation.contact_email}`}>{relation.contact_email}</a> : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Live opportunities" : "Opportunites live"}</CardTitle>
                <CardDescription>{isEn ? "Use the board to find and log outreach." : "Utilisez le board pour trouver et journaliser vos contacts."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {boardSource === "demo" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {isEn ? "Public board is in demo mode until migrations are applied." : "Le board public est en mode demo tant que les migrations ne sont pas appliquees."}
                  </div>
                ) : null}
                {boardLoading ? <div className="text-sm text-slate-500">{isEn ? "Loading..." : "Chargement..."}</div> : null}
                {board.map((item) => (
                  <Card key={item.id} className="border-slate-200 bg-slate-50">
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{TYPE_LABELS[item.opportunity_type][isEn ? "en" : "fr"]}</Badge>
                            {isOwnedOpportunity(item) ? <Badge variant="outline">{isEn ? "Your listing" : "Votre annonce"}</Badge> : null}
                            <span className="text-xs text-slate-500">{formatDate(item.created_at, locale)}</span>
                          </div>
                          <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                          <p className="text-sm text-slate-600">{item.summary}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1"><Building2 className="h-3.5 w-3.5" />{item.company_name}</span>
                            {item.origin_country ? <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1"><Globe2 className="h-3.5 w-3.5" />{item.origin_country}</span> : null}
                            {item.target_country ? <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1"><Globe2 className="h-3.5 w-3.5" />{item.target_country}</span> : null}
                          </div>
                        </div>
                        <div className="flex min-w-[230px] flex-col gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => { setSelectedOpportunityId(item.id); void runDealReview(isEn ? "Is this worth pursuing?" : "Est-ce que cela vaut le coup ?", item); }}>
                            {isEn ? "Analyze" : "Analyser"}
                          </Button>
                          {isOwnedOpportunity(item) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                              disabled={archivingId === item.id}
                              onClick={() => void archiveOpportunity(item)}
                            >
                              {archivingId === item.id
                                ? isEn
                                  ? "Removing..."
                                  : "Retrait..."
                                : isEn
                                  ? "Remove from board"
                                  : "Retirer du board"}
                            </Button>
                          ) : (
                            <Button size="sm" className="rounded-full" onClick={() => void logOutreach(item)}>{isEn ? "I contacted them" : "J'ai contacte ce lead"}</Button>
                          )}
                          <Button asChild size="sm" variant="outline" className="rounded-full"><a href={`mailto:${item.contact_email}`}>Email</a></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card id="deal-ai" className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "ChatGPT deal analyst" : "Analyste d'affaires ChatGPT"}</CardTitle>
                <CardDescription>{isEn ? "Ask if a deal is good and how to qualify it." : "Demandez si une affaire est bonne et comment la qualifier."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <select value={selectedOpportunityId} onChange={(event) => setSelectedOpportunityId(event.target.value)} className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{isEn ? "Free prompt" : "Question libre"}</option>
                  {board.map((item) => <option key={item.id} value={item.id}>{item.company_name} - {item.title}</option>)}
                </select>
                {dealResult ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{DEAL_VERDICT_LABELS[dealResult.verdict][isEn ? "en" : "fr"]}</Badge>
                      <Badge variant="outline">{dealResult.score}/100</Badge>
                      {dealResult.provider ? <Badge variant="outline">{dealResult.provider === "chatgpt" ? "ChatGPT" : (isEn ? "Fallback" : "Secours")}</Badge> : null}
                    </div>
                  </div>
                ) : null}
                <div className="max-h-[240px] space-y-3 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {dealMessages.map((message) => (
                    <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" ? <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-3 w-3" /></div> : null}
                      <div className={`max-w-[88%] rounded-2xl border px-3 py-2 text-sm ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-white"}`}>{message.content}</div>
                    </div>
                  ))}
                  {dealSubmitting ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{isEn ? "Analyzing..." : "Analyse..."}</div> : null}
                </div>
                <Textarea value={dealDraft} onChange={(event) => setDealDraft(event.target.value)} className="min-h-[110px]" placeholder={isEn ? "Is this a good deal and why?" : "Est-ce une bonne affaire et pourquoi ?"} />
                <Button className="h-11 w-full rounded-full" disabled={dealSubmitting} onClick={() => void runDealReview()}><Bot className="mr-2 h-4 w-4" />{isEn ? "Analyze" : "Analyser"}</Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Log a contact" : "Ajouter un contact"}</CardTitle>
                <CardDescription>{isEn ? "Track inbound or outbound contacts manually." : "Journalisez un contact entrant ou sortant."}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitRelation}>
                  <select value={relationForm.direction} onChange={saveRelationField("direction")} className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm">
                    <option value="outbound">{isEn ? "Outbound" : "Sortant"}</option>
                    <option value="inbound">{isEn ? "Inbound" : "Entrant"}</option>
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={relationForm.companyName} onChange={saveRelationField("companyName")} placeholder={isEn ? "Company" : "Entreprise"} />
                    <Input value={relationForm.contactName} onChange={saveRelationField("contactName")} placeholder="Contact" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="email" value={relationForm.contactEmail} onChange={saveRelationField("contactEmail")} placeholder="email@company.com" />
                    <Input value={relationForm.contactPhone} onChange={saveRelationField("contactPhone")} placeholder={isEn ? "Phone" : "Telephone"} />
                  </div>
                  <Textarea value={relationForm.message} onChange={saveRelationField("message")} className="min-h-[96px]" placeholder={isEn ? "Short business note" : "Note business courte"} />
                  <Button type="submit" className="h-11 w-full rounded-full" disabled={relationSubmitting}><Users className="mr-2 h-4 w-4" />{relationSubmitting ? (isEn ? "Saving..." : "Enregistrement...") : (isEn ? "Save contact" : "Enregistrer le contact")}</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Publish opportunity" : "Publier une opportunite"}</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitPublish}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={publishForm.companyName} onChange={savePublishField("companyName")} placeholder={isEn ? "Company" : "Entreprise"} />
                    <Input value={publishForm.contactName} onChange={savePublishField("contactName")} placeholder="Contact" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="email" value={publishForm.contactEmail} onChange={savePublishField("contactEmail")} placeholder="email@company.com" />
                    <select value={publishForm.opportunityType} onChange={savePublishField("opportunityType")} className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm">
                      {BUSINESS_OPPORTUNITY_TYPES.map((type) => <option key={type} value={type}>{TYPE_LABELS[type][isEn ? "en" : "fr"]}</option>)}
                    </select>
                  </div>
                  <Input value={publishForm.title} onChange={savePublishField("title")} placeholder={isEn ? "Opportunity title" : "Titre"} />
                  <Textarea value={publishForm.summary} onChange={savePublishField("summary")} className="min-h-[110px]" placeholder={isEn ? "Business summary" : "Resume business"} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={publishForm.sector} onChange={savePublishField("sector")} placeholder={isEn ? "Sector" : "Secteur"} />
                    <Input value={publishForm.website} onChange={savePublishField("website")} placeholder="https://..." />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={publishForm.originCountry} onChange={savePublishField("originCountry")} placeholder="FR" />
                    <Input value={publishForm.targetCountry} onChange={savePublishField("targetCountry")} placeholder="AE" />
                  </div>
                  <Button type="submit" className="h-11 w-full rounded-full" disabled={publishSubmitting}><BriefcaseBusiness className="mr-2 h-4 w-4" />{publishSubmitting ? (isEn ? "Publishing..." : "Publication...") : (isEn ? "Publish" : "Publier")}</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/95 shadow-sm">
              <CardHeader>
                <CardTitle>{isEn ? "Request MPL introduction" : "Demander une mise en relation MPL"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="space-y-4" onSubmit={submitIntro}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input value={introForm.firstName} onChange={saveIntroField("firstName")} placeholder={isEn ? "Your name" : "Votre nom"} />
                    <Input type="email" value={introForm.email} onChange={saveIntroField("email")} placeholder="email@company.com" />
                  </div>
                  <Input value={introForm.company} onChange={saveIntroField("company")} placeholder={isEn ? "Company" : "Entreprise"} />
                  <Textarea value={introForm.message} onChange={saveIntroField("message")} className="min-h-[96px]" placeholder={isEn ? "What contact do you need?" : "Quel contact cherchez-vous ?"} />
                  <Button type="submit" variant="outline" className="h-11 w-full rounded-full" disabled={introSubmitting}><Send className="mr-2 h-4 w-4" />{introSubmitting ? (isEn ? "Sending..." : "Envoi...") : (isEn ? "Send request" : "Envoyer la demande")}</Button>
                </form>
                <div className="grid gap-2">
                  <a href={`tel:${PHONE_RAW}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"><PhoneCall className="h-4 w-4" />{PHONE_PRETTY}</a>
                  <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Mise en relation business")}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"><Mail className="h-4 w-4" />{CONTACT_EMAIL}</a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
