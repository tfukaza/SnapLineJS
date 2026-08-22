import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mastersDir = resolve(repoRoot, "promo-output/snapsort/masters");

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type ClipOptions = {
  contentWidth: number;
  source: Locator;
  target: Locator;
  sourcePoint?: (box: Rect) => Point;
  targetPoint?: (box: Rect) => Point;
  verify: () => Promise<void>;
};

const captureStyles = (exhibitId: string, contentWidth: number) => `
  html,
  body {
    width: 1200px !important;
    height: 1200px !important;
    min-width: 1200px !important;
    overflow: hidden !important;
    background: #f7f4ec !important;
  }

  .nav-bar,
  .page-content + footer,
  .doc-sidebar,
  .doc-breadcrumb,
  .doc-header,
  .doc-pagination,
  [data-article-outline],
  .doc-article > :not([data-demo-code-tabs="${exhibitId}"]) {
    display: none !important;
  }

  main.page-content,
  .doc-layout,
  .page-content,
  .doc-content,
  .doc-article {
    width: 1200px !important;
    height: 1200px !important;
    min-width: 1200px !important;
    min-height: 1200px !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
    overflow: hidden !important;
  }

  [data-demo-code-tabs="${exhibitId}"] {
    position: fixed !important;
    inset: 56px !important;
    z-index: 100 !important;
    display: flex !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 64px !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0 !important;
    border-radius: 32px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    box-shadow: 0 30px 80px -52px rgb(31 30 41 / 35%) !important;
  }

  [data-demo-code-tabs="${exhibitId}"] > .demo-code-tabs-header {
    display: none !important;
  }

  [data-demo-code-tabs="${exhibitId}"] > .demo-panel {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    height: 100% !important;
    padding: 64px !important;
    box-sizing: border-box !important;
  }

  [data-demo-code-tabs="${exhibitId}"] .complete-example-surface,
  [data-snapsort-example="${exhibitId}"] {
    width: min(100%, ${contentWidth}px) !important;
    max-width: ${contentWidth}px !important;
    margin: auto !important;
    justify-self: center !important;
  }

  #promo-cursor {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2147483647;
    width: 30px;
    height: 42px;
    opacity: 0;
    pointer-events: none;
    user-select: none;
    transform: translate(-4px, -3px);
    filter: drop-shadow(0 2px 3px rgb(31 30 41 / 24%));
  }
`;

async function rect(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected promo locator to have a bounding box.");
  return box;
}

function center(box: Rect): Point {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function movePointer(
  page: Page,
  from: Point,
  to: Point,
  duration: number,
) {
  const steps = Math.max(2, Math.round(duration / 25));
  for (let index = 1; index <= steps; index++) {
    const progress = index / steps;
    const eased =
      progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    await page.mouse.move(
      from.x + (to.x - from.x) * eased,
      from.y + (to.y - from.y) * eased,
    );
    await page.waitForTimeout(duration / steps);
  }
}

async function prepareExhibit(
  page: Page,
  exhibitId: string,
  contentWidth: number,
) {
  const exhibit = page.locator(`[data-snapsort-example="${exhibitId}"]`);
  await exhibit.scrollIntoViewIfNeeded();
  await page.addStyleTag({
    content: captureStyles(exhibitId, contentWidth),
  });
  await page.evaluate(() => {
    const cursor = document.createElement("img");
    cursor.id = "promo-cursor";
    cursor.src = "/icon/noun-cursor-740125.svg";
    cursor.alt = "";
    document.body.append(cursor);
    window.addEventListener(
      "pointermove",
      (event) => {
        cursor.style.opacity = "1";
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      },
      { capture: true },
    );
  });
  await page.waitForTimeout(400);
}

async function recordDragClip(
  page: Page,
  fileName: string,
  exhibitId: string,
  options: ClipOptions,
) {
  await prepareExhibit(page, exhibitId, options.contentWidth);
  await expect(options.source).toBeVisible();
  await expect(options.target).toBeVisible();

  const sourceBox = await rect(options.source);
  const targetBox = await rect(options.target);
  const start = options.sourcePoint?.(sourceBox) ?? center(sourceBox);
  const end = options.targetPoint?.(targetBox) ?? center(targetBox);
  const cursorOrigin = { x: 80, y: 1120 };
  const outputPath = resolve(mastersDir, `${fileName}.webm`);

  mkdirSync(mastersDir, { recursive: true });
  rmSync(outputPath, { force: true });
  await page.mouse.move(cursorOrigin.x, cursorOrigin.y);
  await page.screencast.start({
    path: outputPath,
    size: { width: 1200, height: 1200 },
    quality: 92,
  });

  try {
    await page.waitForTimeout(550);
    await movePointer(page, cursorOrigin, start, 650);
    await page.waitForTimeout(250);
    await page.mouse.down();
    const threshold = { x: start.x + 7, y: start.y + 7 };
    await movePointer(page, start, threshold, 120);
    await page.waitForTimeout(180);
    await movePointer(page, threshold, end, 1_350);
    await page.waitForTimeout(300);
    await page.mouse.up();
    await options.verify();
    await page.waitForTimeout(1_400);
  } finally {
    await page.mouse.up().catch(() => {});
    await page.screencast.stop();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/snapsort/examples/complete-interfaces", {
    waitUntil: "networkidle",
  });
  await expect(
    page.locator('[data-snapsort-example="todo-list"] .snapsort-item').first(),
  ).toBeVisible();
});

test("01 TODO List reorder", async ({ page }) => {
  const exhibit = page.locator('[data-snapsort-example="todo-list"]');
  const cards = exhibit.locator(".project-card");
  const source = cards.first().locator(".project-drag-handle");
  const target = cards.nth(3);

  await recordDragClip(page, "01-todo-list", "todo-list", {
    contentWidth: 760,
    source,
    target,
    targetPoint: (box) => ({
      x: box.x + 28,
      y: box.y + box.height * 0.82,
    }),
    verify: async () => {
      await expect(exhibit.locator(".project-text").first()).not.toHaveText(
        "Plan the grocery run",
      );
    },
  });
});

test("02 Kanban Board transfer", async ({ page }) => {
  const exhibit = page.locator('[data-snapsort-example="kanban-board"]');
  const columns = exhibit.locator(".kanban-column");
  const source = columns.first().locator(".kanban-card").first();
  const target = columns.nth(1);

  await recordDragClip(page, "02-kanban-board", "kanban-board", {
    contentWidth: 980,
    source,
    target,
    targetPoint: (box) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height - 90,
    }),
    verify: async () => {
      await expect(columns.nth(1)).toContainText("Fix Bug #12");
    },
  });
});

test("03 File Explorer nesting", async ({ page }) => {
  const exhibit = page.locator('[data-snapsort-example="file-explorer"]');
  const source = exhibit
    .locator(".tree-row.file-row")
    .filter({ hasText: "package.json" });
  const target = exhibit.locator(".tree-folder").filter({ hasText: "docs" });

  await recordDragClip(page, "03-file-explorer", "file-explorer", {
    contentWidth: 620,
    source,
    target,
    targetPoint: (box) => ({
      x: box.x + 150,
      y: box.y + box.height - 14,
    }),
    verify: async () => {
      await expect(target).toContainText("package.json");
    },
  });
});

test("04 Template Palette duplication", async ({ page }) => {
  const exhibit = page.locator('[data-snapsort-example="clone-palette"]');
  const palette = exhibit.locator(".clone-palette");
  const canvas = exhibit.locator(".clone-canvas");
  const source = palette
    .locator(".snapsort-item")
    .filter({ hasText: "Button" });

  await recordDragClip(page, "04-clone-palette", "clone-palette", {
    contentWidth: 720,
    source,
    target: canvas,
    targetPoint: (box) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height * 0.4,
    }),
    verify: async () => {
      await expect(canvas.locator(".clone-canvas-block")).toHaveCount(1);
      await expect(palette.locator(".snapsort-item")).toHaveCount(4);
    },
  });
});

test("05 Trash It deletion", async ({ page }) => {
  const exhibit = page.locator('[data-snapsort-example="trash-it"]');
  const list = exhibit.locator(".trash-list");
  const source = list.locator(".trash-task").first();
  const target = exhibit.locator(".trash-drop-target");

  await recordDragClip(page, "05-trash-it", "trash-it", {
    contentWidth: 620,
    source,
    target,
    verify: async () => {
      await expect(list.locator(".trash-task")).toHaveCount(4);
    },
  });
});

test("06 Swap Grid exchange", async ({ page }) => {
  const exhibit = page.locator('[data-snapsort-example="swap-grid"]');
  const tiles = exhibit.locator(".snapsort-item");
  const source = tiles.filter({ hasText: "A1" });
  const target = tiles.filter({ hasText: "B2" });

  await recordDragClip(page, "06-swap-grid", "swap-grid", {
    contentWidth: 720,
    source,
    target,
    targetPoint: (box) => ({
      x: box.x + box.width * 0.62,
      y: box.y + box.height * 0.4,
    }),
    verify: async () => {
      await expect
        .poll(() => exhibit.locator(".swap-tile").first().textContent())
        .toContain("B2");
    },
  });
});
