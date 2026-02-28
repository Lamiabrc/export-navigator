import * as React from "react";
import { AlertTriangle, Bot, ExternalLink, Loader2, Send } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { buildGuidedFallback, type GuidedFallback } from "@/lib/chatGuidance";
import { ingestChatExchange } from "@/lib/chatIngest";
import { detectCountryFromShortInput } from "@/lib/countryInput";

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

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const COUNTRY_FOLLOWUP_RE = /(quel est le pays|pays de destination|destination exact)/i;
const COUNTRY_MISSING_RE = /(pays.*(a confirmer|manquant)|quel est le pays de destination|destination exacte)/i;

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
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading]);

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

      const detectedCountry = detectCountryFromShortInput(question);
      if (detectedCountry) setDestinationCountry(detectedCountry);
      const resolvedDestination = detectedCountry || destinationCountry || null;
      const productKnownFromPrompt = detectProductOrHsInPrompt(question);

      const questionForApi = detectedCountry && isLikelyCountryOnlyPrompt(question, detectedCountry)
        ? `Destination: ${detectedCountry}. Je n'ai donne que le pays. Donne d'abord les regles generales puis demande le produit pour affiner.`
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
            destination: resolvedDestination,
          },
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as ChatResponse;
      if (!resp.ok || data?.ok === false || data?.error) {
        throw new Error(data?.detail || data?.error || `chat_failed_${resp.status}`);
      }

      const answerRaw = String(data?.answer_markdown || data?.answer || "").trim();
      const guidanceSeed =
        resolvedDestination && !detectCountryFromShortInput(question)
          ? `${question} destination ${resolvedDestination}`
          : question;
      const guided = buildGuidedFallback(guidanceSeed);
      const guidedBlocks = buildAssistantBlocksFromGuided(guided);

      const modelFollowUps = [
        ...(Array.isArray(data?.follow_up_questions) ? data.follow_up_questions : []),
        ...(Array.isArray(data?.missing_questions) ? data.missing_questions : []),
      ]
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, 6);

      const filteredModelFollowUps = resolvedDestination
        ? modelFollowUps.filter((q) => !COUNTRY_FOLLOWUP_RE.test(q))
        : modelFollowUps;

      const filteredGuidedFollowUps = resolvedDestination
        ? guided.followUpQuestions.filter((q) => !COUNTRY_FOLLOWUP_RE.test(q))
        : guided.followUpQuestions;

      const followUpQuestions = filteredModelFollowUps.length
        ? filteredModelFollowUps.slice(0, 3)
        : (filteredGuidedFollowUps.length ? filteredGuidedFollowUps.slice(0, 3) : guided.followUpQuestions.slice(0, 3));

      const prioritizedFollowUpQuestions = withPriorityFollowUp({
        followUps: followUpQuestions,
        countryKnown: Boolean(resolvedDestination),
        productKnown: productKnownFromPrompt,
      }).slice(0, 3);

      const countryStillMissing = Boolean(resolvedDestination && COUNTRY_MISSING_RE.test(answerRaw.toLowerCase()));
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
          destination_country: destinationCountry,
          has_structured_blocks: Boolean(blocks),
        },
      });
    } finally {
      setLoading(false);
    }
  }, [draft, loading, destinationCountry, sessionId]);

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
