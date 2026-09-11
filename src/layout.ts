/**
 * Layout simulation over measured box trees.
 *
 * Given a frozen tree of measured boxes (typically captured from the DOM at
 * the start of a gesture), this module infers the metrics the browser used —
 * content-box start offsets, main/cross gaps, line sizes, wrap capacity — and
 * re-runs that layout with nodes removed and virtual entries inserted. It
 * never reads the DOM, so a plan built from one snapshot answers any number
 * of "what if" questions without layout thrash.
 *
 * Two backends share one plan:
 * - `flow` re-accumulates entries along the main axis and wraps them against
 *   the measured capacity (flexbox-style flow).
 * - `slots` places entries into measured track positions by index, the basis
 *   for simulating CSS grid.
 */
import {
  addEdges,
  contentOffset,
  contentRect,
  outsetRect,
  type Axis,
  type BoxModel,
  type Dimension,
  type Edges,
  type Point,
  type Rect,
  type Size,
} from "./geometry";

/** Main-axis direction of a layout container. */
export type LayoutDirection = "column" | "row";

/** Main-axis alignment of a layout container's lines. */
export type LayoutMainAxisAlign = "start" | "center";

/** Layout backend: accumulated flow, or measured grid slots. */
export type LayoutModel = "flow" | "slots";

/** Whether a flow container may wrap onto additional lines. */
export type LayoutWrap = "auto" | "nowrap";

/**
 * One node in a measured layout tree. Leaves only need `box`; containers
 * also describe how they lay out their `children`.
 */
export interface LayoutNode<Child extends LayoutNode<Child>> {
  readonly box: BoxModel;
  readonly children: readonly Child[];
  readonly direction: LayoutDirection;
  readonly mainAxisAlign: LayoutMainAxisAlign;
  readonly layoutModel: LayoutModel;
  readonly wrap: LayoutWrap;
  readonly stretchItems: boolean;
}

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
export const LAYOUT_WRAP_TOLERANCE = 0.05;

/**
 * How far a measured main-axis start must move backwards before it counts
 * as the start of a new visual line, absorbing sub-pixel jitter between
 * items on the same line.
 */
export const LAYOUT_LINE_BREAK_TOLERANCE = 1;

/**
 * Maximum spread between inter-row residuals for a slot grid to count as
 * content-sized rows (rows that grow with their tallest entry) rather than
 * fixed template tracks.
 */
const SLOT_ROW_RESIDUAL_TOLERANCE = 0.75;

/** Whether measured main-axis coordinates begin a wrapped line. */
export function startsNewVisualLine(
  wrap: LayoutWrap,
  previousMainStart: number,
  nextMainStart: number,
): boolean {
  return (
    wrap !== "nowrap" &&
    nextMainStart < previousMainStart - LAYOUT_LINE_BREAK_TOLERANCE
  );
}

/** Whether a measured flow layout can create another visual line. */
export function flowLayoutCanWrap<N extends LayoutNode<N>>(
  container: N,
  axes: FlowAxes,
  measuredLineCount: number,
): boolean {
  return (
    container.wrap !== "nowrap" &&
    (axes.direction === "row" || measuredLineCount > 1)
  );
}

/** Axis and dimension names for a flow direction. */
export interface FlowAxes {
  readonly direction: LayoutDirection;
  readonly main: Axis;
  readonly cross: Axis;
  readonly mainSize: Dimension;
  readonly crossSize: Dimension;
}

/** Layout metrics inferred from a container's measured children. */
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

/** One measured visual line in content-box-relative coordinates. */
export interface VisualLine<N> {
  readonly nodes: readonly N[];
  readonly crossStart: number;
  readonly crossSize: number;
}

/** The size and margins of an entry that is not (yet) in the tree. */
export interface VirtualEntry extends Size {
  readonly margin: Edges;
}

/** A virtual entry inserted into `container` before child `index`. */
export interface VirtualInsertion<N> {
  readonly container: N;
  readonly index: number;
  readonly entry: VirtualEntry;
}

/** Simulated positions for one container's children and virtual entries. */
export interface LayoutPositions<N> {
  readonly itemPositions: Map<N, Point>;
  readonly virtualRects: Map<VirtualInsertion<N>, Rect>;
}

/** Deterministic work-count hooks for tests. */
export interface LayoutPlanDiagnostics<N> {
  onNodeVisit?: (node: N) => void;
}

/** Options for {@link createLayoutResolutionPlan}. */
export interface LayoutPlanOptions<N> {
  /** Children to leave out of the layout (for example, dragged nodes). */
  readonly exclude?: (node: N) => boolean;
  /** Virtual entries folded into each container's cached dimensions. */
  readonly insertions?: readonly VirtualInsertion<N>[];
  /**
   * Wrap comparison tolerance, in the tree's units. Defaults to
   * `LAYOUT_WRAP_TOLERANCE`, which is calibrated for CSS pixels; for boxes
   * measured under a zoomed camera, divide it by the zoom so the tolerance
   * stays constant on screen, where browser measurement noise lives.
   */
  readonly wrapTolerance?: number;
  readonly diagnostics?: LayoutPlanDiagnostics<N>;
}

/** The cached layout inputs for one container in a resolution plan. */
export interface LayoutContainerPlan<N> {
  readonly container: N;
  readonly axes: FlowAxes;
  readonly contentSize: Size;
  readonly metrics: FlowMetrics;
  readonly eligibleChildren: readonly N[];
}

/** An immutable layout plan for one frozen tree. */
export interface LayoutResolutionPlan<N> {
  containerPlan(container: N): LayoutContainerPlan<N>;
  layoutPositions(
    container: N,
    startX: number,
    startY: number,
    localInsertions?: readonly VirtualInsertion<N>[],
  ): LayoutPositions<N>;
  virtualDimensions(container: N): Size;
}

type FlowEntry<N> =
  | { kind: "item"; item: N; width: number; height: number }
  | {
      kind: "virtual";
      insertion: VirtualInsertion<N>;
      width: number;
      height: number;
    };

interface FlowLine<N> {
  entries: FlowEntry<N>[];
  mainSize: number;
  crossSize: number;
}

function trailingMainMargin<N extends LayoutNode<N>>(
  entry: FlowEntry<N>,
  axes: FlowAxes,
): number {
  const margin =
    entry.kind === "item"
      ? entry.item.box.margin
      : entry.insertion.entry.margin;
  return axes.main === "x" ? margin.right : margin.bottom;
}

/** Axis and dimension names for `direction`. */
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

/** A point from main- and cross-axis coordinates. */
export function pointFromAxes(
  axes: FlowAxes,
  main: number,
  cross: number,
): Point {
  return axes.main === "x" ? { x: main, y: cross } : { x: cross, y: main };
}

/** `child`'s offset from `container`'s content-box origin. */
export function childRelativeOffset(container: BoxModel, child: Point): Point {
  const offset = contentOffset(container);
  return {
    x: child.x - container.x - offset.x,
    y: child.y - container.y - offset.y,
  };
}

/** `container`'s children, minus any `exclude` rejects. */
export function layoutChildren<N extends LayoutNode<N>>(
  container: N,
  exclude?: (node: N) => boolean,
): N[] {
  return exclude
    ? container.children.filter((child) => !exclude(child))
    : container.children.slice();
}

/**
 * Infer measured visual lines once from the frozen tree. Layout metrics and
 * insertion geometry share this boundary detection so their understanding of
 * wrapping cannot drift apart.
 */
export function inferVisualLines<N extends LayoutNode<N>>(
  container: N,
  axes: FlowAxes,
): readonly VisualLine<N>[] {
  const lines: Array<{
    nodes: N[];
    crossStart: number;
    crossEnd: number;
  }> = [];
  let previousMainStart: number | null = null;

  for (const node of container.children) {
    const offset = childRelativeOffset(container.box, node.box);
    const mainStart = offset[axes.main];
    const startsNewLine =
      previousMainStart !== null &&
      startsNewVisualLine(container.wrap, previousMainStart, mainStart);
    const crossStart = offset[axes.cross];
    const crossEnd = crossStart + node.box[axes.crossSize];

    if (lines.length === 0 || startsNewLine) {
      lines.push({ nodes: [node], crossStart, crossEnd });
    } else {
      const line = lines[lines.length - 1];
      line.nodes.push(node);
      line.crossStart = Math.min(line.crossStart, crossStart);
      line.crossEnd = Math.max(line.crossEnd, crossEnd);
    }
    previousMainStart = mainStart;
  }

  return Object.freeze(
    lines.map((line) =>
      Object.freeze({
        nodes: Object.freeze([...line.nodes]),
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
 * Size a virtual entry for its *destination* container.
 *
 * For a `stretchItems` container the entry fills the container's cross axis
 * (width in column lists, height in row lists): content-box cross size minus
 * the entry's own cross margins, clamped to >= 0. The main-axis size always
 * stays the entry's own. Without `stretchItems` the base size passes through
 * unchanged. Keeping virtual rects destination-sized keeps their centers
 * correct when an entry moves between containers of different widths.
 */
export function virtualEntrySizeFor<N extends LayoutNode<N>>(
  container: N,
  base: VirtualEntry,
): Size {
  if (!container.stretchItems) {
    return { width: base.width, height: base.height };
  }
  const axes = flowAxesForDirection(container.direction);
  const content = contentRect(container.box);
  const crossMargins =
    axes.cross === "x"
      ? base.margin.left + base.margin.right
      : base.margin.top + base.margin.bottom;
  const cross = Math.max(0, content[axes.crossSize] - crossMargins);
  return axes.cross === "x"
    ? { width: cross, height: base.height }
    : { width: base.width, height: cross };
}

/** Infer start offsets, gaps, and line sizes from measured children. */
export function inferFlowLayoutMetrics<N extends LayoutNode<N>>(
  container: N,
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
  const visualLines = inferVisualLines(container, axes);
  const lineByNode = new Map<N, VisualLine<N>>();
  for (const line of visualLines) {
    for (const node of line.nodes) {
      lineByNode.set(node, line);
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
      const nextStartsNewLine = lineByNode.get(item) !== lineByNode.get(next);
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

interface SlotEntryRect extends Rect {
  readonly line: number;
  readonly crossOffset: number;
}

interface FlowBackendPlan {
  readonly kind: "flow";
  readonly canWrap: boolean;
  readonly mainCapacity: number;
  readonly wrapTolerance: number;
}

interface SlotBackendPlan {
  readonly kind: "slots";
  readonly slots: readonly Rect[];
  readonly fillAxis: Axis;
  readonly crossAxis: Axis;
  readonly crossSizeName: Dimension;
  readonly lineOfSlot: readonly number[];
  readonly lineCrossStarts: readonly number[];
  readonly lineMaxItemCross: readonly number[];
  readonly perLine: number;
  readonly contentSizedRows: boolean;
  readonly crossGap: number;
}

type LayoutBackendPlan = FlowBackendPlan | SlotBackendPlan;

interface ContainerPlanGeometry<N> extends LayoutContainerPlan<N> {
  readonly entries: readonly FlowEntry<N>[];
  readonly backend: LayoutBackendPlan;
}

interface InternalContainerPlan<N> extends ContainerPlanGeometry<N> {
  readonly baseDimensions: Size;
}

function materializeEntries<N extends LayoutNode<N>>(
  plan: ContainerPlanGeometry<N>,
  insertions: readonly VirtualInsertion<N>[],
): FlowEntry<N>[] {
  const entries = plan.entries.slice();
  for (const insertion of insertions) {
    if (insertion.container !== plan.container) continue;
    entries.splice(Math.max(0, Math.min(insertion.index, entries.length)), 0, {
      kind: "virtual",
      insertion,
      width: insertion.entry.width,
      height: insertion.entry.height,
    });
  }
  return entries;
}

function createSlotBackendPlan<N extends LayoutNode<N>>(
  container: N,
): SlotBackendPlan {
  // Slots remain unfiltered: an excluded child's measured box is still valid
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
  const fillAxis: Axis =
    slots.length >= 2 &&
    Math.abs(slots[1].y - slots[0].y) > Math.abs(slots[1].x - slots[0].x)
      ? "y"
      : "x";
  const crossAxis: Axis = fillAxis === "x" ? "y" : "x";
  const crossSizeName: Dimension = fillAxis === "x" ? "height" : "width";

  // Accumulate line membership, starts, and maxima together. Candidate
  // materialization can then reuse this measured geometry without rescanning
  // every slot for every line.
  const lineOfSlot: number[] = [];
  const lineCrossStarts: number[] = [];
  const lineMaxItemCross: number[] = [];
  const lineLengths: number[] = [];
  for (let index = 0; index < slots.length; index++) {
    const startsNewLine =
      index === 0 ||
      slots[index][fillAxis] <
        slots[index - 1][fillAxis] - LAYOUT_LINE_BREAK_TOLERANCE;
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
    residuals.every(
      (residual) =>
        Math.abs(residual - residuals[0]) <= SLOT_ROW_RESIDUAL_TOLERANCE,
    );

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
function materializeSlotLayout<N extends LayoutNode<N>>(
  backend: SlotBackendPlan,
  startX: number,
  startY: number,
  entries: FlowEntry<N>[],
): LayoutPositions<N> {
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

  const itemPositions = new Map<N, Point>();
  const virtualRects = new Map<VirtualInsertion<N>, Rect>();
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

function materializeFlowLayout<N extends LayoutNode<N>>(
  plan: ContainerPlanGeometry<N>,
  backend: FlowBackendPlan,
  startX: number,
  startY: number,
  entries: FlowEntry<N>[],
): LayoutPositions<N> {
  const { axes, contentSize, metrics, container } = plan;
  const lines: FlowLine<N>[] = [];
  let currentLine: FlowLine<N> = { entries: [], mainSize: 0, crossSize: 0 };
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
        backend.mainCapacity + backend.wrapTolerance
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

  const itemPositions = new Map<N, Point>();
  const virtualRects = new Map<VirtualInsertion<N>, Rect>();
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

function materializeLayout<N extends LayoutNode<N>>(
  plan: ContainerPlanGeometry<N>,
  startX: number,
  startY: number,
  localInsertions: readonly VirtualInsertion<N>[],
): LayoutPositions<N> {
  const entries = materializeEntries(plan, localInsertions);
  return plan.backend.kind === "slots"
    ? materializeSlotLayout(plan.backend, startX, startY, entries)
    : materializeFlowLayout(plan, plan.backend, startX, startY, entries);
}

function dimensionsFromLayout<N extends LayoutNode<N>>(
  plan: ContainerPlanGeometry<N>,
  localInsertions: readonly VirtualInsertion<N>[],
): Size {
  const positions = materializeLayout(plan, 0, 0, localInsertions);
  let maxX = 0;
  let maxY = 0;
  for (const entry of plan.entries) {
    if (entry.kind !== "item") continue;
    const rel = childRelativeOffset(plan.container.box, entry.item.box);
    const position = positions.itemPositions.get(entry.item) ?? rel;
    maxX = Math.max(maxX, position.x + entry.width);
    maxY = Math.max(maxY, position.y + entry.height);
  }
  for (const rect of positions.virtualRects.values()) {
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  const box = plan.container.box;
  if (plan.entries.length === 0 && localInsertions.length === 0) {
    return { width: box.width, height: box.height };
  }
  const virtualSize = outsetRect(
    { x: 0, y: 0, width: maxX, height: maxY },
    addEdges(box.border, box.padding),
  );
  return plan.axes.direction === "row"
    ? { width: box.width, height: Math.max(box.height, virtualSize.height) }
    : { width: box.width, height: virtualSize.height };
}

/**
 * Build one immutable layout plan for a frozen tree.
 *
 * Every container's inputs are computed once and cached. `insertions` are
 * folded into each container's cached dimensions, while `layoutPositions`
 * accepts the local insertions for an individual candidate layout.
 */
export function createLayoutResolutionPlan<N extends LayoutNode<N>>(
  root: N,
  options: LayoutPlanOptions<N> = {},
): LayoutResolutionPlan<N> {
  const exclude = options.exclude;
  const wrapTolerance = options.wrapTolerance ?? LAYOUT_WRAP_TOLERANCE;
  const insertions = Object.freeze([...(options.insertions ?? [])]);
  const plans = new Map<N, InternalContainerPlan<N>>();

  const build = (container: N): InternalContainerPlan<N> => {
    const cached = plans.get(container);
    if (cached) return cached;
    options.diagnostics?.onNodeVisit?.(container);
    const eligibleChildren = Object.freeze(layoutChildren(container, exclude));
    const childPlans = new Map<N, InternalContainerPlan<N>>();
    for (const child of eligibleChildren) {
      childPlans.set(child, build(child));
    }

    const axes = Object.freeze(flowAxesForDirection(container.direction));
    const content = contentRect(container.box);
    const contentSize = Object.freeze({
      width: content.width,
      height: content.height,
    });
    const metrics = Object.freeze(inferFlowLayoutMetrics(container, axes));
    const entries = Object.freeze(
      eligibleChildren.map((child): FlowEntry<N> => {
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
            wrapTolerance,
          });

    const geometry = {
      container,
      axes,
      contentSize,
      metrics,
      eligibleChildren,
      entries,
      backend,
    } satisfies ContainerPlanGeometry<N>;
    const localInsertions = insertions.filter(
      (insertion) => insertion.container === container,
    );
    const baseDimensions = Object.freeze(
      dimensionsFromLayout(geometry, localInsertions),
    );
    const plan = Object.freeze({ ...geometry, baseDimensions });
    plans.set(container, plan);
    return plan;
  };

  const planFor = (container: N): InternalContainerPlan<N> => {
    const plan = plans.get(container);
    if (!plan) throw new Error("Node is outside this layout resolution");
    return plan;
  };

  build(root);
  return Object.freeze({
    containerPlan(container: N): LayoutContainerPlan<N> {
      return planFor(container);
    },
    layoutPositions(
      container: N,
      startX: number,
      startY: number,
      localInsertions: readonly VirtualInsertion<N>[] = [],
    ): LayoutPositions<N> {
      return materializeLayout(
        planFor(container),
        startX,
        startY,
        localInsertions,
      );
    },
    virtualDimensions(container: N): Size {
      return planFor(container).baseDimensions;
    },
  });
}
