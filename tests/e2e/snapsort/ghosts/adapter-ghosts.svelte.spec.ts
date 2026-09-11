import { expect, test, type Locator, type Page } from "@playwright/test";
import { coreImportPath } from "../../shared/servers";

// Svelte-only because the React demo has no multi-item pointer-preview
// fixture; the other ghost-entry tests here also pass on React.

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected locator to have a bounding box.");
  return box;
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function demoBoxByHeading(page: Page, heading: string): Promise<Locator> {
  return page.locator(".demo-cell", {
    has: page.locator("h2", { hasText: heading }),
  });
}

async function itemByText(container: Locator, text: string): Promise<Locator> {
  return container.locator(".snapsort-item", { hasText: text }).first();
}

async function insertionListByHeading(
  page: Page,
  heading: string,
): Promise<Locator> {
  return page.locator(".insertion-list", {
    has: page.locator("h2", { hasText: heading }),
  });
}

test.describe("SnapSort adapter-rendered ghost entries", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
  });

  test("omitted direction renders a column layout", async ({ page }) => {
    const column = await demoBoxByHeading(page, "Vertical Column");
    await expect(column.locator(".snapsort-container").first()).toHaveCSS(
      "flex-direction",
      "column",
    );
  });

  test("single drag renders exactly one framework-owned ghost entry sized to the dragged item", async ({
    page,
  }) => {
    const column = await demoBoxByHeading(page, "Vertical Column");
    const item1 = await itemByText(column, "Item 1");
    const item1Box = await rect(item1);
    const item4 = await itemByText(column, "Item 4");
    const target = center(await rect(item4));
    const start = center(item1Box);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(60);
    await page.mouse.move(start.x, target.y + 30);
    await page.waitForTimeout(120);

    const ghostEntries = column.locator(
      '[data-snapsort-ghost-entry="target-spacer"]',
    );
    await expect(ghostEntries).toHaveCount(1);
    const ghostBox = await rect(ghostEntries.first());
    expect(Math.abs(ghostBox.width - item1Box.width)).toBeLessThan(2);
    expect(Math.abs(ghostBox.height - item1Box.height)).toBeLessThan(2);

    await page.mouse.up();
    await page.waitForTimeout(250);

    await expect(column.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    const order = await column
      .locator(".snapsort-item")
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(order).toEqual(["Item 2", "Item 3", "Item 4", "Item 1"]);
  });

  test("multi-select drag renders a contiguous run of framework-owned ghost entries", async ({
    page,
  }) => {
    const column = await demoBoxByHeading(page, "Vertical Column");
    const item2 = await itemByText(column, "Item 2");
    const item3 = await itemByText(column, "Item 3");
    await item2.click();
    await item3.click({ modifiers: ["Meta"] });

    const start = center(await rect(item2));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(60);
    await page.mouse.move(start.x, start.y + 120);
    await page.waitForTimeout(150);

    const ghostEntries = column.locator(
      '[data-snapsort-ghost-entry="target-spacer"]',
    );
    await expect(ghostEntries).toHaveCount(2);

    // Contiguous: the two ghost entries sit adjacent among the container's
    // rendered children (items + ghosts), with nothing else between them.
    const isContiguous = await column.evaluate((el) => {
      const container = el.querySelector(".snapsort-container")!;
      const children = [...container.children].filter(
        (child) =>
          child.classList.contains("snapsort-item") ||
          child.hasAttribute("data-snapsort-ghost-entry"),
      );
      const ghostIndices = children
        .map((n, i) => (n.hasAttribute("data-snapsort-ghost-entry") ? i : -1))
        .filter((i) => i !== -1);
      return (
        ghostIndices.length === 2 && ghostIndices[1] - ghostIndices[0] === 1
      );
    });
    expect(isContiguous).toBe(true);

    await page.mouse.up();
    await page.waitForTimeout(250);
    await expect(column.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    // The pair lands as a contiguous run.
    const order = await column
      .locator(".snapsort-item")
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(order).toEqual(["Item 1", "Item 4", "Item 2", "Item 3"]);
  });

  test("a multi-item preview uses one pointer Ghost while flow feedback keeps its target run", async ({
    page,
  }) => {
    const column = await demoBoxByHeading(page, "Vertical Column");
    const containerElement = column.locator(".snapsort-container").first();
    const item2 = await itemByText(column, "Item 2");
    const item3 = await itemByText(column, "Item 3");
    await item2.click();
    await item3.click({ modifiers: ["Meta"] });

    // Install the override after selection updates settle because Svelte's
    // adapter refreshes its callback wrapper when reactive config reruns.
    await page.evaluate(
      async ({ coreImportPath }) => {
        const { GlobalManager } = await import(coreImportPath);
        const cell = [...document.querySelectorAll(".demo-cell")].find(
          (element) =>
            element.querySelector("h2")?.textContent?.trim() ===
            "Vertical Column",
        );
        const element = cell?.querySelector(".snapsort-container");
        const containers =
          GlobalManager.getInstance().data.dragAndDropContainers ?? [];
        const container = containers.find(
          (candidate: any) => candidate.element === element,
        );
        if (!container) throw new Error("Could not find the Vertical Column.");
        const originalCallbacks = container.callbacks;
        const originalGhostInsert = originalCallbacks.onGhostInsert;
        const originalDragStart = originalCallbacks.onDragStart;
        (
          globalThis as typeof globalThis & {
            __snapsortPointerPreviewItemCounts?: number[];
          }
        ).__snapsortPointerPreviewItemCounts = [];
        container.callbacks = {
          ...originalCallbacks,
          onGhostInsert: (event: any) => {
            if (event.ghost.type === "pointer-preview") {
              (
                globalThis as typeof globalThis & {
                  __snapsortPointerPreviewItemCounts: number[];
                }
              ).__snapsortPointerPreviewItemCounts.push(
                event.ghost.items.length,
              );
            }
            originalGhostInsert?.(event);
          },
          onDragStart: (event: any) => {
            const result = originalDragStart?.(event);
            if (result === false) return false;
            event.session.dragVisual = "preview";
            return undefined;
          },
        };
      },
      { coreImportPath },
    );

    const start = center(await rect(item2));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(80);
    await page.mouse.move(start.x, start.y + 120, { steps: 12 });
    await page.waitForTimeout(120);

    await expect(page.locator('[data-snapsort-ghost="pointer"]')).toHaveCount(
      1,
    );
    await expect(
      containerElement.locator('[data-snapsort-ghost-entry="target-spacer"]'),
    ).toHaveCount(2);
    await expect(item2).not.toHaveCSS("position", "absolute");
    await expect(item3).not.toHaveCSS("position", "absolute");
    expect(
      await page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __snapsortPointerPreviewItemCounts?: number[];
            }
          ).__snapsortPointerPreviewItemCounts ?? [],
      ),
    ).toContain(2);

    await page.mouse.up();
    await page.waitForTimeout(250);
    await expect(page.locator('[data-snapsort-ghost="pointer"]')).toHaveCount(
      0,
    );
    await expect(column.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  });

  test("cross-container drag never leaves a stale ghost entry in the departed area", async ({
    page,
  }) => {
    const cell = await demoBoxByHeading(page, "Multiple Drop Areas");
    await cell.scrollIntoViewIfNeeded();
    const area1 = cell.locator(".snapsort-container").nth(1);
    const area2 = cell.locator(".snapsort-container").nth(2);

    const itemA = await itemByText(area1, "Item A");
    const start = center(await rect(itemA));
    const area2Target = center(await rect(await itemByText(area2, "Item Y")));

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(60);

    // Move partway into area 2 and confirm area 1 has already released its
    // ghost (the regression this spec exists to catch: flow-ghost.ts used to
    // silently detach a run anchor when it left a container, never firing
    // onGhostRemove there, which would leak a stale entry in per-container
    // adapter state).
    for (let step = 1; step <= 10; step++) {
      const t = step / 10;
      await page.mouse.move(
        start.x + (area2Target.x - start.x) * t,
        start.y + (area2Target.y - start.y) * t,
      );
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(80);

    await expect(area1.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    await expect(
      area2.locator('[data-snapsort-ghost-entry="target-spacer"]'),
    ).toHaveCount(1);

    await page.mouse.up();
    await page.waitForTimeout(250);

    await expect(area1.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    await expect(area2.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    await expect(area1.locator(".snapsort-item")).toHaveCount(2);
    await expect(area2.locator(".snapsort-item")).toHaveCount(4);

    // Reverse: drag the same item back from area 2 to area 1.
    const movedItem = await itemByText(area2, "Item A");
    const backStart = center(await rect(movedItem));
    const area1Target = center(await rect(await itemByText(area1, "Item B")));
    await page.mouse.move(backStart.x, backStart.y);
    await page.mouse.down();
    await page.mouse.move(backStart.x + 4, backStart.y + 4);
    await page.waitForTimeout(60);
    for (let step = 1; step <= 10; step++) {
      const t = step / 10;
      await page.mouse.move(
        backStart.x + (area1Target.x - backStart.x) * t,
        backStart.y + (area1Target.y - backStart.y) * t,
      );
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(80);

    await expect(area2.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    await expect(
      area1.locator('[data-snapsort-ghost-entry="target-spacer"]'),
    ).toHaveCount(1);

    await page.mouse.up();
    await page.waitForTimeout(250);
    await expect(area1.locator(".snapsort-item")).toHaveCount(3);
    await expect(area2.locator(".snapsort-item")).toHaveCount(3);
  });

  test("insertion marker has exactly one framework owner across repeated container crossings", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_insertion", { waitUntil: "networkidle" });
    const project = await insertionListByHeading(page, "Project");
    const source = await insertionListByHeading(page, "Source");
    const dragged = await itemByText(project, "README.md");
    const start = center(await rect(dragged));
    const projectTarget = center(
      await rect(await itemByText(project, "package.json")),
    );
    const sourceTarget = center(
      await rect(await itemByText(source, "Item.svelte")),
    );
    const allMarkers = page.locator(
      '[data-snapsort-ghost-entry="insertion-marker"]',
    );

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(80);
    await expect(allMarkers).toHaveCount(1);

    for (const target of [sourceTarget, projectTarget, sourceTarget]) {
      await page.mouse.move(target.x, target.y, { steps: 16 });
      await page.waitForTimeout(80);
      await expect(allMarkers).toHaveCount(1);
      const expectedOwner = target === sourceTarget ? source : project;
      const departedOwner = target === sourceTarget ? project : source;
      await expect(
        expectedOwner.locator('[data-snapsort-ghost-entry="insertion-marker"]'),
      ).toHaveCount(1);
      await expect(
        departedOwner.locator('[data-snapsort-ghost-entry="insertion-marker"]'),
      ).toHaveCount(0);
    }

    await page.mouse.up();
    await page.waitForTimeout(250);
    await expect(allMarkers).toHaveCount(0);
    await expect(await itemByText(project, "README.md")).toHaveCount(0);
    await expect(await itemByText(source, "README.md")).toHaveCount(1);
    await expect(project.locator(":scope > .snapsort-item")).toHaveCount(3);
    await expect(source.locator(":scope > .snapsort-item")).toHaveCount(4);
  });
});
