import { randomBytes } from "node:crypto";
import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/user.json";

setup("sign up and finish onboarding", async ({ page }) => {
  const email = `e2e-${Date.now()}-${randomBytes(3).toString("hex")}@test.dev`;

  await page.goto("/signup");
  await page.locator("#name").fill("E2E Tester");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("coach2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");

  // Step 1 — goals
  await page.getByRole("button", { name: "Job interviews" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2 — about you (defaults are valid)
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 — level (pick an explicit level to skip placement)
  await page.getByRole("button", { name: /^Beginner/ }).click();
  await page.getByRole("button", { name: "Finish" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByText("day streak")).toBeVisible();

  await page.context().storageState({ path: AUTH_FILE });
});
