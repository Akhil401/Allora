import { cn } from "@/lib/utils";

export interface WeekDay {
  label: string; // e.g. "Mon"
  minutes: number;
  goalMet: boolean;
}

/** Simple CSS bar chart of the last 7 days' practice minutes (no chart lib). */
export function WeeklyChart({ days, goalMinutes }: { days: WeekDay[]; goalMinutes: number }) {
  const max = Math.max(goalMinutes, ...days.map((d) => d.minutes), 1);
  const goalPct = (goalMinutes / max) * 100;

  return (
    <div className="shadow-soft rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">This week</h2>
        <span className="text-xs text-muted-foreground">goal {goalMinutes} min/day</span>
      </div>
      <div className="relative flex items-end justify-between gap-2" style={{ height: 96 }}>
        {/* Goal line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/30"
          style={{ bottom: `${Math.min(96, goalPct)}%` }}
        />
        {days.map((d, i) => {
          const isLast = i === days.length - 1;
          const has = d.minutes > 0;
          return (
            <div key={i} className="group flex flex-1 flex-col items-center gap-1">
              <span className="h-3 text-[9px] font-semibold text-muted-foreground">
                {has ? d.minutes : ""}
              </span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-500 ease-out",
                    d.goalMet
                      ? "bg-gradient-to-t from-primary/70 to-primary"
                      : has
                        ? "bg-primary/40 group-hover:bg-primary/60"
                        : "bg-muted-foreground/15",
                    isLast && has && "ring-2 ring-primary/30 ring-offset-1 ring-offset-card",
                  )}
                  style={{ height: `${has ? Math.max(8, (d.minutes / max) * 100) : 3}%` }}
                  title={`${d.minutes} min`}
                />
              </div>
              <span
                className={cn(
                  "text-[10px]",
                  isLast ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
