import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = 5191;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  testDir: ".",
  testMatch: [
    "docs-framework-code.spec.ts",
    "material-surface-ssr.spec.ts",
    "snapdesign-gallery-virtual-pointer.spec.ts",
    "snapdesign-control-matrix.spec.ts",
    "snapdesign-kanban-board.spec.ts",
    "snapdesign-precision-slider.spec.ts",
    "snapdesign-sideways-cards.spec.ts",
    "snapdesign-swap-controls.spec.ts",
    "snapdesign-toucan-lesson.spec.ts",
    "snapsort-landing-regression.spec.ts",
    "website-navigation.spec.ts",
    "website-engine-lifecycle.spec.ts",
  ],
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    cwd: resolve(repoRoot, "website"),
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
