import { DEMO_MODE, supabase } from "@/integrations/supabase/client";

export type DealStage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export type CrmAccount = {
  id: string;
  name: string;
  country_iso2: string | null;
  industry: string | null;
  website: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmDeal = {
  id: string;
  title: string;
  stage: DealStage;
  amount: number;
  currency: string;
  probability: number;
  expected_close_date: string | null;
  from_country: string | null;
  to_country: string | null;
  product_text: string | null;
  incoterm: string | null;
  notes: string | null;
  account_id: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
  account_name?: string | null;
};

export type DealItem = {
  id: string;
  deal_id: string;
  line_no: number;
  product_text: string;
  hs6: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_value: number | null;
  currency: string | null;
  created_at: string;
};

export type CreateDealItemInput = {
  line_no?: number;
  product_text: string;
  hs6?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_value?: number | null;
  currency?: string | null;
};

export type DealActivity = {
  id: string;
  deal_id: string;
  activity_type: string;
  content: string;
  due_at: string | null;
  created_at: string;
};

export type DealTask = {
  id: string;
  deal_id: string | null;
  account_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type DealDetailData = {
  deal: CrmDeal | null;
  account: CrmAccount | null;
  items: DealItem[];
  activities: DealActivity[];
  tasks: DealTask[];
};

export type DashboardMetrics = {
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  winRate: number;
  avgCycleDays: number;
  weightedPipeline: number;
  topCountries: Array<{ country: string; count: number; amount: number }>;
  topProducts: Array<{ product: string; count: number; amount: number }>;
};

const DEAL_STAGES: DealStage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

function nowIso() {
  return new Date().toISOString();
}

function isMissingTableError(err: unknown) {
  const message = String((err as { message?: string } | null)?.message || "");
  const code = String((err as { code?: string } | null)?.code || "");
  return code === "42P01" || /not found|does not exist/i.test(message);
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asCurrencyCode(value: unknown, fallback = "EUR") {
  const code = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  return fallback;
}

const demoAccounts: CrmAccount[] = [
  {
    id: "demo-account-1",
    name: "Alpine Foods",
    country_iso2: "FR",
    industry: "Food",
    website: "https://example.com",
    status: "active",
    notes: "Compte demo",
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "demo-account-2",
    name: "Tokyo Retail Partners",
    country_iso2: "JP",
    industry: "Retail",
    website: null,
    status: "active",
    notes: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

let demoDeals: CrmDeal[] = [
  {
    id: "demo-deal-1",
    title: "Export bananes Japon",
    stage: "qualified",
    amount: 24000,
    currency: "EUR",
    probability: 55,
    expected_close_date: null,
    from_country: "FR",
    to_country: "JP",
    product_text: "Bananes fraiches",
    incoterm: "CIF",
    notes: null,
    account_id: "demo-account-2",
    contact_id: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    account_name: "Tokyo Retail Partners",
  },
  {
    id: "demo-deal-2",
    title: "Pieces auto vers Canada",
    stage: "proposal",
    amount: 82000,
    currency: "EUR",
    probability: 65,
    expected_close_date: null,
    from_country: "FR",
    to_country: "CA",
    product_text: "Kits freinage automobile",
    incoterm: "DAP",
    notes: null,
    account_id: "demo-account-1",
    contact_id: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    account_name: "Alpine Foods",
  },
];

const demoItems: DealItem[] = [
  {
    id: "demo-item-1",
    deal_id: "demo-deal-1",
    line_no: 1,
    product_text: "Bananes",
    hs6: "080390",
    quantity: 2000,
    unit_price: 12,
    total_value: 24000,
    currency: "EUR",
    created_at: nowIso(),
  },
];

const demoActivities: DealActivity[] = [
  {
    id: "demo-activity-1",
    deal_id: "demo-deal-1",
    activity_type: "call",
    content: "Appel de qualification avec l'acheteur.",
    due_at: null,
    created_at: nowIso(),
  },
];

const demoTasks: DealTask[] = [
  {
    id: "demo-task-1",
    deal_id: "demo-deal-1",
    account_id: "demo-account-2",
    title: "Valider Incoterm final",
    description: null,
    priority: "high",
    status: "open",
    due_at: null,
    completed_at: null,
    created_at: nowIso(),
  },
];

export const dealStageOrder: DealStage[] = DEAL_STAGES;

export async function listDeals() {
  if (DEMO_MODE) {
    return { deals: [...demoDeals], warning: "DEMO_MODE active: donnees locales." };
  }

  const { data, error } = await supabase
    .from("deals")
    .select("id,title,stage,amount,currency,probability,expected_close_date,from_country,to_country,product_text,incoterm,notes,account_id,contact_id,created_at,updated_at,account:account_id(name)")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) {
    if (isMissingTableError(error)) {
      return { deals: [...demoDeals], warning: "Tables CRM absentes: affichage demo." };
    }
    throw error;
  }

  const deals = (data || []).map((row: Record<string, unknown>) => {
    const stageRaw = String(row.stage || "new").toLowerCase() as DealStage;
    const stage = DEAL_STAGES.includes(stageRaw) ? stageRaw : "new";
    const account = row.account as { name?: string } | null;
    return {
      id: String(row.id),
      title: String(row.title || ""),
      stage,
      amount: asNumber(row.amount),
      currency: String(row.currency || "EUR"),
      probability: asNumber(row.probability, 0),
      expected_close_date: row.expected_close_date ? String(row.expected_close_date) : null,
      from_country: row.from_country ? String(row.from_country) : null,
      to_country: row.to_country ? String(row.to_country) : null,
      product_text: row.product_text ? String(row.product_text) : null,
      incoterm: row.incoterm ? String(row.incoterm) : null,
      notes: row.notes ? String(row.notes) : null,
      account_id: row.account_id ? String(row.account_id) : null,
      contact_id: row.contact_id ? String(row.contact_id) : null,
      created_at: String(row.created_at || nowIso()),
      updated_at: String(row.updated_at || nowIso()),
      account_name: account?.name ? String(account.name) : null,
    } satisfies CrmDeal;
  });

  return { deals };
}

export async function createDeal(input: {
  title: string;
  stage?: DealStage;
  amount?: number;
  currency?: string;
  probability?: number;
  from_country?: string | null;
  to_country?: string | null;
  product_text?: string | null;
  incoterm?: string | null;
  account_id?: string | null;
  notes?: string | null;
}) {
  const createDemoDeal = () => {
    const id = `demo-deal-${Math.random().toString(36).slice(2, 10)}`;
    const created: CrmDeal = {
      id,
      title: input.title,
      stage: input.stage || "new",
      amount: asNumber(input.amount),
      currency: input.currency || "EUR",
      probability: asNumber(input.probability, 20),
      expected_close_date: null,
      from_country: input.from_country || "FR",
      to_country: input.to_country || null,
      product_text: input.product_text || null,
      incoterm: input.incoterm || null,
      notes: input.notes || null,
      account_id: input.account_id || null,
      contact_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      account_name: demoAccounts.find((account) => account.id === input.account_id)?.name || null,
    };
    demoDeals = [created, ...demoDeals];
    return created;
  };

  if (DEMO_MODE) {
    return createDemoDeal();
  }

  const payload = {
    title: input.title,
    stage: input.stage || "new",
    amount: asNumber(input.amount),
    currency: input.currency || "EUR",
    probability: asNumber(input.probability, 20),
    from_country: input.from_country || "FR",
    to_country: input.to_country || null,
    product_text: input.product_text || null,
    incoterm: input.incoterm || null,
    account_id: input.account_id || null,
    notes: input.notes || null,
  };

  const { data, error } = await supabase.from("deals").insert(payload).select("*").single();
  if (error) {
    if (isMissingTableError(error)) return createDemoDeal();
    throw error;
  }
  return {
    id: String(data.id),
    title: String(data.title || ""),
    stage: (String(data.stage || "new").toLowerCase() as DealStage) || "new",
    amount: asNumber(data.amount),
    currency: String(data.currency || "EUR"),
    probability: asNumber(data.probability),
    expected_close_date: data.expected_close_date ? String(data.expected_close_date) : null,
    from_country: data.from_country ? String(data.from_country) : null,
    to_country: data.to_country ? String(data.to_country) : null,
    product_text: data.product_text ? String(data.product_text) : null,
    incoterm: data.incoterm ? String(data.incoterm) : null,
    notes: data.notes ? String(data.notes) : null,
    account_id: data.account_id ? String(data.account_id) : null,
    contact_id: data.contact_id ? String(data.contact_id) : null,
    created_at: String(data.created_at || nowIso()),
    updated_at: String(data.updated_at || nowIso()),
  } satisfies CrmDeal;
}

export async function createDealItems(dealId: string, items: CreateDealItemInput[]) {
  const normalized = (items || [])
    .map((item, index) => {
      const quantity = asNullableNumber(item.quantity);
      const unitPrice = asNullableNumber(item.unit_price);
      const totalValueRaw = asNullableNumber(item.total_value);
      const totalValue =
        totalValueRaw !== null
          ? totalValueRaw
          : quantity !== null && unitPrice !== null
          ? Number((quantity * unitPrice).toFixed(2))
          : null;

      const lineNo = Number.isFinite(Number(item.line_no))
        ? Math.max(1, Math.trunc(Number(item.line_no)))
        : index + 1;

      const productText = String(item.product_text || "").trim();
      const hs6Raw = String(item.hs6 || "").replace(/[^0-9]/g, "");

      return {
        line_no: lineNo,
        product_text: productText,
        hs6: hs6Raw ? hs6Raw.slice(0, 6) : null,
        quantity,
        unit_price: unitPrice,
        total_value: totalValue,
        currency: asCurrencyCode(item.currency || "EUR", "EUR"),
      };
    })
    .filter((item) => item.product_text.length > 0 || item.total_value !== null);

  if (!normalized.length) return [] as DealItem[];

  const createDemoItems = () => {
    const now = nowIso();
    const created = normalized.map((item, index) => ({
      id: `demo-item-${Math.random().toString(36).slice(2, 10)}-${index}`,
      deal_id: dealId,
      line_no: item.line_no,
      product_text: item.product_text || "-",
      hs6: item.hs6,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_value: item.total_value,
      currency: item.currency,
      created_at: now,
    })) satisfies DealItem[];
    demoItems.push(...created);
    return created;
  };

  if (DEMO_MODE) {
    return createDemoItems();
  }

  const payload = normalized.map((item) => ({
    deal_id: dealId,
    line_no: item.line_no,
    product_text: item.product_text || "-",
    hs6: item.hs6,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_value: item.total_value,
    currency: item.currency,
  }));

  const { data, error } = await supabase
    .from("deal_items")
    .insert(payload)
    .select("id,deal_id,line_no,product_text,hs6,quantity,unit_price,total_value,currency,created_at")
    .order("line_no", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return createDemoItems();
    throw error;
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    deal_id: String(row.deal_id),
    line_no: asNumber(row.line_no, 1),
    product_text: String(row.product_text || ""),
    hs6: row.hs6 ? String(row.hs6) : null,
    quantity: row.quantity === null ? null : asNumber(row.quantity),
    unit_price: row.unit_price === null ? null : asNumber(row.unit_price),
    total_value: row.total_value === null ? null : asNumber(row.total_value),
    currency: row.currency ? String(row.currency) : null,
    created_at: String(row.created_at || nowIso()),
  })) as DealItem[];
}

export async function updateDeal(
  dealId: string,
  patch: Partial<Pick<CrmDeal, "title" | "stage" | "amount" | "currency" | "probability" | "from_country" | "to_country" | "product_text" | "incoterm" | "notes">>
) {
  if (DEMO_MODE) {
    demoDeals = demoDeals.map((deal) =>
      deal.id === dealId
        ? {
            ...deal,
            ...patch,
            updated_at: nowIso(),
          }
        : deal
    );
    return demoDeals.find((deal) => deal.id === dealId) || null;
  }

  const { data, error } = await supabase.from("deals").update(patch).eq("id", dealId).select("*").single();
  if (error) throw error;
  return {
    id: String(data.id),
    title: String(data.title || ""),
    stage: (String(data.stage || "new").toLowerCase() as DealStage) || "new",
    amount: asNumber(data.amount),
    currency: String(data.currency || "EUR"),
    probability: asNumber(data.probability),
    expected_close_date: data.expected_close_date ? String(data.expected_close_date) : null,
    from_country: data.from_country ? String(data.from_country) : null,
    to_country: data.to_country ? String(data.to_country) : null,
    product_text: data.product_text ? String(data.product_text) : null,
    incoterm: data.incoterm ? String(data.incoterm) : null,
    notes: data.notes ? String(data.notes) : null,
    account_id: data.account_id ? String(data.account_id) : null,
    contact_id: data.contact_id ? String(data.contact_id) : null,
    created_at: String(data.created_at || nowIso()),
    updated_at: String(data.updated_at || nowIso()),
  } satisfies CrmDeal;
}

export async function getDealDetail(dealId: string): Promise<DealDetailData> {
  if (DEMO_MODE) {
    const deal = demoDeals.find((entry) => entry.id === dealId) || null;
    const account = deal?.account_id ? demoAccounts.find((entry) => entry.id === deal.account_id) || null : null;
    return {
      deal,
      account,
      items: demoItems.filter((item) => item.deal_id === dealId),
      activities: demoActivities.filter((activity) => activity.deal_id === dealId),
      tasks: demoTasks.filter((task) => task.deal_id === dealId),
    };
  }

  const [dealRes, itemRes, activityRes, taskRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id,title,stage,amount,currency,probability,expected_close_date,from_country,to_country,product_text,incoterm,notes,account_id,contact_id,created_at,updated_at,account:account_id(*)")
      .eq("id", dealId)
      .maybeSingle(),
    supabase.from("deal_items").select("id,deal_id,line_no,product_text,hs6,quantity,unit_price,total_value,currency,created_at").eq("deal_id", dealId).order("line_no", { ascending: true }),
    supabase.from("deal_activities").select("id,deal_id,activity_type,content,due_at,created_at").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(40),
    supabase.from("tasks").select("id,deal_id,account_id,title,description,priority,status,due_at,completed_at,created_at").eq("deal_id", dealId).order("created_at", { ascending: false }).limit(40),
  ]);

  if (dealRes.error) {
    if (isMissingTableError(dealRes.error)) {
      const deal = demoDeals.find((entry) => entry.id === dealId) || null;
      const account = deal?.account_id ? demoAccounts.find((entry) => entry.id === deal.account_id) || null : null;
      return {
        deal,
        account,
        items: demoItems.filter((item) => item.deal_id === dealId),
        activities: demoActivities.filter((activity) => activity.deal_id === dealId),
        tasks: demoTasks.filter((task) => task.deal_id === dealId),
      };
    }
    throw dealRes.error;
  }
  if (itemRes.error && !isMissingTableError(itemRes.error)) throw itemRes.error;
  if (activityRes.error && !isMissingTableError(activityRes.error)) throw activityRes.error;
  if (taskRes.error && !isMissingTableError(taskRes.error)) throw taskRes.error;

  const dealRow = dealRes.data as Record<string, unknown> | null;
  const account = (dealRow?.account as CrmAccount | null) || null;
  const deal = dealRow
    ? ({
        id: String(dealRow.id),
        title: String(dealRow.title || ""),
        stage: (String(dealRow.stage || "new").toLowerCase() as DealStage) || "new",
        amount: asNumber(dealRow.amount),
        currency: String(dealRow.currency || "EUR"),
        probability: asNumber(dealRow.probability),
        expected_close_date: dealRow.expected_close_date ? String(dealRow.expected_close_date) : null,
        from_country: dealRow.from_country ? String(dealRow.from_country) : null,
        to_country: dealRow.to_country ? String(dealRow.to_country) : null,
        product_text: dealRow.product_text ? String(dealRow.product_text) : null,
        incoterm: dealRow.incoterm ? String(dealRow.incoterm) : null,
        notes: dealRow.notes ? String(dealRow.notes) : null,
        account_id: dealRow.account_id ? String(dealRow.account_id) : null,
        contact_id: dealRow.contact_id ? String(dealRow.contact_id) : null,
        created_at: String(dealRow.created_at || nowIso()),
        updated_at: String(dealRow.updated_at || nowIso()),
        account_name: account?.name || null,
      } satisfies CrmDeal)
    : null;

  const safeItems = isMissingTableError(itemRes.error) ? [] : itemRes.data || [];
  const safeActivities = isMissingTableError(activityRes.error) ? [] : activityRes.data || [];
  const safeTasks = isMissingTableError(taskRes.error) ? [] : taskRes.data || [];

  const items: DealItem[] = safeItems.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    deal_id: String(row.deal_id),
    line_no: asNumber(row.line_no, 1),
    product_text: String(row.product_text || ""),
    hs6: row.hs6 ? String(row.hs6) : null,
    quantity: row.quantity === null ? null : asNumber(row.quantity),
    unit_price: row.unit_price === null ? null : asNumber(row.unit_price),
    total_value: row.total_value === null ? null : asNumber(row.total_value),
    currency: row.currency ? String(row.currency) : null,
    created_at: String(row.created_at || nowIso()),
  }));

  const activities: DealActivity[] = safeActivities.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    deal_id: String(row.deal_id),
    activity_type: String(row.activity_type || "note"),
    content: String(row.content || ""),
    due_at: row.due_at ? String(row.due_at) : null,
    created_at: String(row.created_at || nowIso()),
  }));

  const tasks: DealTask[] = safeTasks.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    deal_id: row.deal_id ? String(row.deal_id) : null,
    account_id: row.account_id ? String(row.account_id) : null,
    title: String(row.title || ""),
    description: row.description ? String(row.description) : null,
    priority: String(row.priority || "normal"),
    status: String(row.status || "open"),
    due_at: row.due_at ? String(row.due_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_at: String(row.created_at || nowIso()),
  }));

  return { deal, account, items, activities, tasks };
}

function daysBetween(fromIso: string, toIso: string) {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) return 0;
  return Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)));
}

export function buildDashboardMetrics(deals: CrmDeal[]): DashboardMetrics {
  const wonDeals = deals.filter((deal) => deal.stage === "won");
  const lostDeals = deals.filter((deal) => deal.stage === "lost");
  const openDeals = deals.filter((deal) => !["won", "lost"].includes(deal.stage));

  const closedDeals = deals.filter((deal) => ["won", "lost"].includes(deal.stage));
  const avgCycleDays = closedDeals.length
    ? Math.round(
        closedDeals.reduce((sum, deal) => sum + daysBetween(deal.created_at, deal.updated_at), 0) / Math.max(1, closedDeals.length)
      )
    : 0;

  const winRate = closedDeals.length ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0;
  const weightedPipeline = openDeals.reduce((sum, deal) => sum + (deal.amount * Math.max(0, deal.probability)) / 100, 0);

  const countryMap = new Map<string, { country: string; count: number; amount: number }>();
  for (const deal of deals) {
    const key = deal.to_country || "WORLD";
    const existing = countryMap.get(key) || { country: key, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += deal.amount || 0;
    countryMap.set(key, existing);
  }

  const productMap = new Map<string, { product: string; count: number; amount: number }>();
  for (const deal of deals) {
    const key = (deal.product_text || "N/A").trim() || "N/A";
    const existing = productMap.get(key) || { product: key, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += deal.amount || 0;
    productMap.set(key, existing);
  }

  return {
    totalDeals: deals.length,
    openDeals: openDeals.length,
    wonDeals: wonDeals.length,
    lostDeals: lostDeals.length,
    winRate,
    avgCycleDays,
    weightedPipeline,
    topCountries: Array.from(countryMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    topProducts: Array.from(productMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
  };
}

export async function listAccountsForSelect() {
  if (DEMO_MODE) return [...demoAccounts];
  const { data, error } = await supabase.from("accounts").select("id,name,country_iso2,industry,website,status,notes,created_at,updated_at").order("updated_at", { ascending: false }).limit(200);
  if (error) {
    if (isMissingTableError(error)) return [...demoAccounts];
    throw error;
  }
  return (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name || ""),
    country_iso2: row.country_iso2 ? String(row.country_iso2) : null,
    industry: row.industry ? String(row.industry) : null,
    website: row.website ? String(row.website) : null,
    status: String(row.status || "active"),
    notes: row.notes ? String(row.notes) : null,
    created_at: String(row.created_at || nowIso()),
    updated_at: String(row.updated_at || nowIso()),
  })) as CrmAccount[];
}
