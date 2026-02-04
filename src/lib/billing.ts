import { supabase } from "@/lib/supabase";

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) return null;
  return data.session.access_token;
}

export async function startOnlineCheckout() {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const resp = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || "Checkout failed");
  }

  const data = (await resp.json()) as { url?: string };
  if (!data.url) throw new Error("Missing checkout URL");
  window.location.href = data.url;
}

export async function openBillingPortal() {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");

  const resp = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || "Portal session failed");
  }

  const data = (await resp.json()) as { url?: string };
  if (!data.url) throw new Error("Missing portal URL");
  window.location.href = data.url;
}
