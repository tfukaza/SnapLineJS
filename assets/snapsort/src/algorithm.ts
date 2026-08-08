import type { DomProperty } from "@snap-engine/core";
import {
  CollisionEngine,
  CircleCollider,
  PointCollider,
  RectCollider,
} from "@snap-engine/core/collision";
import type { Item as ItemBase } from "./item";
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
import type { DragSession } from "./drag/session";

const TAG_COLLISIONS = "drop-collisions";
const TAG_CANDIDATES = "drop-candidates";
const TAG_LAYOUT = "drop-layout";
const TAG_ZONES = "drop-zones";
const TOP_CANDIDATE_DEBUG_LIMIT = 3;

type Rect = { x: number; y: number; width: number; height: number };
type InsertionGhostRect = Rect & { insetLeft?: number; insetRight?: number };
type WorldRect = Rect;

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

export interface DropCandidate {
  container: ItemBase;
  index: number;
  ghostCenterX: number;
  ghostCenterY: number;
  distance: number;
  /**
   * Sum of euclidean distances between each dragged member's own current
   * drag position and its projected slot center within this candidate's
   * (possibly group-sized) placement rect. Used by euclidean mode's chooser
   * so a multi-item drag picks the candidate that's the best fit for the
   * *whole* run, not just the pressed item. Equal to `distance` when only
   * one item is being dragged.
   */
  groupDistance: number;
  priority: number;
  lineIndex: number;
  dragLineIndex: number;
  lineDistance: number;
  treeDepth: number;
  prevPosition: { x: number; y: number } | null;
  nextPosition: { x: number; y: number } | null;
  placementRect: Rect;
  placementDistance: number;
  placementContainsDragCenter: boolean;
  ghostRect?: InsertionGhostRect;
}

export function resetDropSnapshotDebugDump(_item: ItemBase) {
  return;
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

function containsPoint(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

function distanceToRect(rect: Rect, x: number, y: number): number {
  if (containsPoint(rect, x, y)) return 0;

  const clampedX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const clampedY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return euclidean(x, y, clampedX, clampedY);
}

function distanceToNearestContentEdge(rect: Rect, x: number, y: number): number {
  if (containsPoint(rect, x, y)) {
    return Math.min(
      Math.abs(x - rect.x),
      Math.abs(rect.x + rect.width - x),
      Math.abs(y - rect.y),
      Math.abs(rect.y + rect.height - y),
    );
  }

  return distanceToRect(rect, x, y);
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

function isContainerObject(item: ItemBase) {
  return (
    "configuration" in item &&
    "direction" in item &&
    "name" in item &&
    "numberOfItems" in item
  );
}

function isNoDropContainer(item: ItemBase) {
  const configNoDrop =
    "configuration" in item &&
    (item as { configuration?: { noDrop?: boolean } }).configuration?.noDrop === true;

  return item.noDrop || configNoDrop;
}

function isDropAreaContainer(item: ItemBase) {
  return (
    isContainerObject(item) &&
    !isNoDropContainer(item) &&
    "dropArea" in item &&
    (item as any).dropArea === true
  );
}

const dropAreaCollisionEngine = new CollisionEngine();

function rectColliderForWorldRect(
  owner: ItemBase,
  rect: WorldRect,
): RectCollider | null {
  const scaleX = owner.worldTransform.scaleX;
  const scaleY = owner.worldTransform.scaleY;
  if (scaleX === 0 || scaleY === 0) return null;

  const collider = new RectCollider(
    owner.engine,
    owner,
    0,
    0,
    rect.width / Math.abs(scaleX),
    rect.height / Math.abs(scaleY),
  );
  collider.worldTransform = {
    x: scaleX < 0 ? rect.x + rect.width : rect.x,
    y: scaleY < 0 ? rect.y + rect.height : rect.y,
  };
  return collider;
}

function filterCandidatesByDropArea(
  candidates: DropCandidate[],
  item: ItemBase,
  dragRect: WorldRect,
) {
  const dropAreaContainers = Array.from(
    new Set(candidates.map((candidate) => candidate.container)),
  ).filter(isDropAreaContainer);
  if (dropAreaContainers.length === 0) return candidates;

  const dragCollider = rectColliderForWorldRect(item, dragRect);
  if (!dragCollider) return candidates;

  const collidingContainers: ItemBase[] = [];
  try {
    for (const container of dropAreaContainers) {
      const prop = requireDragSnapshotBox(container);
      const containerCollider = rectColliderForWorldRect(container, prop);
      const isColliding =
        !!containerCollider &&
        dropAreaCollisionEngine.isIntersecting(dragCollider, containerCollider);
      containerCollider?.destroy();

      container.addDebugRect(
        prop.x,
        prop.y,
        prop.width,
        prop.height,
        isColliding ? "rgba(34, 197, 94, 0.35)" : "rgba(148, 163, 184, 0.18)",
        true,
        `drop-area-hitbox-${container.id}`,
        false,
        isColliding ? 3 : 1,
        TAG_ZONES,
      );

      if (isColliding) {
        collidingContainers.push(container);
      }
    }
  } finally {
    dragCollider.destroy();
  }

  if (collidingContainers.length === 0) return candidates;

  const deepestDepth = Math.max(
    ...collidingContainers.map((container) => container.depth),
  );
  const allowedContainers = new Set(
    collidingContainers.filter((container) => container.depth === deepestDepth),
  );
  return candidates.filter((candidate) =>
    allowedContainers.has(candidate.container),
  );
}

const itemHoverCollisionEngine = new CollisionEngine();

function itemHitboxInsets(item: ItemBase): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const metadata = item.dragSnapshot?.metadata ?? item.metadata;
  return {
    top: typeof metadata?.hitboxInsetTop === "number" ? metadata.hitboxInsetTop : 0,
    right:
      typeof metadata?.hitboxInsetRight === "number" ? metadata.hitboxInsetRight : 0,
    bottom:
      typeof metadata?.hitboxInsetBottom === "number"
        ? metadata.hitboxInsetBottom
        : 0,
    left:
      typeof metadata?.hitboxInsetLeft === "number" ? metadata.hitboxInsetLeft : 0,
  };
}

function itemHitboxShape(item: ItemBase): "rect" | "ellipse" {
  const metadata = item.dragSnapshot?.metadata ?? item.metadata;
  return metadata?.hitboxShape === "ellipse" ? "ellipse" : "rect";
}

function hitboxColliderForItem(item: ItemBase): RectCollider | CircleCollider | null {
  const box = item.dragSnapshot?.box;
  if (!box) return null;
  const insets = itemHitboxInsets(item);
  const x = box.x + insets.left;
  const y = box.y + insets.top;
  const width = Math.max(0, box.width - insets.left - insets.right);
  const height = Math.max(0, box.height - insets.top - insets.bottom);

  if (itemHitboxShape(item) === "ellipse") {
    const collider = new CircleCollider(
      item.engine,
      item,
      0,
      0,
      Math.min(width, height) / 2,
    );
    collider.worldTransform = { x: x + width / 2, y: y + height / 2 };
    return collider;
  }

  const collider = new RectCollider(item.engine, item, 0, 0, width, height);
  collider.worldTransform = { x, y };
  return collider;
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

  const pointerCollider = new PointCollider(draggedItem.engine, draggedItem, 0, 0);
  pointerCollider.worldTransform = { x: session.pointer.x, y: session.pointer.y };

  let best: { item: ItemBase; area: number } | null = null;
  try {
    for (const child of dragSnapshotItems(container)) {
      if (session.itemSet.has(child) || child.isGhost) continue;
      const collider = hitboxColliderForItem(child);
      if (!collider) continue;
      try {
        if (!itemHoverCollisionEngine.isIntersecting(pointerCollider, collider)) {
          continue;
        }
        const box = child.dragSnapshot!.box;
        const area = box.width * box.height;
        if (!best || area < best.area) {
          best = { item: child, area };
        }
      } finally {
        collider.destroy();
      }
    }
  } finally {
    pointerCollider.destroy();
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

function chooseByContentBox(
  a: DropCandidate,
  b: DropCandidate,
  dragCenterX: number,
  dragCenterY: number,
): DropCandidate {
  const aRect = containerContentRect(a.container);
  const bRect = containerContentRect(b.container);
  const aContains = containsPoint(aRect, dragCenterX, dragCenterY);
  const bContains = containsPoint(bRect, dragCenterX, dragCenterY);
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
): { candidates: DropCandidate[]; endX: number; endY: number } {
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
    0,
    session,
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
  treeDepth = 0,
  session: DragSession | null = null,
): { candidates: DropCandidate[]; endX: number; endY: number } {
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
  const candidates: DropCandidate[] = [];
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
  ): DropCandidate => {
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
      insertions: [
        ...descendantBaseInsertions,
        insertion,
      ],
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
    const nextPosition = isColumn
      ? { x: rect.x, y: rect.y + rect.height }
      : { x: rect.x + rect.width, y: rect.y };

    return {
      container,
      index,
      ghostCenterX,
      ghostCenterY,
      distance: euclidean(ghostCenterX, ghostCenterY, dragCenterX, dragCenterY),
      groupDistance: session
        ? groupCandidateDistance(session, rect, isColumn)
        : euclidean(ghostCenterX, ghostCenterY, dragCenterX, dragCenterY),
      priority: 0,
      lineIndex,
      dragLineIndex,
      lineDistance: Math.abs(lineIndex - dragLineIndex),
      treeDepth,
      prevPosition: null,
      nextPosition,
      placementRect,
      placementDistance: distanceToRect(
        placementRect,
        dragCenterX,
        dragCenterY,
      ),
      placementContainsDragCenter: containsPoint(
        placementRect,
        dragCenterX,
        dragCenterY,
      ),
    };
  };

  if (
    itemSnapshots.length === 0 &&
    isContainerObject(container) &&
    !isNoDropContainer(container)
  ) {
    candidates.push(makeCandidate(0, { x: startX, y: startY }));
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
      candidates.push(makeCandidate(index, simulatedPosition));
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
          treeDepth + 1,
          session,
        );
        candidates.push(...childResult.candidates);
      }
    }

    if (!itemSnapshot.locked || isContainer) {
      const fallbackMain = simulatedPosition[axes.main] + prop[axes.mainSize];
      const fallbackCross = simulatedPosition[axes.cross];
      candidates.push(
        makeCandidate(
          index + 1,
          pointFromAxes(axes, fallbackMain, fallbackCross),
        ),
      );
    }
  }

  return {
    candidates: isNoDropContainer(container)
      ? candidates.filter((candidate) => candidate.container !== container)
      : candidates,
    endX: startX + contentSize.width,
    endY: startY + contentSize.height,
  };
}

function collectDropCandidates(
  item: ItemBase,
  root: ItemBase,
  session: DragSession | null = null,
): {
  candidates: DropCandidate[];
  dragCenterX: number;
  dragCenterY: number;
  dragGhostW: number;
  dragGhostH: number;
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
  );

  const dragRect = {
    x: item.dragPositionX,
    y: item.dragPositionY,
    width: dragGhostW,
    height: dragGhostH,
  };
  const candidates = filterCandidatesByDropArea(
    virtualCandidates,
    item,
    dragRect,
  );

  return { candidates, dragCenterX, dragCenterY, dragGhostW, dragGhostH };
}

/**
 * Choose the candidate with the least *sum* of per-member distances (see
 * `groupCandidateDistance`) — for a single dragged item this is identical to
 * choosing by `distance`.
 */
function chooseEuclideanCandidate(
  candidates: DropCandidate[],
): DropCandidate | null {
  let best: DropCandidate | null = null;
  for (const candidate of candidates) {
    if (!best || candidate.groupDistance < best.groupDistance) {
      best = candidate;
    }
  }
  return best;
}

function chooseProgressiveCandidate(
  candidates: DropCandidate[],
  dragCenterX: number,
  dragCenterY: number,
): DropCandidate | null {
  let best: DropCandidate | null = null;
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
      candidate.placementContainsDragCenter !==
      best.placementContainsDragCenter
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
      candidate.container.id !== best.container.id
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
  candidates: DropCandidate[],
  best: DropCandidate | null,
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
      `${isBest ? ">> " : ""}[${candidate.container.id}:${candidate.index}] d=${Math.round(candidate.distance)}`,
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
      const label = `#${i + 1} ${candidate.container.id}:${candidate.index} d=${Math.round(candidate.distance)}`;

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
      `DROP: container=${best.container.id} idx=${best.index} dist=${Math.round(best.distance)}`,
      "rgba(250, 204, 21, 0.9)",
      true,
      `drop-result`,
      TAG_CANDIDATES,
    );
  } else {
    item.clearDebugMarker(`drop-result`);
  }
}

function groupIDOf(item: ItemBase): string | undefined {
  return "groupID" in item ? (item as any).groupID : undefined;
}

function compatibleInsertionContainer(
  container: ItemBase,
  sourceGroupID: string | undefined,
): boolean {
  if (!isContainerObject(container)) return false;
  if (isNoDropContainer(container)) return false;
  const targetGroupID = groupIDOf(container);
  return !sourceGroupID || !targetGroupID || sourceGroupID === targetGroupID;
}

function insertionMarkerInsets(container: ItemBase): {
  left: number;
  right: number;
} {
  const snapshotInsets = (container as any).dragSnapshotInsertionMarkerInsets;
  if (
    snapshotInsets &&
    typeof snapshotInsets.left === "number" &&
    typeof snapshotInsets.right === "number"
  ) {
    return snapshotInsets;
  }

  const metadata = (container as any).metadata;
  return {
    left:
      typeof metadata?.insertionMarkerInsetLeft === "number"
        ? metadata.insertionMarkerInsetLeft
        : 0,
    right:
      typeof metadata?.insertionMarkerInsetRight === "number"
        ? metadata.insertionMarkerInsetRight
        : 0,
  };
}

function insertionMarkerRect(
  container: ItemBase,
  index: number,
  items: ItemBase[],
  snapshotItems: ItemBase[],
): InsertionGhostRect {
  const direction = getDirection(container);
  const contentRect = containerContentRect(container);
  const thickness = 3;
  const insets =
    direction === "column"
      ? insertionMarkerInsets(container)
      : { left: 0, right: 0 };
  const withInsets = (rect: Rect): InsertionGhostRect => {
    if (insets.left === 0 && insets.right === 0) return rect;
    return {
      ...rect,
      insetLeft: insets.left,
      insetRight: insets.right,
    };
  };

  if (items.length === 0) {
    if (direction === "row") {
      return withInsets({
        x: contentRect.x + contentRect.width / 2 - thickness / 2,
        y: contentRect.y,
        width: thickness,
        height: Math.max(1, contentRect.height),
      });
    }

    return withInsets({
      x: contentRect.x,
      y: contentRect.y + contentRect.height / 2 - thickness / 2,
      width: Math.max(1, contentRect.width),
      height: thickness,
    });
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

    return withInsets({
      x: markerCenter - thickness / 2,
      y: contentRect.y,
      width: thickness,
      height: Math.max(1, contentRect.height),
    });
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

  return withInsets({
    x: contentRect.x,
    y: markerCenter - thickness / 2,
    width: Math.max(1, contentRect.width),
    height: thickness,
  });
}

function collectInsertionCandidates(
  item: ItemBase,
  root: ItemBase,
  session: DragSession | null = null,
): {
  candidates: DropCandidate[];
  pointerX: number;
  pointerY: number;
} {
  const pointer =
    "dragPointerPosition" in item ? item.dragPointerPosition : null;
  const dragProp = requireDragSnapshotBox(item);
  const pointerX = pointer?.x ?? item.dragPositionX + dragProp.width / 2;
  const pointerY = pointer?.y ?? item.dragPositionY + dragProp.height / 2;
  const sourceParent = "parent" in item ? (item as any).parent : null;
  const sourceGroupID = sourceParent ? groupIDOf(sourceParent) : undefined;
  const excludeSet = session ? session.itemSet : new Set([item]);
  const candidates: DropCandidate[] = [];

  const visit = (container: ItemBase, treeDepth = 0) => {
    if (excludeSet.has(container)) return;

    const snapshotOrderedList = dragSnapshotItems(container);
    const children = snapshotOrderedList.filter(
      (child) => !excludeSet.has(child) && !child.isGhost,
    );
    const snapshotChildren = snapshotOrderedList.filter(
      (child) => !child.isGhost,
    );
    const indexForGap = (index: number) => {
      const nextItem = children[index] ?? null;
      if (!nextItem) return snapshotOrderedList.length;

      const snapshotIndex = snapshotOrderedList.indexOf(nextItem);
      return snapshotIndex === -1 ? index : snapshotIndex;
    };

    if (compatibleInsertionContainer(container, sourceGroupID)) {
      for (let index = 0; index <= children.length; index++) {
        const insertionIndex = indexForGap(index);
        const ghostRect = insertionMarkerRect(
          container,
          index,
          children,
          snapshotChildren,
        );
        const ghostCenterX = ghostRect.x + ghostRect.width / 2;
        const ghostCenterY = ghostRect.y + ghostRect.height / 2;
        candidates.push({
          container,
          index: insertionIndex,
          ghostCenterX,
          ghostCenterY,
          distance: distanceToRect(ghostRect, pointerX, pointerY),
          groupDistance: distanceToRect(ghostRect, pointerX, pointerY),
          priority: 0,
          lineIndex: index,
          dragLineIndex: index,
          lineDistance: 0,
          treeDepth,
          prevPosition: null,
          nextPosition: null,
          placementRect: ghostRect,
          placementDistance: distanceToRect(ghostRect, pointerX, pointerY),
          placementContainsDragCenter: containsPoint(
            ghostRect,
            pointerX,
            pointerY,
          ),
          ghostRect,
        });
      }
    }

    for (const child of children) {
      if (isContainerObject(child)) {
        visit(child, treeDepth + 1);
      }
    }
  };

  visit(root);

  return { candidates, pointerX, pointerY };
}

function chooseInsertionCandidate(
  candidates: DropCandidate[],
  pointerX: number,
  pointerY: number,
): DropCandidate | null {
  let best: DropCandidate | null = null;
  for (const candidate of candidates) {
    if (!best) {
      best = candidate;
      continue;
    }

    if (
      Math.abs(candidate.distance - best.distance) <= 1 &&
      candidate.container.id !== best.container.id
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

/**
 * Filter out candidates whose container's `canDrop` callback rejects this
 * drag. Evaluated once per distinct container (not once per candidate slot)
 * so a container with many open gaps only pays for one callback invocation
 * per drop-target resolution; `canDrop` must be cheap/pure.
 */
function filterCandidatesByCanDrop(
  candidates: DropCandidate[],
  item: ItemBase,
  session: DragSession | null,
): DropCandidate[] {
  if (candidates.length === 0) return candidates;
  const cache = new Map<ItemBase, boolean>();
  const isAllowed = (candidate: DropCandidate): boolean => {
    const container = candidate.container;
    let allowed = cache.get(container);
    if (allowed === undefined) {
      const canDrop =
        "callbacks" in container
          ? (container as any).callbacks?.canDrop
          : undefined;
      const groupItems = session?.items ?? [item];
      allowed = canDrop
          ? canDrop({
              session,
              item,
              itemId: item.resolvedItemId,
              itemMetadata: item.metadata,
              items: groupItems,
              itemIds: groupItems.map((member) => member.resolvedItemId),
              itemsMetadata: groupItems.map((member) => member.metadata),
            container,
            containerMetadata: (container as any).metadata,
            index: candidate.index,
          }) !== false
        : true;
      cache.set(container, allowed);
    }
    return allowed;
  };
  return candidates.filter(isAllowed);
}

export function determineDropTarget(
  item: ItemBase,
  root: ItemBase,
  session: DragSession | null = null,
): DropCandidate | null {
  const { candidates, dragCenterX, dragCenterY } = collectDropCandidates(
    item,
    root,
    session,
  );
  const allowed = filterCandidatesByCanDrop(candidates, item, session);
  const best = chooseEuclideanCandidate(allowed);
  drawCandidateDebug(root, item, allowed, best, {
    topCandidates: true,
    distanceOrigin: { x: dragCenterX, y: dragCenterY },
  });
  debugDropTargetTree(root, item);
  return best;
}

export function determineProgressiveDropTarget(
  item: ItemBase,
  root: ItemBase,
  session: DragSession | null = null,
): DropCandidate | null {
  const { candidates, dragCenterX, dragCenterY } = collectDropCandidates(
    item,
    root,
    session,
  );
  const allowed = filterCandidatesByCanDrop(candidates, item, session);
  const best = chooseProgressiveCandidate(allowed, dragCenterX, dragCenterY);
  drawCandidateDebug(root, item, allowed, best);
  debugDropTargetTree(root, item);
  return best;
}

export function determineInsertionDropTarget(
  item: ItemBase,
  root: ItemBase,
  session: DragSession | null = null,
): DropCandidate | null {
  const { candidates, pointerX, pointerY } = collectInsertionCandidates(
    item,
    root,
    session,
  );
  const allowed = filterCandidatesByCanDrop(candidates, item, session);
  const best = chooseInsertionCandidate(allowed, pointerX, pointerY);
  drawCandidateDebug(root, item, allowed, best);
  debugDropTargetTree(root, item);
  return best;
}

/**
 * Resolve swap mode's drop target: unlike the other modes, this doesn't
 * resolve a gap — it resolves whichever *item* the pointer's hitbox
 * currently matches (via `findHoveredItem`), anywhere in the tree reachable
 * from `root` under the dragged item's group. `index` is that item's live
 * position in its own container, meaning "swap with whatever is here."
 */
export function determineSwapDropTarget(
  item: ItemBase,
  root: ItemBase,
  session: DragSession | null = null,
): DropCandidate | null {
  const sourceParent = "parent" in item ? (item as any).parent : null;
  const sourceGroupID = sourceParent ? groupIDOf(sourceParent) : undefined;

  let best: DropCandidate | null = null;
  let bestArea = Infinity;

  const visit = (container: ItemBase) => {
    if (container === item) return;

    if (session && compatibleInsertionContainer(container, sourceGroupID)) {
      const hovered = findHoveredItem(item, container, session);
      const index = hovered ? container.itemOrderedList.indexOf(hovered) : -1;
      if (hovered && index !== -1) {
        const box = requireDragSnapshotBox(hovered);
        const area = box.width * box.height;
        if (area < bestArea) {
          bestArea = area;
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          best = {
            container,
            index,
            ghostCenterX: centerX,
            ghostCenterY: centerY,
            distance: euclidean(
              centerX,
              centerY,
              session.pointer.x,
              session.pointer.y,
            ),
            groupDistance: euclidean(
              centerX,
              centerY,
              session.pointer.x,
              session.pointer.y,
            ),
            priority: 0,
            lineIndex: 0,
            dragLineIndex: 0,
            lineDistance: 0,
            treeDepth: 0,
            prevPosition: null,
            nextPosition: null,
            placementRect: box,
            placementDistance: distanceToRect(
              box,
              session.pointer.x,
              session.pointer.y,
            ),
            placementContainsDragCenter: containsPoint(
              box,
              session.pointer.x,
              session.pointer.y,
            ),
          };
        }
      }
    }

    for (const child of dragSnapshotItems(container)) {
      if (isContainerObject(child)) {
        visit(child);
      }
    }
  };

  visit(root);
  const allowed = best ? filterCandidatesByCanDrop([best], item, session) : [];
  return allowed[0] ?? null;
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
