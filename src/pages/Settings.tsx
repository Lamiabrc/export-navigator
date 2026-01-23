import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { useReferenceData, type ReferenceData } from '@/hooks/useReferenceData';
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
    <AppLayout>
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
    </AppLayout>
  );
}
