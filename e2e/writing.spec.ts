import { test, expect } from "@playwright/test";

test("submit writing and receive feedback", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/writing");
  await page.locator('a[href^="/writing/"]').first().click();
  await page.waitForURL(/\/writing\/.+/);

  await page.getByPlaceholder(/Start writing here/).fill(
    "Thank you so much for your email yesterday. I really appreciate the detailed feedback you shared about the proposal, and I have already started incorporating your suggestions into the next draft. I will send the updated version by Thursday morning, and I would be happy to discuss any remaining questions on a quick call this week if that works for you."
  );
  await page.getByRole("button", { name: "Submit for feedback" }).click();

  await expect(page.getByText(/tone:/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Write another" })).toBeVisible();
});
