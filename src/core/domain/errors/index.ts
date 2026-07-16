/**
 * Domain error hierarchy. These are framework-agnostic and are mapped to HTTP
 * problem responses at the presentation boundary (see src/lib/http/problem.ts,
 * added in M4). Infrastructure adapters throw the specific subclasses so the
 * LLM router can decide whether to fail over.
 */

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Provider hit its rate limit; router should try the next provider. */
export class RateLimitError extends DomainError {
  constructor(
    message = "Provider rate limit reached",
    readonly retryAfterMs?: number,
  ) {
    super(message, "rate_limited");
  }
}

/** Provider quota/credits exhausted; router should skip it for a cooldown. */
export class QuotaExceededError extends DomainError {
  constructor(message = "Provider quota exceeded") {
    super(message, "quota_exceeded");
  }
}

/** Provider returned an error or timed out; router should try the next. */
export class ProviderError extends DomainError {
  constructor(
    message = "Provider error",
    readonly providerId?: string,
  ) {
    super(message, "provider_error");
  }
}

/** All providers failed; surfaced to the client as 502. */
export class AllProvidersFailedError extends DomainError {
  constructor(message = "All LLM providers failed") {
    super(message, "provider_unavailable");
  }
}
