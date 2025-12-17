import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { incotermRules, destinationProfiles, deductibilityRules } from '@/data/mockData';
import { useReferenceRates } from '@/hooks/useReferenceRates';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon, 
  Users, 
  Database,
  FileText,
  Save,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const {
    vatRates,
    octroiMerRates,
    transportCosts,
    serviceCharges,
    updateVatRate,
    updateOmRate,
    updateTransportCost,
    updateServiceCharge,
    resetToDefaults,
  } = useReferenceRates();

  const [editingVat, setEditingVat] = useState<Record<number, Partial<typeof vatRates[0]>>>({});
  const [editingOm, setEditingOm] = useState<Record<number, Partial<typeof octroiMerRates[0]>>>({});
  const [editingTransport, setEditingTransport] = useState<Record<number, Partial<typeof transportCosts[0]>>>({});

  const handleSaveVatRate = (index: number) => {
    if (editingVat[index]) {
      updateVatRate(index, editingVat[index]);
      setEditingVat(prev => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      toast.success('Taux TVA mis à jour');
    }
  };

  const handleSaveOmRate = (index: number) => {
    if (editingOm[index]) {
      updateOmRate(index, editingOm[index]);
      setEditingOm(prev => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      toast.success('Taux OM mis à jour');
    }
  };

  const handleSaveTransportCost = (index: number) => {
    if (editingTransport[index]) {
      updateTransportCost(index, editingTransport[index]);
      setEditingTransport(prev => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
      toast.success('Coût transport mis à jour');
    }
  };

  const handleResetAll = () => {
    resetToDefaults();
    setEditingVat({});
    setEditingOm({});
    setEditingTransport({});
    toast.success('Taux réinitialisés aux valeurs par défaut');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="mt-1 text-muted-foreground">Configuration et administration du système</p>
        </div>

        <Tabs defaultValue="incoterms" className="space-y-6">
          <TabsList className="bg-muted p-1 flex-wrap h-auto gap-1">
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
            <TabsTrigger value="charges" className="gap-2">
              <Calculator className="h-4 w-4" />
              Charges et Taxes
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

          {/* Charges et Taxes Tab */}
          <TabsContent value="charges">
            <div className="space-y-6">
              {/* Header with reset button */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Gestion des taux et charges</h3>
                  <p className="text-sm text-muted-foreground">
                    {isAdmin ? 'Modifiez les taux utilisés dans le calculateur' : 'Consultation uniquement (accès admin requis pour modifier)'}
                  </p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleResetAll}>
                    <RotateCcw className="h-4 w-4" />
                    Réinitialiser
                  </Button>
                )}
              </div>

              {/* TVA Rates */}
              <div className="bg-card rounded-xl border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h4 className="font-semibold text-foreground">Taux de TVA par destination</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Destination</th>
                        <th>Zone</th>
                        <th>Taux standard (%)</th>
                        <th>Taux LPPR (%)</th>
                        <th>Autoliquidation</th>
                        <th>Notes</th>
                        {isAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {vatRates.map((rate, index) => (
                        <tr key={rate.destination}>
                          <td className="font-medium text-foreground">{rate.destination}</td>
                          <td>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              rate.zone === 'UE' ? 'badge-ue' :
                              rate.zone === 'DROM' ? 'badge-drom' :
                              'badge-hors-ue'
                            }`}>
                              {rate.zone}
                            </span>
                          </td>
                          <td>
                            {isAdmin && editingVat[index] !== undefined ? (
                              <Input
                                type="number"
                                step="0.1"
                                className="w-20 h-8"
                                value={editingVat[index]?.rate_standard ?? rate.rate_standard}
                                onChange={(e) => setEditingVat(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], rate_standard: parseFloat(e.target.value) || 0 }
                                }))}
                              />
                            ) : (
                              <span className="font-mono">{rate.rate_standard}%</span>
                            )}
                          </td>
                          <td>
                            {isAdmin && editingVat[index] !== undefined ? (
                              <Input
                                type="number"
                                step="0.1"
                                className="w-20 h-8"
                                value={editingVat[index]?.rate_lppr ?? rate.rate_lppr}
                                onChange={(e) => setEditingVat(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], rate_lppr: parseFloat(e.target.value) || 0 }
                                }))}
                              />
                            ) : (
                              <span className="font-mono text-primary">{rate.rate_lppr}%</span>
                            )}
                          </td>
                          <td>
                            <span className={rate.autoliquidation ? 'text-status-ok' : 'text-muted-foreground'}>
                              {rate.autoliquidation ? 'Oui' : 'Non'}
                            </span>
                          </td>
                          <td className="text-sm text-muted-foreground max-w-xs truncate">{rate.notes}</td>
                          {isAdmin && (
                            <td>
                              {editingVat[index] !== undefined ? (
                                <Button size="sm" onClick={() => handleSaveVatRate(index)}>
                                  <Save className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => setEditingVat(prev => ({ ...prev, [index]: {} }))}>
                                  Modifier
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Octroi de Mer Rates */}
              <div className="bg-card rounded-xl border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h4 className="font-semibold text-foreground">Taux Octroi de Mer / OMR</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Destination</th>
                        <th>Catégorie</th>
                        <th>Code nomenclature</th>
                        <th>Taux OM (%)</th>
                        <th>Taux OMR (%)</th>
                        <th>Exonération</th>
                        {isAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {octroiMerRates.map((rate, index) => (
                        <tr key={`${rate.destination}-${rate.category}`}>
                          <td className="font-medium text-foreground">{rate.destination}</td>
                          <td>
                            <span className={`text-sm ${rate.category === 'Orthopédie' ? 'text-primary font-medium' : ''}`}>
                              {rate.category}
                            </span>
                          </td>
                          <td className="font-mono text-sm">{rate.code_nomenclature}</td>
                          <td>
                            {isAdmin && editingOm[index] !== undefined ? (
                              <Input
                                type="number"
                                step="0.5"
                                className="w-20 h-8"
                                value={editingOm[index]?.om_rate ?? rate.om_rate}
                                onChange={(e) => setEditingOm(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], om_rate: parseFloat(e.target.value) || 0 }
                                }))}
                              />
                            ) : (
                              <span className="font-mono">{rate.om_rate}%</span>
                            )}
                          </td>
                          <td>
                            {isAdmin && editingOm[index] !== undefined ? (
                              <Input
                                type="number"
                                step="0.5"
                                className="w-20 h-8"
                                value={editingOm[index]?.omr_rate ?? rate.omr_rate}
                                onChange={(e) => setEditingOm(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], omr_rate: parseFloat(e.target.value) || 0 }
                                }))}
                              />
                            ) : (
                              <span className="font-mono">{rate.omr_rate}%</span>
                            )}
                          </td>
                          <td>
                            <span className={rate.exoneration_possible ? 'text-status-ok' : 'text-muted-foreground'}>
                              {rate.exoneration_possible ? 'Oui' : 'Non'}
                            </span>
                          </td>
                          {isAdmin && (
                            <td>
                              {editingOm[index] !== undefined ? (
                                <Button size="sm" onClick={() => handleSaveOmRate(index)}>
                                  <Save className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => setEditingOm(prev => ({ ...prev, [index]: {} }))}>
                                  Modifier
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transport Costs */}
              <div className="bg-card rounded-xl border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h4 className="font-semibold text-foreground">Coûts de transport estimés</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Destination</th>
                        <th>Mode</th>
                        <th>€/kg</th>
                        <th>Minimum (€)</th>
                        <th>Transit (jours)</th>
                        <th>Notes</th>
                        {isAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {transportCosts.map((cost, index) => (
                        <tr key={`${cost.destination}-${cost.transport_mode}`}>
                          <td className="font-medium text-foreground">{cost.destination}</td>
                          <td>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              cost.transport_mode === 'Maritime' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                              cost.transport_mode === 'Aerien' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                              'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                              {cost.transport_mode}
                            </span>
                          </td>
                          <td>
                            {isAdmin && editingTransport[index] !== undefined ? (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-20 h-8"
                                value={editingTransport[index]?.cost_per_kg ?? cost.cost_per_kg}
                                onChange={(e) => setEditingTransport(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], cost_per_kg: parseFloat(e.target.value) || 0 }
                                }))}
                              />
                            ) : (
                              <span className="font-mono">{cost.cost_per_kg.toFixed(2)} €</span>
                            )}
                          </td>
                          <td>
                            {isAdmin && editingTransport[index] !== undefined ? (
                              <Input
                                type="number"
                                step="50"
                                className="w-24 h-8"
                                value={editingTransport[index]?.min_cost ?? cost.min_cost}
                                onChange={(e) => setEditingTransport(prev => ({
                                  ...prev,
                                  [index]: { ...prev[index], min_cost: parseFloat(e.target.value) || 0 }
                                }))}
                              />
                            ) : (
                              <span className="font-mono">{cost.min_cost} €</span>
                            )}
                          </td>
                          <td className="text-sm">{cost.transit_days_min}-{cost.transit_days_max} j</td>
                          <td className="text-sm text-muted-foreground">{cost.notes}</td>
                          {isAdmin && (
                            <td>
                              {editingTransport[index] !== undefined ? (
                                <Button size="sm" onClick={() => handleSaveTransportCost(index)}>
                                  <Save className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" onClick={() => setEditingTransport(prev => ({ ...prev, [index]: {} }))}>
                                  Modifier
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Service Charges */}
              <div className="bg-card rounded-xl border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h4 className="font-semibold text-foreground">Forfaits prestations</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Zone</th>
                        <th>Coût fixe (€)</th>
                        <th>% valeur</th>
                        <th>TVA service (%)</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceCharges.map((charge, index) => (
                        <tr key={`${charge.type}-${charge.zone}`}>
                          <td className="font-medium text-foreground capitalize">
                            {charge.type.replace(/_/g, ' ')}
                          </td>
                          <td>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              charge.zone === 'UE' ? 'badge-ue' :
                              charge.zone === 'DROM' ? 'badge-drom' :
                              'badge-hors-ue'
                            }`}>
                              {charge.zone}
                            </span>
                          </td>
                          <td className="font-mono">{charge.fixed_cost} €</td>
                          <td className="font-mono">{charge.percentage ? `${charge.percentage}%` : '-'}</td>
                          <td className="font-mono">{charge.tva_on_service}%</td>
                          <td className="text-sm text-muted-foreground">{charge.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
