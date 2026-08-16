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
 * trade places. Every adapter must provide this atomic operation; the Vanilla
 * adapter exchanges the two DOM nodes through temporary placeholders.
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

export interface GhostSlotLocation {
  readonly type: "slot";
  readonly container: Container;
  readonly containerMetadata: Record<string, unknown>;
  /**
   * Zero-based position in the materialized flow sequence. Ordinary
   * non-dragged entries and earlier source/target spacers consume positions;
   * dragged entries retained by a framework and overlay ghosts do not. Local
   * spacer positions must be unique, reachable non-negative integers.
   */
  readonly index: number;
}

export interface GhostOverlayLocation {
  readonly type: "overlay";
  readonly container: Container;
  readonly containerMetadata: Record<string, unknown>;
}

export type GhostLocation = GhostSlotLocation | GhostOverlayLocation;

/**
 * Immutable ghost render state. Framework adapters keep these values in
 * framework state; the Vanilla adapter applies them directly to the DOM.
 */
export interface GhostStateBase {
  readonly session: DragSession;
  readonly original: Item;
  readonly originalItemId: ItemId;
  readonly originalMetadata: ItemMetadata;
  readonly items: readonly Item[];
  readonly itemIds: readonly ItemId[];
  readonly ghostItem: Item;
  readonly ghostItemId: ItemId;
  readonly ghostMetadata: ItemMetadata;
  readonly rect: GhostRect;
}

export type GhostState =
  | (GhostStateBase & {
      readonly type: "source-spacer";
      readonly location: GhostSlotLocation;
    })
  | (GhostStateBase & {
      readonly type: "target-spacer";
      readonly location: GhostSlotLocation;
    })
  | (GhostStateBase & {
      readonly type: "insertion-marker";
      readonly location: GhostSlotLocation;
    })
  | (GhostStateBase & {
      readonly type: "pointer-preview";
      readonly location: GhostOverlayLocation;
    });

type GhostStatePlacementFor<State extends GhostState> = State extends GhostState
  ? Pick<State, "type" | "location">
  : never;

/** A ghost variant paired with the only location kind that it can occupy. */
export type GhostStatePlacement = GhostStatePlacementFor<GhostState>;

export interface GhostCreateEvent {
  readonly operation: "create";
  readonly ghost: GhostState;
}

type GhostInsertEventFor<State extends GhostState> = State extends GhostState
  ? {
      readonly operation: "insert";
      readonly ghost: State;
      readonly to: State["location"];
      readonly beforeElement: HTMLElement | null;
    }
  : never;

type GhostMoveEventFor<State extends GhostState> = State extends GhostState
  ? {
      readonly operation: "move";
      readonly ghost: State;
      readonly from: State["location"];
      readonly to: State["location"];
      readonly beforeElement: HTMLElement | null;
    }
  : never;

type GhostRemoveEventFor<State extends GhostState> = State extends GhostState
  ? {
      readonly operation: "remove";
      readonly ghost: State;
      readonly from: State["location"];
    }
  : never;

export type GhostInsertEvent = GhostInsertEventFor<GhostState>;
export type GhostMoveEvent = GhostMoveEventFor<GhostState>;
export type GhostRemoveEvent = GhostRemoveEventFor<GhostState>;

export type GhostEvent =
  | GhostCreateEvent
  | GhostInsertEvent
  | GhostMoveEvent
  | GhostRemoveEvent;

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
 * SnapSort reads each callback only from the receiver named below, following
 * one rule: anything that mutates or renders application/ghost state resolves
 * on the root container's controlled `callbacks` property (falling back to
 * the root-scoped adapter),
 * while anything consulted about a specific container's policy, geometry, or
 * hover reads that container directly. Root-dispatched callbacks cannot be
 * registered on a descendant container: construction, assignment, and subtree
 * attachment reject them. Event fields such as `container`, `from`/`froms`,
 * `to`, or `a`/`b` identify the semantic containers instead.
 *
 * Item and ghost representation callbacks are synchronous commands inside the
 * root adapter's commit boundary. They must finish their projection and return
 * normally. Throwing is an integration fault, not a transaction veto: SnapSort
 * lets the original exception propagate unchanged. During scheduled drag work,
 * the engine boundary reports it and SnapSort queues transient core cleanup
 * before the next paint. It cannot roll back arbitrary application or DOM side
 * effects that already ran. Use `onDragStart` or `canDrop` for supported
 * rejection.
 */
export interface ContainerCallbacks {
  /**
   * Root-dispatched. Fires for euclidean, progressive, and insertion commits
   * and for programmatic moves; `event.froms`/`event.to` identify the source
   * and destination containers. An insertion-mode `"move"` or a programmatic
   * move that leaves the item in its existing placement is a no-op. Preferred
   * by state-backed adapters: one semantic event per move.
   */
  onItemMove?: (event: ItemMoveEvent) => void;

  /**
   * Root-dispatched. Fires for primitive insertions and as the fallback when
   * the root has no `onItemMove`, regardless of the originating
   * mode/operation; `event.container` identifies the destination. The Vanilla
   * default performs direct DOM mutation.
   */
  onItemInsert?: (event: ItemInsertEvent) => void;

  /**
   * Root-dispatched. Fires for programmatic removal; `event.container`
   * identifies the item's direct owner. An ordinary move does not also emit
   * `onItemRemove` for its source.
   */
  onItemRemove?: (event: ItemRemoveEvent) => void;

  /**
   * Root-dispatched, swap mode only: fires once per swap. `event.a` is the
   * dragged item's pre-swap slot and `event.b` the other item's; no second
   * swap event exists. The Vanilla adapter provides an atomic DOM
   * implementation.
   */
  onItemSwap?: (event: ItemSwapEvent) => void;

  /**
   * Root-dispatched in every built-in mode. Returning `false`
   * vetoes the drag before ghost or item lifecycle state changes;
   * `event.source.container` identifies the direct source.
   */
  onDragStart?: (event: DragStartEvent) => void | false;

  /**
   * Root-dispatched when an activated drag ends in every built-in mode,
   * including cancellation and a return to the source. It does not fire when
   * startup is vetoed or fails before activation.
   */
  onDragEnd?: (event: DragEndEvent) => void;

  /**
   * Root-dispatched in every built-in mode, but only when the
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
   * Root-dispatched at most once per engine frame when
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
   * a pure geometry calculation and is not wrapped by the adapter commit.
   */
  getInsertionMarkerRect?: (event: InsertionMarkerRectEvent) => GhostRect;

  /**
   * Consulted synchronously on the direct owner of each hover candidate.
   * Return a world-space rectangle or circle. This is a pure geometry
   * calculation and is not wrapped by the adapter commit.
   */
  getItemHitbox?: (event: ItemHitboxEvent) => ItemHitbox;

  /**
   * Root-dispatched. Fires when a ghost becomes present;
   * `event.ghost.location.container` identifies the destination.
   */
  onGhostInsert?: (event: GhostInsertEvent) => void;

  /**
   * Root-dispatched. Fires once when an existing ghost changes location;
   * `event.from`/`event.to` identify the source and destination containers.
   */
  onGhostMove?: (event: GhostMoveEvent) => void;

  /**
   * Root-dispatched. Fires when a present ghost becomes absent;
   * `event.ghost.location.container` identifies the last owner.
   */
  onGhostRemove?: (event: GhostRemoveEvent) => void;
}
