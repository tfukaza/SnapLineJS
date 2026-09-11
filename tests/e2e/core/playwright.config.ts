// Core engine suite: measurement under a real Camera across all three
// engines, since each quantizes layout differently.
//
// Run with: npm run test:core
import { defineConfig } from "@playwright/test";
import {
  BROWSERS,
  PORTS,
  baseURL,
  demoServer,
  sharedUse,
} from "../shared/servers";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...sharedUse,
    baseURL: baseURL(PORTS.core),
    viewport: { width: 1280, height: 900 },
  },
  projects: (["chromium", "firefox", "webkit"] as const).map((browser) => ({
    name: browser,
    use: { ...BROWSERS[browser], viewport: { width: 1280, height: 900 } },
  })),
  webServer: demoServer("svelte", PORTS.core),
});
