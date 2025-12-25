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
import type { Flow, Incoterm, RiskLevel, Zone } from '@/types';
import { AlertTriangle, Download, Filter, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOperationsSync } from '@/hooks/useOperationsSync';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';

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

export default function ControlTower() {
  const { flows, isLoading } = useFlows();
  const { getChecklist } = useFlowChecklists();
  const operationsSync = useOperationsSync();

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

  // Presets (quick filters)
  const applyPreset = (preset: 'DROM_DDP' | 'SUISSE_BLOQUE' | 'UE_AUTOLIQ' | 'DOCS') => {
    setQ('');
    setDestination('ALL');
    setOnlyMissing(false);
    setOnlyOverdue(false);
    setRisk('ALL');
    setHealth('ALL');
    setZone('ALL');
    setIncoterm('ALL');

    if (preset === 'DROM_DDP') {
      setZone('DROM');
      setIncoterm('DDP');
      setRisk('ALL');
      setOnlyMissing(true);
    }
    if (preset === 'SUISSE_BLOQUE') {
      setDestination('Suisse');
      setHealth('RISQUE');
    }
    if (preset === 'UE_AUTOLIQ') {
      setZone('UE');
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
      const checklist = getChecklist(flow);
      const h = computeFlowHealth(flow, checklist, now);

      // Search tokens: also include checklist labels so "autoliquid" works as shortcut
      const searchBlob = [
        flow.flow_code,
        flow.client_name,
        flow.destination,
        flow.zone,
        flow.incoterm,
        flow.incoterm_place,
        ...checklist.map((c) => c.label),
      ]
        .join(' ')
        .toLowerCase();

      return {
        flow,
        checklist,
        health: h,
        searchBlob,
      };
    });
    // getChecklist has internal map; flows change => safe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows]);

  const destinations = useMemo(() => {
    const set = new Set<string>();
    flows.forEach((f) => set.add(f.destination));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows
      .filter(({ flow, health }) => (zone === 'ALL' ? true : flow.zone === zone))
      .filter(({ flow }) => (destination === 'ALL' ? true : flow.destination === destination))
      .filter(({ flow }) => (incoterm === 'ALL' ? true : flow.incoterm === incoterm))
      .filter(({ flow }) => (risk === 'ALL' ? true : (flow.risk_level ?? 'ok') === risk))
      .filter(({ health: h }) => (health === 'ALL' ? true : h.bucket === health))
      .filter(({ health: h }) => (!onlyMissing ? true : h.missing.length > 0 || h.blockers.length > 0))
      .filter(({ health: h }) => (!onlyOverdue ? true : h.isOverdue))
      .filter(({ searchBlob }) => (!qq ? true : searchBlob.includes(qq)))
      .sort((a, b) => a.health.score - b.health.score);
  }, [rows, q, zone, destination, incoterm, risk, health, onlyMissing, onlyOverdue]);

  const hasActiveFilters = useMemo(
    () =>
      q.trim() !== '' ||
      zone !== 'ALL' ||
      destination !== 'ALL' ||
      incoterm !== 'ALL' ||
      risk !== 'ALL' ||
      health !== 'ALL' ||
      onlyMissing ||
      onlyOverdue,
    [q, zone, destination, incoterm, risk, health, onlyMissing, onlyOverdue]
  );

  const kpis = useMemo(() => {
    const total = flows.length;
    const active = flows.filter(
      (f) => f.status_transport !== 'termine' || f.status_customs !== 'termine' || f.status_invoicing !== 'termine'
    ).length;

    const atRisk = flows.filter((f) => f.risk_level === 'risque').length;
    const watch = flows.filter((f) => f.risk_level === 'a_surveiller').length;

    const now = new Date();
    const overdue = rows.filter((r) => r.health.isOverdue).length;
    const missing = rows.filter((r) => r.health.missing.length > 0 || r.health.blockers.length > 0).length;

    const goodsValue = flows.reduce((s, f) => n(s) + n(f.goods_value), 0);
    const costs = flows.reduce(
      (s, f) =>
        n(s) +
        n(f.cost_transport) +
        n(f.cost_customs_clearance) +
        n(f.cost_duties) +
        n(f.cost_import_vat) +
        n(f.cost_octroi_mer) +
        n(f.cost_octroi_mer_regional) +
        n(f.cost_other),
      0
    );

    // Priorities: worst health
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

    return { total, active, atRisk, watch, overdue, missing, goodsValue, costs, topPriorities, now };
  }, [flows, rows]);

  const exportFilteredCsv = () => {
    const exportRows = filtered.map(({ flow, health: h }) => ({
      Code: flow.flow_code,
      Client: flow.client_name,
      Destination: flow.destination,
      Zone: flow.zone,
      Incoterm: flow.incoterm,
      Lieu: flow.incoterm_place,
      'Départ': flow.departure_date,
      'Livraison': flow.delivery_date,
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
      Overdue: h.isOverdue,
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

  useEffect(() => {
    // Silence unused warning when hooks haven't returned yet
    void operationsSync;
  }, [operationsSync]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Tour de controle Export"
          subtitle="Etat des lieux chiffre, priorisation et controle des risques (DOM, Suisse, UE)."
          actions={(
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={exportFilteredCsv}>
                <Download className="h-4 w-4" />
                Export etat des lieux
              </Button>
              <Button variant="secondary" className="gap-2" onClick={handleSync} disabled={operationsSync.isLoading}>
                <Sparkles className="h-4 w-4" />
                {operationsSync.isLoading ? 'Sync en cours...' : 'Sync OneDrive'}
              </Button>
            </div>
          )}
        />

        {
/* KPI Row */}
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
              <p className="text-[11px] text-muted-foreground">Risque déclaré</p>
            </CardContent>
          </Card>
          <Card className="border-[hsl(var(--status-warning))]/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">À surveiller</p>
              <p className="text-2xl font-bold">{kpis.watch}</p>
              <p className="text-[11px] text-muted-foreground">Risque modéré</p>
            </CardContent>
          </Card>
          <Card className={cn('border', kpis.overdue > 0 ? 'border-[hsl(var(--status-risk))]/30' : '')}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Retards</p>
              <p className="text-2xl font-bold">{kpis.overdue}</p>
              <p className="text-[11px] text-muted-foreground">Livraison/clôture</p>
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
              <Sparkles className="h-5 w-5" />
              États des lieux instantanés
            </CardTitle>
            <CardDescription>1 clic pour sortir un point chiffré en réunion</CardDescription>
          </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => applyPreset('DROM_DDP')}>
                {'DOM > DDP > docs manquants'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyPreset('SUISSE_BLOQUE')}>
                {'Suisse > dossiers à risque'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyPreset('DOCS')}>
                {'Tous > docs à faire'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset('UE_AUTOLIQ')}>
                {'UE > autoliquidation'}
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
              <p className="text-[11px] text-muted-foreground">Pourquoi ? Zone = UE/DROM/Hors UE impacte TVA et preuves.</p>
              <Select value={zone} onValueChange={(v) => setZone(v as ZoneFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes</SelectItem>
                  <SelectItem value="UE">UE</SelectItem>
                  <SelectItem value="DROM">DROM</SelectItem>
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
              <p className="text-[11px] text-muted-foreground">Pourquoi ? DDP/DAP modifient responsabilités douane/TVA.</p>
              <Select value={incoterm} onValueChange={(v) => setIncoterm(v as IncotermFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous</SelectItem>
                  <SelectItem value="EXW">EXW</SelectItem>
                  <SelectItem value="FCA">FCA</SelectItem>
                  <SelectItem value="DAP">DAP</SelectItem>
                  <SelectItem value="DDP">DDP</SelectItem>
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
                  <SelectItem value="a_surveiller">À surveiller</SelectItem>
                  <SelectItem value="risque">Risque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
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
            <div className="flex items-center gap-3 lg:col-span-2">
              <div className="flex items-center gap-2">
                <Switch checked={onlyMissing} onCheckedChange={setOnlyMissing} />
                <span className="text-sm">Docs / bloquants</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={onlyOverdue} onCheckedChange={setOnlyOverdue} />
                <span className="text-sm">Retards</span>
              </div>
            </div>
            <div className="lg:col-span-4 flex items-center justify-end gap-2">
              <Badge variant="outline">Résultats: {filtered.length}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Priorities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5" />
              Top priorités (à traiter)
            </CardTitle>
            <CardDescription>Les 5 dossiers les plus critiques, basés sur le score santé</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.topPriorities.length === 0 ? (
              <p className="text-muted-foreground">Aucun dossier</p>
            ) : (
              kpis.topPriorities.map((p) => (
                <div key={p.code} className="flex items-start justify-between gap-3 p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-foreground">{p.code}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.client} → {p.dest}
                    </p>
                    {p.blockers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.blockers.map((b) => (
                          <Badge key={b} variant="secondary" className="text-xs">
                            {b}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <HealthBadge bucket={p.score >= 80 ? 'OK' : p.score >= 55 ? 'A_SURVEILLER' : 'RISQUE'} score={p.score} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Dossiers (filtrés)
            </CardTitle>
            <CardDescription>
              Tri par criticité (score santé croissant). Clique sur export pour partager l'état des lieux.
            </CardDescription>
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
                    <TableHead>Santé</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead>Docs à faire</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        Aucun résultat
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(({ flow, health: h }) => {
                      const charges =
                        flow.cost_transport +
                        flow.cost_customs_clearance +
                        flow.cost_duties +
                        flow.cost_import_vat +
                        flow.cost_octroi_mer +
                        flow.cost_octroi_mer_regional +
                        flow.cost_other;
                      return (
                        <TableRow key={flow.id} className={cn(h.isOverdue && 'bg-[hsl(var(--status-risk))]/5')}>
                          <TableCell className="font-medium text-primary">{flow.flow_code}</TableCell>
                          <TableCell>{flow.client_name}</TableCell>
                          <TableCell>{flow.destination}</TableCell>
                          <TableCell>
                            <StatusBadge status={flow.zone} type="zone" />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{flow.incoterm}</Badge>
                          </TableCell>
                          <TableCell>
                            <HealthBadge bucket={h.bucket} score={h.score} />
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(flow.goods_value)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(charges)}</TableCell>
                          <TableCell>
                            {h.missing.length === 0 && h.blockers.length === 0 ? (
                              <span className="text-sm text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {h.blockers.slice(0, 1).map((b) => (
                                  <Badge key={b} className="text-xs" variant="destructive">
                                    {b}
                                  </Badge>
                                ))}
                                {h.missing.slice(0, 2).map((m) => (
                                  <Badge key={m} className="text-xs" variant="secondary">
                                    {m}
                                  </Badge>
                                ))}
                                {(h.missing.length + h.blockers.length > 3) && (
                                  <Badge className="text-xs" variant="outline">
                                    +{h.missing.length + h.blockers.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
