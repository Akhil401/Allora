import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { unauthorized, toProblem } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Client sends this roughly once a minute while the app is open + the learner is
// active. Minutes are clamped so a misbehaving/backgrounded client can't inflate
// time. Messages are NOT touched here (chat turns handle those).
const bodySchema = z.object({
  minutes: z.number().int().min(1).max(5).default(1),
});

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const minutes = parsed.success ? parsed.data.minutes : 1;

  try {
    await ctx.supabase.rpc("record_activity", { p_messages: 0, p_minutes: minutes });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toProblem(err);
  }
}
