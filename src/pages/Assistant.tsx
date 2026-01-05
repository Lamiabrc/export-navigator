import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, User, Loader2, Trash2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";

const STORAGE_KEY = "orliman_assistant_chat_v2";

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

export default function Assistant() {
  const [destination, setDestination] = useState("Guadeloupe");
  const [incoterm, setIncoterm] = useState("DAP");
  const [transportMode, setTransportMode] = useState("Maritime");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      // ignore
    }
  }, [messages]);

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

  const send = async () => {
    const msg = draft.trim();
    if (loading) return;
    if (!msg) {
      setError("Merci de saisir une question (ex: obligations DAP Guadeloupe, OM/OMR, incoterm).");
      return;
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, createdAt: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft("");
    setLoading(true);
    setError(null);

    const body = {
      question: msg,
      destination: destination,
      incoterm: incoterm,
      transport_mode: transportMode,
      strict_docs_only: false,
      match_count: 8,
    };

    const fallbackText = "Assistant indisponible. Indique produit, valeur, incoterm, poids, destination. Verifie TVA + OM/OMR + transport.";

    try {
      if (!SUPABASE_ENV_OK) throw new Error("Supabase non configure");
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
      setMessages([...next, assistantMsg]);
    } catch (err: any) {
      setError(err?.message || "Assistant indisponible");
      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: fallbackText,
        createdAt: Date.now(),
      };
      setMessages([...next, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  const lastAssistant = useMemo(() => {
    const rev = [...messages].reverse();
    return rev.find((m) => m.role === "assistant") || null;
  }, [messages]);

  const sections = lastAssistant?.meta?.sections ?? {};
  const hasSections = Object.keys(sections).length > 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">IA Export (mode degrade si Edge Function HS)</p>
            <h1 className="text-2xl font-bold">Assistant DROM / UE / Hors UE</h1>
            <p className="text-sm text-muted-foreground">Reponses courtes, actions suggerees, checklists si dispo.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="gap-2" onClick={() => setShowDetails((s) => !s)}>
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDetails ? "Masquer details" : "Afficher details"}
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
            <CardDescription>Optionnel : aide l'assistant a cibler le conseil.</CardDescription>
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
              <Input value={transportMode} onChange={(e) => setTransportMode(e.target.value)} placeholder="Ex: Maritime" />
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
                    <div className={`max-w-[80%] rounded-xl border px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
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
                placeholder="Ecris ta question... (Entree = envoyer, Shift+Entree = nouvelle ligne)"
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
                  <RefreshCw className="h-3 w-3" /> Mode degrade actif si l'Edge Function echoue.
                </div>
                <Button onClick={() => void send()} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showDetails && hasSections ? (
          <Card>
            <CardHeader>
              <CardTitle>Details / Checklists</CardTitle>
              <CardDescription>Sections renvoyees par l'assistant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(sections).map(([title, lines]) => (
                <div key={title} className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">{title}</div>
                  <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                    {lines.map((l, idx) => (
                      <li key={idx}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MainLayout>
  );
}
