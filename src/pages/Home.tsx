import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { buildDiagnostic, DiagnosticInputs, DiagnosticOutput } from "@/lib/diagnostic";
import { fetchCountryWatch, WatchItem } from "@/lib/rssWatch";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";

const COUNTRIES = [
  { value: "FR", label: "France (FR)" },
  { value: "DE", label: "Allemagne (DE)" },
  { value: "BE", label: "Belgique (BE)" },
  { value: "NL", label: "Pays-Bas (NL)" },
  { value: "CH", label: "Suisse (CH)" },
  { value: "GB", label: "Royaume-Uni (GB)" },
  { value: "US", label: "États-Unis (US)" },
  { value: "CA", label: "Canada (CA)" },
  { value: "CN", label: "Chine (CN)" },
  { value: "JP", label: "Japon (JP)" },
  { value: "IN", label: "Inde (IN)" },
  { value: "AE", label: "Émirats arabes unis (AE)" },
  { value: "MA", label: "Maroc (MA)" },
  { value: "TR", label: "Turquie (TR)" },
  { value: "BR", label: "Brésil (BR)" },
  { value: "AU", label: "Australie (AU)" },
  { value: "SG", label: "Singapour (SG)" },
  { value: "ZA", label: "Afrique du Sud (ZA)" },
];

const INCOTERM_OPTIONS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"];

const CURRENCY_OPTIONS = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY", "CNY"];

const CONSENT_VERSION = "2026-02-07";
const CONSENT_TEXT =
  "J'accepte que mes données soient traitées pour produire ce diagnostic et améliorer l’outil.";

const DIAGNOSTIC_DRAFT_KEY = "mpl_home_diagnostic_draft";
const DIAGNOSTIC_AUTORUN_KEY = "mpl_home_diagnostic_autorun";
const NEWSLETTER_STORAGE_KEY = "mpl:newsletter:subscribers";

const TEASER_CHECKLIST = [
  "Facture commerciale + Incoterm précisé",
  "Packing list + document de transport",
];

const TEASER_RISK = "Sans code HS, droits et contrôles restent approximatifs.";

const FLAG_CLASSES: Record<"info" | "warning" | "risk", string> = {
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  risk: "border-rose-200 bg-rose-50 text-rose-700",
};

function toNumber(value: string) {
  const cleaned = value.replace(",", ".").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatMoney(value: number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined) return "—";
  const cur = currency || "EUR";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  }
}

async function hashText(value: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return `plain:${value.length}`;
  }
  const data = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Home() {
  usePageMeta("meta.home.title", "meta.home.description");

  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [videoFailed, setVideoFailed] = React.useState(false);

  const [form, setForm] = React.useState<DiagnosticInputs>({
    destination_country: "",
    product_label: "",
    hs_code: "",
    origin_country: "",
    incoterm: "",
    quantity: null,
    unit_price: null,
    currency: "EUR",
  });

  const [consentChecked, setConsentChecked] = React.useState(false);
  const [diagnostic, setDiagnostic] = React.useState<DiagnosticOutput | null>(null);
  const [watchItems, setWatchItems] = React.useState<WatchItem[]>([]);
  const [watchStatus, setWatchStatus] = React.useState<"idle" | "loading" | "error" | "ok">("idle");

  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [signupOpen, setSignupOpen] = React.useState(false);
  const [draftLoaded, setDraftLoaded] = React.useState(false);

  const [newsletterCompany, setNewsletterCompany] = React.useState("");
  const [newsletterEmail, setNewsletterEmail] = React.useState("");
  const [newsletterConsent, setNewsletterConsent] = React.useState(false);
  const [newsletterLoading, setNewsletterLoading] = React.useState(false);
  const [newsletterMessage, setNewsletterMessage] = React.useState<string | null>(null);

  const diagnosticRef = React.useRef<HTMLDivElement | null>(null);
  const resultsRef = React.useRef<HTMLDivElement | null>(null);

  const normalizedInputs = React.useCallback((): DiagnosticInputs => {
    return {
      destination_country: String(form.destination_country || "").trim(),
      product_label: String(form.product_label || "").trim(),
      hs_code: form.hs_code ? String(form.hs_code).trim() : null,
      origin_country: form.origin_country ? String(form.origin_country).trim() : null,
      incoterm: form.incoterm ? String(form.incoterm).trim() : null,
      quantity: form.quantity ?? null,
      unit_price: form.unit_price ?? null,
      currency: form.currency || "EUR",
    };
  }, [form]);

  const persistDraft = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const payload = { ...form, consent: consentChecked };
    window.localStorage.setItem(DIAGNOSTIC_DRAFT_KEY, JSON.stringify(payload));
  }, [form, consentChecked]);

  const clearDraft = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DIAGNOSTIC_DRAFT_KEY);
  }, []);

  const runAnalysis = React.useCallback(async () => {
    setError(null);
    setNotice(null);

    const inputs = normalizedInputs();
    if (!inputs.destination_country) {
      setError("Choisis une destination pour lancer le diagnostic.");
      return;
    }
    if (!inputs.product_label) {
      setError("Décris le produit pour obtenir un diagnostic fiable.");
      return;
    }

    setIsRunning(true);
    setWatchStatus("loading");

    try {
      const output = buildDiagnostic(inputs);
      setDiagnostic(output);

      const watch = await fetchCountryWatch(inputs.destination_country, 6);
      setWatchItems(watch);
      setWatchStatus("ok");

      if (!SUPABASE_ENV_OK || !user) {
        setNotice("Sauvegarde indisponible : connexion base non configurée.");
        return;
      }

      const consentHash = await hashText(CONSENT_TEXT);

      const { data: consentRow, error: consentError } = await supabase
        .from("user_consents")
        .upsert(
          {
            user_id: user.id,
            consent: true,
            consent_version: CONSENT_VERSION,
            consent_text_hash: consentHash,
            consented_at: new Date().toISOString(),
            scope: "diagnostic",
          },
          { onConflict: "user_id,scope,consent_version" }
        )
        .select("id")
        .single();

      if (consentError) throw consentError;

      const outputsPayload = {
        ...output,
        watchItems: watch,
      };

      const { error: runError } = await supabase.from("diagnostic_runs").insert({
        user_id: user.id,
        destination_country: inputs.destination_country || null,
        hs_code: inputs.hs_code || null,
        product_label: inputs.product_label || null,
        origin_country: inputs.origin_country || null,
        incoterm: inputs.incoterm || null,
        quantity: inputs.quantity ?? null,
        unit_price: inputs.unit_price ?? null,
        currency: inputs.currency || null,
        inputs: inputs,
        outputs: outputsPayload,
        consent_id: consentRow?.id ?? null,
        consent_version: CONSENT_VERSION,
      });

      if (runError) throw runError;

      clearDraft();
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err: any) {
      setError(err?.message || "Impossible de lancer le diagnostic.");
      setWatchStatus("error");
    } finally {
      setIsRunning(false);
    }
  }, [clearDraft, normalizedInputs, user]);

  const handleAnalyze = async () => {
    if (!consentChecked) {
      setError("Merci de confirmer le consentement pour lancer l’analyse.");
      return;
    }

    if (!isAuthenticated || !user) {
      persistDraft();
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DIAGNOSTIC_AUTORUN_KEY, "1");
      }
      setSignupOpen(true);
      return;
    }

    await runAnalysis();
  };

  const handleStartDiagnostic = () => {
    diagnosticRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!isAuthenticated) setSignupOpen(true);
  };

  const handleNewsletterSubscribe = async () => {
    setNewsletterMessage(null);

    const emailClean = newsletterEmail.trim().toLowerCase();
    const companyClean = newsletterCompany.trim();

    if (!emailClean) {
      setNewsletterMessage("Ajoute un email professionnel pour t'inscrire.");
      return;
    }
    if (!isValidEmail(emailClean)) {
      setNewsletterMessage("Email invalide. Verifie la saisie.");
      return;
    }
    if (!companyClean) {
      setNewsletterMessage("Merci d'indiquer l'entreprise.");
      return;
    }
    if (!newsletterConsent) {
      setNewsletterMessage("Merci d'accepter la reception de la newsletter.");
      return;
    }

    setNewsletterLoading(true);

    const payload = {
      email: emailClean,
      company_name: companyClean,
      frequency: "weekly",
      source: "home",
      consent: true,
      consented_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      if (SUPABASE_ENV_OK) {
        const { error } = await supabase.from("newsletter_subscribers").insert(payload);
        if (error) {
          if (error.code === "23505") {
            setNewsletterMessage("Cet email est deja inscrit.");
            setNewsletterLoading(false);
            return;
          }
          if (isMissingTableError(error)) {
            // fallback local storage
            const raw = window.localStorage.getItem(NEWSLETTER_STORAGE_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            const list = Array.isArray(arr) ? arr : [];
            const exists = list.some((x) => String(x?.email || "").toLowerCase() === emailClean);
            const next = exists ? list.map((x) => (String(x?.email || "").toLowerCase() === emailClean ? payload : x)) : [payload, ...list];
            window.localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(next.slice(0, 200)));
          } else {
            throw error;
          }
        }
      } else {
        const raw = window.localStorage.getItem(NEWSLETTER_STORAGE_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(arr) ? arr : [];
        const exists = list.some((x) => String(x?.email || "").toLowerCase() === emailClean);
        const next = exists ? list.map((x) => (String(x?.email || "").toLowerCase() === emailClean ? payload : x)) : [payload, ...list];
        window.localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(next.slice(0, 200)));
      }

      setNewsletterCompany("");
      setNewsletterEmail("");
      setNewsletterConsent(false);
      setNewsletterMessage("Inscription enregistree. Merci !");
    } catch (err: any) {
      setNewsletterMessage(err?.message || "Impossible d'enregistrer l'inscription.");
    } finally {
      setNewsletterLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(DIAGNOSTIC_DRAFT_KEY);
    if (!raw) {
      setDraftLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DiagnosticInputs> & { consent?: boolean };
      setForm((prev) => ({
        ...prev,
        destination_country: parsed.destination_country || "",
        product_label: parsed.product_label || "",
        hs_code: parsed.hs_code || "",
        origin_country: parsed.origin_country || "",
        incoterm: parsed.incoterm || "",
        quantity: typeof parsed.quantity === "number" ? parsed.quantity : null,
        unit_price: typeof parsed.unit_price === "number" ? parsed.unit_price : null,
        currency: parsed.currency || "EUR",
      }));
      setConsentChecked(Boolean(parsed.consent));
    } catch {
      // ignore
    } finally {
      setDraftLoaded(true);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!draftLoaded || !isAuthenticated) return;
    if (typeof window === "undefined") return;
    const shouldRun = window.localStorage.getItem(DIAGNOSTIC_AUTORUN_KEY) === "1";
    if (!shouldRun || !consentChecked) return;
    window.localStorage.removeItem(DIAGNOSTIC_AUTORUN_KEY);
    void runAnalysis();
  }, [consentChecked, draftLoaded, isAuthenticated, runAnalysis]);

  const showFullResults = Boolean(isAuthenticated && diagnostic);
  const showTeaser = !isAuthenticated;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return (
    <PublicLayout>
      <div className="space-y-16">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white shadow-xl">
          <div className="absolute inset-0">
            {!prefersReducedMotion && !videoFailed ? (
              <video
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onError={() => setVideoFailed(true)}
              >
                <source src="/videos/hero-export.webm" type="video/webm" />
              </video>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-900/70" />
          </div>
          <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/30 blur-3xl" />
          <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-blue-600/30 blur-3xl" />

          <div className="relative grid gap-10 px-8 py-14 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <Badge className="w-fit bg-white/10 text-white hover:bg-white/10">Diagnostic export express</Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  Export : contrôlez marges, risques et obligations en un seul outil.
                </h1>
                <p className="text-base text-white/80 md:text-lg">
                  Diagnostic express, simulateur coûts/marges, veille pays. Des réponses claires avant d’envoyer une offre.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  <Link to="/register?next=/">Créer un compte gratuit</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 text-white hover:bg-white/10"
                  onClick={handleStartDiagnostic}
                >
                  Lancer un diagnostic
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-white/80 hover:bg-white/10"
                >
                  <a href="#outil">Voir l’outil</a>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="font-semibold">Diagnostic rapide</div>
                  <div className="text-white/70">Checklist + risques + Incoterms</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="font-semibold">Marge pilotable</div>
                  <div className="text-white/70">Estimation coûts & marge</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="font-semibold">Veille pays</div>
                  <div className="text-white/70">Signaux récents par destination</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <Sparkles className="h-4 w-4" />
                Ce que vous obtenez dès l’inscription
              </div>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                  Diagnostic export express personnalisé.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                  Première estimation coûts/marge + recommandations.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                  Veille pays et alertes actionnables.
                </li>
              </ul>
              <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/50 p-4 text-xs text-white/70">
                Accès immédiat, sans carte bancaire. Vous gardez le contrôle et pouvez supprimer vos données à tout moment.
              </div>
            </div>
          </div>
        </section>

        {/* 5 BLOCS */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Première approche export</p>
            <h2 className="text-2xl font-semibold text-slate-900">De quoi j’ai besoin pour exporter ?</h2>
            <p className="text-sm text-slate-600">
              Les 5 blocs essentiels à clarifier pour sécuriser devis, contrat et logistique.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              {
                title: "Produit",
                bullets: ["Code HS & conformité", "Origine & restrictions", "Valeur & pricing"],
              },
              {
                title: "Destination",
                bullets: ["Pays cible & risque", "Accords commerciaux", "Contraintes locales"],
              },
              {
                title: "Client & contrat",
                bullets: ["Incoterm adapté", "Conditions paiement", "Responsabilités claires"],
              },
              {
                title: "Logistique",
                bullets: ["Mode de transport", "Assurance & délais", "Prestataires"],
              },
              {
                title: "Douane & facture",
                bullets: ["Documents requis", "Mentions facture", "Droits & taxes"],
              },
            ].map((card) => (
              <Card key={card.title} className="border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-slate-900">{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  <ul className="space-y-2">
                    {card.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* DIAGNOSTIC */}
        <section id="diagnostic" ref={diagnosticRef} className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Diagnostic express</p>
            <h2 className="text-2xl font-semibold text-slate-900">Diagnostic export express</h2>
            <p className="text-sm text-slate-600">
              Remplissez le formulaire pour obtenir checklist, risques clés et veille pays. Inscription gratuite pour les résultats complets.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Votre contexte</CardTitle>
                <CardDescription>Les champs essentiels pour un diagnostic fiable.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Destination</Label>
                    <Select
                      value={form.destination_country}
                      onValueChange={(v) => setForm((s) => ({ ...s, destination_country: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un pays" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Produit</Label>
                    <Input
                      value={form.product_label}
                      onChange={(e) => setForm((s) => ({ ...s, product_label: e.target.value }))}
                      placeholder="Ex : équipements médicaux"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Code HS (optionnel)</Label>
                    <Input
                      value={form.hs_code || ""}
                      onChange={(e) => setForm((s) => ({ ...s, hs_code: e.target.value }))}
                      placeholder="Ex : 8517"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pays d’origine (optionnel)</Label>
                    <Select
                      value={form.origin_country || "NONE"}
                      onValueChange={(v) =>
                        setForm((s) => ({ ...s, origin_country: v === "NONE" ? "" : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Non défini" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Non défini</SelectItem>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={`origin-${c.value}`} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Incoterm (optionnel)</Label>
                    <Select
                      value={form.incoterm || "NONE"}
                      onValueChange={(v) =>
                        setForm((s) => ({ ...s, incoterm: v === "NONE" ? "" : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="À préciser" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">À préciser</SelectItem>
                        {INCOTERM_OPTIONS.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Quantité (optionnel)</Label>
                    <Input
                      type="number"
                      value={form.quantity ?? ""}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, quantity: toNumber(e.target.value) }))
                      }
                      placeholder="Ex : 200"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Prix unitaire (optionnel)</Label>
                    <Input
                      type="number"
                      value={form.unit_price ?? ""}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, unit_price: toNumber(e.target.value) }))
                      }
                      placeholder="Ex : 450"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Devise</Label>
                    <Select
                      value={form.currency || "EUR"}
                      onValueChange={(v) => setForm((s) => ({ ...s, currency: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      checked={consentChecked}
                      onCheckedChange={(checked) => setConsentChecked(Boolean(checked))}
                    />
                    <div className="space-y-1 text-sm">
                      <Label htmlFor="consent" className="font-medium text-slate-900">
                        {CONSENT_TEXT} <Link to="/confidentialite" className="underline">Politique de confidentialité</Link>.
                      </Label>
                      <p className="text-xs text-slate-500">
                        Vous pouvez supprimer vos données depuis votre profil.
                      </p>
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                {notice ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                    {notice}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={handleAnalyze} disabled={isRunning || !consentChecked}>
                    {isRunning ? "Analyse en cours..." : "Analyser"}
                  </Button>
                  {!isAuthenticated ? (
                    <Button variant="outline" asChild>
                      <Link to="/register?next=/">Créer un compte gratuit</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <div ref={resultsRef} className="space-y-4">
              {showFullResults ? (
                <>
                  <Card className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Checklist documents</CardTitle>
                      <CardDescription>À valider avant expédition.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-slate-600">
                        {diagnostic?.checklist.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Risques & points d’attention</CardTitle>
                      <CardDescription>Ce qui peut bloquer ou faire perdre du temps.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {diagnostic?.flags.map((flag) => (
                        <div
                          key={flag.title}
                          className={cn("rounded-xl border px-3 py-2 text-sm", FLAG_CLASSES[flag.level])}
                        >
                          <div className="font-semibold">{flag.title}</div>
                          <div className="text-xs">{flag.detail}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Estimation coûts / marge</CardTitle>
                      <CardDescription>Indicatif, à affiner avec vos prestataires.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {diagnostic?.estimate ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">CA estimé</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {formatMoney(diagnostic.estimate.revenue, diagnostic.estimate.currency)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Coûts estimés</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {formatMoney(diagnostic.estimate.costs, diagnostic.estimate.currency)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Marge brute</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {formatMoney(diagnostic.estimate.margin, diagnostic.estimate.currency)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {diagnostic.estimate.marginPct.toFixed(1)}% de marge
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-600">
                          Ajoutez quantité et prix unitaire pour estimer rapidement la marge.
                        </div>
                      )}

                      {diagnostic?.estimate?.assumptions ? (
                        <ul className="space-y-1 text-xs text-slate-500">
                          {diagnostic.estimate.assumptions.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Veille pays</CardTitle>
                      <CardDescription>Dernières mises à jour liées à la destination.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {watchStatus === "loading" ? (
                        <div className="space-y-2">
                          <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                          <div className="h-4 w-3/5 animate-pulse rounded bg-slate-100" />
                          <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
                        </div>
                      ) : watchItems.length ? (
                        <ul className="space-y-3 text-sm">
                          {watchItems.map((item) => (
                            <li key={item.link} className="space-y-1">
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-slate-900 hover:underline"
                              >
                                {item.title}
                              </a>
                              <div className="text-xs text-slate-500">
                                {item.source || "Source"}{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString("fr-FR")}` : ""}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-slate-600">
                          Aucun item disponible pour cette destination pour le moment.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to="/app/control-tower">Aller dans Control Tower</Link>
                    </Button>
                    <Button variant="outline" onClick={() => setDiagnostic(null)}>
                      Nouveau diagnostic
                    </Button>
                  </div>
                </>
              ) : showTeaser ? (
                <>
                  <Card className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-lg">Aperçu gratuit</CardTitle>
                      <CardDescription>Extrait des résultats que vous débloquez.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-slate-600">
                      <ul className="space-y-2">
                        {TEASER_CHECKLIST.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        {TEASER_RISK}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed border-slate-300 bg-slate-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Lock className="h-4 w-4" /> Débloquez vos résultats
                      </CardTitle>
                      <CardDescription>Checklist complète, veille pays et estimation marge.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild className="w-full">
                        <Link to="/register?next=/">Créer un compte gratuit</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg">Résultats</CardTitle>
                    <CardDescription>Remplissez le formulaire pour obtenir votre diagnostic.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-600">
                    Les résultats apparaîtront ici après l’analyse.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </section>


        {/* OUTIL UNIQUE */}
        <section id="outil" className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Outil unique</p>
            <h2 className="text-2xl font-semibold text-slate-900">Un cockpit pour piloter l’export</h2>
            <p className="text-sm text-slate-600">
              Control Tower, simulateur et veille structurée pour prendre les bonnes décisions.
            </p>
          </div>

          <Tabs defaultValue="tower" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tower">Control Tower</TabsTrigger>
              <TabsTrigger value="simu">Simulateur</TabsTrigger>
              <TabsTrigger value="watch">Veille</TabsTrigger>
            </TabsList>

            <TabsContent value="tower" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Target className="h-4 w-4" />
                Pilotage export centralisé
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Vue globale par pays, produits et marges.</li>
                <li>• Alertes en temps réel sur risques et conformité.</li>
                <li>• Tableaux de bord prêts pour la direction.</li>
              </ul>
              <Button asChild variant="outline">
                <Link to="/app/control-tower">Accéder à la Control Tower</Link>
              </Button>
            </TabsContent>

            <TabsContent value="simu" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Zap className="h-4 w-4" />
                Scénarios coûts/marges en quelques clics
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Comparez transport, Incoterms, frais et taxes.</li>
                <li>• Ajustez la marge cible selon le marché.</li>
                <li>• Exportez un résumé pour vos équipes.</li>
              </ul>
              <Button asChild variant="outline">
                <Link to="/app/simulator">Ouvrir le simulateur</Link>
              </Button>
            </TabsContent>

            <TabsContent value="watch" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4" />
                Veille pays structurée
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Flux ciblés par pays et thématique.</li>
                <li>• Historique des signaux faibles utiles.</li>
                <li>• Partage rapide avec vos équipes.</li>
              </ul>
              <Button asChild variant="outline">
                <Link to="/veille">Voir la veille</Link>
              </Button>
            </TabsContent>
          </Tabs>
        </section>

        {/* PREUVES DE CONFIANCE */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Confiance</p>
            <h2 className="text-2xl font-semibold text-slate-900">Pensé pour les PME, conforme RGPD</h2>
            <p className="text-sm text-slate-600">Données sécurisées, contrôle et transparence.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "RGPD & consentement",
                desc: "Consentement explicite, stockage sécurisé, suppression possible à tout moment.",
              },
              {
                title: "Gain de temps",
                desc: "Une seule interface pour vérifier documents, risques et marges.",
              },
              {
                title: "Pensé PME",
                desc: "Des explications claires et des actions concrètes, sans jargon inutile.",
              },
            ].map((item) => (
              <Card key={item.title} className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base text-slate-900">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">{item.desc}</CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* NEWSLETTER */}
        <section className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Newsletter</p>
            <h2 className="text-2xl font-semibold text-slate-900">Recevoir la veille export</h2>
            <p className="text-sm text-slate-600">
              Un brief clair chaque semaine pour vos pays et produits prioritaires.
            </p>
          </div>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Inscription rapide</CardTitle>
              <CardDescription>Collecte d'emails professionnels et societes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1.1fr_1.3fr]">
                <Input
                  value={newsletterCompany}
                  onChange={(e) => setNewsletterCompany(e.target.value)}
                  placeholder="Entreprise"
                  className="border-slate-200"
                />
                <Input
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Email professionnel"
                  className="border-slate-200"
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600">
                <Checkbox checked={newsletterConsent} onCheckedChange={(v) => setNewsletterConsent(Boolean(v))} />
                J'accepte de recevoir la newsletter Export Navigator (desinscription a tout moment).
              </label>

              {newsletterMessage ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {newsletterMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleNewsletterSubscribe} disabled={newsletterLoading}>
                  {newsletterLoading ? "Enregistrement..." : "S'inscrire"}
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/newsletter">Voir la page newsletter</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* PRICING + FAQ */}
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Gratuit pour démarrer</CardTitle>
                <CardDescription>Créez un compte et obtenez vos premiers diagnostics.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Offre gratuite</div>
                  <div className="text-2xl font-semibold text-slate-900">0 €</div>
                  <div className="text-xs text-slate-500">Sans engagement, accès immédiat.</div>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li>• Diagnostic export express</li>
                  <li>• Veille pays basique</li>
                  <li>• Historique des analyses</li>
                </ul>
                <Button asChild className="w-full">
                  <Link to="/register?next=/">Créer un compte gratuit</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/pricing">Découvrir les plans</Link>
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-slate-900">FAQ</h3>
              <Accordion type="single" collapsible className="rounded-2xl border border-slate-200 bg-white">
                {[
                  {
                    q: "Pourquoi l’inscription est obligatoire ?",
                    a: "Parce que le diagnostic repose sur vos données et doit être conservé en historique. L’inscription garantit sécurité et suivi.",
                  },
                  {
                    q: "Puis-je supprimer mes données ?",
                    a: "Oui. Vous pouvez demander la suppression depuis votre profil ou via la politique de confidentialité.",
                  },
                  {
                    q: "Le diagnostic remplace-t-il un agent en douane ?",
                    a: "Non. Il fournit une première lecture actionnable, mais la validation finale dépend de votre contexte réel.",
                  },
                  {
                    q: "Que se passe-t-il si je n’ai pas de code HS ?",
                    a: "Le diagnostic reste disponible, mais les droits et contrôles sont moins précis. Nous recommandons d’ajouter un HS dès que possible.",
                  },
                ].map((item) => (
                  <AccordionItem key={item.q} value={item.q}>
                    <AccordionTrigger className="px-4">{item.q}</AccordionTrigger>
                    <AccordionContent className="px-4 text-sm text-slate-600">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte gratuit</DialogTitle>
            <DialogDescription>
              Les résultats complets (checklist, risques, veille pays) sont disponibles après inscription gratuite.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => navigate(`/login?next=${encodeURIComponent("/")}`)}>
              Se connecter
            </Button>
            <Button onClick={() => navigate(`/register?next=${encodeURIComponent("/")}`)}>
              Créer un compte gratuit
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PublicLayout>
  );
}
