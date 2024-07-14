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

// describe("Demo website should have 3 lines connecting 4 nodes", () => {
//   beforeAll(async () => {
//     await page.goto("http://localhost:3001");
//   });

//   it('should have svgs that has data attribute "snapline-type" = "line"', async () => {
//     const lines = await page.$$("svg[data-snapline-type='line']");
//     expect(lines.length).toBe(3);
//   });
// });
