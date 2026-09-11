import { expect, test, type Locator, type Page } from "@playwright/test";
import { coreImportPath } from "../../shared/servers";

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected locator to have a bounding box.");
  return box;
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function listByHeading(page: Page, heading: string): Promise<Locator> {
  return page.locator(".insertion-list", {
    has: page.locator("h2", { hasText: heading }),
  });
}

async function overrideInsertionDragVisual(
  page: Page,
  dragVisual: "item" | "preview" | "none",
) {
  await page.evaluate(
    async ({ coreImportPath, dragVisual }) => {
      const { GlobalManager } = await import(coreImportPath);
      const board = document.querySelector(".insertion-board");
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const root = containers.find(
        (candidate: any) => candidate.element === board,
      );
      if (!root) throw new Error("Could not find the insertion board root.");

      const state = globalThis as typeof globalThis & {
        __snapsortInsertionGhostEvents?: Array<{ type: string }>;
      };
      state.__snapsortInsertionGhostEvents = [];
      const originalCallbacks = root.callbacks;
      const originalGhostInsert = originalCallbacks.onGhostInsert;
      const originalDragStart = originalCallbacks.onDragStart;
      root.callbacks = {
        ...originalCallbacks,
        onGhostInsert: (event: any) => {
          state.__snapsortInsertionGhostEvents?.push({
            type: event.ghost.type,
          });
          originalGhostInsert?.(event);
        },
        onDragStart: (event: any) => {
          const result = originalDragStart?.(event);
          if (result === false) return false;
          event.session.dragVisual = dragVisual;
          return undefined;
        },
      };
    },
    { coreImportPath, dragVisual },
  );
}

async function dragOnto(
  page: Page,
  source: Locator,
  target: Locator,
  options: {
    xOffset?: number;
    yOffset?: number;
    beforeDrop?: () => Promise<void>;
    afterDrop?: () => Promise<void>;
  } = {},
) {
  const start = center(await rect(source));
  const end = center(await rect(target));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 4, start.y + 4);
  await page.waitForTimeout(60);
  for (let step = 1; step <= 12; step++) {
    const t = step / 12;
    await page.mouse.move(
      start.x + (end.x - start.x) * t + (options.xOffset ?? 0) * t,
      start.y + (end.y - start.y) * t + (options.yOffset ?? 0) * t,
    );
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(80);
  await options.beforeDrop?.();
  await page.mouse.up();
  await options.afterDrop?.();
  await page.waitForTimeout(250);
}

test.describe("SnapSort insertion move-and-backfill recipe", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=snapsort_insertion", { waitUntil: "networkidle" });
  });

  test("duplicate mode moves the original stable id, backfills its source, and safely animates the drop", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const project = await listByHeading(page, "Project");
    const source = await listByHeading(page, "Source");

    await expect(project.locator(".insertion-card")).toHaveCount(4);
    await expect(source.locator(".insertion-card")).toHaveCount(3);

    // The design system's checkbox input is visually hidden (opacity/size 0)
    // in favor of a `+ span` sibling for the visible box — click the label
    // (as a real user would) rather than `.check()`, which requires the
    // underlying input itself to be visible.
    await page.locator(".duplicate-toggle").click();
    await expect(
      page.locator(".duplicate-toggle input[type=checkbox]"),
    ).toBeChecked();

    const dragged = project.locator(".insertion-card", {
      hasText: "package.json",
    });
    const originalId = await dragged.getAttribute("data-snapsort-item-id");
    expect(originalId).toBeTruthy();
    const originalRect = await rect(dragged);
    const target = source.locator(".insertion-card", {
      hasText: "Item.svelte",
    });
    await dragOnto(page, dragged, target, {
      // Release away from the final card's horizontal layout position so the
      // preview-to-item drop FLIP has observable travel.
      xOffset: 48,
      beforeDrop: async () => {
        // Pointer representation and placement feedback are independent:
        // insertion can show both at once while the original remains in its
        // source layout slot.
        await expect(
          page.locator('[data-snapsort-ghost="pointer"]'),
        ).toHaveCount(1);
        await expect(
          page.locator('[data-snapsort-ghost="insertion"]'),
        ).toHaveCount(1);
        await expect(
          page.locator('[data-snapsort-ghost-entry="pointer-preview"]'),
        ).toHaveCount(1);
        await expect(
          page.locator('[data-snapsort-ghost-entry="insertion-marker"]'),
        ).toHaveCount(1);
        await expect(page.locator("[data-snapsort-ghost-entry]")).toHaveCount(
          2,
        );

        const liveOriginal = project.locator(
          `[data-snapsort-item-id="${originalId}"]`,
        );
        await expect(liveOriginal).toHaveCount(1);
        const liveRect = await rect(liveOriginal);
        expect(Math.abs(liveRect.x - originalRect.x)).toBeLessThan(2);
        expect(Math.abs(liveRect.y - originalRect.y)).toBeLessThan(2);

        // Record every FLIP transform, including short-lived transforms that
        // polling after pointer-up could miss.
        await page.evaluate(() => {
          const state = {
            transformedItemIds: new Set<string>(),
          };
          const check = (node: Node) => {
            if (!(node instanceof HTMLElement)) return;
            const id = node.dataset.snapsortItemId;
            if (id && /^translate3d\(/.test(node.style.transform)) {
              state.transformedItemIds.add(id);
            }
          };
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              check(mutation.target);
              for (const node of mutation.addedNodes) {
                check(node);
                if (node instanceof Element) {
                  for (const child of node.querySelectorAll("[style]")) {
                    check(child);
                  }
                }
              }
            }
          });
          observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["style"],
            childList: true,
            subtree: true,
          });
          const win = window as typeof window & {
            __snapsortCopyFlip?: {
              observer: MutationObserver;
              transformedItemIds: Set<string>;
            };
          };
          win.__snapsortCopyFlip = { observer, ...state };
        });
      },
    });

    // The source still has the same content, now under a freshly-created id.
    await expect(project.locator(".insertion-card")).toHaveCount(4);
    const replacement = project.locator(".insertion-card", {
      hasText: "package.json",
    });
    await expect(replacement).toHaveCount(1);
    const replacementId = await replacement.getAttribute(
      "data-snapsort-item-id",
    );
    expect(replacementId).toBeTruthy();
    expect(replacementId).not.toBe(originalId);

    // The original stable id, not a newly-created destination id, moved to
    // the marker index.
    await expect(source.locator(".insertion-card")).toHaveCount(4);
    const movedOriginal = source.locator(
      `[data-snapsort-item-id="${originalId}"]`,
    );
    await expect(movedOriginal).toHaveCount(1);
    await expect(movedOriginal).toContainText("package.json");

    const transformedIds = await page.evaluate(() => {
      const state = (
        window as typeof window & {
          __snapsortCopyFlip?: {
            observer: MutationObserver;
            transformedItemIds: Set<string>;
          };
        }
      ).__snapsortCopyFlip;
      state?.observer.disconnect();
      return [...(state?.transformedItemIds ?? [])];
    });
    expect(transformedIds).toContain(originalId);
    expect(transformedIds).not.toContain(replacementId);
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
    await expect(page.locator('[data-snapsort-ghost="pointer"]')).toHaveCount(
      0,
    );
    await expect(page.locator('[data-snapsort-ghost="insertion"]')).toHaveCount(
      0,
    );

    await expect(page.locator(".demo-header p")).toHaveText(
      /8 files and folders (?:·|-) original row stays still until drop/,
    );
  });

  test("with duplicate mode off, dragging still performs a normal move", async ({
    page,
  }) => {
    const project = await listByHeading(page, "Project");
    const source = await listByHeading(page, "Source");

    const dragged = project.locator(".insertion-card", {
      hasText: "README.md",
    });
    const draggedId = await dragged.getAttribute("data-snapsort-item-id");
    expect(draggedId).toBeTruthy();
    if (!draggedId) throw new Error("Expected the dragged item to have an ID.");
    const draggedStart = await rect(dragged);
    const movedItem = page.locator(`[data-snapsort-item-id="${draggedId}"]`);
    const target = source.locator(".insertion-card", {
      hasText: "Handle.svelte",
    });
    await dragOnto(page, dragged, target, {
      beforeDrop: async () => {
        await expect(
          page.locator('[data-snapsort-ghost="pointer"]'),
        ).toHaveCount(0);
        await expect(
          page.locator('[data-snapsort-ghost="insertion"]'),
        ).toHaveCount(1);
        const liveRect = await rect(movedItem);
        expect(Math.abs(liveRect.x - draggedStart.x)).toBeLessThan(2);
        expect(Math.abs(liveRect.y - draggedStart.y)).toBeLessThan(2);
      },
      afterDrop: async () => {
        await expect
          .poll(
            () =>
              movedItem.evaluate(
                (node) => getComputedStyle(node).transform !== "none",
              ),
            { intervals: [10, 20, 40], timeout: 500 },
          )
          .toBe(true);
      },
    });

    await expect(project.locator(".insertion-card")).toHaveCount(3);
    await expect(
      project.locator(".insertion-card", { hasText: "README.md" }),
    ).toHaveCount(0);
    await expect(source.locator(".insertion-card")).toHaveCount(4);
    await expect(
      source.locator(".insertion-card", { hasText: "README.md" }),
    ).toHaveCount(1);
    await expect(movedItem).toHaveCSS("transform", "none");

    await expect(page.locator(".demo-header p")).toHaveText(
      /7 files and folders (?:·|-) original row stays still until drop/,
    );
  });

  test("item visual hoists the real insertion item while source spacer and target marker stay independent", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await overrideInsertionDragVisual(page, "item");

    const project = await listByHeading(page, "Project");
    const source = await listByHeading(page, "Source");
    const dragged = project.locator(".insertion-card", {
      hasText: "package.json",
    });
    const target = source.locator(".insertion-card", {
      hasText: "Item.svelte",
    });
    const initial = await rect(dragged);
    const start = center(initial);
    const end = center(await rect(target));

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(80);
    await page.mouse.move(end.x, end.y, { steps: 16 });
    await page.waitForTimeout(120);

    await expect(dragged).toHaveCSS("position", "absolute");
    const draggedCenter = center(await rect(dragged));
    expect(
      Math.hypot(draggedCenter.x - end.x, draggedCenter.y - end.y),
    ).toBeLessThan(12);
    expect(
      Math.hypot(draggedCenter.x - start.x, draggedCenter.y - start.y),
    ).toBeGreaterThan(40);
    await expect(
      project.locator('[data-snapsort-ghost-entry="source-spacer"]'),
    ).toHaveCount(1);
    const targetMarker = source.locator('[data-snapsort-ghost="insertion"]');
    await expect(targetMarker).toHaveCount(1);
    await expect(targetMarker).toHaveAttribute(
      "data-snapsort-ghost-entry",
      "insertion-marker",
    );
    await expect(page.locator('[data-snapsort-ghost="pointer"]')).toHaveCount(
      0,
    );
    const ghostEvents = await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __snapsortInsertionGhostEvents?: Array<{ type: string }>;
          }
        ).__snapsortInsertionGhostEvents ?? [],
    );
    expect(ghostEvents).toContainEqual({ type: "source-spacer" });

    await page.mouse.up();
    await page.waitForTimeout(250);

    await expect(project.locator(".insertion-card")).toHaveCount(3);
    await expect(source.locator(".insertion-card")).toHaveCount(4);
    await expect(
      source.locator(".insertion-card", { hasText: "package.json" }),
    ).toHaveCount(1);
    await expect(page.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
    expect(pageErrors).toHaveLength(0);
  });
});
