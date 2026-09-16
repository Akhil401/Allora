"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Zap,
  MessageSquare,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RateLimit {
  remainingRequests: number | null;
  limitRequests: number | null;
  remainingTokens: number | null;
  limitTokens: number | null;
  resetRequests: string | null;
  resetTokens: string | null;
  updatedAt: string;
}
interface ProviderRow {
  id: string;
  label: string;
  freeTierNote: string;
  tokenBudget: number | null;
  pct: number | null;
  totalTokens: number;
  totalRequests: number;
  todayTokens: number;
  todayRequests: number;
  rateLimit: RateLimit | null;
}
interface Health {
  id: string;
  healthy: boolean;
  cooldownUntil?: number;
}
interface UsageData {
  overall: {
    totalTokens: number;
    totalRequests: number;
    todayTokens: number;
    todayRequests: number;
  };
  providers: ProviderRow[];
  trend: { day: string; tokens: number }[];
  health: Health[];
  embeddingAvailable: boolean;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Admin-only usage panel: estimated tokens burned per provider vs free limits. */
export function AdminUsage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load usage."))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading usage…
      </div>
    );
  }
  if (error || !data) {
    return <p className="py-10 text-center text-sm text-destructive">{error ?? "No data."}</p>;
  }

  const healthById = new Map(data.health.map((h) => [h.id, h]));
  const maxTrend = Math.max(1, ...data.trend.map((t) => t.tokens));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Usage &amp; quota</h1>
          <p className="text-xs text-muted-foreground">
            Estimated from our own logging — providers don’t report remaining free quota.
          </p>
        </div>
      </div>

      {/* Overall */}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<Zap className="h-5 w-5" />}
          label="Tokens today"
          value={fmt(data.overall.todayTokens)}
        />
        <Stat
          icon={<Zap className="h-5 w-5" />}
          label="Tokens total"
          value={fmt(data.overall.totalTokens)}
          accent="violet"
        />
        <Stat
          icon={<MessageSquare className="h-5 w-5" />}
          label="Requests today"
          value={String(data.overall.todayRequests)}
          accent="green"
        />
        <Stat
          icon={<Cpu className="h-5 w-5" />}
          label="Requests total"
          value={String(data.overall.totalRequests)}
          accent="amber"
        />
      </div>

      {/* 14-day trend */}
      <div className="shadow-soft rounded-2xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Tokens · last 14 days</h2>
        <div className="flex items-end justify-between gap-1" style={{ height: 72 }}>
          {data.trend.map((t) => (
            <div
              key={t.day}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${t.day}: ${fmt(t.tokens)}`}
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-primary/40"
                  style={{
                    height: `${t.tokens > 0 ? Math.max(4, (t.tokens / maxTrend) * 100) : 2}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per provider */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">By provider</h2>
        {data.providers.map((p) => {
          const h = healthById.get(p.id);
          const known = h !== undefined;
          return (
            <div key={p.id} className="shadow-soft rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.label}</span>
                  {known ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        h!.healthy
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {h!.healthy ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {h!.healthy ? "healthy" : "cooling down"}
                    </span>
                  ) : p.id === "jina" ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        data.embeddingAvailable
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {data.embeddingAvailable ? "configured" : "not configured"}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                  {fmt(p.totalTokens)} tok · {p.totalRequests} req
                </span>
              </div>

              {p.tokenBudget ? (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {fmt(p.totalTokens)} / {fmt(p.tokenBudget)} free tokens
                    </span>
                    <span className="font-medium text-primary">{p.pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        (p.pct ?? 0) >= 90
                          ? "bg-destructive"
                          : "bg-gradient-to-r from-primary/80 to-primary",
                      )}
                      style={{ width: `${p.pct ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <p className="mt-2 text-xs text-muted-foreground">
                Today: {fmt(p.todayTokens)} tokens · {p.todayRequests} requests
              </p>

              {p.rateLimit ? <RemainingQuota rl={p.rateLimit} /> : null}

              <p className="mt-1 text-[11px] text-muted-foreground">{p.freeTierNote}</p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Token counts are estimates (~4 chars/token) unless a provider returns exact usage. Free-tier
        limits are mostly request-based (per-minute / per-day) and vary by model — treat the numbers
        as guidance for staying under caps, not exact remaining quota.
      </p>
    </div>
  );
}

/** Live remaining-quota readout from a provider's x-ratelimit headers. */
function RemainingQuota({ rl }: { rl: RateLimit }) {
  const hasReq = rl.remainingRequests != null;
  const hasTok = rl.remainingTokens != null;
  if (!hasReq && !hasTok) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
        Live remaining (from provider)
      </p>
      {hasReq ? (
        <QuotaBar
          label="Requests left today"
          remaining={rl.remainingRequests!}
          limit={rl.limitRequests}
          reset={rl.resetRequests}
        />
      ) : null}
      {hasTok ? (
        <QuotaBar
          label="Tokens left (this minute)"
          remaining={rl.remainingTokens!}
          limit={rl.limitTokens}
          reset={rl.resetTokens}
        />
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        Rolling window — resets on the provider&apos;s clock · updated {relTime(rl.updatedAt)}
      </p>
    </div>
  );
}

function QuotaBar({
  label,
  remaining,
  limit,
  reset,
}: {
  label: string;
  remaining: number;
  limit: number | null;
  reset: string | null;
}) {
  const pct = limit && limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : null;
  const low = pct != null && pct <= 15;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-semibold", low ? "text-destructive" : "text-foreground")}>
          {fmt(remaining)}
          {limit ? <span className="font-normal text-muted-foreground"> / {fmt(limit)}</span> : null}
          {reset ? <span className="font-normal text-muted-foreground"> · resets {reset}</span> : null}
        </span>
      </div>
      {pct != null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", low ? "bg-destructive" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Compact "3m ago" style relative time. */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Stat({
  icon,
  label,
  value,
  accent = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "primary" | "violet" | "green" | "amber";
}) {
  const chip = {
    primary: "bg-primary/10 text-primary",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[accent];
  return (
    <div className="hover-lift shadow-soft flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", chip)}>
        {icon}
      </span>
      <span className="text-xl font-bold tracking-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
