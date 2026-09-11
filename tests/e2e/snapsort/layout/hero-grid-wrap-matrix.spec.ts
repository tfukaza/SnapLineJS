import { expect, test } from "@playwright/test";
import {
  makeContainerSnapshot,
  makeItemSnapshot,
  rowCounts,
  simulatedRowCounts,
} from "../../../helpers/layout-grid";
import { type Box } from "../../../helpers/snapsort-fixtures";
import { installSnapsortTrace, writeJson } from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("keeps a zero-slack hero grid at 4 columns across sub-pixel container widths", async ({
    page,
  }, testInfo) => {
    // The landing-page hero pad grid is the worst case for wrap prediction:
    // 4 columns of calc((100% - 12px) / 4) with a 4px gap sum *exactly* to
    // the container width, leaving zero slack for measurement error. Each
    // browser quantizes layout differently (Blink/WebKit on a 1/64px grid;
    // Gecko in 1/60px app units whose getBoundingClientRect doubles carry
    // ~1e-5px conversion noise), which historically over-wrapped the 4th
    // column onto the 2nd row at fractional container widths. Sweep integer
    // width bases crossed with increasingly granular sub-pixel offsets and
    // assert the simulation keeps 4 items per row with a same-size ghost at
    // every insertion index.
    const bases = [356, 380, 397, 414, 430, 434, 443];
    const offsets = [
      0,
      0.5,
      0.25,
      0.75,
      0.33,
      0.67,
      1 / 3,
      2 / 3,
      0.1,
      0.2,
      0.4,
      0.6,
      0.8,
      0.9,
      0.125,
      0.375,
      0.625,
      0.875,
      0.0625,
      0.03125,
      0.015625,
      0.0078125,
    ];
    const widths = bases.flatMap((base) =>
      offsets.map((offset) => base + offset),
    );

    await page.setContent('<main id="hero-grid-fixture"></main>');
    const measuredGrids = await page.evaluate((caseWidths) => {
      const fixture = document.querySelector(
        "#hero-grid-fixture",
      ) as HTMLElement;
      const boxOf = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const number = (value: string) => parseFloat(value) || 0;
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          screen: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          margin: {
            top: number(style.marginTop),
            right: number(style.marginRight),
            bottom: number(style.marginBottom),
            left: number(style.marginLeft),
          },
          padding: {
            top: number(style.paddingTop),
            right: number(style.paddingRight),
            bottom: number(style.paddingBottom),
            left: number(style.paddingLeft),
          },
          border: {
            top: number(style.borderTopWidth),
            right: number(style.borderRightWidth),
            bottom: number(style.borderBottomWidth),
            left: number(style.borderLeftWidth),
          },
        };
      };
      return caseWidths.map((width) => {
        fixture.innerHTML = "";
        const container = document.createElement("section");
        container.style.cssText =
          "box-sizing:border-box;display:flex;flex-direction:row;flex-wrap:wrap;" +
          `align-items:flex-start;align-content:flex-start;gap:4px;width:${width}px;`;
        fixture.appendChild(container);
        for (let index = 0; index < 16; index++) {
          const item = document.createElement("div");
          item.style.cssText =
            "box-sizing:border-box;width:calc((100% - 12px) / 4);height:40px;" +
            "background:#dbeafe;";
          container.appendChild(item);
        }
        return {
          width,
          container: boxOf(container),
          items: [...container.children].map((element) =>
            boxOf(element as HTMLElement),
          ),
        };
      });
    }, widths);

    const failures: Array<{
      width: number;
      index: number | null;
      rows: number[];
    }> = [];
    for (const grid of measuredGrids) {
      const root = makeContainerSnapshot(
        grid.container as Box,
        grid.items.map((box, index) =>
          makeItemSnapshot(`item-${index}`, box as Box),
        ),
      );
      const rowStep = root.children[4].box.y - root.children[0].box.y;
      // Browser ground truth first: the real flex layout must show 4 rows
      // of 4 before the simulation is held to the same shape.
      const browserRows = rowCounts(
        root.children.map((child) => child.box.y),
        rowStep,
      );
      if (browserRows.join() !== "4,4,4,4") {
        failures.push({ width: grid.width, index: null, rows: browserRows });
        continue;
      }

      const dragged = root.children[0];
      for (let index = 0; index <= 15; index++) {
        const rows = simulatedRowCounts(root, {
          rowStep,
          insertion: {
            container: root,
            index,
            entry: {
              width: dragged.box.width,
              height: dragged.box.height,
              margin: dragged.box.margin,
            },
          },
          exclude: (node) => node === dragged,
        });
        if (rows.join() !== "4,4,4,4") {
          failures.push({ width: grid.width, index, rows });
        }
      }
    }

    await writeJson(testInfo.outputPath("hero-grid-subpixel-matrix.json"), {
      widthCount: measuredGrids.length,
      insertionChecks: measuredGrids.length * 16,
      failures: failures.slice(0, 40),
    });
    expect(
      failures.slice(0, 8),
      "the 4th column must stay in the 4th column (not wrap to the 2nd row) at every sub-pixel width",
    ).toHaveLength(0);
  });
});
