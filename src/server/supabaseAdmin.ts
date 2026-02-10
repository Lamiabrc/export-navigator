import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = (k: string) => (process.env[k] ?? "").trim();

let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  // Tolérant aux noms d'env souvent utilisés côté Vercel / front build
  const url =
    env("SUPABASE_URL") || env("VITE_SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");

  const serviceRoleKey =
    env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE") || env("SUPABASE_SERVICE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Expected SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role key)."
    );
  }

  _admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return _admin;
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

export function allowCors(
  handler: Handler,
  opts?: { origin?: string; methods?: string; headers?: string }
) {
  const origin = opts?.origin ?? "*";
  const methods = opts?.methods ?? "GET,POST,OPTIONS";
  const headers = opts?.headers ?? "Content-Type, Authorization";

  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", methods);
    res.setHeader("Access-Control-Allow-Headers", headers);
    if (origin !== "*") res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    return handler(req, res);
  };
}

export function json(res: VercelResponse, status: number, payload: unknown) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload === undefined ? "null" : JSON.stringify(payload));
}

export async function readJson<T = any>(req: VercelRequest): Promise<T> {
  // Vercel peut déjà parser le body selon le Content-Type
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      const s = req.body.trim();
      return (s ? (JSON.parse(s) as T) : ({} as T));
    }
    if (Buffer.isBuffer(req.body)) {
      const s = req.body.toString("utf-8").trim();
      return (s ? (JSON.parse(s) as T) : ({} as T));
    }
    if (typeof req.body === "object") return req.body as T;
  }

  // Sinon on lit le stream (Node runtime)
  const chunks: Buffer[] = [];
  const stream = req as unknown as NodeJS.ReadableStream;

  for await (const chunk of stream as any) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export function getIntParam(req: VercelRequest, key: string, fallback: number) {
  const q = (req.query as Record<string, string | string[] | undefined>) ?? {};
  const v = q[key];
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(String(s ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}
