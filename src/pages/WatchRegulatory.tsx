import * as React from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import {
  ShieldCheck,
  FileSearch,
  Scale,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
} from "lucide-react";

type RegEventRow = {
  id: string;

  title?: string | null;
  summary?: string | null;

  jurisdiction?: string | null;
  impact_level?: number | null; // 1..3 idéalement
  impact?: string | null; // fallback éventuel

  territory_codes?: string[] | string | null; // peut arriver en text/json selon schéma
  hs4?: string[] | string | null;
  hs_code?: string[] | string | null;

  effective_date?: string | null;
  published_at?: string | null;

  source_id?: string | null;
  source_url?: string | null; // si tu l’as déjà en colonne
  document_id?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type WatchSourceRow = {
  id: string;
  type?: string | null; // "regulatory"
  name?: string | null;
  url?: string | null;

  is_enabled?: boolean | null;
  status?: string | null;
  last_checked_at?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type CountProbe = { label: string; table: string; hint: string };

function asMessage(err: any): string {
  if (!err) return "Une erreur inconnue est survenue.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return err?.message ?? "Une erreur inconnue est survenue.";
}

function safeArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string") {
    // tolère "A,B,C" ou JSON stringifié
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

function fmtDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function impactLabel(level?: number | null, fallback?: string | null) {
  if (level === 3) return { txt: "Impact fort", variant: "destructive" as const };
  if (level === 2) return { txt: "Impact moyen", variant: "secondary" as const };
  if (level === 1) return { txt: "Impact faible", variant: "outline" as const };
  if (fallback) return { txt: fallback, variant: "outline" as const };
  return { txt: "Impact à qualifier", variant: "outline" as const };
}

export default function WatchRegulatory() {
  const [tab, setTab] = React.useState<"alerts" | "sources" | "checks">("alerts");

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [events, setEvents] = React.useState<RegEventRow[]>([]);
  const [sources, setSources] = React.useState<WatchSourceRow[]>([]);

  const [docsCount, setDocsCount] = React.useState<number | null>(null);
  const [chunksCount, setChunksCount] = React.useState<number | null>(null);

  const [tableCounts, setTableCounts] = React.useState<Record<string, number | null>>({});

  // UI filtres
  const [q, setQ] = React.useState("");
  const [impactFilter, setImpactFilter] = React.useState<"all" | "1" | "2" | "3">("all");

  const probes: CountProbe[] = React.useMemo(
    () => [
      { label: "Événements (reg_events)", table: "reg_events", hint: "Feed des alertes/règles." },
      { label: "Sources (watch_sources)", table: "watch_sources", hint: "Douane, Légifrance, UE, etc." },
      { label: "Catalogue HS (export_hs_catalog)", table: "export_hs_catalog", hint: "Base HS utilisée par les calculs." },
      { label: "Taux & règles (reference_rates)", table: "reference_rates", hint: "TVA / OM / règles par destination." },
      { label: "Docs (documents)", table: "documents", hint: "Docs importés (PDF/URL/HTML...)."},
      { label: "Chunks (document_chunks)", table: "document_chunks", hint: "Extraits indexés citables par l’IA." },
    ],
    []
  );

  async function probeCount(table: string) {
    // count exact, head true => ne ramène pas de lignes
    const { count, error } = await supabase.from(table as any).select("*", { count: "exact", head: true });
    if (error) {
      // si table n'existe pas / pas accès, on renvoie null
      return null;
    }
    return typeof count === "number" ? count : null;
  }

  async function loadAll() {
    setIsLoading(true);
    setError(null);

    if (!SUPABASE_ENV_OK) {
      setIsLoading(false);
      setError("Configuration Supabase manquante (SUPABASE_ENV_OK=false).");
      return;
    }

    try {
      // 1) events
      const ev = await supabase
        .from("reg_events")
        .select("*")
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (ev.error) throw ev.error;
      setEvents((ev.data as any[])?.map((r) => r as RegEventRow) ?? []);

      // 2) sources (type=regulatory si la colonne existe, sinon toutes)
      const srcTry = await supabase
        .from("watch_sources")
        .select("*")
        .eq("type", "regulatory")
        .order("is_enabled", { ascending: false })
        .order("name", { ascending: true })
        .limit(200);

      if (!srcTry.error) {
        setSources((srcTry.data as any[])?.map((r) => r as WatchSourceRow) ?? []);
      } else {
        // fallback si pas de colonne type/valeur
        const src = await supabase.from("watch_sources").select("*").order("name", { ascending: true }).limit(200);
        if (src.error) throw src.error;
        setSources((src.data as any[])?.map((r) => r as WatchSourceRow) ?? []);
      }

      // 3) counts docs / chunks
      const [dc, cc] = await Promise.all([probeCount("documents"), probeCount("document_chunks")]);
      setDocsCount(dc);
      setChunksCount(cc);

      // 4) probes génériques
      const entries = await Promise.all(probes.map(async (p) => [p.table, await probeCount(p.table)] as const));
      const next: Record<string, number | null> = {};
      entries.forEach(([k, v]) => (next[k] = v));
      setTableCounts(next);
    } catch (e: any) {
      setError(asMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredEvents = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    return events.filter((e) => {
      if (impactFilter !== "all" && String(e.impact_level ?? "") !== impactFilter) return false;
      if (!qq) return true;

      const territories = safeArray(e.territory_codes).join(" ");
      const hs = [...safeArray(e.hs4), ...safeArray(e.hs_code)].join(" ");

      const hay = [
        e.title ?? "",
        e.summary ?? "",
        e.jurisdiction ?? "",
        e.impact ?? "",
        territories,
        hs,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qq);
    });
  }, [events, q, impactFilter]);

  const enabledSources = React.useMemo(() => sources.filter((s) => s.is_enabled !== false), [sources]);

  const kpi = React.useMemo(() => {
    return {
      events: tableCounts["reg_events"] ?? events.length ?? null,
      sources: tableCounts["watch_sources"] ?? sources.length ?? null,
      docs: docsCount,
      chunks: chunksCount,
    };
  }, [tableCounts, events.length, sources.length, docsCount, chunksCount]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Veille réglementaire export</p>
            <h1 className="text-2xl font-bold">Douane, DROM, UE, fiscalité</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Objectif : voir <span className="font-medium">ce qui change</span>, <span className="font-medium">ce qui impacte</span>, et <span className="font-medium">quoi faire</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Rafraîchir
            </button>

            <Link
              to="/taxes-om"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              <Scale className="h-4 w-4" />
              Taxes / OM
            </Link>

            <Link
              to="/invoice"
              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
            >
              <ShieldCheck className="h-4 w-4" />
              Contrôler une facture
            </Link>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alertes / règles</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{kpi.events ?? "—"}</div>
              <Badge variant="outline">reg_events</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sources surveillées</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{kpi.sources ?? "—"}</div>
              <Badge variant="outline">watch_sources</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{kpi.docs ?? "—"}</div>
              <Badge variant="outline">documents</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Extraits indexés</CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{kpi.chunks ?? "—"}</div>
              <Badge variant="outline">document_chunks</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Errors / env */}
        {!SUPABASE_ENV_OK && (
          <Card className="border-amber-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Supabase non configuré
              </CardTitle>
              <CardDescription>
                La page ne peut pas charger la veille tant que les variables Supabase ne sont pas correctes.
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

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("alerts")}
            className={`rounded-md px-3 py-2 text-sm ${
              tab === "alerts" ? "bg-primary text-primary-foreground" : "border bg-background hover:bg-accent"
            }`}
          >
            Alertes
          </button>
          <button
            type="button"
            onClick={() => setTab("sources")}
            className={`rounded-md px-3 py-2 text-sm ${
              tab === "sources" ? "bg-primary text-primary-foreground" : "border bg-background hover:bg-accent"
            }`}
          >
            Sources & docs
          </button>
          <button
            type="button"
            onClick={() => setTab("checks")}
            className={`rounded-md px-3 py-2 text-sm ${
              tab === "checks" ? "bg-primary text-primary-foreground" : "border bg-background hover:bg-accent"
            }`}
          >
            Fiscalité / OM
          </button>
        </div>

        {/* Content */}
        {tab === "alerts" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Alertes / règles (reg_events)
                </CardTitle>
                <CardDescription>
                  Filtre rapide + liste des derniers événements. (Si c’est vide : ajoute des lignes dans Admin → reg_events)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 md:max-w-lg">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Rechercher (mot-clé, HS, territoire, juridiction...)"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Impact :</span>
                    {(["all", "1", "2", "3"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setImpactFilter(v)}
                        className={`rounded-md px-2 py-1 text-xs ${
                          impactFilter === v ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
                        }`}
                      >
                        {v === "all" ? "Tous" : v === "1" ? "Faible" : v === "2" ? "Moyen" : "Fort"}
                      </button>
                    ))}
                    <Badge variant="outline">{filteredEvents.length} résultat(s)</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {filteredEvents.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aucune alerte à afficher</CardTitle>
                  <CardDescription>
                    Soit la table <Badge variant="outline">reg_events</Badge> est vide, soit tes filtres sont trop restrictifs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Astuce : commence par 3–5 événements simples (titre, résumé, juridiction, impact_level, territories, hs4, date d’effet).
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredEvents.map((e) => {
                  const territories = safeArray(e.territory_codes);
                  const hs4 = safeArray(e.hs4);
                  const hs = safeArray(e.hs_code);
                  const imp = impactLabel(e.impact_level ?? null, e.impact ?? null);

                  const srcUrl = e.source_url; // si reg_events la stocke
                  const datePub = fmtDate(e.published_at ?? e.created_at ?? null);
                  const dateEff = fmtDate(e.effective_date ?? null);

                  return (
                    <Card key={e.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{e.title ?? "Événement réglementaire"}</CardTitle>
                            {e.summary && <CardDescription className="text-sm">{e.summary}</CardDescription>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={imp.variant}>{imp.txt}</Badge>
                            {e.jurisdiction && <Badge variant="outline">{e.jurisdiction}</Badge>}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {datePub && <span>Publié : <span className="font-medium">{datePub}</span></span>}
                          {dateEff && <span>• Effet : <span className="font-medium">{dateEff}</span></span>}
                          {e.document_id && <span>• Doc : <span className="font-medium">{String(e.document_id).slice(0, 8)}…</span></span>}
                          {e.source_id && <span>• Source : <span className="font-medium">{String(e.source_id).slice(0, 8)}…</span></span>}
                        </div>

                        {(territories.length > 0 || hs4.length > 0 || hs.length > 0) && (
                          <div className="flex flex-wrap items-center gap-2">
                            {territories.slice(0, 12).map((t) => (
                              <Badge key={t} variant="secondary">
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
                            {(territories.length > 12 || hs4.length > 12 || hs.length > 8) && (
                              <Badge variant="outline">+ plus</Badge>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          {srcUrl ? (
                            <a
                              href={srcUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                            >
                              Source <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <Badge variant="outline">Ajoute source_url pour lien direct</Badge>
                          )}

                          <Link
                            to="/taxes-om"
                            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                          >
                            Vérifier impact (Taxes/OM) <Scale className="h-4 w-4" />
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "sources" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-primary" />
                  Sources surveillées (watch_sources)
                </CardTitle>
                <CardDescription>
                  Objectif : savoir d’où viennent les infos + vérifier que la veille tourne.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">Actives : {enabledSources.length}</Badge>
                  <Badge variant="outline">Total : {sources.length}</Badge>
                </div>

                <div className="space-y-2">
                  {sources.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Aucune source. Ajoute-en dans Admin → watch_sources (Douane, Légifrance, UE…).
                    </div>
                  ) : (
                    sources.slice(0, 20).map((s) => {
                      const ok = s.is_enabled !== false;
                      return (
                        <div key={s.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {ok ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="truncate text-sm font-medium">
                                {s.name ?? "Source sans nom"}
                              </div>
                              {s.type && <Badge variant="outline">{s.type}</Badge>}
                              {s.status && <Badge variant="secondary">{s.status}</Badge>}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Dernier check : {fmtDate(s.last_checked_at ?? null) ?? "—"}
                            </div>
                          </div>

                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex shrink-0 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                            >
                              Ouvrir <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <Badge variant="outline" className="shrink-0">URL manquante</Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {sources.length > 20 && (
                  <div className="text-xs text-muted-foreground">
                    Affichage limité à 20 sources (optimisation UI).
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Docs & indexation</CardTitle>
                <CardDescription>
                  L’IA peut citer les <Badge variant="outline">document_chunks</Badge> si tes documents sont bien indexés.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Documents</div>
                    <div className="text-2xl font-bold">{docsCount ?? "—"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Table: documents</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Extraits indexés</div>
                    <div className="text-2xl font-bold">{chunksCount ?? "—"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Table: document_chunks</div>
                  </div>
                </div>

                <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">Checklist rapide</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Importer un doc (PDF/URL) dans <span className="font-medium">documents</span></li>
                    <li>Indexer en chunks dans <span className="font-medium">document_chunks</span></li>
                    <li>Lier l’event (<span className="font-medium">reg_events.document_id</span>) pour la traçabilité</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "checks" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  Diagnostic Fiscalité / OM
                </CardTitle>
                <CardDescription>
                  Vérifie que les briques nécessaires aux calculs sont présentes et non vides.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {probes.map((p) => {
                    const v = tableCounts[p.table];
                    const ok = typeof v === "number" && v > 0;
                    const unk = v === null || typeof v === "undefined";

                    return (
                      <div key={p.table} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{p.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{p.hint}</div>
                          </div>
                          <div className="shrink-0">
                            {unk ? (
                              <Badge variant="outline">inconnu</Badge>
                            ) : ok ? (
                              <Badge variant="secondary">{v}</Badge>
                            ) : (
                              <Badge variant="destructive">{v ?? 0}</Badge>
                            )}
                          </div>
                        </div>

                        {!unk && !ok && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {p.table === "export_hs_catalog" && (
                              <>Catalogue HS vide : import/seed nécessaire avant calculs.</>
                            )}
                            {p.table === "reference_rates" && (
                              <>Rates vides : ajoute les règles TVA/OM par territoire.</>
                            )}
                            {p.table !== "export_hs_catalog" && p.table !== "reference_rates" && (
                              <>Table vide : renseigne des données pour activer la fonctionnalité.</>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Link
                    to="/simulator-shipping"
                    className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                  >
                    Simulateur Expédition <ExternalLink className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/costs"
                    className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
                  >
                    Costs (charges) <ExternalLink className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/taxes-om"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
                  >
                    Ouvrir Taxes / OM <Scale className="h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pourquoi cette page devient utile</CardTitle>
                <CardDescription>
                  En pratique, tu peux traiter ta veille comme un “ticketing réglementaire”.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-disc space-y-1 pl-5">
                  <li>Chaque <Badge variant="outline">reg_event</Badge> = un changement (UE/FR/DROM) + territoires + HS.</li>
                  <li>Tu vois tout de suite ce qui est <span className="font-medium">impact fort</span>.</li>
                  <li>Tu vérifies que tes bases <Badge variant="outline">export_hs_catalog</Badge> / <Badge variant="outline">reference_rates</Badge> sont prêtes.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
