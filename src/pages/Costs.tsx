import * as React from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Receipt } from "lucide-react";
import { useCosts } from "@/hooks/useCosts";

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = String(v ?? "");
    const needsQuotes = s.includes(";") || s.includes("\n") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))];
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

export default function Costs() {
  const { rows, isLoading, error, warning, refresh } = useCosts();
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const hay = [
        r.cost_type,
        r.market_zone,
        r.destination,
        r.incoterm,
        r.client_id,
        r.product_id,
        r.currency,
        r.date,
        String(r.amount ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q]);

  const total = React.useMemo(() => filtered.reduce((s, r) => s + (r.amount ?? 0), 0), [filtered]);

  function exportCsv() {
    const csv = toCsv(
      filtered.map((r) => ({
        date: r.date ?? "",
        cost_type: r.cost_type ?? "",
        amount: r.amount ?? 0,
        currency: r.currency ?? "",
        market_zone: r.market_zone ?? "",
        destination: r.destination ?? "",
        incoterm: r.incoterm ?? "",
        client_id: r.client_id ?? "",
        product_id: r.product_id ?? "",
      })),
    );
    downloadText(csv, `costs_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <MainLayout contentClassName="md:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Données</p>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Charges
            </h1>
            <p className="text-sm text-muted-foreground">
              Source: <code className="text-xs">cost_lines</code> (ligne de charge)
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={isLoading || filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={refresh} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {error || warning ? (
          <Card className={(warning || "").toLowerCase().includes("manquante") ? "border-amber-300 bg-amber-50" : "border-red-200"}>
            <CardContent className="pt-6 text-sm text-foreground">{error || warning}</CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche (type, zone, incoterm, client…)" />
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
                  <th className="py-2 text-left font-medium">Client</th>
                  <th className="py-2 text-right font-medium">Montant</th>
                  <th className="py-2 text-left font-medium">Devise</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td className="py-3 text-muted-foreground" colSpan={7}>Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td className="py-3 text-muted-foreground" colSpan={7}>Aucune donnée.</td></tr>
                ) : (
                  filtered.slice(0, 200).map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2">{r.date ?? "—"}</td>
                      <td className="py-2">{r.cost_type ?? "—"}</td>
                      <td className="py-2">{r.market_zone ?? "—"}</td>
                      <td className="py-2">{r.incoterm ?? "—"}</td>
                      <td className="py-2">{r.client_id ?? "—"}</td>
                      <td className="py-2 text-right">{(r.amount ?? 0).toLocaleString("fr-FR")}</td>
                      <td className="py-2">{r.currency ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
