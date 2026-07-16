import { NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { toProblem, unauthorized } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List conversation categories (reference data, read-only). */
export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  try {
    const { data, error } = await ctx.supabase
      .from("categories")
      .select("id, slug, title_en, title_it, is_roleplay")
      .order("title_en", { ascending: true });
    if (error) throw new Error(error.message);
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const categories = (data ?? []).map((c: any) => ({
      id: c.id,
      slug: c.slug,
      titleEn: c.title_en,
      titleIt: c.title_it,
      isRoleplay: c.is_roleplay,
    }));
    return NextResponse.json({ categories });
  } catch (err) {
    return toProblem(err);
  }
}
