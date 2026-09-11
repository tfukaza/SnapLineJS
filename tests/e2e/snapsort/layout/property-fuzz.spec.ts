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

  test("layout simulation invariants hold across randomized containers (property fuzz)", async ({
    page,
  }, testInfo) => {
    // Property-based ground truth: instead of hand-picked scenarios, build
    // seeded-random containers and assert invariants that must hold for ANY
    // layout the engine claims to support:
    //
    // - identity: simulating with no exclusions/insertions reproduces the
    //   browser's measured positions;
    // - away-and-back: excluding item k and inserting a same-size ghost at
    //   index k is a no-op — every other item stays put and the ghost lands
    //   on item k's measured rect;
    // - locality: a ghost at index k never moves an entry before index k
    //   (compared against the identity simulation, so the bound is exact).
    //
    // The generator stays inside the engine's stated envelope (uniform gaps,
    // no per-item margins, LTR, no spans); failures record their seed for
    // deterministic repro.
    const TOLERANCE = 1.25;
    const caseCount = 36;

    await page.setContent('<main id="property-fixture"></main>');
    const measured = await page.evaluate((caseCount) => {
      const fixture = document.querySelector(
        "#property-fixture",
      ) as HTMLElement;
      let seed = 20260708;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
      const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
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

      const cases = [];
      for (let index = 0; index < caseCount; index++) {
        const caseSeed = seed;
        const kind = rand() < 0.6 ? "flow" : "slots";
        const width = between(240, 520);
        const gap = int(2, 12);
        const pad = int(0, 12);
        const border = int(0, 3);
        const count = int(8, 16);

        fixture.innerHTML = "";
        const container = document.createElement("section");
        let containerCss =
          `box-sizing:border-box;width:${width}px;padding:${pad}px;` +
          `border:${border}px solid #111;`;
        if (kind === "flow") {
          containerCss +=
            "display:flex;flex-direction:row;flex-wrap:wrap;" +
            `align-items:flex-start;align-content:flex-start;gap:${gap}px;`;
        } else {
          const templates = [
            `repeat(${int(3, 5)}, 1fr)`,
            `repeat(auto-fill, minmax(${int(60, 90)}px, 1fr))`,
            Array.from({ length: int(3, 4) }, () => `${int(50, 120)}px`).join(
              " ",
            ),
          ];
          containerCss +=
            `display:grid;grid-template-columns:${templates[int(0, 2)]};` +
            `gap:${gap}px;`;
        }
        container.style.cssText = containerCss;
        fixture.appendChild(container);
        for (let i = 0; i < count; i++) {
          const item = document.createElement("div");
          let itemCss = `box-sizing:border-box;height:${int(24, 64)}px;background:#dbeafe;`;
          if (kind === "flow") itemCss += `width:${between(30, 110)}px;`;
          item.style.cssText = itemCss;
          container.appendChild(item);
        }
        cases.push({
          caseSeed,
          kind,
          container: boxOf(container),
          items: [...container.children].map((element) =>
            boxOf(element as HTMLElement),
          ),
        });
      }
      return cases;
    }, caseCount);

    const failures: Array<{
      caseSeed: number;
      kind: string;
      property: string;
      detail: string;
      delta: number;
    }> = [];
    const distance = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

    for (const propertyCase of measured) {
      const root = makeContainerSnapshot(
        propertyCase.container as Box,
        propertyCase.items.map((box, index) =>
          makeItemSnapshot(`${index}`, box as Box),
        ),
        "row",
        "start",
        propertyCase.kind as "flow" | "slots",
      );
      const origin = contentRect(root.box);
      const record = (property: string, detail: string, delta: number) =>
        failures.push({
          caseSeed: propertyCase.caseSeed,
          kind: propertyCase.kind,
          property,
          detail,
          delta: +delta.toFixed(2),
        });

      // Identity: the simulation of the unmodified container must reproduce
      // the measured layout.
      const identity = flowLayoutPositions(root, origin.x, origin.y);
      for (const child of root.children) {
        const delta = distance(identity.itemPositions.get(child)!, child.box);
        if (delta > TOLERANCE) record("identity", `item-${child.value}`, delta);
      }

      const count = root.children.length;
      for (const k of [0, Math.floor(count / 2), count - 1]) {
        const target = root.children[k];

        // Away-and-back: excluding item k and inserting an identical ghost
        // at index k must be a no-op.
        const insertion = {
          container: root,
          index: k,
          entry: {
            width: target.box.width,
            height: target.box.height,
            margin: target.box.margin,
          },
        };
        const roundTrip = flowLayoutPositions(root, origin.x, origin.y, {
          exclude: (node) => node === target,
          insertions: [insertion],
        });
        for (const child of root.children) {
          if (child === target) continue;
          const delta = distance(
            roundTrip.itemPositions.get(child)!,
            child.box,
          );
          if (delta > TOLERANCE) {
            record("away-and-back", `k=${k} item-${child.value}`, delta);
          }
        }
        const ghost = roundTrip.virtualRects.get(insertion)!;
        const ghostDelta = distance(ghost, target.box);
        if (ghostDelta > TOLERANCE) {
          record("away-and-back", `k=${k} ghost`, ghostDelta);
        }

        // Locality: inserting at index k (no exclusion) must not move any
        // entry before k. Compared against the identity simulation, so this
        // bound is exact rather than tolerance-based.
        const inserted = flowLayoutPositions(root, origin.x, origin.y, {
          insertions: [
            {
              container: root,
              index: k,
              entry: {
                width: target.box.width,
                height: target.box.height,
                margin: target.box.margin,
              },
            },
          ],
        });
        for (let i = 0; i < k; i++) {
          const child = root.children[i];
          const delta = distance(
            inserted.itemPositions.get(child)!,
            identity.itemPositions.get(child)!,
          );
          if (delta > 0.01) record("locality", `k=${k} item-${i}`, delta);
        }
      }
    }

    await writeJson(testInfo.outputPath("layout-property-fuzz.json"), {
      caseCount: measured.length,
      failures: failures.slice(0, 40),
    });
    expect(
      failures.slice(0, 8),
      "identity / away-and-back / locality invariants should hold for every generated container",
    ).toHaveLength(0);
  });
});
