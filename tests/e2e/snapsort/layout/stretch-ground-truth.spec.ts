import { expect, test } from "@playwright/test";
import { contentRect } from "../../../../src/geometry";
import { virtualEntrySizeFor } from "../../../../src/layout";
import {
  flowLayoutPositions,
  makeContainerSnapshot,
  makeItemSnapshot,
} from "../../../helpers/layout-grid";
import { type Box } from "../../../helpers/snapsort-fixtures";
import { installSnapsortTrace } from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("stretch entry sizing matches a real width-100% spacer (ground truth)", async ({
    page,
  }) => {
    // A stretchItems container's simulated entry must match what the browser
    // does with an unsized (stretch) flex child: fill the content box minus
    // the entry's own margins — including fractional container widths,
    // padding, and borders.
    await page.setContent('<main id="stretch-fixture"></main>');
    const measured = await page.evaluate(() => {
      const fixture = document.querySelector("#stretch-fixture") as HTMLElement;
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
      const build = (withSpacer: boolean) => {
        fixture.innerHTML = "";
        const container = document.createElement("section");
        container.style.cssText =
          "box-sizing:border-box;display:flex;flex-direction:column;" +
          "width:222.33px;padding:9px;border:2px solid #111;gap:6px;";
        fixture.appendChild(container);
        for (let i = 0; i < 3; i++) {
          const item = document.createElement("div");
          item.style.cssText =
            "box-sizing:border-box;height:40px;background:#dbeafe;";
          item.dataset.i = String(i);
          container.appendChild(item);
          if (withSpacer && i === 0) {
            // Unsized stretch flex child with margins: the browser's own
            // notion of a "100% width" entry.
            const spacer = document.createElement("div");
            spacer.id = "spacer";
            spacer.style.cssText =
              "box-sizing:border-box;height:40px;margin:0 4px;background:#fecaca;";
            container.appendChild(spacer);
          }
        }
        return container;
      };
      const pristine = build(false);
      const containerBox = boxOf(pristine);
      const itemBoxes = [...pristine.children].map((element) =>
        boxOf(element as HTMLElement),
      );
      const truth = build(true);
      const spacer = truth.querySelector("#spacer") as HTMLElement;
      const spacerRect = spacer.getBoundingClientRect();
      return {
        container: containerBox,
        itemBoxes,
        spacer: {
          x: spacerRect.x,
          y: spacerRect.y,
          width: spacerRect.width,
          height: spacerRect.height,
        },
      };
    });

    const root = makeContainerSnapshot(
      measured.container as Box,
      measured.itemBoxes.map((box, index) =>
        makeItemSnapshot(`${index}`, box as Box),
      ),
      "column",
      "start",
      "flow",
      { wrap: "nowrap", stretchItems: true },
    );
    const margin = { top: 0, right: 4, bottom: 0, left: 4 };
    const insertion = {
      container: root,
      index: 1,
      entry: {
        // Deliberately oversized base: the source container was wider.
        ...virtualEntrySizeFor(root, { width: 500, height: 40, margin }),
        margin,
      },
    };
    const origin = contentRect(root.box);
    const result = flowLayoutPositions(root, origin.x, origin.y, {
      insertions: [insertion],
    });
    const rect = result.virtualRects.get(insertion)!;
    expect(Math.abs(rect.width - measured.spacer.width)).toBeLessThanOrEqual(
      1.25,
    );
    expect(Math.abs(rect.y - measured.spacer.y)).toBeLessThanOrEqual(1.25);
  });
});
