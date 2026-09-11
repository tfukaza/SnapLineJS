import type { Locator, Page } from "@playwright/test";

// Gallery drag gestures: a small first move past the drag threshold, a
// settle pause, then a stepped move, so SnapSort activates before the
// pointer reaches its target.

export async function dragBetween(
  page: Page,
  source: Locator,
  target: Locator,
) {
  await source.scrollIntoViewIfNeeded();
  const [sourceBox, targetBox] = await Promise.all([
    source.boundingBox(),
    target.boundingBox(),
  ]);
  if (!sourceBox || !targetBox) {
    throw new Error("Gallery drag target has no layout box.");
  }

  const sourcePoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const targetPoint = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2,
  };

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(sourcePoint.x + 7, sourcePoint.y + 7);
  await page.waitForTimeout(60);
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(200);
}

export async function holdDragToPoint(
  page: Page,
  source: Locator,
  targetPoint: { x: number; y: number },
) {
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  if (!sourceBox) {
    throw new Error("Gallery drag source has no layout box.");
  }

  const sourcePoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(sourcePoint.x + 7, sourcePoint.y + 7);
  await page.waitForTimeout(60);
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 });
  await page.waitForTimeout(120);
}
