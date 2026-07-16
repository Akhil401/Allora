import { test, expect } from "@playwright/test";

/**
 * Smoke test: the landing page renders. Grows into the critical path
 * (sign in → send message → receive reply) as auth and conversations land.
 */
test("landing page renders the hero and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
});
