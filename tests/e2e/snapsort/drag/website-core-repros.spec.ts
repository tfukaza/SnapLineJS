import { expect, test } from "@playwright/test";
import { contentRect } from "../../../../src/geometry";
import { flowLayoutPositions } from "../../../helpers/layout-grid";
import {
  type Box,
  center,
  snapshotFixture,
} from "../../../helpers/snapsort-fixtures";
import {
  compressedSpacerStates,
  demoBoxByHeading,
  directLogoSliceOrder,
  directSnapSortItemTexts,
  dragBy,
  dragToItemFraction,
  expectNoParentReentry,
  expectStableDrag,
  ghostInsertionTargets,
  installSnapsortTrace,
  itemByTextIn,
  itemRect,
  websiteCoreDemo,
  writeJson,
} from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("keeps the final slot reachable in a plain vertical list", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const container = verticalColumn.locator(".snapsort-container").first();
    const item = await itemByTextIn(verticalColumn, "Item 1");
    const target = await itemByTextIn(verticalColumn, "Item 4");

    await dragToItemFraction(page, item, "Item 1", 0, target, 1.05, {
      steps: 80,
    });

    await expect
      .poll(() => directSnapSortItemTexts(container))
      .toEqual(["Item 2", "Item 3", "Item 4", "Item 1"]);
  });

  test("reproduces website sideways list final-slot placement", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "sideways-list");
    const container = card.locator(".sideways-list");
    await expect
      .poll(() => directLogoSliceOrder(container))
      .toEqual([3, 0, 5, 1, 4, 2]);

    const source = container.locator(".snapsort-item").first();
    const last = container.locator(".snapsort-item").last();
    const sourceRect = await itemRect(source);
    const sourceCenter = center(sourceRect);
    const lastRect = await itemRect(last);
    const target = {
      x: lastRect.x + lastRect.width + sourceRect.width / 2 + 24,
      y: lastRect.y + lastRect.height / 2,
    };

    await dragBy(
      page,
      source,
      "TypeScript slice 3",
      0,
      {
        x: target.x - sourceCenter.x,
        y: target.y - sourceCenter.y,
      },
      { steps: 140 },
    );

    await expect
      .poll(() => directLogoSliceOrder(container))
      .toEqual([0, 5, 1, 4, 2, 3]);
  });

  test("reproduces website nested bottom-slot stability", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "nested-list");
    const source = await itemByTextIn(card, "Item 1");
    const target = await itemByTextIn(card, "Item 6");
    const handle = source.locator(".demo-row-handle").first();
    const start = center(await itemRect(handle));
    const targetRect = await itemRect(target);
    const targetPoint = {
      x: targetRect.x + targetRect.width / 2,
      y: targetRect.y + targetRect.height * 1.15,
    };
    const samples = await dragBy(
      page,
      source,
      "Item 1",
      0,
      {
        x: targetPoint.x - start.x,
        y: targetPoint.y - start.y,
      },
      {
        start,
        steps: 240,
      },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("website-nested-bottom-slot-trace.json"),
      { assertCenter: false },
    );
    expectNoParentReentry(
      samples,
      "website-nested-inner",
      "website-nested-outer",
      "website core",
    );

    const states = compressedSpacerStates(samples, [
      "website-nested-inner",
      "website-nested-outer",
    ]);
    await writeJson(
      testInfo.outputPath("website-nested-bottom-slot-states.json"),
      {
        states,
        ghostTargets: ghostInsertionTargets(consoleMessages),
      },
    );
    expect(
      states,
      `ghost should reach the bottom slot of the website nested list; observed ${states.join(" -> ")}`,
    ).toContain("website-nested-inner[3]");

    const innerContainer = card.locator(".nested-list");
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Item 4", "Item 5", "Item 6", "Item 1"]);
  });

  test("reproduces website 321px multi-container row layout parity", async ({
    page,
  }, testInfo) => {
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "multiple-containers");
    const board = card.locator(".multi-container-board");
    await expect(board).toBeVisible();

    const measured = await board.evaluate((element) => {
      const number = (value: string) => Number.parseFloat(value) || 0;
      const boxOf = (node: Element): Box => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          screen: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          margin: {
            top: number(style.marginTop),
            right: number(style.marginRight),
            bottom: number(style.marginBottom),
            left: number(style.marginLeft),
          },
          padding: {
            top: number(style.paddingTop),
            right: number(style.paddingRight),
            bottom: number(style.paddingBottom),
            left: number(style.paddingLeft),
          },
          border: {
            top: number(style.borderTopWidth),
            right: number(style.borderRightWidth),
            bottom: number(style.borderBottomWidth),
            left: number(style.borderLeftWidth),
          },
        };
      };
      const columns = [...element.children].filter((child) =>
        child.classList.contains("basic-column"),
      );
      const columnBoxes = columns.map((column, index) => ({
        id: `column-${index}`,
        box: boxOf(column),
      }));
      return {
        board: boxOf(element),
        columns: columnBoxes,
        domSameRow:
          columnBoxes.length === 2 &&
          Math.abs(columnBoxes[0].box.y - columnBoxes[1].box.y) < 1,
      };
    });

    expect(measured.columns).toHaveLength(2);
    expect(
      measured.domSameRow,
      "the browser DOM should keep both columns on one row",
    ).toBe(true);

    const boardSnapshot = snapshotFixture<string>({
      value: "website-multi-container-board",
      direction: "row",
      locked: true,
      box: measured.board,
      children: measured.columns.map((column) => ({
        value: column.id,
        direction: "column",
        locked: true,
        box: column.box,
        children: [],
      })),
    });
    const origin = contentRect(measured.board);
    const layout = flowLayoutPositions(boardSnapshot, origin.x, origin.y);
    const simulated = boardSnapshot.children.map((child) => {
      const position = layout.itemPositions.get(child);
      if (!position) {
        throw new Error(`Missing simulated position for ${child.value}`);
      }
      return { id: child.value, ...position };
    });

    await writeJson(
      testInfo.outputPath("website-321px-multi-container-layout.json"),
      {
        measured,
        simulated,
      },
    );

    expect(
      Math.abs(simulated[0].y - simulated[1].y),
      `layout engine should not wrap the second 321px column when the DOM stays on one row; simulated=${JSON.stringify(simulated)}`,
    ).toBeLessThan(1);

    const source = await itemByTextIn(card, "Spec");
    const target = await itemByTextIn(card, "Ship");
    const sourceCenter = center(await itemRect(source));
    const targetRect = await itemRect(target);
    const samples = await dragBy(
      page,
      source,
      "Spec",
      0,
      {
        x: targetRect.x + targetRect.width / 2 - sourceCenter.x,
        y: targetRect.y + targetRect.height * 1.15 - sourceCenter.y,
      },
      {
        captureFrameRects: true,
        steps: 160,
      },
    );
    const wrappedFrames = samples.flatMap((sample) => {
      const columns =
        sample.frameRects?.filter(
          (entry) =>
            entry.role === "container" &&
            (/^Left\b/.test(entry.text) || /^Right\b/.test(entry.text)),
        ) ?? [];
      if (columns.length !== 2) return [];

      const deltaY = Math.abs(columns[0].rect.y - columns[1].rect.y);
      return deltaY > 1 ? [{ step: sample.step, deltaY, columns }] : [];
    });

    await writeJson(
      testInfo.outputPath("website-321px-multi-container-drag.json"),
      {
        wrappedFrames,
        samples,
      },
    );

    expect(
      wrappedFrames,
      "left and right containers should stay on one visual row during the 321px drag",
    ).toHaveLength(0);
  });

  test("keeps website multi-container dragged item above both columns", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "multiple-containers");
    const source = await itemByTextIn(card, "Spec");
    const target = await itemByTextIn(card, "Ship");
    await target.scrollIntoViewIfNeeded();
    const sourceRect = await source.boundingBox();
    const targetRect = await target.boundingBox();
    if (!sourceRect || !targetRect) {
      throw new Error("Expected multi-container items to have bounding boxes.");
    }
    const startPoint = {
      x: sourceRect.x + sourceRect.width * 0.25,
      y: sourceRect.y + sourceRect.height / 2,
    };
    const hoverPoint = {
      x: targetRect.x + Math.min(48, targetRect.width / 2),
      y: targetRect.y + targetRect.height / 2,
    };

    const samples = await dragBy(
      page,
      source,
      "Spec",
      0,
      {
        x: hoverPoint.x - startPoint.x,
        y: hoverPoint.y - startPoint.y,
      },
      {
        start: startPoint,
        steps: 80,
      },
    );

    const overRightColumn = samples.filter(
      (sample) =>
        sample.mouse.x >= targetRect.x &&
        sample.mouse.x <= targetRect.x + targetRect.width &&
        sample.mouse.y >= targetRect.y &&
        sample.mouse.y <= targetRect.y + targetRect.height,
    );

    expect(
      overRightColumn,
      "drag should move over the right column",
    ).not.toHaveLength(0);
    const recentSamples = JSON.stringify(overRightColumn.slice(-4));
    expect(
      overRightColumn.some(
        (sample) =>
          sample.draggedAttribute === "true" &&
          sample.draggedSourceColumnZIndex === "2" &&
          !!sample.dragged &&
          sample.dragged.x < targetRect.x + targetRect.width &&
          sample.dragged.x + sample.dragged.width > targetRect.x &&
          sample.dragged.y < targetRect.y + targetRect.height &&
          sample.dragged.y + sample.dragged.height > targetRect.y,
      ),
      `dragged item should overlap the right column from an elevated source column; observed ${recentSamples}`,
    ).toBe(true);

    await expect
      .poll(() =>
        card
          .locator(".basic-column")
          .first()
          .evaluate((element) => (element as HTMLElement).style.zIndex),
      )
      .toBe("");
  });
});
