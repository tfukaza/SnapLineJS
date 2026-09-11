import type { Rect } from "@snap-engine/core/geometry";
import type { AnimationConfig, Container } from "../container";
import type { Item } from "../item";
import type { ResolvedDropTarget } from "../algorithm";
import { buildDragLocation } from "../event-builders";
import type { DragLocation } from "../events";
import {
  assertCanFireItemSwap,
  fireItemSwap,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type {
  DragSessionController as DragSession,
  DropPlacement,
} from "./session";
import { reconcileRootTreeState } from "../internal/tree-state";
import { assertCanPlaceItems } from "../internal/tree-mutation";
import { readVisualRect } from "../internal/visual-rect";
import {
  captureDropOriginRects,
  restoreActiveItems,
  startDragVisual,
  stopDragVisual,
  updateDragVisual,
  validateDragVisual,
} from "./item-visual";
import {
  animationConfigFor,
  playDropAnimation,
} from "../internal/flip-animation";

/**
 * Swap mode has no target-spacer state: the current hover target is exposed
 * through `onDragItemEnter`/`Move`/`Leave`. Pointer representation is chosen
 * independently through `dragVisual`: the real Item can be hoisted with a
 * source spacer, the shared group preview can follow the pointer, or neither
 * can be rendered. A `"move"` drop swaps the primary Item with its target.
 */

function drop(session: DragSession): void {
  const item = session.primaryItem;
  const root = session.root;
  const draggedItemId = item.itemId;
  const draggedAnimation: {
    first: Rect | null;
    last: Rect | null;
    element: HTMLElement | null;
    config: AnimationConfig | null;
  } = { first: null, last: null, element: null, config: null };
  const displacedAnimation: {
    item: Item | null;
    itemId: string | null;
    first: Rect | null;
    last: Rect | null;
    element: HTMLElement | null;
    config: AnimationConfig | null;
  } = {
    item: null,
    itemId: null,
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
    if (session.cancelled) {
      return null;
    }

    if (session.input.inputType === "direct") {
      const candidate = session.input.currentCandidate;

      if (!candidate || candidate.kind !== "swap") {
        return null;
      }

      const targetItem = root.findItemById(candidate.targetItemId);

      if (!targetItem || targetItem.isDeleteRequested) {
        return null;
      }

      const location = targetItem.getIndexAndContainer();

      if (!location.container || location.container.rootContainer !== root) {
        return null;
      }

      return {
        container: location.container,
        index: location.index,
        item: targetItem,
      };
    }

    const pending = session.pendingPlacement;
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
      draggedAnimation.first = captureDropOriginRects(session)[0] ?? null;

      dropTarget = resolveDropTarget();
      if (!dropTarget || dropTarget.item.itemId === draggedItemId) {
        return;
      }
      displacedAnimation.item = dropTarget.item;
      displacedAnimation.itemId = dropTarget.item.itemId;
      displacedAnimation.first = readVisualRect(dropTarget.item);
    },
    { stage: "READ_1", queueId: `drag-end-swap-read-first-${item.id}` },
  );

  item.schedule(
    async () => {
      if (session.dragVisual === "item") {
        await stopDragVisual(session);
        restoreActiveItems(session);
      }
      if (session.dragVisual === "preview") await stopDragVisual(session);
      session.pendingPlacement = null;
      session.clearHoveredItem();
      session.clearDraggingFlags();

      const aLocation = item.getIndexAndContainer();
      const target = dropTarget ?? resolveDropTarget();
      const targetItem = target?.item ?? null;
      const targetLocation = targetItem?.getIndexAndContainer();
      const bContainer = targetLocation?.container ?? null;
      const bIndex = targetLocation?.index ?? -1;

      const source = session.sources[0] ?? null;

      let destination: DragLocation | null =
        session.cancelled || !source
          ? null
          : buildDragLocation(source.container, source.index);

      draggedAnimation.config = animationConfigFor(
        bContainer ?? aLocation.container,
        "drop",
      );

      if (bContainer && targetItem && targetItem.itemId !== draggedItemId) {
        destination = buildDragLocation(bContainer, bIndex);
      }

      if (
        aLocation.container &&
        bContainer &&
        targetItem &&
        targetItem.itemId !== draggedItemId &&
        session.dropEffect === "move"
      ) {
        const aContainer = aLocation.container;
        const aIndex = aLocation.index;
        displacedAnimation.config = animationConfigFor(aContainer, "reorder");
        if (displacedAnimation.itemId !== targetItem.itemId) {
          displacedAnimation.item = null;
          displacedAnimation.itemId = null;
          displacedAnimation.first = null;
        }

        assertCanPlaceItems([
          { container: bContainer, item },
          { container: aContainer, item: targetItem },
        ]);
        assertCanFireItemSwap(aContainer);

        const aChildrenBeforeSwap = [...aContainer.children];
        const aOrderBeforeSwap = [...aContainer.itemOrderedList];
        const bChildrenBeforeSwap =
          bContainer === aContainer
            ? aChildrenBeforeSwap
            : [...bContainer.children];
        const bOrderBeforeSwap =
          bContainer === aContainer
            ? aOrderBeforeSwap
            : [...bContainer.itemOrderedList];

        // Update bookkeeping directly as a genuine swap: both items simply
        // trade slots (reparenting is a no-op when they share a container),
        // independent of whatever event ends up firing below.
        bContainer.appendChild(item);
        aContainer.appendChild(targetItem);
        aContainer.itemOrderedList[aIndex] = targetItem;
        bContainer.itemOrderedList[bIndex] = item;

        let projected = false;
        try {
          fireItemSwap(
            { item, container: aContainer, index: aIndex },
            { item: targetItem, container: bContainer, index: bIndex },
            session,
          );
          projected = true;
        } finally {
          if (!projected) {
            aContainer.appendChild(item);
            bContainer.appendChild(targetItem);
            aContainer.children = aChildrenBeforeSwap;
            aContainer.itemOrderedList.splice(
              0,
              aContainer.itemOrderedList.length,
              ...aOrderBeforeSwap,
            );
            if (bContainer !== aContainer) {
              bContainer.children = bChildrenBeforeSwap;
              bContainer.itemOrderedList.splice(
                0,
                bContainer.itemOrderedList.length,
                ...bOrderBeforeSwap,
              );
            }
            reconcileRootTreeState(root);
            session.scheduleErrorFinalizer();
          }
        }
        reconcileRootTreeState(root);
        await settleMutation();
      }

      session.complete(destination);
    },
    { stage: "WRITE_1", queueId: `drag-end-swap-${item.id}` },
  );

  root.schedule(
    () => {
      const currentDraggedItem = root.findItemById(draggedItemId) ?? item;
      draggedAnimation.element = currentDraggedItem.element?.isConnected
        ? currentDraggedItem.element
        : null;
      draggedAnimation.last = readVisualRect(currentDraggedItem);

      if (!displacedAnimation.item || !displacedAnimation.itemId) return;
      const currentDisplacedItem =
        root.findItemById(displacedAnimation.itemId) ?? displacedAnimation.item;
      displacedAnimation.element = currentDisplacedItem.element?.isConnected
        ? currentDisplacedItem.element
        : null;
      displacedAnimation.last = readVisualRect(currentDisplacedItem);
    },
    { stage: "READ_2", queueId: `drag-end-swap-read-last-${item.id}` },
  );

  root.schedule(
    () => {
      playDropAnimation(
        item,
        draggedAnimation.first,
        draggedAnimation.last,
        draggedAnimation.element,
        draggedAnimation.config,
        root,
      );
      if (displacedAnimation.item) {
        playDropAnimation(
          displacedAnimation.item,
          displacedAnimation.first,
          displacedAnimation.last,
          displacedAnimation.element,
          displacedAnimation.config,
          root,
        );
      }
    },
    { stage: "WRITE_2", queueId: `drag-end-swap-play-${item.id}` },
  );
}

export class SwapLifecycle implements DragLifecycleStrategy {
  readonly placementOccupiesFlowSlots = false;

  validateStart(session: DragSession): void {
    if (session.dropEffect === "move") {
      assertCanFireItemSwap(session.activeSources[0].container);
    }
    validateDragVisual(session);
  }

  async dragStart(session: DragSession): Promise<void> {
    await startDragVisual(session);

    if (session.dragVisual === "preview") {
      updateDragVisual(session);
    }

    await session.initializeTarget();
  }

  dragMove(session: DragSession): void {
    updateDragVisual(session);
  }

  currentPlacement(
    session: DragSession,
  ): { container: Container; index: number } | null {
    const pending = session.pendingPlacement;
    if (!pending) return null;
    return { container: pending.container, index: pending.index };
  }

  placementIndexFor(_session: DragSession, target: ResolvedDropTarget): number {
    return target.index;
  }

  syncPlacement(session: DragSession, placement: DropPlacement): void {
    session.pendingPlacement = placement;
  }

  clearPlacement(session: DragSession): void {
    session.pendingPlacement = null;
  }

  afterPlacementSync(_session: DragSession): void {
    // The pointer ghost tracks the raw pointer directly; it needs no
    // resync when the resolved target changes.
  }

  drop(session: DragSession): void {
    session.scheduleDropFinalizer();
    drop(session);
  }
}
