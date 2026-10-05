import { test, expect } from "@playwright/test";

test("chat with the AI coach", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/conversation");
  await expect(page.getByRole("heading", { name: "Coach & chats" })).toBeVisible();
  await page.getByRole("button", { name: "Open coach chat" }).click();
  await page.waitForURL(/\/conversation\?id=/);

  const aiBubbles = page.locator("div.flex.justify-start p");
  const before = await aiBubbles.count();

  await page
    .getByPlaceholder(/Type your reply/)
    .fill("Hello! I have a job interview next week and I am nervous.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("job interview next week")).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => aiBubbles.count(), { timeout: 15_000 })
    .toBeGreaterThan(before);
});
