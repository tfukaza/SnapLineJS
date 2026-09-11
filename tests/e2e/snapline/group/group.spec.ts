import { expect, test, type Locator, type Page } from "@playwright/test";

// A group node carries any node whose center is inside its box. Membership is
// live geometric containment, refreshed on settle (move / resize / node drop);
// moving the group transform-parents its members and rides the writeTransform
// cascade to move them in one pass.

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function dragFromTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

const NODE = "[data-snapline-type='node']";
const MEMBER = "[data-member='true']";
const HEADER = "[data-snapline-part='group-header']";
const RESIZE = "[data-snapline-part='resize-region'][data-handle='se']";

function nodeByTitle(page: Page, title: string): Locator {
  return page.locator(NODE, { hasText: title });
}

function groupByTitle(page: Page, title: string): Locator {
  return page.locator("[data-snapline-type='group']", { hasText: title });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapline-group");
  await expect(page.locator(NODE)).toHaveCount(3);
  await expect(page.locator("[data-snapline-type='group']")).toHaveCount(1);
  // Seed settles: Node A and Node C start inside the box, Node B outside.
  await expect(page.locator(MEMBER)).toHaveCount(2);
});

test("dragging the group header carries its in-box members, not outsiders", async ({
  page,
}) => {
  const nodeA = nodeByTitle(page, "Node A");
  const nodeB = nodeByTitle(page, "Node B");
  const beforeA = await nodeA.boundingBox();
  const beforeB = await nodeB.boundingBox();

  const header = await centerOf(page.locator(HEADER));
  await dragFromTo(page, header, { x: header.x + 130, y: header.y + 70 });

  const afterA = await nodeA.boundingBox();
  const afterB = await nodeB.boundingBox();
  // Member A rides the group by the same delta.
  expect(afterA!.x - beforeA!.x).toBeGreaterThan(100);
  expect(afterA!.y - beforeA!.y).toBeGreaterThan(50);
  // Non-member B stays put.
  expect(Math.abs(afterB!.x - beforeB!.x)).toBeLessThan(8);
  expect(Math.abs(afterB!.y - beforeB!.y)).toBeLessThan(8);
});

test("carried members do not fire enter/leave (cue count stays stable)", async ({
  page,
}) => {
  const header = await centerOf(page.locator(HEADER));
  await dragFromTo(page, header, { x: header.x + 60, y: header.y + 40 });
  // A and C merely moved with the group — still members, no flicker.
  await expect(page.locator(MEMBER)).toHaveCount(2);
});

test("resizing the group to cover a node adds it, shrinking removes it", async ({
  page,
}) => {
  const nodeB = nodeByTitle(page, "Node B");
  await expect(nodeB).not.toHaveAttribute("data-member", "true");

  // Grow the box rightward past Node B's center.
  const handle = await centerOf(page.locator(RESIZE));
  await dragFromTo(page, handle, { x: handle.x + 200, y: handle.y });
  await expect(nodeB).toHaveAttribute("data-member", "true");
  await expect(page.locator(MEMBER)).toHaveCount(3);

  // Shrink back so Node B falls outside again.
  const handle2 = await centerOf(page.locator(RESIZE));
  await dragFromTo(page, handle2, { x: handle2.x - 200, y: handle2.y });
  await expect(nodeB).not.toHaveAttribute("data-member", "true");
  await expect(page.locator(MEMBER)).toHaveCount(2);
});

test("moving the group over a node adds it, and the next drag carries it", async ({
  page,
}) => {
  const nodeB = nodeByTitle(page, "Node B");
  const startB = await nodeB.boundingBox();

  // Drag the group right so its box comes to rest over Node B.
  const header = await centerOf(page.locator(HEADER));
  await dragFromTo(page, header, { x: header.x + 240, y: header.y });

  // B did not move this drag (it was not a member at drag start) but is now one.
  const settledB = await nodeB.boundingBox();
  expect(Math.abs(settledB!.x - startB!.x)).toBeLessThan(8);
  await expect(nodeB).toHaveAttribute("data-member", "true");

  // The next group drag carries B.
  const header2 = await centerOf(page.locator(HEADER));
  await dragFromTo(page, header2, { x: header2.x, y: header2.y + 90 });
  const carriedB = await nodeB.boundingBox();
  expect(carriedB!.y - settledB!.y).toBeGreaterThan(60);
});

test("nested groups carry their full descendant subtree", async ({ page }) => {
  await page.goto("/snapline-nested-group");
  const outer = groupByTitle(page, "Outer Group");
  const inner = groupByTitle(page, "Inner Group");
  const direct = nodeByTitle(page, "Direct Node");
  const nested = nodeByTitle(page, "Nested Node");
  const outside = nodeByTitle(page, "Outside Node");

  await expect(inner).toHaveAttribute("data-outer-member", "true");
  await expect(direct).toHaveAttribute("data-outer-member", "true");
  await expect(nested).toHaveAttribute("data-inner-member", "true");
  await expect(nested).not.toHaveAttribute("data-outer-member", "true");

  const beforeInner = await inner.boundingBox();
  const beforeDirect = await direct.boundingBox();
  const beforeNested = await nested.boundingBox();
  const beforeOutside = await outside.boundingBox();
  const outerHeader = await centerOf(
    outer.locator("[data-snapline-part='group-header']"),
  );
  const target = {
    x: outerHeader.x + 100,
    y: outerHeader.y + 70,
  };
  await page.mouse.move(outerHeader.x, outerHeader.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
  );

  const liveInner = await inner.boundingBox();
  const liveDirect = await direct.boundingBox();
  const liveNested = await nested.boundingBox();
  const liveOutside = await outside.boundingBox();
  for (const [before, after] of [
    [beforeInner, liveInner],
    [beforeDirect, liveDirect],
    [beforeNested, liveNested],
  ] as const) {
    expect(after!.x - before!.x).toBeGreaterThan(80);
    expect(after!.y - before!.y).toBeGreaterThan(50);
  }
  expect(Math.abs(liveOutside!.x - beforeOutside!.x)).toBeLessThan(8);
  expect(Math.abs(liveOutside!.y - beforeOutside!.y)).toBeLessThan(8);
  await page.mouse.up();

  // The nested node remains an inner member and can still be carried by an
  // independent inner-group drag after the outer gesture is detached.
  const beforeNestedOnly = await nested.boundingBox();
  const beforeDirectOnly = await direct.boundingBox();
  const innerHeader = await centerOf(
    inner.locator("[data-snapline-part='group-header']"),
  );
  await dragFromTo(page, innerHeader, {
    x: innerHeader.x + 60,
    y: innerHeader.y + 40,
  });
  const afterNestedOnly = await nested.boundingBox();
  const afterDirectOnly = await direct.boundingBox();
  expect(afterNestedOnly!.x - beforeNestedOnly!.x).toBeGreaterThan(45);
  expect(afterNestedOnly!.y - beforeNestedOnly!.y).toBeGreaterThan(25);
  expect(Math.abs(afterDirectOnly!.x - beforeDirectOnly!.x)).toBeLessThan(8);
});

test("partially overlapping groups do not become nested", async ({ page }) => {
  await page.goto("/snapline-nested-group");
  const outer = groupByTitle(page, "Outer Group");
  const inner = groupByTitle(page, "Inner Group");

  // Move the inner group until it overlaps the outer boundary. Center overlap
  // alone is insufficient for group nesting; the child must fit completely.
  const innerHeader = await centerOf(
    inner.locator("[data-snapline-part='group-header']"),
  );
  await dragFromTo(page, innerHeader, {
    x: innerHeader.x + 260,
    y: innerHeader.y,
  });
  await expect(inner).not.toHaveAttribute("data-outer-member", "true");
  await expect(outer).not.toHaveAttribute("data-inner-member", "true");

  const beforeInner = await inner.boundingBox();
  const outerHeader = await centerOf(
    outer.locator("[data-snapline-part='group-header']"),
  );
  await dragFromTo(page, outerHeader, {
    x: outerHeader.x + 80,
    y: outerHeader.y + 30,
  });
  const afterInner = await inner.boundingBox();
  expect(Math.abs(afterInner!.x - beforeInner!.x)).toBeLessThan(8);
});

test("canContain can opt a consumer out of group members", async ({ page }) => {
  await page.goto("/snapline-nested-group");
  const optOut = groupByTitle(page, "Opt-out Group");
  const rejected = groupByTitle(page, "Rejected Group");
  const ordinary = nodeByTitle(page, "Opt-in Node");

  await expect(rejected).not.toHaveAttribute("data-optout-member", "true");
  await expect(ordinary).toHaveAttribute("data-optout-member", "true");
  await expect(optOut).toBeVisible();
});
