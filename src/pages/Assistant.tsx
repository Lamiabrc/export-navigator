import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, User, Loader2, Trash2, ChevronDown, ChevronUp, List, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type AssistantSections = Record<string, string[]>;

type AssistantResponse = {
  ok?: boolean;
  mode?: "openai" | "fallback";
  destination?: string;
  destination_confidence?: number;
  answer?: string;
  summary?: string; // compat ancien format
  questions?: string[];
  actionsSuggested?: string[];
  sections?: AssistantSections;
  detail?: string;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: {
    destination?: string;
    confidence?: number;
    mode?: string;
    actions?: string[];
    questions?: string[];
    sections?: AssistantSections;
    detail?: string;
  };
  createdAt: number;
};

const STORAGE_KEY = "orliman_assistant_chat_v1";

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function titleCaseKey(k: string) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

export default function Assistant() {
  // context “métier” (facultatif, mais utile)
  const [destination, setDestination] = useState("Guadeloupe");
  const [incoterm, setIncoterm] = useState("DAP");
  const [transportMode, setTransportMode] = useState("Maritime");

  // chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI : détails (checklists)
  const [showDetails, setShowDetails] = useState(false);
  const [includeSections, setIncludeSections] = useState(false);

  // pour “récupérer les checklists” sur le dernier message
  const lastUserMessage = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((m) => m.role === "user")?.content ?? "";
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // load chat
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed)) setMessages(parsed);
    } catch {
      // ignore
    }
  }, []);

  // save chat
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      // ignore
    }
  }, [messages]);

  // auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading, showDetails]);

  const clearChat = () => {
    setMessages([]);
    setDraft("");
    setError(null);
    setShowDetails(false);
    setIncludeSections(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const toHistory = (msgs: ChatMessage[]) =>
    msgs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

  const send = async (text?: string, opts?: { include_sections?: boolean; resendLast?: boolean }) => {
    const msg = (text ?? draft).trim();
    if (!msg || loading) return;

    setLoading(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: msg,
      createdAt: Date.now(),
    };

    // si on “resend” juste pour récupérer les checklists, on n’ajoute pas un nouveau message user
    const nextMessages = opts?.resendLast ? messages : [...messages, userMessage];

    if (!opts?.resendLast) {
      setMessages(nextMessages);
      setDraft("");
    }

    const history = toHistory(nextMessages);

    const body = {
      message: msg,
      history,
      context: {
        destination,
        incoterm,
        transport_mode: transportMode,
      },
      include_sections: Boolean(opts?.include_sections),
    };

    const { data, error: fnError } = await supabase.functions.invoke<AssistantResponse>("export-assistant", {
      body,
    });

    setLoading(false);

    if (fnError || data?.error || data?.ok === false) {
      const msgErr = fnError?.message || data?.detail || data?.error || "Erreur lors de l’appel de la fonction.";
      setError(msgErr);
      return;
    }

    const answer = (data?.answer || data?.summary || "").trim();
    const assistantMessage: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: answer || "Je n’ai pas pu générer de réponse. Réessaie avec plus de détails (produit, valeur, incoterm…).",
      createdAt: Date.now(),
      meta: {
        destination: data?.destination,
        confidence: data?.destination_confidence,
        mode: data?.mode,
        actions: data?.actionsSuggested ?? [],
        questions: data?.questions ?? [],
        sections: data?.sections ?? {},
        detail: data?.detail,
      },
    };

    // si c’était un resend “checklists”, on remplace la dernière réponse assistant si elle existe
    setMessages((prev) => {
      if (opts?.resendLast) {
        const p = [...prev];
        const lastIdx = [...p].reverse().findIndex((m) => m.role === "assistant");
        if (lastIdx !== -1) {
          const idx = p.length - 1 - lastIdx;
          p[idx] = assistantMessage;
          return p;
        }
      }
      return [...nextMessages, assistantMessage];
    });

    // Quand on demande include_sections, on affiche automatiquement le panneau détails
    if (opts?.include_sections) setShowDetails(true);
  };

  const requestChecklists = async () => {
    if (!lastUserMessage) return;
    await send(lastUserMessage, { include_sections: true, resendLast: true });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = envoyer, Shift+Enter = nouvelle ligne
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const lastAssistant = useMemo(() => {
    const reversed = [...messages].reverse();
    return reversed.find((m) => m.role === "assistant") || null;
  }, [messages]);

  const lastMeta = lastAssistant?.meta;

  const hasSections = useMemo(() => {
    const s = lastMeta?.sections ?? {};
    return Object.keys(s).length > 0;
  }, [lastMeta]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">IA Export (Supabase Edge Function)</p>
            <h1 className="text-2xl font-bold">Assistant DROM / UE / Hors UE</h1>
            <p className="text-sm text-muted-foreground">
              Réponses courtes + questions utiles. Les checklists sont optionnelles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" className="gap-2" onClick={() => setShowDetails((s) => !s)}>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDetails ? "Masquer détails" : "Afficher détails"}
            </Button>
            <Button variant="destructive" className="gap-2" onClick={clearChat}>
              <Trash2 className="h-4 w-4" />
              Effacer
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contexte rapide</CardTitle>
            <CardDescription>
              Optionnel : aide l’IA à être plus précise (incoterm, transport, destination).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Destination</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: Guadeloupe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Incoterm</label>
              <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="Ex: DAP" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Transport</label>
              <Input
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                placeholder="Ex: Maritime"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Chat
            </CardTitle>
            <CardDescription>
              Appel via <code>supabase.functions.invoke("export-assistant")</code> (clé IA côté serveur).
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {/* Thread */}
            <div ref={scrollRef} className="max-h-[56vh] overflow-auto border-t border-border bg-muted/20 px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  Pose une question comme :
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>“Quels documents pour expédier des orthèses en Guadeloupe (DAP, maritime) ?”</li>
                    <li>“Mentions facture + risques pour un client en Nouvelle-Calédonie ?”</li>
                    <li>“Monaco : comment facturer et quelles preuves conserver ?”</li>
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={[
                      "flex gap-3",
                      m.role === "user" ? "justify-end" : "justify-start",
                    ].join(" ")}
                  >
                    {m.role === "assistant" && (
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={[
                        "max-w-[860px] rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground border-primary/20"
                          : "bg-background border-border",
                      ].join(" ")}
                    >
                      {m.content}

                      {/* Meta bloc : uniquement sur la dernière réponse assistant, et seulement si showDetails */}
                      {m.role === "assistant" && showDetails && m.meta && (
                        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                          <div className="text-xs text-muted-foreground space-y-1">
                            {m.meta.mode && <div>Mode : {m.meta.mode}</div>}
                            {m.meta.destination && (
                              <div>
                                Zone : {m.meta.destination}
                                {typeof m.meta.confidence === "number" && (
                                  <> · Confiance : {Math.round(m.meta.confidence * 100)}%</>
                                )}
                              </div>
                            )}
                            {m.meta.detail && <div className="opacity-80">{m.meta.detail}</div>}
                          </div>

                          {Array.isArray(m.meta.actions) && m.meta.actions.length > 0 && (
                            <div>
                              <div className="text-sm font-semibold">Actions</div>
                              <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {m.meta.actions.slice(0, 5).map((a, idx) => (
                                  <li key={idx}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(m.meta.questions) && m.meta.questions.length > 0 && (
                            <div>
                              <div className="text-sm font-semibold">Questions</div>
                              <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {m.meta.questions.slice(0, 5).map((q, idx) => (
                                  <li key={idx}>{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Checklists : affichage seulement si présentes */}
                          {m.meta.sections && Object.keys(m.meta.sections).length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">Checklists</div>
                              </div>
                              <div className="space-y-3">
                                {Object.entries(m.meta.sections).map(([k, items]) => (
                                  <div key={k} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                                    <div className="text-sm font-semibold">{titleCaseKey(k)}</div>
                                    <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                      {(items || []).map((it, idx) => (
                                        <li key={idx}>{it}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Bouton pour récupérer les checklists si non présentes */}
                          {!hasSections && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                className="gap-2"
                                onClick={requestChecklists}
                                disabled={loading || !lastUserMessage}
                              >
                                <List className="h-4 w-4" />
                                Récupérer les checklists
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {m.role === "user" && (
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {loading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Réflexion en cours…
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border bg-background p-4">
              <div className="space-y-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Écris ta question… (Entrée = envoyer, Shift+Entrée = nouvelle ligne)"
                  className="min-h-[110px]"
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="gap-2"
                      onClick={() => send()}
                      disabled={loading || !draft.trim()}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Envoyer
                    </Button>

                    <Button
                      variant="secondary"
                      className="gap-2"
                      onClick={() => {
                        // renvoie le dernier message user (utile si tu changes incoterm/destination)
                        if (!lastUserMessage) return;
                        send(lastUserMessage, { include_sections: includeSections, resendLast: false });
                      }}
                      disabled={loading || !lastUserMessage}
                      title="Relancer avec le dernier message"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Relancer
                    </Button>

                    <Button
                      variant={includeSections ? "default" : "secondary"}
                      className="gap-2"
                      onClick={() => setIncludeSections((v) => !v)}
                      title="Inclure les checklists dans la réponse (plus long)"
                    >
                      <List className="h-4 w-4" />
                      Checklists : {includeSections ? "ON" : "OFF"}
                    </Button>
                  </div>

                  <div className="min-h-[20px] text-sm">
                    {error && <span className="text-red-500">{error}</span>}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Astuce : si la réponse est trop longue, laisse <b>Checklists OFF</b> et ouvre “Afficher détails” uniquement quand nécessaire.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
