import type { ElementBox } from "@snap-engine/core";
import {
  contentOffset,
  contentRect,
  distanceToRect,
  freezeRect,
  rectArea,
  type Rect,
  pointIntersectsCircle,
  pointIntersectsRect,
  rectsIntersect,
} from "@snap-engine/core/geometry";
import {
  LAYOUT_WRAP_TOLERANCE,
  childRelativeOffset,
  createLayoutResolutionPlan,
  flowAxesForDirection,
  flowLayoutCanWrap,
  inferVisualLines,
  virtualEntrySizeFor,
  pointFromAxes,
  type LayoutPlanDiagnostics,
  type LayoutResolutionPlan,
  type VisualLine,
  type VirtualInsertion,
} from "@snap-engine/core/layout";
import type { Item as ItemBase } from "./item";
import type { Container } from "./container";
import type { ItemSnapshot } from "./snapshot";
import type { DragSessionController as DragSession } from "./drag/session";
import {
  DROP_REJECT_PRIORITY,
  type DropPriorityEvent,
  type InsertionGapSegment,
  type InsertionMarkerNeighbor,
  type InsertionMarkerPresentation,
  type ItemHitbox,
  type ItemHitboxEvent,
} from "./events";
import { buildItemLocation, buildItemRunEvent } from "./event-builders";
import { projectItemRunMove } from "./internal/move-projection";

const TAG_COLLISIONS = "drop-collisions";
const TAG_CANDIDATES = "drop-candidates";
const TAG_LAYOUT = "drop-layout";
const TOP_CANDIDATE_DEBUG_LIMIT = 3;

/**
 * Candidate-selection tolerances, in world units. Differences below these are
 * measurement noise, so selection falls through to the next tie-breaker.
 */
const EDGE_DISTANCE_TIE_TOLERANCE = 0.5;
const PLACEMENT_DISTANCE_TIE_TOLERANCE = 0.5;
const CROSS_CONTAINER_DISTANCE_TIE_TOLERANCE = 1;
/** Keeps a point exactly on a line boundary on the later line. */
const LINE_INDEX_ROUNDING_BIAS = 0.001;

type Snapshot = ItemSnapshot<ItemBase>;

/**
 * The layout wrap tolerance for boxes measured under `item`'s camera: the
 * CSS-pixel default scaled so it stays constant on screen at any zoom.
 * @internal
 */
export function layoutWrapToleranceFor(item: ItemBase): number {
  const zoom = item.engine?.camera?.zoom ?? 1;
  return zoom > 0 ? LAYOUT_WRAP_TOLERANCE / zoom : LAYOUT_WRAP_TOLERANCE;
}

export interface ResolvedDropTarget {
  container: Container;
  index: number;
  insertion?: InsertionMarkerPresentation;
}

interface CandidateGeometry {
  target: ResolvedDropTarget;
  candidateCenterX: number;
  candidateCenterY: number;
  distance: number;
  placementRect: Rect;
}

interface FlowCandidate extends CandidateGeometry {
  /**
   * Sum of euclidean distances between each dragged member's own current
   * drag position and its projected slot center within this candidate's
   * (possibly group-sized) placement rect. Used by euclidean mode's chooser
   * so a multi-item drag picks the candidate that's the best fit for the
   * *whole* run, not just the pressed item. Equal to `distance` when only
   * one item is being dragged.
   */
  groupDistance: number;
  lineDistance: number;
  placementDistance: number;
  placementContainsDragCenter: boolean;
}

interface InsertionCandidate extends CandidateGeometry {
  virtualLeadingEdgeDistance: number | null;
}

interface SwapCandidate {
  target: ResolvedDropTarget;
  area: number;
}

/**
 * Sum of euclidean distances between each dragged member's own tracked drag
 * position (its original box translated by the shared pointer delta — see
 * `Item.dragPositionX/Y`) and its projected slot center within `rect`
 * (stacked in `session.items` order along the candidate container's main
 * axis). Degenerates to the single-item placement-center distance when there's
 * only one dragged item, so euclidean mode's scoring is unchanged for
 * single-item drags.
 */
function groupCandidateDistance(
  session: DragSession | null,
  rect: Rect,
  isColumn: boolean,
): number {
  if (!session) return 0;
  if (session.items.length === 1) {
    const only = session.primaryItem;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const box = session.dragBoxFor(only);
    const w = box.width;
    const h = box.height;
    const dcx = only.dragPositionX + w / 2;
    const dcy = only.dragPositionY + h / 2;
    return Math.hypot(cx - dcx, cy - dcy);
  }

  let cumulative = 0;
  let sum = 0;
  for (const member of session.items) {
    const box = session.dragBoxFor(member);
    const w = box.width;
    const h = box.height;
    const slotCenterX = isColumn
      ? rect.x + rect.width / 2
      : rect.x + cumulative + w / 2;
    const slotCenterY = isColumn
      ? rect.y + cumulative + h / 2
      : rect.y + rect.height / 2;
    const memberDragCenterX = member.dragPositionX + w / 2;
    const memberDragCenterY = member.dragPositionY + h / 2;
    sum += Math.hypot(
      slotCenterX - memberDragCenterX,
      slotCenterY - memberDragCenterY,
    );
    cumulative += isColumn ? h : w;
  }
  return sum;
}

function distanceToNearestContentEdge(
  rect: Rect,
  x: number,
  y: number,
): number {
  if (pointIntersectsRect({ x, y }, rect)) {
    return Math.min(
      Math.abs(x - rect.x),
      Math.abs(rect.x + rect.width - x),
      Math.abs(y - rect.y),
      Math.abs(rect.y + rect.height - y),
    );
  }

  return distanceToRect({ x, y }, rect);
}

function requireDragSnapshot(item: ItemBase): ItemSnapshot<ItemBase> {
  const snapshot = item.dragSnapshot;
  if (!snapshot) {
    const message = `[drop-snapshot] Missing drag snapshot for item ${item.id}. Drop prediction must run after dragStart captures snapshots.`;
    console.error(message);
    throw new Error(message);
  }
  return snapshot;
}

function requireDragSnapshotBox(item: ItemBase): ElementBox {
  return requireDragSnapshot(item).box;
}

function dragSnapshotItems(item: ItemBase): ItemBase[] {
  return requireDragSnapshot(item).children.map((snapshot) => snapshot.value);
}

function isContainerObject(item: ItemBase): item is Container {
  return (
    "config" in item &&
    "direction" in item &&
    "name" in item &&
    "numberOfItems" in item
  );
}

interface ContainerResolutionBase {
  readonly container: Container;
  readonly containerMetadata: Record<string, unknown>;
  readonly containerRect: Rect;
  readonly containerContentRect: Rect;
  readonly depth: number;
}

interface ResolutionContext {
  readonly session: DragSession | null;
  readonly item: ItemBase;
  readonly itemId: ItemBase["itemId"];
  readonly itemMetadata: ItemBase["metadata"];
  readonly items: readonly ItemBase[];
  readonly itemIds: readonly ItemBase["itemId"][];
  readonly itemsMetadata: readonly ItemBase["metadata"][];
  readonly source: ReturnType<typeof buildItemLocation>;
  readonly sources: readonly ReturnType<typeof buildItemLocation>[];
  readonly pointer: Readonly<{ x: number; y: number }>;
  readonly dragRect: Rect;
  readonly containers: Map<Container, ContainerResolutionBase>;
}

function createResolutionContext(
  item: ItemBase,
  session: DragSession | null,
  pointer: { x: number; y: number },
  dragRect?: Rect,
): ResolutionContext {
  const items = session?.items ?? [item];
  const run = buildItemRunEvent(items);
  const sources = session?.sources ?? items.map(buildItemLocation);
  const box = requireDragSnapshotBox(item);

  return Object.freeze({
    session,
    item,
    itemId: run.itemId,
    itemMetadata: run.itemMetadata,
    items: Object.freeze([...run.items]),
    itemIds: Object.freeze([...run.itemIds]),
    itemsMetadata: Object.freeze([...run.itemsMetadata]),
    source: sources[0] ?? null,
    sources: Object.freeze([...sources]),
    pointer: Object.freeze({
      x: pointer.x,
      y: pointer.y,
    }),
    dragRect: freezeRect(
      dragRect ?? {
        x: item.dragPositionX,
        y: item.dragPositionY,
        width: box.width,
        height: box.height,
      },
    ),
    containers: new Map(),
  });
}

function containerResolutionBase(
  context: ResolutionContext,
  container: Container,
): ContainerResolutionBase {
  const cached = context.containers.get(container);
  if (cached) return cached;
  const base = Object.freeze({
    container,
    containerMetadata: container.metadata,
    containerRect: freezeRect(requireDragSnapshotBox(container)),
    containerContentRect: freezeRect(containerContentRect(container)),
    depth: container.depth,
  });
  context.containers.set(container, base);
  return base;
}

function assertRect(
  value: unknown,
  callbackName: string,
  container: Container,
): asserts value is Rect {
  const x =
    typeof value === "object" && value !== null && "x" in value
      ? value.x
      : undefined;
  const y =
    typeof value === "object" && value !== null && "y" in value
      ? value.y
      : undefined;
  const width =
    typeof value === "object" && value !== null && "width" in value
      ? value.width
      : undefined;
  const height =
    typeof value === "object" && value !== null && "height" in value
      ? value.height
      : undefined;
  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    typeof y !== "number" ||
    !Number.isFinite(y) ||
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    width < 0 ||
    height < 0
  ) {
    throw new TypeError(
      `SnapSort Container ${container.id}: ${callbackName} must return finite x, y, width, and height values with nonnegative dimensions.`,
    );
  }
}

function resolveItemHitbox(
  draggedItem: ItemBase,
  item: ItemBase,
  container: Container,
  session: DragSession,
): ItemHitbox {
  const box = item.dragSnapshot?.box;
  if (!box) {
    throw new Error(`SnapSort Item ${item.id}: missing drag snapshot box.`);
  }
  const defaultRect = freezeRect(box);
  const callback = container.callbacks?.getItemHitbox;
  if (!callback) return { shape: "rect", rect: defaultRect };

  const hitbox = callback({
    session,
    item: draggedItem,
    itemId: draggedItem.itemId,
    itemMetadata: draggedItem.metadata,
    overItem: item,
    overItemId: item.itemId,
    overItemMetadata: item.metadata,
    container,
    containerMetadata: container.metadata,
    pointer: { x: session.pointer.x, y: session.pointer.y },
    defaultRect,
  } satisfies ItemHitboxEvent);

  if (hitbox?.shape === "rect") {
    assertRect(hitbox.rect, "getItemHitbox", container);
    return { shape: "rect", rect: freezeRect(hitbox.rect) };
  }
  const circle = hitbox?.shape === "circle" ? hitbox.circle : null;
  if (
    circle &&
    Number.isFinite(circle.x) &&
    Number.isFinite(circle.y) &&
    Number.isFinite(circle.radius) &&
    circle.radius >= 0
  ) {
    return {
      shape: "circle",
      circle: Object.freeze({
        x: circle.x,
        y: circle.y,
        radius: circle.radius,
      }),
    };
  }
  throw new TypeError(
    `SnapSort Container ${container.id}: getItemHitbox must return a finite rectangle or circle with nonnegative dimensions.`,
  );
}

interface HoveredItemCandidate {
  readonly item: ItemBase;
  readonly area: number;
}

function hoveredItemCandidate(
  draggedItem: ItemBase,
  item: ItemBase,
  owner: Container,
  session: DragSession,
): HoveredItemCandidate | null {
  if (session.itemSet.has(item) || item.isGhost) return null;
  const hitbox = resolveItemHitbox(draggedItem, item, owner, session);
  const area =
    hitbox.shape === "circle"
      ? Math.PI * hitbox.circle.radius ** 2
      : rectArea(hitbox.rect);
  const intersects =
    hitbox.shape === "circle"
      ? pointIntersectsCircle(session.pointer, hitbox.circle)
      : pointIntersectsRect(session.pointer, hitbox.rect);
  return intersects ? { item, area } : null;
}

function preferMoreSpecificHoveredItem(
  current: HoveredItemCandidate | null,
  candidate: HoveredItemCandidate | null,
): HoveredItemCandidate | null {
  if (!candidate || (current && current.area <= candidate.area)) return current;
  return candidate;
}

/**
 * Find which of `container`'s direct children (excluding `draggedItem` and
 * ghosts) the drag pointer's hitbox currently matches, if any. Distinct from
 * drop-target resolution (`determine*DropTarget`): this answers "which item
 * is the pointer over," not "where would a move/insert land." Ties (nested
 * or overlapping hitboxes) favor the smallest-area item as the most specific
 * match. Used to drive `onDragItemEnter`/`Move`/`Leave` and swap mode.
 */
export function findHoveredItem(
  draggedItem: ItemBase,
  container: Container,
  session: DragSession,
): ItemBase | null {
  if (!container.dragSnapshot) return null;

  let best: HoveredItemCandidate | null = null;
  for (const child of dragSnapshotItems(container)) {
    best = preferMoreSpecificHoveredItem(
      best,
      hoveredItemCandidate(draggedItem, child, container, session),
    );
  }
  return best?.item ?? null;
}

/**
 * Resolve hover feedback for a placement target. Direct children remain the
 * first candidates, then a nested destination may match as an Item through
 * its actual owner. Checking the destination last makes an equal-area direct
 * child the stable, more specific result. Swap mode deliberately continues to
 * use `findHoveredItem` and its direct-child-only contract.
 * @internal
 */
export function findPlacementHoveredItem(
  draggedItem: ItemBase,
  container: Container,
  session: DragSession,
): ItemBase | null {
  if (!container.dragSnapshot) return null;

  let best: HoveredItemCandidate | null = null;
  for (const child of dragSnapshotItems(container)) {
    best = preferMoreSpecificHoveredItem(
      best,
      hoveredItemCandidate(draggedItem, child, container, session),
    );
  }

  const owner = container.getIndexAndContainer().container;
  if (owner) {
    best = preferMoreSpecificHoveredItem(
      best,
      hoveredItemCandidate(draggedItem, container, owner, session),
    );
  }
  return best?.item ?? null;
}

function createLayoutSnapshot(root: ItemBase): {
  root: ItemSnapshot<ItemBase>;
  byItem: Map<ItemBase, ItemSnapshot<ItemBase>>;
} {
  const byItem = new Map<ItemBase, ItemSnapshot<ItemBase>>();
  const visit = (snapshot: ItemSnapshot<ItemBase>) => {
    byItem.set(snapshot.value, snapshot);
    for (const child of snapshot.children) {
      visit(child);
    }
  };
  const rootSnapshot = requireDragSnapshot(root);
  visit(rootSnapshot);

  return { root: rootSnapshot, byItem };
}

function activeFlowInsertionsFromPendingPlacement(
  byItem: Map<ItemBase, ItemSnapshot<ItemBase>>,
  session: DragSession | null,
): VirtualInsertion<Snapshot>[] {
  // Insertion and swap lifecycles use absolute marker/pointer ghosts. They do
  // not occupy a flow slot and must never influence virtual list layout.
  if (!session || !session.strategy.lifecycle.placementOccupiesFlowSlots) {
    return [];
  }

  const pendingPlacement = session.pendingPlacement;
  if (!pendingPlacement) return [];

  const container = byItem.get(pendingPlacement.container);
  if (!container) return [];

  // The live flow lifecycle renders one spacer anchor for every dragged
  // member. Model that same run here so the next prediction is based on the
  // layout the browser is actually showing. Treating a multi-item run as one
  // group-sized virtual entry made the predicted slots drift from the real
  // ghost DOM after a few moves, especially in wrapped or unequal lists.
  const memberBoxes = session.items.map((member) => session.dragBoxFor(member));

  return memberBoxes.map((box, offset) => {
    const size = virtualEntrySizeFor(container, box);
    return {
      container,
      index: pendingPlacement.index + offset,
      entry: { ...size, margin: box.margin },
    };
  });
}

function containerContentRect(container: Container): Rect {
  return contentRect(requireDragSnapshotBox(container));
}

function expandedChildHitRect(
  rect: Rect,
  axes: ReturnType<typeof flowAxesForDirection>,
  dragGhostW: number,
  dragGhostH: number,
): Rect {
  const mainExpansion =
    (axes.direction === "column" ? dragGhostH : dragGhostW) * 2;
  if (axes.main === "y") {
    return {
      x: rect.x,
      y: rect.y - mainExpansion,
      width: rect.width,
      height: rect.height + mainExpansion * 2,
    };
  }

  return {
    x: rect.x - mainExpansion,
    y: rect.y,
    width: rect.width + mainExpansion * 2,
    height: rect.height,
  };
}

function chooseByContentBox<T extends CandidateGeometry>(
  a: T,
  b: T,
  dragCenterX: number,
  dragCenterY: number,
): T {
  const aRect = containerContentRect(a.target.container);
  const bRect = containerContentRect(b.target.container);
  const point = { x: dragCenterX, y: dragCenterY };
  const aContains = pointIntersectsRect(point, aRect);
  const bContains = pointIntersectsRect(point, bRect);
  if (aContains !== bContains) return aContains ? a : b;

  const aEdge = distanceToNearestContentEdge(aRect, dragCenterX, dragCenterY);
  const bEdge = distanceToNearestContentEdge(bRect, dragCenterX, dragCenterY);
  if (Math.abs(aEdge - bEdge) > EDGE_DISTANCE_TIE_TOLERANCE) {
    return aEdge < bEdge ? a : b;
  }
  return a.distance <= b.distance ? a : b;
}

export function virtualLayoutRecursive(
  container: Container,
  startX: number,
  startY: number,
  draggedItem: ItemBase,
  dragGhostW: number,
  dragGhostH: number,
  dragCenterX: number,
  dragCenterY: number,
  session: DragSession | null = null,
  debugEnabled = false,
  layoutDiagnostics?: LayoutPlanDiagnostics<Snapshot>,
): { candidates: FlowCandidate[]; endX: number; endY: number } {
  const snapshot = createLayoutSnapshot(container);
  const draggedBox = requireDragSnapshotBox(draggedItem);
  const activeInsertions = activeFlowInsertionsFromPendingPlacement(
    snapshot.byItem,
    session,
  );
  const dragRect: Rect = {
    x: draggedItem.dragPositionX,
    y: draggedItem.dragPositionY,
    width: dragGhostW,
    height: dragGhostH,
  };
  const excludeValues = session ? session.itemSet : new Set([draggedItem]);
  const layoutPlan = createLayoutResolutionPlan(snapshot.root, {
    exclude: (node) => excludeValues.has(node.value),
    insertions: activeInsertions,
    wrapTolerance: layoutWrapToleranceFor(container),
    diagnostics: layoutDiagnostics,
  });
  return virtualLayoutRecursiveFromSnapshot(
    container,
    snapshot.root,
    startX,
    startY,
    layoutPlan,
    draggedBox,
    dragGhostW,
    dragGhostH,
    dragCenterX,
    dragCenterY,
    dragRect,
    session,
    debugEnabled,
  );
}

function virtualLayoutRecursiveFromSnapshot(
  container: Container,
  containerSnapshot: ItemSnapshot<ItemBase>,
  startX: number,
  startY: number,
  layoutPlan: LayoutResolutionPlan<Snapshot>,
  draggedBox: ElementBox,
  dragGhostW: number,
  dragGhostH: number,
  dragCenterX: number,
  dragCenterY: number,
  dragRect: Rect,
  session: DragSession | null = null,
  debugEnabled = false,
): { candidates: FlowCandidate[]; endX: number; endY: number } {
  const containerPlan = layoutPlan.containerPlan(containerSnapshot);
  const axes = containerPlan.axes;
  const isColumn = axes.direction === "column";
  const containerProp = containerSnapshot.box;
  const contentSize = containerPlan.contentSize;
  const itemSnapshots = containerPlan.eligibleChildren;
  const metrics = containerPlan.metrics;
  const flowPositions = layoutPlan.layoutPositions(
    containerSnapshot,
    startX,
    startY,
  ).itemPositions;
  const candidates: FlowCandidate[] = [];
  const lineCrossStart =
    (axes.cross === "x" ? startX : startY) + metrics.crossStart;
  const fallbackLineCrossSize =
    dragGhostH > 0 && axes.crossSize === "height" ? dragGhostH : dragGhostW;
  const lineCrossStep = Math.max(
    1,
    (metrics.lineCrossSize || fallbackLineCrossSize || 1) + metrics.crossGap,
  );
  const dragCross = axes.cross === "x" ? dragCenterX : dragCenterY;
  const lineIndexForCross = (cross: number) =>
    Math.max(
      0,
      Math.floor(
        (cross - lineCrossStart) / lineCrossStep + LINE_INDEX_ROUNDING_BIAS,
      ),
    );
  const dragLineIndex = lineIndexForCross(dragCross);

  if (debugEnabled) {
    container.addDebugRect(
      startX,
      startY,
      contentSize.width,
      contentSize.height,
      "rgba(20, 184, 166, 0.25)",
      true,
      `drop-snapshot-content-${container.id}`,
      false,
      1,
      TAG_LAYOUT,
    );
  }

  // When dragging a group, the virtual box reserved in the layout simulation
  // (and thus the candidate's placement rect) should be the whole group's
  // direction-aware size for this container, not just the pressed item's —
  // the collapsed run occupies one contiguous group-sized slot. Degenerates
  // to the plain drag ghost size for a single-item drag. Either way the
  // entry is then re-sized for THIS destination container: a `stretchItems`
  // container overrides the cross-axis size with its own content width or
  // height, so ghost rects and center points stay correct when the
  // destination is narrower or wider than the source.
  const groupDims = session?.groupDims;
  const entrySize = virtualEntrySizeFor(containerSnapshot, {
    width:
      groupDims && session && session.items.length > 1
        ? isColumn
          ? groupDims.maxW
          : groupDims.sumW
        : dragGhostW,
    height:
      groupDims && session && session.items.length > 1
        ? isColumn
          ? groupDims.sumH
          : groupDims.maxH
        : dragGhostH,
    margin: draggedBox.margin,
  });
  const entryWidth = entrySize.width;
  const entryHeight = entrySize.height;

  const makeCandidate = (
    index: number,
    fallbackPosition: { x: number; y: number },
  ): FlowCandidate => {
    const insertion: VirtualInsertion<Snapshot> = {
      container: containerSnapshot,
      index,
      entry: {
        width: entryWidth,
        height: entryHeight,
        margin: draggedBox.margin,
      },
    };
    const layout = layoutPlan.layoutPositions(
      containerSnapshot,
      startX,
      startY,
      [insertion],
    );
    const rect = layout.virtualRects.get(insertion) ?? {
      ...fallbackPosition,
      width: entryWidth,
      height: entryHeight,
    };
    const placementRect = rect;
    const candidateCenterX = rect.x + rect.width / 2;
    const candidateCenterY = rect.y + rect.height / 2;
    const lineIndex = lineIndexForCross(rect[axes.cross]);
    return {
      target: { container, index },
      candidateCenterX,
      candidateCenterY,
      distance: Math.hypot(
        candidateCenterX - dragCenterX,
        candidateCenterY - dragCenterY,
      ),
      groupDistance: session
        ? groupCandidateDistance(session, rect, isColumn)
        : Math.hypot(
            candidateCenterX - dragCenterX,
            candidateCenterY - dragCenterY,
          ),
      lineDistance: Math.abs(lineIndex - dragLineIndex),
      placementRect,
      placementDistance: distanceToRect(
        { x: dragCenterX, y: dragCenterY },
        placementRect,
      ),
      placementContainsDragCenter: pointIntersectsRect(
        { x: dragCenterX, y: dragCenterY },
        placementRect,
      ),
    };
  };

  const generatedIndices = new Set<number>();
  const addCandidate = (
    index: number,
    fallbackPosition: { x: number; y: number },
  ) => {
    if (generatedIndices.has(index)) return;
    generatedIndices.add(index);
    candidates.push(makeCandidate(index, fallbackPosition));
  };

  if (itemSnapshots.length === 0) {
    addCandidate(0, { x: startX, y: startY });
  }

  for (let index = 0; index < itemSnapshots.length; index++) {
    const itemSnapshot = itemSnapshots[index];
    const item = itemSnapshot.value;
    const prop = itemSnapshot.box;
    const isContainer = isContainerObject(item);
    const rel = childRelativeOffset(containerProp, prop);
    const measuredPosition = { x: startX + rel.x, y: startY + rel.y };
    const simulatedPosition =
      flowPositions.get(itemSnapshot) ?? measuredPosition;

    if (!itemSnapshot.locked || isContainer) {
      addCandidate(index, simulatedPosition);
    }

    if (isContainer) {
      const childOffset = contentOffset(prop);
      const childContent = contentRect(prop);
      const childContentRect = {
        x: simulatedPosition.x + childOffset.x,
        y: simulatedPosition.y + childOffset.y,
        width: childContent.width,
        height: childContent.height,
      };
      const childHitRect = expandedChildHitRect(
        childContentRect,
        flowAxesForDirection(itemSnapshot.direction),
        dragGhostW,
        dragGhostH,
      );
      // Broad-phase cull only: generate the child's candidates whenever the
      // dragged rect overlaps its expanded hit rect. Parent-vs-child conflicts
      // are resolved by candidate selection (closest predicted ghost position
      // plus cross-container hysteresis), not by dropping candidates here.
      // Gating on the bare drag center loses reachable child slots when the
      // grab point (e.g. an edge handle) skews the center outside an inset
      // child container.
      if (rectsIntersect(childHitRect, dragRect)) {
        const childResult = virtualLayoutRecursiveFromSnapshot(
          item,
          itemSnapshot,
          childContentRect.x,
          childContentRect.y,
          layoutPlan,
          draggedBox,
          dragGhostW,
          dragGhostH,
          dragCenterX,
          dragCenterY,
          dragRect,
          session,
          debugEnabled,
        );
        candidates.push(...childResult.candidates);
      }
    }

    if (!itemSnapshot.locked || isContainer) {
      const fallbackMain = simulatedPosition[axes.main] + prop[axes.mainSize];
      const fallbackCross = simulatedPosition[axes.cross];
      addCandidate(index + 1, pointFromAxes(axes, fallbackMain, fallbackCross));
    }
  }

  return {
    candidates,
    endX: startX + contentSize.width,
    endY: startY + contentSize.height,
  };
}

function collectDropCandidates(
  item: ItemBase,
  root: Container,
  session: DragSession | null = null,
  debugEnabled = false,
): {
  candidates: FlowCandidate[];
  dragCenterX: number;
  dragCenterY: number;
} {
  const rootProp = requireDragSnapshotBox(root);
  const dragProp = requireDragSnapshotBox(item);
  const dragGhostW = dragProp.width;
  const dragGhostH = dragProp.height;
  const dragCenterX = item.dragPositionX + dragProp.width / 2;
  const dragCenterY = item.dragPositionY + dragProp.height / 2;
  const layoutOrigin = contentRect(rootProp);

  const { candidates: virtualCandidates } = virtualLayoutRecursive(
    root,
    layoutOrigin.x,
    layoutOrigin.y,
    item,
    dragGhostW,
    dragGhostH,
    dragCenterX,
    dragCenterY,
    session,
    debugEnabled,
  );

  return {
    candidates: virtualCandidates,
    dragCenterX,
    dragCenterY,
  };
}

/**
 * Choose the candidate with the least *sum* of per-member distances (see
 * `groupCandidateDistance`) — for a single dragged item this is identical to
 * choosing by `distance`.
 */
function chooseEuclideanCandidate(
  candidates: FlowCandidate[],
): FlowCandidate | null {
  let best: FlowCandidate | null = null;
  for (const candidate of candidates) {
    if (!best || candidate.groupDistance < best.groupDistance) {
      best = candidate;
    }
  }
  return best;
}

function chooseProgressiveCandidate(
  candidates: FlowCandidate[],
  dragCenterX: number,
  dragCenterY: number,
): FlowCandidate | null {
  let best: FlowCandidate | null = null;
  for (const candidate of candidates) {
    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.lineDistance !== best.lineDistance) {
      best = candidate.lineDistance < best.lineDistance ? candidate : best;
      continue;
    }

    if (
      candidate.placementContainsDragCenter !== best.placementContainsDragCenter
    ) {
      best = candidate.placementContainsDragCenter ? candidate : best;
      continue;
    }

    const placementDistanceDelta: number =
      candidate.placementDistance - best.placementDistance;
    if (Math.abs(placementDistanceDelta) > PLACEMENT_DISTANCE_TIE_TOLERANCE) {
      best = placementDistanceDelta < 0 ? candidate : best;
      continue;
    }

    if (
      Math.abs(candidate.distance - best.distance) <=
        CROSS_CONTAINER_DISTANCE_TIE_TOLERANCE &&
      candidate.target.container.id !== best.target.container.id
    ) {
      best = chooseByContentBox(best, candidate, dragCenterX, dragCenterY);
    } else if (candidate.distance < best.distance) {
      best = candidate;
    }
  }
  return best;
}

function drawCandidateDebug(
  root: Container,
  item: ItemBase,
  candidates: CandidateGeometry[],
  best: CandidateGeometry | null,
  options: {
    topCandidates?: boolean;
    distanceOrigin?: { x: number; y: number };
    distanceLabel?: string;
  } = {},
) {
  const distanceLabel = options.distanceLabel ?? "d";
  for (let i = 0; i < 50; i++) {
    root.clearDebugMarker(`drop-candidate-marker-${i}`);
    root.clearDebugMarker(`drop-candidate-label-${i}`);
  }
  for (let i = 0; i < TOP_CANDIDATE_DEBUG_LIMIT; i++) {
    root.clearDebugMarker(`drop-top-candidate-rect-${i}`);
    root.clearDebugMarker(`drop-top-candidate-center-${i}`);
    root.clearDebugMarker(`drop-top-candidate-label-${i}`);
    root.clearDebugMarker(`drop-top-candidate-distance-${i}`);
    root.clearDebugMarker(`drop-top-candidate-distance-label-${i}`);
  }
  root.clearDebugMarker("drop-distance-origin");
  root.clearDebugMarker("drop-distance-origin-label");

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const isBest = best === candidate;
    const color = isBest
      ? "rgba(250, 204, 21, 0.8)"
      : "rgba(180, 180, 180, 0.35)";

    root.addDebugCircle(
      candidate.candidateCenterX,
      candidate.candidateCenterY,
      isBest ? 6 : 4,
      color,
      true,
      `drop-candidate-marker-${i}`,
      TAG_CANDIDATES,
    );
    root.addDebugText(
      candidate.candidateCenterX + 8,
      candidate.candidateCenterY + 4,
      `${isBest ? ">> " : ""}[${candidate.target.container.id}:${candidate.target.index}] ${distanceLabel}=${Math.round(candidate.distance)}`,
      color,
      true,
      `drop-candidate-label-${i}`,
      TAG_CANDIDATES,
    );
  }

  if (options.topCandidates) {
    const topCandidates = candidates
      .slice()
      .sort((a, b) => a.distance - b.distance)
      .slice(0, TOP_CANDIDATE_DEBUG_LIMIT);
    const rankColors = [
      "rgba(250, 204, 21, 0.95)",
      "rgba(56, 189, 248, 0.9)",
      "rgba(168, 85, 247, 0.85)",
    ];

    if (options.distanceOrigin) {
      root.addDebugCircle(
        options.distanceOrigin.x,
        options.distanceOrigin.y,
        5,
        "rgba(239, 68, 68, 0.95)",
        true,
        "drop-distance-origin",
        TAG_CANDIDATES,
      );
      root.addDebugText(
        options.distanceOrigin.x + 8,
        options.distanceOrigin.y - 8,
        "drag center",
        "rgba(239, 68, 68, 0.95)",
        true,
        "drop-distance-origin-label",
        TAG_CANDIDATES,
      );
    }

    for (let i = 0; i < topCandidates.length; i++) {
      const candidate = topCandidates[i];
      const color = rankColors[i] ?? "rgba(250, 204, 21, 0.9)";
      const placementRect = candidate.placementRect;
      const label = `#${i + 1} ${candidate.target.container.id}:${candidate.target.index} ${distanceLabel}=${Math.round(candidate.distance)}`;

      root.addDebugRect(
        placementRect.x,
        placementRect.y,
        placementRect.width,
        placementRect.height,
        color,
        true,
        `drop-top-candidate-rect-${i}`,
        false,
        i === 0 ? 3 : 2,
        TAG_CANDIDATES,
      );
      root.addDebugCircle(
        candidate.candidateCenterX,
        candidate.candidateCenterY,
        i === 0 ? 7 : 5,
        color,
        true,
        `drop-top-candidate-center-${i}`,
        TAG_CANDIDATES,
      );
      root.addDebugText(
        placementRect.x,
        placementRect.y - 8,
        label,
        color,
        true,
        `drop-top-candidate-label-${i}`,
        TAG_CANDIDATES,
      );

      if (options.distanceOrigin) {
        const midX =
          (options.distanceOrigin.x + candidate.candidateCenterX) / 2;
        const midY =
          (options.distanceOrigin.y + candidate.candidateCenterY) / 2;
        root.addDebugLine(
          options.distanceOrigin.x,
          options.distanceOrigin.y,
          candidate.candidateCenterX,
          candidate.candidateCenterY,
          color,
          true,
          `drop-top-candidate-distance-${i}`,
          i === 0 ? 3 : 1.5,
          TAG_CANDIDATES,
          true,
        );
        root.addDebugText(
          midX + 6,
          midY - 6,
          `sqrt(dx^2+dy^2)=${Math.round(candidate.distance)}`,
          color,
          true,
          `drop-top-candidate-distance-label-${i}`,
          TAG_CANDIDATES,
        );
      }
    }
  }

  if (best) {
    item.addDebugText(
      item.dragPositionX,
      item.dragPositionY - 20,
      `DROP: container=${best.target.container.id} idx=${best.target.index} ${distanceLabel}=${Math.round(best.distance)}`,
      "rgba(250, 204, 21, 0.9)",
      true,
      `drop-result`,
      TAG_CANDIDATES,
    );
  } else {
    item.clearDebugMarker(`drop-result`);
  }
}

function insertionMarkerNeighbor(
  snapshot: ItemSnapshot<ItemBase> | null,
): InsertionMarkerNeighbor | null {
  if (!snapshot) return null;
  return Object.freeze({
    item: snapshot.value,
    itemId: snapshot.itemId,
    itemMetadata: snapshot.metadata,
    rect: freezeRect(snapshot.box),
  });
}

function insertionVisualLine(
  snapshot: ItemSnapshot<ItemBase> | null,
  lineBySnapshot: ReadonlyMap<
    ItemSnapshot<ItemBase>,
    VisualLine<Snapshot>
  >,
): VisualLine<Snapshot> | null {
  if (!snapshot) return null;
  const line = lineBySnapshot.get(snapshot);
  if (!line) {
    throw new Error("SnapSort: insertion neighbor has no visual line.");
  }
  return line;
}

function insertionGapSegment(
  containerSnapshot: ItemSnapshot<ItemBase>,
  previous: ItemSnapshot<ItemBase> | null,
  next: ItemSnapshot<ItemBase> | null,
  lineBySnapshot: ReadonlyMap<
    ItemSnapshot<ItemBase>,
    VisualLine<Snapshot>
  >,
  useVisualLineBand: boolean,
): InsertionGapSegment {
  const axes = flowAxesForDirection(containerSnapshot.direction);
  const content = contentRect(containerSnapshot.box);
  const contentMainStart = content[axes.main];
  const contentMainSize = content[axes.mainSize];
  const previousMainEnd = previous
    ? previous.box[axes.main] + previous.box[axes.mainSize]
    : null;
  const nextMainStart = next ? next.box[axes.main] : null;
  const previousLine = insertionVisualLine(previous, lineBySnapshot);
  const nextLine = insertionVisualLine(next, lineBySnapshot);
  const wrapsToNextLine =
    previousLine !== null && nextLine !== null && previousLine !== nextLine;
  const visualLine = wrapsToNextLine ? nextLine : previousLine ?? nextLine;

  let main: number;
  if (previousMainEnd === null) {
    main =
      nextMainStart === null
        ? contentMainStart + contentMainSize / 2
        : nextMainStart;
  } else if (nextMainStart === null) {
    main = previousMainEnd;
  } else {
    main = wrapsToNextLine
      ? nextMainStart
      : (previousMainEnd + nextMainStart) / 2;
  }

  const crossStart =
    useVisualLineBand && visualLine
      ? content[axes.cross] + visualLine.crossStart
      : content[axes.cross];
  const crossSize =
    useVisualLineBand && visualLine
      ? visualLine.crossSize
      : content[axes.crossSize];

  if (axes.direction === "column") {
    return Object.freeze({
      orientation: "horizontal",
      x: crossStart,
      y: main,
      length: crossSize,
    });
  }

  return Object.freeze({
    orientation: "vertical",
    x: main,
    y: crossStart,
    length: crossSize,
  });
}

function insertionGapCenter(gap: InsertionGapSegment): {
  x: number;
  y: number;
} {
  return gap.orientation === "horizontal"
    ? { x: gap.x + gap.length / 2, y: gap.y }
    : { x: gap.x, y: gap.y + gap.length / 2 };
}

function insertionGapRect(gap: InsertionGapSegment): Rect {
  return gap.orientation === "horizontal"
    ? { x: gap.x, y: gap.y, width: gap.length, height: 0 }
    : { x: gap.x, y: gap.y, width: 0, height: gap.length };
}

function insertionMainAxisDistance(
  pointer: { x: number; y: number },
  gap: InsertionGapSegment,
): number {
  return gap.orientation === "horizontal"
    ? Math.abs(pointer.y - gap.y)
    : Math.abs(pointer.x - gap.x);
}

function insertionVirtualLeadingEdgeDistance(
  dragRect: Rect,
  orientation: InsertionGapSegment["orientation"],
  previous: InsertionMarkerNeighbor | null,
  next: InsertionMarkerNeighbor | null,
): number | null {
  const neighborRects: Readonly<Rect>[] = [];
  if (previous) neighborRects.push(previous.rect);
  if (next) neighborRects.push(next.rect);
  if (neighborRects.length === 0) return null;
  const leadingEdge = orientation === "horizontal" ? dragRect.x : dragRect.y;
  return Math.min(
    ...neighborRects.map((rect) => {
      const neighborLeadingEdge =
        orientation === "horizontal" ? rect.x : rect.y;
      return Math.abs(leadingEdge - neighborLeadingEdge);
    }),
  );
}

function collectInsertionCandidates(
  item: ItemBase,
  root: Container,
  context: ResolutionContext,
): InsertionCandidate[] {
  const excludeSet = context.session
    ? context.session.snapshotItemSet
    : new Set([item]);
  const candidates: InsertionCandidate[] = [];
  const fallbackSources = context.items.map(buildItemLocation);
  const activeSources =
    context.session?.activeSources ??
    (fallbackSources.every((source) => source !== null) ? fallbackSources : []);

  const visit = (container: Container) => {
    if (excludeSet.has(container)) return;

    const containerSnapshot = requireDragSnapshot(container);
    const rawChildren = containerSnapshot.children.filter(
      (child) => !child.value.isGhost,
    );
    const visualLines = inferVisualLines(
      containerSnapshot,
      flowAxesForDirection(containerSnapshot.direction),
    );
    const lineBySnapshot = new Map<
      ItemSnapshot<ItemBase>,
      VisualLine<Snapshot>
    >();
    for (const line of visualLines) {
      for (const snapshot of line.nodes) {
        lineBySnapshot.set(snapshot, line);
      }
    }
    const useVisualLineBand =
      containerSnapshot.layoutModel === "slots"
        ? visualLines.length > 1
        : flowLayoutCanWrap(
            containerSnapshot,
            flowAxesForDirection(containerSnapshot.direction),
            visualLines.length,
          );
    const retainedIndices = rawChildren.flatMap((child, rawIndex) =>
      excludeSet.has(child.value) ? [] : [rawIndex],
    );
    let previousRetainedIndex = -1;

    for (
      let logicalGapIndex = 0;
      logicalGapIndex <= retainedIndices.length;
      logicalGapIndex++
    ) {
      const nextRetainedIndex =
        retainedIndices[logicalGapIndex] ?? rawChildren.length;
      const firstPhysicalBoundary = previousRetainedIndex + 1;
      const lastPhysicalBoundary = nextRetainedIndex;
      const physicalBoundaries =
        firstPhysicalBoundary === lastPhysicalBoundary
          ? [firstPhysicalBoundary]
          : [firstPhysicalBoundary, lastPhysicalBoundary];
      const projection = projectItemRunMove(
        container,
        nextRetainedIndex,
        activeSources,
      );

      for (const boundary of physicalBoundaries) {
        const previousSnapshot = rawChildren[boundary - 1] ?? null;
        const nextSnapshot = rawChildren[boundary] ?? null;
        const gap = insertionGapSegment(
          containerSnapshot,
          previousSnapshot,
          nextSnapshot,
          lineBySnapshot,
          useVisualLineBand,
        );
        const previous = insertionMarkerNeighbor(previousSnapshot);
        const next = insertionMarkerNeighbor(nextSnapshot);
        const insertion = Object.freeze({
          gap,
          previous,
          next,
          isCurrentPlacement: projection.isCurrentPlacement,
        }) satisfies InsertionMarkerPresentation;
        const center = insertionGapCenter(gap);
        candidates.push({
          target: {
            container,
            index: nextRetainedIndex,
            insertion,
          },
          candidateCenterX: center.x,
          candidateCenterY: center.y,
          distance: insertionMainAxisDistance(context.pointer, gap),
          virtualLeadingEdgeDistance: insertionVirtualLeadingEdgeDistance(
            context.dragRect,
            gap.orientation,
            previous,
            next,
          ),
          placementRect: insertionGapRect(gap),
        });
      }

      previousRetainedIndex = nextRetainedIndex;
    }

    for (const retainedIndex of retainedIndices) {
      const child = rawChildren[retainedIndex].value;
      if (isContainerObject(child)) {
        visit(child);
      }
    }
  };

  visit(root);
  return candidates;
}

/** @internal Build the canonical insertion marker for one direct slot. */
export function createDirectInsertionTarget(
  session: DragSession,
  container: Container,
  logicalIndex: number,
): ResolvedDropTarget & {
  readonly insertion: InsertionMarkerPresentation;
} {
  const containerSnapshot = requireDragSnapshot(container);
  const rawChildren = containerSnapshot.children.filter(
    (child) => !child.value.isGhost,
  );

  const retainedIndices = rawChildren.flatMap(
    (child, rawIndex) =>
      session.itemSet.has(child.value)
        ? []
        : [rawIndex],
  );

  if (
    !Number.isInteger(logicalIndex) ||
    logicalIndex < 0 ||
    logicalIndex > retainedIndices.length
  ) {
    throw new RangeError(
      "SnapSort: direct insertion index is outside the retained item slots.",
    );
  }

  const boundary =
    retainedIndices[logicalIndex] ??
    rawChildren.length;

  const previousSnapshot =
    rawChildren[boundary - 1] ?? null;
  const nextSnapshot =
    rawChildren[boundary] ?? null;

  const visualLines = inferVisualLines(
    containerSnapshot,
    flowAxesForDirection(containerSnapshot.direction),
  );

  const lineBySnapshot = new Map<
    ItemSnapshot<ItemBase>,
    VisualLine<Snapshot>
  >();

  for (const line of visualLines) {
    for (const snapshot of line.nodes) {
      lineBySnapshot.set(snapshot, line);
    }
  }

  const useVisualLineBand =
    containerSnapshot.layoutModel === "slots"
      ? visualLines.length > 1
      : flowLayoutCanWrap(
          containerSnapshot,
          flowAxesForDirection(
            containerSnapshot.direction,
          ),
          visualLines.length,
        );

  const gap = insertionGapSegment(
    containerSnapshot,
    previousSnapshot,
    nextSnapshot,
    lineBySnapshot,
    useVisualLineBand,
  );

  const projection = projectItemRunMove(
    container,
    boundary,
    session.activeSources,
  );

  const insertion = Object.freeze({
    gap,
    previous: insertionMarkerNeighbor(
      previousSnapshot,
    ),
    next: insertionMarkerNeighbor(nextSnapshot),
    isCurrentPlacement: projection.isCurrentPlacement,
  }) satisfies InsertionMarkerPresentation;

  return Object.freeze({
    container,
    index: logicalIndex,
    insertion,
  });
}

function chooseInsertionCandidate(
  candidates: InsertionCandidate[],
): InsertionCandidate | null {
  let best: InsertionCandidate | null = null;
  for (const candidate of candidates) {
    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.distance < best.distance) {
      best = candidate;
      continue;
    }

    if (
      candidate.distance === best.distance &&
      candidate.virtualLeadingEdgeDistance !== null &&
      best.virtualLeadingEdgeDistance !== null &&
      candidate.virtualLeadingEdgeDistance < best.virtualLeadingEdgeDistance
    ) {
      best = candidate;
    }
  }
  return best;
}

function validateDropPriority(
  container: Container,
  value: number,
  source: "dropPriority" | "getDropPriority",
): void {
  if (
    !Number.isFinite(value) ||
    (value < 0 && value !== DROP_REJECT_PRIORITY)
  ) {
    throw new TypeError(
      `SnapSort Container ${container.id}: ${source} must be -1 or a finite nonnegative number.`,
    );
  }
}

function configuredDropPriority(container: Container): number {
  const value = container.dropPriority;
  validateDropPriority(container, value, "dropPriority");
  return value;
}

function dropPolicyEvent(
  candidate: { target: ResolvedDropTarget },
  context: ResolutionContext,
  staticPriority: number,
): DropPriorityEvent {
  const base = containerResolutionBase(context, candidate.target.container);

  return {
    session: context.session,
    item: context.item,
    itemId: context.itemId,
    itemMetadata: context.itemMetadata,
    items: [...context.items],
    itemIds: [...context.itemIds],
    itemsMetadata: [...context.itemsMetadata],
    source: context.source,
    sources: [...context.sources],
    container: base.container,
    containerMetadata: base.containerMetadata,
    staticPriority,
    index: candidate.target.index,
    pointer: context.pointer,
    dragRect: context.dragRect,
    containerRect: base.containerRect,
    containerContentRect: base.containerContentRect,
    depth: base.depth,
  };
}

function effectiveDropPriority(
  candidate: { target: ResolvedDropTarget },
  getContext: () => ResolutionContext,
): number {
  const container = candidate.target.container;
  const staticPriority =
    configuredDropPriority(container);
  const callback = container.callbacks?.getDropPriority;

  if (!callback) {
    return staticPriority;
  }

  const override = callback(
    dropPolicyEvent(
      candidate,
      getContext(),
      staticPriority,
    ),
  );

  if (override !== undefined) {
    validateDropPriority(
      container,
      override,
      "getDropPriority",
    );
  }

  return override ?? staticPriority;
}

export function evaluateDropTargetPriority(
  item: ItemBase,
  session: DragSession,
  target: ResolvedDropTarget,
  geometry: Readonly<{
    pointer: Readonly<{ x: number; y: number }>;
    dragRect: Readonly<Rect>;
  }>,
): number {
  return effectiveDropPriority(
    { target },
    () =>
      createResolutionContext(
        item,
        session,
        geometry.pointer,
        geometry.dragRect,
      ),
  );
}

/**
 * Apply destination-owned drop policy once per distinct container. Effective
 * priority -1 rejects a destination; only candidates tied at the highest
 * eligible priority continue to the active mode's slot-ranking algorithm.
 */
function applyDropPolicy<T extends { target: ResolvedDropTarget }>(
  candidates: T[],
  getContext: () => ResolutionContext,
): T[] {
  if (candidates.length === 0) return candidates;
  const byContainer = new Map<Container, T[]>();
  for (const candidate of candidates) {
    const group = byContainer.get(candidate.target.container);
    if (group) {
      group.push(candidate);
    } else {
      byContainer.set(candidate.target.container, [candidate]);
    }
  }

  const eligible: Array<{ candidate: T; priority: number }> = [];
  for (const [_, directCandidates] of byContainer) {
    const priority = effectiveDropPriority(
      directCandidates[0],
      getContext,
    );
    if (priority === DROP_REJECT_PRIORITY) continue;
    for (const candidate of directCandidates) {
      eligible.push({ candidate, priority });
    }
  }

  if (eligible.length === 0) return [];
  const highestPriority = Math.max(...eligible.map((entry) => entry.priority));
  return eligible
    .filter((entry) => entry.priority === highestPriority)
    .map((entry) => entry.candidate);
}

/** Resolve the live pointer, falling back to the drag box center for standalone predictions. */
function resolutionPointer(
  item: ItemBase,
  session: DragSession | null,
): { x: number; y: number } {
  const itemPointer = item.dragPointerPosition;
  if (session) return session.pointer;
  if (itemPointer) return itemPointer;
  const box = requireDragSnapshotBox(item);
  return {
    x: item.dragPositionX + box.width / 2,
    y: item.dragPositionY + box.height / 2,
  };
}

function isDropDebugEnabled(item: ItemBase): boolean {
  return item.engine?.debugRenderer != null;
}

export function determineDropTarget(
  item: ItemBase,
  root: Container,
  session: DragSession | null = null,
): ResolvedDropTarget | null {
  const debugEnabled = isDropDebugEnabled(root);
  const { candidates, dragCenterX, dragCenterY } = collectDropCandidates(
    item,
    root,
    session,
    debugEnabled,
  );
  let context: ResolutionContext | null = null;
  const allowed = applyDropPolicy(
    candidates,
    () =>
      (context ??= createResolutionContext(
        item,
        session,
        resolutionPointer(item, session),
      )),
  );
  const best = chooseEuclideanCandidate(allowed);
  if (debugEnabled) {
    drawCandidateDebug(root, item, allowed, best, {
      topCandidates: true,
      distanceOrigin: { x: dragCenterX, y: dragCenterY },
    });
    debugDropTargetTree(root, item);
  }
  return best?.target ?? null;
}

export function determineProgressiveDropTarget(
  item: ItemBase,
  root: Container,
  session: DragSession | null = null,
): ResolvedDropTarget | null {
  const debugEnabled = isDropDebugEnabled(root);
  const { candidates, dragCenterX, dragCenterY } = collectDropCandidates(
    item,
    root,
    session,
    debugEnabled,
  );
  let context: ResolutionContext | null = null;
  const allowed = applyDropPolicy(
    candidates,
    () =>
      (context ??= createResolutionContext(
        item,
        session,
        resolutionPointer(item, session),
      )),
  );
  const best = chooseProgressiveCandidate(allowed, dragCenterX, dragCenterY);
  if (debugEnabled) {
    drawCandidateDebug(root, item, allowed, best);
    debugDropTargetTree(root, item);
  }
  return best?.target ?? null;
}

export function determineInsertionDropTarget(
  item: ItemBase,
  root: Container,
  session: DragSession | null = null,
): ResolvedDropTarget | null {
  const debugEnabled = isDropDebugEnabled(root);
  const context = createResolutionContext(
    item,
    session,
    resolutionPointer(item, session),
  );
  const candidates = collectInsertionCandidates(item, root, context);
  const allowed = applyDropPolicy(candidates, () => context);
  const best = chooseInsertionCandidate(allowed);
  if (debugEnabled) {
    drawCandidateDebug(root, item, allowed, best, {
      distanceLabel: "main-axis",
    });
    debugDropTargetTree(root, item);
  }
  return best?.target ?? null;
}

/**
 * Resolve swap mode's drop target: unlike the other modes, this doesn't
 * resolve a gap — it resolves whichever *item* the pointer's hitbox
 * currently matches (via `findHoveredItem`), anywhere in the tree reachable
 * from `root`. `index` is that item's live
 * position in its own container, meaning "swap with whatever is here."
 */
export function determineSwapDropTarget(
  item: ItemBase,
  root: Container,
  session: DragSession | null = null,
): ResolvedDropTarget | null {
  if (!session) return null;
  const candidates: SwapCandidate[] = [];

  const visit = (container: Container) => {
    if (container === item) return;

    const hovered = findHoveredItem(item, container, session);
    const index = hovered ? container.itemOrderedList.indexOf(hovered) : -1;
    if (hovered && index !== -1) {
      const box = requireDragSnapshotBox(hovered);
      candidates.push({
        target: { container, index },
        area: rectArea(box),
      });
    }

    for (const child of dragSnapshotItems(container)) {
      if (isContainerObject(child)) {
        visit(child);
      }
    }
  };

  visit(root);
  let context: ResolutionContext | null = null;
  const allowed = applyDropPolicy(
    candidates,
    () => (context ??= createResolutionContext(item, session, session.pointer)),
  );
  let best: SwapCandidate | null = null;
  for (const candidate of allowed) {
    if (!best || candidate.area < best.area) best = candidate;
  }
  return best?.target ?? null;
}

export function debugDropTargetTree(node: Container, draggedItem: ItemBase) {
  const items = node.itemOrderedList.filter(
    (item) => item !== draggedItem && !item.isGhost,
  );

  for (const item of items) {
    const prop = item.dragSnapshot?.box ?? item.box;
    if (!prop) continue;

    item.addDebugRect(
      prop.x,
      prop.y,
      prop.width,
      prop.height,
      "rgba(60, 130, 246, 0.4)",
      true,
      `drop-dom-${item.id}`,
      false,
      1,
      TAG_COLLISIONS,
    );

    if (isContainerObject(item)) {
      debugDropTargetTree(item, draggedItem);
    }
  }
}
