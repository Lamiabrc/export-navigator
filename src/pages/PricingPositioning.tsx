import React from "react";
import { Link } from "react-router-dom";
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
import { pricingConfig, pricePoints, products } from "@/data/mockPricingData";
import { groupByProductMarketChannel } from "@/lib/pricingPositioning";
import type { Brand, PositionRow } from "@/types/pricing";
import { Download, Filter, Rocket, Target } from "lucide-react";

type SortKey = "product" | "gapAvgPct" | "gapBestPct" | "positioning";
type SortDir = "asc" | "desc";

const brands: Brand[] = ["THUASNE", "DONJOY_ENOVIS", "GIBAUD"];
const markets = Array.from(new Set(pricePoints.map((p) => p.market))).sort();
const channels = Array.from(new Set(pricePoints.map((p) => p.channel))).sort();
const categories = Array.from(new Set(products.map((p) => p.category))).sort();

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

export default function PricingPositioning() {
  const [market, setMarket] = React.useState<string>("ALL");
  const [category, setCategory] = React.useState<string>("ALL");
  const [channel, setChannel] = React.useState<string>("ALL");
  const [brandFilters, setBrandFilters] = React.useState<Brand[]>(brands);
  const [minConfidence, setMinConfidence] = React.useState<number>(pricingConfig.minConfidence);
  const [priceType, setPriceType] = React.useState<"ALL" | "HT" | "TTC">("ALL");
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("gapAvgPct");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const filteredProducts = React.useMemo(
    () => (category === "ALL" ? products : products.filter((p) => p.category === category)),
    [category]
  );

  const filteredPricePoints = React.useMemo(() => {
    return pricePoints.filter((pp) => {
      if (pp.confidence < minConfidence) return false;
      if (market !== "ALL" && pp.market !== market) return false;
      if (channel !== "ALL" && pp.channel !== channel) return false;
      if (priceType !== "ALL" && pp.priceType !== priceType) return false;
      if (pp.brand !== "ORLIMAN" && brandFilters.length && !brandFilters.includes(pp.brand)) return false;
      return true;
    });
  }, [market, channel, priceType, minConfidence, brandFilters]);

  const rows = React.useMemo(() => {
    const baseRows = groupByProductMarketChannel(filteredProducts, filteredPricePoints, {
      ...pricingConfig,
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
  }, [filteredProducts, filteredPricePoints, minConfidence, search, sortKey, sortDir]);

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
  ].filter(Boolean) as { label: string; onRemove: () => void }[];

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title="Positionnement Tarification 💡"
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            title="Price Index ORLIMAN"
            value={kpi.priceIndex ? `${(kpi.priceIndex * 100).toFixed(0)} % vs moyenne` : "—"}
            subtitle=">100% = au-dessus de la moyenne concurrente"
            tone="info"
            icon="💶"
          />
          <StatCard
            title="% à risque prix"
            value={`${kpi.premium}`}
            subtitle="Produits au-dessus du marché"
            tone="warning"
            icon="⚠️"
          />
          <StatCard
            title="Opportunités marge"
            value={`${kpi.under}`}
            subtitle="Produits sous-positionnés (remonter prix)"
            tone="success"
            icon="📈"
          />
          <StatCard
            title="Couverture concurrence"
            value={`${kpi.coverage}%`}
            subtitle="Lignes avec au moins un concurrent"
            tone="neutral"
            icon="🛰️"
          />
        </div>

        <SectionCard
          title="Filtres"
          icon={<Filter className="h-5 w-5" />}
          rightSlot={
            <div className="flex items-center gap-2">
              <Badge variant="outline">Résultats: {rows.length}</Badge>
              <Button variant="ghost" size="sm" onClick={() => {
                setMarket("ALL"); setCategory("ALL"); setChannel("ALL"); setBrandFilters(brands); setMinConfidence(pricingConfig.minConfidence); setPriceType("ALL"); setSearch("");
              }}>
                Réinitialiser
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Marché</p>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Catégorie</p>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Canal</p>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  {channels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type prix</p>
              <Select value={priceType} onValueChange={(v) => setPriceType(v as "ALL" | "HT" | "TTC")}>
                <SelectTrigger><SelectValue placeholder="HT/TTC" /></SelectTrigger>
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
            <div>
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
          icon="🌡️"
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
                            {gap !== undefined ? `${gap.toFixed(1)}%` : "—"}
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
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gapAvgPct">Ecart moyenne</SelectItem>
                  <SelectItem value="gapBestPct">Ecart best</SelectItem>
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
                  <TableHead>Ecart best %</TableHead>
                  <TableHead>Ecart moyenne %</TableHead>
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
                    <TableCell className="font-semibold">{r.orlimanPrice ? `${r.orlimanPrice} €` : "—"}</TableCell>
                    <TableCell>
                      {r.bestCompetitor ? (
                        <div className="flex flex-col text-sm">
                          <span className="font-medium">{r.bestCompetitor.brand}</span>
                          <span className="text-muted-foreground">{r.bestCompetitor.price} €</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>{r.gapBestPct !== undefined ? `${r.gapBestPct.toFixed(1)}%` : "—"}</TableCell>
                    <TableCell>{r.gapAvgPct !== undefined ? `${r.gapAvgPct.toFixed(1)}%` : "—"}</TableCell>
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
  );
}
