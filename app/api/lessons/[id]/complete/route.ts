import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseLessonsRepository } from "@/infrastructure/db/repositories/lessons-repository";
import { findLesson } from "@/presentation/data/curriculum";
import { toProblem, unauthorized, notFound } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mark a lesson complete (unlocks the next one). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  if (!findLesson(id)) return notFound("Lesson");

  const repo = new SupabaseLessonsRepository(ctx.supabase, ctx.userId);
  try {
    await repo.markComplete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toProblem(err);
  }
}
