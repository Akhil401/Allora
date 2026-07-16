import { NextResponse, type NextRequest } from "next/server";
import { getRequestContext } from "@/infrastructure/auth/request-context";
import { container } from "@/di/container";
import { collectText } from "@/core/application/use-cases/tutor";
import { parseDictionary } from "@/lib/validation/dictionary";
import { toProblem, unauthorized, validationError, notFound } from "@/lib/http/problem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI dictionary lookup for any word/phrase (Italian or English). Returns a
 * structured Italian→English entry with part of speech and an example sentence.
 */
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext();
  if (!ctx) return unauthorized();

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1 || q.length > 60) return validationError("Provide a word or short phrase (q).");

  try {
    const { stream } = await container.getLlmRouter().generate({
      system:
        "You are an Italian↔English dictionary. Given a word or phrase in Italian OR English, " +
        "return ONLY a JSON object (no prose, no code fences): " +
        '{ "termIt": string, "termEn": string, "partOfSpeech": string, "exampleIt": string, "exampleEn": string }. ' +
        "termIt is always the Italian form, termEn the English translation. exampleIt is a short natural " +
        "Italian sentence using the word, exampleEn its English translation. Keep it beginner-friendly.",
      messages: [{ role: "user", content: q }],
      responseFormat: "json",
      temperature: 0.2,
      maxTokens: 300,
    });
    const result = parseDictionary(await collectText(stream));
    if (!result) return notFound("Translation");
    return NextResponse.json({ result });
  } catch (err) {
    return toProblem(err);
  }
}
