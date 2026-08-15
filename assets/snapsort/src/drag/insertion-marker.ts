import type { AnimationConfig, Container } from "../container";
import type { Item } from "../item";
import type { DropCandidate } from "../algorithm";
import { buildDragLocation } from "../event-builders";
import type { DragLocation, GhostRect, GhostRole } from "../events";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  assertCanFireItemMove,
  fireGhostInsert,
  fireGhostRemove,
  settleMutation,
} from "../mutation";
import type { DragLifecycleStrategy } from "./lifecycle";
import type { DragSessionController as DragSession } from "./session";
import {
  consumeStagedVisualRect,
  readVisualRect,
} from "../internal/visual-rect";
import {
  restoreActiveItems,
  startDragVisual,
  stopDragVisual,
  stopItemVisual,
  updateDragVisual,
  validateDragVisual,
} from "./item-visual";
import {
  pointerPreviewMemberRects,
  removePointerPreview,
} from "./pointer-preview";

/**
 * Floating insertion marker: insertion mode. Unlike the flow ghost, the
 * marker is never attached to a container's item-ordered list — its logical
 * position lives solely in `DragSession.pendingGhostTarget`, and its DOM
 * element is absolutely positioned from the algorithm's computed rect.
 * Pointer representation is independent: `dragVisual` can hoist the real
 * Item, render the shared group preview, or show no pointer-following visual.
 */

function updateInsertionGhostStyle(
  container: Container,
  ghostRect: GhostRect | null | undefined,
  ghostItem: Item,
) {
  const ghostElement = ghostItem.element;
  if (!ghostRect || !ghostElement) return;

  const containerProp =
    (container as unknown as Item).dragSnapshot?.box ??
    container.currentDomProperty;
  const left = ghostRect.x - containerProp.x;
  const top = ghostRect.y - containerProp.y;

  ghostElement.dataset.snapsortGhost = "insertion";
  ghostElement.style.position = "absolute";
  ghostElement.style.left = `${left}px`;
  ghostElement.style.top = `${top}px`;
  ghostElement.style.width = `${ghostRect.width}px`;
  ghostElement.style.height = "0px";
  ghostElement.style.margin = "0";
  ghostElement.style.borderRadius = "999px";
  ghostElement.style.borderTop = "3px solid currentColor";
  ghostElement.style.background = "currentColor";
  ghostElement.style.color = "rgb(37, 99, 235)";
  ghostElement.style.pointerEvents = "none";
  ghostElement.style.boxSizing = "border-box";
  ghostElement.style.zIndex = "999";
}

async function moveGhost(
  session: DragSession,
  container: Container,
  index: number,
  ghostRect: GhostRect | null | undefined,
): Promise<void> {
  const item = session.primaryItem;
  let ghostItem = session.ghostItem;
  if (!ghostRect || !container.element) return;
  if (session.dropEffect !== "none") {
    assertCanFireItemMove(container);
  }
  assertCanFireGhostInsert(container);
  assertCanFireGhostRemove(container);

  const previousTarget =
    ghostItem && session.pendingGhostTarget?.ghostItem === ghostItem
      ? session.pendingGhostTarget
      : null;
  if (previousTarget?.container && previousTarget.container !== container) {
    assertCanFireGhostRemove(previousTarget.container);
  }

  const firstRect = ghostItem ? consumeStagedVisualRect(ghostItem) : null;

  if (!ghostItem) {
    ghostItem = item.createGhostItem(session, "marker", container, ghostRect);
    if (!ghostItem) return;
  }
  session.ghostItem = ghostItem;

  // Framework adapters keep ghost entries in per-container state. Clear the
  // previous owner before rendering the same marker under a new container;
  // otherwise both frameworks try to bind one ghost Item to two DOM nodes.
  if (previousTarget?.container && previousTarget.container !== container) {
    fireGhostRemove(
      previousTarget.container,
      item,
      ghostItem,
      session,
      "marker",
    );
    await settleMutation();
  }

  session.pendingGhostTarget = { ghostItem, container, index, ghostRect };

  if (!ghostItem.element && !ghostItem.frameworkManagedGhostElement) {
    return;
  }

  // The marker is intentionally never attached to the container's item list
  // (see module doc); it always "appends" from the DOM's perspective.
  fireGhostInsert(
    container,
    item,
    ghostItem,
    index,
    null,
    ghostRect,
    session,
    "marker",
  );
  await settleMutation();

  // Core-created markers own their DOM element and are positioned/animated
  // directly; framework-managed markers get geometry solely via `ghostRect`
  // on the onGhostInsert event above.
  const ghostElement = ghostItem.element;
  if (!ghostElement || ghostItem.frameworkManagedGhostElement) return;

  updateInsertionGhostStyle(container, ghostRect, ghostItem);
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
      item.playElementRectAnimation(
        ghostItem,
        firstRect,
        lastRect,
        ghostElement,
        item.reorderAnimationConfig(container),
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

async function removeGhost(
  session: DragSession,
  role: GhostRole = "target",
): Promise<void> {
  const item = session.primaryItem;
  const ghostItem = session.ghosts.get(role);
  const previousTarget = role === "target" ? session.pendingGhostTarget : null;
  if (role === "target") {
    session.pendingGhostTarget = null;
  }
  if (!ghostItem) return;

  if (previousTarget?.container) {
    fireGhostRemove(
      previousTarget.container,
      item,
      ghostItem,
      session,
      "marker",
      role,
    );
    await settleMutation();
  } else {
    // No known container to route onGhostRemove through (e.g. drag ended
    // before a target was ever resolved). Only core-owned DOM can be removed
    // directly; framework-owned DOM always remains with the adapter.
    if (!ghostItem.frameworkManagedGhostElement) {
      ghostItem.element?.remove();
    }
  }
  ghostItem.destroy(!ghostItem.frameworkManagedGhostElement);
  session.ghosts.delete(role);
}

function drop(session: DragSession): void {
  const item = session.primaryItem;
  const items = session.items;
  const root = session.root;
  const dropKeys = items.map((member) => root.itemKey(member));
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
      queueId: `drag-end-insertion-read-first-${session.pressedItem.id}`,
    },
  );

  session.pressedItem.schedule(
    async () => {
      const ghostItem = session.ghostItem;
      const pendingGhostTarget =
        session.pendingGhostTarget?.ghostItem === ghostItem
          ? session.pendingGhostTarget
          : null;
      const commitTarget = session.cancelled ? null : pendingGhostTarget;

      if (session.dragVisual === "item") await stopDragVisual(session);
      await removeGhost(session);
      if (session.dragVisual === "preview") await stopDragVisual(session);

      let destination: DragLocation | null = null;
      if (commitTarget?.container) {
        const destinationContainer = commitTarget.container;
        destination = buildDragLocation(
          destinationContainer,
          commitTarget.index,
        );

        if (session.dropEffect === "move") {
          dropAnimationConfig = item.dropAnimationConfig(destinationContainer);
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
        dropAnimationConfig = item.dropAnimationConfig(
          session.activeSources[0]?.container ?? null,
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
        const currentItem = root.findItemByKey(dropKeys[i]) ?? member;
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
        member.playDropAnimation(
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
  readonly ghostKind = "marker" as const;

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

  currentGhostLocation(
    session: DragSession,
  ): { container: Container; index: number } | null {
    const ghostItem = session.ghostItem;
    const pending = session.pendingGhostTarget;
    if (!pending || pending.ghostItem !== ghostItem) return null;
    return { container: pending.container, index: pending.index };
  }

  translateTargetIndex(_session: DragSession, target: DropCandidate): number {
    return target.index;
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
    if (role === "source") {
      await stopItemVisual(session);
      return;
    }
    await removeGhost(session, role);
  }

  afterSyncDropTarget(_session: DragSession): void {
    // The marker never repositions the dragged item itself.
  }

  drop(session: DragSession): void {
    session.scheduleDropFinalizer();
    drop(session);
  }
}
