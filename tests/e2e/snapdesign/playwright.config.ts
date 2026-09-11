// SnapDesign suite against the website: the Guideline page (including its
// server-rendered HTML) and the interactive Gallery.
//
// Run with: npm run test:snapdesign
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
    baseURL: baseURL(PORTS.snapdesign),
  },
  webServer: websiteServer(PORTS.snapdesign),
});
