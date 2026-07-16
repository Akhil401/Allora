import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import {
  SupabaseLessonsRepository,
  type LessonVariant,
} from "@/infrastructure/db/repositories/lessons-repository";
import { container } from "@/di/container";
import { collectText } from "@/core/application/use-cases/tutor";
import { buildLessonPrompt, VARIANT_FOCUS } from "@/core/prompts/lesson";
import { parseLessonContent, type LessonContent } from "@/lib/validation/lesson";
import { findLesson } from "@/presentation/data/curriculum";
import { toProblem, unauthorized, notFound, validationError, problem } from "@/lib/http/problem";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VARIANT = 2; // original (0) + 2 extra AI versions

async function generate(
  loc: NonNullable<ReturnType<typeof findLesson>>,
  variant: number,
  prior: LessonVariant[],
): Promise<LessonContent | null> {
  const avoid = prior.flatMap((v) => [
    ...v.content.examples.map((e) => e.it),
    ...v.content.keyPhrases.map((p) => p.it),
  ]);

  const { stream } = await container.getLlmRouter().generate({
    system: buildLessonPrompt({
      level: loc.level.level,
      chapterTitle: loc.chapter.title,
      lessonTitle: loc.lesson.title,
      objective: loc.lesson.objective,
      variantFocus: variant > 0 ? VARIANT_FOCUS[variant] : undefined,
      avoid: variant > 0 ? avoid : undefined,
    }),
    messages: [{ role: "user", content: `Create version ${variant} of: ${loc.lesson.title}` }],
    responseFormat: "json",
    temperature: variant > 0 ? 0.7 : 0.4,
    maxTokens: 1500,
  });
  return parseLessonContent(await collectText(stream));
}

/**
 * GET: return ONLY the original lesson (variant 0), generating it once if the
 * shared cache is empty. Extra AI versions are never auto-loaded — they appear
 * only when the user explicitly requests them via POST.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const loc = findLesson(id);
  if (!loc) return notFound("Lesson");

  const repo = new SupabaseLessonsRepository(ctx.supabase, ctx.userId);
  try {
    const all = await repo.getVariants(id);
    let original = all.find((v) => v.variant === 0);
    if (!original) {
      const content = await generate(loc, 0, []);
      if (!content) return problem("generation_failed", "Could not generate this lesson.", 502);
      await repo.saveVariant(id, 0, content);
      original = { variant: 0, content };
    }
    return NextResponse.json({ variants: [original], maxVariant: MAX_VARIANT });
  } catch (err) {
    logger.error("lesson.get_failed", { id, reason: err instanceof Error ? err.message : "?" });
    return toProblem(err);
  }
}

const postSchema = z.object({ variant: z.number().int().min(1).max(MAX_VARIANT) });

/**
 * POST { variant }: return that specific AI version.
 *  - If it's already in the shared cache → return it (NO LLM call).
 *  - Otherwise generate it once (distinct from earlier versions) and cache it.
 * This is what makes the first click talk to the LLM and every later click (by
 * anyone) read from the database.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  const loc = findLesson(id);
  if (!loc) return notFound("Lesson");

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError("variant must be 1 or 2");
  const wanted = parsed.data.variant;

  const repo = new SupabaseLessonsRepository(ctx.supabase, ctx.userId);
  try {
    const prior = await repo.getVariants(id);

    // Already cached → serve from DB, no tokens spent.
    const cached = prior.find((v) => v.variant === wanted);
    if (cached) return NextResponse.json({ variant: cached });

    // Need the immediately-previous version to exist before generating this one.
    if (!prior.some((v) => v.variant === wanted - 1)) {
      return problem("out_of_order", "Open the previous version first.", 409);
    }

    const content = await generate(loc, wanted, prior);
    if (!content) return problem("generation_failed", "Could not generate more. Try again.", 502);
    await repo.saveVariant(id, wanted, content);
    return NextResponse.json({ variant: { variant: wanted, content } });
  } catch (err) {
    logger.error("lesson.more_failed", { id, reason: err instanceof Error ? err.message : "?" });
    return toProblem(err);
  }
}
