import * as React from "react";
import { Mic, MicOff, Send, Volume2, Loader2 } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { HsAutocomplete } from "@/components/hs/HsAutocomplete";
import { supabase } from "@/integrations/supabase/client";

type ChatMsg = { role: "user" | "assistant"; content: string };

type ChatResponse = { session_id?: string; reply?: string; remaining?: number; sources?: Array<{ document_title?: string; chunk_id?: string }> };

export default function Copilote() {
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [sessionId, setSessionId] = React.useState<string | undefined>();
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [remaining, setRemaining] = React.useState<number | null>(null);

  const [countryIso2, setCountryIso2] = React.useState("FR");
  const [product, setProduct] = React.useState("Machines agricoles");
  const [hs6, setHs6] = React.useState("100101");
  const [incoterm, setIncoterm] = React.useState("FCA");
  const [paymentTerms, setPaymentTerms] = React.useState("30% acompte, 70% BL");

  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);

  const send = async () => {
    const message = draft.trim();
    if (!message || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setDraft("");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke<ChatResponse>("chat-free", {
      body: { session_id: sessionId, message, context: { countryIso2, hs6, product, incoterm, paymentTerms } },
    });
    if (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Erreur: ${error.message}` }]);
    } else {
      setSessionId(data?.session_id);
      if (typeof data?.remaining === "number") setRemaining(data.remaining);
      setMessages((prev) => [...prev, { role: "assistant", content: data?.reply || "Réponse vide." }]);
    }
    setLoading(false);
  };

  const startDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.onresult = (ev: any) => setDraft((prev) => `${prev} ${ev.results?.[0]?.[0]?.transcript || ""}`.trim());
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const stopDictation = () => {
    recognitionRef.current?.stop?.();
    setListening(false);
  };

  const speakLast = () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(last.content));
  };

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.32fr)_minmax(0,0.68fr)]">
          <Card className="order-2 lg:order-1">
            <CardHeader><CardTitle>Contexte export</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={countryIso2} onChange={(e) => setCountryIso2(e.target.value.toUpperCase())} placeholder="Pays ISO2" />
              <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Produit" />
              <HsAutocomplete value={hs6} onChange={setHs6} productContext={product} />
              <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="Incoterm" />
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="Paiement" />
              <p className="text-xs text-slate-500">Quota gratuit restant: {remaining ?? "--"} / 30</p>
            </CardContent>
          </Card>

          <Card className="order-1 lg:order-2">
            <CardHeader><CardTitle>Copilote IA (texte + vocal)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[58vh] space-y-2 overflow-auto rounded-lg border p-3">
                {messages.map((m, idx) => (
                  <div key={`${m.role}-${idx}`} className={`rounded-lg p-2 text-sm ${m.role === "user" ? "bg-primary/10" : "bg-slate-100"}`}>
                    <p className="mb-1 text-[11px] uppercase text-slate-500">{m.role}</p>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))}
                {loading ? <p className="text-sm text-slate-500"><Loader2 className="mr-1 inline size-4 animate-spin" /> Réponse en cours...</p> : null}
              </div>

              <div className="space-y-2">
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Posez votre question export..." className="min-h-24" />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="w-full" onClick={send} disabled={loading}><Send className="mr-2 size-4" />Envoyer</Button>
                  <Button type="button" variant="outline" className="w-full" onClick={listening ? stopDictation : startDictation}>{listening ? <MicOff className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}{listening ? "Arrêter" : "Dictée"}</Button>
                  <Button type="button" variant="outline" className="w-full" onClick={speakLast}><Volume2 className="mr-2 size-4" />Écouter</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </PublicLayout>
  );
}
