import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Globe, ListChecks, Rss, ShieldCheck, Target, Zap } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, DEMO_MODE, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc/validators";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTimeFr } from "@/lib/formatters";
import { demoRegulatoryFeeds, demoRegulatoryItems } from "@/lib/demoData";

type Feed = {
  id: string;
  name: string | null;
  source_url: string | null;
  category: string | null;
  zone: string | null;
  enabled: boolean | null;
};

type Item = {
  id: string;
  title: string | null;
  summary: string | null;
  url: string | null;
  published_at: string | null;
  category: string | null;
  zone: string | null;
  severity: string | null;
  feed_id: string | null;
};

type RssApiItem = {
  title?: string;
  summary?: string;
  link?: string;
  publishedAt?: string;
  category?: string;
  zone?: string;
};

const CATEGORIES = [
  { value: "sanctions", label: "Sanctions" },
  { value: "taxes", label: "Taxes" },
  { value: "docs", label: "Documents" },
  { value: "regulation", label: "Réglementation" },
  { value: "douane", label: "Douane" },
  { value: "maritime", label: "Maritime" },
];

const ZONES = ["EU", "US", "UK", "CHINA", "MEA", "AFRICA", "APAC", "LATAM", "GLOBAL"];

export default function WatchRegulatory() {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [zone, setZone] = React.useState<string>("all");
  const [watchCountry, setWatchCountry] = React.useState<string>("all");
  const [launchingWatch, setLaunchingWatch] = React.useState(false);
  const [watchItems, setWatchItems] = React.useState<Item[]>([]);

  const feedsQuery = useQuery({
    queryKey: ["reg-feeds"],
    enabled: !DEMO_MODE && SUPABASE_ENV_OK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regulatory_feeds")
        .select("id,name,source_url,category,zone,enabled")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        if (isMissingTableError(error)) return { data: [], missingTables: true };
        throw error;
      }
      return { data: (data as Feed[]) || [], missingTables: false };
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["reg-items"],
    enabled: !DEMO_MODE && SUPABASE_ENV_OK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regulatory_items")
        .select("id,title,summary,url,published_at,category,zone,severity,feed_id")
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) {
        if (isMissingTableError(error)) return { data: [], missingTables: true };
        throw error;
      }
      return { data: (data as Item[]) || [], missingTables: false };
    },
  });

  const missingTables = Boolean(feedsQuery.data?.missingTables || itemsQuery.data?.missingTables);
  const feeds = DEMO_MODE ? demoRegulatoryFeeds : feedsQuery.data?.data || [];
  const items = DEMO_MODE ? demoRegulatoryItems : itemsQuery.data?.data || [];

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "all" && (it.category || "sanctions") !== category) return false;
      if (zone !== "all" && (it.zone || "").toLowerCase() !== zone.toLowerCase()) return false;
      if (!q) return true;
      const hay = [it.title, it.summary, it.url, it.category, it.zone].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, category, zone, search]);

  const availableCountries = React.useMemo(() => {
    const fromItems = items.map((it) => (it.zone || "").toUpperCase()).filter(Boolean);
    const fromFeeds = feeds.map((f) => (f.zone || "").toUpperCase()).filter(Boolean);
    return Array.from(new Set([...fromItems, ...fromFeeds, ...ZONES])).sort();
  }, [items, feeds]);

  const launchWatch = async () => {
    setLaunchingWatch(true);
    try {
      const zoneParam = watchCountry !== "all" ? `&zone=${encodeURIComponent(watchCountry)}` : "";
      const resp = await fetch(`/api/rss?limit=30${zoneParam}`);
      const payload = await resp.json().catch(() => ({} as { items?: RssApiItem[] }));
      const rssItems = Array.isArray(payload?.items) ? payload.items : [];

      const normalized: Item[] = rssItems.map((it, idx) => ({
        id: `rss_${idx}_${it.link || "x"}`,
        title: it.title || "Alerte",
        summary: it.summary || null,
        url: it.link || null,
        published_at: it.publishedAt || null,
        category: it.category || null,
        zone: it.zone || watchCountry || null,
        severity: null,
        feed_id: null,
      }));

      setWatchItems(normalized);
      setZone(watchCountry);
    } catch {
      setWatchItems([]);
    } finally {
      setLaunchingWatch(false);
    }
  };

  const displayItems = watchItems.length ? watchItems : filtered;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Centre veille réglementaire</p>
            <h1 className="text-2xl font-bold">Audit - Réglementation - Export mondial</h1>
            <p className="text-sm text-muted-foreground">
              Flux et alertes issus de sources officielles. Filtres par categorie, zone et recherche.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={watchCountry} onValueChange={setWatchCountry}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Choisir un pays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les pays</SelectItem>
                {availableCountries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={launchWatch} disabled={launchingWatch}>
              {launchingWatch ? "Chargement..." : "Lancer ma veille"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                feedsQuery.refetch();
                itemsQuery.refetch();
              }}
            >
              Rafraichir
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Input placeholder="Recherche (titre, resume, source...)" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger>
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes zones</SelectItem>
                {ZONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {missingTables ? (
          <EmptyState
            title="Connexion des sources requise"
            description="Initialise la base pour charger les flux réglementaires, puis lance un seed de demo pour alimenter les alertes."
            primaryAction={{ label: "Initialiser la base", to: "/resources" }}
            secondaryAction={{ label: "Voir la documentation", to: "/resources" }}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>Dernières alertes</CardTitle>
                  <CardDescription>Triees par date de publication</CardDescription>
                </div>
                <Badge variant="outline">{filtered.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                  {itemsQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Chargement...</div>
                  ) : displayItems.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Aucune alerte correspondant aux filtres.</div>
                  ) : (
                    displayItems.slice(0, 30).map((it) => (
                    <div key={it.id} className="rounded-lg border p-3 bg-card/50 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">{it.title || "Alerte"}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTimeFr(it.published_at)}</div>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          <Badge variant="secondary">{it.category || "sanctions"}</Badge>
                          {it.zone ? (
                            <Badge variant="outline" className="text-[11px]">
                              {it.zone}
                            </Badge>
                          ) : null}
                          {it.severity ? (
                            <Badge variant="outline" className="text-[11px]">
                              {it.severity}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {it.summary ? <p className="text-sm text-muted-foreground">{it.summary}</p> : null}
                      {it.url ? (
                        <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                          Ouvrir la source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rss className="h-4 w-4" />
                    Flux surveilles
                  </CardTitle>
                  <CardDescription>Sources connectees</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {feedsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Chargement...</p>
                  ) : feeds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun flux. Ajoute des sources officielles.</p>
                  ) : (
                    feeds.slice(0, 20).map((f) => (
                      <div key={f.id} className="rounded-lg border p-2">
                        <div className="text-sm font-semibold">{f.name || "Flux"}</div>
                        <div className="text-[11px] text-muted-foreground break-all">{f.source_url}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {f.category ? <Badge variant="secondary" className="text-[11px]">{f.category}</Badge> : null}
                          {f.zone ? <Badge variant="outline" className="text-[11px]">{f.zone}</Badge> : null}
                          {f.enabled ? <Badge variant="outline" className="text-[11px]">Actif</Badge> : null}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Connexion des sources
                  </CardTitle>
                  <CardDescription>Checklist d'activation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                    <span>Creer les tables regulatory_feeds et regulatory_items.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-primary mt-0.5" />
                    <span>Connecter les sources officielles (UE, OFAC, ONU).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-primary mt-0.5" />
                    <span>Tagger par categorie et zone pour prioriser les alertes.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-primary mt-0.5" />
                    <span>Activer les severites pour remonter les urgences.</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
