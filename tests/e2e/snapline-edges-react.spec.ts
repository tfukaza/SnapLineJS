import { expect, test, type Locator, type Page } from "@playwright/test";

const LINE = "[data-snapline-type='connector-line']";

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
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

function connectorOf(page: Page, nodeTitle: string, port: "input" | "output") {
  return page
    .locator("[data-snapline-type='node']")
    .filter({ has: page.getByRole("heading", { name: nodeTitle, exact: true }) })
    .locator(`[data-snapline-name='${port}']`);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapline-edges");
  await expect(connectorOf(page, "Node A", "output")).toBeVisible();
});

test("react: gesture connect emits one intent and the line survives sync", async ({ page }) => {
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node A", "output")),
    await centerOf(connectorOf(page, "Node B", "input")),
  );
  await expect(page.getByTestId("connect-intents")).toHaveText("1");
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  await expect(page.locator(LINE)).toHaveCount(1);
});

test("react: programmatic edge add renders a line with zero intents", async ({ page }) => {
  await page.getByTestId("add-edge").click();
  await expect(page.locator(LINE)).toHaveCount(1);
  await expect(page.getByTestId("connect-intents")).toHaveText("0");
});

test("react: full input replaces via ONE atomic request", async ({ page }) => {
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node A", "output")),
    await centerOf(connectorOf(page, "Node B", "input")),
  );
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node C", "output")),
    await centerOf(connectorOf(page, "Node B", "input")),
  );
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  await expect(page.locator(LINE)).toHaveCount(1);
  await expect(page.getByTestId("intent-log")).toHaveText(
    "connect:a->b|replace:-a->b+c->b",
  );
});
