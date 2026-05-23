import { DEMO_MODE, supabase } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

export const BUSINESS_OPPORTUNITY_TYPES = [
  "buyer",
  "seller",
  "distributor",
  "partner",
  "investor",
  "service",
] as const;

export type BusinessOpportunityType = (typeof BUSINESS_OPPORTUNITY_TYPES)[number];
export type BusinessOpportunityStatus = "published" | "archived";
export type BusinessOpportunitySource = "server" | "demo";

export type BusinessOpportunity = {
  id: string;
  user_id: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  title: string;
  summary: string;
  opportunity_type: BusinessOpportunityType;
  sector: string | null;
  origin_country: string | null;
  target_country: string | null;
  website: string | null;
  status: BusinessOpportunityStatus;
  created_at: string;
  updated_at: string;
};

export type CreateBusinessOpportunityInput = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  title: string;
  summary: string;
  opportunity_type: BusinessOpportunityType;
  sector?: string | null;
  origin_country?: string | null;
  target_country?: string | null;
  website?: string | null;
};

const BUSINESS_TABLE_MISSING_KEY = "export_navigator.business_opportunities_missing";
const BUSINESS_TABLE_MISSING_TTL_MS = 15 * 60 * 1000;
const BUSINESS_LOCAL_STORAGE_KEY = "export_navigator.business_opportunities_local";
const DEFAULT_BUSINESS_ADMIN_EMAILS = ["lamia.brechet@outlook.fr"];

let businessTableMissingUntil: number = (() => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BUSINESS_TABLE_MISSING_KEY);
    const until = Number(raw || 0);
    if (!Number.isFinite(until) || until <= Date.now()) {
      window.localStorage.removeItem(BUSINESS_TABLE_MISSING_KEY);
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

function shouldUseBusinessDemo() {
  return DEMO_MODE || businessTableMissingUntil > Date.now();
}

function parseBusinessAdminEmails() {
  const raw = String((import.meta as any)?.env?.VITE_ADMIN_EMAILS || "").trim();
  const configured = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_BUSINESS_ADMIN_EMAILS, ...configured]);
}

async function assertCanManageBusinessBoard() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  const email = String(user?.email || "").toLowerCase();
  const appRole = String((user?.app_metadata as any)?.role || "").toLowerCase();
  const userRole = String((user?.user_metadata as any)?.role || "").toLowerCase();
  const adminEmails = parseBusinessAdminEmails();
  const isAdmin =
    adminEmails.has(email) ||
    appRole === "admin" ||
    userRole === "admin" ||
    (user?.app_metadata as any)?.is_admin === true ||
    (user?.user_metadata as any)?.is_admin === true;

  if (!isAdmin) {
    throw new Error("La publication d'annonces est reservee a l'administrateur MPL Export Navigator.");
  }

  return user?.id || null;
}

function markBusinessTableMissing() {
  businessTableMissingUntil = Date.now() + BUSINESS_TABLE_MISSING_TTL_MS;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUSINESS_TABLE_MISSING_KEY, String(businessTableMissingUntil));
  } catch {
    // ignore storage failures
  }
}

function markBusinessTablePresent() {
  if (DEMO_MODE) return;
  businessTableMissingUntil = 0;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BUSINESS_TABLE_MISSING_KEY);
  } catch {
    // ignore storage failures
  }
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanCountry(value: unknown) {
  const normalized = cleanText(value).toUpperCase();
  return normalized || null;
}

function cleanWebsite(value: unknown) {
  const normalized = cleanText(value);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
}

function sortByNewest(items: BusinessOpportunity[]) {
  return [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

function mapBusinessOpportunityRow(row: unknown): BusinessOpportunity | null {
  if (!row || typeof row !== "object") return null;
  const source = row as Record<string, unknown>;
  const opportunityType = cleanText(source.opportunity_type) as BusinessOpportunityType;
  if (!BUSINESS_OPPORTUNITY_TYPES.includes(opportunityType)) return null;

  return {
    id: cleanText(source.id) || `fallback-${Math.random().toString(36).slice(2)}`,
    user_id: cleanText(source.user_id) || null,
    company_name: cleanText(source.company_name),
    contact_name: cleanText(source.contact_name),
    contact_email: cleanText(source.contact_email).toLowerCase(),
    title: cleanText(source.title),
    summary: cleanText(source.summary),
    opportunity_type: opportunityType,
    sector: cleanText(source.sector) || null,
    origin_country: cleanCountry(source.origin_country),
    target_country: cleanCountry(source.target_country),
    website: cleanWebsite(source.website),
    status: cleanText(source.status) === "archived" ? "archived" : "published",
    created_at: cleanText(source.created_at) || nowIso(),
    updated_at: cleanText(source.updated_at) || cleanText(source.created_at) || nowIso(),
  };
}

function readLocalBusinessOpportunities() {
  if (typeof window === "undefined") return [] as BusinessOpportunity[];
  try {
    const raw = window.localStorage.getItem(BUSINESS_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortByNewest(
      parsed
        .map((item) => mapBusinessOpportunityRow(item))
        .filter((item): item is BusinessOpportunity => item !== null)
    );
  } catch {
    return [];
  }
}

function writeLocalBusinessOpportunities(items: BusinessOpportunity[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUSINESS_LOCAL_STORAGE_KEY, JSON.stringify(sortByNewest(items).slice(0, 100)));
  } catch {
    // ignore storage failures
  }
}

async function createDemoBusinessOpportunity(input: CreateBusinessOpportunityInput, userId: string | null) {
  const item: BusinessOpportunity = {
    id: `demo-${Date.now()}`,
    user_id: userId,
    company_name: cleanText(input.company_name),
    contact_name: cleanText(input.contact_name),
    contact_email: cleanText(input.contact_email).toLowerCase(),
    title: cleanText(input.title),
    summary: cleanText(input.summary),
    opportunity_type: input.opportunity_type,
    sector: cleanText(input.sector) || null,
    origin_country: cleanCountry(input.origin_country),
    target_country: cleanCountry(input.target_country),
    website: cleanWebsite(input.website),
    status: "published",
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const existing = readLocalBusinessOpportunities();
  writeLocalBusinessOpportunities([item, ...existing]);
  return item;
}

function archiveDemoBusinessOpportunity(id: string) {
  const existing = readLocalBusinessOpportunities();
  let archived: BusinessOpportunity | null = null;

  const nextItems = existing.map((item) => {
    if (item.id !== id || item.status === "archived") return item;
    archived = { ...item, status: "archived", updated_at: nowIso() };
    return archived;
  });

  if (!archived) return null;

  writeLocalBusinessOpportunities(nextItems);
  return archived;
}

const demoBusinessOpportunities: BusinessOpportunity[] = [
  {
    id: "demo-business-1",
    user_id: null,
    company_name: "Maison Sud France",
    contact_name: "Nadia Martin",
    contact_email: "contact@maison-sud-france.example",
    title: "Recherche distributeur au Maroc pour epicerie fine francaise",
    summary:
      "Marque francaise d'epicerie premium cherche un distributeur local pour hotels, concept stores et reseaux retail au Maroc.",
    opportunity_type: "distributor",
    sector: "Agroalimentaire",
    origin_country: "FR",
    target_country: "MA",
    website: "https://maison-sud-france.example",
    status: "published",
    created_at: "2026-03-10T09:30:00.000Z",
    updated_at: "2026-03-10T09:30:00.000Z",
  },
  {
    id: "demo-business-2",
    user_id: null,
    company_name: "Atlas Med Export",
    contact_name: "Karim El Idrissi",
    contact_email: "karim@atlasmed.example",
    title: "Importateur francais recherche fabricant textile au Maghreb",
    summary:
      "Acheteur base en France cherche un partenaire Maroc, Algerie ou Tunisie pour collections textile petites series avec controle qualite.",
    opportunity_type: "buyer",
    sector: "Textile",
    origin_country: "FR",
    target_country: "TN",
    website: "https://atlasmed.example",
    status: "published",
    created_at: "2026-03-09T14:15:00.000Z",
    updated_at: "2026-03-09T14:15:00.000Z",
  },
  {
    id: "demo-business-3",
    user_id: null,
    company_name: "Maghreb Services Export",
    contact_name: "Helene Borel",
    contact_email: "helene@maghreb-services.example",
    title: "Prestataire transit et documentation pour flux France-Algerie",
    summary:
      "Accompagnement operationnel sur documents, transport, incoterms et verification facture pour PME qui demarrent des flux France-Algerie.",
    opportunity_type: "service",
    sector: "Transit et documents",
    origin_country: "FR",
    target_country: "DZ",
    website: "https://maghreb-services.example",
    status: "published",
    created_at: "2026-03-08T11:00:00.000Z",
    updated_at: "2026-03-08T11:00:00.000Z",
  },
];

function getDemoBusinessFeed(limit: number) {
  const localItems = readLocalBusinessOpportunities().filter((item) => item.status === "published");
  return sortByNewest([...localItems, ...demoBusinessOpportunities]).slice(0, limit);
}

export async function listBusinessOpportunities(limit = 12): Promise<{
  items: BusinessOpportunity[];
  source: BusinessOpportunitySource;
}> {
  if (shouldUseBusinessDemo()) {
    return { items: getDemoBusinessFeed(limit), source: "demo" };
  }

  const { data, error } = await supabase
    .from("business_opportunities")
    .select(
      "id,user_id,company_name,contact_name,contact_email,title,summary,opportunity_type,sector,origin_country,target_country,website,status,created_at,updated_at"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      markBusinessTableMissing();
      return { items: getDemoBusinessFeed(limit), source: "demo" };
    }
    throw error;
  }

  markBusinessTablePresent();

  return {
    items: (data || [])
      .map((row) => mapBusinessOpportunityRow(row))
      .filter((item): item is BusinessOpportunity => item !== null),
    source: "server",
  };
}

export async function createBusinessOpportunity(input: CreateBusinessOpportunityInput): Promise<{
  item: BusinessOpportunity;
  source: BusinessOpportunitySource;
}> {
  const userId = await assertCanManageBusinessBoard();
  const payload = {
    company_name: cleanText(input.company_name),
    contact_name: cleanText(input.contact_name),
    contact_email: cleanText(input.contact_email).toLowerCase(),
    title: cleanText(input.title),
    summary: cleanText(input.summary),
    opportunity_type: input.opportunity_type,
    sector: cleanText(input.sector) || null,
    origin_country: cleanCountry(input.origin_country),
    target_country: cleanCountry(input.target_country),
    website: cleanWebsite(input.website),
    status: "published" as const,
  };

  if (shouldUseBusinessDemo()) {
    return { item: await createDemoBusinessOpportunity(payload, userId), source: "demo" };
  }

  const { data, error } = await supabase
    .from("business_opportunities")
    .insert(payload)
    .select(
      "id,user_id,company_name,contact_name,contact_email,title,summary,opportunity_type,sector,origin_country,target_country,website,status,created_at,updated_at"
    )
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      markBusinessTableMissing();
      return { item: await createDemoBusinessOpportunity(payload, userId), source: "demo" };
    }
    throw error;
  }

  markBusinessTablePresent();

  const item = mapBusinessOpportunityRow(data);
  if (!item) {
    throw new Error("Publication creee, mais reponse invalide.");
  }

  return { item, source: "server" };
}

export async function archiveBusinessOpportunity(id: string): Promise<{
  item: BusinessOpportunity | null;
  source: BusinessOpportunitySource;
}> {
  await assertCanManageBusinessBoard();

  if (shouldUseBusinessDemo()) {
    return { item: archiveDemoBusinessOpportunity(id), source: "demo" };
  }

  const { data, error } = await supabase
    .from("business_opportunities")
    .update({ status: "archived" })
    .eq("id", id)
    .select(
      "id,user_id,company_name,contact_name,contact_email,title,summary,opportunity_type,sector,origin_country,target_country,website,status,created_at,updated_at"
    )
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      markBusinessTableMissing();
      return { item: archiveDemoBusinessOpportunity(id), source: "demo" };
    }
    throw error;
  }

  markBusinessTablePresent();

  return { item: mapBusinessOpportunityRow(data), source: "server" };
}
