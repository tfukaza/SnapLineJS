import type { AnimationConfig } from "../container";
import type { Container } from "../container";
import type { Item } from "../item";
import type { ResolvedDropTarget } from "../algorithm";
import {
  buildDragLocation,
  buildGhostSlotLocation,
  updateGhostState,
} from "../event-builders";
import type { DragLocation, GhostRect, GhostState } from "../events";
import { virtualEntrySizeFor } from "../layout";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostMove,
  assertCanFireGhostRemove,
  assertCanFireItemMove,
  fireGhostInsert,
  fireGhostMove,
  fireMutation,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type {
  DragSessionController as DragSession,
  DropPlacement,
} from "./session";
import { readVisualRect } from "../internal/visual-rect";
import {
  pointerPreviewMemberRects,
  removePointerPreview,
  startPointerPreview,
  updatePointerPreview,
  validatePointerPreview,
} from "./pointer-preview";
import {
  computeGroupOffsets,
  resetItemVisual,
  restoreActiveItems,
} from "./item-visual";
import {
  assertCanPlaceItems,
  detachItem,
  elementAfterRun,
  placeItemAtUnchecked,
} from "../internal/tree-mutation";
import { reconcileRootTreeState } from "../internal/tree-state";
import {
  animationConfigFor,
  playDropAnimation,
  withReorderAnimation,
} from "../internal/flip-animation";
import {
  flowSlotBeforeEntry,
  isFlowSpacerState,
  rawIndexForFlowSlot,
} from "../internal/flow-slots";

/**
 * Flow-layout spacer ghosts: euclidean and progressive modes. Each ghost is a
 * real member of the target container's item-ordered list and is FLIP-
 * animated into place as items reorder around it; the dragged item(s) are
 * hoisted to `position: absolute` and follow the pointer.
 *
 * A multi-item drag creates ONE ghost anchor per dragged member
 * (`DragSession.flowGhostRun`), inserted as a contiguous run at the drop
 * slot. Each anchor fires its own `onGhostInsert` carrying the
 * full `items` list, so the renderer adapter decides how the run looks —
 * separate ghosts (default), one merged ghost (render only the head, leave
 * the rest elementless), or none. The core never forces a single
 * group-sized spacer.
 */

interface CurrentFlowPlacement {
  container: Container;
  index: number;
  rawIndex: number;
}

function currentFlowPlacement(
  session: DragSession,
): CurrentFlowPlacement | null {
  const run = session.flowGhostRun;
  const head = run[0];
  if (!head) return null;
  const headLocation = head.getIndexAndContainer();
  const container = headLocation.container;
  if (!container) {
    if (run.some((ghost) => ghost.getIndexAndContainer().container !== null)) {
      throw new Error(
        "SnapSort: a flow ghost run cannot mix present and absent anchors.",
      );
    }
    return null;
  }

  for (let i = 0; i < run.length; i++) {
    const location = run[i].getIndexAndContainer();
    if (
      location.container !== container ||
      location.index !== headLocation.index + i
    ) {
      throw new Error(
        "SnapSort: an attached flow ghost run must be one contiguous ordered slice.",
      );
    }
  }

  const index = flowSlotBeforeEntry(container.itemOrderedList, head, (item) =>
    consumesFlowSlot(session, item),
  );
  for (let i = 0; i < run.length; i++) {
    const state = run[i].ghostState;
    if (
      !state ||
      state.type !== "target-spacer" ||
      state.location.container !== container ||
      state.location.index !== index + i
    ) {
      throw new Error(
        "SnapSort: an attached flow ghost run must match its ordered slot state.",
      );
    }
  }
  return { container, index, rawIndex: headLocation.index };
}

/**
 * Translate a frozen snapshot insertion index into the current live list.
 *
 * The live list may contain ghosts and no longer contain any dragged item,
 * so this maps through the snapshot item that should appear after the target.
 */
function flowSlotIndexFromSnapshotIndex(
  session: DragSession,
  container: Container,
  snapshotIndex: number,
): number {
  const snapshot = container.dragSnapshot;
  if (!snapshot) {
    throw new Error(
      `SnapSort: destination "${container.name}" has no captured drag layout.`,
    );
  }
  const snapshotChildren = snapshot.children;
  const snapshotRawIndex = rawIndexForFlowSlot(
    snapshotChildren,
    Math.max(0, snapshotIndex),
    ({ value }) => !session.itemSet.has(value) && !value.isGhost,
  );
  const beforeItem =
    snapshotRawIndex === null
      ? null
      : snapshotChildren[snapshotRawIndex]?.value ?? null;
  const runSet = new Set(session.flowGhostRun);
  return flowSlotBeforeEntry(
    container.itemOrderedList,
    beforeItem,
    (item) => !runSet.has(item) && consumesFlowSlot(session, item),
  );
}

/** Translate the pressed Item's source slot into the spacer coordinate. */
function initialFlowSlotIndex(
  session: DragSession,
  source: DragLocation,
): number {
  const snapshots = source.container.dragSnapshot?.children;
  if (!snapshots) {
    throw new Error("SnapSort: a flow drag requires a captured source layout.");
  }
  return flowSlotBeforeEntry(
    snapshots,
    snapshots[source.index] ?? null,
    ({ value }) => !session.itemSet.has(value) && !value.isGhost,
  );
}

/**
 * Size a run anchor's spacer rect for its *destination* container: the
 * member's own snapshot box, cross-axis-stretched when the destination
 * declares `stretchItems` (so a spacer entering a narrower nested list
 * reserves the nested width, not the source container's).
 */
function anchorRectFor(
  session: DragSession,
  container: Container,
  member: Item,
): GhostRect {
  const box = session.dragBoxFor(member);
  const containerSnapshot = container.dragSnapshot;
  if (!containerSnapshot) {
    throw new Error(
      `SnapSort: destination "${container.name}" has no captured drag layout.`,
    );
  }
  const size = virtualEntrySizeFor(containerSnapshot, box);
  return { x: 0, y: 0, width: size.width, height: size.height };
}

/**
 * Ensure the target ghost run has one anchor per dragged member. Each anchor
 * is created for its own member (so its state has `original = member`
 * and can size/skip per member), sized to that member's snapshot box for the
 * destination container. Newly created anchors are not yet attached to any
 * container.
 */
function ensureFlowGhostRun(
  session: DragSession,
  container: Container,
  index: number,
  rects: readonly GhostRect[],
): Item[] {
  const run = session.flowGhostRun;
  if (run.length !== 0 && run.length !== session.items.length) {
    throw new Error("SnapSort: a flow ghost run must be complete.");
  }
  for (let i = run.length; i < session.items.length; i++) {
    const member = session.items[i];
    const ghost = member.createGhostItem(
      session,
      {
        type: "target-spacer",
        location: buildGhostSlotLocation(container, index + i),
      },
      rects[i],
    );
    run.push(ghost);
  }
  return run;
}

type TargetSpacerState = Extract<GhostState, { type: "target-spacer" }>;

interface FlowGhostTransition {
  ghost: Item;
  previous: TargetSpacerState;
  next: TargetSpacerState;
}

function consumesFlowSlot(session: DragSession, item: Item): boolean {
  if (session.itemSet.has(item)) return false;
  if (!item.isGhost) return true;
  return isFlowSpacerState(item.ghostState);
}

function* entriesWithoutCurrentFlowRun(
  container: Container,
  current: CurrentFlowPlacement | null,
  runLength: number,
): IterableIterator<Item> {
  const removedStart =
    current?.container === container ? current.rawIndex : null;
  for (let i = 0; i < container.itemOrderedList.length; i++) {
    if (
      removedStart !== null &&
      i >= removedStart &&
      i < removedStart + runLength
    ) {
      continue;
    }
    yield container.itemOrderedList[i];
  }
}

function rawFlowInsertionIndex(
  session: DragSession,
  container: Container,
  current: CurrentFlowPlacement | null,
  runLength: number,
  slotIndex: number,
): number {
  const rawIndex = rawIndexForFlowSlot(
    entriesWithoutCurrentFlowRun(container, current, runLength),
    slotIndex,
    (entry) => consumesFlowSlot(session, entry),
  );
  if (rawIndex === null) {
    throw new Error(
      `SnapSort: flow ghost slot ${slotIndex} is outside container "${container.name}".`,
    );
  }
  return rawIndex;
}

/** Materialize a complete flow run and publish its ordered state transition. */
function commitFlowGhostRun(
  session: DragSession,
  container: Container,
  index: number,
  run: readonly Item[],
  rects: readonly GhostRect[],
): void {
  const current = currentFlowPlacement(session);
  const rawIndex = rawFlowInsertionIndex(
    session,
    container,
    current,
    run.length,
    index,
  );
  const operation = current ? "move" : "insert";

  const transitions: FlowGhostTransition[] = run.map((ghost, i) => {
    const previous = ghost.ghostState;
    if (!previous || previous.type !== "target-spacer") {
      throw new Error(
        "SnapSort: a flow ghost must retain target-spacer state.",
      );
    }
    return {
      ghost,
      previous,
      next: updateGhostState(
        previous,
        buildGhostSlotLocation(container, index + i),
        rects[i],
      ),
    };
  });
  const root = container.rootContainer;
  try {
    fireMutation(container, () => {
      assertCanPlaceItems(
        transitions.map(({ ghost }) => ({ container, item: ghost })),
      );
      if (operation === "move") {
        for (const { ghost } of transitions) {
          const current = ghost.getIndexAndContainer().container;
          if (!current) {
            throw new Error(
              "SnapSort: a present flow ghost must have a container.",
            );
          }
          detachItem(current, ghost);
        }
      }
      transitions.forEach(({ ghost }, i) => {
        placeItemAtUnchecked(container, ghost, rawIndex + i);
      });

      const beforeElement = elementAfterRun(container, rawIndex, run.length);
      for (const { ghost, next } of transitions) {
        ghost.ghostState = next;
      }
      for (const { ghost, previous, next } of transitions) {
        if (operation === "move") {
          fireGhostMove(previous, next, beforeElement);
        } else {
          fireGhostInsert(ghost, beforeElement);
        }
      }
    });
  } finally {
    reconcileRootTreeState(root);
  }
}

async function syncFlowPlacement(
  session: DragSession,
  placement: DropPlacement,
): Promise<void> {
  const { container, index } = placement;
  if (!container.element) {
    throw new Error(
      `SnapSort: destination "${container.name}" must be mounted before placing a flow spacer.`,
    );
  }
  if (session.dropEffect !== "none") {
    assertCanFireItemMove(container);
  }
  // A rendered ghost must always have an adapter-owned cleanup path before
  // it is created or attached. Otherwise a bad adapter config can leak state
  // and DOM when the drag ends or crosses containers.
  assertCanFireGhostInsert(container);
  assertCanFireGhostMove(container);
  assertCanFireGhostRemove(container);
  const rects = session.items.map((member) =>
    anchorRectFor(session, container, member),
  );
  const run = ensureFlowGhostRun(session, container, index, rects);
  if (run.length === 0) return;

  session.pendingPlacement = placement;

  const doMove = () => {
    if (session.pendingPlacement !== placement || !container.element) {
      return;
    }

    commitFlowGhostRun(session, container, index, run, rects);
  };

  // If any anchor is already placed, animate the whole run's move; otherwise
  // this is the initial placement, which needs no FLIP.
  if (run.some((ghost) => ghost.parent)) {
    withReorderAnimation(container, container, session.items, doMove);
  } else {
    doMove();
    await settleMutation();
  }
}

async function clearFlowPlacement(session: DragSession): Promise<void> {
  session.pendingPlacement = null;
  const run = session.flowGhostRun;
  if (run.length === 0) return;

  fireMutation(session.root, () => {
    for (const ghost of run) {
      ghost.removeGhost();
    }
  });
  await settleMutation();
  for (const ghost of run) {
    ghost.destroy(false);
  }
  run.length = 0;
}

function drop(session: DragSession): void {
  const items = session.items;
  const root = session.root;
  const dropItemIds = items.map((member) => member.resolvedItemId);
  const dropRects = items.map(() => ({
    first: null as DOMRect | null,
    last: null as DOMRect | null,
    element: null as HTMLElement | null,
  }));
  let dropAnimationConfig: AnimationConfig | null = null;

  session.pressedItem.schedule(
    () => {
      if (session.dragVisual === "preview") {
        pointerPreviewMemberRects(session).forEach((rect, i) => {
          dropRects[i].first = rect;
        });
        return;
      }
      if (session.dragVisual !== "item") return;
      items.forEach((member, i) => {
        dropRects[i].first = readVisualRect(member);
      });
    },
    {
      stage: "READ_1",
      queueId: `drag-end-read-first-${session.pressedItem.id}`,
    },
  );

  session.pressedItem.schedule(
    async () => {
      const item = session.primaryItem;
      const pending = session.pendingPlacement;
      const live = currentFlowPlacement(session);
      const usePending =
        !!pending &&
        (!live ||
          live.container !== pending.container ||
          live.index !== pending.index);
      let ghostPos: { container: Container; index: number } | null = usePending
        ? { container: pending.container, index: pending.index }
        : live;

      if (session.cancelled) {
        ghostPos = null;
      } else if (!ghostPos?.container) {
        const finalTarget =
          root.hasDragSnapshotTree() && item.dragSnapshot
            ? session.strategy.dropTarget.resolve(item, root, session)
            : null;
        ghostPos = finalTarget
          ? {
              container: finalTarget.container,
              index: flowSlotIndexFromSnapshotIndex(
                session,
                finalTarget.container,
                finalTarget.index,
              ),
            }
          : {
              container: session.activeSources[0].container,
              index: session.activeSources[0].index,
            };
      }

      if (session.dragVisual === "item") {
        resetItemVisual(session);
      }

      await clearFlowPlacement(session);
      await removePointerPreview(session);

      const destination: DragLocation | null = ghostPos?.container
        ? buildDragLocation(ghostPos.container, ghostPos.index)
        : null;

      if (session.dropEffect === "none" || !destination) {
        restoreActiveItems(session);
        dropAnimationConfig = animationConfigFor(
          session.activeSources[0].container,
          "drop",
        );
      } else {
        dropAnimationConfig = animationConfigFor(destination.container, "drop");
        item.moveItemsAt(
          session.activeSources,
          destination.container,
          items,
          destination.index,
          session,
        );
        await settleMutation();
      }

      session.complete(destination);
    },
    { stage: "WRITE_1", queueId: `drag-end-${session.pressedItem.id}` },
  );

  root.schedule(
    () => {
      items.forEach((member, i) => {
        const currentItem = root.findItemByKey(dropItemIds[i]) ?? member;
        const element = currentItem.element?.isConnected
          ? currentItem.element
          : null;
        dropRects[i].element = element;
        dropRects[i].last = readVisualRect(currentItem);
      });
    },
    {
      stage: "READ_2",
      queueId: `drag-end-read-last-${session.pressedItem.id}`,
    },
  );

  root.schedule(
    () => {
      items.forEach((member, i) => {
        const { first, last, element } = dropRects[i];
        playDropAnimation(
          member,
          first,
          last,
          element,
          dropAnimationConfig,
          root,
        );
      });
    },
    { stage: "WRITE_2", queueId: `drag-end-play-${session.pressedItem.id}` },
  );
}

export class FlowGhostLifecycle implements DragLifecycleStrategy {
  readonly placementOccupiesFlowSlots = true;

  validateStart(session: DragSession): void {
    const pressedIndex = session.items.indexOf(session.pressedItem);
    const source =
      session.activeSources[pressedIndex] ?? session.activeSources[0];
    if (session.dropEffect !== "none") assertCanFireItemMove(source.container);
    assertCanFireGhostInsert(source.container);
    assertCanFireGhostRemove(source.container);
    if (session.dragVisual === "preview") validatePointerPreview(session);
  }

  async dragStart(session: DragSession): Promise<void> {
    const participants = session.items.map((member, i) => {
      const source = session.activeSources[i];
      if (!source) {
        throw new Error(
          "SnapSort: flow drag participants require parallel source locations.",
        );
      }
      const liveIndex = source.container.itemOrderedList.indexOf(member);
      if (liveIndex < 0) {
        throw new Error(
          "SnapSort: a flow drag participant must still be attached when its drag starts.",
        );
      }
      return {
        member,
        source,
        box: session.dragBoxFor(member),
      };
    });
    const pressedIndex = session.items.indexOf(session.pressedItem);
    const pressedSource = participants[pressedIndex].source;
    await syncFlowPlacement(
      session,
      Object.freeze({
        container: pressedSource.container,
        index: initialFlowSlotIndex(session, pressedSource),
        ghostRect: null,
      }),
    );

    const pressedItem = session.pressedItem;
    if (session.dragVisual === "item") {
      computeGroupOffsets(session);
    }

    participants.forEach(({ member, source, box }) => {
      const sourceContainer = source.container;
      detachItem(sourceContainer, member);
      if (session.dragVisual !== "item") return;

      member.style = {
        cursor: "grabbing",
        position: "absolute",
        zIndex: "1000",
        top: "0px",
        left: "0px",
        width: `${box.width}px`,
        height: `${box.height}px`,
      };
      session.dragCoordinateParent.set(member, sourceContainer);
      member.refreshDraggedItemPosition();
    });

    if (session.dragVisual === "preview") {
      await startPointerPreview(session);
    }
    if (session.dragVisual === "item") pressedItem.debugAllItems();
  }

  dragMove(session: DragSession): void {
    if (session.dragVisual === "preview") {
      updatePointerPreview(session);
      return;
    }
    if (session.dragVisual !== "item") return;
    for (const member of session.items) member.writeDraggedTransform();
  }

  currentPlacement(
    session: DragSession,
  ): { container: Container; index: number } | null {
    return currentFlowPlacement(session);
  }

  placementIndexFor(session: DragSession, target: ResolvedDropTarget): number {
    return flowSlotIndexFromSnapshotIndex(
      session,
      target.container,
      target.index,
    );
  }

  async syncPlacement(
    session: DragSession,
    placement: DropPlacement,
  ): Promise<void> {
    await syncFlowPlacement(session, placement);
  }

  async clearPlacement(session: DragSession): Promise<void> {
    await clearFlowPlacement(session);
  }

  afterPlacementSync(session: DragSession): void {
    if (session.dragVisual !== "item") return;
    for (const member of session.items) member.refreshDraggedItemPosition();
  }

  drop(session: DragSession): void {
    session.scheduleDropFinalizer();
    drop(session);
  }
}
