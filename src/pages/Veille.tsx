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

type RssItem = {
  title?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  country?: string | null;
  hsPrefix?: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COUNTRIES_FALLBACK = [
  { label: "Allemagne", iso2: "DE" },
  { label: "États-Unis", iso2: "US" },
  { label: "Royaume-Uni", iso2: "GB" },
  { label: "Suisse", iso2: "CH" },
  { label: "Maroc", iso2: "MA" },
  { label: "Canada", iso2: "CA" },
  { label: "Chine", iso2: "CN" },
  { label: "Émirats arabes unis", iso2: "AE" },
  { label: "Japon", iso2: "JP" },
  { label: "Inde", iso2: "IN" },
];

const TOP_COUNTRY_ISO2 = ["DE", "ES", "IT", "NL", "BE", "CH", "GB", "US", "CA", "MA", "AE", "CN", "JP", "IN"];

function normalizeHsPrefix(v: string) {
  const digits = (v || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  // on autorise 2 à 6 chiffres (préfixe HS)
  if (digits.length < 2) return "";
  return digits.slice(0, 6);
}

export default function Veille() {
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [emailOk, setEmailOk] = React.useState(false);

  const [countries, setCountries] = React.useState<string[]>([]);
  const [countryText, setCountryText] = React.useState("");
  const [hsCodes, setHsCodes] = React.useState<string[]>([]);
  const [hsInput, setHsInput] = React.useState("");

  const [alertsLoading, setAlertsLoading] = React.useState(false);
  const [alertsUpdatedAt, setAlertsUpdatedAt] = React.useState<string | null>(null);
  const [alerts, setAlerts] = React.useState<
    Array<{ id: string; title: string; message: string; severity: string; country?: string | null; hsPrefix?: string | null; detectedAt?: string | null; source?: string | null }>
  >([]);

  const [rssLoading, setRssLoading] = React.useState(false);
  const [rssItems, setRssItems] = React.useState<RssItem[]>([]);

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
    const stored = localStorage.getItem("mpl_lead_email");
    if (stored) {
      setEmail(stored);
      setEmailOk(EMAIL_RE.test(stored));
    }

    const storedPrefs = localStorage.getItem("mpl_watch_prefs");
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
      setRssItems(items.slice(0, 12));
    } catch {
      setRssItems([]);
    } finally {
      setRssLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // RSS utile même sans email
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
      localStorage.setItem("mpl_lead_email", trimmed);
      localStorage.setItem("mpl_watch_prefs", JSON.stringify({ countries, hsCodes }));
      toast({ title: "Préférences enregistrées", description: "Veille personnalisée activée." });
      await loadAlerts(trimmed);
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

  const badgeClass = (severity: string) => {
    const s = (severity || "").toLowerCase();
    if (s.includes("high") || s.includes("crit") || s.includes("risk")) return "badge-risk";
    if (s.includes("med") || s.includes("warn")) return "badge-warning";
    if (s.includes("low") || s.includes("info")) return "badge-neutral";
    return "badge-neutral";
  };

  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* ✅ HERO CINEMATIC (option B) */}
        <section className="rounded-3xl border border-border bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 text-white shadow-xl md:p-10">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Veille export</p>
          <h1 className="mt-2 text-4xl font-semibold md:text-5xl">Alertes sanctions & signaux pays, utiles au quotidien.</h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-200">
            Configure tes pays + préfixes HS : tu reçois une veille ciblée et tu gardes un centre de suivi clair.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => (window.location.href = "/contact?offer=express")}>Validation express</Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => (window.location.href = "/contact?offer=audit")}>
              Audit complet
            </Button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Preferences */}
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Ma veille personnalisée</CardTitle>
              <CardDescription>Email + pays + préfixes HS (2–6 chiffres).</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Email</Label>
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
                ) : null}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Pays suivis</Label>

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
                  <p className="text-xs text-muted-foreground">Ajoute 1–3 pays pour une veille vraiment utile.</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Préfixes HS suivis</Label>
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
                  <p className="text-xs text-muted-foreground">Ajoute 1–3 préfixes HS (2–6 chiffres) liés à tes produits.</p>
                )}
              </div>

              <Button onClick={handleSavePrefs} disabled={alertsLoading} className="w-full">
                {alertsLoading ? "Enregistrement..." : "Activer / mettre à jour ma veille"}
              </Button>

              <p className="text-xs text-muted-foreground">
                Objectif : recevoir uniquement des alertes pertinentes (pays + HS), pas du bruit.
              </p>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Alertes importantes</CardTitle>
              <CardDescription>
                {alertsUpdatedAt ? `Dernière mise à jour : ${formatDateTimeFr(alertsUpdatedAt)}` : "Connecte ton email pour charger les alertes personnalisées."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {!emailOk ? (
                <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
                  Ajoute un email valide puis “Activer / mettre à jour ma veille” pour charger les alertes liées à tes préférences.
                </div>
              ) : (
                <Button variant="outline" onClick={() => loadAlerts(email.trim().toLowerCase())} disabled={alertsLoading} className="w-full">
                  {alertsLoading ? "Chargement..." : "Recharger mes alertes"}
                </Button>
              )}

              <Separator />

              {alertsLoading ? (
                <div className="text-sm text-muted-foreground">Chargement…</div>
              ) : alerts.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  Aucune alerte pour l’instant (ou pas encore de préférences).
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.slice(0, 12).map((a) => (
                    <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold">{a.title}</div>
                        <span className={`rounded-full px-2 py-1 text-xs ${badgeClass(a.severity)}`}>
                          {a.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{a.message}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {a.country ? <span className="rounded-full border border-border bg-muted px-2 py-1">Pays: {a.country}</span> : null}
                        {a.hsPrefix ? <span className="rounded-full border border-border bg-muted px-2 py-1">HS: {a.hsPrefix}</span> : null}
                        {a.detectedAt ? <span className="rounded-full border border-border bg-muted px-2 py-1">{formatDateTimeFr(a.detectedAt)}</span> : null}
                        {a.source ? <span className="rounded-full border border-border bg-muted px-2 py-1">Source: {a.source}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* RSS */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Flux RSS (résumé)</CardTitle>
            <CardDescription>Signaux “macro” utiles : sanctions, géopolitique, commerce, douane…</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={loadRss} disabled={rssLoading}>
                {rssLoading ? "Actualisation..." : "Actualiser le flux"}
              </Button>
              <Button onClick={() => (window.location.href = "/contact?offer=express")}>Transformer ça en action (express)</Button>
            </div>

            <Separator />

            {rssLoading ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : rssItems.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Pas d’items RSS disponibles (ou handler /api/rss en erreur).
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {rssItems.map((it, idx) => (
                  <div key={`${it.link || it.title || "item"}_${idx}`} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-sm font-semibold">{it.title || "Sans titre"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {it.source ? `${it.source} • ` : ""}
                      {it.publishedAt ? formatDateTimeFr(it.publishedAt) : ""}
                    </div>
                    {it.summary ? <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{it.summary}</p> : null}
                    {it.link ? (
                      <a className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" href={it.link} target="_blank" rel="noreferrer">
                        Lire la source →
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
}
