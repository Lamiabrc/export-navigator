import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/hooks/useProducts";
import { RefreshCw, Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatDateFr } from "@/lib/formatters";

function safeText(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 2 });

function fmtPct(v: any) {
  const n = typeof v === "number" ? v : v === "" || v == null ? null : Number(v);
  return Number.isFinite(n as number) ? pct.format((n as number) / 100) : "";
}

export default function Products() {
  const { products, stats, isLoading, error, refresh, missingTables, demoMode } = useProducts({ pageSize: 5000 });
  const [q, setQ] = React.useState("");
  const deferredQ = React.useDeferredValue(q);

  const filtered = React.useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    if (!query) return products;

    return products.filter((p: any) => {
      const hay = [
        p.code,
        p.label,
        p.manufacturer,
        p.hs_code,
      ]
        .map(safeText)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [products, deferredQ]);

  const emptyState = missingTables || (!isLoading && products.length === 0);

  return (
    <AppLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Produits
            </h1>
            <p className="text-sm text-muted-foreground">
              Referentiel produits (HS, TVA, fabricant) pour piloter la conformite export.
            </p>
          </div>

          <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (code produit, libelle, fabricant, HS code...)"
            className="md:max-w-2xl"
          />

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Total: {stats.total}</Badge>
            <Badge variant="secondary">HS ok: {stats.withHs}</Badge>
            <Badge variant="secondary">TVA ok: {stats.withTva}</Badge>
            <Badge variant="outline">Filtres: {filtered.length}</Badge>
            {demoMode ? <Badge variant="outline">Mode demo</Badge> : null}
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">Impossible de charger le catalogue pour le moment.</p> : null}

        {emptyState ? (
          <EmptyState
            title="Catalogue produits indisponible"
            description="Connecte la base Supabase ou lance la migration pour afficher les produits. En mode demo, nous injectons un petit catalogue."
            primaryAction={{ label: "Initialiser la base", to: "/resources" }}
            secondaryAction={{ label: "Voir la documentation", to: "/resources" }}
          />
        ) : (
          <>
            <div className="overflow-auto rounded-xl border max-h-[70vh]">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="p-3">Code produit</th>
                    <th className="p-3">Libelle</th>
                    <th className="p-3">HS code</th>
                    <th className="p-3">TVA</th>
                    <th className="p-3">Fabricant</th>
                    <th className="p-3">Cree le</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={6}>
                        Chargement...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={6}>
                        Aucun produit.
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, 500).map((p: any) => {
                      const missingTva = p.tva == null;
                      const missingHs = !safeText(p.hs_code);

                      return (
                        <tr key={p.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{safeText(p.code)}</td>
                          <td className="p-3">{safeText(p.label)}</td>
                          <td className={`p-3 ${missingHs ? "text-red-600 font-medium" : ""}`}>
                            {missingHs ? "Manquant" : safeText(p.hs_code)}
                          </td>
                          <td className={`p-3 ${missingTva ? "text-red-600 font-medium" : ""}`}>
                            {missingTva ? "Manquant" : fmtPct(p.tva)}
                          </td>
                          <td className="p-3">{safeText(p.manufacturer)}</td>
                          <td className="p-3">{formatDateFr(p.created_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Affichage limite a 500 lignes pour garder l'UI fluide (le filtre recherche agit sur l'ensemble).
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
