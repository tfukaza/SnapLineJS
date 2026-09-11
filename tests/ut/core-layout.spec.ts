import { expect, test } from "@playwright/test";
import { contentRect } from "../../src/geometry";
import {
  createLayoutResolutionPlan,
  flowAxesForDirection,
  inferFlowLayoutMetrics,
  virtualEntrySizeFor,
  type VirtualInsertion,
} from "../../src/layout";
import {
  flowLayoutPositions,
  makeBox,
  makeContainerSnapshot,
  makeGrid,
  makeItemSnapshot,
  patchBox,
  simulatedRowCounts,
  virtualDimensions,
} from "../helpers/layout-grid";
import type { ItemSnapshot } from "../../assets/snapsort/src/snapshot";

type Insertion = VirtualInsertion<ItemSnapshot<string>>;

/**
 * Unit tests for the flow-layout simulation (`layout.ts`), the pure core of
 * the drop-prediction engine. Geometry is synthetic `ItemSnapshot` trees that
 * mirror what `captureDragSnapshotTree` produces from real DOM reads,
 * including the measurement imprecision real browsers exhibit:
 *
 * - Blink/WebKit lay out on a 1/64px grid and return exactly self-consistent
 *   `getBoundingClientRect` doubles.
 * - Gecko lays out in 1/60px app units and returns doubles with ~1e-5px
 *   unit-conversion noise per value (e.g. a 90.6px pad measures alternately
 *   90.59999084 / 90.60000610).
 *
 * The wrap regression suite below locks in the invariant that measurement
 * noise far below LAYOUT_EPSILON never flips a wrap decision, while genuine
 * overflow beyond it always does. The cross-browser e2e twin of these tests
 * (the sub-pixel wrap matrix in snapsort-drag-snapshot.spec.ts) makes the
 * same row-shape assertions through the shared helpers in
 * tests/helpers/layout-grid.ts.
 */

function ghostInsertion(
  grid: ReturnType<typeof makeGrid>,
  index: number,
  entry: { width: number; height: number },
): Insertion {
  return {
    container: grid,
    index,
    entry: { ...entry, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
  };
}

test.describe("layout resolution plans", () => {
  test("visits each eligible snapshot once across repeated candidate materialization", () => {
    const nestedChildren = [0, 1, 2].map((index) =>
      makeItemSnapshot(
        `nested-${index}`,
        makeBox({ x: 10, y: 10 + index * 24, width: 80, height: 20 }),
      ),
    );
    const nested = makeContainerSnapshot(
      makeBox({ x: 0, y: 0, width: 100, height: 90 }),
      nestedChildren,
      "column",
    );
    const excludedChild = makeItemSnapshot(
      "excluded-child",
      makeBox({ x: 0, y: 0, width: 20, height: 20 }),
    );
    const excluded = makeContainerSnapshot(
      makeBox({ x: 0, y: 100, width: 100, height: 30 }),
      [excludedChild],
      "column",
    );
    const peer = makeItemSnapshot(
      "peer",
      makeBox({ x: 0, y: 140, width: 100, height: 20 }),
    );
    const root = makeContainerSnapshot(
      makeBox({ x: 0, y: 0, width: 120, height: 180 }),
      [nested, excluded, peer],
      "column",
    );
    const visits = new Map<string, number>();
    const plan = createLayoutResolutionPlan(root, {
      exclude: (node) => node === excluded,
      diagnostics: {
        onNodeVisit: (snapshot) =>
          visits.set(snapshot.itemId, (visits.get(snapshot.itemId) ?? 0) + 1),
      },
    });

    const insertion = (index: number): Insertion => ({
      container: nested,
      index,
      entry: {
        width: 80,
        height: 20,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
    for (let index = 0; index <= nestedChildren.length; index++) {
      plan.layoutPositions(nested, 10, 10, [insertion(index)]);
    }

    expect([...visits.values()]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(visits.has(excluded.itemId)).toBe(false);
    expect(visits.has(excludedChild.itemId)).toBe(false);
    expect(Object.isFrozen(plan.containerPlan(root))).toBe(true);
    expect(Object.isFrozen(plan.containerPlan(root).eligibleChildren)).toBe(
      true,
    );
  });

  test("caches descendant insertion dimensions while replacing local insertions per candidate", () => {
    const nestedChildren = [0, 1].map((index) =>
      makeItemSnapshot(
        `nested-${index}`,
        makeBox({ x: index * 44, y: 0, width: 40, height: 40 }),
      ),
    );
    const nested = makeContainerSnapshot(
      makeBox({ x: 0, y: 0, width: 84, height: 40 }),
      nestedChildren,
      "row",
    );
    const sibling = makeItemSnapshot(
      "sibling",
      makeBox({ x: 0, y: 50, width: 84, height: 40 }),
    );
    const root = makeContainerSnapshot(
      makeBox({ x: 0, y: 0, width: 100, height: 160 }),
      [nested, sibling],
      "column",
    );
    const activeInsertion = ghostInsertion(nested, 2, {
      width: 40,
      height: 40,
    });
    const plan = createLayoutResolutionPlan(root, {
      insertions: [activeInsertion],
    });

    // The descendant insertion wraps and doubles the nested container height;
    // the parent reuses that cached dimension when placing its next child.
    expect(plan.virtualDimensions(nested).height).toBeCloseTo(80, 4);
    expect(plan.layoutPositions(root, 0, 0).itemPositions.get(sibling)).toEqual(
      {
        x: 0,
        y: 90,
      },
    );

    // A container's active insertion affects its parent-facing dimensions,
    // but its own candidate simulation starts clean and substitutes the local
    // candidate, matching the live pending-ghost replacement behavior.
    expect(plan.layoutPositions(nested, 0, 0).virtualRects.size).toBe(0);
    const candidate = ghostInsertion(nested, 0, {
      width: 40,
      height: 40,
    });
    expect(
      plan
        .layoutPositions(nested, 0, 0, [candidate])
        .virtualRects.get(candidate),
    ).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });
});

test.describe("inferFlowLayoutMetrics", () => {
  test("infers gaps, line size, and extent from a wrapped row grid", () => {
    const grid = makeGrid({ rows: 3, cols: 4, itemW: 90, itemH: 60, gap: 4 });
    const metrics = inferFlowLayoutMetrics(grid, flowAxesForDirection("row"));
    expect(metrics.mainStart).toBeCloseTo(0, 6);
    expect(metrics.crossStart).toBeCloseTo(0, 6);
    expect(metrics.mainGap).toBeCloseTo(4, 6);
    expect(metrics.crossGap).toBeCloseTo(4, 6);
    expect(metrics.lineCrossSize).toBeCloseTo(60, 6);
    expect(metrics.lineCount).toBe(3);
    expect(metrics.measuredMainExtent).toBeCloseTo(4 * 90 + 3 * 4, 6);
  });

  test("includes trailing margins in the measured extent", () => {
    const grid = makeGrid({ rows: 1, cols: 2, itemW: 50, itemH: 20, gap: 10 });
    grid.children[1].box = patchBox(grid.children[1].box, {
      margin: { right: 7 },
    });
    const metrics = inferFlowLayoutMetrics(grid, flowAxesForDirection("row"));
    expect(metrics.measuredMainExtent).toBeCloseTo(110 + 7, 6);
  });
});

test.describe("flowLayoutPositions wrap decisions", () => {
  test("reproduces measured positions for an exact-fill grid", () => {
    const grid = makeGrid({ rows: 4, cols: 4, itemW: 93, itemH: 93, gap: 4 });
    const origin = contentRect(grid.box);
    const result = flowLayoutPositions(grid, origin.x, origin.y);
    for (const child of grid.children) {
      const position = result.itemPositions.get(child)!;
      expect(position.x).toBeCloseTo(child.box.x, 4);
      expect(position.y).toBeCloseTo(child.box.y, 4);
    }
  });

  test("keeps a same-size ghost insertion at every index on the measured grid", () => {
    const grid = makeGrid({ rows: 4, cols: 4, itemW: 93, itemH: 93, gap: 4 });
    const dragged = grid.children[0];
    for (let index = 0; index <= 15; index++) {
      expect(
        simulatedRowCounts(grid, {
          rowStep: 97,
          insertion: ghostInsertion(grid, index, { width: 93, height: 93 }),
          exclude: (node) => node.value === dragged.value,
        }),
        `insertion at ${index}`,
      ).toEqual([4, 4, 4, 4]);
    }
  });

  test("wraps a genuinely oversized ghost insertion", () => {
    const grid = makeGrid({ rows: 2, cols: 4, itemW: 93, itemH: 93, gap: 4 });
    const dragged = grid.children[0];
    // Ghost twice as wide as a slot: only 3 fit per line alongside it.
    const counts = simulatedRowCounts(grid, {
      rowStep: 97,
      insertion: ghostInsertion(grid, 0, { width: 190, height: 93 }),
      exclude: (node) => node.value === dragged.value,
    });
    expect(counts[0]).toBeLessThan(4);
  });

  test("column containers with a single measured line never wrap", () => {
    const children = [0, 1, 2].map((i) =>
      makeItemSnapshot(
        `item-${i}`,
        makeBox({ x: 0, y: i * 30, width: 100, height: 26 }),
      ),
    );
    const container = makeContainerSnapshot(
      makeBox({ x: 0, y: 0, width: 100, height: 60 }),
      children,
      "column",
    );
    // Content height (60) is smaller than the stack (3 x 26 + gaps), but a
    // single-line column must keep everything on one line (it grows instead).
    const insertion: Insertion = {
      container,
      index: 3,
      entry: { width: 100, height: 26, margin: children[0].box.margin },
    };
    const origin = contentRect(container.box);
    const result = flowLayoutPositions(container, origin.x, origin.y, {
      insertions: [insertion],
    });
    const xs = new Set(
      [...result.itemPositions.values()].map((p) => Math.round(p.x)),
    );
    xs.add(Math.round(result.virtualRects.get(insertion)!.x));
    expect(xs.size).toBe(1);
  });

  test("centers lines when mainAxisAlign is center", () => {
    const grid = makeGrid({ rows: 1, cols: 2, itemW: 40, itemH: 20, gap: 10 });
    grid.mainAxisAlign = "center";
    grid.box = patchBox(grid.box, { width: 150 }); // 60px slack
    const origin = contentRect(grid.box);
    const result = flowLayoutPositions(grid, origin.x, origin.y);
    const first = result.itemPositions.get(grid.children[0])!;
    expect(first.x).toBeCloseTo((150 - 90) / 2, 4);
  });
});

test.describe("wrap robustness against browser measurement noise", () => {
  /**
   * Regression for the fractional-width over-wrap bug: Firefox app-unit
   * conversion noise (~1e-5px per measured value) must not push a zero-slack
   * line over capacity. Observed real values from the landing hero grid at
   * card width 430.398px: pad widths alternating 90.59999084 / 90.60000610,
   * measured gaps 4.000030517578125, parsed content 374.3999938964844.
   */
  test("does not over-wrap a zero-slack grid under Gecko-style jitter", () => {
    const jitterW = (i: number) =>
      i % 2 === 0 ? -0.00000915527344 : 0.00000610351562;
    const grid = makeGrid({
      rows: 4,
      cols: 4,
      itemW: 90.6,
      itemH: 90.6,
      gap: 4.000030517578125,
      jitter: (i) => ({ w: jitterW(i), x: (i % 4) * 0.00001525878906 }),
    });
    // Parsed container width fractionally *below* the measured extent, as
    // Gecko reports it.
    grid.box = patchBox(grid.box, { width: 374.3999938964844 });
    const dragged = grid.children[0];
    for (let index = 0; index <= 15; index++) {
      expect(
        simulatedRowCounts(grid, {
          rowStep: 94.6,
          insertion: ghostInsertion(grid, index, {
            width: dragged.box.width,
            height: dragged.box.height,
          }),
          exclude: (node) => node.value === dragged.value,
        }),
        `insertion at ${index}`,
      ).toEqual([4, 4, 4, 4]);
    }
  });

  test("does not over-wrap when parsed capacity is fractionally below the measured extent", () => {
    // Specified-vs-snapped: parsed padding 5.6px vs snapped 5.59375px makes
    // the parsed content width smaller than what the browser demonstrably
    // fit on one line. measuredMainExtent must win.
    const grid = makeGrid({ rows: 2, cols: 4, itemW: 90, itemH: 60, gap: 4 });
    grid.box = patchBox(grid.box, {
      width: grid.box.width + 0.0125, // snapped outer width
      padding: { left: 5.6, right: 5.6 },
    });
    for (const child of grid.children) {
      child.box = patchBox(child.box, { x: child.box.x + 5.59375 });
    }
    const dragged = grid.children[0];
    expect(
      simulatedRowCounts(grid, {
        rowStep: 64,
        insertion: ghostInsertion(grid, 3, { width: 90, height: 60 }),
        exclude: (node) => node.value === dragged.value,
      }),
    ).toEqual([4, 4]);
  });

  test("still wraps genuine overflow just past the tolerance", () => {
    // Guards the other direction: LAYOUT_EPSILON must stay far below real
    // layout features, or lines that truly overflow would under-wrap.
    const grid = makeGrid({ rows: 2, cols: 4, itemW: 90, itemH: 60, gap: 4 });
    const dragged = grid.children[0];
    const counts = simulatedRowCounts(grid, {
      rowStep: 64,
      // 0.5px wider than the slot: genuinely overflows the zero-slack line.
      insertion: ghostInsertion(grid, 3, { width: 90.5, height: 60 }),
      exclude: (node) => node.value === dragged.value,
    });
    expect(counts[0]).toBe(3);
  });

  test("wrap decisions are stable across seeded jitter fuzz", () => {
    // Deterministic LCG so failures are reproducible.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 50; round++) {
      const noise = () => (rand() - 0.5) * 4e-5;
      const grid = makeGrid({
        rows: 4,
        cols: 4,
        itemW: 90.6,
        itemH: 90.6,
        gap: 4,
        jitter: () => ({ w: noise(), x: noise() }),
      });
      grid.box = patchBox(grid.box, { width: grid.box.width + noise() });
      const dragged = grid.children[5];
      expect(
        simulatedRowCounts(grid, {
          rowStep: 94.6,
          insertion: ghostInsertion(grid, Math.floor(rand() * 16), {
            width: dragged.box.width,
            height: dragged.box.height,
          }),
          exclude: (node) => node.value === dragged.value,
        }),
        `fuzz round ${round}`,
      ).toEqual([4, 4, 4, 4]);
    }
  });
});

test.describe("slot layout model", () => {
  // Unequal-track grid: columns 60/140/80/88, gap 4 -> column x: 0/64/208/292.
  const unequalGrid = () =>
    makeGrid({
      rows: 2,
      cols: 4,
      itemW: 0,
      itemH: 40,
      gap: 4,
      colWidths: [60, 140, 80, 88],
      layoutModel: "slots",
    });

  test("entries adopt measured slot geometry on an unequal-track grid", () => {
    const grid = unequalGrid();
    const dragged = grid.children[0];
    const insertion: Insertion = {
      container: grid,
      index: 3,
      entry: { width: 60, height: 40, margin: dragged.box.margin },
    };
    const origin = contentRect(grid.box);
    const result = flowLayoutPositions(grid, origin.x, origin.y, {
      exclude: (node) => node.value === dragged.value,
      insertions: [insertion],
    });
    // Entries [item-1, item-2, item-3, ghost, item-4..item-7] -> slots 0..7.
    const byValue = new Map(
      [...result.itemPositions].map(([snapshotItem, position]) => [
        snapshotItem.value,
        position,
      ]),
    );
    expect(byValue.get("item-1")).toEqual({ x: 0, y: 0 }); // slot 0
    expect(byValue.get("item-2")).toEqual({ x: 64, y: 0 }); // slot 1 (140px track)
    expect(byValue.get("item-4")).toEqual({ x: 0, y: 44 }); // slot 4, row 2
    // Ghost takes slot 3 and adopts its track geometry (88px), not the
    // dragged item's own 60px.
    expect(result.virtualRects.get(insertion)).toEqual({
      x: 292,
      y: 0,
      width: 88,
      height: 40,
    });
  });

  test("remaining items compact into leading slots when one is dragged away", () => {
    const grid = unequalGrid();
    const dragged = grid.children[0];
    const origin = contentRect(grid.box);
    const result = flowLayoutPositions(grid, origin.x, origin.y, {
      exclude: (node) => node.value === dragged.value,
    });
    const byValue = new Map(
      [...result.itemPositions].map(([snapshotItem, position]) => [
        snapshotItem.value,
        position,
      ]),
    );
    // item-7 (was slot 7: row 2, col 4) compacts into slot 6 (row 2, col 3).
    expect(byValue.get("item-7")).toEqual({ x: 208, y: 44 });
  });

  test("an appended insertion extrapolates one slot past the measured grid", () => {
    const grid = unequalGrid();
    const insertion: Insertion = {
      container: grid,
      index: 8,
      entry: {
        width: 60,
        height: 40,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const origin = contentRect(grid.box);
    const result = flowLayoutPositions(grid, origin.x, origin.y, {
      insertions: [insertion],
    });
    // New row 3, reusing column 0's measured geometry.
    expect(result.virtualRects.get(insertion)).toEqual({
      x: 0,
      y: 88,
      width: 60,
      height: 40,
    });
  });

  test("auto-flow column grids assign slots in measured fill order", () => {
    // DOM order fills columns top-to-bottom: item i -> col floor(i/3),
    // row i%3. 2 columns x 3 rows, 80x40 items, gap 4.
    const children = Array.from({ length: 6 }, (_, i) =>
      makeItemSnapshot(
        `item-${i}`,
        makeBox({
          x: Math.floor(i / 3) * 84,
          y: (i % 3) * 44,
          width: 80,
          height: 40,
        }),
      ),
    );
    const container = makeContainerSnapshot(
      makeBox({ x: 0, y: 0, width: 164, height: 128 }),
      children,
      "row",
      "start",
      "slots",
    );
    const dragged = children[0];
    const insertion: Insertion = {
      container,
      index: 2,
      entry: { width: 80, height: 40, margin: dragged.box.margin },
    };
    const result = flowLayoutPositions(container, 0, 0, {
      exclude: (node) => node.value === dragged.value,
      insertions: [insertion],
    });
    const byValue = new Map(
      [...result.itemPositions].map(([snapshotItem, position]) => [
        snapshotItem.value,
        position,
      ]),
    );
    // Entries [item-1, item-2, ghost, item-3, item-4, item-5] -> slots 0..5,
    // which advance DOWN column 1 before moving to column 2.
    expect(byValue.get("item-1")).toEqual({ x: 0, y: 0 }); // slot 0
    expect(byValue.get("item-2")).toEqual({ x: 0, y: 44 }); // slot 1
    expect(result.virtualRects.get(insertion)).toMatchObject({ x: 0, y: 88 }); // slot 2
    expect(byValue.get("item-3")).toEqual({ x: 84, y: 0 }); // slot 3: column 2
  });

  test("non-uniform fixed template rows keep measured slot positions (static variant)", () => {
    // Rows 40/80/40 with uniform 40px items: the 80px track leaves slack, so
    // residuals differ between rows -> static rows detected.
    const grid = makeGrid({
      rows: 3,
      cols: 2,
      itemW: 40,
      itemH: 40,
      gap: 4,
      rowHeights: [40, 80, 40],
      layoutModel: "slots",
    });
    const dragged = grid.children[0];
    const insertion: Insertion = {
      container: grid,
      index: 0,
      entry: { width: 40, height: 40, margin: dragged.box.margin },
    };
    const result = flowLayoutPositions(grid, 0, 0, {
      exclude: (node) => node.value === dragged.value,
      insertions: [insertion],
    });
    const byValue = new Map(
      [...result.itemPositions].map(([snapshotItem, position]) => [
        snapshotItem.value,
        position,
      ]),
    );
    // Row starts stay measured: row 2 at 44, row 3 at 44 + 80 + 4 = 128.
    expect(byValue.get("item-2")).toEqual({ x: 0, y: 44 }); // slot 2
    expect(byValue.get("item-5")).toEqual({ x: 44, y: 128 }); // slot 5
  });

  test("content-sized rows recompute heights when a tall item moves rows", () => {
    // 2x2 content-sized grid: item-1 is 80px tall so row 1's track is 80.
    const grid = makeGrid({
      rows: 2,
      cols: 2,
      itemW: 40,
      itemH: 40,
      gap: 4,
      itemHeight: (i) => (i === 1 ? 80 : 40),
      layoutModel: "slots",
    });
    const dragged = grid.children[1]; // the tall item
    const insertion: Insertion = {
      container: grid,
      index: 3,
      entry: { width: 40, height: 80, margin: dragged.box.margin },
    };
    const result = flowLayoutPositions(grid, 0, 0, {
      exclude: (node) => node.value === dragged.value,
      insertions: [insertion],
    });
    const byValue = new Map(
      [...result.itemPositions].map(([snapshotItem, position]) => [
        snapshotItem.value,
        position,
      ]),
    );
    // Entries [item-0, item-2, item-3, ghost]: row 1 is now two 40px items,
    // so row 2 moves UP from its measured 84 to 40 + 4 = 44, and the ghost
    // (still 80 tall) sits in row 2.
    expect(byValue.get("item-2")).toEqual({ x: 44, y: 0 }); // slot 1, row 1
    expect(byValue.get("item-3")).toEqual({ x: 0, y: 44 }); // slot 2, row 2 moved up
    expect(result.virtualRects.get(insertion)).toEqual({
      x: 44,
      y: 44,
      width: 40,
      height: 80,
    });
  });

  test("virtualDimensions grows by a row when an insertion extrapolates a slot", () => {
    const grid = makeGrid({
      rows: 1,
      cols: 4,
      itemW: 88,
      itemH: 40,
      gap: 4,
      layoutModel: "slots",
    });
    const insertion: Insertion = {
      container: grid,
      index: 4,
      entry: {
        width: 88,
        height: 40,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const dims = virtualDimensions(grid, { insertions: [insertion] });
    expect(dims.width).toBeCloseTo(grid.box.width, 4);
    expect(dims.height).toBeGreaterThan(grid.box.height + 39);
  });
});

test.describe("wrap and stretchItems declarations", () => {
  test("wrap: nowrap keeps an overflowing row list on one line", () => {
    // Zero-slack single-row list: an appended ghost overflows the container.
    const grid = makeGrid({ rows: 1, cols: 4, itemW: 88, itemH: 40, gap: 4 });
    const insertion = (container: typeof grid): Insertion => ({
      container,
      index: 4,
      entry: {
        width: 88,
        height: 40,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
    // Control: with wrap "auto" a row container wraps the overflow.
    expect(
      simulatedRowCounts(grid, { rowStep: 44, insertion: insertion(grid) }),
    ).toEqual([4, 1]);
    // Declared nowrap: the list keeps growing on the same line.
    const noWrapGrid = makeGrid({
      rows: 1,
      cols: 4,
      itemW: 88,
      itemH: 40,
      gap: 4,
    });
    noWrapGrid.wrap = "nowrap";
    expect(
      simulatedRowCounts(noWrapGrid, {
        rowStep: 44,
        insertion: insertion(noWrapGrid),
      }),
    ).toEqual([5]);
  });

  test("virtualEntrySizeFor fills the cross axis minus entry margins", () => {
    // Column container: 200px outer, 3px borders, 10px padding -> 174px
    // content width. Entry has 4px horizontal margins -> 166px.
    const container = makeContainerSnapshot(
      makeBox({
        x: 0,
        y: 0,
        width: 200,
        height: 400,
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
        border: { top: 3, right: 3, bottom: 3, left: 3 },
      }),
      [],
      "column",
      "start",
      "flow",
      { stretchItems: true },
    );
    const base = {
      width: 300,
      height: 48,
      margin: { top: 2, right: 4, bottom: 2, left: 4 },
    };
    expect(virtualEntrySizeFor(container, base)).toEqual({
      width: 174 - 8,
      height: 48,
    });
    // Row container: the cross axis is height.
    container.direction = "row";
    expect(virtualEntrySizeFor(container, base)).toEqual({
      width: 300,
      height: 400 - 26 - 4,
    });
    // Without stretchItems the base passes through unchanged.
    container.stretchItems = false;
    expect(virtualEntrySizeFor(container, base)).toEqual({
      width: 300,
      height: 48,
    });
  });

  test("a wide entry dropped into a narrow stretch column adopts its width and center", () => {
    // Narrow nested list (140px content) receiving an entry measured at
    // 300px in its source container — the nested-container flicker setup.
    const children = [0, 1, 2].map((i) =>
      makeItemSnapshot(
        `item-${i}`,
        makeBox({ x: 10, y: 10 + i * 44, width: 140, height: 40 }),
      ),
    );
    const container = makeContainerSnapshot(
      makeBox({
        x: 0,
        y: 0,
        width: 160,
        height: 160,
        padding: { top: 10, right: 10, bottom: 10, left: 10 },
      }),
      children,
      "column",
      "start",
      "flow",
      { wrap: "nowrap", stretchItems: true },
    );
    const insertion: Insertion = {
      container,
      index: 1,
      entry: {
        ...virtualEntrySizeFor(container, {
          width: 300,
          height: 40,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        }),
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const origin = contentRect(container.box);
    const result = flowLayoutPositions(container, origin.x, origin.y, {
      insertions: [insertion],
    });
    const rect = result.virtualRects.get(insertion)!;
    expect(rect.width).toBe(140);
    // Ghost center sits inside the narrow container, not at source width.
    const centerX = rect.x + rect.width / 2;
    expect(centerX).toBeGreaterThan(0);
    expect(centerX).toBeLessThan(160);
    expect(rect.y).toBeCloseTo(10 + 44, 4);
  });
});

test.describe("virtualDimensions", () => {
  test("grows a row container's height when an insertion adds a line", () => {
    const grid = makeGrid({ rows: 1, cols: 4, itemW: 93, itemH: 93, gap: 4 });
    const insertion = ghostInsertion(grid, 4, { width: 93, height: 93 });
    const dims = virtualDimensions(grid, { insertions: [insertion] });
    expect(dims.width).toBeCloseTo(grid.box.width, 4);
    expect(dims.height).toBeGreaterThan(grid.box.height + 90);
  });

  test("returns the snapshot size when nothing is inserted or removed", () => {
    const grid = makeGrid({ rows: 2, cols: 4, itemW: 93, itemH: 93, gap: 4 });
    const dims = virtualDimensions(grid);
    expect(dims.width).toBeCloseTo(grid.box.width, 4);
    expect(dims.height).toBeCloseTo(grid.box.height, 4);
  });
});
