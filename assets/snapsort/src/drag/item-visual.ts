import type { Container } from "../container";
import type { GhostRect } from "../events";
import type { Item } from "../item";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  settleMutation,
} from "../mutation";
import type { DragSession } from "./session";
import {
  removePointerPreview,
  startPointerPreview,
  updatePointerPreview,
  validatePointerPreview,
} from "./pointer-preview";

function sourceRect(item: Item): GhostRect | null {
  const box = item.dragSnapshot?.box;
  return box ? { x: 0, y: 0, width: box.width, height: box.height } : null;
}

/** @internal Validate callbacks needed to keep source slots stable. */
export function validateItemVisual(session: DragSession): void {
  const containers = new Set(
    session.activeSources.map((source) => source.container),
  );
  for (const container of containers) {
    assertCanFireGhostInsert(container);
    assertCanFireGhostRemove(container);
  }
}

/** @internal Compute a dragged run's offsets along its source flow axis. */
export function computeGroupOffsets(session: DragSession): void {
  const pressedIndex = session.items.indexOf(session.pressedItem);
  const axisContainer =
    session.activeSources[pressedIndex]?.container ??
    session.activeSources[0].container;
  const axis = axisContainer.direction === "row" ? "x" : "y";
  let cumulative = 0;
  let pressedCumulative = 0;
  const cumulativeByItem = new Map<Item, number>();
  for (const member of session.items) {
    cumulativeByItem.set(member, cumulative);
    if (member === session.pressedItem) pressedCumulative = cumulative;
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

/**
 * @internal Hoist the real run and replace its layout slots with source-role
 * flow Ghosts. Placement lifecycles remain free to manage their own target
 * Ghosts independently.
 */
export async function startItemVisual(session: DragSession): Promise<void> {
  validateItemVisual(session);
  computeGroupOffsets(session);

  session.items.forEach((member, i) => {
    const source = session.activeSources[i];
    const container = source.container;
    const liveIndex = container.itemOrderedList.indexOf(member);
    if (liveIndex < 0) {
      throw new Error(
        "SnapSort: a dragVisual item must still be attached when its drag starts.",
      );
    }

    const rect = sourceRect(member);
    const ghost = member.createGhostItem(
      session,
      "flow",
      container,
      rect,
      "source",
    );
    if (!ghost) return;
    ghost.rootContainer = session.root;
    session.sourceGhostRun.push(ghost);
    if (session.sourceGhostRun.length === 1) {
      session.ghosts.set("source", ghost);
    }
    container.insertGhostAt(
      member,
      container,
      ghost,
      liveIndex,
      rect,
      session,
      "flow",
      "source",
    );
    member.detachItemFromContainer(container, member);

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
    session.dragCoordinateParent.set(member, container);
    member.refreshDraggedItemPosition();
  });
  await settleMutation();
}

/** @internal Move every member of a real-item pointer visual. */
export function updateItemVisual(session: DragSession): void {
  for (const member of session.items) member.writeDraggedTransform();
}

/** @internal Reset real-item drag styling without writing through unmounted DOM. */
export function resetItemVisual(session: DragSession): void {
  for (const member of session.items) {
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
    const element = member.element;
    if (!element?.isConnected) continue;
    delete element.dataset.snapsortDragging;
    member.writeDom();
    member.writeTransform();
  }
}

/** @internal Remove source spacers and reset hoisted Item styling. */
export async function stopItemVisual(session: DragSession): Promise<void> {
  resetItemVisual(session);

  for (let i = 0; i < session.sourceGhostRun.length; i++) {
    const ghost = session.sourceGhostRun[i];
    const container = ghost.parent as unknown as Container | null;
    if (container) {
      session.items[i].removeGhostFrom(
        session.items[i],
        container,
        ghost,
        session,
        "flow",
        "source",
      );
    }
  }
  await settleMutation();
  for (const ghost of session.sourceGhostRun) {
    ghost.destroy(!ghost.frameworkManagedGhostElement);
  }
  session.sourceGhostRun.length = 0;
  session.ghosts.delete("source");
}

/** @internal Validate integration requirements for the selected pointer visual. */
export function validateDragVisual(session: DragSession): void {
  if (session.dragVisual === "item") {
    validateItemVisual(session);
  } else if (session.dragVisual === "preview") {
    validatePointerPreview(session);
  }
}

/** @internal Start the selected pointer visual. */
export async function startDragVisual(session: DragSession): Promise<void> {
  if (session.dragVisual === "item") {
    await startItemVisual(session);
  } else if (session.dragVisual === "preview") {
    await startPointerPreview(session);
  }
}

/** @internal Update the selected pointer visual. */
export function updateDragVisual(session: DragSession): void {
  if (session.dragVisual === "item") {
    updateItemVisual(session);
  } else if (session.dragVisual === "preview") {
    updatePointerPreview(session);
  }
}

/** @internal Stop the selected pointer visual. */
export async function stopDragVisual(session: DragSession): Promise<void> {
  if (session.dragVisual === "item") {
    await stopItemVisual(session);
  } else if (session.dragVisual === "preview") {
    await removePointerPreview(session);
  }
}

/** @internal Reattach a detached run to its pre-handoff participant locations. */
export function restoreActiveItems(session: DragSession): void {
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
