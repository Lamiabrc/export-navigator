import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertTriangle, CheckCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { parseCsv } from '@/lib/imports/parseCsv';
import {
  CostDocMapping,
  mapCostDocs,
  mapSageInvoices,
  MappingResult,
  SageInvoiceMapping,
} from '@/lib/imports/mapping';
import type { SageInvoice } from '@/types/sage';
import type { CostDoc } from '@/types/costs';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { COST_DOCS_KEY, SAGE_INVOICES_KEY } from '@/lib/constants/storage';

interface FileState<TMapping> {
  filename: string;
  headers: string[];
  mapping: TMapping | null;
}

const autoPick = (headers: string[], candidates: string[]): string => {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const cand of candidates) {
    const idx = lowerHeaders.findIndex((h) => h.includes(cand.toLowerCase()));
    if (idx >= 0) return headers[idx];
  }
  return headers[0] || '';
};

const renderMappingSelect = (
  label: string,
  value: string,
  onChange: (val: string) => void,
  headers: string[],
  required?: boolean
) => (
  <div className="space-y-1">
    <p className="text-sm font-medium">
      {label} {required && <span className="text-destructive">*</span>}
    </p>
    <Select value={value || ''} onValueChange={(val) => onChange(val)}>
      <SelectTrigger>
        <SelectValue placeholder="Sélectionner une colonne" />
      </SelectTrigger>
      <SelectContent>
        {!required && <SelectItem value="">Aucune</SelectItem>}
        {headers.map((h) => (
          <SelectItem key={h} value={h}>
            {h}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const useUpload = <TMapping,>(initial: TMapping | null) => {
  const [state, setState] = useState<FileState<TMapping>>({
    filename: '',
    headers: [],
    mapping: initial,
  });
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

  const onFile = (file: File, mappingFactory: (headers: string[]) => TMapping) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseCsv(content);
      setRawRows(parsed.rows);
      setState({
        filename: file.name,
        headers: parsed.headers,
        mapping: mappingFactory(parsed.headers),
      });
      toast.success(`Fichier ${file.name} chargé (${parsed.rows.length} lignes)`);
    };
    reader.readAsText(file, 'utf-8');
  };

  return { state, setState, rawRows, onFile };
};

export default function Imports() {
  const [sageResult, setSageResult] = useState<MappingResult<SageInvoice> | null>(null);
  const [costResult, setCostResult] = useState<MappingResult<CostDoc> | null>(null);
  const { state: sageState, setState: setSageState, rawRows: sageRows, onFile: onSageFile } = useUpload<SageInvoiceMapping>(null);
  const { state: costState, setState: setCostState, rawRows: costRows, onFile: onCostFile } = useUpload<CostDocMapping>(null);

  const [, setStoredInvoices] = useLocalStorage<SageInvoice[]>(SAGE_INVOICES_KEY, []);
  const [, setStoredCosts] = useLocalStorage<CostDoc[]>(COST_DOCS_KEY, []);

  const handleSageFile = (file?: File) => {
    if (!file) return;
    onSageFile(file, (headers) => ({
      invoiceNumber: autoPick(headers, ['facture', 'invoice']),
      clientName: autoPick(headers, ['client', 'customer']),
      invoiceDate: autoPick(headers, ['date']),
      currency: autoPick(headers, ['devise', 'currency']),
      totalHT: autoPick(headers, ['ht', 'net']),
      totalTVA: headers.find((h) => h.toLowerCase().includes('tva')) || headers[0],
      totalTTC: headers.find((h) => h.toLowerCase().includes('ttc')) || headers[0],
      shipmentRef: headers.find((h) => h.toLowerCase().includes('shipment')) || undefined,
      awb: headers.find((h) => h.toLowerCase().includes('awb')) || undefined,
      bl: headers.find((h) => h.toLowerCase().includes('bl')) || undefined,
      incoterm: headers.find((h) => h.toLowerCase().includes('incoterm')) || undefined,
      destination: headers.find((h) => h.toLowerCase().includes('dest')) || undefined,
      flowCode: headers.find((h) => h.toLowerCase().includes('flux')) || undefined,
    }));
  };

  const handleCostFile = (file?: File) => {
    if (!file) return;
    onCostFile(file, (headers) => ({
      docNumber: autoPick(headers, ['doc', 'facture', 'invoice']),
      docDate: autoPick(headers, ['date']),
      currency: autoPick(headers, ['devise', 'currency']),
      amount: autoPick(headers, ['montant', 'amount', 'total']),
      costType: autoPick(headers, ['type', 'cost']),
      label: headers.find((h) => h.toLowerCase().includes('libelle')) || headers[0],
      invoiceNumber: headers.find((h) => h.toLowerCase().includes('facture')) || undefined,
      flowCode: headers.find((h) => h.toLowerCase().includes('flux')) || undefined,
      shipmentRef: headers.find((h) => h.toLowerCase().includes('shipment')) || undefined,
      awb: headers.find((h) => h.toLowerCase().includes('awb')) || undefined,
      bl: headers.find((h) => h.toLowerCase().includes('bl')) || undefined,
      supplier: headers.find((h) => h.toLowerCase().includes('fournisseur')) || undefined,
    }));
  };

  const applySageMapping = () => {
    if (!sageState.mapping) {
      toast.error('Importez un CSV Sage d’abord');
      return;
    }
    const result = mapSageInvoices(sageRows, sageState.mapping);
    setSageResult(result);
    toast.success(`Mapping appliqué : ${result.items.length} factures, ${result.invalid.length} lignes invalides`);
  };

  const applyCostMapping = () => {
    if (!costState.mapping) {
      toast.error('Importez un CSV Coûts réels d’abord');
      return;
    }
    const result = mapCostDocs(costRows, costState.mapping);
    setCostResult(result);
    toast.success(`Mapping appliqué : ${result.items.length} documents, ${result.invalid.length} lignes invalides`);
  };

  const saveSageInvoices = () => {
    if (!sageResult) {
      toast.error('Appliquez le mapping avant de sauvegarder');
      return;
    }
    setStoredInvoices(sageResult.items);
    toast.success('Factures Sage enregistrées en local');
  };

  const saveCostDocs = () => {
    if (!costResult) {
      toast.error('Appliquez le mapping avant de sauvegarder');
      return;
    }
    setStoredCosts(costResult.items);
    toast.success('Coûts réels enregistrés en local');
  };

  const sagePreview = useMemo(() => sageResult?.items.slice(0, 5) ?? [], [sageResult]);
  const costPreview = useMemo(() => costResult?.items.slice(0, 5) ?? [], [costResult]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Imports CSV</h1>
          <p className="text-muted-foreground">Alimentez l’outil avec les factures Sage et les coûts réels (transit/douane)</p>
        </div>

        <Tabs defaultValue="sage" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sage">Factures Sage</TabsTrigger>
            <TabsTrigger value="costs">Coûts réels</TabsTrigger>
          </TabsList>

          <TabsContent value="sage">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Import Factures Sage (CSV)
                </CardTitle>
                <CardDescription>Mapping colonnes → champs facture, validation et aperçu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleSageFile(e.target.files?.[0])}
                  />
                  {sageState.filename && <Badge variant="outline">{sageState.filename}</Badge>}
                </div>

                {sageState.headers.length > 0 && sageState.mapping && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderMappingSelect('Numéro facture', sageState.mapping.invoiceNumber, (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), invoiceNumber: val } })), sageState.headers, true)}
                    {renderMappingSelect('Client', sageState.mapping.clientName, (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), clientName: val } })), sageState.headers, true)}
                    {renderMappingSelect('Date facture', sageState.mapping.invoiceDate, (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), invoiceDate: val } })), sageState.headers, true)}
                    {renderMappingSelect('Devise', sageState.mapping.currency, (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), currency: val } })), sageState.headers, true)}
                    {renderMappingSelect('Total HT', sageState.mapping.totalHT, (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), totalHT: val } })), sageState.headers, true)}
                    {renderMappingSelect('TVA', sageState.mapping.totalTVA || '', (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), totalTVA: val } })), sageState.headers)}
                    {renderMappingSelect('TTC', sageState.mapping.totalTTC || '', (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), totalTTC: val } })), sageState.headers)}
                    {renderMappingSelect('Réf. expédition/BL', sageState.mapping.shipmentRef || '', (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), shipmentRef: val } })), sageState.headers)}
                    {renderMappingSelect('AWB', sageState.mapping.awb || '', (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), awb: val } })), sageState.headers)}
                    {renderMappingSelect('BL', sageState.mapping.bl || '', (val) => setSageState((prev) => ({ ...prev, mapping: { ...(prev.mapping as SageInvoiceMapping), bl: val } })), sageState.headers)}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={applySageMapping}>
                    <Upload className="h-4 w-4 mr-2" />
                    Appliquer le mapping
                  </Button>
                  <Button onClick={saveSageInvoices} disabled={!sageResult}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Sauvegarder
                  </Button>
                  {sageResult && (
                    <Badge variant={sageResult.invalid.length ? 'destructive' : 'secondary'}>
                      {sageResult.invalid.length} lignes invalides
                    </Badge>
                  )}
                </div>

                {sagePreview.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 border-b text-sm font-semibold">Aperçu (5 premières lignes)</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Facture</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">HT</TableHead>
                          <TableHead>BL/AWB</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sagePreview.map((row) => (
                          <TableRow key={row.invoiceNumber}>
                            <TableCell className="font-medium">{row.invoiceNumber}</TableCell>
                            <TableCell>{row.clientName}</TableCell>
                            <TableCell>{row.invoiceDate}</TableCell>
                            <TableCell className="text-right">{row.totalHT.toLocaleString('fr-FR')}</TableCell>
                            <TableCell>{row.shipmentRef || row.awb || row.bl || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {sageResult?.invalid.length ? (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {sageResult.invalid.length} lignes écartées (voir console)
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Import Coûts réels (CSV)
                </CardTitle>
                <CardDescription>Mapping colonnes → documents de coûts, validation et aperçu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleCostFile(e.target.files?.[0])}
                  />
                  {costState.filename && <Badge variant="outline">{costState.filename}</Badge>}
                </div>

                {costState.headers.length > 0 && costState.mapping && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderMappingSelect('N° document', costState.mapping.docNumber, (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), docNumber: val } })), costState.headers, true)}
                    {renderMappingSelect('Date document', costState.mapping.docDate, (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), docDate: val } })), costState.headers, true)}
                    {renderMappingSelect('Montant', costState.mapping.amount, (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), amount: val } })), costState.headers, true)}
                    {renderMappingSelect('Devise', costState.mapping.currency, (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), currency: val } })), costState.headers, true)}
                    {renderMappingSelect('Type de coût', costState.mapping.costType, (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), costType: val } })), costState.headers, true)}
                    {renderMappingSelect('Libellé', costState.mapping.label || '', (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), label: val } })), costState.headers)}
                    {renderMappingSelect('Facture liée', costState.mapping.invoiceNumber || '', (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), invoiceNumber: val } })), costState.headers)}
                    {renderMappingSelect('Réf. expédition/BL', costState.mapping.shipmentRef || '', (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), shipmentRef: val } })), costState.headers)}
                    {renderMappingSelect('Fournisseur/Transitaire', costState.mapping.supplier || '', (val) => setCostState((prev) => ({ ...prev, mapping: { ...(prev.mapping as CostDocMapping), supplier: val } })), costState.headers)}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={applyCostMapping}>
                    <Upload className="h-4 w-4 mr-2" />
                    Appliquer le mapping
                  </Button>
                  <Button onClick={saveCostDocs} disabled={!costResult}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Sauvegarder
                  </Button>
                  {costResult && (
                    <Badge variant={costResult.invalid.length ? 'destructive' : 'secondary'}>
                      {costResult.invalid.length} lignes invalides
                    </Badge>
                  )}
                </div>

                {costPreview.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 border-b text-sm font-semibold">Aperçu (5 premières lignes)</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Doc</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead>Facture liée</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costPreview.map((doc) => (
                          <TableRow key={doc.docNumber}>
                            <TableCell className="font-medium">{doc.docNumber}</TableCell>
                            <TableCell>{doc.docDate}</TableCell>
                            <TableCell>{doc.lines[0]?.type || '-'}</TableCell>
                            <TableCell className="text-right">
                              {doc.lines.reduce((s, l) => s + l.amount, 0).toLocaleString('fr-FR')}
                            </TableCell>
                            <TableCell>{doc.invoiceNumber || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {costResult?.invalid.length ? (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {costResult.invalid.length} lignes écartées (voir console)
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
