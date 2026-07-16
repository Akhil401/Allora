import { NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseLessonsRepository } from "@/infrastructure/db/repositories/lessons-repository";
import { toProblem, unauthorized } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ids of lessons the current user has completed. */
export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const repo = new SupabaseLessonsRepository(ctx.supabase, ctx.userId);
  try {
    return NextResponse.json({ completed: await repo.getCompletedIds() });
  } catch (err) {
    return toProblem(err);
  }
}
