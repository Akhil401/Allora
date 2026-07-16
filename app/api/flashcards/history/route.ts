import { NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseStudyRepository } from "@/infrastructure/db/repositories/study-repository";
import { toProblem, unauthorized } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Review history (newest first) for the day-wise history view. */
export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const study = new SupabaseStudyRepository(ctx.supabase, ctx.userId);
  try {
    return NextResponse.json({ history: await study.getReviewHistory() });
  } catch (err) {
    return toProblem(err);
  }
}
