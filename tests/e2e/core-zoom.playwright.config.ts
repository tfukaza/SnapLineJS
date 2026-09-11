// Core measurement under a real zoomed Camera, across the three engines: each
// quantizes layout differently, and readDom must map every one of them into
// the same world-space box.
//
// Run with: npm run test:core-zoom
import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.CORE_ZOOM_TEST_PORT ?? 3034);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  testDir: ".",
  testMatch: "core-zoom.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    cwd: repoRoot,
    command: `npx vite serve demo/svelte --config demo/svelte/vite.config.mjs --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
