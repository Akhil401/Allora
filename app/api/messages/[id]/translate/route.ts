import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { container } from "@/di/container";
import { collectText } from "@/core/application/use-cases/tutor";
import { unauthorized, notFound, toProblem } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Return (and cache) an English translation of an Italian message. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();
  const { id } = await params;

  try {
    const message = await ctx.repo.getMessage(id);
    if (!message) return notFound("Message");
    if (message.contentEn) return NextResponse.json({ contentEn: message.contentEn });

    const { stream } = await container.getLlmRouter().generate({
      system:
        "You are a precise translator. Translate the given Italian text into natural English. " +
        "Return ONLY the English translation, no quotes, no notes.",
      messages: [{ role: "user", content: message.contentIt }],
      temperature: 0.2,
      maxTokens: 400,
    });
    const contentEn = (await collectText(stream)).trim();
    await ctx.repo.setMessageTranslation(id, contentEn);
    return NextResponse.json({ contentEn });
  } catch (err) {
    return toProblem(err);
  }
}
