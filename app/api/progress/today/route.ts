import { NextResponse } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { computeStreak } from "@/core/application/use-cases/progress";
import { toProblem, unauthorized } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [{ data: todayRow }, { data: history }] = await Promise.all([
      ctx.supabase
        .from("daily_progress")
        .select("messages_count, minutes_practiced, goal_minutes, goal_met")
        .eq("day", today)
        .maybeSingle(),
      ctx.supabase
        .from("daily_progress")
        .select("day, goal_met")
        .order("day", { ascending: false })
        .limit(60),
    ]);

    const streak = computeStreak((history ?? []).map((r) => ({ day: r.day, goalMet: r.goal_met })));

    return NextResponse.json({
      messagesCount: todayRow?.messages_count ?? 0,
      minutesPracticed: todayRow?.minutes_practiced ?? 0,
      goalMinutes: todayRow?.goal_minutes ?? 10,
      goalMet: todayRow?.goal_met ?? false,
      streak,
    });
  } catch (err) {
    return toProblem(err);
  }
}
