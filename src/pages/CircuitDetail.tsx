import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { getCircuitById } from '@/data/exportCircuits';
import { transitaires } from '@/data/transitaires';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Euro,
  ArrowRight,
  Truck,
  Send,
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useImportedInvoices } from '@/hooks/useImportedInvoices';
import type { CostDoc } from '@/types/costs';
import { COST_DOCS_KEY } from '@/lib/constants/storage';
import { reconcile } from '@/lib/reco/reconcile';
import { evaluateCase } from '@/lib/rules/riskEngine';
import { useReferenceData } from '@/hooks/useReferenceData';
import { zoneLabel } from '@/types/circuits';

const zoneColors: Record<string, string> = {
  UE: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  HORS_UE: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  DROM: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  MULTI: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const payerColors: Record<string, string> = {
  SELLER: 'bg-blue-500/10 text-blue-700',
  BUYER: 'bg-green-500/10 text-green-700',
  VARIABLE: 'bg-orange-500/10 text-orange-700',
};

const transitaireColors: Record<string, string> = {
  DHL: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  LVoverseas: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  Geodis: 'bg-red-500/10 text-red-700 border-red-500/30',
  TDIS: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  Client: 'bg-green-500/10 text-green-700 border-green-500/30',
  Autre: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
};

const payerLabel = (payer: 'SELLER' | 'BUYER' | 'VARIABLE') => {
  if (payer === 'SELLER') return 'Fournisseur';
  if (payer === 'BUYER') return 'Client';
  return 'Variable';
};

export default function CircuitDetail() {
  const { id } = useParams<{ id: string }>();
  const circuit = id ? getCircuitById(id) : undefined;
  const { value: importedInvoices } = useImportedInvoices();
  const { value: costDocs } = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);
  const { referenceData } = useReferenceData();

  const relatedCases = useMemo(() => {
    if (!id) return [];
    const base = reconcile(importedInvoices, costDocs);
    return base
      .filter((c) => c.invoice.flowCode === id || c.costDocs.some((doc) => doc.flowCode === id))
      .map((c) => {
        const risk = evaluateCase(c, referenceData);
        return { ...c, alerts: risk.alerts, riskScore: risk.riskScore };
      });
  }, [id, importedInvoices, costDocs, referenceData]);

  const caseAlerts = useMemo(() => relatedCases.flatMap((c) => c.alerts || []), [relatedCases]);

  if (!circuit) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <h2 className="text-xl font-semibold mb-4">Circuit non trouvé</h2>
          <Link to="/flows">
            <Button>Retour aux circuits</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const circuitTransitaires = circuit.transitaires
    .map((transId) => transitaires.find((t) => t.id === transId))
    .filter(Boolean);

  const displayIncoterm = circuit.defaultIncoterm ?? circuit.incoterms[0];
  const incotermIsDDP = displayIncoterm === 'DDP';
  const showVatCard = circuit.zone === 'DROM' || incotermIsDDP || !!circuit.vatRules;

  const vatInfo = useMemo(
    () =>
      circuit.vatRules || {
        context: 'DDP export',
        importerOfRecord: 'Transitaire mandaté au nom du vendeur (IOR) ; vérifier qui figure sur le DAU/IM4.',
        payerImportVat: 'Vendeur (DDP) avance TVA import via transitaire.',
        payerDuties: 'Vendeur prend droits et taxes import en DDP (refacturation possible si contrat).',
        taxRecovery:
          "TVA import récupérable si vendeur assujetti avec DAU à son nom + facture transitaire. OM/OMR non récupérables.",
        autoliquidation: "DROM : pas d'autoliquidation. Hors UE : autoliquidation possible (AI2) selon schéma local.",
        traceability: 'Conserver DAU/IM4, quittances TVA/OM/OMR, preuve livraison, rapprochement facture client.',
        checks: [
          'Confirmer IOR sur DAU/IM4',
          'Mandat écrit avec transitaire',
          'Demander ventilation TVA/OM/OMR + frais',
          'Aligner incoterm DDP avec conditions de facture',
        ],
        warnings: ['Sans justificatifs, TVA non récupérable'],
      },
    [circuit.vatRules]
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <Link to="/flows" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour aux circuits
            </Link>
            <h1 className="text-2xl font-bold text-foreground">{circuit.name}</h1>
            <p className="mt-1 text-muted-foreground max-w-3xl">{circuit.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={zoneColors[circuit.zone] ?? 'bg-gray-100 text-gray-600'}>
              {zoneLabel(circuit.zone)}
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {displayIncoterm}
            </Badge>
          </div>
        </div>

        {showVatCard && (
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                TVA / DROM / DDP
              </CardTitle>
              <CardDescription>
                Synthèse des rôles et paiements TVA/droits pour ce montage ({vatInfo.context})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-muted/40">
                  <p className="text-xs uppercase text-muted-foreground">Importateur (IOR)</p>
                  <p className="font-medium text-foreground">{vatInfo.importerOfRecord}</p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/40">
                  <p className="text-xs uppercase text-muted-foreground">Qui paie douane / taxes</p>
                  <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
                    <li>{vatInfo.payerImportVat}</li>
                    <li>{vatInfo.payerDuties}</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-xs uppercase text-muted-foreground">Récup TVA</p>
                  <p className="text-sm text-foreground">{vatInfo.taxRecovery}</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-xs uppercase text-muted-foreground">Autoliquidation / traçabilité</p>
                  <p className="text-sm text-foreground">
                    {vatInfo.autoliquidation}
                    {vatInfo.traceability ? ` — ${vatInfo.traceability}` : ''}
                  </p>
                </div>
              </div>
              {vatInfo.checks && (
                <div className="p-3 rounded-lg border bg-muted/40">
                  <p className="text-xs uppercase text-muted-foreground mb-2">À demander au transitaire / douane</p>
                  <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
                    {vatInfo.checks.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {vatInfo.warnings && vatInfo.warnings.length > 0 && (
                <div className="p-3 rounded-lg border border-orange-200 bg-orange-50">
                  <p className="text-xs uppercase text-orange-700 mb-2">Points d'attention</p>
                  <ul className="text-sm text-orange-900 space-y-1 list-disc list-inside">
                    {vatInfo.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="schema" className="space-y-6">
          <TabsList>
            <TabsTrigger value="schema">Schema du circuit</TabsTrigger>
            <TabsTrigger value="transitaires">Transitaires</TabsTrigger>
            <TabsTrigger value="Couts">Couts</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="risks">Risques & Conseils</TabsTrigger>
          </TabsList>

          <TabsContent value="schema" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Circuit simplifie</CardTitle>
                <CardDescription>Visualisation du circuit export</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-2 flex-wrap p-4 bg-muted/50 rounded-lg overflow-x-auto">
                  {circuit.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div
                        className={`px-3 py-2 rounded-lg border text-sm font-medium text-center min-w-[100px] ${
                          index === 0
                            ? 'bg-primary text-primary-foreground'
                            : index === circuit.steps.length - 1
                            ? 'bg-green-500 text-white'
                            : 'bg-background'
                        }`}
                      >
                        <div className="text-xs opacity-80 mb-1">{step.actor}</div>
                        {step.label}
                      </div>
                      {index < circuit.steps.length - 1 && (
                        <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Étapes détaillées</CardTitle>
                <CardDescription>Description de chaque étape du Circuit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {circuit.steps.map((step, index) => (
                    <div key={step.id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        {index < circuit.steps.length - 1 && <div className="w-0.5 h-8 bg-border mt-2" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-foreground">{step.label}</h4>
                            <Badge variant="outline" className="text-xs">
                              {step.actor}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transitaires" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Transitaires pour ce circuit
                </CardTitle>
                <CardDescription>Partenaires logistiques recommandés selon le type de Circuit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {circuitTransitaires.map(
                    (transitaire) =>
                      transitaire && (
                        <div key={transitaire.id} className={`p-4 rounded-lg border-2 ${transitaireColors[transitaire.id]}`}>
                          <h4 className="font-semibold text-lg">{transitaire.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{transitaire.speciality}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {transitaire.zones.map((zone) => (
                              <Badge key={zone} variant="secondary" className="text-xs">
                                {zone}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Distribution des documents
                </CardTitle>
                <CardDescription>Quel document envoyer à quel transitaire</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {circuit.documentDistribution.map((dist, index) => (
                    <div key={index} className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          {dist.document}
                        </div>
                        {dist.notes && <p className="text-sm text-muted-foreground mt-1">{dist.notes}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {dist.recipients.map((recipient) => (
                          <Badge key={recipient} variant="outline" className={transitaireColors[recipient]}>
                            {recipient}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="Couts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-5 w-5" />
                  Répartition des Couts
                </CardTitle>
                <CardDescription>Qui paie quoi selon ce circuit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {circuit.costItems.map((cost) => (
                    <div key={cost.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium">{cost.label}</div>
                        <div className="text-sm text-muted-foreground">{cost.description}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {cost.typicalPct && (
                          <span className="text-sm text-muted-foreground font-mono">
                            {cost.typicalPct.min}-{cost.typicalPct.max}%/{cost.typicalPct.basis === 'value' ? 'valeur' : 'fret'}
                          </span>
                        )}
                        <Badge className={payerColors[cost.payer]}>{payerLabel(cost.payer)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Déclarations obligatoires
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {circuit.declarationsRequired.map((doc, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents requis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {circuit.documentsRequired.map((doc, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{doc}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risks" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-orange-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <AlertTriangle className="h-5 w-5" />
                    Points de vigilance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {circuit.risks.map((risk, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-green-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                    Bonnes pratiques
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {circuit.bestPractices.map((practice, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{practice}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Alertes rapprochées (factures / Couts)
                </CardTitle>
                <CardDescription>Issues détectées par le moteur de règles sur ce circuit</CardDescription>
              </CardHeader>
              <CardContent>
                {caseAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune alerte détectée sur ce circuit.</p>
                ) : (
                  <div className="space-y-3">
                    {caseAlerts.map((alert, idx) => (
                      <div
                        key={`${alert.code}-${idx}`}
                        className={`p-3 rounded-lg border ${
                          alert.severity === 'blocker'
                            ? 'border-red-200 bg-red-50'
                            : alert.severity === 'warning'
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-blue-200 bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{alert.code}</span>
                          <Badge variant="outline">{alert.severity}</Badge>
                        </div>
                        <p className="text-sm text-foreground mt-1">{alert.message}</p>
                        {alert.suggestion && <p className="text-xs text-muted-foreground mt-1">Action : {alert.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-4 pt-4 border-t">
          <Link to="/simulator">
            <Button>
              <Euro className="h-4 w-4 mr-2" />
              Simuler les Couts
            </Button>
          </Link>
          <Link to="/invoices">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Contrôle factures
            </Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}





