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
  activityLabel?: string;
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

export type PrefsResponse = {
  ok: boolean;
  mode: "remote" | "local";
  warning?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text || "invalid json" };
  }
}

function normalizePrefsPayload(payload: PrefsPayload): PrefsPayload {
  const email = String(payload.email || "").trim().toLowerCase();
  const countries = Array.from(
    new Set(
      (payload.countries || [])
        .map((item) => String(item || "").trim().toUpperCase())
        .filter((item) => /^[A-Z]{2}$/.test(item))
    )
  );
  const hsCodes = Array.from(
    new Set(
      (payload.hsCodes || [])
        .map((item) => String(item || "").replace(/[^0-9]/g, "").trim())
        .filter(Boolean)
    )
  );
  return { email, countries, hsCodes };
}

function shouldFallbackToLocalPrefs(errorMessage: string) {
  const text = String(errorMessage || "").toLowerCase();
  if (!text) return false;
  return (
    text.includes("missing supabase env vars") ||
    text.includes("supabase_url") ||
    text.includes("service_role") ||
    text.includes("supabase_service_role_key")
  );
}

function persistPrefsLocally(payload: PrefsPayload, warning?: string): PrefsResponse {
  const normalized = normalizePrefsPayload(payload);

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mpl_lead_email", normalized.email);
      window.localStorage.setItem(
        "mpl_watch_prefs",
        JSON.stringify({
          countries: normalized.countries,
          hsCodes: normalized.hsCodes,
        })
      );

      const rawUserPrefs = window.localStorage.getItem("mpl_user_prefs");
      const parsedUserPrefs =
        rawUserPrefs && rawUserPrefs.trim()
          ? (() => {
              try {
                return JSON.parse(rawUserPrefs) as Record<string, unknown>;
              } catch {
                return {};
              }
            })()
          : {};

      const nextUserPrefs = {
        ...parsedUserPrefs,
        countries: normalized.countries,
        hsCodes: normalized.hsCodes,
        hsMode: normalized.hsCodes.length ? "products" : "general_conditions",
      };

      window.localStorage.setItem("mpl_user_prefs", JSON.stringify(nextUserPrefs));
    }
  } catch {
    // no-op: on garde un retour succes local pour eviter une UX bloquante
  }

  return {
    ok: true,
    mode: "local",
    warning:
      warning ||
      "Preferences enregistrees localement. La synchronisation serveur reprendra quand Supabase sera configure.",
  };
}

export async function postLead(payload: LeadPayload): Promise<LeadResponse> {
  const res = await fetch("/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);
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
    const data = await safeJson(res);
    throw new Error(data?.error || "pdf failed");
  }

  return await res.blob();
}

export async function getAlerts(email?: string): Promise<AlertsResponse> {
  const qs = email ? `?email=${encodeURIComponent(email)}` : "";
  const res = await fetch(`/api/alerts${qs}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error || "alerts failed");
  return data as AlertsResponse;
}

export async function postPrefs(payload: PrefsPayload): Promise<PrefsResponse> {
  const normalized = normalizePrefsPayload(payload);

  if (!normalized.email) {
    throw new Error("email_required");
  }

  try {
    const res = await fetch("/api/prefs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(normalized),
    });

    const data = await safeJson(res);
    const apiError = String(data?.error || data?.message || "").trim();

    if (!res.ok) {
      if (res.status >= 500 || res.status === 404 || shouldFallbackToLocalPrefs(apiError)) {
        return persistPrefsLocally(normalized, apiError || `prefs_unavailable_${res.status}`);
      }
      throw new Error(apiError || "prefs failed");
    }

    if (data?.ok === false) {
      if (shouldFallbackToLocalPrefs(apiError)) {
        return persistPrefsLocally(normalized, apiError);
      }
      throw new Error(apiError || "prefs failed");
    }

    return { ok: true, mode: "remote" };
  } catch (err) {
    const message = String((err as { message?: string })?.message || "");
    if (shouldFallbackToLocalPrefs(message) || /failed to fetch|networkerror/i.test(message)) {
      return persistPrefsLocally(normalized, message || "network_unavailable");
    }
    throw err;
  }
}
