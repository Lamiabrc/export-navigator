import * as React from "react";
import { Bot, Send, Loader2, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

const STORAGE_KEY = "mpl_assistant_chat_v3";
const SESSION_STORAGE_KEY = "mpl_assistant_session_id_v1";

type AssistantResponse = {
  ok?: boolean;
  mode?: string;
  session_id?: string;
  answer?: string;
  summary?: string;
  detail?: string;
  error?: string;
  actions?: string[];
  follow_up_questions?: string[];
  source_links?: Array<{ title: string; url: string; origin?: string }>;
  context_summary?: string;
  satisfaction_prompt?: string;
};


type LlmChatResponse = {
  session_id?: string;
  reply?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  meta?: AssistantResponse;
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const QUICK_PROMPTS = [
  "Incoterm DDP : risques et bonnes pratiques",
  "Droits et TVA import : comment estimer ?",
  "Documents indispensables pour un export",
  "Effets de la géopolitique sur un flux export",
];


function toChatHistory(messages: ChatMessage[]) {
  return messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
}

export default function Assistant() {
  const { toast } = useToast();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const destination = "Allemagne";
  const incoterm = "DAP";
  const transportMode = "Route";

  React.useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const storedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSessionId) setSessionId(storedSessionId);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed)) setMessages(parsed.slice(-50));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  }, [messages]);

  React.useEffect(() => {
    if (!sessionId) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }, [sessionId]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading]);

  const clearChat = React.useCallback(() => {
    setMessages([]);
    setDraft("");
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    toast({ title: "Chat effacé", description: "Historique supprimé sur cet appareil." });
  }, [toast]);

  const send = React.useCallback(
    async (override?: string, extraContext?: Record<string, unknown>) => {
      const msg = (override ?? draft).trim();
      if (loading) return;
      if (!msg) {
        const m = "Merci de saisir une question claire (incoterm, taxes, documents, risques, géopolitique).";
        setError(m);
        toast({ title: "Message vide", description: m });
        return;
      }

      const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, createdAt: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setDraft("");
      setLoading(true);
      setError(null);

      const body = {
        question: msg,
        context: {
          destination,
          incoterm,
          transport_mode: transportMode,
          chat_history: toChatHistory(messages),
          session_id: sessionId,
          ...extraContext,
        },
      };

      try {
        if (!SUPABASE_ENV_OK) throw new Error("Connexion base indisponible.");

        const llmPayload = {
          session_id: sessionId,
          message: msg,
        };

        const { data: llmData, error: llmError } = await supabase.functions.invoke<LlmChatResponse>("llm-chat", {
          body: llmPayload,
        });

        if (llmError) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) throw new Error("Session invalide");

          const resp = await fetch("/api/ask", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          });

          const data = (await resp.json().catch(() => ({}))) as AssistantResponse;
          if (!resp.ok || data?.error || data?.ok === false) {
            const msgErr = data?.detail || data?.error || llmError.message || "Fonction indisponible";
            throw new Error(msgErr);
          }

          const nextSessionId = String(data?.session_id || "").trim();
          if (nextSessionId) setSessionId(nextSessionId);

          const answer = String(data?.answer || data?.summary || "").trim();
          const assistantMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content: answer || "Assistant indisponible. Précisez destination, incoterm, HS et type de marchandise.",
            createdAt: Date.now(),
            meta: data,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        } else {
          const nextSessionId = String(llmData?.session_id || "").trim();
          if (nextSessionId) setSessionId(nextSessionId);
          const reply = String(llmData?.reply || "").trim();
          const assistantMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content: reply || "Réponse vide de l'agent LLM. Merci de reformuler votre demande.",
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }
      } catch (err: any) {
        const msgErr = err?.message || "Assistant indisponible";
        setError(msgErr);

        toast({
          title: "Assistant indisponible",
          description: "Vous pouvez reformuler ou contacter le support humain.",
        });

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: "Assistant indisponible. Donnez destination, incoterm, HS/produit, mode de paiement, et je poserai des questions ciblées.",
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setLoading(false);
      }
    },
    [draft, loading, destination, incoterm, transportMode, messages, sessionId, toast]
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">MPL Export Expert</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Posez vos questions</h1>
              <Badge variant="outline">Chat IA</Badge>
              {sessionId ? <Badge variant="secondary">Session active</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Incoterms, taxes, documents, géopolitique, risques pays, erreurs de process export.
            </p>
            {!SUPABASE_ENV_OK ? (
              <div className="mt-2 text-sm text-rose-600">Connexion Supabase indisponible : mode fallback uniquement.</div>
            ) : null}
          </div>

          <Button variant="outline" className="gap-2" onClick={clearChat}>
            <Trash2 className="h-4 w-4" />
            Effacer
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Chat
            </CardTitle>
            <CardDescription>MPL Export Expert (posez vos questions).</CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div ref={scrollRef} className="max-h-[56vh] overflow-auto border-t border-border bg-muted/20 px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  Exemples : "Docs DAP Allemagne", "TVA & droits import USA", "Effets géopolitiques sur mon flux".
                </div>
              )}

              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl border px-3 py-2 text-sm ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                      }`}
                    >
                      {m.content}
                      {m.role === "assistant" && (m.meta?.follow_up_questions?.length || m.meta?.source_links?.length) ? (
                        <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
                          {m.meta?.follow_up_questions?.length ? (
                            <div>
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Questions de clarification</div>
                              <div className="flex flex-wrap gap-1.5">
                                {m.meta.follow_up_questions.map((q) => (
                                  <button
                                    key={q}
                                    type="button"
                                    onClick={() => setDraft(q)}
                                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                                  >
                                    {q}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {m.meta?.source_links?.length ? (
                            <div>
                              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sources</div>
                              <div className="flex flex-wrap gap-2">
                                {m.meta.source_links.slice(0, 4).map((src) => (
                                  <a
                                    key={`${src.title}-${src.url}`}
                                    href={src.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] hover:bg-muted"
                                  >
                                    {src.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div>
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {m.meta?.satisfaction_prompt || "Réponse satisfaisante ?"}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  send(
                                    "Oui, c'est satisfaisant. Peux-tu me donner le plan final en 3 actions ?",
                                    { feedback: { satisfied: true } }
                                  )
                                }
                                className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                              >
                                ✅ Oui
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  send(
                                    "Non, la réponse n'est pas satisfaisante. Repose-moi les bonnes questions et corrige.",
                                    { feedback: { satisfied: false } }
                                  )
                                }
                                className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                              >
                                🔁 Non, à corriger
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void send(p)}
                    disabled={loading}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {error ? <div className="text-sm text-rose-600">{error}</div> : null}
              <Textarea
                placeholder="Entrée = envoyer, Shift+Entrée = nouvelle ligne"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Les réponses sont indicatives. Validez les cas sensibles.
                </div>
                <Button onClick={() => void send()} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
