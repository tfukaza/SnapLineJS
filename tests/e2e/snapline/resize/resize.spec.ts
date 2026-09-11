import { expect, test, type Locator, type Page } from "@playwright/test";

// JS-driven node resize starts from developer-rendered DOM regions. Every
// resize re-glues the node's connector lines (same handling as a move + a size
// re-measure).

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function dragFromTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
}

async function waitForAnimationFrame(page: Page) {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => r())),
  );
}

async function lineStart(page: Page) {
  return page
    .locator("[data-snapline-type='connector-line']")
    .evaluate((svg) => {
      const rect = svg.getBoundingClientRect();
      const transform = new DOMMatrixReadOnly(getComputedStyle(svg).transform);
      const path = svg.querySelector("path");
      const numbers =
        path
          ?.getAttribute("d")
          ?.match(/-?\d+(?:\.\d+)?/g)
          ?.map(Number) ?? [];
      const p = new DOMPoint(numbers[0] ?? 0, numbers[1] ?? 0).matrixTransform(
        transform,
      );
      return { x: p.x + (rect.left - p.x), y: p.y + (rect.top - p.y) };
    });
}

function expectClose(
  a: { x: number; y: number },
  b: { x: number; y: number },
  tol = 6,
) {
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(tol);
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(tol);
}

// Every test asserts this at teardown. The stage-guard throw on resize release
// (writeTransformRecursive at IDLE) fired on every gesture here for a long time
// while all assertions stayed green, because they only measure settled geometry.
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/snapline-resize");
  await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test("resizing a node keeps its connector line glued to the moved connector", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Resizable A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Fixed B",
  });
  const output = nodeA.locator("[data-snapline-name='output']");
  const input = nodeB.locator("[data-snapline-name='input']");

  await dragFromTo(page, await centerOf(output), await centerOf(input));
  const line = page.locator("[data-snapline-type='connector-line']");
  await expect(line).toHaveCount(1);
  await waitForAnimationFrame(page);
  expectClose(await lineStart(page), await centerOf(output));

  // Grow node A from its BR corner: the output connector (right edge) moves.
  const before = await nodeA.boundingBox();
  const br = {
    x: before!.x + before!.width - 2,
    y: before!.y + before!.height - 2,
  };
  await dragFromTo(page, br, { x: br.x + 150, y: br.y + 90 });
  await waitForAnimationFrame(page);

  const after = await nodeA.boundingBox();
  expect(after!.width - before!.width).toBeGreaterThan(90);
  expect(after!.height - before!.height).toBeGreaterThan(50);
  // Line start followed the connector that moved with the resize.
  expectClose(await lineStart(page), await centerOf(output));
});

test("resize can be grabbed beyond the node's visual edge", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Resizable A",
  });
  const before = await nodeA.boundingBox();
  // Press OUTSIDE the node's box (BR + 6px) but inside the ~14px hitbox radius.
  const outside = {
    x: before!.x + before!.width + 6,
    y: before!.y + before!.height + 6,
  };
  await dragFromTo(page, outside, { x: outside.x + 130, y: outside.y + 80 });
  await waitForAnimationFrame(page);
  const after = await nodeA.boundingBox();
  expect(after!.width - before!.width).toBeGreaterThan(80);
});

test("all four sides and all four corners resize from the expected fixed edge", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Resizable A",
  });
  const cases = [
    { handle: "n", dx: 0, dy: -45 },
    { handle: "ne", dx: 55, dy: -45 },
    { handle: "e", dx: 55, dy: 0 },
    { handle: "se", dx: 55, dy: 45 },
    { handle: "s", dx: 0, dy: 45 },
    { handle: "sw", dx: -55, dy: 45 },
    { handle: "w", dx: -55, dy: 0 },
    { handle: "nw", dx: -55, dy: -45 },
  ] as const;

  for (const resizeCase of cases) {
    await page.goto("/snapline-resize");
    await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
    const before = (await nodeA.boundingBox())!;
    const west = resizeCase.handle.includes("w");
    const east = resizeCase.handle.includes("e");
    const north = resizeCase.handle.includes("n");
    const south = resizeCase.handle.includes("s");
    const from = {
      x: west
        ? before.x + 2
        : east
          ? before.x + before.width - 2
          : before.x + before.width / 2,
      y: north
        ? before.y + 2
        : south
          ? before.y + before.height - 2
          : before.y + before.height / 2,
    };
    await dragFromTo(page, from, {
      x: from.x + resizeCase.dx,
      y: from.y + resizeCase.dy,
    });
    const after = (await nodeA.boundingBox())!;

    if (west || east) expect(after.width - before.width).toBeGreaterThan(30);
    else expect(Math.abs(after.width - before.width)).toBeLessThan(5);
    if (north || south)
      expect(after.height - before.height).toBeGreaterThan(25);
    else expect(Math.abs(after.height - before.height)).toBeLessThan(5);
    if (west)
      expect(
        Math.abs(after.x + after.width - (before.x + before.width)),
      ).toBeLessThan(5);
    if (north)
      expect(
        Math.abs(after.y + after.height - (before.y + before.height)),
      ).toBeLessThan(5);
    if (east) expect(Math.abs(after.x - before.x)).toBeLessThan(5);
    if (south) expect(Math.abs(after.y - before.y)).toBeLessThan(5);
  }
});

// The anchored edge has to hold on EVERY painted frame. Pacing is the whole
// point: the size lags the transform by exactly one frame, so a gesture driven
// with several frames per move lets the lagging read catch up and the bug
// disappears. This drives one synthetic pointermove per animation frame inside
// the page, and samples the AUTHORED inline values — sampling the rendered rect
// here would force a layout read on every style write, outside the engine's
// read queue, and perturb the very timing under test.
test("a north drag holds the bottom edge with one pointermove per animation frame", async ({
  page,
}) => {
  const samples = await page.evaluate(async () => {
    const element = [
      ...document.querySelectorAll<HTMLElement>("[data-snapline-type='node']"),
    ].find((node) => node.textContent?.includes("Resizable A"))!;
    const region = element.querySelector<HTMLElement>(
      "[data-snapline-part='resize-region'][data-handle='n']",
    )!;
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const top = Math.round(rect.top + 2);

    const out: Array<{ ty: number; height: number }> = [];
    const record = () => {
      const match = /translate(?:3d)?\(([^)]*)\)/.exec(element.style.transform);
      out.push({
        ty: match ? parseFloat(match[1].split(",")[1]) : NaN,
        height: parseFloat(element.style.height),
      });
    };
    new MutationObserver(record).observe(element, {
      attributes: true,
      attributeFilter: ["style"],
    });

    const send = (type: string, clientY: number) =>
      region.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: x,
          clientY,
        }),
      );
    const frame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Grow upward, then reverse and shrink past minHeight (90) so the clamp is
    // covered too.
    const offsets: number[] = [];
    for (let step = 1; step <= 14; step++) offsets.push(-step * 10);
    for (let step = 13; step >= -20; step--) offsets.push(-step * 10);

    send("pointerdown", top);
    for (const offset of offsets) {
      send("pointermove", top + offset);
      await frame();
    }
    send("pointerup", top + offsets[offsets.length - 1]);
    await frame();
    await frame();
    return out;
  });

  const usable = samples.filter(
    (s) => Number.isFinite(s.ty) && Number.isFinite(s.height),
  );
  const heights = usable.map((s) => s.height);
  const bottoms = usable.map((s) => s.ty + s.height);

  // Guard against a vacuous pass: the sampler ran, the node really resized, and
  // the drag actually reached the clamp.
  expect(usable.length).toBeGreaterThan(20);
  expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(50);
  expect(Math.min(...heights)).toBeLessThanOrEqual(92);

  expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2);
});

test("a plain (non-resizable) node moves when grabbed at its BR corner", async ({
  page,
}) => {
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Fixed B",
  });
  const before = await nodeB.boundingBox();
  const br = {
    x: before!.x + before!.width - 3,
    y: before!.y + before!.height - 3,
  };
  await dragFromTo(page, br, { x: br.x + 100, y: br.y + 70 });
  const after = await nodeB.boundingBox();
  expect(after!.x - before!.x).toBeGreaterThan(70); // moved
  expect(Math.abs(after!.width - before!.width)).toBeLessThan(4); // not resized
});

// The anchored edge must hold on EVERY painted frame, not just once the drag
// settles (which is all the assertions above check). Measuring the rendered
// rect rather than the authored `style.height` is the point: those two diverge
// whenever the engine authors a size the stylesheet refuses to honour — e.g. a
// CSS min-height the node's minHeight config doesn't match — and only the
// rendered value is what the user sees move.
// The per-frame test above samples the AUTHORED size, so it cannot see the
// engine authoring a size the stylesheet refuses to apply. This one measures
// the RENDERED box — once, after the gesture settles, rather than on every
// style write, since a layout read inside a MutationObserver reads outside the
// engine's read queue and perturbs the timing it is trying to observe.
test("shrinking past the clamp leaves the anchored edge where it started", async ({
  page,
}) => {
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Resizable A",
  });
  const before = (await nodeA.boundingBox())!;
  const bottomBefore = before.y + before.height;

  // Drag the top edge down, well past minHeight (90). Once the size stops
  // responding the origin has to stop shifting too, or the bottom edge slides.
  const from = { x: before.x + before.width / 2, y: before.y + 2 };
  await dragFromTo(page, from, { x: from.x, y: from.y + 260 });
  await waitForAnimationFrame(page);

  const after = (await nodeA.boundingBox())!;
  expect(after.height).toBeLessThanOrEqual(92); // reached the clamp
  expect(Math.abs(after.y + after.height - bottomBefore)).toBeLessThanOrEqual(
    2,
  );
});

test("releasing a resize leaves cursor and selection state usable", async ({
  page,
}) => {
  // The "no uncaught error" half of this regression is asserted for every test
  // by the afterEach hook.
  const nodeA = page.locator("[data-snapline-type='node']", {
    hasText: "Resizable A",
  });
  const nodeB = page.locator("[data-snapline-type='node']", {
    hasText: "Fixed B",
  });
  const before = (await nodeA.boundingBox())!;

  await dragFromTo(
    page,
    { x: before.x + before.width - 2, y: before.y + before.height / 2 },
    { x: before.x + before.width + 80, y: before.y + before.height / 2 },
  );
  await waitForAnimationFrame(page);

  // Native CSS immediately reflects whichever region is hovered after release.
  const after = (await nodeA.boundingBox())!;
  const south = nodeA.locator(
    "[data-snapline-part='resize-region'][data-handle='s']",
  );
  await page.mouse.move(after.x + after.width / 2, after.y + after.height - 2);
  await expect(south).toHaveCSS("cursor", "ns-resize");

  // resizingNode was cleared, so onUp no longer bails out of click-selection.
  await nodeB.click();
  await waitForAnimationFrame(page);
  await expect(nodeB).toHaveAttribute("data-selected", "true");
});

test("tl anchor: the origin freezes once the min size is reached", async ({
  page,
}) => {
  const nodeC = page.locator("[data-snapline-type='node']", {
    hasText: "TL Anchor C",
  });
  const before = await nodeC.boundingBox();
  const brBefore = {
    x: before!.x + before!.width,
    y: before!.y + before!.height,
  };

  // Drag the TL handle far INWARD (down-right), past the min size clamp.
  const tl = { x: before!.x + 2, y: before!.y + 2 };
  await dragFromTo(page, tl, { x: tl.x + 400, y: tl.y + 400 });
  await waitForAnimationFrame(page);

  const after = await nodeC.boundingBox();
  // Clamped at minWidth/minHeight (140x90 configured in the demo).
  expect(Math.round(after!.width)).toBeGreaterThanOrEqual(140 - 2);
  expect(Math.round(after!.width)).toBeLessThanOrEqual(140 + 6);
  expect(Math.round(after!.height)).toBeGreaterThanOrEqual(90 - 2);
  expect(Math.round(after!.height)).toBeLessThanOrEqual(90 + 6);
  // The BR corner still never moved: origin shift derives from the CLAMPED size.
  const brAfter = { x: after!.x + after!.width, y: after!.y + after!.height };
  expect(Math.abs(brAfter.x - brBefore.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(brAfter.y - brBefore.y)).toBeLessThanOrEqual(4);
});

// Under a zoomed camera every resize re-measures the node. The measured size
// must be world-space (CSS pixels), or the next resize starts from the
// on-screen size and the node jumps by the zoom factor.
for (const [direction, wheelDeltaY] of [
  ["out", 300],
  ["in", -300],
] as const) {
  test(`consecutive resizes stay continuous after zooming ${direction}`, async ({
    page,
  }) => {
    await page.goto("/snapline-resize?camera=1");
    await expect(page.locator("[data-snapline-type='node']")).toHaveCount(3);
    const nodeA = page.locator("[data-snapline-type='node']", {
      hasText: "Resizable A",
    });
    const eastHandle = nodeA.locator(".resize-region[data-handle='e']");
    const cssWidth = () =>
      nodeA.evaluate((node) => (node as HTMLElement).offsetWidth);
    const zoom = async () =>
      (await nodeA.boundingBox())!.width / (await cssWidth());

    // Zoom about the container's top-left corner so the nodes stay in view.
    const canvas = (await page.locator("#node-ui-resize-canvas").boundingBox())!;
    await page.mouse.move(canvas.x + 10, canvas.y + 10);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, wheelDeltaY);
    await page.keyboard.up("Control");
    await expect.poll(zoom).not.toBeCloseTo(1, 2);
    const scale = await zoom();

    const resizeEastBy = async (screenDx: number) => {
      const from = await centerOf(eastHandle);
      await dragFromTo(page, from, { x: from.x + screenDx, y: from.y });
      await waitForAnimationFrame(page);
      await waitForAnimationFrame(page);
    };

    const initial = await cssWidth();
    await resizeEastBy(60);
    const first = await cssWidth();
    expect(first - initial).toBeCloseTo(60 / scale, -0.5);

    await resizeEastBy(40);
    const second = await cssWidth();
    expect(second - first).toBeCloseTo(40 / scale, -0.5);
  });
}
