import { expect, test, type Locator, type Page } from "@playwright/test";
import type { DragStartEvent } from "@snap-engine/snapsort";
import { coreImportPath } from "../../shared/servers";

// The interface cards are laid out for a desktop-width docs page.
test.use({ viewport: { width: 1400, height: 950 } });

async function gotoCompleteExamples(page: Page) {
  await page.goto("/docs/snapsort/examples/complete-interfaces", {
    waitUntil: "networkidle",
  });
}

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected locator to have a bounding box.");
  return box;
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function centerDistance(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const aCenter = center(a);
  const bCenter = center(b);
  return Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y);
}

async function overrideDragVisual(
  page: Page,
  selector: string,
  dragVisual: "item" | "preview" | "none",
) {
  await page.evaluate(
    async ({ coreImportPath, selector, dragVisual }) => {
      const { GlobalManager } = await import(coreImportPath);
      const element = document.querySelector(selector);
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const container = containers.find(
        (candidate) => candidate.element === element,
      );
      if (!container) {
        throw new Error(`Could not find SnapSort container ${selector}.`);
      }
      const callbacks = container.callbacks;
      const original = callbacks.onDragStart;
      container.callbacks = {
        ...callbacks,
        onDragStart: (event: DragStartEvent) => {
          const result = original?.(event);
          if (result === false) return false;
          event.session.dragVisual = dragVisual;
          return result;
        },
      };
    },
    { coreImportPath, selector, dragVisual },
  );
}

/**
 * Drag `source` onto `target`, using a real pointer-move sequence (not a
 * single jump) so SnapSort's drag-threshold and per-move drop-target
 * resolution both get a chance to run, matching how a real user drags.
 */
async function dragOnto(
  page: Page,
  source: Locator,
  target: Locator,
  options: {
    steps?: number;
    xOffset?: number;
    yOffset?: number;
    targetPoint?: (box: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => { x: number; y: number };
    beforeDrop?: () => Promise<void>;
    afterDrop?: () => Promise<void>;
  } = {},
) {
  const sourceBox = await rect(source);
  const start = center(sourceBox);
  const steps = options.steps ?? 24;

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 6, start.y + 6);
  await page.waitForTimeout(60);

  const targetBox = await rect(target);
  const end = options.targetPoint?.(targetBox) ?? {
    x: targetBox.x + targetBox.width / 2 + (options.xOffset ?? 0),
    y: targetBox.y + targetBox.height / 2 + (options.yOffset ?? 0),
  };

  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    await page.mouse.move(
      start.x + (end.x - start.x) * t,
      start.y + (end.y - start.y) * t,
    );
    await page.waitForTimeout(16);
  }

  await page.waitForTimeout(80);
  await options.beforeDrop?.();
  await page.mouse.up();
  await options.afterDrop?.();
  await page.waitForTimeout(250);
}

test.describe("SnapSort complete-interface examples", () => {
  test.beforeEach(async ({ page }) => {
    await gotoCompleteExamples(page);
  });

  test("complete interfaces expose all eight demos and stay usable on mobile", async ({
    page,
  }) => {
    await expect(page.locator("[data-demo-code-tabs]")).toHaveCount(8);
    await expect(page.locator("[data-snapsort-example]")).toHaveCount(8);
    await expect(page.getByRole("tab", { name: "Svelte source" })).toHaveCount(
      8,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    const kanban = page.locator('[data-snapsort-example="kanban-board"]');
    await kanban.scrollIntoViewIfNeeded();
    await expect(kanban).toBeVisible();
    await expect(kanban.locator(".kanban-column")).toHaveCount(3);
    const viewportWidth = await page.locator("html").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(viewportWidth.scrollWidth).toBeLessThanOrEqual(
      viewportWidth.clientWidth,
    );
  });

  test("TODO List reorders through its drag handle", async ({ page }) => {
    const example = page.locator('[data-snapsort-example="todo-list"]');
    await example.scrollIntoViewIfNeeded();
    const cards = example.locator(".project-card");

    await expect(
      example.getByRole("checkbox", { name: "Plan the grocery run" }),
    ).toHaveAccessibleName("Plan the grocery run");
    await expect(
      example.getByRole("checkbox", { name: "Take an evening walk" }),
    ).toBeChecked();

    await dragOnto(
      page,
      cards.first().locator(".project-drag-handle"),
      cards.nth(3),
      {
        targetPoint: (box) => ({
          x: box.x + 28,
          y: box.y + box.height * 0.82,
        }),
      },
    );

    await expect(example.locator(".project-text").first()).not.toHaveText(
      "Plan the grocery run",
    );
  });

  test("none visual still animates a flow-mode drop", async ({ page }) => {
    const example = page.locator('[data-snapsort-example="todo-list"]');
    await example.scrollIntoViewIfNeeded();
    await overrideDragVisual(
      page,
      '[data-snapsort-example="todo-list"] .snapsort-container',
      "none",
    );

    const items = example.locator(".snapsort-item");
    const dragged = items.first();
    const draggedId = await dragged.getAttribute("data-snapsort-item-id");
    expect(draggedId).toBeTruthy();
    if (!draggedId) throw new Error("Expected the dragged item to have an ID.");
    const movedItem = page.locator(`[data-snapsort-item-id="${draggedId}"]`);
    await dragOnto(
      page,
      dragged.locator(".project-drag-handle"),
      items.nth(3),
      {
        targetPoint: (box) => ({
          x: box.x + 28,
          y: box.y + box.height * 0.82,
        }),
        beforeDrop: async () => {
          await expect(
            page.locator('[data-snapsort-ghost="pointer"]'),
          ).toHaveCount(0);
        },
        afterDrop: async () => {
          await expect
            .poll(
              () =>
                movedItem.evaluate(
                  (node) => getComputedStyle(node).transform !== "none",
                ),
              { intervals: [10, 20, 40], timeout: 500 },
            )
            .toBe(true);
        },
      },
    );

    await expect(example.locator(".project-text").first()).not.toHaveText(
      "Plan the grocery run",
    );
  });

  test("Kanban Board moves a card between columns", async ({ page }) => {
    const example = page.locator('[data-snapsort-example="kanban-board"]');
    await example.scrollIntoViewIfNeeded();
    const columns = example.locator(".kanban-column");

    await dragOnto(
      page,
      columns.first().locator(".kanban-card").first(),
      columns.nth(1),
      {
        targetPoint: (box) => ({
          x: box.x + box.width / 2,
          y: box.y + box.height - 90,
        }),
      },
    );

    await expect(columns.nth(1)).toContainText("Fix Bug #12");
  });

  test("File Explorer moves a file into a nested folder", async ({ page }) => {
    const example = page.locator('[data-snapsort-example="file-explorer"]');
    await example.scrollIntoViewIfNeeded();
    const source = example
      .locator(".tree-row.file-row")
      .filter({ hasText: "package.json" });
    const target = example.locator(".tree-folder").filter({ hasText: "docs" });

    await dragOnto(page, source, target, {
      targetPoint: (box) => ({
        x: box.x + box.width * 0.8,
        y: box.y + box.height - 14,
      }),
    });

    await expect(target).toContainText("package.json");
  });

  test("File Explorer exposes separate keyboard controls for disclosure and selection", async ({
    page,
  }) => {
    const example = page.locator('[data-snapsort-example="file-explorer"]');
    await example.scrollIntoViewIfNeeded();
    const selectSource = example.getByRole("button", {
      name: "Select src",
      exact: true,
    });
    const selectPackage = example.getByRole("button", {
      name: "Select package.json",
      exact: true,
    });

    await expect(example.locator(".folder-row button button")).toHaveCount(0);
    await expect(selectSource).toHaveAttribute("aria-pressed", "false");

    const collapseSource = example.getByRole("button", {
      name: "Collapse src",
      exact: true,
    });
    await collapseSource.focus();
    await page.keyboard.press("Enter");
    const expandSource = example.getByRole("button", {
      name: "Expand src",
      exact: true,
    });
    await expect(expandSource).toBeFocused();
    await expect(selectSource).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("Space");
    await expect(collapseSource).toBeFocused();

    await selectSource.focus();
    await page.keyboard.press("Space");
    await expect(selectSource).toHaveAttribute("aria-pressed", "true");

    await selectPackage.focus();
    await page.keyboard.press("Enter");
    await expect(selectPackage).toHaveAttribute("aria-pressed", "true");
    await expect(selectSource).toHaveAttribute("aria-pressed", "false");
  });

  test("sentence builder renders incorrect and correct application feedback", async ({
    page,
  }) => {
    const example = page.locator('[data-snapsort-example="sentence-builder"]');
    await example.scrollIntoViewIfNeeded();

    await example.getByRole("button", { name: "Check" }).click();
    await expect(example.getByText("Incorrect, try again.")).toBeVisible();

    for (const word of ["多く", "の", "用途", "が", "あり", "ます"]) {
      await example
        .getByRole("button", { name: `Move ${word} to answer` })
        .click();
    }
    await example.getByRole("button", { name: "Check" }).click();
    await expect(example.getByText("Correct!")).toBeVisible();
  });

  test("form editor adds and edits fields through application controls", async ({
    page,
  }) => {
    const example = page.locator('[data-snapsort-example="form-editor"]');
    await example.scrollIntoViewIfNeeded();

    const fields = example.locator(".editor-field");
    await expect(fields).toHaveCount(3);
    await example.getByRole("button", { name: "Long text" }).click();
    await expect(fields).toHaveCount(4);

    const addedQuestion = example
      .getByRole("textbox", {
        name: "Question text",
      })
      .last();
    await addedQuestion.fill("Release notes");
    await expect(addedQuestion).toHaveValue("Release notes");

    await example.getByRole("button", { name: "Multiple choice" }).click();
    await expect(fields).toHaveCount(5);
    const newestField = fields.last();
    await expect(
      newestField.getByRole("textbox", { name: "Option text" }),
    ).toHaveCount(2);
    await newestField.getByRole("button", { name: "Add option" }).click();
    await expect(
      newestField.getByRole("textbox", { name: "Option text" }),
    ).toHaveCount(3);
  });

  test.describe("Template Palette (move and backfill)", () => {
    test("dragging a template moves its stable id to the canvas and backfills the palette", async ({
      page,
    }) => {
      const exhibit = page.locator('[data-snapsort-example="clone-palette"]');
      await exhibit.scrollIntoViewIfNeeded();

      const palette = exhibit.locator(".clone-palette");
      const canvas = exhibit.locator(".clone-canvas");
      const buttonTemplate = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Button" });
      const originalButtonId = await buttonTemplate.getAttribute(
        "data-snapsort-item-id",
      );
      expect(originalButtonId).toBeTruthy();
      if (!originalButtonId) {
        throw new Error("Expected the Button template to have an item ID.");
      }

      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(0);

      await dragOnto(page, buttonTemplate, canvas);

      // The palette still exposes the same template, but it is a freshly
      // minted replacement. The original stable id is what moved.
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
      const replacementButton = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Button" });
      await expect(replacementButton).toHaveCount(1);
      await expect(replacementButton).not.toHaveAttribute(
        "data-snapsort-item-id",
        originalButtonId,
      );

      // The canvas gained the original item under its original stable id.
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);
      await expect(canvas.locator(".clone-canvas-block")).toContainText(
        "Button",
      );
      await expect(
        canvas.locator(`[data-snapsort-item-id="${originalButtonId}"]`),
      ).toHaveCount(1);

      // Dragging a second, different block clones onto the canvas too.
      const imageTemplate = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Image" });
      await dragOnto(page, imageTemplate, canvas, { yOffset: 40 });
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(2);
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);

      // Reordering an already-placed canvas block is a plain move, with no
      // source backfill because it did not originate in the palette.
      const canvasItems = canvas.locator(".snapsort-item");
      await dragOnto(page, canvasItems.nth(1), canvasItems.nth(0));
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(2);
      await expect(canvas.locator(".clone-canvas-block").first()).toContainText(
        "Image",
      );

      // Click-to-remove takes a placed block back out of the canvas.
      const firstBlock = canvas.locator(".clone-canvas-block").first();
      await firstBlock.locator(".clone-block-remove").click();
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);
    });

    test("preview drag leaves templates in layout and cleans up when dropped outside a drop zone", async ({
      page,
    }) => {
      const exhibit = page.locator('[data-snapsort-example="clone-palette"]');
      await exhibit.scrollIntoViewIfNeeded();
      const palette = exhibit.locator(".clone-palette");
      const canvas = exhibit.locator(".clone-canvas");

      const dividerTemplate = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Divider" });

      // Drag a palette block toward the canvas. `dragVisual = "preview"`
      // leaves the real template in layout and represents the gesture with a
      // pointer-role Ghost.
      const src = await rect(dividerTemplate);
      const dst = await rect(canvas);
      const start = { x: src.x + src.width / 2, y: src.y + src.height / 2 };
      const end = { x: dst.x + dst.width / 2, y: dst.y + dst.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 6, start.y + 6);
      await page.waitForTimeout(60);
      let maxPaletteTargetGhosts = 0;
      let sawPointerPreview = false;
      for (let step = 1; step <= 16; step++) {
        const t = step / 16;
        await page.mouse.move(
          start.x + (end.x - start.x) * t,
          start.y + (end.y - start.y) * t,
        );
        await page.waitForTimeout(20);
        maxPaletteTargetGhosts = Math.max(
          maxPaletteTargetGhosts,
          await palette.evaluate(
            (el) =>
              el.querySelectorAll('[data-snapsort-ghost-entry$="-spacer"]')
                .length,
          ),
        );
        sawPointerPreview ||=
          (await page.locator('[data-snapsort-ghost="pointer"]').count()) === 1;
      }
      await page.mouse.up();
      await page.waitForTimeout(250);

      expect(maxPaletteTargetGhosts).toBe(0);
      expect(sawPointerPreview).toBe(true);
      await expect(page.locator('[data-snapsort-ghost="pointer"]')).toHaveCount(
        0,
      );
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);

      // Now drag another block but release back over the palette (a rejected
      // zone): no mutation commits and the preview is discarded.
      const spacerTemplate = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Spacer" });
      const spacerBox = await rect(spacerTemplate);
      const spacerStart = {
        x: spacerBox.x + spacerBox.width / 2,
        y: spacerBox.y + spacerBox.height / 2,
      };
      await page.mouse.move(spacerStart.x, spacerStart.y);
      await page.mouse.down();
      await page.mouse.move(spacerStart.x, spacerStart.y + 40);
      await page.waitForTimeout(60);
      await page.mouse.move(spacerStart.x, spacerStart.y);
      await page.waitForTimeout(60);
      await page.mouse.up();
      await page.waitForTimeout(250);

      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
      await expect(page.locator('[data-snapsort-ghost="pointer"]')).toHaveCount(
        0,
      );
    });
  });

  test.describe("Trash It (none effect)", () => {
    test("dropping a task on the trash removes it; other drags still reorder normally", async ({
      page,
    }) => {
      const exhibit = page.locator('[data-snapsort-example="trash-it"]');
      await exhibit.scrollIntoViewIfNeeded();

      const list = exhibit.locator(".trash-list");
      const trashZone = exhibit.locator(".trash-drop-target");

      await expect(list.locator(".trash-task")).toHaveCount(5);
      const firstTaskText = (
        await list.locator(".trash-task").first().textContent()
      )?.trim();
      const secondTaskText = (
        await list.locator(".trash-task").nth(1).textContent()
      )?.trim();

      // Reordering within the list (default move effect) still works.
      const firstTask = list.locator(".snapsort-item").first();
      await dragOnto(page, firstTask, list.locator(".snapsort-item").nth(2));
      await expect(list.locator(".trash-task")).toHaveCount(5);
      await expect(list.locator(".trash-task").first()).not.toContainText(
        firstTaskText ?? "__never__",
      );

      // Dragging a task onto the trash deletes it instead of moving it there.
      const taskToDelete = list
        .locator(".snapsort-item")
        .filter({ hasText: secondTaskText ?? "" });
      await dragOnto(page, taskToDelete, trashZone);

      await expect(list.locator(".trash-task")).toHaveCount(4);
      await expect(
        list.locator(".trash-task", { hasText: secondTaskText ?? "__never__" }),
      ).toHaveCount(0);
      // Nothing should have actually landed inside the trash container itself.
      await expect(trashZone.locator(".trash-task")).toHaveCount(0);
    });
  });

  test.describe("Swap Grid (swap mode)", () => {
    test("dragging a tile onto another swaps their positions and nothing else moves", async ({
      page,
    }) => {
      const exhibit = page.locator('[data-snapsort-example="swap-grid"]');
      await exhibit.scrollIntoViewIfNeeded();

      const grid = exhibit.locator(".swap-grid");
      const tiles = grid.locator(".snapsort-item");
      await expect(tiles).toHaveCount(9);

      const beforeOrder = await grid
        .locator(".swap-tile")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim() ?? ""),
        );
      expect(beforeOrder).toEqual([
        "A1",
        "A2",
        "A3",
        "B1",
        "B2",
        "B3",
        "C1",
        "C2",
        "C3",
      ]);

      const tileA1 = tiles.filter({ hasText: "A1" });
      const tileB2 = tiles.filter({ hasText: "B2" });
      const sourceStart = await rect(tileA1);
      const targetStart = await rect(tileB2);
      let ghostRelease: Awaited<ReturnType<typeof rect>> | null = null;
      await dragOnto(page, tileA1, tileB2, {
        xOffset: 32,
        yOffset: -24,
        beforeDrop: async () => {
          const sourceTile = tileA1.locator(".swap-tile");
          const pointerGhost = page.locator('[data-snapsort-ghost="pointer"]');

          await expect(pointerGhost).toBeVisible();
          await expect(pointerGhost).toContainText("A1");
          await expect(pointerGhost.locator(".swap-tile-grip i")).toHaveCount(
            6,
          );

          const appearances = await Promise.all(
            [sourceTile, pointerGhost].map((locator) =>
              locator.evaluate((element) => {
                const style = getComputedStyle(element);
                return {
                  backgroundColor: style.backgroundColor,
                  borderRadius: style.borderRadius,
                  boxShadow: style.boxShadow,
                  fontFamily: style.fontFamily,
                };
              }),
            ),
          );
          expect(appearances[1]).toEqual(appearances[0]);
          ghostRelease = await rect(pointerGhost);
          const expectedPointer = {
            x: center(targetStart).x + 32,
            y: center(targetStart).y - 24,
          };
          expect(
            Math.hypot(
              center(ghostRelease).x - expectedPointer.x,
              center(ghostRelease).y - expectedPointer.y,
            ),
          ).toBeLessThan(3);
          expect(centerDistance(ghostRelease, sourceStart)).toBeGreaterThan(50);
        },
        afterDrop: async () => {
          await expect
            .poll(
              () =>
                grid
                  .locator(".snapsort-item")
                  .evaluateAll(
                    (nodes) =>
                      nodes.filter(
                        (node) => getComputedStyle(node).transform !== "none",
                      ).length,
                  ),
              { intervals: [10, 20, 40], timeout: 500 },
            )
            .toBeGreaterThanOrEqual(2);

          expect(ghostRelease).not.toBeNull();
          if (!ghostRelease) {
            throw new Error(
              "Expected the released pointer ghost to have bounds.",
            );
          }
          const expectedDraggedDelta = {
            x: center(ghostRelease).x - center(targetStart).x,
            y: center(ghostRelease).y - center(targetStart).y,
          };
          const expectedDisplacedDelta = {
            x: center(targetStart).x - center(sourceStart).x,
            y: center(targetStart).y - center(sourceStart).y,
          };
          const [draggedTransform, displacedTransform] = await Promise.all(
            [tileA1, tileB2].map((locator) =>
              locator.evaluate((node) => {
                const matrix = new DOMMatrixReadOnly(
                  getComputedStyle(node).transform,
                );
                return { x: matrix.m41, y: matrix.m42 };
              }),
            ),
          );

          expect(Math.sign(draggedTransform.x)).toBe(
            Math.sign(expectedDraggedDelta.x),
          );
          expect(Math.sign(draggedTransform.y)).toBe(
            Math.sign(expectedDraggedDelta.y),
          );
          expect(Math.abs(draggedTransform.x)).toBeLessThanOrEqual(
            Math.abs(expectedDraggedDelta.x) + 1,
          );
          expect(Math.abs(draggedTransform.y)).toBeLessThanOrEqual(
            Math.abs(expectedDraggedDelta.y) + 1,
          );
          expect(Math.sign(displacedTransform.x)).toBe(
            Math.sign(expectedDisplacedDelta.x),
          );
          expect(Math.sign(displacedTransform.y)).toBe(
            Math.sign(expectedDisplacedDelta.y),
          );
          expect(Math.abs(displacedTransform.x)).toBeLessThanOrEqual(
            Math.abs(expectedDisplacedDelta.x) + 1,
          );
          expect(Math.abs(displacedTransform.y)).toBeLessThanOrEqual(
            Math.abs(expectedDisplacedDelta.y) + 1,
          );
        },
      });

      const afterOrder = await grid
        .locator(".swap-tile")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim() ?? ""),
        );

      // Only the two dragged/targeted slots change; everything else stays put.
      expect(afterOrder).toEqual([
        "B2",
        "A2",
        "A3",
        "B1",
        "A1",
        "B3",
        "C1",
        "C2",
        "C3",
      ]);
      await expect(tiles).toHaveCount(9);
      await expect(grid.locator('[data-snapsort-dragging="true"]')).toHaveCount(
        0,
      );
      const tileOpacities = await grid
        .locator(".swap-tile")
        .evaluateAll((nodes) =>
          nodes.map((node) => getComputedStyle(node).opacity),
        );
      expect(tileOpacities).toEqual(Array(9).fill("1"));
    });

    test("item visual hoists the real tile, keeps a source spacer, and still swaps", async ({
      page,
    }) => {
      const exhibit = page.locator('[data-snapsort-example="swap-grid"]');
      await exhibit.scrollIntoViewIfNeeded();
      await overrideDragVisual(
        page,
        '[data-snapsort-example="swap-grid"] .swap-grid',
        "item",
      );

      const grid = exhibit.locator(".swap-grid");
      const tileA1 = grid.locator(".snapsort-item").filter({ hasText: "A1" });
      const tileB2 = grid.locator(".snapsort-item").filter({ hasText: "B2" });
      const start = await rect(tileA1);
      const target = await rect(tileB2);

      await dragOnto(page, tileA1, tileB2, {
        beforeDrop: async () => {
          await expect(tileA1).toHaveCSS("position", "absolute");
          await expect(
            grid.locator('[data-snapsort-ghost-entry$="-spacer"]'),
          ).toHaveCount(1);
          await expect(
            page.locator('[data-snapsort-ghost="pointer"]'),
          ).toHaveCount(0);
          const live = await rect(tileA1);
          expect(centerDistance(live, start)).toBeGreaterThan(40);
          expect(centerDistance(live, target)).toBeLessThan(12);
        },
      });

      await expect(grid.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
      const order = await grid
        .locator(".swap-tile")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim() ?? ""),
        );
      expect(order).toEqual([
        "B2",
        "A2",
        "A3",
        "B1",
        "A1",
        "B3",
        "C1",
        "C2",
        "C3",
      ]);
    });

    test("none visual renders no pointer representation while hover targeting still swaps", async ({
      page,
    }) => {
      const exhibit = page.locator('[data-snapsort-example="swap-grid"]');
      await exhibit.scrollIntoViewIfNeeded();
      await overrideDragVisual(
        page,
        '[data-snapsort-example="swap-grid"] .swap-grid',
        "none",
      );

      const grid = exhibit.locator(".swap-grid");
      const tileA1 = grid.locator(".snapsort-item").filter({ hasText: "A1" });
      const tileB2 = grid.locator(".snapsort-item").filter({ hasText: "B2" });
      await dragOnto(page, tileA1, tileB2, {
        beforeDrop: async () => {
          await expect(tileA1).not.toHaveCSS("position", "absolute");
          await expect(page.locator("[data-snapsort-ghost-entry]")).toHaveCount(
            0,
          );
          await expect(tileB2.locator(".swap-tile")).toHaveClass(
            /swap-tile-hovered/,
          );
        },
        afterDrop: async () => {
          await expect
            .poll(
              () =>
                tileA1.evaluate(
                  (node) => getComputedStyle(node).transform !== "none",
                ),
              { intervals: [10, 20, 40], timeout: 500 },
            )
            .toBe(true);
        },
      });

      const order = await grid
        .locator(".swap-tile")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim() ?? ""),
        );
      expect(order).toEqual([
        "B2",
        "A2",
        "A3",
        "B1",
        "A1",
        "B3",
        "C1",
        "C2",
        "C3",
      ]);
      await expect(page.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    });

    test("dropping outside the grid animates the dragged tile back home", async ({
      page,
    }) => {
      const exhibit = page.locator('[data-snapsort-example="swap-grid"]');
      await exhibit.scrollIntoViewIfNeeded();

      const grid = exhibit.locator(".swap-grid");
      const tileA2 = grid.locator(".snapsort-item").filter({ hasText: "A2" });
      const sourceStart = await rect(tileA2);
      let ghostRelease: Awaited<ReturnType<typeof rect>> | null = null;

      const exampleHeader = page.locator(
        '[data-demo-code-tabs="swap-grid"] .demo-code-tabs-header',
      );
      await dragOnto(page, tileA2, exampleHeader, {
        beforeDrop: async () => {
          ghostRelease = await rect(
            page.locator('[data-snapsort-ghost="pointer"]'),
          );
        },
        afterDrop: async () => {
          await expect
            .poll(
              () =>
                tileA2.evaluate(
                  (node) => getComputedStyle(node).transform !== "none",
                ),
              { intervals: [10, 20, 40], timeout: 500 },
            )
            .toBe(true);

          expect(ghostRelease).not.toBeNull();
          if (!ghostRelease) {
            throw new Error(
              "Expected the released pointer ghost to have bounds.",
            );
          }
          const returningVisual = await rect(tileA2);
          expect(centerDistance(returningVisual, ghostRelease)).toBeLessThan(
            centerDistance(returningVisual, sourceStart),
          );
        },
      });

      const order = await grid
        .locator(".swap-tile")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.textContent?.trim() ?? ""),
        );
      expect(order).toEqual([
        "A1",
        "A2",
        "A3",
        "B1",
        "B2",
        "B3",
        "C1",
        "C2",
        "C3",
      ]);
      await expect(grid.locator('[data-snapsort-dragging="true"]')).toHaveCount(
        0,
      );
      await expect(tileA2).toHaveCSS("transform", "none");
      await expect(tileA2.locator(".swap-tile")).toHaveCSS("opacity", "1");
    });
  });
});
