import { expect, test } from "@playwright/test";

type Rect = { x: number; y: number; width: number; height: number };

async function traceRectAnimation(
  page: import("@playwright/test").Page,
  selector: string,
  duration: number,
): Promise<Rect[]> {
  await page.evaluate(
    ({ selector, duration }) => {
      const trace = { done: false, frames: [] as Rect[] };
      (
        window as unknown as {
          __directMoveTrace: typeof trace;
        }
      ).__directMoveTrace = trace;
      const startedAt = performance.now();
      const sample = () => {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          trace.frames.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
        }
        if (performance.now() - startedAt < duration) {
          requestAnimationFrame(sample);
        } else {
          trace.done = true;
        }
      };
      requestAnimationFrame(sample);
    },
    { selector, duration },
  );

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                __directMoveTrace?: { done: boolean };
              }
            ).__directMoveTrace?.done ?? false,
        ),
      { timeout: duration + 1_000 },
    )
    .toBe(true);

  return page.evaluate(
    () =>
      (
        window as unknown as {
          __directMoveTrace: { frames: Rect[] };
        }
      ).__directMoveTrace.frames,
  );
}

test("direct movement animates the active item between candidate slots", async ({
  page,
}) => {
  await page.goto("/snapsort-keyboard", { waitUntil: "networkidle" });

  const outline = page.locator('[data-keyboard-handle="outline"]');
  const item = page.locator('[data-task-id="outline"]');
  await outline.focus();
  await page.keyboard.press("Enter");
  const source = await item.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });

  const framesPromise = traceRectAnimation(
    page,
    '[data-task-id="outline"]',
    260,
  );
  await page.keyboard.press("ArrowDown");
  const frames = await framesPromise;
  const final = frames.at(-1)!;
  const distinctY = new Set(frames.map((frame) => frame.y.toFixed(2)));

  expect(distinctY.size).toBeGreaterThan(3);
  expect(final.y).toBeGreaterThan(source.y + 20);
  expect(
    frames.some((frame) => frame.y > source.y + 1 && frame.y < final.y - 1),
  ).toBe(true);

  await page.keyboard.press("Escape");
});

test("direct movement interpolates destination width and height", async ({
  page,
}) => {
  await page.goto("/snapsort-keyboard?fixture=resize", {
    waitUntil: "networkidle",
  });

  const item = page.locator('[data-resize-card="resize-dragged"]');
  const source = await item.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  const framesPromise = traceRectAnimation(
    page,
    '[data-resize-card="resize-dragged"]',
    650,
  );
  await page.locator("[data-start-direct-resize]").click();
  const frames = await framesPromise;
  const final = frames.at(-1)!;

  expect(final.x).toBeGreaterThan(source.x + 100);
  expect(final.width).toBeLessThan(source.width - 80);
  expect(final.height).toBeGreaterThan(source.height + 30);
  expect(
    frames.some(
      (frame) =>
        frame.x > source.x + 1 &&
        frame.x < final.x - 1 &&
        frame.width < source.width - 1 &&
        frame.width > final.width + 1 &&
        frame.height > source.height + 1 &&
        frame.height < final.height - 1,
    ),
  ).toBe(true);
});

test("keyboard demo reorders, cancels, and preserves focus semantics", async ({
  page,
}) => {
  await page.goto("/snapsort-keyboard", { waitUntil: "networkidle" });

  const taskIds = () =>
    page
      .locator("[data-task-id]")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-task-id")),
      );
  const outline = page.locator('[data-keyboard-handle="outline"]');

  await expect(outline).toBeVisible();
  await outline.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-task-id="outline"]')).toHaveAttribute(
    "data-snapsort-dragging",
    "true",
  );

  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-keyboard-status]")).toContainText(
    "target position 2",
  );
  await page.keyboard.press("Enter");

  await expect
    .poll(taskIds)
    .toEqual(["prototype", "outline", "review", "polish", "ship"]);
  await expect(outline).toBeFocused();

  const orderBeforeCancel = await taskIds();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect.poll(taskIds).toEqual(orderBeforeCancel);
  await expect(outline).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-keyboard-handle="review"]')).toBeFocused();
  await expect.poll(taskIds).toEqual(orderBeforeCancel);
  await expect(page.locator('[data-task-id="outline"]')).not.toHaveAttribute(
    "data-snapsort-dragging",
    "true",
  );
});
