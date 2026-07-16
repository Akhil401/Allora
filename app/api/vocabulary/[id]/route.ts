import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabaseStudyRepository } from "@/infrastructure/db/repositories/study-repository";
import { toProblem, unauthorized, validationError } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ isBookmarked: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError("isBookmarked (boolean) required");

  const study = new SupabaseStudyRepository(ctx.supabase, ctx.userId);
  try {
    await study.setBookmark(id, parsed.data.isBookmarked);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toProblem(err);
  }
}
