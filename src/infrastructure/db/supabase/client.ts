import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/config/env";

/**
 * Browser Supabase client for Client Components (e.g. auth forms). Uses only the
 * public anon key. Safe to run in the browser.
 */
export function createSupabaseBrowserClient() {
  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anon = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase public env vars are not configured.");
  }
  return createBrowserClient(url, anon);
}
