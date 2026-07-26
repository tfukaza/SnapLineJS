import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.SNAPLINE_REACT_TEST_PORT ?? 3030);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  testDir: ".",
  testMatch: [
    "node-react.spec.ts",
    "snapline-react-features.spec.ts",
    "snapline-edges-react.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    cwd: repoRoot,
    command: `npx vite serve demo/react --config demo/react/vite.config.mjs --host 127.0.0.1 --port ${port} --strictPort --force`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
