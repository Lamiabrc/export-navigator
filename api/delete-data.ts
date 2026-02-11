import type { VercelRequest, VercelResponse } from "@vercel/node";
import { allowCors, json, supabaseAdmin } from "../src/server/supabaseAdmin.js";

function getBearerToken(req: VercelRequest) {
  const header = String(req.headers.authorization || "");
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function requireUser(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req);
  if (!token) {
    json(res, 401, { ok: false, error: "missing_auth_bearer" });
    return null;
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    json(res, 401, { ok: false, error: "invalid_auth", detail: error?.message || null });
    return null;
  }
  return { user: data.user, token };
}

export default allowCors(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const auth = await requireUser(req, res);
    if (!auth) return;

    const admin = supabaseAdmin();

    const { data: deletionRow } = await admin
      .from("deletion_requests")
      .insert({ user_id: auth.user.id, status: "pending" })
      .select("id")
      .maybeSingle();

    // Remove objectives files
    const { data: objectives } = await admin
      .from("objectives_uploads")
      .select("id,storage_bucket,storage_path")
      .eq("user_id", auth.user.id);

    if (objectives?.length) {
      const byBucket = new Map<string, string[]>();
      for (const row of objectives) {
        const bucket = row.storage_bucket || "objectives";
        const list = byBucket.get(bucket) || [];
        list.push(row.storage_path);
        byBucket.set(bucket, list);
      }

      for (const [bucket, paths] of byBucket.entries()) {
        await admin.storage.from(bucket).remove(paths);
      }

      await admin.from("objectives_uploads").delete().in("id", objectives.map((r) => r.id));
    }

    await admin.from("tool_runs").delete().eq("user_id", auth.user.id);
    await admin.from("go_no_go_assessments").delete().eq("user_id", auth.user.id);

    if (deletionRow?.id) {
      await admin
        .from("deletion_requests")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", deletionRow.id);
    }

    return json(res, 200, { ok: true });
  } catch (err: any) {
    console.error("[api/delete-data] error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "delete_failed" });
  }
});
