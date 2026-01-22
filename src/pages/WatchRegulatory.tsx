import React, { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import { Bell, Rss, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";

type WatchSource = {
  id: string;
  type: string;
  name: string;
  feed_url: string;
  format: "rss" | "atom";
  jurisdiction: string | null;
  tags: string[];
  enabled: boolean;
  updated_at: string;
};

type WatchItem = {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  published_at: string | null;
  created_at: string;
  source_id: string;
  watch_sources?: { name: string; type: string; jurisdiction: string | null; tags: string[] } | null;
};

type RegEvent = {
  id: string;
  title: string;
  summary: string | null;
  jurisdiction: string | null;
  impact: "low" | "medium" | "high" | "critical";
  status: "new" | "triaged" | "applied" | "ignored";
  hs_codes: string[];
  territory_codes: string[];
  export_zone: string | null;
  effective_date: string | null;
  created_at: string;
};

function fmtDate(x?: string | null) {
  if (!x) return "—";
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "2-digit" });
}

function impactVariant(impact: RegEvent["impact"]) {
  if (impact === "critical") return "destructive";
  if (impact === "high") return "secondary";
  return "outline";
}

export default function WatchRegulatory() {
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [events, setEvents] = useState<RegEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeBadges = useMemo(
    () => [
      { label: "DROM (GP/MQ/GF/RE/YT)", variant: "secondary" as const },
      { label: "UE (JOUE)", variant: "secondary" as const },
      { label: "Suisse (Swissmedic)", variant: "secondary" as const },
      { label: "Orthopédie / DM (HS 9021…)", variant: "outline" as const },
    ],
    [],
  );

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [srcRes, itemRes, evtRes] = await Promise.all([
      supabase
        .from("watch_sources")
        .select("id,type,name,feed_url,format,jurisdiction,tags,enabled,updated_at")
        .eq("enabled", true)
        .order("name", { ascending: true }),

      supabase
        .from("watch_items")
        .select("id,title,url,summary,published_at,created_at,source_id, watch_sources(name,type,jurisdiction,tags)")
        .order("published_at", { ascending: false })
        .limit(50),

      supabase
        .from("reg_events")
        .select("id,title,summary,jurisdiction,impact,status,hs_codes,territory_codes,export_zone,effective_date,created_at")
        .in("status", ["new", "triaged"])
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (srcRes.error) setError(srcRes.error.message);
    if (itemRes.error) setError(itemRes.error.message);
    if (evtRes.error) setError(evtRes.error.message);

    setSources((srcRes.data as any) ?? []);
    setItems((itemRes.data as any) ?? []);
    setEvents((evtRes.data as any) ?? []);
    setLoading(false);
  }

  async function sync() {
    setSyncing(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("watch-sync", { body: { limitPerSource: 30 } });
      if (error) throw error;
      await loadAll();
      // eslint-disable-next-line no-console
      console.log("watch-sync:", data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpi = useMemo(() => {
    const newAlerts = events.filter((e) => e.status === "new").length;
    const high = events.filter((e) => e.impact === "high" || e.impact === "critical").length;
    const feedCount = sources.length;
    const itemCount = items.length;
    return { newAlerts, high, feedCount, itemCount };
  }, [events, sources, items]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Veille export — SME Europe / MPL Conseil Export France</p>
            <h1 className="text-2xl font-bold">DROM • UE • Suisse — Fiscalité, Douane, Dispositifs médicaux</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {scopeBadges.map((b) => (
                <Badge key={b.label} variant={b.variant}>
                  {b.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAll} disabled={loading || syncing}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Rafraîchir
            </Button>
            <Button onClick={sync} disabled={loading || syncing}>
              <Rss className="mr-2 h-4 w-4" />
              {syncing ? "Sync..." : "Sync RSS"}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Erreur</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Alertes nouvelles
              </CardTitle>
              <CardDescription>À trier (auto via règles)</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{kpi.newAlerts}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Alertes high+
              </CardTitle>
              <CardDescription>High / Critical</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{kpi.high}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rss className="h-5 w-5 text-primary" />
                Sources actives
              </CardTitle>
              <CardDescription>RSS / Atom</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{kpi.feedCount}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Derniers items</CardTitle>
              <CardDescription>Brut RSS</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{kpi.itemCount}</CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts">
          <TabsList>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
            <TabsTrigger value="feeds">Sources</TabsTrigger>
            <TabsTrigger value="raw">Brut (RSS)</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Alertes pertinentes (DROM / UE / CH)</CardTitle>
                <CardDescription>
                  Générées automatiquement via <code>watch_rules</code>. À toi de passer les statuts: new → triaged → applied/ignored.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune alerte. Clique sur <b>Sync RSS</b> (et vérifie que tu as bien créé la function <code>watch-sync</code>).
                  </p>
                ) : (
                  events.map((e) => (
                    <div key={e.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{e.title}</div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={impactVariant(e.impact)}>{e.impact}</Badge>
                          <Badge variant="outline">{e.status}</Badge>
                          {e.jurisdiction && <Badge variant="secondary">{e.jurisdiction}</Badge>}
                          {e.export_zone && <Badge variant="secondary">{e.export_zone}</Badge>}
                        </div>
                      </div>

                      {e.summary && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{e.summary}</p>}

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {e.territory_codes?.length > 0 && (
                          <Badge variant="outline">Territoires: {e.territory_codes.join(", ")}</Badge>
                        )}
                        {e.hs_codes?.length > 0 && <Badge variant="outline">HS: {e.hs_codes.join(", ")}</Badge>}
                        <Badge variant="outline">Créé: {fmtDate(e.created_at)}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feeds" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Sources de veille</CardTitle>
                <CardDescription>
                  Ciblées MPL Conseil Export/SME Europe : fiscalité DROM, JOUE (UE), Suisse (Swissmedic), actus économie/export.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune source active. Vérifie les inserts dans <code>watch_sources</code>.
                  </p>
                ) : (
                  sources.map((s) => (
                    <div key={s.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.format.toUpperCase()} • {s.type} • {s.jurisdiction ?? "—"}
                          </div>
                        </div>
                        <a href={s.feed_url} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Ouvrir
                          </Button>
                        </a>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(s.tags ?? []).map((t) => (
                          <Badge key={t} variant="secondary">
                            {t}
                          </Badge>
                        ))}
                        <Badge variant="outline">Maj: {fmtDate(s.updated_at)}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Derniers items RSS (brut)</CardTitle>
                <CardDescription>Utile pour vérifier que la collecte fonctionne. Les alertes se basent sur ces items.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun item collecté. Clique <b>Sync RSS</b>.
                  </p>
                ) : (
                  items.map((it) => (
                    <div key={it.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold">{it.title}</div>
                        <a href={it.url} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Lire
                          </Button>
                        </a>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {it.watch_sources?.name ?? "Source"} • {fmtDate(it.published_at)} • import {fmtDate(it.created_at)}
                      </div>

                      {it.summary && (
                        <>
                          <Separator className="my-3" />
                          <p className="text-sm text-muted-foreground line-clamp-4">{it.summary}</p>
                        </>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
