import type { AnimationConfig, Container } from "../container";
import type { ResolvedDropTarget } from "../algorithm";
import {
  buildDragLocation,
  buildGhostSlotLocation,
  updateGhostState,
} from "../event-builders";
import type { DragLocation } from "../events";
import type { GhostStatePlacement } from "../events";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostMove,
  assertCanFireGhostRemove,
  assertCanFireItemMove,
  fireGhostInsert,
  fireGhostMove,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type {
  DragSessionController as DragSession,
  DropPlacement,
} from "./session";
import {
  consumeStagedVisualRect,
  readVisualRect,
} from "../internal/visual-rect";
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
  playElementRectAnimation,
} from "../internal/flip-animation";

/**
 * Floating insertion marker: insertion mode. Unlike the flow ghost, the
 * marker is never attached to a container's item-ordered list — its logical
 * position lives solely in `DragSession.pendingPlacement`, and its DOM
 * element is rendered from the algorithm's canonical gap segment.
 * Pointer representation is independent: `dragVisual` can hoist the real
 * Item, render the shared group preview, or show no pointer-following visual.
 */

async function syncInsertionPlacement(
  session: DragSession,
  placement: DropPlacement,
): Promise<void> {
  const { container, index, insertion } = placement;
  const item = session.primaryItem;
  let ghostItem = session.ghostsByChannel.get("target") ?? null;
  if (!insertion) {
    throw new Error("SnapSort: insertion placement requires gap geometry.");
  }
  if (!container.element) {
    throw new Error(
      `SnapSort: destination "${container.name}" must be mounted before placing an insertion marker.`,
    );
  }
  if (session.dropEffect !== "none") {
    assertCanFireItemMove(container);
  }
  assertCanFireGhostInsert(container);
  assertCanFireGhostMove(container);
  assertCanFireGhostRemove(container);

  const firstRect = ghostItem ? consumeStagedVisualRect(ghostItem) : null;
  const markerPlacement = {
    type: "insertion-marker",
    location: buildGhostSlotLocation(container, index),
    ...insertion,
  } satisfies Extract<GhostStatePlacement, { type: "insertion-marker" }>;

  if (!ghostItem) {
    ghostItem = item.createGhostItem(session, markerPlacement);
    session.ghostsByChannel.set("target", ghostItem);
    session.pendingPlacement = placement;
    // The marker is intentionally never attached to the container's item
    // list (see module doc); it always appends from the DOM's perspective.
    fireGhostInsert(ghostItem, null);
  } else {
    const previousState = ghostItem.ghostState;
    if (!previousState || previousState.type !== "insertion-marker") {
      throw new Error(
        "SnapSort: the insertion ghost must retain insertion-marker state.",
      );
    }
    const state = updateGhostState(previousState, markerPlacement);
    ghostItem.ghostState = state;
    session.pendingPlacement = placement;
    fireGhostMove(previousState, state, null);
  }
  await settleMutation();

  // The adapter applies ghost geometry during its synchronous commit.
  // Elementless ghosts intentionally skip DOM animation.
  const ghostElement = ghostItem.element;
  if (!ghostElement) return;

  let lastRect: DOMRect | null = null;
  ghostItem.schedule(
    () => {
      lastRect = readVisualRect(ghostItem);
    },
    {
      stage: "READ_2",
      queueId: `insertion-marker-read-last-${session.pressedItem.id}`,
    },
  );
  ghostItem.schedule(
    () => {
      playElementRectAnimation(
        ghostItem,
        firstRect,
        lastRect,
        ghostElement,
        animationConfigFor(container, "reorder"),
        ghostItem,
        { coordinateParent: container },
      );
    },
    {
      stage: "WRITE_2",
      queueId: `insertion-marker-play-${session.pressedItem.id}`,
    },
  );
}

async function clearInsertionPlacement(session: DragSession): Promise<void> {
  const ghostItem = session.ghostsByChannel.get("target");
  session.pendingPlacement = null;
  if (!ghostItem) return;

  ghostItem.removeGhost();
  await settleMutation();
  ghostItem.destroy(false);
  session.ghostsByChannel.delete("target");
}

function drop(session: DragSession): void {
  const item = session.primaryItem;
  const items = session.items;
  const root = session.root;
  const dropItemIds = items.map((member) => member.itemId);
  const dropRects = items.map(() => ({
    first: null as DOMRect | null,
    last: null as DOMRect | null,
    element: null as HTMLElement | null,
  }));
  let dropAnimationConfig: AnimationConfig | null = null;

  session.pressedItem.schedule(
    () => {
      captureDropOriginRects(session).forEach((rect, i) => {
        dropRects[i].first = rect;
      });
    },
    {
      stage: "READ_1",
      queueId: `drag-end-insertion-read-first-${session.pressedItem.id}`,
    },
  );

  session.pressedItem.schedule(
    async () => {
      const commitTarget = session.cancelled ? null : session.pendingPlacement;

      if (session.dragVisual === "item") await stopDragVisual(session);
      await clearInsertionPlacement(session);
      if (session.dragVisual === "preview") await stopDragVisual(session);

      let destination: DragLocation | null = null;
      if (commitTarget?.container) {
        const destinationContainer = commitTarget.container;
        destination = buildDragLocation(
          destinationContainer,
          commitTarget.index,
        );

        if (session.dropEffect === "move") {
          dropAnimationConfig = animationConfigFor(
            destinationContainer,
            "drop",
          );
          if (session.dragVisual === "item") {
            restoreActiveItems(session);
          }
          // Preserve the ordinary sibling FLIP pipeline. It snapshots the
          // pre-mutation tree in READ_2, commits in WRITE_2, and ignores any
          // newly-mounted source replacement because that entry had no first
          // rectangle. The dragged run has its own preview/item drop FLIP.
          item.moveItemsToContainer(
            destinationContainer,
            items,
            commitTarget.index,
            session,
          );
          await settleMutation();
        }
        // "none": no mutation events — the items already sit where they always were.
      }

      if (session.dropEffect === "none" || !destination) {
        if (session.dragVisual === "item") restoreActiveItems(session);
        dropAnimationConfig = animationConfigFor(
          session.activeSources[0].container,
          "drop",
        );
      }

      session.complete(destination);
    },
    {
      stage: "WRITE_1",
      queueId: `drag-end-insertion-${session.pressedItem.id}`,
    },
  );

  root.schedule(
    () => {
      items.forEach((member, i) => {
        const currentItem = root.findItemById(dropItemIds[i]) ?? member;
        const element = currentItem.element?.isConnected
          ? currentItem.element
          : null;
        dropRects[i].element = element;
        dropRects[i].last = readVisualRect(currentItem);
      });
    },
    {
      stage: "READ_3",
      queueId: `drag-end-insertion-read-last-${session.pressedItem.id}`,
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
    {
      stage: "WRITE_3",
      queueId: `drag-end-insertion-play-${session.pressedItem.id}`,
    },
  );
}

export class InsertionMarkerLifecycle implements DragLifecycleStrategy {
  readonly placementOccupiesFlowSlots = false;

  validateStart(session: DragSession): void {
    const pressedIndex = session.items.indexOf(session.pressedItem);
    const source =
      session.activeSources[pressedIndex] ?? session.activeSources[0];
    if (session.dropEffect !== "none") {
      assertCanFireItemMove(source.container);
    }
    assertCanFireGhostInsert(source.container);
    assertCanFireGhostRemove(source.container);
    validateDragVisual(session);
  }

  async dragStart(session: DragSession): Promise<void> {
    await startDragVisual(session);
    await session.updateDropTarget();
  }

  dragMove(session: DragSession): void {
    updateDragVisual(session);
  }

  currentPlacement(
    session: DragSession,
  ): { container: Container; index: number } | null {
    const pending = session.pendingPlacement;
    if (!pending || !session.ghostsByChannel.has("target")) return null;
    return { container: pending.container, index: pending.index };
  }

  placementIndexFor(_session: DragSession, target: ResolvedDropTarget): number {
    return target.index;
  }

  async syncPlacement(
    session: DragSession,
    placement: DropPlacement,
  ): Promise<void> {
    await syncInsertionPlacement(session, placement);
  }

  async clearPlacement(session: DragSession): Promise<void> {
    await clearInsertionPlacement(session);
  }

  afterPlacementSync(_session: DragSession): void {
    // The marker never repositions the dragged item itself.
  }

  drop(session: DragSession): void {
    session.scheduleDropFinalizer();
    drop(session);
  }
}
