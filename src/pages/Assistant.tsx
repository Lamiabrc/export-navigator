import { useState } from "react";
import { Bot, Send } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AssistantResponse = {
  answer?: string;
  actionsSuggested?: string[];
  citations?: string[];
  error?: string;
  detail?: string;
};

export default function Assistant() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const msg = message.trim();
    if (!msg) return;

    setLoading(true);
    setError(null);
    setReply("");
    setActions([]);

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
      setError(fnError?.message || data?.detail || data?.error || "Erreur appel IA");
      return;
    }

    setReply(data?.answer || "");
    setActions(data?.actionsSuggested || []);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">IA Export (Edge Function)</p>
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
              Connecté à la fonction edge <code>export-assistant</code>. Aucune clé IA dans le front.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex: Propose un HS code pour une attelle de cheville livrée en Guadeloupe (DAP, aérien)."
              className="min-h-[140px]"
            />
            <div className="flex gap-2 items-center">
              <Button className="gap-2" onClick={send} disabled={loading || !message.trim()}>
                <Send className="h-4 w-4" />
                {loading ? "Envoi..." : "Envoyer"}
              </Button>
              {error && <span className="text-sm text-red-500">{error}</span>}
            </div>

            {reply && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Réponse :</p>
                <div className="rounded-xl border border-border bg-muted/50 p-3 whitespace-pre-wrap text-sm">
                  {reply}
                </div>
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
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
