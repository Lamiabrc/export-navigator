import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import {
  ArrowDownUp,
  BarChart3,
  FileUp,
  Filter,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

type PriceObs = {
  competitor: string;
  product: string;
  market: string;
  incoterm: string;
  price: number;
  currency: string;
  date: string;
  source: string;
  reliability: "High" | "Medium" | "Low";
};

type OurPrice = {
  product: string;
  market: string;
  incoterm: string;
  floor: number;
  target: number;
  list: number;
  currency: string;
  strategy: "Premium" | "Align" | "Penetration";
};

type PositioningPoint = {
  name: string;
  type: "us" | "competitor";
  priceIndex: number; // 60..140
  valueScore: number; // 0..100
};

const mockCompetitorPrices: PriceObs[] = [
  {
    competitor: "DonJoy",
    product: "Genou – Attelle X",
    market: "FR",
    incoterm: "DAP",
    price: 119,
    currency: "EUR",
    date: "2025-12-20",
    source: "Catalogue revendeur",
    reliability: "High",
  },
  {
    competitor: "Gibaud",
    product: "Cheville – Orthèse Y",
    market: "FR",
    incoterm: "DAP",
    price: 44,
    currency: "EUR",
    date: "2025-12-18",
    source: "E-shop",
    reliability: "Medium",
  },
  {
    competitor: "AT",
    product: "Poignet – Support Z",
    market: "DE",
    incoterm: "DDP",
    price: 29,
    currency: "EUR",
    date: "2025-12-12",
    source: "Annonce",
    reliability: "Low",
  },
];

const mockOurPrices: OurPrice[] = [
  {
    product: "Genou – Attelle X",
    market: "FR",
    incoterm: "DAP",
    floor: 92,
    target: 108,
    list: 115,
    currency: "EUR",
    strategy: "Align",
  },
  {
    product: "Cheville – Orthèse Y",
    market: "FR",
    incoterm: "DAP",
    floor: 35,
    target: 41,
    list: 45,
    currency: "EUR",
    strategy: "Penetration",
  },
  {
    product: "Poignet – Support Z",
    market: "DE",
    incoterm: "DDP",
    floor: 22,
    target: 26,
    list: 28,
    currency: "EUR",
    strategy: "Premium",
  },
];

const mockPositioning: PositioningPoint[] = [
  { name: "Nous", type: "us", priceIndex: 102, valueScore: 78 },
  { name: "DonJoy", type: "competitor", priceIndex: 120, valueScore: 82 },
  { name: "Gibaud", type: "competitor", priceIndex: 98, valueScore: 62 },
  { name: "AT", type: "competitor", priceIndex: 88, valueScore: 55 },
];

function money(n: number, ccy: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: ccy }).format(n);
}

function reliabilityBadge(r: PriceObs["reliability"]) {
  const variant = r === "High" ? "default" : r === "Medium" ? "secondary" : "outline";
  return <Badge variant={variant}>{r}</Badge>;
}

export default function WatchCommercial() {
  // KPI quick calc (mock)
  const avgCompetitor = mockCompetitorPrices.reduce((s, x) => s + x.price, 0) / mockCompetitorPrices.length;
  const avgOurs = mockOurPrices.reduce((s, x) => s + x.target, 0) / mockOurPrices.length;
  const priceIndex = Math.round((avgOurs / avgCompetitor) * 100);
  const alerts = mockCompetitorPrices.filter((x) => x.reliability !== "High").length;

  return (
    <MainLayout>
      {/* Forcer une base claire via tokens shadcn */}
      <div className="space-y-6 bg-background text-foreground">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Veille concurrentielle</p>
            <h1 className="text-2xl font-bold">Prix & positionnement — Concurrence vs Nous</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Analyse orientée décision : stratégie prix, écarts, alertes, et carte de positionnement.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2">
              <FileUp className="h-4 w-4" />
              Importer CSV
            </Button>
            <Button variant="outline" className="gap-2">
              <ArrowDownUp className="h-4 w-4" />
              Exporter
            </Button>
            <Button className="gap-2">
              <Target className="h-4 w-4" />
              Créer une alerte
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filtres
            </CardTitle>
            <CardDescription>Filtre par marché, segment, famille produit, incoterm, période.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="Marché (ex: FR, DE…)" />
              <Input placeholder="Famille produit" />
              <Input placeholder="Segment / Client" />
              <Input placeholder="Incoterm (DAP, DDP…)" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="pricing" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pricing" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Stratégie de prix
            </TabsTrigger>
            <TabsTrigger value="positioning" className="gap-2">
              <Users className="h-4 w-4" />
              Positionnement
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Pricing */}
          <TabsContent value="pricing" className="space-y-4">
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Price Index (Nous vs Marché)
                  </CardTitle>
                  <CardDescription>Basé sur les prix cibles vs prix observés concurrence.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold">{priceIndex}</div>
                    <div className="text-xs text-muted-foreground">100 = aligné marché</div>
                  </div>
                  <Badge variant={priceIndex >= 105 ? "secondary" : "default"}>
                    {priceIndex >= 105 ? "Plutôt Premium" : "Aligné / Compétitif"}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingDown className="h-4 w-4 text-primary" />
                    Écart moyen (cible vs concurrence)
                  </CardTitle>
                  <CardDescription>Lecture simple de l’écart moyen.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold">
                      {Math.round(((avgOurs - avgCompetitor) / avgCompetitor) * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {money(avgOurs, "EUR")} vs {money(avgCompetitor, "EUR")}
                    </div>
                  </div>
                  <Badge variant="outline">Mock</Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" />
                    Alertes à traiter
                  </CardTitle>
                  <CardDescription>Fiabilité source faible/moyenne, variations à confirmer.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold">{alerts}</div>
                    <div className="text-xs text-muted-foreground">à vérifier / compléter</div>
                  </div>
                  <Button variant="outline" size="sm">
                    Voir
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Tables */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Prix observés concurrence</CardTitle>
                  <CardDescription>Tracking prix, conditions, source & fiabilité.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 text-left font-medium">Concurrent</th>
                        <th className="py-2 text-left font-medium">Produit</th>
                        <th className="py-2 text-left font-medium">Marché</th>
                        <th className="py-2 text-left font-medium">Incoterm</th>
                        <th className="py-2 text-right font-medium">Prix</th>
                        <th className="py-2 text-left font-medium">Source</th>
                        <th className="py-2 text-left font-medium">Fiabilité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockCompetitorPrices.map((x, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2">{x.competitor}</td>
                          <td className="py-2">{x.product}</td>
                          <td className="py-2">{x.market}</td>
                          <td className="py-2">{x.incoterm}</td>
                          <td className="py-2 text-right">{money(x.price, x.currency)}</td>
                          <td className="py-2">{x.source}</td>
                          <td className="py-2">{reliabilityBadge(x.reliability)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notre stratégie de prix</CardTitle>
                  <CardDescription>Plancher / cible / liste + stratégie par produit.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 text-left font-medium">Produit</th>
                        <th className="py-2 text-left font-medium">Marché</th>
                        <th className="py-2 text-left font-medium">Incoterm</th>
                        <th className="py-2 text-right font-medium">Plancher</th>
                        <th className="py-2 text-right font-medium">Cible</th>
                        <th className="py-2 text-right font-medium">Liste</th>
                        <th className="py-2 text-left font-medium">Stratégie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockOurPrices.map((x, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2">{x.product}</td>
                          <td className="py-2">{x.market}</td>
                          <td className="py-2">{x.incoterm}</td>
                          <td className="py-2 text-right">{money(x.floor, x.currency)}</td>
                          <td className="py-2 text-right">{money(x.target, x.currency)}</td>
                          <td className="py-2 text-right">{money(x.list, x.currency)}</td>
                          <td className="py-2">
                            <Badge variant={x.strategy === "Premium" ? "secondary" : x.strategy === "Align" ? "default" : "outline"}>
                              {x.strategy}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comparatif & recommandations</CardTitle>
                <CardDescription>Écarts (cible vs prix observés) et action recommandée.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">Produit</th>
                      <th className="py-2 text-right font-medium">Notre cible</th>
                      <th className="py-2 text-right font-medium">Meilleur prix concurrence</th>
                      <th className="py-2 text-right font-medium">Écart</th>
                      <th className="py-2 text-left font-medium">Reco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockOurPrices.map((p, idx) => {
                      const obs = mockCompetitorPrices.filter((o) => o.product === p.product);
                      const best = obs.length ? Math.min(...obs.map((o) => o.price)) : null;
                      const gapPct = best ? Math.round(((p.target - best) / best) * 100) : null;

                      let reco = "OK";
                      if (gapPct !== null && gapPct >= 10) reco = "Trop cher → revoir cible / conditions";
                      if (gapPct !== null && gapPct <= -10) reco = "Sous marché → opportunité marge / premium";

                      return (
                        <tr key={idx} className="border-b">
                          <td className="py-2">{p.product}</td>
                          <td className="py-2 text-right">{money(p.target, p.currency)}</td>
                          <td className="py-2 text-right">{best ? money(best, "EUR") : "—"}</td>
                          <td className="py-2 text-right">
                            {gapPct === null ? "—" : (
                              <Badge variant={gapPct >= 10 ? "secondary" : gapPct <= -10 ? "outline" : "default"}>
                                {gapPct > 0 ? `+${gapPct}%` : `${gapPct}%`}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2">{reco}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Positioning */}
          <TabsContent value="positioning" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Carte de positionnement</CardTitle>
                  <CardDescription>Prix (index) vs Valeur perçue (score). Bulles = acteurs.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Valeur (↑)</div>
                      <div className="text-xs text-muted-foreground">Prix (→)</div>
                    </div>

                    {/* Plot area */}
                    <div className="relative mt-2 h-[320px] w-full rounded-md bg-muted/30">
                      {/* Axes guides */}
                      <div className="absolute inset-0">
                        <div className="absolute left-0 top-1/2 h-px w-full bg-border" />
                        <div className="absolute top-0 left-1/2 w-px h-full bg-border" />
                      </div>

                      {/* Points */}
                      {mockPositioning.map((p, i) => {
                        // map x: priceIndex 60..140 -> 0..100%
                        const x = Math.min(140, Math.max(60, p.priceIndex));
                        const xPct = ((x - 60) / (140 - 60)) * 100;

                        // map y: valueScore 0..100 -> 0..100% (inverted for CSS top)
                        const y = Math.min(100, Math.max(0, p.valueScore));
                        const yPct = 100 - y;

                        return (
                          <div
                            key={i}
                            className="absolute"
                            style={{ left: `${xPct}%`, top: `${yPct}%`, transform: "translate(-50%, -50%)" }}
                          >
                            <div
                              className={[
                                "flex items-center gap-2 rounded-full border px-3 py-1 text-xs shadow-sm",
                                p.type === "us" ? "bg-primary text-primary-foreground border-primary" : "bg-white text-foreground",
                              ].join(" ")}
                            >
                              <span className="font-medium">{p.name}</span>
                              <span className="text-[10px] opacity-80">
                                PI {p.priceIndex} • V {p.valueScore}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="default">Nous</Badge>
                      <Badge variant="outline">Concurrents</Badge>
                      <span className="ml-auto">Mock — brancher scoring (qualité, délais, SAV, conformité…)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Différenciateurs & lecture</CardTitle>
                  <CardDescription>Forces/faiblesses par acteur, par segment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border bg-white p-3 text-sm">
                    <div className="font-medium">Lecture rapide</div>
                    <Separator className="my-2" />
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      <li>Si PI élevé + valeur élevée → premium assumé.</li>
                      <li>Si PI élevé + valeur faible → risque de décrochage (prix trop haut).</li>
                      <li>Si PI bas + valeur élevée → opportunité d’augmenter la marge / repositionner.</li>
                    </ul>
                  </div>

                  <div className="rounded-lg border bg-white p-3 text-sm">
                    <div className="font-medium">Actions suggérées</div>
                    <Separator className="my-2" />
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Ajuster prix</Badge>
                      <Badge variant="outline">Bundle / conditions</Badge>
                      <Badge variant="outline">Améliorer délai / dispo</Badge>
                      <Badge variant="outline">Renforcer preuve valeur</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Matrice critères (positionnement)</CardTitle>
                <CardDescription>Score valeur à construire (qualité, SAV, dispo, conformité, innovation…).</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">Critère</th>
                      <th className="py-2 text-left font-medium">Nous</th>
                      <th className="py-2 text-left font-medium">DonJoy</th>
                      <th className="py-2 text-left font-medium">Gibaud</th>
                      <th className="py-2 text-left font-medium">AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Qualité perçue", "A", "A", "B", "C"],
                      ["Disponibilité / Stock", "B", "B", "B", "C"],
                      ["Délais", "B", "B", "C", "C"],
                      ["SAV / Support", "A", "A", "B", "C"],
                      ["Conformité / docs", "A", "A", "B", "B"],
                    ].map((row, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 font-medium">{row[0]}</td>
                        {row.slice(1).map((v, j) => (
                          <td key={j} className="py-2">
                            <Badge variant={v === "A" ? "default" : v === "B" ? "secondary" : "outline"}>{v}</Badge>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
