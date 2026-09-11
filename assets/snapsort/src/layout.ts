import type { BoxModel, Edges } from "@snap-engine/core";
import type { ItemSnapshot, LayoutDirection, LayoutWrap } from "./snapshot";

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
const LINE_RESET_EPSILON = 1;

/** @internal Whether measured main-axis coordinates begin a wrapped line. */
export function startsNewVisualLine(
  wrap: LayoutWrap,
  previousMainStart: number,
  nextMainStart: number,
): boolean {
  return (
    wrap !== "nowrap" && nextMainStart < previousMainStart - LINE_RESET_EPSILON
  );
}

/** @internal Whether a measured flow layout can create another visual line. */
export function flowLayoutCanWrap<T>(
  container: ItemSnapshot<T>,
  axes: FlowAxes,
  measuredLineCount: number,
): boolean {
  return (
    container.wrap !== "nowrap" &&
    (axes.direction === "row" || measuredLineCount > 1)
  );
}

export interface FlowAxes {
  readonly direction: LayoutDirection;
  readonly main: AxisName;
  readonly cross: AxisName;
  readonly mainSize: SizeName;
  readonly crossSize: SizeName;
}

export interface FlowMetrics {
  readonly mainStart: number;
  readonly crossStart: number;
  readonly mainGap: number;
  readonly crossGap: number;
  readonly lineCrossSize: number;
  readonly lineCount: number;
  /**
   * Largest measured main-axis extent (content-relative, including the line's
   * trailing margin) that the browser actually placed on a single line. Proves
   * a lower bound on the container's true content capacity: box-model values
   * parsed from computed style are specified values (e.g. `0.35rem` → 5.6px)
   * while the browser lays out on a snapped grid (5.59375px), so a capacity
   * derived purely from parsed values can be fractionally smaller than what
   * the DOM demonstrably fits — wrapping lines the browser kept whole.
   */
  readonly measuredMainExtent: number;
}

/** @internal One measured visual line in content-box-relative coordinates. */
export interface SnapshotVisualLine<T> {
  readonly snapshots: readonly ItemSnapshot<T>[];
  readonly crossStart: number;
  readonly crossSize: number;
}

export interface LayoutFilter<T> {
  excludeSnapshots?: Set<ItemSnapshot<T>>;
  excludeValues?: Set<T>;
}

export interface VirtualLayoutEntry {
  width: number;
  height: number;
  margin: Edges;
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
  virtualRects: Map<
    VirtualInsertion<T>,
    { x: number; y: number; width: number; height: number }
  >;
}

type FlowEntry<T> =
  | { kind: "item"; item: ItemSnapshot<T>; width: number; height: number }
  | {
      kind: "virtual";
      insertion: VirtualInsertion<T>;
      width: number;
      height: number;
    };

interface FlowLine<T> {
  entries: FlowEntry<T>[];
  mainSize: number;
  crossSize: number;
}

export interface LayoutPlanDiagnostics<T> {
  // Internal deterministic work-count hook; not exported by the package root.
  onSnapshotVisit?: (snapshot: ItemSnapshot<T>) => void;
}

export interface LayoutContainerPlan<T> {
  readonly snapshot: ItemSnapshot<T>;
  readonly axes: FlowAxes;
  readonly contentSize: Readonly<{ width: number; height: number }>;
  readonly metrics: FlowMetrics;
  readonly eligibleChildren: readonly ItemSnapshot<T>[];
}

export interface LayoutResolutionPlan<T> {
  containerPlan(container: ItemSnapshot<T>): LayoutContainerPlan<T>;
  layoutPositions(
    container: ItemSnapshot<T>,
    startX: number,
    startY: number,
    localInsertions?: readonly VirtualInsertion<T>[],
  ): FlowPositionResult<T>;
  virtualDimensions(container: ItemSnapshot<T>): VirtualDimensions;
}

function trailingMainMargin<T>(entry: FlowEntry<T>, axes: FlowAxes): number {
  const margin =
    entry.kind === "item"
      ? entry.item.box.margin
      : entry.insertion.entry.margin;
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

export function contentBoxOrigin(prop: BoxModel): { x: number; y: number } {
  return {
    x: prop.x + prop.border.left + prop.padding.left,
    y: prop.y + prop.border.top + prop.padding.top,
  };
}

export function contentBoxSize(prop: BoxModel): {
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
  containerProp: BoxModel,
  childProp: BoxModel,
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

/**
 * Infer measured visual lines once from the frozen snapshot. Layout metrics
 * and insertion geometry share this boundary detection so their understanding
 * of wrapping cannot drift apart.
 */
export function inferSnapshotVisualLines<T>(
  container: ItemSnapshot<T>,
  axes: FlowAxes,
): readonly SnapshotVisualLine<T>[] {
  const lines: Array<{
    snapshots: ItemSnapshot<T>[];
    crossStart: number;
    crossEnd: number;
  }> = [];
  let previousMainStart: number | null = null;

  for (const snapshot of container.children) {
    const offset = childRelativeOffset(container.box, snapshot.box);
    const mainStart = offset[axes.main];
    const startsNewLine =
      previousMainStart !== null &&
      startsNewVisualLine(container.wrap, previousMainStart, mainStart);
    const crossStart = offset[axes.cross];
    const crossEnd = crossStart + snapshot.box[axes.crossSize];

    if (lines.length === 0 || startsNewLine) {
      lines.push({ snapshots: [snapshot], crossStart, crossEnd });
    } else {
      const line = lines[lines.length - 1];
      line.snapshots.push(snapshot);
      line.crossStart = Math.min(line.crossStart, crossStart);
      line.crossEnd = Math.max(line.crossEnd, crossEnd);
    }
    previousMainStart = mainStart;
  }

  return Object.freeze(
    lines.map((line) =>
      Object.freeze({
        snapshots: Object.freeze([...line.snapshots]),
        crossStart: line.crossStart,
        crossSize: Math.max(0, line.crossEnd - line.crossStart),
      }),
    ),
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
  base: { width: number; height: number; margin: Edges },
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
  const visualLines = inferSnapshotVisualLines(container, axes);
  const lineBySnapshot = new Map<ItemSnapshot<T>, SnapshotVisualLine<T>>();
  for (const line of visualLines) {
    for (const snapshot of line.snapshots) {
      lineBySnapshot.set(snapshot, line);
    }
  }
  let measuredMainExtent = 0;

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    const offset = childRelativeOffset(container.box, item.box);

    const trailingMargin =
      axes.main === "x" ? item.box.margin.right : item.box.margin.bottom;
    measuredMainExtent = Math.max(
      measuredMainExtent,
      offset[axes.main] + item.box[axes.mainSize] + trailingMargin,
    );

    const next = ordered[i + 1];
    if (next) {
      const nextOffset = childRelativeOffset(container.box, next.box);
      const nextStartsNewLine =
        lineBySnapshot.get(item) !== lineBySnapshot.get(next);
      if (!nextStartsNewLine) {
        const gap =
          nextOffset[axes.main] - (offset[axes.main] + item.box[axes.mainSize]);
        if (gap >= 0) mainGaps.push(gap);
      }
    }
  }

  const crossGaps: number[] = [];
  for (let i = 0; i < visualLines.length - 1; i++) {
    const gap =
      visualLines[i + 1].crossStart -
      (visualLines[i].crossStart + visualLines[i].crossSize);
    if (gap >= 0) crossGaps.push(gap);
  }

  return {
    mainStart: firstOffset[axes.main],
    crossStart: firstOffset[axes.cross],
    mainGap: median(mainGaps),
    crossGap: median(crossGaps),
    lineCrossSize: median(visualLines.map((line) => line.crossSize)),
    lineCount: visualLines.length,
    measuredMainExtent,
  };
}

interface SlotRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SlotEntryRect extends SlotRect {
  readonly line: number;
  readonly crossOffset: number;
}

interface FlowBackendPlan {
  readonly kind: "flow";
  readonly canWrap: boolean;
  readonly mainCapacity: number;
}

interface SlotBackendPlan {
  readonly kind: "slots";
  readonly slots: readonly SlotRect[];
  readonly fillAxis: AxisName;
  readonly crossAxis: AxisName;
  readonly crossSizeName: SizeName;
  readonly lineOfSlot: readonly number[];
  readonly lineCrossStarts: readonly number[];
  readonly lineMaxItemCross: readonly number[];
  readonly perLine: number;
  readonly contentSizedRows: boolean;
  readonly crossGap: number;
}

type LayoutBackendPlan = FlowBackendPlan | SlotBackendPlan;

interface ContainerPlanGeometry<T> extends LayoutContainerPlan<T> {
  readonly entries: readonly FlowEntry<T>[];
  readonly backend: LayoutBackendPlan;
}

interface InternalContainerPlan<T> extends ContainerPlanGeometry<T> {
  readonly baseDimensions: VirtualDimensions;
}

function localInsertionsFor<T>(
  container: ItemSnapshot<T>,
  insertions: readonly VirtualInsertion<T>[],
): VirtualInsertion<T>[] {
  return insertions.filter((insertion) => insertion.container === container);
}

function materializeEntries<T>(
  plan: ContainerPlanGeometry<T>,
  insertions: readonly VirtualInsertion<T>[],
): FlowEntry<T>[] {
  const entries = plan.entries.slice();
  for (const insertion of insertions) {
    if (insertion.container !== plan.snapshot) continue;
    entries.splice(Math.max(0, Math.min(insertion.index, entries.length)), 0, {
      kind: "virtual",
      insertion,
      width: insertion.entry.width,
      height: insertion.entry.height,
    });
  }
  return entries;
}

function createSlotBackendPlan<T>(container: ItemSnapshot<T>): SlotBackendPlan {
  // Slots remain unfiltered: the dragged item's measured box is still valid
  // geometry for whichever entry shifts into that slot.
  const slots = container.children.map((child) => {
    const rel = childRelativeOffset(container.box, child.box);
    return Object.freeze({
      x: rel.x,
      y: rel.y,
      width: child.box.width,
      height: child.box.height,
    });
  });
  const fillAxis: AxisName =
    slots.length >= 2 &&
    Math.abs(slots[1].y - slots[0].y) > Math.abs(slots[1].x - slots[0].x)
      ? "y"
      : "x";
  const crossAxis: AxisName = fillAxis === "x" ? "y" : "x";
  const crossSizeName: SizeName = fillAxis === "x" ? "height" : "width";

  // Accumulate line membership, starts, and maxima together. Candidate
  // materialization can then reuse this measured geometry without rescanning
  // every slot for every line.
  const lineOfSlot: number[] = [];
  const lineCrossStarts: number[] = [];
  const lineMaxItemCross: number[] = [];
  const lineLengths: number[] = [];
  for (let index = 0; index < slots.length; index++) {
    const startsNewLine =
      index === 0 || slots[index][fillAxis] < slots[index - 1][fillAxis] - 1;
    if (startsNewLine) {
      lineCrossStarts.push(slots[index][crossAxis]);
      lineMaxItemCross.push(slots[index][crossSizeName]);
      lineLengths.push(0);
    }
    const line = lineCrossStarts.length - 1;
    lineOfSlot.push(line);
    lineCrossStarts[line] = Math.min(
      lineCrossStarts[line],
      slots[index][crossAxis],
    );
    lineMaxItemCross[line] = Math.max(
      lineMaxItemCross[line],
      slots[index][crossSizeName],
    );
    lineLengths[line]++;
  }

  const residuals: number[] = [];
  for (let line = 0; line < lineCrossStarts.length - 1; line++) {
    residuals.push(
      lineCrossStarts[line + 1] -
        lineCrossStarts[line] -
        lineMaxItemCross[line],
    );
  }
  const contentSizedRows =
    residuals.length === 0 ||
    residuals.every((residual) => Math.abs(residual - residuals[0]) <= 0.75);

  return Object.freeze({
    kind: "slots",
    slots: Object.freeze(slots),
    fillAxis,
    crossAxis,
    crossSizeName,
    lineOfSlot: Object.freeze(lineOfSlot),
    lineCrossStarts: Object.freeze(lineCrossStarts),
    lineMaxItemCross: Object.freeze(lineMaxItemCross),
    perLine: Math.max(...lineLengths),
    contentSizedRows,
    crossGap: residuals.length > 0 ? Math.max(0, median(residuals)) : 0,
  });
}

function slotForEntry(backend: SlotBackendPlan, index: number): SlotEntryRect {
  if (index < backend.slots.length) {
    const line = backend.lineOfSlot[index];
    return {
      ...backend.slots[index],
      line,
      // Offset within a row (for example align-self) survives row movement.
      crossOffset:
        backend.slots[index][backend.crossAxis] - backend.lineCrossStarts[line],
    };
  }
  const wrapped = Math.max(0, index - backend.perLine);
  return {
    ...backend.slots[wrapped],
    line: backend.lineOfSlot[wrapped] + 1,
    crossOffset: 0,
  };
}

/**
 * Materialize a measured-slot plan. Flow and slot backends intentionally stay
 * separate: slot position is a function of index and measured track geometry,
 * while flow position is accumulated from entry dimensions.
 */
function materializeSlotLayout<T>(
  backend: SlotBackendPlan,
  startX: number,
  startY: number,
  entries: FlowEntry<T>[],
): FlowPositionResult<T> {
  const entrySlots = entries.map((_, index) => slotForEntry(backend, index));
  const lineCount = entrySlots.length
    ? Math.max(...entrySlots.map((slot) => slot.line)) + 1
    : 0;
  const lineCross: number[] = [];

  if (backend.contentSizedRows) {
    const lineMaxEntryCross = Array.from({ length: lineCount }, () => 0);
    for (let index = 0; index < entries.length; index++) {
      const line = entrySlots[index].line;
      lineMaxEntryCross[line] = Math.max(
        lineMaxEntryCross[line],
        entries[index][backend.crossSizeName],
      );
    }
    let cursor = backend.lineCrossStarts[0] ?? 0;
    for (let line = 0; line < lineCount; line++) {
      lineCross.push(cursor);
      cursor += lineMaxEntryCross[line] + backend.crossGap;
    }
  } else {
    for (let line = 0; line < lineCount; line++) {
      if (line < backend.lineCrossStarts.length) {
        lineCross.push(backend.lineCrossStarts[line]);
        continue;
      }
      const last = backend.lineCrossStarts.length - 1;
      const advance =
        last > 0
          ? backend.lineCrossStarts[last] - backend.lineCrossStarts[last - 1]
          : backend.lineMaxItemCross[last] + backend.crossGap;
      lineCross.push(backend.lineCrossStarts[last] + advance);
    }
  }

  const itemPositions = new Map<ItemSnapshot<T>, { x: number; y: number }>();
  const virtualRects = new Map<
    VirtualInsertion<T>,
    { x: number; y: number; width: number; height: number }
  >();
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const slot = entrySlots[index];
    const main = slot[backend.fillAxis];
    const cross = lineCross[slot.line] + slot.crossOffset;
    const position =
      backend.fillAxis === "x"
        ? { x: startX + main, y: startY + cross }
        : { x: startX + cross, y: startY + main };

    if (entry.kind === "item") {
      itemPositions.set(entry.item, position);
      continue;
    }
    virtualRects.set(entry.insertion, {
      ...position,
      width:
        backend.fillAxis === "x"
          ? slot.width
          : backend.contentSizedRows
            ? entry.width
            : slot.width,
      height:
        backend.fillAxis === "x"
          ? backend.contentSizedRows
            ? entry.height
            : slot.height
          : slot.height,
    });
  }
  return { itemPositions, virtualRects };
}

function materializeFlowLayout<T>(
  plan: ContainerPlanGeometry<T>,
  backend: FlowBackendPlan,
  startX: number,
  startY: number,
  entries: FlowEntry<T>[],
): FlowPositionResult<T> {
  const { axes, contentSize, metrics, snapshot: container } = plan;
  const lines: FlowLine<T>[] = [];
  let currentLine: FlowLine<T> = { entries: [], mainSize: 0, crossSize: 0 };
  const pushCurrentLine = () => {
    if (currentLine.entries.length === 0) return;
    lines.push(currentLine);
    currentLine = { entries: [], mainSize: 0, crossSize: 0 };
  };

  for (const entry of entries) {
    const entryMainSize = entry[axes.mainSize];
    const entryCrossSize = entry[axes.crossSize];
    const entryTrailingMainMargin = trailingMainMargin(entry, axes);
    if (
      backend.canWrap &&
      currentLine.entries.length > 0 &&
      metrics.mainStart +
        currentLine.mainSize +
        metrics.mainGap +
        entryMainSize +
        entryTrailingMainMargin >
        backend.mainCapacity + LAYOUT_EPSILON
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

  const itemPositions = new Map<ItemSnapshot<T>, { x: number; y: number }>();
  const virtualRects = new Map<
    VirtualInsertion<T>,
    { x: number; y: number; width: number; height: number }
  >();
  const origin = { x: startX, y: startY };
  let cursorCross = origin[axes.cross] + metrics.crossStart;
  for (const line of lines) {
    const lineMainStart =
      axes.direction === "row" && container.mainAxisAlign === "center"
        ? origin[axes.main] +
          Math.max(0, (contentSize[axes.mainSize] - line.mainSize) / 2)
        : origin[axes.main] + metrics.mainStart;
    let cursorMain = lineMainStart;
    for (const entry of line.entries) {
      const position = pointFromAxes(axes, cursorMain, cursorCross);
      if (entry.kind === "virtual") {
        virtualRects.set(entry.insertion, {
          ...position,
          width: entry.width,
          height: entry.height,
        });
      } else {
        itemPositions.set(entry.item, position);
      }
      cursorMain += entry[axes.mainSize] + metrics.mainGap;
    }
    cursorCross += line.crossSize + metrics.crossGap;
  }
  return { itemPositions, virtualRects };
}

function materializeLayout<T>(
  plan: ContainerPlanGeometry<T>,
  startX: number,
  startY: number,
  localInsertions: readonly VirtualInsertion<T>[],
): FlowPositionResult<T> {
  const entries = materializeEntries(plan, localInsertions);
  return plan.backend.kind === "slots"
    ? materializeSlotLayout(plan.backend, startX, startY, entries)
    : materializeFlowLayout(plan, plan.backend, startX, startY, entries);
}

function dimensionsFromLayout<T>(
  plan: ContainerPlanGeometry<T>,
  localInsertions: readonly VirtualInsertion<T>[],
): VirtualDimensions {
  const positions = materializeLayout(plan, 0, 0, localInsertions);
  let maxX = 0;
  let maxY = 0;
  for (const entry of plan.entries) {
    if (entry.kind !== "item") continue;
    const rel = childRelativeOffset(plan.snapshot.box, entry.item.box);
    const position = positions.itemPositions.get(entry.item) ?? rel;
    maxX = Math.max(maxX, position.x + entry.width);
    maxY = Math.max(maxY, position.y + entry.height);
  }
  for (const rect of positions.virtualRects.values()) {
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  const container = plan.snapshot;
  const snapshotSize = {
    width: container.box.width,
    height: container.box.height,
  };
  if (plan.entries.length === 0 && localInsertions.length === 0) {
    return snapshotSize;
  }
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
  return plan.axes.direction === "row"
    ? {
        width: snapshotSize.width,
        height: Math.max(snapshotSize.height, virtualSize.height),
      }
    : { width: snapshotSize.width, height: virtualSize.height };
}

/**
 * Build one immutable layout plan for a frozen drop-target resolution.
 * Descendant active insertions are folded into cached child dimensions, while
 * `layoutPositions` accepts the local insertion that replaces the container's
 * current pending ghost for an individual candidate.
 */
export function createLayoutResolutionPlan<T>(
  root: ItemSnapshot<T>,
  options: {
    filter?: LayoutFilter<T>;
    insertions?: readonly VirtualInsertion<T>[];
    diagnostics?: LayoutPlanDiagnostics<T>;
  } = {},
): LayoutResolutionPlan<T> {
  const filter = options.filter ?? {};
  const insertions = Object.freeze([...(options.insertions ?? [])]);
  const plans = new Map<ItemSnapshot<T>, InternalContainerPlan<T>>();

  const build = (container: ItemSnapshot<T>): InternalContainerPlan<T> => {
    const cached = plans.get(container);
    if (cached) return cached;
    options.diagnostics?.onSnapshotVisit?.(container);
    const eligibleChildren = Object.freeze(layoutItems(container, filter));
    const childPlans = new Map<ItemSnapshot<T>, InternalContainerPlan<T>>();
    for (const child of eligibleChildren) {
      childPlans.set(child, build(child));
    }

    const axes = Object.freeze(flowAxesForDirection(container.direction));
    const contentSize = Object.freeze(contentBoxSize(container.box));
    const metrics = Object.freeze(inferFlowLayoutMetrics(container, axes));
    const entries = Object.freeze(
      eligibleChildren.map((child): FlowEntry<T> => {
        const dimensions =
          child.children.length > 0
            ? childPlans.get(child)!.baseDimensions
            : child.box;
        return Object.freeze({
          kind: "item",
          item: child,
          width: dimensions.width,
          height: dimensions.height,
        });
      }),
    );
    const backend: LayoutBackendPlan =
      container.layoutModel === "slots" && container.children.length > 0
        ? createSlotBackendPlan(container)
        : Object.freeze({
            kind: "flow",
            canWrap: flowLayoutCanWrap(container, axes, metrics.lineCount),
            // Keep the measured-capacity calibration and jitter tolerance
            // exactly where candidate materialization applies wrapping.
            mainCapacity: Math.max(
              contentSize[axes.mainSize],
              metrics.measuredMainExtent,
            ),
          });

    const geometry = {
      snapshot: container,
      axes,
      contentSize,
      metrics,
      eligibleChildren,
      entries,
      backend,
    } satisfies ContainerPlanGeometry<T>;
    const localInsertions = localInsertionsFor(container, insertions);
    const baseDimensions = Object.freeze(
      dimensionsFromLayout(geometry, localInsertions),
    );
    const plan = Object.freeze({ ...geometry, baseDimensions });
    plans.set(container, plan);
    return plan;
  };

  build(root);
  return Object.freeze({
    containerPlan(container: ItemSnapshot<T>): LayoutContainerPlan<T> {
      const plan = plans.get(container);
      if (!plan) throw new Error("Snapshot is outside this layout resolution");
      return plan;
    },
    layoutPositions(
      container: ItemSnapshot<T>,
      startX: number,
      startY: number,
      localInsertions: readonly VirtualInsertion<T>[] = [],
    ): FlowPositionResult<T> {
      const plan = plans.get(container);
      if (!plan) throw new Error("Snapshot is outside this layout resolution");
      return materializeLayout(plan, startX, startY, localInsertions);
    },
    virtualDimensions(container: ItemSnapshot<T>): VirtualDimensions {
      const plan = plans.get(container);
      if (!plan) throw new Error("Snapshot is outside this layout resolution");
      return plan.baseDimensions;
    },
  });
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
  const insertions = options.insertions ?? [];
  const plan = createLayoutResolutionPlan(container, {
    filter: options.filter,
    insertions,
  });
  return plan.layoutPositions(
    container,
    startX,
    startY,
    localInsertionsFor(container, insertions),
  );
}

export function virtualDimensions<T>(
  container: ItemSnapshot<T>,
  options: {
    filter?: LayoutFilter<T>;
    insertions?: VirtualInsertion<T>[];
  } = {},
): VirtualDimensions {
  return createLayoutResolutionPlan(container, options).virtualDimensions(
    container,
  );
}
