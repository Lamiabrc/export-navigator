import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Flow } from '@/types';
import { ArrowRight } from 'lucide-react';

interface RecentFlowsTableProps {
  flows: Flow[];
}

export function RecentFlowsTable({ flows }: RecentFlowsTableProps) {
  return (
    <div className="kpi-card animate-fade-in p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Flux récents</h3>
          <Link 
            to="/flows" 
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-smooth"
          >
            Voir tous
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Client</th>
              <th>Destination</th>
              <th>Zone</th>
              <th>Incoterm</th>
              <th>Risque</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((flow) => (
              <tr key={flow.id} className="transition-smooth">
                <td>
                  <Link 
                    to={`/flows/${flow.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {flow.flow_code}
                  </Link>
                </td>
                <td className="text-foreground">{flow.client_name}</td>
                <td className="text-muted-foreground">{flow.destination}</td>
                <td>
                  <StatusBadge status={flow.zone} type="zone" />
                </td>
                <td>
                  <span className="font-medium">{flow.incoterm}</span>
                </td>
                <td>
                  <StatusBadge status={flow.risk_level || 'ok'} type="risk" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
