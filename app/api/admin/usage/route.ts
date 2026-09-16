import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { isAdminEmail } from "@/lib/config/admin";
import { container } from "@/di/container";
import { PROVIDER_LIMITS } from "@/lib/usage/tokens";
import { unauthorized, toProblem } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Agg {
  totalTokens: number;
  totalRequests: number;
  todayTokens: number;
  todayRequests: number;
}

/**
 * Admin-only usage summary. Providers don't expose remaining free quota, so this
 * aggregates OUR logged usage (token_usage) across all members via the service
 * role, per provider (today + all recent), and returns it alongside each free
 * tier's published note and live provider health.
 */
export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const {
    data: { user },
  } = await ctx.supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return unauthorized();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new Error("Service role key not configured (SUPABASE_SERVICE_ROLE_KEY).");
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10);

    const { data, error } = await admin
      .from("token_usage")
      .select("provider, total_tokens, day")
      .gte("day", since);
    if (error) throw new Error(error.message);

    // Live remaining-quota snapshots (Groq / Cerebras report these via headers).
    const { data: rlRows } = await admin
      .from("provider_rate_limits")
      .select(
        "provider, remaining_requests, limit_requests, remaining_tokens, limit_tokens, reset_requests, reset_tokens, updated_at",
      );
    const rateLimitByProvider = new Map<
      string,
      {
        remainingRequests: number | null;
        limitRequests: number | null;
        remainingTokens: number | null;
        limitTokens: number | null;
        resetRequests: string | null;
        resetTokens: string | null;
        updatedAt: string;
      }
    >();
    for (const r of rlRows ?? []) {
      rateLimitByProvider.set(r.provider, {
        remainingRequests: r.remaining_requests,
        limitRequests: r.limit_requests,
        remainingTokens: r.remaining_tokens,
        limitTokens: r.limit_tokens,
        resetRequests: r.reset_requests,
        resetTokens: r.reset_tokens,
        updatedAt: r.updated_at,
      });
    }

    const rows = (data ?? []) as { provider: string; total_tokens: number; day: string }[];
    const byProvider = new Map<string, Agg>();
    const dailyOverall = new Map<string, number>();
    let overallTokens = 0;
    let overallRequests = 0;
    let todayTokens = 0;
    let todayRequests = 0;

    for (const r of rows) {
      const t = r.total_tokens ?? 0;
      const p = byProvider.get(r.provider) ?? {
        totalTokens: 0,
        totalRequests: 0,
        todayTokens: 0,
        todayRequests: 0,
      };
      p.totalTokens += t;
      p.totalRequests += 1;
      if (r.day === today) {
        p.todayTokens += t;
        p.todayRequests += 1;
        todayTokens += t;
        todayRequests += 1;
      }
      byProvider.set(r.provider, p);
      overallTokens += t;
      overallRequests += 1;
      dailyOverall.set(r.day, (dailyOverall.get(r.day) ?? 0) + t);
    }

    const ids = new Set<string>([...byProvider.keys(), ...PROVIDER_LIMITS.map((p) => p.id)]);
    const providers = [...ids]
      .map((id) => {
        const cfg = PROVIDER_LIMITS.find((p) => p.id === id);
        const agg = byProvider.get(id) ?? {
          totalTokens: 0,
          totalRequests: 0,
          todayTokens: 0,
          todayRequests: 0,
        };
        const tokenBudget = cfg?.tokenBudget ?? null;
        const pct = tokenBudget
          ? Math.min(100, Math.round((agg.totalTokens / tokenBudget) * 100))
          : null;
        return {
          id,
          label: cfg?.label ?? id,
          freeTierNote: cfg?.freeTierNote ?? "",
          tokenBudget,
          pct,
          rateLimit: rateLimitByProvider.get(id) ?? null,
          ...agg,
        };
      })
      .sort((a, b) => b.totalTokens - a.totalTokens);

    const trend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day: d, tokens: dailyOverall.get(d) ?? 0 };
    });

    const health = container.getLlmRouter().providerHealth();
    const embeddingAvailable = container.getEmbeddingProvider().available;

    return NextResponse.json({
      overall: {
        totalTokens: overallTokens,
        totalRequests: overallRequests,
        todayTokens,
        todayRequests,
      },
      providers,
      trend,
      health,
      embeddingAvailable,
    });
  } catch (err) {
    return toProblem(err);
  }
}
