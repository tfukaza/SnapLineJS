import { expect, test, type Locator, type Page } from "@playwright/test";

async function gotoGallery(page: Page) {
  await page.goto("/snapsort/gallery", { waitUntil: "networkidle" });
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
  const end = {
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

test.describe("SnapSort gallery — new drag primitives", () => {
  test.beforeEach(async ({ page }) => {
    await gotoGallery(page);
  });

  test.describe("Clone Palette (copy effect)", () => {
    test("dragging a palette block onto the canvas clones it, leaving the palette intact", async ({
      page,
    }) => {
      const exhibit = page.locator("#clone-palette");
      await exhibit.scrollIntoViewIfNeeded();

      const palette = exhibit.locator(".clone-palette");
      const canvas = exhibit.locator(".clone-canvas");
      const buttonTemplate = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Button" });

      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(0);

      await dragOnto(page, buttonTemplate, canvas);

      // The palette template is never consumed — copy leaves the source alone.
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
      await expect(
        palette.locator(".snapsort-item").filter({ hasText: "Button" }),
      ).toHaveCount(1);
      // The canvas gained one cloned block.
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);
      await expect(canvas.locator(".clone-canvas-block")).toContainText(
        "Button",
      );

      // Dragging a second, different block clones onto the canvas too.
      const imageTemplate = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Image" });
      await dragOnto(page, imageTemplate, canvas, { yOffset: 40 });
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(2);
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);

      // Reordering an already-placed canvas block is a plain move, not
      // another clone (only dragging out of the palette should copy).
      const canvasItems = canvas.locator(".snapsort-item");
      await dragOnto(page, canvasItems.nth(1), canvasItems.nth(0));
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(2);
      await expect(canvas.locator(".clone-canvas-block").first()).toContainText(
        "Image",
      );

      // Click-to-remove takes a cloned block back out of the canvas.
      const firstBlock = canvas.locator(".clone-canvas-block").first();
      await firstBlock.locator(".clone-block-remove").click();
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);
    });

    test("handoff copy never ghosts the palette and discards a clone dropped outside a drop zone", async ({
      page,
    }) => {
      const exhibit = page.locator("#clone-palette");
      await exhibit.scrollIntoViewIfNeeded();
      const palette = exhibit.locator(".clone-palette");
      const canvas = exhibit.locator(".clone-canvas");

      const dividerTemplate = palette
        .locator(".snapsort-item")
        .filter({ hasText: "Divider" });

      // Drag a palette block toward the canvas, sampling the palette DOM
      // mid-drag: the handoff model must never place a ghost or hoisted item
      // in the policy-rejected palette — the original template just sits there.
      const src = await rect(dividerTemplate);
      const dst = await rect(canvas);
      const start = { x: src.x + src.width / 2, y: src.y + src.height / 2 };
      const end = { x: dst.x + dst.width / 2, y: dst.y + dst.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 6, start.y + 6);
      await page.waitForTimeout(60);
      let maxPaletteGhosts = 0;
      for (let step = 1; step <= 16; step++) {
        const t = step / 16;
        await page.mouse.move(
          start.x + (end.x - start.x) * t,
          start.y + (end.y - start.y) * t,
        );
        await page.waitForTimeout(20);
        maxPaletteGhosts = Math.max(
          maxPaletteGhosts,
          await palette.evaluate((el) => el.querySelectorAll("#spacer").length),
        );
      }
      await page.mouse.up();
      await page.waitForTimeout(250);

      expect(maxPaletteGhosts).toBe(0);
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);

      // Now drag another block but release back over the palette (a rejected
      // zone): the copy is cancelled and the clone discarded — canvas unchanged.
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
      // No leftover floating clone stuck in the canvas.
      await expect(canvas.locator(".clone-dragging")).toHaveCount(0);
    });
  });

  test.describe("Trash It (none effect)", () => {
    test("dropping a task on the trash removes it; other drags still reorder normally", async ({
      page,
    }) => {
      const exhibit = page.locator("#trash-it");
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
      const exhibit = page.locator("#swap-grid");
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
          const expectedDraggedDelta = {
            x: center(ghostRelease!).x - center(targetStart).x,
            y: center(ghostRelease!).y - center(targetStart).y,
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

    test("dropping outside the grid animates the dragged tile back home", async ({
      page,
    }) => {
      const exhibit = page.locator("#swap-grid");
      await exhibit.scrollIntoViewIfNeeded();

      const grid = exhibit.locator(".swap-grid");
      const tileA2 = grid.locator(".snapsort-item").filter({ hasText: "A2" });
      const sourceStart = await rect(tileA2);
      let ghostRelease: Awaited<ReturnType<typeof rect>> | null = null;

      await dragOnto(page, tileA2, exhibit.locator(".example-placard"), {
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
          const returningVisual = await rect(tileA2);
          expect(centerDistance(returningVisual, ghostRelease!)).toBeLessThan(
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
