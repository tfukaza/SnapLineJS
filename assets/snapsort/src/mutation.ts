import type { Container } from "./container";
import type { Item } from "./item";
import type { DragSession } from "./drag/session";
import type {
  ContainerCallbacks,
  DragItemHoverEvent,
  DragLocation,
  GhostCreateEvent,
  GhostInsertEvent,
  GhostRemoveEvent,
  ItemInsertEvent,
  ItemMoveEvent,
  ItemRemoveEvent,
  ItemSwapEvent,
  MutationPhase,
} from "./events";

/**
 * Single dispatch point for every ContainerCallbacks entry. Item and the drag
 * lifecycle strategies call these instead of invoking `container.callbacks`
 * directly, so fallback semantics (e.g. onItemMove -> onItemInsert) live in
 * exactly one place.
 */

const warnedAsyncMutationCallbacks = new WeakSet<() => void | Promise<void>>();

/** Run a consumer mutation inside its framework adapter's synchronous commit boundary. */
export function fireMutation(
  container: Container | null,
  mutation: () => void,
): void {
  const flushMutation = container?.callbacks?.flushMutation;
  if (flushMutation) {
    flushMutation(mutation);
    return;
  }

  mutation();

  // Compatibility only: async results are intentionally not awaited because
  // that would let the browser paint between DOM commit and FLIP inversion.
  const awaitMutation = container?.callbacks?.awaitMutation;
  if (!awaitMutation) return;
  const result = awaitMutation();
  if (
    result &&
    typeof (result as Promise<void>).then === "function" &&
    !warnedAsyncMutationCallbacks.has(awaitMutation)
  ) {
    warnedAsyncMutationCallbacks.add(awaitMutation);
    console.warn(
      "SnapSort: callbacks.awaitMutation returned a promise. Async framework commits are not paint-atomic; use the framework adapter's synchronous flushMutation hook instead.",
    );
  }
}

/** Yield to framework commit/effect microtasks without crossing a paint. */
export async function settleMutation(): Promise<void> {
  await Promise.resolve();
}

function itemIds(items: Item[]): string[] {
  return items.map((item) => item.resolvedItemId);
}

function ghostItems(session: DragSession): Item[] {
  return session.items;
}

function ghostItemIds(session: DragSession): string[] {
  return session.items.map((item) => item.resolvedItemId);
}

function missingCallbackError(
  container: Container,
  callback: keyof ContainerCallbacks,
  operation: string,
): Error {
  if (container.domOwnership === "framework") {
    return new Error(
      `SnapSort: framework-owned container "${container.name}" requires callbacks.${String(callback)} to ${operation}. Update framework state synchronously in that callback; SnapSort will not mutate framework-owned DOM.`,
    );
  }
  return new Error(
    `SnapSort: container "${container.name}" requires callbacks.${String(callback)} to ${operation}.`,
  );
}

/** @internal Validate a persistent insertion before core changes its tree bookkeeping. */
export function assertCanFireItemInsert(container: Container): void {
  if (!container.callbacks?.onItemInsert) {
    throw missingCallbackError(container, "onItemInsert", "insert an item");
  }
}

/** @internal Validate a persistent removal before core changes its tree bookkeeping. */
export function assertCanFireItemRemove(container: Container): void {
  if (!container.callbacks?.onItemRemove) {
    throw missingCallbackError(container, "onItemRemove", "remove an item");
  }
}

/** @internal Validate a semantic move before core changes its tree bookkeeping. */
export function assertCanFireItemMove(container: Container): void {
  if (container.callbacks?.onItemMove || container.callbacks?.onItemInsert) return;
  throw missingCallbackError(container, "onItemMove", "move an item");
}

/** @internal Framework state models must express swaps atomically. */
export function assertCanFireItemSwap(container: Container): void {
  if (container.callbacks?.onItemSwap) return;
  if (container.domOwnership === "framework") {
    throw missingCallbackError(container, "onItemSwap", "swap items");
  }
}

/** @internal Validate ghost insertion before core changes ghost bookkeeping. */
export function assertCanFireGhostInsert(container: Container): void {
  if (!container.callbacks?.onGhostInsert) {
    throw missingCallbackError(container, "onGhostInsert", "render a drag ghost");
  }
}

/** @internal Validate ghost removal before core changes ghost bookkeeping. */
export function assertCanFireGhostRemove(container: Container): void {
  if (!container.callbacks?.onGhostRemove) {
    throw missingCallbackError(container, "onGhostRemove", "remove a drag ghost");
  }
}

export function fireItemInsert(
  container: Container,
  items: Item[],
  index: number,
  beforeElement: HTMLElement | null,
  session: DragSession | null,
  phase: MutationPhase = "commit",
): void {
  assertCanFireItemInsert(container);
  const onInsert = container.callbacks?.onItemInsert;
  if (!onInsert) return;
  const event: ItemInsertEvent = {
    session,
    item: items[0],
    itemId: items[0].resolvedItemId,
    itemMetadata: items[0].metadata,
    items,
    itemIds: itemIds(items),
    itemsMetadata: items.map((item) => item.metadata),
    container,
    containerMetadata: container.metadata,
    index,
    beforeElement,
    phase,
  };
  fireMutation(container, () => onInsert(event));
}

export function fireItemRemove(
  container: Container,
  items: Item[],
  session: DragSession | null,
  phase: MutationPhase = "commit",
): void {
  assertCanFireItemRemove(container);
  const onRemove = container.callbacks?.onItemRemove;
  if (!onRemove) return;
  const event: ItemRemoveEvent = {
    session,
    item: items[0],
    itemId: items[0].resolvedItemId,
    itemMetadata: items[0].metadata,
    items,
    itemIds: itemIds(items),
    itemsMetadata: items.map((item) => item.metadata),
    container,
    containerMetadata: container.metadata,
    phase,
  };
  fireMutation(container, () => onRemove(event));
}

/**
 * Fire the semantic move event on the destination container for the whole
 * dragged run in one call. Falls back to the insert-only primitive path when
 * no `onItemMove` is registered, which matches the pre-refactor behavior (a
 * DOM `insertBefore` inherently moves the node, so no explicit remove is
 * needed on the source).
 *
 * Also the copy-drag commit path: a spawned item's `froms` entry is `null`
 * (see `ItemMoveEvent`) and `origins` carries the item it was spawned from.
 */
export function fireItemMove(
  froms: (DragLocation | null)[],
  to: DragLocation,
  items: Item[],
  beforeElement: HTMLElement | null,
  session: DragSession | null,
  phase: MutationPhase = "commit",
  origins: (Item | null)[] = items.map(() => null),
): void {
  assertCanFireItemMove(to.container);
  const onMove = to.container.callbacks?.onItemMove;
  if (onMove) {
    const event: ItemMoveEvent = {
      session,
      item: items[0],
      itemId: items[0].resolvedItemId,
      itemMetadata: items[0].metadata,
      items,
      itemIds: itemIds(items),
      itemsMetadata: items.map((item) => item.metadata),
      from: froms[0] ?? null,
      to,
      froms,
      originItem: origins[0] ?? null,
      originItemId: origins[0]?.resolvedItemId ?? null,
      originItemMetadata: origins[0]?.metadata ?? null,
      origins,
      originItemIds: origins.map((origin) => origin?.resolvedItemId ?? null),
      originsMetadata: origins.map((origin) => origin?.metadata ?? null),
      beforeElement,
      phase,
    };
    fireMutation(to.container, () => onMove(event));
    return;
  }
  fireItemInsert(to.container, items, to.index, beforeElement, session, phase);
}

/**
 * Fire the swap primitive. `a`/`b` describe each item's slot *before* the
 * swap; the caller (the swap lifecycle) has already updated its own
 * bookkeeping to the final, correct swap by the time this runs — this only
 * decides what the *consumer* is told happened.
 */
export function fireItemSwap(
  a: { item: Item; container: Container; index: number },
  b: { item: Item; container: Container; index: number },
  session: DragSession | null,
  phase: MutationPhase = "commit",
): void {
  assertCanFireItemSwap(a.container);
  const onSwap = a.container.callbacks?.onItemSwap;
  if (onSwap) {
    const event: ItemSwapEvent = {
      session,
      a: {
        item: a.item,
        itemId: a.item.resolvedItemId,
        itemMetadata: a.item.metadata,
        container: a.container,
        containerMetadata: a.container.metadata,
        index: a.index,
      },
      b: {
        item: b.item,
        itemId: b.item.resolvedItemId,
        itemMetadata: b.item.metadata,
        container: b.container,
        containerMetadata: b.container.metadata,
        index: b.index,
      },
      phase,
    };
    fireMutation(a.container, () => onSwap(event));
    return;
  }

  // No onItemSwap: approximate as two onItemMove calls (see ItemSwapEvent's
  // doc for the known limitation on non-adjacent same-container swaps).
  // Bookkeeping is already the final, correct swap, so `beforeElement` reads
  // straight off each destination container's current itemOrderedList.
  const beforeElementFor = (
    container: Container,
    index: number,
  ): HTMLElement | null =>
    index >= container.itemOrderedList.length - 1
      ? null
      : (container.itemOrderedList[index + 1]?.element ?? null);

  fireItemMove(
    [
      {
        container: a.container,
        containerMetadata: a.container.metadata,
        index: a.index,
      },
    ],
    {
      container: b.container,
      containerMetadata: b.container.metadata,
      index: b.index,
    },
    [a.item],
    beforeElementFor(b.container, b.index),
    session,
    phase,
  );
  fireItemMove(
    [
      {
        container: b.container,
        containerMetadata: b.container.metadata,
        index: b.index,
      },
    ],
    {
      container: a.container,
      containerMetadata: a.container.metadata,
      index: a.index,
    },
    [b.item],
    beforeElementFor(a.container, a.index),
    session,
    phase,
  );
}

function buildDragItemHoverEvent(
  session: DragSession,
  item: Item,
  overItem: Item,
  container: Container,
): DragItemHoverEvent {
  return {
    session,
    item,
    itemId: item.resolvedItemId,
    itemMetadata: item.metadata,
    overItem,
    overItemId: overItem.resolvedItemId,
    overItemMetadata: overItem.metadata,
    container,
    containerMetadata: container.metadata,
    pointer: { x: session.pointer.x, y: session.pointer.y },
  };
}

export function fireDragItemEnter(
  container: Container,
  item: Item,
  overItem: Item,
  session: DragSession,
): void {
  container.callbacks?.onDragItemEnter?.(
    buildDragItemHoverEvent(session, item, overItem, container),
  );
}

export function fireDragItemMove(
  container: Container,
  item: Item,
  overItem: Item,
  session: DragSession,
): void {
  container.callbacks?.onDragItemMove?.(
    buildDragItemHoverEvent(session, item, overItem, container),
  );
}

export function fireDragItemLeave(
  container: Container,
  item: Item,
  overItem: Item,
  session: DragSession,
): void {
  container.callbacks?.onDragItemLeave?.(
    buildDragItemHoverEvent(session, item, overItem, container),
  );
}

export function fireGhostInsert(
  container: Container,
  original: Item,
  ghostItem: Item,
  index: number,
  beforeElement: HTMLElement | null,
  ghostRect: GhostInsertEvent["ghostRect"],
  session: DragSession,
  kind: GhostInsertEvent["kind"],
  role: GhostInsertEvent["role"] = "target",
): void {
  assertCanFireGhostInsert(container);
  const onInsert = container.callbacks?.onGhostInsert;
  if (!onInsert) return;
  const event: GhostInsertEvent = {
    session,
    kind,
    role,
    original,
    originalItemId: original.resolvedItemId,
    originalMetadata: original.metadata,
    items: ghostItems(session),
    itemIds: ghostItemIds(session),
    ghostItem,
    ghostItemId: ghostItem.resolvedItemId,
    ghostMetadata: ghostItem.metadata,
    container,
    containerMetadata: container.metadata,
    index,
    beforeElement,
    ghostRect,
  };
  fireMutation(container, () => onInsert(event));
}

export function fireGhostRemove(
  container: Container,
  original: Item,
  ghostItem: Item,
  session: DragSession,
  kind: GhostRemoveEvent["kind"],
  role: GhostRemoveEvent["role"] = "target",
): void {
  assertCanFireGhostRemove(container);
  const onRemove = container.callbacks?.onGhostRemove;
  if (!onRemove) return;
  const event: GhostRemoveEvent = {
    session,
    kind,
    role,
    original,
    originalItemId: original.resolvedItemId,
    originalMetadata: original.metadata,
    items: ghostItems(session),
    itemIds: ghostItemIds(session),
    ghostItem,
    ghostItemId: ghostItem.resolvedItemId,
    ghostMetadata: ghostItem.metadata,
    container,
    containerMetadata: container.metadata,
    ghostRect:
      session.pendingGhostTarget?.ghostItem === ghostItem
        ? session.pendingGhostTarget.ghostRect
        : undefined,
  };
  fireMutation(container, () => onRemove(event));
}

export function fireCreateGhost(
  event: GhostCreateEvent,
): HTMLElement | void | null {
  return event.container.callbacks?.createGhost?.(event);
}

// --- Default DOM implementations, merged with user config in Container's constructor. ---

function defaultInsertItem(event: ItemInsertEvent) {
  // Insert every item before the same anchor, in run order: each item lands
  // immediately before the anchor and after whichever run member was just
  // inserted, so the DOM ends up in `items` order.
  for (const item of event.items) {
    event.container.element?.insertBefore(item.element!, event.beforeElement);
  }
}

function defaultRemoveItem(event: ItemRemoveEvent): void {
  for (const item of event.items) {
    item.element?.remove();
  }
}

function defaultInsertGhost(event: GhostInsertEvent) {
  event.container.element?.insertBefore(
    event.ghostItem.element!,
    event.beforeElement,
  );
}

function defaultRemoveGhost(event: GhostRemoveEvent): void {
  event.ghostItem.element?.remove();
}

function defaultCreateFlowGhost(event: GhostCreateEvent): HTMLElement {
  const ghostElement = document.createElement("div");
  ghostElement.id = "spacer";

  const origProp =
    event.original.dragSnapshot?.box ?? event.original.currentDomProperty;
  // `ghostRect`, when present, is the whole dragged group's size (see
  // DragSession.groupDims) — a single item's snapshot box for `items.length
  // === 1`, so this degenerates to the original behavior in that case.
  const width = event.ghostRect?.width ?? origProp.width;
  const height = event.ghostRect?.height ?? origProp.height;
  ghostElement.style.width = width + "px";
  ghostElement.style.height = height + "px";
  ghostElement.style.margin = `${origProp.margin.top}px ${origProp.margin.right}px ${origProp.margin.bottom}px ${origProp.margin.left}px`;
  ghostElement.style.boxSizing = "border-box";
  ghostElement.classList.add("ghost");

  return ghostElement;
}

function defaultCreateMarkerGhost(event: GhostCreateEvent): HTMLElement {
  const ghostElement = document.createElement("div");
  ghostElement.id = "spacer";
  const { ghostRect } = event;
  const insetLeft = ghostRect?.insetLeft ?? 0;
  const insetRight = ghostRect?.insetRight ?? 0;
  const width = ghostRect
    ? Math.max(0, ghostRect.width - insetLeft - insetRight)
    : 0;

  ghostElement.dataset.snapsortGhost = "insertion";
  ghostElement.style.position = "absolute";
  ghostElement.style.width = `${width}px`;
  ghostElement.style.height = "0px";
  ghostElement.style.borderRadius = "999px";
  ghostElement.style.borderTop = "3px solid currentColor";
  ghostElement.style.background = "currentColor";
  ghostElement.style.color = "rgb(37, 99, 235)";
  ghostElement.style.pointerEvents = "none";
  ghostElement.style.boxSizing = "border-box";

  return ghostElement;
}

function defaultCreateGhost(event: GhostCreateEvent): HTMLElement {
  return event.kind === "marker"
    ? defaultCreateMarkerGhost(event)
    : defaultCreateFlowGhost(event);
}

export const defaultCallbacks = {
  onItemInsert: defaultInsertItem,
  onItemRemove: defaultRemoveItem,
  onGhostInsert: defaultInsertGhost,
  onGhostRemove: defaultRemoveGhost,
  createGhost: defaultCreateGhost,
};
