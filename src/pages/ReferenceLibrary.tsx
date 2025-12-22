import { useEffect, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, RefreshCw, Upload, Cloudy, Link as LinkIcon } from 'lucide-react';
import { useReferenceData, type ReferenceData, type IncotermReference, type DestinationReference } from '@/hooks/useReferenceData';
import { toast } from 'sonner';
import { parseCsv } from '@/lib/imports/parseCsv';

const downloadJson = (data: ReferenceData, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function ReferenceLibrary() {
  const { referenceData, saveReferenceData, resetReferenceData } = useReferenceData();
  const [localData, setLocalData] = useState<ReferenceData>(referenceData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [oneDriveLink, setOneDriveLink] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  type ReferenceRow = Record<string, string | number>;

  useEffect(() => {
    setLocalData(referenceData);
  }, [referenceData]);

  const updateIncoterm = (index: number, value: Partial<IncotermReference>) => {
    const next = [...localData.incoterms];
    next[index] = { ...next[index], ...value };
    setLocalData({ ...localData, incoterms: next });
  };

  const updateDestination = (index: number, value: Partial<DestinationReference>) => {
    const next = [...localData.destinations];
    next[index] = { ...next[index], ...value };
    setLocalData({ ...localData, destinations: next });
  };

  const handleSave = () => {
    saveReferenceData(localData);
    toast.success('Référentiel sauvegardé (localStorage)');
  };

  const handleExport = () => downloadJson(localData, 'reference_export_navigator.json');

  const handleImport = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as ReferenceData;
        setLocalData(parsed);
        saveReferenceData(parsed);
        toast.success('Référentiel importé');
      } catch {
        toast.error('Fichier JSON invalide');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleReset = () => {
    resetReferenceData();
    toast.success('Référentiel réinitialisé');
  };

  const resolveColumn = (row: ReferenceRow, candidates: string[]) => {
    const lowerKeys = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
      acc[key.toLowerCase().trim()] = key;
      return acc;
    }, {});
    for (const cand of candidates) {
      const key = Object.keys(lowerKeys).find((k) => k.includes(cand.toLowerCase()));
      if (key) return row[lowerKeys[key]];
    }
    return '';
  };

  const syncFromOneDrive = async () => {
    if (!oneDriveLink) {
      toast.error('Ajoutez un lien OneDrive partageable');
      return;
    }
    setIsSyncing(true);
    try {
      const url = oneDriveLink.includes('download=1') ? oneDriveLink : `${oneDriveLink}${oneDriveLink.includes('?') ? '&' : '?'}download=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
      const rawText = await res.text();

      let incoterms: IncotermReference[] = [];
      let destinations: DestinationReference[] = [];

      try {
        const parsed = JSON.parse(rawText) as ReferenceData;
        incoterms = parsed.incoterms || [];
        destinations = parsed.destinations || [];
      } catch {
        const parsed = parseCsv(rawText);
        const rows = parsed.rows;
        const incotermRows = rows.filter((row) =>
          Object.keys(row).some((k) => k.toLowerCase().includes('incoterm') || k.toLowerCase() === 'code')
        );
        const destinationRows = rows.filter((row) =>
          Object.keys(row).some((k) => k.toLowerCase().includes('destination') || k.toLowerCase().includes('zone'))
        );

        incoterms = incotermRows
          .map((row) => ({
            code: String(resolveColumn(row as ReferenceRow, ['incoterm', 'code'])),
            description: String(resolveColumn(row as ReferenceRow, ['description', 'libelle', 'libellé'])),
            payerTransport: (resolveColumn(row as ReferenceRow, ['payeur', 'payer transport']) || 'Client') as string,
            notes: String(resolveColumn(row as ReferenceRow, ['notes', 'commentaire'])),
          }))
          .filter((r) => r.code);

        destinations = destinationRows
          .map((row) => ({
            destination: String(resolveColumn(row as ReferenceRow, ['destination', 'pays'])),
            zone: String(resolveColumn(row as ReferenceRow, ['zone'])),
            tvaRegime: String(resolveColumn(row as ReferenceRow, ['tva', 'regime'])),
            taxesPossibles: (resolveColumn(row as ReferenceRow, ['taxes', 'om']) || '')
              .split(/[,;]+/)
              .map((v) => v.trim())
              .filter(Boolean),
            flags: (resolveColumn(row as ReferenceRow, ['flags', 'notes']) || '')
              .split(/\n|[,;]+/)
              .map((v) => v.trim())
              .filter(Boolean),
          }))
          .filter((r) => r.destination);
      }

      if (!incoterms.length && !destinations.length) {
        throw new Error('Aucune donnée trouvée (attendu incoterms/destinations en JSON ou CSV).');
      }

      const synced: ReferenceData = {
        incoterms,
        destinations,
        updatedAt: new Date().toISOString(),
        sourceUrl: oneDriveLink,
        sourceLabel: 'OneDrive',
      };
      setLocalData(synced);
      saveReferenceData(synced);
      toast.success('Référentiel synchronisé depuis OneDrive');
    } catch (err) {
      const message =
        err instanceof TypeError || (err instanceof Error && err.message.includes('Failed to fetch'))
          ? 'Accès au lien bloqué (CORS). Téléchargez le fichier puis importez-le en JSON/CSV.'
          : err instanceof Error
          ? err.message
          : 'Sync OneDrive impossible';
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Référentiel Export</h1>
            <p className="text-muted-foreground">Incoterms, destinations, notes internes — version locale éditable</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import JSON
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImport(e.target.files?.[0] || undefined)}
          />
        </div>

        <Card className="bg-gradient-to-r from-emerald-50 via-blue-50 to-white border border-emerald-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloudy className="h-5 w-5 text-emerald-600" />
              Lien OneDrive (Excel ou CSV)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Utilisez un lien partageable (&quot;?download=1&quot;) vers un fichier Excel/CSV avec deux feuilles : <strong>incoterms</strong> et <strong>destinations</strong>.
              Les colonnes attendues : Code, Description, Payeur transport, Notes / Destination, Zone, TVA, Taxes, Flags.
            </p>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={oneDriveLink}
                onChange={(e) => setOneDriveLink(e.target.value)}
                placeholder="https://onedrive.live.com/....?download=1"
              />
              <Button onClick={syncFromOneDrive} disabled={isSyncing}>
                <LinkIcon className="h-4 w-4 mr-2" />
                {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Source: {localData.sourceLabel || 'locale'}</Badge>
              {localData.updatedAt && <span>Maj : {new Date(localData.updatedAt).toLocaleString('fr-FR')}</span>}
              {localData.sourceUrl && (
                <a className="text-primary hover:underline" href={localData.sourceUrl} target="_blank" rel="noreferrer">
                  Voir le lien
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="incoterms">
          <TabsList>
            <TabsTrigger value="incoterms">Incoterms</TabsTrigger>
            <TabsTrigger value="destinations">Destinations</TabsTrigger>
          </TabsList>

          <TabsContent value="incoterms" className="space-y-4">
            {localData.incoterms.map((incoterm, idx) => (
              <Card key={`${incoterm.code}-${idx}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline">{incoterm.code}</Badge>
                    <Input
                      value={incoterm.description}
                      onChange={(e) => updateIncoterm(idx, { description: e.target.value })}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Payeur transport</p>
                      <Input
                        value={incoterm.payerTransport}
                        onChange={(e) =>
                          updateIncoterm(idx, { payerTransport: e.target.value as IncotermReference['payerTransport'] })
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <Textarea
                        value={incoterm.notes || ''}
                        onChange={(e) => updateIncoterm(idx, { notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="destinations" className="space-y-4">
            {localData.destinations.map((dest, idx) => (
              <Card key={`${dest.destination}-${idx}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline">{dest.destination}</Badge>
                    <Input
                      value={dest.zone}
                      onChange={(e) => updateDestination(idx, { zone: e.target.value })}
                      className="w-24"
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Régime TVA</p>
                      <Input
                        value={dest.tvaRegime}
                        onChange={(e) => updateDestination(idx, { tvaRegime: e.target.value })}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Taxes possibles (séparées par ,)</p>
                      <Input
                        value={dest.taxesPossibles.join(', ')}
                        onChange={(e) =>
                          updateDestination(idx, { taxesPossibles: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Flags internes</p>
                    <Textarea
                      value={dest.flags.join('\n')}
                      onChange={(e) => updateDestination(idx, { flags: e.target.value.split('\n').filter(Boolean) })}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave}>Enregistrer le référentiel</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>L’outil reste un contrôle de cohérence : toujours valider les cas sensibles avec finance/déclarant.</p>
            <p>Les données sont stockées en localStorage et exportables en JSON.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
