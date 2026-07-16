import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { toProblem, unauthorized, notFound, validationError } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  try {
    const data = await ctx.repo.get(id);
    if (!data) return notFound("Conversation");
    return NextResponse.json(data);
  } catch (err) {
    return toProblem(err);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationError(parsed.error.issues[0]?.message ?? "Invalid body");

  try {
    return NextResponse.json({ conversation: await ctx.repo.update(id, parsed.data) });
  } catch (err) {
    return toProblem(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;
  try {
    await ctx.repo.archiveAndRemove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return toProblem(err);
  }
}
