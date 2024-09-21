/**
 * Framework-agnostic tests for SnapLine.
 */
import { test, expect, Locator, Page } from "@playwright/test";

const port = 3001;

// Given a CSS selector and a location on the screen, find the element at that location.
// It is considered a match if the top left corner of the element is at the location.
// If there are multiple elements that match, the first one is returned.
async function findElementAtLocation(page: Page, selector: string, x: number, y: number, threshold:number = 10){
  const element = page.locator(selector);
  let match: Locator | null = null;
  for (let i = 0; i < await element.count(); i++) {
    const e = element.nth(i);
    const location = await e.boundingBox();
    if (location && Math.abs(location.x - x) < threshold && Math.abs(location.y - y) < threshold) {
      match = e;
    }
  }
  return match;
}

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

test.describe("Test connecting nodes.", () => {
  test("Should be able to connect two nodes", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    const node1 = page.locator("[data-snapline-class='math']");
    const node2 = page.locator("[data-snapline-class='print']");
    const mathOutput = node1.locator("[data-snapline-type='connector'].right");
    const printInput = node2.locator("[data-snapline-type='connector'].left");

    const mathOutputLocation = await mathOutput.boundingBox();
    const printInputLocation = await printInput.boundingBox();

    await mathOutput.hover();
    await page.mouse.down();
    await page.mouse.move(printInputLocation!.x + printInputLocation!.width / 2, printInputLocation!.y + printInputLocation!.height / 2, { steps: 10 });
    await page.mouse.up();

    let svg = await findElementAtLocation(page, "svg", mathOutputLocation!.x, mathOutputLocation!.y);
    await expect(svg).not.toBeNull();

    let line = svg!.locator("line");
    await expect(line).toHaveCount(1);
    let lineLocation = await line.boundingBox();
    await expect(lineLocation).not.toBeNull();
    await expect(lineLocation!.width).toBeCloseTo(printInputLocation!.x - mathOutputLocation!.x, -2);
    await expect(lineLocation!.height).toBeCloseTo(printInputLocation!.y - mathOutputLocation!.y, -2);

    // Test disconnecting the line
    await printInput.hover(); 
    await page.mouse.down();
    // Move to a location 200px above the math input
    await page.mouse.move(printInputLocation!.x + printInputLocation!.width / 2, printInputLocation!.y + 200, { steps: 10 });
    
    // The line should start from the number output and end at 200 px above the math input
    svg = await findElementAtLocation(page, "svg", mathOutputLocation!.x, mathOutputLocation!.y);
    await expect(svg).not.toBeNull();

    line = svg!.locator("line");
    await expect(line).toHaveCount(1);
    lineLocation = await line.boundingBox();
    await expect(lineLocation).not.toBeNull();
    await expect(lineLocation!.width).toBeCloseTo(Math.abs(mathOutputLocation!.x - printInputLocation!.x), -2);
    await expect(lineLocation!.height).toBeCloseTo(Math.abs(mathOutputLocation!.y - printInputLocation!.y + 200), -2);
  });

});

test.describe("Test dragging a line.", () => {
  test("Should be able to drag out a line", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    const node1 = page.locator("[data-snapline-class='math']");
    const node2 = page.locator("[data-snapline-class='print']");

    const mathOutput = node1.locator("[data-snapline-type='connector'].right");
    const printInput = node2.locator("[data-snapline-type='connector'].left");

    const mathOutputLocation = await mathOutput.boundingBox();
    const printInputLocation = await printInput.boundingBox();

    await mathOutput.hover();
    await page.mouse.down();
    await page.mouse.move(mathOutputLocation!.x + 100, mathOutputLocation!.y + 100, { steps: 10 });

    const svg = await findElementAtLocation(page, "svg", mathOutputLocation!.x, mathOutputLocation!.y);
    await expect(svg).not.toBeNull();

    const line = svg!.locator("line");
    await expect(line).toHaveCount(1);
    const lineLocation = await line.boundingBox();
    await expect(lineLocation).not.toBeNull();
    await expect(lineLocation!.width).toBeCloseTo(100, -2);
    await expect(lineLocation!.height).toBeCloseTo(100, -2);
  });


  test("Should be able to drag out a line and not connect to anything", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    const node1 = page.locator("[data-snapline-class='math']");
    const node1Output = node1.locator("[data-snapline-type='connector'].right");
    const node1OutputLocation = await node1Output.boundingBox();
    await node1Output.hover();
    await page.mouse.down();
   // Move mouse 100px up 
   await page.mouse.move(
    node1OutputLocation!.x + node1OutputLocation!.width / 2,
    node1OutputLocation!.y - 100,
    { steps: 10 }
   );
   await page.mouse.up();

   const svgs = page.locator("svg");
   await expect(svgs).toHaveCount(2);
   
  });
});
