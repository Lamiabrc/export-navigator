import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { postLead, postPdf } from "@/lib/leadMagnetApi";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeFr } from "@/lib/formatters";

type BriefResponse = {
  estimate: { duty: number; taxes: number; total: number; currency: string };
  documents: string[];
  risks: Array<{ title: string; level: "low" | "medium" | "high"; message: string }>;
  complianceScore: number;
  updatedAt: string;
  confidence: "low" | "medium" | "high";
  sources: string[];
  simulationId?: string | null;

  // optionnel backend
  countryNotes?: Array<{ title: string; items: string[] }>;
};

type HsSuggestion = { code: string; label: string };

type ExportBriefPayload = {
  hsInput?: string;
  productText?: string;
  destinationIso2: string;
  value: number;
  currency: string;
  incoterm: string;
  mode: string;
  weightKg: number | null;
  insurance: number | null;
};

type HistoryEntry = {
  payload: ExportBriefPayload;
  result: BriefResponse;
};

const HISTORY_KEY = "mpl_sim_history";
const LAST_SIM_KEY = "mpl_last_simulation";
const EMAIL_KEY = "mpl_lead_email";
const MAX_HISTORY = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOP_COUNTRY_ISO2 = [
  "DE", "ES", "IT", "NL", "BE", "CH", "GB",
  "US", "CA",
  "MA", "AE",
  "CN", "JP", "IN",
];

const COUNTRIES_FALLBACK = [
  { label: "États-Unis", iso2: "US" },
  { label: "Allemagne", iso2: "DE" },
  { label: "Espagne", iso2: "ES" },
  { label: "Royaume-Uni", iso2: "GB" },
  { label: "Chine", iso2: "CN" },
  { label: "Canada", iso2: "CA" },
  { label: "Maroc", iso2: "MA" },
  { label: "Émirats arabes unis", iso2: "AE" },
  { label: "Japon", iso2: "JP" },
  { label: "Inde", iso2: "IN" },
];

const EU_ISO2 = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT",
  "LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

const LANGUAGE_STORAGE_KEY = "mpl_lang";

type ToolAction =
  | { type: "link"; href: string }
  | { type: "scroll"; targetId: string };

type CopyContent = {
  heroTagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimary: string;
  heroSecondary: string;
  heroTrust: string[];
  servicesLabel: string;
  servicesTitle: string;
  servicesSubtitle: string;
  serviceCta: string;
  serviceCards: Array<{ title: string; description: string; detail: string }>;
  toolsLabel: string;
  toolsTitle: string;
  toolsSubtitle: string;
  tools: Array<{ title: string; description: string; actionLabel: string; action: ToolAction }>;
};

const COPY: Record<"fr" | "en", CopyContent> = {
  fr: {
    heroTagline: "Services MPL Export Conseil",
    heroTitle: "Nous pouvons vous aider à sécuriser vos exportations.",
    heroSubtitle:
      "MPL Export Conseil audite vos tarifs, documents et sanctions puis met des outils clairs à disposition pour piloter vos décisions.",
    heroPrimary: "Planifier une validation express",
    heroSecondary: "Découvrir les outils",
    heroTrust: [
      "PDF gratuit de contrôle (sur demande)",
      "Contrôles facture & coûts instantanés",
      "Veille personnalisée réservée VIP",
    ],
    servicesLabel: "Services",
    servicesTitle: "Audit, conformité, veille personnalisée",
    servicesSubtitle:
      "Nous accompagnons chaque exportateur : audit express, supervision continue et support réglementaire.",
    serviceCta: "Demander un audit",
    serviceCards: [
      {
        title: "Audit express",
        description: "Contrôle complet HS, documents et taxes avant embarquement.",
        detail: "Livraison en 48h, rapport actionnable.",
      },
      {
        title: "Support conformité",
        description: "Sanctions, licences, restrictions spécifiques par pays.",
        detail: "Équipe dédiée pour vos zones critiques.",
      },
      {
        title: "Veille & alertes (VIP)",
        description: "Signaux réglementaires et douaniers sur vos pays & HS clés.",
        detail: "Accès outil réservé VIP.",
      },
    ],
    toolsLabel: "Tools",
    toolsTitle: "Nous mettons des outils à disposition",
    toolsSubtitle: "Analyse et contrôle rapide accessibles. Veille personnalisée réservée VIP.",
    tools: [
      {
        title: "Analyse export",
        description: "Simule le landed cost, documents requis et risques par HS.",
        actionLabel: "Ouvrir",
        action: { type: "link", href: "/analyse" },
      },
      {
        title: "Contrôle rapide",
        description: "Estimez un risque à la volée et téléchargez un PDF.",
        actionLabel: "Ouvrir",
        action: { type: "scroll", targetId: "quick-control" },
      },
      {
        title: "Veille premium (VIP)",
        description: "Alertes sanctions & réglementations ciblées (réservé VIP).",
        actionLabel: "Voir l’offre VIP",
        action: { type: "link", href: "/pricing#vip" },
      },
    ],
  },
  en: {
    heroTagline: "MPL Export Conseil Services",
    heroTitle: "We help you secure your exports across borders.",
    heroSubtitle:
      "Our team audits tariffs, documents and sanctions, then unlocks clear tools so you can act swiftly.",
    heroPrimary: "Book an express validation",
    heroSecondary: "Discover the tools",
    heroTrust: [
      "Free control PDF (on request)",
      "Instant invoice & cost checks",
      "Tailored watch is VIP-only",
    ],
    servicesLabel: "Services",
    servicesTitle: "Audit, compliance & tailored monitoring",
    servicesSubtitle:
      "We support exporters with speedy audits, continuous supervision and regulatory guidance.",
    serviceCta: "Request an audit",
    serviceCards: [
      {
        title: "Express audit",
        description: "HS, duties and documents checked before shipment.",
        detail: "48h delivery with actionable report.",
      },
      {
        title: "Compliance support",
        description: "Sanctions, licenses and country-specific restrictions.",
        detail: "Dedicated team for sensitive routes.",
      },
      {
        title: "Monitoring & alerts (VIP)",
        description: "Regulatory signals for your priority markets and HS codes.",
        detail: "VIP tool access only.",
      },
    ],
    toolsLabel: "Tools",
    toolsTitle: "We put tools at your disposal",
    toolsSubtitle: "Analysis and quick checks available. Tailored monitoring is VIP-only.",
    tools: [
      {
        title: "Export analysis",
        description: "Simulate landed cost, documents, and risks per HS.",
        actionLabel: "Open",
        action: { type: "link", href: "/analyse" },
      },
      {
        title: "Quick control",
        description: "Estimate a risk in seconds and download a PDF.",
        actionLabel: "Open",
        action: { type: "scroll", targetId: "quick-control" },
      },
      {
        title: "Premium watch (VIP)",
        description: "Sanctions & regulations alerts tailored to your markets (VIP only).",
        actionLabel: "See VIP plan",
        action: { type: "link", href: "/pricing#vip" },
      },
    ],
  },
};

function normalizeStr(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function confidenceLabel(c?: "low" | "medium" | "high") {
  if (!c) return "—";
  if (c === "high") return "Haute";
  if (c === "medium") return "Moyenne";
  return "Faible";
}

function riskLabel(lvl: "low" | "medium" | "high") {
  if (lvl === "high") return "Élevé";
  if (lvl === "medium") return "Moyen";
  return "Faible";
}

function riskPillClass(lvl: "low" | "medium" | "high") {
  if (lvl === "high") return "border-red-300 bg-red-500/15 text-red-50";
  if (lvl === "medium") return "border-amber-300 bg-amber-500/15 text-amber-50";
  return "border-emerald-300 bg-emerald-500/15 text-emerald-50";
}

function toNumberSafe(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function extractIso2FromDestinationText(
  text: string,
  countries: Array<{ label: string; iso2: string }>
): { iso2: string; label: string } | null {
  const raw = (text || "").trim();
  if (!raw) return null;

  // "Pays (XX)"
  const m = raw.match(/\(([A-Za-z]{2})\)\s*$/);
  if (m?.[1]) {
    const iso2 = m[1].toUpperCase();
    const found = countries.find((c) => c.iso2 === iso2);
    return { iso2, label: found?.label || iso2 };
  }

  // "US"
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const iso2 = raw.toUpperCase();
    const found = countries.find((c) => c.iso2 === iso2);
    return { iso2, label: found?.label || iso2 };
  }

  // match label exact (accents tolérés)
  const n = normalizeStr(raw);
  const found = countries.find((c) => normalizeStr(c.label) === n);
  if (found) return { iso2: found.iso2, label: found.label };

  // match begins-with
  const found2 = countries.find((c) => normalizeStr(c.label).startsWith(n));
  if (found2) return { iso2: found2.iso2, label: found2.label };

  return null;
}

function getTreatyNotesForCountry(iso2: string) {
  const code = (iso2 || "").toUpperCase();
  if (!code) return [];

  if (EU_ISO2.has(code)) {
    return [
      {
        title: "Spécificité UE (intra-UE)",
        items: [
          "Destination dans l’UE : pas de droits de douane (ce n’est pas une exportation au sens douanier).",
          "Vérifier TVA intracom, exigences de facturation, et obligations statistiques (ex: Intrastat/DEB selon cas).",
        ],
      },
    ];
  }

  if (code === "GB") {
    return [
      {
        title: "UE ↔ Royaume-Uni",
        items: [
          "Préférences possibles (droits réduits/0) si règles d’origine respectées (à vérifier au cas réel).",
          "Déclaration douanière requise + attention TVA/UK VAT selon schéma.",
        ],
      },
    ];
  }

  if (code === "CH") {
    return [
      {
        title: "UE ↔ Suisse",
        items: [
          "Préférences possibles selon règles d’origine (à valider au cas réel).",
          "Procédures douanières et documents à sécuriser (origine, valeur, incoterms).",
        ],
      },
    ];
  }

  if (code === "CA") {
    return [
      {
        title: "UE ↔ Canada",
        items: [
          "Préférences possibles selon règles d’origine (à valider au cas réel).",
          "Vérifier la preuve d’origine et les conditions d’éligibilité.",
        ],
      },
    ];
  }

  if (code === "JP") {
    return [
      {
        title: "UE ↔ Japon",
        items: [
          "Préférences possibles selon règles d’origine (à valider au cas réel).",
          "Points sensibles : classification HS, origine et documents.",
        ],
      },
    ];
  }

  if (code === "US") {
    return [
      {
        title: "UE ↔ États-Unis",
        items: [
          "Pas d’accord préférentiel général : droits applicables selon HS/réglementation US.",
          "Vérifier conformité produit (étiquetage, normes, licences selon cas).",
        ],
      },
    ];
  }

  return [
    {
      title: "Traités & préférences",
      items: [
        "Selon le pays, des préférences tarifaires peuvent exister (accords, régimes préférentiels) : cela dépend du produit et de l’origine.",
        "Pour une validation “zéro surprise”, demande une validation express (documents, origine, incoterms).",
      ],
    },
  ];
}

export default function LeadMagnet() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [productOrHs, setProductOrHs] = React.useState("");
  const [hsSuggestions, setHsSuggestions] = React.useState<HsSuggestion[]>([]);

  const [destinationIso2, setDestinationIso2] = React.useState("");
  const [destinationLabel, setDestinationLabel] = React.useState("");
  const [destinationText, setDestinationText] = React.useState("");

  const [value, setValue] = React.useState("10000");
  const [currency, setCurrency] = React.useState("EUR");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [mode, setMode] = React.useState("sea");
  const [weightKg, setWeightKg] = React.useState("");
  const [insurance, setInsurance] = React.useState("");

  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);

  const [loadingEstimate, setLoadingEstimate] = React.useState(false);
  const [loadingPdf, setLoadingPdf] = React.useState(false);

  const [result, setResult] = React.useState<BriefResponse | null>(null);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [lang, setLang] = React.useState<"fr" | "en">("fr");
  const copy = COPY[lang];

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "fr" || stored === "en") {
      setLang(stored);
    }
  }, []);

  const handleLangChange = (next: "fr" | "en") => {
    if (next === lang) return;
    setLang(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    }
  };

  const scrollToId = (id: string) => {
    if (typeof window === "undefined") return;
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // ✅ HS detection fiable
  const normalizedInput = productOrHs.trim();
  const hsOnly = /^[0-9]{2,6}$/.test(normalizedInput);
  const inferredHs = hsOnly ? normalizedInput : "";
  const inferredProduct = hsOnly ? "" : normalizedInput;

  // ✅ Tous les pays (support navigateur) sinon fallback
  const allCountries = React.useMemo(() => {
    try {
      const supported = (Intl as any).supportedValuesOf?.("region") as string[] | undefined;
      if (!supported?.length) return COUNTRIES_FALLBACK;

      const dn = new Intl.DisplayNames(["fr"], { type: "region" });
      const list = supported
        .filter((code) => /^[A-Z]{2}$/.test(code))
        .map((iso2) => ({ iso2, label: dn.of(iso2) || iso2 }))
        .filter((c) => c.label && c.label !== c.iso2);

      const map = new Map<string, string>();
      for (const c of list) map.set(c.iso2, c.label);

      const arr = Array.from(map.entries()).map(([iso2, label]) => ({ iso2, label }));
      arr.sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
      return arr.length ? arr : COUNTRIES_FALLBACK;
    } catch {
      return COUNTRIES_FALLBACK;
    }
  }, []);

  const topCountries = React.useMemo(() => {
    const m = new Map(allCountries.map((c) => [c.iso2, c]));
    return TOP_COUNTRY_ISO2.map((iso2) => m.get(iso2)).filter(Boolean) as Array<{ iso2: string; label: string }>;
  }, [allCountries]);

  // ✅ init storage
  React.useEffect(() => {
    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (rawHistory) setHistory(JSON.parse(rawHistory));
    } catch {
      setHistory([]);
    }

    const storedEmail = localStorage.getItem(EMAIL_KEY);
    if (storedEmail) setEmail(storedEmail);
  }, []);

  // ✅ suggestions HS / produit
  React.useEffect(() => {
    const query = productOrHs.trim();
    if (query.length < 2) {
      setHsSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/hs/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        setHsSuggestions(
          items
            .map((item: any) => ({
              code: String(item?.code || "").trim(),
              label: String(item?.label || "").trim(),
            }))
            .filter((item: HsSuggestion) => item.code),
        );
      } catch (err: any) {
        if (err?.name !== "AbortError") setHsSuggestions([]);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [productOrHs]);

  const syncDestinationFromText = (text: string) => {
    setDestinationText(text);
    const parsed = extractIso2FromDestinationText(text, allCountries);
    if (parsed) {
      setDestinationIso2(parsed.iso2);
      setDestinationLabel(parsed.label);
    } else {
      setDestinationIso2("");
      setDestinationLabel("");
    }
  };

  const selectCountry = (iso2: string, label: string) => {
    setDestinationIso2(iso2);
    setDestinationLabel(label);
    setDestinationText(`${label} (${iso2})`);
  };

  const handleEstimate = async () => {
    if (!normalizedInput) {
      toast({ title: "Saisie requise", description: "Saisis un produit ou un code HS (2 à 6 chiffres)." });
      return;
    }
    if (!destinationIso2) {
      toast({ title: "Pays requis", description: "Sélectionne un pays (ou clique sur un pays recommandé)." });
      return;
    }

    setLoadingEstimate(true);
    try {
      const payload: ExportBriefPayload = {
        hsInput: inferredHs || undefined,
        productText: inferredProduct || undefined,
        destinationIso2,
        value: toNumberSafe(value),
        currency,
        incoterm,
        mode,
        weightKg: weightKg ? toNumberSafe(weightKg) : null,
        insurance: insurance ? toNumberSafe(insurance) : null,
      };

      const res = await fetch("/api/export/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok || raw?.ok === false) {
        throw new Error(raw?.error || "Impossible de calculer.");
      }

      // support formats backend {result} ou {data} ou direct
      const brief: BriefResponse = (raw?.result ?? raw?.data ?? raw) as BriefResponse;

      setResult(brief);

      const entry: HistoryEntry = { payload, result: brief };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, MAX_HISTORY);
        localStorage.setItem(LAST_SIM_KEY, JSON.stringify(entry));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err: any) {
      toast({ title: "Erreur estimation", description: err?.message || "Impossible de calculer." });
    } finally {
      setLoadingEstimate(false);
    }
  };

  const handleLeadAndPdf = async () => {
    if (!result) {
      toast({ title: "Calcule d'abord", description: "Lance l'estimation avant de générer le rapport." });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast({ title: "Email requis", description: "Ajoute un email pour recevoir le PDF." });
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast({ title: "Email invalide", description: "Vérifie le format de ton email." });
      return;
    }
    if (!consent) {
      toast({ title: "Consentement requis", description: "Coche la case RGPD pour continuer." });
      return;
    }

    setLoadingPdf(true);
    try {
      await postLead({
        email: trimmedEmail,
        consent,
        simulationId: result.simulationId,
        metadata: {
          hsInput: inferredHs || undefined,
          productText: inferredProduct || undefined,
          destinationIso2,
          incoterm,
          value: toNumberSafe(value),
          currency,
          mode,
        },
      });

      localStorage.setItem(EMAIL_KEY, trimmedEmail);

      const pdfBlob = await postPdf({
        title: "Rapport de contrôle export",
        email: trimmedEmail,
        destination: destinationLabel || destinationIso2,
        incoterm,
        value: toNumberSafe(value),
        currency,
        score: clamp(Number(result.complianceScore ?? 0), 0, 100),
        result: {
          landedCost: {
            duty: result.estimate.duty,
            taxes: result.estimate.taxes,
            total: result.estimate.total,
            currency: result.estimate.currency,
          },
        },
      });

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-rapport-export-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Rapport généré",
        description: "Le PDF est téléchargé. Pour la veille premium, découvrez l’offre VIP.",
      });

      // ✅ cohérent avec “veille réservée VIP”
      navigate("/pricing?from=leadmagnet#vip");
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible de finaliser." });
    } finally {
      setLoadingPdf(false);
    }
  };

  const reuseHistory = (entry: HistoryEntry) => {
    const p = entry.payload;

    setProductOrHs(p.hsInput || p.productText || "");

    const iso2 = p.destinationIso2 || "";
    const label = allCountries.find((c) => c.iso2 === iso2)?.label || iso2;

    setDestinationIso2(iso2);
    setDestinationLabel(label);
    setDestinationText(label ? `${label} (${iso2})` : iso2);

    setValue(String(p.value ?? ""));
    setCurrency(p.currency || "EUR");
    setIncoterm(p.incoterm || "DAP");
    setMode(p.mode || "sea");
    setWeightKg(p.weightKg ? String(p.weightKg) : "");
    setInsurance(p.insurance ? String(p.insurance) : "");

    setResult(entry.result);
  };

  const clearHistory = () => {
    const confirmed = window.confirm("Supprimer l'historique des simulations ?");
    if (!confirmed) return;
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(LAST_SIM_KEY);
    setHistory([]);
  };

  const downloadHistoryReport = async (entry: HistoryEntry) => {
    setLoadingPdf(true);
    try {
      const iso2 = entry.payload?.destinationIso2;
      const label = allCountries.find((c) => c.iso2 === iso2)?.label || iso2 || "Destination";

      const pdfBlob = await postPdf({
        title: "Rapport de contrôle export",
        destination: label,
        incoterm: entry.payload?.incoterm,
        value: entry.payload?.value,
        currency: entry.payload?.currency,
        score: clamp(Number(entry.result.complianceScore ?? 0), 0, 100),
        result: {
          landedCost: {
            duty: entry.result.estimate.duty,
            taxes: entry.result.estimate.taxes,
            total: entry.result.estimate.total,
            currency: entry.result.estimate.currency,
          },
        },
      });

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mpl-rapport-export-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erreur PDF", description: err?.message || "Impossible de générer le rapport." });
    } finally {
      setLoadingPdf(false);
    }
  };

  const score = clamp(Number(result?.complianceScore ?? 0), 0, 100);

  const treatyBlocks =
    result?.countryNotes?.length
      ? result.countryNotes
      : destinationIso2
        ? getTreatyNotesForCountry(destinationIso2)
        : [];

  return (
    <PublicLayout>
      <section className="rounded-3xl border border-border bg-card/90 p-8 md:p-10 shadow-xl">
        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{copy.heroTagline}</p>
            <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">{copy.heroTitle}</h1>
            <p className="text-lg text-foreground/70">{copy.heroSubtitle}</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate("/contact?offer=express")}>
                {copy.heroPrimary}
              </Button>
              <Button
                variant="outline"
                className="border-border text-foreground hover:border-primary hover:text-primary"
                onClick={() => scrollToId("tools")}
              >
                {copy.heroSecondary}
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {copy.heroTrust.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-muted/70 px-3 py-1 text-xs font-medium text-foreground/80"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.35em] text-muted-foreground">
            <span>Langue</span>
            <div className="flex gap-1 rounded-full bg-background p-1">
              {(["fr", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLangChange(code)}
                  className={`px-3 py-1 text-sm font-semibold transition ${
                    lang === code
                      ? "rounded-full bg-foreground text-background"
                      : "rounded-full text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-3xl border border-border bg-card p-8 md:p-10 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{copy.servicesLabel}</p>
            <h2 className="text-3xl font-semibold text-foreground">{copy.servicesTitle}</h2>
            <p className="text-foreground/70">{copy.servicesSubtitle}</p>
          </div>
          <Button asChild variant="secondary">
            <Link to="/contact?offer=audit">{copy.serviceCta}</Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {copy.serviceCards.map((card) => (
            <article key={card.title} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 text-foreground shadow-sm">
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="text-sm text-foreground/70">{card.description}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="tools" className="mt-10 rounded-3xl border border-border bg-card p-8 md:p-10 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">{copy.toolsLabel}</p>
          <h2 className="mt-1 text-3xl font-semibold text-foreground">{copy.toolsTitle}</h2>
          <p className="text-foreground/70">{copy.toolsSubtitle}</p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {copy.tools.map((tool) => (
            <article key={tool.title} className="flex flex-col gap-4 rounded-2xl border border-border bg-background/60 p-4 text-foreground shadow-sm">
              <div>
                <h3 className="text-lg font-semibold">{tool.title}</h3>
                <p className="mt-2 text-sm text-foreground/70">{tool.description}</p>
              </div>
              {tool.action.type === "link" ? (
                <Button asChild variant="outline" className="border-border text-foreground hover:border-primary">
                  <Link to={tool.action.href}>{tool.actionLabel}</Link>
                </Button>
              ) : (
                <Button variant="outline" className="border-border text-foreground hover:border-primary" onClick={() => scrollToId(tool.action.targetId)}>
                  {tool.actionLabel}
                </Button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section id="quick-control" className="mt-10 rounded-3xl border border-border bg-card/90 p-6 md:p-10 shadow-xl">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.95fr] lg:items-start">
          <div className="space-y-6 text-white">
            <p className="text-xs uppercase tracking-[0.4em] text-blue-200">Audit • Réglementation • Veille (VIP)</p>

            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Votre contrôle export en 30 secondes.
            </h1>

            <p className="text-lg text-slate-200">
              Estimation droits/taxes, documents requis et risques sanctions. Téléchargez un PDF MPL.
              <span className="block mt-2 text-sm text-slate-200/90">
                Veille personnalisée dans l’outil : <span className="font-semibold">réservée VIP</span> (voir l’offre).
              </span>
            </p>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate("/contact?offer=express")}>
                Demander une validation express
              </Button>
              <Button variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => navigate("/pricing#vip")}>
                Voir l’offre VIP
              </Button>
            </div>

            <div className="text-xs text-white/70">
              Besoin d’un accompagnement ?{" "}
              <button
                type="button"
                className="underline hover:opacity-90"
                onClick={() => navigate("/contact?offer=express")}
              >
                Demander une validation express
              </button>
              .
            </div>
          </div>

          {/* FORM */}
          <Card className="border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
            <CardContent className="space-y-4 p-7 md:p-8">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="productOrHs">Produit ou code HS</Label>
                  <Input
                    id="productOrHs"
                    value={productOrHs}
                    onChange={(e) => setProductOrHs(e.target.value)}
                    placeholder="Ex : cosmétique ou 3004"
                    list="hs-list"
                    className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
                  />
                  <datalist id="hs-list">
                    {hsSuggestions.map((item) => (
                      <option key={item.code} value={item.code} label={item.label || item.code} />
                    ))}
                  </datalist>
                  <div className="text-xs text-white/70">
                    Astuce : tape un HS (2–6 chiffres) pour forcer la recherche HS, sinon on traite comme “produit”.
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="destination">Destination</Label>
                    <span className="text-xs text-white/70">recommandés + recherche</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {topCountries.map((c) => (
                      <button
                        key={c.iso2}
                        type="button"
                        onClick={() => selectCountry(c.iso2, c.label)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          destinationIso2 === c.iso2
                            ? "border-white/40 bg-white/20 text-white"
                            : "border-white/20 bg-white/10 text-white"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <Input
                    id="destination"
                    value={destinationText}
                    onChange={(e) => syncDestinationFromText(e.target.value)}
                    placeholder='Ex : "Suisse" ou "Suisse (CH)"'
                    list="countries-list"
                    className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
                  />
                  <datalist id="countries-list">
                    {allCountries.map((c) => (
                      <option key={c.iso2} value={`${c.label} (${c.iso2})`} />
                    ))}
                  </datalist>

                  {!destinationIso2 && destinationText ? (
                    <div className="text-xs text-white/70">
                      Sélectionne une proposition (ex : “Suisse (CH)”) pour valider le pays.
                    </div>
                  ) : destinationIso2 ? (
                    <div className="text-xs text-white/70">
                      Pays sélectionné :{" "}
                      <span className="font-semibold text-white">{destinationLabel}</span> ({destinationIso2})
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Valeur marchandise</Label>
                  <Input
                    id="value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    type="number"
                    className="border-white/20 bg-white/90 text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Incoterm</Label>
                  <Select value={incoterm} onValueChange={setIncoterm}>
                    <SelectTrigger className="border-white/20 bg-white/90 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXW">EXW</SelectItem>
                      <SelectItem value="FCA">FCA</SelectItem>
                      <SelectItem value="DAP">DAP</SelectItem>
                      <SelectItem value="DDP">DDP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="advanced">
                  <AccordionTrigger className="text-white">Options avancées</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Devise</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger className="border-white/20 bg-white/90 text-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Mode transport</Label>
                        <Select value={mode} onValueChange={setMode}>
                          <SelectTrigger className="border-white/20 bg-white/90 text-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="air">Air</SelectItem>
                            <SelectItem value="sea">Maritime</SelectItem>
                            <SelectItem value="road">Route</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Poids (kg)</Label>
                        <Input
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          type="number"
                          className="border-white/20 bg-white/90 text-slate-900"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Assurance (montant)</Label>
                        <Input
                          value={insurance}
                          onChange={(e) => setInsurance(e.target.value)}
                          type="number"
                          className="border-white/20 bg-white/90 text-slate-900"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button onClick={handleEstimate} disabled={loadingEstimate} className="w-full">
                {loadingEstimate ? "Calcul en cours..." : "Calculer mon contrôle export"}
              </Button>

              <p className="text-xs text-slate-200">
                Résultat immédiat, sans email. L'email sert uniquement à recevoir le PDF (et, si vous le souhaitez, la newsletter).
                <span className="block mt-1">
                  La veille personnalisée dans l’outil est réservée au <span className="font-semibold">VIP</span>.
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* RESULT + PDF */}
      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur-xl">
          <CardContent className="p-7 md:p-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-200">Résumé</div>
                <div className="text-2xl font-semibold md:text-3xl">Estimation & conformité</div>
              </div>
              <div className="text-xs text-slate-200">
                Dernière mise à jour : {result?.updatedAt ? formatDateTimeFr(result.updatedAt) : "—"}
              </div>
            </div>

            {!result ? (
              <p className="mt-4 text-sm text-slate-200">
                Saisis un HS/produit + pays, puis clique sur “Calculer”.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase text-slate-200">Score conformité</div>
                      <div className="text-lg font-semibold text-white">{score}/100</div>
                    </div>
                    <div className="text-xs text-slate-200">
                      Confiance : <span className="font-semibold text-white">{confidenceLabel(result.confidence)}</span>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-white/15">
                    <div className="h-2 rounded-full bg-white/70" style={{ width: `${score}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                    <div className="text-xs text-slate-200">Droits estimés</div>
                    <div className="text-lg font-semibold text-white">
                      {result.estimate.duty.toFixed(0)} {result.estimate.currency}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                    <div className="text-xs text-slate-200">Taxes estimées</div>
                    <div className="text-lg font-semibold text-white">
                      {result.estimate.taxes.toFixed(0)} {result.estimate.currency}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/20 p-3 text-white">
                    <div className="text-xs text-slate-100">Total estimé</div>
                    <div className="text-lg font-semibold">
                      {result.estimate.total.toFixed(0)} {result.estimate.currency}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase text-slate-200">Documents requis</div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-200">
                      {result.documents.map((doc) => (
                        <li key={doc}>{doc}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-slate-200">Risques</div>
                    <ul className="mt-2 space-y-2 text-sm text-slate-100">
                      {result.risks.map((risk) => (
                        <li key={risk.title} className="rounded-lg border border-white/15 bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-white">{risk.title}</div>
                            <span className={`rounded-full border px-2 py-1 text-[11px] ${riskPillClass(risk.level)}`}>
                              {riskLabel(risk.level)}
                            </span>
                          </div>
                          <div className="mt-1 text-slate-200">{risk.message}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {treatyBlocks.length > 0 && (
                  <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <div className="text-xs uppercase text-slate-200">Traités & spécificités pays (indication)</div>
                    <div className="mt-3 space-y-3">
                      {treatyBlocks.map((b) => (
                        <div key={b.title}>
                          <div className="font-semibold text-white">{b.title}</div>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-200">
                            {b.items.map((it) => (
                              <li key={it}>{it}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => navigate(`/contact?offer=express&country=${destinationIso2}`)}
                      >
                        Valider avec un expert (express)
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white text-white hover:bg-white/10"
                        onClick={() => navigate(`/contact?offer=audit&country=${destinationIso2}`)}
                      >
                        Audit complet
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white text-white hover:bg-white/10"
                        onClick={() => navigate(`/pricing#vip`)}
                      >
                        Veille premium (VIP)
                      </Button>
                    </div>

                    <div className="mt-2 text-xs text-white/70">
                      Indications à confirmer selon (produit + HS + origine + incoterm).
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
                  Confiance : {result.confidence} — Sources : {result.sources?.join(", ") || "Règles internes"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/15 bg-white/10 text-white backdrop-blur-xl">
          <CardContent className="space-y-4 p-7 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Recevoir le rapport PDF (gratuit)</div>
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/90">
                Veille outil = VIP
              </span>
            </div>

            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email professionnel"
              className="border-white/20 bg-white/90 text-slate-900 placeholder:text-slate-500"
            />

            <label className="flex items-start gap-2 text-xs text-slate-200">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
              <span>
                J'accepte de recevoir le rapport PDF et des informations MPL (RGPD).{" "}
                <Link className="underline hover:opacity-90" to="/confidentialite">
                  Politique de confidentialité
                </Link>
                .
              </span>
            </label>

            <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
              La veille personnalisée dans l’outil est réservée au <span className="font-semibold text-white">VIP</span>.{" "}
              <button type="button" className="underline hover:opacity-90" onClick={() => navigate("/pricing#vip")}>
                Voir l’offre VIP
              </button>
              .
            </div>

            <Button
              onClick={handleLeadAndPdf}
              disabled={loadingEstimate || loadingPdf || !result}
              className="w-full"
            >
              {loadingPdf ? "Génération..." : "Télécharger le PDF"}
            </Button>

            {!result ? (
              <div className="text-xs text-white/70">
                Lance une estimation pour activer la génération du PDF.
              </div>
            ) : null}

            <div className="pt-2">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase text-slate-200">Historique</div>
                {history.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white text-white hover:bg-white/10"
                    onClick={clearHistory}
                  >
                    Effacer
                  </Button>
                ) : null}
              </div>

              {history.length === 0 ? (
                <div className="text-sm text-slate-200">Aucune simulation récente.</div>
              ) : (
                <div className="space-y-2">
                  {history.map((entry, idx) => {
                    const p = entry.payload;
                    return (
                      <div key={`${p.destinationIso2}-${idx}`} className="rounded-lg border border-white/15 bg-white/5 p-2 text-xs">
                        <div className="font-semibold text-white">
                          {p.destinationIso2 || "Pays"} —{" "}
                          {p.hsInput ? `HS ${p.hsInput}` : p.productText ? `Produit: ${p.productText}` : "Saisie: n/a"}
                        </div>
                        <div className="text-slate-200">
                          {p.value || 0} {p.currency || "EUR"} • {entry.result?.estimate?.total?.toFixed?.(0) ?? "—"}{" "}
                          {entry.result?.estimate?.currency ?? ""}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white text-white hover:bg-white/10"
                            onClick={() => reuseHistory(entry)}
                          >
                            Réutiliser
                          </Button>
                          <Button size="sm" onClick={() => downloadHistoryReport(entry)} disabled={loadingPdf}>
                            PDF
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* BENEFITS */}
      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-blue-200">Ce que vous obtenez</div>
          <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-slate-200">
            <li>Estimation droits & taxes</li>
            <li>Documents requis par pays</li>
            <li>Risques sanctions & conformité</li>
            <li>Rapport PDF brand MPL</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-blue-200">Comment ça marche</div>
          <ol className="mt-4 space-y-2 text-sm text-slate-200">
            <li>1. Saisis HS/produit + pays</li>
            <li>2. Obtiens estimation & alertes</li>
            <li>3. Télécharge le rapport PDF</li>
          </ol>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-white backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.24em] text-blue-200">Veille premium (VIP)</div>
          <p className="mt-4 text-sm text-slate-200">
            Alertes sanctions, réglementations et signaux par destination/HS. Accès via l’offre VIP (outil de veille personnalisé).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="border-white text-white hover:bg-white/10"
              variant="outline"
              onClick={() => navigate("/pricing#vip")}
            >
              Découvrir l’offre VIP
            </Button>
            <Button
              className="border-white text-white hover:bg-white/10"
              variant="outline"
              onClick={() => navigate("/newsletter")}
            >
              Newsletter veille (gratuite)
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="force-white mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-700 via-blue-900 to-red-600 p-6 text-white md:flex-row md:items-center">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-white/70">Besoin d'une validation ?</div>
          <div className="text-2xl font-semibold">Demandez un audit complet ou une validation express.</div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/contact?offer=express")}>
            Validation express
          </Button>
          <Button
            variant="outline"
            className="border-white text-white hover:bg-white/10"
            onClick={() => navigate("/pricing#vip")}
          >
            Veille premium (VIP)
          </Button>
        </div>
      </section>

      <div className="mt-8 text-center text-xs text-slate-300">
        <Link to="/mentions-legales" className="underline underline-offset-4 hover:opacity-90">
          Mentions légales
        </Link>{" "}
        ·{" "}
        <Link to="/confidentialite" className="underline underline-offset-4 hover:opacity-90">
          Confidentialité
        </Link>{" "}
        ·{" "}
        <Link to="/cookies" className="underline underline-offset-4 hover:opacity-90">
          Cookies
        </Link>
      </div>
    </PublicLayout>
  );
}
