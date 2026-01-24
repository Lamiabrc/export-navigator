export type LeadPayload = {
  email: string;
  consent: boolean;
  simulationId?: string | null;
  metadata?: Record<string, unknown>;
};

export type LeadResponse = {
  ok: boolean;
  leadId?: string | null;
};

export type PdfPayload = {
  title?: string;
  email?: string;
  destination?: string;
  incoterm?: string;
  value?: number | string;
  currency?: string;
  score?: number;
  result?: {
    landedCost?: { duty: number; taxes: number; total: number; currency: string };
  };
  lines?: Array<{ description?: string; qty?: number; price?: number; hs?: string }>;
};

export type AlertsResponse = {
  updatedAt: string;
  alerts: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    country?: string | null;
    hsPrefix?: string | null;
    detectedAt?: string | null;
    source?: string | null;
  }>;
};

export type PrefsPayload = {
  email: string;
  countries: string[];
  hsCodes: string[];
};

export async function postLead(payload: LeadPayload): Promise<LeadResponse> {
  const res = await fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "lead failed");
  return data as LeadResponse;
}

export async function postPdf(payload: PdfPayload): Promise<Blob> {
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "pdf failed");
  }
  return await res.blob();
}

export async function getAlerts(email?: string): Promise<AlertsResponse> {
  const qs = email ? `?email=${encodeURIComponent(email)}` : "";
  const res = await fetch(`/api/alerts${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "alerts failed");
  return data as AlertsResponse;
}

export async function postPrefs(payload: PrefsPayload): Promise<{ ok: boolean }> {
  const res = await fetch("/api/prefs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "prefs failed");
  return data as { ok: boolean };
}
