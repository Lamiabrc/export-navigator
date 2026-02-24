import * as React from "react";
import { Bot, ExternalLink, Loader2, Send } from "lucide-react";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ingestChatExchange } from "@/lib/chatIngest";
import { getSupabaseAiFallback } from "@/lib/supabaseAiFallback";
import { supabase } from "@/integrations/supabase/client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: Array<{ title: string; url: string }>;
};

type ChatResponse = {
  session_id?: string;
  reply?: string;
  remaining?: number;
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function isUncertainAnswer(answer: string) {
  const txt = answer.trim().toLowerCase();
  if (!txt) return true;
  if (txt.length < 40) return true;
  if (/(pas de reponse|indisponible|erreur|vide|reessaye|reessaie)/i.test(txt)) return true;
  return false;
}

function buildResearchLinks(question: string) {
  const q = question.trim();
  const lower = q.toLowerCase();
  const links: Array<{ title: string; url: string }> = [
    {
      title: "Recherche web ciblee",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${q} reglementation export`)}`,
    },
  ];

  if (/(incoterm|fob|dap|ddp|cif|cip|exw|fca)/i.test(lower)) {
    links.push({ title: "Guide ICC Incoterms", url: "https://iccwbo.org/business-solutions/incoterms-rules/" });
  }

  if (/(douane|droit|tarif|taric|hs|code hs|tva)/i.test(lower)) {
    links.push({ title: "Douane francaise", url: "https://www.douane.gouv.fr/" });
    links.push({
      title: "Taric UE",
      url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp",
    });
  }

  if (/(sanction|embargo|restriction|compliance|conformite)/i.test(lower)) {
    links.push({ title: "EU Sanctions Map", url: "https://www.sanctionsmap.eu/" });
  }

  const deduped = new Map<string, { title: string; url: string }>();
  for (const item of links) deduped.set(item.url, item);
  return Array.from(deduped.values()).slice(0, 4);
}

export default function Copilote() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Bonjour. Posez votre question export en une phrase. Je reponds de facon simple et actionnable.",
    },
  ]);
  const [sessionId, setSessionId] = React.useState<string | undefined>();
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading]);

  const send = React.useCallback(async () => {
    const question = draft.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke<ChatResponse>("chat-free", {
        body: { session_id: sessionId, message: question },
      });

      if (response.error) throw response.error;

      const data = response.data ?? null;
      const answerRaw = String(data?.reply || "").trim();
      const uncertain = isUncertainAnswer(answerRaw);
      const links = uncertain ? buildResearchLinks(question) : [];
      const answer =
        answerRaw ||
        "Je n'ai pas de reponse certaine sur ce point. J'ai ajoute des liens internet fiables pour continuer rapidement.";

      if (data?.session_id) setSessionId(data.session_id);
      if (typeof data?.remaining === "number") setRemaining(data.remaining);

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: answer,
        links,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      void ingestChatExchange({
        channel: "copilote_page",
        source: "CopilotePage",
        question,
        answer,
        mode: uncertain ? "chat_free_with_links" : "chat_free",
        context: {
          session_id: data?.session_id || sessionId || null,
          remaining: typeof data?.remaining === "number" ? data.remaining : null,
          source_links_count: links.length,
        },
      });
    } catch (err: any) {
      const fallback = await getSupabaseAiFallback(question).catch(() => null);
      if (fallback?.answer) {
        const links = [...(fallback.sourceLinks || []), ...buildResearchLinks(question)]
          .map((item) => ({ title: item.title, url: item.url }))
          .slice(0, 4);
        const answer = String(fallback.answer || "").trim();

        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: answer, links }]);
        void ingestChatExchange({
          channel: "copilote_page",
          source: "CopilotePage",
          question,
          answer,
          mode: "supabase_ai_fallback",
          context: {
            session_id: sessionId || null,
            source_links_count: links.length,
          },
        });
        setLoading(false);
        return;
      }

      const links = buildResearchLinks(question);
      const answer =
        "Je n'ai pas pu repondre de facon fiable maintenant. Utilisez les liens internet ci-dessous pour trouver la source officielle.";

      setError("Reponse indisponible. Liens internet proposes.");
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: answer, links }]);

      void ingestChatExchange({
        channel: "copilote_page",
        source: "CopilotePage",
        question,
        answer,
        mode: "assistant_error_with_links",
        context: {
          session_id: sessionId || null,
          error: String(err?.message || "chat_free_error"),
          source_links_count: links.length,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [draft, loading, sessionId]);

  return (
    <PublicLayout>
      <main className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
        <Card className="mx-auto w-full max-w-4xl">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <CardTitle>Copilote IA export</CardTitle>
              <Badge variant="secondary">Gratuit</Badge>
            </div>
            <p className="text-sm text-slate-600">Une seule zone de saisie. Reponses claires. Liens internet proposes si besoin.</p>
            <p className="text-xs text-slate-500">Quota restant: {remaining ?? "--"} / 30</p>
          </CardHeader>

          <CardContent className="space-y-3">
            <div ref={scrollRef} className="max-h-[56vh] min-h-[360px] space-y-3 overflow-auto rounded-xl border bg-slate-50 p-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" ? (
                    <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="h-3 w-3" />
                    </div>
                  ) : null}

                  <div
                    className={`max-w-[82%] rounded-xl border px-3 py-2 text-sm ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-white"
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                    {m.role === "assistant" && m.links?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/70 pt-2">
                        {m.links.map((link) => (
                          <a
                            key={`${m.id}-${link.url}`}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[11px] text-slate-700 hover:bg-muted"
                          >
                            {link.title}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyse en cours...
                </div>
              ) : null}
            </div>

            {error ? <div className="text-xs text-rose-600">{error}</div> : null}

            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ecrivez votre question export ici..."
                className="min-h-[96px] flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />

              <Button onClick={() => void send()} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">Entree = envoyer, Shift+Entree = nouvelle ligne.</p>
          </CardContent>
        </Card>
      </main>
    </PublicLayout>
  );
}
