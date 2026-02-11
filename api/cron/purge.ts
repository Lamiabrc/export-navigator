import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, supabaseAdmin } from "../../src/server/supabaseAdmin.js";

const CRON_SECRET = (process.env.CRON_SECRET || process.env.CRON_TOKEN || "").trim();

function isAuthorized(req: VercelRequest) {
  if (!CRON_SECRET) return true;
  const header = String(req.headers["x-cron-secret"] || "").trim();
  const query = String((req.query as any)?.secret || "").trim();
  return header === CRON_SECRET || query === CRON_SECRET;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return json(res, 401, { ok: false, error: "unauthorized" });
  }

  try {
    const admin = supabaseAdmin();
    const now = new Date().toISOString();

    // Purge objectives + storage
    const { data: expiredObjectives, error: objectivesError } = await admin
      .from("objectives_uploads")
      .select("id,storage_bucket,storage_path")
      .lt("expires_at", now)
      .limit(500);

    if (objectivesError) {
      console.error("[cron/purge] objectives select", objectivesError);
    }

    if (expiredObjectives?.length) {
      const byBucket = new Map<string, string[]>();
      for (const row of expiredObjectives) {
        const bucket = row.storage_bucket || "objectives";
        const list = byBucket.get(bucket) || [];
        list.push(row.storage_path);
        byBucket.set(bucket, list);
      }

      for (const [bucket, paths] of byBucket.entries()) {
        await admin.storage.from(bucket).remove(paths);
      }

      await admin
        .from("objectives_uploads")
        .delete()
        .in("id", expiredObjectives.map((r) => r.id));
    }

    const { error: toolError } = await admin.from("tool_runs").delete().lt("expires_at", now);
    if (toolError) console.error("[cron/purge] tool_runs", toolError);

    const { error: gngError } = await admin.from("go_no_go_assessments").delete().lt("expires_at", now);
    if (gngError) console.error("[cron/purge] go_no_go", gngError);

    return json(res, 200, {
      ok: true,
      purged: {
        objectives: expiredObjectives?.length || 0,
      },
    });
  } catch (err: any) {
    console.error("[cron/purge] error", err?.message || err);
    return json(res, 500, { ok: false, error: err?.message || "purge_failed" });
  }
}
