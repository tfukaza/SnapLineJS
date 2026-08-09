import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websitePort = Number(process.env.SNAPSORT_PROMO_PORT ?? 4321);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  testDir: ".",
  testMatch: ["snapsort-promo.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    browserName: "chromium",
    baseURL: `http://127.0.0.1:${websitePort}`,
    viewport: { width: 1200, height: 1200 },
    screen: { width: 1200, height: 1200 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  webServer: {
    cwd: resolve(repoRoot, "website"),
    command: `npx vite dev --host 127.0.0.1 --port ${websitePort} --strictPort`,
    url: `http://127.0.0.1:${websitePort}/snapsort/gallery`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
