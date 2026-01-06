import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportFilters } from "@/domain/export/types";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { RefreshCw, RotateCcw } from "lucide-react";

type Props = {
  value: ExportFilters;
  onChange: (value: ExportFilters) => void;
  onRefresh?: () => void;
  loading?: boolean;
  showInvoiceSearch?: boolean;
};

export function ExportFiltersBar({ value, onChange, onRefresh, loading, showInvoiceSearch = true }: Props) {
  const { lookups, lookupsLoading } = useGlobalFilters();

  const handleChange = <K extends keyof ExportFilters>(key: K, v: ExportFilters[K]) => {
    onChange({ ...value, [key]: v || undefined });
  };

  const reset = () => {
    onChange({ invoiceNumber: undefined, territory: undefined, clientId: undefined, from: undefined, to: undefined });
  };

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Du</Label>
          <Input
            type="date"
            value={value.from || ""}
            onChange={(e) => handleChange("from", e.target.value || undefined)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Au</Label>
          <Input
            type="date"
            value={value.to || ""}
            onChange={(e) => handleChange("to", e.target.value || undefined)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Territoire / ile</Label>
          <Select
            value={value.territory || ""}
            onValueChange={(v) => handleChange("territory", v || undefined)}
            disabled={lookupsLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              {lookups.territories.map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.code} {t.label ? `- ${t.label}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Client</Label>
          <Select
            value={value.clientId || ""}
            onValueChange={(v) => handleChange("clientId", v || undefined)}
            disabled={lookupsLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="">Tous</SelectItem>
              {lookups.clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name || c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showInvoiceSearch ? (
          <div className="space-y-1">
            <Label className="text-xs">Recherche facture</Label>
            <Input
              placeholder="invoice_number..."
              value={value.invoiceNumber || ""}
              onChange={(e) => handleChange("invoiceNumber", e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">Recherche</Label>
            <Input
              placeholder="invoice_number, client..."
              value={value.search || ""}
              onChange={(e) => handleChange("search", e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 justify-end mt-3">
        <Button variant="ghost" size="sm" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {onRefresh ? (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        ) : null}
      </div>
    </div>
  );
}
