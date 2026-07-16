import { describe, it, expect } from "vitest";
import { FailoverLlmRouter } from "@/infrastructure/llm/router";
import type { LlmProvider, LlmChunk, LlmRequest } from "@/core/application/ports/llm";
import { RateLimitError } from "@/core/domain/errors";

/** Test double: a provider whose behaviour is scripted. */
function fakeProvider(
  id: string,
  behaviour: "ok" | "throw-before-first" | "empty",
  text = "ciao",
): LlmProvider {
  return {
    id,
    health: () => ({ id, healthy: true }),
    async *generate(_input: LlmRequest): AsyncIterable<LlmChunk> {
      if (behaviour === "throw-before-first") {
        throw new RateLimitError(`${id} limited`);
      }
      if (behaviour === "empty") {
        return; // yields nothing
      }
      for (const ch of text) yield { delta: ch };
    },
  };
}

async function collect(stream: AsyncIterable<LlmChunk>): Promise<string> {
  let out = "";
  for await (const c of stream) out += c.delta;
  return out;
}

const req: LlmRequest = { system: "s", messages: [{ role: "user", content: "hi" }] };

describe("FailoverLlmRouter", () => {
  it("uses the first healthy provider that succeeds", async () => {
    const router = new FailoverLlmRouter([fakeProvider("p1", "ok", "uno")]);
    const { providerId, stream } = await router.generate(req);
    expect(providerId).toBe("p1");
    expect(await collect(stream)).toBe("uno");
  });

  it("fails over when a provider throws before the first chunk", async () => {
    const router = new FailoverLlmRouter([
      fakeProvider("p1", "throw-before-first"),
      fakeProvider("p2", "ok", "due"),
    ]);
    const { providerId, stream } = await router.generate(req);
    expect(providerId).toBe("p2");
    expect(await collect(stream)).toBe("due");
  });

  it("skips an empty provider and uses the next", async () => {
    const router = new FailoverLlmRouter([
      fakeProvider("p1", "empty"),
      fakeProvider("p2", "ok", "tre"),
    ]);
    const { providerId } = await router.generate(req);
    expect(providerId).toBe("p2");
  });

  it("throws AllProvidersFailedError when everything fails", async () => {
    const router = new FailoverLlmRouter([
      fakeProvider("p1", "throw-before-first"),
      fakeProvider("p2", "throw-before-first"),
    ]);
    await expect(router.generate(req)).rejects.toThrowError(/All providers failed/);
  });

  it("prefers healthy providers over cooling-down ones", async () => {
    const cooling: LlmProvider = {
      id: "cold",
      health: () => ({ id: "cold", healthy: false, cooldownUntil: Date.now() + 60_000 }),
      // eslint-disable-next-line require-yield
      async *generate() {
        throw new Error("should not be tried first");
      },
    };
    const router = new FailoverLlmRouter([cooling, fakeProvider("warm", "ok", "ok")]);
    const { providerId } = await router.generate(req);
    expect(providerId).toBe("warm");
  });
});
