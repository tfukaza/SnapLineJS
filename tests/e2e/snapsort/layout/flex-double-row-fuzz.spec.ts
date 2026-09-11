import { expect, test } from "@playwright/test";
import { contentRect } from "../../../../src/geometry";
import { virtualInsertionPosition } from "../../../helpers/snapsort-fixtures";
import {
  horizontalDoubleRowLayoutCases,
  layoutNodeFromBrowserCase,
  measureBrowserLayoutCases,
} from "../_support/layout-parity";
import { writeJson } from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test("matches browser flex ghost positions for horizontal double-row fuzz cases", async ({
    page,
  }, testInfo) => {
    const cases = horizontalDoubleRowLayoutCases();
    const measuredCases = await measureBrowserLayoutCases(page, cases);
    const failures: Array<{
      name: string;
      index: number;
      expected: { x: number; y: number };
      actual: { x: number; y: number };
      delta: { x: number; y: number };
    }> = [];

    for (const measuredCase of measuredCases) {
      const root = layoutNodeFromBrowserCase(measuredCase);
      const dragged = root.children.find(
        (item) => item.value === measuredCase.draggedId,
      );
      expect(
        dragged,
        `dragged item should exist for ${measuredCase.name}`,
      ).toBeTruthy();

      const origin = contentRect(measuredCase.container);
      for (const actual of measuredCase.actualGhosts) {
        const simulated = virtualInsertionPosition(
          root,
          dragged!,
          origin.x,
          origin.y,
          actual.index,
          measuredCase.ghost.width,
          measuredCase.ghost.height,
        );
        expect(
          simulated,
          `simulated ghost should exist for ${measuredCase.name}[${actual.index}]`,
        ).toBeTruthy();

        const delta = {
          x: Math.abs(simulated!.x - actual.x),
          y: Math.abs(simulated!.y - actual.y),
        };
        if (delta.x > 1.25 || delta.y > 1.25) {
          failures.push({
            name: measuredCase.name,
            index: actual.index,
            expected: { x: actual.x, y: actual.y },
            actual: simulated!,
            delta,
          });
        }
      }
    }

    await writeJson(
      testInfo.outputPath("horizontal-double-row-layout-fuzz.json"),
      {
        caseCount: measuredCases.length,
        slotCount: measuredCases.reduce(
          (count, measuredCase) => count + measuredCase.actualGhosts.length,
          0,
        ),
        failures,
      },
    );

    expect(
      failures.slice(0, 8),
      "layout engine ghost positions should match browser flex positions within 1.25px",
    ).toHaveLength(0);
  });
});
