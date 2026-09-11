import { expect, test } from "@playwright/test";
import { center } from "../../../helpers/snapsort-fixtures";
import {
  compressedSpacerStates,
  demoBoxByHeading,
  dragBy,
  dragTo,
  expectGhostUpdatesStable,
  expectNoNestedParentFlicker,
  expectNoSpacerBacktrack,
  expectNoSpacerOscillation,
  expectSpacerAlignedAfterPrevious,
  expectSpacerNearDragged,
  expectStableDrag,
  ghostInsertionTargets,
  installSnapsortTrace,
  itemByText,
  itemByTextIn,
  itemRect,
  writeJson,
} from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("does not flicker the spacer backward while dragging down a vertical column", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item = await itemByTextIn(verticalColumn, "Item 1");
    const target = await itemByTextIn(verticalColumn, "Item 4");
    const itemCenter = center(await itemRect(item));
    const targetCenter = center(await itemRect(target));
    const samples = await dragBy(page, item, "Item 1", 0, {
      x: 0,
      y: targetCenter.y - itemCenter.y + 48,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("vertical-column-flicker-trace.json"),
    );
    expectNoSpacerBacktrack(samples, "y");
    expectNoSpacerOscillation(samples);
    expectGhostUpdatesStable(consoleMessages, 5);
  });

  test("does not flicker the spacer upward while dragging into a wrapped horizontal row", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const horizontalRow = await demoBoxByHeading(page, "Horizontal Row");
    const item = await itemByTextIn(horizontalRow, "Item 1");
    const target = await itemByTextIn(horizontalRow, "Item 4");
    const itemCenter = center(await itemRect(item));
    const targetCenter = center(await itemRect(target));
    const samples = await dragBy(page, item, "Item 1", 0, {
      x: 0,
      y: targetCenter.y - itemCenter.y,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("horizontal-row-wrap-flicker-trace.json"),
    );
    expectNoSpacerBacktrack(samples, "y");
    expectNoSpacerOscillation(samples);
    expectGhostUpdatesStable(consoleMessages, 3);
  });

  test("does not flicker out of a nested column after entering it", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    const samples = await dragTo(page, item, "Item 1", 0, target);

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-container-flicker-trace.json"),
      { assertCenter: false },
    );
    expectNoNestedParentFlicker(samples);
    expectGhostUpdatesStable(consoleMessages, 6);
  });

  test("can reach nested column boundary slots while dragging root item downward", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const item3 = await itemByTextIn(nested, "Item 3");
    const itemCenter = center(await itemRect(item));
    const item3Center = center(await itemRect(item3));
    const samples = await dragBy(
      page,
      item,
      "Item 1",
      0,
      {
        x: 0,
        y: item3Center.y - itemCenter.y + 96,
      },
      { steps: 240 },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-boundary-slots-trace.json"),
      { assertCenter: false },
    );

    const states = compressedSpacerStates(samples);
    const ghostTargets = ghostInsertionTargets(consoleMessages);
    await writeJson(testInfo.outputPath("nested-boundary-slots-states.json"), {
      states,
      ghostTargets,
    });

    expect(
      states,
      `ghost should visit nested container boundary slots; observed ${states.join(" -> ")}`,
    ).toEqual(expect.arrayContaining(["nested-inner[0]", "nested-inner[3]"]));
  });

  test("creates a spacer when dragging a sub-container as an item", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const cell = await demoBoxByHeading(page, "Draggable Sub-Containers");
    const source = cell
      .locator(".snapsort-container .snapsort-container")
      .filter({ hasText: "Group 1 - A" })
      .first();
    await expect(source).toBeVisible();
    const target = await itemByTextIn(cell, "Loose Item");
    const sourceRect = await itemRect(source);
    const targetCenter = center(await itemRect(target));
    const start = { x: sourceRect.x + 8, y: sourceRect.y + 8 };
    const samples = await dragBy(
      page,
      source,
      "Group 1",
      0,
      {
        x: targetCenter.x - start.x,
        y: targetCenter.y - start.y,
      },
      { start, assertCenter: false },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("drag-container-trace.json"),
      { assertCenter: false },
    );
    expect(
      samples.some((sample) => sample.spacerCount === 1 && sample.spacer),
      "dragging a sub-container should create and move a spacer",
    ).toBe(true);
  });

  test("keeps layer-panel ghost aligned below a labeled sub-container", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const layers = await demoBoxByHeading(page, "Layers Panel");
    const header = await itemByTextIn(layers, "Header");
    const hero = layers
      .locator(".snapsort-container")
      .filter({ hasText: "Hero Section" })
      .nth(1);
    await expect(hero).toBeVisible();
    const headerRect = await itemRect(header);
    const headerCenter = center(headerRect);
    const heroRect = await itemRect(hero);
    const targetCenterY =
      heroRect.y + heroRect.height + headerRect.height / 2 + 12;
    const samples = await dragBy(
      page,
      header,
      "Header",
      0,
      {
        x: 0,
        y: targetCenterY - headerCenter.y,
      },
      { steps: 240 },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("layers-panel-offset-trace.json"),
      { assertCenter: false },
    );
    expectSpacerAlignedAfterPrevious(samples, "layers-root", /Hero Section/);
    expectSpacerNearDragged(samples, "layers-root", 48);
  });

  test("keeps draggable sub-container ghost aligned after resized groups", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const cell = await demoBoxByHeading(page, "Draggable Sub-Containers");
    const group1B = await itemByTextIn(cell, "Group 1 - B");
    const group2 = cell
      .locator(".snapsort-container")
      .filter({ hasText: "Group 2 - A" })
      .nth(1);
    await expect(group2).toBeVisible();
    const group1BRect = await itemRect(group1B);
    const group1BCenter = center(group1BRect);
    const group2Rect = await itemRect(group2);
    const targetCenterY =
      group2Rect.y + group2Rect.height + group1BRect.height / 2 + 12;
    const samples = await dragBy(
      page,
      group1B,
      "Group 1 - B",
      0,
      {
        x: 0,
        y: targetCenterY - group1BCenter.y,
      },
      { steps: 240 },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("drag-subcontainer-offset-trace.json"),
      { assertCenter: false },
    );
    expectSpacerAlignedAfterPrevious(samples, "drag-root", /Group 2 - A/);
    expectSpacerNearDragged(samples, "drag-root", 48);
  });

  test("keeps one stable spacer while reordering a flat nested-items list", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    await page.screenshot({
      path: testInfo.outputPath("nested-flat-before.png"),
      fullPage: true,
    });

    const item = await itemByText(page, "Item B");
    const samples = await dragBy(page, item, "Item B", 0, { x: 0, y: 110 });
    await page.screenshot({
      path: testInfo.outputPath("nested-flat-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-flat-trace.json"),
    );
  });

  test("keeps nested container drop prediction stable for padded sub-items", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    await page.screenshot({
      path: testInfo.outputPath("nested-subitem-before.png"),
      fullPage: true,
    });

    const item = await itemByText(page, "Sub A2");
    const samples = await dragBy(page, item, "Sub A2", 0, { x: 0, y: 95 });
    await page.screenshot({
      path: testInfo.outputPath("nested-subitem-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-subitem-trace.json"),
    );
  });

  test("resolves multiple-drop-area container conflicts without spacer flicker", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    await page.screenshot({
      path: testInfo.outputPath("multi-area-before.png"),
      fullPage: true,
    });

    const item = await itemByText(page, "Item B");
    const target = await itemByText(page, "Item Y");
    const samples = await dragTo(page, item, "Item B", 0, target);
    await page.screenshot({
      path: testInfo.outputPath("multi-area-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("multi-area-trace.json"),
    );
  });

  test("keeps wrapped row indices aligned beyond the first row", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    const doubleRow = await demoBoxByHeading(page, "Horizontal Double Row");
    await page.screenshot({
      path: testInfo.outputPath("wrapped-row-before.png"),
      fullPage: true,
    });

    const item = await itemByTextIn(doubleRow, "Item 1");
    const target = await itemByTextIn(doubleRow, "Item 9");
    const samples = await dragTo(page, item, "Item 1", 0, target);
    await page.screenshot({
      path: testInfo.outputPath("wrapped-row-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("wrapped-row-trace.json"),
    );

    const order = await doubleRow
      .locator(".snapsort-item")
      .evaluateAll((elements) =>
        elements.map((element) => element.textContent?.trim()),
      );
    expect(order.slice(0, 10)).toEqual([
      "Item 2",
      "Item 3",
      "Item 4",
      "Item 5",
      "Item 6",
      "Item 7",
      "Item 8",
      "Item 9",
      "Item 1",
      "Item 10",
    ]);
  });
});
