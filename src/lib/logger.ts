/**
 * Minimal structured logger. Emits JSON lines so Vercel/host log drains can
 * parse them. Never log secrets or full user content. Swap for pino/Sentry later.
 */
type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => log("debug", event, data),
  info: (event: string, data?: Record<string, unknown>) => log("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => log("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => log("error", event, data),
};
