import { expect, test } from "@playwright/test";
import { center } from "../../../helpers/snapsort-fixtures";
import {
  demoBoxByHeading,
  installSnapsortTrace,
  itemByTextIn,
  itemRect,
} from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("renders one ghost per member (not a merged group ghost) during a multi-item drag", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    const column = await demoBoxByHeading(page, "Vertical Column");

    // Multi-select Item 2 + Item 3 (cmd/ctrl-click), then drag the pair down.
    const item2 = await itemByTextIn(column, "Item 2");
    const item3 = await itemByTextIn(column, "Item 3");
    await item2.click();
    await item3.click({ modifiers: ["Meta"] });

    const start = center(await itemRect(item2));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(60);

    let ghostCountMidDrag = 0;
    for (let step = 1; step <= 14; step++) {
      await page.mouse.move(start.x, start.y + 120 * (step / 14));
      await page.waitForTimeout(20);
      ghostCountMidDrag = await page.evaluate(
        () => document.querySelectorAll("#spacer").length,
      );
    }

    // The two dragged members must each get their own ghost anchor — the core
    // no longer collapses the group into a single merged spacer.
    expect(ghostCountMidDrag).toBe(2);

    await page.mouse.up();
    await page.waitForTimeout(300);

    // Ghosts are cleaned up and the pair lands as a contiguous run.
    expect(
      await page.evaluate(() => document.querySelectorAll("#spacer").length),
    ).toBe(0);
    const order = await column
      .locator(".snapsort-item")
      .evaluateAll((elements) =>
        elements.map((element) => element.textContent?.trim()),
      );
    expect(order).toEqual(["Item 1", "Item 4", "Item 2", "Item 3"]);
  });
});
