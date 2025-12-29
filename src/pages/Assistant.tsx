import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AssistantResponse = {
  ok?: boolean;
  mode?: "openai" | "fallback";
  destination?: string;
  destination_confidence?: number;
  summary?: string;
  sections?: Record<string, string[]>;
  questions?: string[];
  actionsSuggested?: string[];
  error?: string;
  detail?: string;
};

export default function Assistant() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [meta, setMeta] = useState<{ destination?: string; confidence?: number; mode?: string }>({});
  const [sections, setSections] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const msg = message.trim();
    if (!msg) return;

    setLoading(true);
    setError(null);
    setReply("");
    setActions([]);
    setQuestions([]);
    setMeta({});
    setSections({});

    const { data, error: fnError } = await supabase.functions.invoke<AssistantResponse>("export-assistant", {
      body: {
        message: msg,
        context: {
          destination: "Guadeloupe",
          incoterm: "DAP",
          transport_mode: "Maritime",
        },
      },
    });

    setLoading(false);

    if (fnError || data?.error) {
      console.error("export-assistant invoke error:", fnError, data);
      setError(fnError?.message || data?.detail || data?.error || "Erreur appel IA");
      return;
    }

    setReply(data?.summary || "");
    setActions(data?.actionsSuggested || []);
    setQuestions(data?.questions || []);
    setMeta({
      destination: data?.destination,
      confidence: data?.destination_confidence,
      mode: data?.mode,
    });
    setSections(data?.sections || {});
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">IA Export (Supabase Edge Function)</p>
            <h1 className="text-2xl font-bold">Assistant DROM / UE / Hors UE</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Conversation
            </CardTitle>
            <CardDescription>
              Appel via <code>supabase.functions.invoke("export-assistant")</code> (clé IA côté serveur).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Quelles mentions facture + docs pour une livraison d’orthèses en Guadeloupe (DAP, maritime) ?"
              className="min-h-[140px]"
            />

            <div className="flex gap-2 items-center">
              <Button className="gap-2" onClick={send} disabled={loading || !message.trim()}>
                <Send className="h-4 w-4" />
                {loading ? "Envoi..." : "Envoyer"}
              </Button>
              {error && <span className="text-sm text-red-500">{error}</span>}
            </div>

            {(meta.destination || meta.mode) && (
              <div className="text-sm text-muted-foreground">
                {meta.mode && <span>Mode: {meta.mode} · </span>}
                {meta.destination && <span>Zone: {meta.destination}</span>}
                {typeof meta.confidence === "number" && (
                  <span> · Confiance: {Math.round(meta.confidence * 100)}%</span>
                )}
              </div>
            )}

            {reply && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Réponse :</p>
                <div className="rounded-xl border border-border bg-muted/50 p-3 whitespace-pre-wrap text-sm">
                  {reply}
                </div>
              </div>
            )}

            {questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Questions de précision :</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {questions.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {actions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Actions suggérées :</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {actions.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(sections).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Détails (checklists) :</p>
                <div className="space-y-3">
                  {Object.entries(sections).map(([key, items]) => (
                    <div key={key} className="rounded-xl border border-border p-3">
                      <div className="text-sm font-semibold">{key}</div>
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-muted-foreground">
                        {(items || []).map((it, idx) => (
                          <li key={idx}>{it}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
