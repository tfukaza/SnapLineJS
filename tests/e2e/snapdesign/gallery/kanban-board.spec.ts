import { expect, test } from "@playwright/test";

async function dragBetween(
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator,
) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Kanban geometry is missing");

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 16 },
  );
  await page.mouse.up();
}

test("Kanban board anchors two initially centered columns and supports progressive moves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="kanban-board"]');
  await exhibit.scrollIntoViewIfNeeded();
  const stage = exhibit.locator(".kanban-stage");
  const columns = exhibit.locator(".kanban-column");

  await expect(columns).toHaveCount(2);
  await expect(columns.nth(0).locator(".kanban-card")).toHaveCount(3);
  await expect(columns.nth(1).locator(".kanban-card")).toHaveCount(3);
  await expect(exhibit.locator(".kanban-card-category")).toHaveCount(6);
  await expect(exhibit.locator(".kanban-card-due")).toHaveCount(6);
  await expect(exhibit.locator(".kanban-card-avatar")).toHaveCount(6);
  await expect(
    exhibit.locator('[data-kanban-card="kanban-research"]'),
  ).toHaveAttribute(
    "aria-label",
    "Research references, Research, due Today, assigned to Maya Chen",
  );
  await expect(exhibit.getByRole("heading", { name: "To Do" })).toBeVisible();
  await expect(exhibit.getByRole("heading", { name: "Done" })).toBeVisible();

  const layout = await stage.evaluate((element) => {
    const stageRect = element.getBoundingClientRect();
    const board = element.querySelector<HTMLElement>(".kanban-board");
    const viewport = element.querySelector<HTMLElement>(".kanban-viewport");
    if (!board) throw new Error("Kanban board is missing");
    if (!viewport) throw new Error("Kanban viewport is missing");
    const boardRect = board.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    return {
      overflow: getComputedStyle(element).overflow,
      centeredHorizontally:
        Math.abs(
          boardRect.left + boardRect.width / 2 -
            (stageRect.left + stageRect.width / 2),
        ) < 2,
      centeredInitially:
        Math.abs(
          boardRect.top + boardRect.height / 2 -
            (viewportRect.top + viewportRect.height / 2),
        ) < 2,
      boardTop: boardRect.top,
      shorterThanStage: boardRect.height < stageRect.height * 0.75,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(layout).toMatchObject({
    overflow: "hidden",
    centeredHorizontally: true,
    centeredInitially: true,
    shorterThanStage: true,
    pageOverflow: false,
  });

  await dragBetween(
    page,
    exhibit.locator('[data-kanban-card="kanban-research"]'),
    exhibit.locator('[data-kanban-card="kanban-copy"]'),
  );
  await expect
    .poll(() =>
      columns
        .nth(0)
        .locator(".kanban-card")
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("data-kanban-card")),
        ),
    )
    .toEqual(["kanban-wireframe", "kanban-copy", "kanban-research"]);

  await dragBetween(
    page,
    exhibit.locator('[data-kanban-card="kanban-research"]'),
    exhibit.locator('[data-kanban-card="kanban-components"]'),
  );
  await expect(columns.nth(0).locator(".kanban-card")).toHaveCount(2);
  await expect(columns.nth(1).locator(".kanban-card")).toHaveCount(4);
  await expect(
    columns.nth(1).locator('[data-kanban-card="kanban-research"]'),
  ).toHaveCount(1);
  await expect
    .poll(() =>
      stage.locator(".kanban-board").evaluate((board) =>
        board.getBoundingClientRect().top,
      ),
    )
    .toBeCloseTo(layout.boardTop, 0);
  expect(pageErrors).toEqual([]);
});
