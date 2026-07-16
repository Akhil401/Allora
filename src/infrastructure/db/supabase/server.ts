import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/config/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Request-scoped Supabase client for Server Components, Server Actions and Route
 * Handlers. Bound to the user's session cookies, so every query runs AS THE
 * USER and Row-Level Security enforces isolation automatically.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anon = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // set() throws in Server Components; the middleware refreshes the
          // session cookies instead, so this is safe to ignore here.
        }
      },
    },
  });
}

/** Returns the authenticated user or null (never throws on missing session). */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
