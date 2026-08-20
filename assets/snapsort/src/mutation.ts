import type { Container } from "./container";
import type { Item } from "./item";
import type { DragSessionController as DragSession } from "./drag/session";
import type {
  DragItemHoverEvent,
  DragLocation,
  GhostState,
  ItemInsertEvent,
  ItemMoveEvent,
  ItemRemoveEvent,
  ItemSwapEvent,
} from "./events";
import type { SnapSortAdapterCallbacks } from "./adapter";
import {
  buildGhostInsertEvent,
  buildGhostMoveEvent,
  buildGhostRemoveEvent,
  buildItemRunEvent,
} from "./event-builders";

/**
 * Shared dispatch helpers for item/ghost mutations, ghost creation, and item
 * hover. Structural mutation callbacks resolve on the root container's
 * controlled `callbacks` property, then fall back to the root-scoped adapter
 * — the semantic containers appear only in event payloads (`event.container`,
 * `from`/`to`, `a`/`b`). Root
 * lifecycle callbacks are dispatched by the drag session and lifecycle
 * strategies, per-container policy by the drop algorithm, hover by the
 * `overItem` owner, and visual invalidation by Container. Consumer mutations
 * use `fireMutation` here so root-adapter commit semantics and fallbacks (for
 * example, onItemMove -> onItemInsert) stay consistent.
 */

/** Run a consumer mutation inside its root adapter's synchronous commit boundary. */
export function fireMutation(container: Container, mutation: () => void): void {
  container.rootContainer.commitMutation(mutation);
}

/** Run an optional callback only when its receiver actually implements it. */
export function fireOptionalMutation<Event>(
  container: Container,
  callback: ((event: Event) => void) | undefined,
  event: Event,
): void {
  if (!callback) return;
  fireMutation(container, () => callback(event));
}

/** Yield to adapter commit/effect microtasks without crossing a paint. */
export async function settleMutation(): Promise<void> {
  await Promise.resolve();
}

function missingCallbackError(
  container: Container,
  callback: keyof SnapSortAdapterCallbacks,
  operation: string,
): Error {
  const root = container.rootContainer;
  const involving =
    root === container ? "" : ` (involving container "${container.name}")`;
  return new Error(
    `SnapSort: root container "${root.name}" or its adapter requires callbacks.${String(callback)} to ${operation}${involving}.`,
  );
}

function resolveMutationCallback<Name extends keyof SnapSortAdapterCallbacks>(
  container: Container,
  name: Name,
): SnapSortAdapterCallbacks[Name] {
  const root = container.rootContainer;
  return root.callbacks[name] ?? root.adapter.callbacks[name];
}

type ResolvedItemMoveCallback =
  | {
      readonly operation: "move";
      readonly callback: NonNullable<SnapSortAdapterCallbacks["onItemMove"]>;
    }
  | {
      readonly operation: "insert";
    };

function resolveItemMoveCallback(
  container: Container,
): ResolvedItemMoveCallback | null {
  const root = container.rootContainer;
  const rootCallbacks = root.callbacks;
  if (rootCallbacks.onItemMove) {
    return { operation: "move", callback: rootCallbacks.onItemMove };
  }
  if (rootCallbacks.onItemInsert) {
    return { operation: "insert" };
  }

  const adapterCallbacks = root.adapter.callbacks;
  if (adapterCallbacks.onItemMove) {
    return { operation: "move", callback: adapterCallbacks.onItemMove };
  }
  if (adapterCallbacks.onItemInsert) {
    return { operation: "insert" };
  }
  return null;
}

function missingItemMoveCallbackError(container: Container): Error {
  const root = container.rootContainer;
  const involving =
    root === container ? "" : ` (involving container "${container.name}")`;
  return new Error(
    `SnapSort: root container "${root.name}" or its adapter requires callbacks.onItemMove or callbacks.onItemInsert to move an item${involving}.`,
  );
}

const requiredMutationOperations = {
  onItemInsert: "insert an item",
  onItemRemove: "remove an item",
  onItemSwap: "swap items",
  onGhostInsert: "render a drag ghost",
  onGhostMove: "move a drag ghost",
  onGhostRemove: "remove a drag ghost",
} as const satisfies Record<
  Exclude<keyof SnapSortAdapterCallbacks, "onItemMove">,
  string
>;

type RequiredMutationCallback = keyof typeof requiredMutationOperations;

function requireMutationCallback<Name extends RequiredMutationCallback>(
  container: Container,
  callback: Name,
): NonNullable<SnapSortAdapterCallbacks[Name]> {
  const resolved = resolveMutationCallback(container, callback);
  if (resolved) return resolved;
  throw missingCallbackError(
    container,
    callback,
    requiredMutationOperations[callback],
  );
}

/** @internal Validate a persistent insertion before core changes its tree bookkeeping. */
export function assertCanFireItemInsert(container: Container): void {
  requireMutationCallback(container, "onItemInsert");
}

/** @internal Validate a persistent removal before core changes its tree bookkeeping. */
export function assertCanFireItemRemove(container: Container): void {
  requireMutationCallback(container, "onItemRemove");
}

/** @internal Validate a semantic move before core changes its tree bookkeeping. */
export function assertCanFireItemMove(container: Container): void {
  if (resolveItemMoveCallback(container)) return;
  throw missingItemMoveCallbackError(container);
}

/** @internal Every adapter must express swaps atomically. */
export function assertCanFireItemSwap(container: Container): void {
  requireMutationCallback(container, "onItemSwap");
}

/** @internal Validate ghost insertion before core changes ghost bookkeeping. */
export function assertCanFireGhostInsert(container: Container): void {
  requireMutationCallback(container, "onGhostInsert");
}

/** @internal Validate ghost removal before core changes ghost bookkeeping. */
export function assertCanFireGhostRemove(container: Container): void {
  requireMutationCallback(container, "onGhostRemove");
}

/** @internal Validate ghost relocation before core changes ghost bookkeeping. */
export function assertCanFireGhostMove(container: Container): void {
  requireMutationCallback(container, "onGhostMove");
}

export function fireItemInsert(
  container: Container,
  items: readonly Item[],
  index: number,
  beforeElement: HTMLElement | null,
  session: DragSession | null,
): void {
  const onInsert = requireMutationCallback(container, "onItemInsert");
  const event: ItemInsertEvent = {
    session: session?.handle ?? null,
    ...buildItemRunEvent(items),
    container,
    containerMetadata: container.metadata,
    index,
    beforeElement,
  };
  fireMutation(container, () => onInsert(event));
}

export function fireItemRemove(
  container: Container,
  items: readonly Item[],
  session: DragSession | null,
): void {
  const onRemove = requireMutationCallback(container, "onItemRemove");
  const event: ItemRemoveEvent = {
    session: session?.handle ?? null,
    ...buildItemRunEvent(items),
    container,
    containerMetadata: container.metadata,
  };
  fireMutation(container, () => onRemove(event));
}

/**
 * Fire the semantic move event for the whole dragged run in one call; the
 * root resolves the handler and `from`/`froms`/`to` carry the source and
 * destination. Falls back to the insert-only primitive path when no
 * `onItemMove` is registered, which matches the pre-refactor behavior (a
 * DOM `insertBefore` inherently moves the node, so no explicit remove is
 * needed on the source).
 */
export function fireItemMove(
  froms: readonly DragLocation[],
  to: DragLocation,
  items: readonly Item[],
  beforeElement: HTMLElement | null,
  session: DragSession | null,
): void {
  const resolved = resolveItemMoveCallback(to.container);
  if (!resolved) {
    throw missingItemMoveCallbackError(to.container);
  }
  if (resolved.operation === "move") {
    const event: ItemMoveEvent = {
      session: session?.handle ?? null,
      ...buildItemRunEvent(items),
      from: froms[0],
      to,
      froms: [...froms],
      beforeElement,
    };
    fireMutation(to.container, () => resolved.callback(event));
    return;
  }
  fireItemInsert(to.container, items, to.index, beforeElement, session);
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
): void {
  const onSwap = requireMutationCallback(a.container, "onItemSwap");
  const event: ItemSwapEvent = {
    session: session?.handle ?? null,
    a: {
      item: a.item,
      itemId: a.item.itemId,
      itemMetadata: a.item.metadata,
      container: a.container,
      containerMetadata: a.container.metadata,
      index: a.index,
    },
    b: {
      item: b.item,
      itemId: b.item.itemId,
      itemMetadata: b.item.metadata,
      container: b.container,
      containerMetadata: b.container.metadata,
      index: b.index,
    },
  };
  fireMutation(a.container, () => onSwap(event));
}

function buildDragItemHoverEvent(
  session: DragSession,
  item: Item,
  overItem: Item,
  container: Container,
): DragItemHoverEvent {
  return {
    session: session.handle,
    item,
    itemId: item.itemId,
    itemMetadata: item.metadata,
    overItem,
    overItemId: overItem.itemId,
    overItemMetadata: overItem.metadata,
    container,
    containerMetadata: container.metadata,
    pointer: { x: session.pointer.x, y: session.pointer.y },
  };
}

type HoverCallback = "onDragItemEnter" | "onDragItemMove" | "onDragItemLeave";

function fireDragItemHover(
  callback: HoverCallback,
  container: Container,
  item: Item,
  overItem: Item,
  session: DragSession,
): void {
  container.callbacks[callback]?.(
    buildDragItemHoverEvent(session, item, overItem, container),
  );
}

export function fireDragItemEnter(
  container: Container,
  item: Item,
  overItem: Item,
  session: DragSession,
): void {
  fireDragItemHover("onDragItemEnter", container, item, overItem, session);
}

export function fireDragItemMove(
  container: Container,
  item: Item,
  overItem: Item,
  session: DragSession,
): void {
  fireDragItemHover("onDragItemMove", container, item, overItem, session);
}

export function fireDragItemLeave(
  container: Container,
  item: Item,
  overItem: Item,
  session: DragSession,
): void {
  fireDragItemHover("onDragItemLeave", container, item, overItem, session);
}

export function fireGhostInsert(
  ghostItem: Item,
  beforeElement: HTMLElement | null,
): void {
  const state = ghostItem.ghostState;
  if (!state) throw new Error("SnapSort: ghost has no state.");
  const container = state.location.container;
  const onInsert = requireMutationCallback(container, "onGhostInsert");
  const event = buildGhostInsertEvent(state, beforeElement);
  fireMutation(container, () => onInsert(event));
}

export function fireGhostMove(
  previous: GhostState,
  next: GhostState,
  beforeElement: HTMLElement | null,
): void {
  const container = next.location.container;
  const onMove = requireMutationCallback(container, "onGhostMove");
  const event = buildGhostMoveEvent(previous, next, beforeElement);
  fireMutation(container, () => onMove(event));
}

export function fireGhostRemove(ghostItem: Item): void {
  const state = ghostItem.ghostState;
  if (!state) throw new Error("SnapSort: ghost has no state.");
  const container = state.location.container;
  const onRemove = requireMutationCallback(container, "onGhostRemove");
  const event = buildGhostRemoveEvent(state);
  fireMutation(container, () => onRemove(event));
}
