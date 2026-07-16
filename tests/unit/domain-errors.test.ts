import { describe, it, expect } from "vitest";
import {
  DomainError,
  RateLimitError,
  QuotaExceededError,
  AllProvidersFailedError,
} from "@/core/domain/errors";

/**
 * Sample unit test proving the test harness + path aliases + domain layer work.
 * Real coverage (LLM router failover, use cases) lands with those features.
 */
describe("domain errors", () => {
  it("carry a stable code and correct name", () => {
    expect(new RateLimitError().code).toBe("rate_limited");
    expect(new QuotaExceededError().code).toBe("quota_exceeded");
    expect(new AllProvidersFailedError().code).toBe("provider_unavailable");
    expect(new RateLimitError().name).toBe("RateLimitError");
  });

  it("are instances of DomainError", () => {
    expect(new RateLimitError()).toBeInstanceOf(DomainError);
    expect(new QuotaExceededError()).toBeInstanceOf(DomainError);
  });

  it("preserve a custom retry hint", () => {
    const err = new RateLimitError("slow down", 1500);
    expect(err.retryAfterMs).toBe(1500);
    expect(err.message).toBe("slow down");
  });
});
