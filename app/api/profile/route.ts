import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { isAdminEmail } from "@/lib/config/admin";
import { toProblem, unauthorized, validationError } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
});

function displayName(first?: string | null, last?: string | null): string | null {
  const name = [first?.trim(), last?.trim()].filter(Boolean).join(" ");
  return name || null;
}

export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  try {
    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("first_name, last_name, display_name, cefr_level")
      .maybeSingle();

    return NextResponse.json({
      email: user?.email ?? "",
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      displayName: profile?.display_name ?? "",
      cefrLevel: profile?.cefr_level ?? "A1",
      isAdmin: isAdminEmail(user?.email),
    });
  } catch (err) {
    return toProblem(err);
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError("Invalid name.");

  try {
    // Merge with existing so display_name recomputes correctly.
    const { data: existing } = await ctx.supabase
      .from("profiles")
      .select("first_name, last_name")
      .maybeSingle();

    const firstName = parsed.data.firstName ?? existing?.first_name ?? "";
    const lastName = parsed.data.lastName ?? existing?.last_name ?? "";

    const { error } = await ctx.supabase
      .from("profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: displayName(firstName, lastName),
      })
      .eq("id", ctx.userId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, displayName: displayName(firstName, lastName) });
  } catch (err) {
    return toProblem(err);
  }
}
