import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Mapping = {
  competitor: string;
  territory: string;
  product: string;
  netPrice: string;
  snapshotDate: string;
};

const TARGET_FIELDS: { key: keyof Mapping; label: string }[] = [
  { key: "competitor", label: "Competitor" },
  { key: "territory", label: "Territoire" },
  { key: "product", label: "Produit ref" },
  { key: "netPrice", label: "Net price" },
  { key: "snapshotDate", label: "Date" },
];

export function CsvImport({ onImport, loading }: { onImport: (rows: any[]) => Promise<void> | void; loading?: boolean }) {
  const [raw, setRaw] = useState("");
  const [mapping, setMapping] = useState<Mapping>({
    competitor: "competitor",
    territory: "territory_code",
    product: "product_ref",
    netPrice: "net_price_est",
    snapshotDate: "snapshot_date",
  });
  const [delimiter, setDelimiter] = useState<"," | ";">(",");
  const headers = useMemo(() => {
    const [first] = raw.split(/\r?\n/);
    if (!first) return [];
    return first.split(delimiter).map((h) => h.trim());
  }, [raw, delimiter]);

  const applyImport = async () => {
    if (!raw.trim()) return;
    const lines = raw.trim().split(/\r?\n/);
    if (lines.length < 2) return;
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(delimiter).map((c) => c.trim());
      const mapValue = (field: keyof Mapping) => {
        const idx = headers.findIndex((h) => h.toLowerCase() === mapping[field].toLowerCase());
        return idx >= 0 ? cols[idx] : "";
      };
      const netPriceStr = mapValue("netPrice");
      return {
        competitor_id: mapValue("competitor"),
        territory_code: mapValue("territory"),
        product_ref: mapValue("product"),
        net_price_est: netPriceStr ? Number(netPriceStr) : null,
        snapshot_date: mapValue("snapshotDate"),
      };
    });
    await onImport(rows);
    setRaw("");
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Import CSV (coller)</h3>
          <p className="text-sm text-muted-foreground">Colonnes attendues: competitor, territory_code, product_ref, net_price_est, snapshot_date.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Délimiteur</Label>
          <Select value={delimiter} onValueChange={(v) => setDelimiter(v as any)}>
            <SelectTrigger className="h-8 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=",">,</SelectItem>
              <SelectItem value=";">;</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {TARGET_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input
              value={mapping[f.key]}
              onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
              placeholder="Nom de colonne"
            />
          </div>
        ))}
      </div>

      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="Coller CSV avec en-têtes..."
        className="min-h-[140px]"
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={() => void applyImport()} disabled={loading}>
          Importer
        </Button>
      </div>
    </div>
  );
}
