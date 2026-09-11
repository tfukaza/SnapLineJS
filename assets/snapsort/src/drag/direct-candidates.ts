import {
  contentOffset,
  contentRect,
  type Rect,
} from "@snap-engine/core/geometry";
import {
  virtualEntrySizeFor,
  createLayoutResolutionPlan,
  type VirtualInsertion,
  type LayoutResolutionPlan,
} from "@snap-engine/core/layout";
import {
  createDirectInsertionTarget,
  layoutWrapToleranceFor,
  type ResolvedDropTarget,
} from "../algorithm";
import type { DragLocation, InsertionMarkerPresentation } from "../events";
import type { ItemId, ItemSnapshot } from "../snapshot";
import { Container } from "../container";
import type { Item } from "../item";
import { buildDragLocation } from "../event-builders";
import type { DragSessionController } from "./session";

interface DirectLayoutSnapshot {
  readonly root: ItemSnapshot<Item>;
  readonly byItem: ReadonlyMap<Item, ItemSnapshot<Item>>;
}

interface DirectCandidateBase {
  readonly target: Readonly<ResolvedDropTarget>;
  /** Projected world-space border boxes, ordered to parallel session.items. */
  readonly memberRects: readonly Readonly<Rect>[];
}

export interface DirectFlowCandidate extends DirectCandidateBase {
  readonly kind: "flow";
}

export interface DirectInsertionCandidate extends DirectCandidateBase {
  readonly kind: "insertion";
  readonly target: Readonly<ResolvedDropTarget> & {
    readonly insertion: InsertionMarkerPresentation;
  };
}

export interface DirectSwapCandidate extends DirectCandidateBase {
  readonly kind: "swap";
  readonly targetItemId: ItemId;
}

export interface DirectCandidateGeometry {
  readonly pointer: Readonly<{
    x: number;
    y: number;
  }>;
  readonly dragRect: Readonly<Rect>;
  readonly memberRects: readonly Readonly<Rect>[];
}

export type DirectCandidate =
  | DirectFlowCandidate
  | DirectInsertionCandidate
  | DirectSwapCandidate;

function createDirectLayoutSnapshot(root: Container): DirectLayoutSnapshot {
  const rootSnapshot = root.dragSnapshot;

  if (!rootSnapshot) {
    throw new Error(
      "SnapSort: direct candidates require an active drag snapshot.",
    );
  }

  const byItem = new Map<Item, ItemSnapshot<Item>>();

  const visit = (snapshot: ItemSnapshot<Item>): void => {
    byItem.set(snapshot.value, snapshot);

    for (const child of snapshot.children) {
      visit(child);
    }
  };

  visit(rootSnapshot);

  return {
    root: rootSnapshot,
    byItem,
  };
}

// TODO: feels like we have a lot of repeated code to
// traverse item trees, we should make a common utility.
function collectDirectSlotTargets(
  session: DragSessionController,
  rootSnapshot: ItemSnapshot<Item>,
): readonly ResolvedDropTarget[] {
  const targets: ResolvedDropTarget[] = [];

  const visit = (containerSnapshot: ItemSnapshot<Item>): void => {
    const container = containerSnapshot.value;

    if (!(container instanceof Container)) {
      throw new Error(
        "SnapSort: direct candidate traversal expected a container.",
      );
    }

    const retainedChildren = containerSnapshot.children.filter(
      (child) => !session.itemSet.has(child.value),
    );

    targets.push({
      container,
      index: 0,
    });

    retainedChildren.forEach((child, index) => {
      if (child.value instanceof Container) {
        visit(child);
      }

      targets.push({
        container,
        index: index + 1,
      });
    });
  };

  visit(rootSnapshot);

  return targets;
}

export function createDirectFlowCandidates(
  session: DragSessionController,
): readonly DirectCandidate[] {
  const snapshot = createDirectLayoutSnapshot(session.root);
  const targets = collectDirectSlotTargets(session, snapshot.root);

  const candidates = targets.map(
    (target): DirectFlowCandidate => ({
      kind: "flow",
      target: {
        container: target.container,
        index: target.index,
      },
      memberRects: projectDirectRects(session, snapshot, target),
    }),
  );

  return freezeDirectCandidates(candidates);
}

export function createDirectInsertionCandidates(
  session: DragSessionController,
): readonly DirectCandidate[] {
  const snapshot = createDirectLayoutSnapshot(session.root);

  const slots = collectDirectSlotTargets(session, snapshot.root);

  const candidates = slots.map(
    ({ container, index }): DirectInsertionCandidate => {
      const target = createDirectInsertionTarget(session, container, index);

      return {
        kind: "insertion",
        target,
        memberRects: projectDirectRects(session, snapshot, target),
      };
    },
  );

  return freezeDirectCandidates(candidates);
}

function createDirectInsertionRun(
  session: DragSessionController,
  containerSnapshot: ItemSnapshot<Item>,
  index: number,
): readonly VirtualInsertion<ItemSnapshot<Item>>[] {
  return Object.freeze(
    session.items.map((item, offset) => {
      const box = session.dragBoxFor(item);
      const size = virtualEntrySizeFor(containerSnapshot, box);

      return Object.freeze({
        container: containerSnapshot,
        index: index + offset,
        entry: Object.freeze({
          width: size.width,
          height: size.height,
          margin: box.margin,
        }),
      });
    }),
  );
}

export function createDirectSwapCandidates(
  session: DragSessionController,
  initiatingItemId: ItemId,
): readonly DirectCandidate[] {
  const snapshot = createDirectLayoutSnapshot(session.root);

  const homeItem =
    session.items.find((item) => item.itemId === initiatingItemId) ??
    session.pressedItem;

  const candidates: DirectSwapCandidate[] = [];

  const visit = (containerSnapshot: ItemSnapshot<Item>): void => {
    const container = containerSnapshot.value;

    if (!(container instanceof Container)) {
      throw new Error("SnapSort: direct swap traversal expected a container.");
    }

    containerSnapshot.children.forEach((child, index) => {
      const item = child.value;

      if (item.isGhost) {
        return;
      }

      if (session.itemSet.has(item)) {
        if (item === homeItem) {
          candidates.push({
            kind: "swap",
            target: {
              container,
              index,
            },
            targetItemId: item.itemId,
            memberRects: projectRectsIntoTarget(session, child.box),
          });
        }

        // Never descend into a dragged Container.
        return;
      }

      candidates.push({
        kind: "swap",
        target: {
          container,
          index,
        },
        targetItemId: item.itemId,
        memberRects: projectRectsIntoTarget(session, child.box),
      });

      if (item instanceof Container) {
        visit(child);
      }
    });
  };

  visit(snapshot.root);

  return freezeDirectCandidates(candidates);
}

export function createDirectCandidates(
  session: DragSessionController,
  initiatingItemId: ItemId,
): readonly DirectCandidate[] {
  switch (session.strategy.mode) {
    case "euclidean":
    case "progressive":
      return createDirectFlowCandidates(session);

    case "insertion":
      return createDirectInsertionCandidates(session);

    case "swap":
      return createDirectSwapCandidates(session, initiatingItemId);
  }
}

function snapshotPathTo(
  root: ItemSnapshot<Item>,
  target: ItemSnapshot<Item>,
): readonly ItemSnapshot<Item>[] {
  if (root === target) {
    return [root];
  }

  for (const child of root.children) {
    const childPath = snapshotPathTo(child, target);

    if (childPath.length > 0) {
      return [root, ...childPath];
    }
  }

  return [];
}

function freezeRect(rect: Rect): Readonly<Rect> {
  return Object.freeze({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
}

function sourceMemberRects(
  session: DragSessionController,
): readonly Readonly<Rect>[] {
  return Object.freeze(
    session.items.map((item) => {
      const start = session.dragVisualStart.get(item);

      if (!start) {
        throw new Error(
          "SnapSort: direct candidate geometry requires captured visual positions.",
        );
      }

      const box = session.dragBoxFor(item);
      return freezeRect({
        x: start.x,
        y: start.y,
        width: box.width,
        height: box.height,
      });
    }),
  );
}

// TODO: Eventually, these functions
// should be provided as part of a layout engine
function boundingRect(
  rects: readonly Readonly<Rect>[],
): Rect {
  if (rects.length === 0) {
    throw new Error(
      "SnapSort: cannot calculate a direct candidate without projected items.",
    );
  }

  let left = rects[0].x;
  let top = rects[0].y;
  let right = rects[0].x + rects[0].width;
  let bottom = rects[0].y + rects[0].height;

  for (const rect of rects.slice(1)) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function projectRectsIntoTarget(
  session: DragSessionController,
  target: Readonly<Rect>,
): readonly Readonly<Rect>[] {
  const sourceRects = sourceMemberRects(session);
  const sourceGroup = boundingRect(sourceRects);
  const scaleX = sourceGroup.width > 0 ? target.width / sourceGroup.width : 1;
  const scaleY =
    sourceGroup.height > 0 ? target.height / sourceGroup.height : 1;

  return Object.freeze(
    sourceRects.map((rect) =>
      freezeRect({
        x: target.x + (rect.x - sourceGroup.x) * scaleX,
        y: target.y + (rect.y - sourceGroup.y) * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY,
      }),
    ),
  );
}

export function directCandidateGeometry(
  session: DragSessionController,
  candidate: DirectCandidate,
): DirectCandidateGeometry {
  const sourceRects = sourceMemberRects(session);
  const pressedIndex = session.items.indexOf(session.pressedItem);
  const primaryIndex = session.items.indexOf(session.primaryItem);
  const pressedStart = sourceRects[pressedIndex];
  const pressedTarget = candidate.memberRects[pressedIndex];
  const primaryTarget = candidate.memberRects[primaryIndex];

  if (
    candidate.memberRects.length !== session.items.length ||
    !pressedStart ||
    !pressedTarget ||
    !primaryTarget
  ) {
    throw new Error(
      "SnapSort: direct candidate geometry requires one projected rectangle per participant.",
    );
  }

  const delta = {
    x: pressedTarget.x - pressedStart.x,
    y: pressedTarget.y - pressedStart.y,
  };

  return Object.freeze({
    pointer: Object.freeze({
      x: session.visualStart.x + delta.x,
      y: session.visualStart.y + delta.y,
    }),
    dragRect: primaryTarget,
    memberRects: candidate.memberRects,
  });
}

function projectedContentOrigin(
  layoutPlan: LayoutResolutionPlan<ItemSnapshot<Item>>,
  path: readonly ItemSnapshot<Item>[],
): Readonly<{ x: number; y: number }> {
  const rootSnapshot = path[0];

  if (!rootSnapshot) {
    throw new Error(
      "SnapSort: direct candidate target is outside the drag snapshot.",
    );
  }

  const rootContent = contentRect(rootSnapshot.box);
  let origin = { x: rootContent.x, y: rootContent.y };

  for (let index = 1; index < path.length; index += 1) {
    const parent = path[index - 1];
    const child = path[index];

    const parentLayout = layoutPlan.layoutPositions(parent, origin.x, origin.y);

    const childPosition = parentLayout.itemPositions.get(child);

    if (!childPosition) {
      throw new Error(
        "SnapSort: layout did not project a direct candidate container.",
      );
    }

    const offset = contentOffset(child.box);
    origin = { x: childPosition.x + offset.x, y: childPosition.y + offset.y };
  }

  return Object.freeze(origin);
}

function projectDirectRects(
  session: DragSessionController,
  snapshot: DirectLayoutSnapshot,
  target: ResolvedDropTarget,
): readonly Readonly<Rect>[] {
  const targetSnapshot = snapshot.byItem.get(target.container);

  if (!targetSnapshot) {
    throw new Error(
      "SnapSort: direct candidate target is outside the drag snapshot.",
    );
  }

  const insertionRun = createDirectInsertionRun(
    session,
    targetSnapshot,
    target.index,
  );

  const layoutPlan = createLayoutResolutionPlan(snapshot.root, {
    exclude: (node) => session.itemSet.has(node.value),
    insertions: insertionRun,
    wrapTolerance: layoutWrapToleranceFor(target.container),
  });

  const path = snapshotPathTo(snapshot.root, targetSnapshot);
  const targetOrigin = projectedContentOrigin(layoutPlan, path);

  const result = layoutPlan.layoutPositions(
    targetSnapshot,
    targetOrigin.x,
    targetOrigin.y,
    insertionRun,
  );

  const memberRects = insertionRun.map((insertion) => {
    const rect = result.virtualRects.get(insertion);

    if (!rect) {
      throw new Error(
        "SnapSort: layout did not project a direct candidate item.",
      );
    }

    return rect;
  });

  return Object.freeze(memberRects.map(freezeRect));
}

function freezeInsertion(
  insertion: InsertionMarkerPresentation,
): InsertionMarkerPresentation {
  const freezeNeighbor = (neighbor: InsertionMarkerPresentation["previous"]) =>
    neighbor
      ? Object.freeze({
          ...neighbor,
          rect: freezeRect(neighbor.rect),
        })
      : null;

  return Object.freeze({
    gap: Object.freeze({ ...insertion.gap }),
    previous: freezeNeighbor(insertion.previous),
    next: freezeNeighbor(insertion.next),
    isCurrentPlacement: insertion.isCurrentPlacement,
  });
}

export function freezeDirectCandidate(
  candidate: DirectCandidate,
): DirectCandidate {
  const memberRects = Object.freeze(candidate.memberRects.map(freezeRect));

  switch (candidate.kind) {
    case "flow":
      return Object.freeze({
        kind: candidate.kind,
        target: Object.freeze({
          container: candidate.target.container,
          index: candidate.target.index,
        }),
        memberRects,
      });

    case "insertion":
      return Object.freeze({
        kind: candidate.kind,
        target: Object.freeze({
          container: candidate.target.container,
          index: candidate.target.index,
          insertion: freezeInsertion(candidate.target.insertion),
        }),
        memberRects,
      });

    case "swap":
      return Object.freeze({
        kind: candidate.kind,
        target: Object.freeze({
          container: candidate.target.container,
          index: candidate.target.index,
        }),
        targetItemId: candidate.targetItemId,
        memberRects,
      });
  }
}

export function freezeDirectCandidates(
  candidates: readonly DirectCandidate[],
): readonly DirectCandidate[] {
  return Object.freeze(candidates.map(freezeDirectCandidate));
}

export function directCandidateLocations(
  candidates: readonly DirectCandidate[],
): readonly DragLocation[] {
  return Object.freeze(
    candidates.map((candidate) =>
      Object.freeze(
        buildDragLocation(candidate.target.container, candidate.target.index),
      ),
    ),
  );
}
