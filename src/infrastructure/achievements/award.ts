import type { SupabaseClient } from "@supabase/supabase-js";
import { earnedAchievements } from "@/core/application/use-cases/achievements";
import { computeStreak } from "@/core/application/use-cases/progress";

/**
 * Gather the user's stats and upsert any earned achievements. Idempotent via the
 * unique (user_id, code) constraint (migration 0003) + ignoreDuplicates.
 * Best-effort: callers wrap this in try/catch so it never blocks a chat turn.
 */
export async function checkAndAwardAchievements(db: SupabaseClient, userId: string): Promise<void> {
  const [conv, msg, vocab, progress] = await Promise.all([
    db.from("conversations").select("*", { count: "exact", head: true }),
    db.from("messages").select("*", { count: "exact", head: true }),
    db.from("vocabulary_items").select("*", { count: "exact", head: true }),
    db.from("daily_progress").select("day, goal_met").order("day", { ascending: false }).limit(60),
  ]);

  const streak = computeStreak(
    (progress.data ?? []).map((r: { day: string; goal_met: boolean }) => ({
      day: r.day,
      goalMet: r.goal_met,
    })),
  );

  const codes = earnedAchievements({
    conversationsCount: conv.count ?? 0,
    totalMessages: msg.count ?? 0,
    totalWords: vocab.count ?? 0,
    streak,
  });
  if (codes.length === 0) return;

  await db.from("achievements").upsert(
    codes.map((code) => ({ user_id: userId, code })),
    { onConflict: "user_id,code", ignoreDuplicates: true },
  );
}
