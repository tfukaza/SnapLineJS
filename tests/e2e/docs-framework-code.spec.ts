import { expect, test } from "@playwright/test";

test("SnapSort exposes one canonical Svelte overview entry", async ({
  page,
}) => {
  const response = await page.goto(
    "/docs/snapsort/reference/svelte?framework=svelte",
  );
  expect(response?.status()).toBe(200);

  const sidebar = page.locator(".doc-sidebar");
  await expect(sidebar.getByRole("heading", { name: "SnapSort" })).toHaveCount(
    1,
  );
  await expect(
    sidebar.getByRole("link", { name: "Svelte Overview", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: "Svelte API", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Svelte Overview" }),
  ).toHaveCount(1);
});

test("framework selector shows only its matching install code block", async ({
  page,
}) => {
  const response = await page.goto(
    "/docs/snapsort/introduction/01_setup?framework=svelte",
  );
  expect(response?.status()).toBe(200);
  await page.waitForFunction(
    () => localStorage.getItem("preferredCodeFramework") === "svelte",
  );

  const visibleInstallBlocks = page
    .locator(".framework-code-block:visible")
    .filter({
      hasText: "npm install",
    });

  await expect(visibleInstallBlocks).toHaveCount(1);
  await expect(visibleInstallBlocks).toContainText(
    "npm install @snap-engine/snapsort @snap-engine/asset-base",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/asset-base/svelte",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/snapsort/svelte",
  );

  await page.locator("#desktop-doc-framework").selectOption("react");

  await expect(page.locator(".doc-article")).toHaveAttribute(
    "data-framework",
    "react",
  );
  await expect(visibleInstallBlocks).toHaveCount(1);
  await expect(visibleInstallBlocks).toContainText(
    "npm install @snap-engine/snapsort @snap-engine/asset-base react react-dom",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/asset-base/react",
  );
  await expect(visibleInstallBlocks).not.toContainText(
    "@snap-engine/snapsort/react",
  );
});

test("coding-agent resource links bypass client-side routing", async ({
  page,
}) => {
  await page.goto("/docs/snapsort/introduction");

  const markdownLink = page.getByRole("link", {
    name: "this page as Markdown",
  });
  await expect(markdownLink).toHaveAttribute("data-sveltekit-reload", "");
  const markdownResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/docs/snapsort/introduction.md"),
  );
  await markdownLink.click();
  expect((await markdownResponsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/docs\/snapsort\/introduction\.md$/);

  await page.goto("/docs/snapsort/introduction");
  const indexLink = page.locator('a[href="/docs/snapsort/llms.txt"]');
  await expect(indexLink).toHaveAttribute("data-sveltekit-reload", "");
  const indexResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/docs/snapsort/llms.txt"),
  );
  await indexLink.click();
  expect((await indexResponsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/docs\/snapsort\/llms\.txt$/);
});

test("raw Markdown selects one framework without damaging fenced code", async ({
  request,
}) => {
  const svelteResponse = await request.get(
    "/docs/snapsort/introduction/01_setup.md",
  );
  expect(svelteResponse.status()).toBe(200);
  expect(svelteResponse.headers()["content-type"]).toContain("text/markdown");

  const svelteMarkdown = await svelteResponse.text();
  expect(svelteMarkdown).toContain("# Setup");
  expect(svelteMarkdown).toContain('```svelte\n<script lang="ts">');
  expect(svelteMarkdown).toContain("@snap-engine/snapsort/svelte");
  expect(svelteMarkdown).not.toContain("@snap-engine/snapsort/react");
  expect(svelteMarkdown).not.toContain("framework=Svelte");
  expect(svelteMarkdown).not.toContain("\nproject: snapsort\n");
  expect(svelteMarkdown).toContain(
    "npm install @snap-engine/snapsort @snap-engine/asset-base",
  );
  expect(svelteMarkdown).not.toContain("@snap-engine/snapsort-svelte");

  const reactResponse = await request.get(
    "/docs/snapsort/introduction/01_setup.md?framework=react",
  );
  expect(reactResponse.status()).toBe(200);
  const reactMarkdown = await reactResponse.text();
  expect(reactMarkdown).toContain("```tsx");
  expect(reactMarkdown).toContain("@snap-engine/snapsort/react");
  expect(reactMarkdown).not.toContain("@snap-engine/snapsort/svelte");
  expect(reactMarkdown).not.toContain("framework=React");

  const vanillaResponse = await request.get(
    "/docs/snapsort/introduction/01_setup.md?framework=vanilla",
  );
  expect(vanillaResponse.status()).toBe(200);
  const vanillaMarkdown = await vanillaResponse.text();
  expect(vanillaMarkdown).toContain("```javascript");
  expect(vanillaMarkdown).toContain("new CollisionEngine()");
  expect(vanillaMarkdown).not.toContain("@snap-engine/snapsort/react");
});

test("raw Markdown switches paired reference pages and cleans interactive MDX", async ({
  request,
}) => {
  const pairedResponse = await request.get(
    "/docs/snapsort/reference/svelte/container.md?framework=react",
  );
  expect(pairedResponse.status()).toBe(200);
  const pairedMarkdown = await pairedResponse.text();
  expect(pairedMarkdown).toContain("# Container");
  expect(pairedMarkdown).not.toContain("React Container component props");
  expect(pairedMarkdown).toContain("@snap-engine/snapsort/react");
  expect(pairedMarkdown).not.toContain("@snap-engine/snapsort/svelte");

  const svelteReferenceResponse = await request.get(
    "/docs/snapsort/reference/svelte/container.md",
  );
  expect(svelteReferenceResponse.status()).toBe(200);
  expect(await svelteReferenceResponse.text()).toContain(
    "`<Ghost {event}>...</Ghost>`",
  );

  const interactiveResponse = await request.get(
    "/docs/snapsort/guides/01_core_concepts.md",
  );
  expect(interactiveResponse.status()).toBe(200);
  const interactiveMarkdown = await interactiveResponse.text();
  expect(interactiveMarkdown).toContain("# Core Concepts");
  expect(interactiveMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(interactiveMarkdown).toContain(
    "https://snapengine.dev/docs/snapsort/guides/01_core_concepts",
  );
  expect(interactiveMarkdown).not.toContain("<SnapSortConceptsDiagram");
  expect(interactiveMarkdown).not.toContain("<SnapSortEntityCue");
  expect(interactiveMarkdown).not.toContain("<script>");
});

test("raw Markdown validates routes and framework values", async ({
  request,
}) => {
  const indexResponse = await request.get("/docs/snapsort/introduction.md");
  expect(indexResponse.status()).toBe(200);
  expect(await indexResponse.text()).toContain("# What is SnapSort?");

  const redirectedResponse = await request.get("/docs/snapsort.md", {
    maxRedirects: 0,
  });
  expect(redirectedResponse.status()).toBe(308);
  expect(redirectedResponse.headers().location).toBe(
    "/docs/snapsort/introduction.md",
  );

  const invalidFramework = await request.get(
    "/docs/snapsort/introduction/01_setup.md?framework=vue",
  );
  expect(invalidFramework.status()).toBe(400);

  const missingPage = await request.get("/docs/snapsort/not-a-page.md");
  expect(missingPage.status()).toBe(404);
});

test("SnapEngine browser support exposes its audited feature matrix", async ({
  page,
  request,
}) => {
  const response = await page.goto(
    "/docs/snapengine/introduction/09_browser_support",
  );
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Browser Support", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Chrome Android" }).first(),
  ).toBeVisible();

  const customVariableRow = page
    .getByRole("row")
    .filter({ hasText: "Custom $variable animation" });
  await expect(customVariableRow).toContainText("128+");
  await expect(customVariableRow).toContainText("16.4+");
  await expect(
    page.getByRole("link", { name: "CSS.registerProperty()" }).first(),
  ).toHaveAttribute(
    "href",
    "https://developer.mozilla.org/en-US/docs/Web/API/CSS/registerProperty_static",
  );

  const markdownResponse = await request.get(
    "/docs/snapengine/introduction/09_browser_support.md",
  );
  expect(markdownResponse.status()).toBe(200);
  const markdown = await markdownResponse.text();
  expect(markdown).toContain("# Browser Support");
  expect(markdown).toContain("| Custom `$variable` animation |");
  expect(markdown).toContain("MDN Browser Compatibility Data");
});

test("project llms.txt files expose ordered framework-aware Markdown trees", async ({
  request,
}) => {
  const snapSortResponse = await request.get("/docs/snapsort/llms.txt");
  expect(snapSortResponse.status()).toBe(200);
  expect(snapSortResponse.headers()["content-type"]).toContain("text/plain");
  const snapSortIndex = await snapSortResponse.text();
  expect(snapSortIndex).toContain("# SnapSort Documentation");
  expect(snapSortIndex.indexOf("## Introduction")).toBeLessThan(
    snapSortIndex.indexOf("## Guides"),
  );
  expect(snapSortIndex.indexOf("## Guides")).toBeLessThan(
    snapSortIndex.indexOf("## Reference"),
  );
  expect(snapSortIndex).toContain(
    "[Setup (Svelte)](https://snapengine.dev/docs/snapsort/introduction/01_setup.md?framework=svelte)",
  );
  expect(snapSortIndex).toContain(
    "[Setup (React)](https://snapengine.dev/docs/snapsort/introduction/01_setup.md?framework=react)",
  );
  expect(snapSortIndex).toContain(
    "[Setup (Vanilla JS)](https://snapengine.dev/docs/snapsort/introduction/01_setup.md?framework=vanilla)",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/svelte/container.md?framework=svelte",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/react/container.md?framework=react",
  );
  expect(snapSortIndex).not.toContain("/docs/snapengine/");
  expect(snapSortIndex).not.toContain("styleguide");

  const snapEngineResponse = await request.get("/docs/snapengine/llms.txt");
  expect(snapEngineResponse.status()).toBe(200);
  const snapEngineIndex = await snapEngineResponse.text();
  expect(snapEngineIndex).toContain("# SnapEngine Core Documentation");
  expect(snapEngineIndex).toContain(
    "https://snapengine.dev/docs/snapengine/introduction.md",
  );
  expect(snapEngineIndex).toContain(
    "https://snapengine.dev/docs/snapengine/introduction/09_browser_support.md",
  );
  expect(snapEngineIndex).toContain(
    "https://snapengine.dev/docs/snapengine/reference/engine.md",
  );
  expect(snapEngineIndex).not.toContain("/docs/snapsort/");
});

test("SnapLine docs expose framework switching, live demos, Markdown, and llms index", async ({
  page,
  request,
}) => {
  const response = await page.goto(
    "/docs/snapline/introduction/01_setup?framework=svelte",
  );
  expect(response?.status()).toBe(200);
  await page.waitForFunction(
    () => localStorage.getItem("preferredCodeFramework") === "svelte",
  );
  await expect(page.locator("#desktop-doc-framework")).toHaveValue("svelte");
  await expect(
    page.locator(".framework-code-block:visible").filter({
      hasText: "@snap-engine/snapline/svelte",
    }),
  ).toHaveCount(1);

  await page.locator("#desktop-doc-framework").selectOption("react");
  await expect(page.locator(".doc-article")).toHaveAttribute(
    "data-framework",
    "react",
  );
  await expect(
    page.locator(".framework-code-block:visible").filter({
      hasText: "@snap-engine/snapline/react",
    }),
  ).toHaveCount(1);

  await page.goto("/docs/snapline/guides/03_groups");
  await expect(page.locator(".snapline-demo")).toBeVisible();
  await expect(page.locator("[data-snapline-type='group']")).toHaveCount(2);
  await expect(page.getByText("Outer group", { exact: true })).toBeVisible();

  const markdown = await request.get(
    "/docs/snapline/guides/03_groups.md?framework=svelte",
  );
  expect(markdown.status()).toBe(200);
  const markdownText = await markdown.text();
  expect(markdownText).toContain("# Groups and nesting");
  expect(markdownText).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(markdownText).not.toContain("<SnapLineDemo");

  const llms = await request.get("/docs/snapline/llms.txt");
  expect(llms.status()).toBe(200);
  const llmsText = await llms.text();
  expect(llmsText).toContain("# SnapLine Documentation");
  expect(llmsText).toContain(
    "/docs/snapline/reference/svelte/group.md?framework=svelte",
  );
  expect(llmsText).toContain(
    "/docs/snapline/reference/react/group.md?framework=react",
  );
});
