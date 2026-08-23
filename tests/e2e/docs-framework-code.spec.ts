import { expect, test, type Locator, type Page } from "@playwright/test";
import { insertionTreeMarkerOptions } from "../../website/src/lib/components/docs/placement-modes/insertionTreeMarker";

async function dragBetween(
  page: Page,
  source: Locator,
  target: Locator,
  options: { beforeDrop?: () => Promise<void> } = {},
) {
  await source.scrollIntoViewIfNeeded();
  const [sourceBox, targetBox] = await Promise.all([
    source.boundingBox(),
    target.boundingBox(),
  ]);
  if (!sourceBox || !targetBox)
    throw new Error("Drag target has no layout box.");

  const sourcePoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const targetPoint = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  };

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(sourcePoint.x + 7, sourcePoint.y + 7);
  await page.waitForTimeout(60);
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.waitForTimeout(120);
  await options.beforeDrop?.();
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test("tree insertion marker options follow adjacent item geometry", () => {
  expect(
    insertionTreeMarkerOptions({
      gap: { orientation: "horizontal", x: 10, y: 40, length: 100 },
      previous: { rect: { x: 20, y: 10, width: 70, height: 30 } },
      next: null,
    }),
  ).toEqual({ thickness: 3, startInset: 10, endInset: 20 });

  expect(
    insertionTreeMarkerOptions({
      gap: { orientation: "horizontal", x: 10, y: 40, length: 100 },
      previous: null,
      next: { rect: { x: 0, y: 40, width: 80, height: 30 } },
    }),
  ).toEqual({ thickness: 3, startInset: 0, endInset: 30 });

  expect(
    insertionTreeMarkerOptions({
      gap: { orientation: "horizontal", x: 10, y: 40, length: 100 },
      previous: { rect: { x: 15, y: 10, width: 90, height: 30 } },
      next: { rect: { x: 25, y: 40, width: 60, height: 30 } },
    }),
  ).toEqual({ thickness: 3, startInset: 15, endInset: 25 });

  expect(
    insertionTreeMarkerOptions({
      gap: { orientation: "vertical", x: 40, y: 20, length: 120 },
      previous: { rect: { x: 10, y: 35, width: 30, height: 80 } },
      next: null,
    }),
  ).toEqual({ thickness: 3, startInset: 15, endInset: 25 });

  expect(
    insertionTreeMarkerOptions({
      gap: { orientation: "horizontal", x: 10, y: 40, length: 100 },
      previous: null,
      next: null,
    }),
  ).toEqual({ thickness: 3, startInset: 0, endInset: 0 });

  expect(
    insertionTreeMarkerOptions({
      gap: { orientation: "horizontal", x: 10, y: 40, length: 100 },
      previous: { rect: { x: 0, y: 10, width: 5, height: 30 } },
      next: { rect: { x: 120, y: 40, width: 20, height: 30 } },
    }),
  ).toEqual({ thickness: 3, startInset: 0, endInset: 0 });
});

test("core components demo reduces ghost teardown through the framework tree", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  const response = await page.goto("/docs/snapsort/guides/core-components");
  expect(response?.status()).toBe(200);

  const diagram = page.locator(".snapsort-concepts-diagram");
  const items = diagram.locator(".snapsort-concepts-item");
  await expect(items).toHaveCount(4);
  await dragBetween(page, items.first(), items.nth(1));

  await expect(diagram.locator(".snapsort-concepts-ghost")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("Drags and Ghosts guide demonstrates all four transient roles and cleanup", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  const response = await page.goto(
    "/docs/snapsort/guides/sessions/ghosts?framework=svelte",
    { waitUntil: "networkidle" },
  );
  expect(response?.status()).toBe(200);

  const flow = page.locator('[data-ghost-demo="flow-lifecycle"]');
  await dragBetween(
    page,
    flow.locator('[data-demo-item="ghost-flow-outline"]'),
    flow.locator('[data-demo-item="ghost-flow-review"]'),
    {
      beforeDrop: async () => {
        await expect(
          flow.locator('[data-snapsort-ghost-entry="target-spacer"]'),
        ).toHaveCount(1);
        await expect(
          flow.locator('[data-snapsort-ghost-entry="pointer-preview"]'),
        ).toHaveCount(1);
      },
    },
  );
  await expect(flow.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  await expect(flow.locator('[data-ghost-event="insert"]')).not.toHaveCount(0);
  await expect(flow.locator('[data-ghost-event="remove"]')).not.toHaveCount(0);

  const overlay = page.locator('[data-ghost-demo="overlay-channels"]');
  await dragBetween(
    page,
    overlay.locator('[data-demo-item="ghost-overlay-alpha"]'),
    overlay.locator('[data-demo-item="ghost-overlay-charlie"]'),
    {
      beforeDrop: async () => {
        await expect(
          overlay.locator('[data-snapsort-ghost-entry="source-spacer"]'),
        ).toHaveCount(1);
        await expect(
          overlay.locator('[data-snapsort-ghost-entry="insertion-marker"]'),
        ).toHaveCount(1);
      },
    },
  );
  await expect(overlay.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  await expect(
    overlay.locator('[data-ghost-type="insertion-marker"]'),
  ).not.toHaveCount(0);
  await expect(
    overlay.locator('[data-ghost-type="source-spacer"]'),
  ).not.toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("SnapSort guide routes use the new session hierarchy without legacy fallbacks", async ({
  request,
}) => {
  const currentSlugs = [
    "snapsort/guides/core-components",
    "snapsort/guides/placement-modes",
    "snapsort/guides/sessions/drag-start",
    "snapsort/guides/sessions/ghosts",
    "snapsort/guides/sessions/commit-and-cleanup",
    "snapsort/guides/sessions/drop-policies",
    "snapsort/examples",
    "snapsort/examples/basics",
    "snapsort/examples/containers",
    "snapsort/examples/items",
    "snapsort/examples/complete-interfaces",
    "snapsort/examples/advanced-settings-and-callbacks",
  ];
  const removedSlugs = [
    "snapsort/introduction/01_core_concepts",
    "snapsort/introduction/01_setup",
    "snapsort/guides/01_core_concepts",
    "snapsort/guides/02_placement_modes",
    "snapsort/guides/03_ghosts",
    "snapsort/guides/03_session_lifecycle",
    "snapsort/guides/04_drop_policies",
    "snapsort/guides/sessions/placement-modes",
    "snapsort/guides/sessions/advanced-settings-and-callbacks",
  ];

  for (const slug of currentSlugs) {
    for (const suffix of ["", ".md"]) {
      const path = `/docs/${slug}${suffix}`;
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  }

  for (const slug of removedSlugs) {
    for (const suffix of ["", ".md"]) {
      const path = `/docs/${slug}${suffix}`;
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }
  }

  const retiredGallery = await request.get("/snapsort/gallery", {
    maxRedirects: 0,
  });
  expect(retiredGallery.status()).toBe(404);

  const knownSource = await request.get(
    "/docs/snapsort/examples/source/todo-list",
  );
  expect(knownSource.status()).toBe(200);
  expect(knownSource.headers()["content-type"]).toContain("text/html");
  expect(await knownSource.text()).toContain('<pre class="display shiki');

  const unknownSource = await request.get(
    "/docs/snapsort/examples/source/not-an-example",
  );
  expect(unknownSource.status()).toBe(404);
});

test("SnapSort navigation orders Placement Modes, Drag Sessions, and Examples", async ({
  page,
  request,
}) => {
  for (const [path, destination] of [
    [
      "/docs/snapsort/guides/sessions",
      "/docs/snapsort/guides/sessions/drag-start",
    ],
    [
      "/docs/snapsort/guides/sessions.md",
      "/docs/snapsort/guides/sessions/drag-start.md",
    ],
    [
      "/docs/snapsort/guides/sessions?framework=react",
      "/docs/snapsort/guides/sessions/drag-start?framework=react",
    ],
    [
      "/docs/snapsort/guides/sessions.md?framework=react",
      "/docs/snapsort/guides/sessions/drag-start.md?framework=react",
    ],
  ]) {
    const redirectResponse = await request.get(path, { maxRedirects: 0 });
    expect(redirectResponse.status()).toBe(308);
    expect(redirectResponse.headers().location).toBe(destination);
  }

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.ok()).toBe(true);
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain(
    "https://snapengine.dev/docs/snapsort/guides/sessions/drag-start",
  );
  expect(sitemap).not.toContain(
    "<loc>https://snapengine.dev/docs/snapsort/guides/sessions</loc>",
  );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/snapsort/guides/sessions/drag-start?framework=svelte");
  await expect(page.locator(".doc-article > p").first()).toContainText(
    "DragSession",
  );
  const applicationBoundaryHeading = page.getByRole("heading", {
    name: "Application Boundary",
    level: 2,
  });
  const dragStartHeading = page.getByRole("heading", {
    name: "onDragStart",
    level: 2,
  });
  await expect(applicationBoundaryHeading).toBeVisible();
  await expect(dragStartHeading).toBeVisible();
  const [applicationBoundaryBox, dragStartBox] = await Promise.all([
    applicationBoundaryHeading.boundingBox(),
    dragStartHeading.boundingBox(),
  ]);
  expect(applicationBoundaryBox).not.toBeNull();
  expect(dragStartBox).not.toBeNull();
  expect(applicationBoundaryBox!.y).toBeLessThan(dragStartBox!.y);
  await expect(
    page.locator(".pagination-link.prev .pagination-title"),
  ).toHaveText("Placement Modes");
  await expect(
    page.locator(".pagination-link.next .pagination-title"),
  ).toHaveText("Drags and Ghosts");

  const response = await page.goto(
    "/docs/snapsort/guides/sessions/ghosts?framework=svelte",
    { waitUntil: "networkidle" },
  );
  expect(response?.status()).toBe(200);

  const guidesSection = page.locator(".doc-sidebar .sidebar-section", {
    has: page.locator(".section-title", { hasText: "Guides" }),
  });
  const topLevelItems = guidesSection.locator(
    ":scope > ul > li > :is(a, button)",
  );
  await expect(topLevelItems).toHaveText([
    "Core Components",
    "Placement Modes",
    "Drag Sessions",
    "Examples",
  ]);

  const sessionsButton = guidesSection.locator(
    ":scope > ul > li > button.doc-navigation-group",
    { hasText: "Drag Sessions" },
  );
  const sessionsNode = sessionsButton.locator("..");
  await expect(sessionsButton).toHaveClass(/ancestor/);
  await expect(sessionsButton).toHaveAttribute("aria-expanded", "true");
  await expect(sessionsButton).not.toHaveAttribute("href", /./);
  await expect(sessionsNode.locator(":scope > ul > li > a")).toHaveText([
    "Drag Start",
    "Drags and Ghosts",
    "Commit and Cleanup",
    "Programmatic Moves",
  ]);
  await expect(
    sessionsNode.locator('a[href="/docs/snapsort/guides/placement-modes"]'),
  ).toHaveCount(0);
  await expect(
    sessionsNode.locator(
      ':scope > ul > li > a[href="/docs/snapsort/guides/sessions/ghosts"]',
    ),
  ).toHaveAttribute("aria-current", "page");

  await sessionsButton.click();
  await expect(sessionsButton).toHaveAttribute("aria-expanded", "false");
  await expect(sessionsNode.locator(":scope > ul")).toBeHidden();
  await sessionsButton.click();
  await expect(sessionsButton).toHaveAttribute("aria-expanded", "true");
  await expect(sessionsNode.locator(":scope > ul")).toBeVisible();

  const examplesLink = guidesSection.locator(
    ':scope > ul > li > a[href="/docs/snapsort/examples"]',
  );
  const examplesNode = examplesLink.locator("..");
  await expect(examplesNode.locator(":scope > ul > li > a")).toHaveText([
    "Basics",
    "Container Recipes",
    "Item Recipes",
    "Complete Interfaces",
    "Advanced Session Settings and Callbacks",
  ]);

  const ghostsBreadcrumb = page.locator(".doc-breadcrumb");
  await expect(
    ghostsBreadcrumb.getByRole("link", { name: "Drag Sessions" }),
  ).toHaveCount(0);
  await expect(ghostsBreadcrumb).toContainText("Drag Sessions");
  await expect(ghostsBreadcrumb.locator('[aria-current="page"]')).toHaveText(
    "Drags and Ghosts",
  );
  await expect(
    page.locator(".pagination-link.prev .pagination-title"),
  ).toHaveText("Drag Start");
  await expect(
    page.locator(".pagination-link.next .pagination-title"),
  ).toHaveText("Commit and Cleanup");

  await page.goto("/docs/snapsort/guides/placement-modes?framework=svelte");
  const placementLink = guidesSection.locator(
    ':scope > ul > li > a[href="/docs/snapsort/guides/placement-modes"]',
  );
  await expect(placementLink).toHaveAttribute("aria-current", "page");
  await expect(sessionsButton).not.toHaveClass(/ancestor/);

  const placementBreadcrumb = page.locator(".doc-breadcrumb");
  await expect(placementBreadcrumb).toContainText("Guides");
  await expect(placementBreadcrumb.locator('[aria-current="page"]')).toHaveText(
    "Placement Modes",
  );
  await expect(
    placementBreadcrumb.getByRole("link", { name: "Drag Sessions" }),
  ).toHaveCount(0);

  await page.goto("/docs/snapsort/examples/containers?framework=svelte");
  await expect(examplesLink).toHaveClass(/ancestor/);
  await expect(
    examplesNode.locator(
      ':scope > ul > li > a[href="/docs/snapsort/examples/containers"]',
    ),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.locator(".doc-breadcrumb").getByRole("link", { name: "Examples" }),
  ).toHaveAttribute("href", "/docs/snapsort/examples");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapsort/guides/sessions/ghosts?framework=svelte", {
    waitUntil: "networkidle",
  });
  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const mobileNavigationTrigger = primaryNav.getByRole("button", {
    name: "Toggle navigation",
  });
  await mobileNavigationTrigger.click();
  await expect(mobileNavigationTrigger).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  const mobileDocs = primaryNav.locator(".mobile-doc-navigation");
  await expect(mobileDocs).toBeVisible();
  await expect(mobileDocs).toContainText("SnapSort docs");
  const mobileGuides = mobileDocs.locator(".mobile-doc-section", {
    has: page.locator(".mobile-doc-section-title", {
      hasText: "Guides",
    }),
  });
  await expect(
    mobileGuides.locator(":scope > ul > li > :is(a, button)"),
  ).toHaveText([
    "Core Components",
    "Placement Modes",
    "Drag Sessions",
    "Examples",
  ]);
  const mobileSessionsButton = mobileGuides.locator(
    ":scope > ul > li > button.mobile-doc-group",
    { hasText: "Drag Sessions" },
  );
  const mobileSessionsNode = mobileSessionsButton.locator("..");
  await expect(mobileSessionsButton).toHaveAttribute("aria-expanded", "true");
  await expect(mobileSessionsNode.locator(":scope > ul > li > a")).toHaveText([
    "Drag Start",
    "Drags and Ghosts",
    "Commit and Cleanup",
    "Programmatic Moves",
  ]);
  await expect(
    mobileSessionsNode.locator(
      'a[href="/docs/snapsort/guides/placement-modes"]',
    ),
  ).toHaveCount(0);

  await mobileSessionsButton.click();
  await expect(mobileSessionsButton).toHaveAttribute("aria-expanded", "false");
  await expect(mobileSessionsNode.locator(":scope > ul")).toBeHidden();
  await expect(mobileNavigationTrigger).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await mobileSessionsButton.click();
  await expect(mobileSessionsButton).toHaveAttribute("aria-expanded", "true");
  await expect(mobileSessionsNode.locator(":scope > ul")).toBeVisible();

  const mobileExamplesLink = mobileGuides.locator(
    ':scope > ul > li > a[href="/docs/snapsort/examples"]',
  );
  await expect(
    mobileExamplesLink.locator("..").locator(":scope > ul > li > a"),
  ).toHaveText([
    "Basics",
    "Container Recipes",
    "Item Recipes",
    "Complete Interfaces",
    "Advanced Session Settings and Callbacks",
  ]);
});

test("SnapSort example source tabs recover from a failed lazy request", async ({
  page,
}) => {
  let sourceAttempts = 0;
  await page.route(
    "**/docs/snapsort/examples/source/container-intro-basic",
    async (route) => {
      sourceAttempts += 1;
      if (sourceAttempts === 1) {
        await route.fulfill({ status: 503, body: "Unavailable" });
        return;
      }
      await route.continue();
    },
  );

  await page.goto("/docs/snapsort/examples/basics", {
    waitUntil: "networkidle",
  });
  expect(sourceAttempts).toBe(0);

  const example = page.locator('[data-demo-code-tabs="container-intro-basic"]');
  await example.getByRole("tab", { name: "Svelte source" }).click();
  await expect(example.getByRole("alert")).toContainText(
    "Could not load the Svelte source.",
  );
  await example.getByRole("button", { name: "Retry" }).click();
  await expect(example.locator("pre.shiki.display")).toHaveCount(1);
  expect(sourceAttempts).toBe(2);
});

test("article outlines expose Markdown headings without demo internals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/snapsort/guides/placement-modes?framework=svelte");

  const rail = page.locator('[data-article-outline="rail"]');
  const inline = page.locator('[data-article-outline="inline"]');
  await expect(rail).toBeVisible();
  await expect(inline).toBeHidden();
  const desktopOutlineGeometry = await page.evaluate(() => {
    const content = document.querySelector(".doc-content");
    const outline = document.querySelector('[data-article-outline="rail"]');
    if (
      !(content instanceof HTMLElement) ||
      !(outline instanceof HTMLElement)
    ) {
      throw new Error("Missing desktop documentation outline geometry");
    }

    const contentRect = content.getBoundingClientRect();
    const outlineRect = outline.getBoundingClientRect();
    return {
      contentRight: contentRect.right,
      outlineLeft: outlineRect.left,
    };
  });
  expect(desktopOutlineGeometry.outlineLeft).toBeGreaterThanOrEqual(
    desktopOutlineGeometry.contentRight - 1,
  );
  await expect(rail.locator("a")).toHaveText([
    "Euclidean",
    "Insertion",
    "Swap",
    "Progressive",
  ]);
  await expect(rail.locator('[data-outline-depth="2"]')).toHaveCount(4);
  await expect(rail.locator('[data-outline-depth="3"]')).toHaveCount(0);

  for (const [title, id] of [
    ["Euclidean", "euclidean"],
    ["Insertion", "insertion"],
    ["Swap", "swap"],
    ["Progressive", "progressive"],
  ]) {
    await expect(
      rail.getByRole("link", { name: title, exact: true }),
    ).toHaveAttribute("href", `#${id}`);
    await expect(page.locator(`h2#${id}`)).toHaveCount(1);
  }

  await rail.getByRole("link", { name: "Insertion", exact: true }).click();
  await expect(page).toHaveURL(/#insertion$/);
  await expect(page.locator("h2#insertion")).toBeInViewport();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(
    rail.getByRole("link", { name: "Progressive", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  expect(new URL(page.url()).hash).toBe("#insertion");

  await page.goto("/docs/snapsort/guides/sessions/ghosts?framework=svelte");
  const ghostsRail = page.locator('[data-article-outline="rail"]');
  await expect(
    page.getByRole("heading", { name: "Active ghosts", level: 3 }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Lifecycle ledger", level: 3 }),
  ).toHaveCount(2);
  await expect(
    ghostsRail.getByRole("link", { name: "Active ghosts" }),
  ).toHaveCount(0);
  await expect(
    ghostsRail.getByRole("link", { name: "Lifecycle ledger" }),
  ).toHaveCount(0);

  await page.goto("/docs/snapsort/reference/svelte/item?framework=svelte");
  const itemRail = page.locator('[data-article-outline="rail"]');
  const childrenLinks = itemRail.getByRole("link", {
    name: "children",
    exact: true,
  });
  await expect(childrenLinks).toHaveCount(2);
  await expect(childrenLinks.nth(0)).toHaveAttribute("href", "#children");
  await expect(childrenLinks.nth(1)).toHaveAttribute("href", "#children-1");
  await expect(page.locator("h3#children")).toHaveCount(1);
  await expect(page.locator("h3#children-1")).toHaveCount(1);

  await page.goto(
    "/docs/snapsort/reference/react/container?framework=react#callbacks",
  );
  await expect(page.locator("h2#callbacks")).toBeInViewport();

  await page.goto("/docs/snapsort/introduction");
  await expect(page.locator("[data-article-outline]")).toHaveCount(0);

  await page.goto("/docs");
  const docsHomeRail = page.locator('[data-article-outline="rail"]');
  await expect(page.locator(".doc-sidebar")).toHaveCount(0);
  await expect(page.locator(".doc-breadcrumb")).toHaveText("Docs");
  await expect(docsHomeRail).toBeVisible();
  await expect(docsHomeRail.locator("a")).toHaveText([
    "SnapEngine Core",
    "Assets",
    "SnapSort",
    "SnapLine",
    "SnapZap",
  ]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapsort/guides/placement-modes?framework=svelte", {
    waitUntil: "networkidle",
  });
  const mobileRail = page.locator('[data-article-outline="rail"]');
  const mobileInline = page.locator('[data-article-outline="inline"]');
  await expect(mobileRail).toBeHidden();
  await expect(mobileInline).toBeVisible();
  const outlineSummary = mobileInline.locator("summary");
  await outlineSummary.focus();
  await expect(outlineSummary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(mobileInline).toHaveAttribute("open", "");
  await expect(mobileInline.locator("a")).toHaveText([
    "Euclidean",
    "Insertion",
    "Swap",
    "Progressive",
  ]);
  await mobileInline
    .getByRole("link", { name: "Insertion", exact: true })
    .click();
  await expect(mobileInline).not.toHaveAttribute("open", "");
  await expect(outlineSummary).toBeFocused();
  await expect(page.locator("h2#insertion")).toBeInViewport();
  const mobilePageWidth = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(mobilePageWidth.scrollWidth).toBeLessThanOrEqual(
    mobilePageWidth.clientWidth,
  );
});

test("insertion placement demo moves items through a nested layers tree", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/docs/snapsort/guides/placement-modes?framework=svelte", {
    waitUntil: "networkidle",
  });

  const demo = page.locator(".insertion-demo-tree");
  await expect(page.locator(".euclidean-demo-list")).toHaveCount(2);
  await expect(page.locator(".progressive-demo-list")).toHaveCount(1);
  await expect(page.locator(".swap-demo-list")).toHaveCount(1);
  const unaffectedLabels = await Promise.all([
    page.locator(".euclidean-demo-list").allTextContents(),
    page.locator(".progressive-demo-list").allTextContents(),
    page.locator(".swap-demo-list").allTextContents(),
  ]);
  await expect(demo.locator(".insertion-tree-row")).toHaveCount(8);
  await expect(demo.locator(".insertion-tree-label")).toHaveText([
    "Item 1",
    "Item 2",
    "Item 3",
    "Item 4",
    "Item 5",
    "Item 6",
    "Item 7",
    "Item 8",
  ]);
  await expect(demo.locator(".insertion-tree-group")).toHaveCount(2);
  await expect(demo.locator(":scope > .insertion-tree-item")).toHaveCount(3);
  await expect(demo.locator(":scope > .insertion-tree-group")).toHaveCount(1);

  const labelOffsets = await Promise.all(
    ["one", "four", "seven"].map((itemId) =>
      demo
        .locator(
          `[data-snapsort-item-id="${itemId}"] .insertion-tree-label, [data-placement-tree-id="${itemId}"] > .insertion-tree-row .insertion-tree-label`,
        )
        .boundingBox(),
    ),
  );
  expect(labelOffsets.every(Boolean)).toBe(true);
  expect(labelOffsets[1]!.x).toBeGreaterThan(labelOffsets[0]!.x);
  expect(labelOffsets[2]!.x).toBeGreaterThan(labelOffsets[1]!.x);

  const itemEight = demo.locator('[data-snapsort-item-id="eight"]');
  const itemFour = demo.locator('[data-snapsort-item-id="four"]');
  const itemSeven = demo.locator('[data-snapsort-item-id="seven"]');
  const [initialItemEightBox, initialItemFourBox] = await Promise.all([
    itemEight.boundingBox(),
    itemFour.boundingBox(),
  ]);
  expect(initialItemEightBox).not.toBeNull();
  expect(initialItemFourBox).not.toBeNull();
  const sharedVirtualLeft =
    initialItemFourBox!.x +
    initialItemFourBox!.width / 2 -
    initialItemEightBox!.width / 2;
  await expect(
    demo
      .locator('[data-placement-tree-id="six"]')
      .locator('[data-snapsort-item-id="seven"]'),
  ).toHaveCount(1);
  let firstLevelMarkerBox: Awaited<ReturnType<Locator["boundingBox"]>> = null;
  let firstLevelNeighborBox: Awaited<ReturnType<Locator["boundingBox"]>> = null;
  let firstLevelDotBox: Awaited<ReturnType<Locator["boundingBox"]>> = null;
  await dragBetween(page, itemEight, itemFour, {
    beforeDrop: async () => {
      const marker = demo.locator('[data-snapsort-ghost="insertion"]');
      const dot = marker.locator(".insertion-tree-marker-dot");
      await expect(marker).toHaveCount(1);
      await expect(marker).toHaveAttribute("data-tree-marker-hidden", "false");
      await expect(marker).toHaveCSS("visibility", "visible");
      await expect(dot).toHaveAttribute("aria-hidden", "true");
      [firstLevelMarkerBox, firstLevelNeighborBox, firstLevelDotBox] =
        await Promise.all([
          marker.boundingBox(),
          itemFour.boundingBox(),
          dot.boundingBox(),
        ]);
    },
  });

  await expect(
    demo
      .locator('[data-placement-tree-id="three"]')
      .locator('[data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);
  await dragBetween(
    page,
    itemEight,
    demo.locator('[data-snapsort-item-id="two"]'),
  );
  await expect(
    demo.locator(':scope > [data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);

  const [alternateSourceBox, alternateTargetBox, alternateGroupBox] =
    await Promise.all([
      itemEight.boundingBox(),
      itemFour.boundingBox(),
      demo.locator('[data-placement-tree-id="three"]').boundingBox(),
    ]);
  expect(alternateSourceBox).not.toBeNull();
  expect(alternateTargetBox).not.toBeNull();
  expect(alternateGroupBox).not.toBeNull();
  const alternateGrabOffset = alternateSourceBox!.width - 2;
  const alternatePointerX = sharedVirtualLeft + alternateGrabOffset;
  expect(sharedVirtualLeft).toBeGreaterThanOrEqual(alternateGroupBox!.x);
  expect(alternatePointerX).toBeGreaterThan(
    alternateGroupBox!.x + alternateGroupBox!.width,
  );
  const alternateStart = {
    x: alternateSourceBox!.x + alternateGrabOffset,
    y: alternateSourceBox!.y + alternateSourceBox!.height / 2,
  };
  await page.mouse.move(alternateStart.x, alternateStart.y);
  await page.mouse.down();
  await page.mouse.move(alternateStart.x + 7, alternateStart.y + 7);
  await page.waitForTimeout(60);
  await page.mouse.move(
    alternatePointerX,
    alternateTargetBox!.y + alternateTargetBox!.height / 2,
    { steps: 12 },
  );
  await page.waitForTimeout(120);
  const offsetAwareMarker = demo.locator(
    '[data-placement-tree-id="three"] > [data-snapsort-ghost="insertion"]',
  );
  await expect(offsetAwareMarker).toHaveCount(1);
  const offsetAwareMarkerBox = await offsetAwareMarker.boundingBox();
  expect(offsetAwareMarkerBox).not.toBeNull();
  expect(offsetAwareMarkerBox!.x).toBeCloseTo(firstLevelMarkerBox!.x, 0);
  expect(offsetAwareMarkerBox!.width).toBeCloseTo(
    firstLevelMarkerBox!.width,
    0,
  );
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(
    demo
      .locator('[data-placement-tree-id="three"]')
      .locator('[data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);

  await dragBetween(
    page,
    itemEight,
    demo.locator('[data-snapsort-item-id="two"]'),
  );
  await expect(
    demo.locator(':scope > [data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);

  let secondLevelMarkerBox: Awaited<ReturnType<Locator["boundingBox"]>> = null;
  let secondLevelNeighborBox: Awaited<ReturnType<Locator["boundingBox"]>> =
    null;
  await dragBetween(page, itemEight, itemSeven, {
    beforeDrop: async () => {
      const marker = demo.locator('[data-snapsort-ghost="insertion"]');
      await expect(marker).toHaveCount(1);
      [secondLevelMarkerBox, secondLevelNeighborBox] = await Promise.all([
        marker.boundingBox(),
        itemSeven.boundingBox(),
      ]);
    },
  });
  await expect(
    demo
      .locator('[data-placement-tree-id="six"]')
      .locator('[data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);

  for (const [markerBox, neighborBox] of [
    [firstLevelMarkerBox, firstLevelNeighborBox],
    [secondLevelMarkerBox, secondLevelNeighborBox],
  ]) {
    expect(markerBox).not.toBeNull();
    expect(neighborBox).not.toBeNull();
    expect(Math.abs(markerBox!.x - neighborBox!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        markerBox!.x + markerBox!.width - (neighborBox!.x + neighborBox!.width),
      ),
    ).toBeLessThanOrEqual(1);
  }
  expect(secondLevelMarkerBox!.x).toBeGreaterThan(firstLevelMarkerBox!.x);
  expect(secondLevelMarkerBox!.width).toBeLessThan(firstLevelMarkerBox!.width);
  expect(firstLevelMarkerBox!.height).toBeCloseTo(3, 0);
  expect(firstLevelDotBox).not.toBeNull();
  expect(firstLevelDotBox!.width).toBeCloseTo(7, 0);
  expect(firstLevelDotBox!.height).toBeCloseTo(7, 0);
  expect(firstLevelDotBox!.x).toBeGreaterThanOrEqual(firstLevelMarkerBox!.x);
  expect(firstLevelDotBox!.x + firstLevelDotBox!.width).toBeLessThanOrEqual(
    firstLevelMarkerBox!.x + firstLevelMarkerBox!.width,
  );
  await expect(demo.locator("[data-snapsort-ghost]")).toHaveCount(0);
  await expect(page.locator(".euclidean-demo-list")).toHaveText(
    unaffectedLabels[0],
  );
  await expect(page.locator(".progressive-demo-list")).toHaveText(
    unaffectedLabels[1],
  );
  await expect(page.locator(".swap-demo-list")).toHaveText(unaffectedLabels[2]);

  await dragBetween(
    page,
    itemEight,
    demo.locator('[data-snapsort-item-id="two"]'),
  );
  await expect(
    demo.locator(':scope > [data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);

  const itemThreeRow = demo.locator(
    '[data-placement-tree-id="three"] > .insertion-tree-group-row',
  );
  const itemSixRow = demo.locator(
    '[data-placement-tree-id="six"] > .insertion-tree-group-row',
  );
  const groupThree = demo.locator('[data-placement-tree-id="three"]');
  const groupSix = demo.locator('[data-placement-tree-id="six"]');
  const moveHeldPointerTo = async (target: Locator) => {
    const box = await target.boundingBox();
    if (!box) throw new Error("Held-drag target has no layout box.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 8,
    });
    await page.waitForTimeout(120);
  };

  await page.evaluate(() => {
    document.addEventListener(
      "pointerdown",
      (event) => {
        document.documentElement.dataset.testActivePointerId = String(
          event.pointerId,
        );
      },
      { capture: true, once: true },
    );
  });
  const [cancelSourceBox, cancelTargetBox] = await Promise.all([
    itemEight.boundingBox(),
    itemThreeRow.boundingBox(),
  ]);
  expect(cancelSourceBox).not.toBeNull();
  expect(cancelTargetBox).not.toBeNull();
  await page.mouse.move(
    cancelSourceBox!.x + cancelSourceBox!.width / 2,
    cancelSourceBox!.y + cancelSourceBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(cancelSourceBox!.x + 7, cancelSourceBox!.y + 7);
  await moveHeldPointerTo(itemThreeRow);
  await expect(groupThree).toHaveAttribute(
    "data-tree-group-highlighted",
    "true",
  );
  await expect(demo.locator('[data-snapsort-ghost="insertion"]')).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.evaluate(
    ({ x, y }) => {
      const pointerId = Number(
        document.documentElement.dataset.testActivePointerId,
      );
      document.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          buttons: 0,
          clientX: x,
          clientY: y,
          pointerId,
          pointerType: "mouse",
        }),
      );
      delete document.documentElement.dataset.testActivePointerId;
    },
    {
      x: cancelTargetBox!.x + cancelTargetBox!.width / 2,
      y: cancelTargetBox!.y + cancelTargetBox!.height / 2,
    },
  );
  await page.mouse.up();
  await page.waitForTimeout(150);
  await expect(groupThree).toHaveAttribute(
    "data-tree-group-highlighted",
    "false",
  );
  await expect(demo.locator("[data-snapsort-ghost]")).toHaveCount(0);
  await expect(
    demo.locator(':scope > [data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);

  await dragBetween(page, itemEight, itemThreeRow, {
    beforeDrop: async () => {
      const marker = demo.locator('[data-snapsort-ghost="insertion"]');
      await expect(groupThree).toHaveAttribute(
        "data-tree-group-highlighted",
        "true",
      );
      await expect(marker).toHaveCount(1);
      await expect(marker).toHaveAttribute("data-tree-marker-hidden", "true");
      await expect(marker).toHaveCSS("visibility", "hidden");
      await expect(marker.locator(".insertion-tree-marker-dot")).toHaveCount(1);

      await moveHeldPointerTo(itemFour);
      await expect(groupThree).toHaveAttribute(
        "data-tree-group-highlighted",
        "false",
      );
      await expect(marker).toHaveAttribute("data-tree-marker-hidden", "false");
      await expect(marker).toHaveCSS("visibility", "visible");

      await moveHeldPointerTo(itemThreeRow);
      await expect(groupThree).toHaveAttribute(
        "data-tree-group-highlighted",
        "true",
      );
      await expect(marker).toHaveCSS("visibility", "hidden");
    },
  });
  await expect(
    groupThree.locator('[data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);
  await expect(groupThree).toHaveAttribute(
    "data-tree-group-highlighted",
    "false",
  );
  await expect(demo.locator("[data-snapsort-ghost]")).toHaveCount(0);

  await dragBetween(
    page,
    itemEight,
    demo.locator('[data-snapsort-item-id="two"]'),
  );
  await expect(
    demo.locator(':scope > [data-snapsort-item-id="eight"]'),
  ).toHaveCount(1);

  await dragBetween(page, itemEight, itemSixRow, {
    beforeDrop: async () => {
      const marker = demo.locator('[data-snapsort-ghost="insertion"]');
      await expect(groupSix).toHaveAttribute(
        "data-tree-group-highlighted",
        "true",
      );
      await expect(marker).toHaveCount(1);
      await expect(marker).toHaveAttribute("data-tree-marker-hidden", "true");
      await expect(marker).toHaveCSS("visibility", "hidden");
    },
  });
  await expect(groupSix.locator('[data-snapsort-item-id="eight"]')).toHaveCount(
    1,
  );
  await expect(groupSix).toHaveAttribute(
    "data-tree-group-highlighted",
    "false",
  );
  await expect(demo.locator("[data-snapsort-ghost]")).toHaveCount(0);

  await dragBetween(page, itemThreeRow, itemSeven);
  await expect(
    demo
      .locator('[data-placement-tree-id="six"]')
      .locator('[data-placement-tree-id="three"]'),
  ).toHaveCount(0);
  await expect(demo.locator("[data-snapsort-ghost]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const pageWidth = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth);
});

test("SnapSort reference exposes paired Ghost pages and shared policies", async ({
  page,
  request,
}) => {
  for (const slug of [
    "snapsort/reference/svelte/ghost",
    "snapsort/reference/react/ghost",
    "snapsort/reference/drag-session",
    "snapsort/reference/callbacks",
  ]) {
    for (const suffix of ["", ".md"]) {
      const response = await request.get(`/docs/${slug}${suffix}`);
      expect(response.status(), `${slug}${suffix}`).toBe(200);
    }
  }

  const referenceOverviewResponse = await request.get(
    "/docs/snapsort/reference.md",
  );
  expect(referenceOverviewResponse.status()).toBe(200);
  const referenceOverview = await referenceOverviewResponse.text();
  expect(referenceOverview).toContain("/docs/snapsort/reference/svelte/ghost");
  expect(referenceOverview).toContain("/docs/snapsort/reference/react/ghost");
  expect(referenceOverview).toContain("/docs/snapsort/reference/drag-session");
  expect(referenceOverview).toContain("/docs/snapsort/reference/callbacks");

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  for (const slug of [
    "snapsort/reference/svelte/ghost",
    "snapsort/reference/react/ghost",
    "snapsort/reference/drag-session",
    "snapsort/reference/callbacks",
  ]) {
    expect(sitemap).toContain(`https://snapengine.dev/docs/${slug}`);
  }

  const response = await page.goto(
    "/docs/snapsort/reference/svelte?framework=svelte",
  );
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(
    /\/docs\/snapsort\/reference\/svelte\/container(?:\?framework=svelte)?$/,
  );

  const sidebar = page.locator(".doc-sidebar");
  await expect(sidebar.getByText("SnapSort", { exact: true })).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: "Container", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: "Item", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: "Ghost", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: "DragSession", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: "Standard Callbacks", exact: true }),
  ).toHaveCount(1);
  await expect(
    sidebar.getByRole("link", { name: /Svelte (?:Overview|API)/ }),
  ).toHaveCount(0);

  const referenceTitle = sidebar.getByText("Reference", { exact: true });
  const containerLink = sidebar.getByRole("link", {
    name: "Container",
    exact: true,
  });
  const [titleBox, linkBox] = await Promise.all([
    referenceTitle.boundingBox(),
    containerLink.boundingBox(),
  ]);
  expect(titleBox).not.toBeNull();
  expect(linkBox).not.toBeNull();
  expect(linkBox!.x).toBeCloseTo(titleBox!.x, 0);

  await page.goto("/docs/snapsort/reference/svelte/ghost?framework=svelte", {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", { name: "Component Properties", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ghost Roles", level: 2 }),
  ).toBeVisible();
  await expect(
    page.locator(".pagination-link.prev .pagination-title"),
  ).toHaveText("Item");
  await expect(
    page.locator(".pagination-link.next .pagination-title"),
  ).toHaveText("DragSession");

  await page.locator("#desktop-doc-framework").selectOption("react");
  await expect(page).toHaveURL(
    /\/docs\/snapsort\/reference\/react\/ghost\?framework=react$/,
  );
  await expect(page.getByRole("article")).toContainText(
    'import { Ghost } from "@snap-engine/snapsort/react"',
  );
  await expect(
    page
      .locator(".doc-sidebar")
      .getByRole("link", { name: "Ghost", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/docs/snapsort/reference/drag-session?framework=vanilla", {
    waitUntil: "networkidle",
  });
  const vanillaReference = page.locator(".doc-sidebar .sidebar-section", {
    has: page.locator(".section-title", { hasText: "Reference" }),
  });
  await expect(vanillaReference.locator(":scope > ul > li > a")).toHaveText([
    "DragSession",
    "Standard Callbacks",
  ]);
  await expect(
    page.getByRole("heading", { name: "Status Lifecycle", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "dragVisual", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "dropEffect", level: 2 }),
  ).toBeVisible();

  const pairedMarkdownResponse = await request.get(
    "/docs/snapsort/reference/svelte/ghost.md?framework=react",
  );
  expect(pairedMarkdownResponse.status()).toBe(200);
  const pairedMarkdown = await pairedMarkdownResponse.text();
  expect(pairedMarkdown).toContain("# Ghost");
  expect(pairedMarkdown).toContain("@snap-engine/snapsort/react");
  expect(pairedMarkdown).not.toContain("@snap-engine/snapsort/svelte");
  expect(pairedMarkdown).toContain("## Ghost Roles");
  expect(pairedMarkdown).toContain("`source-spacer`");
  expect(pairedMarkdown).toContain("`pointer-preview`");

  const sessionMarkdownResponse = await request.get(
    "/docs/snapsort/reference/drag-session.md?framework=react",
  );
  expect(sessionMarkdownResponse.status()).toBe(200);
  const sessionMarkdown = await sessionMarkdownResponse.text();
  expect(sessionMarkdown).toContain("# DragSession");
  expect(sessionMarkdown).toContain('type DragSessionStatus = "pending"');
  expect(sessionMarkdown).toContain("## `dragVisual`");
  expect(sessionMarkdown).toContain("## Deprecated `handoff`");

  const callbacksResponse = await page.goto(
    "/docs/snapsort/reference/callbacks?framework=vanilla",
  );
  expect(callbacksResponse?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Callback Summary", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "prioritizeTreeDepth", level: 2 }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toContainText(
    "@snap-engine/snapsort/callbacks",
  );
  await expect(page.getByRole("article")).toContainText("DROP_REJECT_PRIORITY");

  const callbacksMarkdownResponse = await request.get(
    "/docs/snapsort/reference/callbacks.md?framework=react",
  );
  expect(callbacksMarkdownResponse.status()).toBe(200);
  const callbacksMarkdown = await callbacksMarkdownResponse.text();
  expect(callbacksMarkdown).toContain("# Standard Callbacks");
  expect(callbacksMarkdown).toContain("## `prioritizeTreeDepth`");
  expect(callbacksMarkdown).toContain("x: event.dragRect.x");
  expect(callbacksMarkdown).toContain("y: event.pointer.y");
  expect(callbacksMarkdown).toContain("event.depth + 1");
  expect(callbacksMarkdown).toContain("event.staticPriority");
  expect(callbacksMarkdown).toContain("DROP_REJECT_PRIORITY");
  expect(callbacksMarkdown).toContain("1 / (1 + distance)");
  expect(callbacksMarkdown).not.toContain("canDrop");

  const guideMarkdownResponse = await request.get(
    "/docs/snapsort/guides/sessions/ghosts.md",
  );
  expect(guideMarkdownResponse.status()).toBe(200);
  const guideMarkdown = await guideMarkdownResponse.text();
  expect(guideMarkdown).toContain("[Standard Callbacks reference]");
  expect(guideMarkdown).toContain(
    "/docs/snapsort/reference/callbacks.md?framework=svelte",
  );
  expect(guideMarkdown).not.toContain("| `prioritizePointerContainer`      |");
  expect(guideMarkdown).not.toContain("canDrop");
});

test("SnapSort Container examples move out of Reference and keep accessible source tabs", async ({
  page,
}) => {
  const response = await page.goto(
    "/docs/snapsort/reference/svelte/container?framework=svelte",
  );
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Component Properties", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Direct Children and Render Entries",
      level: 2,
    }),
  ).toBeVisible();
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Container basics" }),
  ).toHaveAttribute("href", "/docs/snapsort/examples/basics#basic-container");
  await expect(
    page
      .getByRole("article")
      .getByRole("link", { name: "Container Recipes", exact: true }),
  ).toHaveAttribute("href", "/docs/snapsort/examples/containers");
  await expect(
    page.getByRole("heading", {
      name: "Move Items Between Containers",
      level: 2,
    }),
  ).toHaveCount(0);
  const exampleSourceRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/docs/snapsort/examples/source/")) {
      exampleSourceRequests.push(request.url());
    }
  });
  await page.goto("/docs/snapsort/examples/basics?framework=svelte");
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(4);
  expect(exampleSourceRequests).toEqual([]);

  const basic = page.locator('[data-demo-code-tabs="container-intro-basic"]');
  await expect(basic.locator(".snapsort-item")).toHaveCount(2);
  await basic.getByRole("tab", { name: "Svelte source" }).click();
  await expect.poll(() => exampleSourceRequests.length).toBe(1);
  expect(exampleSourceRequests[0]).toContain(
    "/docs/snapsort/examples/source/container-intro-basic",
  );
  await expect(basic.getByRole("tabpanel")).toContainText("{#each");
  await expect(basic.locator("pre.shiki.display")).toHaveCount(1);
  await basic.getByRole("tab", { name: "Demo" }).click();
  await basic.getByRole("tab", { name: "Svelte source" }).click();
  expect(exampleSourceRequests).toHaveLength(1);

  const sortable = page.locator(
    '[data-demo-code-tabs="container-intro-sortable"]',
  );
  await expect(sortable.locator(".snapsort-item")).toHaveCount(2);
  await sortable.getByRole("tab", { name: "Svelte source" }).click();
  await expect(sortable.getByRole("tabpanel")).toContainText(
    "onGhostInsert: onGhostMove",
  );

  const mixed = page.locator('[data-demo-code-tabs="container-intro-mixed"]');
  await expect(mixed.locator(".snapsort-container")).toHaveCount(3);
  await expect(mixed.getByText("Today", { exact: true })).toBeVisible();
  await expect(mixed.getByText("Later", { exact: true })).toBeVisible();
  const today = mixed.getByText("Today", { exact: true }).locator("..");
  const later = mixed.getByText("Later", { exact: true }).locator("..");
  await dragBetween(
    page,
    today.getByText("Draft update", { exact: true }),
    later.getByText("Publish update", { exact: true }),
  );
  await expect(today.getByText("Draft update", { exact: true })).toHaveCount(0);
  await expect(later.getByText("Draft update", { exact: true })).toHaveCount(1);
  await expect(mixed.locator(".snapsort-ghost")).toHaveCount(0);

  await page.goto("/docs/snapsort/examples/containers?framework=svelte");
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(7);

  const collection = page.locator(
    '[data-demo-code-tabs="container-property-collection"]',
  );
  const demoTab = collection.getByRole("tab", { name: "Demo" });
  const codeTab = collection.getByRole("tab", { name: "Svelte source" });
  await expect(collection.locator(".property-list")).toBeVisible();
  await expect(demoTab).toHaveAttribute("aria-selected", "true");
  await codeTab.click();
  await expect(codeTab).toHaveAttribute("aria-selected", "true");
  await expect(collection.getByRole("tabpanel")).toContainText(
    "createRenderEntries",
  );
  await expect(collection.getByRole("tabpanel")).toContainText(
    "{#each tasks.entries as entry (entry.itemId)}",
  );
  await expect(collection.getByRole("tabpanel")).not.toContainText("entry.key");
  const codePanel = collection.locator(".code-panel");
  const highlightedCode = codePanel.locator("pre.shiki.display");
  await expect(highlightedCode).toHaveCount(1);
  await expect(highlightedCode).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(highlightedCode).toHaveCSS("color", "rgb(31, 35, 40)");
  await expect(codePanel.locator("pre")).toHaveCount(1);
  await expect(codePanel).toContainText("@snap-engine/snapsort/svelte");
  await expect(codePanel).not.toContainText("@snap-engine/snapsort/react");
  const firstLine = highlightedCode.locator('.line[data-line="1"]');
  await expect(firstLine).toBeVisible();
  expect(
    await firstLine.evaluate(
      (line) => getComputedStyle(line, "::before").content,
    ),
  ).toBe('"1"');

  await codeTab.press("Home");
  await expect(demoTab).toBeFocused();
  await expect(demoTab).toHaveAttribute("aria-selected", "true");
  await demoTab.press("End");
  await expect(codeTab).toBeFocused();
  await expect(codeTab).toHaveAttribute("aria-selected", "true");
  await codeTab.press("ArrowLeft");
  await expect(demoTab).toBeFocused();

  const config = page.locator(
    '[data-demo-code-tabs="container-property-config"]',
  );
  await config.getByRole("button", { name: "Row" }).click();
  await expect(config.locator(".config-list")).toHaveCSS(
    "flex-direction",
    "row",
  );

  const beforeAfter = page.locator(
    '[data-demo-code-tabs="container-property-before-after"]',
  );
  await expect(beforeAfter.locator(".before-after-item")).toHaveCount(2);
  const fixedSequence = beforeAfter.locator(".before-after-list");
  await dragBetween(
    page,
    beforeAfter.locator(".before-after-item").first(),
    beforeAfter.locator(".before-after-item").last(),
    {
      beforeDrop: async () => {
        const childKinds = await fixedSequence.evaluate((container) =>
          Array.from(container.children).map((child) => {
            if (child.matches("header.before-content")) return "header";
            if (child.matches("footer.after-content")) return "footer";
            if (child.matches("[data-snapsort-ghost-entry]")) return "ghost";
            if (child.matches(".before-after-item")) return "item";
            return "other";
          }),
        );
        expect(childKinds[0]).toBe("header");
        expect(childKinds.at(-1)).toBe("footer");
        expect(childKinds.indexOf("ghost")).toBeGreaterThan(0);
        expect(childKinds.indexOf("ghost")).toBeLessThan(childKinds.length - 1);
      },
    },
  );
  await expect(fixedSequence.locator(":scope > :first-child")).toHaveClass(
    /before-content/,
  );
  await expect(fixedSequence.locator(":scope > :last-child")).toHaveClass(
    /after-content/,
  );
  await expect(
    fixedSequence.locator("[data-snapsort-ghost-entry]"),
  ).toHaveCount(0);
  await beforeAfter.getByRole("button", { name: "Add task" }).click();
  await expect(beforeAfter.locator(".before-after-item")).toHaveCount(3);

  const metadata = page.locator(
    '[data-demo-code-tabs="container-property-metadata"]',
  );
  const backlogColumn = metadata
    .getByRole("heading", { name: "Backlog" })
    .locator("..");
  const doneColumn = metadata
    .getByRole("heading", { name: "Done" })
    .locator("..");
  await dragBetween(
    page,
    backlogColumn.getByText("Review changes", { exact: true }),
    doneColumn,
  );
  await expect(
    doneColumn.getByText("Review changes", { exact: true }),
  ).toHaveCount(1);
  await expect(metadata.locator(".move-status")).toHaveText(
    "Review changes moved to Done",
  );
  await expect(metadata.locator(".snapsort-ghost")).toHaveCount(0);
  await metadata.evaluate(() => {
    const animationState = window as typeof window & {
      __metadataMoveTransforms?: string[];
    };
    animationState.__metadataMoveTransforms = [];
    const startedAt = performance.now();
    const sampleTransform = () => {
      const draftItem = Array.from(
        document.querySelectorAll<HTMLElement>(".metadata-item"),
      ).find((item) => item.textContent?.includes("Draft copy"));
      if (draftItem) {
        animationState.__metadataMoveTransforms!.push(
          getComputedStyle(draftItem).transform,
        );
      }
      if (performance.now() - startedAt < 500) {
        requestAnimationFrame(sampleTransform);
      }
    };
    requestAnimationFrame(sampleTransform);
  });
  await metadata
    .getByRole("button", { name: "Move Draft copy to Done" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const animationState = window as typeof window & {
          __metadataMoveTransforms?: string[];
        };
        return animationState.__metadataMoveTransforms?.some(
          (transform) => transform !== "none",
        );
      }),
    )
    .toBe(true);
  await expect(metadata.getByText("Draft copy", { exact: true })).toHaveCount(
    1,
  );
  await expect(metadata.locator(".move-status")).toHaveText(
    "Draft copy moved to Done",
  );

  const nested = page.locator(
    '[data-demo-code-tabs="container-property-nested"]',
  );
  await dragBetween(
    page,
    nested.getByText("Ship", { exact: true }),
    nested.getByText("Design", { exact: true }),
  );
  await expect
    .poll(() =>
      nested.locator(".nested-card-content > strong").allTextContents(),
    )
    .not.toEqual(["Design", "Build", "Ship"]);
  await expect(nested.locator(".snapsort-ghost")).toHaveCount(0);
  const shipSelection = nested.getByRole("button", {
    name: "Select",
    exact: true,
  });
  await shipSelection.click();
  await expect(nested.getByRole("button", { name: "Selected" })).toHaveCount(3);

  const presentation = page.locator(
    '[data-demo-code-tabs="container-property-presentation"]',
  );
  const styledContainer = presentation.getByLabel("Styled task list");
  await expect(styledContainer).toHaveAttribute(
    "data-example-kind",
    "presentation",
  );
  await expect(styledContainer).toHaveClass(/is-emphasized/);
  await presentation.getByRole("button", { name: "Toggle emphasis" }).click();
  await expect(styledContainer).not.toHaveClass(/is-emphasized/);
});

test("SnapSort Item examples move out of Reference and preserve focused behavior", async ({
  page,
  request,
}) => {
  const response = await page.goto(
    "/docs/snapsort/reference/svelte/item?framework=svelte",
  );
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Component Properties", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Handle", level: 2 }),
  ).toBeVisible();
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Basic Item", exact: true }),
  ).toHaveAttribute("href", "/docs/snapsort/examples/basics#basic-item");
  await expect(
    page
      .getByRole("article")
      .getByRole("link", { name: "Item Recipes", exact: true }),
  ).toHaveAttribute("href", "/docs/snapsort/examples/items");

  await page.goto("/docs/snapsort/examples/basics?framework=svelte");
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(4);

  const basic = page.locator('[data-demo-code-tabs="item-example-basic"]');
  await expect(basic.locator(".item-demo-card")).toHaveCount(3);
  await basic.getByRole("tab", { name: "Svelte source" }).click();
  await expect(basic.locator("pre.shiki.display")).toHaveCount(1);
  await expect(basic.getByRole("tabpanel")).toContainText(
    "<Item itemId={entry.itemId}",
  );

  await page.goto("/docs/snapsort/examples/items?framework=svelte");
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(4);

  const metadata = page.locator(
    '[data-demo-code-tabs="item-example-metadata"]',
  );
  await dragBetween(
    page,
    metadata.locator(".metadata-card").first(),
    metadata.locator(".metadata-card").last(),
  );
  await expect(metadata.locator(".metadata-status")).toHaveText(
    /(?:Dragging|Dropped) brief: Mina · High/,
  );

  const selection = page.locator(
    '[data-demo-code-tabs="item-example-selection"]',
  );
  await expect(
    selection.locator('.selection-card[aria-pressed="true"]'),
  ).toHaveCount(2);
  await selection.getByRole("button", { name: /Gamma/ }).click();
  await expect(
    selection.locator('.selection-card[aria-pressed="true"]'),
  ).toHaveCount(3);
  await expect(selection.locator(".selection-status")).toHaveText(
    "3 items selected",
  );

  const itemInstance = page.locator(
    '[data-demo-code-tabs="item-example-item-instance"]',
  );
  await itemInstance
    .getByRole("button", { name: "Inspect core item" })
    .first()
    .click();
  await expect(itemInstance.locator(".instance-report")).toHaveText(
    "ID: adopt-one · index: 0 · origin: application",
  );
  await itemInstance.getByRole("tab", { name: "Svelte source" }).click();
  await expect(itemInstance.getByRole("tabpanel")).toContainText(
    "new SnapSortItem(engine, container, { itemId: initialId })",
  );
  await expect(itemInstance.getByRole("tabpanel")).toContainText(
    "<Item itemId={initialId} {item}",
  );
  await expect(itemInstance.getByRole("tabpanel")).toContainText(
    "<!-- AdoptedItemRow.svelte -->",
  );

  const handle = page.locator('[data-demo-code-tabs="item-example-handle"]');
  const initialHandleStatus =
    "Drag with the grip; the Done buttons remain interactive.";
  await expect(handle.locator(".handle-status")).toHaveText(
    initialHandleStatus,
  );

  await dragBetween(
    page,
    handle.locator(".task-label").first(),
    handle.locator(".task-label").last(),
  );
  await expect(handle.locator(".handle-status")).toHaveText(
    initialHandleStatus,
  );

  await dragBetween(
    page,
    handle.getByLabel("Drag Plan release"),
    handle.getByLabel("Drag Ship update"),
  );
  await expect(handle.locator(".handle-status")).toHaveText(
    /(?:Dragging Plan release from its handle|Moved Plan release)/,
  );

  await handle
    .getByRole("button", { name: /Done|Undo/ })
    .first()
    .click();
  await expect(handle.locator(".handle-status")).toHaveText(
    /marked (?:done|not done)$/,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapsort/examples/items?framework=svelte");
  await expect(page.locator(".doc-sidebar")).toBeHidden();
  await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(4);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);

  const markdownResponse = await request.get(
    "/docs/snapsort/reference/svelte/item.md",
  );
  expect(markdownResponse.status()).toBe(200);
  const markdown = await markdownResponse.text();
  expect(markdown).toContain("## Component Properties");
  expect(markdown).toContain("<Item itemId={task.id}>");
  expect(markdown).toContain("bind:item");
  expect(markdown).not.toContain("DragSession.handoff");
  expect(markdown).not.toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(markdown).not.toContain("<ItemExample");

  const itemExamplesResponse = await request.get(
    "/docs/snapsort/examples/items.md",
  );
  expect(itemExamplesResponse.status()).toBe(200);
  const itemExamplesMarkdown = await itemExamplesResponse.text();
  expect(itemExamplesMarkdown).toContain(
    "new SnapSortItem(engine, container, { itemId: initialId })",
  );
  expect(itemExamplesMarkdown).toContain("<Item itemId={initialId} {item}");
  expect(itemExamplesMarkdown).toContain('<Handle className="drag-grip"');
  expect(itemExamplesMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(itemExamplesMarkdown).not.toContain("<ItemExample");

  const reactMarkdownResponse = await request.get(
    "/docs/snapsort/reference/react/item.md",
  );
  expect(reactMarkdownResponse.status()).toBe(200);
  const reactMarkdown = await reactMarkdownResponse.text();
  expect(reactMarkdown).toContain("## Core Item Access");
  expect(reactMarkdown).toContain("item={existingItem}");
  expect(reactMarkdown).not.toContain("DragSession.handoff");
  expect(reactMarkdown).not.toContain("itemObject");
});

test("SnapSort callback docs expose receiver routing and mutation boundaries", async ({
  page,
  request,
}) => {
  const lifecycleResponse = await page.goto(
    "/docs/snapsort/guides/sessions/drag-start?framework=react",
  );
  expect(lifecycleResponse?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Terms", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lifecycle at a Glance", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", {
      name: /root-owned DragSession initiates target resolution.*Ghosts are passive visual data/i,
    }),
  ).toBeVisible();

  const lifecycleDiagram = page.locator(".lifecycle-diagram");
  await expect(lifecycleDiagram.locator("[data-phase]")).toHaveCount(5);
  await expect(lifecycleDiagram).toContainText("Ghost");
  const structuralCallbackSteps = [
    "1.3a",
    "1.4a",
    "1.6a",
    "2.3a",
    "3.1a",
    "3.2a",
    "3.3a",
    "5.1b",
  ];
  for (const step of structuralCallbackSteps) {
    await expect(
      lifecycleDiagram.locator(`[data-step="${step}"]`),
    ).toHaveAttribute("data-to", "root");
  }
  await expect(
    lifecycleDiagram.locator('[data-step="2.3b"] .detail'),
  ).toContainText("reduceRenderTree");
  await expect(lifecycleDiagram).not.toContainText("container reducer");
  await expect(lifecycleDiagram.locator(".uml-legend")).toHaveCount(0);
  await expect(lifecycleDiagram.locator(".message-label > code")).toHaveCount(
    0,
  );
  const callbackLabel = lifecycleDiagram.locator(
    '[data-step="1.3a"] .self-message',
  );
  const ordinaryLabel = lifecycleDiagram.locator('[data-step="1.3c"] .message');
  await expect(callbackLabel).toHaveClass(/invokes-callback/);
  await expect(ordinaryLabel).not.toHaveClass(/invokes-callback/);
  await expect(callbackLabel.locator("strong")).toContainText("onGhostInsert");
  await expect(callbackLabel.locator("strong")).not.toContainText(
    "Add source ghost",
  );
  await expect(
    callbackLabel.getByRole("link", { name: "onGhostInsert" }),
  ).toHaveAttribute(
    "href",
    "/docs/snapsort/reference/react/container?framework=react#callbacks",
  );
  const labelStyles = await lifecycleDiagram.evaluate((diagram) => {
    const callbackBadge = diagram.querySelector(
      '[data-step="1.3a"] .step-number',
    );
    const ordinaryBadge = diagram.querySelector(
      '[data-step="1.3c"] .step-number',
    );
    const title = diagram.querySelector('[data-step="1.3a"] strong');
    const lane = diagram.querySelector(".participant");
    const phase = diagram.querySelector(".phase-heading span");
    const branch = diagram.querySelector(".branch-label");
    const detail = diagram.querySelector(".detail");
    if (
      !callbackBadge ||
      !ordinaryBadge ||
      !title ||
      !lane ||
      !phase ||
      !branch ||
      !detail
    ) {
      throw new Error("Missing lifecycle label styles");
    }
    return {
      callbackColor: getComputedStyle(callbackBadge).backgroundColor,
      ordinaryColor: getComputedStyle(ordinaryBadge).backgroundColor,
      titleSize: Number.parseFloat(getComputedStyle(title).fontSize),
      laneSize: Number.parseFloat(getComputedStyle(lane).fontSize),
      phaseSize: Number.parseFloat(getComputedStyle(phase).fontSize),
      branchSize: Number.parseFloat(getComputedStyle(branch).fontSize),
      detailSize: Number.parseFloat(getComputedStyle(detail).fontSize),
      titleFamily: getComputedStyle(title).fontFamily,
      titleWeight: getComputedStyle(title).fontWeight,
      arrowWidth: getComputedStyle(diagram.querySelector(".uml-line")!)
        .strokeWidth,
    };
  });
  expect(labelStyles.callbackColor).not.toBe(labelStyles.ordinaryColor);
  expect(labelStyles.laneSize).toBeGreaterThan(labelStyles.titleSize);
  expect(labelStyles.titleSize).toBeGreaterThan(labelStyles.phaseSize);
  expect(labelStyles.phaseSize).toBeGreaterThan(labelStyles.branchSize);
  expect(labelStyles.detailSize).toBeGreaterThanOrEqual(13);
  expect(labelStyles.titleFamily).toContain("Geist");
  expect(labelStyles.titleWeight).toBe("400");
  expect(Number.parseFloat(labelStyles.arrowWidth)).toBeGreaterThanOrEqual(2);

  const desktopLayout = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing layout element: ${selector}`);
      }
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };

    return {
      viewportWidth: window.innerWidth,
      sidebar: bounds(".doc-sidebar"),
      content: bounds(".doc-content"),
      paragraph: bounds(".doc-article > p"),
      diagram: bounds(".lifecycle-diagram"),
    };
  });
  expect(desktopLayout.sidebar.left).toBeGreaterThanOrEqual(15);
  expect(desktopLayout.sidebar.left).toBeLessThanOrEqual(40);
  expect(desktopLayout.content.width).toBeGreaterThan(700);
  expect(desktopLayout.paragraph.width).toBeLessThanOrEqual(701);
  expect(desktopLayout.diagram.width).toBeGreaterThan(700);
  expect(
    Math.abs(desktopLayout.content.width - desktopLayout.diagram.width),
  ).toBeLessThanOrEqual(1);
  expect(
    await lifecycleDiagram
      .locator(".scroll-region")
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);

  const diagramGeometry = await lifecycleDiagram.evaluate((diagram) => {
    const laneOrder = [
      "item",
      "ghost",
      "root",
      "source",
      "target",
      "app",
      "dom",
    ];
    const center = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const participants = [...diagram.querySelectorAll(".participant")];
    const lifelines = [...diagram.querySelectorAll(".lifeline")].slice(0, 7);
    const laneCenterDeltas = participants.map((participant, index) =>
      Math.abs(center(participant).x - center(lifelines[index]).x),
    );
    const routeGeometry = [...diagram.querySelectorAll(".message-row")]
      .filter((row) => row.querySelector(":scope > .message"))
      .map((row) => {
        const label = row.querySelector(".message-label");
        const route = row.querySelector(".route-svg");
        const head = row.querySelector(".route-head-svg");
        if (!label || !route || !head) {
          throw new Error(`Incomplete route geometry for ${row.dataset.step}`);
        }
        const labelRect = label.getBoundingClientRect();
        const messageRect = row
          .querySelector(":scope > .message")!
          .getBoundingClientRect();
        const routeCenter = center(route);
        const headCenter = center(head);
        const from = laneOrder.indexOf(row.dataset.from ?? "");
        const to = laneOrder.indexOf(row.dataset.to ?? "");
        const expectedLeft = center(lifelines[Math.min(from, to)]).x;
        const expectedRight = center(lifelines[Math.max(from, to)]).x;
        return {
          step: row.dataset.step,
          labelGap: routeCenter.y - labelRect.bottom,
          headDelta: Math.abs(routeCenter.y - headCenter.y),
          leftDelta: Math.abs(messageRect.left - expectedLeft),
          rightDelta: Math.abs(messageRect.right - expectedRight),
        };
      });

    const selfLoopGeometry = [...diagram.querySelectorAll(".self-route")].map(
      (route) => {
        const rect = route.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      },
    );

    return { laneCenterDeltas, routeGeometry, selfLoopGeometry };
  });
  expect(Math.max(...diagramGeometry.laneCenterDeltas)).toBeLessThan(0.1);
  for (const route of diagramGeometry.routeGeometry) {
    expect(
      route.labelGap,
      `${route.step} label overlaps its arrow`,
    ).toBeGreaterThanOrEqual(1);
    expect(route.headDelta, `${route.step} arrowhead is off-axis`).toBeLessThan(
      0.1,
    );
    expect(route.leftDelta, `${route.step} starts off-lifeline`).toBeLessThan(
      2,
    );
    expect(route.rightDelta, `${route.step} ends off-lifeline`).toBeLessThan(2);
  }
  for (const loop of diagramGeometry.selfLoopGeometry) {
    expect(loop.width).toBeLessThanOrEqual(64.1);
    expect(loop.width / loop.height).toBeCloseTo(64 / 44, 2);
  }

  await page.setViewportSize({ width: 2200, height: 900 });
  const wideLaneGeometry = await lifecycleDiagram.evaluate((diagram) => {
    const sequence = diagram.querySelector(".sequence");
    if (!(sequence instanceof HTMLElement)) {
      throw new Error("Missing lifecycle sequence");
    }
    const laneWidths = [...diagram.querySelectorAll(".participant")].map(
      (participant) => participant.getBoundingClientRect().width,
    );
    return {
      diagramWidth: diagram.getBoundingClientRect().width,
      sequenceWidth: sequence.getBoundingClientRect().width,
      widestLane: Math.max(...laneWidths),
    };
  });
  expect(wideLaneGeometry.sequenceWidth).toBeLessThanOrEqual(1400.1);
  expect(wideLaneGeometry.widestLane).toBeLessThanOrEqual(200.1);
  expect(
    wideLaneGeometry.diagramWidth - wideLaneGeometry.sequenceWidth,
  ).toBeLessThanOrEqual(49);
  await page.setViewportSize({ width: 1280, height: 720 });

  const ghostRelocation = lifecycleDiagram.locator('[data-step="2.3a"]');
  await expect(ghostRelocation).toHaveAttribute("data-from", "root");
  await expect(ghostRelocation).toHaveAttribute("data-to", "root");
  await expect(ghostRelocation).toHaveAttribute("data-kind", "sync");
  await expect(ghostRelocation).toContainText("onGhostMove");

  const ghostDomRelocation = lifecycleDiagram.locator('[data-step="2.3c"]');
  await expect(ghostDomRelocation).toHaveAttribute("data-from", "app");
  await expect(ghostDomRelocation).toHaveAttribute("data-to", "dom");
  await expect(ghostDomRelocation).toContainText("Commit relocated ghost");

  const ghostDomRelocationReturn =
    lifecycleDiagram.locator('[data-step="2.3d"]');
  await expect(ghostDomRelocationReturn).toHaveAttribute("data-from", "dom");
  await expect(ghostDomRelocationReturn).toHaveAttribute("data-to", "app");
  await expect(ghostDomRelocationReturn).toHaveAttribute("data-kind", "return");
  await expect(ghostDomRelocationReturn).toContainText("DOM commit complete");

  const ghostRemovalFlushReturn =
    lifecycleDiagram.locator('[data-step="2.3e"]');
  await expect(ghostRemovalFlushReturn).toHaveAttribute("data-from", "app");
  await expect(ghostRemovalFlushReturn).toHaveAttribute("data-to", "root");
  await expect(ghostRemovalFlushReturn).toHaveAttribute("data-kind", "return");

  await expect(lifecycleDiagram.locator('[data-step^="2.4"]')).toHaveCount(0);

  for (const step of ["2.5", "2.5r", "4.2", "4.2r"]) {
    const notification = lifecycleDiagram.locator(`[data-step="${step}"]`);
    await expect(notification).toHaveAttribute("data-from", "root");
    await expect(notification).toHaveAttribute("data-to", "root");
  }

  const phaseLabels = await lifecycleDiagram
    .locator(".phase-heading span")
    .all();
  for (const label of phaseLabels) {
    expect(
      await label.evaluate(
        (element) => getComputedStyle(element).textTransform,
      ),
    ).toBe("none");
  }

  const normalCommitStep = lifecycleDiagram.locator('[data-step="3.2a"]');
  await expect(lifecycleDiagram.locator('[data-step="3.1a"]')).toContainText(
    "onGhostRemove",
  );
  await expect(normalCommitStep).toContainText("onItemMove");
  await expect(normalCommitStep).toContainText("onItemInsert");
  const collectionUpdateStep = lifecycleDiagram.locator('[data-step="3.2b"]');
  await collectionUpdateStep.locator(".message, .self-message").hover();
  await expect(collectionUpdateStep.locator(".detail")).toBeVisible();
  await expect(collectionUpdateStep.locator(".detail")).toContainText(
    "The source receives no onItemRemove callback.",
  );

  for (const step of ["3.1d", "3.2d", "3.3d"]) {
    const domReturn = lifecycleDiagram.locator(`[data-step="${step}"]`);
    await expect(domReturn).toHaveAttribute("data-from", "dom");
    await expect(domReturn).toHaveAttribute("data-to", "app");
    await expect(domReturn).toHaveAttribute("data-kind", "return");
  }
  for (const step of ["3.1e", "3.2e", "3.3e"]) {
    const transactionReturn = lifecycleDiagram.locator(`[data-step="${step}"]`);
    await expect(transactionReturn).toHaveAttribute("data-from", "app");
    await expect(transactionReturn).toHaveAttribute("data-to", "root");
    await expect(transactionReturn).toHaveAttribute("data-kind", "return");
  }

  await expect(lifecycleDiagram.locator('[data-step="4.4"]')).toHaveAttribute(
    "data-kind",
    "return",
  );
  await expect(lifecycleDiagram.locator('[data-step="4.5"]')).toHaveAttribute(
    "data-kind",
    "async",
  );
  await expect(
    lifecycleDiagram.locator('[data-phase="finish"]'),
  ).not.toContainText(/WRITE_1|WRITE_2|READ_2/);
  await expect(lifecycleDiagram.locator('[data-step="5.1b"]')).toContainText(
    "onItemRemove",
  );
  await expect(lifecycleDiagram.locator('[data-step^="5.2"]')).toHaveCount(0);
  await expect(lifecycleDiagram).not.toContainText(
    /flow-copy|transient clone/i,
  );
  await expect(lifecycleDiagram).toContainText('dragVisual = "item"');
  await expect(lifecycleDiagram).toContainText('dragVisual = "preview"');
  await expect(lifecycleDiagram).toContainText('dragVisual = "none"');
  await expect(lifecycleDiagram).toContainText(
    "Independent placement feedback",
  );
  await expect(
    lifecycleDiagram.getByRole("link", { name: "adapter" }).first(),
  ).toBeVisible();

  for (const framework of ["react", "svelte"] as const) {
    await page.goto(
      `/docs/snapsort/guides/sessions/drag-start?framework=${framework}`,
    );
    await expect(page.locator(".lifecycle-diagram")).not.toContainText(
      "createGhost",
    );
    await expect(
      page
        .locator(".lifecycle-diagram")
        .getByRole("link", { name: "adapter" })
        .first(),
    ).toBeVisible();
  }

  await page.goto(
    "/docs/snapsort/guides/sessions/drag-start?framework=vanilla",
  );
  const vanillaDiagram = page.locator(".lifecycle-diagram");
  await expect(vanillaDiagram).toContainText("Construct Vanilla element");
  await expect(vanillaDiagram).toContainText("The Vanilla adapter constructs");
  await expect(vanillaDiagram).not.toContainText("inside root adapter commit");
  await expect(vanillaDiagram.locator("[data-phase]")).toHaveCount(5);
  for (const step of [
    "1.3d",
    "1.4d",
    "1.6d",
    "2.3a",
    "3.1a",
    "3.2a",
    "3.3a",
    "5.1b",
  ]) {
    await expect(
      vanillaDiagram.locator(`[data-step="${step}"]`),
    ).toHaveAttribute("data-to", "root");
  }
  for (const [callStep, returnStep] of [
    ["1.3e", "1.3f"],
    ["1.4e", "1.4f"],
    ["1.6e", "1.6f"],
    ["2.3b", "2.3c"],
    ["3.1b", "3.1c"],
    ["3.2b", "3.2c"],
    ["3.3b", "3.3c"],
    ["5.1c", "5.1d"],
  ] as const) {
    const domCall = vanillaDiagram.locator(`[data-step="${callStep}"]`);
    await expect(domCall).toHaveAttribute("data-from", "root");
    await expect(domCall).toHaveAttribute("data-to", "dom");
    await expect(domCall).toHaveAttribute("data-kind", "sync");

    const domReturn = vanillaDiagram.locator(`[data-step="${returnStep}"]`);
    await expect(domReturn).toHaveAttribute("data-from", "dom");
    await expect(domReturn).toHaveAttribute("data-to", "root");
    await expect(domReturn).toHaveAttribute("data-kind", "return");
    await expect(domReturn).toContainText(/returned|complete/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapsort/guides/sessions/drag-start?framework=react");
  await expect(page.locator(".doc-sidebar")).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    await page
      .locator(".lifecycle-diagram .scroll-region")
      .evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBe(true);

  await page.setViewportSize({ width: 1280, height: 720 });

  const rootCallbackGroups = [
    "onItemMove(event)",
    "onItemInsert(event)",
    "onItemRemove(event)",
    "onItemSwap(event)",
    "onGhostInsert/Move/Remove(event)",
    "onDragStart/End(event)",
    "onDropTargetChange(event)",
    "onVisualGeometryInvalidated(event)",
  ];
  const localCallbackGroups = [
    "getDropPriority",
    "getItemHitbox",
    "onDragItemEnter/Move/Leave",
  ];

  for (const framework of ["svelte", "react"] as const) {
    const response = await page.goto(
      `/docs/snapsort/reference/${framework}/container?framework=${framework}`,
    );
    expect(response?.status()).toBe(200);

    const rootCallbackTable = page.locator("table").filter({
      has: page.getByRole("columnheader", { name: "Root callback" }),
    });
    const localCallbackTable = page.locator("table").filter({
      has: page.getByRole("columnheader", { name: "Local callback" }),
    });
    await expect(rootCallbackTable).toHaveCount(1);
    await expect(localCallbackTable).toHaveCount(1);
    await expect(rootCallbackTable.getByRole("row")).toHaveCount(9);
    await expect(localCallbackTable.getByRole("row")).toHaveCount(4);
    expect(
      await rootCallbackTable.evaluate(
        (element) => element.getBoundingClientRect().width,
      ),
    ).toBeLessThanOrEqual(701);
    await expect(
      rootCallbackTable.locator("tbody tr td:first-child"),
    ).toHaveText(rootCallbackGroups);
    await expect(
      localCallbackTable.locator("tbody tr td:first-child"),
    ).toHaveText(localCallbackGroups);
    await expect(page.locator(".doc-article")).toContainText(
      "insertionMarkerRect",
    );
    await expect(page.locator(".doc-article")).toContainText(
      "isCurrentPlacement",
    );
    await expect(page.locator(".doc-article")).not.toContainText(
      "getInsertionMarkerRect",
    );

    await expect(
      rootCallbackTable
        .locator("tbody tr")
        .filter({ has: page.getByText("onItemMove(event)", { exact: true }) }),
    ).toContainText("source and destination");
    await expect(
      rootCallbackTable
        .locator("tbody tr")
        .filter({ has: page.getByText("onItemSwap(event)", { exact: true }) }),
    ).toContainText("atomic pairwise exchange");
    await expect(
      localCallbackTable
        .getByRole("row")
        .filter({ hasText: "getDropPriority" }),
    ).toContainText("candidate destination");
    await expect(
      localCallbackTable
        .getByRole("row")
        .filter({ hasText: "onDragItemEnter" }),
    ).toContainText("overItem");
  }

  const lifecycleMarkdownResponse = await request.get(
    "/docs/snapsort/guides/sessions/drag-start.md",
  );
  expect(lifecycleMarkdownResponse.status()).toBe(200);
  const lifecycleMarkdown = await lifecycleMarkdownResponse.text();
  expect(lifecycleMarkdown).toContain("## Terms");
  expect(lifecycleMarkdown).toContain("## Lifecycle at a Glance");

  for (const framework of ["svelte", "react"] as const) {
    const markdownResponse = await request.get(
      `/docs/snapsort/reference/${framework}/container.md?framework=${framework}`,
    );
    expect(markdownResponse.status()).toBe(200);
    const markdown = await markdownResponse.text();
    expect(markdown).toContain("| Root callback");
    expect(markdown).toContain("| Local callback");
    expect(markdown).toContain(
      "Structural and lifecycle callbacks resolve on the **tree root**",
    );
    expect(markdown).toContain("remain **per container**");
    expect(markdown).toContain("### Drag visuals");
    for (const callbackName of [
      ...rootCallbackGroups,
      "getDropPriority",
      ...localCallbackGroups.slice(1),
    ]) {
      expect(markdown).toContain(`\`${callbackName}`);
    }
  }
});

test("SnapSort docs keep application CRUD and destination meaning application-owned", async ({
  request,
}) => {
  const [
    quickstartResponse,
    commitResponse,
    ghostsResponse,
    placementResponse,
    programmaticMovesResponse,
    advancedResponse,
    svelteContainerResponse,
    reactContainerResponse,
  ] = await Promise.all([
    request.get("/docs/snapsort/introduction/setup.md"),
    request.get("/docs/snapsort/guides/sessions/commit-and-cleanup.md"),
    request.get("/docs/snapsort/guides/sessions/ghosts.md"),
    request.get("/docs/snapsort/guides/placement-modes.md"),
    request.get("/docs/snapsort/guides/sessions/drop-policies.md"),
    request.get("/docs/snapsort/examples/advanced-settings-and-callbacks.md"),
    request.get("/docs/snapsort/reference/svelte/container.md"),
    request.get("/docs/snapsort/reference/react/container.md"),
  ]);

  expect(quickstartResponse.status()).toBe(200);
  expect(commitResponse.status()).toBe(200);
  expect(ghostsResponse.status()).toBe(200);
  expect(placementResponse.status()).toBe(200);
  expect(programmaticMovesResponse.status()).toBe(200);
  expect(advancedResponse.status()).toBe(200);
  expect(svelteContainerResponse.status()).toBe(200);
  expect(reactContainerResponse.status()).toBe(200);

  const [
    quickstart,
    commit,
    ghosts,
    placement,
    programmaticMoves,
    advanced,
    svelteContainer,
    reactContainer,
  ] = await Promise.all([
    quickstartResponse.text(),
    commitResponse.text(),
    ghostsResponse.text(),
    placementResponse.text(),
    programmaticMovesResponse.text(),
    advancedResponse.text(),
    svelteContainerResponse.text(),
    reactContainerResponse.text(),
  ]);

  expect(quickstart).not.toContain("## Who Changes Framework Render State?");
  expect(quickstart).not.toContain("function addTask(task: Task)");
  expect(programmaticMoves).toContain("function addTask(task: Task)");
  expect(programmaticMoves).toContain(
    "function deleteTasks(itemIds: readonly ItemId[])",
  );
  expect(programmaticMoves).toMatch(
    /application code,\s+not SnapSort\s+exports/,
  );
  expect(programmaticMoves).toContain("container.removeItem(itemId)");
  expect(programmaticMoves).toMatch(
    /`reduceRenderTree`\s+cannot invent the application value/,
  );

  expect(programmaticMoves).toContain(
    "## Application-Owned Collection Changes",
  );
  expect(programmaticMoves).toMatch(
    /Application-originated additions and deletions do not need to round-trip/,
  );
  expect(ghosts).toContain("## Explicit Lifecycle Callbacks");
  expect(ghosts).toContain("onGhostInsert: applyGhostEvent");
  expect(ghosts).toContain("onGhostMove: applyGhostEvent");
  expect(ghosts).toContain("onGhostRemove: applyGhostEvent");

  expect(advanced).toContain("## Give a Drop Application Meaning");
  expect(advanced).toContain(
    'event.session.dropEffect = isTrash ? "none" : "move"',
  );
  expect(advanced).toContain(
    'event.destination?.containerMetadata.role !== "trash"',
  );
  expect(advanced).toContain("new Set(event.itemIds)");
  expect(advanced).toMatch(
    /The recursive `removeEntries` function\s+is\s+intentionally application-local/,
  );
  expect(advanced).toMatch(
    /Checking `event.destination` rather\s+than\s+remembered\s+hover\s+state\s+makes cancellation safe/,
  );
  expect(advanced).not.toContain("DragSession.handoff");
  expect(placement).not.toContain("## Three Independent Decisions");
  expect(placement).not.toContain("## Give a Drop Application Meaning");

  for (const containerReference of [svelteContainer, reactContainer]) {
    expect(containerReference).toContain("### Application-owned item lifetime");
    expect(containerReference).toContain("addTaskToTodo");
    expect(containerReference).toContain("deleteTasksFromTodo");
    expect(containerReference).toMatch(
      /These are application functions, not SnapSort\s+helpers/,
    );
    expect(containerReference).toMatch(/framework mounting does not emit it/);
    expect(containerReference).toMatch(
      /do not expect `onItemRemove` for the source half of a move/,
    );
    expect(containerReference).not.toContain("DragSession.handoff");
    expect(containerReference).not.toContain("entry.key");
  }

  expect(svelteContainer).toContain(
    "{#each board.entries as entry (entry.itemId)}",
  );
  expect(reactContainer).toContain(
    "<Ghost key={entry.itemId} ghost={entry.ghost}",
  );
  expect(reactContainer).toContain(
    "<Item key={entry.itemId} itemId={entry.itemId}",
  );
  expect(svelteContainer).not.toContain('entry.isGhost ? "ghost" : "item"');
  expect(reactContainer).not.toContain("ghost:${entry.itemId}");
});

test("Quickstart package-manager tabs persist independently from framework selection", async ({
  page,
}) => {
  const response = await page.goto(
    "/docs/snapsort/introduction/setup?framework=svelte",
  );
  expect(response?.status()).toBe(200);
  await page.waitForFunction(
    () => localStorage.getItem("preferredCodeFramework") === "svelte",
  );

  const tabs = page.locator("[data-code-tabs]");
  await expect(tabs).toHaveCount(1);
  await expect(tabs.getByRole("tab")).toHaveText([
    "npm",
    "pnpm",
    "Yarn",
    "Bun",
  ]);
  await expect(
    tabs.getByRole("tab", { name: "npm", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tabpanel")).toHaveCount(1);
  await expect(tabs.getByRole("tabpanel")).toContainText(
    "npm install @snap-engine/snapsort @snap-engine/asset-base",
  );
  await expect(tabs).toHaveCSS("border-top-width", "1px");
  const codeBlockBorders = await tabs
    .locator("pre.shiki.display:visible")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ];
    });
  expect(codeBlockBorders).toEqual(["0px", "0px", "0px", "0px"]);

  await tabs.getByRole("tab", { name: "pnpm" }).click();
  await expect(tabs.getByRole("tabpanel")).toContainText(
    "pnpm add @snap-engine/snapsort @snap-engine/asset-base",
  );
  await tabs.getByRole("tab", { name: "pnpm" }).press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Yarn" })).toBeFocused();
  await expect(tabs.getByRole("tab", { name: "Yarn" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(tabs.getByRole("tabpanel")).toContainText(
    "yarn add @snap-engine/snapsort @snap-engine/asset-base",
  );
  await expect
    .poll(() =>
      page.evaluate(() => ({
        framework: localStorage.getItem("preferredCodeFramework"),
        packageManager: localStorage.getItem(
          "preferredCodeTab:npm|pnpm|yarn|bun",
        ),
      })),
    )
    .toEqual({ framework: "svelte", packageManager: "yarn" });

  await page.reload({ waitUntil: "networkidle" });
  await expect(tabs.getByRole("tab", { name: "Yarn" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(tabs.getByRole("tabpanel")).toContainText("yarn add");

  await page.locator("#desktop-doc-framework").selectOption("react");

  await expect(page.locator(".doc-article")).toHaveAttribute(
    "data-framework",
    "react",
  );
  await expect(tabs.getByRole("tab", { name: "Yarn" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const visibleFrameworkBlock = page.locator(".framework-code-block:visible");
  await expect(visibleFrameworkBlock).toHaveCount(1);
  await expect(visibleFrameworkBlock).toContainText(
    'import { useCallback, useState } from "react"',
  );

  const markdownResponse = await page.request.get(
    "/docs/snapsort/introduction/setup.md",
  );
  expect(markdownResponse.status()).toBe(200);
  const markdown = await markdownResponse.text();
  expect(markdown).toContain("npm install @snap-engine/snapsort");
  expect(markdown).toContain("pnpm add @snap-engine/snapsort");
  expect(markdown).toContain("yarn add @snap-engine/snapsort");
  expect(markdown).toContain("bun add @snap-engine/snapsort");

  await page.setViewportSize({ width: 390, height: 844 });
  const viewport = await page.locator("html").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
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
    "/docs/snapsort/introduction/setup.md",
  );
  expect(svelteResponse.status()).toBe(200);
  expect(svelteResponse.headers()["content-type"]).toContain("text/markdown");

  const svelteMarkdown = await svelteResponse.text();
  expect(svelteMarkdown).toContain("# Quickstart");
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
    "/docs/snapsort/introduction/setup.md?framework=react",
  );
  expect(reactResponse.status()).toBe(200);
  const reactMarkdown = await reactResponse.text();
  expect(reactMarkdown).toContain("```tsx");
  expect(reactMarkdown).toContain("@snap-engine/snapsort/react");
  expect(reactMarkdown).not.toContain("@snap-engine/snapsort/svelte");
  expect(reactMarkdown).not.toContain("framework=React");

  const vanillaResponse = await request.get(
    "/docs/snapsort/introduction/setup.md?framework=vanilla",
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
  expect(pairedMarkdown).toContain("insertionMarker={markerOptions}");
  expect(pairedMarkdown).toContain(
    "insertionMarkerRect(marker, markerOptions)",
  );
  expect(pairedMarkdown).not.toContain("getInsertionMarkerRect");

  const svelteReferenceResponse = await request.get(
    "/docs/snapsort/reference/svelte/container.md",
  );
  expect(svelteReferenceResponse.status()).toBe(200);
  const svelteReferenceMarkdown = await svelteReferenceResponse.text();
  expect(svelteReferenceMarkdown).toContain("## Component Properties");
  expect(svelteReferenceMarkdown).toContain("createRenderTree<BoardValue>");
  expect(svelteReferenceMarkdown).toContain("{#if entry.isGhost}");
  expect(svelteReferenceMarkdown).toContain("entry.childTree");
  expect(svelteReferenceMarkdown).toContain("reduceRenderTree");
  expect(svelteReferenceMarkdown).toContain("$state.raw");
  expect(svelteReferenceMarkdown).toContain("insertionMarker={markerOptions}");
  expect(svelteReferenceMarkdown).toContain(
    "insertionMarkerRect(marker, markerOptions)",
  );
  expect(svelteReferenceMarkdown).toContain("isCurrentPlacement");
  expect(svelteReferenceMarkdown).not.toContain("getInsertionMarkerRect");
  expect(svelteReferenceMarkdown).toContain(
    '<Container itemId="project-board-root"',
  );
  expect(svelteReferenceMarkdown).not.toContain("containerRef");
  expect(svelteReferenceMarkdown).not.toContain("{#snippet entry");
  expect(svelteReferenceMarkdown).not.toContain("composeRenderEntries");
  expect(svelteReferenceMarkdown).not.toContain("{#snippet ghost(event)}");
  expect(svelteReferenceMarkdown).not.toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(svelteReferenceMarkdown).not.toContain("<ContainerIntroExample");
  expect(svelteReferenceMarkdown).not.toContain("<ContainerPropertyExample");

  const basicsResponse = await request.get("/docs/snapsort/examples/basics.md");
  expect(basicsResponse.status()).toBe(200);
  const basicsMarkdown = await basicsResponse.text();
  expect(basicsMarkdown).toContain(
    "{#each tasks.entries as entry (entry.itemId)}",
  );
  expect(basicsMarkdown).toContain("<Item itemId={entry.itemId}");
  expect(basicsMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(basicsMarkdown).not.toContain("<ContainerIntroExample");
  expect(basicsMarkdown).not.toContain("<ItemExample");

  const containerExamplesResponse = await request.get(
    "/docs/snapsort/examples/containers.md",
  );
  expect(containerExamplesResponse.status()).toBe(200);
  const containerExamplesMarkdown = await containerExamplesResponse.text();
  expect(containerExamplesMarkdown).toContain("createRenderEntries");
  expect(containerExamplesMarkdown).toContain("source.container.moveItem(");
  expect(containerExamplesMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(containerExamplesMarkdown).not.toContain("<ContainerPropertyExample");

  const completeExamplesResponse = await request.get(
    "/docs/snapsort/examples/complete-interfaces.md?framework=react",
  );
  expect(completeExamplesResponse.status()).toBe(200);
  const completeExamplesMarkdown = await completeExamplesResponse.text();
  expect(completeExamplesMarkdown).toContain("# Complete Interfaces");
  expect(completeExamplesMarkdown).toContain(
    'data-snapsort-example="todo-list"',
  );
  expect(completeExamplesMarkdown).toContain(
    'data-snapsort-example="form-editor"',
  );
  expect(completeExamplesMarkdown).toContain(
    "<!-- SnapSortContextBoundary.svelte -->",
  );
  expect(completeExamplesMarkdown).toContain("```svelte");
  expect(completeExamplesMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(completeExamplesMarkdown).not.toContain("<CompleteExample");

  const interactiveResponse = await request.get(
    "/docs/snapsort/guides/core-components.md",
  );
  expect(interactiveResponse.status()).toBe(200);
  const interactiveMarkdown = await interactiveResponse.text();
  expect(interactiveMarkdown).toContain("# Core Components");
  expect(interactiveMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(interactiveMarkdown).toContain(
    "https://snapengine.dev/docs/snapsort/guides/core-components",
  );
  expect(interactiveMarkdown).toMatch(/unique\s+within one SnapSort root/);
  expect(interactiveMarkdown).toContain(
    "[Drags and Ghosts](/docs/snapsort/guides/sessions/ghosts.md?framework=svelte)",
  );
  expect(interactiveMarkdown).not.toContain("## Every Drag Is a Session");
  expect(interactiveMarkdown).not.toContain("globally unique `itemId`");
  expect(interactiveMarkdown).not.toContain("Their `role`");
  expect(interactiveMarkdown).not.toContain("<SnapSortConceptsDiagram");
  expect(interactiveMarkdown).not.toContain("<SnapSortEntityCue");
  expect(interactiveMarkdown).not.toContain("<script>");

  const ghostsResponse = await request.get(
    "/docs/snapsort/guides/sessions/ghosts.md",
  );
  expect(ghostsResponse.status()).toBe(200);
  const ghostsMarkdown = await ghostsResponse.text();
  expect(ghostsMarkdown).toContain("# Drags and Ghosts");
  expect(ghostsMarkdown).toContain(
    "This page includes interactive diagrams or demos.",
  );
  expect(ghostsMarkdown).toContain(
    "https://snapengine.dev/docs/snapsort/guides/sessions/ghosts",
  );
  expect(ghostsMarkdown).toContain("`source-spacer`");
  expect(ghostsMarkdown).toContain("`target-spacer`");
  expect(ghostsMarkdown).toContain("`insertion-marker`");
  expect(ghostsMarkdown).toContain("zero-thickness, world-space `gap`");
  expect(ghostsMarkdown).toContain("`isCurrentPlacement`");
  expect(ghostsMarkdown).toContain("`pointer-preview`");
  expect(ghostsMarkdown).toContain("## Explicit Lifecycle Callbacks");
  expect(ghostsMarkdown).toContain("insertionMarker={{");
  expect(ghostsMarkdown).not.toContain("<GhostGuideDemo");
  expect(ghostsMarkdown).not.toContain("<script>");

  const lifecycleResponse = await request.get(
    "/docs/snapsort/guides/sessions/drag-start.md",
  );
  expect(lifecycleResponse.status()).toBe(200);
  const lifecycleMarkdown = await lifecycleResponse.text();
  expect(lifecycleMarkdown).toContain("## Terms");
  expect(lifecycleMarkdown).toContain("## Lifecycle at a Glance");

  const placementResponse = await request.get(
    "/docs/snapsort/guides/placement-modes.md",
  );
  expect(placementResponse.status()).toBe(200);
  const placementMarkdown = await placementResponse.text();
  expect(placementMarkdown).toContain("# Placement Modes");
  expect(placementMarkdown).toContain('`mode: "euclidean"`');
  expect(placementMarkdown).toContain('`mode: "insertion"`');
  expect(placementMarkdown).toContain('`mode: "swap"`');
  expect(placementMarkdown).toContain('`mode: "progressive"`');
  expect(placementMarkdown).not.toContain("getInsertionMarkerRect");
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
    "/docs/snapsort/introduction/setup.md?framework=vue",
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
    "[Quickstart (Svelte)](https://snapengine.dev/docs/snapsort/introduction/setup.md?framework=svelte)",
  );
  expect(snapSortIndex).toContain(
    "[Quickstart (React)](https://snapengine.dev/docs/snapsort/introduction/setup.md?framework=react)",
  );
  expect(snapSortIndex).toContain(
    "[Quickstart (Vanilla JS)](https://snapengine.dev/docs/snapsort/introduction/setup.md?framework=vanilla)",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/svelte/container.md?framework=svelte",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/react/container.md?framework=react",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/svelte/ghost.md?framework=svelte",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/react/ghost.md?framework=react",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/drag-session.md",
  );
  expect(snapSortIndex).toContain(
    "https://snapengine.dev/docs/snapsort/reference/callbacks.md",
  );
  const dragSessionsLine = "- Drag Sessions";
  const dragStartLine =
    "  - [Drag Start](https://snapengine.dev/docs/snapsort/guides/sessions/drag-start.md)";
  const ghostsLine =
    "  - [Drags and Ghosts (Svelte)](https://snapengine.dev/docs/snapsort/guides/sessions/ghosts.md?framework=svelte)";
  const commitLine =
    "  - [Commit and Cleanup](https://snapengine.dev/docs/snapsort/guides/sessions/commit-and-cleanup.md)";
  const advancedLine =
    "  - [Advanced Session Settings and Callbacks](https://snapengine.dev/docs/snapsort/examples/advanced-settings-and-callbacks.md)";
  const dropPoliciesLine =
    "  - [Programmatic Moves (Svelte)](https://snapengine.dev/docs/snapsort/guides/sessions/drop-policies.md?framework=svelte)";
  const placementModesLine =
    "- [Placement Modes](https://snapengine.dev/docs/snapsort/guides/placement-modes.md)";
  const examplesLine =
    "- [Examples](https://snapengine.dev/docs/snapsort/examples.md)";
  const basicsLine =
    "  - [Basics](https://snapengine.dev/docs/snapsort/examples/basics.md)";
  const containerRecipesLine =
    "  - [Container Recipes](https://snapengine.dev/docs/snapsort/examples/containers.md)";
  const itemRecipesLine =
    "  - [Item Recipes](https://snapengine.dev/docs/snapsort/examples/items.md)";
  const completeInterfacesLine =
    "  - [Complete Interfaces](https://snapengine.dev/docs/snapsort/examples/complete-interfaces.md)";
  for (const line of [
    dragSessionsLine,
    dragStartLine,
    ghostsLine,
    commitLine,
    dropPoliciesLine,
    placementModesLine,
    examplesLine,
    basicsLine,
    containerRecipesLine,
    itemRecipesLine,
    completeInterfacesLine,
    advancedLine,
  ]) {
    expect(snapSortIndex).toContain(line);
  }
  expect(snapSortIndex.indexOf(placementModesLine)).toBeLessThan(
    snapSortIndex.indexOf(dragSessionsLine),
  );
  expect(snapSortIndex.indexOf(dragSessionsLine)).toBeLessThan(
    snapSortIndex.indexOf(dragStartLine),
  );
  expect(snapSortIndex.indexOf(dragStartLine)).toBeLessThan(
    snapSortIndex.indexOf(ghostsLine),
  );
  expect(snapSortIndex.indexOf(ghostsLine)).toBeLessThan(
    snapSortIndex.indexOf(commitLine),
  );
  expect(snapSortIndex.indexOf(commitLine)).toBeLessThan(
    snapSortIndex.indexOf(dropPoliciesLine),
  );
  expect(snapSortIndex.indexOf(dropPoliciesLine)).toBeLessThan(
    snapSortIndex.indexOf(examplesLine),
  );
  expect(snapSortIndex.indexOf(examplesLine)).toBeLessThan(
    snapSortIndex.indexOf(basicsLine),
  );
  expect(snapSortIndex.indexOf(basicsLine)).toBeLessThan(
    snapSortIndex.indexOf(containerRecipesLine),
  );
  expect(snapSortIndex.indexOf(containerRecipesLine)).toBeLessThan(
    snapSortIndex.indexOf(itemRecipesLine),
  );
  expect(snapSortIndex.indexOf(itemRecipesLine)).toBeLessThan(
    snapSortIndex.indexOf(completeInterfacesLine),
  );
  expect(snapSortIndex.indexOf(completeInterfacesLine)).toBeLessThan(
    snapSortIndex.indexOf(advancedLine),
  );
  expect(snapSortIndex).not.toContain("  - [Placement Modes]");
  expect(snapSortIndex).not.toContain(
    "/docs/snapsort/guides/sessions/placement-modes",
  );
  expect(snapSortIndex).not.toContain(
    "https://snapengine.dev/docs/snapsort/guides/sessions.md",
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
