import { describe, it, expect } from "vitest";
import { parseCorrection } from "@/lib/validation/correction";

describe("parseCorrection", () => {
  it("parses a clean JSON object", () => {
    const raw = JSON.stringify({
      hasError: true,
      originalText: "Ieri io andato",
      correctedText: "Ieri sono andato",
      explanationEn: "Use the auxiliary 'sono'.",
      errors: [{ type: "auxiliary_verb", detail: "missing sono", severity: "med" }],
      vocabulary: [{ termIt: "ieri", termEn: "yesterday" }],
    });
    const result = parseCorrection(raw);
    expect(result?.correctedText).toBe("Ieri sono andato");
    expect(result?.errors[0]?.type).toBe("auxiliary_verb");
  });

  it("strips ```json fences and surrounding prose", () => {
    const raw =
      'Here you go:\n```json\n{"hasError":false,"originalText":"Ciao","correctedText":"Ciao","explanationEn":"ok"}\n```';
    const result = parseCorrection(raw);
    expect(result?.hasError).toBe(false);
    expect(result?.errors).toEqual([]); // defaulted
  });

  it("returns null for unsalvageable output", () => {
    expect(parseCorrection("sorry, I cannot help")).toBeNull();
  });
});
