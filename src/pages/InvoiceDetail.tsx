import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, NotebookPen, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchInvoiceByNumber } from "@/domain/export/queries";
import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";
import { toast } from "sonner";

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
}

type NoteRow = {
  id?: string;
  body: string;
  created_at: string;
};

export default function InvoiceDetailPage() {
  const navigate = useNavigate();
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();

  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [notesAvailable, setNotesAvailable] = React.useState<boolean | null>(null);
  const [notesWarning, setNotesWarning] = React.useState<string>("");

  const storageKey = React.useMemo(() => {
    return `mpl:invoice:notes:${invoiceNumber || "unknown"}`;
  }, [invoiceNumber]);

  const [notes, setNotes] = React.useState<NoteRow[]>([]);
  const [notesLoading, setNotesLoading] = React.useState(false);

  const loadLocalNotes = React.useCallback((): NoteRow[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x) => x && typeof x.body === "string" && typeof x.created_at === "string")
        .slice(0, 50);
    } catch {
      return [];
    }
  }, [storageKey]);

  const pushLocalNote = React.useCallback(
    (body: string) => {
      const next: NoteRow[] = [
        { body, created_at: new Date().toISOString() },
        ...loadLocalNotes(),
      ].slice(0, 50);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      setNotes(next);
    },
    [loadLocalNotes, storageKey]
  );

  const detailQuery = useQuery({
    queryKey: ["invoice-detail", invoiceNumber],
    queryFn: () => fetchInvoiceByNumber(invoiceNumber || ""),
    enabled: Boolean(invoiceNumber),
  });

  // Detect presence of table notes to avoid misleading CTA
  React.useEffect(() => {
    let mounted = true;

    // charge immédiatement les notes locales (utile en mode demo)
    setNotes(loadLocalNotes());

    supabase
      .from("notes")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .then(({ error }) => {
        if (!mounted) return;
        if (error) {
          if (isMissingTableError(error)) {
            setNotesAvailable(false);
            setNotesWarning("Notes non disponibles côté serveur (mode démo). Stockage local activé.");
          } else {
            setNotesAvailable(false);
            setNotesWarning(error.message || "Notes indisponibles côté serveur. Stockage local activé.");
          }
        } else {
          setNotesAvailable(true);
          setNotesWarning("");
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setNotesAvailable(false);
        setNotesWarning(err?.message || "Notes indisponibles côté serveur. Stockage local activé.");
      });

    return () => {
      mounted = false;
    };
  }, [loadLocalNotes]);

  // If notes table exists, fetch recent notes for this invoice
  React.useEffect(() => {
    if (!invoiceNumber) return;

    if (notesAvailable !== true) {
      // mode demo: on reste sur localStorage
      setNotes(loadLocalNotes());
      return;
    }

    let mounted = true;
    setNotesLoading(true);

    supabase
      .from("notes")
      .select("id, body, created_at")
      .eq("target", "invoice")
      .eq("target_id", invoiceNumber)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          if (isMissingTableError(error)) {
            setNotesAvailable(false);
            setNotesWarning("Notes non disponibles côté serveur (mode démo). Stockage local activé.");
            setNotes(loadLocalNotes());
          } else {
            setNotesWarning(error.message || "Impossible de charger les notes.");
          }
        } else {
          setNotes((data as NoteRow[]) || []);
        }
      })
      .finally(() => {
        if (!mounted) return;
        setNotesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [invoiceNumber, notesAvailable, loadLocalNotes]);

  const invoice = detailQuery.data;

  const costComponents = invoice?.estimated_export_costs;
  const baseMargin = invoice
    ? invoice.products_ht_eur - invoice.transit_fee_eur - (costComponents?.total || 0)
    : 0;
  const marginAfterTransport = invoice ? baseMargin - (invoice.transport_cost_eur || 0) : 0;

  const handleValidate = async () => {
    if (!invoiceNumber) return;

    setSaving(true);
    try {
      // Mode demo => localStorage
      if (notesAvailable === false) {
        pushLocalNote("✅ Validation facture");
        toast.success("Facture marquée comme validée (mémo local).");
        return;
      }

      const { error } = await supabase.from("notes").insert({
        target: "invoice",
        target_id: invoiceNumber,
        body: "✅ Validation facture",
        created_at: new Date().toISOString(),
      });

      if (error) {
        if (isMissingTableError(error)) {
          setNotesAvailable(false);
          setNotesWarning("Notes non disponibles côté serveur (mode démo). Stockage local activé.");
          pushLocalNote("✅ Validation facture");
          toast.success("Facture marquée comme validée (mémo local).");
        } else {
          throw error;
        }
      } else {
        toast.success("Facture marquée comme validée (note ajoutée).");
        // refresh notes
        setNotesLoading(true);
        const { data } = await supabase
          .from("notes")
          .select("id, body, created_at")
          .eq("target", "invoice")
          .eq("target_id", invoiceNumber)
          .order("created_at", { ascending: false })
          .limit(20);
        setNotes((data as NoteRow[]) || []);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur validation");
    } finally {
      setSaving(false);
      setNotesLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!invoiceNumber) return;
    const body = note.trim();
    if (!body) return;

    setSaving(true);
    try {
      // Mode demo => localStorage
      if (notesAvailable === false) {
        pushLocalNote(body);
        toast.success("Note ajoutée (mémo local).");
        setNote("");
        return;
      }

      const { error } = await supabase.from("notes").insert({
        target: "invoice",
        target_id: invoiceNumber,
        body,
        created_at: new Date().toISOString(),
      });

      if (error) {
        if (isMissingTableError(error)) {
          setNotesAvailable(false);
          setNotesWarning("Notes non disponibles côté serveur (mode démo). Stockage local activé.");
          pushLocalNote(body);
          toast.success("Note ajoutée (mémo local).");
          setNote("");
        } else {
          throw error;
        }
      } else {
        toast.success("Note ajoutée");
        setNote("");
        // refresh notes
        setNotesLoading(true);
        const { data } = await supabase
          .from("notes")
          .select("id, body, created_at")
          .eq("target", "invoice")
          .eq("target_id", invoiceNumber)
          .order("created_at", { ascending: false })
          .limit(20);
        setNotes((data as NoteRow[]) || []);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur ajout note");
    } finally {
      setSaving(false);
      setNotesLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Détail facture</p>
            <h1 className="text-2xl font-bold">{invoiceNumber || "—"}</h1>
          </div>
        </div>

        {detailQuery.isLoading ? (
          <Card>
            <CardContent className="py-6 text-muted-foreground">Chargement...</CardContent>
          </Card>
        ) : detailQuery.error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-sm text-red-800">
              {(detailQuery.error as Error).message}
            </CardContent>
          </Card>
        ) : invoice ? (
          <>
            {invoice.warning ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>{invoice.warning}</div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <SummaryCard label="Date" value={invoice.invoice_date || "?"} />
              <SummaryCard label="Client" value={invoice.client_name || invoice.client_id || "Sans client"} />
              <SummaryCard label="Territoire" value={invoice.territory_code || invoice.ile || "?"} />
              <SummaryCard label="Nb colis" value={String(invoice.nb_colis ?? "n/a")} />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <SummaryCard label="Invoice HT" value={money(invoice.invoice_ht_eur)} />
              <SummaryCard
                label="Produits HT"
                value={money(invoice.products_ht_eur)}
                badge={invoice.products_estimated ? "Estimé" : "Réel"}
              />
              <SummaryCard label="Transit inclus" value={money(invoice.transit_fee_eur)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Estimation coûts export</CardTitle>
                <CardDescription>OM + octroi + TVA selon les règles fiscales disponibles</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <SummaryCard label="OM" value={money(costComponents?.om)} />
                <SummaryCard label="Octroi" value={money(costComponents?.octroi)} />
                <SummaryCard label="TVA" value={money(costComponents?.vat)} />
                <SummaryCard label="Autres règles" value={money(costComponents?.extraRules)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comparaison avant / après transport</CardTitle>
                <CardDescription>Inclut transit et coûts export estimés</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Avant transport</div>
                  <div className="text-2xl font-semibold">{money(baseMargin)}</div>
                  <div className="text-xs text-muted-foreground">Produits - transit - coûts export</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Après transport</div>
                  <div className="text-2xl font-semibold">{money(marginAfterTransport)}</div>
                  <div className="text-xs text-muted-foreground">Transport info déduit</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Lignes de facture</CardTitle>
                  <CardDescription>Source table sales (si liée par invoice_number / order_id)</CardDescription>
                </div>
                <Badge variant="outline">{invoice.lines?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead className="text-right">PU HT</TableHead>
                      <TableHead className="text-right">Total HT</TableHead>
                      <TableHead>Territoire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lines?.length ? (
                      invoice.lines.map((l) => (
                        <TableRow key={l.id || `${l.product_id}-${l.quantity}`}>
                          <TableCell>{l.product_label || l.product_id || "?"}</TableCell>
                          <TableCell>{l.quantity ?? "?"}</TableCell>
                          <TableCell className="text-right">{money(l.unit_price_ht)}</TableCell>
                          <TableCell className="text-right">{money(l.total_ht)}</TableCell>
                          <TableCell>{l.territory_code || "?"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          {invoice.linesWarning || "Aucune ligne trouvée."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* NOTES + ACTIONS */}
            <Card>
              <CardHeader>
                <CardTitle>Actions & notes</CardTitle>
                <CardDescription>
                  Marquer comme validée, ajouter une note, et conserver l’historique (serveur si dispo, sinon local).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notesWarning ? (
                  <div className="text-sm text-muted-foreground">{notesWarning}</div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button className="gap-2" onClick={handleValidate} disabled={saving}>
                    <CheckCircle className="h-4 w-4" />
                    {notesAvailable === false ? "Marquer comme validée (local)" : "Marquer comme validée"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Input placeholder="Facture" value={invoiceNumber || ""} disabled />
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ajouter une note (serveur si disponible, sinon mémo local)"
                  />
                  <Button variant="outline" onClick={handleAddNote} disabled={saving || !note.trim()}>
                    <NotebookPen className="mr-2 h-4 w-4" />
                    {notesAvailable === false ? "Ajouter note (local)" : "Ajouter note"}
                  </Button>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Historique des notes</div>
                      <div className="text-sm font-semibold">
                        {notesAvailable === false ? "Stockage local" : notesAvailable === true ? "Stockage serveur" : "—"}
                      </div>
                    </div>
                    <Badge variant="outline">{notes.length}</Badge>
                  </div>

                  {notesLoading ? (
                    <div className="mt-3 text-sm text-muted-foreground">Chargement des notes...</div>
                  ) : notes.length ? (
                    <div className="mt-3 space-y-2">
                      {notes.map((n, idx) => (
                        <div key={n.id || `${n.created_at}-${idx}`} className="rounded-md border bg-card/50 p-3">
                          <div className="text-xs text-muted-foreground">
                            {new Date(n.created_at).toLocaleString("fr-FR")}
                          </div>
                          <div className="text-sm">{n.body}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-muted-foreground">Aucune note pour l’instant.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

function SummaryCard({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 text-lg font-semibold">
        {value}
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
    </div>
  );
}
