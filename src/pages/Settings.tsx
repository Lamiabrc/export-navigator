import { useEffect, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { useReferenceData, type ReferenceData } from '@/hooks/useReferenceData';
import { useExcelSync } from '@/hooks/useExcelSync';
import { toast } from 'sonner';

const downloadJson = (data: ReferenceData, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function Settings() {
  const { referenceData, saveReferenceData, resetReferenceData } = useReferenceData();
  const [preview, setPreview] = useState(JSON.stringify(referenceData, null, 2));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelPathRef = useRef<HTMLInputElement>(null);
  const { filePath, setFilePath, status, error, lastUpdate, lastRowsCount, isElectron, syncNow } = useExcelSync();

  useEffect(() => {
    setPreview(JSON.stringify(referenceData, null, 2));
  }, [referenceData]);

  const handleImport = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as ReferenceData;
        saveReferenceData(parsed);
        toast.success('Référentiel importé');
      } catch {
        toast.error('JSON invalide');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(preview) as ReferenceData;
      saveReferenceData(parsed);
      toast.success('Référentiel sauvegardé');
    } catch {
      toast.error('Format JSON incorrect');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
            <p className="text-muted-foreground">Gestion du référentiel (incoterms, destinations) en local</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadJson(referenceData, 'reference_export_navigator.json')}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import JSON
            </Button>
            <Button variant="ghost" onClick={() => { resetReferenceData(); toast.success('Réinitialisé'); }}>
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

        <Card>
          <CardHeader>
            <CardTitle>Édition JSON</CardTitle>
            <CardDescription>Modifier le référentiel puis sauvegarder (stockage local)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={18}
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex justify-end">
              <Button onClick={handleSave}>Sauvegarder</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Synchronisation Excel locale (mode Electron)</CardTitle>
            <CardDescription>
              Surveille un fichier Excel et met à jour les flux en temps réel via l’application desktop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Chemin du fichier Excel</label>
              <div className="flex gap-2">
                <Input
                  ref={excelPathRef}
                  placeholder="Ex : C:\\Users\\vous\\Documents\\exports.xlsx"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  disabled={!isElectron}
                />
                <Button variant="outline" onClick={() => setFilePath(excelPathRef.current?.value || '')} disabled={!isElectron}>
                  Sauvegarder
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-muted-foreground">
                Statut : {isElectron ? (status === 'watching' ? 'Surveillance active' : status === 'error' ? 'Erreur' : 'En attente') : 'Disponible uniquement en mode desktop (Electron)'}
              </p>
              {lastUpdate && (
                <p className="text-muted-foreground">Dernière mise à jour : {new Date(lastUpdate).toLocaleString()} ({lastRowsCount} lignes)</p>
              )}
              {error && <p className="text-sm text-red-500">Erreur : {error}</p>}
            </div>
            <div className="flex gap-2">
              <Button onClick={syncNow} disabled={!isElectron || !filePath}>Forcer une lecture</Button>
              <Button variant="ghost" onClick={() => { setFilePath(''); toast.success('Surveillance Excel désactivée'); }} disabled={!isElectron}>
                Arrêter
              </Button>
            </div>
            {!isElectron && (
              <p className="text-xs text-muted-foreground">
                Indication : la lecture automatique d’un fichier local n’est autorisée qu’en mode Electron. Sur le web, utilisez l’import CSV classique.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              L’outil reste un contrôle de cohérence (non un conseil fiscal). Valider les cas sensibles avec finance / transitaire.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Données conservées dans localStorage, exportables/importables en JSON.</p>
            <p>Réinitialiser pour revenir au référentiel versionné dans le code.</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
