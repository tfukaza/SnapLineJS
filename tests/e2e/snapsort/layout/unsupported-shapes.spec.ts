import { expect, test, type Page } from "@playwright/test";
import { contentRect } from "../../../../src/geometry";
import {
  flowLayoutPositions,
  makeContainerSnapshot,
  makeItemSnapshot,
} from "../../../helpers/layout-grid";
import { type Box } from "../../../helpers/snapsort-fixtures";

test.describe("Snapsort drag-start snapshot layout", () => {
  // Documented-unsupported layout shapes, encoded as expected failures so
  // the boundary is visible in the test report and any accidental fix or
  // regression flips the result. Each builds a real DOM, inserts a real
  // spacer, and counts entries where the simulation misses the browser's
  // placement by more than 1.25px.
  async function unsupportedShapeMismatches(
    page: Page,
    config: {
      containerCss: string;
      itemCss: string[];
      itemInnerHeights?: number[];
      layoutModel: "flow" | "slots";
      spacerIndices: number[];
    },
  ): Promise<number> {
    await page.setContent('<main id="unsupported-fixture"></main>');
    const measured = await page.evaluate((cfg) => {
      const fixture = document.querySelector(
        "#unsupported-fixture",
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
      const build = (
        spacer: { index: number; width: number; height: number } | null,
      ) => {
        fixture.innerHTML = "";
        const container = document.createElement("section");
        container.style.cssText = "box-sizing:border-box;" + cfg.containerCss;
        fixture.appendChild(container);
        const nodes: HTMLElement[] = [];
        for (let i = 0; i < cfg.itemCss.length; i++) {
          if (spacer && i === 0) continue; // dragged item lifted
          const item = document.createElement("div");
          item.style.cssText =
            "box-sizing:border-box;background:#dbeafe;" + cfg.itemCss[i];
          item.dataset.i = String(i);
          const innerHeight = cfg.itemInnerHeights?.[i];
          if (innerHeight != null) {
            const inner = document.createElement("div");
            inner.style.cssText = `height:${innerHeight}px;`;
            item.appendChild(inner);
          }
          nodes.push(item);
        }
        if (spacer) {
          const spacerEl = document.createElement("div");
          spacerEl.id = "spacer";
          spacerEl.style.cssText = `box-sizing:border-box;background:#fecaca;width:${spacer.width}px;height:${spacer.height}px;`;
          nodes.splice(Math.min(spacer.index, nodes.length), 0, spacerEl);
        }
        for (const node of nodes) container.appendChild(node);
        return container;
      };

      const pristine = build(null);
      const containerBox = boxOf(pristine);
      const itemBoxes = [...pristine.children].map((element) =>
        boxOf(element as HTMLElement),
      );
      const dragged = itemBoxes[0];
      const truths = cfg.spacerIndices.map((index) => {
        const container = build({
          index,
          width: dragged.width,
          height: dragged.height,
        });
        let ghost: { x: number; y: number } | null = null;
        const items: Array<{ id: string; x: number; y: number }> = [];
        for (const element of container.children) {
          const rect = element.getBoundingClientRect();
          if (element.id === "spacer") ghost = { x: rect.x, y: rect.y };
          else {
            items.push({
              id: (element as HTMLElement).dataset.i!,
              x: rect.x,
              y: rect.y,
            });
          }
        }
        return { spacerIndex: index, ghost, items };
      });
      return { container: containerBox, itemBoxes, truths };
    }, config);

    const root = makeContainerSnapshot(
      measured.container as Box,
      measured.itemBoxes.map((box, index) =>
        makeItemSnapshot(`${index}`, box as Box),
      ),
      "row",
      "start",
      config.layoutModel,
    );
    const dragged = root.children[0];
    let mismatches = 0;
    for (const truth of measured.truths) {
      const insertion = {
        container: root,
        index: truth.spacerIndex,
        entry: {
          width: dragged.box.width,
          height: dragged.box.height,
          margin: dragged.box.margin,
        },
      };
      const origin = contentRect(root.box);
      const result = flowLayoutPositions(root, origin.x, origin.y, {
        exclude: (node) => node === dragged,
        insertions: [insertion],
      });
      const actualById = new Map(truth.items.map((item) => [item.id, item]));
      for (const [snapshotItem, position] of result.itemPositions) {
        const actual = actualById.get(snapshotItem.value);
        if (!actual) continue;
        if (
          Math.max(
            Math.abs(position.x - actual.x),
            Math.abs(position.y - actual.y),
          ) > 1.25
        ) {
          mismatches++;
        }
      }
      const ghost = result.virtualRects.get(insertion);
      if (
        !ghost ||
        !truth.ghost ||
        Math.max(
          Math.abs(ghost.x - truth.ghost.x),
          Math.abs(ghost.y - truth.ghost.y),
        ) > 1.25
      ) {
        mismatches++;
      }
    }
    return mismatches;
  }

  test("documents unsupported: RTL flex containers", async ({ page }) => {
    test.fail(
      true,
      "The flow model assumes LTR main-axis growth: RTL offsets regress per item, so line detection and positions are mirrored. Slot mode covers RTL grids; RTL flex is out of scope.",
    );
    const mismatches = await unsupportedShapeMismatches(page, {
      containerCss:
        "display:flex;flex-wrap:wrap;direction:rtl;width:380.33px;gap:4px;" +
        "align-items:flex-start;align-content:flex-start;",
      itemCss: Array.from(
        { length: 16 },
        () => "width:calc((100% - 12px)/4);height:40px;",
      ),
      layoutModel: "flow",
      spacerIndices: [0, 3, 7],
    });
    expect(mismatches).toBe(0);
  });

  test("documents unsupported: grid items spanning multiple tracks", async ({
    page,
  }) => {
    test.fail(
      true,
      "Slot mode assumes one entry per slot: a span-2 item makes slot geometry depend on placement, which reordering invalidates.",
    );
    const mismatches = await unsupportedShapeMismatches(page, {
      containerCss:
        "display:grid;grid-template-columns:repeat(4, 88px);gap:4px;width:380px;",
      itemCss: Array.from({ length: 14 }, (_, i) =>
        i === 5 ? "height:40px;grid-column:span 2;" : "height:40px;",
      ),
      layoutModel: "slots",
      spacerIndices: [0, 3, 7],
    });
    expect(mismatches).toBe(0);
  });

  test("documents unsupported: stretch items with intrinsic heights across content-sized rows", async ({
    page,
  }) => {
    test.fail(
      true,
      "Items with align-self:stretch and no explicit height measure at their row's height, not their intrinsic height; when displaced across content-sized rows the simulation carries the stale stretched height. Predicting the true height would require intrinsic sizing per destination track.",
    );
    const mismatches = await unsupportedShapeMismatches(page, {
      containerCss:
        "display:grid;grid-template-columns:repeat(3, 110px);grid-auto-rows:auto;gap:4px;width:346px;",
      // No explicit item heights: each stretches to its row. Item 0's inner
      // content is 90px tall, making row 1's track 90 and stretching its
      // short siblings to 90 as measured. Removing item 0 shrinks row 1 to
      // 30 in the real layout; the simulation keeps the stale 90.
      itemCss: Array.from({ length: 9 }, () => ""),
      itemInnerHeights: Array.from({ length: 9 }, (_, i) =>
        i === 0 ? 90 : 30,
      ),
      layoutModel: "slots",
      spacerIndices: [8],
    });
    expect(mismatches).toBe(0);
  });
});
