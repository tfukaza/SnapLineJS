import { expect, test, type Locator, type Page } from "@playwright/test";

// An overlay outside SnapLine keeps a marker glued to a line's midpoint using
// onGeometryInvalidated + its own WRITE_3 task. The point of these tests is
// that it tracks *per frame*, not just once the gesture settles — a
// settle-only assertion would pass even if the channel fired once at the end.

const LINE = "[data-snapline-type='connector-line']";
const LABEL = "[data-testid='line-label']";

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

function connectorOf(page: Page, nodeTitle: string, port: "input" | "output") {
  return page
    .locator("[data-snapline-type='node']")
    .filter({
      has: page.getByRole("heading", { name: nodeTitle, exact: true }),
    })
    .locator(`[data-snapline-name='${port}']`);
}

function nodeOf(page: Page, nodeTitle: string) {
  return page.locator("[data-snapline-type='node']").filter({
    has: page.getByRole("heading", { name: nodeTitle, exact: true }),
  });
}

/**
 * The rendered line's midpoint, in screen space.
 *
 * The default path is `M 0,0 C x1,0 dx-x1,dy dx,dy`, which is point-symmetric
 * about (dx/2, dy/2) — P0↔P3 and P1↔P2 reflect through it. So the painted
 * curve's bounding box is centred exactly on the midpoint, and reading it
 * measures what was actually rendered rather than re-deriving it from the
 * numbers the overlay already used.
 */
async function lineMidpoint(page: Page) {
  return page
    .locator(`${LINE} path`)
    .first()
    .evaluate((path) => {
      const rect = path.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
}

async function labelCenter(page: Page) {
  return centerOf(page.locator(LABEL).first());
}

/** Screen-space distance between the marker and where the line actually is. */
async function drift(page: Page) {
  const [mid, label] = await Promise.all([
    lineMidpoint(page),
    labelCenter(page),
  ]);
  return Math.hypot(mid.x - label.x, mid.y - label.y);
}

async function connectAB(page: Page) {
  const from = await centerOf(connectorOf(page, "Node A", "output"));
  const to = await centerOf(connectorOf(page, "Node B", "input"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(LINE)).toHaveCount(1);
  await expect(page.locator(LABEL)).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapline-edges");
  await expect(connectorOf(page, "Node A", "output")).toBeVisible();
});

test("the overlay is glued to a settled line without any gesture", async ({
  page,
}) => {
  await connectAB(page);
  expect(await drift(page)).toBeLessThan(2);
});

test("the overlay tracks every frame of an endpoint-node drag", async ({
  page,
}) => {
  await connectAB(page);

  const node = nodeOf(page, "Node B");
  const grip = await centerOf(node.getByRole("heading", { name: "Node B" }));
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();

  const drifts: number[] = [];
  for (let step = 1; step <= 8; step++) {
    // One move per animation frame: slow pacing hides per-frame races.
    await page.mouse.move(grip.x + step * 14, grip.y + step * 9);
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => r())),
    );
    drifts.push(await drift(page));
  }
  await page.mouse.up();

  // Mid-drag, not just at rest.
  expect(Math.max(...drifts)).toBeLessThan(4);
  expect(await drift(page)).toBeLessThan(2);
});

test("the overlay tracks a resize of an endpoint node", async ({ page }) => {
  await connectAB(page);

  const node = nodeOf(page, "Node B");
  const box = (await node.boundingBox())!;
  // The TOP-LEFT handle, deliberately: it moves the anchored edge, so the
  // input connector (and therefore the line endpoint) actually travels.
  // A bottom-right resize would leave the left edge — and this line — put,
  // and the test would pass without the channel doing anything.
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();

  const drifts: number[] = [];
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(box.x - step * 6, box.y - step * 5);
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => r())),
    );
    drifts.push(await drift(page));
  }
  await page.mouse.up();

  expect(Math.max(...drifts)).toBeLessThan(4);
  expect(await drift(page)).toBeLessThan(2);
});

test("the overlay survives the line being removed and re-added", async ({
  page,
}) => {
  await connectAB(page);
  await page.getByTestId("reset-doc").click();
  await expect(page.locator(LABEL)).toHaveCount(0);

  await connectAB(page);
  expect(await drift(page)).toBeLessThan(2);
});
