// Single source of truth for the e2e suites: repo paths, browser devices,
// dev servers, and one port table. Each project config
// (tests/e2e/<project>/playwright.config.ts) builds its servers and projects
// from here, so every suite runs under the same conditions and no two
// configs ever compete for a port when run side by side.
import { devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/**
 * Vite `/@fs` URL of core's entry, for in-page `import()` so a test can reach
 * the same module instances (GlobalManager, containers) as the demo it drives.
 */
export const coreImportPath = `/@fs${repoRoot}/src/index.ts`;

export const BROWSERS = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;
export type BrowserName = keyof typeof BROWSERS;

export type FrameworkName = "svelte" | "react";

function port(envName: string, fallback: number): number {
  return Number(process.env[envName] ?? fallback);
}

/** Every dev server port used by the e2e suites; each is unique. */
export const PORTS = {
  core: port("CORE_E2E_PORT", 3040),
  assetBaseSvelte: port("ASSET_BASE_SVELTE_E2E_PORT", 3041),
  assetBaseReact: port("ASSET_BASE_REACT_E2E_PORT", 3042),
  snaplineSvelte: port("SNAPLINE_SVELTE_E2E_PORT", 3043),
  snaplineReact: port("SNAPLINE_REACT_E2E_PORT", 3044),
  snapsortSvelte: port("SNAPSORT_SVELTE_E2E_PORT", 3027),
  snapsortReact: port("SNAPSORT_REACT_E2E_PORT", 3031),
  snapsortLayout: port("SNAPSORT_LAYOUT_E2E_PORT", 3045),
} as const;

/** Failure artifacts every suite keeps. */
export const sharedUse = {
  screenshot: "only-on-failure" as const,
  trace: "retain-on-failure" as const,
};

export function baseURL(serverPort: number): string {
  return `http://127.0.0.1:${serverPort}`;
}

/** A vite dev server for one framework's demo app. */
export function demoServer(framework: FrameworkName, serverPort: number) {
  return {
    cwd: repoRoot,
    command:
      `npx vite serve demo/${framework} --config demo/${framework}/vite.config.mjs ` +
      `--host 127.0.0.1 --port ${serverPort} --strictPort --force`,
    url: baseURL(serverPort),
    reuseExistingServer: false,
    timeout: 30_000,
  };
}
