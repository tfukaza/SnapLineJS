// Website suite: site navigation, engine lifecycle across client routing, and
// the SnapSort landing page and documentation examples.
//
// Run with: npm run test:website
import { defineConfig } from "@playwright/test";
import {
  BROWSERS,
  PORTS,
  baseURL,
  sharedUse,
  websiteServer,
} from "../shared/servers";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...BROWSERS.chromium,
    ...sharedUse,
    baseURL: baseURL(PORTS.website),
  },
  webServer: websiteServer(PORTS.website),
});
