// SnapLine suite, one folder per feature (nodes, camera, edges, group,
// resize). Svelte runs every spec except `*.react.spec.ts`; React runs only
// the `*.react.spec.ts` adapter-parity specs.
//
// Run with: npm run test:snapline
import { defineConfig } from "@playwright/test";
import { PORTS, baseURL, demoServer, sharedUse } from "../shared/servers";

const use = {
  ...sharedUse,
  channel: "chrome",
  viewport: { width: 1280, height: 900 },
};

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  projects: [
    {
      name: "svelte",
      testIgnore: ["**/*.react.spec.ts"],
      use: { ...use, baseURL: baseURL(PORTS.snaplineSvelte) },
    },
    {
      name: "react",
      testMatch: ["**/*.react.spec.ts"],
      use: { ...use, baseURL: baseURL(PORTS.snaplineReact) },
    },
  ],
  webServer: [
    demoServer("svelte", PORTS.snaplineSvelte),
    demoServer("react", PORTS.snaplineReact),
  ],
});
