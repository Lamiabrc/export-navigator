import React from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { CompareTable } from "@/components/strategy/CompareTable";
import { priceObservations, competitors } from "@/data/mockStrategyData";
import { PageHeader } from "@/components/PageHeader";
import { RiskBadge } from "@/components/strategy/RiskBadge";

const compareRows = [
  {
    label: "Positionnement",
    values: ["Premium remboursement", "Sport performance", "Volume retail", "Mix agilite DROM"],
  },
  {
    label: "Gammes",
    values: ["Ortho LPP", "Sport + ortho", "Retail remboursement", "Ortho + sport"],
  },
  {
    label: "Canaux",
    values: ["Hospitalier", "Sport / clinique", "Pharmacie", "Grossiste / DROM"],
  },
  {
    label: "Prix moyen",
    values: ["68€", "110€", "55€", "72€"],
  },
  {
    label: "Forces",
    values: ["LPP fort", "Innovation", "Tarifs agressifs", "Agilite DROM"],
  },
  {
    label: "Faiblesses",
    values: ["Prix premium", "Moins LPP", "Moins tech", "Marque a renforcer"],
  },
];

export default function CompetitiveIntel() {
  const [marketFilter, setMarketFilter] = React.useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL");

  const markets = Array.from(new Set(priceObservations.map((o) => o.market)));
  const categories = Array.from(new Set(priceObservations.map((o) => o.category)));

  const filtered = priceObservations.filter((o) => {
    const marketOk = marketFilter === "ALL" || o.market === marketFilter;
    const categoryOk = categoryFilter === "ALL" || o.category === categoryFilter;
    return marketOk && categoryOk;
  });

  const getCompetitorName = (id: string) =>
    competitors.find((c) => c.id === id)?.name ?? id;

  return (
    <MainLayout>
      <PageHeader
        title="Competitive Intel"
        subtitle="Comparer ORLIMAN vs Thuasne / DonJoy / Gibaud."
        actions={
          <Link
            to="/scenario-lab"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground border border-primary/60 shadow-lg shadow-primary/30"
          >
            Lancer un scenario
          </Link>
        }
      />

      <div className="mt-4">
        <CompareTable
          columns={["Thuasne", "DonJoy", "Gibaud", "ORLIMAN"]}
          rows={compareRows}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 space-y-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Observations de prix</h2>
            <p className="text-sm text-muted-foreground">
              Filtre par marche / categorie pour identifier un levier.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="rounded-lg bg-background border border-border px-2 py-1 text-sm text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
            >
              <option value="ALL">Tous marches</option>
              {markets.map((mkt) => (
                <option key={mkt} value={mkt}>
                  {mkt}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg bg-background border border-border px-2 py-1 text-sm text-foreground dark:bg-white/5 dark:border-white/10 dark:text-white"
            >
              <option value="ALL">Toutes categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border dark:border-white/10">
          <table className="min-w-full text-sm text-foreground">
            <thead className="bg-muted/40 text-muted-foreground dark:bg-white/5 dark:text-white/80">
              <tr>
                <th className="px-3 py-2 text-left">Competiteur</th>
                <th className="px-3 py-2 text-left">Categorie</th>
                <th className="px-3 py-2 text-left">Produit</th>
                <th className="px-3 py-2 text-left">Marche</th>
                <th className="px-3 py-2 text-left">Prix</th>
                <th className="px-3 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((obs) => (
                <tr key={obs.id} className="border-t border-border dark:border-white/5">
                  <td className="px-3 py-2">{getCompetitorName(obs.competitorId)}</td>
                  <td className="px-3 py-2">{obs.category}</td>
                  <td className="px-3 py-2">{obs.productName ?? "-"}</td>
                  <td className="px-3 py-2">{obs.market}</td>
                  <td className="px-3 py-2">
                    {obs.price} {obs.currency}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground dark:text-white/70">
                    {obs.sourceLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <RiskBadge level="medium" />
          <Link
            to="/scenario-lab?from=observation"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Creer un scenario a partir d'une observation
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
