import * as React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type ExportCase = { id: string; title: string; status: string; created_at: string; destination_country_iso2: string | null; hs6: string | null };

export default function TourDeControle() {
  const [loading, setLoading] = React.useState(true);
  const [isPro, setIsPro] = React.useState(false);
  const [cases, setCases] = React.useState<ExportCase[]>([]);
  const [title, setTitle] = React.useState("");
  const [orgId, setOrgId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      setIsPro(false);
      setLoading(false);
      return;
    }

    const { data: access } = await supabase.rpc("has_pro_access", { uid });
    setIsPro(Boolean(access));
    if (access) {
      const { data: membership } = await supabase.from("memberships").select("org_id").limit(1).maybeSingle();
      const targetOrg = membership?.org_id || null;
      setOrgId(targetOrg);
      if (targetOrg) {
        const { data } = await supabase.from("export_cases").select("id,title,status,created_at,destination_country_iso2,hs6").eq("org_id", targetOrg).order("created_at", { ascending: false }).limit(30);
        setCases((data as ExportCase[]) || []);
      }
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const createCase = async () => {
    if (!title.trim() || !orgId) return;
    await supabase.from("export_cases").insert({ title, org_id: orgId, created_by: (await supabase.auth.getUser()).data.user?.id });
    setTitle("");
    await load();
  };

  if (loading) {
    return <AppLayout><div className="p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline size-4 animate-spin" />Chargement...</div></AppLayout>;
  }

  if (!isPro) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          <Card>
            <CardHeader><CardTitle>Tour de contrôle (Pro)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">Passez au plan Pro pour gérer dossiers, tâches, alertes, historique et dashboard export.</p>
              <ul className="list-disc pl-5 text-sm text-slate-700">
                <li>Dossiers export partagés</li><li>Suivi des tâches</li><li>Alertes réglementaires</li><li>Historique d'analyses</li>
              </ul>
              <Button asChild><Link to="/pricing">Voir l'offre Pro</Link></Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouveau dossier export" />
          <Button onClick={createCase}>Créer</Button>
        </div>
        <Card>
          <CardHeader><CardTitle>Dossiers export</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-slate-500"><th>Titre</th><th>Pays</th><th>HS</th><th>Statut</th><th>Créé</th></tr></thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-t"><td className="py-2">{c.title}</td><td>{c.destination_country_iso2 || "-"}</td><td>{c.hs6 || "-"}</td><td>{c.status}</td><td>{new Date(c.created_at).toLocaleDateString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
