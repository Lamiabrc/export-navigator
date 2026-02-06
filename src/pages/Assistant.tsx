import * as React from "react";
import { Bot, Send, User, Loader2, Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

const STORAGE_KEY = "mpl_assistant_chat_v2";

type AssistantSections = Record<string, string[]>;
type Citation = { title: string; chunk_index: number; similarity?: number; published_at?: string };

type AssistantResponse = {
  ok?: boolean;
  mode?: string;
  destination?: string;
  incoterm?: string | null;
  transport_mode?: string | null;

  answer?: string;
  summary?: string;
  questions?: string[];
  actionsSuggested?: string[];
  sections?: AssistantSections;

  citations?: Citation[];
  debug?: any;

  detail?: string;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  meta?: AssistantResponse;
};

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
function safeLSRemove(key: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function Assistant() {
  const { toast } = useToast();

  // ✅ Defaults plus généraux
  const [destination, setDestination] = React.useState("Allemagne");
  const [incoterm, setIncoterm] = React.useState("DAP");
  const [transportMode, setTransportMode] = React.useState("Route");

  const [strictDocsOnly, setStrictDocsOnly] = React.useState(false);
  const [matchCount, setMatchCount] = React.useState(8);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const FALLBACK_TEXT =
    "Assistant indisponible. Donne : HS code, valeur, incoterm, origine, destination, mode de transport, et qui paie droits/TVA.";

  // Load chat history
  React.useEffect(() => {
    const raw = safeLSGet(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;

      const cleaned = parsed
        .filter((m: any) => m && typeof m === "object")
        .map((m: any) => ({
          id: typeof m.id === "string" ? m.id : uid(),
          role: m.role === "assistant" ? "assistant" : "user",
          content: typeof m.content === "string" ? m.content : "",
          createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
          meta: m.meta && typeof m.meta === "object" ? (m.meta as AssistantResponse) : undefined,
        }))
        .filter((m: ChatMessage) => m.content.trim().length > 0);

      setMessages(cleaned.slice(-50));
    } catch {
      // ignore
    }
  }, []);

  // Persist last 50 messages
  React.useEffect(() => {
    safeLSSet(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  }, [messages]);

  // Auto scroll
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
    safeLSRemove(STORAGE_KEY);
    toast({ title: "Chat effacé", description: "Historique supprimé sur cet appareil." });
  }, [toast]);

  const send = React.useCallback(async () => {
    const msg = draft.trim();
    if (loading) return;

    if (!msg) {
      const m =
        "Merci de saisir une question (ex: documents DAP Allemagne, droits/TVA import, incoterms, origine préférentielle).";
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
      destination,
      incoterm,
      transport_mode: transportMode,
      strict_docs_only: strictDocsOnly,
      match_count: clamp(matchCount, 1, 20),
    };

    try {
      if (!SUPABASE_ENV_OK) throw new Error("Connexion base indisponible.");

      const { data, error: fnError } = await supabase.functions.invoke<AssistantResponse>("export-assistant", {
        body,
      });

      if (fnError || data?.error || data?.ok === false) {
        const msgErr = fnError?.message || data?.detail || data?.error || "Fonction indisponible";
        throw new Error(msgErr);
      }

      const answer = (data?.answer || data?.summary || "").trim();

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: answer || FALLBACK_TEXT,
        createdAt: Date.now(),
        meta: data,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const msgErr = err?.message || "Assistant indisponible";
      setError(msgErr);

      toast({
        title: "Assistant indisponible",
        description: msgErr,
      });

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: FALLBACK_TEXT,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  }, [draft, loading, destination, incoterm, transportMode, strictDocsOnly, matchCount, toast]);

  const lastAssistant = React.useMemo(() => {
    const rev = [...messages].reverse();
    return rev.find((m) => m.role === "assistant") || null;
  }, [messages]);

  const meta = lastAssistant?.meta;
  const sections = meta?.sections ?? {};
  const citations = meta?.citations ?? [];
  const hasSections = Object.keys(sections).length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">IA Export (RAG docs + fallback)</p>
            <h1 className="text-2xl font-bold">Assistant Export & Import</h1>
            <p className="text-sm text-muted-foreground">
              Documents, incoterms, droits/TVA, origine, conformité — réponses actionnables + citations si dispo.
            </p>
            {!SUPABASE_ENV_OK ? (
              <div className="mt-2 text-sm text-rose-600">Connexion Supabase indisponible : mode fallback uniquement.</div>
            ) : null}
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
            <CardTitle>Contexte (optionnel)</CardTitle>
            <CardDescription>Plus tu précises, plus la réponse est opérationnelle.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Destination (pays / zone)</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: Allemagne / USA / UE" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Incoterm</label>
              <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="Ex: EXW / FOB / DDP" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Transport</label>
              <Input value={transportMode} onChange={(e) => setTransportMode(e.target.value)} placeholder="Ex: Route / Air / Mer" />
            </div>

            <div className="sm:col-span-3 flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={strictDocsOnly} onCheckedChange={setStrictDocsOnly} />
                <span className="text-sm text-muted-foreground">Docs only</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">match_count</span>
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  max={20}
                  value={matchCount}
                  onChange={(e) => setMatchCount(clamp(Number(e.target.value || 8), 1, 20))}
                />
              </div>

              {meta?.mode ? <Badge variant="outline">mode: {meta.mode}</Badge> : null}
              {meta?.destination ? <Badge variant="secondary">dest: {meta.destination}</Badge> : null}
              {meta?.incoterm ? <Badge variant="secondary">incoterm: {meta.incoterm}</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Chat
            </CardTitle>
            <CardDescription>Appel supabase.functions.invoke("export-assistant").</CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div ref={scrollRef} className="max-h-[56vh] overflow-auto border-t border-border bg-muted/20 px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  Exemples : “Docs FOB Chine”, “TVA & droits import USA”, “Origine préférentielle UE”, “Sanctions & restrictions”, “HS code et exigences”.
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
                    </div>
                    {m.role === "user" && (
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-4 space-y-3">
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
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <RefreshCw className="h-3 w-3" /> Si la base documentaire ne répond pas, fallback conseillé.
                </div>
                <Button onClick={() => void send()} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showDetails ? (
          <Card>
            <CardHeader>
              <CardTitle>Détails</CardTitle>
              <CardDescription>Checklists + citations (si disponibles).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {meta?.summary ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Résumé</div>
                  <div className="text-sm text-muted-foreground mt-1">{meta.summary}</div>
                </div>
              ) : null}

              {meta?.actionsSuggested?.length ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Actions suggérées</div>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1 mt-2">
                    {meta.actionsSuggested.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {meta?.questions?.length ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Questions utiles</div>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1 mt-2">
                    {meta.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {hasSections ? (
                <div className="space-y-3">
                  {Object.entries(sections).map(([title, lines]) => (
                    <div key={title} className="rounded-lg border p-3">
                      <div className="text-sm font-semibold">{title}</div>
                      <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1 mt-2">
                        {lines.map((l, idx) => (
                          <li key={idx}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aucune section renvoyée.</div>
              )}

              {citations.length ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Citations</div>
                  <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                    {citations.slice(0, 12).map((c, i) => (
                      <li key={i}>
                        • {c.title} — chunk {c.chunk_index}
                        {typeof c.similarity === "number" ? ` (sim ${c.similarity.toFixed(3)})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppLayout>
  );
}
