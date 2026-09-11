// SnapSort suite on Chromium for both framework adapters. Shared specs run
// on Svelte and React; `*.svelte.spec.ts` / `*.react.spec.ts` run only on
// their framework. The layout-sensitive subset also runs cross-browser in
// layout.playwright.config.ts.
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
      testIgnore: ["**/*.react.spec.ts"],
      use: { ...use, baseURL: baseURL(PORTS.snapsortSvelte) },
    },
    {
      name: "react-chromium",
      testIgnore: ["**/*.svelte.spec.ts"],
      use: { ...use, baseURL: baseURL(PORTS.snapsortReact) },
    },
  ],
  webServer: [
    demoServer("svelte", PORTS.snapsortSvelte),
    demoServer("react", PORTS.snapsortReact),
  ],
});
