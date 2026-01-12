import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, User, Loader2, Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

const STORAGE_KEY = "orliman_assistant_chat_v2";
const PREFS_KEY = "orliman_assistant_prefs_v1";

type AssistantSections = Record<string, string[]>;

type AssistantResponse = {
  ok?: boolean;
  mode?: string;
  destination?: string;
  destination_confidence?: number;
  answer?: string;
  summary?: string;
  questions?: string[];
  actionsSuggested?: string[];
  sections?: AssistantSections;
  // (recommandé côté edge function)
  sources?: { title?: string; source?: string; url?: string; excerpt?: string }[];
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

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export default function Assistant() {
  const [destination, setDestination] = useState("Guadeloupe");
  const [incoterm, setIncoterm] = useState("DAP");
  const [transportMode, setTransportMode] = useState("Maritime");

  // ✅ réglages RAG
  const [strictDocsOnly, setStrictDocsOnly] = useState(false);
  const [matchCount, setMatchCount] = useState(8);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Charger messages
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

  // Charger prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as any;
      if (typeof p?.destination === "string") setDestination(p.destination);
      if (typeof p?.incoterm === "string") setIncoterm(p.incoterm);
      if (typeof p?.transportMode === "string") setTransportMode(p.transportMode);
      if (typeof p?.strictDocsOnly === "boolean") setStrictDocsOnly(p.strictDocsOnly);
      if (typeof p?.matchCount === "number") setMatchCount(clampInt(p.matchCount, 1, 20));
    } catch {
      // ignore
    }
  }, []);

  // Sauver messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      // ignore
    }
  }, [messages]);

  // Sauver prefs
  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          destination,
          incoterm,
          transportMode,
          strictDocsOnly,
          matchCount: clampInt(matchCount, 1, 20),
        })
      );
    } catch {
      // ignore
    }
  }, [destination, incoterm, transportMode, strictDocsOnly, matchCount]);

  // Auto scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const clearChat = () => {
    setMessages([]);
    setDraft("");
    setError(null);
  };

  const fallbackText =
    "Assistant indisponible. Indique produit, valeur, incoterm, poids, destination. Vérifie TVA + OM/OMR + transport.";

  const sendQuestion = async (question: string) => {
    const msg = question.trim();
    if (loading) return;

    if (!msg) {
      setError("Merci de saisir une question (ex: obligations DAP Guadeloupe, OM/OMR, incoterm).");
      return;
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, createdAt: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    const body = {
      question: msg,
      destination,
      incoterm,
      transport_mode: transportMode,
      strict_docs_only: strictDocsOnly,
      match_count: clampInt(matchCount, 1, 20),
    };

    try {
      if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré");

      const { data, error: fnError } = await supabase.functions.invoke<AssistantResponse>("export-assistant", { body });

      if (fnError || data?.error || data?.ok === false) {
        const msgErr = fnError?.message || data?.detail || data?.error || "Fonction indisponible";
        throw new Error(msgErr);
      }

      const answer = (data?.answer || data?.summary || "").trim();

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: answer || fallbackText,
        createdAt: Date.now(),
        meta: data,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err?.message || "Assistant indisponible");
      const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: fallbackText, createdAt: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    const msg = draft.trim();
    setDraft("");
    await sendQuestion(msg);
  };

  const lastAssistant = useMemo(() => {
    const rev = [...messages].reverse();
    return rev.find((m) => m.role === "assistant") || null;
  }, [messages]);

  const sections = lastAssistant?.meta?.sections ?? {};
  const hasSections = Object.keys(sections).length > 0;

  const lastMeta = lastAssistant?.meta;
  const hasMetaExtras =
    (lastMeta?.actionsSuggested?.length || 0) > 0 ||
    (lastMeta?.questions?.length || 0) > 0 ||
    (lastMeta?.sources?.length || 0) > 0 ||
    hasSections;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">IA Export (mode dégradé si Edge Function HS)</p>
            <h1 className="text-2xl font-bold">Assistant DROM / UE / Hors UE</h1>
            <p className="text-sm text-muted-foreground">Réponses courtes, actions suggérées, checklists si dispo.</p>
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
            <CardDescription>Optionnel : aide l'assistant à cibler le conseil.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm text-muted-foreground">Destination</label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Ex: Guadeloupe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Incoterm</label>
              <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="Ex: DAP" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Transport</label>
              <Input value={transportMode} onChange={(e) => setTransportMode(e.target.value)} placeholder="Ex: Maritime" />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">RAG</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={strictDocsOnly ? "default" : "outline"}
                  className="h-9 px-3"
                  onClick={() => setStrictDocsOnly((v) => !v)}
                  title="Si activé, l’assistant doit répondre uniquement si des sources pertinentes sont trouvées."
                >
                  {strictDocsOnly ? "Docs only: ON" : "Docs only: OFF"}
                </Button>
              </div>
              <div className="mt-2">
                <label className="text-xs text-muted-foreground">match_count (1–20)</label>
                <Input
                  value={String(matchCount)}
                  onChange={(e) => setMatchCount(clampInt(Number(e.target.value), 1, 20))}
                  className="h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Chat
            </CardTitle>
            <CardDescription>Appel supabase.functions.invoke("export-assistant") avec fallback local.</CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div ref={scrollRef} className="max-h-[56vh] overflow-auto border-t border-border bg-muted/20 px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                  Pose une question : obligations DAP Guadeloupe, documents facture, taxes OM/OMR, etc.
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
                placeholder="Écris ta question... (Entrée = envoyer, Shift+Entrée = nouvelle ligne)"
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
                  <RefreshCw className="h-3 w-3" /> Mode dégradé actif si l'Edge Function échoue.
                </div>
                <Button onClick={() => void send()} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showDetails && hasMetaExtras ? (
          <Card>
            <CardHeader>
              <CardTitle>Détails / Sources</CardTitle>
              <CardDescription>Utile pour valider la recherche et réduire les hallucinations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lastMeta?.summary ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Résumé</div>
                  <div className="text-sm text-muted-foreground mt-1">{lastMeta.summary}</div>
                </div>
              ) : null}

              {(lastMeta?.actionsSuggested?.length || 0) > 0 ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Actions suggérées</div>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1 mt-1">
                    {lastMeta!.actionsSuggested!.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(lastMeta?.questions?.length || 0) > 0 ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Questions de précision</div>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1 mt-1">
                    {lastMeta!.questions!.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(lastMeta?.sources?.length || 0) > 0 ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">Sources (RAG)</div>
                  <div className="space-y-2 mt-2">
                    {lastMeta!.sources!.map((s, i) => (
                      <div key={i} className="rounded-md border p-2">
                        <div className="text-sm font-medium">{s.title || s.source || `Source ${i + 1}`}</div>
                        {s.url ? <div className="text-xs text-muted-foreground break-all">{s.url}</div> : null}
                        {s.excerpt ? <div className="text-xs text-muted-foreground mt-1">{s.excerpt}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasSections ? (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold mb-2">Checklists</div>
                  <div className="space-y-3">
                    {Object.entries(sections).map(([title, lines]) => (
                      <div key={title} className="rounded-md border p-2">
                        <div className="text-sm font-semibold">{title}</div>
                        <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1 mt-1">
                          {lines.map((l, idx) => (
                            <li key={idx}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MainLayout>
  );
}
