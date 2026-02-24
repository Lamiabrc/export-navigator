import * as React from "react";
import { Bot, ExternalLink, Loader2, MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ingestChatExchange } from "@/lib/chatIngest";
import { buildGuidedFallback, buildResearchLinks } from "@/lib/chatGuidance";
import { supabase } from "@/integrations/supabase/client";

type AssistantResponse = {
  ok?: boolean;
  mode?: string;
  session_id?: string;
  answer?: string;
  summary?: string;
  detail?: string;
  error?: string;
  follow_up_questions?: string[];
  source_links?: Array<{ title: string; url: string; origin?: string }>;
  context_summary?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  meta?: AssistantResponse;
};

type SupportChatWidgetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  defaultContext?: {
    destination?: string;
    incoterm?: string;
    transport_mode?: string;
  };
};

const STORAGE_KEY = "mpl_support_widget_chat_v3";
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function safeLSGet(key: string) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLSSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function isUncertainAnswer(answer: string, mode?: string) {
  const txt = answer.trim().toLowerCase();
  if (!txt) return true;
  if (txt.length < 40) return true;
  if (/(pas de reponse|indisponible|reessaye|reessaie|erreur|vide)/i.test(txt)) return true;
  if (/(fallback|error|timeout)/i.test(String(mode || ""))) return true;
  return false;
}

export default function SupportChatWidget({
  open,
  onOpenChange,
  defaultOpen = false,
  defaultContext,
}: SupportChatWidgetProps) {
  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen));
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? Boolean(open) : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const destination = defaultContext?.destination || "UE";
  const incoterm = defaultContext?.incoterm || "DAP";
  const transportMode = defaultContext?.transport_mode || "Route";

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const raw = safeLSGet(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned: ChatMessage[] = parsed
        .filter((m: any) => m && typeof m === "object")
        .map((m: any) => ({
          id: typeof m.id === "string" ? m.id : uid(),
          role: (m.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
          content: typeof m.content === "string" ? m.content : "",
          createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
          meta: m.meta && typeof m.meta === "object" ? m.meta : undefined,
        }))
        .filter((m) => m.content.trim().length > 0);
      setMessages(cleaned.slice(-50));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    safeLSSet(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  }, [messages]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading, isOpen]);

  const toChatHistory = React.useCallback(
    (items: ChatMessage[]) => items.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    []
  );

  const invokeApiAsk = React.useCallback(
    async (msg: string, history: ChatMessage[]) => {
      let token: string | undefined;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData.session?.access_token;
      } catch {
        token = undefined;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch("/api/ask", {
        method: "POST",
        headers,
        body: JSON.stringify({
          question: msg,
          context: {
            session_id: sessionId,
            destination,
            incoterm,
            transport_mode: transportMode,
            chat_history: toChatHistory(history),
          },
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as AssistantResponse;
      if (!resp.ok || data?.error || data?.ok === false) {
        const msgErr = data?.detail || data?.error || `ask_failed_${resp.status}`;
        throw new Error(msgErr);
      }

      return data;
    },
    [destination, incoterm, sessionId, toChatHistory, transportMode]
  );

  const send = React.useCallback(
    async (override?: string) => {
      if (loading) return;
      const msg = (override ?? draft).trim();
      if (!msg) return;

      const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, createdAt: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setDraft("");
      setLoading(true);
      setError(null);

      try {
        const data = await invokeApiAsk(msg, [...messages, userMsg]);

        const answerRaw = String(data?.answer || data?.summary || "").trim();
        const uncertain = isUncertainAnswer(answerRaw, data?.mode);
        const guided = buildGuidedFallback(msg);
        const modelFollowUps = (data?.follow_up_questions || []).filter(Boolean).slice(0, 3);
        const followUpQuestions = modelFollowUps.length ? modelFollowUps : guided.followUpQuestions;
        const internetLinks = uncertain ? buildResearchLinks(msg) : [];
        const sourceLinks = [...(data?.source_links || []), ...internetLinks].slice(0, 4);
        const answer = uncertain ? guided.answer : (answerRaw || guided.answer);

        const nextSessionId = String(data?.session_id || "").trim();
        if (nextSessionId) setSessionId(nextSessionId);

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: answer,
          createdAt: Date.now(),
          meta: {
            ...data,
            source_links: sourceLinks,
            follow_up_questions: followUpQuestions,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
        void ingestChatExchange({
          channel: "support_widget",
          source: "SupportChatWidget",
          question: msg,
          answer: assistantMsg.content,
          mode: data?.mode || "support_widget_primary",
          context: {
            destination,
            incoterm,
            transport_mode: transportMode,
            source_links_count: sourceLinks.length,
            follow_up_questions_count: followUpQuestions.length,
            session_id: nextSessionId || sessionId,
          },
        });
      } catch (err: any) {
        const guided = buildGuidedFallback(msg);
        const answer = guided.answer;
        const sourceLinks = buildResearchLinks(msg);

        setError("Reponse serveur indisponible: je passe en mode guide pour avancer pas a pas.");

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: answer,
          createdAt: Date.now(),
          meta: {
            ok: false,
            mode: "assistant_error_with_links",
            answer,
            source_links: sourceLinks,
            follow_up_questions: guided.followUpQuestions,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
        void ingestChatExchange({
          channel: "support_widget",
          source: "SupportChatWidget",
          question: msg,
          answer,
          mode: "assistant_error_with_links",
          context: {
            destination,
            incoterm,
            transport_mode: transportMode,
            error: String(err?.message || "assistant_error"),
            source_links_count: sourceLinks.length,
            follow_up_questions_count: guided.followUpQuestions.length,
            session_id: sessionId,
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [draft, loading, invokeApiAsk, messages, destination, incoterm, sessionId, transportMode]
  );

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a]"
          aria-label="Ouvrir le chatbot export"
          aria-expanded="false"
        >
          <MessageCircle className="h-4 w-4" />
          Chatbot export
        </button>
      ) : (
        <div
          className="w-[94vw] max-w-[420px] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
          role="dialog"
          aria-modal="false"
          aria-label="Chatbot export"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">MPL Export Expert</div>
                <div className="text-[11px] text-white/70">Posez une question, recevez une reponse claire.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col">
            <div ref={scrollRef} className="max-h-[360px] overflow-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Exemple: "Quels documents pour un export DAP vers l'Allemagne ?"
                </div>
              ) : null}

              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" ? (
                      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-3 w-3" />
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[82%] rounded-xl border px-3 py-2 text-xs ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                      {m.role === "assistant" && m.meta?.source_links?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                          {m.meta.source_links.slice(0, 4).map((src) => (
                            <a
                              key={`${m.id}-${src.url}`}
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-slate-700 hover:bg-muted"
                            >
                              {src.title}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      ) : null}

                      {m.role === "assistant" && m.meta?.follow_up_questions?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                          {m.meta.follow_up_questions.slice(0, 3).map((q) => (
                            <button
                              key={`${m.id}-${q}`}
                              type="button"
                              onClick={() => setDraft(q)}
                              className="rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-slate-700 hover:bg-muted"
                            >
                              {q}
                            </button>
                          ))}
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
            </div>

            <div className="border-t border-border px-4 py-3">
              {error ? <div className="mb-2 text-xs text-rose-600">{error}</div> : null}

              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ecrivez votre question ici..."
                  rows={3}
                  className="min-h-[88px] flex-1 resize-none"
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

              <div className="mt-2 text-[11px] text-muted-foreground">
                Entree = envoyer, Shift+Entree = nouvelle ligne.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
