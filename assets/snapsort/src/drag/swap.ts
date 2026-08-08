import type { AnimationConfig, Container } from "../container";
import type { Item } from "../item";
import { resetDropSnapshotDebugDump, type DropCandidate } from "../algorithm";
import type { DragLocation, GhostRect, GhostRole } from "../events";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  assertCanFireItemSwap,
  fireGhostInsert,
  fireGhostRemove,
  fireItemSwap,
  fireMutation,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type { DragSession } from "./session";

/**
 * Swap mode: the original item never moves during the drag (like the
 * insertion marker, it's never detached); a `"pointer"`-role ghost follows
 * the pointer as a purely visual preview. There is no target-role ghost —
 * which item the pointer is over is reported via `onDragItemEnter`/`Move`/
 * `Leave` (see session.ts's generic hover tracking), and it's the consumer's
 * job to render any target highlight. Dropping swaps the dragged item with
 * whichever item the pointer was last over.
 */

async function createPointerGhost(session: DragSession): Promise<void> {
  if (session.ghosts.has("pointer")) return;
  const item = session.primaryItem;
  const root = session.root;
  if (!root.element) return;
  assertCanFireGhostInsert(root);
  assertCanFireGhostRemove(root);

  const box = item.dragSnapshot?.box ?? null;
  const ghostRect: GhostRect | null = box
    ? { x: box.x, y: box.y, width: box.width, height: box.height }
    : null;

  const ghostItem = item.createGhostItem(
    session,
    "marker",
    root,
    ghostRect,
    "pointer",
  );
  if (!ghostItem) return;
  session.ghosts.set("pointer", ghostItem);

  // The pointer ghost isn't part of any container's item list — like the
  // insertion marker, it's a purely visual, absolutely-positioned element.
  // `index: -1` signals "not applicable" (there is no list position).
  fireGhostInsert(
    root,
    item,
    ghostItem,
    -1,
    null,
    ghostRect,
    session,
    "marker",
    "pointer",
  );
  await settleMutation();
}

function writePointerGhostPosition(session: DragSession): void {
  const ghostItem = session.ghosts.get("pointer");
  const ghostElement = ghostItem?.element;
  if (!ghostElement) return;

  const root = session.root;
  const rootProp = root.dragSnapshot?.box ?? root.currentDomProperty;
  const box = session.primaryItem.dragSnapshot?.box;
  const width = box?.width ?? 0;
  const height = box?.height ?? 0;
  const worldLeft = session.pointer.x - width / 2;
  const worldTop = session.pointer.y - height / 2;

  if (ghostItem.frameworkManagedGhostElement) {
    // Move framework ghosts by updating adapter state, not by styling the
    // node behind the framework's back. Reusing onGhostInsert as an upsert
    // replaces the existing keyed ghost event synchronously.
    fireGhostInsert(
      root,
      session.primaryItem,
      ghostItem,
      -1,
      null,
      { x: worldLeft, y: worldTop, width, height },
      session,
      "marker",
      "pointer",
    );
    return;
  }

  const left = worldLeft - rootProp.x;
  const top = worldTop - rootProp.y;

  ghostElement.dataset.snapsortGhost = "pointer";
  ghostElement.style.position = "absolute";
  ghostElement.style.left = `${left}px`;
  ghostElement.style.top = `${top}px`;
  ghostElement.style.width = `${width}px`;
  ghostElement.style.height = `${height}px`;
  ghostElement.style.pointerEvents = "none";
  ghostElement.style.zIndex = "1000";
}

async function removeGhost(
  session: DragSession,
  role: GhostRole = "target",
): Promise<void> {
  if (role === "target") {
    // Swap mode has no target-role ghost — hover feedback is entirely the
    // consumer's job via onDragItemEnter/Move/Leave.
    session.pendingGhostTarget = null;
    return;
  }
  const item = session.primaryItem;
  const ghostItem = session.ghosts.get(role);
  if (!ghostItem) return;

  // Pointer ghosts are visual overlays rather than list members, so route
  // removal through the same root container that received onGhostInsert.
  fireGhostRemove(session.root, item, ghostItem, session, "marker", role);
  await settleMutation();
  ghostItem.destroy(!ghostItem.frameworkManagedGhostElement);
  session.ghosts.delete(role);
}

function drop(session: DragSession): void {
  const item = session.primaryItem;
  const root = session.root;
  const draggedKey = root.itemKey(item);
  const draggedAnimation: {
    first: DOMRect | null;
    last: DOMRect | null;
    element: HTMLElement | null;
    config: AnimationConfig | null;
  } = { first: null, last: null, element: null, config: null };
  const displacedAnimation: {
    item: Item | null;
    key: string | null;
    first: DOMRect | null;
    last: DOMRect | null;
    element: HTMLElement | null;
    config: AnimationConfig | null;
  } = {
    item: null,
    key: null,
    first: null,
    last: null,
    element: null,
    config: null,
  };
  let dropTarget: {
    container: Container;
    index: number;
    item: Item;
  } | null = null;

  const resolveDropTarget = () => {
    const pending = session.pendingGhostTarget;
    const container = pending?.container ?? null;
    const index = pending?.index ?? -1;
    const targetItem =
      container && index >= 0 && index < container.itemOrderedList.length
        ? container.itemOrderedList[index]
        : null;
    return container && targetItem
      ? { container, index, item: targetItem }
      : null;
  };

  item.schedule(
    () => {
      const pointerGhost = session.ghosts.get("pointer")?.element ?? null;
      draggedAnimation.first =
        pointerGhost?.getBoundingClientRect() ??
        item.element?.getBoundingClientRect() ??
        null;

      dropTarget = resolveDropTarget();
      if (!dropTarget || dropTarget.item === item) return;
      displacedAnimation.item = dropTarget.item;
      displacedAnimation.key = root.itemKey(dropTarget.item);
      displacedAnimation.first =
        dropTarget.item.element?.getBoundingClientRect() ?? null;
    },
    { stage: "READ_1", queueId: `drag-end-swap-read-first-${item.id}` },
  );

  item.schedule(
    async () => {
      await removeGhost(session, "pointer");
      session.pendingGhostTarget = null;
      session.clearHoveredItem();
      for (const member of session.items) {
        if (member.element) {
          delete member.element.dataset.snapsortDragging;
        }
      }

      const aLocation = item.getIndexAndContainer();
      const target = dropTarget ?? resolveDropTarget();
      const bContainer = target?.container ?? null;
      const bIndex = target?.index ?? -1;
      const targetItem = target?.item ?? null;

      let destination: DragLocation | null = null;
      draggedAnimation.config = item.dropAnimationConfig(
        bContainer ?? aLocation.container,
      );

      if (
        aLocation.container &&
        bContainer &&
        targetItem &&
        targetItem !== item
      ) {
        const aContainer = aLocation.container;
        const aIndex = aLocation.index;
        displacedAnimation.config =
          targetItem.reorderAnimationConfig(aContainer);
        if (displacedAnimation.key !== root.itemKey(targetItem)) {
          displacedAnimation.item = null;
          displacedAnimation.key = null;
          displacedAnimation.first = null;
        }

        destination = {
          container: bContainer,
          containerMetadata: bContainer.metadata,
          index: bIndex,
        };

        assertCanFireItemSwap(aContainer);

        // Update bookkeeping directly as a genuine swap: both items simply
        // trade slots (reparenting is a no-op when they share a container),
        // independent of whatever event ends up firing below.
        (bContainer as unknown as Item).appendChild(item);
        (aContainer as unknown as Item).appendChild(targetItem);
        aContainer.itemOrderedList[aIndex] = targetItem;
        bContainer.itemOrderedList[bIndex] = item;

        fireItemSwap(
          { item, container: aContainer, index: aIndex },
          { item: targetItem, container: bContainer, index: bIndex },
          session,
        );
        await settleMutation();
      }

      root.clearDragSnapshotTree();
      resetDropSnapshotDebugDump(item);
      session.status = "ended";
      root.dragSession = null;
      fireMutation(root, () => {
        root.callbacks?.onDragEnd?.({
          session,
          item,
          itemId: item.resolvedItemId,
          itemMetadata: item.metadata,
          items: session.items,
          itemIds: session.items.map((member) => member.resolvedItemId),
          itemsMetadata: session.items.map((member) => member.metadata),
          element: item.element,
          source: session.sources[0],
          sources: session.sources,
          destination,
        });
      });
    },
    { stage: "WRITE_1", queueId: `drag-end-swap-${item.id}` },
  );

  root.schedule(
    () => {
      const currentDraggedItem = root.findItemByKey(draggedKey) ?? item;
      draggedAnimation.element = currentDraggedItem.element?.isConnected
        ? currentDraggedItem.element
        : null;
      draggedAnimation.last =
        draggedAnimation.element?.getBoundingClientRect() ?? null;

      if (!displacedAnimation.item || !displacedAnimation.key) return;
      const currentDisplacedItem =
        root.findItemByKey(displacedAnimation.key) ?? displacedAnimation.item;
      displacedAnimation.element = currentDisplacedItem.element?.isConnected
        ? currentDisplacedItem.element
        : null;
      displacedAnimation.last =
        displacedAnimation.element?.getBoundingClientRect() ?? null;
    },
    { stage: "READ_2", queueId: `drag-end-swap-read-last-${item.id}` },
  );

  root.schedule(
    () => {
      item.playDropAnimation(
        draggedAnimation.first,
        draggedAnimation.last,
        draggedAnimation.element,
        draggedAnimation.config,
        root,
      );
      displacedAnimation.item?.playDropAnimation(
        displacedAnimation.first,
        displacedAnimation.last,
        displacedAnimation.element,
        displacedAnimation.config,
        root,
      );
    },
    { stage: "WRITE_2", queueId: `drag-end-swap-play-${item.id}` },
  );
}

export class SwapLifecycle implements DragLifecycleStrategy {
  readonly ghostKind = "marker" as const;

  validateStart(session: DragSession): void {
    assertCanFireItemSwap(session.sources[0].container);
    assertCanFireGhostInsert(session.root);
    assertCanFireGhostRemove(session.root);
  }

  async dragStart(session: DragSession): Promise<void> {
    assertCanFireItemSwap(session.sources[0].container);
    await createPointerGhost(session);
    writePointerGhostPosition(session);
    await session.updateDropTarget();
  }

  dragMove(session: DragSession): void {
    writePointerGhostPosition(session);
  }

  currentGhostLocation(
    session: DragSession,
  ): { container: Container; index: number } | null {
    const pending = session.pendingGhostTarget;
    const pointerGhost = session.ghosts.get("pointer");
    if (!pending || !pointerGhost || pending.ghostItem !== pointerGhost) {
      return null;
    }
    return { container: pending.container, index: pending.index };
  }

  translateTargetIndex(_session: DragSession, target: DropCandidate): number {
    return target.index;
  }

  moveGhost(
    session: DragSession,
    container: Container,
    index: number,
    ghostRect: GhostRect | null | undefined,
  ): void {
    const pointerGhost = session.ghosts.get("pointer");
    if (!pointerGhost) return;
    session.pendingGhostTarget = {
      ghostItem: pointerGhost,
      container,
      index,
      ghostRect,
    };
  }

  async removeGhost(
    session: DragSession,
    role: GhostRole = "target",
  ): Promise<void> {
    await removeGhost(session, role);
  }

  afterSyncDropTarget(_session: DragSession): void {
    // The pointer ghost tracks the raw pointer directly; it needs no
    // resync when the resolved target changes.
  }

  drop(session: DragSession): void {
    session.scheduleDropFinalizer();
    drop(session);
  }

  cancel(session: DragSession): void {
    // A swap has no detached source item to restore. Clearing the pending
    // target makes the ordinary drop path remove its pointer ghost and end
    // lifecycle state without exchanging either item.
    session.pendingGhostTarget = null;
    this.drop(session);
  }
}
