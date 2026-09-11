import { expect, test } from "@playwright/test";
import { center } from "../../../helpers/snapsort-fixtures";
import {
  demoBoxByHeading,
  installSnapsortTrace,
  itemByTextIn,
  itemRect,
  writeJson,
} from "../_support/drag-harness";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("drops land where the drag preview predicted (drift oracle)", async ({
    page,
  }, testInfo) => {
    // The mid-drag preview IS the layout engine's prediction: displaced
    // items sit at simulated positions and the spacer marks the dragged
    // item's landing slot. After the drop, the framework re-renders and the
    // browser performs the real layout — the authoritative ground truth.
    // Comparing the settled DOM against the last preview turns any real
    // drag into a layout-engine oracle: drift means the simulation and the
    // browser disagreed about the committed arrangement.
    const TOLERANCE = 1.5;
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");

    const dragWithOracle = async (
      sourceText: string,
      target: { x: number; y: number },
      label: string,
    ) => {
      const source = await itemByTextIn(verticalColumn, sourceText);
      const start = center(await itemRect(source));
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      for (let step = 1; step <= 14; step++) {
        await page.mouse.move(
          start.x + ((target.x - start.x) * step) / 14,
          start.y + ((target.y - start.y) * step) / 14,
        );
        await page.waitForTimeout(16);
      }
      // Let the preview settle so captured rects are the engine's final
      // prediction, not a mid-animation frame.
      await page.waitForTimeout(350);

      const prediction = await verticalColumn.evaluate((box, dragged) => {
        const out: Record<string, { x: number; y: number }> = {};
        for (const element of box.querySelectorAll(".snapsort-item")) {
          const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
          if (element.id === "spacer" || text.includes(dragged)) continue;
          const rect = element.getBoundingClientRect();
          out[text] = { x: rect.x, y: rect.y };
        }
        const spacer = box.querySelector("#spacer");
        if (spacer) {
          const rect = spacer.getBoundingClientRect();
          out["__dragged__"] = { x: rect.x, y: rect.y };
        }
        return out;
      }, sourceText);

      await page.mouse.up();
      await page.waitForTimeout(500);

      const settled = await verticalColumn.evaluate((box, dragged) => {
        const out: Record<string, { x: number; y: number }> = {};
        for (const element of box.querySelectorAll(".snapsort-item")) {
          const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const rect = element.getBoundingClientRect();
          out[text.includes(dragged) ? "__dragged__" : text] = {
            x: rect.x,
            y: rect.y,
          };
        }
        return out;
      }, sourceText);

      const drifts: Array<{ label: string; entry: string; delta: number }> = [];
      let compared = 0;
      for (const [entry, predicted] of Object.entries(prediction)) {
        const actual = settled[entry];
        if (!actual) continue;
        compared++;
        const delta = Math.max(
          Math.abs(predicted.x - actual.x),
          Math.abs(predicted.y - actual.y),
        );
        if (delta > TOLERANCE)
          drifts.push({ label, entry, delta: +delta.toFixed(2) });
      }
      // Guard against a vacuous pass: the oracle must have compared the
      // dragged item's landing slot plus the displaced items.
      expect(
        compared,
        `oracle should compare several entries for ${label}`,
      ).toBeGreaterThanOrEqual(4);
      expect(
        prediction.__dragged__,
        `spacer prediction should exist for ${label}`,
      ).toBeTruthy();
      return drifts;
    };

    const item3 = await itemByTextIn(verticalColumn, "Item 3");
    const item3Center = center(await itemRect(item3));
    const item4 = await itemByTextIn(verticalColumn, "Item 4");
    const item4Rect = await itemRect(item4);

    const allDrifts = [
      // Reorder downward past two slots.
      ...(await dragWithOracle("Item 1", item3Center, "item1-to-item3")),
      // Reach the final slot (past the last item's bottom edge).
      ...(await dragWithOracle(
        "Item 2",
        {
          x: item4Rect.x + item4Rect.width / 2,
          y: item4Rect.y + item4Rect.height * 1.05,
        },
        "item2-to-final-slot",
      )),
    ];

    await writeJson(testInfo.outputPath("drop-drift-oracle.json"), {
      drifts: allDrifts,
    });
    expect(
      allDrifts,
      "settled post-drop positions should match the drag preview's prediction",
    ).toHaveLength(0);
  });

  test("keeps the spacer stable while dragging into a narrower nested container (stretch flicker regression)", async ({
    page,
  }, testInfo) => {
    // Before `stretchItems`, insertion entries kept the dragged item's
    // source-container size everywhere, so nested candidates' ghost rects
    // and centers were computed at parent width — candidate scoring
    // flip-flopped between parent and nested slots as the pointer moved and
    // the spacer visibly oscillated between containers. The Stretch Nested
    // demo cell's items are genuinely 100% width and its containers declare
    // `stretchItems`, so the spacer host must settle: at most a couple of
    // transitions on the way in, ending inside the nested sub-list, with
    // the drop committing there.
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const nested = await demoBoxByHeading(page, "Stretch Nested");
    const source = await itemByTextIn(nested, "Task 1");
    const target = await itemByTextIn(nested, "Sub task 2");
    const start = center(await itemRect(source));
    const end = center(await itemRect(target));

    const spacerHost = () =>
      nested.evaluate((box) => {
        const spacer = box.querySelector("#spacer");
        if (!spacer) return "none";
        const container = spacer.closest(".snapsort-container");
        if (!container) return "unknown";
        return container.classList.contains("stretch-sublist")
          ? "nested"
          : "parent";
      });

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const hosts: string[] = [];
    const steps = 24;
    for (let step = 1; step <= steps; step++) {
      await page.mouse.move(
        start.x + ((end.x - start.x) * step) / steps,
        start.y + ((end.y - start.y) * step) / steps,
      );
      await page.waitForTimeout(16);
      hosts.push(await spacerHost());
    }
    await page.waitForTimeout(350);
    hosts.push(await spacerHost());

    // The core of the fix: once the spacer is hosted by the narrower
    // sublist, it must be re-sized to the sublist's content width (minus
    // its own margins) rather than keeping the parent-container width it
    // was measured at.
    const spacerSizing = await nested.evaluate((box) => {
      const spacer = box.querySelector("#spacer") as HTMLElement | null;
      const sublist = box.querySelector(
        ".stretch-sublist",
      ) as HTMLElement | null;
      if (!spacer || !sublist) return null;
      const spacerRect = spacer.getBoundingClientRect();
      const style = getComputedStyle(sublist);
      const spacerStyle = getComputedStyle(spacer);
      const number = (value: string) => parseFloat(value) || 0;
      const contentWidth =
        sublist.getBoundingClientRect().width -
        number(style.borderLeftWidth) -
        number(style.borderRightWidth) -
        number(style.paddingLeft) -
        number(style.paddingRight);
      const expected =
        contentWidth -
        number(spacerStyle.marginLeft) -
        number(spacerStyle.marginRight);
      return { spacerWidth: spacerRect.width, expected };
    });
    expect(spacerSizing, "spacer should be inside the sublist").toBeTruthy();
    expect(
      Math.abs(spacerSizing!.spacerWidth - spacerSizing!.expected),
      `spacer width ${spacerSizing!.spacerWidth} should match the sublist's content width ${spacerSizing!.expected}`,
    ).toBeLessThanOrEqual(1.5);

    // Drift oracle for the nested drop: preview rects just before release
    // vs the settled DOM afterward.
    const prediction = await nested.evaluate((box) => {
      const out: Record<string, { x: number; y: number }> = {};
      for (const element of box.querySelectorAll(".snapsort-item")) {
        const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
        if (element.id === "spacer" || text === "Task 1") continue;
        if (!/^Sub task \d$/.test(text)) continue;
        const rect = element.getBoundingClientRect();
        out[text] = { x: rect.x, y: rect.y };
      }
      const spacer = box.querySelector("#spacer");
      if (spacer) {
        const rect = spacer.getBoundingClientRect();
        out["__dragged__"] = { x: rect.x, y: rect.y };
      }
      return out;
    });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const settled = await nested.evaluate((box) => {
      const out: Record<string, { x: number; y: number }> = {};
      for (const element of box.querySelectorAll(".snapsort-item")) {
        const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
        const rect = element.getBoundingClientRect();
        if (text === "Task 1") out["__dragged__"] = { x: rect.x, y: rect.y };
        else if (/^Sub task \d$/.test(text))
          out[text] = { x: rect.x, y: rect.y };
      }
      return out;
    });
    const drifts: Array<{ entry: string; delta: number }> = [];
    for (const [entry, predicted] of Object.entries(prediction)) {
      const actual = settled[entry];
      if (!actual) continue;
      const delta = Math.max(
        Math.abs(predicted.x - actual.x),
        Math.abs(predicted.y - actual.y),
      );
      if (delta > 1.5) drifts.push({ entry, delta: +delta.toFixed(2) });
    }

    const transitions = hosts.filter(
      (host, index) => index > 0 && host !== hosts[index - 1],
    ).length;
    const subGroupTexts = await nested.evaluate((box) =>
      [...box.querySelectorAll(".stretch-sublist .snapsort-item")].map(
        (element) => element.textContent?.trim().replace(/\s+/g, " ") ?? "",
      ),
    );

    await writeJson(testInfo.outputPath("nested-stretch-flicker.json"), {
      hosts,
      transitions,
      drifts,
      subGroupTexts,
    });
    expect(
      hosts[hosts.length - 1],
      "spacer should end in the nested sub-list",
    ).toBe("nested");
    expect(
      transitions,
      "spacer host must not oscillate between parent and nested containers",
    ).toBeLessThanOrEqual(2);
    expect(
      drifts,
      "nested drop should land where the preview predicted",
    ).toHaveLength(0);
    expect(
      subGroupTexts.some((text) => text.includes("Task 1")),
      "the dragged item should commit into the nested sub-list",
    ).toBe(true);
  });
});
