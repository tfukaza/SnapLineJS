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

async function counts(page: Page) {
  return {
    connect: Number(await page.getByTestId("connect-intents").textContent()),
    disconnect: Number(
      await page.getByTestId("disconnect-intents").textContent(),
    ),
    edges: Number(await page.getByTestId("edge-count").textContent()),
    lines: await page.locator(LINE).count(),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapline-edges");
  await expect(connectorOf(page, "Node A", "output")).toBeVisible();
});

test("gesture connect emits one intent and the accepted line survives sync", async ({ page }) => {
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node A", "output")),
    await centerOf(connectorOf(page, "Node B", "input")),
  );
  await expect(page.getByTestId("connect-intents")).toHaveText("1");
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  await expect(page.locator(LINE)).toHaveCount(1);
  // Two frames later the reconciled line is still the doc's line.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(page.locator(LINE)).toHaveCount(1);
  expect((await counts(page)).disconnect).toBe(0);
});

test("gesture disconnect emits one intent and the doc drops the edge", async ({ page }) => {
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node A", "output")),
    await centerOf(connectorOf(page, "Node B", "input")),
  );
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  // Pick the line up from the occupied input and drop it on empty canvas.
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node B", "input")),
    { x: 900, y: 700 },
  );
  await expect(page.getByTestId("disconnect-intents")).toHaveText("1");
  await expect(page.getByTestId("edge-count")).toHaveText("0");
  await expect(page.locator(LINE)).toHaveCount(0);
});

test("programmatic edge add and remove sync lines with zero intents", async ({ page }) => {
  await page.getByTestId("add-edge").click();
  await expect(page.locator(LINE)).toHaveCount(1);
  await page.getByTestId("remove-edge").click();
  await expect(page.locator(LINE)).toHaveCount(0);
  const result = await counts(page);
  expect(result.connect).toBe(0);
  expect(result.disconnect).toBe(0);
});

test("full input replaces via ONE atomic request the document applies", async ({ page }) => {
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
  const log = (await page.getByTestId("intent-log").textContent()) ?? "";
  expect(log).toBe("connect:a->b|replace:-a->b+c->b");
});

test("rejected gesture connect leaves no line after re-sync and no paint flicker on accept", async ({ page }) => {
  // Arm a per-frame observer that records the line count on every rAF.
  await page.evaluate(() => {
    const win = window as unknown as { __lineCounts?: number[]; __stop?: boolean };
    win.__lineCounts = [];
    const tick = () => {
      if (win.__stop) return;
      win.__lineCounts!.push(
        document.querySelectorAll("[data-snapline-type='connector-line']").length,
      );
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Accepted connect: once a frame shows the line, no later frame may lose it.
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node A", "output")),
    await centerOf(connectorOf(page, "Node B", "input")),
  );
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  await page.waitForTimeout(150);
  const accepted = await page.evaluate(() => {
    const win = window as unknown as { __lineCounts?: number[] };
    return win.__lineCounts!.slice();
  });
  const firstConnected = accepted.indexOf(1);
  expect(firstConnected).toBeGreaterThanOrEqual(0);
  expect(accepted.slice(firstConnected)).not.toContain(0);

  // Rejected connect: consumer ignores the intent; the line must reconcile away.
  await page.getByTestId("reject-connects").click();
  await dragFromTo(
    page,
    await centerOf(connectorOf(page, "Node A", "output")),
    await centerOf(connectorOf(page, "Node C", "input")),
  );
  await expect(page.getByTestId("connect-intents")).toHaveText("2");
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  await expect(page.locator(LINE)).toHaveCount(1);
});

test("node unmount emits zero intents and clears its lines", async ({ page }) => {
  await page.getByTestId("add-edge").click(); // programmatic A->C
  await expect(page.locator(LINE)).toHaveCount(1);
  await page.getByTestId("show-node-c").click();
  await expect(page.locator(LINE)).toHaveCount(0);
  const result = await counts(page);
  expect(result.connect).toBe(0);
  expect(result.disconnect).toBe(0);
  // The doc still holds the edge; remounting the node re-hydrates its line.
  await expect(page.getByTestId("edge-count")).toHaveText("1");
  await page.getByTestId("show-node-c").click();
  await expect(page.locator(LINE)).toHaveCount(1);
});

test("doc changes mid-drag do not destroy the in-flight drag line", async ({ page }) => {
  const from = await centerOf(connectorOf(page, "Node A", "output"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y + 80, { steps: 6 });
  // Mutate the doc while the drag line (no target yet) is alive — via the
  // window hook, so a second pointer interaction doesn't break the gesture.
  await page.evaluate(() =>
    (window as unknown as { __addTestEdge: () => void }).__addTestEdge(),
  );
  await page.mouse.move(from.x + 140, from.y + 90, { steps: 2 });
  // Drag preview line + hydrated A->C line coexist.
  await expect(page.locator(LINE)).toHaveCount(2);
  await page.mouse.up();
  // Dropped on empty canvas: preview discarded, doc line remains.
  await expect(page.locator(LINE)).toHaveCount(1);
  await expect(page.getByTestId("edge-count")).toHaveText("1");
});
