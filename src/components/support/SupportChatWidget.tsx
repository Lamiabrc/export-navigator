import * as React from "react";
import { Bot, ExternalLink, Loader2, MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ingestChatExchange } from "@/lib/chatIngest";
import { getSupabaseAiFallback } from "@/lib/supabaseAiFallback";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

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

type ChatFreeResponse = {
  session_id?: string;
  reply?: string;
  follow_up_questions?: string[];
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

const STORAGE_KEY = "mpl_support_widget_chat_v2";
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

function buildResearchLinks(question: string) {
  const q = question.trim();
  const lower = q.toLowerCase();
  const links: Array<{ title: string; url: string; origin: "internet" }> = [
    {
      title: "Recherche web ciblee",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${q} reglementation export`)}`,
      origin: "internet",
    },
  ];

  if (/(incoterm|fob|dap|ddp|cif|cip|exw|fca)/i.test(lower)) {
    links.push({
      title: "Guide ICC Incoterms",
      url: "https://iccwbo.org/business-solutions/incoterms-rules/",
      origin: "internet",
    });
  }

  if (/(douane|droit|tarif|taric|hs|code hs|tva)/i.test(lower)) {
    links.push(
      {
        title: "Douane francaise",
        url: "https://www.douane.gouv.fr/",
        origin: "internet",
      },
      {
        title: "Taric UE",
        url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp",
        origin: "internet",
      }
    );
  }

  if (/(sanction|embargo|restriction|compliance|conformite)/i.test(lower)) {
    links.push({
      title: "EU Sanctions Map",
      url: "https://www.sanctionsmap.eu/",
      origin: "internet",
    });
  }

  const deduped = new Map<string, { title: string; url: string; origin: "internet" }>();
  for (const item of links) deduped.set(item.url, item);
  return Array.from(deduped.values()).slice(0, 4);
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
  const [chatFreeSessionId, setChatFreeSessionId] = React.useState<string | null>(null);
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

  const invokeExportAssistant = React.useCallback(
    async (msg: string) => {
      if (!SUPABASE_ENV_OK) throw new Error("connexion_base_indisponible");

      const timeoutMs = 18000;
      let timeoutId: number | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("assistant_timeout")), timeoutMs);
      });

      try {
        const invokePromise = supabase.functions.invoke<AssistantResponse>("export-assistant", {
          body: {
            question: msg,
            destination,
            incoterm,
            transport_mode: transportMode,
          },
        });

        const { data, error: fnError } = (await Promise.race([invokePromise, timeoutPromise])) as Awaited<typeof invokePromise>;
        if (fnError || data?.error || data?.ok === false) {
          const msgErr = fnError?.message || data?.detail || data?.error || "assistant_indisponible";
          throw new Error(msgErr);
        }

        return data;
      } finally {
        if (typeof timeoutId === "number") window.clearTimeout(timeoutId);
      }
    },
    [destination, incoterm, transportMode]
  );

  const invokeApiFallback = React.useCallback(
    async (msg: string, history: ChatMessage[]) => {
      if (!SUPABASE_ENV_OK) return null;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return null;

      const resp = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: msg,
          context: {
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
    [destination, incoterm, transportMode, toChatHistory]
  );

  const invokeChatFreeFallback = React.useCallback(
    async (msg: string) => {
      if (!SUPABASE_ENV_OK) return null;

      const { data, error: fnError } = await supabase.functions.invoke<ChatFreeResponse>("chat-free", {
        body: {
          session_id: chatFreeSessionId || undefined,
          message: msg,
          context: {
            destination,
            incoterm,
            transport_mode: transportMode,
          },
        },
      });

      if (fnError) throw new Error(fnError.message || "chat_free_failed");

      const reply = String(data?.reply || "").trim();
      if (!reply) return null;

      const nextSessionId = String(data?.session_id || "").trim();
      if (nextSessionId) setChatFreeSessionId(nextSessionId);

      return {
        ok: true,
        mode: "chat_free_fallback",
        session_id: nextSessionId || undefined,
        answer: reply,
        follow_up_questions: (data?.follow_up_questions || []).slice(0, 3),
      } satisfies AssistantResponse;
    },
    [chatFreeSessionId, destination, incoterm, transportMode]
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
        let data: AssistantResponse | null = null;
        let primaryErr: unknown = null;

        try {
          data = await invokeExportAssistant(msg);
        } catch (err) {
          primaryErr = err;
        }

        if (!data) {
          try {
            data = await invokeApiFallback(msg, [...messages, userMsg]);
          } catch (err) {
            if (!primaryErr) primaryErr = err;
          }
        }

        if (!data) {
          try {
            data = await invokeChatFreeFallback(msg);
          } catch (err) {
            if (!primaryErr) primaryErr = err;
          }
        }

        if (!data) {
          const primaryErrMessage =
            primaryErr instanceof Error ? primaryErr.message : primaryErr ? String(primaryErr) : "assistant_indisponible";
          throw new Error(primaryErrMessage);
        }

        const answerRaw = String(data?.answer || data?.summary || "").trim();
        const uncertain = isUncertainAnswer(answerRaw, data?.mode);
        const internetLinks = uncertain ? buildResearchLinks(msg) : [];
        const sourceLinks = [...(data?.source_links || []), ...internetLinks].slice(0, 4);
        const answer = answerRaw || "Je n'ai pas de reponse certaine. Voici des liens internet fiables pour verifier rapidement.";

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: answer,
          createdAt: Date.now(),
          meta: {
            ...data,
            source_links: sourceLinks,
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
          },
        });
      } catch (err: any) {
        const fallback = await getSupabaseAiFallback(msg).catch(() => null);
        if (fallback) {
          setError(null);
          const sourceLinks = [...(fallback.sourceLinks || []), ...buildResearchLinks(msg)].slice(0, 4);
          const answer =
            String(fallback.answer || "").trim() ||
            "Je n'ai pas de reponse fiable sur ce point. Utilisez les liens ci-dessous pour trouver la source officielle.";

          const assistantMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content: answer,
            createdAt: Date.now(),
            meta: {
              ok: true,
              mode: "supabase_ai_fallback",
              answer,
              summary: fallback.summary,
              follow_up_questions: fallback.followUpQuestions,
              source_links: sourceLinks,
              context_summary: fallback.contextSummary,
            },
          };

          setMessages((prev) => [...prev, assistantMsg]);
          void ingestChatExchange({
            channel: "support_widget",
            source: "SupportChatWidget",
            question: msg,
            answer: assistantMsg.content,
            mode: "supabase_ai_fallback",
            context: {
              destination,
              incoterm,
              transport_mode: transportMode,
              source_links_count: sourceLinks.length,
            },
          });
          return;
        }

        const answer =
          "Je n'ai pas pu produire une reponse fiable maintenant. J'ai ajoute des liens internet pour continuer la recherche.";
        const sourceLinks = buildResearchLinks(msg);

        setError("Reponse indisponible. Liens de secours proposes.");

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
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [draft, loading, invokeApiFallback, invokeChatFreeFallback, invokeExportAssistant, messages, destination, incoterm, transportMode]
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

              {!SUPABASE_ENV_OK ? (
                <div className="mt-1 text-[11px] text-rose-600">Connexion Supabase indisponible: mode limite.</div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
