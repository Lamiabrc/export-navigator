import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useFlows } from '@/hooks/useFlows';
import { useFlowChecklists } from '@/hooks/useFlowChecklists';
import { computeFlowHealth } from '@/lib/flows/flowHealth';
import type { Incoterm, RiskLevel, Zone } from '@/types';
import { AlertTriangle, Download, Filter, RefreshCw, Sparkles, Target, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOperationsSync } from '@/hooks/useOperationsSync';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { supabase } from '@/integrations/supabase/client';

type ZoneFilter = 'ALL' | Zone;
type IncotermFilter = 'ALL' | Incoterm;
type RiskFilter = 'ALL' | RiskLevel;
type HealthFilter = 'ALL' | 'OK' | 'A_SURVEILLER' | 'RISQUE';

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v ?? 0) || 0);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

const toCsv = (rows: Record<string, string | number | boolean>[]) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    // CSV Excel friendly (semicolon)
    const needsQuotes = s.includes(';') || s.includes('\n') || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };
  const lines = [headers.join(';'), ...rows.map((r) => headers.map((h) => escape(r[h])).join(';'))];
  return lines.join('\n');
};

const downloadText = (content: string, filename: string, mime = 'text/csv') => {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const HealthBadge = ({ bucket, score }: { bucket: 'OK' | 'A_SURVEILLER' | 'RISQUE'; score: number }) => {
  const cls =
    bucket === 'OK'
      ? 'bg-[hsl(var(--status-ok))]/10 text-[hsl(var(--status-ok))] border-[hsl(var(--status-ok))]/30'
      : bucket === 'A_SURVEILLER'
        ? 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]/30'
        : 'bg-[hsl(var(--status-risk))]/10 text-[hsl(var(--status-risk))] border-[hsl(var(--status-risk))]/30';
  const label = bucket === 'OK' ? 'OK' : bucket === 'A_SURVEILLER' ? 'À surveiller' : 'Risque';
  return (
    <Badge variant="outline" className={cn('gap-2', cls)}>
      {label}
      <span className="opacity-80">{score}</span>
    </Badge>
  );
};

type DbCounts = {
  products: number | null;
  clients: number | null;
  flows: number | null;
  byZone: Array<{ export_zone: string | null; nb_clients: number }>;
  byDrom: Array<{ drom_code: string | null; nb_clients: number }>;
  error?: string | null;
};

async function countTable(table: string) {
  const { count, error } = await supabase.from(table).select('*', { head: true, count: 'exact' });
  if (error) throw error;
  return count ?? 0;
}

export default function ControlTower() {
  const { flows, isLoading } = useFlows();
  const { getChecklist } = useFlowChecklists();
  const operationsSync = useOperationsSync();

  // --- Supabase DB quick stats ---
  const [db, setDb] = useState<DbCounts>({
    products: null,
    clients: null,
    flows: null,
    byZone: [],
    byDrom: [],
    error: null,
  });
  const [dbLoading, setDbLoading] = useState(false);

  const refreshDb = async () => {
    setDbLoading(true);
    try {
      const [productsCount, clientsCount, flowsCount] = await Promise.all([
        countTable('products'),   // ✅ ton vrai nom de table
        countTable('clients'),
        countTable('flows'),
      ]);

      const { data: byZone, error: e1 } = await supabase.from('v_clients_by_zone').select('*');
      if (e1) throw e1;

      const { data: byDrom, error: e2 } = await supabase.from('v_clients_drom').select('*');
      if (e2) throw e2;

      setDb({
        products: productsCount,
        clients: clientsCount,
        flows: flowsCount,
        byZone: (byZone ?? []) as any,
        byDrom: (byDrom ?? []) as any,
        error: null,
      });
    } catch (e: any) {
      setDb((prev) => ({ ...prev, error: e?.message ?? 'Erreur DB' }));
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    refreshDb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filters
  const [q, setQ] = useState('');
  const [zone, setZone] = useState<ZoneFilter>('ALL');
  const [destination, setDestination] = useState<string>('ALL');
  const [incoterm, setIncoterm] = useState<IncotermFilter>('ALL');
  const [risk, setRisk] = useState<RiskFilter>('ALL');
  const [health, setHealth] = useState<HealthFilter>('ALL');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const resetFilters = () => {
    setQ('');
    setZone('ALL');
    setDestination('ALL');
    setIncoterm('ALL');
    setRisk('ALL');
    setHealth('ALL');
    setOnlyMissing(false);
    setOnlyOverdue(false);
  };

  const hasActiveFilters =
    q.trim() !== '' ||
    zone !== 'ALL' ||
    destination !== 'ALL' ||
    incoterm !== 'ALL' ||
    risk !== 'ALL' ||
    health !== 'ALL' ||
    onlyMissing ||
    onlyOverdue;

  // Presets (quick filters)
  const applyPreset = (preset: 'DROM_DDP' | 'SUISSE_BLOQUE' | 'UE_AUTOLIQ' | 'DOCS') => {
    resetFilters();

    if (preset === 'DROM_DDP') {
      setZone('DROM' as ZoneFilter);
      setIncoterm('DDP' as IncotermFilter);
      setOnlyMissing(true);
    }
    if (preset === 'SUISSE_BLOQUE') {
      setDestination('Suisse');
      setHealth('RISQUE');
    }
    if (preset === 'UE_AUTOLIQ') {
      setZone('UE' as ZoneFilter);
      setOnlyMissing(true);
      setQ('autoliquid');
    }
    if (preset === 'DOCS') {
      setOnlyMissing(true);
    }
  };

  // Build derived data with health
  const rows = useMemo(() => {
    const now = new Date();

    return flows.map((flow) => {
      const checklistRaw: any = getChecklist(flow);

      // ✅ robuste : certains hooks renvoient un tableau, d'autres un objet { checklist: [] }
      const checklistItems: Array<{ label: string; done?: boolean }> = Array.isArray(checklistRaw)
        ? checklistRaw
        : Array.isArray(checklistRaw?.checklist)
          ? checklistRaw.checklist
          : [];

      const h = computeFlowHealth(flow as any, checklistRaw, now);

      // Search tokens: include checklist labels so "autoliquid" works
      const searchBlob = [
        (flow as any).flow_code,
        (flow as any).client_name,
        (flow as any).destination,
        (flow as any).zone,
        (flow as any).incoterm,
        (flow as any).incoterm_place,
        ...checklistItems.map((c) => c.label),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        flow: flow as any,
        checklist: checklistRaw,
        health: h,
        searchBlob,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows]);

  const destinations = useMemo(() => {
    const set = new Set<string>();
    flows.forEach((f: any) => f?.destination && set.add(f.destination));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows
      .filter(({ flow }) => (zone === 'ALL' ? true : flow.zone === zone))
      .filter(({ flow }) => (destination === 'ALL' ? true : flow.destination === destination))
      .filter(({ flow }) => (incoterm === 'ALL' ? true : flow.incoterm === incoterm))
      .filter(({ flow }) => (risk === 'ALL' ? true : (flow.risk_level ?? 'ok') === risk))
      .filter(({ health: h }) => (health === 'ALL' ? true : h.bucket === health))
      .filter(({ health: h }) => (!onlyMissing ? true : h.missing.length > 0 || h.blockers.length > 0))
      .filter(({ health: h }) => (!onlyOverdue ? true : h.isOverdue))
      .filter(({ searchBlob }) => (!qq ? true : searchBlob.includes(qq)))
      .sort((a, b) => a.health.score - b.health.score);
  }, [rows, q, zone, destination, incoterm, risk, health, onlyMissing, onlyOverdue]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => String(r.flow?.status ?? '').toLowerCase() !== 'cloture').length;
    const atRisk = rows.filter((r) => r.health.bucket === 'RISQUE').length;
    const watch = rows.filter((r) => r.health.bucket === 'A_SURVEILLER').length;
    const overdue = rows.filter((r) => r.health.isOverdue).length;
    const missing = rows.filter((r) => r.health.missing.length > 0).length;

    const goodsValue = rows.reduce((acc, r) => acc + n(r.flow?.goods_value), 0);
    const costs = rows.reduce(
      (acc, r) =>
        acc +
        n(r.flow?.cost_transport) +
        n(r.flow?.cost_customs_clearance) +
        n(r.flow?.cost_duties) +
        n(r.flow?.cost_import_vat) +
        n(r.flow?.cost_octroi_mer) +
        n(r.flow?.cost_octroi_mer_regional) +
        n(r.flow?.cost_other),
      0
    );

    const topPriorities = [...rows]
      .sort((a, b) => a.health.score - b.health.score)
      .slice(0, 5)
      .map((r) => ({
        code: r.flow.flow_code,
        client: r.flow.client_name,
        dest: r.flow.destination,
        score: r.health.score,
        blockers: r.health.blockers.slice(0, 2),
      }));

    return { total, active, atRisk, watch, overdue, missing, goodsValue, costs, topPriorities };
  }, [rows]);

  const exportFilteredCsv = () => {
    const exportRows = filtered.map(({ flow, health: h }) => ({
      Code: flow.flow_code,
      Client: flow.client_name,
      Destination: flow.destination,
      Zone: flow.zone,
      Incoterm: flow.incoterm,
      Lieu: flow.incoterm_place,
      Départ: flow.departure_date ?? '',
      Livraison: flow.delivery_date ?? '',
      'Valeur marchandises': n(flow.goods_value),
      'Charges totales':
        n(flow.cost_transport) +
        n(flow.cost_customs_clearance) +
        n(flow.cost_duties) +
        n(flow.cost_import_vat) +
        n(flow.cost_octroi_mer) +
        n(flow.cost_octroi_mer_regional) +
        n(flow.cost_other),
      Risque: flow.risk_level ?? 'ok',
      Santé: h.bucket,
      Score: h.score,
      Retard: h.isOverdue,
      Bloquants: h.blockers.join(' | '),
      'Docs à faire': h.missing.join(' | '),
    }));

    const csv = toCsv(exportRows);
    downloadText(csv, `etat_des_lieux_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const handleSync = async () => {
    const result = await operationsSync.sync();
    if (result && result.length) {
      toast.success(`Synchronisation OneDrive OK (${result.length} lignes)`);
    } else if (operationsSync.error) {
      toast.error(`Sync OneDrive échouée : ${operationsSync.error}`);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Chargement.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Tour de contrôle Export"
          subtitle="État des lieux chiffré, priorisation et contrôle des risques (DOM, Suisse, UE)."
          actions={(
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={exportFilteredCsv}>
                <Download className="h-4 w-4" />
                Export état des lieux
              </Button>
              <Button variant="secondary" className="gap-2" onClick={handleSync} disabled={operationsSync.isLoading}>
                <Sparkles className="h-4 w-4" />
                {operationsSync.isLoading ? 'Sync en cours…' : 'Sync OneDrive'}
              </Button>
            </div>
          )}
        />

        {/* ✅ Supabase quick status */}
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5" />
                Base de données (Supabase)
              </CardTitle>
              <CardDescription>
                Tables: clients / products / flows + vues: v_clients_by_zone, v_clients_drom
              </CardDescription>
              {db.error ? (
                <p className="text-sm text-[hsl(var(--status-risk))]">{db.error}</p>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={refreshDb} disabled={dbLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {dbLoading ? 'Rafraîchissement…' : 'Rafraîchir'}
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">Clients: {db.clients ?? '—'}</Badge>
            <Badge variant="outline">Produits: {db.products ?? '—'}</Badge>
            <Badge variant="outline">Flows: {db.flows ?? '—'}</Badge>
            {!!db.byZone?.length && (
              <div className="w-full mt-2 flex flex-wrap gap-2">
                {db.byZone.map((r, i) => (
                  <Badge key={`${r.export_zone ?? 'NA'}-${i}`} variant="secondary">
                    {r.export_zone ?? '—'}: {r.nb_clients}
                  </Badge>
                ))}
              </div>
            )}
            {!!db.byDrom?.length && (
              <div className="w-full mt-2 flex flex-wrap gap-2">
                {db.byDrom.map((r, i) => (
                  <Badge key={`${r.drom_code ?? 'NA'}-${i}`} variant="outline">
                    DROM {r.drom_code ?? '—'}: {r.nb_clients}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total dossiers</p>
              <p className="text-2xl font-bold">{kpis.total}</p>
              <p className="text-[11px] text-muted-foreground">Tous statuts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Actifs</p>
              <p className="text-2xl font-bold">{kpis.active}</p>
              <p className="text-[11px] text-muted-foreground">Non clôturés</p>
            </CardContent>
          </Card>
          <Card className="border-[hsl(var(--status-risk))]/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">À risque</p>
              <p className="text-2xl font-bold">{kpis.atRisk}</p>
              <p className="text-[11px] text-muted-foreground">Santé “Risque”</p>
            </CardContent>
          </Card>
          <Card className="border-[hsl(var(--status-warning))]/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">À surveiller</p>
              <p className="text-2xl font-bold">{kpis.watch}</p>
              <p className="text-[11px] text-muted-foreground">Santé “À surveiller”</p>
            </CardContent>
          </Card>
          <Card className={cn('border', kpis.overdue > 0 ? 'border-[hsl(var(--status-risk))]/30' : '')}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Retards</p>
              <p className="text-2xl font-bold">{kpis.overdue}</p>
              <p className="text-[11px] text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Docs à faire</p>
              <p className="text-2xl font-bold">{kpis.missing}</p>
              <p className="text-[11px] text-muted-foreground">Checklist</p>
            </CardContent>
          </Card>
        </div>

        {/* Value row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Valeur marchandises</CardTitle>
              <CardDescription>Somme des flux</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(n(kpis.goodsValue))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Charges estimées</CardTitle>
              <CardDescription>Transport + douane + taxes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(n(kpis.costs))}</div>
            </CardContent>
          </Card>
        </div>

        {/* Presets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5" />
              États des lieux instantanés
            </CardTitle>
            <CardDescription>1 clic pour sortir un point chiffré</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => applyPreset('DROM_DDP')}>
              DOM &gt; DDP &gt; docs manquants
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyPreset('SUISSE_BLOQUE')}>
              Suisse &gt; dossiers à risque
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyPreset('DOCS')}>
              Tous &gt; docs à faire
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset('UE_AUTOLIQ')}>
              UE &gt; autoliquidation
            </Button>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtres
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Résultats: {filtered.length}</Badge>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="q">Recherche</Label>
              <Input
                id="q"
                placeholder="Code, client, destination, incoterm, doc (ex: autoliquidation)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div>
              <Label>Zone</Label>
              <p className="text-[11px] text-muted-foreground">UE/DROM/Hors UE impacte TVA et preuves.</p>
              <Select value={zone} onValueChange={(v) => setZone(v as ZoneFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  <SelectItem value="UE">UE</SelectItem>
                  <SelectItem value="DROM">DROM</SelectItem>
                  <SelectItem value="Suisse">Suisse</SelectItem>
                  <SelectItem value="Hors UE">Hors UE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Destination</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  {destinations.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Incoterm</Label>
              <Select value={incoterm} onValueChange={(v) => setIncoterm(v as IncotermFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  {(['EXW', 'FCA', 'FOB', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'] as const).map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Risque</Label>
              <Select value={risk} onValueChange={(v) => setRisk(v as RiskFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="watch">À surveiller</SelectItem>
                  <SelectItem value="risk">Risque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Label>Santé</Label>
              <Select value={health} onValueChange={(v) => setHealth(v as HealthFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  <SelectItem value="OK">OK</SelectItem>
                  <SelectItem value="A_SURVEILLER">À surveiller</SelectItem>
                  <SelectItem value="RISQUE">Risque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} />
              <span className="text-sm">Docs / bloquants</span>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} />
              <span className="text-sm">Retards</span>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Dossiers (filtrés)
            </CardTitle>
            <CardDescription>Tri par criticité (score santé croissant).</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Incoterm</TableHead>
                    <TableHead className="text-right">Marchandises</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead>Risque</TableHead>
                    <TableHead>Santé</TableHead>
                    <TableHead>Retard</TableHead>
                    <TableHead className="min-w-[220px]">Docs / bloquants</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map(({ flow, health: h }) => {
                    const totalCosts =
                      n(flow.cost_transport) +
                      n(flow.cost_customs_clearance) +
                      n(flow.cost_duties) +
                      n(flow.cost_import_vat) +
                      n(flow.cost_octroi_mer) +
                      n(flow.cost_octroi_mer_regional) +
                      n(flow.cost_other);

                    const riskLevel = (flow.risk_level ?? 'ok') as RiskLevel;

                    const checklistRaw: any = getChecklist(flow);
                    const checklistItems: Array<{ label: string; done?: boolean }> = Array.isArray(checklistRaw)
                      ? checklistRaw
                      : Array.isArray(checklistRaw?.checklist)
                        ? checklistRaw.checklist
                        : [];

                    const missingPreview = [...h.blockers, ...h.missing]
                      .filter(Boolean)
                      .slice(0, 4)
                      .join(' • ');

                    return (
                      <TableRow key={flow.id}>
                        <TableCell className="font-medium">{flow.flow_code}</TableCell>
                        <TableCell>{flow.client_name}</TableCell>
                        <TableCell>{flow.destination}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{flow.zone}</Badge>
                        </TableCell>
                        <TableCell>{flow.incoterm}</TableCell>
                        <TableCell className="text-right">{formatCurrency(n(flow.goods_value))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalCosts)}</TableCell>
                        <TableCell>
                          <StatusBadge status={riskLevel as any} />
                        </TableCell>
                        <TableCell>
                          <HealthBadge bucket={h.bucket} score={h.score} />
                        </TableCell>
                        <TableCell>
                          {h.isOverdue ? <Badge variant="destructive">Oui</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {missingPreview || (checklistItems.length ? 'OK' : '—')}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-sm text-muted-foreground">
                        Aucun dossier ne correspond aux filtres.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
