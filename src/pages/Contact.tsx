import * as React from "react";
import { useLocation } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { RssItem } from "@/lib/rss/types";

const INPUT_CLASSES = "bg-slate-950/70 border-white/10 text-slate-100 placeholder:text-slate-400";
const TEXTAREA_CLASSES = "bg-slate-950/70 border-white/10 text-slate-100 placeholder:text-slate-400";
const CONTACT_EMAIL = "contact@exportfrancefacile.com";

const offerLabels: Record<string, string> = {
  express: "Validation express",
  pricing: "Offre tarifaire",
  audit: "Audit complet",
};

function readScenarioSummary() {
  try {
    const raw = localStorage.getItem("mpl_last_simulation");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as any;
    if (!parsed?.payload) return "";

    const payload = parsed.payload as Record<string, any>;
    const lines = [
      `Destination: ${payload.destination || payload.destinationIso2 || "n/a"}`,
      `Incoterm: ${payload.incoterm || "n/a"}`,
      `Mode: ${payload.mode || "n/a"}`,
      `Valeur marchandise: ${payload.goodsValue || payload.value || "n/a"}`,
    ];
    return lines.join(" | ");
  } catch {
    return "";
  }
}

function pickFranceNews(items: RssItem[]) {
  const normalized = items.map((item) => ({
    item,
    haystack: `${item.title} ${item.summary}`.toLowerCase(),
  }));
  const match = normalized.find((row) => row.haystack.includes("france"));
  return match?.item || items[0] || null;
}

export default function Contact() {
  const location = useLocation();
  const { toast } = useToast();

  const params = new URLSearchParams(location.search);
  const offerParam = params.get("offer") || "audit";
  const offerType = offerLabels[offerParam] ? offerParam : "audit";

  const [firstName, setFirstName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState(offerLabels[offerType]);
  const [message, setMessage] = React.useState("");
  const [includeScenario, setIncludeScenario] = React.useState(false);
  const [scenarioSummary, setScenarioSummary] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const [newsItem, setNewsItem] = React.useState<RssItem | null>(null);
  const [newsError, setNewsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSubject(offerLabels[offerType]);
  }, [offerType]);

  React.useEffect(() => {
    if (includeScenario) {
      setScenarioSummary(readScenarioSummary());
    }
  }, [includeScenario]);

  React.useEffect(() => {
    let mounted = true;
    const loadNews = async () => {
      try {
        const res = await fetch("/api/rss?limit=6&offset=0");
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error(data?.error || "Erreur RSS");
        const items = (data?.data?.items || []) as RssItem[];
        if (!mounted) return;
        setNewsItem(pickFranceNews(items));
      } catch (err: any) {
        if (!mounted) return;
        setNewsError(err?.message || "Actualite indisponible");
      }
    };
    void loadNews();
    return () => {
      mounted = false;
    };
  }, []);

  const submit = async () => {
    if (!firstName.trim()) {
      toast({ title: "Prenom requis", description: "Merci d'indiquer votre prenom." });
      return;
    }
    if (!email.trim()) {
      toast({ title: "Email requis", description: "Merci de renseigner un email de contact." });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Message requis", description: "Merci d'indiquer votre besoin." });
      return;
    }
    try {
      setSending(true);
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim().toLowerCase(),
          company: company.trim(),
          subject: subject.trim(),
          message: message.trim(),
          offerType,
          scenarioSummary: includeScenario ? scenarioSummary : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Impossible d'envoyer la demande.");
      }
      toast({ title: "Demande envoyee", description: "Nous revenons vers vous rapidement." });
      setMessage("");
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.message || "Impossible d'envoyer la demande." });
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicLayout>
      <div className="space-y-8">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-slate-100 shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-white/5 text-slate-100 border-white/15">Actualite export France</Badge>
            {newsError && <span className="text-sm text-rose-200">{newsError}</span>}
            {!newsError && !newsItem && <span className="text-sm text-slate-300">Chargement...</span>}
            {newsItem && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                <span className="font-semibold text-white">{newsItem.title}</span>
                <span className="text-xs text-slate-400">
                  {new Date(newsItem.pubDate).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <a
                  href={newsItem.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-200 hover:text-blue-100"
                >
                  Lire la source
                </a>
              </div>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Contact</p>
          <h1 className="text-4xl font-semibold text-white">Parlons de votre projet export.</h1>
          <p className="text-lg text-slate-200">
            Offre selectionnee: <span className="font-semibold text-white">{offerLabels[offerType]}</span>.
          </p>
          <p className="text-sm text-slate-400">
            Par mail :{" "}
            <a className="text-blue-200 underline-offset-4 hover:text-blue-100 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg backdrop-blur space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label className="text-slate-200">Prenom</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Prenom"
              className={INPUT_CLASSES}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className={INPUT_CLASSES}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Societe</Label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nom de l'entreprise"
              className={INPUT_CLASSES}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Sujet</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet"
              className={INPUT_CLASSES}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Besoin, pays, HS, urgence..."
              className={TEXTAREA_CLASSES}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <input
              id="scenario"
              type="checkbox"
              checked={includeScenario}
              onChange={(e) => setIncludeScenario(e.target.checked)}
            />
            <Label htmlFor="scenario" className="text-slate-200">
              Joindre mon scenario d'analyse
            </Label>
          </div>
          {includeScenario && scenarioSummary && (
            <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-xs text-slate-200">
              {scenarioSummary}
            </div>
          )}
          <Button onClick={submit} disabled={sending}>
            {sending ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </div>
      </div>
    </PublicLayout>
  );
}
