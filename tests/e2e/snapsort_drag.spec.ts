/**
 * Snapsort drag/drop flicker regression test.
 *
 * Reproduces the reported bug where, while dragging an item, the drop ghost
 * (a) sits far from the cursor and (b) flickers (jumps back and forth) between frames.
 *
 * Root cause: the drag-start layout snapshot froze each item at its absolute position,
 * which still included the gap the dragged item occupied. Once the dragged item is
 * removed the real DOM closes that gap and everything below shifts up, so the frozen
 * candidate slots were offset by ~one item height and the chosen slot oscillated.
 *
 * This test drives a real pointer drag down a column, samples the ghost element's
 * position every frame, and asserts:
 *   1. ghost tracks the cursor   — |ghostCenterY - mouseY| stays small throughout;
 *   2. no flicker                — as the cursor moves monotonically down, the ghost's
 *                                  position is (near-)monotonic: few direction reversals.
 *
 * It also captures the layout engine's per-frame "chosen" decision (from the
 * LAYOUT_TRACE console output) and writes a frame-by-frame log + screenshots to
 * test-results/ for inspection.
 *
 * Requires the SVELTE demo server on :3001, e.g.:
 *   start-server-and-test server:svelte http://localhost:3001 \
 *     'playwright test tests/e2e/snapsort_drag.spec.ts --project=chromium'
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const port = 3001;
const OUT_DIR = path.resolve("test-results", "snapsort-drag");

interface Frame {
  step: number;
  mouseY: number;
  ghostTop: number | null;
  ghostCenterY: number | null;
  chosen: string | null; // last layout-engine decision seen before this sample
}

/** Read the live ghost spacer element's bounding rect from the page. */
async function readGhost(
  page: Page,
): Promise<{ top: number; height: number } | null> {
  return page.evaluate(() => {
    const el = document.querySelector(".ghost") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, height: r.height };
  });
}

test.describe("Snapsort drag ghost should track the cursor without flickering", () => {
  test("dragging an item down a column keeps the ghost under the cursor and monotonic", async ({
    page,
  }) => {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // Capture the layout engine's per-frame drop decision from the console trace.
    let lastChosen: string | null = null;
    const chosenLog: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      const m = text.match(
        /✔ chosen\s+container=(\S+)\s+idx=(\d+)\s+ghost=\(([-\d]+),([-\d]+)\)/,
      );
      if (m) {
        lastChosen = `container=${m[1]} idx=${m[2]} ghost=(${m[3]},${m[4]})`;
        chosenLog.push(lastChosen);
      }
    });

    await page.goto(`http://localhost:${port}/?demo=nested_items`);

    // Use the "Flat List" container: a pure column of Item A..D with no sub-containers,
    // which isolates the dragged-item-gap reflow that caused the flicker.
    const items = page
      .locator(".snapsort-container")
      .first()
      .locator(".snapsort-item");
    await expect(items.first()).toBeVisible();
    const first = items.first();
    const box = await first.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;

    // Drag distance: travel down ~4 item heights so we cross several drop slots.
    const travel = box!.height * 4;
    // Use a HIGH step count so each frame moves only a few pixels — this simulates a
    // smooth, gradual human drag. The flicker only manifests with small per-frame
    // movement near a slot boundary; large jumps skip over the oscillation.
    const steps = 120;
    const pxPerStep = travel / steps;

    await first.hover();
    await page.mouse.down();
    // Small initial nudge to cross the drag-start threshold.
    await page.mouse.move(startX, startY + 3, { steps: 2 });
    await page.waitForTimeout(50);

    const frames: Frame[] = [];
    const shotAt = new Set([
      1,
      Math.floor(steps / 4),
      Math.floor(steps / 2),
      Math.floor((3 * steps) / 4),
      steps,
    ]);
    for (let i = 1; i <= steps; i++) {
      const mouseY = startY + pxPerStep * i;
      // Move in a couple of sub-steps for a smooth pointer path between samples.
      await page.mouse.move(startX, mouseY, { steps: 3 });
      // Let the engine process its read/write frame(s) so the ghost DOM settles.
      await page.waitForTimeout(25);
      const ghost = await readGhost(page);
      frames.push({
        step: i,
        mouseY,
        ghostTop: ghost ? ghost.top : null,
        ghostCenterY: ghost ? ghost.top + ghost.height / 2 : null,
        chosen: lastChosen,
      });
      if (shotAt.has(i)) {
        await page.screenshot({
          path: path.join(OUT_DIR, `drag-step-${i}.png`),
        });
      }
    }

    await page.mouse.up();

    // Persist the frame log for inspection.
    fs.writeFileSync(
      path.join(OUT_DIR, "frames.json"),
      JSON.stringify({ frames, chosenLog }, null, 2),
    );

    // ---- Assertions ----
    const valid = frames.filter(
      (f) => f.ghostCenterY !== null,
    ) as Required<Frame>[];
    // The ghost must exist during the drag.
    expect(valid.length).toBeGreaterThan(steps * 0.7);

    const itemH = box!.height;

    // (1) Ghost tracks the cursor: it should never be more than ~1.5 item heights away.
    const maxOffset = Math.max(
      ...valid.map((f) => Math.abs((f.ghostCenterY as number) - f.mouseY)),
    );
    expect
      .soft(
        maxOffset,
        `max |ghostCenterY - mouseY| = ${maxOffset.toFixed(1)}px`,
      )
      .toBeLessThan(itemH * 1.5);

    // (2) No flicker: as the cursor moves monotonically down, the ghost center should be
    // (near-)monotonic. Count meaningful downward->upward reversals (> 4px to ignore jitter).
    let reversals = 0;
    for (let i = 1; i < valid.length; i++) {
      const dy =
        (valid[i].ghostCenterY as number) -
        (valid[i - 1].ghostCenterY as number);
      if (dy < -4) reversals++;
    }
    expect
      .soft(reversals, `ghost-position reversals across ${valid.length} frames`)
      .toBeLessThanOrEqual(2);

    // Surface a compact summary in the report.
    test.info().annotations.push({
      type: "drag-summary",
      description: `frames=${valid.length} maxOffset=${maxOffset.toFixed(1)}px reversals=${reversals} decisions=${chosenLog.length}`,
    });
  });
});
