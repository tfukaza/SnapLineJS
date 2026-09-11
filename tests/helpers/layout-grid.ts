// Shared helpers for layout-engine tests (tests/ut/core-layout.spec.ts and the
// wrap-matrix e2e test in tests/e2e/snapsort-drag-snapshot.spec.ts): DOM-free
// snapshot builders plus the row-shape assertions both suites make. Keeping
// the grid construction and row counting here guarantees the unit tests and
// the cross-browser e2e matrix judge the layout engine by the same rules.
//
// Note: code inside `page.evaluate` blocks cannot import from here (evaluate
// serializes the closure into the browser), so in-page measurement helpers
// like `boxOf` remain local to their spec.
import type { Edges, ElementBox } from "../../src/geometry";
import { contentRect } from "../../src/geometry";
import {
  createLayoutResolutionPlan,
  type LayoutNode,
  type LayoutPositions,
  type VirtualInsertion,
} from "../../src/layout";
import type { ItemSnapshot } from "../../assets/snapsort/src/snapshot";

export type BoxInit = {
  x: number;
  y: number;
  width: number;
  height: number;
  margin?: Partial<Edges>;
  padding?: Partial<Edges>;
  border?: Partial<Edges>;
};

/** A frozen element box, mirroring what `ElementObject.readDom` returns. */
export function makeBox(init: BoxInit): ElementBox {
  const edges = (src: Partial<Edges> | undefined): Edges =>
    Object.freeze({
      top: src?.top ?? 0,
      right: src?.right ?? 0,
      bottom: src?.bottom ?? 0,
      left: src?.left ?? 0,
    });
  return Object.freeze({
    x: init.x,
    y: init.y,
    width: init.width,
    height: init.height,
    screen: Object.freeze({
      x: init.x,
      y: init.y,
      width: init.width,
      height: init.height,
    }),
    margin: edges(init.margin),
    padding: edges(init.padding),
    border: edges(init.border),
  });
}

/** A copy of `box` with `patch` applied; edge patches merge per side. */
export function patchBox(box: ElementBox, patch: Partial<BoxInit>): ElementBox {
  return makeBox({
    x: patch.x ?? box.x,
    y: patch.y ?? box.y,
    width: patch.width ?? box.width,
    height: patch.height ?? box.height,
    margin: { ...box.margin, ...patch.margin },
    padding: { ...box.padding, ...patch.padding },
    border: { ...box.border, ...patch.border },
  });
}

let nextItemId = 0;

export function makeItemSnapshot(
  value: string,
  box: ElementBox,
  children: ItemSnapshot<string>[] = [],
): ItemSnapshot<string> {
  return {
    value,
    itemId: `item-${nextItemId++}`,
    metadata: {},
    direction: "column",
    mainAxisAlign: "start",
    layoutModel: "flow",
    wrap: "auto",
    stretchItems: false,
    locked: false,
    box,
    children,
  };
}

export function makeContainerSnapshot(
  box: ElementBox,
  children: ItemSnapshot<string>[],
  direction: "row" | "column" = "row",
  mainAxisAlign: "start" | "center" = "start",
  layoutModel: "flow" | "slots" = "flow",
  options: { wrap?: "auto" | "nowrap"; stretchItems?: boolean } = {},
): ItemSnapshot<string> {
  return {
    value: "container",
    itemId: `container-${nextItemId++}`,
    metadata: {},
    direction,
    mainAxisAlign,
    layoutModel,
    wrap: options.wrap ?? "auto",
    stretchItems: options.stretchItems ?? false,
    locked: false,
    box,
    children,
  };
}

/**
 * Build a wrapped row grid snapshot: `rows` x `cols` items with `gap`,
 * inside a container sized to fit `cols` per row exactly (zero slack).
 *
 * - `colWidths` gives each column its own track width (unequal-track grids);
 *   default is `itemW` everywhere.
 * - `rowHeights` fixes each row's track height independently of its items
 *   (template-fixed rows; items sit at the row start, possibly shorter);
 *   default rows are content-sized: track height = tallest item in the row.
 * - `itemHeight(index)` gives per-item heights; default `itemH`.
 * - `jitter` injects per-item measurement noise to simulate browser
 *   imprecision.
 * - `layoutModel` marks the container `"slots"` for grid semantics.
 */
export function makeGrid(options: {
  rows: number;
  cols: number;
  itemW: number;
  itemH: number;
  gap: number;
  originX?: number;
  originY?: number;
  padding?: number;
  colWidths?: number[];
  rowHeights?: number[];
  itemHeight?: (index: number) => number;
  layoutModel?: "flow" | "slots";
  jitter?: (index: number) => { w?: number; x?: number };
}): ItemSnapshot<string> {
  const { rows, cols, itemW, itemH, gap } = options;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const pad = options.padding ?? 0;
  const colWidth = (c: number) => options.colWidths?.[c] ?? itemW;
  const itemHeight = (i: number) => options.itemHeight?.(i) ?? itemH;
  const rowTrack = (r: number) =>
    options.rowHeights?.[r] ??
    Math.max(
      ...Array.from({ length: cols }, (_, c) => itemHeight(r * cols + c)),
    );
  const colX = (c: number) => {
    let x = originX + pad;
    for (let k = 0; k < c; k++) x += colWidth(k) + gap;
    return x;
  };
  const rowY = (r: number) => {
    let y = originY + pad;
    for (let k = 0; k < r; k++) y += rowTrack(k) + gap;
    return y;
  };
  const children: ItemSnapshot<string>[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const jitter = options.jitter?.(i) ?? {};
      children.push(
        makeItemSnapshot(
          `item-${i}`,
          makeBox({
            x: colX(c) + (jitter.x ?? 0),
            y: rowY(r),
            width: colWidth(c) + (jitter.w ?? 0),
            height: itemHeight(i),
          }),
        ),
      );
    }
  }
  const contentW = colX(cols) - gap - (originX + pad);
  const contentH = rowY(rows) - gap - (originY + pad);
  return makeContainerSnapshot(
    makeBox({
      x: originX,
      y: originY,
      width: contentW + pad * 2,
      height: contentH + pad * 2,
      padding: { top: pad, right: pad, bottom: pad, left: pad },
    }),
    children,
    "row",
    "start",
    options.layoutModel ?? "flow",
  );
}

/** Group y positions into lines `rowStep` apart and return per-line counts. */
export function rowCounts(ys: number[], rowStep: number): number[] {
  const base = Math.min(...ys);
  const counts = new Map<number, number>();
  for (const y of ys) {
    const row = Math.round((y - base) / rowStep);
    counts.set(row, (counts.get(row) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, count]) => count);
}

/** Options for the one-shot layout wrappers below. */
export interface LayoutRunOptions<N> {
  exclude?: (node: N) => boolean;
  insertions?: readonly VirtualInsertion<N>[];
}

/** Lay out one container with a throwaway plan and its local insertions. */
export function flowLayoutPositions<N extends LayoutNode<N>>(
  container: N,
  startX: number,
  startY: number,
  options: LayoutRunOptions<N> = {},
): LayoutPositions<N> {
  const insertions = options.insertions ?? [];
  const plan = createLayoutResolutionPlan(container, {
    exclude: options.exclude,
    insertions,
  });
  return plan.layoutPositions(
    container,
    startX,
    startY,
    insertions.filter((insertion) => insertion.container === container),
  );
}

/** A container's simulated border-box size with a throwaway plan. */
export function virtualDimensions<N extends LayoutNode<N>>(
  container: N,
  options: LayoutRunOptions<N> = {},
) {
  return createLayoutResolutionPlan(container, options).virtualDimensions(
    container,
  );
}

/**
 * Run the flow-layout simulation on a container snapshot and return the
 * per-line entry counts (items plus the ghost, when an insertion is given).
 * Throws if an insertion is given but the simulation produced no rect for it.
 */
export function simulatedRowCounts<T>(
  container: ItemSnapshot<T>,
  options: {
    rowStep: number;
    insertion?: VirtualInsertion<ItemSnapshot<T>>;
    exclude?: (node: ItemSnapshot<T>) => boolean;
  },
): number[] {
  const origin = contentRect(container.box);
  const result = flowLayoutPositions(container, origin.x, origin.y, {
    exclude: options.exclude,
    insertions: options.insertion ? [options.insertion] : undefined,
  });
  const ys: number[] = [];
  for (const [, position] of result.itemPositions) ys.push(position.y);
  if (options.insertion) {
    const rect = result.virtualRects.get(options.insertion);
    if (!rect) {
      throw new Error("simulation produced no rect for the insertion");
    }
    ys.push(rect.y);
  }
  return rowCounts(ys, options.rowStep);
}
