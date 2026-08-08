import type { DomProperty } from "@snap-engine/core";
import type {
  ItemSnapshot,
  LayoutDirection,
} from "./snapshot";

export type { LayoutDirection, LayoutMainAxisAlign } from "./snapshot";
type AxisName = "x" | "y";
type SizeName = "width" | "height";
/**
 * Tolerance for main-axis wrap comparisons. Measured geometry is noisy well
 * beyond double-precision: browsers lay out on a snapped grid (Blink 1/64px,
 * Gecko 1/60px app units) and `getBoundingClientRect` doubles carry
 * unit-conversion noise (~1e-5px per value in Firefox), which a simulated
 * line sum accumulates per entry — plus ~1e-2px per parsed box-model value
 * (computed style returns specified values, e.g. `0.35rem` → 5.6px, while
 * the browser lays out the snapped 5.59375px). With a tolerance below that
 * accumulated noise, a container whose items exactly fill it (zero slack)
 * over-wraps: the simulated line overshoots capacity by pure measurement
 * noise and the last column spills to the next line. The tolerance must
 * stay far below real layout features (gaps, item sizes) or lines that
 * genuinely overflow would under-wrap; 0.05px sits ~5x above the worst
 * observed noise and ~100x below typical feature scale.
 */
const LAYOUT_EPSILON = 0.05;

export interface FlowAxes {
  direction: LayoutDirection;
  main: AxisName;
  cross: AxisName;
  mainSize: SizeName;
  crossSize: SizeName;
}

interface FlowMetrics {
  mainStart: number;
  crossStart: number;
  mainGap: number;
  crossGap: number;
  lineCrossSize: number;
  lineCount: number;
  /**
   * Largest measured main-axis extent (content-relative, including the line's
   * trailing margin) that the browser actually placed on a single line. Proves
   * a lower bound on the container's true content capacity: box-model values
   * parsed from computed style are specified values (e.g. `0.35rem` → 5.6px)
   * while the browser lays out on a snapped grid (5.59375px), so a capacity
   * derived purely from parsed values can be fractionally smaller than what
   * the DOM demonstrably fits — wrapping lines the browser kept whole.
   */
  measuredMainExtent: number;
}

export interface LayoutFilter<T> {
  excludeSnapshots?: Set<ItemSnapshot<T>>;
  excludeValues?: Set<T>;
}

export interface VirtualLayoutEntry {
  width: number;
  height: number;
  margin: DomProperty["margin"];
}

export interface VirtualInsertion<T> {
  container: ItemSnapshot<T>;
  index: number;
  entry: VirtualLayoutEntry;
}

export interface VirtualDimensions {
  width: number;
  height: number;
}

export interface FlowPositionResult<T> {
  itemPositions: Map<ItemSnapshot<T>, { x: number; y: number }>;
  virtualPositions: Map<VirtualInsertion<T>, { x: number; y: number }>;
  virtualRects: Map<
    VirtualInsertion<T>,
    { x: number; y: number; width: number; height: number }
  >;
}

type FlowEntry<T> =
  | { kind: "item"; item: ItemSnapshot<T>; width: number; height: number }
  | { kind: "virtual"; insertion: VirtualInsertion<T>; width: number; height: number };

interface FlowLine<T> {
  entries: FlowEntry<T>[];
  mainSize: number;
  crossSize: number;
}

function trailingMainMargin<T>(
  entry: FlowEntry<T>,
  axes: FlowAxes,
): number {
  const margin =
    entry.kind === "item" ? entry.item.box.margin : entry.insertion.entry.margin;
  return axes.main === "x" ? margin.right : margin.bottom;
}

export function flowAxesForDirection(direction: LayoutDirection): FlowAxes {
  if (direction === "row") {
    return {
      direction,
      main: "x",
      cross: "y",
      mainSize: "width",
      crossSize: "height",
    };
  }

  return {
    direction,
    main: "y",
    cross: "x",
    mainSize: "height",
    crossSize: "width",
  };
}

export function pointFromAxes(
  axes: FlowAxes,
  main: number,
  cross: number,
): { x: number; y: number } {
  return axes.main === "x" ? { x: main, y: cross } : { x: cross, y: main };
}

export function contentBoxOrigin(prop: DomProperty): { x: number; y: number } {
  return {
    x: prop.x + prop.border.left + prop.padding.left,
    y: prop.y + prop.border.top + prop.padding.top,
  };
}

export function contentBoxSize(prop: DomProperty): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(
      0,
      prop.width -
        prop.border.left -
        prop.border.right -
        prop.padding.left -
        prop.padding.right,
    ),
    height: Math.max(
      0,
      prop.height -
        prop.border.top -
        prop.border.bottom -
        prop.padding.top -
        prop.padding.bottom,
    ),
  };
}

export function childRelativeOffset(
  containerProp: DomProperty,
  childProp: DomProperty,
): { x: number; y: number } {
  const origin = contentBoxOrigin(containerProp);
  return {
    x: childProp.x - origin.x,
    y: childProp.y - origin.y,
  };
}

export function layoutItems<T>(
  container: ItemSnapshot<T>,
  filter: LayoutFilter<T> = {},
): ItemSnapshot<T>[] {
  return container.children.filter(
    (item) =>
      !filter.excludeSnapshots?.has(item) &&
      !filter.excludeValues?.has(item.value),
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Size a virtual insertion entry for its *destination* container. The single
 * source of entry sizing for candidate simulation and the real flow spacer.
 *
 * For a `stretchItems` container the entry fills the container's cross axis
 * (width in column lists, height in row lists): content-box cross size minus
 * the entry's own cross margins, clamped to >= 0. The main-axis size always
 * stays the dragged item's own — a todo item's height is content-driven.
 * Without `stretchItems` the base size passes through unchanged (today's
 * behavior). Keeping ghost rects destination-sized is what makes candidate
 * center points correct when dragging between containers of different
 * widths (e.g. from a parent list into a narrower nested list).
 */
export function virtualEntrySizeFor<T>(
  container: ItemSnapshot<T>,
  base: { width: number; height: number; margin: DomProperty["margin"] },
): { width: number; height: number } {
  if (!container.stretchItems) {
    return { width: base.width, height: base.height };
  }
  const axes = flowAxesForDirection(container.direction);
  const content = contentBoxSize(container.box);
  const crossMargins =
    axes.cross === "x"
      ? base.margin.left + base.margin.right
      : base.margin.top + base.margin.bottom;
  const cross = Math.max(0, content[axes.crossSize] - crossMargins);
  return axes.cross === "x"
    ? { width: cross, height: base.height }
    : { width: base.width, height: cross };
}

export function inferFlowLayoutMetrics<T>(
  container: ItemSnapshot<T>,
  axes: FlowAxes,
): FlowMetrics {
  const ordered = container.children;
  if (ordered.length === 0) {
    return {
      mainStart: 0,
      crossStart: 0,
      mainGap: 0,
      crossGap: 0,
      lineCrossSize: 0,
      lineCount: 0,
      measuredMainExtent: 0,
    };
  }

  const firstOffset = childRelativeOffset(container.box, ordered[0].box);
  const mainGaps: number[] = [];
  const lines: Array<{ cross: number; crossSize: number }> = [];
  let currentLine: { cross: number; crossSize: number } | null = null;
  let previousOffset: { x: number; y: number } | null = null;
  let measuredMainExtent = 0;

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    const offset = childRelativeOffset(container.box, item.box);
    const startsNewLine =
      previousOffset != null &&
      offset[axes.main] < previousOffset[axes.main] - 1;
    if (!currentLine || startsNewLine) {
      currentLine = {
        cross: offset[axes.cross],
        crossSize: item.box[axes.crossSize],
      };
      lines.push(currentLine);
    } else {
      currentLine.crossSize = Math.max(
        currentLine.crossSize,
        item.box[axes.crossSize],
      );
    }

    const trailingMargin =
      axes.main === "x" ? item.box.margin.right : item.box.margin.bottom;
    measuredMainExtent = Math.max(
      measuredMainExtent,
      offset[axes.main] + item.box[axes.mainSize] + trailingMargin,
    );

    const next = ordered[i + 1];
    if (next) {
      const nextOffset = childRelativeOffset(container.box, next.box);
      const nextStartsNewLine = nextOffset[axes.main] < offset[axes.main] - 1;
      if (!nextStartsNewLine) {
        const gap =
          nextOffset[axes.main] - (offset[axes.main] + item.box[axes.mainSize]);
        if (gap >= 0) mainGaps.push(gap);
      }
    }
    previousOffset = offset;
  }

  const crossGaps: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const gap = lines[i + 1].cross - (lines[i].cross + lines[i].crossSize);
    if (gap >= 0) crossGaps.push(gap);
  }

  return {
    mainStart: firstOffset[axes.main],
    crossStart: firstOffset[axes.cross],
    mainGap: median(mainGaps),
    crossGap: median(crossGaps),
    lineCrossSize: median(lines.map((line) => line.crossSize)),
    lineCount: lines.length,
    measuredMainExtent,
  };
}

/**
 * Slot layout model (CSS-grid-like containers): position is a function of
 * *index*, not accumulated size. The pristine snapshot's measured child
 * boxes are the slots; simulated entry i adopts slot i's geometry, so an
 * insertion at index k shifts every following entry one slot over. This
 * inherits correctness for unequal tracks, `grid-auto-flow: column`, and RTL
 * grids, because slots are measured rather than derived.
 *
 * Contract: the main-axis (column) track geometry must not depend on which
 * items occupy it — fixed/fr/percent templates. Rows need no such
 * constraint: content-sized rows (`grid-auto-rows: auto`) are detected from
 * measurements and their heights recomputed flow-style (row height = max
 * cross size of the entries assigned to that row), so a tall item moving
 * rows grows its destination row's prediction.
 *
 * Known approximations, corrected by the real browser layout + FLIP on
 * drop: spanning items (slot geometry unstable under reorder), items with
 * `align-self: stretch` and no explicit cross size (they measure at the
 * row's height, not their intrinsic height), and content-sized *columns*.
 */
function slotLayoutPositions<T>(
  container: ItemSnapshot<T>,
  startX: number,
  startY: number,
  options: {
    filter?: LayoutFilter<T>;
    insertions?: VirtualInsertion<T>[];
  } = {},
): FlowPositionResult<T> {
  const filter = options.filter ?? {};
  const items = layoutItems(container, filter);
  const entries = assembleEntries(container, items, options);

  // Slots: content-relative rects of ALL children (unfiltered — the dragged
  // item's original box is still a valid slot for whoever shifts into it).
  const children = container.children;
  const slots = children.map((child) => {
    const rel = childRelativeOffset(container.box, child.box);
    return {
      x: rel.x,
      y: rel.y,
      width: child.box.width,
      height: child.box.height,
    };
  });

  // The fill axis is measured, not declared: consecutive slots advance along
  // the main axis of the grid's auto-flow (x for row-major, y for
  // `grid-auto-flow: column`).
  const fillAxis: AxisName =
    slots.length >= 2 &&
    Math.abs(slots[1].y - slots[0].y) > Math.abs(slots[1].x - slots[0].x)
      ? "y"
      : "x";
  const crossAxis: AxisName = fillAxis === "x" ? "y" : "x";
  const crossSizeName: SizeName = fillAxis === "x" ? "height" : "width";
  const entryCrossSize = (entry: FlowEntry<T>) => entry[crossSizeName];

  // Group slots into lines by fill-axis regression (same heuristic as
  // inferFlowLayoutMetrics).
  const lineOfSlot: number[] = [];
  const lines: number[][] = [];
  for (let i = 0; i < slots.length; i++) {
    const startsNewLine =
      i > 0 && slots[i][fillAxis] < slots[i - 1][fillAxis] - 1;
    if (i === 0 || startsNewLine) lines.push([]);
    lineOfSlot.push(lines.length - 1);
    lines[lines.length - 1].push(i);
  }
  const perLine = Math.max(...lines.map((line) => line.length));

  // Detect content-sized rows: each measured line's cross advance minus the
  // tallest item in it leaves the same residual (the row gap). Fixed tracks
  // with slack leave varying residuals when item sizes vary; a single line
  // is ambiguous, where both variants agree at capture time.
  const lineCrossStart = (line: number[]) =>
    Math.min(...line.map((i) => slots[i][crossAxis]));
  const lineMaxItemCross = (line: number[]) =>
    Math.max(...line.map((i) => slots[i][crossSizeName]));
  const residuals: number[] = [];
  for (let j = 0; j < lines.length - 1; j++) {
    residuals.push(
      lineCrossStart(lines[j + 1]) -
        lineCrossStart(lines[j]) -
        lineMaxItemCross(lines[j]),
    );
  }
  const contentSizedRows =
    residuals.length === 0 ||
    residuals.every((residual) => Math.abs(residual - residuals[0]) <= 0.75);
  const crossGap = residuals.length > 0 ? Math.max(0, median(residuals)) : 0;

  // Geometry per entry index: measured slot, or one extrapolated slot past
  // the end (entries exceed slots by at most one insertion) reusing the
  // main-axis geometry of the slot one full line earlier.
  const slotForEntry = (index: number) => {
    if (index < slots.length) {
      const line = lineOfSlot[index];
      return {
        ...slots[index],
        line,
        // Offset within the row (e.g. align-self) survives row movement.
        crossOffset: slots[index][crossAxis] - lineCrossStart(lines[line]),
      };
    }
    const wrapped = Math.max(0, index - perLine);
    return {
      ...slots[wrapped],
      line: lineOfSlot[wrapped] + 1,
      crossOffset: 0,
    };
  };

  // Cross-axis position per line: measured for static tracks; accumulated
  // from assigned entry sizes for content-sized rows.
  const entrySlots = entries.map((_, index) => slotForEntry(index));
  const lineCount = entrySlots.length
    ? Math.max(...entrySlots.map((slot) => slot.line)) + 1
    : 0;
  const lineCross: number[] = [];
  if (contentSizedRows) {
    let cursor = lines.length > 0 ? lineCrossStart(lines[0]) : 0;
    for (let j = 0; j < lineCount; j++) {
      lineCross.push(cursor);
      let lineHeight = 0;
      for (let index = 0; index < entries.length; index++) {
        if (entrySlots[index].line === j) {
          lineHeight = Math.max(lineHeight, entryCrossSize(entries[index]));
        }
      }
      cursor += lineHeight + crossGap;
    }
  } else {
    for (let j = 0; j < lineCount; j++) {
      if (j < lines.length) {
        lineCross.push(lineCrossStart(lines[j]));
      } else {
        // Extrapolated line: extend by the last measured cross advance.
        const last = lines.length - 1;
        const advance =
          last > 0
            ? lineCrossStart(lines[last]) - lineCrossStart(lines[last - 1])
            : lineMaxItemCross(lines[last]) + crossGap;
        lineCross.push(lineCrossStart(lines[last]) + advance);
      }
    }
  }

  const origin = { x: startX, y: startY };
  const itemPositions = new Map<ItemSnapshot<T>, { x: number; y: number }>();
  const virtualPositions = new Map<VirtualInsertion<T>, { x: number; y: number }>();
  const virtualRects = new Map<
    VirtualInsertion<T>,
    { x: number; y: number; width: number; height: number }
  >();

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const slot = entrySlots[index];
    const main = slot[fillAxis];
    const cross = lineCross[slot.line] + slot.crossOffset;
    const position =
      fillAxis === "x"
        ? { x: origin.x + main, y: origin.y + cross }
        : { x: origin.x + cross, y: origin.y + main };

    if (entry.kind === "virtual") {
      virtualPositions.set(entry.insertion, position);
      virtualRects.set(entry.insertion, {
        ...position,
        // The slot's measured main-axis size (the track); for content-sized
        // rows the cross size is the entry's own, since the row will size
        // to its content.
        width:
          fillAxis === "x"
            ? slot.width
            : contentSizedRows
              ? entry.width
              : slot.width,
        height:
          fillAxis === "x"
            ? contentSizedRows
              ? entry.height
              : slot.height
            : slot.height,
      });
    } else {
      itemPositions.set(entry.item, position);
    }
  }

  return { itemPositions, virtualPositions, virtualRects };
}

function assembleEntries<T>(
  container: ItemSnapshot<T>,
  items: ItemSnapshot<T>[],
  options: {
    filter?: LayoutFilter<T>;
    insertions?: VirtualInsertion<T>[];
  },
): FlowEntry<T>[] {
  const entries: FlowEntry<T>[] = items.map((item) => {
    const dimensions =
      item.children.length > 0
        ? virtualDimensions(item, options)
        : item.box;
    return {
      kind: "item",
      item,
      width: dimensions.width,
      height: dimensions.height,
    };
  });

  const insertions = options.insertions ?? [];
  for (const insertion of insertions) {
    if (insertion.container === container) {
      entries.splice(Math.max(0, Math.min(insertion.index, entries.length)), 0, {
        kind: "virtual",
        insertion,
        width: insertion.entry.width,
        height: insertion.entry.height,
      });
    }
  }
  return entries;
}

export function flowLayoutPositions<T>(
  container: ItemSnapshot<T>,
  startX: number,
  startY: number,
  options: {
    filter?: LayoutFilter<T>;
    insertions?: VirtualInsertion<T>[];
  } = {},
): FlowPositionResult<T> {
  if (container.layoutModel === "slots" && container.children.length > 0) {
    return slotLayoutPositions(container, startX, startY, options);
  }
  const axes = flowAxesForDirection(container.direction);
  const contentSize = contentBoxSize(container.box);
  const filter = options.filter ?? {};
  const items = layoutItems(container, filter);
  const metrics = inferFlowLayoutMetrics(container, axes);
  const entries = assembleEntries(container, items, options);

  const itemPositions = new Map<ItemSnapshot<T>, { x: number; y: number }>();
  const virtualPositions = new Map<VirtualInsertion<T>, { x: number; y: number }>();
  const virtualRects = new Map<
    VirtualInsertion<T>,
    { x: number; y: number; width: number; height: number }
  >();
  const origin = { x: startX, y: startY };
  const lineCrossStart = origin[axes.cross] + metrics.crossStart;
  const canWrap =
    container.wrap !== "nowrap" &&
    (axes.direction === "row" || metrics.lineCount > 1);
  const lines: FlowLine<T>[] = [];
  let currentLine: FlowLine<T> = { entries: [], mainSize: 0, crossSize: 0 };

  const pushCurrentLine = () => {
    if (currentLine.entries.length > 0) {
      lines.push(currentLine);
      currentLine = { entries: [], mainSize: 0, crossSize: 0 };
    }
  };

  // Calibrate the wrap capacity against what the browser demonstrably placed
  // on a single line. The parsed content size can be fractionally smaller
  // than the true layout capacity (specified vs snapped box values), which
  // would wrap lines the DOM keeps whole. Raising capacity to the measured
  // extent is always safe: it never exceeds the browser's real capacity, so
  // genuine overflow introduced by an inserted ghost still wraps.
  const mainCapacity = Math.max(
    contentSize[axes.mainSize],
    metrics.measuredMainExtent,
  );

  for (const entry of entries) {
    const entryMainSize = entry[axes.mainSize];
    const entryCrossSize = entry[axes.crossSize];
    const entryTrailingMainMargin = trailingMainMargin(entry, axes);
    if (
      canWrap &&
      currentLine.entries.length > 0 &&
      metrics.mainStart +
        currentLine.mainSize +
        metrics.mainGap +
        entryMainSize +
        entryTrailingMainMargin >
        mainCapacity + LAYOUT_EPSILON
    ) {
      pushCurrentLine();
    }

    currentLine.mainSize +=
      currentLine.entries.length === 0
        ? entryMainSize
        : metrics.mainGap + entryMainSize;
    currentLine.crossSize = Math.max(currentLine.crossSize, entryCrossSize);
    currentLine.entries.push(entry);
  }
  pushCurrentLine();

  let cursorCross = lineCrossStart;
  for (const line of lines) {
    const lineMainStart =
      axes.direction === "row" && container.mainAxisAlign === "center"
        ? origin[axes.main] +
          Math.max(0, (contentSize[axes.mainSize] - line.mainSize) / 2)
        : origin[axes.main] + metrics.mainStart;
    let cursorMain = lineMainStart;

    for (const entry of line.entries) {
      const entryMainSize = entry[axes.mainSize];
      const position = pointFromAxes(axes, cursorMain, cursorCross);

      if (entry.kind === "virtual") {
        virtualPositions.set(entry.insertion, position);
        virtualRects.set(entry.insertion, {
          ...position,
          width: entry.width,
          height: entry.height,
        });
      } else {
        itemPositions.set(entry.item, position);
      }

      cursorMain += entryMainSize + metrics.mainGap;
    }

    cursorCross += line.crossSize + metrics.crossGap;
  }

  return { itemPositions, virtualPositions, virtualRects };
}

export function virtualDimensions<T>(
  container: ItemSnapshot<T>,
  options: {
    filter?: LayoutFilter<T>;
    insertions?: VirtualInsertion<T>[];
  } = {},
): VirtualDimensions {
  const axes = flowAxesForDirection(container.direction);
  const filter = options.filter ?? {};
  const items = layoutItems(container, filter);
  const flowPositions = flowLayoutPositions(
    container,
    0,
    0,
    options,
  );
  let maxX = 0;
  let maxY = 0;

  for (const child of items) {
    const dimensions =
      child.children.length > 0
        ? virtualDimensions(child, options)
        : child.box;
    const rel = childRelativeOffset(container.box, child.box);
    const measured = { x: rel.x, y: rel.y };
    const simulated = flowPositions.itemPositions.get(child) ?? measured;
    maxX = Math.max(maxX, simulated.x + dimensions.width);
    maxY = Math.max(maxY, simulated.y + dimensions.height);
  }

  for (const [insertion, rect] of flowPositions.virtualRects) {
    if (insertion.container === container) {
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }
  }

  const snapshotSize = {
    width: container.box.width,
    height: container.box.height,
  };
  const virtualSize = {
    width:
      container.box.border.left +
      container.box.padding.left +
      maxX +
      container.box.padding.right +
      container.box.border.right,
    height:
      container.box.border.top +
      container.box.padding.top +
      maxY +
      container.box.padding.bottom +
      container.box.border.bottom,
  };

  const hasLocalInsertion = (options.insertions ?? []).some(
    (insertion) => insertion.container === container,
  );
  if (items.length === 0 && !hasLocalInsertion) {
    return snapshotSize;
  }

  if (axes.direction === "row") {
    return {
      width: snapshotSize.width,
      height: Math.max(snapshotSize.height, virtualSize.height),
    };
  }

  return {
    width: snapshotSize.width,
    height: virtualSize.height,
  };
}
