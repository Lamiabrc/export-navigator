import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "../../src/server/supabaseAdmin.js";
import { getDailyLimit, getQuotaSnapshotForRequest } from "../../src/server/hsQuota.js";

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

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

  try {
    const quota = await getQuotaSnapshotForRequest(admin, req);
    return json(res, 200, {
      ok: true,
      limit: quota.limit,
      used: quota.used,
      remaining: quota.remaining,
      degraded: Boolean((quota as any).degraded),
      detail: (quota as any).degradedReason || null,
    });
  } catch (err: any) {
    const limit = getDailyLimit();
    return json(res, 200, {
      ok: true,
      limit,
      used: 0,
      remaining: limit,
      degraded: true,
      detail: `quota_resolve_failed:${String(err?.message || "unknown")}`,
    });
  }
});
