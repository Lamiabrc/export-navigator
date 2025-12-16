import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { incotermRules, destinationProfiles, deductibilityRules } from '@/data/mockData';
import { 
  Settings as SettingsIcon, 
  Users, 
  Database,
  FileText,
  Save,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Settings() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="mt-1 text-muted-foreground">Configuration et administration du système</p>
        </div>

        <Tabs defaultValue="incoterms" className="space-y-6">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="incoterms" className="gap-2">
              <FileText className="h-4 w-4" />
              Incoterms
            </TabsTrigger>
            <TabsTrigger value="destinations" className="gap-2">
              <Database className="h-4 w-4" />
              Destinations
            </TabsTrigger>
            <TabsTrigger value="deductibility" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              Déductibilité
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Utilisateurs
            </TabsTrigger>
          </TabsList>

          {/* Incoterms Tab */}
          <TabsContent value="incoterms">
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Règles Incoterms</h3>
                <Button size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  Enregistrer
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Incoterm</th>
                      <th>Transport</th>
                      <th>Douane export</th>
                      <th>Douane import</th>
                      <th>Droits</th>
                      <th>TVA import</th>
                      <th>OM/OMR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incotermRules.map(rule => (
                      <tr key={rule.incoterm}>
                        <td className="font-semibold text-primary">{rule.incoterm}</td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.payer_transport === 'Fournisseur' ? 'text-chart-2' : 'text-chart-3'
                          }`}>
                            {rule.payer_transport}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.payer_customs_export === 'Fournisseur' ? 'text-chart-2' : 'text-chart-3'
                          }`}>
                            {rule.payer_customs_export}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.payer_customs_import === 'Fournisseur' ? 'text-chart-2' : 'text-chart-3'
                          }`}>
                            {rule.payer_customs_import}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.payer_duties === 'Fournisseur' ? 'text-chart-2' : 'text-chart-3'
                          }`}>
                            {rule.payer_duties}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.payer_import_vat === 'Fournisseur' ? 'text-chart-2' : 'text-chart-3'
                          }`}>
                            {rule.payer_import_vat}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.payer_octroi_mer === 'Fournisseur' ? 'text-chart-2' : 'text-chart-3'
                          }`}>
                            {rule.payer_octroi_mer}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-muted/50 text-sm text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded bg-chart-2 mr-2"></span>
                Fournisseur
                <span className="inline-block w-3 h-3 rounded bg-chart-3 ml-4 mr-2"></span>
                Client
              </div>
            </div>
          </TabsContent>

          {/* Destinations Tab */}
          <TabsContent value="destinations">
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Profils Destinations</h3>
                <Button size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  Enregistrer
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Destination</th>
                      <th>Zone</th>
                      <th>TVA</th>
                      <th>OM/OMR</th>
                      <th>Documents requis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {destinationProfiles.map(profile => (
                      <tr key={profile.destination}>
                        <td className="font-medium text-foreground">{profile.destination}</td>
                        <td>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            profile.zone === 'UE' ? 'badge-ue' :
                            profile.zone === 'DROM' ? 'badge-drom' :
                            'badge-hors-ue'
                          }`}>
                            {profile.zone}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm ${profile.tva_applicable ? 'text-status-ok' : 'text-muted-foreground'}`}>
                            {profile.tva_applicable ? 'Oui' : 'Non'}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm ${profile.om_applicable ? 'text-status-warning' : 'text-muted-foreground'}`}>
                            {profile.om_applicable ? 'Oui' : 'Non'}
                          </span>
                        </td>
                        <td className="text-sm text-muted-foreground max-w-xs truncate">
                          {profile.documents_required.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Deductibility Tab */}
          <TabsContent value="deductibility">
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Règles de déductibilité</h3>
                <Button size="sm" className="gap-2">
                  <Save className="h-4 w-4" />
                  Enregistrer
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Type de charge</th>
                      <th>Déductible fournisseur</th>
                      <th>Déductible client</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deductibilityRules.map((rule, index) => (
                      <tr key={index}>
                        <td>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.zone === 'UE' ? 'badge-ue' :
                            rule.zone === 'DROM' ? 'badge-drom' :
                            'badge-hors-ue'
                          }`}>
                            {rule.zone}
                          </span>
                        </td>
                        <td className="font-medium">{rule.charge_type}</td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.deductible_supplier === 'Oui' ? 'text-status-ok' :
                            rule.deductible_supplier === 'Non' ? 'text-status-risk' :
                            'text-status-warning'
                          }`}>
                            {rule.deductible_supplier}
                          </span>
                        </td>
                        <td>
                          <span className={`text-sm font-medium ${
                            rule.deductible_client === 'Oui' ? 'text-status-ok' :
                            rule.deductible_client === 'Non' ? 'text-status-risk' :
                            'text-status-warning'
                          }`}>
                            {rule.deductible_client}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="bg-card rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-6">
                <Users className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Gestion des utilisateurs</h3>
                  <p className="text-sm text-muted-foreground">
                    Connectez Lovable Cloud pour activer l'authentification et la gestion des rôles
                  </p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  La gestion des utilisateurs nécessite une base de données.
                </p>
                <Button>Connecter Lovable Cloud</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
