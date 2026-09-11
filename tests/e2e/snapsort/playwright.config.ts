// SnapSort suite on Chromium for both framework adapters. Shared specs run
// on Svelte and React; `*.svelte.spec.ts` / `*.react.spec.ts` run only on
// their framework. `layout/**` renders its own markup instead of a demo, so it
// runs only in layout.playwright.config.ts, which also repeats the
// layout-sensitive drag specs cross-browser.
//
// Run with: npm run test:snapsort
import { defineConfig } from "@playwright/test";
import {
  BROWSERS,
  PORTS,
  baseURL,
  demoServer,
  sharedUse,
} from "../shared/servers";

const use = {
  ...BROWSERS.chromium,
  ...sharedUse,
  viewport: { width: 1400, height: 950 },
};

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  projects: [
    {
      name: "svelte-chromium",
      testIgnore: ["layout/**", "**/*.react.spec.ts"],
      use: { ...use, baseURL: baseURL(PORTS.snapsortSvelte) },
    },
    {
      name: "react-chromium",
      testIgnore: ["layout/**", "**/*.svelte.spec.ts"],
      use: { ...use, baseURL: baseURL(PORTS.snapsortReact) },
    },
  ],
  webServer: [
    demoServer("svelte", PORTS.snapsortSvelte),
    demoServer("react", PORTS.snapsortReact),
  ],
});
