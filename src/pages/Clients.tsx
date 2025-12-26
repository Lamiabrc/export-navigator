import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type ExportZone = "DROM" | "INTRA_EU" | "EXTRA_EU";
type Canal = "DIRECT" | "INDIRECT" | "DEPOSITAIRE" | "GROSSISTE";

type ClientRow = {
  id: string;
  code_ets: string | null;
  libelle_client: string;
  telephone: string | null;
  adresse: string | null;
  cp: string | null;
  ville: string | null;
  pays: string | null;

  export_zone: ExportZone | null;
  drom_code: string | null;
  canal: Canal | null;

  depositaire_id: string | null;
  groupement_id: string | null;
};

export default function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // filtres
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<"" | ExportZone>("");
  const [dromFilter, setDromFilter] = useState<"" | "GP" | "MQ" | "GF" | "RE" | "YT">("");
  const [canalFilter, setCanalFilter] = useState<"" | Canal>("");

  // formulaire ajout (minimal, le trigger SQL fera export_zone/drom_code/canal)
  const [form, setForm] = useState({
    code_ets: "",
    libelle_client: "",
    telephone: "",
    adresse: "",
    cp: "",
    ville: "",
    pays: "",
  });

  const dromOptions = useMemo(() => ["GP", "MQ", "GF", "RE", "YT"] as const, []);

  async function fetchClients() {
    setLoading(true);
    setError("");

    try {
      let q = supabase
        .from("clients")
        .select(
          "id,code_ets,libelle_client,telephone,adresse,cp,ville,pays,export_zone,drom_code,canal,depositaire_id,groupement_id"
        )
        .order("libelle_client", { ascending: true })
        .limit(1000);

      const s = search.trim();
      if (s) {
        const safe = s.replaceAll(",", " "); // évite de casser la clause OR
        q = q.or(`libelle_client.ilike.%${safe}%,code_ets.ilike.%${safe}%`);
      }

      if (zoneFilter) q = q.eq("export_zone", zoneFilter);
      if (dromFilter) q = q.eq("drom_code", dromFilter);
      if (canalFilter) q = q.eq("canal", canalFilter);

      const { data, error } = await q;
      if (error) throw error;

      setClients((data ?? []) as ClientRow[]);
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // auto-reset DROM filter si on quitte DROM
    if (zoneFilter !== "DROM") setDromFilter("");
  }, [zoneFilter]);

  async function handleAdd() {
    const name = form.libelle_client.trim();
    if (!name) return;

    setLoading(true);
    setError("");

    try {
      const payload = {
        code_ets: form.code_ets.trim() || null,
        libelle_client: name,
        telephone: form.telephone.trim() || null,
        adresse: form.adresse.trim() || null,
        cp: form.cp.trim() || null,
        ville: form.ville.trim() || null,
        pays: form.pays.trim().toUpperCase() || null,
      };

      const { error } = await supabase.from("clients").insert(payload);
      if (error) throw error;

      setForm({
        code_ets: "",
        libelle_client: "",
        telephone: "",
        adresse: "",
        cp: "",
        ville: "",
        pays: "",
      });

      await fetchClients();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l’ajout du client.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la suppression.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Base clients (Supabase)</p>
          <h1 className="text-2xl font-bold text-foreground">Clients Export</h1>
        </div>

        <Button variant="outline" onClick={fetchClients} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-red-200">
          <CardContent className="pt-6 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code ETS (optionnel)</Label>
                <Input value={form.code_ets} onChange={(e) => setForm({ ...form, code_ets: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Pays (ISO, ex: FR/BE/CH)</Label>
                <Input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Libellé client</Label>
              <Input
                value={form.libelle_client}
                onChange={(e) => setForm({ ...form, libelle_client: e.target.value })}
                placeholder="Ex: ORTHOPEDIC TUNISIA"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>CP</Label>
                <Input value={form.cp} onChange={(e) => setForm({ ...form, cp: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ville</Label>
                <Input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Adresse</Label>
                <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
              </div>
            </div>

            <Button className="w-full" onClick={handleAdd} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-muted/60">
          <CardHeader>
            <CardTitle>Filtres & lecture Export</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="space-y-1">
              <Label>Recherche (libellé / code ETS)</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: ORLIMAN / A014..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Zone</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value as any)}
                >
                  <option value="">Toutes</option>
                  <option value="DROM">DROM</option>
                  <option value="INTRA_EU">Intra-UE</option>
                  <option value="EXTRA_EU">Hors UE</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>DROM</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={dromFilter}
                  onChange={(e) => setDromFilter(e.target.value as any)}
                  disabled={zoneFilter !== "DROM"}
                >
                  <option value="">Tous</option>
                  {dromOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Canal</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={canalFilter}
                  onChange={(e) => setCanalFilter(e.target.value as any)}
                >
                  <option value="">Tous</option>
                  <option value="DIRECT">Direct</option>
                  <option value="INDIRECT">Indirect</option>
                  <option value="DEPOSITAIRE">Dépositaire</option>
                  <option value="GROSSISTE">Grossiste</option>
                </select>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                // recharge avec les filtres actuels
                fetchClients();
              }}
              disabled={loading}
            >
              Appliquer les filtres
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Pays</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>DROM</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Code ETS</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-semibold">{c.libelle_client}</div>
                    <div className="text-xs text-muted-foreground">
                      {[c.adresse, c.cp, c.ville].filter(Boolean).join(" • ")}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.pays ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.export_zone ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.drom_code ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.canal ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.code_ets ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.telephone ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} disabled={loading}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {loading ? "Chargement..." : "Aucun client pour le moment."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
