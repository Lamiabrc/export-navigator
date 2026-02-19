import * as React from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Run = {
  id: string;
  status: "success" | "failed" | "partial";
  started_at: string;
  finished_at: string | null;
  stats: Record<string, unknown>;
  error: string | null;
};

function parseFileContent(name: string, text: string): unknown[] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  }

  const rows = text.trim().split(/\r?\n/);
  const [header, ...rest] = rows;
  const cols = header.split(",").map((s) => s.trim());
  return rest.map((line) => {
    const vals = line.split(",");
    return cols.reduce<Record<string, string>>((acc, key, idx) => {
      acc[key] = vals[idx] ?? "";
      return acc;
    }, {});
  });
}

export default function AdminData() {
  const [runs, setRuns] = React.useState<Run[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [sourceName, setSourceName] = React.useState("Manual Upload");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string>("");

  const loadRuns = React.useCallback(async () => {
    const { data } = await supabase
      .from("ingestion_runs")
      .select("id,status,started_at,finished_at,stats,error")
      .order("started_at", { ascending: false })
      .limit(30);
    setRuns((data as Run[]) || []);
  }, []);

  React.useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const runSeed = async () => {
    setBusy("seed");
    setMessage("");
    try {
      const { error } = await supabase.functions.invoke("admin-index-kb", { body: { limit: 1 } });
      if (error) throw error;
      setMessage("Seed côté script serveur déclenché. Utilisez scripts/seed.ts pour l'import complet local.");
      await loadRuns();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const refreshSanctions = async () => {
    setBusy("sanctions");
    setMessage("");
    try {
      let entities: unknown[] = [];
      if (selectedFile) {
        const text = await selectedFile.text();
        entities = parseFileContent(selectedFile.name, text);
      }
      const { error } = await supabase.functions.invoke("admin-ingest-sanctions", {
        body: { source_name: sourceName, entities },
      });
      if (error) throw error;
      setMessage(`Sanctions mises à jour (${entities.length} entrées).`);
      await loadRuns();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const indexKb = async () => {
    setBusy("kb");
    setMessage("");
    try {
      const { error } = await supabase.functions.invoke("admin-index-kb", { body: { limit: 40 } });
      if (error) throw error;
      setMessage("Indexation KB terminée.");
      await loadRuns();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Admin Data — Ingestion et index</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Source name</p>
                <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Manual Upload" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Fichier CSV/JSON (optionnel)</p>
                <Input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <Button onClick={runSeed} disabled={busy !== null}>{busy === "seed" ? "Traitement..." : "Run seed"}</Button>
              <Button onClick={refreshSanctions} variant="outline" disabled={busy !== null}>{busy === "sanctions" ? "Traitement..." : "Refresh sanctions"}</Button>
              <Button onClick={indexKb} variant="outline" disabled={busy !== null}>{busy === "kb" ? "Traitement..." : "Index KB"}</Button>
            </div>
            {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingestion runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th>Status</th>
                    <th>Started</th>
                    <th>Finished</th>
                    <th>Stats</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-t align-top">
                      <td className="py-2">{run.status}</td>
                      <td className="py-2">{new Date(run.started_at).toLocaleString()}</td>
                      <td className="py-2">{run.finished_at ? new Date(run.finished_at).toLocaleString() : "-"}</td>
                      <td className="py-2 text-xs text-slate-600">{JSON.stringify(run.stats || {})}</td>
                      <td className="py-2 text-xs text-rose-600">{run.error || "-"}</td>
                    </tr>
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
