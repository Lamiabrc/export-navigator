import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Info,
  Link as LinkIcon,
  Plus,
  RefreshCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, CURRENCIES, INCOTERMS, OFFICIAL_LINKS } from "@/lib/constants";
import {
  assessInvoice,
  isEuIso2,
  isValidIsoCurrency,
  type CheckStatus,
  type CheckerItem,
  type CheckerTab,
  type InvoiceData,
  type InvoiceLineInput,
  type TransactionContext,
} from "@/lib/invoice";

const TAB_ORDER: CheckerTab[] = ["mentions", "vat", "customs", "fx", "calculs", "risks"];

const TAB_LABELS: Record<CheckerTab, string> = {
  mentions: "Mentions facture",
  vat: "TVA",
  customs: "Douane",
  fx: "Devise",
  calculs: "Calculs",
  risks: "Risques",
};

type FormIssue = {
  id: string;
  level: "KO" | "WARN";
  message: string;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseNumberInput(value: string) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumberInput(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIso2(value: string) {
  return String(value || "").trim().toUpperCase().slice(0, 2);
}

function normalizeHs6(value: string) {
  return String(value || "").replace(/[^0-9]/g, "").slice(0, 6);
}

function formatMoney(value: number | null | undefined, currency: string) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "-";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency || "EUR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "EUR"}`;
  }
}

function countryLabel(iso2: string) {
  const code = normalizeIso2(iso2);
  const found = COUNTRIES.find((country) => country.iso2 === code);
  return found ? `${found.label_fr} (${found.iso2})` : code || "-";
}

function computeLineValue(line: Pick<InvoiceLineInput, "qty" | "unitPrice" | "discountPct">) {
  const qty = Number.isFinite(line.qty) ? line.qty : 0;
  const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  const discountPct = Number.isFinite(line.discountPct) ? line.discountPct : 0;
  return round2(qty * unitPrice * (1 - discountPct / 100));
}

function createLine(position: number): InvoiceLineInput {
  return {
    id: `line_${Date.now()}_${position}`,
    description: "",
    hs6: "",
    originCountry: "",
    qty: 1,
    unit: "pcs",
    unitPrice: 0,
    discountPct: 0,
    lineValue: 0,
  };
}

function createInitialContext(): TransactionContext {
  return {
    goodsOrServices: "goods",
    flowDirection: "auto",
    sellerCountry: "FR",
    buyerCountry: "",
    buyerIsTaxable: true,
    sellerVat: "",
    buyerVat: "",
    currency: "EUR",
    exchangeRate: null,
    incoterm: "",
    incotermPlace: "",
    proofOfTransport: false,
  };
}

function createInitialInvoice(): InvoiceData {
  return {
    invoiceNumber: "",
    issueDate: "",
    poReference: "",
    contractReference: "",
    seller: {
      name: "",
      address: "",
      identifier: "",
    },
    buyer: {
      name: "",
      address: "",
      identifier: "",
    },
    lines: [createLine(1)],
    totals: {
      totalHt: 0,
      vatAmount: 0,
      totalTtc: 0,
    },
    netWeight: 0,
    grossWeight: 0,
    packageCount: 0,
    marksNumbers: "",
    payment: {
      dueDate: "",
      iban: "",
      bic: "",
      swift: "",
    },
    charges: {
      freight: 0,
      insurance: 0,
      other: 0,
    },
    documents: {
      awb: "",
      bl: "",
      packingList: "",
    },
  };
}
function buildContextIssues(context: TransactionContext): FormIssue[] {
  const issues: FormIssue[] = [];
  const seller = normalizeIso2(context.sellerCountry);
  const buyer = normalizeIso2(context.buyerCountry);
  const isInternational = Boolean(seller && buyer && seller !== buyer);
  const isIntraEuGoods = context.goodsOrServices === "goods" && isEuIso2(seller) && isEuIso2(buyer) && seller !== buyer;

  if (!seller) {
    issues.push({
      id: "ctx_seller",
      level: "KO",
      message: "Pays vendeur obligatoire.",
    });
  }

  if (!buyer) {
    issues.push({
      id: "ctx_buyer",
      level: "KO",
      message: "Pays acheteur obligatoire.",
    });
  }

  if (!isValidIsoCurrency(context.currency)) {
    issues.push({
      id: "ctx_currency",
      level: "KO",
      message: "Devise invalide: utilisez un code ISO 4217 (EUR, USD, GBP, ...).",
    });
  }

  if (context.currency.toUpperCase() !== "EUR" && (!context.exchangeRate || context.exchangeRate <= 0)) {
    issues.push({
      id: "ctx_fx",
      level: "KO",
      message: "Taux de change obligatoire si la devise est differente de EUR.",
    });
  }

  if (isInternational && (!context.incoterm.trim() || !context.incotermPlace.trim())) {
    issues.push({
      id: "ctx_incoterm",
      level: "WARN",
      message: "Incoterm + lieu recommandes en international (warning si absent).",
    });
  }

  if (isIntraEuGoods && !context.proofOfTransport) {
    issues.push({
      id: "ctx_transport_proof",
      level: "WARN",
      message: "Preuve de transport intra-UE non cochee: condition d'exoneration TVA potentiellement manquante.",
    });
  }

  return issues;
}

function statusBadge(status: "OK" | "WARNING" | "BLOCKING") {
  if (status === "OK") {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="h-3.5 w-3.5" />
        OK
      </Badge>
    );
  }
  if (status === "WARNING") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
        <AlertTriangle className="h-3.5 w-3.5" />
        WARNING
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-rose-100 text-rose-800 hover:bg-rose-100">
      <XCircle className="h-3.5 w-3.5" />
      BLOCKING
    </Badge>
  );
}

function checkStatusBadge(status: CheckStatus) {
  if (status === "OK") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>;
  }
  if (status === "WARN") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">WARN</Badge>;
  }
  return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">KO</Badge>;
}

function toResultSummary(assessmentChecks: CheckerItem[]) {
  const ko = assessmentChecks.filter((check) => check.status === "KO").length;
  const warn = assessmentChecks.filter((check) => check.status === "WARN").length;
  const ok = assessmentChecks.filter((check) => check.status === "OK").length;
  return { ko, warn, ok };
}

export default function InvoiceCheck() {
  const { toast } = useToast();

  const [context, setContext] = React.useState<TransactionContext>(() => createInitialContext());
  const [invoice, setInvoice] = React.useState<InvoiceData>(() => createInitialInvoice());
  const [activeTab, setActiveTab] = React.useState<CheckerTab>("mentions");
  const [pdfFileName, setPdfFileName] = React.useState("");

  const isInternational = React.useMemo(
    () => Boolean(context.sellerCountry && context.buyerCountry && context.sellerCountry !== context.buyerCountry),
    [context.buyerCountry, context.sellerCountry],
  );

  const contextIssues = React.useMemo(() => buildContextIssues(context), [context]);
  const assessment = React.useMemo(() => assessInvoice(context, invoice), [context, invoice]);

  const allChecks = React.useMemo(
    () => TAB_ORDER.flatMap((tab) => assessment.checks_by_tab[tab]),
    [assessment],
  );
  const checkSummary = React.useMemo(() => toResultSummary(allChecks), [allChecks]);

  const lineTotal = React.useMemo(
    () => round2(invoice.lines.reduce((sum, line) => sum + Number(line.lineValue || 0), 0)),
    [invoice.lines],
  );

  const updateContext = React.useCallback((patch: Partial<TransactionContext>) => {
    setContext((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateInvoice = React.useCallback(<K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
    setInvoice((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateLine = React.useCallback((lineId: string, patch: Partial<InvoiceLineInput>) => {
    setInvoice((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...patch };
        const lineValueExplicit = "lineValue" in patch;
        const shouldAutoCompute = "qty" in patch || "unitPrice" in patch || "discountPct" in patch;
        if (!lineValueExplicit && shouldAutoCompute) {
          next.lineValue = computeLineValue(next);
        }
        return next;
      }),
    }));
  }, []);

  const addLine = React.useCallback(() => {
    setInvoice((prev) => ({
      ...prev,
      lines: [...prev.lines, createLine(prev.lines.length + 1)],
    }));
  }, []);

  const removeLine = React.useCallback((lineId: string) => {
    setInvoice((prev) => {
      if (prev.lines.length <= 1) return prev;
      return {
        ...prev,
        lines: prev.lines.filter((line) => line.id !== lineId),
      };
    });
  }, []);

  const recomputeTotals = React.useCallback(() => {
    setInvoice((prev) => {
      const recomputedHt = round2(prev.lines.reduce((sum, line) => sum + Number(line.lineValue || 0), 0));
      return {
        ...prev,
        totals: {
          ...prev.totals,
          totalHt: recomputedHt,
          totalTtc: round2(recomputedHt + Number(prev.totals.vatAmount || 0)),
        },
      };
    });
    toast({
      title: "Totaux recalcules",
      description: "HT aligne sur la somme des lignes, TTC = HT + TVA.",
    });
  }, [toast]);

  const resetForm = React.useCallback(() => {
    setContext(createInitialContext());
    setInvoice(createInitialInvoice());
    setActiveTab("mentions");
    setPdfFileName("");
  }, []);

  const handlePdfUpload = React.useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({
          title: "Format non supporte",
          description: "Importez un PDF. L'extraction OCR reste optionnelle et non bloquante.",
        });
        return;
      }
      setPdfFileName(file.name);
      toast({
        title: "PDF charge",
        description: "La verification s'appuie prioritairement sur la saisie guidee.",
      });
    },
    [toast],
  );

  const alertVariant = contextIssues.some((issue) => issue.level === "KO") ? "destructive" : "warning";
  const currencyUpper = context.currency.toUpperCase();
  const requiresFxRate = currencyUpper !== "EUR";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Mode guide: facture import/export</p>
            <h1 className="text-xl font-semibold text-slate-900">Verification de facture operationnelle</h1>
            <p className="text-sm text-muted-foreground">
              Flux en 3 blocs: contexte, donnees facture, resultat expert TVA/douane/devise.
            </p>
          </div>
          <Button variant="outline" onClick={resetForm}>
            Reinitialiser
          </Button>
        </div>

        {contextIssues.length > 0 ? (
          <Alert variant={alertVariant}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Points de saisie a corriger</AlertTitle>
            <AlertDescription className="space-y-1">
              {contextIssues.map((issue) => (
                <p key={issue.id}>- {issue.message}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Contexte minimum complet</AlertTitle>
            <AlertDescription>
              Les champs critiques sont renseignes. Vous pouvez fiabiliser les calculs et les checks detailes.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>A) Contexte transaction</CardTitle>
            <CardDescription>
              Obligatoire pour determiner TVA, logique import/export, devise et exigences documentaires.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Biens / Services</Label>
                <Select
                  value={context.goodsOrServices}
                  onValueChange={(value: "goods" | "services") => updateContext({ goodsOrServices: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goods">Biens</SelectItem>
                    <SelectItem value="services">Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Flux</Label>
                <Select
                  value={context.flowDirection}
                  onValueChange={(value: "auto" | "import" | "export") => updateContext({ flowDirection: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto via pays</SelectItem>
                    <SelectItem value="import">Import</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Pays vendeur</Label>
                <Select
                  value={context.sellerCountry || undefined}
                  onValueChange={(value) => updateContext({ sellerCountry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={`seller-${country.iso2}`} value={country.iso2}>
                        {country.label_fr} ({country.iso2})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Pays acheteur</Label>
                <Select
                  value={context.buyerCountry || undefined}
                  onValueChange={(value) => updateContext({ buyerCountry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={`buyer-${country.iso2}`} value={country.iso2}>
                        {country.label_fr} ({country.iso2})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Acheteur assujetti TVA ?</Label>
                <Select
                  value={context.buyerIsTaxable ? "yes" : "no"}
                  onValueChange={(value) => updateContext({ buyerIsTaxable: value === "yes" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>N TVA vendeur</Label>
                <Input
                  value={context.sellerVat}
                  onChange={(event) =>
                    updateContext({
                      sellerVat: event.target.value.toUpperCase().replace(/\s+/g, ""),
                    })
                  }
                  placeholder="FR12345678901"
                />
              </div>

              <div className="space-y-1">
                <Label>N TVA acheteur</Label>
                <Input
                  value={context.buyerVat}
                  onChange={(event) =>
                    updateContext({
                      buyerVat: event.target.value.toUpperCase().replace(/\s+/g, ""),
                    })
                  }
                  placeholder="IT12345678901"
                />
              </div>

              <div className="space-y-1">
                <Label>Preuve transport UE ?</Label>
                <Select
                  value={context.proofOfTransport ? "yes" : "no"}
                  onValueChange={(value) => updateContext({ proofOfTransport: value === "yes" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Devise (ISO 4217)</Label>
                <Input
                  value={context.currency}
                  onChange={(event) =>
                    updateContext({
                      currency: event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3),
                    })
                  }
                  placeholder="EUR"
                />
                <p className="text-xs text-muted-foreground">Codes frequents: {CURRENCIES.map((currency) => currency.value).join(", ")}</p>
              </div>

              <div className="space-y-1">
                <Label>Taux de change ({currencyUpper} vers EUR)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={context.exchangeRate == null ? "" : String(context.exchangeRate)}
                  onChange={(event) => updateContext({ exchangeRate: parseNullableNumberInput(event.target.value) })}
                  placeholder={requiresFxRate ? "Obligatoire si devise != EUR" : "Non requis en EUR"}
                />
              </div>

              <div className="space-y-1">
                <Label>Incoterm</Label>
                <Select value={context.incoterm || undefined} onValueChange={(value) => updateContext({ incoterm: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="EXW / FCA / DDP..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOTERMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Lieu Incoterm</Label>
                <Input
                  value={context.incotermPlace}
                  onChange={(event) => updateContext({ incotermPlace: event.target.value })}
                  placeholder="FCA Lyon / DAP Milan"
                />
              </div>
            </div>

            {isInternational && (!context.incoterm || !context.incotermPlace) ? (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>International sans Incoterm complet</AlertTitle>
                <AlertDescription>
                  Le moteur continue, mais ce point reste en warning. Ajoutez le code Incoterm et le lieu.
                </AlertDescription>
              </Alert>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Verification VIES:{" "}
              <a className="underline" href="https://ec.europa.eu/taxation_customs/vies/" target="_blank" rel="noreferrer">
                https://ec.europa.eu/taxation_customs/vies/
              </a>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>B) Donnees facture</CardTitle>
                <CardDescription>
                  Saisie guidee complete: identites, lignes, totaux, devise, poids, paiement et frais douaniers.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4" />
                  Ajouter ligne
                </Button>
                <Button variant="outline" size="sm" onClick={recomputeTotals}>
                  <RefreshCcw className="h-4 w-4" />
                  Recalculer HT/TTC
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Numero unique facture</Label>
                <Input
                  value={invoice.invoiceNumber}
                  onChange={(event) => updateInvoice("invoiceNumber", event.target.value)}
                  placeholder="FAC-2026-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Date emission</Label>
                <Input
                  type="date"
                  value={invoice.issueDate}
                  onChange={(event) => updateInvoice("issueDate", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Reference PO</Label>
                <Input
                  value={invoice.poReference}
                  onChange={(event) => updateInvoice("poReference", event.target.value)}
                  placeholder="PO-8842"
                />
              </div>
              <div className="space-y-1">
                <Label>Reference contrat</Label>
                <Input
                  value={invoice.contractReference}
                  onChange={(event) => updateInvoice("contractReference", event.target.value)}
                  placeholder="CTR-2026-18"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-semibold">Vendeur</p>
                <div className="space-y-1">
                  <Label>Nom</Label>
                  <Input
                    value={invoice.seller.name}
                    onChange={(event) =>
                      updateInvoice("seller", {
                        ...invoice.seller,
                        name: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Adresse</Label>
                  <Input
                    value={invoice.seller.address}
                    onChange={(event) =>
                      updateInvoice("seller", {
                        ...invoice.seller,
                        address: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>ID (SIREN / VAT / Registre)</Label>
                  <Input
                    value={invoice.seller.identifier}
                    onChange={(event) =>
                      updateInvoice("seller", {
                        ...invoice.seller,
                        identifier: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-semibold">Acheteur</p>
                <div className="space-y-1">
                  <Label>Nom</Label>
                  <Input
                    value={invoice.buyer.name}
                    onChange={(event) =>
                      updateInvoice("buyer", {
                        ...invoice.buyer,
                        name: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Adresse</Label>
                  <Input
                    value={invoice.buyer.address}
                    onChange={(event) =>
                      updateInvoice("buyer", {
                        ...invoice.buyer,
                        address: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>ID (VAT / Registre)</Label>
                  <Input
                    value={invoice.buyer.identifier}
                    onChange={(event) =>
                      updateInvoice("buyer", {
                        ...invoice.buyer,
                        identifier: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Lignes facture</p>
                <p className="text-xs text-muted-foreground">Chaque ligne: description, HS6, qty, PU, remise, valeur</p>
              </div>

              {invoice.lines.map((line, index) => {
                const autoValue = computeLineValue(line);
                return (
                  <div key={line.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Ligne {index + 1}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.id)}
                        disabled={invoice.lines.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Description</Label>
                        <Input
                          value={line.description}
                          onChange={(event) => updateLine(line.id, { description: event.target.value })}
                          placeholder="Description produit/service"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>HS6 (si connu)</Label>
                        <Input
                          value={line.hs6}
                          onChange={(event) => updateLine(line.id, { hs6: normalizeHs6(event.target.value) })}
                          placeholder="850760"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Pays origine</Label>
                        <Input
                          value={line.originCountry}
                          onChange={(event) => updateLine(line.id, { originCountry: normalizeIso2(event.target.value) })}
                          placeholder="FR"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Quantite</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={String(line.qty)}
                          onChange={(event) => updateLine(line.id, { qty: parseNumberInput(event.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Unite</Label>
                        <Input
                          value={line.unit}
                          onChange={(event) => updateLine(line.id, { unit: event.target.value })}
                          placeholder="pcs/kg/litre"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Prix unitaire</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(line.unitPrice)}
                          onChange={(event) => updateLine(line.id, { unitPrice: parseNumberInput(event.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Remise %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={String(line.discountPct)}
                          onChange={(event) => updateLine(line.id, { discountPct: parseNumberInput(event.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Valeur ligne</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={String(line.lineValue)}
                          onChange={(event) => updateLine(line.id, { lineValue: parseNumberInput(event.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Valeur auto calculee: {autoValue.toFixed(2)}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateLine(line.id, { lineValue: autoValue })}
                      >
                        Utiliser valeur auto
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Total HT</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(invoice.totals.totalHt)}
                  onChange={(event) =>
                    updateInvoice("totals", {
                      ...invoice.totals,
                      totalHt: parseNumberInput(event.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">Somme lignes actuelle: {lineTotal.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <Label>Montant TVA</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(invoice.totals.vatAmount)}
                  onChange={(event) =>
                    updateInvoice("totals", {
                      ...invoice.totals,
                      vatAmount: parseNumberInput(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Total TTC</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(invoice.totals.totalTtc)}
                  onChange={(event) =>
                    updateInvoice("totals", {
                      ...invoice.totals,
                      totalTtc: parseNumberInput(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Nombre colis</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={String(invoice.packageCount)}
                  onChange={(event) => updateInvoice("packageCount", parseNumberInput(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Poids net</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={String(invoice.netWeight)}
                  onChange={(event) => updateInvoice("netWeight", parseNumberInput(event.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Poids brut</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={String(invoice.grossWeight)}
                  onChange={(event) => updateInvoice("grossWeight", parseNumberInput(event.target.value))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Marques / numeros colis</Label>
                <Input
                  value={invoice.marksNumbers}
                  onChange={(event) => updateInvoice("marksNumbers", event.target.value)}
                  placeholder="ABX/001-012"
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-semibold">Paiement</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Echeance</Label>
                    <Input
                      type="date"
                      value={invoice.payment.dueDate}
                      onChange={(event) =>
                        updateInvoice("payment", {
                          ...invoice.payment,
                          dueDate: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>IBAN (optionnel)</Label>
                    <Input
                      value={invoice.payment.iban}
                      onChange={(event) =>
                        updateInvoice("payment", {
                          ...invoice.payment,
                          iban: event.target.value.toUpperCase().replace(/\s+/g, ""),
                        })
                      }
                      placeholder="FR76..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>BIC (optionnel)</Label>
                    <Input
                      value={invoice.payment.bic}
                      onChange={(event) =>
                        updateInvoice("payment", {
                          ...invoice.payment,
                          bic: event.target.value.toUpperCase().replace(/\s+/g, ""),
                        })
                      }
                      placeholder="BNPAFRPP"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>SWIFT (optionnel)</Label>
                    <Input
                      value={invoice.payment.swift}
                      onChange={(event) =>
                        updateInvoice("payment", {
                          ...invoice.payment,
                          swift: event.target.value.toUpperCase().replace(/\s+/g, ""),
                        })
                      }
                      placeholder="DEUTDEFF"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-semibold">Frais pour valeur en douane</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Freight</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(invoice.charges.freight)}
                      onChange={(event) =>
                        updateInvoice("charges", {
                          ...invoice.charges,
                          freight: parseNumberInput(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Insurance</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(invoice.charges.insurance)}
                      onChange={(event) =>
                        updateInvoice("charges", {
                          ...invoice.charges,
                          insurance: parseNumberInput(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Autres</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={String(invoice.charges.other)}
                      onChange={(event) =>
                        updateInvoice("charges", {
                          ...invoice.charges,
                          other: parseNumberInput(event.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>AWB (optionnel)</Label>
                <Input
                  value={invoice.documents.awb}
                  onChange={(event) =>
                    updateInvoice("documents", {
                      ...invoice.documents,
                      awb: event.target.value,
                    })
                  }
                  placeholder="020-12345675"
                />
              </div>
              <div className="space-y-1">
                <Label>B/L (optionnel)</Label>
                <Input
                  value={invoice.documents.bl}
                  onChange={(event) =>
                    updateInvoice("documents", {
                      ...invoice.documents,
                      bl: event.target.value,
                    })
                  }
                  placeholder="MSCU1234567"
                />
              </div>
              <div className="space-y-1">
                <Label>Packing list (optionnel)</Label>
                <Input
                  value={invoice.documents.packingList}
                  onChange={(event) =>
                    updateInvoice("documents", {
                      ...invoice.documents,
                      packingList: event.target.value,
                    })
                  }
                  placeholder="PL-2026-001"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>OCR / PDF (optionnel)</CardTitle>
            <CardDescription>
              L'extraction PDF/OCR n'est pas bloquante. La saisie guidee reste la source principale de validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border-2 border-dashed p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileUp className="h-4 w-4" />
                Import PDF (optionnel)
              </div>
              <div className="mt-3">
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    handlePdfUpload(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              {pdfFileName ? (
                <p className="mt-2 text-xs text-muted-foreground">Dernier fichier charge: {pdfFileName}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>C) Resultat</CardTitle>
            <CardDescription>Score global, statut et checks detailles par onglet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Score global</p>
                <p className="mt-1 text-2xl font-semibold">{assessment.score}/100</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Statut</p>
                <div className="mt-2">{statusBadge(assessment.status)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Decision TVA</p>
                <p className="mt-1 text-sm font-semibold">{assessment.vat_result.status}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Checks</p>
                <p className="mt-1 text-sm font-semibold">
                  {checkSummary.ko} KO / {checkSummary.warn} WARN / {checkSummary.ok} OK
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-sm font-semibold">TVA - raison</p>
                <p className="mt-1 text-sm text-muted-foreground">{assessment.vat_result.reason}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Mentions facture attendues</p>
                  {assessment.vat_result.required_invoice_mentions.length > 0 ? (
                    assessment.vat_result.required_invoice_mentions.map((mention) => (
                      <p key={mention} className="text-xs">
                        - {mention}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune mention specifique retournee.</p>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  VIES:{" "}
                  <a
                    className="underline"
                    href={assessment.vat_result.vies_validation.vies_link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    verifier les numeros TVA
                  </a>
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-sm font-semibold">Douane / Devise</p>
                <div className="mt-2 space-y-1">
                  {assessment.customs_usage.map((item) => (
                    <p key={item} className="text-xs text-muted-foreground">
                      - {item}
                    </p>
                  ))}
                </div>
                {assessment.fx_result.converted ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs">
                    <p>Contre-valeur EUR HT: {formatMoney(assessment.fx_result.converted.totalHtEur, "EUR")}</p>
                    <p>Contre-valeur EUR TVA: {formatMoney(assessment.fx_result.converted.vatAmountEur, "EUR")}</p>
                    <p>Contre-valeur EUR TTC: {formatMoney(assessment.fx_result.converted.totalTtcEur, "EUR")}</p>
                  </div>
                ) : null}
                {assessment.fx_result.recommendations.length > 0 ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Recommandations devise</p>
                    {assessment.fx_result.recommendations.map((item) => (
                      <p key={item} className="text-xs text-muted-foreground">
                        - {item}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {assessment.vat_result.missing_questions.length > 0 ? (
              <Alert variant="warning">
                <Info className="h-4 w-4" />
                <AlertTitle>Questions manquantes a trancher</AlertTitle>
                <AlertDescription>
                  {assessment.vat_result.missing_questions.map((question) => (
                    <p key={question}>- {question}</p>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CheckerTab)} className="space-y-3">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-6">
                {TAB_ORDER.map((tab) => {
                  const tabChecks = assessment.checks_by_tab[tab];
                  const issuesCount = tabChecks.filter((check) => check.status !== "OK").length;
                  return (
                    <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm">
                      {TAB_LABELS[tab]}
                      {issuesCount > 0 ? ` (${issuesCount})` : ""}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {TAB_ORDER.map((tab) => {
                const checks = assessment.checks_by_tab[tab];
                return (
                  <TabsContent key={tab} value={tab}>
                    {checks.length === 0 ? (
                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">Aucun check pour cet onglet.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Check</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Explication</TableHead>
                            <TableHead>Quoi corriger</TableHead>
                            <TableHead>Exemple</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {checks.map((check) => (
                            <TableRow key={`${tab}_${check.id}`}>
                              <TableCell className="font-mono text-xs">{check.id}</TableCell>
                              <TableCell className="font-medium">{check.label}</TableCell>
                              <TableCell>{checkStatusBadge(check.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{check.explanation}</TableCell>
                              <TableCell className="text-sm">{check.what_to_fix}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{check.example}</TableCell>
                              <TableCell>
                                {check.source_link ? (
                                  <a
                                    href={check.source_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs underline"
                                  >
                                    <LinkIcon className="h-3 w-3" />
                                    Ouvrir
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>

            <p className="text-xs text-muted-foreground">
              Sources officielles:{" "}
              <a className="underline" href={OFFICIAL_LINKS.douane_fr} target="_blank" rel="noreferrer">
                Douane FR
              </a>{" "}
              |{" "}
              <a className="underline" href={OFFICIAL_LINKS.incoterms_icc} target="_blank" rel="noreferrer">
                ICC Incoterms
              </a>{" "}
              |{" "}
              <a className="underline" href="https://www.impots.gouv.fr/" target="_blank" rel="noreferrer">
                impots.gouv.fr
              </a>
            </p>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Coherence docs simplifiee: AWB/B-L/Packing list controles seulement si saisis.
        </p>
      </div>
    </AppLayout>
  );
}
