import { NextResponse } from "next/server";
import { DomainError, AllProvidersFailedError } from "@/core/domain/errors";

/** Uniform error envelope: { error: { code, message } }. */
export function problem(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Map a thrown error to an HTTP problem response. */
export function toProblem(err: unknown) {
  if (err instanceof AllProvidersFailedError) {
    return problem("provider_unavailable", "All AI providers are unavailable. Try again.", 502);
  }
  if (err instanceof DomainError) {
    return problem(err.code, err.message, 400);
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return problem("internal", message, 500);
}

export const unauthorized = () => problem("unauthorized", "Sign in required.", 401);
export const notFound = (what = "Resource") => problem("not_found", `${what} not found.`, 404);
export const validationError = (message: string) => problem("validation_error", message, 400);
