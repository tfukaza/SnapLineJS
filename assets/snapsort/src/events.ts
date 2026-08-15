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
  readonly container: Container;
  readonly containerMetadata: Record<string, unknown>;
  readonly index: number;
}

/**
 * What committing the current drag should do to source data. Consumers may
 * choose `"none"` for gestures that use the resolved destination without a
 * SnapSort mutation (for example, a trash target handled by `onDragEnd`).
 */
export type DropEffect = "move" | "none";

/** What follows the pointer during a drag, independent of placement feedback. */
export type DragVisual = "item" | "preview" | "none";

/** Which visual job a temporary ghost performs during a drag. */
export type GhostRole = "target" | "source" | "pointer";

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
}

/**
 * Fired for a single semantic move of an item from one container/index to
 * another (including within the same container). Preferred over the
 * insert/remove primitives when the consumer's state model can express a
 * move as one operation.
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
  from: DragLocation;
  to: DragLocation;
  /** Each item's source location, parallel to `items`. `from === froms[0]`. */
  froms: DragLocation[];
  /** Element the whole run is inserted before (all items share one insertion point). */
  beforeElement: HTMLElement | null;
}

export interface GhostRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Which visual form a ghost uses: `"flow"` is a layout spacer and `"marker"`
 * is an overlay used for either an insertion target or a pointer preview. Use
 * `GhostRole` to distinguish source, target, and pointer responsibilities.
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
  /** Source locations parallel to `items`; null when no drag source is available. */
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
   * Fires on the item's current direct owner for programmatic removal. An
   * ordinary move does not also emit `onItemRemove` on its source.
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
   * Fires directly on `event.container` when a ghost is created: a flow
   * placement/source spacer, an insertion target marker, or a root-owned
   * pointer preview. Not wrapped by `flushMutation`; `event.kind` and
   * `event.role` distinguish its form and responsibility.
   */
  createGhost?: (event: GhostCreateEvent) => HTMLElement | void | null;

  /**
   * Fires on the direct ghost owner (`event.container`) through that owner's
   * `flushMutation`: a flow source/target spacer, insertion target, or the root
   * pointer preview. May repeat to move or update a ghost.
   */
  onGhostInsert?: (event: GhostInsertEvent) => void;

  /**
   * Fires on the direct owner the ghost is leaving (`event.container`) through
   * that owner's `flushMutation`: a flow source/target spacer, insertion
   * target, or the root pointer preview.
   */
  onGhostRemove?: (event: GhostRemoveEvent) => void;

  /**
   * Integration hook, not a session event. SnapSort reads it from the same
   * receiver as the callback being wrapped: item move/insert/remove/swap,
   * ghost insert/remove, or root drop-target-change/drag-end.
   * Framework adapters provide it automatically to commit state and DOM
   * synchronously before SnapSort reads geometry. Drag start, ghost creation,
   * hover, policy, and visual-invalidation callbacks are not wrapped.
   */
  flushMutation?: (mutation: () => void) => void;
}
