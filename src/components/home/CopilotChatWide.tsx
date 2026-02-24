import * as React from "react";
import { Mic, MicOff, Send, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ingestChatExchange } from "@/lib/chatIngest";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  isEn: boolean;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type ChatFreeResponse = {
  session_id?: string;
  reply?: string;
  remaining?: number;
  detected_context?: {
    countryIso2?: string;
    product?: string;
    hs6?: string;
  };
  follow_up_questions?: string[];
};

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
  const [listening, setListening] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | undefined>(undefined);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [detectedContext, setDetectedContext] = React.useState<ChatFreeResponse["detected_context"]>({});
  const [followUps, setFollowUps] = React.useState<string[]>([]);
  const recognitionRef = React.useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);

  const send = async (preset?: string) => {
    const text = (preset ?? draft).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    setLoading(true);

    let data: ChatFreeResponse | null = null;
    let error: Error | null = null;
    try {
      const response = await supabase.functions.invoke<ChatFreeResponse>("chat-free", {
        body: { session_id: sessionId, message: text },
      });
      data = response.data ?? null;
      error = response.error as Error | null;
    } catch (exception) {
      error = exception as Error;
    }

    if (error) {
      const answer = isEn
        ? "AI connection in progress. I can already guide you: share destination country, product and HS code."
        : "Connexion IA en cours. Je peux deja vous guider: partagez pays destination, produit et code HS.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
        },
      ]);
      void ingestChatExchange({
        channel: "home_copilot",
        source: "CopilotChatWide",
        question: text,
        answer,
        mode: "chat_free_error",
        context: {
          session_id: sessionId ?? null,
          error: error.message || null,
        },
      });
      setLoading(false);
      return;
    }

    setSessionId(data?.session_id);
    setRemaining(typeof data?.remaining === "number" ? data.remaining : null);
    setDetectedContext(data?.detected_context || {});
    setFollowUps((data?.follow_up_questions || []).slice(0, 2));
    const answer = data?.reply || "Reponse vide";
    setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    void ingestChatExchange({
      channel: "home_copilot",
      source: "CopilotChatWide",
      question: text,
      answer,
      mode: "chat_free",
      context: {
        session_id: data?.session_id || sessionId || null,
        remaining: typeof data?.remaining === "number" ? data.remaining : null,
        detected_context: data?.detected_context || {},
      },
    });
    setLoading(false);
  };

  const toggleDictation = () => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = isEn ? "en-US" : "fr-FR";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (!transcript) return;
      setDraft((prev) => `${prev} ${transcript}`.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  const suggestions = isEn ? SUGGESTIONS.en : SUGGESTIONS.fr;

  return (
    <section id="copilote" className="w-full">
      <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
        <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">{isEn ? "Export AI Chatbot" : "Chatbot IA export"}</h2>
            <Badge variant="secondary">{isEn ? "Free" : "Gratuit"}</Badge>
          </div>
          <p className="text-sm font-medium text-primary">{isEn ? "I reply in 60 seconds. Free." : "Je vous réponds en 60 secondes. Gratuit."}</p>
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
          <div className="text-xs text-slate-500">
            {isEn ? "Remaining today" : "Restant aujourd'hui"}: {remaining ?? "--"}/30
          </div>
          {detectedContext?.countryIso2 || detectedContext?.product || detectedContext?.hs6 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">{isEn ? "Detected context:" : "Contexte détecté:"}</span>
              {detectedContext.countryIso2 ? <Badge variant="outline">{detectedContext.countryIso2}</Badge> : null}
              {detectedContext.product ? <Badge variant="outline">{detectedContext.product}</Badge> : null}
              {detectedContext.hs6 ? <Badge variant="outline">HS {detectedContext.hs6}</Badge> : null}
            </div>
          ) : null}
          {followUps.length ? (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-semibold">{isEn ? "To refine, answer:" : "Pour affiner, répondez à:"}</p>
              {followUps.map((q) => (
                <button key={q} type="button" onClick={() => setDraft(q)} className="block text-left underline">
                  {q}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="max-h-[60vh] min-h-[320px] space-y-3 overflow-y-auto p-4 md:min-h-[420px] md:p-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-4xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {message.content}
            </div>
          ))}
          {loading ? (
            <div className="max-w-4xl rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
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
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-11"
                aria-label="Microphone"
                onClick={toggleDictation}
              >
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
              <Button type="button" onClick={() => send()} disabled={loading} className="w-full sm:w-11" aria-label="Send">
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
