import { expect, test, type Locator } from "@playwright/test";

type CellGeometry = {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  scrollWidth: number;
  scrollHeight: number;
};

type MatrixGeometry = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  cells: CellGeometry[];
};

async function readMatrixGeometry(matrix: Locator): Promise<MatrixGeometry> {
  return matrix.evaluate((element) => {
    const matrixRect = element.getBoundingClientRect();
    return {
      left: matrixRect.left,
      top: matrixRect.top,
      right: matrixRect.right,
      bottom: matrixRect.bottom,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      cells: Array.from(
        element.querySelectorAll<HTMLElement>("[data-control-cell]"),
        (cell) => {
          const rect = cell.getBoundingClientRect();
          return {
            name: cell.dataset.controlCell ?? "",
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            scrollWidth: cell.scrollWidth,
            scrollHeight: cell.scrollHeight,
          };
        },
      ),
    };
  });
}

function roundedUnique(values: number[]) {
  return new Set(values.map((value) => Math.round(value))).size;
}

function expectTwoByThree(geometry: MatrixGeometry) {
  expect(geometry.cells).toHaveLength(6);
  expect(
    Math.abs(geometry.clientWidth - geometry.clientHeight),
  ).toBeLessThanOrEqual(1);
  expect(roundedUnique(geometry.cells.map((cell) => cell.left))).toBe(2);
  expect(roundedUnique(geometry.cells.map((cell) => cell.top))).toBe(3);

  const widths = geometry.cells.map((cell) => cell.width);
  const heights = geometry.cells.map((cell) => cell.height);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
}

test("renders an interactive, responsive 2 by 3 control matrix", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="control-matrix"]');
  const stage = exhibit.locator(".control-matrix-stage");
  const matrix = exhibit.locator("[data-control-matrix]");
  await exhibit.scrollIntoViewIfNeeded();

  await expect(
    exhibit.getByRole("heading", { name: "Control matrix" }),
  ).toBeVisible();
  await expect(stage).toHaveAttribute(
    "aria-label",
    "Interactive UI control matrix",
  );
  expectTwoByThree(await readMatrixGeometry(matrix));

  const button = exhibit.getByRole("button", { name: "Run action" });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");

  const dial = exhibit.getByRole("slider", { name: "Dial specimen" });
  await expect(dial).toHaveAttribute("aria-valuenow", "130");
  await dial.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dial).toHaveAttribute("aria-valuenow", "140");

  const slider = exhibit.getByRole("slider", { name: "Slider specimen" });
  await expect(slider).toHaveValue("65");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("70");

  const toggle = exhibit.getByRole("switch", { name: "Toggle specimen" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  const checkbox = exhibit.getByRole("checkbox", {
    name: "Checkbox specimen",
  });
  await expect(checkbox).toBeChecked();
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();

  await exhibit.getByRole("radio", { name: "Option B" }).click();
  await expect(exhibit.getByRole("radio", { name: "Option B" })).toBeChecked();
  await expect(
    exhibit.getByRole("radio", { name: "Option A" }),
  ).not.toBeChecked();
  const radioPositions = await exhibit
    .getByRole("radiogroup", { name: "Radio specimen" })
    .getByRole("radio")
    .evaluateAll((labels) =>
      labels.map((label) => {
        const rect = label.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      }),
    );
  expect(
    Math.abs(radioPositions[0].left - radioPositions[1].left),
  ).toBeLessThan(1);
  expect(radioPositions[1].top).toBeGreaterThan(radioPositions[0].top);

  await page.setViewportSize({ width: 390, height: 844 });
  await exhibit.scrollIntoViewIfNeeded();
  const narrowGeometry = await readMatrixGeometry(matrix);
  expectTwoByThree(narrowGeometry);
  expect(narrowGeometry.scrollWidth).toBe(narrowGeometry.clientWidth);
  expect(narrowGeometry.scrollHeight).toBe(narrowGeometry.clientHeight);
  for (const cell of narrowGeometry.cells) {
    expect(cell.left).toBeGreaterThanOrEqual(narrowGeometry.left - 1);
    expect(cell.top).toBeGreaterThanOrEqual(narrowGeometry.top - 1);
    expect(cell.right).toBeLessThanOrEqual(narrowGeometry.right + 1);
    expect(cell.bottom).toBeLessThanOrEqual(narrowGeometry.bottom + 1);
  }

  expect(pageErrors).toEqual([]);
});

test("autoplays every control in the matrix", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="control-matrix"]');
  const matrix = exhibit.locator("[data-control-matrix]");
  await exhibit.scrollIntoViewIfNeeded();
  await expect(matrix).toHaveAttribute(
    "data-control-autoplay-phase",
    "complete",
    {
      timeout: 8_000,
    },
  );

  await expect(
    exhibit.getByRole("button", { name: "Run action" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    exhibit.getByRole("slider", { name: "Dial specimen" }),
  ).toHaveAttribute("aria-valuenow", "200");
  await expect(
    exhibit.getByRole("slider", { name: "Slider specimen" }),
  ).toHaveValue("35");
  await expect(
    exhibit.getByRole("switch", { name: "Toggle specimen" }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(
    exhibit.getByRole("checkbox", { name: "Checkbox specimen" }),
  ).not.toBeChecked();
  await expect(exhibit.getByRole("radio", { name: "Option B" })).toBeChecked();

  await expect(matrix).toHaveAttribute(
    "data-control-autoplay-phase",
    "resting",
    { timeout: 8_000 },
  );
  await expect(
    exhibit.getByRole("slider", { name: "Slider specimen" }),
  ).toHaveValue("65");
  await expect(
    exhibit.getByRole("slider", { name: "Dial specimen" }),
  ).toHaveAttribute("aria-valuenow", "130");
});
