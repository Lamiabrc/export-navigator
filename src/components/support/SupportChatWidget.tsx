import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send, Loader2, MessageCircle, X, ChevronDown, ChevronUp, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AssistantResponse = {
  ok?: boolean;
  mode?: string;
  answer?: string;
  summary?: string;
  detail?: string;
  error?: string;
  citations?: Array<{ title: string; chunk_index: number; similarity?: number }>;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  meta?: AssistantResponse;
};

type SupportChatWidgetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  defaultContext?: {
    destination?: string;
    incoterm?: string;
    transport_mode?: string;
  };
};

const STORAGE_KEY = "mpl_support_widget_chat_v1";
const QUICK_PROMPTS = [
  "Quels documents pour un export DAP vers l'Allemagne ?",
  "TVA et droits import USA : que prevoir ?",
  "Incoterm CIP : assurance obligatoire ?",
  "Restrictions / sanctions a verifier pour la Turquie ?",
];

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

function buildContactDraft(message: ChatMessage | null, context: string) {
  const lines: string[] = [];
  if (message?.content) lines.push(`Question: ${message.content}`);
  if (context) lines.push(`Contexte: ${context}`);
  return lines.join("\n");
}

export default function SupportChatWidget({
  open,
  onOpenChange,
  defaultOpen = false,
  defaultContext,
}: SupportChatWidgetProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen));
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? Boolean(open) : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [destination, setDestination] = React.useState(defaultContext?.destination || "UE");
  const [incoterm, setIncoterm] = React.useState(defaultContext?.incoterm || "DAP");
  const [transportMode, setTransportMode] = React.useState(defaultContext?.transport_mode || "Route");

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showContext, setShowContext] = React.useState(false);
  const [showContact, setShowContact] = React.useState(false);

  const [contactEmail, setContactEmail] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactMessage, setContactMessage] = React.useState("");
  const [contactLoading, setContactLoading] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const raw = safeLSGet(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned: ChatMessage[] = parsed
        .filter((m: any) => m && typeof m === "object")
        .map((m: any) => ({
          id: typeof m.id === "string" ? m.id : uid(),
          role: m.role === "assistant" ? "assistant" : "user",
          content: typeof m.content === "string" ? m.content : "",
          createdAt: typeof m.createdAt === "number" ? m.createdAt : Date.now(),
          meta: m.meta && typeof m.meta === "object" ? m.meta : undefined,
        }))
        .filter((m) => m.content.trim().length > 0);
      setMessages(cleaned.slice(-40));
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    safeLSSet(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  }, [messages]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading, isOpen]);

  React.useEffect(() => {
    if (user?.email && !contactEmail) setContactEmail(user.email);
  }, [user?.email, contactEmail]);

  const lastUser = React.useMemo(() => {
    const rev = [...messages].reverse();
    return rev.find((m) => m.role === "user") || null;
  }, [messages]);

  const lastAssistant = React.useMemo(() => {
    const rev = [...messages].reverse();
    return rev.find((m) => m.role === "assistant") || null;
  }, [messages]);

  const lastMode = lastAssistant?.meta?.mode;

  const send = React.useCallback(
    async (override?: string) => {
      if (loading) return;
      const msg = (override ?? draft).trim();
      if (!msg) {
        setError("Ajoute une question pour lancer l'aide IA.");
        return;
      }

      const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, createdAt: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setDraft("");
      setLoading(true);
      setError(null);

      try {
        if (!SUPABASE_ENV_OK) throw new Error("Connexion base indisponible.");

        const { data, error: fnError } = await supabase.functions.invoke<AssistantResponse>("export-assistant", {
          body: {
            question: msg,
            destination,
            incoterm,
            transport_mode: transportMode,
          },
        });

        if (fnError || data?.error || data?.ok === false) {
          const msgErr = fnError?.message || data?.detail || data?.error || "Assistant indisponible";
          throw new Error(msgErr);
        }

        const answer = String(data?.answer || data?.summary || "").trim();
        const fallback =
          "Je n'ai pas de reponse exploitable. Tu peux preciser le HS, la destination, l'incoterm, " +
          "ou passer en mode avance pour une analyse complete.";

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: answer || fallback,
          createdAt: Date.now(),
          meta: data,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: any) {
        const msgErr = err?.message || "Assistant indisponible";
        setError(msgErr);

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content:
            "Assistant indisponible pour le moment. Tu peux reessayer, preciser le contexte, ou contacter le support.",
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setLoading(false);
      }
    },
    [draft, loading, destination, incoterm, transportMode]
  );

  const handleContactOpen = () => {
    const contextLine = `destination=${destination} | incoterm=${incoterm} | transport=${transportMode}`;
    if (!contactMessage) {
      setContactMessage(buildContactDraft(lastUser, contextLine));
    }
    setShowContact(true);
  };

  const sendSupport = async () => {
    if (contactLoading) return;
    const email = (user?.email || contactEmail || "").trim().toLowerCase();
    if (!email) {
      toast({ title: "Email requis", description: "Ajoute un email pour contacter le support." });
      return;
    }
    if (!contactMessage.trim()) {
      toast({ title: "Message requis", description: "Ajoute un message pour le support." });
      return;
    }

    const payload = {
      email,
      name: contactName.trim() || null,
      message: contactMessage.trim(),
      page_url: typeof window !== "undefined" ? window.location.href : null,
      context: {
        destination,
        incoterm,
        transport_mode: transportMode,
        last_mode: lastMode || null,
        last_question: lastUser?.content || null,
      },
    };

    try {
      setContactLoading(true);
      const { data, error: fnError } = await supabase.functions.invoke<{ ok: boolean; error?: string }>(
        "support-message",
        { body: payload }
      );

      if (fnError || data?.ok === false) {
        throw new Error(fnError?.message || data?.error || "Envoi impossible");
      }

      toast({ title: "Message envoye", description: "Le support revient vers toi sous 24-48h." });
      setContactMessage("");
      setShowContact(false);
    } catch (err: any) {
      toast({ title: "Erreur support", description: err?.message || "Envoi impossible" });
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-2 rounded-full bg-[#0B1220] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#16233a]"
          aria-label="Ouvrir l'aide IA"
          aria-expanded="false"
        >
          <MessageCircle className="h-4 w-4" />
          Aide IA
        </button>
      ) : (
        <div
          className="w-[92vw] max-w-[380px] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"
          role="dialog"
          aria-modal="false"
          aria-label="Support IA"
        >
          <div className="flex items-start justify-between gap-2 border-b border-border bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Support IA</div>
                <div className="text-[11px] text-white/70">
                  Conseils rapides export/import
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastMode ? <Badge variant="secondary">Mode: {lastMode}</Badge> : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <div ref={scrollRef} className="max-h-[320px] overflow-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Exemples: documents DAP UE, droits/TVA import, assurance CIP, sanctions pays.
                </div>
              ) : null}

              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" ? (
                      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="h-3 w-3" />
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[80%] rounded-xl border px-3 py-2 text-xs ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border px-4 py-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void send(p)}
                    disabled={loading}
                    className="rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    {p}
                  </button>
                ))}
              </div>

              {error ? <div className="text-xs text-rose-600">{error}</div> : null}

              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Pose ta question..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowContext((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showContext ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Contexte
                </button>

                <Button onClick={() => void send()} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </Button>
              </div>

              {showContext ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
                  <div className="grid gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Destination</label>
                      <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="UE" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Incoterm</label>
                      <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="DAP" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Transport</label>
                      <Input value={transportMode} onChange={(e) => setTransportMode(e.target.value)} placeholder="Route" />
                    </div>
                  </div>
                </div>
              ) : null}

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/assistant")}>
                  Mode avance
                </Button>
                <Button variant="outline" size="sm" onClick={handleContactOpen} className="gap-1">
                  <LifeBuoy className="h-4 w-4" />
                  Nous contacter
                </Button>
              </div>

              {showContact ? (
                <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <div className="text-xs font-semibold">Support humain</div>
                  {!user?.email ? (
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Email</label>
                      <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="vous@entreprise.com" />
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">
                      Email du compte: <span className="font-medium">{user.email}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Nom (optionnel)</label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nom / Societe" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-muted-foreground">Message</label>
                    <Textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} rows={3} />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={sendSupport} disabled={contactLoading} className="gap-2">
                      {contactLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Envoyer
                    </Button>
                  </div>
                </div>
              ) : null}

              {!SUPABASE_ENV_OK ? (
                <div className="text-[11px] text-rose-600">
                  Connexion Supabase indisponible: mode IA limite.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
