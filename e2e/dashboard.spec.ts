import { test, expect } from "@playwright/test";

test("dashboard shows plan stats and app nav", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("day streak")).toBeVisible();
  await expect(page.getByRole("link", { name: "AI Coach" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Learn", exact: true }).first()).toBeVisible();
});

test("theme toggle flips dark mode", async ({ page }) => {
  await page.goto("/dashboard");
  const html = page.locator("html");
  const wasDark = ((await html.getAttribute("class")) ?? "").includes("dark");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  if (wasDark) {
    await expect(html).not.toHaveClass(/dark/);
  } else {
    await expect(html).toHaveClass(/dark/);
  }
});

test("app nav navigates to lessons", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Learn", exact: true }).first().click();
  await page.waitForURL("**/lessons");
  await expect(page.getByRole("heading", { name: "Lessons", level: 1 })).toBeVisible();
});

test("account menu opens and navigates to progress", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Progress" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await Promise.all([
    page.waitForURL("**/progress"),
    page.getByRole("menuitem", { name: "Progress" }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible();
});
