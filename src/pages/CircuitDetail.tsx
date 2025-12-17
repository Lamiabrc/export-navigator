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
  Send
} from 'lucide-react';

const zoneColors: Record<string, string> = {
  'UE': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Hors UE': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'DROM': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Multiple': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const payerColors: Record<string, string> = {
  'Fournisseur': 'bg-blue-500/10 text-blue-700',
  'Client': 'bg-green-500/10 text-green-700',
  'Variable': 'bg-orange-500/10 text-orange-700',
};

const transitaireColors: Record<string, string> = {
  'DHL': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  'LVoverseas': 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  'Geodis': 'bg-red-500/10 text-red-700 border-red-500/30',
  'TDIS': 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  'Client': 'bg-green-500/10 text-green-700 border-green-500/30',
  'Autre': 'bg-gray-500/10 text-gray-700 border-gray-500/30',
};

export default function CircuitDetail() {
  const { id } = useParams<{ id: string }>();
  const circuit = id ? getCircuitById(id) : undefined;

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
    .map(id => transitaires.find(t => t.id === id))
    .filter(Boolean);

  // Generate mermaid diagram for the flow
  const generateMermaidDiagram = () => {
    const steps = circuit.steps.map((step, i) => {
      const nodeId = `step${i}`;
      const label = `${step.label}\\n(${step.actor})`;
      return { nodeId, label };
    });

    let diagram = 'graph LR\n';
    steps.forEach((step, i) => {
      diagram += `    ${step.nodeId}["${step.label}"]\n`;
      if (i < steps.length - 1) {
        diagram += `    ${step.nodeId} --> step${i + 1}\n`;
      }
    });

    // Add styling
    diagram += '\n    style step0 fill:#3b82f6,color:#fff\n';
    diagram += `    style step${steps.length - 1} fill:#22c55e,color:#fff\n`;

    return diagram;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
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
            <Badge variant="outline" className={zoneColors[circuit.zone]}>
              {circuit.zone}
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {circuit.incoterm}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="schema" className="space-y-6">
          <TabsList>
            <TabsTrigger value="schema">Schéma du flux</TabsTrigger>
            <TabsTrigger value="transitaires">Transitaires</TabsTrigger>
            <TabsTrigger value="costs">Coûts</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="risks">Risques & Conseils</TabsTrigger>
          </TabsList>

          {/* Schema Tab */}
          <TabsContent value="schema" className="space-y-6">
            {/* Visual Flow Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Flux simplifié</CardTitle>
                <CardDescription>Visualisation du circuit export</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center gap-2 flex-wrap p-4 bg-muted/50 rounded-lg overflow-x-auto">
                  {circuit.steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                      <div className={`px-3 py-2 rounded-lg border text-sm font-medium text-center min-w-[100px] ${
                        index === 0 ? 'bg-primary text-primary-foreground' : 
                        index === circuit.steps.length - 1 ? 'bg-green-500 text-white' : 'bg-background'
                      }`}>
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
                <CardDescription>Description de chaque étape du flux</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Flow Diagram */}
                <div className="relative">
                  <div className="flex flex-col gap-4">
                    {circuit.steps.map((step, index) => (
                      <div key={step.id} className="flex items-start gap-4">
                        {/* Step number and connector */}
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          {index < circuit.steps.length - 1 && (
                            <div className="w-0.5 h-8 bg-border mt-2" />
                          )}
                        </div>
                        
                        {/* Step content */}
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transitaires Tab */}
          <TabsContent value="transitaires" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Transitaires pour ce circuit
                </CardTitle>
                <CardDescription>Partenaires logistiques recommandés selon le type de flux</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {circuitTransitaires.map((transitaire) => transitaire && (
                    <div 
                      key={transitaire.id}
                      className={`p-4 rounded-lg border-2 ${transitaireColors[transitaire.id]}`}
                    >
                      <h4 className="font-semibold text-lg">{transitaire.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{transitaire.speciality}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {transitaire.zones.map(zone => (
                          <Badge key={zone} variant="secondary" className="text-xs">
                            {zone}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Document Distribution */}
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
                    <div 
                      key={index}
                      className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          {dist.document}
                        </div>
                        {dist.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{dist.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {dist.recipients.map(recipient => (
                          <Badge 
                            key={recipient} 
                            variant="outline"
                            className={transitaireColors[recipient]}
                          >
                            {recipient}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Visual Document Flow */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Flux documentaire</CardTitle>
                <CardDescription>Visualisation de la distribution des documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium">
                    🏢 ORLIMAN
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {circuit.transitaires.map(t => {
                      const trans = transitaires.find(tr => tr.id === t);
                      return (
                        <div key={t} className={`px-3 py-2 rounded-lg border text-center ${transitaireColors[t]}`}>
                          📦 {trans?.name || t}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-5 w-5" />
                  Répartition des coûts
                </CardTitle>
                <CardDescription>Qui paie quoi selon ce circuit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {circuit.costItems.map((cost) => (
                    <div 
                      key={cost.id} 
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{cost.label}</div>
                        <div className="text-sm text-muted-foreground">{cost.description}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {cost.typical_percentage && (
                          <span className="text-sm text-muted-foreground font-mono">
                            {cost.typical_percentage}
                          </span>
                        )}
                        <Badge className={payerColors[cost.payer]}>
                          {cost.payer}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cost Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-blue-500/5 border-blue-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-700">À charge Fournisseur</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {circuit.costItems.filter(c => c.payer === 'Fournisseur').map(c => (
                      <li key={c.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-blue-600" />
                        {c.label}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-green-500/5 border-green-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-700">À charge Client</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {circuit.costItems.filter(c => c.payer === 'Client').map(c => (
                      <li key={c.id} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                        {c.label}
                      </li>
                    ))}
                    {circuit.costItems.filter(c => c.payer === 'Client').length === 0 && (
                      <li className="text-muted-foreground italic">Aucun coût direct</li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-orange-500/5 border-orange-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-orange-700">Variable (selon accord)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {circuit.costItems.filter(c => c.payer === 'Variable').map(c => (
                      <li key={c.id} className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-orange-600" />
                        {c.label}
                      </li>
                    ))}
                    {circuit.costItems.filter(c => c.payer === 'Variable').length === 0 && (
                      <li className="text-muted-foreground italic">Tous les coûts sont définis</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Documents Tab */}
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

          {/* Risks Tab */}
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
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <Link to="/simulator">
            <Button>
              <Euro className="h-4 w-4 mr-2" />
              Simuler les coûts
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
