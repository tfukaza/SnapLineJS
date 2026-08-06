import type { AnimationConfig } from "../container";
import type { Container } from "../container";
import { Item } from "../item";
import { resetDropSnapshotDebugDump, type DropCandidate } from "../algorithm";
import type {
  DragCloneEvent,
  DragLocation,
  GhostRect,
  GhostRole,
} from "../events";
import { virtualEntrySizeFor } from "../layout";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  assertCanFireItemMove,
  assertCanFireItemRemove,
  fireItemRemove,
  fireMutation,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type { DragSession } from "./session";

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

/** Find the SnapSort container whose element is `el`, via the global registry. */
function containerForElement(
  session: DragSession,
  el: HTMLElement | null,
): Container | null {
  if (!el) return null;
  const registry = (session.root.global.data["dragAndDropContainers"] ??
    []) as Container[];
  return registry.find((c) => c.element === el) ?? null;
}

/**
 * `dropEffect = "copy"` at drag start: create one clone item per dragged
 * member and hand the drag off to them (see `DragSession.handoff`). The
 * consumer materializes each clone in their own state and renders it inside a
 * drop container (binding its element via `itemObject`); the original items
 * are never touched, so they produce no ghosts. Returns false (vetoing the
 * drag) if the consumer binds no element to a clone.
 */
async function startCopyHandoff(session: DragSession): Promise<boolean> {
  const root = session.root;
  const origins = session.items;
  const cloneItems = origins.map(() => {
    const clone = new Item(root.engine, null);
    // A clone is created with no parent, so its rootContainer defaults to
    // itself; point it at the real root so drag/dragEnd dispatch (via
    // `rootContainer.dragSession`) and pointer-follow both resolve this drag.
    clone.rootContainer = root;
    return clone;
  });

  const event: DragCloneEvent = {
    session,
    item: origins[0],
    itemId: origins[0].resolvedItemId,
    itemMetadata: origins[0].metadata,
    items: origins,
    itemIds: origins.map((o) => o.resolvedItemId),
    itemsMetadata: origins.map((o) => o.metadata),
    sources: session.sources,
    cloneItems,
  };
  fireMutation(root, () => root.callbacks?.onDragClone?.(event));
  await settleMutation();

  const cloneBindings = cloneItems.map((clone) => ({
    clone,
    container: containerForElement(
      session,
      clone.element?.parentElement ?? null,
    ),
  }));

  // Every clone must be rendered directly inside a registered drop
  // container. Otherwise core cannot route either commit or cancellation
  // back through the framework's state model.
  if (
    cloneBindings.some(
      ({ clone, container }) => !clone.element || container === null,
    )
  ) {
    // A framework may have rendered only part of the requested run before a
    // bad binding vetoes the handoff. Retire any rendered clone through its
    // owning container's state callback, then destroy core objects without
    // touching DOM. Directly removing those nodes would put framework state
    // and the rendered tree out of sync.
    const renderedClones = cloneBindings
      .filter(
        (entry): entry is { clone: Item; container: Container } =>
          entry.container !== null,
      );
    try {
      for (const { container } of renderedClones) {
        assertCanFireItemRemove(container);
      }
      for (const { clone, container } of renderedClones) {
        fireItemRemove(container, [clone], session);
      }
      await settleMutation();
    } finally {
      for (const clone of cloneItems) clone.destroy(false);
    }
    return false;
  }

  const boundClones = cloneBindings as Array<{
    clone: Item;
    container: Container;
  }>;
  try {
    // Copy can be released before its first target-ghost update, so validate
    // both possible terminal mutations at handoff time. A framework-owned
    // transient clone must always be removable from state on cancel and
    // movable into state on commit.
    for (const { container } of boundClones) {
      assertCanFireItemRemove(container);
      assertCanFireItemMove(container);
    }
  } catch (error) {
    // Retire core objects without deleting framework DOM. Containers that do
    // provide a removal callback still get a chance to discard clone state;
    // the original configuration error remains the one reported to users.
    for (const { clone, container } of boundClones) {
      if (container.callbacks?.onItemRemove) {
        fireItemRemove(container, [clone], session);
      }
    }
    await settleMutation();
    for (const clone of cloneItems) clone.destroy(false);
    throw error;
  }

  try {
    session.handoff(cloneItems);
  } catch (error) {
    // Native capture can reject a destination that disappeared between the
    // framework flush and the handoff. Retire those transient clones through
    // framework state before propagating the input failure.
    for (const { clone, container } of boundClones) {
      fireItemRemove(container, [clone], session);
    }
    await settleMutation();
    for (const clone of cloneItems) clone.destroy(false);
    throw error;
  }
  return true;
}

function drop(session: DragSession): void {
  const items = session.items;
  const root = session.root;
  const dropKeys = items.map((member) => member.itemKey(member));
  const dropRects: Array<{
    first: DOMRect | null;
    last: DOMRect | null;
    element: HTMLElement | null;
  }> = items.map(() => ({ first: null, last: null, element: null }));
  let dropAnimationConfig: AnimationConfig | null = null;
  let retireCopyMembers = false;

  session.pressedItem.schedule(
    () => {
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
      // Get the ghost run head's current position — where the run should land.
      const ghostItem = session.flowGhostRun[0] ?? null;
      const pendingGhostTarget =
        session.pendingGhostTarget?.ghostItem === ghostItem
          ? session.pendingGhostTarget
          : null;
      const liveGhostPos = ghostItem?.getIndexAndContainer();
      const usePendingGhostTarget =
        !!pendingGhostTarget &&
        (!liveGhostPos?.container ||
          liveGhostPos.container !== pendingGhostTarget.container ||
          liveGhostPos.index !== pendingGhostTarget.index);
      let ghostPos = usePendingGhostTarget
        ? {
            index: pendingGhostTarget!.index,
            container: pendingGhostTarget!.container,
          }
        : (liveGhostPos as
            | { index: number; container: Container | null }
            | undefined);
      const isCopy = session.dropEffect === "copy";
      // Capture each clone's rendering container before the coordinate-parent
      // map is cleared below — needed if this copy drag cancels (no
      // destination), since a cancelled clone was never a real list member
      // and must be removed from wherever the consumer rendered it.
      const cloneContainers = new Map(session.dragCoordinateParent);
      if (session.cancelled) {
        ghostPos = undefined;
      } else if (!ghostPos?.container) {
        const finalTarget =
          root.hasDragSnapshotTree() && item.dragSnapshot
            ? session.strategy.dropTarget.resolve(item, root, session)
            : null;
        // The source-slot fallback only applies to move/none (the originals
        // belong there). A copy clone has no source slot — if it never
        // resolved a real drop target, the drop is cancelled (destination
        // null) and the consumer discards the clone in `onDragEnd`.
        ghostPos = finalTarget
          ? {
              index: liveIndexFromSnapshotIndex(
                session,
                finalTarget.container as unknown as Container,
                finalTarget.index,
              ),
              container: finalTarget.container as unknown as Container,
            }
          : !isCopy && session.sources[0]
            ? {
                index: session.sources[0].index,
                container: session.sources[0].container,
              }
            : undefined;
      }

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
      session.dragCoordinateParent.clear();
      session.dragLayoutPosition.clear();
      session.groupVisualOffsets.clear();

      // Remove the target ghost run first.
      await removeGhost(session, "target");

      const destination: DragLocation | null = ghostPos?.container
        ? {
            container: ghostPos.container,
            containerMetadata: ghostPos.container.metadata,
            index: ghostPos.index,
          }
        : null;

      if (session.dropEffect === "none") {
        // No mutation events: each item was only *logically* detached — its
        // DOM element never left its source container — so returning it is
        // pure bookkeeping. Return in ascending original index (per source
        // container) so relative order within any shared source is preserved.
        const bySourceContainer = new Map<Container, number[]>();
        items.forEach((_, i) => {
          const list =
            bySourceContainer.get(session.sources[i].container) ?? [];
          list.push(i);
          bySourceContainer.set(session.sources[i].container, list);
        });
        for (const [sourceContainer, indices] of bySourceContainer) {
          indices
            .slice()
            .sort((a, b) => session.sources[a].index - session.sources[b].index)
            .forEach((i) => {
              const member = items[i];
              if (member.parent) return;
              const returnIndex = Math.min(
                session.sources[i].index,
                sourceContainer.itemOrderedList.length,
              );
              member.attachItemToContainer(
                sourceContainer,
                member,
                returnIndex,
              );
            });
        }
        dropAnimationConfig = item.dropAnimationConfig(
          session.sources[0].container,
        );
      } else if (destination) {
        // "move" and "copy" share this path from here on: one batch
        // `onItemMove` commit into the destination. For "move" the originals
        // were already logically detached at dragStart, so this is their
        // first (re-)attachment since; for "copy" the clones were never in
        // any container's list, so this is their *first* attachment ever —
        // `from`/`froms` report null and `origins` carries the item each
        // clone stands in for (see ItemMoveEvent), so the consumer's
        // onItemMove handler can tell "this itemId is new to me, add it"
        // apart from "this itemId already exists, reorder it" — exactly the
        // same distinction a cross-container move already requires.
        const destinationContainer = destination.container;
        dropAnimationConfig = item.dropAnimationConfig(destinationContainer);
        const froms = isCopy ? items.map(() => null) : session.sources;
        const origins = isCopy
          ? session.handoffOrigins ?? items.map(() => null)
          : items.map(() => null);
        item.moveItemsAt(
          froms,
          destinationContainer,
          items,
          destination.index,
          session,
          origins,
        );
        await settleMutation();
        retireCopyMembers = isCopy;
        // Skip for copy: the dragged clone's element is *expected* to go
        // stale here, once the consumer's state-driven re-render replaces it
        // with a fresh, permanent Item instance sharing the same itemId (see
        // ItemMoveEvent doc) — checking headItem.element would false-positive
        // on exactly the success case, not just adapter wiring bugs.
        if (!isCopy) {
          const headItem = items[0];
          if (headItem.element && destinationContainer.element) {
            const runEndIndex = destination.index + items.length;
            const expectedBefore =
              runEndIndex >= destinationContainer.itemOrderedList.length
                ? null
                : destinationContainer.itemOrderedList[runEndIndex].element;
            const runTailElement = items[items.length - 1].element;
            if (
              headItem.element.parentElement !== destinationContainer.element ||
              runTailElement?.nextElementSibling !== expectedBefore
            ) {
              console.warn(
                "SnapSort: the adapter did not place the dropped item(s) where onItemMove/onItemInsert specified. Check the adapter's callback/flushMutation wiring.",
                {
                  items,
                  container: destinationContainer,
                  index: destination.index,
                },
              );
            }
          }
        }
      } else if (isCopy) {
        // Copy with no destination (dropped outside any drop container): a
        // clone was never a real list member, so there is nothing to return
        // home to — remove it from wherever the consumer rendered it and let
        // them delete it from state.
        for (const clone of items) {
          const cloneContainer = cloneContainers.get(clone) as
            | Container
            | undefined;
          if (cloneContainer) {
            fireItemRemove(cloneContainer, [clone], session);
          }
        }
        await settleMutation();
        for (const clone of items) {
          clone.destroy(false);
        }
      }

      session.clearHoveredItem();
      root.clearDragSnapshotTree();
      for (const member of items) {
        resetDropSnapshotDebugDump(member);
      }
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
        if (!element) return;
        if (currentItem === member) {
          currentItem.readDom({ unapplyTransform: false }, "READ_2");
        }
        dropRects[i].last = element.getBoundingClientRect();
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
      if (retireCopyMembers) {
        // The framework has replaced each transient clone with a permanent
        // item carrying the same itemId. Keep that framework-owned DOM in
        // place and retire only the handoff objects after their drop FLIP has
        // been started (the animation itself is owned by the root).
        for (const member of items) member.destroy(false);
      }
    },
    { stage: "WRITE_2", queueId: `drag-end-play-${session.pressedItem.id}` },
  );
}

export class FlowGhostLifecycle implements DragLifecycleStrategy {
  readonly ghostKind = "flow" as const;

  validateStart(session: DragSession): void {
    if (session.dropEffect === "copy") return;
    const pressedIndex = session.items.indexOf(session.pressedItem);
    const source = session.sources[pressedIndex] ?? session.sources[0];
    if (session.dropEffect !== "none") {
      assertCanFireItemMove(source.container);
    }
    assertCanFireGhostInsert(source.container);
    assertCanFireGhostRemove(source.container);
  }

  async dragStart(session: DragSession): Promise<void> {
    const isCopy = session.dropEffect === "copy";

    if (isCopy) {
      // Hand the drag off to freshly-created clone items; the originals stay
      // put and produce no ghosts. A vetoed handoff (consumer bound no clone
      // element) ends the drag cleanly.
      const ok = await startCopyHandoff(session);
      if (!ok) {
        session.status = "ended";
        session.root.dragSession = null;
        return;
      }
      // No initial ghost: the target ghost run is created on the first
      // dragMove when the pointer resolves to a valid drop container (which is
      // never the noDrop source), so nothing appears in the source list.
    } else {
      const pressedIndex = session.items.indexOf(session.pressedItem);
      const pressedSource = session.sources[pressedIndex];
      // Create a ghost run at the pressed item's current location.
      await moveGhost(
        session,
        pressedSource.container,
        pressedSource.index,
        null,
      );
    }

    const pressedItem = session.pressedItem;
    const coordinateContainer = (member: Item, sourceContainer: Container) =>
      isCopy
        ? containerForElement(session, member.element?.parentElement ?? null) ??
          sourceContainer
        : sourceContainer;
    const axisContainer = isCopy
      ? session.root
      : session.sources[session.items.indexOf(pressedItem)].container;

    // Compute each member's offset (relative to the pressed item) along the
    // group's main axis, in run order — an approximation of the collapsed run
    // using each member's own snapshot size; the destination's real gaps are
    // corrected by FLIP once the drop lands (see DragSession.groupDims doc).
    const axis = axisContainer.direction === "row" ? "x" : "y";
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

    // Hoist each dragged item: for a move/none drag this _logically_ removes
    // the original from its container (the DOM element stays put, the ghost
    // takes its layout slot); for a copy drag the members are clones that were
    // never in a container's item list, so there is nothing to detach.
    session.items.forEach((member, i) => {
      const sourceContainer = session.sources[i].container;
      if (!isCopy) {
        member.detachItemFromContainer(sourceContainer, member);
      }

      const dragSnapshot = member.dragSnapshot;
      member.style = {
        cursor: "grabbing",
        position: "absolute",
        zIndex: "1000",
        top: "0px",
        left: "0px",
        width: dragSnapshot ? `${dragSnapshot.box.width}px` : "",
        height: dragSnapshot ? `${dragSnapshot.box.height}px` : "",
      };

      // The dragged element's coordinate parent is the container its element
      // currently lives under (its original container for move/none; for a
      // copy clone, the drop container the consumer rendered it into).
      session.dragCoordinateParent.set(
        member,
        coordinateContainer(member, sourceContainer),
      );

      member.refreshDraggedItemPosition();
    });
    pressedItem.debugAllItems();
  }

  async dragMove(session: DragSession): Promise<void> {
    for (const member of session.items) {
      member.writeDraggedTransform();
    }
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
    await removeGhost(session, role);
  }

  afterSyncDropTarget(session: DragSession): void {
    for (const member of session.items) {
      member.refreshDraggedItemPosition();
    }
  }

  drop(session: DragSession): void {
    session.scheduleDropFinalizer();
    drop(session);
  }
}
