import type { Container } from "./container";
import type { DragSessionController as DragSession } from "./drag/session";
import type {
  DragEndEvent,
  DragLocation,
  DragStartEvent,
  DropTargetChangeEvent,
  GhostInsertEvent,
  GhostMoveEvent,
  GhostOverlayLocation,
  GhostRemoveEvent,
  GhostState,
  GhostStateBase,
  GhostStatePlacement,
  GhostSlotLocation,
  InsertionGapSegment,
  InsertionMarkerNeighbor,
  InsertionMarkerState,
} from "./events";
import type { Item } from "./item";
import type { ItemId, ItemMetadata } from "./snapshot";

interface ItemRunEventFields {
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
}

export function buildItemRunEvent(items: readonly Item[]): ItemRunEventFields {
  const item = items[0];
  return {
    item,
    itemId: item.itemId,
    itemMetadata: item.metadata,
    items: [...items],
    itemIds: items.map((member) => member.itemId),
    itemsMetadata: items.map((member) => member.metadata),
  };
}

export function buildDragLocation(
  container: Container,
  index: number,
): DragLocation {
  return { container, containerMetadata: container.metadata, index };
}

export function buildItemLocation(item: Item): DragLocation | null {
  const { container, index } = item.getIndexAndContainer();
  return container && index !== -1 ? buildDragLocation(container, index) : null;
}

export function buildGhostSlotLocation(
  container: Container,
  index: number,
): GhostSlotLocation {
  return {
    type: "slot",
    container,
    containerMetadata: container.metadata,
    index,
  };
}

export function buildGhostOverlayLocation(
  container: Container,
): GhostOverlayLocation {
  return {
    type: "overlay",
    container,
    containerMetadata: container.metadata,
  };
}

function freezeInsertionGap(gap: InsertionGapSegment): InsertionGapSegment {
  return Object.freeze({ ...gap });
}

function freezeInsertionNeighbor(
  neighbor: InsertionMarkerNeighbor | null,
): InsertionMarkerNeighbor | null {
  if (neighbor === null) return null;
  return Object.freeze({
    ...neighbor,
    rect: Object.freeze({
      x: neighbor.rect.x,
      y: neighbor.rect.y,
      width: neighbor.rect.width,
      height: neighbor.rect.height,
    }),
  });
}

export function buildGhostState(
  session: DragSession,
  placement: GhostStatePlacement,
  original: Item,
  ghostItem: Item,
): GhostState {
  const base: GhostStateBase = {
    session: session.handle,
    original,
    originalItemId: original.itemId,
    originalMetadata: original.metadata,
    items: [...session.items],
    itemIds: session.items.map((item) => item.itemId),
    ghostItem,
    ghostItemId: ghostItem.itemId,
    ghostMetadata: ghostItem.metadata,
  };

  switch (placement.type) {
    case "source-spacer":
      return {
        ...base,
        type: "source-spacer",
        location: placement.location,
        rect: placement.rect,
      };
    case "target-spacer":
      return {
        ...base,
        type: "target-spacer",
        location: placement.location,
        rect: placement.rect,
      };
    case "insertion-marker":
      return Object.freeze({
        ...base,
        type: "insertion-marker",
        location: placement.location,
        gap: freezeInsertionGap(placement.gap),
        previous: freezeInsertionNeighbor(placement.previous),
        next: freezeInsertionNeighbor(placement.next),
        isCurrentPlacement: placement.isCurrentPlacement,
      } satisfies InsertionMarkerState);
    case "pointer-preview":
      return {
        ...base,
        type: "pointer-preview",
        location: placement.location,
        rect: placement.rect,
      };
  }
}

type GhostStateOf<Type extends GhostState["type"]> = Extract<
  GhostState,
  { type: Type }
>;

type GhostStatePlacementOf<Type extends GhostState["type"]> = Extract<
  GhostStatePlacement,
  { type: Type }
>;

export function updateGhostState(
  previous: GhostStateOf<"source-spacer">,
  placement: GhostStatePlacementOf<"source-spacer">,
): GhostStateOf<"source-spacer">;
export function updateGhostState(
  previous: GhostStateOf<"target-spacer">,
  placement: GhostStatePlacementOf<"target-spacer">,
): GhostStateOf<"target-spacer">;
export function updateGhostState(
  previous: GhostStateOf<"insertion-marker">,
  placement: GhostStatePlacementOf<"insertion-marker">,
): GhostStateOf<"insertion-marker">;
export function updateGhostState(
  previous: GhostStateOf<"pointer-preview">,
  placement: GhostStatePlacementOf<"pointer-preview">,
): GhostStateOf<"pointer-preview">;
export function updateGhostState(
  previous: GhostState,
  placement: GhostStatePlacement,
): GhostState {
  switch (placement.type) {
    case "source-spacer":
      if (previous.type !== "source-spacer") {
        break;
      }
      return {
        ...previous,
        location: placement.location,
        rect: placement.rect,
      };
    case "target-spacer":
      if (previous.type !== "target-spacer") {
        break;
      }
      return {
        ...previous,
        location: placement.location,
        rect: placement.rect,
      };
    case "insertion-marker":
      if (previous.type !== "insertion-marker") {
        break;
      }
      return Object.freeze({
        ...previous,
        location: placement.location,
        gap: freezeInsertionGap(placement.gap),
        previous: freezeInsertionNeighbor(placement.previous),
        next: freezeInsertionNeighbor(placement.next),
        isCurrentPlacement: placement.isCurrentPlacement,
      } satisfies InsertionMarkerState);
    case "pointer-preview":
      if (previous.type !== "pointer-preview") {
        break;
      }
      return {
        ...previous,
        location: placement.location,
        rect: placement.rect,
      };
  }
  throw new Error("SnapSort: a ghost cannot change its state type.");
}

export function buildGhostInsertEvent(
  state: GhostState,
  beforeElement: HTMLElement | null,
): GhostInsertEvent {
  switch (state.type) {
    case "source-spacer":
      return {
        operation: "insert",
        ghost: state,
        to: state.location,
        beforeElement,
      };
    case "target-spacer":
      return {
        operation: "insert",
        ghost: state,
        to: state.location,
        beforeElement,
      };
    case "insertion-marker":
      return {
        operation: "insert",
        ghost: state,
        to: state.location,
        beforeElement,
      };
    case "pointer-preview":
      return {
        operation: "insert",
        ghost: state,
        to: state.location,
        beforeElement,
      };
  }
}

export function buildGhostMoveEvent(
  previous: GhostState,
  next: GhostState,
  beforeElement: HTMLElement | null,
): GhostMoveEvent {
  switch (next.type) {
    case "source-spacer":
      if (previous.type !== "source-spacer") break;
      return {
        operation: "move",
        ghost: next,
        from: previous.location,
        to: next.location,
        beforeElement,
      };
    case "target-spacer":
      if (previous.type !== "target-spacer") break;
      return {
        operation: "move",
        ghost: next,
        from: previous.location,
        to: next.location,
        beforeElement,
      };
    case "insertion-marker":
      if (previous.type !== "insertion-marker") break;
      return {
        operation: "move",
        ghost: next,
        from: previous.location,
        to: next.location,
        beforeElement,
      };
    case "pointer-preview":
      if (previous.type !== "pointer-preview") break;
      return {
        operation: "move",
        ghost: next,
        from: previous.location,
        to: next.location,
        beforeElement,
      };
  }
  throw new Error("SnapSort: a ghost cannot change its state type.");
}

export function buildGhostRemoveEvent(state: GhostState): GhostRemoveEvent {
  switch (state.type) {
    case "source-spacer":
      return { operation: "remove", ghost: state, from: state.location };
    case "target-spacer":
      return { operation: "remove", ghost: state, from: state.location };
    case "insertion-marker":
      return { operation: "remove", ghost: state, from: state.location };
    case "pointer-preview":
      return { operation: "remove", ghost: state, from: state.location };
  }
}

export function buildDragStartEvent(session: DragSession): DragStartEvent {
  return {
    session: session.handle,
    ...buildItemRunEvent(session.items),
    element: session.primaryItem.element,
    source: session.sources[0],
    sources: [...session.sources],
  };
}

export function buildDragEndEvent(
  session: DragSession,
  destination: DragLocation | null,
): DragEndEvent {
  return {
    session: session.handle,
    ...buildItemRunEvent(session.items),
    element: session.primaryItem.element,
    source: session.sources[0],
    sources: [...session.sources],
    destination,
  };
}

export function buildDropTargetChangeEvent(
  session: DragSession,
  previous: DragLocation | null,
  current: DragLocation | null,
): DropTargetChangeEvent {
  return {
    session: session.handle,
    ...buildItemRunEvent(session.items),
    previous,
    current,
  };
}
