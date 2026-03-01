import * as React from "react";
import { AlertTriangle, Bot, ExternalLink, Loader2, Send } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { buildGuidedFallback, type GuidedFallback } from "@/lib/chatGuidance";
import { ingestChatExchange } from "@/lib/chatIngest";
import { detectCountryFromShortInput } from "@/lib/countryInput";
import { resolveCountryIso2 } from "@/lib/copilot/officialLinks";
import { countryFunnelAnalysis } from "@/services/supabaseAI";

type ChatDocument = {
  name: string;
  required: boolean;
  source_url: string | null;
};

type ChatDossier = {
  summary: string;
  documents: ChatDocument[];
  restrictions: string[];
  sanctions: string[];
  taxes: string[];
  logistics: string[];
  contract: { clauses: string[] };
  next_actions: string[];
};

type ChatCheck = {
  id: string;
  label: string;
  status: "OK" | "A_CONFIRMER" | "MANQUANT" | "KO";
  explanation: string;
  what_to_fix: string;
  example_mention?: string;
  fieldPath?: string;
  source_link?: string;
};

type ChatDecision = {
  status: "GO" | "NO_GO" | "SOUS_CONDITIONS";
  reason: string;
};

type ChatResponse = {
  ok?: boolean;
  error?: string;
  detail?: string;
  thread_id?: string;
  session_id?: string;
  answer?: string;
  answer_markdown?: string;
  mode?: string;
  missing_questions?: string[];
  follow_up_questions?: string[];
  source_links?: Array<{ title: string; url: string }>;
  dossier?: ChatDossier;
  checks?: ChatCheck[];
  main_blocker?: ChatCheck | null;
  decision?: ChatDecision;
};

type QuotaResponse = {
  ok?: boolean;
  limit?: number;
  used?: number;
  remaining?: number;
  error?: string;
  detail?: string;
};

type AssistantBlocks = {
  summary: string[];
  checklist: Array<{ label: string; required: boolean }>;
  risks: string[];
  documents: ChatDocument[];
  actions: string[];
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: Array<{ title: string; url: string }>;
  followUpQuestions?: string[];
  blocks?: AssistantBlocks;
  checks?: ChatCheck[];
  mainBlocker?: ChatCheck | null;
  decision?: ChatDecision;
};

type FollowUpAction = {
  label: string;
  value: string;
};

type CopilotFormContext = {
  sellerCountry: string;
  buyerCountry: string;
};

type GuidedFormValues = {
  flow: "export" | "import" | "unknown";
  goodsOrServices: "goods" | "services" | "unknown";
  origin: string;
  destination: string;
  productOrHs: string;
  incoterm: string;
  buyerIsTaxable: "yes" | "no" | "unknown";
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const COUNTRY_FOLLOWUP_RE = /(quel est le pays|pays de destination|destination exact)/i;
const COUNTRY_MISSING_RE = /(pays.*(a confirmer|manquant)|quel est le pays de destination|destination exacte)/i;
const COUNTRY_OVERRIDE_KEYS = {
  seller: ["sellerCountry", "seller_country", "origin", "from"],
  buyer: ["buyerCountry", "buyer_country", "destination", "to", "country"],
} as const;

const GENERAL_UNKNOWN_PROMPT =
  "Je ne sais pas encore les details (pays/produit/incoterm). Donne une reponse generale import/export: regles de base TVA/douane, risques majeurs, documents standards et 3 prochaines actions simples.";

function isUncertainAnswer(answer: string) {
  const txt = answer.trim().toLowerCase();
  if (!txt) return true;
  if (txt.length < 40) return true;
  if (/(pas de reponse|indisponible|erreur|vide|reessaye|reessaie)/i.test(txt)) return true;
  return false;
}

function statusLabel(status: ChatCheck["status"]) {
  switch (status) {
    case "KO":
      return "KO";
    case "MANQUANT":
      return "Manquant";
    case "A_CONFIRMER":
      return "A confirmer";
    default:
      return "OK";
  }
}

function normalizePrompt(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveMainBlocker(checks: ChatCheck[] | undefined) {
  if (!checks?.length) return null;
  const byPriority = [...checks].sort((a, b) => {
    const rank = (status: ChatCheck["status"]) => {
      if (status === "KO") return 4;
      if (status === "MANQUANT") return 3;
      if (status === "A_CONFIRMER") return 2;
      return 1;
    };
    return rank(b.status) - rank(a.status);
  });
  return byPriority.find((check) => check.status === "KO") || byPriority.find((check) => check.status === "MANQUANT") || null;
}

function buildAssistantBlocks(dossier: ChatDossier | undefined): AssistantBlocks | undefined {
  if (!dossier) return undefined;

  const summary = String(dossier.summary || "")
    .split("\n")
    .map((line) => line.replace(/^[-\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  const checklist = (Array.isArray(dossier.documents) ? dossier.documents : [])
    .map((doc) => ({ label: doc.name || "Document", required: Boolean(doc.required) }))
    .slice(0, 8);

  const risks = [
    ...(Array.isArray(dossier.restrictions) ? dossier.restrictions : []),
    ...(Array.isArray(dossier.sanctions) ? dossier.sanctions : []),
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const documents = (Array.isArray(dossier.documents) ? dossier.documents : [])
    .filter((doc) => doc && typeof doc === "object")
    .slice(0, 8);

  const actions = (Array.isArray(dossier.next_actions) ? dossier.next_actions : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!summary.length && !checklist.length && !risks.length && !documents.length && !actions.length) {
    return undefined;
  }

  return { summary, checklist, risks, documents, actions };
}

function buildAssistantBlocksFromGuided(guided: GuidedFallback): AssistantBlocks | undefined {
  const blocks = guided.blocks;
  if (!blocks) return undefined;

  const summary = Array.isArray(blocks.summary) ? blocks.summary.slice(0, 3) : [];
  const checklist = Array.isArray(blocks.checklist) ? blocks.checklist.slice(0, 8) : [];
  const risks = Array.isArray(blocks.risks) ? blocks.risks.slice(0, 8) : [];
  const actions = Array.isArray(blocks.actions) ? blocks.actions.slice(0, 8) : [];

  if (!summary.length && !checklist.length && !risks.length && !actions.length) {
    return undefined;
  }

  return {
    summary,
    checklist,
    risks,
    documents: [],
    actions,
  };
}

function isLikelyCountryOnlyPrompt(question: string, detectedCountry: string | null) {
  if (!detectedCountry) return false;

  const normalizedQuestion = normalizePrompt(question);
  const normalizedCountry = normalizePrompt(detectedCountry);
  if (!normalizedQuestion || !normalizedCountry) return false;

  if (normalizedQuestion.split(" ").length <= 3) {
    return normalizedQuestion.includes(normalizedCountry);
  }

  const stripped = normalizedQuestion
    .replace(/\b(destination|pays|vers|pour|to|export|import)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped === normalizedCountry;
}

function normalizeCountryOverride(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const directIso2 = resolveCountryIso2(raw);
  if (directIso2) return directIso2;
  const detected = detectCountryFromShortInput(raw);
  if (!detected) return null;
  return resolveCountryIso2(detected);
}

function pickObjectText(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const object = value as Record<string, unknown>;
  for (const key of keys) {
    const text = String(object[key] ?? "").trim();
    if (text) return text;
  }
  return "";
}

function readFormContext(): CopilotFormContext {
  if (typeof window === "undefined") return { sellerCountry: "", buyerCountry: "" };

  const fromQuery = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        sellerCountry: String(params.get("sellerCountry") || params.get("seller_country") || params.get("origin") || params.get("from") || "").trim(),
        buyerCountry: String(params.get("buyerCountry") || params.get("buyer_country") || params.get("destination") || params.get("to") || params.get("country") || "").trim(),
      };
    } catch {
      return { sellerCountry: "", buyerCountry: "" };
    }
  })();

  const fromStorage = (() => {
    try {
      const raw = window.localStorage.getItem("mpl_copilot_form_context");
      if (!raw) return { sellerCountry: "", buyerCountry: "" };
      const parsed = JSON.parse(raw) as unknown;
      return {
        sellerCountry: pickObjectText(parsed, COUNTRY_OVERRIDE_KEYS.seller),
        buyerCountry: pickObjectText(parsed, COUNTRY_OVERRIDE_KEYS.buyer),
      };
    } catch {
      return { sellerCountry: "", buyerCountry: "" };
    }
  })();

  return {
    sellerCountry: fromQuery.sellerCountry || fromStorage.sellerCountry,
    buyerCountry: fromQuery.buyerCountry || fromStorage.buyerCountry,
  };
}

function detectProductOrHsInPrompt(question: string) {
  const normalized = normalizePrompt(question);
  if (!normalized) return false;
  if (/\b\d{6,10}\b/.test(normalized)) return true;
  if (/\b(exportateur|importateur)\s+(de|d)\s+[a-z0-9]/.test(normalized)) return true;
  if (/\b(produit|marchandise)\b/.test(normalized)) return true;
  if (/\b(banane|acier|ferraille|drone|logiciel|chiffrement|cacao|textile|pharma)\b/.test(normalized)) return true;
  return false;
}

function withPriorityFollowUp(params: {
  followUps: string[];
  countryKnown: boolean;
  productKnown: boolean;
}) {
  const countryQuestion = "Quel est le pays de destination exact (et pays de transit si applicable) ?";
  const productQuestion = "Quel est le produit exact (nom commercial + composition/usage) ?";

  const base = Array.from(new Set(params.followUps.filter(Boolean)));
  if (params.productKnown && !params.countryKnown) {
    return [countryQuestion, ...base.filter((q) => q !== countryQuestion)];
  }
  if (params.countryKnown && !params.productKnown) {
    return [...base.filter((q) => q !== productQuestion), productQuestion];
  }
  return base;
}

function followUpToAction(question: string): FollowUpAction {
  const normalized = normalizePrompt(question);
  if (/\b(pays|destination|transit|origin|origine)\b/.test(normalized)) {
    return { label: "Renseigner le pays", value: "Pays destination: " };
  }
  if (/\b(produit|marchandise|usage|composition)\b/.test(normalized)) {
    return { label: "Renseigner le produit", value: "Produit (nom + usage): " };
  }
  if (/\b(code hs|hs)\b/.test(normalized)) {
    return { label: "Renseigner le code HS", value: "Code HS (6 chiffres): " };
  }
  if (/\bincoterm\b/.test(normalized)) {
    return { label: "Renseigner l'Incoterm", value: "Incoterm + lieu: " };
  }
  if (/\btransport\b/.test(normalized)) {
    return { label: "Renseigner le transport", value: "Transport: " };
  }
  if (/\bpayment|paiement|reglement\b/.test(normalized)) {
    return { label: "Renseigner le paiement", value: "Mode de paiement: " };
  }
  return { label: "Repondre", value: "Reponse: " };
}

function fieldPathToDraft(fieldPath?: string) {
  switch (fieldPath) {
    case "context.destination":
      return "Pays destination (ISO2 ou nom): ";
    case "context.origin":
      return "Pays origine (ISO2 ou nom): ";
    case "context.product":
      return "Produit (nom commercial + composition/usage): ";
    case "context.hs6":
      return "Code HS6: ";
    case "context.flow":
      return "Flux: export ou import ? ";
    case "context.incoterm":
      return "Incoterm + lieu (ex: FCA Lyon): ";
    case "context.buyerIsTaxable":
      return "Acheteur assujetti TVA ? (oui/non): ";
    case "context.goodsOrServices":
      return "Operation sur biens ou services ? ";
    default:
      return "Correction: ";
  }
}

function shouldShowGuidedForm(message: ChatMessage | undefined) {
  if (!message || message.role !== "assistant") return false;
  if (message.mainBlocker?.status === "MANQUANT") return true;
  const checks = Array.isArray(message.checks) ? message.checks : [];
  return checks.some((check) => check.status === "MANQUANT");
}

function buildPromptFromGuidedForm(values: GuidedFormValues) {
  const lines: string[] = [];
  lines.push("Analyse via formulaire guide:");
  lines.push(`- Flux: ${values.flow === "unknown" ? "je ne sais pas" : values.flow}`);
  lines.push(`- Nature: ${values.goodsOrServices === "unknown" ? "je ne sais pas" : values.goodsOrServices}`);
  lines.push(`- Pays origine: ${values.origin.trim() || "je ne sais pas"}`);
  lines.push(`- Pays destination: ${values.destination.trim() || "je ne sais pas"}`);
  lines.push(`- Produit / HS: ${values.productOrHs.trim() || "je ne sais pas"}`);
  lines.push(`- Incoterm: ${values.incoterm.trim() || "je ne sais pas"}`);
  lines.push(
    `- Acheteur assujetti TVA: ${
      values.buyerIsTaxable === "yes" ? "oui" : values.buyerIsTaxable === "no" ? "non" : "je ne sais pas"
    }`,
  );
  lines.push("Donne une decision provisoire, checklist, risques et actions.");
  return lines.join("\n");
}

function decisionBadgeClass(status?: ChatDecision["status"]) {
  if (status === "NO_GO") return "bg-rose-100 text-rose-700 border-rose-200";
  if (status === "SOUS_CONDITIONS") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function buildWatchLinks(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return [
      { title: "Ouvrir la veille", url: "/app/centre-veille/reglementation" },
      { title: "Choisir un pays (liste)", url: "/app/centre-veille/reglementation" },
      { title: "Choisir un pays (carte)", url: "/app/control-tower" },
    ];
  }

  return [
    { title: "Ouvrir la page veille", url: "/veille" },
    { title: "S'inscrire pour la veille", url: "/register?next=%2Fapp%2Fcentre-veille%2Freglementation" },
    { title: "Voir les tarifs", url: "/pricing#plans" },
  ];
}

function buildWatchHint(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return "Etape suivante: ouvrez la veille et choisissez un pays via la liste deroulante ou la carte.";
  }
  return "Etape suivante: ouvrez la page veille puis inscrivez-vous pour activer le suivi par pays.";
}

export default function Copilote() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Bonjour. Donnez votre cas export/import en une phrase. Je reponds avec decision provisoire, checklist, risques et actions.",
    },
  ]);

  const [sessionId, setSessionId] = React.useState<string | undefined>();
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [quotaLimit, setQuotaLimit] = React.useState(30);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [quotaStatus, setQuotaStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [destinationCountry, setDestinationCountry] = React.useState<string | null>(null);
  const [sellerCountry, setSellerCountry] = React.useState<string | null>(null);
  const [formContext] = React.useState<CopilotFormContext>(() => readFormContext());
  const [guidedForm, setGuidedForm] = React.useState<GuidedFormValues>(() => ({
    flow: "unknown",
    goodsOrServices: "unknown",
    origin: formContext.sellerCountry || "",
    destination: formContext.buyerCountry || "",
    productOrHs: "",
    incoterm: "",
    buyerIsTaxable: "unknown",
  }));
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const latestAssistantMessage = React.useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const showGuidedForm = React.useMemo(() => shouldShowGuidedForm(latestAssistantMessage), [latestAssistantMessage]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading]);

  React.useEffect(() => {
    setGuidedForm((prev) => ({
      ...prev,
      origin: prev.origin || sellerCountry || formContext.sellerCountry || "",
      destination: prev.destination || destinationCountry || formContext.buyerCountry || "",
    }));
  }, [destinationCountry, sellerCountry, formContext.buyerCountry, formContext.sellerCountry]);

  const refreshQuota = React.useCallback(async () => {
    try {
      const resp = await fetch("/api/hs/quota", { method: "GET" });
      const data = (await resp.json().catch(() => ({}))) as QuotaResponse;
      if (!resp.ok || data?.ok === false || typeof data?.remaining !== "number" || typeof data?.limit !== "number") {
        throw new Error(data?.detail || data?.error || `quota_failed_${resp.status}`);
      }
      setQuotaLimit(data.limit);
      setRemaining(data.remaining);
      setQuotaStatus("ready");
    } catch {
      setQuotaStatus("error");
      setRemaining(null);
    }
  }, []);

  React.useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const quotaLabel =
    quotaStatus === "loading"
      ? ".../30"
      : quotaStatus === "error"
        ? "indisponible"
        : `${Math.max(0, Number(remaining ?? 0))}/${quotaLimit}`;

  const applyDraftAndFocus = React.useCallback((value: string) => {
    setDraft(value);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const send = React.useCallback(async (preset?: string) => {
    const question = (preset ?? draft).trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);
    setError(null);
    let isAuthenticated = false;

    try {
      let trackedRemaining: number | null = null;
      try {
        const trackingResp = await fetch(
          `/api/hs/search?mode=track&q=${encodeURIComponent(question)}&universe=copilote&locale=fr`,
          { method: "GET" },
        );
        const trackingData = (await trackingResp.json().catch(() => ({}))) as QuotaResponse;
        if (typeof trackingData?.limit === "number") setQuotaLimit(trackingData.limit);
        if (typeof trackingData?.remaining === "number") {
          trackedRemaining = trackingData.remaining;
          setRemaining(trackedRemaining);
          setQuotaStatus("ready");
        }

        if (trackingResp.status === 429 || trackingData?.error === "daily_limit_reached") {
          const blockedAnswer = "Quota gratuit atteint pour les 24h. Reessayez plus tard ou contactez l'equipe MPL.";
          setError(blockedAnswer);
          setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: blockedAnswer }]);
          return;
        }
      } catch {
        // quota endpoint is non-blocking for /api/chat
      }

      const formSeller = normalizeCountryOverride(formContext.sellerCountry);
      const formBuyer = normalizeCountryOverride(formContext.buyerCountry);
      const detectedCountry = normalizeCountryOverride(detectCountryFromShortInput(question) || "");

      const finalSellerCountry = formSeller || sellerCountry || null;
      let finalBuyerCountry = formBuyer || detectedCountry || destinationCountry || null;

      if (!formBuyer && !finalBuyerCountry) {
        try {
          const funnel = await countryFunnelAnalysis(question, "fr", 5);
          if (funnel.status === "ok" && funnel.suggestions[0]?.code_iso2) {
            finalBuyerCountry = normalizeCountryOverride(funnel.suggestions[0].code_iso2) || funnel.suggestions[0].code_iso2;
          }
        } catch {
          // non bloquant: on garde le flux courant
        }
      }

      if (finalSellerCountry) setSellerCountry(finalSellerCountry);
      if (finalBuyerCountry) setDestinationCountry(finalBuyerCountry);
      const countryKnown = Boolean(finalBuyerCountry || finalSellerCountry);
      const resolvedDestination = finalBuyerCountry;
      const productKnownFromPrompt = detectProductOrHsInPrompt(question);

      const questionForApi = resolvedDestination && isLikelyCountryOnlyPrompt(question, resolvedDestination)
        ? `Destination: ${resolvedDestination}. Je n'ai donne que le pays. Donne d'abord les regles generales puis demande le produit pour affiner.`
        : question;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      isAuthenticated = Boolean(token);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: questionForApi,
          thread_id: sessionId || null,
          lang: "fr",
          overrides: {
            origin: finalSellerCountry,
            destination: resolvedDestination,
            sellerCountry: finalSellerCountry,
            buyerCountry: finalBuyerCountry,
          },
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as ChatResponse;
      if (!resp.ok || data?.ok === false || data?.error) {
        throw new Error(data?.detail || data?.error || `chat_failed_${resp.status}`);
      }

      const answerRaw = String(data?.answer_markdown || data?.answer || "").trim();
      const guidanceSeed = [
        question,
        finalSellerCountry ? `origine ${finalSellerCountry}` : "",
        resolvedDestination ? `destination ${resolvedDestination}` : "",
      ].filter(Boolean).join(" ");
      const guided = buildGuidedFallback(guidanceSeed);
      const guidedBlocks = buildAssistantBlocksFromGuided(guided);

      const modelFollowUps = [
        ...(Array.isArray(data?.follow_up_questions) ? data.follow_up_questions : []),
        ...(Array.isArray(data?.missing_questions) ? data.missing_questions : []),
      ]
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 6);

      const filteredModelFollowUps = countryKnown
        ? modelFollowUps.filter((q) => !COUNTRY_FOLLOWUP_RE.test(q))
        : modelFollowUps;

      const filteredGuidedFollowUps = countryKnown
        ? guided.followUpQuestions.filter((q) => !COUNTRY_FOLLOWUP_RE.test(q))
        : guided.followUpQuestions;

      const followUpQuestions = filteredModelFollowUps.length
        ? filteredModelFollowUps.slice(0, 3)
        : (filteredGuidedFollowUps.length ? filteredGuidedFollowUps.slice(0, 3) : guided.followUpQuestions.slice(0, 3));

      const prioritizedFollowUpQuestions = withPriorityFollowUp({
        followUps: followUpQuestions,
        countryKnown,
        productKnown: productKnownFromPrompt,
      }).slice(0, 3);

      const countryStillMissing = Boolean(!countryKnown && COUNTRY_MISSING_RE.test(answerRaw.toLowerCase()));
      const blocks = buildAssistantBlocks(data?.dossier) || guidedBlocks;
      const uncertain = isUncertainAnswer(answerRaw) || countryStillMissing;
      const links = buildWatchLinks(isAuthenticated);

      const baseAnswer = uncertain ? guided.answer : (answerRaw || guided.answer);
      const answer = `${baseAnswer}\n\n${buildWatchHint(isAuthenticated)}`;
      const finalBlocks = uncertain ? (guidedBlocks || blocks) : blocks;
      const responseChecks = Array.isArray(data?.checks) ? data.checks : [];
      const mainBlocker = data?.main_blocker ?? deriveMainBlocker(responseChecks);

      const nextThreadId = data?.thread_id || data?.session_id;
      if (nextThreadId) setSessionId(nextThreadId);
      if (typeof trackedRemaining === "number") {
        setRemaining(trackedRemaining);
        setQuotaStatus("ready");
      }

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: answer,
        links,
        followUpQuestions: prioritizedFollowUpQuestions,
        blocks: finalBlocks,
        checks: responseChecks,
        mainBlocker,
        decision: data?.decision,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      void ingestChatExchange({
        channel: "copilote_page",
        source: "CopilotePage",
        question,
        answer,
        mode: data?.mode || (uncertain ? "api_chat_with_links" : "api_chat"),
        context: {
          session_id: nextThreadId || sessionId || null,
          remaining: trackedRemaining,
          source_links_count: links.length,
          follow_up_questions_count: prioritizedFollowUpQuestions.length,
          destination_country: resolvedDestination,
          origin_country: finalSellerCountry,
          has_structured_blocks: Boolean(finalBlocks),
          decision: data?.decision?.status || null,
          main_blocker: mainBlocker?.id || null,
        },
      });
    } catch (err: any) {
      const guided = buildGuidedFallback(question);
      const links = buildWatchLinks(isAuthenticated);
      const answer = `${guided.answer}\n\n${buildWatchHint(isAuthenticated)}`;
      const blocks = buildAssistantBlocksFromGuided(guided);

      setError("Serveur temporairement indisponible. Mode guide active avec plan d'action.");
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: answer,
          links,
          followUpQuestions: guided.followUpQuestions,
          blocks,
        },
      ]);

      void ingestChatExchange({
        channel: "copilote_page",
        source: "CopilotePage",
        question,
        answer,
        mode: "assistant_error_with_links",
        context: {
          session_id: sessionId || null,
          error: String(err?.message || "api_chat_error"),
          source_links_count: links.length,
          follow_up_questions_count: guided.followUpQuestions.length,
          destination_country: destinationCountry || formContext.buyerCountry || null,
          origin_country: sellerCountry || formContext.sellerCountry || null,
          has_structured_blocks: Boolean(blocks),
        },
      });
    } finally {
      setLoading(false);
    }
  }, [draft, loading, destinationCountry, formContext.buyerCountry, formContext.sellerCountry, sellerCountry, sessionId]);

  const updateGuidedFormField = React.useCallback(
    <K extends keyof GuidedFormValues>(key: K, value: GuidedFormValues[K]) => {
      setGuidedForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const sendGuidedForm = React.useCallback(() => {
    const prompt = buildPromptFromGuidedForm(guidedForm);
    void send(prompt);
  }, [guidedForm, send]);

  const sendGeneralUnknown = React.useCallback(() => {
    void send(GENERAL_UNKNOWN_PROMPT);
  }, [send]);

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <Card className="mx-auto w-full max-w-5xl">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle>Copilote IA export</CardTitle>
              <Badge variant="secondary">Gratuit</Badge>
            </div>
            <p className="text-sm text-slate-600">Decision provisoire, checklist, risques, documents et actions en une reponse.</p>
            <p className="text-xs text-slate-500">Quota restant: {quotaLabel}</p>
          </CardHeader>

          <CardContent className="space-y-3">
            <div ref={scrollRef} className="max-h-[60vh] min-h-[380px] space-y-3 overflow-auto rounded-xl border bg-slate-50 p-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" ? (
                    <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-3 w-3" />
                    </div>
                  ) : null}

                  <div className={`max-w-[88%] rounded-xl border px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-white"}`}>
                    {m.role === "assistant" && m.decision ? (
                      <div className="mb-2 flex items-center gap-2 border-b border-border/70 pb-2">
                        <Badge className={`border ${decisionBadgeClass(m.decision.status)}`}>{m.decision.status}</Badge>
                        <span className="text-xs text-slate-600">{m.decision.reason}</span>
                      </div>
                    ) : null}

                    {m.role === "assistant" && m.mainBlocker ? (
                      <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Point bloquant principal
                          </div>
                          <Badge variant="outline" className="border-rose-200 text-rose-700">
                            {statusLabel(m.mainBlocker.status)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-900">{m.mainBlocker.label}</p>
                        <p className="mt-1 text-xs text-slate-700">{m.mainBlocker.explanation}</p>
                        <p className="mt-1 text-xs text-slate-700">Action: {m.mainBlocker.what_to_fix}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => applyDraftAndFocus(fieldPathToDraft(m.mainBlocker?.fieldPath))}
                          >
                            Corriger
                          </Button>
                          {m.mainBlocker.source_link ? (
                            <a
                              href={m.mainBlocker.source_link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-slate-600 underline"
                            >
                              Source
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                    {m.role === "assistant" && m.blocks ? (
                      <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 md:grid-cols-2">
                        {m.blocks.summary.length ? (
                          <div className="rounded-lg border bg-muted/30 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Resume</div>
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                              {m.blocks.summary.map((line) => <li key={`${m.id}-sum-${line}`}>{line}</li>)}
                            </ul>
                          </div>
                        ) : null}

                        {m.blocks.checklist.length ? (
                          <div className="rounded-lg border bg-muted/30 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documents</div>
                            <ul className="mt-1 space-y-1 text-xs">
                              {m.blocks.checklist.map((item) => (
                                <li key={`${m.id}-chk-${item.label}`}>{item.required ? "[x]" : "[ ]"} {item.label}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {m.blocks.risks.length ? (
                          <div className="rounded-lg border bg-rose-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Risques</div>
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-rose-800">
                              {m.blocks.risks.map((item) => <li key={`${m.id}-risk-${item}`}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null}

                        {m.blocks.actions.length ? (
                          <div className="rounded-lg border bg-emerald-50 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Actions</div>
                            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-emerald-800">
                              {m.blocks.actions.map((item) => <li key={`${m.id}-act-${item}`}>{item}</li>)}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {m.role === "assistant" && m.links?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                        {m.links.map((link) => (
                          <a
                            key={`${m.id}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-slate-700 hover:bg-muted"
                          >
                            {link.title}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {m.role === "assistant" && m.followUpQuestions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                        {m.followUpQuestions.map((q) => {
                          const action = followUpToAction(q);
                          return (
                            <Button
                              key={`${m.id}-${q}`}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-2 text-[11px]"
                              onClick={() => applyDraftAndFocus(action.value)}
                            >
                              {action.label}
                            </Button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyse en cours...
                </div>
              ) : null}
            </div>

            {error ? <div className="text-xs text-rose-600">{error}</div> : null}

            {showGuidedForm ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="mb-2 text-sm font-semibold text-amber-900">Formulaire rapide (si le Copilote manque des infos)</div>
                <p className="mb-3 text-xs text-amber-800">
                  Remplissez ce que vous savez. Utilisez "Je ne sais pas" pour recevoir une reponse generale import/export.
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Flux</Label>
                    <Select
                      value={guidedForm.flow}
                      onValueChange={(value) => updateGuidedFormField("flow", value as GuidedFormValues["flow"])}
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="export">Export</SelectItem>
                        <SelectItem value="import">Import</SelectItem>
                        <SelectItem value="unknown">Je ne sais pas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Biens / Services</Label>
                    <Select
                      value={guidedForm.goodsOrServices}
                      onValueChange={(value) =>
                        updateGuidedFormField("goodsOrServices", value as GuidedFormValues["goodsOrServices"])
                      }
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="goods">Biens</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                        <SelectItem value="unknown">Je ne sais pas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Pays origine</Label>
                    <Input
                      value={guidedForm.origin}
                      onChange={(e) => updateGuidedFormField("origin", e.target.value)}
                      placeholder="FR / France..."
                      className="h-9 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Pays destination</Label>
                    <Input
                      value={guidedForm.destination}
                      onChange={(e) => updateGuidedFormField("destination", e.target.value)}
                      placeholder="IT / Italie..."
                      className="h-9 bg-white"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Produit / HS</Label>
                    <Input
                      value={guidedForm.productOrHs}
                      onChange={(e) => updateGuidedFormField("productOrHs", e.target.value)}
                      placeholder="ex: tomates fraiches / HS 070200"
                      className="h-9 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Incoterm (optionnel)</Label>
                    <Input
                      value={guidedForm.incoterm}
                      onChange={(e) => updateGuidedFormField("incoterm", e.target.value)}
                      placeholder="EXW, FCA, FOB..."
                      className="h-9 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Acheteur assujetti TVA ?</Label>
                    <Select
                      value={guidedForm.buyerIsTaxable}
                      onValueChange={(value) =>
                        updateGuidedFormField("buyerIsTaxable", value as GuidedFormValues["buyerIsTaxable"])
                      }
                    >
                      <SelectTrigger className="h-9 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Oui</SelectItem>
                        <SelectItem value="no">Non</SelectItem>
                        <SelectItem value="unknown">Je ne sais pas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={sendGuidedForm} disabled={loading}>
                    Analyser ce formulaire
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={sendGeneralUnknown} disabled={loading}>
                    Je ne sais pas
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ecrivez votre question export ici..."
                className="min-h-[96px] flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />

              <Button onClick={() => void send()} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">Entree = envoyer, Shift+Entree = nouvelle ligne.</p>
          </CardContent>
        </Card>
      </main>
    </PublicLayout>
  );
}
