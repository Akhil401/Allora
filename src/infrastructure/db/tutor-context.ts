import type { SupabaseClient } from "@supabase/supabase-js";
import type { TutorContext } from "@/core/prompts/tutor";

/**
 * Load the base tutor context (CEFR level + difficulty + learner name) from
 * profiles and settings. Falls back to safe defaults so the tutor always works
 * even before a profile row exists. The memory block is attached separately by
 * the caller (it needs the embedding provider for semantic recall).
 */
export async function loadTutorContext(
  supabase: SupabaseClient,
  topicHint?: string,
): Promise<TutorContext> {
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("cefr_level, display_name, first_name").maybeSingle(),
    supabase.from("settings").select("tutor_difficulty").maybeSingle(),
  ]);

  const difficulty = (settings?.tutor_difficulty ?? "normal") as TutorContext["difficulty"];
  const firstName =
    (profile as { first_name?: string } | null)?.first_name?.trim() ||
    (profile?.display_name ? String(profile.display_name).trim().split(/\s+/)[0] : "");

  return {
    cefrLevel: profile?.cefr_level ?? "A1",
    difficulty: ["gentle", "normal", "strict"].includes(difficulty) ? difficulty : "normal",
    topicHint,
    learnerName: firstName || undefined,
  };
}
