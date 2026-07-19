import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Auth middleware.
 *
 * 1) Refreshes the Supabase session cookies on every request (required by
 *    @supabase/ssr so Server Components see a valid session).
 * 2) Guards the authenticated area: unauthenticated requests to /dashboard,
 *    /conversations or /settings are redirected to /sign-in.
 *
 * If Supabase env vars are absent (e.g. before M2 setup), it no-ops so the
 * public site still renders.
 */
const PROTECTED = [
  "/dashboard",
  "/conversations",
  "/settings",
  "/learn",
  "/talk",
  "/review",
  "/vocabulary",
  "/profile",
  "/admin",
  "/patente",
];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and the service worker.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|icons|.*\\.png$).*)"],
};
