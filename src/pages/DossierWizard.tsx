import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileUp, Loader2, Plus, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/contexts/LanguageContext";
import { COUNTRIES, CURRENCIES, PAYMENT_TERMS, getCountryLabel } from "@/lib/constants";
import { getOfficialLinks } from "@/lib/officialLinks";
import { extractInvoiceFromPdf, type ParsedInvoice } from "@/lib/pdf/extractInvoice";
import { resolveCountryIso2 } from "@/lib/copilot/officialLinks";
import { createDeal, createDealItems, type CreateDealItemInput } from "@/services/crm";

type Step = 1 | 2 | 3 | 4;
type SourceMode = "manual" | "pdf";

type ItemDraft = {
  id: string;
  product_text: string;
  hs6: string;
  quantity: string;
  unit_price: string;
  total_value: string;
  currency: string;
};

type FormState = {
  title: string;
  from_country: string;
  to_country: string;
  incoterm: string;
  currency: string;
  value_amount: string;
  payment_method: string;
  route: string;
  client: string;
  product_desc: string;
  notes: string;
};

type PdfExtractResponse = {
  ok?: boolean;
  mode?: string;
  extracted?: {
    to_country?: string | null;
    currency?: string | null;
    value_amount?: number | null;
    product_desc?: string | null;
    title_suggestion?: string | null;
    items?: Array<{
      product_text?: string | null;
      hs6?: string | null;
      quantity?: number | null;
      unit_price?: number | null;
      total_value?: number | null;
      currency?: string | null;
    }>;
  };
};

const blankItem = (): ItemDraft => ({
  id: `line-${Math.random().toString(36).slice(2, 10)}`,
  product_text: "",
  hs6: "",
  quantity: "",
  unit_price: "",
  total_value: "",
  currency: "EUR",
});

const INITIAL_FORM: FormState = {
  title: "",
  from_country: "FR",
  to_country: "",
  incoterm: "",
  currency: "EUR",
  value_amount: "",
  payment_method: "",
  route: "",
  client: "",
  product_desc: "",
  notes: "",
};

function n(v: unknown) {
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function currency3(v: string) {
  const x = String(v || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(x) ? x : "";
}

function hs6(v: string) {
  return String(v || "").replace(/[^0-9]/g, "").slice(0, 6);
}

function incoterm3(v: string) {
  return String(v || "").trim().toUpperCase().slice(0, 3);
}

function mapParsedInvoice(parsed: ParsedInvoice) {
  const detectedCurrency = /\bUSD\b|\$/i.test(parsed.rawText || "") ? "USD" : "EUR";
  const items = (parsed.lineItems || []).map((line, idx) => {
    const qty = n(line.quantity);
    const total = n(line.amountHT);
    const unit = qty && total ? Number((total / qty).toFixed(4)) : null;
    return {
      product_text: String(line.description || "").trim() || `Ligne ${idx + 1}`,
      hs6: hs6(String(line.hsCode || "")) || null,
      quantity: qty,
      unit_price: unit,
      total_value: total,
      currency: detectedCurrency,
    };
  });

  return {
    to_country: resolveCountryIso2(parsed.billingCountry || ""),
    currency: detectedCurrency,
    value_amount: n(parsed.totalHT) ?? n(parsed.totalTTC),
    product_desc: items.find((x) => x.product_text)?.product_text || "",
    title_suggestion: parsed.invoiceNumber ? `Dossier ${parsed.invoiceNumber}` : "",
    items,
  };
}

function toDraftItems(items: NonNullable<PdfExtractResponse["extracted"]>["items"]) {
  const rows = (items || [])
    .map((row) => ({
      id: `line-${Math.random().toString(36).slice(2, 10)}`,
      product_text: String(row?.product_text || "").trim(),
      hs6: hs6(String(row?.hs6 || "")),
      quantity: row?.quantity == null ? "" : String(row.quantity),
      unit_price: row?.unit_price == null ? "" : String(row.unit_price),
      total_value: row?.total_value == null ? "" : String(row.total_value),
      currency: currency3(String(row?.currency || "")) || "EUR",
    }))
    .filter((row) => row.product_text || row.total_value);
  return rows.length ? rows : [blankItem()];
}

export default function DossierWizard() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isEn = lang === "en";

  const [step, setStep] = React.useState<Step>(1);
  const [source, setSource] = React.useState<SourceMode>("manual");
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [items, setItems] = React.useState<ItemDraft[]>([blankItem()]);
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const officialLinks = React.useMemo(() => getOfficialLinks(lang, 6), [lang]);

  const applyExtracted = React.useCallback((extracted: NonNullable<PdfExtractResponse["extracted"]>) => {
    setForm((prev) => ({
      ...prev,
      title: prev.title || String(extracted.title_suggestion || "").trim(),
      to_country: String(extracted.to_country || "").trim().toUpperCase() || prev.to_country,
      currency: currency3(String(extracted.currency || "")) || prev.currency || "EUR",
      value_amount: extracted.value_amount == null ? prev.value_amount : String(extracted.value_amount),
      product_desc: String(extracted.product_desc || "").trim() || prev.product_desc,
    }));
    setItems(toDraftItems(extracted.items));
  }, []);

  const onAnalyzePdf = React.useCallback(async () => {
    if (!file) return;
    setParsing(true);
    setError(null);
    setStatus(null);
    try {
      const parsed = await extractInvoiceFromPdf(file);
      const localExtracted = mapParsedInvoice(parsed);
      let usedApi = false;

      try {
        const res = await fetch("/api/pdf", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "extract",
            parsed: {
              invoiceNumber: parsed.invoiceNumber,
              supplier: parsed.supplier,
              date: parsed.date,
              totalHT: parsed.totalHT,
              totalTTC: parsed.totalTTC,
              billingCountry: parsed.billingCountry,
              rawText: parsed.rawText,
              lineItems: parsed.lineItems,
            },
          }),
        });
        const payload = (await res.json().catch(() => null)) as PdfExtractResponse | null;
        if (res.ok && payload?.ok && payload.mode === "extract" && payload.extracted) {
          applyExtracted(payload.extracted);
          setStatus(isEn ? "PDF analyzed and prefilled." : "PDF analyse et pre-rempli.");
          usedApi = true;
        }
      } catch {
        // fallback local
      }

      if (!usedApi) {
        applyExtracted(localExtracted);
        setStatus(
          isEn
            ? "Server extraction unavailable, local prefill applied."
            : "Extraction serveur indisponible, pre-remplissage local applique."
        );
      }
    } catch {
      setError(isEn ? "Unable to parse this PDF." : "Impossible d'analyser ce PDF.");
    } finally {
      setParsing(false);
    }
  }, [applyExtracted, file, isEn]);

  const updateLine = (id: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const addLine = () => setItems((prev) => [...prev, blankItem()]);
  const removeLine = (id: string) =>
    setItems((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length ? next : [blankItem()];
    });

  const normalizedItems = React.useMemo(() => {
    return items
      .map((row, index) => {
        const quantity = n(row.quantity);
        const unit = n(row.unit_price);
        const totalInput = n(row.total_value);
        const total =
          totalInput !== null ? totalInput : quantity !== null && unit !== null ? Number((quantity * unit).toFixed(2)) : null;
        return {
          line_no: index + 1,
          product_text: String(row.product_text || "").trim(),
          hs6: hs6(row.hs6) || null,
          quantity,
          unit_price: unit,
          total_value: total,
          currency: currency3(row.currency) || currency3(form.currency) || "EUR",
        } satisfies CreateDealItemInput;
      })
      .filter((row) => row.product_text || row.total_value !== null);
  }, [form.currency, items]);

  const validate = React.useCallback(() => {
    if (!form.to_country) return isEn ? "Destination country is required." : "Le pays de destination est obligatoire.";
    if (!form.product_desc.trim() && !normalizedItems.length) {
      return isEn
        ? "Provide product description or at least one line item."
        : "Renseignez une description produit ou au moins une ligne.";
    }
    if (!currency3(form.currency)) return isEn ? "Currency must be 3 letters." : "La devise doit comporter 3 lettres.";
    if (form.incoterm && !/^[A-Z]{3}$/.test(incoterm3(form.incoterm))) {
      return isEn ? "Incoterm must be 3 letters." : "L'incoterm doit comporter 3 lettres.";
    }
    return null;
  }, [form.currency, form.incoterm, form.product_desc, form.to_country, isEn, normalizedItems.length]);

  const onCreate = React.useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const notes = [
        form.notes.trim(),
        form.client.trim() ? `${isEn ? "Client" : "Client"}: ${form.client.trim()}` : "",
        form.payment_method.trim() ? `${isEn ? "Payment" : "Paiement"}: ${form.payment_method.trim()}` : "",
        form.route.trim() ? `Route: ${form.route.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const deal = await createDeal({
        title: form.title.trim() || (isEn ? `Export dossier ${form.to_country}` : `Dossier export ${form.to_country}`),
        stage: "new",
        amount: n(form.value_amount) || 0,
        currency: currency3(form.currency) || "EUR",
        probability: 20,
        from_country: form.from_country || "FR",
        to_country: form.to_country || null,
        product_text: form.product_desc.trim() || null,
        incoterm: incoterm3(form.incoterm) || null,
        notes: notes || null,
      });

      const lines = normalizedItems.length
        ? normalizedItems
        : [
            {
              line_no: 1,
              product_text: form.product_desc.trim() || (isEn ? "Product line" : "Ligne produit"),
              hs6: null,
              quantity: 1,
              unit_price: n(form.value_amount),
              total_value: n(form.value_amount),
              currency: currency3(form.currency) || "EUR",
            } satisfies CreateDealItemInput,
          ];

      await createDealItems(deal.id, lines);
      navigate(`/app/dossiers/${deal.id}`);
    } catch (e) {
      setError((e as Error)?.message || (isEn ? "Unable to create dossier." : "Impossible de creer le dossier."));
    } finally {
      setSaving(false);
    }
  }, [form.client, form.currency, form.from_country, form.incoterm, form.notes, form.payment_method, form.product_desc, form.route, form.title, form.to_country, form.value_amount, isEn, navigate, normalizedItems, validate]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" asChild>
            <Link to="/app/dossiers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isEn ? "Back to dossiers" : "Retour aux dossiers"}
            </Link>
          </Button>
          <Badge variant="outline">{`Step ${step}/4`}</Badge>
        </div>

        <Card className="border-blue-100 bg-white/95">
          <CardHeader>
            <CardTitle>{isEn ? "New Export Dossier" : "Nouveau Dossier Export"}</CardTitle>
            <CardDescription>
              {isEn ? "Create a usable dossier in under 2 minutes." : "Creez un dossier exploitable en moins de 2 minutes."}
            </CardDescription>
            <div className="flex flex-wrap gap-2">
              <Badge variant={step >= 1 ? "default" : "outline"}>{`1. ${isEn ? "Source" : "Source"}`}</Badge>
              <Badge variant={step >= 2 ? "default" : "outline"}>{`2. ${isEn ? "Operation" : "Operation"}`}</Badge>
              <Badge variant={step >= 3 ? "default" : "outline"}>{`3. ${isEn ? "Items" : "Lignes"}`}</Badge>
              <Badge variant={step >= 4 ? "default" : "outline"}>{`4. ${isEn ? "Review" : "Verification"}`}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {status ? <p className="text-sm text-emerald-700">{status}</p> : null}

            {step === 1 ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSource("manual")}
                    className={`rounded-xl border p-4 text-left ${source === "manual" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                  >
                    <p className="font-semibold">{isEn ? "Manual" : "Manuel"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isEn ? "Start from scratch." : "Demarrer avec une saisie simple."}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource("pdf")}
                    className={`rounded-xl border p-4 text-left ${source === "pdf" ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                  >
                    <p className="font-semibold">{isEn ? "From PDF" : "A partir d'un PDF"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isEn ? "Upload invoice/proforma/order and prefill." : "Importer facture/proforma/commande et pre-remplir."}
                    </p>
                  </button>
                </div>

                {source === "pdf" ? (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                    <Label htmlFor="dossier-pdf">{isEn ? "PDF file" : "Fichier PDF"}</Label>
                    <Input
                      id="dossier-pdf"
                      type="file"
                      accept="application/pdf"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                    />
                    <Button type="button" variant="secondary" disabled={!file || parsing} onClick={onAnalyzePdf}>
                      {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                      {isEn ? "Analyze PDF" : "Analyser le PDF"}
                    </Button>
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)}>{isEn ? "Next" : "Suivant"}</Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>{isEn ? "Title" : "Titre"}</Label>
                    <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEn ? "Origin country" : "Pays origine"}</Label>
                    <Select value={form.from_country || "FR"} onValueChange={(value) => setForm((p) => ({ ...p, from_country: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={`from-${country.iso2}`} value={country.iso2}>
                            {isEn ? country.label_en : country.label_fr} ({country.iso2})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{isEn ? "Destination country *" : "Pays destination *"}</Label>
                    <Select value={form.to_country || "none"} onValueChange={(value) => setForm((p) => ({ ...p, to_country: value === "none" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder={isEn ? "Select country" : "Choisir un pays"} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-</SelectItem>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={`to-${country.iso2}`} value={country.iso2}>
                            {isEn ? country.label_en : country.label_fr} ({country.iso2})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Incoterm</Label>
                    <Input value={form.incoterm} onChange={(e) => setForm((p) => ({ ...p, incoterm: incoterm3(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEn ? "Currency *" : "Devise *"}</Label>
                    <Select value={currency3(form.currency) || "EUR"} onValueChange={(value) => setForm((p) => ({ ...p, currency: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((item) => (
                          <SelectItem key={`cur-${item.value}`} value={item.value}>
                            {isEn ? item.label_en : item.label_fr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{isEn ? "Operation value" : "Valeur operation"}</Label>
                    <Input type="number" min="0" value={form.value_amount} onChange={(e) => setForm((p) => ({ ...p, value_amount: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEn ? "Payment method" : "Mode de paiement"}</Label>
                    <Select value={form.payment_method || "none"} onValueChange={(value) => setForm((p) => ({ ...p, payment_method: value === "none" ? "" : value }))}>
                      <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-</SelectItem>
                        {PAYMENT_TERMS.map((item) => (
                          <SelectItem key={`pay-${item.value}`} value={item.value}>
                            {isEn ? item.label_en : item.label_fr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Route</Label>
                    <Input value={form.route} onChange={(e) => setForm((p) => ({ ...p, route: e.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{isEn ? "Client" : "Client"}</Label>
                    <Input value={form.client} onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{isEn ? "Product description *" : "Description produit *"}</Label>
                    <Input value={form.product_desc} onChange={(e) => setForm((p) => ({ ...p, product_desc: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>{isEn ? "Notes" : "Notes"}</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>{isEn ? "Back" : "Retour"}</Button>
                  <Button onClick={() => setStep(3)}>{isEn ? "Next" : "Suivant"}</Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                {items.map((line) => (
                  <div key={line.id} className="grid gap-2 rounded-xl border border-border bg-card p-3 md:grid-cols-12">
                    <div className="space-y-1 md:col-span-4">
                      <Label>{isEn ? "Product" : "Produit"}</Label>
                      <Input value={line.product_text} onChange={(e) => updateLine(line.id, { product_text: e.target.value })} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>HS6</Label>
                      <Input value={line.hs6} onChange={(e) => updateLine(line.id, { hs6: hs6(e.target.value) })} />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <Label>{isEn ? "Qty" : "Qt"}</Label>
                      <Input type="number" min="0" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>{isEn ? "Unit" : "PU"}</Label>
                      <Input type="number" min="0" value={line.unit_price} onChange={(e) => updateLine(line.id, { unit_price: e.target.value })} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label>{isEn ? "Total" : "Total"}</Label>
                      <Input type="number" min="0" value={line.total_value} onChange={(e) => updateLine(line.id, { total_value: e.target.value })} />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <Label>{isEn ? "Cur." : "Dev."}</Label>
                      <Input value={line.currency} onChange={(e) => updateLine(line.id, { currency: currency3(e.target.value) })} />
                    </div>
                    <div className="md:col-span-12 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(line.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isEn ? "Remove line" : "Supprimer la ligne"}
                      </Button>
                    </div>
                  </div>
                ))}

                <Button type="button" variant="outline" onClick={addLine}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isEn ? "Add line item" : "Ajouter une ligne"}
                </Button>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>{isEn ? "Back" : "Retour"}</Button>
                  <Button onClick={() => setStep(4)}>{isEn ? "Review" : "Verifier"}</Button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-semibold">{isEn ? "Operation summary" : "Resume operation"}</p>
                  <div className="mt-2 grid gap-1 text-sm md:grid-cols-2">
                    <div>{isEn ? "Title" : "Titre"}: <b>{form.title || "-"}</b></div>
                    <div>{isEn ? "From" : "Origine"}: <b>{getCountryLabel(form.from_country, lang)}</b></div>
                    <div>{isEn ? "To" : "Destination"}: <b>{getCountryLabel(form.to_country, lang)}</b></div>
                    <div>Incoterm: <b>{form.incoterm || "-"}</b></div>
                    <div>{isEn ? "Currency" : "Devise"}: <b>{currency3(form.currency) || "-"}</b></div>
                    <div>{isEn ? "Amount" : "Valeur"}: <b>{form.value_amount || "-"}</b></div>
                  </div>
                  <p className="mt-2 text-sm">{isEn ? "Product" : "Produit"}: <b>{form.product_desc || "-"}</b></p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold">
                    {isEn ? "Official sources" : "Sources officielles"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {officialLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                        title={link.description}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setStep(3)}>{isEn ? "Back" : "Retour"}</Button>
                  <Button onClick={onCreate} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {saving ? (isEn ? "Creating..." : "Creation...") : (isEn ? "Create dossier" : "Creer le dossier")}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
