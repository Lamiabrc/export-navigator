import * as React from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getAlerts, postPrefs } from "@/lib/leadMagnetApi";
import { formatDateTimeFr } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  BellRing,
  ShieldAlert,
  Sparkles,
  Globe2,
  Search,
  ExternalLink,
  Info,
  Mail,
  Hash,
  MapPin,
  RefreshCcw,
} from "lucide-react";

type RssItem = {
  title?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  country?: string | null;
  hsPrefix?: string | null;

  // optionnel si ton /api/rss renvoie déjà une image
  image?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COUNTRIES_FALLBACK = [
  { label: "Allemagne", iso2: "DE" },
  { label: "Espagne", iso2: "ES" },
  { label: "Italie", iso2: "IT" },
  { label: "Pays-Bas", iso2: "NL" },
  { label: "Belgique", iso2: "BE" },
  { label: "Royaume-Uni", iso2: "GB" },
  { label: "Suisse", iso2: "CH" },
  { label: "États-Unis", iso2: "US" },
  { label: "Canada", iso2: "CA" },
  { label: "Maroc", iso2: "MA" },
  { label: "Émirats arabes unis", iso2: "AE" },
  { label: "Chine", iso2: "CN" },
  { label: "Japon", iso2: "JP" },
  { label: "Inde", iso2: "IN" },
];

const TOP_COUNTRY_ISO2 = ["DE", "ES", "IT", "NL", "BE", "CH", "GB", "US", "CA", "MA", "AE", "CN", "JP", "IN"];

// Presets “conversion” (rapides, orientés usage)
const PRESETS: Array<{ label: string; countries: string[]; hint: string }> = [
  { label: "Europe (DE/ES/IT/NL/BE)", countries: ["DE", "ES", "IT", "NL", "BE"], hint: "Flux UE, douane & conformité." },
  { label: "USA", countries: ["US"], hint: "Sanctions, contrôles export, OFAC/CBP." },
  { label: "UK", countries: ["GB"], hint: "Brexit, règles d’origine, formalités." },
  { label: "Suisse", countries: ["CH"], hint: "Procédures & exigences locales." },
  { label: "MENA (MA/AE)", countries: ["MA", "AE"], hint: "Certificats, contrôles, restrictions." },
  { label: "Asie (CN/JP/IN)", countries: ["CN", "JP", "IN"], hint: "Réglementations, sanctions & risques pays." },
];

const HS_SUGGESTIONS: Array<{ hs: string; label: string; note: string }> = [
  { hs: "30", label: "Pharma / santé", note: "médicaments, dispositifs – risques sanctions/contrôles" },
  { hs: "39", label: "Plastiques", note: "matières/emballages – exigences & restrictions" },
  { hs: "61", label: "Textile (tricot)", note: "règles d’origine / étiquetage" },
  { hs: "62", label: "Textile (non tricot)", note: "règles d’origine / conformité" },
  { hs: "84", label: "Machines", note: "dual-use potentiel / licences" },
  { hs: "85", label: "Électrique / électronique", note: "contrôles export, restrictions" },
  { hs: "87", label: "Véhicules", note: "règles techniques / sanctions" },
];

function normalizeHsPrefix(v: string) {
  const digits = (v || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  // on autorise 2 à 6 chiffres (préfixe HS)
  if (digits.length < 2) return "";
  return digits.slice(0, 6);
}

function safeLocalStorageGet(key: string) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalStorageSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function getDomain(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function faviconUrlFromLink(link?: string) {
  const domain = getDomain(link);
  if (!domain) return "";
  // favicon stable & rapide
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function seededCover(seed: string) {
  // image “wow” sans back à modifier : stable via seed (picsum)
  // si tu préfères 100% interne : on pourra remplacer par des assets locaux plus tard
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/960/540`;
}

type AlertItem = {
  id: string;
  title: string;
  message: string;
  severity: string;
  country?: string | null;
  hsPrefix?: string | null;
  detectedAt?: string | null;
  source?: string | null;
};

function severityLabel(sev: string) {
  const s = (sev || "").toLowerCase();
  if (s.includes("high") || s.includes("crit") || s.includes("risk")) return "Critique";
  if (s.includes("med") || s.includes("warn")) return "Attention";
  if (s.includes("low") || s.includes("info")) return "Info";
  return sev || "Info";
}

function badgeClass(severity: string) {
  const s = (severity || "").toLowerCase();
  if (s.includes("high") || s.includes("crit") || s.includes("risk")) return "badge-risk";
  if (s.includes("med") || s.includes("warn")) return "badge-warning";
  if (s.includes("low") || s.includes("info")) return "badge-neutral";
  return "badge-neutral";
}

const EXPERT_WATCH = [
  {
    title: "Sanctions & embargos",
    desc: "Listes UE/ONU/US, gels d’avoirs, interdictions sectorielles, pays sensibles.",
  },
  {
    title: "Contrôles export / dual-use",
    desc: "Biens à double usage, licences, restrictions sur technologies & composants.",
  },
  {
    title: "Règles d’origine & préférences",
    desc: "Accords, preuves d’origine, impacts sur droits & accès au marché.",
  },
  {
    title: "Douane & conformité documentaire",
    desc: "Facture, packing list, déclarations, certificats, exigences spécifiques.",
  },
  {
    title: "Mesures commerciales",
    desc: "Anti-dumping, quotas, restrictions, nouvelles formalités/contrôles.",
  },
];

export default function Veille() {
  const { toast } = useToast();
  const prefsRef = React.useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = React.useState("");
  const [emailOk, setEmailOk] = React.useState(false);

  const [countries, setCountries] = React.useState<string[]>([]);
  const [countryText, setCountryText] = React.useState("");

  const [hsCodes, setHsCodes] = React.useState<string[]>([]);
  const [hsInput, setHsInput] = React.useState("");

  const [alertsLoading, setAlertsLoading] = React.useState(false);
  const [alertsUpdatedAt, setAlertsUpdatedAt] = React.useState<string | null>(null);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);

  const [rssLoading, setRssLoading] = React.useState(false);
  const [rssItems, setRssItems] = React.useState<RssItem[]>([]);
  const [rssQuery, setRssQuery] = React.useState("");
  const [view, setView] = React.useState<"alerts" | "rss">("alerts");

  const allCountries = React.useMemo(() => {
    try {
      const supported = (Intl as any).supportedValuesOf?.("region") as string[] | undefined;
      if (!supported?.length) return COUNTRIES_FALLBACK;

      const dn = new Intl.DisplayNames(["fr"], { type: "region" });
      const list = supported
        .filter((code) => /^[A-Z]{2}$/.test(code))
        .map((iso2) => ({ iso2, label: dn.of(iso2) || iso2 }))
        .filter((c) => c.label && c.label !== c.iso2);

      const map = new Map<string, string>();
      for (const c of list) map.set(c.iso2, c.label);

      const arr = Array.from(map.entries()).map(([iso2, label]) => ({ iso2, label }));
      arr.sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
      return arr.length ? arr : COUNTRIES_FALLBACK;
    } catch {
      return COUNTRIES_FALLBACK;
    }
  }, []);

  const topCountries = React.useMemo(() => {
    const m = new Map(allCountries.map((c) => [c.iso2, c]));
    return TOP_COUNTRY_ISO2.map((iso2) => m.get(iso2)).filter(Boolean) as Array<{ iso2: string; label: string }>;
  }, [allCountries]);

  React.useEffect(() => {
    const stored = safeLocalStorageGet("mpl_lead_email");
    if (stored) {
      setEmail(stored);
      setEmailOk(EMAIL_RE.test(stored));
    }
    const storedPrefs = safeLocalStorageGet("mpl_watch_prefs");
    if (storedPrefs) {
      try {
        const p = JSON.parse(storedPrefs);
        if (Array.isArray(p?.countries)) setCountries(p.countries);
        if (Array.isArray(p?.hsCodes)) setHsCodes(p.hsCodes);
      } catch {
        // ignore
      }
    }
  }, []);

  const loadAlerts = React.useCallback(
    async (mail: string) => {
      setAlertsLoading(true);
      try {
        const data = await getAlerts(mail);
        setAlertsUpdatedAt(data.updatedAt);
        setAlerts(data.alerts || []);
      } catch (e: any) {
        toast({ title: "Erreur alertes", description: e?.message || "Impossible de charger les alertes." });
      } finally {
        setAlertsLoading(false);
      }
    },
    [toast]
  );

  const loadRss = React.useCallback(async () => {
    setRssLoading(true);
    try {
      const res = await fetch("/api/rss");
      const raw = await res.json().catch(() => ({}));
      const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data?.items) ? raw.data.items : [];
      setRssItems(items.slice(0, 24));
    } catch {
      setRssItems([]);
    } finally {
      setRssLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRss();
  }, [loadRss]);

  const handleSavePrefs = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      toast({ title: "Email requis", description: "Ajoute un email valide pour activer la veille personnalisée." });
      return;
    }

    try {
      setAlertsLoading(true);
      await postPrefs({ email: trimmed, countries, hsCodes });
      safeLocalStorageSet("mpl_lead_email", trimmed);
      safeLocalStorageSet("mpl_watch_prefs", JSON.stringify({ countries, hsCodes }));
      toast({ title: "Veille activée", description: "Préférences enregistrées. Chargement des alertes…" });
      await loadAlerts(trimmed);
      setView("alerts");
    } catch (e: any) {
      toast({ title: "Erreur préférences", description: e?.message || "Impossible d'enregistrer." });
    } finally {
      setAlertsLoading(false);
    }
  };

  const addCountryFromText = (text: string) => {
    setCountryText(text);
    const m = text.match(/\(([A-Za-z]{2})\)\s*$/);
    const iso2 = m?.[1]?.toUpperCase();
    if (!iso2) return;

    if (!countries.includes(iso2)) {
      setCountries((prev) => [...prev, iso2]);
    }
    setCountryText("");
  };

  const addHs = () => {
    const hs = normalizeHsPrefix(hsInput);
    if (!hs) {
      toast({ title: "HS invalide", description: "Entre un préfixe HS de 2 à 6 chiffres (ex : 30, 3004, 8517)." });
      return;
    }
    if (!hsCodes.includes(hs)) setHsCodes((prev) => [...prev, hs]);
    setHsInput("");
  };

  const applyPreset = (presetCountries: string[]) => {
    setCountries((prev) => {
      const s = new Set(prev);
      for (const c of presetCountries) s.add(c);
      return Array.from(s);
    });
  };

  const scrollToPrefs = () => {
    prefsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ticker = React.useMemo(() => {
    const items = rssItems.slice(0, 10).map((x) => x.title).filter(Boolean) as string[];
    if (!items.length) return "Veille en cours : sanctions, douane, conformité documentaire, risques pays…";
    return items.join("  •  ");
  }, [rssItems]);

  const filteredRss = React.useMemo(() => {
    const q = rssQuery.trim().toLowerCase();
    if (!q) return rssItems;
    return rssItems.filter((it) => {
      const hay = `${it.title || ""} ${it.summary || ""} ${it.source || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rssItems, rssQuery]);

  const demoAlerts: AlertItem[] = React.useMemo(
    () => [
      {
        id: "demo-1",
        title: "Changement sanction / restriction sectorielle",
        message:
          "Une mesure peut impacter l’export de certains produits vers un pays cible. Vérifier la liste applicable + adapter documents & screening.",
        severity: "high",
        country: "US",
        hsPrefix: "85",
        detectedAt: new Date().toISOString(),
        source: "Synthèse (exemple)",
      },
      {
        id: "demo-2",
        title: "Contrôle export / dual-use : vigilance composants",
        message:
          "Certains composants/technologies peuvent relever de contrôles. Confirmer classification + licence si nécessaire.",
        severity: "med",
        country: "DE",
        hsPrefix: "84",
        detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        source: "Synthèse (exemple)",
      },
    ],
    []
  );

  const effectiveAlerts = emailOk ? alerts : demoAlerts;

  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* HERO WAOW + TICKER */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 text-white shadow-xl md:p-10">
          {/* blobs */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(56,189,248,0.20),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_55%_90%,rgba(14,165,233,0.12),transparent_40%)]" />

          <div className="relative">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Veille export — sanctions & conformité</p>
            <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
              Ta tour de contrôle <span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5" /> anti-surprise</span>.
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-slate-200">
              Configure tes <strong>pays</strong> et tes <strong>préfixes HS</strong>. On te remonte uniquement l’essentiel : alertes
              actionnables + sources.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={scrollToPrefs}>
                Activer ma veille <Chevron />
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => (window.location.href = "/contact?offer=express")}
              >
                Validation express
              </Button>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => (window.location.href = "/contact?offer=audit")}
              >
                Audit complet
              </Button>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-200">
                <BellRing className="h-4 w-4" />
                <span className="opacity-90">Live</span>
                <span className="opacity-60">—</span>
                <span className="opacity-75">derniers signaux</span>
              </div>
              <div className="relative">
                <div className="animate-marquee whitespace-nowrap px-4 py-3 text-sm text-slate-100">
                  {ticker} &nbsp;&nbsp;&nbsp; {ticker}
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-950 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-950 to-transparent" />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-300/80">
              Pas de bruit : pays + HS = signal utile. <span className="opacity-80">Tu gardes l’historique, tu agis vite.</span>
            </p>
          </div>
        </section>

        {/* EXPERTISE BLOCK */}
        <section className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Ce qu’on surveille (niveau expert)
              </CardTitle>
              <CardDescription>Les 5 sources d’ennuis récurrents en export — converties en alertes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {EXPERT_WATCH.map((x) => (
                <div key={x.title} className="rounded-xl border border-border bg-card p-4">
                  <div className="font-semibold">{x.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{x.desc}</p>
                </div>
              ))}
              <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Objectif :</span> éviter la mauvaise surprise (blocage, retard, non-conformité),
                et sécuriser décision/flux.
              </div>
            </CardContent>
          </Card>

          {/* MAIN: prefs + live content */}
          <div className="lg:col-span-3 space-y-6" ref={prefsRef}>
            {/* PREFS (waow UX) */}
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5" />
                  Ma veille personnalisée
                </CardTitle>
                <CardDescription>Email + pays + préfixes HS. Tu peux commencer en 30 secondes.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    value={email}
                    onChange={(e) => {
                      const v = e.target.value;
                      setEmail(v);
                      setEmailOk(EMAIL_RE.test(v.trim().toLowerCase()));
                    }}
                    placeholder="email@entreprise.com"
                  />
                  {!emailOk && email.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Format email non valide.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      On s’en sert pour te livrer des alertes utiles (pas du spam).
                    </p>
                  )}
                </div>

                <Separator />

                {/* Presets */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Démarrage rapide
                  </Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p.countries)}
                        className="group rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{p.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{p.hint}</div>
                          </div>
                          <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground group-hover:text-foreground">
                            + ajouter
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Countries */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Pays suivis
                  </Label>

                  <div className="flex flex-wrap gap-2">
                    {topCountries.map((c) => (
                      <button
                        key={c.iso2}
                        type="button"
                        onClick={() => setCountries((prev) => (prev.includes(c.iso2) ? prev : [...prev, c.iso2]))}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-muted"
                      >
                        + {c.label}
                      </button>
                    ))}
                  </div>

                  <Input
                    value={countryText}
                    onChange={(e) => setCountryText(e.target.value)}
                    onBlur={(e) => addCountryFromText(e.target.value)}
                    placeholder='Recherche : "Suisse (CH)"'
                    list="countries-list"
                  />

                  <datalist id="countries-list">
                    {allCountries.map((c) => (
                      <option key={c.iso2} value={`${c.label} (${c.iso2})`} />
                    ))}
                  </datalist>

                  {countries.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {countries.map((iso2) => (
                        <button
                          key={iso2}
                          type="button"
                          onClick={() => setCountries((prev) => prev.filter((x) => x !== iso2))}
                          className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground hover:opacity-80"
                          title="Cliquer pour retirer"
                        >
                          {iso2} ✕
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ajoute 1–3 pays : plus de signal, moins de bruit.</p>
                  )}
                </div>

                <Separator />

                {/* HS */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Hash className="h-4 w-4" /> Préfixes HS suivis
                  </Label>

                  <div className="flex flex-wrap gap-2">
                    {HS_SUGGESTIONS.map((x) => (
                      <button
                        key={x.hs}
                        type="button"
                        onClick={() => setHsCodes((prev) => (prev.includes(x.hs) ? prev : [...prev, x.hs]))}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-muted"
                        title={x.note}
                      >
                        + HS {x.hs} <span className="opacity-70">({x.label})</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={hsInput}
                      onChange={(e) => setHsInput(e.target.value)}
                      placeholder="Ex : 30, 3004, 8517"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHs();
                        }
                      }}
                    />
                    <Button type="button" onClick={addHs} variant="outline">
                      Ajouter
                    </Button>
                  </div>

                  {hsCodes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {hsCodes.map((hs) => (
                        <button
                          key={hs}
                          type="button"
                          onClick={() => setHsCodes((prev) => prev.filter((x) => x !== hs))}
                          className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground hover:opacity-80"
                          title="Cliquer pour retirer"
                        >
                          HS {hs} ✕
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ajoute 1–3 préfixes HS (2–6 chiffres) pour filtrer au plus près de tes produits.
                    </p>
                  )}
                </div>

                <Button onClick={handleSavePrefs} disabled={alertsLoading} className="w-full">
                  {alertsLoading ? "Activation..." : "Activer / mettre à jour ma veille"}
                </Button>

                <div className="rounded-xl border border-border bg-muted p-4 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">💡 Tip :</span> commence par 1 pays + 1 HS. Tu élargiras ensuite.
                  <br />
                  <span className="font-medium text-foreground">⚠️ Disclaimer :</span> info indicative, ne remplace pas conseil juridique/douanier.
                </div>
              </CardContent>
            </Card>

            {/* LIVE PANEL: Alerts / RSS */}
            <Card className="card-hover">
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BellRing className="h-5 w-5" />
                      Centre de veille
                    </CardTitle>
                    <CardDescription>
                      {view === "alerts" ? (
                        alertsUpdatedAt ? (
                          <>Dernière mise à jour : {formatDateTimeFr(alertsUpdatedAt)}</>
                        ) : (
                          <>Aperçu disponible — connecte ton email pour les vraies alertes.</>
                        )
                      ) : (
                        <>Flux “macro” (sanctions, commerce, douane…) + recherche rapide.</>
                      )}
                    </CardDescription>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={view === "alerts" ? "default" : "outline"}
                      onClick={() => setView("alerts")}
                      className="flex-1"
                    >
                      Alertes
                    </Button>
                    <Button
                      variant={view === "rss" ? "default" : "outline"}
                      onClick={() => setView("rss")}
                      className="flex-1"
                    >
                      RSS + images
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {view === "alerts" ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {emailOk ? (
                          "Alertes liées à tes préférences (pays + HS)."
                        ) : (
                          "Mode démo : exemple d’alertes (entre ton email pour activer)."
                        )}
                      </div>
                      <div className="flex gap-2">
                        {emailOk ? (
                          <Button
                            variant="outline"
                            onClick={() => loadAlerts(email.trim().toLowerCase())}
                            disabled={alertsLoading}
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            {alertsLoading ? "Chargement..." : "Recharger"}
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={scrollToPrefs}>
                            <Mail className="mr-2 h-4 w-4" />
                            Activer avec mon email
                          </Button>
                        )}
                        <Button onClick={() => (window.location.href = "/contact?offer=express")}>
                          Transformer en action
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {alertsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-24 rounded-xl border border-border bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : effectiveAlerts.length === 0 ? (
                      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                        Aucune alerte pour l’instant.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {effectiveAlerts.slice(0, 10).map((a) => (
                          <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-semibold">{a.title}</div>
                              <span className={cn("rounded-full px-2 py-1 text-xs", badgeClass(a.severity))}>
                                {severityLabel(a.severity)}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{a.message}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {a.country ? (
                                <span className="rounded-full border border-border bg-muted px-2 py-1">Pays: {a.country}</span>
                              ) : null}
                              {a.hsPrefix ? (
                                <span className="rounded-full border border-border bg-muted px-2 py-1">HS: {a.hsPrefix}</span>
                              ) : null}
                              {a.detectedAt ? (
                                <span className="rounded-full border border-border bg-muted px-2 py-1">
                                  {formatDateTimeFr(a.detectedAt)}
                                </span>
                              ) : null}
                              {a.source ? (
                                <span className="rounded-full border border-border bg-muted px-2 py-1">Source: {a.source}</span>
                              ) : null}
                            </div>
                            <div className="mt-4 rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                                <Info className="h-4 w-4" /> Action recommandée
                              </span>
                              <div className="mt-1">
                                1) Vérifier la source officielle • 2) Confirmer classification (HS / usage) • 3) Adapter documents / screening • 4)
                                Décider (OK / blocage / escalade).
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={rssQuery}
                          onChange={(e) => setRssQuery(e.target.value)}
                          placeholder="Rechercher dans le flux (ex : sanctions, embargo, douane, Russie, Iran, dual-use...)"
                          className="pl-9"
                        />
                      </div>
                      <Button variant="outline" onClick={loadRss} disabled={rssLoading}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        {rssLoading ? "Actualisation..." : "Actualiser"}
                      </Button>
                    </div>

                    <Separator />

                    {rssLoading ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-56 rounded-2xl border border-border bg-muted animate-pulse" />
                        ))}
                      </div>
                    ) : filteredRss.length === 0 ? (
                      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                        Aucun item RSS trouvé (ou /api/rss en erreur).
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {filteredRss.slice(0, 12).map((it, idx) => {
                          const domain = getDomain(it.link) || it.source || "rss";
                          const cover = it.image || seededCover(`${domain}-${it.title || idx}`);
                          const favicon = faviconUrlFromLink(it.link);

                          return (
                            <div key={`${it.link || it.title || "item"}_${idx}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lg">
                              <div className="relative h-32">
                                <img
                                  src={cover}
                                  alt=""
                                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    {favicon ? (
                                      <img src={favicon} alt="" className="h-7 w-7 rounded-full border border-white/30 bg-white/10" loading="lazy" />
                                    ) : null}
                                    <div className="text-xs text-white/90">
                                      <div className="font-medium">{it.source || domain}</div>
                                      <div className="opacity-75">{it.publishedAt ? formatDateTimeFr(it.publishedAt) : ""}</div>
                                    </div>
                                  </div>
                                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/90">
                                    Signal
                                  </span>
                                </div>
                              </div>

                              <div className="p-4">
                                <div className="text-sm font-semibold line-clamp-2">{it.title || "Sans titre"}</div>
                                {it.summary ? (
                                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{it.summary}</p>
                                ) : null}

                                <div className="mt-4 flex items-center justify-between gap-3">
                                  {it.link ? (
                                    <a
                                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                                      href={it.link}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Lire la source <ExternalLink className="h-4 w-4" />
                                    </a>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Lien indisponible</span>
                                  )}

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => (window.location.href = "/contact?offer=express")}
                                    className="text-xs"
                                  >
                                    Interpréter pour moi
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {/* Tailwind marquee animation (local) */}
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 28s linear infinite;
          }
        `}
      </style>
    </PublicLayout>
  );
}

function Chevron() {
  return (
    <span className="inline-flex items-center">
      <span className="ml-2">→</span>
    </span>
  );
}
