import { NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseMemoryRepository } from "@/infrastructure/db/repositories/memory-repository";
import { SupabaseLessonsRepository } from "@/infrastructure/db/repositories/lessons-repository";
import { recomputeMemory } from "@/infrastructure/db/memory-sync";
import { recommendLessons } from "@/core/application/use-cases/memory";
import { ORDERED_LESSON_IDS, lessonMetaMap, titlesForIds } from "@/presentation/data/curriculum";
import { unauthorized, toProblem } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * V3 insights endpoint. Recomputes the learner's adaptive memory on demand and
 * returns it together with up-to-3 recommended lessons (weakness-targeted, then
 * next-in-order). Powers the dashboard insights card and Learn recommendations.
 */
export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  try {
    const memoryRepo = new SupabaseMemoryRepository(ctx.supabase, ctx.userId);
    const lessonsRepo = new SupabaseLessonsRepository(ctx.supabase, ctx.userId);

    const completedIds = await lessonsRepo.getCompletedIds();
    const memory = await recomputeMemory({
      memoryRepo,
      completedTopics: titlesForIds(completedIds),
      lessonsCompleted: completedIds.length,
    });

    const recommendations = recommendLessons(
      memory,
      new Set(completedIds),
      ORDERED_LESSON_IDS,
      lessonMetaMap(),
      3,
    );

    return NextResponse.json({ memory, recommendations });
  } catch (err) {
    return toProblem(err);
  }
}
