import * as React from "react";
import { Bot, Loader2, Send, SlidersHorizontal, RefreshCw } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

const THREAD_KEY = "mpl_export_expert_thread_id_v1";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  entities?: Record<string, unknown>;
  dossier?: Record<string, unknown>;
};

type ExpertResponse = {
  ok?: boolean;
  thread_id?: string;
  assistant_message?: string;
  entities?: Record<string, unknown>;
  dossier?: Record<string, unknown>;
  error?: string;
  in_scope?: boolean;
};

type CountrySuggestion = { iso2: string; name_fr: string; name_en: string };
type HsSuggestion = { hs6: string; description_fr: string; description_en: string };

type Overrides = {
  origin?: string | null;
  destination?: string | null;
  hs6?: string | null;
  incoterm?: string | null;
  payment?: string | null;
  transport?: string | null;
  currency?: string | null;
  contract_type?: string | null;
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FOB", "CFR", "CIF"];
const PAYMENTS = ["LC", "CAD", "OA", "TT"];
const TRANSPORTS = ["air", "sea", "road", "rail", "courier"];
const CONTRACTS = ["sales", "distribution", "agency", "franchise", "licensing", "oem"];

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

export default function Assistant() {
  const { toast } = useToast();
  const { lang } = useI18n();

  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [bootLoading, setBootLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entities, setEntities] = React.useState<Record<string, unknown>>({});
  const [dossier, setDossier] = React.useState<Record<string, unknown>>({});

  const [showCorrections, setShowCorrections] = React.useState(false);
  const [countryQuery, setCountryQuery] = React.useState("");
  const [hsQuery, setHsQuery] = React.useState("");
  const [countrySuggestions, setCountrySuggestions] = React.useState<CountrySuggestion[]>([]);
  const [hsSuggestions, setHsSuggestions] = React.useState<HsSuggestion[]>([]);
  const [overrides, setOverrides] = React.useState<Overrides>({});

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const labels = React.useMemo(
    () => ({
      title: lang === "en" ? "Export Expert" : "Export Expert",
      subtitle:
        lang === "en"
          ? "Deterministic import/export assistant built from database references"
          : "Assistant import/export deterministe base sur les referentiels en base",
      placeholder:
        lang === "en"
          ? "Describe your case: origin, destination, product/HS, Incoterm, payment, transport..."
          : "Decrivez votre cas : origine, destination, produit/HS, Incoterm, paiement, transport...",
      send: lang === "en" ? "Send" : "Envoyer",
      update: lang === "en" ? "Apply corrections" : "Appliquer les corrections",
      corrections: lang === "en" ? "Correct" : "Corriger",
      clear: lang === "en" ? "New thread" : "Nouveau fil",
      loading: lang === "en" ? "Analyzing..." : "Analyse en cours...",
      docs: lang === "en" ? "Documents" : "Documents",
      compliance: lang === "en" ? "Compliance" : "Compliance",
      contract: lang === "en" ? "Contract" : "Contrat",
      tax: lang === "en" ? "Tax & customs" : "Fiscalite & douane",
      transport: lang === "en" ? "Transport" : "Transport",
      payment: lang === "en" ? "Payment" : "Paiement",
      noData: lang === "en" ? "No data yet." : "Pas encore de donnees.",
    }),
    [lang],
  );

  const loadThread = React.useCallback(async (id: string) => {
    const { data, error: loadError } = await supabase
      .from("chat_messages")
      .select("id, role, content, entities, dossier, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true })
      .limit(80);

    if (loadError) {
      throw new Error(loadError.message);
    }

    const rows = Array.isArray(data) ? data : [];
    const mapped = rows
      .filter((r: any) => r.role === "user" || r.role === "assistant")
      .map((r: any) => ({
        id: String(r.id || uid()),
        role: r.role === "assistant" ? "assistant" : "user",
        content: String(r.content || ""),
        createdAt: new Date(r.created_at || Date.now()).getTime(),
        entities: asObject(r.entities),
        dossier: asObject(r.dossier),
      } as ChatMessage));

    setMessages(mapped);

    for (let i = mapped.length - 1; i >= 0; i -= 1) {
      if (Object.keys(asObject(mapped[i].entities)).length) {
        setEntities(asObject(mapped[i].entities));
        break;
      }
    }

    for (let i = mapped.length - 1; i >= 0; i -= 1) {
      if (Object.keys(asObject(mapped[i].dossier)).length) {
        setDossier(asObject(mapped[i].dossier));
        break;
      }
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const stored = localStorage.getItem(THREAD_KEY);
        if (stored) {
          if (!cancelled) setThreadId(stored);
          await loadThread(stored);
        } else {
          const { data } = await supabase
            .from("chat_threads")
            .select("id, created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data?.id) {
            if (!cancelled) {
              setThreadId(data.id);
              localStorage.setItem(THREAD_KEY, data.id);
            }
            await loadThread(data.id);
          }
        }
      } catch {
        // silent boot fail
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadThread]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages, loading]);

  React.useEffect(() => {
    if (!showCorrections || countryQuery.trim().length < 2) {
      setCountrySuggestions([]);
      return;
    }

    let active = true;
    const run = async () => {
      const q = countryQuery.trim();
      const { data } = await supabase
        .from("ref_countries")
        .select("iso2,name_fr,name_en")
        .or(`name_fr.ilike.%${q}%,name_en.ilike.%${q}%,iso2.ilike.%${q}%`)
        .limit(8);
      if (active) setCountrySuggestions((data || []) as CountrySuggestion[]);
    };
    void run();

    return () => {
      active = false;
    };
  }, [countryQuery, showCorrections]);

  React.useEffect(() => {
    if (!showCorrections || hsQuery.trim().length < 2) {
      setHsSuggestions([]);
      return;
    }

    let active = true;
    const run = async () => {
      const q = hsQuery.trim();
      const { data } = await supabase
        .from("ref_hs")
        .select("hs6,description_fr,description_en")
        .or(`hs6.ilike.%${q}%,description_fr.ilike.%${q}%,description_en.ilike.%${q}%`)
        .limit(8);
      if (active) setHsSuggestions((data || []) as HsSuggestion[]);
    };
    void run();

    return () => {
      active = false;
    };
  }, [hsQuery, showCorrections]);

  const sendMessage = React.useCallback(
    async (text?: string, forceOverrides?: Overrides) => {
      const message = (text ?? draft).trim();
      if (!message || loading) return;

      setLoading(true);
      setError(null);

      const userLocal: ChatMessage = {
        id: uid(),
        role: "user",
        content: message,
        createdAt: Date.now(),
        entities,
        dossier: {},
      };
      setMessages((prev) => [...prev, userLocal]);
      setDraft("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          throw new Error(lang === "en" ? "Please sign in again." : "Veuillez vous reconnecter.");
        }

        const payload = {
          message,
          thread_id: threadId,
          lang,
          overrides: forceOverrides || overrides,
        };

        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = (await resp.json().catch(() => ({}))) as ExpertResponse;
        if (!resp.ok || data?.ok === false || data?.error) {
          throw new Error(data?.error || `chat_failed_${resp.status}`);
        }

        if (data.thread_id) {
          setThreadId(data.thread_id);
          localStorage.setItem(THREAD_KEY, data.thread_id);
        }

        const assistantMessage: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: String(data.assistant_message || ""),
          createdAt: Date.now(),
          entities: asObject(data.entities),
          dossier: asObject(data.dossier),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setEntities(asObject(data.entities));
        setDossier(asObject(data.dossier));
      } catch (err: any) {
        const msgErr = String(err?.message || "chat_failed");
        setError(msgErr);
        toast({
          title: lang === "en" ? "Chat error" : "Erreur chat",
          description: msgErr,
        });
      } finally {
        setLoading(false);
      }
    },
    [draft, entities, lang, loading, overrides, threadId, toast],
  );

  const applyCorrections = React.useCallback(async () => {
    const hasOverrides = Object.values(overrides).some((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (!hasOverrides) return;

    setEntities((prev) => ({ ...prev, ...overrides }));

    await sendMessage(
      lang === "en"
        ? "Please refresh the export dossier with these corrected values."
        : "Merci de recalculer le dossier export avec ces valeurs corrigees.",
      overrides,
    );

    setShowCorrections(false);
    setCountryQuery("");
    setHsQuery("");
    setCountrySuggestions([]);
    setHsSuggestions([]);
  }, [lang, overrides, sendMessage]);

  const resetThread = React.useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setEntities({});
    setDossier({});
    setOverrides({});
    localStorage.removeItem(THREAD_KEY);
  }, []);

  const chips = [
    ["destination", entities.destination],
    ["origin", entities.origin],
    ["hs6", entities.hs6],
    ["incoterm", entities.incoterm],
    ["payment", entities.payment],
    ["transport", entities.transport],
    ["contract", entities.contract_type],
    ["currency", entities.currency],
  ].filter(([, v]) => Boolean(v));

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">MPL Export</p>
            <h1 className="text-2xl font-semibold">{labels.title}</h1>
            <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowCorrections((p) => !p)} className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {labels.corrections}
            </Button>
            <Button variant="outline" onClick={resetThread} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {labels.clear}
            </Button>
          </div>
        </div>

        {chips.length ? (
          <div className="flex flex-wrap gap-2">
            {chips.map(([k, v]) => (
              <Badge key={`${k}-${String(v)}`} variant="secondary">{`${k}: ${String(v)}`}</Badge>
            ))}
          </div>
        ) : null}

        {showCorrections ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{labels.corrections}</CardTitle>
              <CardDescription>
                {lang === "en" ? "Select country/HS and optional slots, then recalculate." : "Selectionnez pays/HS et slots optionnels, puis recalculer."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Input value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} placeholder={lang === "en" ? "Search destination country" : "Rechercher pays destination"} />
                  <div className="flex flex-wrap gap-1.5">
                    {countrySuggestions.map((c) => (
                      <button
                        key={c.iso2}
                        type="button"
                        onClick={() => setOverrides((prev) => ({ ...prev, destination: c.iso2 }))}
                        className="rounded-full border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {`${c.iso2} - ${lang === "en" ? c.name_en : c.name_fr}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Input value={hsQuery} onChange={(e) => setHsQuery(e.target.value)} placeholder={lang === "en" ? "Search HS/product" : "Rechercher HS/produit"} />
                  <div className="flex flex-wrap gap-1.5">
                    {hsSuggestions.map((h) => (
                      <button
                        key={h.hs6}
                        type="button"
                        onClick={() => setOverrides((prev) => ({ ...prev, hs6: h.hs6 }))}
                        className="rounded-full border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {`${h.hs6} - ${lang === "en" ? h.description_en : h.description_fr}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <Input placeholder="Incoterm" list="incoterm-list" onChange={(e) => setOverrides((p) => ({ ...p, incoterm: e.target.value.toUpperCase() || null }))} />
                <Input placeholder="Payment" list="payment-list" onChange={(e) => setOverrides((p) => ({ ...p, payment: e.target.value.toUpperCase() || null }))} />
                <Input placeholder="Transport" list="transport-list" onChange={(e) => setOverrides((p) => ({ ...p, transport: e.target.value.toLowerCase() || null }))} />
                <Input placeholder="Contract" list="contract-list" onChange={(e) => setOverrides((p) => ({ ...p, contract_type: e.target.value.toLowerCase() || null }))} />
              </div>

              <datalist id="incoterm-list">{INCOTERMS.map((x) => <option key={x} value={x} />)}</datalist>
              <datalist id="payment-list">{PAYMENTS.map((x) => <option key={x} value={x} />)}</datalist>
              <datalist id="transport-list">{TRANSPORTS.map((x) => <option key={x} value={x} />)}</datalist>
              <datalist id="contract-list">{CONTRACTS.map((x) => <option key={x} value={x} />)}</datalist>

              <Button onClick={() => void applyCorrections()}>{labels.update}</Button>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-primary" />Chat</CardTitle>
            <CardDescription>{threadId ? `thread: ${threadId}` : labels.noData}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div ref={scrollRef} className="max-h-[55vh] overflow-auto rounded-xl border bg-muted/20 p-3">
              {bootLoading ? (
                <div className="text-sm text-muted-foreground">{labels.loading}</div>
              ) : null}

              {!bootLoading && messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {lang === "en"
                    ? "Example: Export strawberries to Chile under CIF with LC payment."
                    : "Exemple : Export de fraises vers le Chili en CIF avec paiement LC."}
                </div>
              ) : null}

              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl border px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error ? <div className="text-sm text-rose-600">{error}</div> : null}

            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={labels.placeholder}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <div className="flex justify-end">
              <Button onClick={() => void sendMessage()} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {labels.send}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" className="w-full rounded-xl border bg-card px-4">
          <AccordionItem value="docs">
            <AccordionTrigger>{labels.docs}</AccordionTrigger>
            <AccordionContent>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(dossier.documents || [], null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="compliance">
            <AccordionTrigger>{labels.compliance}</AccordionTrigger>
            <AccordionContent>
              <pre className="overflow-x-auto text-xs">{JSON.stringify({ restrictions: dossier.restrictions || [], sanctions: dossier.sanctions || {} }, null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="contract">
            <AccordionTrigger>{labels.contract}</AccordionTrigger>
            <AccordionContent>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(dossier.contracts || {}, null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="tax">
            <AccordionTrigger>{labels.tax}</AccordionTrigger>
            <AccordionContent>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(dossier.tax_and_customs || {}, null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="transport">
            <AccordionTrigger>{labels.transport}</AccordionTrigger>
            <AccordionContent>
              <pre className="overflow-x-auto text-xs">{JSON.stringify({ incoterm: dossier.incoterm || {}, transport: dossier.transport || {} }, null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="payment">
            <AccordionTrigger>{labels.payment}</AccordionTrigger>
            <AccordionContent>
              <pre className="overflow-x-auto text-xs">{JSON.stringify(dossier.payment || {}, null, 2)}</pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </AppLayout>
  );
}
