import { expect, test, type Locator, type Page } from "@playwright/test";

// SnapSort inside a zoomed Camera. Drop prediction, the flow spacer, and the
// wrapped-row simulation all run on measured boxes, so they must agree with
// the browser at every zoom.

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

function card(page: Page, id: string) {
  return page.locator(`[data-card-id="${id}"]`);
}

async function cardOrder(page: Page): Promise<string[]> {
  return page
    .locator(".camera-grid [data-card-id]")
    .evaluateAll((cards) =>
      cards.map((element) => element.getAttribute("data-card-id")!),
    );
}

/** On-screen scale of the camera layer, measured from a card. */
async function zoomOf(page: Page): Promise<number> {
  const width = (await card(page, "card-2").boundingBox())!.width;
  return width / 120;
}

async function zoomCamera(page: Page, wheelDeltaY: number) {
  const canvas = (await page.locator("#snapsort-camera-canvas").boundingBox())!;
  await page.mouse.move(canvas.x + 10, canvas.y + 10);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, wheelDeltaY);
  await page.keyboard.up("Control");
  await expect.poll(() => zoomOf(page)).not.toBeCloseTo(1, 2);
}

/**
 * Drag card 1 onto card 5's right half. Returns the flow spacer's authored
 * width and the grid's row lengths (by screen y) while the drag is held.
 */
async function dragCardOneOntoCardFive(page: Page) {
  const from = await centerOf(card(page, "card-1"));
  const target = (await card(page, "card-5").boundingBox())!;
  const to = {
    x: target.x + target.width * 0.75,
    y: target.y + target.height / 2,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 6, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.waitForTimeout(250);

  const held = await page.evaluate(() => {
    const ghost = document.querySelector<HTMLElement>(".camera-ghost");
    const entries = [
      ...document.querySelectorAll<HTMLElement>(".camera-grid > *"),
    ].filter(
      (element) =>
        element.classList.contains("camera-ghost") ||
        getComputedStyle(element).position !== "absolute",
    );
    const rows = new Map<number, number>();
    for (const element of entries) {
      const y = Math.round(element.getBoundingClientRect().y);
      rows.set(y, (rows.get(y) ?? 0) + 1);
    }
    return {
      spacerWidth: ghost?.style.width ?? null,
      rows: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n),
    };
  });

  await page.mouse.up();
  await expect(page.locator(".camera-ghost")).toHaveCount(0);
  return held;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/snapsort-camera");
  await expect(page.locator(".camera-grid [data-card-id]")).toHaveCount(8);
});

test("drags reorder the same way at zoom 1", async ({ page }) => {
  const held = await dragCardOneOntoCardFive(page);
  expect(held.spacerWidth).toBe("120px");
  expect(held.rows).toEqual([3, 3, 2]);
  expect(await cardOrder(page)).toEqual([
    "card-2",
    "card-3",
    "card-4",
    "card-5",
    "card-1",
    "card-6",
    "card-7",
    "card-8",
  ]);
});

for (const [direction, wheelDeltaY] of [
  ["out", 300],
  ["in", -300],
] as const) {
  test(`drags size the spacer and keep rows whole after zooming ${direction}`, async ({
    page,
  }) => {
    await zoomCamera(page, wheelDeltaY);
    const held = await dragCardOneOntoCardFive(page);

    // The spacer is authored in CSS pixels, which are world units here.
    expect(held.spacerWidth).toBe("120px");
    expect(held.rows).toEqual([3, 3, 2]);
    expect(await cardOrder(page)).toEqual([
      "card-2",
      "card-3",
      "card-4",
      "card-5",
      "card-1",
      "card-6",
      "card-7",
      "card-8",
    ]);
  });
}
