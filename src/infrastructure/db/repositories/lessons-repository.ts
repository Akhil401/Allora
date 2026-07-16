import type { SupabaseClient } from "@supabase/supabase-js";
import type { LessonContent } from "@/lib/validation/lesson";

export interface LessonVariant {
  variant: number; // 0 = original, 1 & 2 = extra AI versions
  content: LessonContent;
}

/**
 * Lesson progress (per user) + shared lesson-content cache. Content is keyed by
 * (lesson_id, variant) — identical for everyone — so each version is generated
 * once and reused forever.
 */
export class SupabaseLessonsRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async getCompletedIds(): Promise<string[]> {
    const { data, error } = await this.db.from("lesson_progress").select("lesson_id");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { lesson_id: string }) => r.lesson_id);
  }

  async markComplete(lessonId: string): Promise<void> {
    const { error } = await this.db
      .from("lesson_progress")
      .upsert(
        { user_id: this.userId, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  }

  /** All cached versions of a lesson, ordered variant 0 → n. */
  async getVariants(lessonId: string): Promise<LessonVariant[]> {
    const { data, error } = await this.db
      .from("lesson_content")
      .select("variant, content")
      .eq("lesson_id", lessonId)
      .order("variant", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { variant: number; content: LessonContent }) => ({
      variant: r.variant,
      content: r.content,
    }));
  }

  async saveVariant(lessonId: string, variant: number, content: LessonContent): Promise<void> {
    const { error } = await this.db
      .from("lesson_content")
      .upsert(
        { lesson_id: lessonId, variant, content },
        { onConflict: "lesson_id,variant", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  }
}
