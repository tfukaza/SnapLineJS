import { expect, test } from "@playwright/test";
import { dragBetween } from "../_support/gallery-drag";

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
    .locator(
      '.toggle[aria-label="Skeuomorphic toggle"] .material-surface.recessed',
    )
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
  const stageDimensions = await page
    .locator(".demo-stage")
    .evaluateAll((stages) =>
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
      const group = demo.querySelector<HTMLElement>('[data-layer-id="header"]');
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
          panelRect.left +
          panelRect.width / 2 -
          (demoRect.left + demoRect.width / 2),
        panelVerticalCenterDelta:
          panelRect.top +
          panelRect.height / 2 -
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
  expect(Math.abs(layersGeometry.panelVerticalCenterDelta)).toBeLessThanOrEqual(
    1,
  );
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
  await expect(todoStage.locator(".todo-label")).toHaveText([
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
  await expect(promoTodo.locator('[role="switch"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
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
  expect(
    Math.abs(mobileLayout.stageWidth - mobileLayout.stageHeight),
  ).toBeLessThanOrEqual(1);
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
  await expect(page.locator('[data-todo-id="todo-promo"]')).toHaveAttribute(
    "data-completed",
    "true",
  );
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
