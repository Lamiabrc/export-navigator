import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Globe, ListChecks, Rss, ShieldCheck, Target, Zap } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

type Feed = {
  id: string;
  title: string | null;
  url: string | null;
  scope: string | null;
  tags: string[] | null;
};

type Item = {
  id: string;
  title: string | null;
  summary: string | null;
  source_url: string | null;
  published_at: string | null;
  category: string | null;
  tags: string[] | null;
  feed_id: string | null;
};

const CATEGORIES = [
  { value: "audit", label: "Audit" },
  { value: "reglementation", label: "Reglementation" },
  { value: "douane", label: "Douane" },
  { value: "sanctions", label: "Sanctions" },
  { value: "incoterms", label: "Incoterms" },
  { value: "marche", label: "Marche" },
  { value: "concurrence", label: "Concurrence" },
];

const TERRITORIES = ["FR", "EU", "US", "UK", "CHINA", "MEA", "AFRICA", "APAC", "LATAM", "GLOBAL"];

function toDateLabel(d: string | null) {
  if (!d) return "Date inconnue";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function WatchRegulatory() {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [territory, setTerritory] = React.useState<string>("all");

  const feedsQuery = useQuery({
    queryKey: ["reg-feeds"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) return { data: [], warning: "Supabase non configure" };
      const { data, error } = await supabase.from("regulatory_feeds").select("id,title,url,scope,tags").limit(200);
      if (error) {
        if (isMissingTableError(error)) return { data: [], warning: "Table regulatory_feeds absente" };
        throw error;
      }
      return { data: (data as Feed[]) || [], warning: undefined };
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["reg-items"],
    queryFn: async () => {
      if (!SUPABASE_ENV_OK) return { data: [], warning: "Supabase non configure" };
      const { data, error } = await supabase
        .from("regulatory_items")
        .select("id,title,summary,source_url,published_at,category,tags,feed_id")
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) {
        if (isMissingTableError(error)) return { data: [], warning: "Table regulatory_items absente" };
        throw error;
      }
      return { data: (data as Item[]) || [], warning: undefined };
    },
  });

  const warning = feedsQuery.data?.warning || itemsQuery.data?.warning;
  const feeds = feedsQuery.data?.data || [];
  const items = itemsQuery.data?.data || [];

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "all" && (it.category || "audit") !== category) return false;
      if (territory !== "all") {
        const tags = (it.tags || []).map((t) => t.toLowerCase());
        if (!tags.some((t) => t.includes(territory.toLowerCase()))) return false;
      }
      if (!q) return true;
      const hay = [it.title, it.summary, it.source_url, (it.tags || []).join(" ")].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, category, territory, search]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Veille audit et reglementation</p>
            <h1 className="text-2xl font-bold">Audit - Reglementation - Export mondial</h1>
            <p className="text-sm text-muted-foreground">
              Flux depuis regulatory_feeds / regulatory_items. Filtres : categorie, zone, recherche.
            </p>
          </div>
          <div className="flex gap-2">
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
            <Select value={territory} onValueChange={setTerritory}>
              <SelectTrigger>
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes zones</SelectItem>
                {TERRITORIES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {warning ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-4 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4" />
              <div>{warning}. Cree les tables regulatory_feeds / regulatory_items ou alimente-les.</div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Dernieres alertes</CardTitle>
                <CardDescription>Triees par date de publication</CardDescription>
              </div>
              <Badge variant="outline">{filtered.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {itemsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Chargement...</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune alerte correspondant aux filtres.</div>
              ) : (
                filtered.slice(0, 30).map((it) => (
                  <div key={it.id} className="rounded-lg border p-3 bg-card/50 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">{it.title || "Alerte"}</div>
                        <div className="text-xs text-muted-foreground">{toDateLabel(it.published_at)}</div>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        <Badge variant="secondary">{it.category || "audit"}</Badge>
                        {(it.tags || []).slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[11px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {it.summary ? <p className="text-sm text-muted-foreground">{it.summary}</p> : null}
                    {it.source_url ? (
                      <a href={it.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
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
                <CardDescription>Tables regulatory_feeds / items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {feedsQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                ) : feeds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun flux. Ajoute des sources (douanes, reglementation, concurrence).</p>
                ) : (
                  feeds.slice(0, 20).map((f) => (
                    <div key={f.id} className="rounded-lg border p-2">
                      <div className="text-sm font-semibold">{f.title || "Flux"}</div>
                      <div className="text-[11px] text-muted-foreground break-all">{f.url}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {f.scope ? <Badge variant="secondary" className="text-[11px]">{f.scope}</Badge> : null}
                        {(f.tags || []).slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[11px]">{t}</Badge>
                        ))}
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
                  A faire
                </CardTitle>
                <CardDescription>Connexion aux flux externes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                  <span>Creer les tables <code>regulatory_feeds</code> et <code>regulatory_items</code> si absentes.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Globe className="h-4 w-4 text-primary mt-0.5" />
                  <span>Configurer un job pour injecter les flux (RSS, sites officiels, veille concurrence).</span>
                </div>
                <div className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-primary mt-0.5" />
                  <span>Tagger les items avec categorie et zone (EU, US, CHINA, MEA...).</span>
                </div>
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-primary mt-0.5" />
                  <span>Activer les filtres pour prioriser les alertes critiques.</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
