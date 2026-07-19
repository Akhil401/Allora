import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabasePatenteRepository } from "@/infrastructure/db/repositories/patente-repository";
import { unauthorized, validationError, toProblem } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  attempts: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        topic: z.string(),
        kind: z.enum(["practice", "exam"]).default("practice"),
        chosen: z.boolean(),
        correct: z.boolean(),
      }),
    )
    .min(1)
    .max(60),
});

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");

  try {
    const repo = new SupabasePatenteRepository(ctx.supabase, ctx.userId);
    await repo.recordAttempts(parsed.data.attempts);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toProblem(err);
  }
}
