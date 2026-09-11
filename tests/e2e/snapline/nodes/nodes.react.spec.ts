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

async function lineEndpoints(page: Page) {
  return page
    .locator("[data-snapline-type='connector-line']")
    .evaluate((svg) => {
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

function expectPointCloseTo(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  tolerance = 3,
) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the React SnapLine demo nodes and connectors", async ({
  page,
}) => {
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
  await expect(page.locator("[data-snapline-type='connector']")).toHaveCount(6);
  await expect(page.locator("[data-snapline-type='selection']")).toHaveCount(1);
});

test("connects two React SnapLine nodes", async ({ page }) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Node A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Node B",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");

  await dragFromTo(page, await centerOf(output), await centerOf(input));

  await expect(
    page.locator("[data-snapline-type='connector-line']"),
  ).toHaveCount(1);
});

test("keeps a React line endpoint aligned while the target node is moving", async ({
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
