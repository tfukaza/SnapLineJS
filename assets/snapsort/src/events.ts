import type { Container } from "./container";
import type { Item } from "./item";
import type { DragSession } from "./drag/session";
import type { ItemId, ItemSnapshotMetadata } from "./snapshot";
import type { CollisionRect } from "@snap-engine/core/collision";

/**
 * A container + index location, used both for drag sources/destinations and
 * for the currently prospective drop target during a drag.
 */
export interface DragLocation {
  container: Container;
  containerMetadata: Record<string, unknown>;
  index: number;
}

/**
 * What committing the current drag should do to source data. Writable by
 * consumers (from `onDragStart` / `onDropTargetChange`) via `session.dropEffect`;
 * the core never infers this itself.
 *
 * - `"move"` (default): the original item is relocated.
 * - `"copy"`: commits through the same `onItemMove` path a move would — see
 *   `ItemMoveEvent`'s doc for the full contract (`from: null`, `origins`
 *   provenance). Flow mode spawns a fresh floating item at dragStart
 *   (`onDragClone`) whose permanent id carries through to commit; insertion
 *   mode never lifts anything, so the commit event carries the ORIGINAL
 *   (`items[i] === origins[i]`) and the consumer mints the duplicate's id.
 * - `"none"`: no mutation events fire; the original returns to its source slot.
 *   `onDragEnd` still reports the resolved destination (e.g. for a trash-bin
 *   drop, where the consumer removes the item themselves in `onDragEnd`).
 */
export type DropEffect = "move" | "copy" | "none";

/** Which role a ghost plays during a drag. See `DragSession.ghosts`. */
export type GhostRole = "target" | "source" | "pointer";

/**
 * Distinguishes a mid-drag relocation from the final placement on a mutation
 * event. `"preview"` fires as the drop target changes during a drag — apply
 * it to state, but gate side effects (server sync, undo checkpoints, etc.)
 * on `"commit"`, which fires once when the drag settles. Defaults to
 * `"commit"` on events that don't yet distinguish the two (pre-unified-
 * entries call sites); this will become load-bearing once previews are
 * fired (see the unified entries redesign).
 */
export type MutationPhase = "preview" | "commit";

export type VisualGeometryInvalidationReason =
  | "drag"
  | "ghost"
  | "animation"
  | "settle";

/**
 * Coalesced notification that SnapSort changed transient visual geometry.
 * Consumers can use this to invalidate geometry owned by another system
 * without SnapSort knowing what that system is.
 */
export interface VisualGeometryInvalidationEvent {
  root: Container;
  session: DragSession | null;
  items: readonly Item[];
  reasons: readonly VisualGeometryInvalidationReason[];
}

export interface ItemRemoveEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  /** The full removed run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  container: Container;
  containerMetadata: Record<string, unknown>;
  phase: MutationPhase;
}

export interface ItemInsertEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  /** The full inserted run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  container: Container;
  containerMetadata: Record<string, unknown>;
  /** Index of the first item in the run. */
  index: number;
  /** Element the whole run is inserted before (all items share one insertion point). */
  beforeElement: HTMLElement | null;
  phase: MutationPhase;
}

export interface ItemSwapParticipant {
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  container: Container;
  containerMetadata: Record<string, unknown>;
  /** This item's slot before the swap — after committing, `b`'s item occupies this slot (and vice versa). */
  index: number;
}

/**
 * Fired when `"swap"` mode commits: the occupants of `a`'s and `b`'s slots
 * trade places. No default: falls back to two `onItemMove` calls (further
 * falling back to `onItemInsert`) when unregistered, which is a correct
 * substitute for adjacent-in-the-same-container or cross-container swaps,
 * but reads as "each item independently moved" — not a strict pairwise
 * swap — for non-adjacent same-container slots, since `onItemMove` has no
 * way to say "leave everything in between untouched." Provide `onItemSwap`
 * for state models that need that distinction.
 */
export interface ItemSwapEvent {
  session: DragSession | null;
  a: ItemSwapParticipant;
  b: ItemSwapParticipant;
  phase: MutationPhase;
}

/**
 * Fired for a single semantic move of an item from one container/index to
 * another (including within the same container). Preferred over the
 * insert/remove primitives when the consumer's state model can express a
 * move as one operation.
 *
 * Also the commit event for a `dropEffect = "copy"` drag: a spawned item
 * (see `onDragClone`) has no source location, so `from`/`froms` are `null`
 * for it — the consumer's job is to recognize an unfamiliar `itemId` and
 * *add* an entry, exactly as it would for an item arriving from a container
 * whose state it doesn't track. `origins`/`originsMetadata` carry the
 * original item a spawned entry stands in for (`null` for a genuinely moved
 * item), for consumers that want provenance (undo/history). The permanent
 * entry the consumer creates on this event MUST reuse the spawned item's
 * existing `itemId` — the dragged clone instance is destroyed once the
 * consumer's own re-render takes over rendering the permanent entry, and
 * only a stable `itemId` bridges the two instances for FLIP/key lookups
 * (see `Item.itemKey`).
 */
export interface ItemMoveEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  /** The full moved run, ordered by original (document) index. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  /** Null when `item` was spawned (copy), not moved from anywhere. */
  from: DragLocation | null;
  to: DragLocation;
  /** Each item's source location, parallel to `items`; entries are null for spawned items. `from === froms[0]`. */
  froms: (DragLocation | null)[];
  /** The original item `item` was spawned from (copy), or null for a genuinely moved item. */
  originItem: Item | null;
  originItemId: ItemId | null;
  originItemMetadata: ItemSnapshotMetadata | null;
  /** Parallel to `items`/`froms`. */
  origins: (Item | null)[];
  originItemIds: (ItemId | null)[];
  originsMetadata: (ItemSnapshotMetadata | null)[];
  /** Element the whole run is inserted before (all items share one insertion point). */
  beforeElement: HTMLElement | null;
  phase: MutationPhase;
}

export interface GhostRect {
  x: number;
  y: number;
  width: number;
  height: number;
  insetLeft?: number;
  insetRight?: number;
}

/** Which drag lifecycle produced a ghost: a flow-layout spacer, or a floating insertion marker. */
export type GhostKind = "flow" | "marker";

export interface GhostEventBase {
  session: DragSession;
  kind: GhostKind;
  /** Which role this ghost plays in the current drag; see `GhostRole`. */
  role: GhostRole;
  container: Container;
  containerMetadata: Record<string, unknown>;
  original: Item;
  originalItemId: ItemId;
  originalMetadata: ItemSnapshotMetadata;
  /** The full dragged run this ghost represents, ordered. For a multi-item flow run, `original` is the member represented by this anchor; the single-item case is `items[0]`. */
  items: Item[];
  itemIds: ItemId[];
  ghostItem: Item;
  ghostItemId: ItemId;
  ghostMetadata: ItemSnapshotMetadata;
  ghostRect?: GhostRect | null;
}

export interface GhostCreateEvent extends GhostEventBase {}

export interface GhostInsertEvent extends GhostEventBase {
  index: number;
  beforeElement: HTMLElement | null;
}

/**
 * Fired when a ghost is removed from `container`'s list. For flow mode this
 * includes a run anchor RELOCATING to a different container (not just the
 * run being torn down at drop/cancel): `container` here is the one the
 * anchor is LEAVING, so an adapter keeping per-container ghost state must
 * treat this as "this container's ghost is gone," not only "the drag ended."
 */
export interface GhostRemoveEvent extends GhostEventBase {}

export type GhostEvent = GhostCreateEvent | GhostInsertEvent | GhostRemoveEvent;

/** @internal Passed between a lifecycle strategy and the Mutator; not part of the public callback surface. */
export interface GhostUpdateEvent {
  session: DragSession;
  kind: GhostKind;
  original: Item;
  container: Container | null;
  index: number;
  ghostRect?: GhostRect | null;
}

export interface DragStartEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  element: HTMLElement | null;
  source: DragLocation;
  /** Each item's source location, parallel to `items`. `source === sources[0]`. */
  sources: DragLocation[];
}

export interface DragEndEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  element: HTMLElement | null;
  source: DragLocation;
  /** Each item's source location, parallel to `items`. `source === sources[0]`. */
  sources: DragLocation[];
  /** Null when the item was dropped back to its source or the drag was cancelled. */
  destination: DragLocation | null;
}

/**
 * Fired on the source (root) container at drag start when
 * `session.dropEffect === "copy"`, BEFORE the drag is hoisted. The consumer
 * must materialize a clone in their own state for each `cloneItems` entry and
 * render it (bound via `itemObject`) inside a drop container. The framework
 * adapter's synchronous `flushMutation` transaction ensures each clone has a
 * DOM element before core hands the
 * drag off to the clones (`DragSession.handoff`) — the original items stay
 * exactly where they are, untouched and un-ghosted. If the consumer binds no
 * element, the copy drag is vetoed.
 *
 * From this point on, handling is identical to a move drag — hover, ghost
 * placement, and drop-target resolution never branch on copy vs move.
 * `cloneItems` is parallel to `items` (the originals). At drop, a clone with
 * a valid destination commits through the **same** `onItemMove` path a moved
 * item would (see `ItemMoveEvent` — `from`/`origins` distinguish "spawned"
 * from "moved" for consumers that care). A clone dropped with no valid
 * destination was never a real list member, so there is nothing to return —
 * `onItemRemove` fires instead so the consumer deletes what it created.
 */
export interface DragCloneEvent {
  session: DragSession;
  /** The original items (never moved). `item === items[0]`. */
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  sources: DragLocation[];
  /** Fresh clone items, parallel to `items`; the consumer binds each one's element. */
  cloneItems: Item[];
}

export interface DropTargetChangeEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  previous: DragLocation | null;
  current: DragLocation | null;
}

export interface CanDropEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  /** The primary item's source when available. */
  source: DragLocation | null;
  /** Source locations parallel to `items`; spawned items may have no source. */
  sources: readonly (DragLocation | null)[];
  container: Container;
  containerMetadata: Record<string, unknown>;
  /**
   * Candidate insertion index. `canDrop` is evaluated once per container per
   * drop-target resolution (not once per candidate slot) for performance, so
   * this reflects whichever candidate for this container was evaluated
   * first and should not be used for per-slot gating.
   */
  index: number;
}

/** A frozen world-space rectangle captured for the current drag resolution. */
export type DropPriorityRect = CollisionRect;

/**
 * Geometry and metadata supplied when a destination computes its candidate
 * priority. The callback runs once per eligible container per resolution;
 * its result applies to candidates owned directly by that container.
 */
export interface DropPriorityEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemSnapshotMetadata[];
  source: DragLocation | null;
  sources: readonly (DragLocation | null)[];
  container: Container;
  containerMetadata: Record<string, unknown>;
  /** The container's configured `dropPriority` before this callback overrides it. */
  staticPriority: number;
  pointer: { x: number; y: number };
  /** The primary dragged item's current world-space rectangle. */
  dragRect: DropPriorityRect;
  /** The destination's frozen border-box rectangle. */
  containerRect: DropPriorityRect;
  /** The destination's frozen content-box rectangle. */
  containerContentRect: DropPriorityRect;
  depth: number;
}

/**
 * Fired while dragging as the pointer's hitbox test starts, continues, or
 * stops matching another item's hitbox. Distinct from `onDropTargetChange`,
 * which tracks the resolved drop slot/gap — this tracks hovering over an
 * *item*, independent of any sort algorithm. `overItem`'s hitbox is
 * adjustable via `hitboxInset*`/`hitboxShape` metadata (see
 * `ItemSnapshotMetadata`). Used directly by swap mode; also available
 * generally for hover-driven UI (highlight-on-hover, previews, etc.).
 */
export interface DragItemHoverEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemSnapshotMetadata;
  overItem: Item;
  overItemId: ItemId;
  overItemMetadata: ItemSnapshotMetadata;
  container: Container;
  containerMetadata: Record<string, unknown>;
  pointer: { x: number; y: number };
}

export interface ContainerCallbacks {
  /** Preferred by state-backed frameworks: one semantic event per move. */
  onItemMove?: (event: ItemMoveEvent) => void;

  /** Primitives kept as building blocks; defaults perform direct DOM mutation. */
  onItemInsert?: (event: ItemInsertEvent) => void;
  onItemRemove?: (event: ItemRemoveEvent) => void;

  /**
   * Fired when `"swap"` mode commits. No default: falls back to two
   * `onItemMove` calls when unregistered (see `ItemSwapEvent`).
   */
  onItemSwap?: (event: ItemSwapEvent) => void;

  /**
   * Flow-mode (euclidean/progressive) copy: fired at drag start when
   * `dropEffect === "copy"` (see `DragCloneEvent`). The consumer must bind an
   * element to each clone, or the copy drag is vetoed. The clones then commit
   * at drop through the normal `onItemMove` path.
   */
  onDragClone?: (event: DragCloneEvent) => void;

  /** Fired on the source container. Returning `false` vetoes the drag before any state changes. */
  onDragStart?: (event: DragStartEvent) => void | false;
  onDragEnd?: (event: DragEndEvent) => void;

  /** Fired only when the prospective drop container/index actually changes. */
  onDropTargetChange?: (event: DropTargetChangeEvent) => void;

  /** Fired on the container owning `overItem`, once per hovered item, when the pointer's hitbox first matches it. */
  onDragItemEnter?: (event: DragItemHoverEvent) => void;
  /** Fired on the container owning `overItem` on every pointer move while its hitbox still matches. */
  onDragItemMove?: (event: DragItemHoverEvent) => void;
  /** Fired on the container owning `overItem` when the pointer's hitbox stops matching it. */
  onDragItemLeave?: (event: DragItemHoverEvent) => void;

  /**
   * Fired on the root container at most once per engine frame when transient
   * item geometry may have changed. Notification only; consumers decide what
   * external geometry, if any, to invalidate.
   */
  onVisualGeometryInvalidated?: (
    event: VisualGeometryInvalidationEvent,
  ) => void;

  /** Consulted while resolving candidates for `container`; return false to reject it for this drag. */
  canDrop?: (event: CanDropEvent) => boolean;

  /**
   * Override `container.dropPriority` for this drag resolution. Return
   * `undefined` to preserve the configured value. Higher-priority candidates
   * are considered before the active placement mode ranks candidate slots.
   */
  getDropPriority?: (event: DropPriorityEvent) => number | undefined;

  /** Ghost customization, unified across both drag lifecycles via `event.kind`. */
  createGhost?: (event: GhostCreateEvent) => HTMLElement | void | null;
  onGhostInsert?: (event: GhostInsertEvent) => void;
  onGhostRemove?: (event: GhostRemoveEvent) => void;

  /**
   * Run a state mutation inside the framework adapter's synchronous DOM
   * commit boundary. Framework adapters provide this automatically.
   */
  flushMutation?: (mutation: () => void) => void;

  /**
   * Wait for the caller's framework to flush DOM after SnapSort mutates data.
   *
   * @deprecated Use `flushMutation`. Promise-returning mutation waits cannot
   * guarantee that FLIP's inverse transform is installed before paint.
   */
  awaitMutation?: () => void | Promise<void>;
}
