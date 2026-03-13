import { isMissingTableError } from "@/domain/calc";
import { DEMO_MODE, supabase } from "@/integrations/supabase/client";

export const BUSINESS_RELATION_DIRECTIONS = ["inbound", "outbound"] as const;
export const BUSINESS_RELATION_SOURCES = ["manual", "board_request", "board_outreach", "intro_request"] as const;
export const BUSINESS_RELATION_STATUSES = ["new", "contacted", "qualified", "closed"] as const;

export type BusinessRelationDirection = (typeof BUSINESS_RELATION_DIRECTIONS)[number];
export type BusinessRelationSourceKey = (typeof BUSINESS_RELATION_SOURCES)[number];
export type BusinessRelationStatus = (typeof BUSINESS_RELATION_STATUSES)[number];
export type BusinessRelationDataSource = "server" | "demo";

export type BusinessRelation = {
  id: string;
  owner_user_id: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  direction: BusinessRelationDirection;
  relation_source: BusinessRelationSourceKey;
  relation_status: BusinessRelationStatus;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  message: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateBusinessRelationInput = {
  opportunity_id?: string | null;
  opportunity_title?: string | null;
  direction: BusinessRelationDirection;
  relation_source?: BusinessRelationSourceKey;
  relation_status?: BusinessRelationStatus;
  company_name: string;
  contact_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  message: string;
  notes?: string | null;
};

const BUSINESS_RELATIONS_MISSING_KEY = "export_navigator.business_relations_missing";
const BUSINESS_RELATIONS_MISSING_TTL_MS = 15 * 60 * 1000;
const BUSINESS_RELATIONS_LOCAL_STORAGE_KEY = "export_navigator.business_relations_local";

let businessRelationsMissingUntil: number = (() => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BUSINESS_RELATIONS_MISSING_KEY);
    const until = Number(raw || 0);
    if (!Number.isFinite(until) || until <= Date.now()) {
      window.localStorage.removeItem(BUSINESS_RELATIONS_MISSING_KEY);
      return 0;
    }
    return until;
  } catch {
    return 0;
  }
})();

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value: unknown, limit = 2000) {
  return String(value || "").trim().slice(0, limit);
}

function cleanEmail(value: unknown) {
  const normalized = cleanText(value, 254).toLowerCase();
  return normalized || null;
}

function cleanPhone(value: unknown) {
  const normalized = cleanText(value, 64);
  return normalized || null;
}

function sortByNewest(items: BusinessRelation[]) {
  return [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function shouldUseDemo() {
  return DEMO_MODE || businessRelationsMissingUntil > Date.now();
}

function markMissing() {
  businessRelationsMissingUntil = Date.now() + BUSINESS_RELATIONS_MISSING_TTL_MS;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUSINESS_RELATIONS_MISSING_KEY, String(businessRelationsMissingUntil));
  } catch {
    // ignore storage failures
  }
}

function markPresent() {
  if (DEMO_MODE) return;
  businessRelationsMissingUntil = 0;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BUSINESS_RELATIONS_MISSING_KEY);
  } catch {
    // ignore storage failures
  }
}

function mapBusinessRelationRow(row: unknown): BusinessRelation | null {
  if (!row || typeof row !== "object") return null;
  const source = row as Record<string, unknown>;
  const direction = cleanText(source.direction) as BusinessRelationDirection;
  const relationSource = cleanText(source.relation_source) as BusinessRelationSourceKey;
  const relationStatus = cleanText(source.relation_status) as BusinessRelationStatus;

  if (!BUSINESS_RELATION_DIRECTIONS.includes(direction)) return null;
  if (!BUSINESS_RELATION_SOURCES.includes(relationSource)) return null;
  if (!BUSINESS_RELATION_STATUSES.includes(relationStatus)) return null;

  return {
    id: cleanText(source.id) || `relation-${Math.random().toString(36).slice(2)}`,
    owner_user_id: cleanText(source.owner_user_id) || null,
    opportunity_id: cleanText(source.opportunity_id) || null,
    opportunity_title: cleanText(source.opportunity_title) || null,
    direction,
    relation_source: relationSource,
    relation_status: relationStatus,
    company_name: cleanText(source.company_name, 200),
    contact_name: cleanText(source.contact_name, 200),
    contact_email: cleanEmail(source.contact_email),
    contact_phone: cleanPhone(source.contact_phone),
    message: cleanText(source.message, 4000),
    notes: cleanText(source.notes, 2000) || null,
    created_at: cleanText(source.created_at) || nowIso(),
    updated_at: cleanText(source.updated_at) || cleanText(source.created_at) || nowIso(),
  };
}

function readLocalRelations() {
  if (typeof window === "undefined") return [] as BusinessRelation[];
  try {
    const raw = window.localStorage.getItem(BUSINESS_RELATIONS_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortByNewest(
      parsed
        .map((item) => mapBusinessRelationRow(item))
        .filter((item): item is BusinessRelation => item !== null)
    );
  } catch {
    return [];
  }
}

function writeLocalRelations(items: BusinessRelation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUSINESS_RELATIONS_LOCAL_STORAGE_KEY, JSON.stringify(sortByNewest(items).slice(0, 120)));
  } catch {
    // ignore storage failures
  }
}

function createDemoRelation(input: CreateBusinessRelationInput) {
  const item: BusinessRelation = {
    id: `demo-relation-${Date.now()}`,
    owner_user_id: null,
    opportunity_id: cleanText(input.opportunity_id) || null,
    opportunity_title: cleanText(input.opportunity_title, 240) || null,
    direction: input.direction,
    relation_source: input.relation_source || "manual",
    relation_status: input.relation_status || "new",
    company_name: cleanText(input.company_name, 200),
    contact_name: cleanText(input.contact_name, 200),
    contact_email: cleanEmail(input.contact_email),
    contact_phone: cleanPhone(input.contact_phone),
    message: cleanText(input.message, 4000),
    notes: cleanText(input.notes, 2000) || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const existing = readLocalRelations();
  writeLocalRelations([item, ...existing]);
  return item;
}

const demoRelations: BusinessRelation[] = [
  {
    id: "demo-relation-1",
    owner_user_id: null,
    opportunity_id: null,
    opportunity_title: "Recherche distributeur pour accessoires agro premium",
    direction: "inbound",
    relation_source: "board_request",
    relation_status: "new",
    company_name: "Delta Retail Europe",
    contact_name: "Marie Lopez",
    contact_email: "marie@delta-retail.example",
    contact_phone: null,
    message: "Nous cherchons un echange rapide pour comprendre vos conditions export Espagne + Portugal.",
    notes: "Exemple de demande entrante depuis le board public.",
    created_at: "2026-03-11T10:15:00.000Z",
    updated_at: "2026-03-11T10:15:00.000Z",
  },
  {
    id: "demo-relation-2",
    owner_user_id: null,
    opportunity_id: null,
    opportunity_title: "Partenaire distribution sante Afrique du Nord",
    direction: "outbound",
    relation_source: "board_outreach",
    relation_status: "contacted",
    company_name: "Atlas Med Export",
    contact_name: "Karim El Idrissi",
    contact_email: "karim@atlasmed.example",
    contact_phone: null,
    message: "Premier contact envoye suite a une opportunite board. Validation du positionnement en cours.",
    notes: "Exemple de contact sortant.",
    created_at: "2026-03-10T15:40:00.000Z",
    updated_at: "2026-03-10T15:40:00.000Z",
  },
];

function getDemoFeed(limit: number) {
  return sortByNewest([...readLocalRelations(), ...demoRelations]).slice(0, limit);
}

export async function listBusinessRelations(limit = 24): Promise<{
  items: BusinessRelation[];
  source: BusinessRelationDataSource;
}> {
  if (shouldUseDemo()) {
    return { items: getDemoFeed(limit), source: "demo" };
  }

  const { data, error } = await supabase
    .from("business_relations")
    .select(
      "id,owner_user_id,opportunity_id,opportunity_title,direction,relation_source,relation_status,company_name,contact_name,contact_email,contact_phone,message,notes,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      markMissing();
      return { items: getDemoFeed(limit), source: "demo" };
    }
    throw error;
  }

  markPresent();

  return {
    items: (data || [])
      .map((row) => mapBusinessRelationRow(row))
      .filter((item): item is BusinessRelation => item !== null),
    source: "server",
  };
}

export async function createBusinessRelation(input: CreateBusinessRelationInput): Promise<{
  item: BusinessRelation;
  source: BusinessRelationDataSource;
}> {
  const payload = {
    opportunity_id: cleanText(input.opportunity_id) || null,
    opportunity_title: cleanText(input.opportunity_title, 240) || null,
    direction: input.direction,
    relation_source: input.relation_source || "manual",
    relation_status: input.relation_status || "new",
    company_name: cleanText(input.company_name, 200),
    contact_name: cleanText(input.contact_name, 200),
    contact_email: cleanEmail(input.contact_email),
    contact_phone: cleanPhone(input.contact_phone),
    message: cleanText(input.message, 4000),
    notes: cleanText(input.notes, 2000) || null,
  };

  if (shouldUseDemo()) {
    return { item: createDemoRelation(payload), source: "demo" };
  }

  const { data, error } = await supabase
    .from("business_relations")
    .insert(payload)
    .select(
      "id,owner_user_id,opportunity_id,opportunity_title,direction,relation_source,relation_status,company_name,contact_name,contact_email,contact_phone,message,notes,created_at,updated_at"
    )
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      markMissing();
      return { item: createDemoRelation(payload), source: "demo" };
    }
    throw error;
  }

  markPresent();

  const item = mapBusinessRelationRow(data);
  if (!item) {
    throw new Error("Relation creee, mais reponse invalide.");
  }

  return { item, source: "server" };
}
