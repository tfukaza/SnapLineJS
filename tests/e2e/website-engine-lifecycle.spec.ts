import { expect, test } from "@playwright/test";

test("owned Svelte engines survive page teardown without errors", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#highlight-animation")).toBeVisible();
  await expect(page.locator("#collision-card-canvas")).toBeVisible();

  const collisionCanvas = await page
    .locator("#collision-card-canvas")
    .boundingBox();
  expect(collisionCanvas?.width).toBeGreaterThan(800);
  expect(collisionCanvas?.height).toBeGreaterThan(400);

  await page.getByRole("link", { name: "About", exact: true }).first().click();
  await expect(page).toHaveURL(/\/about$/);

  expect(pageErrors).toEqual([]);
});

test("marker ghost callbacks do not emit flow-mode warnings", async ({
  page,
}) => {
  const ghostWarnings: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      message.text().includes("ghost callbacks")
    ) {
      ghostWarnings.push(message.text());
    }
  });

  await page.goto("/snapsort/gallery");
  await expect(page.locator("#swap-grid .swap-grid")).toBeVisible();

  expect(ghostWarnings).toEqual([]);
});

test("SnapSort asset preview pans and moves items through the imperative API", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  const card = page.locator(".drop-snap-card");
  const preview = page.locator(
    "#assets-snapsort-preview-engine .preview-mosaic",
  );
  const pan = card.locator(".snapsort-preview-pan");
  const scale = card.locator(".snapsort-preview-scale");
  const firstKanbanColumn = card.locator(".preview-kanban-column").first();
  const sentenceAnswer = card.locator(".preview-sentence-zone").first();
  const firstTile = card.locator(".preview-tile-grid > .snapsort-item").first();
  const fileRows = card.locator(".preview-file-tree > .snapsort-item");
  const editorTools = card.locator(".preview-editor-tools");
  const editorCanvas = card.locator(".preview-editor-canvas");

  await card.scrollIntoViewIfNeeded();
  await expect(preview).toBeVisible();
  await expect(card).toHaveJSProperty("tagName", "ARTICLE");
  await expect(card.getByRole("link", { name: "Learn more" })).toBeVisible();
  await expect(card.locator(".framework-list")).toHaveCount(0);
  await expect(card.locator(".slot")).toHaveCount(0);
  await expect(
    firstKanbanColumn.locator(":scope > .snapsort-item"),
  ).toHaveCount(2);
  await expect(sentenceAnswer.locator(":scope > .snapsort-item")).toHaveCount(
    2,
  );
  await expect(firstTile).toHaveText("01");
  await expect(fileRows).toHaveCount(5);
  await expect(editorTools.locator(":scope > .snapsort-item")).toHaveCount(3);
  await expect(editorCanvas.locator(":scope > .snapsort-item")).toHaveCount(0);

  const nativeGridMetrics = await preview.evaluate((element) => ({
    layoutWidth: (element as HTMLElement).offsetWidth,
    renderedWidth: element.getBoundingClientRect().width,
  }));
  expect(nativeGridMetrics.layoutWidth).toBe(1084);
  expect(nativeGridMetrics.renderedWidth).toBeLessThan(500);

  const exhibitRows = await card.evaluate((element) => ({
    sentence: element
      .querySelector(".preview-sentence-panel")!
      .getBoundingClientRect().top,
    kanban: element
      .querySelector(".preview-kanban-panel")!
      .getBoundingClientRect().top,
    editor: element
      .querySelector(".preview-editor-panel")!
      .getBoundingClientRect().top,
  }));
  expect(exhibitRows.kanban).toBeGreaterThan(exhibitRows.sentence);
  expect(exhibitRows.kanban).toBeLessThan(exhibitRows.editor);

  const edgeMetrics = await card.evaluate((element) => {
    const cardRect = element.getBoundingClientRect();
    const previewRect = element
      .querySelector(".snapsort-preview-window")!
      .getBoundingClientRect();
    return {
      left: previewRect.left - cardRect.left,
      right: cardRect.right - previewRect.right,
      bottom: cardRect.bottom - previewRect.bottom,
    };
  });
  expect(edgeMetrics.left).toBeCloseTo(0, 3);
  expect(edgeMetrics.right).toBeCloseTo(0, 3);
  expect(edgeMetrics.bottom).toBeCloseTo(0, 3);

  const cardBefore = await card.boundingBox();
  const panBefore = await pan.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await expect(scale).toHaveCSS("filter", /grayscale\(1\)/);

  await card.hover();
  await expect(card).toHaveAttribute("data-preview-active", "true");
  await expect(card).toHaveAttribute("data-preview-hovered", "true");
  for (const selector of [
    ".preview-trash-list span:first-child",
    ".preview-clone-blocks .heading-block",
  ]) {
    await expect(card.locator(selector)).toHaveCSS(
      "animation-play-state",
      "running",
    );
  }
  await expect
    .poll(
      () =>
        card
          .locator('[data-preview-entry-id="preview-kanban-motion"]')
          .evaluate((element) =>
            element
              .getAnimations()
              .some((animation) => animation.playState === "running"),
          ),
      { timeout: 1500 },
    )
    .toBe(true);
  await expect
    .poll(() => fileRows.last().textContent())
    .toContain("Card.svelte");
  await expect
    .poll(() =>
      card
        .locator('[data-preview-entry-id="preview-file-card"]')
        .evaluate((element) =>
          element
            .getAnimations()
            .some((animation) => animation.playState === "running"),
        ),
    )
    .toBe(true);
  await expect
    .poll(() => firstKanbanColumn.locator(":scope > .snapsort-item").count())
    .toBe(1);
  await expect.poll(() => firstTile.textContent()).toBe("02");
  const movedTile = card.locator(
    '[data-preview-entry-id="preview-tile-primary"]',
  );
  await expect
    .poll(() =>
      movedTile.evaluate((element) =>
        element
          .getAnimations()
          .some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(true);
  await expect(
    movedTile.locator(
      "xpath=ancestor::*[contains(@class, 'snapsort-item')][1]",
    ),
  ).toHaveCSS("transform", "none");
  await expect
    .poll(() => editorCanvas.locator(":scope > .snapsort-item").count())
    .toBe(1);
  await expect
    .poll(() =>
      card
        .locator('[data-preview-entry-id="preview-editor-text"]')
        .evaluate((element) =>
          element
            .getAnimations()
            .some((animation) => animation.playState === "running"),
        ),
    )
    .toBe(true);
  await expect
    .poll(() => sentenceAnswer.locator(":scope > .snapsort-item").count())
    .toBe(3);
  await expect(scale).toHaveCSS("filter", /grayscale\(0\)/);

  const pointerCardBox = await card.boundingBox();
  if (!pointerCardBox)
    throw new Error("Expected the SnapSort card to have bounds.");
  await page.mouse.move(pointerCardBox.x + 20, pointerCardBox.y + 20);
  await page.waitForTimeout(220);
  const topPan = await pan.evaluate(
    (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
  );
  await page.mouse.move(
    pointerCardBox.x + pointerCardBox.width - 20,
    pointerCardBox.y + pointerCardBox.height - 20,
  );
  await page.waitForTimeout(220);
  const bottomPan = await pan.evaluate(
    (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
  );
  expect(bottomPan).toBeLessThan(topPan - 100);

  const panAfter = await pan.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(panAfter).not.toBe(panBefore);

  const cardAfter = await card.boundingBox();
  expect(cardAfter?.x).toBeCloseTo(cardBefore?.x ?? 0, 3);
  expect(cardAfter?.y).toBeCloseTo(cardBefore?.y ?? 0, 3);
  expect(cardAfter?.width).toBeCloseTo(cardBefore?.width ?? 0, 3);
  expect(cardAfter?.height).toBeCloseTo(cardBefore?.height ?? 0, 3);

  await card.getByRole("link", { name: "Learn more" }).click();
  await expect(page).toHaveURL(/\/snapsort$/);
  expect(pageErrors).toEqual([]);
});

test("SnapSort asset preview honors reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const card = page.locator(".drop-snap-card");
  const firstKanbanColumn = card.locator(".preview-kanban-column").first();
  await card.scrollIntoViewIfNeeded();
  await expect(
    firstKanbanColumn.locator(":scope > .snapsort-item"),
  ).toHaveCount(2);

  await card.hover();
  await expect(card).toHaveAttribute("data-preview-active", "false");
  await expect(card).toHaveAttribute("data-preview-hovered", "true");
  await expect(card.locator(".snapsort-preview-scale")).toHaveCSS(
    "filter",
    /grayscale\(0\)/,
  );
  await page.waitForTimeout(1200);
  await expect(
    firstKanbanColumn.locator(":scope > .snapsort-item"),
  ).toHaveCount(2);
  await expect(card.locator(".snapsort-preview-pan")).toHaveCSS(
    "animation-name",
    "none",
  );
  const reducedPanBefore = await card
    .locator(".snapsort-preview-pan")
    .evaluate((element) => getComputedStyle(element).transform);
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error("Expected the SnapSort card to have bounds.");
  await page.mouse.move(cardBox.x + 10, cardBox.y + cardBox.height - 10);
  const reducedPanAfter = await card
    .locator(".snapsort-preview-pan")
    .evaluate((element) => getComputedStyle(element).transform);
  expect(reducedPanAfter).toBe(reducedPanBefore);
});

test("SnapSort asset preview activates and pans with scroll on touch screens", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");

  const card = page.locator(".drop-snap-card");
  const pan = card.locator(".snapsort-preview-pan");
  const firstKanbanColumn = card.locator(".preview-kanban-column").first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-preview-active", "true");
  await expect(card).toHaveAttribute("data-preview-hovered", "true");

  const panBeforeScroll = await pan.evaluate(
    (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
  );
  await page.evaluate(() => window.scrollBy(0, 140));
  await expect
    .poll(() =>
      pan.evaluate(
        (element) => new DOMMatrix(getComputedStyle(element).transform).m42,
      ),
    )
    .toBeLessThan(panBeforeScroll - 15);
  await expect
    .poll(() => firstKanbanColumn.locator(":scope > .snapsort-item").count())
    .toBe(1);

  await context.close();
});

test("camera card reserves modified wheel input for zoom", async ({ page }) => {
  await page.goto("/");

  const card = page.locator(".camera-control-card");
  const camera = page.locator("#snap-camera-control");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await expect(camera).toBeVisible();

  const movePointerOverCard = async () => {
    const box = await card.boundingBox();
    if (!box) throw new Error("Expected camera card to have a bounding box.");
    await page.mouse.move(
      box.x + box.width / 2,
      Math.min(box.y + box.height / 2, 760),
    );
  };

  await movePointerOverCard();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const transformBefore = await camera.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  await page.mouse.wheel(0, 420);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrollBefore + 100);
  expect(
    await camera.evaluate(
      (element) => (element as HTMLElement).style.transform,
    ),
  ).toBe(transformBefore);

  await card.scrollIntoViewIfNeeded();
  await movePointerOverCard();
  const modifiedScrollBefore = await page.evaluate(() => window.scrollY);
  const modifiedTransformBefore = await camera.evaluate(
    (element) => (element as HTMLElement).style.transform,
  );
  await page.keyboard.down("Control");
  try {
    await page.mouse.wheel(0, -320);
  } finally {
    await page.keyboard.up("Control");
  }
  await expect
    .poll(() =>
      camera.evaluate((element) => (element as HTMLElement).style.transform),
    )
    .not.toBe(modifiedTransformBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(modifiedScrollBefore);
});
