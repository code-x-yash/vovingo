import { test, expect } from "@playwright/test";

test("record a typed take and get the analysis", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/speaking");

  // Pick a free-talk topic (Web Speech is unavailable in headless, so use typing).
  await page
    .locator("section")
    .filter({ hasText: "or just talk" })
    .locator("li button")
    .first()
    .click();

  const textarea = page.locator("section textarea");
  if (!(await textarea.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Type instead" }).click();
  }

  await textarea.fill(
    "Today I practised my presentation out loud, recorded every single take twice, and still found small mistakes to fix."
  );
  await page.getByRole("button", { name: /^Finish/ }).click();

  await expect(page.getByRole("heading", { name: "Review your transcript" })).toBeVisible();
  await page.getByRole("button", { name: "Analyse my speech" }).click();

  await expect(page.getByRole("heading", { name: "Your analysis" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/\bwpm\b/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Practice again" })).toBeVisible();
});
