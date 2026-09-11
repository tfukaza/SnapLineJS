// Asset Base suite: camera control on both framework adapters, plus React
// context and ref wiring. `*.react.spec.ts` files run only on React.
//
// Run with: npm run test:asset-base
import { defineConfig } from "@playwright/test";
import { PORTS, baseURL, demoServer, sharedUse } from "../shared/servers";

const use = {
  ...sharedUse,
  channel: "chrome",
  viewport: { width: 1280, height: 820 },
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
      use: { ...use, baseURL: baseURL(PORTS.assetBaseSvelte) },
    },
    {
      name: "react",
      testIgnore: ["**/*.svelte.spec.ts"],
      use: { ...use, baseURL: baseURL(PORTS.assetBaseReact) },
    },
  ],
  webServer: [
    demoServer("svelte", PORTS.assetBaseSvelte),
    demoServer("react", PORTS.assetBaseReact),
  ],
});
