import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { toProblem, unauthorized, validationError } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  voiceOutputEnabled: z.boolean().optional(),
  tutorDifficulty: z.enum(["gentle", "normal", "strict"]).optional(),
  dailyGoalMinutes: z.number().int().min(1).max(240).optional(),
  cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
});

export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  try {
    const [{ data: settings }, { data: profile }] = await Promise.all([
      ctx.supabase
        .from("settings")
        .select("theme, voice_output_enabled, tutor_difficulty, daily_goal_minutes")
        .maybeSingle(),
      ctx.supabase.from("profiles").select("cefr_level").maybeSingle(),
    ]);
    return NextResponse.json({
      theme: settings?.theme ?? "system",
      voiceOutputEnabled: settings?.voice_output_enabled ?? true,
      tutorDifficulty: settings?.tutor_difficulty ?? "normal",
      dailyGoalMinutes: settings?.daily_goal_minutes ?? 10,
      cefrLevel: profile?.cefr_level ?? "A1",
    });
  } catch (err) {
    return toProblem(err);
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");
  const { cefrLevel, ...settings } = parsed.data;

  try {
    if (Object.keys(settings).length > 0) {
      const row: Record<string, unknown> = { user_id: ctx.userId };
      if (settings.theme !== undefined) row.theme = settings.theme;
      if (settings.voiceOutputEnabled !== undefined)
        row.voice_output_enabled = settings.voiceOutputEnabled;
      if (settings.tutorDifficulty !== undefined) row.tutor_difficulty = settings.tutorDifficulty;
      if (settings.dailyGoalMinutes !== undefined)
        row.daily_goal_minutes = settings.dailyGoalMinutes;
      const { error } = await ctx.supabase.from("settings").upsert(row, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    }
    if (cefrLevel !== undefined) {
      const { error } = await ctx.supabase
        .from("profiles")
        .update({ cefr_level: cefrLevel })
        .eq("id", ctx.userId);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toProblem(err);
  }
}
