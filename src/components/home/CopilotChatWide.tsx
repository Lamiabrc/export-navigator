import * as React from "react";
import { Mic, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  isEn: boolean;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = {
  fr: ["Choisir un HS", "Sécuriser un paiement", "Incoterm recommandé", "Email client"],
  en: ["Pick an HS code", "Secure payment", "Recommended Incoterm", "Client email"],
};

export function CopilotChatWide({ isEn }: Props) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: "assistant",
      content: isEn
        ? "Hello, I can help with customs, Incoterms, HS code and export payments."
        : "Bonjour, je peux vous aider sur douane, Incoterms, code HS et paiements export.",
    },
  ]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const send = async (preset?: string) => {
    const text = (preset ?? draft).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 550));

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: isEn
          ? `Connection in progress. Here is a draft answer for: "${text}". Please add destination country, product and HS code for a precise action plan.`
          : `Connexion IA en cours. Voici une première réponse pour : "${text}". Ajoutez le pays destination, le produit et le code HS pour un plan d’action précis.`,
      },
    ]);
    setLoading(false);
  };

  const suggestions = isEn ? SUGGESTIONS.en : SUGGESTIONS.fr;

  return (
    <section className="w-full px-4 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-[1400px]">
        <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="space-y-3 border-b border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <CardTitle>{isEn ? "Export AI Chatbot" : "Chatbot IA export"}</CardTitle>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
          <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">{isEn ? "Export AI Chatbot" : "Chatbot IA export"}</h2>
              <Badge variant="secondary">{isEn ? "Free" : "Gratuit"}</Badge>
            </div>
            <p className="text-sm font-medium text-primary">
              {isEn ? "I reply in 60 seconds. Free." : "Je vous réponds en 60 secondes. Gratuit."}
            </p>
            <p className="text-sm text-slate-600">
              {isEn
                ? "Ask your export question (customs, Incoterm, payment, HS…)."
                : "Posez votre question export (douane, Incoterm, paiement, HS…)."}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => send(item)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
          </div>

          <div className="p-0">
            <div className="max-h-[56vh] min-h-[320px] space-y-3 overflow-y-auto p-4 md:min-h-[420px]">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {loading ? (
                <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  {isEn ? "Thinking..." : "Réflexion en cours..."}
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    isEn
                      ? "Ask your export question (customs, Incoterm, payment, HS…)"
                      : "Posez votre question export (douane, Incoterm, paiement, HS…)"
                  }
                  className="min-h-[92px] flex-1 resize-none"
                />
                <div className="flex gap-2 sm:flex-col">
                  <Button type="button" variant="outline" className="w-full sm:w-11" aria-label="Microphone">
                    <Mic className="size-4" />
                  </Button>
                  <Button type="button" onClick={() => send()} disabled={loading} className="w-full sm:w-11" aria-label="Send">
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
