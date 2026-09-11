import { defineConfig } from "@playwright/test";
import {
  frameworkBrowserProjects,
  frameworkWebServers,
} from "./playwright-matrix";

// Firefox and WebKit stay out of this broad suite to keep local runs fast;
// the layout suite (snapsort-layout.playwright.config.ts) runs the layout
// spec on all three browsers.
const frameworks = ["svelte", "react"] as const;
const testMatch = [
  "snapsort-drag-snapshot.spec.ts",
  "snapsort-duolingo.spec.ts",
  "snapsort-adapter-ghosts.spec.ts",
  "snapsort-fail-safe.spec.ts",
  "snapsort-insertion-copy.spec.ts",
  "snapsort-item-api.spec.ts",
  "snapsort-callback-ledger.spec.ts",
];

const keyboardDemoProjects = frameworkBrowserProjects({
  frameworks: ["svelte"],
  browsers: ["chromium"],
  testMatch: ["snapsort-keyboard-demo.spec.ts"],
}).map((project) => ({
  ...project,
  name: `${project.name}-keyboard`,
}));

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  projects: [
    ...frameworkBrowserProjects({
      frameworks,
      browsers: ["chromium"],
      testMatch,
    }),
    ...keyboardDemoProjects,
  ],
  webServer: frameworkWebServers(frameworks),
});
