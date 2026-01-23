import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/hooks/useProducts";
import { RefreshCw, Package } from "lucide-react";

function safeText(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 2 });

function fmtEur(v: any) {
  const n = typeof v === "number" ? v : v === "" || v == null ? null : Number(v);
  return Number.isFinite(n as number) ? eur.format(n as number) : "";
}
function fmtPct(v: any) {
  const n = typeof v === "number" ? v : v === "" || v == null ? null : Number(v);
  return Number.isFinite(n as number) ? pct.format((n as number) / 100) : "";
}

export default function Products() {
  const { products, stats, isLoading, error, refresh } = useProducts({ pageSize: 5000 });
  const [q, setQ] = React.useState("");
  const deferredQ = React.useDeferredValue(q);

  const filtered = React.useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    if (!query) return products;

    return products.filter((p: any) => {
      const hay = [
        p.code_article,
        p.libelle_article,
        p.code_ean13,
        p.code_acl7,
        p.code_tarif_ref_generique,
        p.code_tarif_ref_individuel,
        p.manufacturer_name,
        p.classement_groupe,
        p.classement_produit_libelle,
        p.hs_code,
      ]
        .map(safeText)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [products, deferredQ]);

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Produits
            </h1>
            <p className="text-sm text-muted-foreground">
              Referentiel Supabase: recherche et controle des champs (TVA, tarif ref., HS code).
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
            placeholder="Rechercher (code article, libelle, EAN/ACL, fabricant, tarif ref., HS code...)"
            className="md:max-w-2xl"
          />

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Total: {stats.total}</Badge>
            <Badge variant="secondary">Nouveautes: {stats.nouveautes}</Badge>
            <Badge variant="secondary">Tarif ref.: {stats.tarif_ref}</Badge>
            <Badge variant="secondary">TVA OK: {stats.withTva}</Badge>
            <Badge variant="outline">Filtres: {filtered.length}</Badge>
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="overflow-auto rounded-xl border max-h-[70vh]">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="text-left">
                <th className="p-3">Code article</th>
                <th className="p-3">Libelle</th>
                <th className="p-3">TVA</th>
                <th className="p-3">Tarif cat. 2025</th>
                <th className="p-3">Tarif ref.</th>
                <th className="p-3">HS code</th>
                <th className="p-3">Classement</th>
                <th className="p-3">Fabricant</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={8}>
                    Chargement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={8}>
                    Aucun produit.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 500).map((p: any) => {
                  const missingTva = p.tva_percent == null;
                  const missingHs = !safeText(p.hs_code);
                  const missingTarif = p.tarif_catalogue_2025 == null;

                  return (
                    <tr key={p.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{safeText(p.code_article)}</td>
                      <td className="p-3">{safeText(p.libelle_article)}</td>

                      <td className={`p-3 ${missingTva ? "text-red-600 font-medium" : ""}`}>
                        {missingTva ? "Manquant" : fmtPct(p.tva_percent)}
                      </td>

                      <td className={`p-3 ${missingTarif ? "text-red-600 font-medium" : ""}`}>
                        {missingTarif ? "Manquant" : fmtEur(p.tarif_catalogue_2025)}
                      </td>

                      <td className="p-3">{p.tarif_ref_eur != null ? fmtEur(p.tarif_ref_eur) : ""}</td>

                      <td className={`p-3 ${missingHs ? "text-red-600 font-medium" : ""}`}>
                        {missingHs ? "Manquant" : safeText(p.hs_code)}
                      </td>

                      <td className="p-3">
                        {safeText(p.classement_groupe || p.classement_produit_libelle || p.classement_detail)}
                      </td>

                      <td className="p-3">{safeText(p.manufacturer_name)}</td>
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
      </div>
    </MainLayout>
  );
}
