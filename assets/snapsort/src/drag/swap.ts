import type { AnimationConfig, Container } from "../container";
import type { Item } from "../item";
import type { DropCandidate } from "../algorithm";
import { buildDragEndEvent, buildDragLocation } from "../event-builders";
import type { DragLocation, GhostRect, GhostRole } from "../events";
import {
  assertCanFireItemSwap,
  fireItemSwap,
  fireOptionalMutation,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type { DragSession } from "./session";
import { reconcileTreeState } from "../tree-state";
import {
  restoreActiveItems,
  startItemVisual,
  stopItemVisual,
  updateItemVisual,
  validateItemVisual,
} from "./item-visual";
import {
  pointerPreviewMemberRects,
  removePointerPreview,
  startPointerPreview,
  updatePointerPreview,
  validatePointerPreview,
} from "./pointer-preview";

/**
 * Swap mode has no target-role ghost: the current hover target is exposed
 * through `onDragItemEnter`/`Move`/`Leave`. Pointer representation is chosen
 * independently through `dragVisual`: the real Item can be hoisted with a
 * source spacer, the shared group preview can follow the pointer, or neither
 * can be rendered. A `"move"` drop swaps the primary Item with its target.
 */

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
  if (role === "pointer") await removePointerPreview(session);
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
      draggedAnimation.first =
        session.dragVisual === "preview"
          ? pointerPreviewMemberRects(session)[0]
          : session.dragVisual === "item"
            ? item.element?.getBoundingClientRect() ?? null
            : null;

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
      if (session.dragVisual === "item") {
        await stopItemVisual(session);
        restoreActiveItems(session);
      }
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
      const targetItem = target?.item ?? null;
      const targetLocation = targetItem?.getIndexAndContainer();
      const bContainer = targetLocation?.container ?? null;
      const bIndex = targetLocation?.index ?? -1;

      let destination: DragLocation | null = null;
      draggedAnimation.config = item.dropAnimationConfig(
        bContainer ?? aLocation.container,
      );

      if (bContainer && targetItem && targetItem !== item) {
        destination = buildDragLocation(bContainer, bIndex);
      }

      if (
        aLocation.container &&
        bContainer &&
        targetItem &&
        targetItem !== item &&
        session.dropEffect === "move"
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

        assertCanFireItemSwap(aContainer);

        // Update bookkeeping directly as a genuine swap: both items simply
        // trade slots (reparenting is a no-op when they share a container),
        // independent of whatever event ends up firing below.
        (bContainer as unknown as Item).appendChild(item);
        (aContainer as unknown as Item).appendChild(targetItem);
        aContainer.itemOrderedList[aIndex] = targetItem;
        bContainer.itemOrderedList[bIndex] = item;

        try {
          fireItemSwap(
            { item, container: aContainer, index: aIndex },
            { item: targetItem, container: bContainer, index: bIndex },
            session,
          );
        } finally {
          root[reconcileTreeState]();
        }
        await settleMutation();
      }

      root.clearDragSnapshotTree();
      session.dragCoordinateParent.clear();
      session.dragLayoutPosition.clear();
      session.dragVisualStart.clear();
      session.groupVisualOffsets.clear();
      session.status = "ended";
      root.dragSession = null;
      fireOptionalMutation(
        root,
        root.callbacks?.onDragEnd,
        buildDragEndEvent(session, destination),
      );
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
    if (session.dropEffect === "move") {
      assertCanFireItemSwap(session.activeSources[0].container);
    }
    if (session.dragVisual === "preview") validatePointerPreview(session);
    if (session.dragVisual === "item") validateItemVisual(session);
  }

  async dragStart(session: DragSession): Promise<void> {
    if (session.dropEffect === "move") {
      assertCanFireItemSwap(session.activeSources[0].container);
    }
    if (session.dragVisual === "item") {
      await startItemVisual(session);
    } else if (session.dragVisual === "preview") {
      await startPointerPreview(session);
      updatePointerPreview(session);
    }
    await session.updateDropTarget();
  }

  dragMove(session: DragSession): void {
    if (session.dragVisual === "item") {
      updateItemVisual(session);
    } else if (session.dragVisual === "preview") {
      updatePointerPreview(session);
    }
  }

  currentGhostLocation(
    session: DragSession,
  ): { container: Container; index: number } | null {
    const pending = session.pendingGhostTarget;
    if (!pending) return null;
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
    const pointerGhost = session.ghosts.get("pointer") ?? session.primaryItem;
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
    if (role === "source") {
      await stopItemVisual(session);
      return;
    }
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
