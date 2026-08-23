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

/** A zero-thickness insertion boundary in world coordinates. */
export type InsertionGapSegment =
  | {
      readonly orientation: "horizontal";
      readonly x: number;
      readonly y: number;
      readonly length: number;
    }
  | {
      readonly orientation: "vertical";
      readonly x: number;
      readonly y: number;
      readonly length: number;
    };

/** One item immediately adjacent to the insertion marker's visual boundary. */
export interface InsertionMarkerNeighbor {
  readonly item: Item;
  readonly itemId: ItemId;
  readonly itemMetadata: ItemMetadata;
  /** Frozen world-space border box captured for this resolution. */
  readonly rect: Readonly<CollisionRect>;
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
}

interface RectGhostStateBase extends GhostStateBase {
  readonly rect: GhostRect;
}

/** Framework-ready render state for insertion placement feedback. */
export interface InsertionMarkerState extends GhostStateBase {
  readonly type: "insertion-marker";
  readonly location: GhostSlotLocation;
  readonly gap: InsertionGapSegment;
  readonly previous: InsertionMarkerNeighbor | null;
  readonly next: InsertionMarkerNeighbor | null;
  /** Whether committing this candidate preserves the dragged run's placement. */
  readonly isCurrentPlacement: boolean;
}

/** @internal Marker presentation before a transient ghost Item is allocated. */
export type InsertionMarkerPresentation = Pick<
  InsertionMarkerState,
  "gap" | "previous" | "next" | "isCurrentPlacement"
>;

export type GhostState =
  | (RectGhostStateBase & {
      readonly type: "source-spacer";
      readonly location: GhostSlotLocation;
    })
  | (RectGhostStateBase & {
      readonly type: "target-spacer";
      readonly location: GhostSlotLocation;
    })
  | InsertionMarkerState
  | (RectGhostStateBase & {
      readonly type: "pointer-preview";
      readonly location: GhostOverlayLocation;
    });

type GhostStatePlacementFor<State extends GhostState> = State extends GhostState
  ? State extends InsertionMarkerState
    ? Pick<
        State,
        "type" | "location" | "gap" | "previous" | "next" | "isCurrentPlacement"
      >
    : State extends { readonly rect: GhostRect }
      ? Pick<State, "type" | "location" | "rect">
      : never
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

/** The three explicit framework ghost-presence and relocation events. */
export type GhostLifecycleEvent =
  | GhostInsertEvent
  | GhostMoveEvent
  | GhostRemoveEvent;

export type GhostEvent = GhostCreateEvent | GhostLifecycleEvent;

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

/** Effective priority value that rejects every candidate owned by a Container. */
export const DROP_REJECT_PRIORITY = -1;

/** A frozen world-space rectangle captured for the current drag resolution. */
export type DropPriorityRect = CollisionRect;

/** Complete world-space geometry for one pointer-hover hitbox. */
export type ItemHitbox =
  | { shape: "rect"; rect: CollisionRect }
  | { shape: "circle"; center: { x: number; y: number }; radius: number };

/** Geometry supplied to a hovered item's direct owner for hitbox resolution. */
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

/**
 * Geometry and metadata supplied when a destination computes its candidate
 * priority. The callback runs once per candidate container per resolution;
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
  /**
   * Candidate insertion index. Policy is evaluated once per container per
   * resolution, so this reflects the first candidate generated for that
   * container and must not be used for per-slot gating.
   */
  index: number;
  /** The container's configured `dropPriority` before this callback overrides it. */
  staticPriority: number;
  pointer: { x: number; y: number };
  /**
   * The primary dragged item's virtual current world-space rectangle. Its
   * leading edge preserves the pointer-to-item offset captured at drag start.
   */
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
 * *item* associated with the currently resolved target. Outside swap mode,
 * this may be a direct child of that target or the nested target Container
 * itself. `overItem`'s hitbox can be customized by its direct owner's
 * `getItemHitbox` callback. Used directly by swap mode; also available
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
 * effects that already ran. Use `onDragStart` or `getDropPriority` for
 * supported rejection.
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
   * `onItemRemove` for its source. With a source `animation.move`, accepted
   * removals dispatch in the next coordinated frame before surviving Items
   * FLIP to their committed positions.
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
   * first matches for the currently resolved target. Outside swap mode, a
   * nested target Container can itself be `event.overItem`. Available in every
   * built-in mode.
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
   * Consulted once per candidate destination in every built-in resolver.
   * Override `container.dropPriority` for this resolution, return `undefined`
   * to preserve it, or return `DROP_REJECT_PRIORITY` to reject the destination.
   */
  getDropPriority?: (event: DropPriorityEvent) => number | undefined;

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
   * Root-dispatched. Fires when an existing ghost changes location or when an
   * insertion marker changes physical gap presentation at the same logical
   * location. `event.from`/`event.to` may therefore be equal.
   */
  onGhostMove?: (event: GhostMoveEvent) => void;

  /**
   * Root-dispatched. Fires when a present ghost becomes absent;
   * `event.ghost.location.container` identifies the last owner.
   */
  onGhostRemove?: (event: GhostRemoveEvent) => void;
}
