import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseStudyRepository } from "@/infrastructure/db/repositories/study-repository";
import { toProblem, unauthorized, validationError } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addSchema = z.object({
  termIt: z.string().min(1).max(120),
  termEn: z.string().min(1).max(200),
  partOfSpeech: z.string().max(40).nullable().optional(),
  isBookmarked: z.boolean().optional(),
});

/** List the user's vocabulary. `?bookmarked=1` returns favourites only. */
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const bookmarkedOnly = request.nextUrl.searchParams.get("bookmarked") === "1";

  const study = new SupabaseStudyRepository(ctx.supabase, ctx.userId);
  try {
    return NextResponse.json({ vocabulary: await study.listVocabulary(bookmarkedOnly) });
  } catch (err) {
    return toProblem(err);
  }
}

/** Add a word to the user's vocabulary (e.g. saved from the dictionary). */
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const parsed = addSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");

  const study = new SupabaseStudyRepository(ctx.supabase, ctx.userId);
  try {
    const item = await study.addVocabulary(parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return toProblem(err);
  }
}
