import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small metric card for the dashboard grid. */
export function StatCard({
  icon,
  label,
  value,
  accent = "primary",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: "primary" | "amber" | "green" | "violet";
}) {
  const chip = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  }[accent];

  return (
    <div className="hover-lift shadow-soft flex flex-col gap-2 rounded-2xl border bg-card p-4 text-card-foreground">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", chip)}>
        {icon}
      </span>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
