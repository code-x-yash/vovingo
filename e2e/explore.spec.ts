import { test, expect } from "@playwright/test";

const PAGES = [
  "/",
  "/dashboard",
  "/progress",
  "/listening",
  "/mistakes",
  "/vocab",
  "/vocab/review",
  "/writing",
  "/conversation",
  "/placement",
  "/speedrun",
  "/phantom",
  "/bloopers",
  "/wrapped",
  "/leaderboard",
  "/settings",
  "/scripts",
  "/duel",
  "/story",
  "/stage",
];

test("core pages render for a fresh account", async ({ page }) => {
  test.setTimeout(120_000);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Known dev-only noise: Base UI warns that render=<Link> isn't a native button.
    if (text.includes("Base UI:")) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  for (const path of PAGES) {
    const resp = await page.goto(path);
    const status = resp?.status() ?? 0;
    expect(status, `${path} should not server-error`).toBeLessThan(500);
    if (status === 404) continue;

    await expect(page.locator("main, body").first()).toBeVisible();
    const h1 = page.locator("h1").first();
    await expect(h1, `${path} should render an h1`).toBeVisible({ timeout: 15_000 });
  }

  expect(consoleErrors, "no console/page errors across core pages").toEqual([]);
});
