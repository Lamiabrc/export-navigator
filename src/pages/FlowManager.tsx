import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { AddFlowDialog } from '@/components/flows/AddFlowDialog';
import { useFlows } from '@/hooks/useFlows';
import { calculateCosts } from '@/utils/costCalculator';
import type { Flow, Invoice } from '@/types';
import { useInvoices } from '@/hooks/useInvoices';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, ShieldCheck, Calculator, TrendingUp, Download } from 'lucide-react';

type EditableCosts = Pick<
  Flow,
  | 'goods_value'
  | 'cost_transport'
  | 'cost_customs_clearance'
  | 'cost_duties'
  | 'cost_import_vat'
  | 'cost_octroi_mer'
  | 'cost_octroi_mer_regional'
  | 'cost_other'
  | 'prix_vente_conseille'
>;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const computeFinancials = (flow: Flow) => {
  const charges =
    flow.cost_transport +
    flow.cost_customs_clearance +
    flow.cost_duties +
    flow.cost_import_vat +
    flow.cost_octroi_mer +
    flow.cost_octroi_mer_regional +
    flow.cost_other;

  const prixRevient =
    flow.prix_revient_estime ??
    flow.goods_value +
      (flow.charges_fournisseur_estimees ?? charges);

  const prixVente =
    flow.prix_vente_conseille ??
    (flow.margin ? prixRevient * (1 + flow.margin / 100) : flow.goods_value + charges);

  const marge = prixVente > 0 ? ((prixVente - prixRevient) / prixVente) * 100 : 0;

  return { charges, prixRevient, prixVente, marge };
};

const computeRealized = (flow: Flow, invoices: Invoice[]) => {
  const related = invoices.filter((inv) => inv.flow_id === flow.id);
  const recettes = related.filter((i) => i.type === 'client').reduce((s, i) => s + i.amount_ht, 0);
  const couts = related
    .filter((i) => i.type === 'transport' || i.type === 'douane' || i.type === 'autre')
    .reduce((s, i) => s + i.amount_ht, 0);
  const marge = recettes > 0 ? ((recettes - couts) / recettes) * 100 : 0;
  return { recettes, couts, marge };
};

export default function FlowManager() {
  const { flows, isLoading, updateFlow } = useFlows();
  const { invoices } = useInvoices();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [editValues, setEditValues] = useState<EditableCosts | null>(null);

  const summary = useMemo(() => {
    const total = flows.length;
    const totals = flows.reduce(
      (acc, flow) => {
        const { prixRevient, prixVente, marge } = computeFinancials(flow);
        const realised = computeRealized(flow, invoices);
        acc.prixRevient += prixRevient;
        acc.prixVente += prixVente;
        acc.marges.push(marge);
        acc.recettes += realised.recettes;
        acc.couts += realised.couts;
        return acc;
      },
      { prixRevient: 0, prixVente: 0, marges: [] as number[], recettes: 0, couts: 0 }
    );
    const avgMargin =
      totals.marges.length > 0
        ? totals.marges.reduce((s, m) => s + m, 0) / totals.marges.length
        : 0;
    const avgMargeRealisee =
      totals.recettes > 0 ? ((totals.recettes - totals.couts) / totals.recettes) * 100 : 0;
    return {
      total,
      prixRevient: totals.prixRevient,
      prixVente: totals.prixVente,
      avgMargin,
      recettes: totals.recettes,
      couts: totals.couts,
      avgMargeRealisee,
    };
  }, [flows, invoices]);

  const openEdit = (flow: Flow) => {
    setEditing(flow);
    setEditValues({
      goods_value: flow.goods_value,
      cost_transport: flow.cost_transport,
      cost_customs_clearance: flow.cost_customs_clearance,
      cost_duties: flow.cost_duties,
      cost_import_vat: flow.cost_import_vat,
      cost_octroi_mer: flow.cost_octroi_mer,
      cost_octroi_mer_regional: flow.cost_octroi_mer_regional,
      cost_other: flow.cost_other,
      prix_vente_conseille: flow.prix_vente_conseille,
    });
  };

  const saveEdit = () => {
    if (!editing || !editValues) return;
    updateFlow(editing.id, {
      ...editValues,
      prix_revient_estime:
        editValues.goods_value +
        editValues.cost_transport +
        editValues.cost_customs_clearance +
        editValues.cost_duties +
        editValues.cost_import_vat +
        editValues.cost_octroi_mer +
        editValues.cost_octroi_mer_regional +
        editValues.cost_other,
      updated_at: new Date().toISOString(),
    });
    toast.success('Coûts mis à jour');
    setEditing(null);
    setEditValues(null);
  };

  const handleQuickRecompute = (flow: Flow) => {
    // Rejoue le calcul standard avec les paramètres connus (sans product type fin)
    const recomputed = calculateCosts({
      goodsValue: flow.goods_value,
      destination: flow.destination,
      incoterm: flow.incoterm,
      productType: flow.product_type || 'lppr',
      transportMode: flow.transport_mode,
      weight: flow.weight || 100,
      margin: flow.margin || 25,
    });
    updateFlow(flow.id, {
      prix_revient_estime: recomputed.prixDeRevient,
      prix_vente_conseille: recomputed.prixVenteHT,
      charges_fournisseur_estimees: recomputed.totalFournisseur,
      charges_client_estimees: recomputed.totalClient,
    });
    toast.success('Estimation recalculée');
  };

  const exportCsv = () => {
    const header = [
      'FlowCode',
      'Client',
      'Destination',
      'Incoterm',
      'Prévu_PrixRevient',
      'Prévu_PrixVente',
      'Prévu_Marge%',
      'Réalisé_Recettes',
      'Réalisé_Couts',
      'Réalisé_Marge%',
    ].join(';');
    const rows = flows.map((flow) => {
      const prev = computeFinancials(flow);
      const real = computeRealized(flow, invoices);
      return [
        flow.flow_code,
        flow.client_name,
        flow.destination,
        flow.incoterm,
        prev.prixRevient.toFixed(2),
        prev.prixVente.toFixed(2),
        prev.marge.toFixed(1),
        real.recettes.toFixed(2),
        real.couts.toFixed(2),
        real.marge.toFixed(1),
      ].join(';');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flux_marges_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Pilotage des flux export</p>
          <h1 className="text-2xl font-bold text-foreground">Flux & Marges</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau flux
          </Button>
        </div>
      </div>

      <AddFlowDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement des flux...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Flux actifs</CardTitle>
                <ShieldCheck className="h-4 w-4 text-chart-1" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.total}</div>
                <p className="text-xs text-muted-foreground">Prévision / réalisé</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Prix de revient prévisionnel</CardTitle>
                <Calculator className="h-4 w-4 text-chart-2" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.prixRevient)}</div>
                <p className="text-xs text-muted-foreground">Somme des flux</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Marge moyenne</CardTitle>
                <TrendingUp className="h-4 w-4 text-chart-3" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.avgMargin.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Prévisionnel</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Marge réalisée (factures)</CardTitle>
                <TrendingUp className="h-4 w-4 text-chart-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.avgMargeRealisee.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Recettes: {formatCurrency(summary.recettes)} / Coûts: {formatCurrency(summary.couts)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tableau des flux</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flux</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Incoterm</TableHead>
                    <TableHead>Prix de revient</TableHead>
                    <TableHead>Prix de vente</TableHead>
                    <TableHead>Marge</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flows.map((flow) => {
                    const { prixRevient, prixVente, marge } = computeFinancials(flow);
                    const realised = computeRealized(flow, invoices);
                    return (
                      <TableRow key={flow.id}>
                        <TableCell>
                          <div className="font-semibold">{flow.flow_code}</div>
                          <div className="text-xs text-muted-foreground">{flow.client_name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{flow.destination}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{flow.incoterm}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(prixRevient)}</TableCell>
                        <TableCell>{formatCurrency(prixVente)}</TableCell>
                        <TableCell className={marge < 0 ? 'text-[hsl(var(--status-risk))]' : 'text-[hsl(var(--status-ok))]'}>
                          {marge.toFixed(1)}%
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(realised.recettes)}</TableCell>
                        <TableCell>{formatCurrency(realised.couts)}</TableCell>
                        <TableCell className={realised.marge < 0 ? 'text-[hsl(var(--status-risk))]' : 'text-[hsl(var(--status-ok))]'}>
                          {realised.marge.toFixed(1)}%
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(flow)} className="gap-1">
                            <Pencil className="h-4 w-4" />
                            Coûts
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleQuickRecompute(flow)}>
                            Recalcul
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={!!editing} onOpenChange={(open) => (!open ? setEditing(null) : undefined)}>
        <SheetContent side="right" className="w-[420px] sm:w-[460px]">
          <SheetHeader>
            <SheetTitle>Mise à jour des coûts</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Ajustez les factures transport, douane, OM/OMR, TVA import et prix de vente.
            </p>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {editValues && (
              <>
                {(
                  Object.keys(editValues) as (keyof EditableCosts)[]
                ).map((key) => (
                  <div className="space-y-1" key={key}>
                    <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
                    <Input
                      type="number"
                      value={Number(editValues[key] ?? 0)}
                      onChange={(e) =>
                        setEditValues({
                          ...editValues,
                          [key]: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                ))}

                <Separator />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Aperçu marge après mise à jour</p>
                  <MargePreview flow={editing} overrides={editValues} />
                </div>
              </>
            )}
          </div>

          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button onClick={saveEdit}>Enregistrer</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}

function MargePreview({ flow, overrides }: { flow: Flow; overrides: EditableCosts }) {
  const clone: Flow = {
    ...flow,
    ...overrides,
  };
  const { prixRevient, prixVente, marge } = computeFinancials(clone);
  return (
    <div className="grid grid-cols-3 gap-3 text-sm bg-muted/60 rounded-lg p-3">
      <div>
        <p className="text-muted-foreground">Revient</p>
        <p className="font-semibold">{formatCurrency(prixRevient)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Vente</p>
        <p className="font-semibold">{formatCurrency(prixVente)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Marge</p>
        <p className={marge < 0 ? 'text-[hsl(var(--status-risk))] font-semibold' : 'text-[hsl(var(--status-ok))] font-semibold'}>
          {marge.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
