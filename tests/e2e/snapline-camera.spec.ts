import { expect, test, type Locator, type Page } from "@playwright/test";

// SnapLine composed inside <Camera>: panning, zooming, and the
// allowCameraControl handshake between node/line drags and the camera.

const CAMERA = "#node-ui-camera";

async function cameraTransform(page: Page): Promise<string> {
  return page.locator(CAMERA).evaluate((el) => getComputedStyle(el).transform);
}

// scaleX is the first number of the computed matrix(...) (1 when untransformed).
async function cameraScale(page: Page): Promise<number> {
  const nums = (await cameraTransform(page)).match(/-?\d*\.?\d+/g);
  return nums ? Number.parseFloat(nums[0]) : 1;
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
}

async function dragFromTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  button: "left" | "middle" = "left",
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up({ button });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapline-camera");
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
});

test("background drag pans the camera", async ({ page }) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const before = await nodeA.boundingBox();
  await dragFromTo(page, { x: 900, y: 620 }, { x: 700, y: 470 });
  const after = await nodeA.boundingBox();
  expect(after!.x - before!.x).toBeLessThan(-150);
  expect(after!.y - before!.y).toBeLessThan(-100);
});

test("ctrl+wheel zooms the camera", async ({ page }) => {
  const before = await cameraTransform(page);
  await page.mouse.move(640, 450);
  // The camera starts at its max zoom (1), so scroll down / pinch-in zooms out.
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 240);
  await page.keyboard.up("Control");
  await expect.poll(() => cameraTransform(page)).not.toBe(before);
});

test("dragging a node does not pan the camera", async ({ page }) => {
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const startBox = await nodeB.boundingBox();
  const before = await cameraTransform(page);
  await dragFromTo(
    page,
    { x: startBox!.x + 40, y: startBox!.y + 24 },
    { x: startBox!.x + 110, y: startBox!.y + 84 },
  );
  expect(await cameraTransform(page)).toBe(before);
  const endBox = await nodeB.boundingBox();
  expect(endBox!.x - startBox!.x).toBeGreaterThan(50);
});

test("dragging a connector line does not pan the camera", async ({ page }) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const before = await cameraTransform(page);
  // Drag a line out and drop it on empty canvas: no connection, no pan.
  const start = await centerOf(output);
  await dragFromTo(page, start, { x: start.x + 180, y: start.y + 140 });
  expect(await cameraTransform(page)).toBe(before);
  await expect(
    page.locator("[data-snapline-type='connector-line']"),
  ).toHaveCount(0);
});

test("connector drag edge-pans continuously and keeps the line under the pointer", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const start = await centerOf(output);
  const camera = page.locator("#node-ui-camera-canvas");
  const bounds = await camera.boundingBox();
  expect(bounds).not.toBeNull();
  const edge = {
    x: bounds!.x + bounds!.width - 8,
    y: Math.min(bounds!.y + bounds!.height - 80, start.y + 100),
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(edge.x, edge.y, { steps: 12 });
  const before = await cameraTransform(page);
  await expect.poll(() => cameraTransform(page)).not.toBe(before);

  const line = page.locator("[data-snapline-type='connector-line']");
  await expect(line).toHaveCount(1);
  const endpoint = await line.evaluate((svg) => {
    const rect = svg.getBoundingClientRect();
    const path = svg.querySelector("path")?.getAttribute("d") ?? "";
    const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const transform = new DOMMatrixReadOnly(getComputedStyle(svg).transform);
    const startPoint = new DOMPoint(
      numbers[0] ?? 0,
      numbers[1] ?? 0,
    ).matrixTransform(transform);
    const endPoint = new DOMPoint(
      numbers[6] ?? 0,
      numbers[7] ?? 0,
    ).matrixTransform(transform);
    const layoutOffsetX = rect.left - startPoint.x;
    const layoutOffsetY = rect.top - startPoint.y;
    return {
      x: endPoint.x + layoutOffsetX,
      y: endPoint.y + layoutOffsetY,
    };
  });
  expect(Math.abs(endpoint.x - edge.x)).toBeLessThan(8);
  expect(Math.abs(endpoint.y - edge.y)).toBeLessThan(8);

  await page.mouse.up();
  await expect(line).toHaveCount(0);
});

test("node drag edge-pans while the dragged node stays under the pointer", async ({
  page,
}) => {
  const nodeC = page.locator("[data-snapline-type='node']", {
    hasText: "Node C",
  });
  const startBox = await nodeC.boundingBox();
  const camera = page.locator("#node-ui-camera-canvas");
  const bounds = await camera.boundingBox();
  expect(startBox).not.toBeNull();
  expect(bounds).not.toBeNull();
  const start = { x: startBox!.x + 40, y: startBox!.y + 24 };
  const edge = {
    x: bounds!.x + bounds!.width - 8,
    y: Math.min(bounds!.y + bounds!.height - 60, start.y + 80),
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(edge.x, edge.y, { steps: 12 });
  const before = await cameraTransform(page);
  await expect.poll(() => cameraTransform(page)).not.toBe(before);
  const draggedBox = await nodeC.boundingBox();
  expect(edge.x - draggedBox!.x).toBeGreaterThan(20);
  expect(edge.x - draggedBox!.x).toBeLessThan(draggedBox!.width);
  expect(edge.y - draggedBox!.y).toBeGreaterThan(5);
  expect(edge.y - draggedBox!.y).toBeLessThan(draggedBox!.height);
  await page.mouse.up();
});

test("panButton='middle': middle-drag pans, left-drag does not", async ({
  page,
}) => {
  await page.goto("/snapline-camera?panButton=middle");
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });

  // Left-drag the background: with panButton='middle' this must NOT pan.
  const beforeLeft = await cameraTransform(page);
  await dragFromTo(page, { x: 900, y: 620 }, { x: 700, y: 470 }, "left");
  expect(await cameraTransform(page)).toBe(beforeLeft);

  // Middle-drag the background: this pans.
  const before = await nodeA.boundingBox();
  await dragFromTo(page, { x: 900, y: 620 }, { x: 700, y: 470 }, "middle");
  const after = await nodeA.boundingBox();
  expect(after!.x - before!.x).toBeLessThan(-150);
  expect(after!.y - before!.y).toBeLessThan(-100);
});

test("wheelPan: unmodified wheel pans, ctrl+wheel still zooms", async ({
  page,
}) => {
  await page.goto("/snapline-camera?wheelPan=1");
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });

  // Two-finger scroll (an unmodified wheel with deltaX/deltaY) pans the camera:
  // a downward + rightward scroll pans the view down/right, so nodes shift up/left.
  const before = await nodeA.boundingBox();
  await page.mouse.move(640, 450);
  await page.mouse.wheel(160, 200);
  await expect
    .poll(async () => (await nodeA.boundingBox())!.y - before!.y)
    .toBeLessThan(-80);
  const after = await nodeA.boundingBox();
  expect(after!.x - before!.x).toBeLessThan(-60);

  // A ctrl+wheel over the same surface still zooms rather than panning (scroll
  // down zooms out from the starting max zoom).
  const beforeZoom = await cameraTransform(page);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 240);
  await page.keyboard.up("Control");
  await expect.poll(() => cameraTransform(page)).not.toBe(beforeZoom);
});

test("ctrl+wheel direction: scroll down / pinch in zooms out, scroll up / pinch out zooms in", async ({
  page,
}) => {
  await page.mouse.move(640, 450);
  // Starts at max zoom (1), so first zoom out (scroll down / pinch in): scale drops.
  const base = await cameraScale(page);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 40);
  await page.keyboard.up("Control");
  await expect.poll(() => cameraScale(page)).toBeLessThan(base);

  // Now scroll up / pinch out zooms back in: scale rises — the natural direction.
  const zoomedOut = await cameraScale(page);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -40);
  await page.keyboard.up("Control");
  await expect.poll(() => cameraScale(page)).toBeGreaterThan(zoomedOut);
});

test("connecting after pan and zoom still lands on the target connector", async ({
  page,
}) => {
  await dragFromTo(page, { x: 900, y: 620 }, { x: 780, y: 540 });
  await page.mouse.move(640, 450);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 120);
  await page.keyboard.up("Control");

  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");
  await dragFromTo(page, await centerOf(output), await centerOf(input));

  const line = page.locator("[data-snapline-type='connector-line']");
  await expect(line).toHaveCount(1);
  await expect(line.locator("path")).toHaveAttribute("d", /C/);
});

test("wheel does not pan or zoom the camera mid node-drag (pointer claim blocks it)", async ({
  page,
}) => {
  await page.goto("/snapline-camera?wheelPan=1");
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const startBox = await nodeA.boundingBox();

  // Hold a node drag, then wheel: the claim must suppress the camera globally.
  await page.mouse.move(startBox!.x + 40, startBox!.y + 24);
  await page.mouse.down();
  await page.mouse.move(startBox!.x + 90, startBox!.y + 60, { steps: 8 });
  const midDrag = await cameraTransform(page);
  await page.mouse.wheel(120, 160);
  await page.waitForTimeout(120);
  expect(await cameraTransform(page)).toBe(midDrag);
  await page.mouse.up();

  // After the gesture ends the claim auto-releases: wheel pans again.
  await page.mouse.move(900, 620);
  const atRest = await cameraTransform(page);
  await page.mouse.wheel(120, 160);
  await expect.poll(() => cameraTransform(page)).not.toBe(atRest);
});
