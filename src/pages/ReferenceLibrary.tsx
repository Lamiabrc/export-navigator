import { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarClock, Download, Eye, FileEdit, FileText, Filter, Plus, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  defaultReferenceData,
  useReferenceData,
  type CheatSheet,
  type ChargeTaxRule,
  type NomenclatureEntry,
} from '@/hooks/useReferenceData';

const DEST_KEY = 'export_destinations_v1';
const INCOTERM_KEY = 'export_incoterms_v1';
const LOGISTICS_MODE_KEY = 'export_logistics_mode_v1';

const logisticModes = ['Envoi direct depuis métropole', 'Dépositaire / stock local'] as const;
const zones = ['UE', 'DROM', 'Suisse', 'Hors UE'] as const;
const incotermCodes = ['EXW', 'FCA', 'FOB', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'] as const;

type DocFlags = {
  facture: boolean;
  packing: boolean;
  blAwb: boolean;
  certifOrigine: boolean;
  declarationDouane: boolean;
  preuveExport: boolean;
  autres: string;
};

type ControlFlags = {
  incotermVsPayeur: boolean;
  refacturationTransit: boolean;
  justificatifsTVA: boolean;
  taxesDOM: boolean;
  autoliquidation: boolean;
};

type DestinationRow = {
  id: string;
  name: string;
  zone: (typeof zones)[number];
  logisticMode: (typeof logisticModes)[number];
  docs: DocFlags;
  controls: ControlFlags;
  notes?: string;
};

type IncotermPayer = 'Fournisseur' | 'Client';

type IncotermRow = {
  id: string;
  code: (typeof incotermCodes)[number];
  notes?: string;
  payers: {
    transport: IncotermPayer;
    dedouanementImport: IncotermPayer;
    droits: IncotermPayer;
    tvaImport: IncotermPayer;
    omOmr: IncotermPayer;
  };
};

type ImportPayload = {
  version?: string;
  destinations?: DestinationRow[];
  incoterms?: IncotermRow[];
  logisticsMode?: (typeof logisticModes)[number];
  chargesTaxes?: ChargeTaxRule[];
  cheatSheets?: CheatSheet[];
  nomenclature?: NomenclatureEntry[];
  updatedAt?: string;
};

const docCheckboxes: { key: keyof Omit<DocFlags, 'autres'>; label: string }[] = [
  { key: 'facture', label: 'Facture' },
  { key: 'packing', label: 'Packing list' },
  { key: 'blAwb', label: 'BL/AWB' },
  { key: 'certifOrigine', label: 'Certif origine' },
  { key: 'declarationDouane', label: 'Déclaration douane' },
  { key: 'preuveExport', label: 'Preuve export' },
];

const controlCheckboxes: { key: keyof ControlFlags; label: string }[] = [
  { key: 'incotermVsPayeur', label: 'Incoterm vs payeur' },
  { key: 'refacturationTransit', label: 'Refacturation transit' },
  { key: 'justificatifsTVA', label: 'Justificatifs TVA' },
  { key: 'taxesDOM', label: 'Taxes DOM (OM/OMR)' },
  { key: 'autoliquidation', label: 'Autoliquidation' },
];

const defaultDestinations: DestinationRow[] = [
  {
    id: 'dest-fr',
    name: 'France (métropole)',
    zone: 'UE',
    logisticMode: 'Envoi direct depuis métropole',
    docs: { facture: true, packing: true, blAwb: false, certifOrigine: false, declarationDouane: false, preuveExport: true, autres: '' },
    controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: false, autoliquidation: true },
    notes: 'BL/CMR requis pour facturation HT en intra.',
  },
  {
    id: 'dest-drom',
    name: 'DROM (GUA/MQT/RUN)',
    zone: 'DROM',
    logisticMode: 'Dépositaire / stock local',
    docs: { facture: true, packing: true, blAwb: true, certifOrigine: false, declarationDouane: true, preuveExport: true, autres: 'Document OM/OMR' },
    controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: true, autoliquidation: false },
    notes: 'Anticiper OM/OMR ; vérifier valeur douane transport inclus.',
  },
  {
    id: 'dest-ch',
    name: 'Suisse',
    zone: 'Suisse',
    logisticMode: 'Envoi direct depuis métropole',
    docs: { facture: true, packing: true, blAwb: true, certifOrigine: true, declarationDouane: true, preuveExport: true, autres: '' },
    controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: false, autoliquidation: false },
    notes: 'Préférer DAP ; EUR.1 ou attestation d’origine pour préférences.',
  },
];

const defaultIncoterms: IncotermRow[] = [
  {
    id: 'inc-fca',
    code: 'FCA',
    notes: 'Transport principal payé par client, dédouanement export vendeur.',
    payers: { transport: 'Client', dedouanementImport: 'Client', droits: 'Client', tvaImport: 'Client', omOmr: 'Client' },
  },
  {
    id: 'inc-dap',
    code: 'DAP',
    notes: 'Transport payé fournisseur, import à la charge du client.',
    payers: { transport: 'Fournisseur', dedouanementImport: 'Client', droits: 'Client', tvaImport: 'Client', omOmr: 'Client' },
  },
  {
    id: 'inc-ddp',
    code: 'DDP',
    notes: 'Vendeur supporte tous les coûts. Attention DROM = risque fort.',
    payers: { transport: 'Fournisseur', dedouanementImport: 'Fournisseur', droits: 'Fournisseur', tvaImport: 'Fournisseur', omOmr: 'Fournisseur' },
  },
];

const logisticImpacts = {
  'Envoi direct depuis métropole': {
    documents: ['Facture + packing list', 'BL/AWB', 'Preuve export', 'Certificat origine si demandé'],
    taxes: ['Transit / frais dossier', 'Droits/TVA import selon HS code', 'OM/OMR pour DROM'],
    controls: ['Incoterm cohérent avec payeur', 'Transit refacturé', 'Justificatifs TVA ou autoliquidation'],
  },
  'Dépositaire / stock local': {
    documents: ['Documents import initiaux', 'Inventaire stock local', 'Preuve de sortie locale'],
    taxes: ['OM/OMR réglés à l’import DROM', 'Frais stockage local'],
    controls: ['Suivi justification TVA locale', 'Contrôle péremption stock', 'Accords de refacturation'],
  },
};

const warningDromDepositaire =
  'Attention : DROM + Dépositaire = vérifier déclaration entrée DOM, OM/OMR et justificatifs (preuve import + stock).';

const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const loadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed || fallback;
  } catch (e) {
    console.warn(`Failed to parse localStorage key ${key}`, e);
    return fallback;
  }
};

const persistToStorage = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export default function ReferenceLibrary() {
  const { referenceData, saveReferenceData, resetReferenceData } = useReferenceData();

  const [destinations, setDestinations] = useState<DestinationRow[]>(() => loadFromStorage(DEST_KEY, defaultDestinations));
  const [incoterms, setIncoterms] = useState<IncotermRow[]>(() => loadFromStorage(INCOTERM_KEY, defaultIncoterms));
  const [logisticsMode, setLogisticsMode] = useState<(typeof logisticModes)[number]>(() => {
    const stored = loadFromStorage<string | undefined>(LOGISTICS_MODE_KEY, logisticModes[0]);
    return logisticModes.includes(stored as (typeof logisticModes)[number]) ? (stored as (typeof logisticModes)[number]) : logisticModes[0];
  });

  const [destSearch, setDestSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [logisticsFilter, setLogisticsFilter] = useState<string>('');
  const [importPreview, setImportPreview] = useState<ImportPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [viewDestination, setViewDestination] = useState<DestinationRow | null>(null);
  const [editDestination, setEditDestination] = useState<DestinationRow | null>(null);
  const [deleteDestination, setDeleteDestination] = useState<DestinationRow | null>(null);
  const [editIncoterm, setEditIncoterm] = useState<IncotermRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persistToStorage(DEST_KEY, destinations);
  }, [destinations]);

  useEffect(() => {
    persistToStorage(INCOTERM_KEY, incoterms);
  }, [incoterms]);

  useEffect(() => {
    persistToStorage(LOGISTICS_MODE_KEY, logisticsMode);
  }, [logisticsMode]);

  const handlePrefill = () => {
    setDestinations(defaultDestinations);
    setIncoterms(defaultIncoterms);
    setLogisticsMode(logisticModes[0]);
    saveReferenceData(defaultReferenceData);
    toast.success('Référentiel prérempli (Orliman)');
  };

  const handleExport = () => {
    const payload = {
      version: 'v1',
      destinations,
      incoterms,
      logisticsMode,
      chargesTaxes: referenceData.chargesTaxes,
      cheatSheets: referenceData.cheatSheets,
      nomenclature: referenceData.nomenclature,
      updatedAt: new Date().toISOString(),
    };
    downloadJson(payload, 'bible_export_navigator.json');
  };

  const handleImport = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as ImportPayload;
        setImportPreview(parsed);
        setImportError(null);
      } catch (error) {
        console.error(error);
        setImportPreview(null);
        setImportError('Fichier JSON invalide');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const applyImport = () => {
    if (!importPreview) return;
    if (importPreview.destinations) setDestinations(importPreview.destinations as DestinationRow[]);
    if (importPreview.incoterms) setIncoterms(importPreview.incoterms as IncotermRow[]);
    if (importPreview.logisticsMode) {
      const importedMode = logisticModes.includes(importPreview.logisticsMode as (typeof logisticModes)[number])
        ? (importPreview.logisticsMode as (typeof logisticModes)[number])
        : logisticModes[0];
      setLogisticsMode(importedMode);
    }
    if (importPreview.chargesTaxes || importPreview.cheatSheets || importPreview.nomenclature) {
      saveReferenceData({
        ...referenceData,
        chargesTaxes: importPreview.chargesTaxes ?? referenceData.chargesTaxes,
        cheatSheets: importPreview.cheatSheets ?? referenceData.cheatSheets,
        nomenclature: importPreview.nomenclature ?? referenceData.nomenclature,
      });
    }
    toast.success('Import appliqué');
    setIsImportOpen(false);
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetRef = () => {
    setDestinations(defaultDestinations);
    setIncoterms(defaultIncoterms);
    setLogisticsMode(logisticModes[0]);
    persistToStorage(DEST_KEY, defaultDestinations);
    persistToStorage(INCOTERM_KEY, defaultIncoterms);
    persistToStorage(LOGISTICS_MODE_KEY, logisticModes[0]);
    resetReferenceData();
    toast.success('Référentiel remis par défaut');
    setIsResetOpen(false);
  };

  const handleResetAll = () => {
    localStorage.clear();
    setDestinations(defaultDestinations);
    setIncoterms(defaultIncoterms);
    setLogisticsMode(logisticModes[0]);
    resetReferenceData();
    toast.success('Tous les réglages locaux ont été supprimés');
    setIsResetOpen(false);
  };

  const upsertDestination = (draft: DestinationRow) => {
    const name = draft.name.trim();
    if (!name) {
      toast.error('Le nom est obligatoire');
      return;
    }
    const duplicate = destinations.find((d) => d.id !== draft.id && d.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      toast.error('Nom déjà utilisé');
      return;
    }
    const next = destinations.some((d) => d.id === draft.id)
      ? destinations.map((d) => (d.id === draft.id ? { ...draft, name } : d))
      : [...destinations, { ...draft, name }];
    setDestinations(next);
    setEditDestination(null);
    toast.success('Destination sauvegardée');
  };

  const removeDestination = () => {
    if (!deleteDestination) return;
    setDestinations(destinations.filter((d) => d.id !== deleteDestination.id));
    setDeleteDestination(null);
    toast.success('Destination supprimée');
  };

  const upsertIncoterm = (draft: IncotermRow) => {
    const next = incoterms.some((i) => i.id === draft.id)
      ? incoterms.map((i) => (i.id === draft.id ? draft : i))
      : [...incoterms, draft];
    setIncoterms(next);
    setEditIncoterm(null);
    toast.success('Incoterm sauvegardé');
  };

  const filteredDestinations = useMemo(() => {
    return destinations.filter((dest) => {
      const matchesSearch = dest.name.toLowerCase().includes(destSearch.toLowerCase());
      const matchesZone = zoneFilter ? dest.zone === zoneFilter : true;
      const matchesLog = logisticsFilter ? dest.logisticMode === logisticsFilter : true;
      return matchesSearch && matchesZone && matchesLog;
    });
  }, [destinations, destSearch, zoneFilter, logisticsFilter]);

  const filteredIncoterms = useMemo(() => {
    return incoterms.filter((row) => row.code.toLowerCase().includes(destSearch.toLowerCase()) || (row.notes ?? '').toLowerCase().includes(destSearch.toLowerCase()));
  }, [incoterms, destSearch]);

  const displayDate = useMemo(() => new Date().toLocaleString(), []);

  const renderDocs = (docs: DocFlags) => {
    const docList = [
      docs.facture && 'Facture',
      docs.packing && 'Packing',
      docs.blAwb && 'BL/AWB',
      docs.certifOrigine && 'Certif origine',
      docs.declarationDouane && 'Déclaration douane',
      docs.preuveExport && 'Preuve export',
      docs.autres ? `Autres: ${docs.autres}` : null,
    ].filter(Boolean);
    return docList.join(' • ');
  };

  const renderControls = (controls: ControlFlags) => {
    const list = [
      controls.incotermVsPayeur && 'Incoterm vs payeur',
      controls.refacturationTransit && 'Refacturation transit',
      controls.justificatifsTVA && 'Justificatifs TVA',
      controls.taxesDOM && 'Taxes DOM (OM/OMR)',
      controls.autoliquidation && 'Autoliquidation',
    ].filter(Boolean);
    return list.join(' • ');
  };

  const startNewDestination = () => {
    setEditDestination({
      id: crypto.randomUUID(),
      name: '',
      zone: 'UE',
      logisticMode: logisticModes[0],
      docs: { facture: true, packing: true, blAwb: false, certifOrigine: false, declarationDouane: false, preuveExport: false, autres: '' },
      controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: false, autoliquidation: true },
      notes: '',
    });
  };

  const startNewIncoterm = () => {
    setEditIncoterm({
      id: crypto.randomUUID(),
      code: 'EXW',
      notes: '',
      payers: { transport: 'Client', dedouanementImport: 'Client', droits: 'Client', tvaImport: 'Client', omOmr: 'Client' },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Bible Export – Référentiel &amp; règles</h1>
            <p className="text-muted-foreground">
              Guide opérationnel 100% métier : zero JSON, tout en formulaires. Données locales avec import/export JSON.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              <span>Màj locale : {displayDate}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="secondary" onClick={handlePrefill}>
              <Sparkles className="h-4 w-4 mr-2" />
              Préremplir (Orliman)
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exporter la bible
            </Button>
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importer la bible
            </Button>
            <Button variant="ghost" onClick={() => setIsResetOpen(true)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        <Tabs defaultValue="destinations" className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="destinations">A) Destinations</TabsTrigger>
            <TabsTrigger value="incoterms">B) Incoterms</TabsTrigger>
            <TabsTrigger value="charges">C) Charges &amp; Taxes</TabsTrigger>
            <TabsTrigger value="cheatsheets">D) Cheatsheets</TabsTrigger>
            <TabsTrigger value="logistics">E) Logistique</TabsTrigger>
            <TabsTrigger value="nomenclature">F) Nomenclature (HS)</TabsTrigger>
          </TabsList>

          <TabsContent value="destinations" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="flex items-center gap-2">Destinations &amp; contrôles terrain</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Input placeholder="Recherche destination" value={destSearch} onChange={(e) => setDestSearch(e.target.value)} className="w-48" />
                    <Select value={zoneFilter} onValueChange={setZoneFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Zone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Toutes zones</SelectItem>
                        {zones.map((z) => (
                          <SelectItem key={z} value={z}>
                            {z}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={logisticsFilter} onValueChange={setLogisticsFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Mode logistique" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Tous modes</SelectItem>
                        {logisticModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={startNewDestination}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Filter className="h-4 w-4" /> Filtre par zone et mode logistique. Actions par ligne : voir (fiche 1 min), modifier, supprimer.
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Mode logistique</TableHead>
                      <TableHead>Docs requis</TableHead>
                      <TableHead>Contrôles</TableHead>
                      <TableHead className="w-[220px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDestinations.map((dest) => (
                      <TableRow key={dest.id}>
                        <TableCell className="font-medium">{dest.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{dest.zone}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{dest.logisticMode}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{renderDocs(dest.docs)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{renderControls(dest.controls)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setViewDestination(dest)}>
                              <Eye className="h-4 w-4 mr-1" /> Voir
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditDestination(dest)}>
                              <FileEdit className="h-4 w-4 mr-1" /> Modifier
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeleteDestination(dest)}>
                              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDestinations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                          Aucune destination ne correspond aux filtres.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incoterms" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <CardTitle>Incoterms (payeurs &amp; notes)</CardTitle>
                  <p className="text-sm text-muted-foreground">Répartition des charges par poste. Ajout/édition en modale.</p>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Recherche" value={destSearch} onChange={(e) => setDestSearch(e.target.value)} className="w-48" />
                  <Button variant="outline" onClick={startNewIncoterm}>
                    <Plus className="h-4 w-4 mr-2" /> Ajouter
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert variant="warning">
                  <AlertTitle>Alerte DROM + DDP</AlertTitle>
                  <AlertDescription>
                    Si Zone = DROM et Incoterm = DDP ⇒ risque fort (anticiper OM/OMR, droits, TVA). Privilégier FCA/DAP.
                  </AlertDescription>
                </Alert>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Incoterm</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Transport</TableHead>
                      <TableHead>Dédouanement import</TableHead>
                      <TableHead>Droits</TableHead>
                      <TableHead>TVA import</TableHead>
                      <TableHead>OM/OMR</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIncoterms.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-semibold">
                          <Badge variant="outline">{row.code}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.notes}</TableCell>
                        <TableCell>{row.payers.transport}</TableCell>
                        <TableCell>{row.payers.dedouanementImport}</TableCell>
                        <TableCell>{row.payers.droits}</TableCell>
                        <TableCell>{row.payers.tvaImport}</TableCell>
                        <TableCell>{row.payers.omOmr}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setEditIncoterm(row)}>
                              <FileEdit className="h-4 w-4 mr-1" />
                              Modifier
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredIncoterms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                          Aucun incoterm trouvé.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charges" className="space-y-4">
            <div className="grid gap-3">
              {referenceData.chargesTaxes.map((rule: ChargeTaxRule, idx: number) => (
                <Card key={`${rule.name}-${idx}`}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap gap-2 items-center">
                      <Badge variant="outline">{rule.scope}</Badge>
                      <span>{rule.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                    <div>
                      <p className="font-semibold text-foreground">Payeur</p>
                      <p>{rule.payer}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Déclencheur</p>
                      <p>{rule.trigger}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Docs obligatoires</p>
                      <ul className="list-disc ml-4 space-y-1">
                        {(rule.mandatoryDocs || []).map((doc) => (
                          <li key={doc}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                    {rule.comment ? (
                      <div className="md:col-span-3">
                        <p className="font-semibold text-foreground">Commentaire</p>
                        <p>{rule.comment}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cheatsheets" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {referenceData.cheatSheets.map((sheet: CheatSheet, idx: number) => (
                <Card key={`${sheet.title}-${idx}`}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap gap-2 items-center">
                      <span>{sheet.title}</span>
                      {sheet.warning ? <Badge variant="secondary">{sheet.warning}</Badge> : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div>
                      <p className="font-semibold text-foreground">Rappels terrain</p>
                      <ul className="list-disc ml-4 space-y-1">
                        {sheet.reminders.map((reminder) => (
                          <li key={reminder}>{reminder}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Documents</p>
                      <ul className="list-disc ml-4 space-y-1">
                        {sheet.documents.map((doc) => (
                          <li key={doc}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logistics" className="space-y-4">
            <Card>
              <CardHeader className="space-y-2">
                <CardTitle>Logistique (Dépositaire vs Direct)</CardTitle>
                <p className="text-sm text-muted-foreground">Sélectionnez votre mode par défaut et consultez les impacts.</p>
                <div className="flex flex-col md:flex-row md:items-center md:gap-3">
                  <Select value={logisticsMode} onValueChange={(value) => setLogisticsMode(value as (typeof logisticModes)[number])}>
                    <SelectTrigger className="w-[260px]">
                      <SelectValue placeholder="Mode logistique par défaut" />
                    </SelectTrigger>
                    <SelectContent>
                      {logisticModes.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary">Clé locale : {LOGISTICS_MODE_KEY}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  {logisticModes.map((mode) => (
                    <Card key={mode} className={mode === logisticsMode ? 'border-primary/70' : ''}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {mode === logisticsMode ? <Badge>Mode par défaut</Badge> : null}
                          {mode}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <div>
                          <p className="font-semibold text-foreground">Documents</p>
                          <ul className="list-disc ml-4 space-y-1">
                            {logisticImpacts[mode].documents.map((doc) => (
                              <li key={doc}>{doc}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Taxes / charges</p>
                          <ul className="list-disc ml-4 space-y-1">
                            {logisticImpacts[mode].taxes.map((tax) => (
                              <li key={tax}>{tax}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">Contrôles</p>
                          <ul className="list-disc ml-4 space-y-1">
                            {logisticImpacts[mode].controls.map((control) => (
                              <li key={control}>{control}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Alert variant="warning">
                  <AlertTitle>Attention DROM + Dépositaire</AlertTitle>
                  <AlertDescription>{warningDromDepositaire}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nomenclature" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Nomenclature HS (orthèses)</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3">
                {referenceData.nomenclature.map((item: NomenclatureEntry, idx: number) => (
                  <Card key={`${item.hsCode}-${idx}`}>
                    <CardHeader>
                      <CardTitle className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline">HS {item.hsCode}</Badge>
                        <span>{item.label}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <div>
                        <p className="font-semibold text-foreground">Usages</p>
                        <ul className="list-disc ml-4 space-y-1">
                          {item.usages.map((u) => (
                            <li key={u}>{u}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Documents</p>
                        <ul className="list-disc ml-4 space-y-1">
                          {item.documents.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-col gap-1">
                        <a className="text-primary underline" href={item.taricUrl} target="_blank" rel="noreferrer">
                          Ouvrir TARIC
                        </a>
                        <a className="text-primary underline" href={item.taresUrl} target="_blank" rel="noreferrer">
                          Ouvrir TARes
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Stockage local-first : Destinations ({DEST_KEY}), Incoterms ({INCOTERM_KEY}), mode logistique ({LOGISTICS_MODE_KEY}).</p>
            <p>Export/Import via JSON, aucune saisie technique nécessaire. Toujours valider les cas sensibles avec finance/déclarant.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewDestination} onOpenChange={(open) => setViewDestination(open ? viewDestination : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fiche destination</DialogTitle>
            <DialogDescription>Récapitulatif en 1 minute.</DialogDescription>
          </DialogHeader>
          {viewDestination ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-2 items-center text-foreground">
                <Badge variant="outline">{viewDestination.zone}</Badge>
                <Badge variant="secondary">{viewDestination.logisticMode}</Badge>
                <span className="font-semibold">{viewDestination.name}</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">Documents</p>
                <p>{renderDocs(viewDestination.docs)}</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Contrôles</p>
                <p>{renderControls(viewDestination.controls)}</p>
              </div>
              {viewDestination.notes ? (
                <div>
                  <p className="font-semibold text-foreground">Notes</p>
                  <p>{viewDestination.notes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setViewDestination(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDestination} onOpenChange={(open) => setEditDestination(open ? editDestination : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editDestination?.id && destinations.some((d) => d.id === editDestination.id) ? 'Modifier' : 'Ajouter'} une destination</DialogTitle>
            <DialogDescription>Champs métiers uniquement.</DialogDescription>
          </DialogHeader>
          {editDestination ? (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Nom</label>
                  <Input
                    value={editDestination.name}
                    onChange={(e) => setEditDestination({ ...editDestination, name: e.target.value })}
                    placeholder="Nom unique"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Zone</label>
                  <Select
                    value={editDestination.zone}
                    onValueChange={(value) => setEditDestination({ ...editDestination, zone: value as DestinationRow['zone'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Mode logistique</label>
                  <Select
                    value={editDestination.logisticMode}
                    onValueChange={(value) =>
                      setEditDestination({ ...editDestination, logisticMode: value as DestinationRow['logisticMode'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mode logistique" />
                    </SelectTrigger>
                    <SelectContent>
                      {logisticModes.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Textarea
                    value={editDestination.notes || ''}
                    onChange={(e) => setEditDestination({ ...editDestination, notes: e.target.value })}
                    placeholder="Contraintes locales, saisonnalité, etc."
                    rows={3}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Docs requis</p>
                  <div className="space-y-2">
                    {docCheckboxes.map((doc) => (
                      <label key={doc.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editDestination.docs[doc.key]}
                          onCheckedChange={(checked) =>
                            setEditDestination({
                              ...editDestination,
                              docs: { ...editDestination.docs, [doc.key]: Boolean(checked) },
                            })
                          }
                        />
                        {doc.label}
                      </label>
                    ))}
                    <Input
                      placeholder="Autres"
                      value={editDestination.docs.autres}
                      onChange={(e) => setEditDestination({ ...editDestination, docs: { ...editDestination.docs, autres: e.target.value } })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Contrôles</p>
                  <div className="space-y-2">
                    {controlCheckboxes.map((ctrl) => (
                      <label key={ctrl.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editDestination.controls[ctrl.key]}
                          onCheckedChange={(checked) =>
                            setEditDestination({
                              ...editDestination,
                              controls: { ...editDestination.controls, [ctrl.key]: Boolean(checked) },
                            })
                          }
                        />
                        {ctrl.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDestination(null)}>
              Annuler
            </Button>
            <Button onClick={() => editDestination && upsertDestination(editDestination)}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editIncoterm} onOpenChange={(open) => setEditIncoterm(open ? editIncoterm : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editIncoterm && incoterms.some((i) => i.id === editIncoterm.id) ? 'Modifier' : 'Ajouter'} un incoterm</DialogTitle>
            <DialogDescription>Choix du payeur par poste.</DialogDescription>
          </DialogHeader>
          {editIncoterm ? (
            <div className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Incoterm</label>
                  <Select
                    value={editIncoterm.code}
                    onValueChange={(value) => setEditIncoterm({ ...editIncoterm, code: value as IncotermRow['code'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Incoterm" />
                    </SelectTrigger>
                    <SelectContent>
                      {incotermCodes.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Textarea
                    value={editIncoterm.notes || ''}
                    onChange={(e) => setEditIncoterm({ ...editIncoterm, notes: e.target.value })}
                    rows={3}
                    placeholder="Précisions commerciales"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {(
                  [
                    { key: 'transport', label: 'Transport' },
                    { key: 'dedouanementImport', label: 'Dédouanement import' },
                    { key: 'droits', label: 'Droits' },
                    { key: 'tvaImport', label: 'TVA import' },
                    { key: 'omOmr', label: 'OM/OMR' },
                  ] as const
                ).map((item) => (
                  <div key={item.key} className="space-y-2">
                    <label className="text-xs text-muted-foreground">{item.label}</label>
                    <Select
                      value={editIncoterm.payers[item.key]}
                      onValueChange={(value) =>
                        setEditIncoterm({
                          ...editIncoterm,
                          payers: { ...editIncoterm.payers, [item.key]: value as IncotermPayer },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Payeur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fournisseur">Fournisseur</SelectItem>
                        <SelectItem value="Client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditIncoterm(null)}>
              Annuler
            </Button>
            <Button onClick={() => editIncoterm && upsertIncoterm(editIncoterm)}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDestination} onOpenChange={(open) => setDeleteDestination(open ? deleteDestination : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette destination ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible. La ligne sera retirée de {DEST_KEY}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={removeDestination}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importer la bible</DialogTitle>
            <DialogDescription>Choisissez un JSON, prévisualisez, puis appliquez.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={(e) => handleImport(e.target.files?.[0] || undefined)}
            />
            {importError ? <p className="text-sm text-destructive">{importError}</p> : null}
            {importPreview ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Destinations</CardTitle>
                  </CardHeader>
                  <CardContent>{importPreview?.destinations?.length ?? 0} lignes</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Incoterms</CardTitle>
                  </CardHeader>
                  <CardContent>{importPreview?.incoterms?.length ?? 0} lignes</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Logistique / HS</CardTitle>
                  </CardHeader>
                  <CardContent>
                    Mode log : {importPreview?.logisticsMode || '—'}
                    <br />
                    Codes HS : {importPreview?.nomenclature?.length ?? referenceData.nomenclature.length}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Prévisualisation après sélection du fichier.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsImportOpen(false)}>
              Annuler
            </Button>
            <Button onClick={applyImport} disabled={!importPreview}>
              Appliquer l’import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset</DialogTitle>
            <DialogDescription>Choisissez le périmètre à remettre à zéro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Reset référentiel : remet Destinations/Incoterms/Logistique et les sections par défaut.</p>
            <p>Reset tout : vide le localStorage complet.</p>
          </div>
          <DialogFooter className="flex flex-col md:flex-row md:gap-2">
            <Button variant="outline" onClick={handleResetRef}>
              Reset référentiel
            </Button>
            <Button variant="destructive" onClick={handleResetAll}>
              Reset tout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
