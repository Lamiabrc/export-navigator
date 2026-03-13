import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "../supabaseAdmin.js";
import { getDailyLimit, getQuotaSnapshotForRequest, insertHsSearchLog } from "../hsQuota.js";

function queryParam(req: VercelRequest, key: string) {
  const value = req.query[key];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function usedPlusOne(used: number) {
  return Number.isFinite(used) ? used + 1 : 1;
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  const q = queryParam(req, "q");
  const mode = queryParam(req, "mode").toLowerCase();
  const universe = queryParam(req, "universe") || null;
  const locale = queryParam(req, "locale") || null;

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (err: any) {
    return json(res, 500, {
      ok: false,
      error: "server_env_missing",
      detail: String(err?.message || "missing supabase env"),
    });
  }

  let quota: {
    limit: number;
    used: number;
    remaining: number;
    degraded?: boolean;
    degradedReason?: string | null;
  };
  try {
    quota = await getQuotaSnapshotForRequest(admin, req);
  } catch (err: any) {
    const limit = getDailyLimit();
    quota = {
      limit,
      used: 0,
      remaining: limit,
      degraded: true,
      degradedReason: `quota_resolve_failed:${String(err?.message || "unknown")}`,
    };
  }

  if (quota.remaining <= 0) {
    await insertHsSearchLog(admin, req, {
      query: q || "[empty]",
      universe,
      locale,
      status: "limit_reached",
    });

    return json(res, 429, {
      ok: false,
      error: "daily_limit_reached",
      limit: quota.limit,
      used: quota.used,
      remaining: 0,
      degraded: Boolean(quota.degraded),
      detail: quota.degradedReason || null,
      items: [],
    });
  }

  if (mode === "track") {
    await insertHsSearchLog(admin, req, {
      query: q || "[track-only]",
      universe,
      locale,
      status: "track_only",
    });

    const used = usedPlusOne(quota.used);
    return json(res, 200, {
      ok: true,
      items: [],
      limit: quota.limit,
      used,
      remaining: Math.max(0, quota.limit - used),
      degraded: Boolean(quota.degraded),
      detail: quota.degradedReason || null,
    });
  }

  if (q.length < 2) {
    await insertHsSearchLog(admin, req, {
      query: q || "[short-query]",
      universe,
      locale,
      status: "short_query",
    });

    const used = usedPlusOne(quota.used);
    return json(res, 200, {
      ok: true,
      items: [],
      limit: quota.limit,
      used,
      remaining: Math.max(0, quota.limit - used),
      degraded: Boolean(quota.degraded),
      detail: quota.degradedReason || null,
    });
  }

  const { data, error } = await admin.rpc("mpl_search_hs", { q, lim: 12 });
  if (error) {
    await insertHsSearchLog(admin, req, {
      query: q,
      universe,
      locale,
      status: "search_error",
    });

    return json(res, 500, {
      ok: false,
      error: "hs_search_failed",
      detail: error.message,
    });
  }

  await insertHsSearchLog(admin, req, {
    query: q,
    universe,
    locale,
    status: "ok",
  });

  const used = usedPlusOne(quota.used);
  return json(res, 200, {
    ok: true,
    items: (data || []).map((x: any) => ({ code: x.code, label: x.label })),
    limit: quota.limit,
    used,
    remaining: Math.max(0, quota.limit - used),
    degraded: Boolean(quota.degraded),
    detail: quota.degradedReason || null,
  });
});
