import { expect, test } from "@playwright/test";
import { contentRect } from "../../../../src/geometry";
import {
  flowLayoutPositions,
  makeContainerSnapshot,
  makeItemSnapshot,
} from "../../../helpers/layout-grid";
import { type Box } from "../../../helpers/snapsort-fixtures";
import { installSnapsortTrace, writeJson } from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("matches browser grid placements across template variants (slot layout model)", async ({
    page,
  }, testInfo) => {
    // Ground truth for the slot layout model: for each grid template
    // variant, remove the dragged item from a real `display:grid` DOM,
    // insert a real spacer (with the dragged item's explicit size, as
    // flow-ghost does) at several indices, and require the slot simulation
    // to match the browser's placement of every entry within 1.25px. The
    // unequal-track, auto-flow-column, and auto-rows variants are exactly
    // the shapes the flow model cannot represent.
    const scenarios = [
      {
        name: "fixed equal tracks",
        container:
          "display:grid;grid-template-columns:repeat(4, 88px);gap:4px;width:380px;",
        itemHeight: () => 40,
      },
      {
        name: "fractional tracks",
        container:
          "display:grid;grid-template-columns:repeat(4, 1fr);gap:4px;width:380.33px;",
        itemHeight: () => 40,
      },
      {
        name: "unequal tracks",
        container:
          "display:grid;grid-template-columns:60px 140px 80px 88.33px;gap:4px;width:380.33px;",
        itemHeight: () => 40,
      },
      {
        name: "auto-fill minmax",
        container:
          "display:grid;grid-template-columns:repeat(auto-fill, minmax(80px, 1fr));gap:4px;width:380.33px;",
        itemHeight: () => 40,
      },
      {
        name: "auto-flow column",
        container:
          "display:grid;grid-auto-flow:column;grid-template-rows:repeat(4, 44px);gap:4px;width:max-content;",
        itemHeight: () => 40,
      },
      {
        name: "auto rows with mixed item heights",
        container:
          "display:grid;grid-template-columns:repeat(4, 88px);grid-auto-rows:auto;gap:4px;width:380px;align-items:start;",
        // item 0 (the dragged one) is tall: removing it shrinks its row in
        // the real layout, which only the content-sized row variant tracks.
        itemHeight: (index: number) => (index % 5 === 0 ? 80 : 40),
      },
    ];
    const spacerIndices = [0, 3, 7, 14];
    const draggedIndex = 0;

    await page.setContent('<main id="grid-slot-fixture"></main>');
    const measured = await page.evaluate(
      ({ cases, spacerIndices, draggedIndex }) => {
        const fixture = document.querySelector(
          "#grid-slot-fixture",
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
          entry: { container: string; itemHeights: number[] },
          spacer: { index: number; width: number; height: number } | null,
        ) => {
          fixture.innerHTML = "";
          const container = document.createElement("section");
          container.style.cssText = "box-sizing:border-box;" + entry.container;
          fixture.appendChild(container);
          const nodes: HTMLElement[] = [];
          for (let i = 0; i < 16; i++) {
            if (spacer && i === draggedIndex) continue; // dragged item lifted
            const item = document.createElement("div");
            item.style.cssText = `box-sizing:border-box;background:#dbeafe;height:${entry.itemHeights[i]}px;`;
            item.dataset.i = String(i);
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

        return cases.map((entry) => {
          const pristine = build(entry, null);
          const containerBox = boxOf(pristine);
          const itemBoxes = [...pristine.children].map((element) =>
            boxOf(element as HTMLElement),
          );
          const dragged = itemBoxes[draggedIndex];
          const truths = spacerIndices.map((index) => {
            const container = build(entry, {
              index,
              width: dragged.width,
              height: dragged.height,
            });
            let ghost: { x: number; y: number } | null = null;
            const items: Array<{ id: string; x: number; y: number }> = [];
            for (const element of container.children) {
              const rect = element.getBoundingClientRect();
              if (element.id === "spacer") {
                ghost = { x: rect.x, y: rect.y };
              } else {
                items.push({
                  id: (element as HTMLElement).dataset.i!,
                  x: rect.x,
                  y: rect.y,
                });
              }
            }
            return { spacerIndex: index, ghost, items };
          });
          return {
            name: entry.name,
            container: containerBox,
            itemBoxes,
            truths,
          };
        });
      },
      {
        cases: scenarios.map((scenario) => ({
          name: scenario.name,
          container: scenario.container,
          itemHeights: Array.from({ length: 16 }, (_, i) =>
            scenario.itemHeight(i),
          ),
        })),
        spacerIndices,
        draggedIndex,
      },
    );

    const failures: Array<{
      name: string;
      spacerIndex: number;
      entry: string;
      delta: number;
    }> = [];
    for (const grid of measured) {
      const root = makeContainerSnapshot(
        grid.container as Box,
        grid.itemBoxes.map((box, index) =>
          makeItemSnapshot(`${index}`, box as Box),
        ),
        "row",
        "start",
        "slots",
      );
      const dragged = root.children[draggedIndex];
      for (const truth of grid.truths) {
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
          const delta = Math.max(
            Math.abs(position.x - actual.x),
            Math.abs(position.y - actual.y),
          );
          if (delta > 1.25) {
            failures.push({
              name: grid.name,
              spacerIndex: truth.spacerIndex,
              entry: `item-${snapshotItem.value}`,
              delta: +delta.toFixed(2),
            });
          }
        }
        const ghost = result.virtualRects.get(insertion);
        expect(
          ghost,
          `ghost position for ${grid.name}[${truth.spacerIndex}]`,
        ).toBeTruthy();
        const ghostDelta = truth.ghost
          ? Math.max(
              Math.abs(ghost!.x - truth.ghost.x),
              Math.abs(ghost!.y - truth.ghost.y),
            )
          : Infinity;
        if (ghostDelta > 1.25) {
          failures.push({
            name: grid.name,
            spacerIndex: truth.spacerIndex,
            entry: "ghost",
            delta: +ghostDelta.toFixed(2),
          });
        }
      }
    }

    await writeJson(testInfo.outputPath("grid-slot-model-ground-truth.json"), {
      scenarioCount: measured.length,
      failures: failures.slice(0, 40),
    });
    expect(
      failures.slice(0, 8),
      "slot layout simulation should match browser grid placement within 1.25px",
    ).toHaveLength(0);
  });
});
