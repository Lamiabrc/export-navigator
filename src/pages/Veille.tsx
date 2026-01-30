import React from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { ImpactLevel, RssFeedSource, RssItem } from "@/lib/rss/types";
import { DEFAULT_FEEDS } from "@/lib/rss/feeds";

const IMPACT_LABELS: Record<ImpactLevel, string> = {
  LOW: "Low",
  MED: "Med",
  HIGH: "High",
};

const IMPACT_STYLES: Record<ImpactLevel, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MED: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-rose-50 text-rose-700 border-rose-200",
};

type WatchPrefs = {
  countries: string[];
  themes: string[];
  sources: string[];
};

const EMPTY_PREFS: WatchPrefs = {
  countries: [],
  themes: [],
  sources: [],
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function normalizeText(value: string) {
  return value.toLowerCase();
}

export default function Veille() {
  const [items, setItems] = React.useState<RssItem[]>([]);
  const [sources, setSources] = React.useState<RssFeedSource[]>(DEFAULT_FEEDS);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [impactFilter, setImpactFilter] = React.useState<ImpactLevel | "ALL">("ALL");
  const [sourceFilters, setSourceFilters] = React.useState<string[]>([]);
  const [themeFilters, setThemeFilters] = React.useState<string[]>([]);

  const { value: prefs, setValue: setPrefs } = useLocalStorage<WatchPrefs>(
    "mpl_watch_prefs",
    EMPTY_PREFS
  );
  const [useMyWatch, setUseMyWatch] = React.useState(false);
  const [countryInput, setCountryInput] = React.useState("");

  const limit = 40;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rss?limit=${limit}&offset=${offset}`);
      const payload = await response.json();

      if (!payload.ok) {
        throw new Error(payload.error || "Impossible de charger la veille");
      }

      const data = payload.data as { items: RssItem[]; total: number; sources: RssFeedSource[] };

      setSources(data.sources?.length ? data.sources : DEFAULT_FEEDS);
      setTotal(data.total ?? 0);

      setItems((prev) => {
        if (offset === 0) return data.items;
        const existing = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        data.items.forEach((item) => {
          if (!existing.has(item.id)) merged.push(item);
        });
        return merged;
      });
    } catch (err: any) {
      setError(err?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const availableTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach((item) => item.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [items]);

  const activeSources = useMyWatch && prefs.sources.length ? prefs.sources : sourceFilters;
  const activeThemes = useMyWatch && prefs.themes.length ? prefs.themes : themeFilters;
  const activeCountries = useMyWatch ? prefs.countries : [];

  const filteredItems = React.useMemo(() => {
    const query = normalizeText(search.trim());
    return items.filter((item) => {
      const inSource = activeSources.length === 0 || activeSources.includes(item.sourceName);
      const inImpact = impactFilter === "ALL" || item.impact === impactFilter;
      const inTheme = activeThemes.length === 0 || activeThemes.some((theme) => item.tags.includes(theme));

      const haystack = normalizeText(`${item.title} ${item.summary}`);
      const inSearch = !query || haystack.includes(query);

      const inCountry =
        activeCountries.length === 0 ||
        activeCountries.some((country) => haystack.includes(normalizeText(country)));

      return inSource && inImpact && inTheme && inSearch && inCountry;
    });
  }, [items, activeSources, activeThemes, impactFilter, search, activeCountries]);

  const hasMore = items.length < total;

  return (
    <PublicLayout>
      <div className="space-y-10">
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Veille export</p>
          <h1 className="text-4xl font-semibold text-white">Decisions plus rapides avec une veille priorisee.</h1>
          <p className="text-lg text-slate-200">
            Tous les flux sont agreges cote serveur, filtres et scores pour mettre en avant l'impact metier.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => (window.location.href = "/analyse")}>Analyser un export</Button>
            <Button
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => (window.location.href = "/contact")}
            >
              Demander un audit export
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-lg backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Filtres rapides</h2>
              <p className="text-sm text-slate-200">Sources, themes, impact et recherche texte.</p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="my-watch">Mode Ma veille</Label>
              <Switch id="my-watch" checked={useMyWatch} onCheckedChange={setUseMyWatch} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Recherche</Label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mot-cle, pays, mesure..."
              />
            </div>

            <div className="space-y-2">
              <Label>Impact</Label>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "LOW", "MED", "HIGH"] as const).map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={impactFilter === level ? "default" : "outline"}
                    className={cn(level !== "ALL" && "bg-white/5 text-white")}
                    onClick={() => setImpactFilter(level)}
                  >
                    {level === "ALL" ? "Tous" : IMPACT_LABELS[level]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sources</Label>
              <div className="flex flex-wrap gap-2">
                {sources.map((source) => (
                  <Button
                    key={source.id}
                    type="button"
                    variant={activeSources.includes(source.name) ? "default" : "outline"}
                    onClick={() => setSourceFilters((prev) => toggleValue(prev, source.name))}
                  >
                    {source.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator className="my-6 bg-white/10" />

          <div className="space-y-3">
            <Label>Themes</Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.length === 0 && (
                <p className="text-sm text-slate-200">Les themes s'affichent des la premiere collecte.</p>
              )}
              {availableTags.map((tag) => (
                <Badge
                  key={tag}
                  onClick={() => setThemeFilters((prev) => toggleValue(prev, tag))}
                  className={cn(
                    "cursor-pointer border",
                    activeThemes.includes(tag)
                      ? "bg-white text-blue-900"
                      : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                  )}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-lg backdrop-blur">
          <h2 className="text-xl font-semibold">Ma veille</h2>
          <p className="text-sm text-slate-200">
            Ajoutez vos pays et themes preferes. Ils sont stockes localement dans votre navigateur.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Pays suivis (separes par une virgule)</Label>
              <div className="flex gap-2">
                <Input
                  value={countryInput}
                  onChange={(event) => setCountryInput(event.target.value)}
                  placeholder="France, Allemagne, Maroc"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const countries = countryInput
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean);
                    if (!countries.length) return;
                    setPrefs((prev) => ({
                      ...prev,
                      countries: Array.from(new Set([...prev.countries, ...countries])),
                    }));
                    setCountryInput("");
                  }}
                >
                  Ajouter
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {prefs.countries.map((country) => (
                  <Badge
                    key={country}
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        countries: prev.countries.filter((item) => item !== country),
                      }))
                    }
                    className="cursor-pointer bg-white/10 text-white border-white/20 hover:bg-white/20"
                  >
                    {country}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Themes preferes</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        themes: toggleValue(prev.themes, tag),
                      }))
                    }
                    className={cn(
                      "cursor-pointer border",
                      prefs.themes.includes(tag)
                        ? "bg-white text-blue-900"
                        : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                    )}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Flux recents</h2>
            <Badge className="bg-white/10 text-white border-white/20">{filteredItems.length} articles</Badge>
          </div>

          {error && <p className="text-sm text-rose-200">{error}</p>}

          <div className="grid gap-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className="bg-white/10 border-white/10 text-white">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("border", IMPACT_STYLES[item.impact])}>{IMPACT_LABELS[item.impact]}</Badge>
                    <Badge className="bg-white/10 text-white border-white/20">{item.sourceName}</Badge>
                    <span className="text-xs text-slate-200">
                      {new Date(item.pubDate).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="text-slate-200">{item.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Pourquoi</p>
                    <ul className="text-sm text-slate-200 list-disc pl-5">
                      {item.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <Badge key={tag} className="bg-white/10 text-white border-white/20">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <a href={item.link} target="_blank" rel="noreferrer">
                        Lire la source
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white text-white hover:bg-white/10"
                      asChild
                    >
                      <a href="/contact">Demander un audit</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {loading && <p className="text-sm text-slate-200">Chargement des flux...</p>}
            {!loading && filteredItems.length === 0 && (
              <p className="text-sm text-slate-200">Aucun resultat avec les filtres actuels.</p>
            )}
          </div>

          <div className="flex justify-center">
            {hasMore && (
              <Button
                variant="outline"
                className="border-white text-white hover:bg-white/10"
                onClick={() => setOffset((prev) => prev + limit)}
                disabled={loading}
              >
                Charger plus
              </Button>
            )}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
