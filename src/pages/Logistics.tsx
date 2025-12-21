import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useFlows } from '@/hooks/useFlows';
import { 
  Truck, 
  Ship, 
  Plane, 
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  FileX,
} from 'lucide-react';
import type { TransportMode } from '@/types';

const transportIcons: Record<TransportMode, React.ComponentType<{ className?: string }>> = {
  'Routier': Truck,
  'Maritime': Ship,
  'Aerien': Plane,
  'Express': Package,
  'Ferroviaire': Truck,
};

export default function Logistics() {
  const { flows, isLoading } = useFlows();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  const activeFlows = flows.filter(f => 
    f.status_transport === 'en_cours' || f.status_transport === 'non_demarre'
  );

  const flowsWithMissingDocs = flows.filter(f => 
    f.chk_transport_doc === 'a_faire' || 
    f.chk_packing_list === 'a_faire' ||
    f.chk_certificate_origin === 'bloque'
  );

  const upcomingDepartures = flows
    .filter(f => new Date(f.departure_date) >= new Date())
    .sort((a, b) => new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime());

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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logistique</h1>
          <p className="mt-1 text-muted-foreground">Suivi des transports et documents</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                <Truck className="h-5 w-5 text-chart-1" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeFlows.length}</p>
                <p className="text-sm text-muted-foreground">Transports actifs</p>
              </div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning/10">
                <FileX className="h-5 w-5 text-status-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{flowsWithMissingDocs.length}</p>
                <p className="text-sm text-muted-foreground">Docs manquants</p>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                <Clock className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingDepartures.length}</p>
                <p className="text-sm text-muted-foreground">Départs à venir</p>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                <Ship className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {flows.filter(f => f.transport_mode === 'Maritime').length}
                </p>
                <p className="text-sm text-muted-foreground">Envois maritimes</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Transports */}
          <div className="bg-card rounded-xl border">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Transports en cours</h3>
            </div>
            <div className="divide-y divide-border">
              {activeFlows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Aucun transport en cours
                </div>
              ) : (
                activeFlows.map(flow => {
                  const Icon = transportIcons[flow.transport_mode];
                  return (
                    <div key={flow.id} className="p-4 hover:bg-muted/30 transition-smooth">
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">{flow.flow_code}</span>
                            <StatusBadge status={flow.status_transport} type="flow" />
                          </div>
                          <p className="text-sm text-foreground mt-1">{flow.client_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {flow.incoterm_place} → {flow.destination}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">Départ</p>
                          <p className="font-medium">
                            {new Date(flow.departure_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Missing Documents */}
          <div className="bg-card rounded-xl border">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-warning" />
              <h3 className="font-semibold text-foreground">Documents à compléter</h3>
            </div>
            <div className="divide-y divide-border">
              {flowsWithMissingDocs.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="h-8 w-8 text-status-ok mx-auto mb-2" />
                  <p className="text-muted-foreground">Tous les documents sont à jour</p>
                </div>
              ) : (
                flowsWithMissingDocs.map(flow => {
                  const missingDocs = [];
                  if (flow.chk_transport_doc === 'a_faire') missingDocs.push('Document transport');
                  if (flow.chk_packing_list === 'a_faire') missingDocs.push('Packing list');
                  if (flow.chk_certificate_origin === 'bloque') missingDocs.push('Certificat origine');
                  
                  return (
                    <div key={flow.id} className="p-4 hover:bg-muted/30 transition-smooth">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">{flow.flow_code}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-foreground">{flow.destination}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{flow.client_name}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {missingDocs.map(doc => (
                              <span 
                                key={doc}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium badge-warning"
                              >
                                {doc}
                              </span>
                            ))}
                          </div>
                        </div>
                        <StatusBadge status={flow.risk_level || 'ok'} type="risk" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Timeline / Upcoming */}
        <div className="bg-card rounded-xl border">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Calendrier des départs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date départ</th>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Destination</th>
                  <th>Mode</th>
                  <th>Incoterm</th>
                  <th>Statut transport</th>
                  <th>Date livraison prévue</th>
                </tr>
              </thead>
              <tbody>
                {upcomingDepartures.map(flow => {
                  const Icon = transportIcons[flow.transport_mode];
                  const daysUntil = Math.ceil(
                    (new Date(flow.departure_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  
                  return (
                    <tr key={flow.id}>
                      <td>
                        <div>
                          <p className="font-medium">
                            {new Date(flow.departure_date).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {daysUntil === 0 ? "Aujourd'hui" : 
                              daysUntil === 1 ? 'Demain' : 
                              `Dans ${daysUntil} jours`}
                          </p>
                        </div>
                      </td>
                      <td className="font-medium text-primary">{flow.flow_code}</td>
                      <td>{flow.client_name}</td>
                      <td>
                        <StatusBadge status={flow.zone} type="zone" className="mr-2" />
                        {flow.destination}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span>{flow.transport_mode}</span>
                        </div>
                      </td>
                      <td className="font-medium">{flow.incoterm}</td>
                      <td>
                        <StatusBadge status={flow.status_transport} type="flow" />
                      </td>
                      <td className="text-muted-foreground">
                        {new Date(flow.delivery_date).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
