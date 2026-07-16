import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — used to generate SQL from src/infrastructure/db/schema.ts
 * and (optionally) push/migrate against DATABASE_URL. For V1 the authoritative
 * setup is supabase/migrations/0001_init.sql (run in the Supabase SQL editor);
 * this config supports schema evolution afterwards.
 */
export default defineConfig({
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
