import type { Container } from "./container";
import type { Item } from "./item";
import type { DragSession } from "./drag/session";
import type { ItemId, ItemMetadata } from "./snapshot";
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
 * consumers through `session.dropEffect` from `onDragStart` and, subject to
 * the lifecycle constraints below, `onDropTargetChange`; the core never
 * infers this itself.
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
 *
 * The built-in euclidean, progressive, and insertion lifecycles honor all
 * three effects. In euclidean/progressive mode, clone handoff happens only at
 * startup: choose `"copy"` in `onDragStart` and do not change to or from it
 * later; `onDropTargetChange` may still switch between `"move"` and `"none"`.
 * In insertion mode, the effect can also change during target updates. The
 * built-in swap lifecycle currently does not branch on `dropEffect`: setting
 * `"copy"` or `"none"` still follows the normal swap commit path. Treat swap
 * mode as `"move"`-only until that limitation is removed.
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
  itemMetadata: ItemMetadata;
  /** The full removed run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
  container: Container;
  containerMetadata: Record<string, unknown>;
  phase: MutationPhase;
}

export interface ItemInsertEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  /** The full inserted run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
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
  itemMetadata: ItemMetadata;
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
  itemMetadata: ItemMetadata;
  /** The full moved run, ordered by original (document) index. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
  /** Null when `item` was spawned (copy), not moved from anywhere. */
  from: DragLocation | null;
  to: DragLocation;
  /** Each item's source location, parallel to `items`; entries are null for spawned items. `from === froms[0]`. */
  froms: (DragLocation | null)[];
  /** The original item `item` was spawned from (copy), or null for a genuinely moved item. */
  originItem: Item | null;
  originItemId: ItemId | null;
  originItemMetadata: ItemMetadata | null;
  /** Parallel to `items`/`froms`. */
  origins: (Item | null)[];
  originItemIds: (ItemId | null)[];
  originsMetadata: (ItemMetadata | null)[];
  /** Element the whole run is inserted before (all items share one insertion point). */
  beforeElement: HTMLElement | null;
  phase: MutationPhase;
}

export interface GhostRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Which drag lifecycle produced a ghost: `"flow"` is a flow-layout spacer;
 * `"marker"` is an overlay used for either an insertion marker or swap's
 * pointer preview. Use `GhostRole` to distinguish target and pointer markers.
 */
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
  originalMetadata: ItemMetadata;
  /** The full dragged run this ghost represents, ordered. For a multi-item flow run, `original` is the member represented by this anchor; the single-item case is `items[0]`. */
  items: Item[];
  itemIds: ItemId[];
  ghostItem: Item;
  ghostItemId: ItemId;
  ghostMetadata: ItemMetadata;
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
  itemMetadata: ItemMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
  element: HTMLElement | null;
  source: DragLocation;
  /** Each item's source location, parallel to `items`. `source === sources[0]`. */
  sources: DragLocation[];
}

export interface DragEndEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
  element: HTMLElement | null;
  source: DragLocation;
  /** Each item's source location, parallel to `items`. `source === sources[0]`. */
  sources: DragLocation[];
  /**
   * Final resolved drop location, which may equal `source`. Null when the
   * lifecycle ends without a resolved destination.
   */
  destination: DragLocation | null;
}

/**
 * Fired on the tree root at drag start in euclidean/progressive mode when
 * `session.dropEffect === "copy"`, BEFORE the drag is hoisted. The direct
 * source is carried by `sources`; it is not the callback receiver. The
 * consumer must materialize a clone in their own state for each `cloneItems`
 * entry and render it (passed through the adapter's `item` prop) inside a drop
 * container. The framework adapter's synchronous `flushMutation` transaction
 * ensures each clone has a DOM element before core hands the drag off to the clones
 * (`DragSession.handoff`) — the original items stay exactly where they are,
 * untouched and un-ghosted. If the consumer binds no element, the copy drag
 * is vetoed.
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
  itemMetadata: ItemMetadata;
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
  sources: DragLocation[];
  /** Fresh clone items, parallel to `items`; the consumer binds each one's element. */
  cloneItems: Item[];
}

export interface DropTargetChangeEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
  previous: DragLocation | null;
  current: DragLocation | null;
}

export interface CanDropEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  /** The full dragged run, ordered. `item === items[0]` (single-item case: length 1). */
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
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

/** Complete world-space geometry for one pointer-hover hitbox. */
export type ItemHitbox =
  | { shape: "rect"; rect: CollisionRect }
  | { shape: "circle"; center: { x: number; y: number }; radius: number };

/** Geometry supplied to a candidate item's direct owner for hitbox resolution. */
export interface ItemHitboxEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  overItem: Item;
  overItemId: ItemId;
  overItemMetadata: ItemMetadata;
  container: Container;
  containerMetadata: Record<string, unknown>;
  pointer: { x: number; y: number };
  /** Frozen world-space border box used when no callback is configured. */
  defaultRect: CollisionRect;
}

/** Geometry supplied to an insertion candidate's direct destination. */
export interface InsertionMarkerRectEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
  source: DragLocation | null;
  sources: readonly (DragLocation | null)[];
  container: Container;
  containerMetadata: Record<string, unknown>;
  index: number;
  pointer: { x: number; y: number };
  dragRect: CollisionRect;
  containerRect: CollisionRect;
  containerContentRect: CollisionRect;
  /** Default final marker rectangle in world coordinates. */
  defaultRect: GhostRect;
}

/**
 * Geometry and metadata supplied when a destination computes its candidate
 * priority. The callback runs once per eligible container per resolution;
 * its result applies to candidates owned directly by that container.
 */
export interface DropPriorityEvent {
  session: DragSession | null;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  items: Item[];
  itemIds: ItemId[];
  itemsMetadata: ItemMetadata[];
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
 * *item* within the currently resolved target container. `overItem`'s hitbox
 * can be customized by the direct owner's `getItemHitbox` callback. Used
 * directly by swap mode; also available
 * generally for hover-driven UI (highlight-on-hover, previews, etc.). Each
 * callback is read from the direct container that owns `overItem`; it does not
 * bubble to the root.
 */
export interface DragItemHoverEvent {
  session: DragSession;
  item: Item;
  itemId: ItemId;
  itemMetadata: ItemMetadata;
  overItem: Item;
  overItemId: ItemId;
  overItemMetadata: ItemMetadata;
  container: Container;
  containerMetadata: Record<string, unknown>;
  pointer: { x: number; y: number };
}

/**
 * Callbacks installed on one specific `Container`.
 *
 * SnapSort reads each callback only from the receiver named below. Callbacks
 * are not inherited from a parent or root container and do not bubble through
 * the container tree. Event fields such as `source`, `container`, or `to`
 * describe related locations; they do not change which container receives
 * the callback. Install a shared handler explicitly on every container that
 * should use it.
 */
export interface ContainerCallbacks {
  /**
   * Fires on the direct destination for euclidean, progressive, and insertion
   * commits and for programmatic moves. An insertion-mode `"move"` or a
   * programmatic move that leaves the item in its existing placement is a
   * no-op. Vanilla swap fallback also emits two destination-owned moves when
   * `onItemSwap` is absent. Preferred by state-backed frameworks: one semantic
   * event per move.
   */
  onItemMove?: (event: ItemMoveEvent) => void;

  /**
   * Fires on the direct destination for primitive insertions and as the
   * fallback when that destination has no `onItemMove`, regardless of the
   * originating mode/operation. The Vanilla default performs direct DOM
   * mutation.
   */
  onItemInsert?: (event: ItemInsertEvent) => void;

  /**
   * Fires on the item's current direct owner for programmatic removal, or on
   * the container hosting a transient euclidean/progressive copy clone during
   * cleanup. An ordinary move does not also emit `onItemRemove` on its source.
   */
  onItemRemove?: (event: ItemRemoveEvent) => void;

  /**
   * Swap mode only: fires once on the dragged item's pre-swap direct owner
   * (`event.a.container`). `event.b.container` receives no second swap event.
   * Vanilla has no default and falls back to two destination-owned
   * `onItemMove` calls when unregistered (see `ItemSwapEvent`).
   */
  onItemSwap?: (event: ItemSwapEvent) => void;

  /**
   * Euclidean/progressive copy only: fires on the tree root at drag start when
   * `dropEffect === "copy"` (see `DragCloneEvent`). The consumer must bind an
   * element to each clone, or the copy drag is vetoed. The clones then commit
   * at drop through the normal destination-owned `onItemMove` path.
   */
  onDragClone?: (event: DragCloneEvent) => void;

  /**
   * Fires directly on the tree root in every built-in mode. Returning `false`
   * vetoes the drag before ghost or item lifecycle state changes;
   * `event.source.container` identifies the direct source.
   */
  onDragStart?: (event: DragStartEvent) => void | false;

  /**
   * Fires on the tree root when an activated drag ends in every built-in mode,
   * including cancellation and a return to the source. It does not fire when
   * startup is vetoed or fails before activation.
   */
  onDragEnd?: (event: DragEndEvent) => void;

  /**
   * Fires on the tree root in every built-in mode, but only when the
   * prospective direct container/index changes. `event.current` identifies
   * that target; the target container does not receive this callback.
   */
  onDropTargetChange?: (event: DropTargetChangeEvent) => void;

  /**
   * Fires directly on the container owning `event.overItem` when its hitbox
   * first matches within the currently resolved target container. Available
   * in every built-in mode.
   */
  onDragItemEnter?: (event: DragItemHoverEvent) => void;

  /**
   * Fires directly on the container owning `event.overItem` on each pointer
   * move while its hitbox still matches, in every built-in mode.
   */
  onDragItemMove?: (event: DragItemHoverEvent) => void;

  /**
   * Fires directly on the container owning `event.overItem` when its hitbox
   * stops matching or the drag ends, in every built-in mode.
   */
  onDragItemLeave?: (event: DragItemHoverEvent) => void;

  /**
   * Fires directly on the root container at most once per engine frame when
   * transient item geometry may have changed. It is independent of the
   * built-in mode and may also fire outside an active session. Notification
   * only; consumers decide what external geometry, if any, to invalidate.
   */
  onVisualGeometryInvalidated?: (
    event: VisualGeometryInvalidationEvent,
  ) => void;

  /**
   * Consulted directly on each candidate destination in every built-in
   * resolver; return false to reject that container for this resolution.
   */
  canDrop?: (event: CanDropEvent) => boolean;

  /**
   * Consulted directly on each eligible candidate destination in every
   * built-in resolver. Override `container.dropPriority` for this resolution,
   * or return `undefined` to preserve it.
   */
  getDropPriority?: (event: DropPriorityEvent) => number | undefined;

  /**
   * Consulted synchronously on an insertion candidate's direct destination.
   * Return the complete final marker rectangle in world coordinates. This is
   * a pure geometry calculation and is not wrapped by `flushMutation`.
   */
  getInsertionMarkerRect?: (event: InsertionMarkerRectEvent) => GhostRect;

  /**
   * Consulted synchronously on the direct owner of each hover candidate.
   * Return a world-space rectangle or circle. This is a pure geometry
   * calculation and is not wrapped by `flushMutation`.
   */
  getItemHitbox?: (event: ItemHitboxEvent) => ItemHitbox;

  /**
   * Fires directly on `event.container` when a ghost is created: the initial
   * source for euclidean/progressive move or none; the first valid destination
   * for euclidean/progressive copy or insertion; or the root for swap's pointer
   * ghost. Not wrapped by `flushMutation`; `event.kind` and `event.role`
   * distinguish the ghost lifecycle.
   */
  createGhost?: (event: GhostCreateEvent) => HTMLElement | void | null;

  /**
   * Fires on the direct ghost owner (`event.container`) through that owner's
   * `flushMutation`: the prospective target in flow/insertion modes, or the
   * root for swap's pointer ghost. May repeat to move or update a ghost.
   */
  onGhostInsert?: (event: GhostInsertEvent) => void;

  /**
   * Fires on the direct owner the ghost is leaving (`event.container`) through
   * that owner's `flushMutation`: a previous/current target in flow/insertion
   * modes, or the root for swap's pointer ghost.
   */
  onGhostRemove?: (event: GhostRemoveEvent) => void;

  /**
   * Integration hook, not a session event. SnapSort reads it from the same
   * receiver as the callback being wrapped: item move/insert/remove/swap,
   * ghost insert/remove, or root drag clone/drop-target-change/drag-end.
   * Framework adapters provide it automatically to commit state and DOM
   * synchronously before SnapSort reads geometry. Drag start, ghost creation,
   * hover, policy, and visual-invalidation callbacks are not wrapped.
   */
  flushMutation?: (mutation: () => void) => void;

  /**
   * Deprecated compatibility hook read from the same receiver after a wrapped
   * mutation, and only when that receiver has no `flushMutation`. Returned
   * promises are not awaited because SnapSort cannot cross a paint boundary.
   *
   * @deprecated Use `flushMutation`. Promise-returning mutation waits cannot
   * guarantee that FLIP's inverse transform is installed before paint.
   */
  awaitMutation?: () => void | Promise<void>;
}
