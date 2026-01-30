import React from "react";
import { useNavigate } from "react-router-dom";
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
import { Bookmark, BookmarkCheck } from "lucide-react";

const IMPACT_LABELS: Record<ImpactLevel, string> = {
  LOW: "Faible",
  MED: "Moyen",
  HIGH: "Élevé",
};

const IMPACT_STYLES: Record<ImpactLevel, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MED: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-rose-50 text-rose-700 border-rose-200",
};

const THEME_PRESETS = ["Douanes", "TVA", "Sanctions", "Transport", "Accords"];
const SECTOR_PRESETS = ["Agroalimentaire", "Industrie", "Cosmétique", "Pharma", "Tech", "Services"];

const INPUT_CLASSES = "bg-slate-950/70 border-white/10 text-slate-100 placeholder:text-slate-400";

type WatchPrefs = {
  countries: string[];
  themes: string[];
  sources: string[];
};

type BriefSource = {
  id: string;
  title: string;
  link: string;
  sourceName: string;
  pubDate: string;
  impact: string;
};

type BriefData = {
  summary: string;
  sources: BriefSource[];
  createdAt: string;
  model: string;
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
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function Veille() {
  const navigate = useNavigate();

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

  const { value: prefs, setValue: setPrefs } = useLocalStorage<WatchPrefs>("mpl_watch_prefs", EMPTY_PREFS);
  const { value: savedIds, setValue: setSavedIds } = useLocalStorage<string[]>("mpl_saved_watch", []);

  const [useMyWatch, setUseMyWatch] = React.useState(false);
  const [countryInput, setCountryInput] = React.useState("");

  const [sector, setSector] = React.useState("");
  const [product, setProduct] = React.useState("");
  const [destination, setDestination] = React.useState("");

  const [briefData, setBriefData] = React.useState<BriefData | null>(null);
  const [briefLoading, setBriefLoading] = React.useState(false);
  const [briefError, setBriefError] = React.useState<string | null>(null);

  const limit = 40;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rss?limit=${limit}&offset=${offset}`);
      const payload = await response.json().catch(() => ({}));

      if (!payload?.ok) {
        throw new Error(payload?.error || "Impossible de charger la veille");
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

  const refresh = React.useCallback(() => {
    if (offset !== 0) setOffset(0);
    else void load();
  }, [offset, load]);

  const availableTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach((item) => item.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
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

      const haystack = normalizeText(`${item.title} ${item.summary} ${item.tags.join(" ")} ${item.sourceName}`);
      const inSearch = !query || haystack.includes(query);

      const inCountry =
        activeCountries.length === 0 ||
        activeCountries.some((country) => haystack.includes(normalizeText(country)));

      return inSource && inImpact && inTheme && inSearch && inCountry;
    });
  }, [items, activeSources, activeThemes, impactFilter, search, activeCountries]);

  const topImpactItems = React.useMemo(
    () => filteredItems.filter((item) => item.impact === "HIGH").slice(0, 10),
    [filteredItems]
  );

  const hasMore = items.length < total;
  const showEmptyState = !loading && filteredItems.length === 0 && !error;

  const toggleSaved = React.useCallback(
    (id: string) => {
      setSavedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    },
    [setSavedIds]
  );

  const applyOperationToFilters = () => {
    const parts = [sector, product, destination].filter(Boolean).join(" ");
    if (parts) setSearch(parts);

    if (destination) {
      setPrefs((prev) => ({
        ...prev,
        countries: Array.from(new Set([...prev.countries, destination])),
      }));
    }
  };

  const generateBrief = async () => {
    setBriefLoading(true);
    setBriefError(null);
    try {
      const params = new URLSearchParams();
      if (sector) params.set("sector", sector);
      if (product) params.set("product", product);
      if (destination) params.set("destination", destination);

      const res = await fetch(`/api/brief?${params.toString()}`);
      const payload = await res.json().catch(() => ({}));

      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Impossible de générer le brief");
      }

      setBriefData(payload.data as BriefData);
    } catch (err: any) {
      setBriefError(err?.message || "Erreur de génération");
    } finally {
      setBriefLoading(false);
    }
  };

  const SkeletonCard = () => (
    <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5 shadow-lg backdrop-blur-md">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="mt-3 h-6 w-3/4 rounded bg-white/10" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-5/6 rounded bg-white/10" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-28 rounded bg-white/10" />
        <div className="h-8 w-32 rounded bg-white/10" />
      </div>
    </div>
  );

  return (
    <PublicLayout>
      <div className="space-y-10">
        {/* Hero lisible */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-6 text-white md:p-10">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-blue-200">Veille export</p>
            <h1 className="text-4xl font-semibold">Décisions plus rapides avec une veille priorisée.</h1>
            <p className="text-lg text-slate-200">
              Les flux sont agrégés côté serveur, filtrés et scorés pour faire ressortir l’impact opérationnel.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/analyse")}>Analyser un export</Button>
              <Button
                variant="outline"
                className="border-white/20 text-slate-100 hover:bg-white/10"
                onClick={() => navigate("/contact?offer=audit")}
              >
                Demander un audit export
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-lg backdrop-blur-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Votre opération export</h2>
              <p className="text-sm text-slate-200">Choisissez un secteur, un produit et un pays pour cibler la veille.</p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="my-watch" className="text-slate-200">
                Mode Ma veille
              </Label>
              <Switch id="my-watch" checked={useMyWatch} onCheckedChange={setUseMyWatch} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-slate-200">Secteur</Label>
              <div className="flex flex-wrap gap-2">
                {SECTOR_PRESETS.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant="outline"
                    className={cn(
                      "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10",
                      sector === item && "bg-white/15 text-white"
                    )}
                    onClick={() => setSector(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Produit</Label>
              <Input
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder="Ex : pièces mécaniques"
                className={INPUT_CLASSES}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Pays de destination</Label>
              <Input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Ex : Allemagne"
                className={INPUT_CLASSES}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-white/20 text-slate-100 hover:bg-white/10"
              onClick={applyOperationToFilters}
            >
              Appliquer aux filtres
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-slate-100 hover:bg-white/10"
              onClick={() => setSearch("")}
            >
              Réinitialiser la recherche
            </Button>
            <Button onClick={generateBrief} disabled={briefLoading}>
              {briefLoading ? "Génération..." : "Générer un brief actionnable"}
            </Button>
          </div>

          <Separator className="my-6 bg-white/10" />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-slate-200">Recherche</Label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mot-clé, pays, mesure..."
                className={INPUT_CLASSES}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Impact</Label>
              <div className="flex flex-wrap gap-2">
                {(["ALL", "LOW", "MED", "HIGH"] as const).map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={impactFilter === level ? "default" : "outline"}
                    className={cn("text-slate-100", impactFilter !== level && "border-white/20 hover:bg-white/10")}
                    onClick={() => setImpactFilter(level)}
                  >
                    {level === "ALL" ? "Tous" : IMPACT_LABELS[level]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Sources</Label>
              <div className="flex flex-wrap gap-2">
                {sources.map((source) => {
                  const selected = activeSources.includes(source.name);
                  return (
                    <Button
                      key={source.id}
                      type="button"
                      variant="outline"
                      className={cn(
                        "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10",
                        selected && "bg-white/15 text-white"
                      )}
                      onClick={() => {
                        if (useMyWatch) {
                          setPrefs((prev) => ({ ...prev, sources: toggleValue(prev.sources, source.name) }));
                        } else {
                          setSourceFilters((prev) => toggleValue(prev, source.name));
                        }
                      }}
                    >
                      {source.name}
                    </Button>
                  );
                })}
              </div>
              {useMyWatch && (
                <div className="text-xs text-white/70">
                  En mode “Ma veille”, tes sources sélectionnées sont sauvegardées dans ton navigateur.
                </div>
              )}
            </div>
          </div>

          <Separator className="my-6 bg-white/10" />

          <div className="space-y-3">
            <Label className="text-slate-200">Thèmes</Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.length === 0 && (
                <p className="text-sm text-slate-300">Les thèmes s’affichent dès la première collecte.</p>
              )}
              {availableTags.map((tag) => (
                <Badge
                  key={tag}
                  onClick={() => {
                    if (useMyWatch) {
                      setPrefs((prev) => ({ ...prev, themes: toggleValue(prev.themes, tag) }));
                    } else {
                      setThemeFilters((prev) => toggleValue(prev, tag));
                    }
                  }}
                  className={cn(
                    "cursor-pointer border bg-white/5 text-slate-100 border-white/15 hover:bg-white/10",
                    activeThemes.includes(tag) && "bg-white/15 text-white"
                  )}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-slate-200">
            <div className="text-sm font-semibold text-white">Infos de base</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>Vérifier la classification douanière du produit.</li>
              <li>Confirmer les documents requis (facture, origine, transport).</li>
              <li>Rappeler : droits & TVA peuvent varier selon l’origine, l’accord, et la base taxable.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-slate-200">
            <div className="text-sm font-semibold text-white">Risques à surveiller</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>Incoterm et répartition des risques/coûts.</li>
              <li>Sanctions, contrôles export, restrictions sectorielles.</li>
              <li>Délais et congestion transport.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-slate-200">
            <div className="text-sm font-semibold text-white">Prochaine étape</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              <li>Estimer le coût complet pour {destination || "votre destination"}.</li>
              <li>Comparer 2–3 scénarios (incoterms, modes).</li>
              <li>Demander un audit pour valider la stratégie.</li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-white shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Brief actionnable</h2>
              <p className="text-sm text-slate-200">
                Synthèse basée sur des sources récentes. Ajoute tes critères avant de générer.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate("/analyse")}>Estimer les coûts</Button>
              <Button
                variant="outline"
                className="border-white/20 text-slate-100 hover:bg-white/10"
                onClick={() => navigate("/contact?offer=audit")}
              >
                Être accompagné par MPL
              </Button>
            </div>
          </div>

          {briefError && (
            <div className="mt-4 rounded-lg border border-rose-200/20 bg-rose-950/40 p-4 text-rose-100">
              {briefError}
            </div>
          )}

          {!briefError && !briefData && (
            <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
              Clique sur “Générer un brief actionnable” pour obtenir une synthèse actualisée.
            </div>
          )}

          {briefData && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-200 whitespace-pre-line">
                {briefData.summary}
              </div>
              <div className="text-xs text-slate-400">
                Généré le {new Date(briefData.createdAt).toLocaleString("fr-FR")} via {briefData.model}.
              </div>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">Sources utilisées</div>
                <div className="grid gap-2">
                  {briefData.sources.map((source) => (
                    <a
                      key={source.id}
                      href={source.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200 hover:bg-white/5"
                    >
                      <div className="font-semibold text-white">{source.title}</div>
                      <div className="text-xs text-slate-400">
                        {source.sourceName} • {new Date(source.pubDate).toLocaleDateString("fr-FR")} • {source.impact}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Top impacts (Élevé)</h2>
            <Badge className="bg-white/5 text-slate-100 border-white/15">{topImpactItems.length} items</Badge>
          </div>

          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonCard key={`top-skeleton-${index}`} />
              ))}
            </div>
          )}

          {!loading && topImpactItems.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-6 text-slate-200 backdrop-blur-md">
              Aucun item “impact élevé” pour le moment.
            </div>
          )}

          {!loading && topImpactItems.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {topImpactItems.map((item) => (
                <Card key={item.id} className="bg-slate-950/70 border-white/10 text-white backdrop-blur-md">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("border", IMPACT_STYLES[item.impact])}>
                        {IMPACT_LABELS[item.impact]}
                      </Badge>
                      <Badge className="bg-white/5 text-slate-100 border-white/15">{item.sourceName}</Badge>
                      <span className="text-xs text-slate-300">
                        {new Date(item.pubDate).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>

                      <button
                        type="button"
                        className="ml-auto inline-flex items-center justify-center rounded-md p-2 text-slate-100 hover:bg-white/10 hover:text-white"
                        onClick={() => toggleSaved(item.id)}
                        aria-label={savedIds.includes(item.id) ? "Retirer des sauvegardes" : "Sauvegarder"}
                      >
                        {savedIds.includes(item.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                      </button>
                    </div>

                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription className="text-slate-200 line-clamp-3">{item.summary}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-200">Pourquoi</p>
                      <ul className="text-sm text-slate-300 list-disc pl-5">
                        {item.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Badge key={tag} className="bg-white/5 text-slate-100 border-white/15">
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
                        className="border-white/20 text-slate-100 hover:bg-white/10"
                        onClick={() => navigate("/contact?offer=audit")}
                      >
                        Demander un audit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-white shadow-lg backdrop-blur-md">
          <h2 className="text-xl font-semibold">Ma veille</h2>
          <p className="text-sm text-slate-200">
            Ajoute tes pays, thèmes et sources préférés. Tout est stocké localement dans ton navigateur.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-200">Pays suivis (séparés par une virgule)</Label>
              <div className="flex gap-2">
                <Input
                  value={countryInput}
                  onChange={(event) => setCountryInput(event.target.value)}
                  placeholder="France, Allemagne, Maroc"
                  className={INPUT_CLASSES}
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
                    className="cursor-pointer bg-white/5 text-slate-100 border-white/15 hover:bg-white/10"
                  >
                    {country}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Thèmes préférés</Label>
              <div className="flex flex-wrap gap-2">
                {THEME_PRESETS.map((tag) => (
                  <Badge
                    key={tag}
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        themes: toggleValue(prev.themes, tag),
                      }))
                    }
                    className={cn(
                      "cursor-pointer border bg-white/5 text-slate-100 border-white/15 hover:bg-white/10",
                      prefs.themes.includes(tag) && "bg-white/15 text-white"
                    )}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              <Separator className="my-4 bg-white/10" />

              <Label className="text-slate-200">Sources préférées</Label>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <Badge
                    key={s.id}
                    onClick={() =>
                      setPrefs((prev) => ({
                        ...prev,
                        sources: toggleValue(prev.sources, s.name),
                      }))
                    }
                    className={cn(
                      "cursor-pointer border bg-white/5 text-slate-100 border-white/15 hover:bg-white/10",
                      prefs.sources.includes(s.name) && "bg-white/15 text-white"
                    )}
                  >
                    {s.name}
                  </Badge>
                ))}
              </div>

              <div className="mt-3">
                <Button
                  variant="outline"
                  className="border-white/20 text-slate-100 hover:bg-white/10"
                  onClick={() => setPrefs(EMPTY_PREFS)}
                >
                  Réinitialiser “Ma veille”
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Flux récents</h2>
            <Badge className="bg-white/5 text-slate-100 border-white/15">{filteredItems.length} articles</Badge>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200/20 bg-rose-950/40 p-4 text-rose-100">
              <p className="text-sm">{error}</p>
              <Button
                variant="outline"
                className="mt-3 border-rose-200/40 text-rose-100 hover:bg-white/10"
                onClick={refresh}
              >
                Réessayer
              </Button>
            </div>
          )}

          {showEmptyState && (
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-6 text-slate-200 backdrop-blur-md">
              <p className="text-sm">Aucun résultat avec les filtres actuels.</p>
              <Button
                variant="outline"
                className="mt-3 border-white/20 text-slate-100 hover:bg-white/10"
                onClick={refresh}
              >
                Rafraîchir
              </Button>
            </div>
          )}

          {loading && (
            <div className="grid gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={`list-skeleton-${index}`} />
              ))}
            </div>
          )}

          {!loading && filteredItems.length > 0 && (
            <div className="grid gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="bg-slate-950/70 border-white/10 text-white backdrop-blur-md">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("border", IMPACT_STYLES[item.impact])}>
                        {IMPACT_LABELS[item.impact]}
                      </Badge>
                      <Badge className="bg-white/5 text-slate-100 border-white/15">{item.sourceName}</Badge>
                      <span className="text-xs text-slate-300">
                        {new Date(item.pubDate).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>

                      <button
                        type="button"
                        className="ml-auto inline-flex items-center justify-center rounded-md p-2 text-slate-100 hover:bg-white/10 hover:text-white"
                        onClick={() => toggleSaved(item.id)}
                        aria-label={savedIds.includes(item.id) ? "Retirer des sauvegardes" : "Sauvegarder"}
                      >
                        {savedIds.includes(item.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                      </button>
                    </div>

                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription className="text-slate-200 line-clamp-3">{item.summary}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-200">Pourquoi</p>
                      <ul className="text-sm text-slate-300 list-disc pl-5">
                        {item.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Badge key={tag} className="bg-white/5 text-slate-100 border-white/15">
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
                        className="border-white/20 text-slate-100 hover:bg-white/10"
                        onClick={() => navigate("/contact?offer=audit")}
                      >
                        Demander un audit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            {hasMore && !loading && (
              <Button
                variant="outline"
                className="border-white/20 text-slate-100 hover:bg-white/10"
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
