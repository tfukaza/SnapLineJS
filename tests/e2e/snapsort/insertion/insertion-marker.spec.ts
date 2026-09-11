import { expect, test } from "@playwright/test";
import { center } from "../../../helpers/snapsort-fixtures";
import { itemRect } from "../_support/drag-harness";

test.describe("SnapSort insertion marker strategy", () => {
  test("keeps insertion marker absolute and does not displace siblings during hover", async ({
    page,
  }) => {
    await page.goto("/snapsort-insertion", { waitUntil: "networkidle" });

    const firstList = page.locator(".insertion-list").first();
    const firstCard = firstList.locator(".insertion-card").first();
    const secondCard = firstList.locator(".insertion-card").nth(1);

    const firstRect = await itemRect(firstCard);
    const secondBefore = await itemRect(secondCard);
    const start = center(firstRect);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + firstRect.height + 18);
    await page.waitForTimeout(120);

    const marker = page.locator('[data-snapsort-ghost="insertion"]').first();
    await expect(marker).toHaveCount(1);

    const markerState = await marker.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        position: style.position,
        inlineHeight: element.style.height,
        computedHeight: style.height,
        borderTopWidth: style.borderTopWidth,
        rectHeight: rect.height,
      };
    });
    expect(markerState.position).toBe("absolute");
    expect(markerState.inlineHeight).toBe("3px");
    expect(markerState.computedHeight).toBe("3px");
    expect(markerState.borderTopWidth).toBe("0px");
    expect(markerState.rectHeight).toBeCloseTo(3, 1);

    const secondDuring = await itemRect(secondCard);
    expect(Math.abs(secondDuring.x - secondBefore.x)).toBeLessThan(1);
    expect(Math.abs(secondDuring.y - secondBefore.y)).toBeLessThan(1);

    await page.mouse.up();
  });

  test("moves one stable marker between both outer edges of the current item", async ({
    page,
  }) => {
    await page.goto("/snapsort-insertion", { waitUntil: "networkidle" });

    const firstList = page.locator(".insertion-list").first();
    const cards = firstList.locator(".insertion-card");
    const dragged = cards.nth(1);
    const beforeOrder = await cards.locator("strong").allTextContents();
    const firstBefore = await itemRect(cards.first());
    const draggedBefore = await itemRect(dragged);
    const thirdBefore = await itemRect(cards.nth(2));
    const start = center(draggedBefore);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // The move that crosses the drag threshold only starts the session; its
    // position is not resolved. Start the drag first so the next move is the
    // first one that places the marker.
    await page.mouse.move(start.x + 6, start.y);
    await page.waitForTimeout(60);
    await page.mouse.move(start.x, draggedBefore.y + 4);
    await page.waitForTimeout(120);

    const marker = page.locator('[data-snapsort-ghost="insertion"]');
    await expect(marker).toHaveCount(1);
    const leadingRect = await itemRect(marker);
    await marker.evaluate((element) => {
      element.setAttribute("data-test-marker-identity", "stable");
    });

    await page.mouse.move(start.x, draggedBefore.y + draggedBefore.height - 4);
    await page.waitForTimeout(120);

    await expect(marker).toHaveCount(1);
    await expect(
      page.locator('[data-test-marker-identity="stable"]'),
    ).toHaveCount(1);
    const trailingRect = await itemRect(marker);
    expect(trailingRect.y - leadingRect.y).toBeGreaterThan(
      draggedBefore.height / 2,
    );

    for (const [current, before] of [
      [await itemRect(cards.first()), firstBefore],
      [await itemRect(cards.nth(2)), thirdBefore],
    ]) {
      expect(Math.abs(current.x - before.x)).toBeLessThan(1);
      expect(Math.abs(current.y - before.y)).toBeLessThan(1);
    }

    await page.mouse.up();
    await expect(marker).toHaveCount(0);
    await expect(cards.locator("strong")).toHaveText(beforeOrder);
  });
});
