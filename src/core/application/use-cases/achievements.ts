/**
 * Achievement rules (pure, unit-tested). Given a snapshot of learner stats,
 * return the set of achievement codes that have been earned. The caller
 * persists any newly-earned codes (idempotent via a unique constraint).
 */

export interface LearnerStats {
  conversationsCount: number;
  totalMessages: number; // user + tutor
  totalWords: number; // vocabulary items collected
  streak: number; // consecutive goal-met days
}

interface AchievementRule {
  code: string;
  title: string;
  emoji: string;
  test: (s: LearnerStats) => boolean;
}

export const ACHIEVEMENTS: AchievementRule[] = [
  {
    code: "first_conversation",
    title: "First words",
    emoji: "👋",
    test: (s) => s.conversationsCount >= 1,
  },
  { code: "messages_50", title: "Chatterbox", emoji: "💬", test: (s) => s.totalMessages >= 50 },
  { code: "messages_200", title: "Fluent flow", emoji: "🗣️", test: (s) => s.totalMessages >= 200 },
  { code: "words_50", title: "Word collector", emoji: "📚", test: (s) => s.totalWords >= 50 },
  { code: "streak_7", title: "One week strong", emoji: "🔥", test: (s) => s.streak >= 7 },
  { code: "streak_30", title: "Unstoppable", emoji: "🏆", test: (s) => s.streak >= 30 },
];

export const ACHIEVEMENT_META: Record<string, { title: string; emoji: string }> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.code, { title: a.title, emoji: a.emoji }]));

export function earnedAchievements(stats: LearnerStats): string[] {
  return ACHIEVEMENTS.filter((a) => a.test(stats)).map((a) => a.code);
}
