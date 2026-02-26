import * as React from "react";
import { FileUp, Loader2, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  COUNTRIES,
  CURRENCIES,
  INCOTERMS,
  OPERATION_TYPES,
  PAYMENT_TERMS,
  PRODUCTS,
  getCountryLabel,
  getLocalizedLabel,
} from "@/lib/constants";
import { sanitizeOptionalComment, toFriendlyErrorMessage } from "@/lib/textSanitizer";
import { useI18n } from "@/contexts/LanguageContext";

type CheckLevel = "ok" | "warning" | "risk";

type InvoiceCheckItem = {
  level: CheckLevel;
  label: string;
  detail: string;
};

type InvoiceAnalysisResult = {
  ok: boolean;
  analysis_source: string;
  status: "ok" | "review" | "risk";
  extracted: {
    invoice_number: string | null;
    date: string | null;
    seller: string | null;
    buyer: string | null;
    destination: string | null;
    incoterm: string | null;
    currency: string | null;
    total_ht: number | null;
    total_ttc: number | null;
    line_count: number | null;
  };
  checks: InvoiceCheckItem[];
  recommendations: string[];
  checklist: string[];
};

type EditableInvoiceContext = {
  operationType: string;
  destination: string;
  incoterm: string;
  currency: string;
  paymentTerm: string;
  productCode: string;
  optionalComment: string;
};

const INITIAL_CONTEXT: EditableInvoiceContext = {
  operationType: "export",
  destination: "",
  incoterm: "",
  currency: "EUR",
  paymentTerm: "",
  productCode: "",
  optionalComment: "",
};

function formatMoney(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency || "EUR"}`;
  }
}

function resolveStatusFromChecks(checks: InvoiceCheckItem[]): "ok" | "review" | "risk" {
  if (checks.some((item) => item.level === "risk")) return "risk";
  if (checks.some((item) => item.level === "warning")) return "review";
  return "ok";
}

function buildLocalChecks(ctx: EditableInvoiceContext, parsed: InvoiceAnalysisResult | null) {
  const checks: InvoiceCheckItem[] = [];

  if (!ctx.destination) {
    checks.push({
      level: "warning",
      label: "Destination",
      detail: "Le pays de destination doit etre confirme pour la partie douane et sanctions.",
    });
  } else {
    checks.push({
      level: "ok",
      label: "Destination",
      detail: `Destination selectionnee: ${getCountryLabel(ctx.destination, "fr")}.`,
    });
  }

  if (!ctx.incoterm) {
    checks.push({
      level: "risk",
      label: "Incoterm",
      detail: "Incoterm manquant: impossible de fixer clairement la repartition des risques et couts.",
    });
  } else {
    checks.push({
      level: "ok",
      label: "Incoterm",
      detail: `Incoterm confirme: ${ctx.incoterm}.`,
    });
  }

  if (!ctx.paymentTerm) {
    checks.push({
      level: "warning",
      label: "Paiement",
      detail: "Mode de paiement non precise. Ajoutez-le pour reduire le risque contractuel.",
    });
  } else {
    checks.push({
      level: "ok",
      label: "Paiement",
      detail: `Mode de paiement: ${ctx.paymentTerm}.`,
    });
  }

  if (parsed?.extracted.total_ht != null && parsed?.extracted.total_ttc != null && parsed.extracted.total_ttc < parsed.extracted.total_ht) {
    checks.push({
      level: "risk",
      label: "Totaux HT/TTC",
      detail: "Incoherence detectee: le total TTC est inferieur au total HT.",
    });
  }

  if ((parsed?.extracted.line_count || 0) <= 0) {
    checks.push({
      level: "warning",
      label: "Lignes facture",
      detail: "Aucune ligne produit detectee automatiquement. Controle manuel recommande.",
    });
  }

  return checks;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function statusBadge(status: "ok" | "review" | "risk") {
  if (status === "ok") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <ShieldCheck className="h-3.5 w-3.5" /> OK
      </Badge>
    );
  }
  if (status === "review") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
        <TriangleAlert className="h-3.5 w-3.5" /> Points a corriger
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-rose-100 text-rose-800 hover:bg-rose-100">
      <ShieldAlert className="h-3.5 w-3.5" /> Risques
    </Badge>
  );
}

function checkColor(level: CheckLevel) {
  if (level === "ok") return "text-emerald-700";
  if (level === "warning") return "text-amber-700";
  return "text-rose-700";
}

export default function InvoiceCheck() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const isEn = lang === "en";

  const [context, setContext] = React.useState<EditableInvoiceContext>(INITIAL_CONTEXT);
  const [pdfFileName, setPdfFileName] = React.useState<string>("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<InvoiceAnalysisResult | null>(null);
  const [localChecks, setLocalChecks] = React.useState<InvoiceCheckItem[]>([]);
  const [errorText, setErrorText] = React.useState<string>("");

  const mergedChecks = React.useMemo(() => {
    const serverChecks = Array.isArray(analysis?.checks) ? analysis?.checks : [];
    const all = [...serverChecks, ...localChecks];
    return all;
  }, [analysis?.checks, localChecks]);

  const finalStatus = React.useMemo(() => {
    if (analysis?.status) {
      const localStatus = resolveStatusFromChecks(localChecks);
      if (analysis.status === "risk" || localStatus === "risk") return "risk";
      if (analysis.status === "review" || localStatus === "review") return "review";
      return "ok";
    }
    return resolveStatusFromChecks(localChecks);
  }, [analysis?.status, localChecks]);

  const onContextChange = (patch: Partial<EditableInvoiceContext>) => {
    setContext((prev) => ({ ...prev, ...patch }));
  };

  const applyExtractedToContext = React.useCallback((result: InvoiceAnalysisResult) => {
    setContext((prev) => ({
      ...prev,
      destination: result.extracted.destination || prev.destination,
      incoterm: result.extracted.incoterm || prev.incoterm,
      currency: result.extracted.currency || prev.currency || "EUR",
    }));
  }, []);

  const runChecks = React.useCallback((result: InvoiceAnalysisResult | null, currentContext: EditableInvoiceContext) => {
    const checks = buildLocalChecks(currentContext, result);
    setLocalChecks(checks);
  }, []);

  const analyzeInvoice = React.useCallback(
    async (file: File) => {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({
          title: isEn ? "Unsupported file" : "Fichier non supporte",
          description: isEn ? "Please upload a PDF invoice." : "Merci d'importer une facture au format PDF.",
        });
        return;
      }

      setLoading(true);
      setErrorText("");
      setPdfFileName(file.name);

      try {
        const payload = {
          file_name: file.name,
          file_base64: await fileToBase64(file),
          operation_type: context.operationType,
          destination: context.destination,
          incoterm: context.incoterm,
          currency: context.currency,
          payment_term: context.paymentTerm,
          product_code: context.productCode,
          optional_comment: sanitizeOptionalComment(context.optionalComment),
        };

        const response = await fetch("/api/invoice/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = (await response.json().catch(() => ({}))) as InvoiceAnalysisResult & { error?: string };

        if (!response.ok || !json.ok) {
          throw new Error(json?.error || `invoice_analyze_failed_${response.status}`);
        }

        setAnalysis(json);
        applyExtractedToContext(json);

        const nextContext: EditableInvoiceContext = {
          ...context,
          destination: json.extracted.destination || context.destination,
          incoterm: json.extracted.incoterm || context.incoterm,
          currency: json.extracted.currency || context.currency,
        };
        runChecks(json, nextContext);

        toast({
          title: isEn ? "Invoice analyzed" : "Facture analysee",
          description: isEn
            ? "Extraction completed. Please review and adjust the controlled fields."
            : "Extraction terminee. Merci de verifier les champs controles ci-dessous.",
        });
      } catch (error) {
        const friendly = toFriendlyErrorMessage(error, lang);
        setErrorText(friendly);
        toast({
          title: isEn ? "Analysis unavailable" : "Analyse indisponible",
          description: friendly,
        });
      } finally {
        setLoading(false);
      }
    },
    [applyExtractedToContext, context, isEn, lang, runChecks, toast],
  );

  React.useEffect(() => {
    runChecks(analysis, context);
  }, [analysis, context, runChecks]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">MPL Export Navigator</p>
          <h1 className="text-2xl font-semibold">
            {isEn ? "Invoice verification" : "Verification facture export/import"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn
              ? "Upload a PDF, extract key fields, validate consistency, and get an action checklist."
              : "Importez un PDF, detectez les champs cles, validez la coherence et obtenez une checklist actionnable."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Context (controlled fields)" : "Contexte (champs controles)"}</CardTitle>
            <CardDescription>
              {isEn
                ? "Only dropdowns are allowed, plus one optional comment."
                : "Utilisation exclusive de menus deroulants, avec un seul commentaire optionnel."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>{isEn ? "Operation" : "Operation"}</Label>
              <Select value={context.operationType} onValueChange={(value) => onContextChange({ operationType: value })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {OPERATION_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{getLocalizedLabel(item, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Destination country" : "Pays destination"}</Label>
              <Select value={context.destination} onValueChange={(value) => onContextChange({ destination: value })}>
                <SelectTrigger><SelectValue placeholder={isEn ? "Select country" : "Choisir un pays"} /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.iso2} value={country.iso2}>
                      {lang === "en" ? country.label_en : country.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Incoterm</Label>
              <Select value={context.incoterm} onValueChange={(value) => onContextChange({ incoterm: value })}>
                <SelectTrigger><SelectValue placeholder="EXW/FCA/..." /></SelectTrigger>
                <SelectContent>
                  {INCOTERMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Currency" : "Devise"}</Label>
              <Select value={context.currency} onValueChange={(value) => onContextChange({ currency: value })}>
                <SelectTrigger><SelectValue placeholder="EUR/USD/..." /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Payment method" : "Mode de paiement"}</Label>
              <Select value={context.paymentTerm} onValueChange={(value) => onContextChange({ paymentTerm: value })}>
                <SelectTrigger><SelectValue placeholder="LC/CAD/..." /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{getLocalizedLabel(item, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{isEn ? "Product" : "Produit"}</Label>
              <Select value={context.productCode} onValueChange={(value) => onContextChange({ productCode: value })}>
                <SelectTrigger><SelectValue placeholder={isEn ? "Select product" : "Choisir un produit"} /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((product) => (
                    <SelectItem key={product.code} value={product.code}>
                      {lang === "en" ? product.label_en : product.label_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:col-span-3">
              <Label>{isEn ? "Optional precision" : "Precision optionnelle"}</Label>
              <Textarea
                rows={2}
                value={context.optionalComment}
                onChange={(event) => onContextChange({ optionalComment: event.target.value })}
                placeholder={isEn ? "Optional details" : "Details optionnels"}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isEn ? "Upload invoice PDF" : "Importer la facture PDF"}</CardTitle>
            <CardDescription>
              {isEn
                ? "File is analyzed without mandatory storage."
                : "Le fichier est analyse sans stockage obligatoire."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className={`rounded-xl border-2 border-dashed p-6 text-center transition ${
                isDragging ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  void analyzeInvoice(file);
                }
              }}
            >
              <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm">
                {isEn ? "Drop your PDF here or choose a file" : "Glissez votre PDF ici ou choisissez un fichier"}
              </p>
              <div className="mt-3">
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={loading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void analyzeInvoice(file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isEn ? "Analyzing invoice..." : "Analyse de la facture en cours..."}
              </div>
            ) : null}

            {pdfFileName ? (
              <p className="text-xs text-muted-foreground">{isEn ? "Last file" : "Dernier fichier"}: {pdfFileName}</p>
            ) : null}

            {errorText ? <p className="text-sm text-rose-700">{errorText}</p> : null}
          </CardContent>
        </Card>

        {analysis ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{isEn ? "Analysis result" : "Resultat de l'analyse"}</CardTitle>
                  {statusBadge(finalStatus)}
                </div>
                <CardDescription>
                  {isEn ? "Detected values are editable in the controlled context above." : "Les valeurs detectees restent modifiables dans le contexte controle ci-dessus."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{isEn ? "Invoice number" : "Numero facture"}</div>
                  <div className="text-sm font-medium">{analysis.extracted.invoice_number || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="text-sm font-medium">{analysis.extracted.date || "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{isEn ? "Detected destination" : "Destination detectee"}</div>
                  <div className="text-sm font-medium">{analysis.extracted.destination ? getCountryLabel(analysis.extracted.destination, lang) : "-"}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">HT</div>
                  <div className="text-sm font-medium">{formatMoney(analysis.extracted.total_ht, context.currency)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">TTC</div>
                  <div className="text-sm font-medium">{formatMoney(analysis.extracted.total_ttc, context.currency)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{isEn ? "Detected lines" : "Lignes detectees"}</div>
                  <div className="text-sm font-medium">{analysis.extracted.line_count ?? "-"}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Checks and risks" : "Controles et risques"}</CardTitle>
                <CardDescription>
                  {isEn ? "No technical errors are exposed. Use this checklist to correct the invoice." : "Aucune erreur technique n'est exposee. Utilisez cette checklist pour corriger la facture."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {mergedChecks.map((check, index) => (
                  <div key={`${check.label}-${index}`} className="rounded-lg border bg-card px-3 py-2">
                    <p className={`text-sm font-medium ${checkColor(check.level)}`}>{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isEn ? "Action checklist" : "Checklist actionnable"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {(analysis.checklist || []).map((item) => (
                    <li key={`checklist-${item}`}>{item}</li>
                  ))}
                </ul>
                <Separator />
                <p className="text-sm font-medium">{isEn ? "Recommendations" : "Recommandations"}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {(analysis.recommendations || []).map((item) => (
                    <li key={`reco-${item}`}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
