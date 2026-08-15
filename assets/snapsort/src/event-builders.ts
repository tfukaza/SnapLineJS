import type { Container } from "./container";
import type { DragSessionController as DragSession } from "./drag/session";
import type {
  DragEndEvent,
  DragLocation,
  DragStartEvent,
  DropTargetChangeEvent,
  GhostEventBase,
  GhostKind,
  GhostRect,
  GhostRole,
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

export function buildGhostEvent(
  session: DragSession,
  kind: GhostKind,
  role: GhostRole,
  original: Item,
  ghostItem: Item,
  container: Container,
  ghostRect?: GhostRect | null,
): GhostEventBase {
  return {
    session: session.handle,
    kind,
    role,
    container,
    containerMetadata: container.metadata,
    original,
    originalItemId: original.resolvedItemId,
    originalMetadata: original.metadata,
    items: [...session.items],
    itemIds: session.items.map((item) => item.resolvedItemId),
    ghostItem,
    ghostItemId: ghostItem.resolvedItemId,
    ghostMetadata: ghostItem.metadata,
    ghostRect,
  };
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
