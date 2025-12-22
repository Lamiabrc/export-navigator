import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle, ExternalLink, FileDown, FileUp, Gauge, Info, Shield, ShieldAlert, TrendingDown, TrendingUp } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { reconcile } from '@/lib/reco/reconcile';
import { evaluateCase } from '@/lib/rules/riskEngine';
import { aggregateCases, margin, transitCoverage } from '@/lib/kpi/exportKpis';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useFeeBenchmarks } from '@/hooks/useFeeBenchmarks';
import { defaultProfitabilityReference } from '@/data/feeBenchmarks';
import { evaluateInvoiceProfitability } from '@/lib/analysis/invoiceProfitability';
import { incotermPayerRules, type IncotermPayerRule, getZoneFromDestination, getVatRateForDestination } from '@/data/referenceRates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { exportCircuits } from '@/data/exportCircuits';
import { getTransitaireById } from '@/data/transitaires';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SageInvoice } from '@/types/sage';
import type { CostDoc } from '@/types/costs';
import type { ExportCase } from '@/types/case';
import { COST_DOCS_KEY, SAGE_INVOICES_KEY } from '@/lib/constants/storage';

type GuidanceSeverity = 'ok' | 'warn' | 'alert';

interface QuestionPreset {
  id: string;
  label: string;
  build: (ctx: {
    incotermRule: IncotermPayerRule | null;
    zone: ReturnType<typeof getZoneFromDestination> | null;
    vatRate: ReturnType<typeof getVatRateForDestination> | null;
    coverage: ReturnType<typeof transitCoverage> | null;
    circuitName?: string;
    intermediaries: string[];
  }) => {
    title: string;
    bullets: string[];
    severity: GuidanceSeverity;
  };
}

const statusBadge = (status: ExportCase['matchStatus']) => {
  switch (status) {
    case 'match':
      return <Badge className="bg-green-100 text-green-700 border-green-200">Match OK</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partiel</Badge>;
    default:
      return <Badge variant="outline">Aucun</Badge>;
  }
};

const alertBadge = (alertsCount: number, hasBlocker: boolean) => {
  if (alertsCount === 0) return <Badge variant="outline">Aucune alerte</Badge>;
  if (hasBlocker)
    return <Badge className="bg-red-100 text-red-700 border-red-200">{alertsCount} alerte(s)</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{alertsCount} alerte(s)</Badge>;
};

export default function Invoices() {
  const [sageInvoices] = useLocalStorage<SageInvoice[]>(SAGE_INVOICES_KEY, []);
  const [costDocs] = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);
  const { referenceData } = useReferenceData();
  const { benchmarks, saveBenchmarks, resetBenchmarks } = useFeeBenchmarks();
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedQuestion, setSelectedQuestion] = useState<string>('tva');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cases = useMemo(() => {
    const base = reconcile(sageInvoices, costDocs);
    return base.map((c) => {
      const risk = evaluateCase(c, referenceData);
      return { ...c, alerts: risk.alerts, riskScore: risk.riskScore };
    });
  }, [sageInvoices, costDocs, referenceData]);

  const aggregates = useMemo(() => aggregateCases(cases), [cases]);
  const matchCounts = useMemo(
    () =>
      cases.reduce(
        (acc, c) => {
          acc[c.matchStatus] += 1;
          return acc;
        },
        { match: 0, partial: 0, none: 0 } as Record<ExportCase['matchStatus'], number>
      ),
    [cases]
  );

  useEffect(() => {
    if (cases.length > 0 && !selectedCaseId) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) ?? cases[0],
    [cases, selectedCaseId]
  );

  const profitability = useMemo(
    () => (selectedCase ? evaluateInvoiceProfitability(selectedCase, benchmarks) : null),
    [selectedCase, benchmarks]
  );

  const feeChartData = useMemo(
    () =>
      profitability
        ? profitability.feeGaps.map((gap) => ({
            label: gap.label,
            actual: Number(gap.ratio.toFixed(2)),
            target: gap.target,
            max: gap.max,
            status: gap.status,
          }))
        : [],
    [profitability]
  );

  const selectedIncotermRule = useMemo(() => {
    if (!selectedCase?.invoice.incoterm) return null;
    return incotermPayerRules.find((r) => r.incoterm === selectedCase.invoice.incoterm) ?? null;
  }, [selectedCase]);

  const selectedZone = useMemo(
    () => (selectedCase?.invoice.destination ? getZoneFromDestination(selectedCase.invoice.destination) : null),
    [selectedCase]
  );

  const selectedVatRate = useMemo(
    () => (selectedCase?.invoice.destination ? getVatRateForDestination(selectedCase.invoice.destination) : null),
    [selectedCase]
  );

  const selectedCircuit = useMemo(() => {
    if (!selectedCase) return null;
    return (
      exportCircuits.find((c) => c.id === selectedCase.invoice.flowCode) ||
      exportCircuits.find((c) => selectedCase.invoice.incoterm && c.incoterms.includes(selectedCase.invoice.incoterm))
    );
  }, [selectedCase]);

  const intermediaries = useMemo(
    () => (selectedCircuit ? selectedCircuit.transitaires.map((t) => getTransitaireById(t)).filter(Boolean) : []),
    [selectedCircuit]
  );

  const selectedCoverage = useMemo(
    () => (selectedCase ? transitCoverage(selectedCase) : null),
    [selectedCase]
  );

  const questionPresets: QuestionPreset[] = [
    {
      id: 'tva',
      label: 'Dois-je payer la TVA import ?',
      build: ({ incotermRule, zone, vatRate }) => {
        const payer = incotermRule?.tva_import ?? 'Client';
        const shouldPay = payer === 'Fournisseur';
        const severity: GuidanceSeverity = shouldPay ? 'alert' : 'ok';
        const bullets = [
          shouldPay
            ? "Incoterm DDP / prise en charge fournisseur = TVA import avancée (puis récupérable si justificatifs)."
            : "Incoterm non DDP : la TVA import est en principe due par le client/IOR.",
        ];
        if (zone === 'UE') {
          bullets.push('UE : autoliquidation possible si numéro TVA valide et facture intracom.');
        } else if (zone === 'DROM') {
          bullets.push('DROM : TVA payée à l’import (pas d’autoliquidation) ; conserver IM4/DAU.');
        }
        if (vatRate) {
          bullets.push(`Taux de référence destination : ${vatRate.rate_standard}% (${vatRate.notes}).`);
        }
        return {
          title: shouldPay ? 'Oui, TVA import à avancer' : 'Plutôt le client (sauf mandat DDP)',
          bullets,
          severity,
        };
      },
    },
    {
      id: 'droits',
      label: 'Qui paye droits / OM / OMR ?',
      build: ({ incotermRule, zone }) => {
        const payer = incotermRule?.droits_douane ?? incotermRule?.octroi_mer ?? 'Client';
        const shouldPay = payer === 'Fournisseur';
        const bullets = [
          shouldPay
            ? 'En DDP, le vendeur avance droits/OM/OMR et doit sécuriser la refacturation.'
            : 'En DAP/FCA, les droits et taxes import restent à la charge du client.',
        ];
        if (zone === 'DROM') {
          bullets.push('OM/OMR applicables : vérifier nomenclature et éventuelles exonérations.');
        } else if (zone === 'Hors UE') {
          bullets.push('Hors UE : droits variables ; valider la base taxable et préférences tarifaires.');
        }
        return {
          title: shouldPay ? 'Oui, droits/OM/OMR à payer ou avancer' : 'Client redevable des droits import',
          bullets,
          severity: shouldPay ? 'warn' : 'ok',
        };
      },
    },
    {
      id: 'transit',
      label: 'Dois-je prendre en charge transit / dédouanement ?',
      build: ({ incotermRule, coverage, circuitName, intermediaries }) => {
        const paysTransit =
          incotermRule?.transport_principal === 'Fournisseur' ||
          incotermRule?.dedouanement_import === 'Fournisseur' ||
          incotermRule?.dedouanement_export === 'Fournisseur';
        const uncovered = coverage ? Math.round(coverage.uncovered) : 0;
        const bullets = [
          paysTransit
            ? 'Incoterm implique la prise en charge du transport principal ou du dédouanement par le vendeur.'
            : 'Transit géré côté client : s’assurer que le transitaire facture directement le client.',
          uncovered > 0
            ? `Couverture transit actuelle : ${coverage ? Math.round(coverage.coverage * 100) : 0}% (reste ${uncovered.toLocaleString('fr-FR')} € non refacturé).`
            : 'Transit déjà couvert par la facture côté client.',
        ];
        if (circuitName) bullets.push(`Circuit : ${circuitName} (${intermediaries.length ? 'intermédiaires identifiés' : 'sans transitaire déclaré'}).`);
        return {
          title: paysTransit ? 'Oui, transit/dédouanement à sécuriser' : 'Transit à laisser au client',
          bullets,
          severity: paysTransit || uncovered > 0 ? 'warn' : 'ok',
        };
      },
    },
    {
      id: 'assurance',
      label: 'Qui doit assurer la marchandise ?',
      build: ({ incotermRule }) => {
        const payer = incotermRule?.assurance ?? 'Client';
        const shouldPay = payer === 'Fournisseur';
        const bullets = [
          shouldPay
            ? 'Incoterm ou contrat implique une assurance cargo côté vendeur (ex : CIP/CIF/DDP).'
            : 'Assurance à la charge du client ; demander attestation de couverture.',
          'Vérifier la valeur déclarée (facture + fret + 10%) et la zone couverte.',
        ];
        return {
          title: shouldPay ? 'Oui, assurance à souscrire' : 'Client responsable de l’assurance',
          bullets,
          severity: shouldPay ? 'warn' : 'ok',
        };
      },
    },
  ];

  const selectedQuestionPreset = questionPresets.find((q) => q.id === selectedQuestion);

  const questionGuidance = useMemo(
    () =>
      selectedQuestionPreset
        ? selectedQuestionPreset.build({
            incotermRule: selectedIncotermRule,
            zone: selectedZone,
            vatRate: selectedVatRate,
            coverage: selectedCoverage,
            circuitName: selectedCircuit?.name,
            intermediaries: intermediaries.map((i) => i?.name ?? 'Transitaire'),
          })
        : null,
    [
      selectedQuestionPreset,
      selectedIncotermRule,
      selectedZone,
      selectedVatRate,
      selectedCoverage,
      selectedCircuit?.name,
      intermediaries,
    ]
  );

  const downloadBenchmarks = (useTemplate = false) => {
    const payload = useTemplate ? defaultProfitabilityReference : benchmarks;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = useTemplate ? 'modele_benchmarks_frais.json' : 'benchmarks_frais_export_navigator.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBenchmarkImport = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        saveBenchmarks(parsed);
      } catch {
        // silently ignore malformed files; UI remains unchanged
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contrôle & Rapprochement factures</h1>
            <p className="text-muted-foreground">
              Factures Sage ↔ coûts réels (transit/douane) avec score de match et alertes
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/imports">
              <Button variant="outline">Aller aux imports CSV</Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Factures importées</p>
              <p className="text-2xl font-bold">{sageInvoices.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Match complet</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {matchCounts.match}
                <CheckCircle className="h-5 w-5 text-green-600" />
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Partiel</p>
              <p className="text-2xl font-bold text-amber-600">{matchCounts.partial}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Sans match</p>
              <p className="text-2xl font-bold text-muted-foreground">{matchCounts.none}</p>
            </CardContent>
          </Card>
        </div>

        {cases.length > 0 && profitability && selectedCase && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-primary" />
                    Diagnostic rentabilité facture
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Benchmarks locaux : {benchmarks.source} (maj {new Date(benchmarks.updatedAt).toLocaleDateString('fr-FR')})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                    <SelectTrigger className="w-[260px]">
                      <SelectValue placeholder="Choisir une facture" />
                    </SelectTrigger>
                    <SelectContent>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.invoice.invoiceNumber} — {c.invoice.clientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className={profitability.status === 'beneficiaire' ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'}>
                    {profitability.status === 'beneficiaire' ? 'Bénéficiaire' : 'Déficitaire'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between text-sm">
                      <span>Statut marge</span>
                      {profitability.status === 'beneficiaire' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-xl font-semibold">
                      {profitability.marginRate.toFixed(1)}% ({profitability.marginAmount.toLocaleString('fr-FR')} €)
                    </p>
                    <p className="text-xs text-muted-foreground">Seuil mini {benchmarks.minMarginRate}% • Alerte sous {benchmarks.cautionMarginRate}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between text-sm">
                      <span>Transit couvert</span>
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xl font-semibold">
                      {selectedCoverage ? Math.round(selectedCoverage.coverage * 100) : 0}% couvert
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Reste à refacturer : {selectedCoverage ? selectedCoverage.uncovered.toLocaleString('fr-FR') : 0} €
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between text-sm">
                      <span>Zone / incoterm</span>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-semibold">{selectedCase.invoice.incoterm || 'NC'}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCase.invoice.destination || 'Destination non renseignée'}
                    </p>
                  </div>
                </div>

                <div>
                  <Progress value={Math.min(100, Math.max(0, profitability.marginRate))} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>Marge réalisée vs 100% HT</span>
                    <span>Objectif interne : {benchmarks.cautionMarginRate}%</span>
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={feeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.25} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis unit="%" />
                      <Tooltip
                        formatter={(value, name, props) =>
                          name === 'max'
                            ? [`${value}%`, 'Plafond de référence']
                            : [`${value}%`, 'Ratio réel vs HT']
                        }
                        labelFormatter={(_, payload) => {
                          const data = payload && payload[0]?.payload;
                          return data ? `${data.label} • cible ${data.target}% / plafond ${data.max}%` : 'Référence';
                        }}
                      />
                      <ReferenceLine y={0} stroke="#ccc" />
                      <Bar dataKey="max" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.2} />
                      <Bar dataKey="actual" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">
                  Les ratios sont calculés en % du montant HT de la facture (benchmarks modifiables via fichier local).
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-primary" />
                  Référentiel local des frais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Reliez votre fichier JSON local (benchmarks de frais). Les données sont stockées en local et utilisées pour le diagnostic.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadBenchmarks()}>
                    <FileDown className="h-4 w-4 mr-1" />
                    Exporter l’actuel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadBenchmarks(true)}>
                    <FileDown className="h-4 w-4 mr-1" />
                    Modèle JSON
                  </Button>
                  <Button variant="default" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <FileUp className="h-4 w-4 mr-1" />
                    Importer un fichier
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => resetBenchmarks()}>
                    Réinitialiser
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => handleBenchmarkImport(e.target.files?.[0] || undefined)}
                />
                <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
                  <p className="font-medium text-foreground">Dernière mise à jour</p>
                  <p className="text-muted-foreground">
                    {new Date(benchmarks.updatedAt).toLocaleString('fr-FR')} • {benchmarks.notes?.[0] ?? 'Référentiel sans note'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {cases.length > 0 && selectedCase && (
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  Assistant taxes & intermédiaires
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Répond aux questions « dois-je payer… » selon incoterm, destination et chaîne de transitaires.
                </p>
              </div>
              <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {questionPresets.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Incoterm {selectedCase.invoice.incoterm || 'NC'}</Badge>
                <Badge variant="outline">{selectedCase.invoice.destination || 'Destination'}</Badge>
                {selectedCircuit && <Badge variant="secondary">{selectedCircuit.name}</Badge>}
                {intermediaries.length > 0 ? (
                  intermediaries.map((inter, idx) => (
                    <Badge key={`${inter?.id}-${idx}`} variant="outline" className="bg-primary/5">
                      {inter?.name}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">Transitaire non renseigné</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">Fournisseur</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">{intermediaries[0]?.name ?? 'Transitaire'}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">Client</Badge>
              </div>

              {questionGuidance && (
                <div
                  className={`p-4 rounded-lg border ${
                    questionGuidance.severity === 'alert'
                      ? 'bg-red-50 border-red-200'
                      : questionGuidance.severity === 'warn'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <p className="font-semibold">{questionGuidance.title}</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {questionGuidance.bullets.map((b, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rapprochements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Client / Destination</TableHead>
                    <TableHead className="text-right">HT</TableHead>
                    <TableHead>Rapprochement</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Couverture transit</TableHead>
                    <TableHead>Alertes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Importez des fichiers dans l’onglet Imports CSV pour lancer le rapprochement.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cases.map((c) => {
                      const coverage = transitCoverage(c);
                      const hasBlocker = (c.alerts || []).some((a) => a.severity === 'blocker');
                      const flowId = c.invoice.flowCode || c.costDocs[0]?.flowCode;
                      return (
                        <TableRow key={c.id} className="hover:bg-muted/40">
                          <TableCell className="font-medium">{c.invoice.invoiceNumber}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{c.invoice.clientName}</span>
                              <span className="text-xs text-muted-foreground">{c.invoice.destination || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.invoice.totalHT?.toLocaleString('fr-FR') || '-'}
                          </TableCell>
                          <TableCell>{statusBadge(c.matchStatus)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{Math.round(c.matchScore)}%</Badge>
                          </TableCell>
                          <TableCell>
                            {coverage.transitCosts > 0 ? (
                              <span className="text-sm">
                                {Math.round(coverage.coverage * 100)}%{' '}
                                <span className="text-muted-foreground">
                                  ({coverage.uncovered.toLocaleString('fr-FR')} non couvert)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">n/a</span>
                            )}
                          </TableCell>
                          <TableCell>{alertBadge(c.alerts?.length || 0, hasBlocker)}</TableCell>
                          <TableCell className="text-right">
                            {flowId ? (
                              <Link to={`/flows/${flowId}`}>
                                <Button variant="ghost" size="sm" className="gap-1">
                                  <ExternalLink className="h-4 w-4" />
                                  Voir dossier
                                </Button>
                              </Link>
                            ) : (
                              <Button variant="ghost" size="sm" disabled>
                                <Shield className="h-4 w-4 mr-1" />
                                Associer flux
                              </Button>
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

        {aggregates.topLosses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top dossiers en perte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {aggregates.topLosses.map((c) => {
                  const m = margin(c);
                  return (
                    <div key={c.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{c.invoice.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{c.invoice.clientName}</p>
                        </div>
                        <Badge variant="outline">Incoterm {c.invoice.incoterm || 'NC'}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-destructive">
                        Perte: {m.amount.toLocaleString('fr-FR')} ({m.rate.toFixed(1)}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {cases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alertes globales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {cases.flatMap((c) => c.alerts || []).length === 0 ? (
                  <Badge variant="outline">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aucune alerte
                  </Badge>
                ) : (
                  cases.flatMap((c) => c.alerts || []).map((alert) => (
                    <Badge
                      key={`${alert.code}-${alert.id}`}
                      className={`flex items-center gap-1 ${
                        alert.severity === 'blocker'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : alert.severity === 'warning'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-blue-100 text-blue-700 border-blue-200'
                      }`}
                    >
                      {alert.severity === 'blocker' ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      {alert.code}
                    </Badge>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
