import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame, MessageSquare, BookMarked, Target, ArrowRight } from "lucide-react";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { StatCard } from "@/presentation/components/stat-card";
import { WeeklyChart, type WeekDay } from "@/presentation/components/weekly-chart";
import { AchievementsStrip } from "@/presentation/components/achievements-strip";
import { LearnerInsights } from "@/presentation/components/learner-insights";
import { computeStreak } from "@/core/application/use-cases/progress";

export const dynamic = "force-dynamic";

interface ProgressRow {
  day: string;
  minutes_practiced: number;
  goal_met: boolean;
  goal_minutes: number;
  messages_count: number;
}

export default async function DashboardPage() {
  const ctx = await getRequestContext();
  if (!ctx) redirect("/sign-in");

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const weekAgoKey = new Date(today.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);

  const [
    { data: profile },
    { data: recent },
    { data: history },
    { data: earnedRows },
    { count: wordCount },
  ] = await Promise.all([
    ctx.supabase.from("profiles").select("display_name, cefr_level").maybeSingle(),
    ctx.supabase
      .from("daily_progress")
      .select("day, minutes_practiced, goal_met, goal_minutes, messages_count")
      .gte("day", weekAgoKey),
    ctx.supabase
      .from("daily_progress")
      .select("day, minutes_practiced, messages_count")
      .order("day", { ascending: false })
      .limit(120),
    ctx.supabase.from("achievements").select("code"),
    ctx.supabase.from("vocabulary_items").select("id", { count: "exact", head: true }),
  ]);

  const rows = (recent ?? []) as ProgressRow[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const todayRow = byDay.get(todayKey);
  const goal = todayRow?.goal_minutes ?? 10;

  // Streak counts any day the learner showed up (opened/used the app), not just
  // days where the minutes goal was met — more encouraging and matches "open = +1".
  const streak = computeStreak(
    (history ?? []).map(
      (r: { day: string; minutes_practiced: number; messages_count: number }) => ({
        day: r.day,
        goalMet: (r.minutes_practiced ?? 0) > 0 || (r.messages_count ?? 0) > 0,
      }),
    ),
  );

  const week: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    return {
      label: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 2),
      minutes: row?.minutes_practiced ?? 0,
      goalMet: row?.goal_met ?? false,
    };
  });

  const earned = (earnedRows ?? []).map((r: { code: string }) => r.code);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold tracking-tight">
          Ciao
          <span className="text-gradient">
            {profile?.display_name ? `, ${profile.display_name}` : ""}
          </span>
          !
        </h1>
        <p className="text-sm text-muted-foreground">
          Level {profile?.cefr_level ?? "A1"} · keep it up.
        </p>
      </div>

      <div className="stagger grid grid-cols-2 gap-3">
        <StatCard
          accent="amber"
          icon={<Flame className="h-5 w-5" />}
          label="Streak"
          value={`${streak} day${streak === 1 ? "" : "s"}`}
        />
        <StatCard
          accent="primary"
          icon={<Target className="h-5 w-5" />}
          label="Today's goal"
          value={`${todayRow?.minutes_practiced ?? 0}/${goal} min`}
        />
        <StatCard
          accent="violet"
          icon={<MessageSquare className="h-5 w-5" />}
          label="Messages today"
          value={String(todayRow?.messages_count ?? 0)}
        />
        <StatCard
          accent="green"
          icon={<BookMarked className="h-5 w-5" />}
          label="Words learned"
          value={String(wordCount ?? 0)}
        />
      </div>

      <div className="animate-fade-in-up">
        <LearnerInsights />
      </div>
      <div className="animate-fade-in-up">
        <WeeklyChart days={week} goalMinutes={goal} />
      </div>
      <div className="animate-fade-in-up">
        <AchievementsStrip earned={earned} />
      </div>

      <Link
        href="/conversations"
        className="hover-lift shadow-soft group relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 font-medium text-primary-foreground"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl"
        />
        <span className="relative">
          <span className="block text-base font-semibold">Practice with your tutor</span>
          <span className="block text-xs text-primary-foreground/80">
            Start a conversation in Italian
          </span>
        </span>
        <ArrowRight className="relative h-5 w-5 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}
