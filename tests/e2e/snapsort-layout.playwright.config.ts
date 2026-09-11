// Layout-engine test suite: unit tests for the pure flow-layout simulation
// (tests/ut/core-layout.spec.ts) plus the drag-snapshot layout e2e spec across
// chromium, firefox, and webkit. Cross-browser coverage matters here more
// than anywhere else in the repo: the layout engine reconciles simulated
// sums with browser-measured geometry, and each engine quantizes layout
// differently (Blink/WebKit 1/64px; Gecko 1/60px app units with ~1e-5px
// getBoundingClientRect conversion noise).
//
// Run with: npm run test:layout
import { defineConfig } from "@playwright/test";
import {
  frameworkBrowserProjects,
  frameworkWebServers,
} from "./playwright-matrix";

export default defineConfig({
  testDir: "..",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  projects: [
    {
      name: "layout-ut",
      testMatch: ["ut/core-layout.spec.ts"],
    },
    ...frameworkBrowserProjects({
      frameworks: ["svelte"],
      browsers: ["chromium", "firefox", "webkit"],
      testMatch: ["e2e/snapsort-drag-snapshot.spec.ts"],
    }),
  ],
  webServer: frameworkWebServers(["svelte"]),
});
