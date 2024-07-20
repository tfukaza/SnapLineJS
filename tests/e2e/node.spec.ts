/**
 * Framework-agnostic tests for SnapLine.
 */
import { test, expect } from "@playwright/test";

const port = 3001;

test.describe("Check that the demo site loads the expected nodes after startup.", () => {
  test("There should be 4 nodes: 2 number nodes, 1 math node, and 1 print node.", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}`);
    const nodes = page.locator(".sl-node");
    await expect(nodes).toHaveCount(4);

    const constantNodes = page.locator("div[data-snapline-name='number']");
    await expect(constantNodes).toHaveCount(2);

    const mathNodes = page.locator("div[data-snapline-name='math']");
    await expect(mathNodes).toHaveCount(1);

    const printNodes = page.locator("div[data-snapline-name='print']");
    await expect(printNodes).toHaveCount(1);
  });

  test("Math node should have 2 input connectors and 1 output connector.", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}`);
    const connectors = page.locator(
      "div[data-snapline-name='math'] .sl-connector",
    );
    await expect(connectors).toHaveCount(3);
  });
});

test.describe("Test the basic interactions with nodes.", () => {
  test.beforeAll(async () => {});

  test("Should be able to press and select a node", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    const node = page.locator("div[data-snapline-name='math']");
    await node.click();
    await expect(node).toHaveClass("sl-focus");
  });

  test("Should be able to press and drag a node", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    const node = page.locator("div[data-snapline-name='math']");
    const nodeStart = await node.boundingBox();
    await node.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100, { steps: 10 });
    await page.mouse.up();

    const nodeEnd = await node.boundingBox();

    await expect(nodeStart).not.toEqual(nodeEnd);
    await expect(nodeEnd!.x - nodeStart!.x).toBeCloseTo(100);
    await expect(nodeEnd!.y - nodeStart!.y).toBeCloseTo(100);
  });
});
