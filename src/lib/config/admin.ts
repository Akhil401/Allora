/**
 * Admin allow-list. Admins bypass linear unlock (all lessons open) and can be
 * granted other elevated capabilities later. Add more emails as needed, or set
 * ADMIN_EMAILS in the environment (comma-separated) to override.
 */
const DEFAULT_ADMINS = ["theancienthour59@gmail.com"];

const envAdmins = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const ADMIN_EMAILS = new Set([...DEFAULT_ADMINS, ...envAdmins].map((e) => e.toLowerCase()));

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
