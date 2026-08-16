import type { Container } from "./container";
import type { DragSessionController as DragSession } from "./drag/session";
import type {
  DragEndEvent,
  DragLocation,
  DragStartEvent,
  DropTargetChangeEvent,
  GhostInsertEvent,
  GhostLocation,
  GhostMoveEvent,
  GhostOverlayLocation,
  GhostRect,
  GhostRemoveEvent,
  GhostState,
  GhostStateBase,
  GhostStatePlacement,
  GhostSlotLocation,
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
    itemId: item.resolvedItemId,
    itemMetadata: item.metadata,
    items: [...items],
    itemIds: items.map((member) => member.resolvedItemId),
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

export function buildGhostState(
  session: DragSession,
  placement: GhostStatePlacement,
  original: Item,
  ghostItem: Item,
  rect: GhostRect,
): GhostState {
  const base: GhostStateBase = {
    session: session.handle,
    original,
    originalItemId: original.resolvedItemId,
    originalMetadata: original.metadata,
    items: [...session.items],
    itemIds: session.items.map((item) => item.resolvedItemId),
    ghostItem,
    ghostItemId: ghostItem.resolvedItemId,
    ghostMetadata: ghostItem.metadata,
    rect,
  };

  switch (placement.type) {
    case "source-spacer":
      return {
        ...base,
        type: "source-spacer",
        location: placement.location,
      };
    case "target-spacer":
      return {
        ...base,
        type: "target-spacer",
        location: placement.location,
      };
    case "insertion-marker":
      return {
        ...base,
        type: "insertion-marker",
        location: placement.location,
      };
    case "pointer-preview":
      return {
        ...base,
        type: "pointer-preview",
        location: placement.location,
      };
  }
}

type GhostStateOf<Type extends GhostState["type"]> = Extract<
  GhostState,
  { type: Type }
>;

export function updateGhostState(
  previous: GhostStateOf<"source-spacer">,
  location: GhostSlotLocation,
  rect: GhostRect,
): GhostStateOf<"source-spacer">;
export function updateGhostState(
  previous: GhostStateOf<"target-spacer">,
  location: GhostSlotLocation,
  rect: GhostRect,
): GhostStateOf<"target-spacer">;
export function updateGhostState(
  previous: GhostStateOf<"insertion-marker">,
  location: GhostSlotLocation,
  rect: GhostRect,
): GhostStateOf<"insertion-marker">;
export function updateGhostState(
  previous: GhostStateOf<"pointer-preview">,
  location: GhostOverlayLocation,
  rect: GhostRect,
): GhostStateOf<"pointer-preview">;
export function updateGhostState(
  previous: GhostState,
  location: GhostLocation,
  rect: GhostRect,
): GhostState {
  switch (previous.type) {
    case "source-spacer":
      if (location.type !== "slot") {
        throw new Error("SnapSort: a source spacer requires a slot location.");
      }
      return { ...previous, location, rect };
    case "target-spacer":
      if (location.type !== "slot") {
        throw new Error("SnapSort: a target spacer requires a slot location.");
      }
      return { ...previous, location, rect };
    case "insertion-marker":
      if (location.type !== "slot") {
        throw new Error(
          "SnapSort: an insertion marker requires a slot location.",
        );
      }
      return { ...previous, location, rect };
    case "pointer-preview":
      if (location.type !== "overlay") {
        throw new Error(
          "SnapSort: a pointer preview requires an overlay location.",
        );
      }
      return { ...previous, location, rect };
  }
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
