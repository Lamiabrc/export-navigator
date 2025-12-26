import React from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FilterChips } from "@/components/ui-kit/FilterChips";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { StatCard } from "@/components/ui-kit/StatCard";

import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { useProducts, type ProductRow } from "@/hooks/useProducts";

import { pricingConfig as mockPricingConfig, pricePoints as mockPricePoints } from "@/data/mockPricingData";
import { groupByProductMarketChannel } from "@/lib/pricingPositioning";
import type { Brand, PositionRow, PricePoint, PricingConfig, Product as PricingProduct } from "@/types/pricing";

import { Download, Filter, Rocket, Target } from "lucide-react";
import logoOrliman from "@/assets/logo-orliman.png";

type SortKey = "product" | "gapAvgPct" | "gapBestPct" | "positioning";
type SortDir = "asc" | "desc";

const brands: Brand[] = ["THUASNE", "DONJOY_ENOVIS", "GIBAUD"];

/**
 * Convertit une ligne Supabase "products" vers le type pricing minimal attendu
 */
const toPricingProduct = (p: ProductRow): PricingProduct => {
  const name = (p.libelle_article || p.code_article || "Produit").trim();

  // Catégorie : on prend un champ de classement utile, fallback sinon
  const category =
    (p.classement_groupe ||
      p.classement_produit_libelle ||
      p.classement_detail ||
      p.classement_sous_famille_code ||
      "Non classé") ?? "Non classé";

  return {
    id: p.id,
    name,
    category,
    // Optionnel : si ton type PricingProduct a d'autres champs, on les laisse absents
  } as PricingProduct;
};

const toCsv = (rows: PositionRow[]) => {
  if (!rows.length) return "";
  const headers = [
    "Produit",
    "Categorie",
    "Marche",
    "Canal",
    "Prix ORLIMAN",
    "Best concurrent",
    "Ecart best %",
    "Ecart moyenne %",
    "Positionnement",
    "Reco",
    "Confiance",
  ];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    const needsQuotes = s.includes(";") || s.includes("\n") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  const body = rows.map((r) =>
    [
      r.product.name,
      r.product.category,
      r.market,
      r.channel,
      r.orlimanPrice ?? "",
      r.bestCompetitor ? `${r.bestCompetitor.brand} ${r.bestCompetitor.price}` : "",
      r.gapBestPct?.toFixed(1) ?? "",
      r.gapAvgPct?.toFixed(1) ?? "",
      r.positioning,
      r.recommendation,
      r.confidenceCoverage,
    ]
      .map(escape)
      .join(";")
  );
  return [headers.join(";"), ...body].join("\n");
};

const colorForGap = (gap?: number) => {
  if (gap === undefined) return "bg-muted";
  if (gap > 12) return "bg-orange-200/60 text-orange-900";
  if (gap > 5) return "bg-orange-100/70 text-orange-800";
  if (gap < -8) return "bg-emerald-200/60 text-emerald-900";
  if (gap < -3) return "bg-emerald-100/70 text-emerald-800";
  return "bg-muted text-foreground";
};

const positioningBadge = (pos: PositionRow) => {
  if (pos.positioning === "premium") return <Badge className="bg-orange-100 text-orange-800">Premium</Badge>;
  if (pos.positioning === "underpriced") return <Badge className="bg-emerald-100 text-emerald-800">Sous marché</Badge>;
  if (pos.positioning === "aligned") return <Badge variant="outline">Aligné</Badge>;
  return <Badge variant="outline">Données manquantes</Badge>;
};

const brandCards: { brand: Brand; title: string; tone: string; desc: string; size?: "lg" | "sm" }[] = [
  { brand: "THUASNE", title: "Thuasne", tone: "from-sky-200/80 to-sky-400/60", desc: "Premium remboursement" },
  { brand: "DONJOY_ENOVIS", title: "DonJoy / Enovis", tone: "from-purple-200/80 to-purple-400/60", desc: "Sport + ortho" },
  { brand: "ORLIMAN", title: "ORLIMAN", tone: "from-orange-200/90 to-orange-500/80", desc: "Référence au centre", size: "lg" },
  { brand: "GIBAUD", title: "Gibaud", tone: "from-emerald-200/80 to-emerald-400/60", desc: "Retail remboursement" },
];

async function fetchSupabasePricePoints(): Promise<{ data: PricePoint[]; error?: string }> {
  if (!SUPABASE_ENV_OK) return { data: [], error: "Env Supabase manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)" };

  // ⚠️ Cette table peut ne pas exister encore : on gère le cas en fallback.
  const { data, error } = await supabase.from("price_points").select("*").limit(10000);

  if (error) {
    return { data: [], error: error.message };
  }

  // On cast en PricePoint : tu aligneras le schéma quand on crée la table.
  return { data: (data ?? []) as PricePoint[] };
}

export default function PricingPositioning() {
  // ✅ Produits réels (Supabase)
  const { products: sbProducts, isLoading: productsLoading, error: productsError } = useProducts({ pageSize: 1000 });

  // Price points (Supabase si dispo, sinon mock)
  const [sbPricePoints, setSbPricePoints] = React.useState<PricePoint[] | null>(null);
  const [ppError, setPpError] = React.useState<string>("");
  const [ppLoading, setPpLoading] = React.useState<boolean>(true);

  // Config (pour l’instant mock — on la mettra en DB plus tard)
  const [config] = React.useState<PricingConfig>(mockPricingConfig);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setPpLoading(true);
      const res = await fetchSupabasePricePoints();
      if (!mounted) return;

      if (res.error) {
        // fallback mock
        setPpError(res.error);
        setSbPricePoints(null);
      } else {
        setPpError("");
        setSbPricePoints(res.data);
      }
      setPpLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const pricingProducts = React.useMemo(() => sbProducts.map(toPricingProduct), [sbProducts]);

  const pricePoints: PricePoint[] = React.useMemo(() => {
    // si on a des PP Supabase => on les utilise
    if (sbPricePoints) return sbPricePoints;
    // sinon fallback mock
    return mockPricePoints as PricePoint[];
  }, [sbPricePoints]);

  const markets = React.useMemo(() => Array.from(new Set(pricePoints.map((p) => p.market))).sort(), [pricePoints]);
  const channels = React.useMemo(() => Array.from(new Set(pricePoints.map((p) => p.channel))).sort(), [pricePoints]);
  const categories = React.useMemo(
    () => Array.from(new Set(pricingProducts.map((p) => p.category))).sort(),
    [pricingProducts]
  );

  const [market, setMarket] = React.useState<string>("ALL");
  const [category, setCategory] = React.useState<string>("ALL");
  const [channel, setChannel] = React.useState<string>("ALL");
  const [brandFilters, setBrandFilters] = React.useState<Brand[]>(brands);
  const [minConfidence, setMinConfidence] = React.useState<number>(config.minConfidence);
  const [priceType, setPriceType] = React.useState<"ALL" | "HT" | "TTC">("ALL");
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("gapAvgPct");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [groupFilter, setGroupFilter] = React.useState<string>("");

  const filteredProducts = React.useMemo(
    () => (category === "ALL" ? pricingProducts : pricingProducts.filter((p) => p.category === category)),
    [category, pricingProducts]
  );

  const filteredPricePoints = React.useMemo(() => {
    return pricePoints.filter((pp) => {
      if (pp.confidence < minConfidence) return false;
      if (market !== "ALL" && pp.market !== market) return false;
      if (channel !== "ALL" && pp.channel !== channel) return false;
      if (groupFilter && !pp.channel.toLowerCase().includes(groupFilter.toLowerCase())) return false;
      if (priceType !== "ALL" && (pp as any).priceType !== priceType) return false;
      if (pp.brand !== "ORLIMAN" && brandFilters.length && !brandFilters.includes(pp.brand)) return false;
      return true;
    });
  }, [market, channel, priceType, minConfidence, brandFilters, groupFilter, pricePoints]);

  const rows = React.useMemo(() => {
    const baseRows = groupByProductMarketChannel(filteredProducts, filteredPricePoints, {
      ...config,
      minConfidence,
    });

    const searched = baseRows.filter((r) =>
      [r.product.name, r.product.category, r.market, r.channel].some((field) =>
        field.toLowerCase().includes(search.toLowerCase())
      )
    );

    const sorted = [...searched].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "product") return dir * a.product.name.localeCompare(b.product.name);
      if (sortKey === "positioning") return dir * a.positioning.localeCompare(b.positioning);
      if (sortKey === "gapBestPct") return dir * ((a.gapBestPct ?? 0) - (b.gapBestPct ?? 0));
      return dir * ((a.gapAvgPct ?? 0) - (b.gapAvgPct ?? 0));
    });

    return sorted;
  }, [filteredProducts, filteredPricePoints, config, minConfidence, search, sortKey, sortDir]);

  const kpi = React.useMemo(() => {
    const withComp = rows.filter((r) => r.avgCompetitorPrice && r.orlimanPrice);
    const priceIndex =
      withComp.length === 0
        ? 0
        : withComp.reduce((acc, r) => acc + (r.orlimanPrice! / r.avgCompetitorPrice!), 0) / withComp.length;

    const premium = rows.filter((r) => r.positioning === "premium").length;
    const under = rows.filter((r) => r.positioning === "underpriced").length;
    const coverage = rows.length === 0 ? 0 : Math.round((withComp.length / rows.length) * 100);

    return { priceIndex, premium, under, coverage };
  }, [rows]);

  const heatmap = React.useMemo(() => {
    const matrix: Record<string, Record<string, number | undefined>> = {};
    rows.forEach((r) => {
      const cat = r.product.category;
      matrix[cat] = matrix[cat] || {};
      matrix[cat][r.market] = r.gapAvgPct;
    });
    return matrix;
  }, [rows]);

  const toggleBrand = (b: Brand) => {
    setBrandFilters((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  };

  const exportCsv = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pricing_positioning_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const activeChips = [
    market !== "ALL" && { label: `Marché: ${market}`, onRemove: () => setMarket("ALL") },
    category !== "ALL" && { label: `Catégorie: ${category}`, onRemove: () => setCategory("ALL") },
    channel !== "ALL" && { label: `Canal: ${channel}`, onRemove: () => setChannel("ALL") },
    priceType !== "ALL" && { label: `Type: ${priceType}`, onRemove: () => setPriceType("ALL") },
    groupFilter && { label: `Groupement: ${groupFilter}`, onRemove: () => setGroupFilter("") },
  ].filter(Boolean) as { label: string; onRemove: () => void }[];

  return (
    <MainLayout>
      <TooltipProvider>
        <div className="space-y-6">
          <PageHeader
            title="Positionnement Tarification"
            subtitle="Comparer ORLIMAN vs Thuasne / DonJoy-Enovis / Gibaud par marché et canal."
            rightSlot={
              <>
                <Button variant="outline" className="gap-2" onClick={exportCsv}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
                <Link
                  to="/scenario-lab"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 hover:-translate-y-0.5 transition"
                >
                  <Rocket className="h-4 w-4" />
                  Créer un scénario
                </Link>
              </>
            }
          />

          {/* Status data */}
          <SectionCard
            title="Sources de données"
            icon="🧩"
            rightSlot={<p className="text-xs text-muted-foreground">Produits Supabase + Prix concurrence (Supabase si table dispo)</p>}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">Produits</div>
                <div className="text-xs text-muted-foreground">
                  {productsLoading ? "Chargement…" : productsError ? `Erreur: ${productsError}` : `${pricingProducts.length} produits (Supabase)`}
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">Price points</div>
                <div className="text-xs text-muted-foreground">
                  {ppLoading
                    ? "Chargement…"
                    : sbPricePoints
                    ? `${sbPricePoints.length} lignes (Supabase)`
                    : `${pricePoints.length} lignes (mock fallback)`}
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">Supabase</div>
                <div className="text-xs text-muted-foreground">
                  {SUPABASE_ENV_OK ? "OK" : "Env manquantes (l’app reste stable)"}{" "}
                  {ppError ? <span className="text-orange-700">— {ppError}</span> : null}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Panorama concurrence (ORLIMAN au centre)"
            icon="🧭"
            rightSlot={<p className="text-xs text-muted-foreground">Place des marques par rapport à ORLIMAN.</p>}
          >
            <div className="flex flex-wrap items-stretch justify-center gap-3">
              {brandCards.map((b) => (
                <div
                  key={b.brand}
                  className={`relative overflow-hidden rounded-2xl border border-border shadow-sm dark:border-white/10 ${
                    b.size === "lg" ? "w-64" : "w-44"
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${b.tone}`} />
                  <div className="relative z-10 p-4 space-y-2 text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-sm font-bold text-slate-900">
                        {b.brand === "ORLIMAN" ? (
                          <img src={logoOrliman} alt="ORLIMAN" className="h-6 w-auto" />
                        ) : (
                          b.title.charAt(0)
                        )}
                      </span>
                      <span className="text-sm font-semibold">{b.title}</span>
                    </div>
                    <p className="text-xs text-slate-900/80">{b.desc}</p>
                    {b.brand === "ORLIMAN" && (
                      <Badge variant="secondary" className="bg-white/70 text-slate-900 border-white">
                        Référence
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              title="Price Index ORLIMAN"
              value={kpi.priceIndex ? `${(kpi.priceIndex * 100).toFixed(0)} % vs moyenne` : "-"}
              subtitle=">100% = au-dessus de la moyenne concurrente"
              tone="info"
              icon="EUR"
            />
            <StatCard
              title="Lignes à risque prix"
              value={`${kpi.premium}`}
              subtitle="Produits au-dessus du marché"
              tone="warning"
              icon="!"
            />
            <StatCard
              title="Opportunités marge"
              value={`${kpi.under}`}
              subtitle="Produits sous-positionnés"
              tone="success"
              icon="▲"
            />
            <StatCard
              title="Couverture concurrence"
              value={`${kpi.coverage}%`}
              subtitle="Lignes avec au moins un concurrent"
              tone="neutral"
              icon="◎"
            />
          </div>

          <SectionCard
            title="Filtres"
            icon={<Filter className="h-5 w-5" />}
            rightSlot={
              <div className="flex items-center gap-2">
                <Badge variant="outline">Résultats: {rows.length}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMarket("ALL");
                    setCategory("ALL");
                    setChannel("ALL");
                    setBrandFilters(brands);
                    setMinConfidence(config.minConfidence);
                    setPriceType("ALL");
                    setSearch("");
                    setGroupFilter("");
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Marché</p>
                <Select value={market} onValueChange={setMarket}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    {markets.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Catégorie</p>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Canal</p>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous</SelectItem>
                    {channels.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Groupement</p>
                <Input
                  placeholder="Contient…"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Type prix</p>
                <Select value={priceType} onValueChange={(v) => setPriceType(v as "ALL" | "HT" | "TTC")}>
                  <SelectTrigger>
                    <SelectValue placeholder="HT/TTC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">HT + TTC</SelectItem>
                    <SelectItem value="HT">HT</SelectItem>
                    <SelectItem value="TTC">TTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Min. confiance</p>
                <Input
                  type="number"
                  min={50}
                  max={100}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(Number(e.target.value))}
                />
              </div>

              <div className="lg:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Concurrents</p>
                <div className="flex gap-2 flex-wrap">
                  {brands.map((b) => (
                    <Button
                      key={b}
                      variant={brandFilters.includes(b) ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => toggleBrand(b)}
                    >
                      {b.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <FilterChips chips={activeChips} />
            </div>
          </SectionCard>

          <SectionCard
            title="Heatmap catégorie x marché"
            icon="Heatmap"
            rightSlot={<p className="text-xs text-muted-foreground">Couleur = écart vs moyenne concurrente</p>}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    {markets.map((m) => (
                      <TableHead key={m}>{m}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat}>
                      <TableCell className="font-semibold">{cat}</TableCell>
                      {markets.map((m) => {
                        const gap = heatmap[cat]?.[m];
                        return (
                          <TableCell key={`${cat}-${m}`}>
                            <div className={`rounded-lg px-2 py-1 text-xs text-center ${colorForGap(gap)}`}>
                              {gap !== undefined ? `${gap.toFixed(1)}%` : "-"}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>

          <SectionCard
            title="Détails par produit"
            icon={<Target className="h-5 w-5" />}
            rightSlot={
              <div className="flex items-center gap-2 text-xs">
                <span>Tri</span>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gapAvgPct">Écart moyenne</SelectItem>
                    <SelectItem value="gapBestPct">Écart best</SelectItem>
                    <SelectItem value="product">Produit</SelectItem>
                    <SelectItem value="positioning">Position</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
                  {sortDir === "asc" ? "↑" : "↓"}
                </Button>
                <Input
                  placeholder="Rechercher produit..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-48"
                />
              </div>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Marché</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Prix ORLIMAN</TableHead>
                    <TableHead>Best concurrent</TableHead>
                    <TableHead>Écart best %</TableHead>
                    <TableHead>Écart moyenne %</TableHead>
                    <TableHead>Positionnement</TableHead>
                    <TableHead>Reco</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                        Aucune ligne avec ces filtres.
                      </TableCell>
                    </TableRow>
                  )}

                  {rows.map((r) => (
                    <TableRow key={`${r.product.id}-${r.market}-${r.channel}`}>
                      <TableCell className="font-semibold">{r.product.name}</TableCell>
                      <TableCell>{r.product.category}</TableCell>
                      <TableCell>{r.market}</TableCell>
                      <TableCell>{r.channel}</TableCell>
                      <TableCell className="font-semibold">{r.orlimanPrice ? `${r.orlimanPrice} €` : "-"}</TableCell>
                      <TableCell>
                        {r.bestCompetitor ? (
                          <div className="flex flex-col text-sm">
                            <span className="font-medium">{r.bestCompetitor.brand}</span>
                            <span className="text-muted-foreground">{r.bestCompetitor.price} €</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{r.gapBestPct !== undefined ? `${r.gapBestPct.toFixed(1)}%` : "-"}</TableCell>
                      <TableCell>{r.gapAvgPct !== undefined ? `${r.gapAvgPct.toFixed(1)}%` : "-"}</TableCell>
                      <TableCell>{positioningBadge(r)}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-default">
                              {r.recommendation}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{r.recommendationHint}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/scenario-lab?productId=${r.product.id}&market=${r.market}${
                              r.bestCompetitor ? `&targetPrice=${r.bestCompetitor.price}` : ""
                            }`}
                            className="text-sm text-primary hover:underline"
                          >
                            Scénario
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}
