import type { AnimationConfig } from "../container";
import type { Container } from "../container";
import type { Item } from "../item";
import { resetDropSnapshotDebugDump, type DropCandidate } from "../algorithm";
import type { DragLocation, GhostRect, GhostRole } from "../events";
import { virtualEntrySizeFor } from "../layout";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  assertCanFireItemMove,
  fireMutation,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type { DragSession } from "./session";
import {
  pointerPreviewMemberRects,
  removePointerPreview,
  startPointerPreview,
  updatePointerPreview,
  validatePointerPreview,
} from "./pointer-preview";

/**
 * Flow-layout spacer ghosts: euclidean and progressive modes. Each ghost is a
 * real member of the target container's item-ordered list and is FLIP-
 * animated into place as items reorder around it; the dragged item(s) are
 * hoisted to `position: absolute` and follow the pointer.
 *
 * A multi-item drag creates ONE ghost anchor per dragged member
 * (`DragSession.flowGhostRun`), inserted as a contiguous run at the drop
 * slot. Each anchor fires its own `createGhost`/`onGhostInsert` carrying the
 * full `items` list, so the framework adapter decides how the run looks —
 * separate ghosts (default), one merged ghost (render only the head, leave
 * the rest elementless), or none. The core never forces a single
 * group-sized spacer.
 */

function currentGhostLocation(
  session: DragSession,
): { container: Container; index: number } | null {
  const head = session.flowGhostRun[0];
  if (!head?.parent) return null;
  const container = head.parent as unknown as Container;
  const index = container.itemOrderedList.indexOf(head);
  if (index === -1) return null;
  return { container, index };
}

/**
 * Translate a frozen snapshot insertion index into the current live list.
 *
 * The live list may contain ghosts and no longer contain any dragged item,
 * so this maps through the snapshot item that should appear after the target.
 */
function liveIndexFromSnapshotIndex(
  session: DragSession,
  container: Container,
  snapshotIndex: number,
): number {
  const snapshotItems = (
    container.dragSnapshot?.children.map((snapshot) => snapshot.value) ?? []
  ).filter((i) => !session.itemSet.has(i) && !i.isGhost);
  const runSet = new Set(session.flowGhostRun);
  const liveItems = container.itemOrderedList.filter(
    (i) => !session.itemSet.has(i) && !runSet.has(i),
  );
  const clampedIndex = Math.max(
    0,
    Math.min(snapshotIndex, snapshotItems.length),
  );
  const beforeItem = snapshotItems[clampedIndex] ?? null;
  if (!beforeItem) return liveItems.length;

  const liveIndex = liveItems.indexOf(beforeItem);
  return liveIndex === -1 ? liveItems.length : liveIndex;
}

/**
 * Size a run anchor's spacer rect for its *destination* container: the
 * member's own snapshot box, cross-axis-stretched when the destination
 * declares `stretchItems` (so a spacer entering a narrower nested list
 * reserves the nested width, not the source container's).
 */
function anchorRectFor(container: Container, member: Item): GhostRect | null {
  const box = member.dragSnapshot?.box;
  if (!box) return null;
  const containerSnapshot = container.dragSnapshot;
  if (!containerSnapshot) {
    return { x: 0, y: 0, width: box.width, height: box.height };
  }
  const size = virtualEntrySizeFor(containerSnapshot, box);
  return { x: 0, y: 0, width: size.width, height: size.height };
}

/**
 * Ensure the target ghost run has one anchor per dragged member. Each anchor
 * is created for its own member (so `createGhost` sees `original = member`
 * and can size/skip per member), sized to that member's snapshot box for the
 * destination container. Newly created anchors are not yet attached to any
 * container.
 */
function ensureFlowGhostRun(
  session: DragSession,
  container: Container,
): Item[] {
  const run = session.flowGhostRun;
  for (let i = run.length; i < session.items.length; i++) {
    const member = session.items[i];
    const rect = anchorRectFor(container, member);
    const ghost = member.createGhostItem(
      session,
      "flow",
      container,
      rect,
      "target",
    );
    if (!ghost) break;
    run.push(ghost);
  }
  return run;
}

async function moveGhost(
  session: DragSession,
  container: Container,
  index: number,
  _ghostRect: GhostRect | null | undefined,
): Promise<void> {
  const item = session.primaryItem;
  if (session.dropEffect !== "none") {
    assertCanFireItemMove(container);
  }
  // A rendered ghost must always have a framework-owned cleanup path before
  // it is created or attached. Otherwise a bad adapter config can leak state
  // and DOM when the drag ends or crosses containers.
  assertCanFireGhostInsert(container);
  assertCanFireGhostRemove(container);
  const run = ensureFlowGhostRun(session, container);
  if (run.length === 0) return;

  const head = run[0];
  session.pendingGhostTarget = {
    ghostItem: head,
    container,
    index,
    ghostRect: null,
  };

  const doMove = () => {
    const pendingTarget = session.pendingGhostTarget;
    if (
      session.flowGhostRun[0] !== head ||
      pendingTarget?.ghostItem !== head ||
      pendingTarget.container !== container ||
      pendingTarget.index !== index ||
      !container.element
    ) {
      return;
    }

    assertCanFireGhostInsert(container);
    for (const ghost of run) {
      if (ghost.parent && ghost.container !== container) {
        assertCanFireGhostRemove(ghost.container);
      }
    }

    // Detach every run anchor from wherever it currently sits, then reinsert
    // the whole run contiguously at `index..index+N-1`, in run order. A
    // same-container reposition stays a silent detach (no consumer-visible
    // event — it's about to be re-inserted into the SAME container this
    // synchronous pass). A cross-container move fires onGhostRemove on the
    // departed container first: adapters that keep per-container ghost
    // state (rather than one shared pool across every container, as today's
    // hand-rolled demo consumers do) need to be told the entry left, or it
    // leaks as a stale ghost there forever.
    run.forEach((ghost, i) => {
      if (!ghost.parent) return;
      const oldContainer = ghost.container;
      if (oldContainer === container) {
        container.detachItemFromContainer(oldContainer, ghost);
      } else {
        item.removeGhostFrom(
          session.items[i] ?? item,
          oldContainer,
          ghost,
          session,
          "flow",
          "target",
        );
      }
    });
    run.forEach((ghost, i) => {
      const member = session.items[i] ?? item;
      const rect = anchorRectFor(container, member);
      container.insertGhostAt(
        session.items[i] ?? item,
        container,
        ghost,
        index + i,
        rect,
        session,
        "flow",
      );
    });
  };

  // If any anchor is already placed, animate the whole run's move; otherwise
  // this is the initial placement, which needs no FLIP.
  if (run.some((ghost) => ghost.parent)) {
    container.withReorderAnimation(container, session.items, doMove);
  } else {
    doMove();
    await settleMutation();
  }
}

async function removeGhost(
  session: DragSession,
  role: GhostRole = "target",
): Promise<void> {
  const item = session.primaryItem;
  if (role !== "target") {
    // Flow mode only ever manages the "target" run here; source ghosts have
    // their own removal path (removeSourceGhosts).
    return;
  }
  session.pendingGhostTarget = null;
  const run = session.flowGhostRun;
  if (run.length === 0) return;

  for (const ghost of run) {
    const ghostContainer = ghost.parent as unknown as Container | null;
    if (ghostContainer) {
      item.removeGhostFrom(
        item,
        ghostContainer,
        ghost,
        session,
        "flow",
        "target",
      );
    }
  }
  await settleMutation();
  for (const ghost of run) {
    ghost.destroy(!ghost.frameworkManagedGhostElement);
  }
  run.length = 0;
}

function restoreToActiveSources(session: DragSession): void {
  const byContainer = new Map<Container, number[]>();
  session.items.forEach((_, i) => {
    const source = session.activeSources[i];
    if (!source) return;
    const indices = byContainer.get(source.container) ?? [];
    indices.push(i);
    byContainer.set(source.container, indices);
  });
  for (const [container, indices] of byContainer) {
    indices
      .slice()
      .sort(
        (a, b) =>
          session.activeSources[a].index - session.activeSources[b].index,
      )
      .forEach((i) => {
        const member = session.items[i];
        if (member.parent) return;
        member.attachItemToContainer(
          container,
          member,
          Math.min(
            session.activeSources[i].index,
            container.itemOrderedList.length,
          ),
        );
      });
  }
}

function drop(session: DragSession): void {
  const items = session.items;
  const root = session.root;
  const dropKeys = items.map((member) => member.itemKey(member));
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
        if (!member.element) return;
        const first = member.readDom({ unapplyTransform: false }, "READ_1");
        dropRects[i].first = new DOMRect(
          first.screenX,
          first.screenY,
          first.width,
          first.height,
        );
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
      const ghostItem = session.flowGhostRun[0] ?? null;
      const pending =
        session.pendingGhostTarget?.ghostItem === ghostItem
          ? session.pendingGhostTarget
          : null;
      const live = ghostItem?.getIndexAndContainer();
      const usePending =
        !!pending &&
        (!live?.container ||
          live.container !== pending.container ||
          live.index !== pending.index);
      let ghostPos = usePending
        ? { container: pending!.container, index: pending!.index }
        : (live as { container: Container | null; index: number } | undefined);

      if (session.cancelled) {
        ghostPos = undefined;
      } else if (!ghostPos?.container) {
        const finalTarget =
          root.hasDragSnapshotTree() && item.dragSnapshot
            ? session.strategy.dropTarget.resolve(item, root, session)
            : null;
        ghostPos = finalTarget
          ? {
              container: finalTarget.container as unknown as Container,
              index: liveIndexFromSnapshotIndex(
                session,
                finalTarget.container as unknown as Container,
                finalTarget.index,
              ),
            }
          : session.activeSources[0]
            ? {
                container: session.activeSources[0].container,
                index: session.activeSources[0].index,
              }
            : undefined;
      }

      if (session.dragVisual === "item") {
        for (const member of items) {
          member.style = {
            cursor: "grab",
            position: "relative",
            zIndex: "",
            top: "",
            left: "",
            width: "",
            height: "",
          };
          member.transformMode = "none";
          member.transformOrigin = null;
          if (member.element) {
            delete member.element.dataset.snapsortDragging;
            member.writeDom();
            member.writeTransform();
          }
        }
      }

      await removeGhost(session, "target");
      await removePointerPreview(session);

      const destination: DragLocation | null = ghostPos?.container
        ? {
            container: ghostPos.container,
            containerMetadata: ghostPos.container.metadata,
            index: ghostPos.index,
          }
        : null;

      if (session.dropEffect === "none" || !destination) {
        restoreToActiveSources(session);
        dropAnimationConfig = item.dropAnimationConfig(
          session.activeSources[0]?.container ?? null,
        );
      } else {
        dropAnimationConfig = item.dropAnimationConfig(destination.container);
        item.moveItemsAt(
          session.activeSources,
          destination.container,
          items,
          destination.index,
          session,
        );
        await settleMutation();
      }

      session.dragCoordinateParent.clear();
      session.dragLayoutPosition.clear();
      session.dragVisualStart.clear();
      session.groupVisualOffsets.clear();
      session.clearHoveredItem();
      root.clearDragSnapshotTree();
      for (const member of items) resetDropSnapshotDebugDump(member);
      session.status = "ended";
      root.dragSession = null;
      fireMutation(root, () => {
        root.callbacks?.onDragEnd?.({
          session,
          item,
          itemId: item.resolvedItemId,
          itemMetadata: item.metadata,
          items,
          itemIds: items.map((member) => member.resolvedItemId),
          itemsMetadata: items.map((member) => member.metadata),
          element: item.element,
          source: session.sources[0],
          sources: session.sources,
          destination,
        });
      });
    },
    { stage: "WRITE_1", queueId: `drag-end-${session.pressedItem.id}` },
  );

  root.schedule(
    () => {
      items.forEach((member, i) => {
        const currentItem = root.findItemByKey(dropKeys[i]) ?? member;
        const element = currentItem.element?.isConnected
          ? currentItem.element
          : null;
        dropRects[i].element = element;
        dropRects[i].last = element?.getBoundingClientRect() ?? null;
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
        member.playDropAnimation(
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
  readonly ghostKind = "flow" as const;

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
    const pressedIndex = session.items.indexOf(session.pressedItem);
    const pressedSource = session.activeSources[pressedIndex];
    await moveGhost(
      session,
      pressedSource.container,
      pressedSource.index,
      null,
    );

    const pressedItem = session.pressedItem;
    if (session.dragVisual === "item") {
      const axis = pressedSource.container.direction === "row" ? "x" : "y";
      let cumulative = 0;
      let pressedCumulative = 0;
      const cumulativeByItem = new Map<Item, number>();
      for (const member of session.items) {
        cumulativeByItem.set(member, cumulative);
        if (member === pressedItem) pressedCumulative = cumulative;
        const box = member.dragSnapshot?.box;
        cumulative += axis === "y" ? box?.height ?? 0 : box?.width ?? 0;
      }
      for (const member of session.items) {
        const delta = (cumulativeByItem.get(member) ?? 0) - pressedCumulative;
        session.groupVisualOffsets.set(
          member,
          axis === "y" ? { x: 0, y: delta } : { x: delta, y: 0 },
        );
      }
    }

    session.items.forEach((member, i) => {
      const sourceContainer = session.activeSources[i].container;
      member.detachItemFromContainer(sourceContainer, member);
      if (session.dragVisual !== "item") return;

      const snapshot = member.dragSnapshot;
      member.style = {
        cursor: "grabbing",
        position: "absolute",
        zIndex: "1000",
        top: "0px",
        left: "0px",
        width: snapshot ? `${snapshot.box.width}px` : "",
        height: snapshot ? `${snapshot.box.height}px` : "",
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

  currentGhostLocation(
    session: DragSession,
  ): { container: Container; index: number } | null {
    return currentGhostLocation(session);
  }

  translateTargetIndex(session: DragSession, target: DropCandidate): number {
    return liveIndexFromSnapshotIndex(
      session,
      target.container as unknown as Container,
      target.index,
    );
  }

  async moveGhost(
    session: DragSession,
    container: Container,
    index: number,
    ghostRect: GhostRect | null | undefined,
  ): Promise<void> {
    await moveGhost(session, container, index, ghostRect);
  }

  async removeGhost(
    session: DragSession,
    role: GhostRole = "target",
  ): Promise<void> {
    if (role === "pointer") {
      await removePointerPreview(session);
      return;
    }
    await removeGhost(session, role);
  }

  afterSyncDropTarget(session: DragSession): void {
    if (session.dragVisual !== "item") return;
    for (const member of session.items) member.refreshDraggedItemPosition();
  }

  drop(session: DragSession): void {
    session.scheduleDropFinalizer();
    drop(session);
  }
}
