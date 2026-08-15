import type { DomProperty } from "@snap-engine/core";
import {
  type CollisionCircle,
  distanceToRect,
  pointIntersectsCircle,
  pointIntersectsRect,
  rectsIntersect,
} from "@snap-engine/core/collision";
import type { Item as ItemBase } from "./item";
import type { Container } from "./container";
import {
  childRelativeOffset,
  contentBoxOrigin,
  contentBoxSize,
  flowAxesForDirection,
  flowLayoutPositions,
  inferFlowLayoutMetrics,
  virtualEntrySizeFor,
  layoutItems,
  pointFromAxes,
  virtualDimensions as layoutVirtualDimensions,
  type LayoutFilter,
  type VirtualInsertion,
} from "./layout";
import type { ItemSnapshot } from "./snapshot";
import type { DragSessionController as DragSession } from "./drag/session";
import type {
  CanDropEvent,
  DropPriorityEvent,
  GhostRect,
  InsertionMarkerRectEvent,
  ItemHitboxEvent,
} from "./events";
import { buildItemLocation, buildItemRunEvent } from "./event-builders";

const TAG_COLLISIONS = "drop-collisions";
const TAG_CANDIDATES = "drop-candidates";
const TAG_LAYOUT = "drop-layout";
const TOP_CANDIDATE_DEBUG_LIMIT = 3;

type Rect = { x: number; y: number; width: number; height: number };
type InsertionGhostRect = Rect;
type ResolvedItemHitbox =
  | { shape: "rect"; rect: Rect }
  | { shape: "circle"; circle: CollisionCircle };

export interface VirtualGhost {
  container: ItemBase;
  index: number;
  width: number;
  height: number;
}

export interface VirtualDimensions {
  width: number;
  height: number;
}

export interface ResolvedDropTarget {
  container: ItemBase;
  index: number;
  ghostRect?: InsertionGhostRect;
}

interface CandidateGeometry {
  target: ResolvedDropTarget;
  ghostCenterX: number;
  ghostCenterY: number;
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

type InsertionCandidate = CandidateGeometry;

interface SwapCandidate {
  target: ResolvedDropTarget;
  area: number;
}

function getDirection(node: ItemBase): "column" | "row" {
  return "direction" in node && typeof (node as any).direction === "string"
    ? (node as any).direction
    : "column";
}

function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

/**
 * Sum of euclidean distances between each dragged member's own tracked drag
 * position (its original box translated by the shared pointer delta — see
 * `Item.dragPositionX/Y`) and its projected slot center within `rect`
 * (stacked in `session.items` order along the candidate container's main
 * axis). Degenerates to the single-item ghost-center distance when there's
 * only one dragged item, so euclidean mode's scoring is unchanged for
 * single-item drags.
 */
function groupCandidateDistance(
  session: DragSession | null,
  rect: Rect,
  isColumn: boolean,
): number {
  const only = session?.primaryItem;
  if (!session || session.items.length <= 1) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    if (!only) return 0;
    const box = only.dragSnapshot?.box;
    const w = box?.width ?? rect.width;
    const h = box?.height ?? rect.height;
    const dcx = only.dragPositionX + w / 2;
    const dcy = only.dragPositionY + h / 2;
    return euclidean(cx, cy, dcx, dcy);
  }

  let cumulative = 0;
  let sum = 0;
  for (const member of session.items) {
    const box = member.dragSnapshot?.box;
    const w = box?.width ?? 0;
    const h = box?.height ?? 0;
    const slotCenterX = isColumn
      ? rect.x + rect.width / 2
      : rect.x + cumulative + w / 2;
    const slotCenterY = isColumn
      ? rect.y + cumulative + h / 2
      : rect.y + rect.height / 2;
    const memberDragCenterX = member.dragPositionX + w / 2;
    const memberDragCenterY = member.dragPositionY + h / 2;
    sum += euclidean(
      slotCenterX,
      slotCenterY,
      memberDragCenterX,
      memberDragCenterY,
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

function requireDragSnapshotBox(item: ItemBase): DomProperty {
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

function frozenRect(rect: Rect): Rect {
  return Object.freeze({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
}

interface ContainerResolutionBase {
  readonly container: ItemBase;
  readonly containerMetadata: Record<string, unknown>;
  readonly containerRect: Rect;
  readonly containerContentRect: Rect;
  readonly depth: number;
}

interface ResolutionContext {
  readonly session: DragSession | null;
  readonly item: ItemBase;
  readonly itemId: ItemBase["resolvedItemId"];
  readonly itemMetadata: ItemBase["metadata"];
  readonly items: readonly ItemBase[];
  readonly itemIds: readonly ItemBase["resolvedItemId"][];
  readonly itemsMetadata: readonly ItemBase["metadata"][];
  readonly source: ReturnType<typeof buildItemLocation>;
  readonly sources: readonly ReturnType<typeof buildItemLocation>[];
  readonly pointer: Readonly<{ x: number; y: number }>;
  readonly dragRect: Rect;
  readonly containers: Map<ItemBase, ContainerResolutionBase>;
}

function createResolutionContext(
  item: ItemBase,
  session: DragSession | null,
  pointer: { x: number; y: number },
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
    pointer: Object.freeze({ x: pointer.x, y: pointer.y }),
    dragRect: frozenRect({
      x: item.dragPositionX,
      y: item.dragPositionY,
      width: box.width,
      height: box.height,
    }),
    containers: new Map(),
  });
}

function containerResolutionBase(
  context: ResolutionContext,
  container: ItemBase,
): ContainerResolutionBase {
  const cached = context.containers.get(container);
  if (cached) return cached;
  const base = Object.freeze({
    container,
    containerMetadata: (container as any).metadata,
    containerRect: frozenRect(requireDragSnapshotBox(container)),
    containerContentRect: frozenRect(containerContentRect(container)),
    depth: container.depth,
  });
  context.containers.set(container, base);
  return base;
}

function assertRect(
  value: unknown,
  callbackName: string,
  container: ItemBase,
): asserts value is Rect {
  const rect = value as Partial<Rect> | null;
  if (
    !rect ||
    !Number.isFinite(rect.x) ||
    !Number.isFinite(rect.y) ||
    !Number.isFinite(rect.width) ||
    !Number.isFinite(rect.height) ||
    rect.width! < 0 ||
    rect.height! < 0
  ) {
    throw new TypeError(
      `SnapSort Container ${container.id}: ${callbackName} must return finite x, y, width, and height values with nonnegative dimensions.`,
    );
  }
}

function resolveItemHitbox(
  draggedItem: ItemBase,
  item: ItemBase,
  container: ItemBase,
  session: DragSession,
): ResolvedItemHitbox {
  const box = item.dragSnapshot?.box;
  if (!box) {
    throw new Error(`SnapSort Item ${item.id}: missing drag snapshot box.`);
  }
  const defaultRect = frozenRect(box);
  if (!isContainerObject(container)) {
    return { shape: "rect", rect: defaultRect };
  }
  const callback = container.callbacks?.getItemHitbox;
  if (!callback) return { shape: "rect", rect: defaultRect };

  const hitbox = callback({
    session: session.handle,
    item: draggedItem,
    itemId: draggedItem.resolvedItemId,
    itemMetadata: draggedItem.metadata,
    overItem: item,
    overItemId: item.resolvedItemId,
    overItemMetadata: item.metadata,
    container,
    containerMetadata: container.metadata,
    pointer: { x: session.pointer.x, y: session.pointer.y },
    defaultRect,
  } satisfies ItemHitboxEvent);

  if (hitbox?.shape === "rect") {
    assertRect(hitbox.rect, "getItemHitbox", container);
    return { shape: "rect", rect: frozenRect(hitbox.rect) };
  }
  if (
    hitbox?.shape === "circle" &&
    Number.isFinite(hitbox.center?.x) &&
    Number.isFinite(hitbox.center?.y) &&
    Number.isFinite(hitbox.radius) &&
    hitbox.radius >= 0
  ) {
    return {
      shape: "circle",
      circle: Object.freeze({
        x: hitbox.center.x,
        y: hitbox.center.y,
        radius: hitbox.radius,
      }),
    };
  }
  throw new TypeError(
    `SnapSort Container ${container.id}: getItemHitbox must return a finite rectangle or circle with nonnegative dimensions.`,
  );
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
  container: ItemBase,
  session: DragSession,
): ItemBase | null {
  if (!container.dragSnapshot) return null;

  const pointer = session.pointer;
  let best: { item: ItemBase; area: number } | null = null;
  for (const child of dragSnapshotItems(container)) {
    if (session.itemSet.has(child) || child.isGhost) continue;
    const hitbox = resolveItemHitbox(draggedItem, child, container, session);
    const area =
      hitbox.shape === "circle"
        ? Math.PI * hitbox.circle.radius ** 2
        : hitbox.rect.width * hitbox.rect.height;
    const intersects =
      hitbox.shape === "circle"
        ? pointIntersectsCircle(pointer, hitbox.circle)
        : pointIntersectsRect(pointer, hitbox.rect);
    if (intersects && (!best || area < best.area)) {
      best = { item: child, area };
    }
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

function layoutInsertionFromGhost(
  byItem: Map<ItemBase, ItemSnapshot<ItemBase>>,
  ghost?: VirtualGhost,
): VirtualInsertion<ItemBase> | undefined {
  if (!ghost) return undefined;
  const container = byItem.get(ghost.container);
  if (!container) return undefined;
  const margin = requireDragSnapshotBox(ghost.container).margin;
  const size = virtualEntrySizeFor(container, {
    width: ghost.width,
    height: ghost.height,
    margin,
  });
  return {
    container,
    index: ghost.index,
    entry: { ...size, margin },
  };
}

function activeGhostInsertionsFromPendingTarget(
  byItem: Map<ItemBase, ItemSnapshot<ItemBase>>,
  session: DragSession | null,
  draggedBox: DomProperty,
  dragGhostW: number,
  dragGhostH: number,
): VirtualInsertion<ItemBase>[] {
  // Insertion and swap lifecycles use absolute marker/pointer ghosts. They do
  // not occupy a flow slot and must never influence virtual list layout.
  if (!session || session.strategy.lifecycle.ghostKind !== "flow") return [];

  const pendingTarget = session?.pendingGhostTarget;
  if (!pendingTarget?.container) return [];

  const container = byItem.get(pendingTarget.container);
  if (!container) return [];

  // The live flow lifecycle renders one spacer anchor for every dragged
  // member. Model that same run here so the next prediction is based on the
  // layout the browser is actually showing. Treating a multi-item run as one
  // group-sized virtual entry made the predicted slots drift from the real
  // ghost DOM after a few moves, especially in wrapped or unequal lists.
  const memberBoxes =
    session && session.items.length > 0
      ? session.items.map((member) => member.dragSnapshot?.box ?? draggedBox)
      : [
          {
            ...draggedBox,
            width: dragGhostW,
            height: dragGhostH,
          },
        ];

  return memberBoxes.map((box, offset) => {
    const size = virtualEntrySizeFor(container, box);
    return {
      container,
      index: pendingTarget.index + offset,
      entry: { ...size, margin: box.margin },
    };
  });
}

function containerContentRect(container: ItemBase): Rect {
  const prop = requireDragSnapshotBox(container);
  const origin = contentBoxOrigin(prop);
  const size = contentBoxSize(prop);
  return { ...origin, ...size };
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
  if (Math.abs(aEdge - bEdge) > 0.5) return aEdge < bEdge ? a : b;
  return a.distance <= b.distance ? a : b;
}

export function virtualDimensions(
  container: ItemBase,
  draggedItem: ItemBase,
  ghost?: VirtualGhost,
): VirtualDimensions {
  const snapshot = createLayoutSnapshot(container);
  const insertions = [layoutInsertionFromGhost(snapshot.byItem, ghost)].filter(
    (insertion): insertion is VirtualInsertion<ItemBase> => !!insertion,
  );
  return layoutVirtualDimensions(snapshot.root, {
    filter: { excludeValues: new Set([draggedItem]) },
    insertions,
  });
}

export function virtualLayoutRecursive(
  container: ItemBase,
  startX: number,
  startY: number,
  draggedItem: ItemBase,
  dragGhostW: number,
  dragGhostH: number,
  dragCenterX: number,
  dragCenterY: number,
  session: DragSession | null = null,
  debugEnabled = false,
): { candidates: FlowCandidate[]; endX: number; endY: number } {
  const snapshot = createLayoutSnapshot(container);
  const draggedBox = requireDragSnapshotBox(draggedItem);
  const activeInsertions = activeGhostInsertionsFromPendingTarget(
    snapshot.byItem,
    session,
    draggedBox,
    dragGhostW,
    dragGhostH,
  );
  const dragRect: Rect = {
    x: draggedItem.dragPositionX,
    y: draggedItem.dragPositionY,
    width: dragGhostW,
    height: dragGhostH,
  };
  const excludeValues = session ? session.itemSet : new Set([draggedItem]);
  return virtualLayoutRecursiveFromSnapshot(
    snapshot.root,
    startX,
    startY,
    { excludeValues },
    draggedBox,
    dragGhostW,
    dragGhostH,
    dragCenterX,
    dragCenterY,
    dragRect,
    activeInsertions,
    session,
    debugEnabled,
  );
}

function virtualLayoutRecursiveFromSnapshot(
  containerSnapshot: ItemSnapshot<ItemBase>,
  startX: number,
  startY: number,
  filter: LayoutFilter<ItemBase>,
  draggedBox: DomProperty,
  dragGhostW: number,
  dragGhostH: number,
  dragCenterX: number,
  dragCenterY: number,
  dragRect: Rect,
  baseInsertions: VirtualInsertion<ItemBase>[] = [],
  session: DragSession | null = null,
  debugEnabled = false,
): { candidates: FlowCandidate[]; endX: number; endY: number } {
  const container = containerSnapshot.value;
  const axes = flowAxesForDirection(containerSnapshot.direction);
  const isColumn = axes.direction === "column";
  const containerProp = containerSnapshot.box;
  const contentSize = contentBoxSize(containerProp);
  const itemSnapshots = layoutItems(containerSnapshot, filter);
  const metrics = inferFlowLayoutMetrics(containerSnapshot, axes);
  const descendantBaseInsertions = baseInsertions.filter(
    (baseInsertion) => baseInsertion.container !== containerSnapshot,
  );
  const flowPositions = flowLayoutPositions(containerSnapshot, startX, startY, {
    filter,
    insertions: descendantBaseInsertions,
  }).itemPositions;
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
    Math.max(0, Math.floor((cross - lineCrossStart) / lineCrossStep + 0.001));
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
    const insertion: VirtualInsertion<ItemBase> = {
      container: containerSnapshot,
      index,
      entry: {
        width: entryWidth,
        height: entryHeight,
        margin: draggedBox.margin,
      },
    };
    const layout = flowLayoutPositions(containerSnapshot, startX, startY, {
      filter,
      insertions: [...descendantBaseInsertions, insertion],
    });
    const rect = layout.virtualRects.get(insertion) ?? {
      ...fallbackPosition,
      width: entryWidth,
      height: entryHeight,
    };
    const placementRect = rect;
    const ghostCenterX = rect.x + rect.width / 2;
    const ghostCenterY = rect.y + rect.height / 2;
    const lineIndex = lineIndexForCross(rect[axes.cross]);
    return {
      target: { container, index },
      ghostCenterX,
      ghostCenterY,
      distance: euclidean(ghostCenterX, ghostCenterY, dragCenterX, dragCenterY),
      groupDistance: session
        ? groupCandidateDistance(session, rect, isColumn)
        : euclidean(ghostCenterX, ghostCenterY, dragCenterX, dragCenterY),
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

  if (itemSnapshots.length === 0 && isContainerObject(container)) {
    addCandidate(0, { x: startX, y: startY });
  }

  for (let index = 0; index < itemSnapshots.length; index++) {
    const itemSnapshot = itemSnapshots[index];
    const item = itemSnapshot.value;
    const prop = itemSnapshot.box;
    const isContainer =
      itemSnapshot.children.length > 0 || isContainerObject(item);
    const rel = childRelativeOffset(containerProp, prop);
    const measuredPosition = { x: startX + rel.x, y: startY + rel.y };
    const simulatedPosition =
      flowPositions.get(itemSnapshot) ?? measuredPosition;

    if (!itemSnapshot.locked || isContainer) {
      addCandidate(index, simulatedPosition);
    }

    if (isContainer) {
      const childOrigin = {
        x: simulatedPosition.x + prop.border.left + prop.padding.left,
        y: simulatedPosition.y + prop.border.top + prop.padding.top,
      };
      const childContentSize = contentBoxSize(prop);
      const childContentRect = {
        ...childOrigin,
        ...childContentSize,
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
          itemSnapshot,
          childOrigin.x,
          childOrigin.y,
          filter,
          draggedBox,
          dragGhostW,
          dragGhostH,
          dragCenterX,
          dragCenterY,
          dragRect,
          baseInsertions,
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
  root: ItemBase,
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
  const layoutOrigin = contentBoxOrigin(rootProp);

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
    if (Math.abs(placementDistanceDelta) > 0.5) {
      best = placementDistanceDelta < 0 ? candidate : best;
      continue;
    }

    if (
      Math.abs(candidate.distance - best.distance) <= 1 &&
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
  root: ItemBase,
  item: ItemBase,
  candidates: CandidateGeometry[],
  best: CandidateGeometry | null,
  options: {
    topCandidates?: boolean;
    distanceOrigin?: { x: number; y: number };
  } = {},
) {
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
      candidate.ghostCenterX,
      candidate.ghostCenterY,
      isBest ? 6 : 4,
      color,
      true,
      `drop-candidate-marker-${i}`,
      TAG_CANDIDATES,
    );
    root.addDebugText(
      candidate.ghostCenterX + 8,
      candidate.ghostCenterY + 4,
      `${isBest ? ">> " : ""}[${candidate.target.container.id}:${candidate.target.index}] d=${Math.round(candidate.distance)}`,
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
      const label = `#${i + 1} ${candidate.target.container.id}:${candidate.target.index} d=${Math.round(candidate.distance)}`;

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
        candidate.ghostCenterX,
        candidate.ghostCenterY,
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
        const midX = (options.distanceOrigin.x + candidate.ghostCenterX) / 2;
        const midY = (options.distanceOrigin.y + candidate.ghostCenterY) / 2;
        root.addDebugLine(
          options.distanceOrigin.x,
          options.distanceOrigin.y,
          candidate.ghostCenterX,
          candidate.ghostCenterY,
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
      `DROP: container=${best.target.container.id} idx=${best.target.index} dist=${Math.round(best.distance)}`,
      "rgba(250, 204, 21, 0.9)",
      true,
      `drop-result`,
      TAG_CANDIDATES,
    );
  } else {
    item.clearDebugMarker(`drop-result`);
  }
}

function isInsertionContainer(container: ItemBase): container is Container {
  return isContainerObject(container);
}

function insertionMarkerRect(
  container: Container,
  index: number,
  items: ItemBase[],
  snapshotItems: ItemBase[],
): InsertionGhostRect {
  const direction = getDirection(container);
  const contentRect = containerContentRect(container);
  const thickness = 3;

  if (items.length === 0) {
    if (direction === "row") {
      return {
        x: contentRect.x + contentRect.width / 2 - thickness / 2,
        y: contentRect.y,
        width: thickness,
        height: Math.max(1, contentRect.height),
      };
    }

    return {
      x: contentRect.x,
      y: contentRect.y + contentRect.height / 2 - thickness / 2,
      width: Math.max(1, contentRect.width),
      height: thickness,
    };
  }

  if (direction === "row") {
    const previous =
      index >= items.length
        ? snapshotItems[snapshotItems.length - 1]
        : items[index - 1];
    const next = index === 0 ? snapshotItems[0] : items[index];
    const previousRect = previous ? requireDragSnapshotBox(previous) : null;
    const nextRect = next ? requireDragSnapshotBox(next) : null;
    const markerCenter = previousRect
      ? nextRect
        ? (previousRect.x + previousRect.width + nextRect.x) / 2
        : previousRect.x + previousRect.width
      : nextRect!.x;

    return {
      x: markerCenter - thickness / 2,
      y: contentRect.y,
      width: thickness,
      height: Math.max(1, contentRect.height),
    };
  }

  const previous =
    index >= items.length
      ? snapshotItems[snapshotItems.length - 1]
      : items[index - 1];
  const next = index === 0 ? snapshotItems[0] : items[index];
  const previousRect = previous ? requireDragSnapshotBox(previous) : null;
  const nextRect = next ? requireDragSnapshotBox(next) : null;
  const markerCenter = previousRect
    ? nextRect
      ? (previousRect.y + previousRect.height + nextRect.y) / 2
      : previousRect.y + previousRect.height
    : nextRect!.y;

  return {
    x: contentRect.x,
    y: markerCenter - thickness / 2,
    width: Math.max(1, contentRect.width),
    height: thickness,
  };
}

function configuredInsertionMarkerRect(
  container: Container,
  index: number,
  context: ResolutionContext,
  defaultRect: GhostRect,
): GhostRect {
  const callback = container.callbacks?.getInsertionMarkerRect;
  if (!callback) return frozenRect(defaultRect);

  const base = containerResolutionBase(context, container);
  const result = callback({
    session: context.session?.handle ?? null,
    item: context.item,
    itemId: context.itemId,
    itemMetadata: context.itemMetadata,
    items: [...context.items],
    itemIds: [...context.itemIds],
    itemsMetadata: [...context.itemsMetadata],
    source: context.source,
    sources: [...context.sources],
    container,
    containerMetadata: base.containerMetadata,
    index,
    pointer: context.pointer,
    dragRect: context.dragRect,
    containerRect: base.containerRect,
    containerContentRect: base.containerContentRect,
    defaultRect: frozenRect(defaultRect),
  } satisfies InsertionMarkerRectEvent);
  assertRect(result, "getInsertionMarkerRect", container);
  return frozenRect(result);
}

function collectInsertionCandidates(
  item: ItemBase,
  root: ItemBase,
  context: ResolutionContext,
): {
  candidates: InsertionCandidate[];
  pointerX: number;
  pointerY: number;
} {
  const pointerX = context.pointer.x;
  const pointerY = context.pointer.y;
  const excludeSet = context.session
    ? context.session.itemSet
    : new Set([item]);
  const candidates: InsertionCandidate[] = [];

  const visit = (container: ItemBase) => {
    if (excludeSet.has(container)) return;

    const snapshotOrderedList = dragSnapshotItems(container);
    const children = snapshotOrderedList.filter(
      (child) => !excludeSet.has(child) && !child.isGhost,
    );
    const snapshotChildren = snapshotOrderedList.filter(
      (child) => !child.isGhost,
    );
    const snapshotIndices = new Map(
      snapshotOrderedList.map((child, index) => [child, index]),
    );
    const indexForGap = (index: number) => {
      const nextItem = children[index] ?? null;
      if (!nextItem) return snapshotOrderedList.length;

      const snapshotIndex = snapshotIndices.get(nextItem) ?? -1;
      return snapshotIndex === -1 ? index : snapshotIndex;
    };

    if (isInsertionContainer(container)) {
      for (let index = 0; index <= children.length; index++) {
        const insertionIndex = indexForGap(index);
        const defaultRect = insertionMarkerRect(
          container,
          index,
          children,
          snapshotChildren,
        );
        const ghostRect = configuredInsertionMarkerRect(
          container,
          insertionIndex,
          context,
          defaultRect,
        );
        const ghostCenterX = ghostRect.x + ghostRect.width / 2;
        const ghostCenterY = ghostRect.y + ghostRect.height / 2;
        const distance = distanceToRect(
          { x: pointerX, y: pointerY },
          ghostRect,
        );
        candidates.push({
          target: { container, index: insertionIndex, ghostRect },
          ghostCenterX,
          ghostCenterY,
          distance,
          placementRect: ghostRect,
        });
      }
    }

    for (const child of children) {
      if (isContainerObject(child)) {
        visit(child);
      }
    }
  };

  visit(root);

  return { candidates, pointerX, pointerY };
}

function chooseInsertionCandidate(
  candidates: InsertionCandidate[],
  pointerX: number,
  pointerY: number,
): InsertionCandidate | null {
  let best: InsertionCandidate | null = null;
  for (const candidate of candidates) {
    if (!best) {
      best = candidate;
      continue;
    }

    if (
      Math.abs(candidate.distance - best.distance) <= 1 &&
      candidate.target.container.id !== best.target.container.id
    ) {
      best = chooseByContentBox(best, candidate, pointerX, pointerY);
      continue;
    }

    if (candidate.distance < best.distance) {
      best = candidate;
    }
  }
  return best;
}

function configuredDropPriority(container: ItemBase): number {
  const value =
    "dropPriority" in container
      ? (container as any).dropPriority
      : (container as any).config?.dropPriority;
  if (value !== undefined && !Number.isFinite(value)) {
    throw new TypeError(
      `SnapSort Container ${container.id}: dropPriority must be a finite number.`,
    );
  }
  return value ?? 0;
}

function dropPolicyEvent(
  candidate: { target: ResolvedDropTarget },
  context: ResolutionContext,
): Omit<DropPriorityEvent, "staticPriority"> & Pick<CanDropEvent, "index"> {
  const base = containerResolutionBase(context, candidate.target.container);

  return {
    session: context.session?.handle ?? null,
    item: context.item,
    itemId: context.itemId,
    itemMetadata: context.itemMetadata,
    items: [...context.items],
    itemIds: [...context.itemIds],
    itemsMetadata: [...context.itemsMetadata],
    source: context.source,
    sources: [...context.sources],
    container: base.container as DropPriorityEvent["container"],
    containerMetadata: base.containerMetadata,
    index: candidate.target.index,
    pointer: context.pointer,
    dragRect: context.dragRect,
    containerRect: base.containerRect,
    containerContentRect: base.containerContentRect,
    depth: base.depth,
  };
}

/**
 * Apply destination-owned drop policy once per distinct container. Eligibility
 * is resolved before priority; only candidates tied at the highest effective
 * priority continue to the active placement mode's slot-ranking algorithm.
 */
function applyDropPolicy<T extends { target: ResolvedDropTarget }>(
  candidates: T[],
  getContext: () => ResolutionContext,
): T[] {
  if (candidates.length === 0) return candidates;
  const byContainer = new Map<ItemBase, T[]>();
  for (const candidate of candidates) {
    const group = byContainer.get(candidate.target.container);
    if (group) {
      group.push(candidate);
    } else {
      byContainer.set(candidate.target.container, [candidate]);
    }
  }

  const eligible: Array<{ candidate: T; priority: number }> = [];
  for (const [container, directCandidates] of byContainer) {
    const callbacks =
      "callbacks" in container ? (container as any).callbacks : undefined;
    let event:
      | (Omit<DropPriorityEvent, "staticPriority"> &
          Pick<CanDropEvent, "index">)
      | undefined;
    const getEvent = () =>
      (event ??= dropPolicyEvent(directCandidates[0], getContext()));
    if (callbacks?.canDrop?.(getEvent() as CanDropEvent) === false) continue;

    const staticPriority = configuredDropPriority(container);
    const override = callbacks?.getDropPriority
      ? callbacks.getDropPriority({
          ...getEvent(),
          staticPriority,
        } as DropPriorityEvent)
      : undefined;
    if (override !== undefined && !Number.isFinite(override)) {
      throw new TypeError(
        `SnapSort Container ${container.id}: getDropPriority must return a finite number or undefined.`,
      );
    }
    const priority = override ?? staticPriority;
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

// TODO: Not all resolution uses center point
function resolutionPointer(
  item: ItemBase,
  session: DragSession | null,
): { x: number; y: number } {
  const itemPointer =
    "dragPointerPosition" in item ? item.dragPointerPosition : null;
  if (session?.pointer) return session.pointer;
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
  root: ItemBase,
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
  root: ItemBase,
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
  root: ItemBase,
  session: DragSession | null = null,
): ResolvedDropTarget | null {
  const debugEnabled = isDropDebugEnabled(root);
  const context = createResolutionContext(
    item,
    session,
    resolutionPointer(item, session),
  );
  const { candidates, pointerX, pointerY } = collectInsertionCandidates(
    item,
    root,
    context,
  );
  const allowed = applyDropPolicy(candidates, () => context);
  const best = chooseInsertionCandidate(allowed, pointerX, pointerY);
  if (debugEnabled) {
    drawCandidateDebug(root, item, allowed, best);
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
  root: ItemBase,
  session: DragSession | null = null,
): ResolvedDropTarget | null {
  if (!session) return null;
  const candidates: SwapCandidate[] = [];

  const visit = (container: ItemBase) => {
    if (container === item) return;

    if (isInsertionContainer(container)) {
      const hovered = findHoveredItem(item, container, session);
      const index = hovered ? container.itemOrderedList.indexOf(hovered) : -1;
      if (hovered && index !== -1) {
        const box = requireDragSnapshotBox(hovered);
        candidates.push({
          target: { container, index },
          area: box.width * box.height,
        });
      }
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

export function debugDropTargetTree(node: ItemBase, draggedItem: ItemBase) {
  const items = node.itemOrderedList.filter(
    (item) => item !== draggedItem && !item.isGhost,
  );

  for (const item of items) {
    const prop = item.dragSnapshot?.box ?? item.currentDomProperty;
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

    if (item.children.length > 0) {
      debugDropTargetTree(item, draggedItem);
    }
  }
}
