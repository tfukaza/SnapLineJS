// SnapSort layout-engine suite across Chromium, Firefox, and WebKit. Cross-
// browser coverage matters most here: the layout engine reconciles simulated
// sums with browser-measured geometry, and each engine quantizes layout
// differently (Blink/WebKit 1/64px; Gecko 1/60px app units with ~1e-5px
// getBoundingClientRect conversion noise). Also runs the pure layout-engine
// unit tests from tests/ut/core-layout.spec.ts.
//
// Run with: npm run test:layout
import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import {
  BROWSERS,
  PORTS,
  baseURL,
  demoServer,
  repoRoot,
  sharedUse,
} from "../shared/servers";

/** The layout-sensitive specs: everything that compares simulation to DOM. */
const layoutSpecs = [
  "layout/**/*.spec.ts",
  "drag/**/*.spec.ts",
  "animation/**/*.spec.ts",
  "nested/**/*.spec.ts",
  "components/framework-state.spec.ts",
  "insertion/insertion-marker.spec.ts",
  "ghosts/multi-item-ghosts.spec.ts",
];

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  projects: [
    {
      name: "layout-ut",
      testDir: resolve(repoRoot, "tests/ut"),
      testMatch: ["core-layout.spec.ts"],
    },
    ...(["chromium", "firefox", "webkit"] as const).map((browser) => ({
      name: `svelte-${browser}`,
      testMatch: layoutSpecs,
      use: {
        ...BROWSERS[browser],
        ...sharedUse,
        viewport: { width: 1400, height: 950 },
        baseURL: baseURL(PORTS.snapsortLayout),
      },
    })),
  ],
  webServer: demoServer("svelte", PORTS.snapsortLayout),
});
