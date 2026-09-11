import { expect, test } from "@playwright/test";
import { center } from "../../../helpers/snapsort-fixtures";
import {
  demoBoxByHeading,
  dragLockedNestedContainerBackground,
  installSnapsortTrace,
  itemByTextIn,
  itemRect,
  nestedContainerSelfInsertProbe,
  nestedSnapSortLifecycleState,
  releaseStartedDragNearOrigin,
  writeJson,
} from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("does not crash when drag movement arrives before snapshot capture", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item = await itemByTextIn(verticalColumn, "Item 1");
    const itemCenter = center(await itemRect(item));

    await page.mouse.move(itemCenter.x, itemCenter.y);
    await page.mouse.down();
    for (let step = 1; step <= 24; step++) {
      await page.mouse.move(itemCenter.x, itemCenter.y + step * 4);
    }
    await page.mouse.up();
    await page.waitForTimeout(100);

    await writeJson(testInfo.outputPath("snapshot-readiness-trace.json"), {
      errors: consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
      snapshotWaits: consoleMessages.filter((message) =>
        /waiting for drag snapshot/.test(message),
      ),
    });

    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });

  test("cleans up drag state when a started drag releases back inside the threshold", async ({
    page,
  }, testInfo) => {
    // Regression: a drag that starts (crosses the threshold) and then returns
    // near its origin before release must still fire dragEnd and commit/clean
    // up. Previously dragEnd was gated on the pointer's final distance from
    // the start, so an away-and-back "drop it in the same place" gesture was
    // misclassified as a click and left the drag session uncommitted.
    // Fixed in src/input.ts #finishPointer by gating on the drag gesture state.
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    await releaseStartedDragNearOrigin(page, nested, "Item 1.5", "Sub A1", 0.2);
    const state = await nestedSnapSortLifecycleState(page);

    await writeJson(
      testInfo.outputPath("threshold-release-cleanup-repro.json"),
      {
        state,
        errors: [
          ...pageErrors,
          ...consoleMessages.filter((message) =>
            /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
              message,
            ),
          ),
        ],
      },
    );

    expect(state.spacerCount, "released drag should remove its ghost").toBe(0);
    expect(
      state.draggingTexts,
      "released drag should clear the dragging marker",
    ).toEqual([]);
  });

  test("does not let a locked container drag consume leaked root ghost state", async ({
    page,
  }, testInfo) => {
    test.fail(
      true,
      "Known repro: drag/dragEnd still run after locked dragStart returns, so a locked container can consume leaked root drag state.",
    );
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&lockNestedChild=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Nested Container");
    await releaseStartedDragNearOrigin(page, nested, "Item 1.5", "Sub A1", 0.2);
    const beforeLockedDrag = await nestedSnapSortLifecycleState(page);
    await dragLockedNestedContainerBackground(page, nested);
    const afterLockedDrag = await nestedSnapSortLifecycleState(page);

    await writeJson(
      testInfo.outputPath("locked-container-leak-adoption-repro.json"),
      {
        beforeLockedDrag,
        afterLockedDrag,
        adapterWarnings: consoleMessages.filter((message) =>
          /adapter did not place/.test(message),
        ),
        errors: [
          ...pageErrors,
          ...consoleMessages.filter((message) =>
            /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
              message,
            ),
          ),
        ],
      },
    );

    expect(
      beforeLockedDrag.spacerCount,
      "precondition should expose the leaked ghost",
    ).toBe(1);
    expect(
      afterLockedDrag.spacerCount,
      "a locked container drag should not consume another drag's leaked ghost",
    ).toBe(1);
  });

  test("does not self-reference beforeElement when reinserting an existing nested container", async ({
    page,
  }, testInfo) => {
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const probe = await nestedContainerSelfInsertProbe(page);
    await writeJson(
      testInfo.outputPath("nested-container-self-insert-repro.json"),
      {
        probe,
      },
    );

    expect(probe.found, "expected to find the nested container objects").toBe(
      true,
    );
    expect(
      probe.insertEvents.some((event) => event.selfBefore),
      `adapter should never receive the dropped item as beforeElement; events=${JSON.stringify(probe.insertEvents)}`,
    ).toBe(false);
    expect(
      probe.duplicateCount,
      `re-inserting an existing child should not duplicate the itemOrderedList; order=${probe.afterOrder.join(" | ")}`,
    ).toBe(1);
  });

  test("does not throw when a released dragged item is grabbed again", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    await releaseStartedDragNearOrigin(page, nested, "Item 1.5", "Sub A1", 0.2);
    const releasedItem = await itemByTextIn(nested, "Item 1.5");
    const releasedRect = await itemRect(releasedItem);
    const releasedCenter = center(releasedRect);

    await page.mouse.move(releasedCenter.x, releasedCenter.y);
    await page.mouse.down();
    await page.mouse.move(releasedCenter.x + 20, releasedCenter.y + 20, {
      steps: 10,
    });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const state = await nestedSnapSortLifecycleState(page);
    await writeJson(testInfo.outputPath("released-item-regrab.json"), {
      state,
      pageErrors,
      consoleErrors: consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    });

    expect(pageErrors).toHaveLength(0);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
    expect(state.spacerCount).toBe(0);
    expect(state.draggingTexts).toEqual([]);
  });
});
