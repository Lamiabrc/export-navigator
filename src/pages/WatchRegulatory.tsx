import * as React from "react";
import { ExternalLink, Filter, RefreshCw, Rss } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PanoramicControlTowerMap } from "@/components/controlTower/PanoramicControlTowerMap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDateTimeFr } from "@/lib/formatters";

type RssItem = {
  title: string;
  link: string;
  summary: string | null;
  publishedAt: string | null;
  source: string | null;
  zone: string | null;
  territory?: string | null;
  category: string | null;
  tags?: string[];
  official?: boolean;
  importance?: number;
  imageUrl: string | null;
};

type RssPayload = {
  ok?: boolean;
  degraded?: boolean;
  territory?: string;
  topic?: string | null;
  from?: string | null;
  to?: string | null;
  official_only?: boolean;
  updatedAt?: string | null;
  items?: RssItem[];
  sources?: string[];
  pinned?: string[];
  error?: string;
};

const TOPICS = [
  { value: "all", label: "Tous" },
  { value: "sanctions", label: "Sanctions" },
  { value: "douane", label: "Douane" },
  { value: "taxes", label: "Taxes" },
  { value: "documents", label: "Documents" },
  { value: "logistics", label: "Logistique" },
  { value: "trade", label: "Commerce" },
  { value: "health", label: "Sante" },
];

function normalizeTerritory(value: string | null | undefined) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "WORLD" || raw === "GLOBAL" || raw === "ALL" || raw === "MONDE") return "WORLD";
  return /^[A-Z]{2}$/.test(raw) ? raw : "WORLD";
}

function territoryLabel(iso: string) {
  if (iso === "WORLD") return "Monde";
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    return dn.of(iso) || iso;
  } catch {
    return iso;
  }
}

function importanceVariant(score: number) {
  if (score >= 75) return "destructive" as const;
  if (score >= 45) return "secondary" as const;
  return "outline" as const;
}

export default function WatchRegulatory() {
  const [territory, setTerritory] = React.useState("WORLD");
  const [topic, setTopic] = React.useState("all");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [officialOnly, setOfficialOnly] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<RssPayload>({});

  const refreshKey = React.useRef(0);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", "60");
      params.set("territory", territory);
      params.set("official", officialOnly ? "1" : "0");
      if (topic !== "all") params.set("topic", topic);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      try {
        const res = await fetch(`/api/rss?${params.toString()}`);
        const json = (await res.json().catch(() => ({}))) as RssPayload;
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `rss_failed_${res.status}`);
        }

        if (!active) return;
        setPayload(json);
      } catch (e: any) {
        if (!active) return;
        setPayload({ items: [], pinned: [], sources: [] });
        setError(String(e?.message || "rss_unavailable"));
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [territory, topic, fromDate, toDate, officialOnly, refreshTick]);

  const items = React.useMemo(() => (Array.isArray(payload.items) ? payload.items : []), [payload.items]);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.summary || "",
        item.source || "",
        item.category || "",
        ...(item.tags || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const countryStats = React.useMemo(() => {
    const stats: Record<string, { label?: string; alerts: number; updates: number; total: number }> = {};

    for (const item of items) {
      const iso = normalizeTerritory(item.territory || item.zone || payload.territory || "WORLD");
      if (iso === "WORLD") continue;
      const current = stats[iso] || {
        label: territoryLabel(iso),
        alerts: 0,
        updates: 0,
        total: 0,
      };
      const importance = Number(item.importance || 0);
      if (importance >= 70) current.alerts += 1;
      else current.updates += 1;
      current.total += 1;
      stats[iso] = current;
    }

    return stats;
  }, [items, payload.territory]);

  const selectedStats = React.useMemo(() => {
    if (territory !== "WORLD" && countryStats[territory]) return countryStats[territory];
    return Object.values(countryStats).reduce(
      (acc, curr) => ({ alerts: acc.alerts + curr.alerts, updates: acc.updates + curr.updates, total: acc.total + curr.total }),
      { alerts: 0, updates: 0, total: 0 },
    );
  }, [countryStats, territory]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Centre veille reglementaire</p>
              <h1 className="mt-1 text-2xl font-semibold">Flux RSS officiels et signaux export</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Filtres pays, topic, date et mode officiel. Les sources permanentes restent actives.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  refreshKey.current += 1;
                  setRefreshTick(refreshKey.current);
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {(payload.pinned || []).map((name) => (
              <Badge key={`pinned-${name}`} variant="secondary">{name}</Badge>
            ))}
            {(payload.sources || []).slice(0, 8).map((name) => (
              <Badge key={`src-${name}`} variant="outline">{name}</Badge>
            ))}
            {payload.degraded ? <Badge variant="outline">Mode degrade</Badge> : null}
          </div>
        </section>

        <PanoramicControlTowerMap
          selectedCountry={territory === "WORLD" ? null : territory}
          selectedLabel={territoryLabel(territory)}
          stats={selectedStats}
          countryStats={countryStats}
          onCountrySelect={(iso) => setTerritory(iso)}
          onReset={() => setTerritory("WORLD")}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
            <CardDescription>Par defaut, seuls les liens officiels sont actifs.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1 md:col-span-2">
              <Label>Recherche</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titre, source, tag..." />
            </div>

            <div className="space-y-1">
              <Label>Topic</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  {TOPICS.map((it) => (
                    <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Du</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Au</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Mode officiel</Label>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Switch checked={officialOnly} onCheckedChange={setOfficialOnly} />
                <span className="text-xs text-muted-foreground">Liens officiels</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rss className="h-4 w-4" />
                Flux filtre ({filteredItems.length})
              </CardTitle>
              <CardDescription>
                Territoire: {territoryLabel(territory)}
                {payload.updatedAt ? ` - Mise a jour: ${formatDateTimeFr(payload.updatedAt)}` : ""}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
            ) : loading ? (
              <p className="text-sm text-muted-foreground">Chargement des flux...</p>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">Aucun item pour ces filtres.</div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const importance = Number(item.importance || 0);
                  const dateLabel = item.publishedAt ? formatDateTimeFr(item.publishedAt) : "Date inconnue";
                  return (
                    <div key={item.link} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{dateLabel}</div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Badge variant={importanceVariant(importance)}>Impact {importance}/100</Badge>
                          {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                          {item.official ? <Badge variant="secondary">Officiel</Badge> : null}
                        </div>
                      </div>

                      {item.summary ? <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {item.source ? <Badge variant="outline">{item.source}</Badge> : null}
                        {(item.tags || []).slice(0, 5).map((tag) => (
                          <Badge key={`${item.link}-${tag}`} variant="outline">#{tag}</Badge>
                        ))}
                        <span>{territoryLabel(normalizeTerritory(item.territory || item.zone || territory))}</span>
                      </div>

                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        Ouvrir la source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
