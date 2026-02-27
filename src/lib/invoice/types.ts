export type CheckStatus = "OK" | "WARN" | "KO";

export type CheckerTab =
  | "mentions"
  | "vat"
  | "customs"
  | "fx"
  | "calculs"
  | "risks";

export type GoodsOrServices = "goods" | "services";

export type FlowDirection = "import" | "export" | "auto";

export type CheckerStatus = "OK" | "WARNING" | "BLOCKING";

export type PartyIdentity = {
  name: string;
  address: string;
  identifier: string;
};

export type InvoiceLineInput = {
  id: string;
  description: string;
  hs6: string;
  originCountry: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discountPct: number;
  lineValue: number;
};

export type InvoiceTotals = {
  totalHt: number;
  vatAmount: number;
  totalTtc: number;
};

export type InvoiceCharges = {
  freight: number;
  insurance: number;
  other: number;
};

export type InvoicePayment = {
  dueDate: string;
  iban: string;
  bic: string;
  swift: string;
};

export type InvoiceDocuments = {
  awb: string;
  bl: string;
  packingList: string;
};

export type InvoiceData = {
  invoiceNumber: string;
  issueDate: string;
  poReference: string;
  contractReference: string;
  seller: PartyIdentity;
  buyer: PartyIdentity;
  lines: InvoiceLineInput[];
  totals: InvoiceTotals;
  netWeight: number;
  grossWeight: number;
  packageCount: number;
  marksNumbers: string;
  payment: InvoicePayment;
  charges: InvoiceCharges;
  documents: InvoiceDocuments;
};

export type TransactionContext = {
  goodsOrServices: GoodsOrServices;
  flowDirection: FlowDirection;
  sellerCountry: string;
  buyerCountry: string;
  buyerIsTaxable: boolean;
  sellerVat: string;
  buyerVat: string;
  currency: string;
  exchangeRate: number | null;
  incoterm: string;
  incotermPlace: string;
  proofOfTransport: boolean;
};

export type CheckerItem = {
  id: string;
  label: string;
  status: CheckStatus;
  explanation: string;
  what_to_fix: string;
  example: string;
  source_link?: string;
  fieldPath?: string;
};

export type VatResultStatus =
  | "VAT_APPLIES"
  | "VAT_EXEMPT"
  | "REVERSE_CHARGE"
  | "IMPORT_VAT"
  | "UNKNOWN";

export type VatResult = {
  status: VatResultStatus;
  reason: string;
  required_invoice_mentions: string[];
  missing_questions: string[];
  vies_validation: {
    seller_format_ok: boolean;
    buyer_format_ok: boolean;
    vies_link: string;
  };
};

export type FxCheckResult = {
  checks: CheckerItem[];
  requiresExchangeRate: boolean;
  converted: {
    totalHtEur: number;
    vatAmountEur: number;
    totalTtcEur: number;
  } | null;
  recommendations: string[];
};

export type CustomsCheckResult = {
  customs_checks: CheckerItem[];
  customs_usage: string[];
};

export type InvoiceAssessment = {
  score: number;
  status: CheckerStatus;
  vat_result: VatResult;
  checks_by_tab: Record<CheckerTab, CheckerItem[]>;
  customs_usage: string[];
  fx_result: FxCheckResult;
};
