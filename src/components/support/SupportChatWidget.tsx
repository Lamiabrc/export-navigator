import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, MessageCircle, X, ChevronDown, ChevronUp, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ingestChatExchange } from "@/lib/chatIngest";
import { getSupabaseAiFallback } from "@/lib/supabaseAiFallback";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AssistantResponse = {
  ok?: boolean;
  mode?: string;
  session_id?: string;
  answer?: string;
  summary?: string;
  detail?: string;
  error?: string;
  citations?: Array<{ title: string; chunk_index: number; similarity?: number }>;
  follow_up_questions?: string[];
  source_links?: Array<{ title: string; url: string; origin?: string }>;
  context_summary?: string;
  privacy_notice?: string;
  retention_days?: number;
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

const STORAGE_KEY = "mpl_support_widget_chat_v1";
const QUICK_PROMPTS = [
  "Quels documents pour un export DAP vers l'Allemagne ?",
  "TVA et droits import USA : que prevoir ?",
  "Incoterm CIP : assurance obligatoire ?",
  "Restrictions / sanctions a verifier pour la Turquie ?",
];

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

function buildContactDraft(message: ChatMessage | null, context: string) {
  const lines: string[] = [];
  if (message?.content) lines.push(`Question: ${message.content}`);
  if (context) lines.push(`Contexte: ${context}`);
  return lines.join("\n");
}

export default function SupportChatWidget({
  open,
  onOpenChange,
  defaultOpen = false,
  defaultContext,
}: SupportChatWidgetProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen));
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? Boolean(open) : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [destination, setDestination] = React.useState(defaultContext?.destination || "UE");
  const [incoterm, setIncoterm] = React.useState(defaultContext?.incoterm || "DAP");
  const [transportMode, setTransportMode] = React.useState(defaultContext?.transport_mode || "Route");

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [chatFreeSessionId, setChatFreeSessionId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showContext, setShowContext] = React.useState(false);
  const [showContact, setShowContact] = React.useState(false);

  const [contactEmail, setContactEmail] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactMessage, setContactMessage] = React.useState("");
  const [contactLoading, setContactLoading] = React.useState(false);

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
      setMessages(cleaned.slice(-40));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    safeLSSet(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  }, [messages]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading, isOpen]);

  React.useEffect(() => {
    if (user?.email && !contactEmail) setContactEmail(user.email);
  }, [user?.email, contactEmail]);

  const lastUser = React.useMemo(() => {
    const rev = [...messages].reverse();
    return rev.find((m) => m.role === "user") || null;
  }, [messages]);

  const lastAssistant = React.useMemo(() => {
    const rev = [...messages].reverse();
    return rev.find((m) => m.role === "assistant") || null;
  }, [messages]);

  const lastMode = lastAssistant?.meta?.mode;
  const toChatHistory = React.useCallback(
    (items: ChatMessage[]) => items.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    []
  );

  const invokeExportAssistant = React.useCallback(
    async (msg: string) => {
      if (!SUPABASE_ENV_OK) throw new Error("Connexion base indisponible.");

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
          const msgErr = fnError?.message || data?.detail || data?.error || "Assistant indisponible";
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
      if (!msg) {
        setError("Ajoute une question pour lancer l'aide IA.");
        return;
      }

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
            primaryErr instanceof Error ? primaryErr.message : primaryErr ? String(primaryErr) : "Assistant indisponible";
          throw new Error(primaryErrMessage);
        }

        const answer = String(data?.answer || data?.summary || "").trim();
        const fallback =
          "Je n'ai pas de reponse exploitable. Tu peux preciser le HS, la destination, l'incoterm, " +
          "ou passer en mode avance pour une analyse complete.";

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: answer || fallback,
          createdAt: Date.now(),
          meta: data,
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
          },
        });
      } catch (err: any) {
        const rawErr = String(err?.message || "Assistant indisponible");
        const msgErr = rawErr === "assistant_timeout"
          ? "L'assistant met trop de temps a repondre. Reessaie dans quelques secondes."
          : rawErr.includes("Failed to fetch")
            ? "Le service IA est temporairement indisponible. Reessaie dans quelques secondes."
            : "Assistant indisponible pour le moment. Reessaie ou precise le contexte.";

        const fallback = await getSupabaseAiFallback(msg).catch(() => null);
        if (fallback) {
          setError(null);
          const assistantMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content: fallback.answer,
            createdAt: Date.now(),
            meta: {
              ok: true,
              mode: "supabase_ai_fallback",
              answer: fallback.answer,
              summary: fallback.summary,
              follow_up_questions: fallback.followUpQuestions,
              source_links: fallback.sourceLinks,
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
            },
          });
          return;
        }

        setError(msgErr);

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content:
            "Je n'ai pas pu recuperer de reponse IA maintenant. Reessaie ou precise pays, produit/HS, incoterm et mode de transport.",
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        void ingestChatExchange({
          channel: "support_widget",
          source: "SupportChatWidget",
          question: msg,
          answer: assistantMsg.content,
          mode: "assistant_error",
          context: {
            destination,
            incoterm,
            transport_mode: transportMode,
            error: rawErr,
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [draft, loading, messages, invokeExportAssistant, invokeApiFallback, invokeChatFreeFallback, destination, incoterm, transportMode]
  );

  const handleContactOpen = () => {
    const contextLine = `destination=${destination} | incoterm=${incoterm} | transport=${transportMode}`;
    if (!contactMessage) {
      setContactMessage(buildContactDraft(lastUser, contextLine));
    }
    setShowContact(true);
  };

  const sendSupport = async () => {
    if (contactLoading) return;
    const email = (user?.email || contactEmail || "").trim().toLowerCase();
    if (!email) {
      toast({ title: "Email requis", description: "Ajoute un email pour contacter le support." });
      return;
    }
    if (!contactMessage.trim()) {
      toast({ title: "Message requis", description: "Ajoute un message pour le support." });
      return;
    }

    const context = {
      destination,
      incoterm,
      transport_mode: transportMode,
      last_mode: lastMode || null,
      last_question: lastUser?.content || null,
      page_url: typeof window !== "undefined" ? window.location.href : null,
    };

    const payload = {
      firstName: contactName.trim() || "Support widget",
      email,
      topic: "support-message",
      subject: "Demande support depuis le widget",
      source: "support-widget",
      message: `${contactMessage.trim()}\n\nContexte:\n${JSON.stringify(context, null, 2)}`,
      scenarioSummary: JSON.stringify(context),
    };

    try {
      setContactLoading(true);
      const resp = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({} as { ok?: boolean; error?: string }));

      if (!resp.ok || data?.ok === false) {
        throw new Error(data?.error || `contact_failed_${resp.status}`);
      }

      toast({ title: "Message envoye", description: "Le support revient vers toi sous 24-48h." });
      setContactMessage("");
      setShowContact(false);
    } catch (err: any) {
      toast({ title: "Erreur support", description: err?.message || "Envoi impossible" });
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a]"
          aria-label="Ouvrir ton conseiller export"
          aria-expanded="false"
        >
          <MessageCircle className="h-4 w-4" />
          Ton conseiller export
        </button>
      ) : (
        <div
          className="w-[92vw] max-w-[380px] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
          role="dialog"
          aria-modal="false"
          aria-label="Ton conseiller export"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Ton conseiller export</div>
                <div className="text-[11px] text-white/70">
                  Conseils rapides export/import
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastMode ? <Badge variant="secondary">Mode: {lastMode}</Badge> : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <div ref={scrollRef} className="max-h-[320px] overflow-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Exemples: documents DAP UE, droits/TVA import, assurance CIP, sanctions pays.
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
                      className={`max-w-[80%] rounded-xl border px-3 py-2 text-xs ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border px-4 py-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void send(p)}
                    disabled={loading}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {error ? <div className="text-xs text-rose-600">{error}</div> : null}

              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Pose ta question..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowContext((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Contexte
                </button>

                <Button onClick={() => void send()} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </Button>
              </div>

              {showContext ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
                  <div className="grid gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Destination</label>
                      <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="UE" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Incoterm</label>
                      <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="DAP" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Transport</label>
                      <Input value={transportMode} onChange={(e) => setTransportMode(e.target.value)} placeholder="Route" />
                    </div>
                  </div>
                </div>
              ) : null}

              <Separator />

              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                Données confidentielles : vos questions sont stockées de façon sécurisée dans la base de données et
                supprimées automatiquement après la période de rétention.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/assistant")}>
                  Mode avance
                </Button>
                <Button variant="outline" size="sm" onClick={handleContactOpen} className="gap-1">
                  <LifeBuoy className="h-4 w-4" />
                  Nous contacter
                </Button>
              </div>

              {showContact ? (
                <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <div className="text-xs font-semibold">Support humain</div>
                  {!user?.email ? (
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Email</label>
                      <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="vous@entreprise.com" />
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      Email du compte: <span className="font-medium">{user.email}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Nom (optionnel)</label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nom / Societe" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Message</label>
                    <Textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} rows={3} />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={sendSupport} disabled={contactLoading} className="gap-2">
                      {contactLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Envoyer
                    </Button>
                  </div>
                </div>
              ) : null}

              {!SUPABASE_ENV_OK ? (
                <div className="text-[11px] text-rose-600">
                  Connexion Supabase indisponible: mode IA limite.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
