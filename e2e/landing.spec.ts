import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("landing renders hero, nav and CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("English coach");
  await expect(page.getByRole("navigation", { name: "Landing" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await expect(page.getByText("pattern rules")).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle theme" })).toBeVisible();
});

test("protected pages redirect guests to login with next", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  expect(page.url()).toContain("next=%2Fdashboard");
  await expect(page.getByText("Learn English by speaking")).toBeVisible();
});

test("unknown routes show the custom 404", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("That page")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back home" })).toBeVisible();
});

test("faq accordion expands closed questions", async ({ page }) => {
  await page.goto("/#faq");
  const trigger = page.getByRole("button", { name: /Do I need to know my English level/ });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/three-minute placement check/)).toBeVisible();
});
