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
    const nodes = page.locator("[data-snapline-type='node']");
    await expect(nodes).toHaveCount(4);

    const constantNodes = page.locator("[data-snapline-class='number']");
    await expect(constantNodes).toHaveCount(2);

    const mathNodes = page.locator("[data-snapline-class='math']");
    await expect(mathNodes).toHaveCount(1);

    const printNodes = page.locator("[data-snapline-class='print']");
    await expect(printNodes).toHaveCount(1);
  });

  test("Math node should have 2 input connectors and 1 output connector.", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}`);
    const connectors = page.locator(
      "[data-snapline-class='math'] [data-snapline-type='connector']",
    );
    await expect(connectors).toHaveCount(3);
  });
});

test.describe("Test the basic interactions with nodes.", () => {
  test.beforeAll(async () => {});

  test("Should be able to press and select a node", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    const node = page.locator("[data-snapline-class='math']");
    await node.click();
    await expect(node).toHaveAttribute("data-snapline-state", "focus");
  });

  test("Should be able to press and drag a node", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    const node = page.locator("[data-snapline-class='math']");
    const nodeStart = await node.boundingBox();
    await node.hover();
    const mouseX = nodeStart!.x + nodeStart!.width / 2;
    const mouseY = nodeStart!.y + nodeStart!.height / 2;
    await page.mouse.down();
    await page.mouse.move(mouseX - 100, mouseY - 100, { steps: 10 });
    await page.mouse.up();

    const nodeEnd = await node.boundingBox();

    await expect(nodeStart).not.toEqual(nodeEnd);
    await expect(nodeEnd!.x - nodeStart!.x).toBeCloseTo(-100, 0);
    await expect(nodeEnd!.y - nodeStart!.y).toBeCloseTo(-100, 0);
  });
});
