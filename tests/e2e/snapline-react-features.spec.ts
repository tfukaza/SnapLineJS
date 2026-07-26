import { expect, test, type Locator, type Page } from "@playwright/test";

// React-adapter parity coverage for the JS node resize and the group node —
// mirrors the svelte suites (snapline-resize.spec.ts / snapline-group.spec.ts).

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

const NODE = "[data-snapline-type='node']";

test("react: resizing a node grows it from the BR corner and keeps lines glued", async ({ page }) => {
  await page.goto("/snapline-resize");
  await expect(page.locator(NODE)).toHaveCount(2);
  const nodeA = page.locator(NODE, { hasText: "Resizable A" });
  const nodeB = page.locator(NODE, { hasText: "Fixed B" });

  // Connect A output -> B input, then resize A: the line must survive.
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");
  await dragFromTo(page, await centerOf(output), await centerOf(input));
  const line = page.locator("[data-snapline-type='connector-line']");
  await expect(line).toHaveCount(1);

  const before = await nodeA.boundingBox();
  const corner = { x: before!.x + before!.width - 2, y: before!.y + before!.height - 2 };
  await dragFromTo(page, corner, { x: corner.x + 140, y: corner.y + 80 });
  await waitForAnimationFrame(page);

  const after = await nodeA.boundingBox();
  expect(after!.width - before!.width).toBeGreaterThan(90);
  expect(after!.height - before!.height).toBeGreaterThan(40);
  await expect(line).toHaveCount(1);
});

test("react: a plain node moves (not resizes) when grabbed at its BR corner", async ({ page }) => {
  await page.goto("/snapline-resize");
  await expect(page.locator(NODE)).toHaveCount(2);
  const nodeB = page.locator(NODE, { hasText: "Fixed B" });
  const before = await nodeB.boundingBox();
  const corner = { x: before!.x + before!.width - 3, y: before!.y + before!.height - 3 };
  await dragFromTo(page, corner, { x: corner.x + 100, y: corner.y + 60 });
  const after = await nodeB.boundingBox();
  expect(after!.x - before!.x).toBeGreaterThan(70);
  expect(Math.abs(after!.width - before!.width)).toBeLessThan(4);
});

test("react: group carries its in-box members and resize updates membership", async ({ page }) => {
  await page.goto("/snapline-group");
  await expect(page.locator(NODE)).toHaveCount(3);
  await expect(page.locator("[data-snapline-type='group']")).toHaveCount(1);
  // Seed: Node A and Node C inside, Node B outside.
  await expect(page.locator("[data-member='true']")).toHaveCount(2);

  const nodeA = page.locator(NODE, { hasText: "Node A" });
  const nodeB = page.locator(NODE, { hasText: "Node B" });
  const beforeA = await nodeA.boundingBox();
  const beforeB = await nodeB.boundingBox();

  // Move the group by its header: members ride, outsider stays.
  const header = await centerOf(page.locator("[data-snapline-part='group-header']"));
  await dragFromTo(page, header, { x: header.x + 120, y: header.y + 60 });
  const afterA = await nodeA.boundingBox();
  const afterB = await nodeB.boundingBox();
  expect(afterA!.x - beforeA!.x).toBeGreaterThan(90);
  expect(Math.abs(afterB!.x - beforeB!.x)).toBeLessThan(8);

  // Resize the group over Node B: it becomes a member.
  const box = await page.locator("[data-snapline-type='group']").boundingBox();
  const corner = { x: box!.x + box!.width - 3, y: box!.y + box!.height - 3 };
  await dragFromTo(page, corner, { x: corner.x + 200, y: corner.y });
  await expect(nodeB).toHaveAttribute("data-member", "true");
});
