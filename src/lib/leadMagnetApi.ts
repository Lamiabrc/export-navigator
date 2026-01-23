export type EstimateRequest = {
  productText?: string;
  hsInput?: string;
  destination?: string;
  incoterm?: string;
  value?: number;
  currency?: string;
  transportMode?: string;
  weightKg?: number | null;
  insurance?: number | null;
};

export type EstimateResponse = {
  simulationId?: string | null;
  landedCost: {
    duty: number;
    taxes: number;
    total: number;
    currency: string;
    dutyRate?: number;
    vatRate?: number;
  };
  docs: string[];
  risks: Array<{ title: string; level: "low" | "medium" | "high"; message: string }>;
  updatedAt: string;
  disclaimer: string;
};

export type LeadRequest = {
  email: string;
  consent: boolean;
  simulationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type LeadResponse = {
  ok: boolean;
  leadId?: string | null;
};

export type PrefsRequest = {
  email: string;
  countries: string[];
  hsCodes: string[];
};

export type AlertsResponse = {
  updatedAt: string;
  alerts: Array<{
    id: string;
    title: string;
    message: string;
    severity: "low" | "medium" | "high";
    country?: string | null;
    hsPrefix?: string | null;
    detectedAt?: string | null;
  }>;
};

export async function postEstimate(payload: EstimateRequest): Promise<EstimateResponse> {
  const res = await fetch("/api/estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postLead(payload: LeadRequest): Promise<LeadResponse> {
  const res = await fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postPrefs(payload: PrefsRequest): Promise<{ ok: boolean }> {
  const res = await fetch("/api/prefs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAlerts(email?: string | null): Promise<AlertsResponse> {
  const qs = email ? `?email=${encodeURIComponent(email)}` : "";
  const res = await fetch(`/api/alerts${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postPdf(payload: Record<string, unknown>): Promise<Blob> {
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}
