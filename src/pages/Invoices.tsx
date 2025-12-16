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
import { mockFlows } from '@/data/mockData';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  Eye,
  Trash2,
} from 'lucide-react';

interface UploadedInvoice {
  id: string;
  filename: string;
  flow_id: string | null;
  uploaded_at: string;
  status: 'pending' | 'analyzing' | 'ok' | 'warning' | 'error';
  compliance_score?: number;
  issues?: string[];
}

const mockInvoices: UploadedInvoice[] = [
  {
    id: '1',
    filename: 'facture_FX-0001_belgique.pdf',
    flow_id: '1',
    uploaded_at: '2024-01-20T10:30:00Z',
    status: 'ok',
    compliance_score: 100,
    issues: [],
  },
  {
    id: '2',
    filename: 'invoice_reunion_jan2024.pdf',
    flow_id: '2',
    uploaded_at: '2024-01-22T14:00:00Z',
    status: 'warning',
    compliance_score: 75,
    issues: ['OM/OMR non détecté sur la facture', 'Vérifier cohérence montant transport'],
  },
  {
    id: '3',
    filename: 'facture_swiss_precision.pdf',
    flow_id: '3',
    uploaded_at: '2024-01-23T09:15:00Z',
    status: 'error',
    compliance_score: 40,
    issues: ['Incoterm manquant', 'Certificat origine requis non mentionné', 'Incohérence destination'],
  },
];

export default function Invoices() {
  const [invoices, setInvoices] = useState<UploadedInvoice[]>(mockInvoices);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('none');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    // Simulate upload
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const newInvoice: UploadedInvoice = {
        id: Date.now().toString(),
        filename: files[0].name,
        flow_id: selectedFlowId !== 'none' ? selectedFlowId : null,
        uploaded_at: new Date().toISOString(),
        status: 'analyzing',
        issues: [],
      };
      setInvoices(prev => [newInvoice, ...prev]);
      
      // Simulate analysis
      setTimeout(() => {
        setInvoices(prev => prev.map(inv => 
          inv.id === newInvoice.id 
            ? { ...inv, status: 'ok' as const, compliance_score: 95, issues: ['Vérifier date facture'] }
            : inv
        ));
      }, 2000);
    }
  };

  const getStatusIcon = (status: UploadedInvoice['status']) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-status-ok" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-status-warning" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-status-risk" />;
      case 'analyzing':
        return <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: UploadedInvoice['status']) => {
    switch (status) {
      case 'ok':
        return <StatusBadge status="ok" type="risk" />;
      case 'warning':
        return <StatusBadge status="a_surveiller" type="risk" />;
      case 'error':
        return <StatusBadge status="risque" type="risk" />;
      case 'analyzing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium badge-neutral">Analyse...</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium badge-neutral">En attente</span>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contrôle Factures</h1>
          <p className="mt-1 text-muted-foreground">Upload et vérification de conformité des factures</p>
        </div>

        {/* Upload Zone */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center gap-4 mb-4">
          <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Rattacher à un flux (optionnel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun flux sélectionné</SelectItem>
              {mockFlows.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.flow_code} - {f.client_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-foreground font-medium mb-1">
              Glissez-déposez vos factures ici
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              ou cliquez pour sélectionner (PDF, JPG, PNG)
            </p>
            <Button variant="outline">
              Sélectionner un fichier
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{invoices.length}</p>
                <p className="text-sm text-muted-foreground">Total factures</p>
              </div>
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-ok/10">
                <CheckCircle className="h-5 w-5 text-status-ok" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {invoices.filter(i => i.status === 'ok').length}
                </p>
                <p className="text-sm text-muted-foreground">Conformes</p>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-warning/10">
                <AlertTriangle className="h-5 w-5 text-status-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {invoices.filter(i => i.status === 'warning').length}
                </p>
                <p className="text-sm text-muted-foreground">À surveiller</p>
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-risk/10">
                <XCircle className="h-5 w-5 text-status-risk" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {invoices.filter(i => i.status === 'error').length}
                </p>
                <p className="text-sm text-muted-foreground">Non conformes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Factures uploadées</h3>
          </div>
          <div className="divide-y divide-border">
            {invoices.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Aucune facture uploadée</p>
              </div>
            ) : (
              invoices.map(invoice => {
                const linkedFlow = invoice.flow_id 
                  ? mockFlows.find(f => f.id === invoice.flow_id) 
                  : null;
                
                return (
                  <div key={invoice.id} className="p-4 hover:bg-muted/30 transition-smooth">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        {getStatusIcon(invoice.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-foreground truncate">
                            {invoice.filename}
                          </span>
                          {getStatusBadge(invoice.status)}
                        </div>
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>
                            {new Date(invoice.uploaded_at).toLocaleString('fr-FR')}
                          </span>
                          {linkedFlow && (
                            <span className="flex items-center gap-1">
                              <span>→</span>
                              <span className="text-primary font-medium">
                                {linkedFlow.flow_code}
                              </span>
                              <span className="text-muted-foreground">
                                ({linkedFlow.destination})
                              </span>
                            </span>
                          )}
                        </div>

                        {invoice.compliance_score !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    invoice.compliance_score >= 80 ? 'bg-status-ok' :
                                    invoice.compliance_score >= 50 ? 'bg-status-warning' :
                                    'bg-status-risk'
                                  }`}
                                  style={{ width: `${invoice.compliance_score}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-12">
                                {invoice.compliance_score}%
                              </span>
                            </div>
                          </div>
                        )}

                        {invoice.issues && invoice.issues.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {invoice.issues.map((issue, idx) => (
                              <p key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <span className="text-status-warning">•</span>
                                {issue}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
