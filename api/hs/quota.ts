import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "../../src/server/supabaseAdmin.js";
import { getQuotaSnapshotForRequest } from "../../src/server/hsQuota.js";

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
    });
  } catch (err: any) {
    return json(res, 500, {
      ok: false,
      error: "quota_resolve_failed",
      detail: String(err?.message || "quota resolve failed"),
    });
  }
});
