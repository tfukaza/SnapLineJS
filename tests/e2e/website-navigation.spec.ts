import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragBetween(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const [sourceBox, targetBox] = await Promise.all([
    source.boundingBox(),
    target.boundingBox(),
  ]);
  if (!sourceBox || !targetBox) {
    throw new Error("Gallery drag target has no layout box.");
  }

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
  await page.mouse.up();
  await page.waitForTimeout(200);
}

async function holdDragToPoint(
  page: Page,
  source: Locator,
  targetPoint: { x: number; y: number },
) {
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error("Gallery drag source has no layout box.");
  }

  const sourcePoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(sourcePoint.x + 7, sourcePoint.y + 7);
  await page.waitForTimeout(60);
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.waitForTimeout(120);
}

test("uses the arrow as a project selector and the wordmark as a homepage link", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const projectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapEngine/,
  });
  const projectMenu = page.locator("#project-nav-menu");
  const docsLink = primaryNav.getByRole("link", { name: "Docs", exact: true });
  const wordmark = primaryNav.locator(".wordmark");

  await expect(wordmark).toHaveText("SnapEngine");
  await expect(wordmark).toHaveAttribute("href", "/");
  await expect(projectMenu).not.toBeVisible();
  await expect(docsLink).toHaveAttribute(
    "href",
    "/docs/snapengine/introduction",
  );
  await projectTrigger.click();
  await expect(projectTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(projectMenu).toBeVisible();
  await expect(projectMenu.getByRole("link")).toHaveCount(4);
  await expect(
    projectMenu.getByRole("link", { name: "SnapEngine" }),
  ).toHaveAttribute("href", "/");
  await expect(
    projectMenu
      .getByRole("link", { name: "SnapEngine" })
      .locator(".project-nav-check"),
  ).toHaveText("✓");
  await expect(
    projectMenu.getByRole("link", { name: "SnapEngine" }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    projectMenu.getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/snapsort");
  await expect(
    projectMenu.getByRole("link", { name: "SnapLine" }),
  ).toHaveAttribute("href", "/snapline");
  await expect(
    projectMenu.getByRole("link", { name: "SnapDesign" }),
  ).toHaveAttribute("href", "/snapdesign");
  await expect(projectMenu.getByRole("link", { name: "SnapZap" })).toHaveCount(
    0,
  );

  await projectMenu.getByRole("link", { name: "SnapSort" }).click();
  await expect(page).toHaveURL(/\/snapsort$/);
  await expect(wordmark).toHaveText("SnapSort");
  await expect(wordmark).toHaveAttribute("href", "/snapsort");
  await expect(docsLink).toHaveAttribute("href", "/docs/snapsort/introduction");
  await expect(
    primaryNav.getByRole("link", { name: "Examples", exact: true }),
  ).toHaveAttribute("href", "/docs/snapsort/examples");
  await expect(primaryNav.getByRole("link", { name: "About" })).toHaveCount(0);

  await page.goto("/docs/snapsort/examples", { waitUntil: "networkidle" });
  await expect(wordmark).toHaveText("SnapSort");
  await expect(
    primaryNav.getByRole("link", { name: "Examples", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(docsLink).not.toHaveAttribute("aria-current", "page");
  const docsProjectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapSort/,
  });
  await docsProjectTrigger.click();
  await expect(
    projectMenu.getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/snapsort");
  await expect(
    projectMenu.getByRole("link", { name: "SnapEngine" }),
  ).toHaveAttribute("href", "/");
  await expect(
    projectMenu.getByRole("link", { name: "SnapDesign" }),
  ).toHaveAttribute("href", "/snapdesign");

  await page.keyboard.press("Escape");
  await expect(docsProjectTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(docsProjectTrigger).toBeFocused();

  await docsProjectTrigger.click();
  await page.mouse.click(1200, 500);
  await expect(docsProjectTrigger).toHaveAttribute("aria-expanded", "false");

  await wordmark.click();
  await expect(page).toHaveURL(/\/snapsort$/);
  await expect(projectMenu).not.toBeVisible();
});

test("uses SnapEngine navigation for global pages", async ({ page }) => {
  await page.goto("/about", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(primaryNav.locator(".wordmark")).toHaveText("SnapEngine");
  await expect(primaryNav.locator(".wordmark")).toHaveAttribute("href", "/");
  await expect(
    primaryNav.getByRole("link", { name: "Docs", exact: true }),
  ).toHaveAttribute("href", "/docs/snapengine/introduction");
  await expect(
    primaryNav.getByRole("link", { name: "About", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(primaryNav.getByRole("link", { name: "Examples" })).toHaveCount(
    0,
  );
});

test("puts project documentation inside the icon-only mobile menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/snapline/introduction", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const projectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapLine/,
  });

  await expect(primaryNav.locator(".wordmark")).toHaveText("SnapLine");
  await expect(primaryNav.locator(".wordmark")).toHaveAttribute(
    "href",
    "/snapline",
  );
  await expect(projectTrigger).toBeVisible();
  await projectTrigger.click();
  await expect(page.locator("#project-nav-menu")).toBeVisible();
  await expect(
    page.locator("#project-nav-menu").getByRole("link", { name: "SnapSort" }),
  ).toHaveAttribute("href", "/snapsort");
  await expect(
    page.locator("#project-nav-menu").getByRole("link", { name: "SnapDesign" }),
  ).toHaveAttribute("href", "/snapdesign");

  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: /Browse .* docs/ }),
  ).toHaveCount(0);

  const mobileHeaderTrigger = primaryNav.getByRole("button", {
    name: "Toggle navigation",
  });
  await expect(mobileHeaderTrigger).toHaveText("≡");
  await mobileHeaderTrigger.click();
  await expect(mobileHeaderTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(mobileHeaderTrigger).toHaveText("×");
  await expect(
    primaryNav.getByRole("link", { name: "Docs", exact: true }),
  ).toHaveAttribute("href", "/docs/snapline/introduction");
  await expect(primaryNav.getByRole("link", { name: "About" })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "Examples" })).toHaveCount(
    0,
  );

  const mobileDocs = primaryNav.locator(".mobile-doc-navigation");
  await expect(mobileDocs).toBeVisible();
  await expect(mobileDocs).toContainText("SnapLine docs");
  await expect(mobileDocs.getByLabel("Framework")).toBeVisible();
  await expect(
    mobileDocs.getByRole("link", { name: "Installation and setup" }),
  ).toHaveAttribute("href", "/docs/snapline/introduction/01_setup");
  await expect(
    mobileDocs.getByRole("link", { name: "SnapLine", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("uses SnapDesign navigation on Guideline and Gallery pages", async ({
  page,
}) => {
  await page.goto("/snapdesign", { waitUntil: "networkidle" });

  const primaryNav = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const projectTrigger = primaryNav.getByRole("button", {
    name: /Switch project\. Current project: SnapDesign/,
  });
  const wordmark = primaryNav.locator(".wordmark");
  const guideline = primaryNav.getByRole("link", {
    name: "Guideline",
    exact: true,
  });
  const gallery = primaryNav.getByRole("link", {
    name: "Gallery",
    exact: true,
  });

  await expect(wordmark).toHaveText("SnapDesign");
  await expect(wordmark).toHaveAttribute("href", "/snapdesign");
  await expect(projectTrigger).toHaveText("");
  await expect(guideline).toHaveAttribute("href", "/snapdesign");
  await expect(guideline).toHaveAttribute("aria-current", "page");
  await expect(gallery).toHaveAttribute("href", "/snapdesign/gallery");
  await expect(primaryNav.getByRole("link", { name: "Docs" })).toHaveCount(0);
  await expect(primaryNav.getByRole("link", { name: "About" })).toHaveCount(0);
  await expect(
    primaryNav.getByRole("link", { name: "SnapEngine on GitHub" }),
  ).toBeVisible();

  await gallery.click();
  await expect(page).toHaveURL(/\/snapdesign\/gallery$/);
  await expect(wordmark).toHaveText("SnapDesign");
  await expect(gallery).toHaveAttribute("aria-current", "page");
  await expect(guideline).not.toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const mobileHeaderTrigger = primaryNav.getByRole("button", {
    name: "Toggle navigation",
  });
  await mobileHeaderTrigger.click();
  await expect(guideline).toBeVisible();
  await expect(gallery).toBeVisible();
  await expect(
    primaryNav.getByRole("link", { name: "SnapEngine on GitHub" }),
  ).toBeVisible();
});

test("serves the interactive Gallery and removes the old photo-op route", async ({
  page,
  request,
}) => {
  const oldPhotoOp = await request.get("/snapsort/photo-op", {
    maxRedirects: 0,
  });
  expect(oldPhotoOp.status()).toBe(404);

  await page.goto("/snapdesign", { waitUntil: "networkidle" });
  const guidelineToggleSurface = page
    .locator('.toggle[aria-label="Skeuomorphic toggle"] .material-surface.recessed')
    .first();
  await guidelineToggleSurface.scrollIntoViewIfNeeded();
  const guidelineToggleRecipe = await guidelineToggleSurface.evaluate(
    (surface) => {
      const style = getComputedStyle(surface);
      return [
        "--material-light-angle",
        "--material-rim-width",
        "--material-rim-blur",
        "--material-shadow-far-blur",
        "--material-shadow-far-x",
        "--material-shadow-far-y",
        "--material-crevice-visibility",
      ].map((property) => style.getPropertyValue(property).trim());
    },
  );

  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Gallery", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-gallery]")).toHaveCount(6);
  const stageDimensions = await page.locator(".demo-stage").evaluateAll(
    (stages) =>
      stages.map((stage) => ({
        width: stage.clientWidth,
        height: stage.clientHeight,
      })),
  );
  expect(stageDimensions).toHaveLength(6);
  for (const { width, height } of stageDimensions) {
    expect(Math.abs(width - height)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://snapengine.dev/snapdesign/gallery",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

  const layersGeometry = await page
    .locator('[data-demo="layers-panel"]')
    .evaluate((demo) => {
      const shell = demo.querySelector<HTMLElement>(".figma-shell");
      const panel = demo.querySelector<HTMLElement>(
        ".layers-card.material-surface",
      );
      const group = demo.querySelector<HTMLElement>(
        '[data-layer-id="header"]',
      );
      const child = demo.querySelector<HTMLElement>(
        '[data-layer-id="brand-mark"]',
      );
      const rows = [...demo.querySelectorAll<HTMLElement>(".layers-tree-row")];
      if (!shell || !panel || !group || !child) {
        throw new Error("Layers panel geometry targets are missing.");
      }

      const demoRect = demo.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      const childRect = child.getBoundingClientRect();
      const rowTops = rows.map((row) => row.getBoundingClientRect().top);
      return {
        shellTopOffset: shellRect.top - demoRect.top,
        shellWidthDelta: shellRect.width - demoRect.width,
        shellHeightDelta: shellRect.height - demoRect.height,
        panelCenterDelta:
          panelRect.left + panelRect.width / 2 -
          (demoRect.left + demoRect.width / 2),
        panelVerticalCenterDelta:
          panelRect.top + panelRect.height / 2 -
          (demoRect.top + demoRect.height / 2),
        panelWidthRatio: panelRect.width / demoRect.width,
        panelHeight: panelRect.height,
        childInset: childRect.left - groupRect.left,
        childIsNarrower: childRect.width < groupRect.width,
        rowGaps: rowTops.slice(1).map((top, index) => top - rowTops[index]),
      };
    });
  expect(Math.abs(layersGeometry.shellTopOffset)).toBeLessThanOrEqual(1);
  expect(Math.abs(layersGeometry.shellWidthDelta)).toBeLessThanOrEqual(1);
  expect(Math.abs(layersGeometry.shellHeightDelta)).toBeLessThanOrEqual(1);
  expect(Math.abs(layersGeometry.panelCenterDelta)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(layersGeometry.panelVerticalCenterDelta),
  ).toBeLessThanOrEqual(1);
  expect(layersGeometry.panelWidthRatio).toBeGreaterThanOrEqual(0.45);
  expect(layersGeometry.panelWidthRatio).toBeLessThanOrEqual(0.47);
  expect(Math.abs(layersGeometry.panelHeight - 464)).toBeLessThanOrEqual(1);
  expect(layersGeometry.childInset).toBeGreaterThanOrEqual(19);
  expect(layersGeometry.childIsNarrower).toBe(true);
  for (const gap of layersGeometry.rowGaps) {
    expect(Math.abs(gap - 36)).toBeLessThanOrEqual(1);
  }

  const todoStage = page.locator('[data-gallery="todo-list"] .todo-stage');
  const todoDemo = todoStage.locator(".todo-demo");
  const todoList = todoStage.locator('[data-demo="todo-list"]');
  const promoTodo = todoStage.locator('[data-todo-id="todo-promo"]');
  await expect(todoStage).toHaveAttribute("inert", "");
  await expect(todoStage).toHaveAttribute("aria-hidden", "true");
  await expect(todoStage).toHaveCSS("pointer-events", "none");
  await expect(
    todoStage.locator(".todo-label"),
  ).toHaveText([
    "Promo video",
    "Support accessibility",
    "SSR mode",
    "Publish gallery",
  ]);

  const galleryToggleRecipe = await todoStage
    .locator(".todo-toggle .material-surface.recessed")
    .first()
    .evaluate((surface) => {
      const style = getComputedStyle(surface);
      return [
        "--material-light-angle",
        "--material-rim-width",
        "--material-rim-blur",
        "--material-shadow-far-blur",
        "--material-shadow-far-x",
        "--material-shadow-far-y",
        "--material-crevice-visibility",
      ].map((property) => style.getPropertyValue(property).trim());
    });
  expect(galleryToggleRecipe).toEqual(guidelineToggleRecipe);

  await todoDemo.scrollIntoViewIfNeeded();
  await expect(todoDemo).toHaveAttribute("data-todo-autoplay-active", "true");
  await expect(promoTodo).toHaveAttribute("data-completed", "true", {
    timeout: 5_000,
  });
  await expect(
    promoTodo.locator('[role="switch"]'),
  ).toHaveAttribute("aria-checked", "true");
  await expect(todoList).toHaveAttribute(
    "data-todo-order",
    "todo-accessibility,todo-ssr,todo-publish,todo-promo",
    { timeout: 5_000 },
  );
  await expect(todoList).toHaveAttribute(
    "data-todo-order",
    "todo-promo,todo-accessibility,todo-ssr,todo-publish",
    { timeout: 5_000 },
  );
  await expect(promoTodo).toHaveAttribute("data-completed", "false");

  const swapItems = page.locator(".swap-grid > .snapsort-item");
  await expect(swapItems).toHaveCount(6);
  const swapLabels = () =>
    swapItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-swap-label")),
    );
  await expect.poll(swapLabels).toEqual(["A", "B", "C", "D", "E", "F"]);
  await dragBetween(page, swapItems.nth(0), swapItems.nth(1));
  await expect.poll(swapLabels).toEqual(["B", "A", "C", "D", "E", "F"]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const mobileLayout = await page.evaluate(() => {
    const nestedStage = document.querySelector<HTMLElement>(
      '[data-gallery="nested-containers"] .demo-stage',
    );
    if (!nestedStage) throw new Error("Nested Gallery stage is missing");

    return {
      documentWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      stageWidth: nestedStage.clientWidth,
      stageHeight: nestedStage.clientHeight,
      stageScrollHeight: nestedStage.scrollHeight,
    };
  });
  expect(mobileLayout.documentScrollWidth).toBe(mobileLayout.documentWidth);
  expect(Math.abs(mobileLayout.stageWidth - mobileLayout.stageHeight)).toBeLessThanOrEqual(1);
  expect(mobileLayout.stageScrollHeight).toBeLessThanOrEqual(
    mobileLayout.stageHeight,
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  const reducedTodoDemo = page.locator(".todo-demo");
  await reducedTodoDemo.scrollIntoViewIfNeeded();
  await expect(reducedTodoDemo).toHaveAttribute("data-todo-phase", "reduced");
  await expect(reducedTodoDemo).toHaveAttribute(
    "data-todo-autoplay-active",
    "false",
  );
  await expect(
    page.locator('[data-todo-id="todo-promo"]'),
  ).toHaveAttribute("data-completed", "true");
  await expect(page.locator('[data-demo="todo-list"]')).toHaveAttribute(
    "data-todo-order",
    "todo-promo,todo-accessibility,todo-ssr,todo-publish",
  );

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapXml = await sitemap.text();
  expect(sitemapXml).toContain("https://snapengine.dev/snapdesign");
  expect(sitemapXml).toContain("https://snapengine.dev/snapdesign/gallery");
  expect(sitemapXml).not.toContain("/snapsort/photo-op");
});

test("Layers panel nests by main-axis proximity and unnests by leading edge", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const layersPanel = page.locator('[data-demo="layers-panel"]');
  await layersPanel.scrollIntoViewIfNeeded();
  const group = layersPanel.locator('[data-layer-id="navigation"]');
  const groupRow = group.locator(":scope > .group-row");
  const artwork = layersPanel.locator('[data-layer-id="hero-artwork"]');
  const groupRowBox = await groupRow.boundingBox();
  if (!groupRowBox) {
    throw new Error("Layers panel group row has no layout box.");
  }

  await holdDragToPoint(page, artwork, {
    x: groupRowBox.x + 4,
    y: groupRowBox.y + groupRowBox.height + 1,
  });
  await expect(
    group.locator(
      '.insertion-tree-marker[data-tree-marker-hidden="false"]',
    ),
  ).toBeVisible();
  await page.mouse.up();
  await expect(
    group.locator('[data-layer-id="hero-artwork"]'),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      layersPanel.locator("[data-layer-id]").evaluateAll((elements) =>
        elements.every(
          (element) => !(element as HTMLElement).style.transform,
        ),
      ),
    )
    .toBe(true);

  const [artworkBox, notesBox] = await Promise.all([
    artwork.boundingBox(),
    layersPanel.locator('[data-layer-id="prototype-notes"]').boundingBox(),
  ]);
  if (!artworkBox || !notesBox) {
    throw new Error("Layers panel drag target has no layout box.");
  }

  await page.mouse.move(
    artworkBox.x + artworkBox.width / 2,
    artworkBox.y + artworkBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    artworkBox.x + artworkBox.width / 2 + 7,
    artworkBox.y + 7,
  );
  await page.waitForTimeout(60);
  await page.mouse.move(notesBox.x + 4, notesBox.y + notesBox.height / 2, {
    steps: 12,
  });
  await page.waitForTimeout(120);
  await page.mouse.up();

  await expect(
    layersPanel.locator('.layers-tree-root > [data-layer-id="hero-artwork"]'),
  ).toHaveCount(1);
});

test("Layers panel group FLIP preserves unchanged descendants and animates local changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const layersPanel = page.locator('[data-demo="layers-panel"]');
  await layersPanel.scrollIntoViewIfNeeded();
  await page.addStyleTag({
    content: `
      [data-demo="layers-panel"]
        .layers-tree-root
        > [data-layer-id="header"]
        > [data-layer-id="brand-mark"] {
        margin-left: calc(var(--layers-node-indent) + 12px) !important;
      }
    `,
  });
  const header = layersPanel.locator('[data-layer-id="header"]');
  const notes = layersPanel.locator('[data-layer-id="prototype-notes"]');
  const relations = [
    { childId: "brand-mark", parentId: "header" },
    { childId: "navigation", parentId: "header" },
    { childId: "features", parentId: "navigation" },
    { childId: "pricing", parentId: "navigation" },
  ];
  const baselineOffsets = await layersPanel.evaluate((demo, pairs) => {
    return Object.fromEntries(
      pairs.map(({ childId, parentId }) => {
        const child = demo.querySelector<HTMLElement>(
          `[data-layer-id="${childId}"]`,
        );
        const parent = demo.querySelector<HTMLElement>(
          `[data-layer-id="${parentId}"]`,
        );
        if (!child || !parent) {
          throw new Error("Layers panel FLIP relation is missing.");
        }
        const childRect = child.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        return [
          `${childId}:${parentId}`,
          {
            x: childRect.x - parentRect.x,
            y: childRect.y - parentRect.y,
          },
        ];
      }),
    );
  }, relations);

  const notesBox = await notes.boundingBox();
  if (!notesBox) {
    throw new Error("Layers panel root insertion target has no layout box.");
  }
  await holdDragToPoint(page, header.locator(":scope > .group-row"), {
    x: notesBox.x + 4,
    y: notesBox.y + notesBox.height / 2,
  });
  await page.waitForTimeout(320);

  const frameTrace = layersPanel.evaluate(
    (demo, pairs) =>
      new Promise<
        Array<{
          connected: boolean;
          transforms: Record<string, string>;
          offsets: Record<string, { x: number; y: number }>;
        }>
      >((resolve) => {
        const itemIds = [
          "header",
          "brand-mark",
          "navigation",
          "features",
          "pricing",
          "feature-cards",
        ];
        const frames: Array<{
          connected: boolean;
          transforms: Record<string, string>;
          offsets: Record<string, { x: number; y: number }>;
        }> = [];
        const startedAt = performance.now();
        const sample = () => {
          const items = new Map(
            itemIds.map((itemId) => [
              itemId,
              demo.querySelector<HTMLElement>(
                `[data-layer-id="${itemId}"]`,
              ),
            ]),
          );
          const connected = [...items.values()].every(Boolean);
          const transforms = Object.fromEntries(
            itemIds.map((itemId) => [
              itemId,
              items.get(itemId)?.style.transform ?? "",
            ]),
          );
          const offsets: Record<string, { x: number; y: number }> = {};
          for (const { childId, parentId } of pairs) {
            const child = items.get(childId);
            const parent = items.get(parentId);
            if (!child || !parent) continue;
            const childRect = child.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();
            offsets[`${childId}:${parentId}`] = {
              x: childRect.x - parentRect.x,
              y: childRect.y - parentRect.y,
            };
          }
          frames.push({ connected, transforms, offsets });

          if (performance.now() - startedAt >= 420) {
            resolve(frames);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    relations,
  );
  await page.mouse.up();
  const frames = (await frameTrace).filter((frame) => frame.connected);

  await expect(
    layersPanel.locator('.layers-tree-root > [data-layer-id="header"]'),
  ).toHaveCount(1);
  expect(frames.length).toBeGreaterThan(4);
  expect(
    frames.some(({ transforms }) => transforms.header !== ""),
  ).toBe(true);
  expect(
    frames.some(({ transforms }) => transforms["feature-cards"] !== ""),
  ).toBe(true);
  expect(
    frames.some(({ transforms }) => transforms["brand-mark"] !== ""),
  ).toBe(true);

  for (const frame of frames) {
    for (const itemId of ["navigation", "features", "pricing"]) {
      expect(frame.transforms[itemId]).toBe("");
    }
    for (const [relation, baseline] of Object.entries(baselineOffsets)) {
      if (relation === "brand-mark:header") continue;
      const offset = frame.offsets[relation];
      expect(offset).toBeDefined();
      expect(Math.abs(offset.x - baseline.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.y - baseline.y)).toBeLessThanOrEqual(1);
    }
  }

  const brandBaseline = baselineOffsets["brand-mark:header"];
  const finalBrandFrame = frames.at(-1);
  const finalBrandOffset = finalBrandFrame?.offsets["brand-mark:header"];
  const animatedBrandOffsets = frames
    .filter(({ transforms }) => transforms["brand-mark"] !== "")
    .map(({ offsets }) => offsets["brand-mark:header"].x - brandBaseline.x);
  expect(finalBrandFrame).toBeDefined();
  expect(finalBrandOffset).toBeDefined();
  expect(finalBrandFrame?.transforms["brand-mark"]).toBe("");
  expect(animatedBrandOffsets.some((offset) => offset > 0 && offset < 12)).toBe(
    true,
  );
  expect(
    Math.abs((finalBrandOffset?.x ?? 0) - brandBaseline.x - 12),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs((finalBrandOffset?.y ?? 0) - brandBaseline.y),
  ).toBeLessThanOrEqual(1);
});

test("Layers panel keeps collapsed-group edges available for sibling insertion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const layersPanel = page.locator('[data-demo="layers-panel"]');
  await layersPanel.scrollIntoViewIfNeeded();
  const desktopHome = layersPanel.locator('[data-layer-id="desktop-home"]');
  const header = layersPanel.locator('[data-layer-id="header"]');
  const featureCards = layersPanel.locator('[data-layer-id="feature-cards"]');
  const notes = layersPanel.locator('[data-layer-id="prototype-notes"]');

  await header
    .getByRole("button", { name: "Collapse Header" })
    .click();
  await featureCards
    .getByRole("button", { name: "Collapse Feature cards" })
    .click();
  await expect(
    header.getByRole("button", { name: "Expand Header" }),
  ).toBeVisible();
  await expect(
    featureCards.getByRole("button", { name: "Expand Feature cards" }),
  ).toBeVisible();

  const headerRowBox = await header
    .locator(":scope > .group-row")
    .boundingBox();
  if (!headerRowBox) {
    throw new Error("Collapsed Layers group row has no layout box.");
  }

  await holdDragToPoint(page, notes, {
    x: headerRowBox.x + headerRowBox.width / 2,
    y: headerRowBox.y + headerRowBox.height - 2,
  });
  await expect(
    desktopHome.locator(
      ':scope > .insertion-tree-marker[data-tree-marker-hidden="false"]',
    ),
  ).toBeVisible();
  await expect(
    layersPanel.locator('[data-layer-targeted="true"]'),
  ).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(200);

  const desktopLayerIds = () =>
    desktopHome
      .locator(":scope > [data-layer-id]")
      .evaluateAll((entries) =>
        entries.map((entry) => entry.getAttribute("data-layer-id")),
      );
  await expect.poll(desktopLayerIds).toEqual([
    "header",
    "prototype-notes",
    "feature-cards",
    "hero-artwork",
  ]);

  const featureCardsRowBox = await featureCards
    .locator(":scope > .group-row")
    .boundingBox();
  if (!featureCardsRowBox) {
    throw new Error("Collapsed Layers group row has no layout box.");
  }

  await holdDragToPoint(page, notes, {
    x: featureCardsRowBox.x + featureCardsRowBox.width / 2,
    y: featureCardsRowBox.y + featureCardsRowBox.height / 2,
  });
  await expect(featureCards).toHaveAttribute("data-layer-targeted", "true");
  await expect(
    desktopHome.locator(
      ':scope > .insertion-tree-marker[data-tree-marker-hidden="false"]',
    ),
  ).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(200);

  await featureCards
    .getByRole("button", { name: "Expand Feature cards" })
    .click();
  await expect(
    featureCards.locator(':scope > [data-layer-id="prototype-notes"]'),
  ).toHaveCount(1);
});

test("keeps coming-soon SnapLine pages unlisted but directly accessible", async ({
  page,
  request,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const snapLineCard = page.locator("#asset-snapline");
  const snapZapCard = page.locator("#asset-snapzap");
  await expect(snapLineCard).toContainText("Coming soon");
  await expect(snapLineCard.getByRole("link")).toHaveCount(0);
  await expect(
    snapLineCard.getByRole("button", { name: "Learn more" }),
  ).toBeDisabled();
  await expect(snapZapCard).toContainText("Coming soon");
  await expect(
    page.locator(".planned-asset-node", { hasText: "SnapLine" }),
  ).toContainText("Coming soon");
  await expect(
    page.locator("footer").getByText("SnapLine · Coming soon"),
  ).toBeVisible();

  await page.goto("/docs", { waitUntil: "networkidle" });
  await expect(page.locator(".doc-article")).toContainText(
    "SnapLine is a planned toolkit",
  );
  await expect(
    page.locator('.doc-article a[href^="/docs/snapline"]'),
  ).toHaveCount(0);

  await page.goto("/snapline", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", { name: "Node-based UI primitives" }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(
    page.getByRole("link", {
      name: /SnapLine docs|Read the docs|Install SnapLine/,
    }),
  ).toHaveCount(0);

  await page.goto("/docs/snapline/introduction", { waitUntil: "networkidle" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(
    page.getByRole("heading", { name: "SnapLine", level: 1 }),
  ).toBeVisible();

  const rootLlms = await request.get("/llms.txt");
  expect(rootLlms.ok()).toBe(true);
  expect(await rootLlms.text()).not.toContain("SnapLine");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).not.toContain("/snapline");

  const markdown = await request.get("/docs/snapline/introduction.md");
  expect(markdown.ok()).toBe(true);
  expect(markdown.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  const projectLlms = await request.get("/docs/snapline/llms.txt");
  expect(projectLlms.ok()).toBe(true);
  expect(projectLlms.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});

test("uses one reading width for documentation chrome and article content", async ({
  page,
}) => {
  await page.goto("/docs/snapengine/reference/engine", {
    waitUntil: "networkidle",
  });

  const selectors = [
    ".doc-breadcrumb",
    ".doc-header",
    ".doc-article > p",
    ".doc-article > .display",
    ".doc-article > table",
    ".doc-pagination",
  ];
  const boxes = await Promise.all(
    selectors.map((selector) => page.locator(selector).first().boundingBox()),
  );
  const measuredBoxes = boxes.filter(
    (box): box is NonNullable<typeof box> => box !== null,
  );

  expect(measuredBoxes).toHaveLength(selectors.length);
  for (const box of measuredBoxes) {
    expect(box.x).toBeCloseTo(measuredBoxes[0].x, 0);
    expect(box.width).toBeCloseTo(measuredBoxes[0].width, 0);
  }
  expect(measuredBoxes[0].width).toBeLessThanOrEqual(700);
});
