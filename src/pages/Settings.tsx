import { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Download, FilePlus, RefreshCw, Upload } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type MarginThresholds = {
  marginMinPercent: number;
  marginMinEuro: number;
  transitCoverageMinPercent: number;
};

type DestinationZone = 'UE' | 'DROM' | 'Suisse' | 'Hors UE';

type DestinationDocuments = {
  facture: boolean;
  packingList: boolean;
  blAwb: boolean;
  certificatOrigine: boolean;
  declarationDouane: boolean;
  preuveExport: boolean;
  autre?: string;
};

type Destination = {
  id: string;
  name: string;
  zone: DestinationZone;
  countryCode?: string;
  documents: DestinationDocuments;
  notes?: string;
};

type Payer = 'Fournisseur' | 'Client';

type IncotermCode = 'EXW' | 'FCA' | 'FOB' | 'CIF' | 'CPT' | 'CIP' | 'DAP' | 'DDP';

type Incoterm = {
  id: string;
  code: IncotermCode;
  notes?: string;
  payers: {
    transport: Payer;
    dedouanementImport: Payer;
    droitsDouane: Payer;
    tvaImport: Payer;
    octroiOm: Payer;
  };
};

type ExportedSettings = {
  thresholds: MarginThresholds;
  destinations: Destination[];
  incoterms: Incoterm[];
  exportedAt: string;
};

const MARGIN_STORAGE_KEY = 'margin_thresholds_v1';
const DESTINATIONS_STORAGE_KEY = 'export_destinations_v1';
const INCOTERMS_STORAGE_KEY = 'export_incoterms_v1';

const DEFAULT_THRESHOLDS: MarginThresholds = {
  marginMinPercent: 5,
  marginMinEuro: 50,
  transitCoverageMinPercent: 100,
};

const ZONE_OPTIONS: DestinationZone[] = ['UE', 'DROM', 'Suisse', 'Hors UE'];
const INCOTERM_OPTIONS: IncotermCode[] = ['EXW', 'FCA', 'FOB', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'];
const PAYER_OPTIONS: Payer[] = ['Fournisseur', 'Client'];

const emptyDestination = (): Destination => ({
  id: crypto.randomUUID(),
  name: '',
  zone: 'UE',
  countryCode: '',
  documents: {
    facture: false,
    packingList: false,
    blAwb: false,
    certificatOrigine: false,
    declarationDouane: false,
    preuveExport: false,
    autre: '',
  },
  notes: '',
});

const emptyIncoterm = (): Incoterm => ({
  id: crypto.randomUUID(),
  code: 'EXW',
  notes: '',
  payers: {
    transport: 'Client',
    dedouanementImport: 'Client',
    droitsDouane: 'Client',
    tvaImport: 'Client',
    octroiOm: 'Client',
  },
});

export default function Settings() {
  const [thresholds, setThresholds, resetThresholds] = useLocalStorage<MarginThresholds>(
    MARGIN_STORAGE_KEY,
    DEFAULT_THRESHOLDS,
  );
  const [destinations, setDestinations, resetDestinations] = useLocalStorage<Destination[]>(
    DESTINATIONS_STORAGE_KEY,
    [],
  );
  const [incoterms, setIncoterms, resetIncoterms] = useLocalStorage<Incoterm[]>(INCOTERMS_STORAGE_KEY, []);

  const [thresholdDraft, setThresholdDraft] = useState<MarginThresholds>(thresholds);
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
  const [incotermDialogOpen, setIncotermDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);
  const [editingIncoterm, setEditingIncoterm] = useState<Incoterm | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setThresholdDraft(thresholds);
  }, [thresholds]);

  const usedDestinationNames = useMemo(
    () => new Set(destinations.map((d) => d.name.trim().toLowerCase())),
    [destinations],
  );

  const handleSaveThresholds = () => {
    setThresholds({
      marginMinPercent: Number(thresholdDraft.marginMinPercent) || 0,
      marginMinEuro: Number(thresholdDraft.marginMinEuro) || 0,
      transitCoverageMinPercent: Number(thresholdDraft.transitCoverageMinPercent) || 0,
    });
    toast.success('Seuils enregistrés');
  };

  const upsertDestination = (payload: Destination) => {
    const normalized = payload.name.trim().toLowerCase();
    const duplicate = destinations.find(
      (d) => d.id !== payload.id && d.name.trim().toLowerCase() === normalized,
    );
    if (duplicate) {
      toast.error('Nom de destination déjà utilisé');
      return false;
    }
    setDestinations((prev) => {
      const exists = prev.some((d) => d.id === payload.id);
      return exists ? prev.map((d) => (d.id === payload.id ? payload : d)) : [...prev, payload];
    });
    toast.success(`Destination ${payload.name} enregistrée`);
    return true;
  };

  const upsertIncoterm = (payload: Incoterm) => {
    const duplicate = incoterms.find((i) => i.id !== payload.id && i.code === payload.code);
    if (duplicate) {
      toast.error('Un incoterm de ce type existe déjà');
      return false;
    }
    setIncoterms((prev) => {
      const exists = prev.some((i) => i.id === payload.id);
      return exists ? prev.map((i) => (i.id === payload.id ? payload : i)) : [...prev, payload];
    });
    toast.success(`Incoterm ${payload.code} enregistré`);
    return true;
  };

  const handleExport = () => {
    const payload: ExportedSettings = {
      thresholds,
      destinations,
      incoterms,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'export-navigator-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Paramètres exportés');
  };

  const validateImportedData = (data: unknown): data is ExportedSettings => {
    if (!data || typeof data !== 'object') return false;
    const obj = data as ExportedSettings;
    return !!obj.thresholds && !!obj.destinations && !!obj.incoterms;
  };

  const handleImport = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!validateImportedData(parsed)) {
          toast.error('Format de fichier non reconnu');
          return;
        }
        setThresholds(parsed.thresholds ?? DEFAULT_THRESHOLDS);
        setDestinations(parsed.destinations ?? []);
        setIncoterms(parsed.incoterms ?? []);
        toast.success(
          `Paramètres importés (${parsed.destinations?.length ?? 0} destinations, ${parsed.incoterms?.length ?? 0} incoterms)`,
        );
      } catch (error) {
        console.error(error);
        toast.error('Import impossible : fichier invalide');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleReset = (mode: 'thresholds' | 'reference' | 'all') => {
    if (mode === 'thresholds' || mode === 'all') {
      resetThresholds();
      setThresholds(DEFAULT_THRESHOLDS);
    }
    if (mode === 'reference' || mode === 'all') {
      resetDestinations();
      resetIncoterms();
    }
    toast.success(
      mode === 'all'
        ? 'Paramètres réinitialisés'
        : mode === 'thresholds'
          ? 'Seuils réinitialisés'
          : 'Référentiel réinitialisé',
    );
    setResetDialogOpen(false);
  };

  const applyTemplate = () => {
    const templateDestinations: Destination[] = [
      {
        id: crypto.randomUUID(),
        name: 'Île-de-France (UE)',
        zone: 'UE',
        countryCode: 'FR',
        documents: {
          facture: true,
          packingList: true,
          blAwb: true,
          certificatOrigine: false,
          declarationDouane: false,
          preuveExport: true,
          autre: '',
        },
        notes: 'Flux intra-UE classique',
      },
      {
        id: crypto.randomUUID(),
        name: 'Guadeloupe (DROM)',
        zone: 'DROM',
        countryCode: 'GP',
        documents: {
          facture: true,
          packingList: true,
          blAwb: true,
          certificatOrigine: false,
          declarationDouane: true,
          preuveExport: true,
          autre: 'Octroi/OMR si applicable',
        },
        notes: 'Règles OMR locales',
      },
      {
        id: crypto.randomUUID(),
        name: 'Suisse',
        zone: 'Suisse',
        countryCode: 'CH',
        documents: {
          facture: true,
          packingList: true,
          blAwb: true,
          certificatOrigine: true,
          declarationDouane: true,
          preuveExport: true,
          autre: '',
        },
        notes: 'Déclaration export obligatoire',
      },
      {
        id: crypto.randomUUID(),
        name: 'États-Unis',
        zone: 'Hors UE',
        countryCode: 'US',
        documents: {
          facture: true,
          packingList: true,
          blAwb: true,
          certificatOrigine: false,
          declarationDouane: true,
          preuveExport: true,
          autre: '',
        },
        notes: 'Vérifier EAR/ITAR selon produit',
      },
    ];

    const templateIncoterms: Incoterm[] = [
      {
        ...emptyIncoterm(),
        code: 'EXW',
        notes: 'Client gère transport et douane import',
        payers: {
          transport: 'Client',
          dedouanementImport: 'Client',
          droitsDouane: 'Client',
          tvaImport: 'Client',
          octroiOm: 'Client',
        },
      },
      {
        ...emptyIncoterm(),
        code: 'FCA',
        notes: 'Vendeur remet la marchandise au transporteur',
        payers: {
          transport: 'Client',
          dedouanementImport: 'Client',
          droitsDouane: 'Client',
          tvaImport: 'Client',
          octroiOm: 'Client',
        },
      },
      {
        ...emptyIncoterm(),
        code: 'DAP',
        notes: 'Livraison au lieu convenu, droits/TVA à la charge du client',
        payers: {
          transport: 'Fournisseur',
          dedouanementImport: 'Client',
          droitsDouane: 'Client',
          tvaImport: 'Client',
          octroiOm: 'Client',
        },
      },
      {
        ...emptyIncoterm(),
        code: 'DDP',
        notes: 'Vendeur supporte transport et droits/TVA import',
        payers: {
          transport: 'Fournisseur',
          dedouanementImport: 'Fournisseur',
          droitsDouane: 'Fournisseur',
          tvaImport: 'Fournisseur',
          octroiOm: 'Fournisseur',
        },
      },
    ];

    setDestinations(templateDestinations);
    setIncoterms(templateIncoterms);
    toast.success('Référentiel prérempli (Orliman/SM Europe)');
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Paramètres métier</h1>
            <p className="text-sm text-muted-foreground">
              Seuils de marge, destinations et incoterms stockés en local (mission control).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exporter mes paramètres
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Importer des paramètres
            </Button>
            <Button variant="ghost" onClick={() => setResetDialogOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Réinitialiser
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Réglages métier</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="thresholds">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="thresholds">Seuils marge & alertes</TabsTrigger>
                <TabsTrigger value="destinations">Destinations (Bible export)</TabsTrigger>
                <TabsTrigger value="incoterms">Incoterms (Bible export)</TabsTrigger>
              </TabsList>

              <TabsContent value="thresholds" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Seuils de rentabilité</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="marginMinPercent">Marge min (%)</Label>
                        <Input
                          id="marginMinPercent"
                          type="number"
                          min={0}
                          value={thresholdDraft.marginMinPercent}
                          onChange={(e) =>
                            setThresholdDraft((prev) => ({
                              ...prev,
                              marginMinPercent: Number(e.target.value),
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">Alerte si la marge % passe sous ce seuil.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="marginMinEuro">Marge min (€)</Label>
                        <Input
                          id="marginMinEuro"
                          type="number"
                          min={0}
                          value={thresholdDraft.marginMinEuro}
                          onChange={(e) =>
                            setThresholdDraft((prev) => ({
                              ...prev,
                              marginMinEuro: Number(e.target.value),
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">Alerte si la marge absolue est inférieure.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transitCoverageMinPercent">Couverture transit min (%)</Label>
                        <Input
                          id="transitCoverageMinPercent"
                          type="number"
                          min={0}
                          value={thresholdDraft.transitCoverageMinPercent}
                          onChange={(e) =>
                            setThresholdDraft((prev) => ({
                              ...prev,
                              transitCoverageMinPercent: Number(e.target.value),
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Ratio frais de transit couverts par la marge avant alerte.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveThresholds}>Enregistrer</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="destinations" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Destinations</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={applyTemplate}>
                        <FilePlus className="mr-2 h-4 w-4" />
                        Préremplir modèle Orliman/SM Europe
                      </Button>
                      <Dialog open={destinationDialogOpen} onOpenChange={setDestinationDialogOpen}>
                        <DialogTrigger asChild>
                          <Button onClick={() => setEditingDestination(emptyDestination())}>Ajouter destination</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-xl">
                          <DialogHeader>
                            <DialogTitle>
                              {editingDestination?.id && destinations.some((d) => d.id === editingDestination.id)
                                ? 'Modifier la destination'
                                : 'Ajouter une destination'}
                            </DialogTitle>
                          </DialogHeader>
                          <DestinationForm
                            destination={editingDestination}
                            usedNames={usedDestinationNames}
                            onSave={(dest) => {
                              const ok = upsertDestination(dest);
                              if (ok) {
                                setDestinationDialogOpen(false);
                                setEditingDestination(null);
                              }
                            }}
                            onCancel={() => {
                              setDestinationDialogOpen(false);
                              setEditingDestination(null);
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {destinations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun enregistrement. Ajoutez une destination ou préremplissez le modèle.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Destination</TableHead>
                            <TableHead>Zone</TableHead>
                            <TableHead>Documents clés</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {destinations.map((destination) => (
                            <TableRow key={destination.id}>
                              <TableCell className="font-medium">{destination.name}</TableCell>
                              <TableCell>{destination.zone}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {renderDocuments(destination.documents)}
                              </TableCell>
                              <TableCell className="max-w-xs text-sm text-muted-foreground">
                                {destination.notes || '—'}
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingDestination(destination);
                                    setDestinationDialogOpen(true);
                                  }}
                                >
                                  Modifier
                                </Button>
                                <DeleteButton
                                  label={`Supprimer ${destination.name}`}
                                  onConfirm={() =>
                                    setDestinations(destinations.filter((d) => d.id !== destination.id))
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="incoterms" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Incoterms</CardTitle>
                    <Dialog open={incotermDialogOpen} onOpenChange={setIncotermDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setEditingIncoterm(emptyIncoterm())}>Ajouter incoterm</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                          <DialogTitle>
                            {editingIncoterm?.id && incoterms.some((i) => i.id === editingIncoterm.id)
                              ? 'Modifier incoterm'
                              : 'Ajouter un incoterm'}
                          </DialogTitle>
                        </DialogHeader>
                        <IncotermForm
                          incoterm={editingIncoterm}
                          onSave={(item) => {
                            const ok = upsertIncoterm(item);
                            if (ok) {
                              setIncotermDialogOpen(false);
                              setEditingIncoterm(null);
                            }
                          }}
                          onCancel={() => {
                            setIncotermDialogOpen(false);
                            setEditingIncoterm(null);
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {incoterms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun incoterm configuré. Utilisez le bouton ajouter ou le préremplissage modèle.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Incoterm</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Répartition payeur</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {incoterms.map((incoterm) => (
                            <TableRow key={incoterm.id}>
                              <TableCell className="font-medium">{incoterm.code}</TableCell>
                              <TableCell className="max-w-xs text-sm text-muted-foreground">
                                {incoterm.notes || '—'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {renderPayers(incoterm.payers)}
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingIncoterm(incoterm);
                                    setIncotermDialogOpen(true);
                                  }}
                                >
                                  Modifier
                                </Button>
                                <DeleteButton
                                  label={`Supprimer ${incoterm.code}`}
                                  onConfirm={() => setIncoterms(incoterms.filter((i) => i.id !== incoterm.id))}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser les paramètres</AlertDialogTitle>
            <AlertDialogDescription>
              Choisissez ce que vous souhaitez réinitialiser. Les données reviendront aux valeurs par défaut
              stockées localement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
            <AlertDialogAction
              className="w-full"
              onClick={() => handleReset('thresholds')}
            >
              Réinitialiser les seuils de marge
            </AlertDialogAction>
            <AlertDialogAction
              className="w-full"
              onClick={() => handleReset('reference')}
            >
              Réinitialiser destinations + incoterms
            </AlertDialogAction>
            <AlertDialogAction
              className="w-full"
              onClick={() => handleReset('all')}
            >
              Tout réinitialiser
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">Annuler</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

type DestinationFormProps = {
  destination: Destination | null;
  usedNames: Set<string>;
  onSave: (destination: Destination) => void;
  onCancel: () => void;
};

function DestinationForm({ destination, usedNames, onSave, onCancel }: DestinationFormProps) {
  const [draft, setDraft] = useState<Destination>(destination ?? emptyDestination());

  useEffect(() => {
    setDraft(destination ?? emptyDestination());
  }, [destination]);

  const handleSubmit = () => {
    const name = draft.name.trim();
    if (!name) {
      toast.error('Le nom est obligatoire');
      return;
    }
    const normalized = name.toLowerCase();
    if (usedNames.has(normalized) && destination?.name.trim().toLowerCase() !== normalized) {
      toast.error('Nom de destination déjà utilisé');
      return;
    }
    onSave({ ...draft, name });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="destination-name">Nom destination</Label>
          <Input
            id="destination-name"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Guadeloupe, Suisse, États-Unis..."
          />
        </div>
        <div className="space-y-2">
          <Label>Zone</Label>
          <Select
            value={draft.zone}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, zone: value as DestinationZone }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir une zone" />
            </SelectTrigger>
            <SelectContent>
              {ZONE_OPTIONS.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="country-code">Pays / code (optionnel)</Label>
          <Input
            id="country-code"
            value={draft.countryCode ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, countryCode: e.target.value }))}
            placeholder="FR, GP, CH..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destination-notes">Notes</Label>
          <Textarea
            id="destination-notes"
            value={draft.notes ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Documents spécifiques, sources officielles, etc."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Documents requis</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DocCheckbox
            label="Facture"
            checked={draft.documents.facture}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, documents: { ...prev.documents, facture: !!checked } }))
            }
          />
          <DocCheckbox
            label="Packing list"
            checked={draft.documents.packingList}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, documents: { ...prev.documents, packingList: !!checked } }))
            }
          />
          <DocCheckbox
            label="BL / AWB"
            checked={draft.documents.blAwb}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, documents: { ...prev.documents, blAwb: !!checked } }))
            }
          />
          <DocCheckbox
            label="Certificat d’origine"
            checked={draft.documents.certificatOrigine}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({
                ...prev,
                documents: { ...prev.documents, certificatOrigine: !!checked },
              }))
            }
          />
          <DocCheckbox
            label="Déclaration douane"
            checked={draft.documents.declarationDouane}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({
                ...prev,
                documents: { ...prev.documents, declarationDouane: !!checked },
              }))
            }
          />
          <DocCheckbox
            label="Preuve export"
            checked={draft.documents.preuveExport}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, documents: { ...prev.documents, preuveExport: !!checked } }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destination-autre">Autre (optionnel)</Label>
          <Input
            id="destination-autre"
            value={draft.documents.autre ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, documents: { ...prev.documents, autre: e.target.value } }))}
            placeholder="Ex: certificat sanitaire, licence, etc."
          />
        </div>
      </div>

      <DialogFooter className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={handleSubmit}>Enregistrer</Button>
      </DialogFooter>
    </div>
  );
}

type IncotermFormProps = {
  incoterm: Incoterm | null;
  onSave: (incoterm: Incoterm) => void;
  onCancel: () => void;
};

function IncotermForm({ incoterm, onSave, onCancel }: IncotermFormProps) {
  const [draft, setDraft] = useState<Incoterm>(incoterm ?? emptyIncoterm());

  useEffect(() => {
    setDraft(incoterm ?? emptyIncoterm());
  }, [incoterm]);

  const handleSubmit = () => {
    if (!draft.code) {
      toast.error('Choisissez un incoterm');
      return;
    }
    onSave(draft);
  };

  const payerSelect = (field: keyof Incoterm['payers'], label: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={draft.payers[field]}
        onValueChange={(value) =>
          setDraft((prev) => ({
            ...prev,
            payers: { ...prev.payers, [field]: value as Payer },
          }))
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Choisir" />
        </SelectTrigger>
        <SelectContent>
          {PAYER_OPTIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Incoterm</Label>
          <Select
            value={draft.code}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, code: value as IncotermCode }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un incoterm" />
            </SelectTrigger>
            <SelectContent>
              {INCOTERM_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="incoterm-notes">Notes</Label>
          <Textarea
            id="incoterm-notes"
            value={draft.notes ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Qui paye quoi, exceptions, sources officielles..."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {payerSelect('transport', 'Transport')}
        {payerSelect('dedouanementImport', 'Dédouanement import')}
        {payerSelect('droitsDouane', 'Droits de douane')}
        {payerSelect('tvaImport', 'TVA import')}
        {payerSelect('octroiOm', 'Octroi de mer / OMR')}
      </div>

      <DialogFooter className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button onClick={handleSubmit}>Enregistrer</Button>
      </DialogFooter>
    </div>
  );
}

type DeleteButtonProps = {
  label: string;
  onConfirm: () => void;
};

function DeleteButton({ label, onConfirm }: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTriggerButton onClick={() => setOpen(true)} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              toast.success(label);
              setOpen(false);
            }}
          >
            Confirmer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AlertDialogTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="text-destructive" onClick={onClick}>
      Supprimer
    </Button>
  );
}

type DocCheckboxProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean | 'indeterminate') => void;
};

function DocCheckbox({ label, checked, onCheckedChange }: DocCheckboxProps) {
  return (
    <label className="flex items-center space-x-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function renderDocuments(documents: DestinationDocuments) {
  const entries = [
    documents.facture && 'Facture',
    documents.packingList && 'Packing list',
    documents.blAwb && 'BL/AWB',
    documents.certificatOrigine && "Certificat d'origine",
    documents.declarationDouane && 'Déclaration douane',
    documents.preuveExport && 'Preuve export',
  ].filter(Boolean);

  if (documents.autre) {
    entries.push(`Autre: ${documents.autre}`);
  }

  return entries.length > 0 ? entries.join(' • ') : '—';
}

function renderPayers(payers: Incoterm['payers']) {
  const labels: { key: keyof Incoterm['payers']; label: string }[] = [
    { key: 'transport', label: 'Transport' },
    { key: 'dedouanementImport', label: 'Dédouanement import' },
    { key: 'droitsDouane', label: 'Droits de douane' },
    { key: 'tvaImport', label: 'TVA import' },
    { key: 'octroiOm', label: 'Octroi/OMR' },
  ];

  return (
    <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
      {labels.map((entry) => (
        <div key={entry.key} className="flex items-center justify-between rounded bg-muted/20 px-2 py-1">
          <span>{entry.label}</span>
          <span className={cn('font-medium', payers[entry.key] === 'Client' ? 'text-amber-400' : 'text-emerald-400')}>
            {payers[entry.key]}
          </span>
        </div>
      ))}
    </div>
  );
}
