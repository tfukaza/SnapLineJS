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

  test("animates displaced items when the ghost reorders", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item1 = await itemByTextIn(verticalColumn, "Item 1");
    const item4 = await itemByTextIn(verticalColumn, "Item 4");
    const item1Center = center(await itemRect(item1));
    const item4Center = center(await itemRect(item4));

    await page.mouse.move(item1Center.x, item1Center.y);
    await page.mouse.down();

    // Arm a style-attribute observer before the reorder: polling for the
    // inline transform can miss a FLIP that starts and settles between polls
    // (WebKit clears the transform quickly on fast machines).
    await page.evaluate(() => {
      const win = window as unknown as {
        __sawDisplacedTransform?: boolean;
        __displacedObserver?: MutationObserver;
      };
      win.__sawDisplacedTransform = false;
      const isDisplaced = (element: Element) =>
        element.id !== "spacer" && !/Item 1/.test(element.textContent ?? "");
      const check = (element: Element) => {
        if (
          isDisplaced(element) &&
          /^translate3d\(/.test((element as HTMLElement).style.transform)
        ) {
          win.__sawDisplacedTransform = true;
        }
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) check(mutation.target as Element);
      });
      for (const element of document.querySelectorAll(".snapsort-item")) {
        observer.observe(element, {
          attributes: true,
          attributeFilter: ["style"],
        });
        check(element);
      }
      win.__displacedObserver = observer;
    });

    // Pace the moves like a human drag: a single burst of interpolated moves
    // can be delivered entirely before the drag session finishes activating
    // (observed on WebKit), leaving no post-activation pointermove and thus
    // no reorder to animate.
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(
        item1Center.x,
        item1Center.y + ((item4Center.y - item1Center.y) * step) / 12,
      );
      await page.waitForTimeout(16);
    }

    const animated = await page.waitForFunction(
      () =>
        (window as unknown as { __sawDisplacedTransform?: boolean })
          .__sawDisplacedTransform === true,
    );
    await page.mouse.up();
    await page.waitForTimeout(120);

    await writeJson(testInfo.outputPath("reorder-animation-trace.json"), {
      animated: await animated.jsonValue(),
      errors: consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    });

    expect(await animated.jsonValue()).toBe(true);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });

  test("animates siblings when a flow ghost leaves and re-enters a valid container", async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const multipleAreas = await demoBoxByHeading(page, "Multiple Drop Areas");
    const itemA = await itemByTextIn(multipleAreas, "Item A");
    const itemY = await itemByTextIn(multipleAreas, "Item Y");
    const containers = multipleAreas.locator(".snapsort-container");
    const area1 = containers.nth(1);
    const area2 = containers.nth(2);
    const targetSpacers = area2.locator(
      '[data-snapsort-ghost-entry="target-spacer"]',
    );
    const sourceBox = await itemRect(itemA);
    const start = center(sourceBox);
    const initialTarget = center(await itemRect(itemY));

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let step = 1; step <= 14; step++) {
      await page.mouse.move(
        start.x + ((initialTarget.x - start.x) * step) / 14,
        start.y + ((initialTarget.y - start.y) * step) / 14,
      );
      await page.waitForTimeout(16);
    }
    await expect(targetSpacers).toHaveCount(1);
    await expect
      .poll(() =>
        area2
          .locator(".snapsort-item")
          .evaluateAll((elements) =>
            elements.every(
              (element) => !(element as HTMLElement).style.transform,
            ),
          ),
      )
      .toBe(true);

    await area2.evaluate((container) => {
      type Phase = "idle" | "removal" | "insertion";
      interface FlowGhostFlipTrace {
        phase: Phase;
        removal: string[];
        insertion: string[];
      }
      const win = window as unknown as {
        __flowGhostFlipTrace?: FlowGhostFlipTrace;
        __flowGhostFlipObserver?: MutationObserver;
      };
      const trace: FlowGhostFlipTrace = {
        phase: "idle",
        removal: [],
        insertion: [],
      };
      const check = (element: Element) => {
        const transform = (element as HTMLElement).style.transform;
        if (!/^translate3d\(/.test(transform)) return;
        const hasSpacer = Boolean(
          container.querySelector(
            '[data-snapsort-ghost-entry="target-spacer"]',
          ),
        );
        const label = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
        if (trace.phase === "removal" && !hasSpacer) {
          trace.removal.push(`${label}: ${transform}`);
        } else if (trace.phase === "insertion" && hasSpacer) {
          trace.insertion.push(`${label}: ${transform}`);
        }
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) check(mutation.target as Element);
      });
      for (const element of container.querySelectorAll(".snapsort-item")) {
        observer.observe(element, {
          attributes: true,
          attributeFilter: ["style"],
        });
      }
      win.__flowGhostFlipTrace = trace;
      win.__flowGhostFlipObserver = observer;
    });

    const setTracePhase = async (phase: "idle" | "removal" | "insertion") =>
      page.evaluate((nextPhase) => {
        const trace = (
          window as unknown as {
            __flowGhostFlipTrace?: { phase: typeof nextPhase };
          }
        ).__flowGhostFlipTrace;
        if (!trace) throw new Error("Missing flow ghost FLIP trace.");
        trace.phase = nextPhase;
      }, phase);
    const traceCounts = () =>
      page.evaluate(() => {
        const trace = (
          window as unknown as {
            __flowGhostFlipTrace?: {
              removal: string[];
              insertion: string[];
            };
          }
        ).__flowGhostFlipTrace;
        return {
          removal: trace?.removal.length ?? 0,
          insertion: trace?.insertion.length ?? 0,
        };
      });

    const [area1Box, area2Box] = await Promise.all([
      area1.boundingBox(),
      area2.boundingBox(),
    ]);
    if (!area1Box || !area2Box) {
      throw new Error("Expected visible drop areas.");
    }
    const invalidPoint = {
      x: area2Box.x + area2Box.width / 2,
      // Progressive candidates expand their broad-phase main-axis band by
      // twice the dragged height, so leave a second full band of clearance.
      y: Math.min(area1Box.y, area2Box.y) - sourceBox.height * 4,
    };

    await setTracePhase("removal");
    await page.mouse.move(invalidPoint.x, invalidPoint.y);
    await expect(targetSpacers).toHaveCount(0);
    await expect
      .poll(async () => (await traceCounts()).removal)
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        area2
          .locator(".snapsort-item")
          .evaluateAll((elements) =>
            elements.every(
              (element) => !(element as HTMLElement).style.transform,
            ),
          ),
      )
      .toBe(true);

    const reentryTarget = center(await itemRect(itemY));
    await setTracePhase("insertion");
    await page.mouse.move(reentryTarget.x, reentryTarget.y);
    await expect(targetSpacers).toHaveCount(1);
    await expect
      .poll(async () => (await traceCounts()).insertion)
      .toBeGreaterThan(0);

    await setTracePhase("idle");
    await page.mouse.up();
    await expect(
      page.locator('[data-snapsort-ghost-entry="target-spacer"]'),
    ).toHaveCount(0);
    const trace = await page.evaluate(() => {
      const win = window as unknown as {
        __flowGhostFlipTrace?: {
          removal: string[];
          insertion: string[];
        };
        __flowGhostFlipObserver?: MutationObserver;
      };
      win.__flowGhostFlipObserver?.disconnect();
      return win.__flowGhostFlipTrace ?? { removal: [], insertion: [] };
    });
    await writeJson(testInfo.outputPath("flow-ghost-frame-flip.json"), {
      invalidPoint,
      trace,
      pageErrors,
    });

    expect(trace.removal.length).toBeGreaterThan(0);
    expect(trace.insertion.length).toBeGreaterThan(0);
    expect(pageErrors).toHaveLength(0);
  });

  test("animates displaced items when the ghost reorders upward", async ({
    page,
  }, testInfo) => {
    // Mirror of the downward test above. Upward reorders place the ghost
    // BEFORE the displaced items in FLIP snapshot order, so a failure while
    // animating the ghost entry silently kills every displaced-item
    // animation — a class of bug the downward drag cannot catch.
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item1 = await itemByTextIn(verticalColumn, "Item 1");
    const item4 = await itemByTextIn(verticalColumn, "Item 4");
    const item1Center = center(await itemRect(item1));
    const item4Center = center(await itemRect(item4));

    await page.mouse.move(item4Center.x, item4Center.y);
    await page.mouse.down();

    await page.evaluate(() => {
      const win = window as unknown as {
        __sawDisplacedTransform?: boolean;
        __displacedObserver?: MutationObserver;
      };
      win.__sawDisplacedTransform = false;
      const isDisplaced = (element: Element) =>
        element.id !== "spacer" && !/Item 4/.test(element.textContent ?? "");
      const check = (element: Element) => {
        if (
          isDisplaced(element) &&
          /^translate3d\(/.test((element as HTMLElement).style.transform)
        ) {
          win.__sawDisplacedTransform = true;
        }
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) check(mutation.target as Element);
      });
      for (const element of document.querySelectorAll(".snapsort-item")) {
        observer.observe(element, {
          attributes: true,
          attributeFilter: ["style"],
        });
        check(element);
      }
      win.__displacedObserver = observer;
    });

    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(
        item4Center.x,
        item4Center.y + ((item1Center.y - item4Center.y) * step) / 12,
      );
      await page.waitForTimeout(16);
    }

    const animated = await page.waitForFunction(
      () =>
        (window as unknown as { __sawDisplacedTransform?: boolean })
          .__sawDisplacedTransform === true,
    );
    await page.mouse.up();
    await page.waitForTimeout(120);

    await writeJson(
      testInfo.outputPath("reorder-animation-upward-trace.json"),
      {
        animated: await animated.jsonValue(),
        errors: consoleMessages.filter((message) =>
          /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
            message,
          ),
        ),
      },
    );

    expect(await animated.jsonValue()).toBe(true);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });
});
