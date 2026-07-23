import { expect, test, type Locator, type Page } from "@playwright/test";

// JS-driven node resize (SnapLine core): a virtual CircleCollider hitbox at the
// node's bottom-right corner. Pressing+dragging it resizes the node, and every
// resize re-glues the node's connector lines (same handling as a move + a size
// re-measure).

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function dragFromTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
}

async function waitForAnimationFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
}

async function lineStart(page: Page) {
  return page.locator("[data-snapline-type='connector-line']").evaluate((svg) => {
    const rect = svg.getBoundingClientRect();
    const transform = new DOMMatrixReadOnly(getComputedStyle(svg).transform);
    const path = svg.querySelector("path");
    const numbers = path?.getAttribute("d")?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const p = new DOMPoint(numbers[0] ?? 0, numbers[1] ?? 0).matrixTransform(transform);
    return { x: p.x + (rect.left - p.x), y: p.y + (rect.top - p.y) };
  });
}

function expectClose(a: { x: number; y: number }, b: { x: number; y: number }, tol = 6) {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(tol);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(tol);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapline-resize");
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
});

test("resizing a node keeps its connector line glued to the moved connector", async ({ page }) => {
  const nodeA = page.locator("[data-snapline-type='node']", { hasText: "Resizable A" });
  const nodeB = page.locator("[data-snapline-type='node']", { hasText: "Fixed B" });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");

  await dragFromTo(page, await centerOf(output), await centerOf(input));
  const line = page.locator("[data-snapline-type='connector-line']");
  await expect(line).toHaveCount(1);
  await waitForAnimationFrame(page);
  expectClose(await lineStart(page), await centerOf(output));

  // Grow node A from its BR corner: the output connector (right edge) moves.
  const before = await nodeA.boundingBox();
  const br = { x: before!.x + before!.width - 2, y: before!.y + before!.height - 2 };
  await dragFromTo(page, br, { x: br.x + 150, y: br.y + 90 });
  await waitForAnimationFrame(page);

  const after = await nodeA.boundingBox();
  expect(after!.width - before!.width).toBeGreaterThan(90);
  expect(after!.height - before!.height).toBeGreaterThan(50);
  // Line start followed the connector that moved with the resize.
  expectClose(await lineStart(page), await centerOf(output));
});

test("resize can be grabbed beyond the node's visual edge", async ({ page }) => {
  const nodeA = page.locator("[data-snapline-type='node']", { hasText: "Resizable A" });
  const before = await nodeA.boundingBox();
  // Press OUTSIDE the node's box (BR + 6px) but inside the ~14px hitbox radius.
  const outside = { x: before!.x + before!.width + 6, y: before!.y + before!.height + 6 };
  await dragFromTo(page, outside, { x: outside.x + 130, y: outside.y + 80 });
  await waitForAnimationFrame(page);
  const after = await nodeA.boundingBox();
  expect(after!.width - before!.width).toBeGreaterThan(80);
});

test("a plain (non-resizable) node moves when grabbed at its BR corner", async ({ page }) => {
  const nodeB = page.locator("[data-snapline-type='node']", { hasText: "Fixed B" });
  const before = await nodeB.boundingBox();
  const br = { x: before!.x + before!.width - 3, y: before!.y + before!.height - 3 };
  await dragFromTo(page, br, { x: br.x + 100, y: br.y + 70 });
  const after = await nodeB.boundingBox();
  expect(after!.x - before!.x).toBeGreaterThan(70); // moved
  expect(Math.abs(after!.width - before!.width)).toBeLessThan(4); // not resized
});

test("tl anchor: dragging the top-left handle grows the box while the BR corner stays fixed", async ({ page }) => {
  const nodeC = page.locator("[data-snapline-type='node']", { hasText: "TL Anchor C" });
  const before = await nodeC.boundingBox();
  const brBefore = { x: before!.x + before!.width, y: before!.y + before!.height };

  // Press the TL corner (the anchor) and drag outward (up-left): grows the box.
  const tl = { x: before!.x + 2, y: before!.y + 2 };
  await dragFromTo(page, tl, { x: tl.x - 90, y: tl.y - 60 });
  await waitForAnimationFrame(page);

  const after = await nodeC.boundingBox();
  expect(after!.width - before!.width).toBeGreaterThan(60);
  expect(after!.height - before!.height).toBeGreaterThan(30);
  // The OPPOSITE (bottom-right) corner must not move.
  const brAfter = { x: after!.x + after!.width, y: after!.y + after!.height };
  expect(Math.abs(brAfter.x - brBefore.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(brAfter.y - brBefore.y)).toBeLessThanOrEqual(4);
});

test("tl anchor: the origin freezes once the min size is reached", async ({ page }) => {
  const nodeC = page.locator("[data-snapline-type='node']", { hasText: "TL Anchor C" });
  const before = await nodeC.boundingBox();
  const brBefore = { x: before!.x + before!.width, y: before!.y + before!.height };

  // Drag the TL handle far INWARD (down-right), past the min size clamp.
  const tl = { x: before!.x + 2, y: before!.y + 2 };
  await dragFromTo(page, tl, { x: tl.x + 400, y: tl.y + 400 });
  await waitForAnimationFrame(page);

  const after = await nodeC.boundingBox();
  // Clamped at minWidth/minHeight (140x90 configured in the demo).
  expect(Math.round(after!.width)).toBeGreaterThanOrEqual(140 - 2);
  expect(Math.round(after!.width)).toBeLessThanOrEqual(140 + 6);
  expect(Math.round(after!.height)).toBeGreaterThanOrEqual(90 - 2);
  expect(Math.round(after!.height)).toBeLessThanOrEqual(90 + 6);
  // The BR corner still never moved: origin shift derives from the CLAMPED size.
  const brAfter = { x: after!.x + after!.width, y: after!.y + after!.height };
  expect(Math.abs(brAfter.x - brBefore.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(brAfter.y - brBefore.y)).toBeLessThanOrEqual(4);
});
