import { expect, test } from "@playwright/test";
import { type Rect } from "../../../../src/geometry";
import { center } from "../../../helpers/snapsort-fixtures";
import {
  type DragSample,
  collectSample,
  demoBoxByHeading,
  directSnapSortChildTexts,
  directSnapSortItemTexts,
  dragBy,
  dragTo,
  dragToItemFraction,
  expectGhostUpdatesStable,
  expectNoNestedParentFlicker,
  expectStableDrag,
  installSnapsortTrace,
  itemByTextIn,
  itemRect,
  writeJson,
} from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("keeps dragged item aligned while entering a slowly animating nested container", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    const samples = await dragTo(page, item, "Item 1", 0, target, {
      captureFrameRects: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-slow-animation-drag-trace.json"),
    );
    expectNoNestedParentFlicker(samples);
    expectGhostUpdatesStable(consoleMessages, 6);
  });

  test("keeps the drop animation visible while a reorder animation is still active", async ({
    page,
  }, testInfo) => {
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const innerContainer = nested.locator(".snapsort-container").nth(1);
    const source = await itemByTextIn(innerContainer, "Sub A1");
    const target = await itemByTextIn(innerContainer, "Sub A3");
    const sourceRect = await itemRect(source);
    const targetRect = await itemRect(target);
    const start = center(sourceRect);
    const releasePoint = {
      x: targetRect.x + targetRect.width / 2 + 18,
      y: targetRect.y + targetRect.height * 0.85,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 5, start.y);
    await page.waitForTimeout(16);
    for (let step = 1; step <= 14; step++) {
      await page.mouse.move(
        start.x + ((releasePoint.x - start.x) * step) / 14,
        start.y + ((releasePoint.y - start.y) * step) / 14,
      );
      await page.waitForTimeout(12);
    }

    // Prove the release happens during the condition that caused the bug:
    // at least one displaced sibling still has a reorder FLIP transform.
    await expect
      .poll(
        () =>
          innerContainer
            .locator(".snapsort-item")
            .evaluateAll((nodes) =>
              nodes.some(
                (node) =>
                  !node.textContent?.includes("Sub A1") &&
                  (node as HTMLElement).style.transform !== "",
              ),
            ),
        { intervals: [10, 20, 40], timeout: 300 },
      )
      .toBe(true);

    const releaseRect = await itemRect(source);
    await page.evaluate(() => {
      type DropFrame = {
        time: number;
        rect: Rect;
        inlineTransform: string;
        computedTransform: string;
        dragging: boolean;
        displacedTransformCount: number;
      };
      type StyleMutation = {
        time: number;
        oldValue: string | null;
        currentValue: string;
      };
      const win = window as unknown as {
        __dropContinuityTrace?: {
          done: boolean;
          frames: DropFrame[];
          styleMutations: StyleMutation[];
        };
      };
      const trace = {
        done: false,
        frames: [] as DropFrame[],
        styleMutations: [] as StyleMutation[],
      };
      win.__dropContinuityTrace = trace;

      const nested = [...document.querySelectorAll(".demo-cell")].find(
        (element) =>
          element.querySelector("h2")?.textContent?.trim() ===
          "Nested Container",
      );
      if (!nested) throw new Error("Nested Container fixture was not found.");
      const itemText = (element: Element) =>
        element.querySelector(":scope > p")?.textContent?.trim() ?? "";
      const findDraggedItem = () =>
        [...nested.querySelectorAll(".snapsort-item")].find(
          (element) => itemText(element) === "Sub A1",
        ) as HTMLElement | undefined;
      const rectOf = (element: Element): Rect => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      };
      const startedAt = performance.now();
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.target instanceof Element &&
            mutation.target.classList.contains("snapsort-item") &&
            itemText(mutation.target) === "Sub A1"
          ) {
            trace.styleMutations.push({
              time: performance.now() - startedAt,
              oldValue: mutation.oldValue,
              currentValue:
                (mutation.target as HTMLElement).getAttribute("style") ?? "",
            });
          }
        }
      });
      observer.observe(nested, {
        attributes: true,
        attributeFilter: ["style"],
        attributeOldValue: true,
        subtree: true,
      });

      const sample = () => {
        const item = findDraggedItem();
        if (item) {
          trace.frames.push({
            time: performance.now() - startedAt,
            rect: rectOf(item),
            inlineTransform: item.style.transform,
            computedTransform: getComputedStyle(item).transform,
            dragging: item.dataset.snapsortDragging === "true",
            displacedTransformCount: [
              ...nested.querySelectorAll<HTMLElement>(".snapsort-item"),
            ].filter(
              (element) =>
                element !== item &&
                !element.id.includes("spacer") &&
                element.style.transform !== "",
            ).length,
          });
        }
        if (performance.now() - startedAt < 1_050) {
          requestAnimationFrame(sample);
          return;
        }
        observer.disconnect();
        trace.done = true;
      };
      requestAnimationFrame(sample);
    });

    await page.mouse.up();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  __dropContinuityTrace?: { done: boolean };
                }
              ).__dropContinuityTrace?.done ?? false,
          ),
        { timeout: 2_000 },
      )
      .toBe(true);

    const trace = await page.evaluate(
      () =>
        (
          window as unknown as {
            __dropContinuityTrace: {
              done: boolean;
              frames: Array<{
                time: number;
                rect: Rect;
                inlineTransform: string;
                computedTransform: string;
                dragging: boolean;
                displacedTransformCount: number;
              }>;
              styleMutations: Array<{
                time: number;
                oldValue: string | null;
                currentValue: string;
              }>;
            };
          }
        ).__dropContinuityTrace,
    );
    await writeJson(
      testInfo.outputPath("drop-animation-continuity-trace.json"),
      { releaseRect, ...trace },
    );

    const postDropFrames = trace.frames.filter((frame) => !frame.dragging);
    expect(postDropFrames.length).toBeGreaterThan(20);
    const finalFrame = postDropFrames.at(-1)!;
    const centerDistance = (a: Rect, b: Rect) => {
      const aCenter = center(a);
      const bCenter = center(b);
      return Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y);
    };
    const travel = centerDistance(releaseRect, finalFrame.rect);
    expect(travel).toBeGreaterThan(12);

    const firstPaintedDropFrame = postDropFrames[0];
    expect(
      centerDistance(firstPaintedDropFrame.rect, releaseRect),
      "the first painted drop frame should remain at the pointer release position",
    ).toBeLessThan(Math.max(4, travel * 0.15));
    expect(
      postDropFrames.some((frame) => frame.inlineTransform !== ""),
      "the drop FLIP transform should remain visible after release",
    ).toBe(true);

    const distancesToFinal = postDropFrames.map((frame) =>
      centerDistance(frame.rect, finalFrame.rect),
    );
    const firstSettledFrame = distancesToFinal.findIndex(
      (distance) => distance <= 1,
    );
    if (firstSettledFrame !== -1) {
      expect(
        Math.max(...distancesToFinal.slice(firstSettledFrame)),
        "the item must not reach its slot and then bounce away again",
      ).toBeLessThanOrEqual(2);
    }

    expect(finalFrame.inlineTransform).toBe("");
    await expect(source).not.toHaveAttribute("data-snapsort-dragging");
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A2", "Sub A3", "Sub A1"]);
  });

  test("keeps nested dragged item aligned while moving in and out of its container", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const innerContainer = nested.locator(".snapsort-container").nth(1);
    const item = await itemByTextIn(nested, "Sub A1");
    const activeId = await item.getAttribute("data-engine-id");
    const start = center(await itemRect(item));
    const innerRect = await itemRect(innerContainer);
    const leftOutside = {
      x: innerRect.x - 28,
      y: start.y,
    };
    const innerCenter = {
      x: innerRect.x + innerRect.width / 2,
      y: start.y,
    };
    const path = [leftOutside, innerCenter, leftOutside, innerCenter];
    const samples: DragSample[] = [];
    let previous = start;

    await page.evaluate(
      ({ activeId }) => {
        const win = window as unknown as {
          __snapsortActiveText?: string;
          __snapsortActiveIndex?: number;
          __snapsortActiveId?: string;
        };
        win.__snapsortActiveText = "Sub A1";
        win.__snapsortActiveIndex = 0;
        win.__snapsortActiveId = activeId ?? "";
      },
      { activeId },
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y);
    await page.waitForTimeout(16);

    for (const point of path) {
      for (let step = 1; step <= 24; step++) {
        const ratio = step / 24;
        const mouse = {
          x: previous.x + (point.x - previous.x) * ratio,
          y: previous.y + (point.y - previous.y) * ratio,
        };
        await page.mouse.move(mouse.x, mouse.y);
        await page.waitForTimeout(8);
        samples.push(
          await collectSample(page, samples.length + 1, mouse, {
            captureFrameRects: true,
          }),
        );
      }
      previous = point;
    }

    await page.mouse.up();
    await page.waitForTimeout(100);

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-in-out-drag-trace.json"),
    );
  });

  test("drops at the pending nested index after a quick same-container slot change", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const subA1 = await itemByTextIn(nested, "Sub A1");
    const subA3 = await itemByTextIn(nested, "Sub A3");
    const itemCenter = center(await itemRect(item));
    const subA1Center = center(await itemRect(subA1));
    const subA3Rect = await itemRect(subA3);
    const subA3AfterPoint = {
      x: subA3Rect.x + subA3Rect.width / 2,
      y: subA3Rect.y + subA3Rect.height * 0.85,
    };

    await page.mouse.move(itemCenter.x, itemCenter.y);
    await page.mouse.down();
    await page.mouse.move(itemCenter.x, itemCenter.y + 6);
    await page.waitForTimeout(16);
    await page.mouse.move(subA1Center.x, subA1Center.y);
    await page.waitForTimeout(24);
    await page.mouse.move(subA3AfterPoint.x, subA3AfterPoint.y);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });

  test("commits the hovered nested slot without animation", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const subA1 = await itemByTextIn(nested, "Sub A1");
    const target = await itemByTextIn(nested, "Sub A3");
    const itemCenter = center(await itemRect(item));
    const subA1Center = center(await itemRect(subA1));

    await page.mouse.move(itemCenter.x, itemCenter.y);
    await page.mouse.down();
    await page.mouse.move(itemCenter.x, itemCenter.y + 6);
    await page.waitForTimeout(16);
    await page.mouse.move(subA1Center.x, subA1Center.y);
    await page.waitForTimeout(120);

    const movedTargetRect = await itemRect(target);
    await page.mouse.move(
      movedTargetRect.x + movedTargetRect.width / 2,
      movedTargetRect.y + movedTargetRect.height * 0.85,
    );
    await page.mouse.up();
    await page.waitForTimeout(200);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });

  test("commits the hovered slot in a compact nested list", async ({
    page,
  }) => {
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&compactNested=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Compact Nested List");
    const item = await itemByTextIn(nested, "Overview");
    const target = await itemByTextIn(nested, "Container");
    await dragToItemFraction(page, item, "Overview", 0, target, 0.5, {
      steps: 20,
    });

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Container", "Overview", "Item", "Handle"]);
  });

  test("moves a nested item to the parent slot above its nested container", async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const outerContainer = nested.locator(".snapsort-container").first();
    const innerContainer = nested.locator(".snapsort-container").nth(1);
    const item = await itemByTextIn(nested, "Sub A1");
    const itemCenter = center(await itemRect(item));
    const innerRect = await itemRect(innerContainer);
    const targetPoint = {
      x: itemCenter.x - 12,
      y: innerRect.y - 2,
    };
    await dragBy(
      page,
      item,
      "Sub A1",
      0,
      {
        x: targetPoint.x - itemCenter.x,
        y: targetPoint.y - itemCenter.y,
      },
      { steps: 120 },
    );

    await expect
      .poll(() => directSnapSortChildTexts(outerContainer))
      .toEqual([
        "Item 1",
        "Item 1.5",
        "Sub A1",
        "Sub A2Sub A3",
        "Item 2",
        "Item 3",
      ]);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });

  test("commits the hovered slot inside a locked nested container without animation", async ({
    page,
  }) => {
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&lockNestedChild=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    await dragToItemFraction(page, item, "Item 1", 0, target, 0.85);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });

  test("places an item below a projected locked nested container without entering it", async ({
    page,
  }) => {
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&lockNestedChild=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Nested Container");
    const outerContainer = nested.locator(".snapsort-container").first();
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Item 2");
    await dragToItemFraction(page, item, "Item 1", 0, target, 0.5, {
      steps: 70,
    });

    await expect
      .poll(() => directSnapSortChildTexts(outerContainer))
      .toEqual([
        "Item 1.5",
        "Sub A1Sub A2Sub A3",
        "Item 2",
        "Item 1",
        "Item 3",
      ]);
  });

  test("commits the first nested item slot without animation", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A1");
    await dragToItemFraction(page, item, "Item 1", 0, target, 1.05, {
      steps: 70,
    });

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Item 1", "Sub A2", "Sub A3"]);
  });

  test("commits the hovered nested slot while animation moves the container", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    await dragToItemFraction(page, item, "Item 1", 0, target, 0.85);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });
});
