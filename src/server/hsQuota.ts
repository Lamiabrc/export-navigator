import type { VercelRequest } from "@vercel/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAILY_LIMIT = 30;

type LogStatus =
  | "ok"
  | "track_only"
  | "short_query"
  | "limit_reached"
  | "search_error"
  | "env_error";

function readHeader(req: VercelRequest, key: string) {
  const value = req.headers[key];
  if (Array.isArray(value)) return String(value[0] || "");
  return typeof value === "string" ? value : "";
}

function normalizeIp(raw: string) {
  const cleaned = raw.trim();
  if (!cleaned) return "";
  const first = cleaned.split(",")[0]?.trim() || "";
  if (!first) return "";
  if (first.startsWith("::ffff:")) return first.slice(7);
  return first;
}

export function getClientIp(req: VercelRequest) {
  const forwardedFor = normalizeIp(readHeader(req, "x-forwarded-for"));
  if (forwardedFor) return forwardedFor;

  const realIp = normalizeIp(readHeader(req, "x-real-ip"));
  if (realIp) return realIp;

  const socketIp = normalizeIp(String(req.socket?.remoteAddress || ""));
  if (socketIp) return socketIp;

  return "0.0.0.0";
}

export function getDailyLimit() {
  const parsed = Number((process.env.FREE_DAILY_LIMIT || "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAILY_LIMIT;
  return Math.floor(parsed);
}

export function getIpHashFromRequest(req: VercelRequest) {
  const pepper = String(process.env.IP_HASH_PEPPER || "").trim();
  if (!pepper) throw new Error("missing_env_IP_HASH_PEPPER");

  const ip = getClientIp(req);
  return createHash("sha256").update(`${ip}:${pepper}`).digest("hex");
}

export function getUserAgent(req: VercelRequest) {
  return readHeader(req, "user-agent").slice(0, 512) || null;
}

export async function getQuotaSnapshotForRequest(admin: SupabaseClient, req: VercelRequest) {
  const ipHash = getIpHashFromRequest(req);
  const limit = getDailyLimit();
  const since = new Date(Date.now() - ONE_DAY_MS).toISOString();

  const { count, error } = await admin
    .from("hs_search_logs")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if (error) {
    throw new Error(`quota_count_failed:${error.message}`);
  }

  const used = Number(count || 0);
  return {
    ipHash,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

export async function insertHsSearchLog(
  admin: SupabaseClient,
  req: VercelRequest,
  payload: {
    query: string;
    universe?: string | null;
    locale?: string | null;
    status: LogStatus | string;
  }
) {
  const ipHash = getIpHashFromRequest(req);
  const userAgent = getUserAgent(req);

  const { error } = await admin.from("hs_search_logs").insert({
    ip_hash: ipHash,
    user_agent: userAgent,
    query: String(payload.query || "").slice(0, 1000),
    universe: payload.universe ? String(payload.universe).slice(0, 64) : null,
    locale: payload.locale ? String(payload.locale).slice(0, 32) : null,
    status: String(payload.status || "ok").slice(0, 32),
  });

  if (error) {
    throw new Error(`hs_search_log_insert_failed:${error.message}`);
  }
}
