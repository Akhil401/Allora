import { NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseStudyRepository } from "@/infrastructure/db/repositories/study-repository";
import { toProblem, unauthorized } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ensure flashcards exist for all vocab, then return the cards due now. */
export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const study = new SupabaseStudyRepository(ctx.supabase, ctx.userId);
  try {
    await study.ensureFlashcards();
    return NextResponse.json({ cards: await study.getDue() });
  } catch (err) {
    return toProblem(err);
  }
}
