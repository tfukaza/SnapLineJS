// Single source of truth for the snapsort Playwright test matrix: browser
// devices, framework demo servers, and the shared per-project settings.
// Every config builds its projects from here so all browsers and frameworks
// run tests under identical conditions (viewport, trace, screenshots) — add
// a browser or tweak an option in one place and every suite follows.
import { devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const BROWSERS = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;
export type BrowserName = keyof typeof BROWSERS;

export const FRAMEWORK_PORTS = {
  svelte: Number(process.env.SNAPSORT_SVELTE_TEST_PORT ?? 3027),
  react: Number(process.env.SNAPSORT_REACT_TEST_PORT ?? 3031),
} as const;
export type FrameworkName = keyof typeof FRAMEWORK_PORTS;

const sharedUse = {
  screenshot: "only-on-failure" as const,
  trace: "retain-on-failure" as const,
  viewport: { width: 1400, height: 950 },
};

/**
 * Cross product of frameworks x browsers as Playwright projects named
 * `<framework>-<browser>`, all running the same `testMatch` set.
 */
export function frameworkBrowserProjects(options: {
  frameworks: readonly FrameworkName[];
  browsers: readonly BrowserName[];
  testMatch: string[];
}) {
  return options.frameworks.flatMap((framework) =>
    options.browsers.map((browser) => ({
      name: `${framework}-${browser}`,
      testMatch: options.testMatch,
      use: {
        ...BROWSERS[browser],
        baseURL: `http://127.0.0.1:${FRAMEWORK_PORTS[framework]}`,
        ...sharedUse,
      },
    })),
  );
}

/** One vite demo server per framework, on that framework's fixed test port. */
export function frameworkWebServers(frameworks: readonly FrameworkName[]) {
  return frameworks.map((framework) => ({
    cwd: repoRoot,
    command:
      `npx vite serve demo/${framework} --config demo/${framework}/vite.config.mjs ` +
      `--host 127.0.0.1 --port ${FRAMEWORK_PORTS[framework]} --strictPort --force`,
    url: `http://127.0.0.1:${FRAMEWORK_PORTS[framework]}`,
    reuseExistingServer: false,
    timeout: 30_000,
  }));
}
