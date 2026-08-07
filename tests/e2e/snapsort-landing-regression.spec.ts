import { expect, test, type Locator, type Page } from "@playwright/test";

async function directItemKeys(container: Locator): Promise<string[]> {
  return container.evaluate((element) =>
    Array.from(element.children)
      .filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement &&
          child.classList.contains("snapsort-item"),
      )
      .map(
        (child) =>
          child.dataset.snapsortItemId ??
          child.innerText.replace(/\s+/g, " ").trim(),
      ),
  );
}

async function expectFrameworkOrder(container: Locator, order: string[]) {
  const frameworkOrder = await container.getAttribute("data-order");
  if (frameworkOrder !== null) {
    expect(order).toEqual(frameworkOrder ? frameworkOrder.split(",") : []);
  }
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (!value) throw new Error("Expected a visible drag target.");
  return value;
}

function watchSnapSortProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      message.text().includes("SnapSort")
    ) {
      problems.push(message.text());
    }
  });
  return problems;
}

async function reorderDirectItems(
  page: Page,
  container: Locator,
  sourceIndex: number,
  targetIndex: number,
  options: { handle?: string; settleMs?: number } = {},
): Promise<string[]> {
  const before = await directItemKeys(container);
  const items = container.locator(":scope > .snapsort-item");
  const sourceItem = items.nth(sourceIndex);
  const pointerTarget = options.handle
    ? sourceItem.locator(options.handle).first()
    : sourceItem;
  const targetItem = items.nth(targetIndex);
  const sourceBox = await box(pointerTarget);
  const targetBox = await box(targetItem);
  const start = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  };
  const movingDown = targetIndex > sourceIndex;
  const end = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height * (movingDown ? 0.82 : 0.18),
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 7, start.y + 7);

  const ghost = container.locator(
    ':scope > [data-snapsort-ghost-entry="flow"]',
  );
  await expect(ghost).toHaveCount(1);

  // Creating the next framework-owned ghost must never reconcile the list
  // back to an older source-array order.
  expect(await directItemKeys(container)).toEqual(before);
  await expectFrameworkOrder(container, before);

  const dragging = page.locator("[data-snapsort-dragging]");
  await expect(dragging).toHaveCount(1);
  await expect(dragging).toHaveCSS("position", "absolute");
  await expect(dragging).toHaveCSS("z-index", "1000");

  const sampledCenters: Array<{ x: number; y: number }> = [];
  for (let step = 1; step <= 14; step++) {
    const t = step / 14;
    await page.mouse.move(
      start.x + (end.x - start.x) * t,
      start.y + (end.y - start.y) * t,
    );
    if (step % 4 === 0) {
      const current = await box(dragging);
      sampledCenters.push({
        x: current.x + current.width / 2,
        y: current.y + current.height / 2,
      });
    }
  }

  expect(sampledCenters.length).toBeGreaterThan(1);
  for (let index = 1; index < sampledCenters.length; index++) {
    const previous = sampledCenters[index - 1];
    const current = sampledCenters[index];
    expect(
      Math.hypot(current.x - previous.x, current.y - previous.y),
    ).toBeGreaterThan(4);
  }

  await page.mouse.up();
  await page.waitForTimeout(options.settleMs ?? 140);
  await expect(ghost).toHaveCount(0);
  await expect(page.locator("[data-snapsort-dragging]")).toHaveCount(0);

  const after = await directItemKeys(container);
  expect(after).not.toEqual(before);
  await expectFrameworkOrder(container, after);
  return after;
}

test.describe("SnapSort landing repeated-drag ownership", () => {
  test("keeps the sortable list responsive and ordered through repeated drags", async ({
    page,
  }) => {
    const problems = watchSnapSortProblems(page);
    await page.goto("/snapsort", { waitUntil: "networkidle" });
    const list = page.locator(".sortable-list");
    await list.scrollIntoViewIfNeeded();
    await expect(list.locator(":scope > .snapsort-item")).toHaveCount(6);

    for (let drag = 0; drag < 5; drag++) {
      const down = drag % 2 === 0;
      await reorderDirectItems(page, list, down ? 0 : 5, down ? 5 : 0, {
        // Start the next gesture immediately after the configured 100ms FLIP
        // window to exercise cleanup without hiding it behind long waits.
        settleMs: 105,
      });
    }
    expect(problems).toEqual([]);
  });

  test("keeps the hero framework order authoritative on every gesture", async ({
    page,
  }) => {
    const problems = watchSnapSortProblems(page);
    await page.goto("/snapsort", { waitUntil: "networkidle" });
    const hero = page.locator(".hero-stack").first();
    await expect(hero.locator(":scope > .snapsort-item")).toHaveCount(3);

    for (let drag = 0; drag < 4; drag++) {
      const down = drag % 2 === 0;
      await reorderDirectItems(page, hero, down ? 0 : 2, down ? 2 : 0, {
        handle: ".hero-row-handle",
        settleMs: 105,
      });
    }
    expect(problems).toEqual([]);
  });

  test("keeps each themed mini-list interactive with independent state", async ({
    page,
  }) => {
    const problems = watchSnapSortProblems(page);
    await page.goto("/snapsort", { waitUntil: "networkidle" });
    const customizable = page.locator(".customizable-demo");
    await customizable.scrollIntoViewIfNeeded();
    await customizable.evaluate((element) => {
      const rail = element.querySelector<HTMLElement>(
        ".customizable-theme-rail",
      );
      rail?.style.setProperty("transform", "translateX(0)", "important");
      for (const frame of element.querySelectorAll<HTMLElement>(
        ".customizable-motion-frame",
      )) {
        frame.style.setProperty("transform", "translateY(0)", "important");
        frame.style.setProperty("transition", "none", "important");
      }
    });

    const retroList = page.locator(
      '.customizable-surface[data-theme="retro"] .customizable-mini-list',
    );
    const defaultList = page.locator(
      '.customizable-surface[data-theme="default"] .customizable-mini-list',
    );
    await retroList.scrollIntoViewIfNeeded();
    const defaultBefore = await directItemKeys(defaultList);

    for (let drag = 0; drag < 3; drag++) {
      const down = drag % 2 === 0;
      await reorderDirectItems(page, retroList, down ? 0 : 2, down ? 2 : 0, {
        settleMs: 105,
      });
    }

    expect(await directItemKeys(defaultList)).toEqual(defaultBefore);
    expect(problems).toEqual([]);
  });
});
