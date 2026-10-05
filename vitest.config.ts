import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Restricts vitest to tests/** so Playwright specs in e2e/ (also *.spec.ts)
 * are never picked up as unit tests. Only maps the `@/*` path alias.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
