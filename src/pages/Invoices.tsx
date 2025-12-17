import { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportCircuits } from '@/data/exportCircuits';
import { transitaires } from '@/data/transitaires';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  Eye,
  Trash2,
  Truck,
  Info,
} from 'lucide-react';

interface UploadedInvoice {
  id: string;
  filename: string;
  circuit_id: string | null;
  transitaire_id: string | null;
  uploaded_at: string;
  status: 'pending' | 'analyzing' | 'ok' | 'warning' | 'error';
  compliance_score?: number;
  issues?: string[];
  fileData?: string;
  fileType?: string;
}

const transitaireColors: Record<string, string> = {
  'DHL': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  'LVoverseas': 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  'Geodis': 'bg-red-500/10 text-red-700 border-red-500/30',
  'TDIS': 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  'Client': 'bg-green-500/10 text-green-700 border-green-500/30',
  'Autre': 'bg-gray-500/10 text-gray-700 border-gray-500/30',
};

export default function Invoices() {
  const [invoices, setInvoices] = useLocalStorage<UploadedInvoice[]>('orliman_invoices', []);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('none');
  const [selectedTransitaire, setSelectedTransitaire] = useState<string>('none');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCircuit = selectedCircuitId !== 'none' 
    ? exportCircuits.find(c => c.id === selectedCircuitId) 
    : null;

  const availableTransitaires = selectedCircuit 
    ? transitaires.filter(t => selectedCircuit.transitaires.includes(t.id))
    : transitaires;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result as string;
      
      const newInvoice: UploadedInvoice = {
        id: crypto.randomUUID(),
        filename: file.name,
        circuit_id: selectedCircuitId !== 'none' ? selectedCircuitId : null,
        transitaire_id: selectedTransitaire !== 'none' ? selectedTransitaire : null,
        uploaded_at: new Date().toISOString(),
        status: 'analyzing',
        issues: [],
        fileData,
        fileType: file.type,
      };
      
      setInvoices(prev => [newInvoice, ...prev]);
      toast.info(`Analyse de ${file.name} en cours...`);
      
      // Simulate local analysis with circuit-specific checks
      setTimeout(() => {
        const score = Math.floor(Math.random() * 60) + 40;
        const possibleIssues = selectedCircuit ? [
          `Vérifier conformité circuit ${selectedCircuit.shortName}`,
          'Incoterm à confirmer',
          'Montant TVA/taxes à vérifier',
          'Documents requis incomplets',
        ] : [
          'Vérifier date facture',
          'Incoterm non visible',
          'Montant TVA à vérifier',
          'Destinataire à confirmer',
        ];
        const issues = score < 80 
          ? possibleIssues.slice(0, Math.floor(Math.random() * 2) + 1)
          : [];
        
        setInvoices(prev => prev.map(inv => 
          inv.id === newInvoice.id 
            ? { 
                ...inv, 
                status: score >= 80 ? 'ok' : score >= 50 ? 'warning' : 'error',
                compliance_score: score,
                issues
              }
            : inv
        ));
        toast.success(`Analyse de ${file.name} terminée`);
      }, 1500);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleViewInvoice = (invoice: UploadedInvoice) => {
    if (invoice.fileData) {
      const newWindow = window.open();
      if (newWindow) {
        if (invoice.fileType?.includes('pdf')) {
          newWindow.document.write(`<iframe src="${invoice.fileData}" width="100%" height="100%" style="border:none;"></iframe>`);
        } else {
          newWindow.document.write(`<img src="${invoice.fileData}" style="max-width:100%;height:auto;" />`);
        }
      }
    } else {
      toast.error('Fichier non disponible');
    }
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    toast.success('Facture supprimée');
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
          <p className="mt-1 text-muted-foreground">
            Vérification de conformité des factures par circuit et transitaire
          </p>
        </div>

        {/* Process Diagram */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Processus de contrôle facture
            </CardTitle>
            <CardDescription>Étapes de vérification selon le circuit export</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-2 flex-wrap p-4 bg-muted/50 rounded-lg overflow-x-auto">
              {['📄 Upload', '🔍 Circuit', '📦 Transitaire', '⚙️ Analyse', '✅ Résultat'].map((step, i, arr) => (
                <div key={step} className="flex items-center">
                  <div className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                    i === 0 ? 'bg-primary text-primary-foreground' : 
                    i === arr.length - 1 ? 'bg-green-500 text-white' : 'bg-background'
                  }`}>
                    {step}
                  </div>
                  {i < arr.length - 1 && <span className="mx-2">→</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upload Zone */}
        <div className="bg-card rounded-xl border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Circuit export</label>
              <Select value={selectedCircuitId} onValueChange={(val) => {
                setSelectedCircuitId(val);
                setSelectedTransitaire('none');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un circuit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous circuits</SelectItem>
                  {exportCircuits.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.shortName} - {c.incoterm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Transitaire</label>
              <Select value={selectedTransitaire} onValueChange={setSelectedTransitaire}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un transitaire" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tous transitaires</SelectItem>
                  {availableTransitaires.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected circuit info */}
          {selectedCircuit && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{selectedCircuit.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Documents requis : {selectedCircuit.documentsRequired.slice(0, 3).join(', ')}...
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedCircuit.transitaires.map(t => (
                    <Badge key={t} variant="outline" className={transitaireColors[t]}>
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-foreground font-medium mb-1">
              Glissez-déposez vos factures ici
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              ou cliquez pour sélectionner (PDF, JPG, PNG)
            </p>
            <Button variant="outline" type="button">
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
            <h3 className="font-semibold text-foreground">Factures contrôlées</h3>
          </div>
          <div className="divide-y divide-border">
            {invoices.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Aucune facture uploadée</p>
              </div>
            ) : (
              invoices.map(invoice => {
                const linkedCircuit = invoice.circuit_id 
                  ? exportCircuits.find(c => c.id === invoice.circuit_id) 
                  : null;
                const linkedTransitaire = invoice.transitaire_id
                  ? transitaires.find(t => t.id === invoice.transitaire_id)
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
                        
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                          <span>
                            {new Date(invoice.uploaded_at).toLocaleString('fr-FR')}
                          </span>
                          {linkedCircuit && (
                            <Badge variant="outline" className="text-xs">
                              {linkedCircuit.shortName}
                            </Badge>
                          )}
                          {linkedTransitaire && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${transitaireColors[linkedTransitaire.id]}`}
                            >
                              <Truck className="h-3 w-3 mr-1" />
                              {linkedTransitaire.name}
                            </Badge>
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
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleViewInvoice(invoice)}
                          title="Voir la facture"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          title="Supprimer"
                        >
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
