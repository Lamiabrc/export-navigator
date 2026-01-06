import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, NotebookPen, AlertTriangle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { fetchInvoiceByNumber } from "@/domain/export/queries";
import { InvoiceDetail } from "@/domain/export/types";
import { supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";
import { toast } from "sonner";

function money(n: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));
}

export default function InvoiceDetailPage() {
  const navigate = useNavigate();
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const detailQuery = useQuery({
    queryKey: ["invoice-detail", invoiceNumber],
    queryFn: () => fetchInvoiceByNumber(invoiceNumber || ""),
    enabled: Boolean(invoiceNumber),
  });

  const invoice = detailQuery.data;

  const costComponents = invoice?.estimated_export_costs;
  const baseMargin = invoice ? invoice.products_ht_eur - invoice.transit_fee_eur - (costComponents?.total || 0) : 0;
  const marginAfterTransport = invoice ? baseMargin - (invoice.transport_cost_eur || 0) : 0;

  const handleValidate = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("notes").insert({
        target: "invoice",
        target_id: invoice.invoice_number,
        body: "Validation facture",
        created_at: new Date().toISOString(),
      });
      if (error) {
        if (isMissingTableError(error)) {
          toast.info("Table notes absente : validation uniquement visuelle.");
        } else {
          throw error;
        }
      } else {
        toast.success("Facture marquee comme validee (note ajoutee).");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur validation");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("notes").insert({
        target: "invoice",
        target_id: invoiceNumber,
        body: note.trim(),
        created_at: new Date().toISOString(),
      });
      if (error) {
        if (isMissingTableError(error)) {
          toast.info("Table notes absente : note non persistee mais affichee ici.");
        } else {
          throw error;
        }
      } else {
        toast.success("Note ajoutee");
        setNote("");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur ajout note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Detail facture</p>
            <h1 className="text-2xl font-bold">{invoiceNumber}</h1>
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
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div>{invoice.warning}</div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <SummaryCard label="Date" value={invoice.invoice_date || "?"} />
              <SummaryCard label="Client" value={invoice.client_name || invoice.client_id || "Sans client"} />
              <SummaryCard label="Territoire" value={invoice.territory_code || invoice.ile || "?"} />
              <SummaryCard label="Nb colis" value={String(invoice.nb_colis ?? "n/a")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SummaryCard label="Invoice HT" value={money(invoice.invoice_ht_eur)} />
              <SummaryCard label="Produits HT" value={money(invoice.products_ht_eur)} badge={invoice.products_estimated ? "Estime" : "Reel"} />
              <SummaryCard label="Transit inclus" value={money(invoice.transit_fee_eur)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Estimation couts export</CardTitle>
                <CardDescription>OM + octroi + TVA selon om_rates / octroi_rates / vat_rates / tax_rules_extra</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <SummaryCard label="OM" value={money(costComponents?.om)} />
                <SummaryCard label="Octroi" value={money(costComponents?.octroi)} />
                <SummaryCard label="TVA" value={money(costComponents?.vat)} />
                <SummaryCard label="Autres regles" value={money(costComponents?.extraRules)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comparaison avant / apres transport</CardTitle>
                <CardDescription>Inclut transit et couts export estimes</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Avant transport</div>
                  <div className="text-2xl font-semibold">{money(baseMargin)}</div>
                  <div className="text-xs text-muted-foreground">Produits - transit - couts export</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Apres transport</div>
                  <div className="text-2xl font-semibold">{money(marginAfterTransport)}</div>
                  <div className="text-xs text-muted-foreground">Transport info deduit</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Lignes de facture</CardTitle>
                  <CardDescription>Source table sales (si liee par invoice_number / order_id)</CardDescription>
                </div>
                <Badge variant="outline">{invoice.lines?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantite</TableHead>
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
                          {invoice.linesWarning || "Aucune ligne trouvee."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Concurrence</CardTitle>
                  <CardDescription>Prix concurrents sur le territoire si disponibles (v_export_pricing)</CardDescription>
                </div>
                <Badge variant="outline">{invoice.competitors?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoice.competitors?.length ? (
                  invoice.competitors.map((c) => (
                    <div key={`${c.sku}-${c.competitor}`} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">{c.sku}</div>
                        <div className="font-semibold">{c.label || "Produit"}</div>
                        <div className="text-xs text-muted-foreground">{c.competitor}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{money(c.price)}</div>
                        <div className="text-xs text-muted-foreground">{c.territory_code || invoice.territory_code || "?"}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{invoice.competitorWarning || "Pas de donnees concurrentes."}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Marquer comme valide ou ajouter une note</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button className="gap-2" onClick={handleValidate} disabled={saving}>
                    <CheckCircle className="h-4 w-4" />
                    Marquer comme valide
                  </Button>
                </div>
                <div className="space-y-2">
                  <Input placeholder="Titre/description rapide" value={invoiceNumber || ""} disabled />
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ajouter une note (table notes si presente, sinon memo local)"
                  />
                  <Button variant="outline" onClick={handleAddNote} disabled={saving || !note.trim()}>
                    <NotebookPen className="h-4 w-4 mr-2" />
                    Ajouter note
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}

function SummaryCard({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="rounded-lg border p-3 bg-card/50">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold flex items-center gap-2">
        {value}
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
      </div>
    </div>
  );
}
