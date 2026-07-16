import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseStudyRepository } from "@/infrastructure/db/repositories/study-repository";
import { toProblem, unauthorized, validationError } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ grade: z.enum(["again", "hard", "good", "easy"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError("grade must be again|hard|good|easy");

  const study = new SupabaseStudyRepository(ctx.supabase, ctx.userId);
  try {
    await study.review(id, parsed.data.grade);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toProblem(err);
  }
}
