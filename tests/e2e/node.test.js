/**
 * Framework-agnostic tests for SnapLine.
 */

const hyperparameter = [
  ["Vanilla Js", 3001],
  ["React", 3002],
];

describe("Check that the demo site loads the expected nodes after startup.", () => {
  it.each(hyperparameter)(
    "[%s, %i] should have a 4 div that has data attribute 'snapline-type' = 'node'",
    async (name, port) => {
      await page.goto(`http://localhost:${port}`);
      const nodes = await page.$$("div[data-snapline-type='node']");
      expect(nodes.length).toBe(4);
    },
  );
});

describe("Test the basic interactions with nodes.", () => {
  beforeAll(async () => {
    for (const [name, port] of hyperparameter) {
      await page.goto(`http://localhost:${port}`);
    }
  });

  it.each(hyperparameter)(
    "[%s, %i] should be able to press and select a node",
    async (name, port) => {
      await page.goto(`http://localhost:${port}`);
      const node = await page.$("div[data-snapline-type='node']");
      expect(node).not.toBeNull();
      await node.click();
      const selected = await node.evaluate((node) =>
        node.classList.contains("sl-focus"),
      );
      expect(selected).toBe(true);
    },
  );

  it.each(hyperparameter)(
    "[%s, %i] should be able to press and drag a node",
    async (name, port) => {
      await page.goto(`http://localhost:${port}`);
      const node = await page.waitForSelector("div[data-snapline-type='node']");
      expect(node).not.toBeNull();

      let { startX, startY } = await page.evaluate((el) => {
        const { x, y } = el.getBoundingClientRect();
        return { startX: x, startY: y };
      }, node);

      await page.mouse.move(startX + 10, startY + 10);
      await page.mouse.down();
      await page.mouse.move(startX + 20, startY + 20);
      await page.mouse.up();

      const { endX, endY } = await page.evaluate((el) => {
        const { x, y } = el.getBoundingClientRect();
        return { endX: x, endY: y };
      }, node);

      expect(endX - startX).toBeCloseTo(10);
      expect(endY - startY).toBeCloseTo(10);
    },
  );
});
