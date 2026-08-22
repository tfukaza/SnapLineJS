import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websitePort = Number(process.env.SNAPSORT_WEBSITE_TEST_PORT ?? 4317);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  testDir: ".",
  testMatch: ["snapsort-examples-features.spec.ts"],
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${websitePort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1400, height: 950 },
  },
  webServer: {
    cwd: resolve(repoRoot, "website"),
    command: `npx vite dev --host 127.0.0.1 --port ${websitePort} --strictPort`,
    url: `http://127.0.0.1:${websitePort}/docs/snapsort/examples/complete-interfaces`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
