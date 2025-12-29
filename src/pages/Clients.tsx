import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RefreshCw, Download } from "lucide-react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { fetchAllWithPagination } from "@/utils/supabasePagination";

type ExportZone = "UE" | "DROM" | "Suisse" | "Hors UE" | "France";
type SalesChannel = "direct" | "indirect" | "depositaire" | "grossiste";

type ClientRow = {
  id: string;
  code_ets: string | null;
  libelle_client: string;
  telephone: string | null;
  adresse: string | null;
  cp: string | null;
  ville: string | null;
  pays: string | null;

  export_zone: ExportZone | string | null;
  drom_code: string | null;

  // "canal" = brut (si tu l’alimentes), "sales_channel" = canonique (déduit)
  canal: string | null;
  sales_channel: SalesChannel | string | null;

  depositaire_id: string | null;
  groupement_id: string | null;
  groupement: string | null;
};

type DepoFilter = "" | "DEPOS_ONLY" | "ATTACHED_TO_DEPOS";

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);

  const escape = (v: any) => {
    const s = String(v ?? "");
    const needsQuotes = s.includes(";") || s.includes("\n") || s.includes('"');
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))];
  return lines.join("\n");
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function humanZone(z: string | null) {
  if (!z) return "-";
  return z;
}

function humanSalesChannel(v: string | null) {
  if (!v) return "-";
  const x = v.toLowerCase();
  if (x === "direct") return "Direct";
  if (x === "indirect") return "Indirect";
  if (x === "depositaire") return "Dépositaire";
  if (x === "grossiste") return "Grossiste";
  return v;
}

function explainWriteError(msg: string) {
  const lower = msg.toLowerCase();
  if (lower.includes("permission") || lower.includes("row-level security") || lower.includes("rls")) {
    return "Écriture refusée (RLS). Pour ajouter/supprimer depuis l’app, il faut une policy d’écriture (admin/authenticated).";
  }
  return msg;
}

export default function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // filtres
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState<"" | ExportZone>("");
  const [dromFilter, setDromFilter] = useState<string>("");
  const [paysFilter, setPaysFilter] = useState<string>("");
  const [salesChannelFilter, setSalesChannelFilter] = useState<"" | SalesChannel>("");
  const [depoFilter, setDepoFilter] = useState<DepoFilter>("");
  const [groupementFilter, setGroupementFilter] = useState<string>("");

  // formulaire ajout (minimal, trigger SQL complète export_zone/drom_code/sales_channel)
  const [form, setForm] = useState({
    code_ets: "",
    libelle_client: "",
    telephone: "",
    adresse: "",
    cp: "",
    ville: "",
    pays: "",
    canal: "",
    groupement: "",
  });

  // Options DROM/COM (tu peux en ajouter si besoin)
  const dromOptions = useMemo(
    () => ["GP", "MQ", "GF", "RE", "YT", "SPM", "BL", "MF", "NC", "PF", "WF", "TF", "OUTRE-MER"] as const,
    [],
  );

  async function fetchClients() {
    if (!SUPABASE_ENV_OK) {
      setError("Supabase env manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const pageSize = 1000;

      const all = await fetchAllWithPagination<ClientRow>((from, to) => {
        let q = supabase
          .from("clients")
          .select(
            "id,code_ets,libelle_client,telephone,adresse,cp,ville,pays,export_zone,drom_code,canal,sales_channel,depositaire_id,groupement_id,groupement",
          );

        // Recherche
        const s = search.trim();
        if (s) {
          // PostgREST OR: conditions séparées par des virgules => on évite les virgules dans la valeur
          const safe = s.replaceAll(",", " ").replaceAll("'", " ");
          q = q.or(
            [
              `libelle_client.ilike.%${safe}%`,
              `code_ets.ilike.%${safe}%`,
              `pays.ilike.%${safe}%`,
              `ville.ilike.%${safe}%`,
            ].join(","),
          );
        }

        if (zoneFilter) q = q.eq("export_zone", zoneFilter);
        if (dromFilter) q = q.eq("drom_code", dromFilter);

        const p = paysFilter.trim();
        if (p) q = q.ilike("pays", `%${p}%`);

        if (salesChannelFilter) q = q.eq("sales_channel", salesChannelFilter);

        if (depoFilter === "DEPOS_ONLY") {
          // Dépositaire = celui qui est lui-même un dépositaire
          q = q.eq("sales_channel", "depositaire");
        } else if (depoFilter === "ATTACHED_TO_DEPOS") {
          // Client rattaché à un dépositaire
          q = q.not("depositaire_id", "is", null);
        }

        const g = groupementFilter.trim();
        if (g) q = q.ilike("groupement", `%${g}%`);

        // Ordre stable + pagination
        return q.order("libelle_client", { ascending: true }).range(from, to);
      }, pageSize);

      setClients(all);
    } catch (e: any) {
      setError(e?.message || "Erreur lors du chargement des clients.");
      setClients([]);
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
      const payload: Partial<ClientRow> = {
        code_ets: form.code_ets.trim() || null,
        libelle_client: name,
        telephone: form.telephone.trim() || null,
        adresse: form.adresse.trim() || null,
        cp: form.cp.trim() || null,
        ville: form.ville.trim() || null,
        pays: form.pays.trim() || null,

        canal: form.canal.trim() || null,
        groupement: form.groupement.trim() || null,
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
        canal: "",
        groupement: "",
      });

      await fetchClients();
    } catch (e: any) {
      setError(explainWriteError(e?.message || "Erreur lors de l’ajout du client."));
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
      setError(explainWriteError(e?.message || "Erreur lors de la suppression."));
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const rows = clients.map((c) => ({
      libelle_client: c.libelle_client,
      pays: c.pays ?? "",
      export_zone: c.export_zone ?? "",
      drom_code: c.drom_code ?? "",
      sales_channel: c.sales_channel ?? "",
      canal: c.canal ?? "",
      groupement: c.groupement ?? "",
      code_ets: c.code_ets ?? "",
      telephone: c.telephone ?? "",
      adresse: c.adresse ?? "",
      cp: c.cp ?? "",
      ville: c.ville ?? "",
      depositaire_id: c.depositaire_id ?? "",
    }));

    const csv = toCsv(rows);
    downloadText(csv, `clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Base clients (Supabase)</p>
          <h1 className="text-2xl font-bold text-foreground">Clients Export</h1>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={loading || clients.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          <Button variant="outline" onClick={fetchClients} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
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
            <p className="text-xs text-muted-foreground">
              ⚠️ Si tu as mis la DB en lecture seule (RLS), l’ajout/suppression depuis l’app sera refusé. Dans ce cas,
              continue l’import via Supabase, et on activera une policy “admin” plus tard.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code ETS (optionnel)</Label>
                <Input value={form.code_ets} onChange={(e) => setForm({ ...form, code_ets: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Pays (ex: BE / Belgique / Suisse)</Label>
                <Input value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Libellé client</Label>
              <Input
                value={form.libelle_client}
                onChange={(e) => setForm({ ...form, libelle_client: e.target.value })}
                placeholder="Ex: TDIS / Island Distribution / ..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Canal (optionnel, brut)</Label>
                <Input value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Groupement (optionnel)</Label>
                <Input value={form.groupement} onChange={(e) => setForm({ ...form, groupement: e.target.value })} />
              </div>
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
            <CardTitle>Filtres (Export)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="space-y-1">
              <Label>Recherche (client / code / pays / ville)</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex: TDIS / BELGIQUE / ..." />
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
                  <option value="UE">UE</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Hors UE">Hors UE</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>DROM / OM</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={dromFilter}
                  onChange={(e) => setDromFilter(e.target.value)}
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
                <Label>Sales channel</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={salesChannelFilter}
                  onChange={(e) => setSalesChannelFilter(e.target.value as any)}
                >
                  <option value="">Tous</option>
                  <option value="direct">Direct</option>
                  <option value="indirect">Indirect</option>
                  <option value="depositaire">Dépositaire</option>
                  <option value="grossiste">Grossiste</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Pays (contient)</Label>
                <Input value={paysFilter} onChange={(e) => setPaysFilter(e.target.value)} placeholder="ex: Belgique / BE" />
              </div>

              <div className="space-y-1">
                <Label>Dépositaire</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={depoFilter}
                  onChange={(e) => setDepoFilter(e.target.value as any)}
                >
                  <option value="">Tous</option>
                  <option value="DEPOS_ONLY">Dépositaires uniquement</option>
                  <option value="ATTACHED_TO_DEPOS">Clients rattachés à un dépositaire</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>Groupement (contient)</Label>
                <Input
                  value={groupementFilter}
                  onChange={(e) => setGroupementFilter(e.target.value)}
                  placeholder="ex: ABC / ..."
                />
              </div>
            </div>

            <Button variant="secondary" className="w-full" onClick={fetchClients} disabled={loading}>
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
                <TableHead>Sales</TableHead>
                <TableHead>Canal (brut)</TableHead>
                <TableHead>Groupement</TableHead>
                <TableHead>Code ETS</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Dépositaire</TableHead>
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
                  <TableCell className="text-sm">{humanZone(c.export_zone)}</TableCell>
                  <TableCell className="text-sm">{c.drom_code ?? "-"}</TableCell>
                  <TableCell className="text-sm">{humanSalesChannel(c.sales_channel)}</TableCell>
                  <TableCell className="text-sm">{c.canal ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.groupement ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.code_ets ?? "-"}</TableCell>
                  <TableCell className="text-sm">{c.telephone ?? "-"}</TableCell>

                  <TableCell className="text-sm">
                    {c.depositaire_id ? (
                      <span className="text-muted-foreground">Oui</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} disabled={loading}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
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
