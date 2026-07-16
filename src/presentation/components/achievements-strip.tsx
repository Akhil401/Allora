import { ACHIEVEMENTS, ACHIEVEMENT_META } from "@/core/application/use-cases/achievements";

/** Horizontal strip of achievement badges: earned ones highlighted, rest dimmed. */
export function AchievementsStrip({ earned }: { earned: string[] }) {
  const earnedSet = new Set(earned);

  return (
    <div className="shadow-soft rounded-2xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Achievements</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {ACHIEVEMENTS.map((a) => {
          const has = earnedSet.has(a.code);
          const meta = ACHIEVEMENT_META[a.code];
          return (
            <div
              key={a.code}
              className={`flex min-w-16 flex-col items-center gap-1 text-center transition-opacity ${has ? "" : "opacity-30 grayscale"}`}
              title={meta?.title ?? a.code}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition-transform hover:scale-110 ${
                  has ? "bg-primary/10" : "bg-muted"
                }`}
              >
                {meta?.emoji ?? "⭐"}
              </span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {meta?.title ?? a.code}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
