import { aggregateMemory, type LearnerMemory } from "@/core/application/use-cases/memory";
import { SupabaseMemoryRepository } from "@/infrastructure/db/repositories/memory-repository";

/**
 * Gather raw signals and recompute + persist the learner's structured memory.
 * Shared by the chat route (live, after each turn) and GET /api/memory.
 *
 * `completedTopics` (lesson titles) and `lessonsCompleted` are supplied by the
 * caller, which has access to the curriculum + completed-lesson ids — this keeps
 * the repository/use-case free of presentation-layer curriculum data.
 */
export async function recomputeMemory(params: {
  memoryRepo: SupabaseMemoryRepository;
  completedTopics: string[];
  lessonsCompleted: number;
}): Promise<LearnerMemory> {
  const { memoryRepo, completedTopics, lessonsCompleted } = params;

  const [mistakes, favoriteTopics, reviews, activity] = await Promise.all([
    memoryRepo.getMistakeSignals(),
    memoryRepo.getFavoriteTopicSignals(),
    memoryRepo.getReviewTally(),
    memoryRepo.getActivityCounts(),
  ]);

  const memory = aggregateMemory({
    mistakes,
    completedTopics,
    favoriteTopics,
    reviews,
    lessonsCompleted,
    activeDays: activity.activeDays,
    totalMessages: activity.totalMessages,
  });

  await memoryRepo.saveMemory(memory);
  return memory;
}
