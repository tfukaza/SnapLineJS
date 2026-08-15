import type { AnimationObject } from "@snap-engine/core/animation";
import type {
  GestureHandoffControl,
  dragStartProp,
  dragProp,
} from "@snap-engine/core";
import type { Container } from "../container";
import type { Item } from "../item";
import { stageVisualRectBeforeMutation } from "../internal/visual-rect";
import { placeItemAt } from "../internal/tree-mutation";
import { findHoveredItem, type DropCandidate } from "../algorithm";
import {
  buildDragEndEvent,
  buildDragLocation,
  buildDragStartEvent,
  buildDropTargetChangeEvent,
} from "../event-builders";
import type {
  DragLocation,
  DragVisual,
  DropEffect,
  GhostRect,
  GhostRole,
} from "../events";
import {
  fireDragItemEnter,
  fireDragItemLeave,
  fireDragItemMove,
  fireOptionalMutation,
} from "../mutation";
import type { SortStrategy } from "./drop-strategy";
import { resetItemVisual } from "./item-visual";
import { clearDragSession } from "./session-store";

export type DragSessionStatus = "pending" | "active" | "dropping" | "ended";

export interface DragSession {
  readonly root: Container;
  readonly pointerId: number;
  readonly items: readonly Item[];
  readonly sources: readonly DragLocation[];
  readonly pressedItem: Item;
  readonly primaryItem: Item;
  readonly start: Readonly<{ x: number; y: number }>;
  readonly pointer: Readonly<{ x: number; y: number }>;
  readonly status: DragSessionStatus;
  dragVisual: DragVisual;
  dropEffect: DropEffect;
  handoff(replacements: readonly Item[]): void;
}

/** @internal Ghost placement the lifecycle strategy is currently targeting. */
export interface GhostTarget {
  ghostItem: Item;
  container: Container;
  index: number;
  ghostRect?: GhostRect | null;
}

/** @internal Direction-aware size of the whole dragged group, used to size a single group ghost/marker. */
export interface GroupDimensions {
  maxW: number;
  maxH: number;
  sumW: number;
  sumH: number;
}

function reportDragSessionError(error: unknown): void {
  const reportedError =
    error instanceof Error ? error : new Error(String(error));
  const reportError = globalThis.reportError;
  if (typeof reportError === "function") {
    reportError(reportedError);
    return;
  }
  console.error(reportedError);
}

function freezePoint(point: { x: number; y: number }) {
  return Object.freeze({ x: point.x, y: point.y });
}

function freezeLocation(location: DragLocation): DragLocation {
  return Object.freeze({ ...location });
}

class PublicDragSession implements DragSession {
  readonly #controller: DragSessionController;

  constructor(controller: DragSessionController) {
    this.#controller = controller;
    Object.freeze(this);
  }

  get root() {
    return this.#controller.root;
  }
  get pointerId() {
    return this.#controller.pointerId;
  }
  get items() {
    return this.#controller.items;
  }
  get sources() {
    return this.#controller.sources;
  }
  get pressedItem() {
    return this.#controller.pressedItem;
  }
  get primaryItem() {
    return this.#controller.primaryItem;
  }
  get start() {
    return this.#controller.start;
  }
  get pointer() {
    return this.#controller.pointer;
  }
  get status() {
    return this.#controller.status;
  }
  get dragVisual() {
    return this.#controller.dragVisual;
  }
  set dragVisual(value: DragVisual) {
    this.#controller.dragVisual = value;
  }
  get dropEffect() {
    return this.#controller.dropEffect;
  }
  set dropEffect(value: DropEffect) {
    this.#controller.dropEffect = value;
  }
  handoff(replacements: readonly Item[]): void {
    this.#controller.handoff(replacements);
  }
}

/**
 * @internal Runtime controller for one drag gesture. Its `handle` is the only
 * session object exposed through public callbacks and `root.dragSession`.
 */
export class DragSessionController {
  readonly handle: DragSession;
  readonly root: Container;
  /** Pointer id driving this drag (from `dragStartProp`). */
  readonly pointerId: number;
  // TODO: Feels hacky?
  readonly #handoffTo: GestureHandoffControl["handoffTo"];
  /**
   * The items currently receiving this drag. Stable except across `handoff`.
   * Ordered by the original run's document order (lowest first).
   */
  items!: readonly Item[];
  sources: readonly DragLocation[];
  /** The item the pointer actually grabbed — may differ from `items[0]` (the run head) for disjoint selections. Anchors pointer-follow geometry. Replaced on `handoff`. */
  // TODO: Can be unified with items?
  pressedItem!: Item;
  /** `items` as a Set, for O(1) exclusion checks in layout/algorithm code. */
  itemSet!: Set<Item>;
  /** @internal Current participants' mounted locations. Public `sources` always remain the gesture origins. */
  activeSources!: readonly DragLocation[];
  readonly #touchedItems = new Set<Item>();
  /** Direction-aware bounding size of the whole dragged group, computed once drag snapshots are captured. Degenerates to the single item's box when `items.length === 1`. */
  groupDims: GroupDimensions | null = null;
  /** Per-item constant visual offset (relative to `pressedItem`) so companions preview the collapsed run while hoisted. */
  readonly groupVisualOffsets: Map<Item, { x: number; y: number }> = new Map();
  readonly strategy: SortStrategy;
  status: DragSessionStatus = "pending";
  /** @internal True when a lifecycle is dropping only to unwind a failed drag. */
  cancelled = false;

  /**
   * What committing this drag should do to source data. Defaults to `"move"`.
   * Consumers may set `"none"` for a no-op (for example, a trash target).
   */
  #dropEffect: DropEffect = "move";

  get dropEffect(): DropEffect {
    return this.#dropEffect;
  }

  set dropEffect(value: DropEffect) {
    if (this.status !== "pending" && this.status !== "active") {
      throw new Error(
        "DragSession.dropEffect can only be changed before dropping begins.",
      );
    }
    if (value !== "move" && value !== "none") {
      throw new Error(
        `DragSession.dropEffect: unknown effect "${String(value)}".`,
      );
    }
    this.#dropEffect = value;
  }

  #dragVisual: DragVisual;

  /**
   * What follows the pointer. This may be changed while the session is
   * pending (normally from `onDragStart`) and is fixed once activation begins.
   */
  get dragVisual(): DragVisual {
    return this.#dragVisual;
  }

  set dragVisual(value: DragVisual) {
    if (this.status !== "pending") {
      throw new Error(
        "DragSession.dragVisual can only be changed during onDragStart.",
      );
    }
    if (value !== "item" && value !== "preview" && value !== "none") {
      throw new Error(
        `DragSession.dragVisual: unknown visual "${String(value)}".`,
      );
    }
    this.#dragVisual = value;
  }

  start: Readonly<{ x: number; y: number }>;
  pointer: Readonly<{ x: number; y: number }>;
  offset: { x: number; y: number } = { x: 0, y: 0 };

  /**
   * Ghosts currently live for this drag, keyed by role. Most lifecycles only
   * ever populate `"target"` (the placeholder tracking the prospective drop
   * slot); `"source"` and `"pointer"` hold
   * a slot open or represent the pointer-following visual without disturbing
   * the target ghost. Ghosts can be added, moved, or removed independently at
   * any point during a drag.
   */
  readonly ghosts: Map<GhostRole, Item> = new Map();

  /**
   * Flow-mode target ghosts: one logical anchor per dragged member, ordered
   * to parallel `items`, inserted as a contiguous run at the prospective drop
   * slot. Each anchor fires its own `createGhost`/`onGhostInsert` (with the
   * full `items` list), so the framework adapter decides whether to render
   * them as separate ghosts, one merged ghost, or none — the core never
   * forces a single group-sized spacer. Empty for insertion/swap modes, which
   * use `ghosts` (`"target"`/`"pointer"`) instead. The run head
   * (`flowGhostRun[0]`) is what `ghostItem`/`pendingGhostTarget` track.
   */
  readonly flowGhostRun: Item[] = [];

  /** @internal Source-slot spacers used when insertion/swap hoist real Items. */
  readonly sourceGhostRun: Item[] = [];

  /** Convenience accessor for the `"target"` ghost — the placeholder most lifecycles track. */
  get ghostItem(): Item | null {
    return this.ghosts.get("target") ?? null;
  }

  set ghostItem(value: Item | null) {
    if (value) {
      this.ghosts.set("target", value);
    } else {
      this.ghosts.delete("target");
    }
  }

  /** The ghost placement most recently requested by the lifecycle strategy. */
  pendingGhostTarget: GhostTarget | null = null;
  /** Last drop candidate resolved by the drop-target strategy (raw, snapshot-space index). */
  dropTarget: DropCandidate | null = null;
  /** The item whose hitbox the pointer is currently over, if any — drives `onDragItemEnter`/`Move`/`Leave`. */
  hoveredItem: Item | null = null;

  /**
   * @internal FLIP/positioning bookkeeping for dragged-item visuals, keyed
   * per dragged item (each member can live under a different original DOM
   * parent).
   */
  readonly dragCoordinateParent: Map<Item, Item> = new Map();
  /** @internal */
  readonly dragLayoutPosition: Map<Item, { x: number; y: number }> = new Map();
  /** @internal Visual top-left of each member when this gesture began, before active FLIP transforms are removed from the frozen layout snapshot. */
  readonly dragVisualStart: Map<Item, { x: number; y: number }> = new Map();
  /** @internal */
  dragTransformSyncAnimation: AnimationObject | null = null;

  constructor(
    root: Container,
    items: Item[],
    sources: DragLocation[],
    strategy: SortStrategy,
    prop: dragStartProp,
    pressedItem: Item = items[0],
  ) {
    this.handle = new PublicDragSession(this);
    this.root = root;
    this.sources = Object.freeze(sources.map(freezeLocation));
    this.#setParticipants(items, sources.slice(), pressedItem);
    this.strategy = strategy;
    this.#dragVisual =
      strategy.mode === "insertion"
        ? "none"
        : strategy.mode === "swap"
          ? "preview"
          : "item";
    this.pointerId = prop.pointerId;
    this.#handoffTo = prop.handoffTo;
    this.start = freezePoint(prop.start);
    this.pointer = freezePoint(prop.start);
  }

  #setParticipants(
    items: readonly Item[],
    activeSources: readonly DragLocation[],
    pressedItem: Item,
  ): void {
    if (items.length === 0 || items.length !== activeSources.length) {
      throw new Error(
        "DragSession: items and active sources must be non-empty parallel runs.",
      );
    }
    const itemSet = new Set(items);
    if (itemSet.size !== items.length) {
      throw new Error("DragSession: participants must be unique.");
    }
    if (!itemSet.has(pressedItem)) {
      throw new Error("DragSession: pressedItem must be a participant.");
    }
    this.items = Object.freeze([...items]);
    this.activeSources = Object.freeze(activeSources.map(freezeLocation));
    this.pressedItem = pressedItem;
    this.itemSet = itemSet;
    for (const item of items) this.#touchedItems.add(item);
  }

  /**
   * Transfer this gesture to an already-mounted parallel run. Handoff changes
   * input/session ownership only: it never creates, destroys, inserts, removes,
   * or otherwise manages application state for either run. Public `sources`
   * continue to describe where the gesture began. Call it synchronously from
   * `onDragStart`, before the selected drag visual is activated.
   *
   * Validation and native input transfer complete before session fields are
   * changed, so a rejected handoff leaves the current participants unchanged.
   */
  handoff(replacements: readonly Item[]): void {
    if (this.status !== "pending") {
      throw new Error(
        "DragSession.handoff can only be called during onDragStart.",
      );
    }
    if (replacements.length !== this.items.length) {
      throw new Error(
        "DragSession.handoff: replacements must be parallel to the dragged items.",
      );
    }

    const origins = this.items;
    const unique = new Set(replacements);
    if (unique.size !== replacements.length) {
      throw new Error("DragSession.handoff: replacements must be unique.");
    }
    if (replacements.some((replacement) => this.itemSet.has(replacement))) {
      throw new Error(
        "DragSession.handoff: replacements must not include the current dragged items.",
      );
    }

    const replacementSources = replacements.map((replacement) => {
      if (
        replacement.engine !== this.root.engine ||
        replacement.isDeleteRequested
      ) {
        throw new Error(
          "DragSession.handoff: every replacement must be live in the session engine.",
        );
      }
      if (replacement.isGhost) {
        throw new Error(
          "DragSession.handoff: pointer previews and other Ghosts cannot receive an Item handoff.",
        );
      }
      if (replacement.rootContainer !== this.root) {
        throw new Error(
          "DragSession.handoff: every replacement must belong to the session root.",
        );
      }
      const { container, index } = replacement.getIndexAndContainer();
      if (!container || index < 0) {
        throw new Error(
          "DragSession.handoff: every replacement must be attached to a container.",
        );
      }
      const element = replacement.element;
      if (
        !element?.isConnected ||
        !container.element ||
        element.parentElement !== container.element
      ) {
        throw new Error(
          "DragSession.handoff: every replacement must have a connected element directly inside its container.",
        );
      }
      return buildDragLocation(container, index);
    });

    const pressedIndex = origins.indexOf(this.pressedItem);
    const nextPressedItem =
      replacements[pressedIndex === -1 ? 0 : pressedIndex];

    // Native capture can reject a stale destination. Transfer before changing
    // SnapSort bookkeeping so that failure is atomic from the session's side.
    this.#handoffTo(nextPressedItem);

    replacements.forEach((replacement, i) => {
      replacement.adoptDragSnapshotFrom(origins[i]);
      const visualStart = this.dragVisualStart.get(origins[i]);
      if (visualStart) {
        this.dragVisualStart.set(replacement, { ...visualStart });
      }
      const groupOffset = this.groupVisualOffsets.get(origins[i]);
      if (groupOffset) {
        this.groupVisualOffsets.set(replacement, { ...groupOffset });
      }
      this.#touchedItems.add(replacement);
    });

    this.#setParticipants(replacements, replacementSources, nextPressedItem);
  }

  /** The run head — lowest original index, first element of `items`. Used as the singular `item` in backwards-compatible event fields. */
  get primaryItem(): Item {
    return this.items[0];
  }

  /**
   * Compute this session's group dimensions from each member's drag
   * snapshot box. Called once drag snapshots are captured (READ_1 of
   * `begin`). Degenerates to the pressed item's own box for a single item.
   */
  // TODO: Need to factor in gaps between items
  private computeGroupDims(): GroupDimensions {
    let maxW = 0;
    let maxH = 0;
    let sumW = 0;
    let sumH = 0;
    let prevBox: {
      width: number;
      height: number;
      margin: { top: number; bottom: number; left: number; right: number };
    } | null = null;
    for (const member of this.items) {
      const box = member.dragSnapshot?.box;
      if (!box) continue;
      maxW = Math.max(maxW, box.width);
      maxH = Math.max(maxH, box.height);
      const columnGap = prevBox
        ? Math.max(prevBox.margin.bottom, box.margin.top)
        : 0;
      const rowGap = prevBox
        ? Math.max(prevBox.margin.right, box.margin.left)
        : 0;
      sumH += box.height + columnGap;
      sumW += box.width + rowGap;
      prevBox = box;
    }
    return { maxW, maxH, sumW, sumH };
  }

  /** Schedules the READ_1/WRITE_1 work for starting a drag; see FlowGhostLifecycle/InsertionMarkerLifecycle for the mode-specific WRITE_1 continuation. */
  begin(prop: dragStartProp): void {
    const item = this.pressedItem;
    const root = this.root;

    item.schedule(
      () => {
        if (this.#isEnded()) return;
        this.pointer = freezePoint(prop.start);
        this.start = freezePoint(prop.start);
        for (const member of this.items) {
          const visual = member.readDom({ unapplyTransform: false });
          this.dragVisualStart.set(member, { x: visual.x, y: visual.y });
        }
        const itemVisualStart = this.dragVisualStart.get(item) ?? {
          x: item.worldTransform.x,
          y: item.worldTransform.y,
        };
        this.offset = {
          x: prop.start.x - itemVisualStart.x,
          y: prop.start.y - itemVisualStart.y,
        };
        root.readDragSnapshotTree();
        root.captureDragSnapshotTree();
        this.groupDims = this.computeGroupDims();
      },
      { stage: "READ_1", queueId: `drag-start-offset-${item.id}` },
    );

    item.schedule(
      async () => {
        if (this.#isEnded()) return;
        let vetoed = false;
        try {
          vetoed =
            root.callbacks?.onDragStart?.(buildDragStartEvent(this)) === false;
          if (!vetoed) {
            this.strategy.lifecycle.validateStart?.(this);
          }
        } catch (error) {
          this.#endBeforeActivation(error);
          return;
        }
        if (vetoed) {
          this.#endBeforeActivation();
          return;
        }

        try {
          this.status = "active";
          await this.strategy.lifecycle.dragStart(this);
          if (this.#isEnded()) {
            this.#clearSessionState();
            return;
          }
          for (const member of this.items) {
            if (member.element) {
              member.element.dataset.snapsortDragging = "true";
            }
          }
        } catch (error) {
          this.#cancelAfterError(error);
        }
      },
      { stage: "WRITE_1" },
    );
  }

  pointerMove(prop: dragProp): void {
    const item = this.primaryItem;
    item.schedule(
      () => {
        if (this.status !== "active") return;
        this.pointer = freezePoint(prop.position);
        const ghostItem = this.ghostItem;
        if (ghostItem) stageVisualRectBeforeMutation(ghostItem);
      },
      { stage: "READ_1", queueId: `drag-read-${item.id}` },
    );
    item.schedule(
      async () => {
        if (this.status !== "active") return;
        try {
          this.pointer = freezePoint(prop.position);
          await this.updateDropTarget();
          await this.strategy.lifecycle.dragMove(this);
        } catch (error) {
          this.#cancelAfterError(error);
        }
      },
      { stage: "WRITE_1", queueId: `drag-${item.id}` },
    );
    this.root.queueReadTree("READ_2", `drag-${item.id}`);
  }

  #endBeforeActivation(error?: unknown): void {
    if (error !== undefined) {
      reportDragSessionError(error);
    }
    this.#clearSessionState();
  }

  #isEnded(): boolean {
    return this.status === "ended";
  }

  #cancelAfterError(error: unknown): void {
    reportDragSessionError(error);
    this.cancel();
  }

  /** @internal Unwinds an input-cancelled drag without committing a drop. */
  cancel(): void {
    if (this.status === "dropping" || this.status === "ended") return;

    this.cancelled = true;
    if (this.status === "pending") {
      this.#clearSessionState();
      return;
    }
    this.status = "dropping";
    this.dragTransformSyncAnimation?.cancel();
    this.dragTransformSyncAnimation = null;
    this.#dropEffect = "none";

    try {
      const lifecycle = this.strategy.lifecycle;
      // TODO: Have consistent lifecycle API so this if statement is not needed
      if (lifecycle.cancel) {
        lifecycle.cancel(this);
      } else {
        lifecycle.drop(this);
      }
    } catch (cleanupError) {
      reportDragSessionError(cleanupError);
      this.#forceEndAfterError();
    }
  }

  /** @internal Ensure a throwing scheduled drop callback cannot strand state. */
  scheduleDropFinalizer(): void {
    // Consumer callbacks can throw again while the scheduled drop unwinds.
    // A later-stage watchdog guarantees the session and visual flags do not
    // remain stuck even when that cleanup task aborts early.
    this.root.schedule(
      () => {
        if (this.status !== "ended") {
          this.#forceEndAfterError();
        }
      },
      {
        stage: "WRITE_3",
        queueId: `drag-error-finalize-${this.pressedItem.id}`,
      },
    );
  }

  #clearSessionState(): void {
    this.dragTransformSyncAnimation?.cancel();
    this.dragTransformSyncAnimation = null;
    this.status = "ended";
    clearDragSession(this.root, this);
    this.dragCoordinateParent.clear();
    this.dragLayoutPosition.clear();
    this.dragVisualStart.clear();
    this.groupVisualOffsets.clear();
    this.groupDims = null;
    this.pendingGhostTarget = null;
    this.dropTarget = null;
    this.hoveredItem = null;
    this.flowGhostRun.length = 0;
    this.sourceGhostRun.length = 0;
    this.ghosts.clear();
    this.root.clearDragSnapshotTree();
    this.clearDraggingFlags();
  }

  /** @internal Clear participant drag markers without writing through unmounted DOM. */
  clearDraggingFlags(): void {
    for (const member of this.#touchedItems) {
      if (member.element?.isConnected)
        delete member.element.dataset.snapsortDragging;
    }
  }

  /** @internal Complete a successful or cancelled lifecycle after mode-specific commits. */
  complete(destination: DragLocation | null): void {
    try {
      this.clearHoveredItem();
    } catch (error) {
      this.#clearSessionState();
      throw error;
    }
    this.#clearSessionState();
    fireOptionalMutation(
      this.root,
      this.root.callbacks?.onDragEnd,
      buildDragEndEvent(this, destination),
    );
  }

  #forceEndAfterError(): void {
    const members = [...this.items];
    resetItemVisual(this);

    const ghosts = new Set([
      ...this.flowGhostRun,
      ...this.sourceGhostRun,
      ...this.ghosts.values(),
    ]);
    for (const ghost of ghosts) ghost.destroy(false);

    members.forEach((member, i) => {
      if (member.parent) return;
      const source = this.activeSources[i];
      if (!source) return;
      placeItemAt(
        source.container,
        member,
        Math.min(source.index, source.container.itemOrderedList.length),
      );
    });

    this.#clearSessionState();
  }

  /**
   * Compute the current drop target and move the ghost when the target changes.
   * Mode-specific translation/comparison is delegated to the lifecycle strategy;
   * this method owns the shared "did the target change" bookkeeping and the
   * `onDropTargetChange` callback.
   */
  async updateDropTarget(): Promise<void> {
    const item = this.primaryItem;
    const root = this.root;
    // Defensive guard for a drag-start/drag race: the deeper fix should live in
    // the engine scheduler as built-in debounce/coalescing support for input
    // updates that depend on earlier READ/WRITE phases.
    if (!root.hasDragSnapshotTree() || !item.dragSnapshot) {
      return;
    }

    const lifecycle = this.strategy.lifecycle;
    const target = this.strategy.dropTarget.resolve(item, root, this);
    if (!target) {
      // No valid candidate anywhere (e.g. the pointer left every drop-eligible
      // container). The target ghost should not linger over a target that no
      // longer exists — clear it and report the loss, same as any other
      // drop-target change.
      const previousGhostLocation = lifecycle.currentGhostLocation(this);
      if (previousGhostLocation || this.dropTarget) {
        this.dropTarget = null;
        await lifecycle.removeGhost(this, "target");
        this.#invalidateVisualGeometry(
          previousGhostLocation ? [previousGhostLocation.container] : [],
          "ghost",
        );
        this.fireDropTargetChange(previousGhostLocation, null);
      }
      this.updateHoveredItem(null);
      return;
    }
    this.dropTarget = target;

    const ghostSource = lifecycle.currentGhostLocation(this);
    const targetIndex =
      target.container != null
        ? lifecycle.translateTargetIndex(this, target)
        : -1;
    const targetContainer = target.container as unknown as Container;

    this.updateHoveredItem(targetContainer);

    if (!targetContainer) return;
    const changed =
      !ghostSource ||
      targetContainer !== ghostSource.container ||
      targetIndex !== ghostSource.index;
    if (changed) {
      await lifecycle.moveGhost(
        this,
        targetContainer,
        targetIndex,
        target.ghostRect,
      );
      this.#invalidateVisualGeometry(
        ghostSource
          ? [ghostSource.container, targetContainer]
          : [targetContainer],
        "ghost",
      );
      this.fireDropTargetChange(ghostSource, {
        container: targetContainer,
        index: targetIndex,
      });
    }
    lifecycle.afterSyncDropTarget(this);
  }

  #invalidateVisualGeometry(
    containers: readonly Container[],
    reason: "ghost",
  ): void {
    const items = new Set<Item>(this.items);
    for (const container of containers) {
      for (const item of container.itemOrderedList) {
        if (!item.isGhost) items.add(item);
      }
    }
    this.root.invalidateVisualGeometry(items, reason);
  }

  private fireDropTargetChange(
    previous: { container: Container; index: number } | null,
    current: { container: Container; index: number } | null,
  ): void {
    const toLocation = (
      loc: { container: Container; index: number } | null,
    ): DragLocation | null =>
      loc ? buildDragLocation(loc.container, loc.index) : null;
    fireOptionalMutation(
      this.root,
      this.root.callbacks?.onDropTargetChange,
      buildDropTargetChangeEvent(
        this,
        toLocation(previous),
        toLocation(current),
      ),
    );
  }

  /**
   * Fire a final `onDragItemLeave` if a hover was active when the drag ends,
   * so hover-driven UI (highlights, previews) doesn't get stuck. Lifecycle
   * `drop()` implementations call this before firing `onDragEnd`.
   */
  clearHoveredItem(): void {
    const previousHovered = this.hoveredItem;
    this.hoveredItem = null;
    if (!previousHovered?.parent) return;
    fireDragItemLeave(
      previousHovered.container,
      this.primaryItem,
      previousHovered,
      this,
    );
  }

  /**
   * Hit-test the pointer against `container`'s children (or clear the hover
   * when `container` is null, e.g. no valid drop target) and fire
   * enter/move/leave accordingly. Hover is semantically distinct from the
   * resolved slot/gap, but its hit-test is scoped to the currently resolved
   * target container passed here.
   */
  private updateHoveredItem(container: Container | null): void {
    const item = this.primaryItem;
    const nextHovered = container
      ? findHoveredItem(item, container, this)
      : null;
    const previousHovered = this.hoveredItem;

    if (previousHovered === nextHovered) {
      if (nextHovered && container) {
        fireDragItemMove(container, item, nextHovered, this);
      }
      return;
    }

    if (previousHovered?.parent) {
      fireDragItemLeave(previousHovered.container, item, previousHovered, this);
    }
    this.hoveredItem = nextHovered;
    if (nextHovered && container) {
      fireDragItemEnter(container, item, nextHovered, this);
    }
  }
}
