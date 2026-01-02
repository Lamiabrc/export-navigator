import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Receipt, Truck, Plane } from "lucide-react";
import { useCosts } from "@/hooks/useCosts";
import { supabase } from "@/integrations/supabase/client";
import { useDhlSalesQuotes } from "@/hooks/useDhlSalesQuotes";

function toCsv(rows: Record<string, any>[], delimiter = ";") {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);

  const escape = (v: any) => {
    const s = String(v ?? "");
    const needsQuotes = s.includes(delimiter) || s.includes("\n") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [
    headers.join(delimiter),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(delimiter)),
  ];
  return lines.join("\n");
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// -------------------- PRICING EXPORT (v_export_pricing) --------------------
const TERRITORIES = [
  { code: "FR", label: "Métropole" },
  { code: "GP", label: "Guadeloupe" },
  { code: "MQ", label: "Martinique" },
  { code: "GF", label: "Guyane" },
  { code: "RE", label: "Réunion" },
  { code: "YT", label: "Mayotte" },
  { code: "SPM", label: "Saint-Pierre-et-Miquelon" },
  { code: "BL", label: "Saint-Barthélemy" },
  { code: "MF", label: "Saint-Martin" },
];

async function fetchAllPricingRows(territoryCode: string) {
  const pageSize = 5000;
  let from = 0;
  const all: any[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("v_export_pricing")
      .select("*")
      .eq("territory_code", territoryCode)
      .order("sku", { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

// -------------------- PAGE --------------------
export default function Costs() {
  const { rows, isLoading, error, warning, refresh } = useCosts();
  const [destinations, setDestinations] = React.useState<{ id: string; name: string | null }[]>([]);
  const [dhlDestinationId, setDhlDestinationId] = React.useState<string>("all");

  const { data: dhlQuotes, loading: dhlLoading, error: dhlError, refetch: refetchDhl } = useDhlSalesQuotes({
    destinationId: dhlDestinationId === "all" ? undefined : dhlDestinationId,
  });

  // Recherche charges
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((r: any) => {
      const hay = [
        r.cost_type,
        r.market_zone,
        r.destination,
        r.incoterm,
        r.client_id,
        r.product_id,
        r.order_id, // ✅ nouveau
        r.currency,
        r.date,
        String(r.amount ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [rows, q]);

  const total = React.useMemo(
    () => filtered.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0),
    [filtered]
  );

  function exportChargesCsv() {
    const csv = toCsv(
      filtered.map((r: any) => ({
        date: r.date ?? "",
        cost_type: r.cost_type ?? "",
        amount: r.amount ?? 0,
        currency: r.currency ?? "",
        market_zone: r.market_zone ?? "",
        destination: r.destination ?? "",
        incoterm: r.incoterm ?? "",
        order_id: r.order_id ?? "", // ✅ nouveau
        client_id: r.client_id ?? "",
        product_id: r.product_id ?? "",
      }))
    );

    downloadText(csv, `costs_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  React.useEffect(() => {
    supabase
      .from("export_destinations")
      .select("id,name")
      .order("name", { ascending: true })
      .limit(1000)
      .then(({ data, error: destError }) => {
        if (!destError && data) setDestinations(data as any);
      })
      .catch(console.error);
  }, []);

  const dhlTotal = React.useMemo(
    () => dhlQuotes.reduce((s, q) => s + (Number(q.dhl_transport_eur) || 0), 0),
    [dhlQuotes]
  );

  function exportDhlCsv() {
    if (!dhlQuotes.length) return;
    const csv = toCsv(
      dhlQuotes.map((q) => ({
        sale_id: q.sale_id ?? "",
        sale_date: q.sale_date ?? "",
        destination_name: q.destination_name ?? "",
        dhl_zone: q.dhl_zone ?? "",
        quantity: q.quantity ?? "",
        total_actual_weight_kg: q.total_actual_weight_kg ?? "",
        dhl_transport_eur: q.dhl_transport_eur ?? "",
      }))
    );
    downloadText(csv, `dhl_quotes_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // -------------------- FORM: TRANSPORT + DOSSIER (par commande) --------------------
  const [orderId, setOrderId] = React.useState("");
  const [transportAmount, setTransportAmount] = React.useState<number | "">("");
  const [dossierAmount, setDossierAmount] = React.useState<number | "">("");
  const [currency, setCurrency] = React.useState("EUR");
  const [marketZone, setMarketZone] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [incoterm, setIncoterm] = React.useState("");
  const [isSavingOrderCharges, setIsSavingOrderCharges] = React.useState(false);

  async function addOrderCharges() {
    const oid = orderId.trim();
    if (!oid) {
      alert("Merci de renseigner un ID de commande.");
      return;
    }

    const t = transportAmount === "" ? 0 : Number(transportAmount);
    const d = dossierAmount === "" ? 0 : Number(dossierAmount);

    if ((t || 0) <= 0 && (d || 0) <= 0) {
      alert("Renseigne au moins un montant (transport ou dossier).");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const rowsToInsert: any[] = [];

    if (t > 0) {
      rowsToInsert.push({
        date: today,
        cost_type: "TRANSPORT_COMMANDE",
        amount: t,
        currency,
        market_zone: marketZone || null,
        destination: destination || null,
        incoterm: incoterm || null,
        order_id: oid,
      });
    }

    if (d > 0) {
      rowsToInsert.push({
        date: today,
        cost_type: "FRAIS_DOSSIER",
        amount: d,
        currency,
        market_zone: marketZone || null,
        destination: destination || null,
        incoterm: incoterm || null,
        order_id: oid,
      });
    }

    setIsSavingOrderCharges(true);
    try {
      const { error } = await supabase.from("cost_lines").insert(rowsToInsert);
      if (error) throw error;

      setTransportAmount("");
      setDossierAmount("");
      await refresh();

      alert("Charges ajoutées à la commande ✅");
    } catch (e: any) {
      console.error(e);
      alert(`Erreur: ${e?.message ?? e}`);
    } finally {
      setIsSavingOrderCharges(false);
    }
  }

  // -------------------- PRICING EXPORT UI --------------------
  const [pricingTerritory, setPricingTerritory] = React.useState("FR");
  const [isExportPricing, setIsExportPricing] = React.useState(false);

  async function exportPricingCsv() {
    setIsExportPricing(true);
    try {
      const data = await fetchAllPricingRows(pricingTerritory);

      const csv = toCsv(
        data.map((r: any) => ({
          sku: r.sku ?? "",
          label: r.label ?? "",
          hs_code: r.hs_code ?? "",
          hs4: r.hs4 ?? "",
          tax_level: r.tax_level ?? "",
          lpp_generic: r.lpp_generic ?? "",
          lpp_individual: r.lpp_individual ?? "",
          competitor_family: r.competitor_family ?? "",
          territory_code: r.territory_code ?? "",
          territory_name: r.territory_name ?? "",
          vat_rate: r.vat_rate ?? "",
          om_rate: r.om_rate ?? "",
          omr_rate: r.omr_rate ?? "",
          tr_metropole_ttc: r.tr_metropole_ttc ?? "",
          plv_metropole_ttc: r.plv_metropole_ttc ?? "",
          lppr_majoration_coef_t2_ch1_orth: r.lppr_majoration_coef_t2_ch1_orth ?? "",
          tr_om_ttc: r.tr_om_ttc ?? "",
          plv_om_ttc: r.plv_om_ttc ?? "",
          thuasne_price_ttc: r.thuasne_price_ttc ?? "",
          donjoy_price_ttc: r.donjoy_price_ttc ?? "",
          gibaud_price_ttc: r.gibaud_price_ttc ?? "",
        }))
      );

      downloadText(csv, `pricing_${pricingTerritory}_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: any) {
      console.error(e);
      alert(`Erreur export pricing: ${e?.message ?? e}`);
    } finally {
      setIsExportPricing(false);
    }
  }

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Données</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Coûts & export
            </h1>
            <p className="text-sm text-muted-foreground">
              Charges: <code className="text-xs">cost_lines</code> — Prix: <code className="text-xs">v_export_pricing</code>
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportChargesCsv} disabled={isLoading || filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export charges (CSV)
            </Button>
            <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser charges
            </Button>
          </div>
        </div>

        {/* ERRORS */}
        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        {/* DHL ESTIMATION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Estimation DHL (Economy Select • Export)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={dhlDestinationId}
                  onChange={(e) => setDhlDestinationId(e.target.value)}
                >
                  <option value="all">Toutes</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name ?? d.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={refetchDhl} disabled={dhlLoading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${dhlLoading ? "animate-spin" : ""}`} />
                  Actualiser DHL
                </Button>
                <Button variant="outline" onClick={exportDhlCsv} disabled={dhlLoading || dhlQuotes.length === 0} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export DHL (CSV)
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Lignes: {dhlQuotes.length}</Badge>
              <Badge variant="secondary">Total estimé: {Math.round(dhlTotal).toLocaleString("fr-FR")} €</Badge>
            </div>

            {dhlError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4 text-sm text-foreground">{dhlError}</CardContent>
              </Card>
            ) : null}

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Vente</th>
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-left font-medium">Destination</th>
                    <th className="py-2 text-left font-medium">Zone DHL</th>
                    <th className="py-2 text-right font-medium">Qté</th>
                    <th className="py-2 text-right font-medium">Poids (kg)</th>
                    <th className="py-2 text-right font-medium">Transport (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {dhlLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Chargement…
                      </td>
                    </tr>
                  ) : dhlQuotes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        Pas de devis DHL : vérifier destination_id, mapping zone, poids produit.
                      </td>
                    </tr>
                  ) : (
                    dhlQuotes.map((q) => (
                      <tr key={q.sale_id} className="border-b last:border-0">
                        <td className="py-2">{q.sale_id ?? "—"}</td>
                        <td className="py-2">{q.sale_date ?? "—"}</td>
                        <td className="py-2">{q.destination_name ?? "—"}</td>
                        <td className="py-2">{q.dhl_zone ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{q.quantity ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{q.total_actual_weight_kg ?? "—"}</td>
                        <td className="py-2 text-right tabular-nums">{(q.dhl_transport_eur ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 1) PRIX (v_export_pricing) */}
        <Card>
          <CardHeader>
            <CardTitle>Prix catalogue (export par territoire)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Territoire</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={pricingTerritory}
                  onChange={(e) => setPricingTerritory(e.target.value)}
                >
                  {TERRITORIES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} — {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button onClick={exportPricingCsv} disabled={isExportPricing} className="gap-2">
                  <Download className="h-4 w-4" />
                  {isExportPricing ? "Export..." : "Exporter le catalogue (CSV)"}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Exporte tout le catalogue depuis <code className="text-xs">v_export_pricing</code> (TVA, OM/OMR, TR/LPPR majoré, concurrents).
            </p>
          </CardContent>
        </Card>

        {/* 2) TRANSPORT / DOSSIER (par commande) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Transport & traitement de dossier (par commande)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">ID commande</p>
                <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Ex: CMD-2026-0001" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Devise</p>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Incoterm</p>
                <Input value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="EXW / DAP / ..." />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Zone</p>
                <Input value={marketZone} onChange={(e) => setMarketZone(e.target.value)} placeholder="DOM / UE / ..." />
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Destination</p>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Guadeloupe / Client / Ville..." />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Charge transport</p>
                <Input
                  type="number"
                  value={transportAmount}
                  onChange={(e) => setTransportAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Frais dossier</p>
                <Input
                  type="number"
                  value={dossierAmount}
                  onChange={(e) => setDossierAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              <div className="flex items-end">
                <Button onClick={addOrderCharges} disabled={isSavingOrderCharges} className="w-full">
                  {isSavingOrderCharges ? "Enregistrement..." : "Ajouter à la commande"}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Ceci crée 1 ou 2 lignes dans <code className="text-xs">cost_lines</code> (TRANSPORT_COMMANDE / FRAIS_DOSSIER) avec le même{" "}
              <code className="text-xs">order_id</code>.
            </p>
          </CardContent>
        </Card>

        {/* 3) LISTE CHARGES */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche (type, zone, incoterm, commande, client…)" />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Lignes: {filtered.length}</Badge>
            <Badge variant="secondary">Total: {Math.round(total).toLocaleString("fr-FR")}</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dernières charges</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-left font-medium">Date</th>
                  <th className="py-2 text-left font-medium">Type</th>
                  <th className="py-2 text-left font-medium">Zone</th>
                  <th className="py-2 text-left font-medium">Incoterm</th>
                  <th className="py-2 text-left font-medium">Commande</th>
                  <th className="py-2 text-left font-medium">Client</th>
                  <th className="py-2 text-left font-medium">Produit</th>
                  <th className="py-2 text-right font-medium">Montant</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      Chargement…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      Aucune donnée.
                    </td>
                  </tr>
                ) : (
                  filtered.slice(0, 250).map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2">{r.date ?? "—"}</td>
                      <td className="py-2">{r.cost_type ?? "—"}</td>
                      <td className="py-2">{r.market_zone ?? "—"}</td>
                      <td className="py-2">{r.incoterm ?? "—"}</td>
                      <td className="py-2">{r.order_id ?? "—"}</td>
                      <td className="py-2">{r.client_id ?? "—"}</td>
                      <td className="py-2">{r.product_id ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums">
                        {(Number(r.amount) || 0).toLocaleString("fr-FR")} {r.currency ?? ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {filtered.length > 250 ? (
              <p className="text-xs text-muted-foreground mt-3">
                Affichage limité aux 250 premières lignes (utilise la recherche ou export CSV).
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
