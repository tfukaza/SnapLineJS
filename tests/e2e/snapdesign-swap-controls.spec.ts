import { expect, test } from "@playwright/test";

test("runs independent gallery drags concurrently", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const coreImportPath = `/@fs${process.cwd()}/src/index.ts`;
  const pointerImportPath =
    "/src/routes/snapdesign/gallery/virtual-pointer.ts";
  const report = await page.evaluate(
    async ({ coreImportPath, pointerImportPath }) => {
      const [{ GlobalManager }, { VirtualPointerController }] =
        await Promise.all([
          import(coreImportPath),
          import(pointerImportPath),
        ]);
      const requireElement = <ElementType extends Element>(selector: string) => {
        const element = document.querySelector<ElementType>(selector);
        if (!element) throw new Error(`Missing concurrency target: ${selector}`);
        return element;
      };

      const swapRootElement = requireElement<HTMLElement>(
        '[data-demo="swap-mode"]',
      );
      const sidewaysRootElement = requireElement<HTMLElement>(
        '[data-demo="sideways-insert"]',
      );
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const swapRoot = containers.find(
        (container: { element?: Element }) =>
          container.element === swapRootElement,
      );
      const sidewaysRoot = containers.find(
        (container: { element?: Element }) =>
          container.element === sidewaysRootElement,
      );
      if (
        !swapRoot ||
        !sidewaysRoot ||
        swapRoot.engine !== sidewaysRoot.engine
      ) {
        throw new Error("Independent gallery roots do not share one engine.");
      }

      const swapDemo = requireElement<HTMLElement>(".swap-stage");
      const sidewaysDemo = requireElement<HTMLElement>(".sideways-demo");
      const swapHandle = requireElement<HTMLElement>(
        '[data-swap-label="A"] .swap-tile-label',
      );
      const sidewaysHandle = requireElement<HTMLElement>(
        '[data-sideways-card-id="side-discover"] .playing-card',
      );
      const swapCursor = swapDemo.querySelector<HTMLElement>(
        "[data-virtual-pointer]",
      );
      const sidewaysCursor = sidewaysDemo.querySelector<HTMLElement>(
        "[data-virtual-pointer]",
      );
      if (!swapCursor || !sidewaysCursor) {
        throw new Error("Concurrent virtual pointers are missing.");
      }

      const controller = new AbortController();
      const swapPointer = new VirtualPointerController(
        swapRoot.engine,
        swapCursor,
        {
          coordinateRoot: swapDemo,
          signal: controller.signal,
          pointerId: 2_000_000_101,
        },
      );
      const sidewaysPointer = new VirtualPointerController(
        sidewaysRoot.engine,
        sidewaysCursor,
        {
          coordinateRoot: sidewaysDemo,
          signal: controller.signal,
          pointerId: 2_000_000_102,
        },
      );

      try {
        await Promise.all([
          swapPointer.moveTo(swapHandle, { duration: 0 }),
          sidewaysPointer.moveTo(sidewaysHandle, { duration: 0 }),
        ]);
        await Promise.all([
          swapPointer.press(swapHandle),
          sidewaysPointer.press(sidewaysHandle),
        ]);
        await swapPointer.activateDrag();
        await swapPointer.waitUntil(
          () => swapRoot.dragSession?.status === "active",
        );
        await sidewaysPointer.activateDrag();
        await sidewaysPointer.waitUntil(
          () => sidewaysRoot.dragSession?.status === "active",
        );

        const activePointerIds = [
          swapRoot.dragSession?.pointerId,
          sidewaysRoot.dragSession?.pointerId,
        ];
        const simultaneous = activePointerIds.every(
          (pointerId) => pointerId != null,
        );

        if (swapPointer.pressed) await swapPointer.release();
        if (sidewaysPointer.pressed) await sidewaysPointer.release();
        await Promise.all([
          swapPointer.waitUntil(() => swapRoot.dragSession == null),
          sidewaysPointer.waitUntil(() => sidewaysRoot.dragSession == null),
        ]);

        return {
          activePointerIds,
          simultaneous,
          sessionsEnded:
            swapRoot.dragSession == null && sidewaysRoot.dragSession == null,
        };
      } finally {
        controller.abort();
        swapPointer.destroy();
        sidewaysPointer.destroy();
      }
    },
    { coreImportPath, pointerImportPath },
  );

  expect(report).toEqual({
    activePointerIds: [2_000_000_101, 2_000_000_102],
    simultaneous: true,
    sessionsEnded: true,
  });
  expect(pageErrors).toEqual([]);
});

test("starts every gallery autoplay reel without viewport entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  await expect(page.locator(".todo-demo")).toHaveAttribute(
    "data-todo-autoplay-active",
    "true",
  );
  await expect(page.locator(".nested-demo")).toHaveAttribute(
    "data-nested-autoplay-active",
    "true",
  );
  await expect(page.locator(".sideways-demo")).toHaveAttribute(
    "data-sideways-autoplay-active",
    "true",
  );
  await expect(page.locator("[data-lesson-active]")).toHaveAttribute(
    "data-lesson-active",
    "true",
  );
  await expect(page.locator("[data-control-matrix]")).toHaveAttribute(
    "data-control-autoplay-active",
    "true",
  );
  await expect(page.locator(".swap-stage")).toHaveAttribute(
    "data-swap-autoplay-active",
    "true",
  );
});

test("swap controls use centered ten-degree dials without starting a tile drag", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="swap-mode"]');
  await exhibit.scrollIntoViewIfNeeded();
  const swapItems = exhibit.locator(".swap-grid > .snapsort-item");
  const labels = () =>
    swapItems.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-swap-label")),
    );

  const dial = exhibit.getByRole("slider", { name: "Dial A" });
  const markers = dial.locator(".dial-marker");
  await expect(markers).toHaveCount(36);
  await expect(dial).toHaveAttribute("aria-valuenow", "40");
  const dialBody = dial.locator(".dial-body");
  await expect(dialBody).toHaveCSS("--material-shadow-far-blur", "11.25px");
  await expect(dialBody).toHaveCSS("--material-rim-width", "1.75px");

  const markerGeometry = await dial.evaluate((element) => {
    const dialRect = element.getBoundingClientRect();
    const markerRects = [
      ...element.querySelectorAll<HTMLElement>(".dial-marker"),
    ].map((marker) => marker.getBoundingClientRect());
    const centers = markerRects.map((rect) => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }));
    return {
      dialCenterX: dialRect.left + dialRect.width / 2,
      dialCenterY: dialRect.top + dialRect.height / 2,
      markerCenterX:
        centers.reduce((sum, center) => sum + center.x, 0) / centers.length,
      markerCenterY:
        centers.reduce((sum, center) => sum + center.y, 0) / centers.length,
    };
  });
  expect(markerGeometry.markerCenterX).toBeCloseTo(
    markerGeometry.dialCenterX,
    2,
  );
  expect(markerGeometry.markerCenterY).toBeCloseTo(
    markerGeometry.dialCenterY,
    2,
  );

  const dialBox = await dial.boundingBox();
  if (!dialBox) throw new Error("Swap dial geometry is missing");
  await dial.click({
    position: { x: dialBox.width - 2, y: dialBox.height / 2 },
  });
  await expect(dial).toHaveAttribute("aria-valuenow", "90");
  await expect.poll(labels).toEqual(["A", "B", "C", "D", "E", "F"]);
  await expect(exhibit.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);

  const lcdGeometry = await exhibit
    .locator(".lcd-tile")
    .first()
    .evaluate((tile) => {
      const display = tile.querySelector<HTMLElement>(".code-lcd-display");
      if (!display) throw new Error("Swap LCD display is missing");
      const tileRect = tile.getBoundingClientRect();
      const displayRect = display.getBoundingClientRect();
      return {
        top: displayRect.top - tileRect.top,
        right: tileRect.right - displayRect.right,
        bottom: tileRect.bottom - displayRect.bottom,
        left: displayRect.left - tileRect.left,
        radius: getComputedStyle(display).borderRadius,
      };
    });
  expect(lcdGeometry.top).toBeCloseTo(4, 1);
  expect(lcdGeometry.right).toBeCloseTo(4, 1);
  expect(lcdGeometry.bottom).toBeCloseTo(4, 1);
  expect(lcdGeometry.left).toBeCloseTo(4, 1);
  expect(lcdGeometry.radius).toBe("12px");
  expect(pageErrors).toEqual([]);
});

test("autoplays A with F and then C with D through swap mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="swap-mode"]');
  const demo = exhibit.locator(".swap-stage");
  await expect(demo).toHaveAttribute("data-swap-autoplay-active", "true");

  await expect(demo).toHaveAttribute("data-swap-order", "F,B,C,D,E,A", {
    timeout: 8_000,
  });
  await expect(demo).toHaveAttribute("data-swap-order", "F,B,D,C,E,A", {
    timeout: 5_000,
  });
  await expect(demo).toHaveAttribute("data-swap-phase", "complete");
  await expect(demo.locator("[data-virtual-pointer]")).toHaveAttribute(
    "data-virtual-pointer-state",
    "visible",
  );
  expect(pageErrors).toEqual([]);
});
