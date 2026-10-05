import { test, expect } from "@playwright/test";

test("work through a lesson to the finish screen", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/lessons");
  await expect(page.getByRole("heading", { name: "Lessons", level: 1 })).toBeVisible();
  await page.locator('a[href^="/lessons/"]').first().click();
  await page.waitForURL(/\/lessons\/.+/);

  const finishScreen = page.getByText(/graded questions correctly/);
  const checkButton = page.getByRole("button", { name: "Check answer" }).first();
  const nextButton = page.getByRole("button", { name: /^(Next|Finish)$/ }).first();

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await finishScreen.isVisible().catch(() => false)) break;

    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }

    if (await checkButton.isVisible().catch(() => false)) {
      const card = page.locator("section").filter({ has: checkButton }).first();
      const inputs = card.locator("textarea, input");
      const inputCount = await inputs.count();
      if (inputCount > 0) {
        for (let j = 0; j < inputCount; j++) {
          if (await inputs.nth(j).isVisible().catch(() => false)) {
            await inputs.nth(j).fill("been").catch(() => {});
          }
        }
      } else {
        const options = card.locator("button.px-4, button.rounded-full");
        const optionCount = Math.min(await options.count(), 16);
        for (let j = 0; j < optionCount; j++) {
          if (await options.nth(j).isEnabled().catch(() => false)) {
            await options.nth(j).click().catch(() => {});
          }
        }
      }
      if (await checkButton.isEnabled().catch(() => false)) {
        await checkButton.click().catch(() => {});
      }
      await page.waitForTimeout(300);
      continue;
    }

    await page.waitForTimeout(300);
  }

  await expect(finishScreen).toBeVisible();
  await expect(page.getByRole("link", { name: "All lessons" })).toBeVisible();
});
