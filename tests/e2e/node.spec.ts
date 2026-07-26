import { expect, test, type Locator, type Page } from "@playwright/test";

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
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function waitForAnimationFrame(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function endpointsOf(line: Locator) {
  return line.evaluate((svg) => {
    const rect = svg.getBoundingClientRect();
    const transform = new DOMMatrixReadOnly(getComputedStyle(svg).transform);
    const path = svg.querySelector("path");
    const numbers =
      path
        ?.getAttribute("d")
        ?.match(/-?\d+(?:\.\d+)?/g)
        ?.map(Number) ?? [];
    const startPoint = new DOMPoint(numbers[0] ?? 0, numbers[1] ?? 0);
    const endPoint = new DOMPoint(numbers[6] ?? 0, numbers[7] ?? 0);
    const transformedStart = startPoint.matrixTransform(transform);
    const transformedEnd = endPoint.matrixTransform(transform);
    const layoutOffsetX = rect.left - transformedStart.x;
    const layoutOffsetY = rect.top - transformedStart.y;
    return {
      start: {
        x: transformedStart.x + layoutOffsetX,
        y: transformedStart.y + layoutOffsetY,
      },
      end: {
        x: transformedEnd.x + layoutOffsetX,
        y: transformedEnd.y + layoutOffsetY,
      },
    };
  });
}

async function lineEndpoints(page: Page) {
  return endpointsOf(page.locator("[data-snapline-type='connector-line']"));
}

function expectPointCloseTo(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  tolerance = 3,
) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapline");
});

test("renders the simple SnapLine demo nodes and connectors", async ({
  page,
}) => {
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
  await expect(page.locator("[data-snapline-type='connector']")).toHaveCount(6);
  await expect(page.locator("[data-snapline-type='selection']")).toHaveCount(1);
});

test("selects and drags a node", async ({ page }) => {
  const node = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const startBox = await node.boundingBox();
  expect(startBox).not.toBeNull();

  await page.mouse.click(startBox!.x + 24, startBox!.y + 24);
  await expect(node).toHaveAttribute("data-snapline-state", "focus");

  await dragFromTo(
    page,
    { x: startBox!.x + 40, y: startBox!.y + 24 },
    { x: startBox!.x + 110, y: startBox!.y + 84 },
  );

  const endBox = await node.boundingBox();
  expect(endBox).not.toBeNull();
  expect(endBox!.x - startBox!.x).toBeGreaterThan(65);
  expect(endBox!.x - startBox!.x).toBeLessThan(75);
  expect(endBox!.y - startBox!.y).toBeGreaterThan(55);
  expect(endBox!.y - startBox!.y).toBeLessThan(65);
});

test("a node follows the pointer live on repeated drags", async ({ page }) => {
  const node = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const first = await node.boundingBox();
  expect(first).not.toBeNull();

  await dragFromTo(
    page,
    { x: first!.x + 40, y: first!.y + 24 },
    { x: first!.x + 90, y: first!.y + 64 },
  );

  const settled = await node.boundingBox();
  expect(settled).not.toBeNull();
  await page.mouse.move(settled!.x + 40, settled!.y + 24);
  await page.mouse.down();
  await page.mouse.move(settled!.x + 120, settled!.y + 84, { steps: 8 });
  await waitForAnimationFrame(page);

  const live = await node.boundingBox();
  expect(live).not.toBeNull();
  expect(live!.x - settled!.x).toBeGreaterThan(65);
  expect(live!.y - settled!.y).toBeGreaterThan(45);
  await page.mouse.up();
});

test("connects an output connector to an input connector", async ({ page }) => {
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

test("clicking an output connector does not create a preview line", async ({
  page,
}) => {
  const output = page
    .locator("[data-snapline-type='node']", { hasText: "Node A" })
    .locator("[data-snapline-name='output']");

  const outputCenter = await centerOf(output);
  await page.mouse.click(outputCenter.x, outputCenter.y);

  await expect(page.locator("[data-snapline-type='connector-line']")).toHaveCount(
    0,
  );
});

test("clicking an occupied input does not disconnect its line", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");

  await dragFromTo(page, await centerOf(output), await centerOf(input));
  await expect(page.locator("[data-snapline-type='connector-line']")).toHaveCount(
    1,
  );

  const inputCenter = await centerOf(input);
  await page.mouse.click(inputCenter.x, inputCenter.y);

  const line = page.locator("[data-snapline-type='connector-line']");
  await expect(line).toHaveCount(1);
  expectPointCloseTo((await endpointsOf(line)).end, inputCenter);
});

test("reconnects an occupied input line after the drag threshold", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const nodeC = page.locator("[data-snapline-type='node']", {
    hasText: "Node C",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const inputB = nodeB.locator("[data-snapline-name='input']");
  const inputC = nodeC.locator("[data-snapline-name='input']");

  await dragFromTo(page, await centerOf(output), await centerOf(inputB));
  await dragFromTo(page, await centerOf(inputB), await centerOf(inputC));

  const line = page.locator("[data-snapline-type='connector-line']");
  await expect(line).toHaveCount(1);
  expectPointCloseTo((await endpointsOf(line)).end, await centerOf(inputC));
});

test("replaces the oldest line when a finite input is full", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const nodeC = page.locator("[data-snapline-type='node']", {
    hasText: "Node C",
  });
  const input = nodeB.locator("[data-snapline-name='input']");
  const outputA = nodeA.locator("[data-snapline-name='output']");
  const outputC = nodeC.locator("[data-snapline-name='output']");

  await dragFromTo(page, await centerOf(outputA), await centerOf(input));
  await expect(page.locator("[data-snapline-type='connector-line']")).toHaveCount(
    1,
  );

  await dragFromTo(page, await centerOf(outputC), await centerOf(input));
  const lines = page.locator("[data-snapline-type='connector-line']");
  await expect(lines).toHaveCount(1);

  const endpoints = await lineEndpoints(page);
  expectPointCloseTo(endpoints.start, await centerOf(outputC));
  expectPointCloseTo(endpoints.end, await centerOf(input));
});

test("evicts only the oldest lines needed for a larger finite capacity", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const nodeC = page.locator("[data-snapline-type='node']", {
    hasText: "Node C",
  });
  const input = nodeC.locator("[data-snapline-name='input']");
  const outputA = nodeA.locator("[data-snapline-name='output']");
  const outputB = nodeB.locator("[data-snapline-name='output']");
  const outputC = nodeC.locator("[data-snapline-name='output']");
  const lines = page.locator("[data-snapline-type='connector-line']");

  await dragFromTo(page, await centerOf(outputA), await centerOf(input));
  await dragFromTo(page, await centerOf(outputB), await centerOf(input));
  await expect(lines).toHaveCount(2);

  await dragFromTo(page, await centerOf(outputC), await centerOf(input));
  await expect(lines).toHaveCount(2);

  const endpoints = await Promise.all([
    endpointsOf(lines.nth(0)),
    endpointsOf(lines.nth(1)),
  ]);
  const expectedStarts = await Promise.all([centerOf(outputB), centerOf(outputC)]);
  for (const endpoint of endpoints) {
    expectPointCloseTo(endpoint.end, await centerOf(input));
  }
  for (const expectedStart of expectedStarts) {
    expect(
      endpoints.some(
        ({ start }) =>
          Math.abs(start.x - expectedStart.x) <= 3 &&
          Math.abs(start.y - expectedStart.y) <= 3,
      ),
    ).toBe(true);
  }
});

test("keeps a line endpoint aligned while the target node is moving", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");

  await dragFromTo(page, await centerOf(output), await centerOf(input));

  const nodeBBox = await nodeB.boundingBox();
  expect(nodeBBox).not.toBeNull();
  await page.mouse.move(nodeBBox!.x + 40, nodeBBox!.y + 24);
  await page.mouse.down();
  await page.mouse.move(nodeBBox!.x + 150, nodeBBox!.y + 84, { steps: 8 });
  await waitForAnimationFrame(page);

  const endpoints = await lineEndpoints(page);
  expectPointCloseTo(endpoints.end, await centerOf(input));

  await page.mouse.up();
});

test("keeps a line start aligned while the source node is moving", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");

  await dragFromTo(page, await centerOf(output), await centerOf(input));

  const nodeABox = await nodeA.boundingBox();
  expect(nodeABox).not.toBeNull();
  await page.mouse.move(nodeABox!.x + 40, nodeABox!.y + 24);
  await page.mouse.down();
  await page.mouse.move(nodeABox!.x + 150, nodeABox!.y + 84, { steps: 8 });
  await waitForAnimationFrame(page);

  const endpoints = await lineEndpoints(page);
  expectPointCloseTo(endpoints.start, await centerOf(output));

  await page.mouse.up();
});

test("disconnects a line by picking it up from the input connector", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");
  const inputCenter = await centerOf(input);

  await dragFromTo(page, await centerOf(output), inputCenter);
  await expect(page.locator("[data-snapline-type='connector-line']")).toHaveCount(
    1,
  );

  await dragFromTo(page, inputCenter, {
    x: inputCenter.x + 180,
    y: inputCenter.y + 120,
  });

  await expect(page.locator("[data-snapline-type='connector-line']")).toHaveCount(
    0,
  );
});

test("drops an output drag without creating a line when there is no target", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const outputCenter = await centerOf(
    nodeA.locator("[data-snapline-name='output']"),
  );

  await dragFromTo(
    page,
    outputCenter,
    { x: outputCenter.x + 160, y: outputCenter.y - 120 },
  );

  await expect(page.locator("[data-snapline-type='connector-line']")).toHaveCount(
    0,
  );
});

test("selects nodes with the rectangle selector", async ({ page }) => {
  const background = page.locator("#sl-background");
  const box = await background.boundingBox();
  expect(box).not.toBeNull();

  await dragFromTo(
    page,
    { x: box!.x + 40, y: box!.y + 40 },
    { x: box!.x + 760, y: box!.y + 560 },
  );

  await expect(
    page.locator("[data-snapline-type='node'][data-selected='true']"),
  ).toHaveCount(3);
});
