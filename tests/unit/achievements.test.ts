import { describe, it, expect } from "vitest";
import { earnedAchievements } from "@/core/application/use-cases/achievements";

describe("earnedAchievements", () => {
  it("awards nothing for a brand-new learner", () => {
    expect(
      earnedAchievements({ conversationsCount: 0, totalMessages: 0, totalWords: 0, streak: 0 }),
    ).toEqual([]);
  });

  it("awards first_conversation after one conversation", () => {
    const codes = earnedAchievements({
      conversationsCount: 1,
      totalMessages: 2,
      totalWords: 0,
      streak: 0,
    });
    expect(codes).toContain("first_conversation");
  });

  it("awards streak and message milestones cumulatively", () => {
    const codes = earnedAchievements({
      conversationsCount: 5,
      totalMessages: 220,
      totalWords: 60,
      streak: 8,
    });
    expect(codes).toEqual(
      expect.arrayContaining([
        "first_conversation",
        "messages_50",
        "messages_200",
        "words_50",
        "streak_7",
      ]),
    );
    expect(codes).not.toContain("streak_30");
  });
});
