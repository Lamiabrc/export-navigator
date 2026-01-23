import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type DashboardFilters = {
  from: string;
  to: string;
  territories: string;
  channel: string;
  incoterm: string;
  client: string;
  product: string;
};

export function FiltersBar({ value, onChange, onRefresh }: { value: DashboardFilters; onChange: (v: DashboardFilters) => void; onRefresh?: () => void }) {
  const set = (patch: Partial<DashboardFilters>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6 items-end">
      <div>
        <Label className="text-xs">Du</Label>
        <Input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Au</Label>
        <Input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Territoires (CSV)</Label>
        <Input placeholder="GP,MQ,RE" value={value.territories} onChange={(e) => set({ territories: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Canal</Label>
        <Input placeholder="direct/depositaire" value={value.channel} onChange={(e) => set({ channel: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Incoterm</Label>
        <Input placeholder="DAP/FOB..." value={value.incoterm} onChange={(e) => set({ incoterm: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Client</Label>
        <Input placeholder="Recherche client" value={value.client} onChange={(e) => set({ client: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Produit</Label>
        <Input placeholder="Réf produit" value={value.product} onChange={(e) => set({ product: e.target.value })} />
      </div>
      <div className="md:col-span-2">
        <Button onClick={onRefresh} className="w-full">Appliquer</Button>
      </div>
    </div>
  );
}
