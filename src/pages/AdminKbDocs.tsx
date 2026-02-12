import * as React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/authz";

type KbDocRow = {
  id: string;
  title: string;
  status: string;
  enabled: boolean;
  language: string;
  created_at: string;
};

export default function AdminKbDocs() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [rows, setRows] = React.useState<KbDocRow[]>([]);
  const [title, setTitle] = React.useState("");
  const [language, setLanguage] = React.useState("fr");
  const [file, setFile] = React.useState<File | null>(null);

  const loadDocs = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kb_documents")
        .select("id,title,status,enabled,language,created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setRows((data || []) as KbDocRow[]);
    } catch (e: any) {
      toast({ title: "Erreur chargement", description: e?.message || "Impossible de charger les documents." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (isAdmin) {
      void loadDocs();
    }
  }, [isAdmin, loadDocs]);

  const handleUpload = async () => {
    if (!file) {
      toast({ title: "Fichier requis", description: "Sélectionnez un PDF." });
      return;
    }

    setUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session invalide");

      const docTitle = title.trim() || file.name.replace(/\.pdf$/i, "");
      const objectPath = `${user?.id || "admin"}/${Date.now()}-${file.name}`;

      let bucket = "kb_admin";
      let storageError: any = null;
      const primaryUpload = await supabase.storage.from(bucket).upload(objectPath, file, {
        upsert: false,
        contentType: file.type || "application/pdf",
      });
      storageError = primaryUpload.error;

      if (storageError) {
        const fallbackBucket = "kb_docs";
        const fallbackUpload = await supabase.storage.from(fallbackBucket).upload(objectPath, file, {
          upsert: false,
          contentType: file.type || "application/pdf",
        });
        if (fallbackUpload.error) {
          throw fallbackUpload.error;
        }
        bucket = fallbackBucket;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("kb_documents")
        .insert({
          title: docTitle,
          language,
          file_name: file.name,
          mime_type: file.type || "application/pdf",
          size_bytes: file.size,
          storage_bucket: bucket,
          storage_path: objectPath,
          status: "uploaded",
          enabled: true,
        })
        .select("id")
        .single();

      if (insertError || !inserted?.id) throw insertError || new Error("Insertion impossible");

      const resp = await fetch("/api/kb/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ document_id: inserted.id }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || payload?.ok === false) {
        throw new Error(payload?.error || payload?.detail || "Ingestion impossible");
      }

      toast({ title: "Document prêt", description: "Le document est indexé et disponible pour l'assistant." });
      setTitle("");
      setFile(null);
      await loadDocs();
    } catch (e: any) {
      toast({ title: "Erreur upload", description: e?.message || "Échec de l'upload." });
    } finally {
      setUploading(false);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card>
          <CardHeader>
            <CardTitle>Accès réservé</CardTitle>
            <CardDescription>Cette page est réservée aux administrateurs.</CardDescription>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout contentClassName="md:p-6">
      <div className="space-y-5">
        <Card className="border-blue-100 bg-white/95 shadow-lg">
          <CardHeader>
            <CardTitle>Base documentaire IA (Admin)</CardTitle>
            <CardDescription>
              Ajoutez un PDF, il sera stocké en privé dans Supabase puis indexé pour enrichir les réponses IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kb-title">Titre</Label>
              <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Guide douane Maroc" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-lang">Langue</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="kb-lang">
                  <SelectValue placeholder="Langue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français (fr)</SelectItem>
                  <SelectItem value="en">English (en)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="kb-file">PDF</Label>
              <Input id="kb-file" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleUpload} disabled={uploading}>{uploading ? "Traitement..." : "Uploader et indexer"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents récents</CardTitle>
            <CardDescription>{loading ? "Chargement..." : `${rows.length} document(s)`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{r.title}</span>
                <Badge variant="outline">{r.language}</Badge>
                <Badge variant={r.status === "ready" ? "default" : "secondary"}>{r.status}</Badge>
                <Badge variant="outline">{r.enabled ? "actif" : "désactivé"}</Badge>
              </div>
            ))}
            {!rows.length ? <p className="text-sm text-muted-foreground">Aucun document pour le moment.</p> : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
