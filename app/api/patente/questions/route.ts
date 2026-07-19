import { type NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabasePatenteRepository } from "@/infrastructure/db/repositories/patente-repository";
import { unauthorized, validationError, toProblem } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const topic = request.nextUrl.searchParams.get("topic");
  if (!topic) return validationError("A topic is required.");
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)));

  try {
    const repo = new SupabasePatenteRepository(ctx.supabase, ctx.userId);
    return NextResponse.json({ questions: await repo.getByTopic(topic, limit) });
  } catch (err) {
    return toProblem(err);
  }
}
