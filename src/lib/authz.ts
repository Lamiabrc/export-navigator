import type { User } from "@supabase/supabase-js";

const DEFAULT_ADMIN_EMAILS = ["lamia.brechet@outlook.fr"];

function parseAdminEmails() {
  const raw = String((import.meta as any)?.env?.VITE_ADMIN_EMAILS || "").trim();
  const configured = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS, ...configured]);
}

export function isAdminUser(user: User | null | undefined) {
  if (!user) return false;

  const emails = parseAdminEmails();
  const email = String(user.email || "").toLowerCase();
  const appRole = String((user.app_metadata as any)?.role || "").toLowerCase();
  const userRole = String((user.user_metadata as any)?.role || "").toLowerCase();
  const appAdminFlag = (user.app_metadata as any)?.is_admin;
  const userAdminFlag = (user.user_metadata as any)?.is_admin;

  return emails.has(email) || appRole === "admin" || userRole === "admin" || appAdminFlag === true || userAdminFlag === true;
}
