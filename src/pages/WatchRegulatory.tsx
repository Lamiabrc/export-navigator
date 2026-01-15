import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import {
  Rss,
  ShieldCheck,
  FileSearch,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Search,
  PlusCircle,
} from "lucide-react";

type WatchSourceRow = {
  id: string;
  type?: string | null;
  format?: string | null;
  name?: string | null;
  url: string;
  is_enabled?: boolean | null;
  status?: string | null;
  last_checked_at?: string | null;
  last_error?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WatchItemRow = {
  id: string;
  source_id: string | null;
  type?: string | null;
  title?: string | null;
  summary?: string | null;
  url?: string | null;
  published_at?: string | null;
  guid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RegEventRow = {
  id: string;
  title?: string | null;
  summary?: string | null;
  jurisdiction?: string | null;
  impact_level?: number | null;

  territory_codes?: string[] | string | null;
  hs4?: string[] | string | null;
  hs_code?: string[] | string | null;

  effective_date?: string | null;
  published_at?: string | null;

  source_id?: string | null;
  source_url?: string | null;
  document_id?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

function asMessage(err: any): string {
  if (!err) return "Une erreur inconnue est survenue.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return err?.message ?? "Une erreur inconnue est survenue.";
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function safeArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      } catch {
        // ignore
      }
    }
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function impactBadge(level?: number | null) {
  if (level === 3) return { text: "Impact fort", variant: "destructive" as const };
  if (level === 2) return { text: "Impact moyen", variant: "secondary" as const };
  if (level === 1) return { text: "Impact faible", variant: "outline" as const };
  return { text: "Impact à qualifier", variant: "outline" as const };
}

async function safeCount(table: string): Promise<number | null> {
  const { count, error } = await supabase.from(table as any).select("*", { count: "exact", head: true });
  if (error) return null;
  return typeof count === "number" ? count : null;
}

export default function WatchRegulatory() {
  const [tab, setTab] = React.useState<"rss" | "alerts" | "sources">("rss");

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const [sources, setSources] = React.useState<WatchSourceRow[]>([]);
  const [items, setItems] = React.useState<WatchItemRow[]>([]);
  const [events, setEvents] = React.useState<RegEventRow[]>([]);

  const [counts, setCounts] = React.useState<{
    watch_sources: number | null;
    watch_items: number | null;
    reg_events: number | null;
    documents: number | null;
    document_chunks: number | null;
  }>({
    watch_sources: null,
    watch_items: null,
    reg_events: null,
    documents: null,
    document_chunks: null,
  });

  // filtres UI
  const [q, setQ] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [impactFilter, setImpactFilter] = React.useState<"all" | "1" | "2" | "3">("all");

  const [pulling, setPulling] = React.useState(false);
  const [pullResult, setPullResult] = React.useState<any>(null);

  const sourcesById = React.useMemo(() => {
    const m: Record<string, WatchSourceRow> = {};
    for (const s of sources) m[s.id] = s;
    return m;
  }, [sources]);

  const filteredItems = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (sourceFilter !== "all" && String(it.source_id ?? "") !== sourceFilter) return false;
      if (!qq) return true;
      const hay = `${it.title ?? ""} ${it.summary ?? ""} ${it.url ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q, sourceFilter]);

  const filteredEvents = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    return events.filter((e) => {
      if (impactFilter !== "all" && String(e.impact_level ?? "") !== impactFilter) return false;
      if (!qq) return true;

      const territories = safeArray(e.territory_codes).join(" ");
      const hs = [...safeArray(e.hs4), ...safeArray(e.hs_code)].join(" ");

      const hay = `${e.title ?? ""} ${e.summary ?? ""} ${e.jurisdiction ?? ""} ${territories} ${hs} ${e.source_url ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [events, q, impactFilter]);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    setWarnings([]);

    if (!SUPABASE_ENV_OK) {
      setIsLoading(false);
      setError("Configuration Supabase manquante (SUPABASE_ENV_OK=false).");
      return;
    }

    const nextWarnings: string[] = [];

    try {
      // counts (si table absente -> null)
      const [cSources, cItems, cEvents, cDocs, cChunks] = await Promise.all([
        safeCount("watch_sources"),
        safeCount("watch_items"),
        safeCount("reg_events"),
        safeCount("documents"),
        safeCount("document_chunks"),
      ]);

      setCounts({
        watch_sources: cSources,
        watch_items: cItems,
        reg_events: cEvents,
        documents: cDocs,
        document_chunks: cChunks,
      });

      if (cSources === null) nextWarnings.push("Table manquante: public.watch_sources (exécute le SQL correctif).");
      if (cItems === null) nextWarnings.push("Table manquante: public.watch_items (exécute le SQL correctif).");
      if (cEvents === null) nextWarnings.push("Table manquante: public.reg_events (exécute le SQL correctif).");

      // sources
      {
        const res = await supabase
          .from("watch_sources")
          .select("*")
          .order("is_enabled", { ascending: false })
          .order("name", { ascending: true })
          .limit(200);

        if (res.error) {
          // table manquante / pas accès
          setSources([]);
        } else {
          setSources((res.data as any[])?.map((r) => r as WatchSourceRow) ?? []);
        }
      }

      // items RSS
      {
        const res = await supabase
          .from("watch_items")
          .select("*")
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200);

        if (res.error) {
          setItems([]);
        } else {
          setItems((res.data as any[])?.map((r) => r as WatchItemRow) ?? []);
        }
      }

      // reg_events
      {
        const res = await supabase
          .from("reg_events")
          .select("*")
          .order("published_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200);

        if (res.error) {
          setEvents([]);
        } else {
          setEvents((res.data as any[])?.map((r) => r as RegEventRow) ?? []);
        }
      }
    } catch (e: any) {
      setError(asMessage(e));
    } finally {
      setWarnings(nextWarnings);
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pullRssNow() {
    setPulling(true);
    setPullResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("watch_rss_pull", {
        body: { type: "regulatory", limit_per_source: 25, since_days: 120 },
      });
      if (error) throw error;
      setPullResult(data ?? { ok: true });
      // recharge items après import
      await loadAll();
    } catch (e: any) {
      setPullResult({ ok: false, error: asMessage(e) });
    } finally {
      setPulling(false);
    }
  }

  async function promoteToRegEvent(item: WatchItemRow) {
    // crée une alerte “qualifiée” basique à partir d’un item RSS
    try {
      const payload: any = {
        title: item.title ?? "Alerte réglementaire",
        summary: item.summary ?? null,
        published_at: item.published_at ?? null,
        source_id: item.source_id ?? null,
        source_url: item.url ?? null,
        impact_level: 2, // valeur par défaut (modifiable ensuite dans Admin)
      };

      const { error } = await supabase.from("reg_events").insert(payload);
      if (error) throw error;

      await loadAll();
      setTab("alerts");
    } catch (e: any) {
      setError(
        "Impossible de créer l’alerte dans reg_events. Vérifie que reg_events existe avec les bonnes colonnes (SQL correctif). Détail: " +
          asMessage(e),
      );
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Veille réglementaire export</p>
            <h1 className="text-2xl font-bold">Douane, DROM, UE, fiscalité</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Flux RSS (brut) → <span className="font-medium">watch_items</span> • Alertes qualifiées →{" "}
              <span className="font-medium">reg_events</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadAll()} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>

            <Button onClick={() => setTab("rss")} variant={tab === "rss" ? "default" : "outline"}>
              <Rss className="mr-2 h-4 w-4" />
              Flux RSS
            </Button>
            <Button onClick={() => setTab("alerts")} variant={tab === "alerts" ? "default" : "outline"}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Alertes
            </Button>
            <Button onClick={() => setTab("sources")} variant={tab === "sources" ? "default" : "outline"}>
              <FileSearch className="mr-2 h-4 w-4" />
              Sources
            </Button>
          </div>
        </div>

        {/* KPI */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sources</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{counts.watch_sources ?? "—"}</div>
              <Badge variant="outline">watch_sources</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Items RSS</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{counts.watch_items ?? "—"}</div>
              <Badge variant="outline">watch_items</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alertes</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{counts.reg_events ?? "—"}</div>
              <Badge variant="outline">reg_events</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Docs</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{counts.documents ?? "—"}</div>
              <Badge variant="outline">documents</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Chunks</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{counts.document_chunks ?? "—"}</div>
              <Badge variant="outline">document_chunks</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Warnings / errors */}
        {!SUPABASE_ENV_OK && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Supabase non configuré
              </CardTitle>
              <CardDescription>Corrige tes variables Supabase côté app.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {warnings.length > 0 && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Correctifs SQL nécessaires
              </CardTitle>
              <CardDescription>
                {warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Erreur
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Filtres communs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recherche</CardTitle>
            <CardDescription>Un seul champ de recherche pour RSS et Alertes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 md:max-w-lg">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Mot-clé, HS, territoire, texte..."
                className="border-0 px-0 py-0 shadow-none focus-visible:ring-0"
              />
            </div>

            {tab === "rss" && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <option value="all">Toutes les sources</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.url}
                    </option>
                  ))}
                </select>

                <Button onClick={() => void pullRssNow()} disabled={pulling}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${pulling ? "animate-spin" : ""}`} />
                  Importer RSS
                </Button>
              </div>
            )}

            {tab === "alerts" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Impact :</span>
                {(["all", "1", "2", "3"] as const).map((v) => (
                  <Button
                    key={v}
                    variant={impactFilter === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setImpactFilter(v)}
                  >
                    {v === "all" ? "Tous" : v === "1" ? "Faible" : v === "2" ? "Moyen" : "Fort"}
                  </Button>
                ))}
                <Badge variant="outline">{filteredEvents.length} alerte(s)</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Résultat import RSS */}
        {tab === "rss" && pullResult && (
          <Card className={pullResult.ok ? "border-primary/30" : "border-destructive/40"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {pullResult.ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                Import RSS
              </CardTitle>
              <CardDescription className="break-words">
                {pullResult.ok
                  ? `Sources: ${pullResult.sources_count ?? "?"} • Upserts: ${pullResult.total_upserted ?? "?"}`
                  : `Erreur: ${pullResult.error ?? "inconnue"}`}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Onglets */}
        {tab === "rss" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rss className="h-5 w-5 text-primary" />
                  Flux RSS (watch_items)
                </CardTitle>
                <CardDescription>
                  Liste brute des articles. Quand c’est pertinent, tu le “promouvois” en alerte dans <Badge variant="outline">reg_events</Badge>.
                </CardDescription>
              </CardHeader>
            </Card>

            {filteredItems.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aucun item RSS</CardTitle>
                  <CardDescription>
                    1) Ajoute des sources dans <Badge variant="outline">watch_sources</Badge> • 2) Clique “Importer RSS”.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredItems.map((it) => {
                  const s = it.source_id ? sourcesById[it.source_id] : null;
                  return (
                    <Card key={it.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{it.title ?? "Article RSS"}</CardTitle>
                            <CardDescription className="text-sm">
                              {s ? (s.name ?? s.url) : "Source inconnue"} • Publié: {fmtDate(it.published_at)}
                            </CardDescription>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {it.url ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                              >
                                Ouvrir <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <Badge variant="outline">Lien manquant</Badge>
                            )}

                            <Button
                              variant="secondary"
                              onClick={() => void promoteToRegEvent(it)}
                              className="inline-flex items-center gap-2"
                            >
                              <PlusCircle className="h-4 w-4" />
                              Créer alerte
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      {it.summary && (
                        <CardContent className="text-sm text-muted-foreground">
                          {it.summary.length > 400 ? it.summary.slice(0, 400) + "…" : it.summary}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "alerts" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Alertes qualifiées (reg_events)
                </CardTitle>
                <CardDescription>
                  Ici tu mets ce qui est exploitable (HS, territoires, impact). Le RSS est une matière première.
                </CardDescription>
              </CardHeader>
            </Card>

            {filteredEvents.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aucune alerte</CardTitle>
                  <CardDescription>Crée-en depuis un item RSS (“Créer alerte”) ou via Admin.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredEvents.map((e) => {
                  const imp = impactBadge(e.impact_level ?? null);
                  const territories = safeArray(e.territory_codes);
                  const hs4 = safeArray(e.hs4);
                  const hs = safeArray(e.hs_code);

                  return (
                    <Card key={e.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{e.title ?? "Alerte réglementaire"}</CardTitle>
                            {e.summary && <CardDescription className="text-sm">{e.summary}</CardDescription>}
                            <div className="text-xs text-muted-foreground">
                              Publié: {fmtDate(e.published_at ?? e.created_at)} • Effet: {fmtDate(e.effective_date)}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={imp.variant}>{imp.text}</Badge>
                            {e.jurisdiction && <Badge variant="outline">{e.jurisdiction}</Badge>}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {(territories.length || hs4.length || hs.length) ? (
                          <div className="flex flex-wrap gap-2">
                            {territories.slice(0, 12).map((t) => (
                              <Badge key={`t-${t}`} variant="secondary">
                                {t}
                              </Badge>
                            ))}
                            {hs4.slice(0, 12).map((h) => (
                              <Badge key={`hs4-${h}`} variant="outline">
                                HS4 {h}
                              </Badge>
                            ))}
                            {hs.slice(0, 8).map((h) => (
                              <Badge key={`hs-${h}`} variant="outline">
                                HS {h}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            À compléter : territoires/HS/impact pour exploiter l’alerte.
                          </div>
                        )}

                        {e.source_url ? (
                          <a
                            href={e.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                          >
                            Source <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <Badge variant="outline">source_url manquant</Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "sources" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-primary" />
                  Sources (watch_sources)
                </CardTitle>
                <CardDescription>
                  Mets ici tes flux RSS. Le bouton “Importer RSS” remplira <Badge variant="outline">watch_items</Badge>.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Exemple SQL d’ajout: <span className="font-medium">insert into watch_sources (name,url)</span> …
              </CardContent>
            </Card>

            {sources.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aucune source</CardTitle>
                  <CardDescription>Ajoute des lignes dans watch_sources (RSS) puis reviens dans l’onglet Flux RSS.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-4">
                {sources.map((s) => (
                  <Card key={s.id}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{s.name ?? "Source"}</CardTitle>
                          <CardDescription className="text-sm break-words">{s.url}</CardDescription>
                          <div className="text-xs text-muted-foreground">
                            Dernier check: {fmtDate(s.last_checked_at)} {s.last_error ? "• Erreur: " + s.last_error : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={s.is_enabled === false ? "outline" : "secondary"}>
                            {s.is_enabled === false ? "désactivée" : "active"}
                          </Badge>
                          {s.format && <Badge variant="outline">{s.format}</Badge>}
                          {s.type && <Badge variant="outline">{s.type}</Badge>}
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                          >
                            Ouvrir <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
