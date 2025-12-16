import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { mockFlows, incotermRules } from '@/data/mockData';
import type { Flow, Destination, Incoterm, Zone, RiskLevel } from '@/types';
import { Plus, Search, Filter, FileText, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

const destinations: Destination[] = [
  'Guadeloupe', 'Martinique', 'Guyane', 'Réunion', 'Mayotte',
  'Belgique', 'Espagne', 'Luxembourg', 'Suisse'
];

const incoterms: Incoterm[] = ['EXW', 'FCA', 'DAP', 'DDP'];

export default function Flows() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDestination, setFilterDestination] = useState<string>('all');
  const [filterIncoterm, setFilterIncoterm] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

  const filteredFlows = mockFlows.filter(flow => {
    const matchesSearch = 
      flow.flow_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flow.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDestination = filterDestination === 'all' || flow.destination === filterDestination;
    const matchesIncoterm = filterIncoterm === 'all' || flow.incoterm === filterIncoterm;
    const matchesRisk = filterRisk === 'all' || flow.risk_level === filterRisk;
    
    return matchesSearch && matchesDestination && matchesIncoterm && matchesRisk;
  });

  const getIncotermRule = (incoterm: Incoterm) => {
    return incotermRules.find(r => r.incoterm === incoterm);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Flux Export</h1>
            <p className="mt-1 text-muted-foreground">Gestion et suivi des flux d'exportation</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau flux
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-xl border">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par code ou client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={filterDestination} onValueChange={setFilterDestination}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes destinations</SelectItem>
              {destinations.map(dest => (
                <SelectItem key={dest} value={dest}>{dest}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterIncoterm} onValueChange={setFilterIncoterm}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Incoterm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous incoterms</SelectItem>
              {incoterms.map(inc => (
                <SelectItem key={inc} value={inc}>{inc}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Risque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="a_surveiller">À surveiller</SelectItem>
              <SelectItem value="risque">Risque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Destination</th>
                  <th>Zone</th>
                  <th>Incoterm</th>
                  <th>Transport</th>
                  <th>Départ</th>
                  <th>Valeur</th>
                  <th>Risque</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.map((flow) => (
                  <tr key={flow.id} className="transition-smooth">
                    <td>
                      <span className="font-medium text-primary">{flow.flow_code}</span>
                    </td>
                    <td className="font-medium text-foreground">{flow.client_name}</td>
                    <td className="text-muted-foreground">{flow.destination}</td>
                    <td>
                      <StatusBadge status={flow.zone} type="zone" />
                    </td>
                    <td>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button 
                            className="font-semibold text-primary hover:underline"
                            onClick={() => setSelectedFlow(flow)}
                          >
                            {flow.incoterm}
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Règle Incoterm : {flow.incoterm}</DialogTitle>
                          </DialogHeader>
                          {(() => {
                            const rule = getIncotermRule(flow.incoterm);
                            if (!rule) return null;
                            return (
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">{rule.notes}</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div className="p-3 bg-muted rounded-lg">
                                    <span className="text-muted-foreground">Transport</span>
                                    <p className="font-medium">{rule.payer_transport}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg">
                                    <span className="text-muted-foreground">Douane export</span>
                                    <p className="font-medium">{rule.payer_customs_export}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg">
                                    <span className="text-muted-foreground">Douane import</span>
                                    <p className="font-medium">{rule.payer_customs_import}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg">
                                    <span className="text-muted-foreground">Droits</span>
                                    <p className="font-medium">{rule.payer_duties}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg">
                                    <span className="text-muted-foreground">TVA import</span>
                                    <p className="font-medium">{rule.payer_import_vat}</p>
                                  </div>
                                  <div className="p-3 bg-muted rounded-lg">
                                    <span className="text-muted-foreground">OM/OMR</span>
                                    <p className="font-medium">{rule.payer_octroi_mer}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </DialogContent>
                      </Dialog>
                    </td>
                    <td className="text-muted-foreground">{flow.transport_mode}</td>
                    <td className="text-muted-foreground">
                      {new Date(flow.departure_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="font-medium">
                      {flow.goods_value.toLocaleString('fr-FR')} €
                    </td>
                    <td>
                      <StatusBadge status={flow.risk_level || 'ok'} type="risk" />
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link 
                          to={`/flows/${flow.id}`}
                          className="p-2 hover:bg-muted rounded-lg transition-smooth"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Link>
                        <button className="p-2 hover:bg-muted rounded-lg transition-smooth">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredFlows.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">Aucun flux trouvé</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredFlows.length} flux affichés sur {mockFlows.length}</span>
        </div>
      </div>
    </MainLayout>
  );
}
