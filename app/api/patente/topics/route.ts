import { NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { SupabasePatenteRepository } from "@/infrastructure/db/repositories/patente-repository";
import { unauthorized, toProblem } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  try {
    const repo = new SupabasePatenteRepository(ctx.supabase, ctx.userId);
    return NextResponse.json({ topics: await repo.listTopics() });
  } catch (err) {
    return toProblem(err);
  }
}
