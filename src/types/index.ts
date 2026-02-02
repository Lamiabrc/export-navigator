// =======================================================
// MPL Export / Export France Facile — Domain Types
// Positionnement: outil décisionnel (costing) + conformité + veille
// =======================================================

// ---------- Shared primitives ----------
export type ISODate = string; // "YYYY-MM-DD"
export type UUID = string;

// Currency: keep simple but extensible
export type CurrencyCode =
  | "EUR"
  | "USD"
  | "GBP"
  | "CHF"
  | "CAD"
  | "JPY"
  | "CNY"
  | "AUD";

export type FlowStatus = "non_demarre" | "en_cours" | "termine" | "bloque";
export type ChecklistStatus = "ok" | "a_faire" | "na" | "bloque";

// Risk levels used by the app UI (simple and readable)
export type RiskLevel = "ok" | "a_surveiller" | "risque" | "critique";

// Important for your OM (Octroi de mer) requirement:
// - OM applies only to certain French overseas territories (DROM in your UX).
export type Zone = "FR" | "UE" | "DROM" | "Hors UE";

// Incoterms 2020 (full list). You can still restrict in UI if needed.
export type Incoterm =
  | "EXW"
  | "FCA"
  | "FAS"
  | "FOB"
  | "CFR"
  | "CIF"
  | "CPT"
  | "CIP"
  | "DAP"
  | "DPU"
  | "DDP";

export type TransportMode =
  | "Routier"
  | "Maritime"
  | "Aerien"
  | "Express"
  | "Ferroviaire"
  | "Multimodal";

export type Payer = "Fournisseur" | "Client";

// Destination codes: in practice use ISO2 (e.g. "DE", "US") or territory codes like "FR-GP"
export type Destination = string;

// Plans: used for gating (FREE / PRO / VIP)
export type Plan = "free" | "pro" | "vip";

// User roles aligned with your positioning (PME + cabinet + admin)
export type UserRole =
  | "owner" // dirigeant PME / utilisateur principal
  | "direction"
  | "adv_export"
  | "logistique"
  | "finance"
  | "consultant" // cabinet / audit MPL Export Conseil
  | "admin"
  | "viewer"; // lecture seule

// ---------- Compliance & Watch (Veille) ----------
export type ComplianceStatus = "OK" | "A_surveille" | "Risque" | "Non_verifie";

// Simple buckets; you can enrich later (dual-use / sanctions / embargo / licences…)
export type ComplianceTopic =
  | "Sanctions"
  | "Embargo"
  | "Biens_double_usage"
  | "Licence_export"
  | "Origine_preferentielle"
  | "Etiquetage"
  | "Normes_produit"
  | "Douane";

// Veille item (dynamic watch aggregation)
export interface WatchItem {
  id: UUID;
  created_at: string;
  title: string;
  source_name: string; // ex: "Douane", "Business France", "UE", "WTO/OMC"
  source_url: string;
  published_at?: string; // ISO string
  country_code?: string; // destination focus
  tags?: string[]; // ["sanctions","douane","incoterms"]
  summary?: string;
}

// ---------- Invoicing / Documents ----------
export type InvoiceType =
  | "client"
  | "transport"
  | "douane"
  | "assurance"
  | "manutention"
  | "stockage"
  | "autre";

export interface Invoice {
  id: UUID;
  flow_id?: UUID;

  type: InvoiceType;
  label: string;

  amount_ht: number;
  currency: CurrencyCode;

  date: ISODate;

  vendor?: string; // transporteur / douane / client
  file_url?: string; // chemin local ou lien
  notes?: string;
}

export type DocumentType =
  | "Facture"
  | "PackingList"
  | "Transport"
  | "Douane"
  | "CertificatOrigine"
  | "Assurance"
  | "Licence"
  | "Autre";

export interface Document {
  id: UUID;
  flow_id: UUID;

  doc_type: DocumentType;
  file_url: string;

  uploaded_at: string;
  uploaded_by: UUID;

  extracted_json?: Record<string, unknown>;
  compliance_report?: Record<string, unknown>;

  compliance_status?: ComplianceStatus;
}

// ---------- Business entities ----------
export interface Client {
  id: UUID;
  name: string;
  email?: string;
  phone?: string;

  tva_number?: string;
  address?: string;
  notes?: string;

  default_destination?: Destination;
}

// Product lines: align with HS code + sector filtering + pricing decisions
export interface ProductLine {
  id: UUID;
  hs_code: string; // e.g. "6403.99"
  description: string;

  quantity: number;
  unit?: string; // "pcs", "kg", etc.

  unit_value: number; // valeur unitaire (HT)
  currency: CurrencyCode;

  origin_country_code?: string; // ex: "FR", "DE"
  gross_weight_kg?: number;

  // compliance flags (optional, used for guidance)
  regulated?: boolean;
  compliance_topics?: ComplianceTopic[]; // e.g. ["Normes_produit","Licence_export"]
}

// Destination profile drives UI: VAT, OM, docs, risks, best practices.
// Your OM requirement is handled by zone === "DROM" and om_applicable === true.
export interface DestinationProfile {
  destination: Destination;
  zone: Zone;

  // VAT/TVA considerations (export FR -> dest)
  tva_applicable: boolean;
  tva_notes: string;

  // Octroi de mer considerations (only for DROM / territories that apply it)
  om_applicable: boolean;
  om_notes: string;

  documents_required: string[];
  common_risks: string;
  best_practices: string;

  // Optional: compliance guidance by topic
  compliance_status?: ComplianceStatus;
  compliance_notes?: string;
}

// Deductibility / accounting hints
export interface DeductibilityRule {
  zone: Zone;
  charge_type: string;

  deductible_supplier: "Oui" | "Non" | "A valider";
  deductible_client: "Oui" | "Non" | "A valider";
}

// Incoterm rules used for “who pays what” logic in costing
export interface IncotermRule {
  incoterm: Incoterm;

  payer_transport: Payer;
  payer_customs_export: Payer;
  payer_customs_import: Payer;
  payer_duties: Payer;

  payer_import_vat: Payer;
  // Octroi de mer (only meaningful if destination profile says applicable)
  payer_octroi_mer: Payer;

  notes: string;
}

// ---------- Core object: Flow (export operation) ----------
export interface Flow {
  id: UUID;
  flow_code: string;

  created_at: string;
  updated_at: string;

  created_by: UUID;

  // Company context (useful for SaaS multi-tenant if you add it)
  company_id?: UUID;

  // Client
  client_id?: UUID;
  client_name: string;

  // Decision inputs
  destination: Destination;
  zone: Zone;

  sector?: string; // nouveau: choix du secteur d’activité (UI + guidance)
  incoterm: Incoterm;
  incoterm_place: string;

  transport_mode: TransportMode;

  departure_date: ISODate;
  delivery_date: ISODate;

  // Product / goods
  product_type?: "regulated" | "standard"; // keep
  product_lines?: ProductLine[]; // nouveau: HS code + lignes
  goods_value: number; // valeur marchandise HT (fallback if product_lines absent)
  currency?: CurrencyCode; // currency for flow-level amounts (default EUR)

  weight?: number; // total kg (optional, can be derived)

  // Costing — these fields feed your “prix de revient / prix conseillé”
  cost_transport: number;
  cost_customs_clearance: number;
  cost_duties: number;
  cost_import_vat: number;

  // OM: keep but make them optional because they must appear only when applicable
  cost_octroi_mer?: number;
  cost_octroi_mer_regional?: number;

  cost_other: number;

  // Outputs (computed / advised)
  margin?: number; // % or absolute depending on your UI (document it in UI)
  prix_revient_estime?: number;
  prix_vente_conseille?: number;

  charges_fournisseur_estimees?: number;
  charges_client_estimees?: number;

  // Step statuses (pilotage opérationnel)
  status_order: FlowStatus;
  status_incoterm_validated: FlowStatus;
  status_export: FlowStatus;
  status_transport: FlowStatus;
  status_customs: FlowStatus;
  status_invoicing: FlowStatus;

  // Compliance (new positioning)
  status_compliance?: FlowStatus; // "en_cours" while checks run / user reviews
  compliance_status?: ComplianceStatus;
  compliance_topics?: ComplianceTopic[];
  compliance_notes?: string;

  // Checklists (documents)
  chk_invoice: ChecklistStatus;
  chk_packing_list: ChecklistStatus;
  chk_transport_doc: ChecklistStatus;
  chk_certificate_origin: ChecklistStatus;
  chk_insurance: ChecklistStatus;

  // Notes & risk
  comment: string;
  risk_level?: RiskLevel;

  // Optional: link to watch items saved for this flow
  watch_item_ids?: UUID[];
}

// ---------- User ----------
export interface User {
  id: UUID;
  email: string;
  name: string;

  role: UserRole;

  // new: subscription plan gating (FREE/PRO/VIP)
  plan?: Plan;
  company_id?: UUID;
}
