import { defineConfig } from "@playwright/test";

/**
 * Unit tests: DOM-free (or JSDOM) specs under tests/ut, run in Node.
 *
 * `npm test` runs all of them; the `test:*-ut` scripts run one package's.
 * End-to-end suites live in tests/e2e/<project>/ with their own configs;
 * see the `test:<project>` scripts.
 */
export default defineConfig({
  testDir: "./tests/ut",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  projects: [{ name: "chromium" }],
});
