import { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { CalendarClock, Download, Eye, FileEdit, Filter, Plus, RefreshCw, Sparkles, Trash2, Upload, Save } from 'lucide-react';
import { toast } from 'sonner';
import { chargesTaxesKnowledge, type ChargeRule } from '@/data/chargesTaxesKnowledge';
import { defaultHsCatalog, type HsItem } from '@/data/hsCatalog';
import { buildSwissTaresUrl, buildTaricUrl } from '@/lib/customs/lookupLinks';
import { supabase } from '@/lib/supabaseClient';

const logisticModes = ['Envoi direct depuis métropole', 'Dépositaire / stock local'] as const;
const zones = ['UE', 'DROM', 'Suisse', 'Hors UE'] as const;
const allFilter = 'all';
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
  exportedAt?: string;
  destinations?: DestinationRow[];
  incoterms?: IncotermRow[];
  logisticsMode?: (typeof logisticModes)[number];
  hsCatalog?: HsItem[];
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

const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // ignore and fallback below
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const defaultDestinations: DestinationRow[] = [
  {
    id: 'dest-drom-direct',
    name: 'DROM Direct',
    zone: 'DROM',
    logisticMode: 'Envoi direct depuis métropole',
    docs: { facture: true, packing: true, blAwb: true, certifOrigine: false, declarationDouane: true, preuveExport: true, autres: 'Document OM/OMR' },
    controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: true, autoliquidation: false },
    notes: 'Anticiper OM/OMR ; valeur douane = marchandise + transport.',
  },
  {
    id: 'dest-drom-depositaire',
    name: 'DROM Dépositaire',
    zone: 'DROM',
    logisticMode: 'Dépositaire / stock local',
    docs: { facture: true, packing: true, blAwb: true, certifOrigine: false, declarationDouane: true, preuveExport: true, autres: 'Inventaire stock local' },
    controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: true, autoliquidation: false },
    notes: 'Vérifier entrée DOM et justificatifs de stock. OM/OMR réglés à l’import.',
  },
  {
    id: 'dest-ue-intra',
    name: 'UE Intra',
    zone: 'UE',
    logisticMode: 'Envoi direct depuis métropole',
    docs: { facture: true, packing: true, blAwb: false, certifOrigine: false, declarationDouane: false, preuveExport: true, autres: 'Preuve transport (CMR/BL)' },
    controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: false, autoliquidation: true },
    notes: 'N° TVA client + preuve transport pour autoliquidation.',
  },
  {
    id: 'dest-ch-import',
    name: 'Suisse Import',
    zone: 'Suisse',
    logisticMode: 'Envoi direct depuis métropole',
    docs: { facture: true, packing: true, blAwb: true, certifOrigine: true, declarationDouane: true, preuveExport: true, autres: '' },
    controls: { incotermVsPayeur: true, refacturationTransit: true, justificatifsTVA: true, taxesDOM: false, autoliquidation: false },
    notes: 'EUR.1 ou déclaration d’origine si préférences ; TVA import 7.7%.',
  },
];

const defaultIncoterms: IncotermRow[] = [
  {
    id: 'inc-exw',
    code: 'EXW',
    notes: 'Client récupère à l’usine ; transit refacturable.',
    payers: { transport: 'Client', dedouanementImport: 'Client', droits: 'Client', tvaImport: 'Client', omOmr: 'Client' },
  },
  {
    id: 'inc-fca',
    code: 'FCA',
    notes: 'Dédouanement export vendeur, transport principal client.',
    payers: { transport: 'Client', dedouanementImport: 'Client', droits: 'Client', tvaImport: 'Client', omOmr: 'Client' },
  },
  {
    id: 'inc-dap',
    code: 'DAP',
    notes: 'Transport payé fournisseur, import à charge client.',
    payers: { transport: 'Fournisseur', dedouanementImport: 'Client', droits: 'Client', tvaImport: 'Client', omOmr: 'Client' },
  },
  {
    id: 'inc-ddp',
    code: 'DDP',
    notes: 'Vendeur supporte tous les coûts. Risque fort en DROM.',
    payers: { transport: 'Fournisseur', dedouanementImport: 'Fournisseur', droits: 'Fournisseur', tvaImport: 'Fournisseur', omOmr: 'Fournisseur' },
  },
];

const cheatsheets = [
  {
    title: 'DROM',
    resume: 'OM/OMR + TVA locale. Vérifier valeur douane avec transport.',
    docs: ['Facture détaillée', 'Packing list', 'BL/AWB', 'Document OM/OMR', 'Preuve export'],
    risques: ['Retards portuaires', 'Mauvais HS ⇒ OM/OMR erroné', 'DDP = risque trésorerie élevé'],
    controles: ['HS code validé', 'Valeur transport intégrée', 'Preuve import + paiement OM/OMR'],
    cta: [
      { label: 'Créer destination DROM Direct', targetId: 'dest-drom-direct' },
      { label: 'Créer destination DROM Dépositaire', targetId: 'dest-drom-depositaire' },
    ],
  },
  {
    title: 'UE',
    resume: 'Intra-UE : autoliquidation si N° TVA et preuve transport.',
    docs: ['Facture', 'Preuve transport (CMR/BL)', 'N° TVA client validé'],
    risques: ['Preuve transport manquante', 'N° TVA invalide'],
    controles: ['N° TVA vérifié (VIES)', 'Incoterm FCA/DAP conseillé'],
    cta: [{ label: 'Créer destination UE Intra', targetId: 'dest-ue-intra' }],
  },
  {
    title: 'Suisse',
    resume: 'TVA import 7.7% + droits selon HS et origine.',
    docs: ['Facture', 'Packing list', 'BL/AWB', 'EUR.1 ou déclaration d’origine', 'Décompte TVA import'],
    risques: ['Origine non maîtrisée', 'Transport non valorisé'],
    controles: ['HS code confirmé', 'Valeur transport incluse', 'Preuve origine si préférences'],
    cta: [{ label: 'Créer destination Suisse Import', targetId: 'dest-ch-import' }],
  },
];

const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const isDestinationArray = (value: unknown): value is DestinationRow[] => Array.isArray(value);
const isIncotermArray = (value: unknown): value is IncotermRow[] => Array.isArray(value);
const isHsArray = (value: unknown): value is HsItem[] => Array.isArray(value);

const SETTINGS_KEY_LOGISTICS = 'logistics_mode';

export default function ReferenceLibrary() {
  const [destinations, setDestinations] = useState<DestinationRow[]>(defaultDestinations);
  const [incoterms, setIncoterms] = useState<IncotermRow[]>(defaultIncoterms);
  const [hsCatalog, setHsCatalog] = useState<HsItem[]>(defaultHsCatalog);
  const [logisticsMode, setLogisticsMode] = useState<(typeof logisticModes)[number]>(logisticModes[0]);

  const [destSearch, setDestSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string>(allFilter);
  const [logisticsFilter, setLogisticsFilter] = useState<string>(allFilter);
  const [importPreview, setImportPreview] = useState<ImportPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [viewDestination, setViewDestination] = useState<DestinationRow | null>(null);
  const [editDestination, setEditDestination] = useState<DestinationRow | null>(null);
  const [deleteDestination, setDeleteDestination] = useState<DestinationRow | null>(null);
  const [editIncoterm, setEditIncoterm] = useState<IncotermRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [syncInfo, setSyncInfo] = useState<string>('');

  const displayDate = useMemo(() => new Date().toLocaleString(), []);

  const fetchAll = async (seedIfEmpty = true) => {
    setLoading(true);
    setSyncInfo('');
    try {
      // Destinations
      const destRes = await supabase
        .from('export_destinations')
        .select('id,name,zone,logistic_mode,docs,controls,notes')
        .order('name', { ascending: true });

      if (destRes.error) throw destRes.error;

      // Incoterms
      const incRes = await supabase
        .from('export_incoterms')
        .select('id,code,notes,payers')
        .order('code', { ascending: true });

      if (incRes.error) throw incRes.error;

      // HS
      const hsRes = await supabase
        .from('export_hs_catalog')
        .select('hs_code,label,notes,risk')
        .order('hs_code', { ascending: true });

      if (hsRes.error) throw hsRes.error;

      // Settings
      const setRes = await supabase
        .from('export_settings')
        .select('key,value')
        .eq('key', SETTINGS_KEY_LOGISTICS)
        .maybeSingle();

      if (setRes.error && setRes.status !== 406) throw setRes.error;

      const destRows = (destRes.data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        zone: d.zone,
        logisticMode: d.logistic_mode,
        docs: d.docs,
        controls: d.controls,
        notes: d.notes ?? '',
      })) as DestinationRow[];

      const incRows = (incRes.data ?? []).map((i) => ({
        id: i.id,
        code: i.code,
        notes: i.notes ?? '',
        payers: i.payers,
      })) as IncotermRow[];

      const hsRows = (hsRes.data ?? []).map((h) => ({
        hsCode: h.hs_code,
        label: h.label,
        notes: h.notes ?? '',
        risk: (h.risk ?? 'Modéré') as HsItem['risk'],
      })) as HsItem[];

      const storedMode = setRes.data?.value?.mode as string | undefined;
      const mode = logisticModes.includes(storedMode as any) ? (storedMode as any) : logisticModes[0];

      // Seed si tables vides (première utilisation)
      if (seedIfEmpty && destRows.length === 0 && incRows.length === 0 && hsRows.length === 0) {
        await seedDefaults();
        setSyncInfo('Référentiel initial créé (seed).');
        await fetchAll(false);
        return;
      }

      setDestinations(destRows.length ? destRows : defaultDestinations);
      setIncoterms(incRows.length ? incRows : defaultIncoterms);
      setHsCatalog(hsRows.length ? hsRows : defaultHsCatalog);
      setLogisticsMode(mode);

      setSyncInfo('Synchronisé avec Supabase.');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur Supabase (chargement référentiel).');
      setSyncInfo('Erreur de synchro.');
    } finally {
      setLoading(false);
    }
  };

  const seedDefaults = async () => {
    // Destinations
    const destPayload = defaultDestinations.map((d) => ({
      id: d.id,
      name: d.name,
      zone: d.zone,
      logistic_mode: d.logisticMode,
      docs: d.docs,
      controls: d.controls,
      notes: d.notes ?? null,
    }));

    const incPayload = defaultIncoterms.map((i) => ({
      id: i.id,
      code: i.code,
      notes: i.notes ?? null,
      payers: i.payers,
    }));

    const hsPayload = defaultHsCatalog.map((h) => ({
      hs_code: h.hsCode,
      label: h.label,
      notes: h.notes ?? null,
      risk: h.risk ?? null,
    }));

    const r1 = await supabase.from('export_destinations').upsert(destPayload);
    if (r1.error) throw r1.error;

    const r2 = await supabase.from('export_incoterms').upsert(incPayload);
    if (r2.error) throw r2.error;

    const r3 = await supabase.from('export_hs_catalog').upsert(hsPayload, { onConflict: 'hs_code' });
    if (r3.error) throw r3.error;

    const r4 = await supabase
      .from('export_settings')
      .upsert({ key: SETTINGS_KEY_LOGISTICS, value: { mode: logisticModes[0] } });
    if (r4.error) throw r4.error;
  };

  useEffect(() => {
    fetchAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveLogisticsMode = async (mode: (typeof logisticModes)[number]) => {
    setLogisticsMode(mode);
    const { error } = await supabase.from('export_settings').upsert({ key: SETTINGS_KEY_LOGISTICS, value: { mode } });
    if (error) toast.error(error.message);
  };

  const handlePrefill = async () => {
    try {
      setLoading(true);
      // On merge local, puis on upsert complet
      const mergedDest = mergeWithoutDuplicateNames(destinations, defaultDestinations);
      const mergedInc = mergeIncoterms(incoterms, defaultIncoterms);

      const destPayload = mergedDest.map((d) => ({
        id: d.id,
        name: d.name,
        zone: d.zone,
        logistic_mode: d.logisticMode,
        docs: d.docs,
        controls: d.controls,
        notes: d.notes ?? null,
      }));

      const incPayload = mergedInc.map((i) => ({
        id: i.id,
        code: i.code,
        notes: i.notes ?? null,
        payers: i.payers,
      }));

      const r1 = await supabase.from('export_destinations').upsert(destPayload);
      if (r1.error) throw r1.error;

      const r2 = await supabase.from('export_incoterms').upsert(incPayload);
      if (r2.error) throw r2.error;

      // HS remis au catalogue par défaut
      const hsPayload = defaultHsCatalog.map((h) => ({
        hs_code: h.hsCode,
        label: h.label,
        notes: h.notes ?? null,
        risk: h.risk ?? null,
      }));
      const r3 = await supabase.from('export_hs_catalog').upsert(hsPayload, { onConflict: 'hs_code' });
      if (r3.error) throw r3.error;

      await saveLogisticsMode(logisticModes[0]);

      toast.success('Préremplissage Orliman appliqué (Supabase, sans doublons)');
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur lors du préremplissage.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const payload: ImportPayload = {
      version: 'v3-supabase',
      exportedAt: new Date().toISOString(),
      destinations,
      incoterms,
      logisticsMode,
      hsCatalog,
    };
    downloadJson(payload, 'bible_export_navigator.json');
  };

  const handleImport = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as ImportPayload;
        if (!Array.isArray(parsed.destinations) || !Array.isArray(parsed.incoterms)) throw new Error('Structure JSON inattendue');
        setImportPreview(parsed);
        setImportError(null);
      } catch (error) {
        console.error(error);
        setImportPreview(null);
        setImportError('Fichier JSON invalide ou structure incompatible');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const applyImport = async () => {
    if (!importPreview) return;
    try {
      setLoading(true);

      if (importPreview.destinations && isDestinationArray(importPreview.destinations)) {
        const destPayload = importPreview.destinations.map((d) => ({
          id: d.id || generateId(),
          name: d.name,
          zone: d.zone,
          logistic_mode: d.logisticMode,
          docs: d.docs,
          controls: d.controls,
          notes: d.notes ?? null,
        }));
        const r = await supabase.from('export_destinations').upsert(destPayload);
        if (r.error) throw r.error;
      }

      if (importPreview.incoterms && isIncotermArray(importPreview.incoterms)) {
        const incPayload = importPreview.incoterms.map((i) => ({
          id: i.id || generateId(),
          code: i.code,
          notes: i.notes ?? null,
          payers: i.payers,
        }));
        const r = await supabase.from('export_incoterms').upsert(incPayload);
        if (r.error) throw r.error;
      }

      if (importPreview.hsCatalog && isHsArray(importPreview.hsCatalog)) {
        const hsPayload = importPreview.hsCatalog.map((h) => ({
          hs_code: h.hsCode,
          label: h.label,
          notes: h.notes ?? null,
          risk: h.risk ?? null,
        }));
        const r = await supabase.from('export_hs_catalog').upsert(hsPayload, { onConflict: 'hs_code' });
        if (r.error) throw r.error;
      }

      if (importPreview.logisticsMode) {
        const importedMode = logisticModes.includes(importPreview.logisticsMode) ? importPreview.logisticsMode : logisticModes[0];
        await saveLogisticsMode(importedMode);
      }

      toast.success('Import appliqué (Supabase)');
      setIsImportOpen(false);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur lors de l’import.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetRef = async () => {
    try {
      setLoading(true);
      // purge tables + reseed
      const r1 = await supabase.from('export_destinations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (r1.error) throw r1.error;
      const r2 = await supabase.from('export_incoterms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (r2.error) throw r2.error;
      const r3 = await supabase.from('export_hs_catalog').delete().neq('hs_code', '___NOPE___');
      if (r3.error) throw r3.error;

      await seedDefaults();
      toast.success('Référentiel remis par défaut (Supabase)');
      setIsResetOpen(false);
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur reset référentiel.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAll = async () => {
    // Ici "Reset tout" = référentiel + settings
    try {
      setLoading(true);
      await handleResetRef();
      const r4 = await supabase.from('export_settings').delete().eq('key', SETTINGS_KEY_LOGISTICS);
      if (r4.error) throw r4.error;
      await supabase.from('export_settings').upsert({ key: SETTINGS_KEY_LOGISTICS, value: { mode: logisticModes[0] } });
      toast.success('Tous les réglages Supabase ont été réinitialisés');
      setIsResetOpen(false);
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur reset global.');
    } finally {
      setLoading(false);
    }
  };

  const upsertDestination = async (draft: DestinationRow) => {
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

    try {
      setLoading(true);
      const payload = {
        id: draft.id,
        name,
        zone: draft.zone,
        logistic_mode: draft.logisticMode,
        docs: draft.docs,
        controls: draft.controls,
        notes: draft.notes ?? null,
      };

      const { error } = await supabase.from('export_destinations').upsert(payload);
      if (error) throw error;

      toast.success('Destination sauvegardée (Supabase)');
      setEditDestination(null);
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur sauvegarde destination.');
    } finally {
      setLoading(false);
    }
  };

  const removeDestination = async () => {
    if (!deleteDestination) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('export_destinations').delete().eq('id', deleteDestination.id);
      if (error) throw error;
      toast.success('Destination supprimée');
      setDeleteDestination(null);
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur suppression destination.');
    } finally {
      setLoading(false);
    }
  };

  const upsertIncoterm = async (draft: IncotermRow) => {
    try {
      setLoading(true);
      const payload = {
        id: draft.id,
        code: draft.code,
        notes: draft.notes ?? null,
        payers: draft.payers,
      };
      const { error } = await supabase.from('export_incoterms').upsert(payload);
      if (error) throw error;
      toast.success('Incoterm sauvegardé');
      setEditIncoterm(null);
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur sauvegarde incoterm.');
    } finally {
      setLoading(false);
    }
  };

  const addHsLine = () => {
    setHsCatalog([...hsCatalog, { hsCode: '0000', label: 'Nouveau code', notes: 'Notes', risk: 'Modéré' }]);
  };

  const updateHsLine = (index: number, value: Partial<HsItem>) => {
    setHsCatalog((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...value } : item)));
  };

  const saveHsCatalog = async () => {
    try {
      setLoading(true);
      const payload = hsCatalog
        .filter((h) => (h.hsCode || '').trim() !== '')
        .map((h) => ({
          hs_code: h.hsCode.trim(),
          label: (h.label || '').trim() || '—',
          notes: h.notes ?? null,
          risk: h.risk ?? null,
        }));

      const { error } = await supabase.from('export_hs_catalog').upsert(payload, { onConflict: 'hs_code' });
      if (error) throw error;

      toast.success('Catalogue HS sauvegardé (Supabase)');
      await fetchAll(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erreur sauvegarde HS.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDestinations = useMemo(() => {
    return destinations.filter((dest) => {
      const matchesSearch = dest.name.toLowerCase().includes(destSearch.toLowerCase());
      const matchesZone = zoneFilter === allFilter ? true : dest.zone === zoneFilter;
      const matchesLog = logisticsFilter === allFilter ? true : dest.logisticMode === logisticsFilter;
      return matchesSearch && matchesZone && matchesLog;
    });
  }, [destinations, destSearch, zoneFilter, logisticsFilter]);

  const filteredIncoterms = useMemo(() => {
    return incoterms.filter((row) => row.code.toLowerCase().includes(destSearch.toLowerCase()) || (row.notes ?? '').toLowerCase().includes(destSearch.toLowerCase()));
  }, [incoterms, destSearch]);

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
      id: generateId(),
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
      id: generateId(),
      code: 'EXW',
      notes: '',
      payers: { transport: 'Client', dedouanementImport: 'Client', droits: 'Client', tvaImport: 'Client', omOmr: 'Client' },
    });
  };

  const createDestinationFromCheat = async (targetId: string) => {
    const template = defaultDestinations.find((d) => d.id === targetId);
    if (!template) return;
    await upsertDestination(template);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Bible Export – Référentiel &amp; règles</h1>
            <p className="text-muted-foreground">Référentiel métier synchronisé Supabase (partagé) + export/import JSON.</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              <span>Màj : {displayDate}</span>
              {syncInfo ? <Badge variant="secondary">{syncInfo}</Badge> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => fetchAll(false)} disabled=
