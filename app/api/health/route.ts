import { NextResponse } from "next/server";
import { container } from "@/di/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + LLM provider health (which providers are configured / cooling down). */
export async function GET() {
  try {
    const providers = container.getLlmRouter().providerHealth();
    return NextResponse.json({ ok: true, providers });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
