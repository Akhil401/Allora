import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { toProblem, unauthorized, validationError } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  try {
    return NextResponse.json({ conversations: await ctx.repo.list() });
  } catch (err) {
    return toProblem(err);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");

  try {
    const conversation = await ctx.repo.create(parsed.data);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    return toProblem(err);
  }
}
