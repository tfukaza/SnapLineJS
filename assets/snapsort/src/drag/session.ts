import type { AnimationObject } from "@snap-engine/core/animation";
import type { DomProperty, dragStartProp } from "@snap-engine/core";
import type { Container } from "../container";
import type { Item } from "../item";
import { reconcileRootTreeState, rootHasItemId } from "../internal/tree-state";
import {
  prepareReorderAnimation,
  type PreparedReorderAnimation,
} from "../internal/flip-animation";
import { stageVisualRectBeforeMutation } from "../internal/visual-rect";
import {
  findHoveredItem,
  findPlacementHoveredItem,
  type ResolvedDropTarget,
} from "../algorithm";
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
  InsertionMarkerPresentation,
} from "../events";
import { sameInsertionMarkerPresentation } from "../insertion-geometry";
import type { ItemId } from "../snapshot";
import {
  fireDragItemEnter,
  fireDragItemLeave,
  fireDragItemMove,
  fireOptionalMutation,
} from "../mutation";
import type { SortStrategy } from "./drop-strategy";
import { resetItemVisual, restoreActiveItems } from "./item-visual";
import { clearDragSession } from "./session-store";
import { PointerDragController } from "./pointer-controller";
import {
  cancelDirectMoveAnimation,
  DirectDragController,
} from "./direct-controller";

export type DragSessionStatus = "pending" | "active" | "dropping" | "ended";
export type GhostChannel = "target" | "source" | "pointer";

export type DragInputController = PointerDragController | DirectDragController;

/** @internal Input-specific information needed to start one shared session. */
export type DragInputStart =
  | {
      readonly inputType: "pointer";
      readonly prop: dragStartProp;
    }
  | {
      readonly inputType: "direct";
      readonly initiatingItemId: ItemId;
    };

export interface DragSession {
  readonly root: Container;
  readonly input: DragInputController;
  readonly items: readonly Item[];
  readonly sources: readonly DragLocation[];
  readonly pressedItem: Item;
  readonly primaryItem: Item;
  readonly status: DragSessionStatus;
  dragVisual: DragVisual;
  dropEffect: DropEffect;
}

/** @internal Placement the active lifecycle is currently targeting. */
export interface DropPlacement {
  readonly container: Container;
  readonly index: number;
  readonly insertion: InsertionMarkerPresentation | null;
}

/** @internal Direction-aware size of the whole dragged group, used to size a single group ghost/marker. */
export interface GroupDimensions {
  maxW: number;
  maxH: number;
  sumW: number;
  sumH: number;
}

interface DropTargetUpdate {
  readonly target: ResolvedDropTarget | null;
  readonly previousPlacement: Readonly<{
    container: Container;
    index: number;
  }> | null;
  readonly placement: DropPlacement | null;
  readonly logicalChanged: boolean;
  readonly presentationChanged: boolean;
  readonly shouldClear: boolean;
}

function freezePoint(point: {
  x: number;
  y: number;
}): Readonly<{ x: number; y: number }> {
  return Object.freeze({
    x: point.x,
    y: point.y,
  });
}

function freezeLocation(location: DragLocation): DragLocation {
  return Object.freeze({ ...location });
}

function freezePlacement(
  container: Container,
  index: number,
  insertion: InsertionMarkerPresentation | null,
): DropPlacement {
  return Object.freeze({ container, index, insertion });
}

/**
 * @internal Runtime controller maintaining drag events and states,
 * newly created for every drag gesture.
 */
export class DragSessionController implements DragSession {
  readonly root: Container;
  /** Input-specific controller created and owned by this session. */
  readonly input: DragInputController;
  /**
   * The items currently receiving this drag. Stable except across `handoff`.
   * Ordered by the original run's document order (lowest first).
   */
  items!: readonly Item[];
  sources: readonly DragLocation[];
  /** The item the pointer actually grabbed — may differ from `items[0]` (the run head) for disjoint selections. Anchors pointer-follow geometry. Replaced on `handoff`. */
  pressedItem!: Item;
  /** `items` as a Set, for O(1) exclusion checks in layout/algorithm code. */
  itemSet!: Set<Item>;
  /** @internal Original participants represented in the frozen root snapshot. */
  readonly snapshotItemSet: ReadonlySet<Item>;
  /** @internal Current participants' mounted locations. Public `sources` always remain the gesture origins. */
  activeSources!: readonly DragLocation[];
  readonly #touchedItems = new Set<Item>();
  /** Direction-aware bounding size of the whole dragged group, computed once drag snapshots are captured. Degenerates to the single item's box when `items.length === 1`. */
  groupDims: GroupDimensions | null = null;
  /** Per-item constant visual offset (relative to `pressedItem`) so companions preview the collapsed run while hoisted. */
  readonly groupVisualOffsets: Map<Item, { x: number; y: number }> = new Map();
  readonly strategy: SortStrategy;
  phase: DragSessionStatus = "pending";
  /** @internal True when a lifecycle is dropping only to unwind a failed drag. */
  cancelled = false;
  #preparedFlowReorderAnimation: PreparedReorderAnimation | null = null;

  /** Status exposed during a logically pre-drop move. */
  get status(): DragSessionStatus {
    return this.pointerInput?.applyingScheduledMove === true &&
      this.phase === "dropping" &&
      !this.cancelled
      ? "active"
      : this.phase;
  }

  /** @internal Active pointer input, or null for a direct session. */
  get pointerInput(): PointerDragController | null {
    return this.input.inputType === "pointer" ? this.input : null;
  }

  get pointerId(): number {
    const input = this.pointerInput;

    if (!input) {
      throw new Error("DragSession: a direct drag has no pointer id.");
    }

    return input.pointerId;
  }

  get start(): Readonly<{ x: number; y: number }> {
    const input = this.pointerInput;

    if (!input) {
      throw new Error(
        "DragSession: a direct drag has no public pointer start.",
      );
    }

    return input.start;
  }

  get pointer(): Readonly<{ x: number; y: number }> {
    const input = this.pointerInput;

    if (!input) {
      throw new Error(
        "DragSession: a direct drag has no public pointer position.",
      );
    }

    return input.pointer;
  }

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
    if (this.phase !== "pending") {
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

  #visualStart: Readonly<{ x: number; y: number }>;
  #visualPointer: Readonly<{ x: number; y: number }>;
  visualOffset: { x: number; y: number } = {
    x: 0,
    y: 0,
  };

  get visualStart(): Readonly<{ x: number; y: number }> {
    return this.#visualStart;
  }

  get visualPointer(): Readonly<{ x: number; y: number }> {
    return this.#visualPointer;
  }

  set visualPointer(value: Readonly<{ x: number; y: number }>) {
    this.#visualPointer = freezePoint(value);
  }

  /**
   * Ghosts currently live for this drag, keyed by role. Most lifecycles only
   * ever populate `"target"` (the placeholder tracking the prospective drop
   * slot); `"source"` and `"pointer"` hold
   * a slot open or represent the pointer-following visual without disturbing
   * the target ghost. Ghosts can be added, moved, or removed independently at
   * any point during a drag.
   */
  readonly ghostsByChannel: Map<GhostChannel, Item> = new Map();

  /**
   * Flow-mode target ghosts: one logical anchor per dragged member, ordered
   * to parallel `items`, inserted as a contiguous run at the prospective drop
   * slot. Each anchor fires its own `onGhostInsert` (with the
   * full `items` list), so the renderer adapter decides whether to render
   * them as separate ghosts, one merged ghost, or none — the core never
   * forces a single group-sized spacer. Empty for insertion/swap modes, which
   * use `ghostsByChannel` (`"target"`/`"pointer"`) instead.
   */
  readonly flowGhostRun: Item[] = [];

  /** @internal Source-slot spacers used when insertion/swap hoist real Items. */
  readonly sourceGhostRun: Item[] = [];

  /** @internal Allocate a collision-free transient identity in this root. */
  allocateGhostItemId(): ItemId {
    let itemId = this.root.global.createId();
    while (rootHasItemId(this.root, itemId)) {
      itemId = this.root.global.createId();
    }
    return itemId;
  }

  /** The placement most recently requested by the lifecycle strategy. */
  pendingPlacement: DropPlacement | null = null;
  /** Last drop candidate resolved by the drop-target strategy (raw, snapshot-space index). */
  resolvedDropTarget: ResolvedDropTarget | null = null;
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
    start: DragInputStart,
    pressedItem: Item = items[0],
  ) {
    this.root = root;
    this.sources = Object.freeze(sources.map(freezeLocation));
    this.snapshotItemSet = new Set(items);
    this.#setParticipants(items, sources.slice(), pressedItem);
    this.strategy = strategy;
    this.#dragVisual =
      strategy.mode === "insertion"
        ? "none"
        : strategy.mode === "swap"
          ? "preview"
          : "item";

    if (start.inputType === "pointer") {
      const input = new PointerDragController(this, start.prop);
      this.input = input;
      this.#visualStart = input.start;
      this.#visualPointer = input.pointer;
    } else {
      const initialVisualPoint = freezePoint({ x: 0, y: 0 });
      this.input = new DirectDragController(this, start.initiatingItemId);
      this.#visualStart = initialVisualPoint;
      this.#visualPointer = initialVisualPoint;
    }
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

  /** The run head — lowest original index, first element of `items`. Used as the singular `item` in backwards-compatible event fields. */
  get primaryItem(): Item {
    return this.items[0];
  }

  /** @internal Return the captured box for one current participant. */
  dragBoxFor(item: Item): DomProperty {
    if (!this.itemSet.has(item)) {
      throw new Error(
        "DragSession: drag geometry is only available for current participants.",
      );
    }
    const box = item.dragSnapshot?.box;
    if (!box) {
      throw new Error(
        `DragSession: participant "${item.itemId}" has no captured drag geometry.`,
      );
    }
    return box;
  }

  /**
   * Compute this session's group dimensions from each member's drag
   * snapshot box. Called once drag snapshots are captured (READ_1 of
   * `begin`). Degenerates to the pressed item's own box for a single item.
   */
  // Consecutive margins are represented here; CSS `gap` is not present in
  // per-item boxes and therefore cannot be reconstructed from this snapshot.
  #computeGroupDims(): GroupDimensions {
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
      const box = this.dragBoxFor(member);
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
  begin(): void {
    const item = this.pressedItem;
    const root = this.root;

    item.schedule(
      () => {
        if (this.#isEnded()) return;
        for (const member of this.items) {
          const visual = member.readDom({ unapplyTransform: false });
          this.dragVisualStart.set(member, { x: visual.x, y: visual.y });
        }
        const itemVisualStart = this.dragVisualStart.get(item) ?? {
          x: item.worldTransform.x,
          y: item.worldTransform.y,
        };
        const pointerInput = this.pointerInput;
        if (pointerInput) {
          this.visualOffset = {
            x: pointerInput.start.x - itemVisualStart.x,
            y: pointerInput.start.y - itemVisualStart.y,
          };
        } else {
          this.#visualStart = freezePoint(itemVisualStart);
          this.#visualPointer = this.#visualStart;
          this.visualOffset = { x: 0, y: 0 };
        }
        root.readDragSnapshotTree();
        root.captureDragSnapshotTree();
        this.groupDims = this.#computeGroupDims();
        if (this.input.inputType === "direct") {
          this.input.activate();
        }
      },
      { stage: "READ_1", queueId: `drag-start-offset-${item.id}` },
    );

    item.schedule(
      async () => {
        if (this.#isEnded()) return;
        let completed = false;
        try {
          const vetoed =
            root.callbacks?.onDragStart?.(buildDragStartEvent(this)) === false;
          if (vetoed) {
            this.#clearSessionState();
            completed = true;
            return;
          }
          this.strategy.lifecycle.validateStart(this);

          this.phase = "active";
          await this.strategy.lifecycle.dragStart(this);
          if (this.#isEnded()) {
            this.#clearSessionState();
            completed = true;
            return;
          }
          for (const member of this.items) {
            if (member.element) {
              member.element.dataset.snapsortDragging = "true";
            }
          }
          completed = true;
        } finally {
          if (!completed) this.scheduleErrorFinalizer();
        }
      },
      { stage: "WRITE_1" },
    );
  }

  #isEnded(): boolean {
    return this.phase === "ended";
  }

  #cancelInputAnimation(): void {
    if (this.input.inputType === "direct") {
      cancelDirectMoveAnimation(this.input);
    }
  }

  /** @internal Begin a successful drop exactly once. */
  beginDrop(): boolean {
    if (this.phase !== "active") {
      return false;
    }

    this.#cancelInputAnimation();
    this.phase = "dropping";
    this.dragTransformSyncAnimation?.cancel();
    this.dragTransformSyncAnimation = null;

    let completed = false;

    try {
      this.strategy.lifecycle.drop(this);
      completed = true;
      return true;
    } finally {
      if (!completed) {
        this.scheduleErrorFinalizer();
      }
    }
  }

  /** @internal Unwinds an input-cancelled drag without committing a drop. */
  cancel(): void {
    if (this.phase === "dropping" || this.phase === "ended") return;

    this.#cancelInputAnimation();
    this.cancelled = true;
    if (this.phase === "pending") {
      this.#clearSessionState();
      return;
    }
    this.phase = "dropping";
    this.dragTransformSyncAnimation?.cancel();
    this.dragTransformSyncAnimation = null;
    this.#dropEffect = "none";

    let completed = false;
    try {
      this.strategy.lifecycle.drop(this);
      completed = true;
    } finally {
      if (!completed) this.scheduleErrorFinalizer();
    }
  }

  /** @internal Ensure a throwing scheduled drop callback cannot strand state. */
  scheduleDropFinalizer(): void {
    this.#scheduleFailureFinalizer(true);
  }

  /** @internal Mark a failed task and defer cleanup to the engine's error boundary. */
  scheduleErrorFinalizer(): void {
    if (this.phase === "ended") return;
    const shouldFireDragEnd = this.phase !== "pending";
    this.#markFailedDrop();
    this.#scheduleFailureFinalizer(shouldFireDragEnd);
  }

  #markFailedDrop(): void {
    if (this.#isEnded()) return;
    this.#cancelInputAnimation();
    this.cancelled = true;
    this.phase = "dropping";
    this.#dropEffect = "none";
    this.dragTransformSyncAnimation?.cancel();
    this.dragTransformSyncAnimation = null;
  }

  #clearSessionState(): void {
    this.#cancelInputAnimation();
    this.dragTransformSyncAnimation?.cancel();
    this.dragTransformSyncAnimation = null;
    this.phase = "ended";
    clearDragSession(this.root, this);
    this.dragCoordinateParent.clear();
    this.dragLayoutPosition.clear();
    this.dragVisualStart.clear();
    this.groupVisualOffsets.clear();
    this.groupDims = null;
    this.#preparedFlowReorderAnimation = null;
    this.pendingPlacement = null;
    this.resolvedDropTarget = null;
    this.hoveredItem = null;
    this.flowGhostRun.length = 0;
    this.sourceGhostRun.length = 0;
    this.ghostsByChannel.clear();
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
    } finally {
      this.#clearSessionState();
    }
    this.#fireDragEnd(destination);
  }

  #fireDragEnd(destination: DragLocation | null): void {
    fireOptionalMutation(
      this.root,
      this.root.callbacks?.onDragEnd,
      buildDragEndEvent(this, destination),
    );

    if (this.input.inputType === "direct") {
      this.input.scheduleFocusRestoration();
    }
  }

  #scheduleFailureFinalizer(shouldFireDragEnd: boolean): void {
    const ghosts = new Set([
      ...this.flowGhostRun,
      ...this.sourceGhostRun,
      ...this.ghostsByChannel.values(),
    ]);
    let finalized = false;
    const finalizer = this.root.schedule(null, {
      stage: "WRITE_3",
      queueId: `drag-error-finalize-${this.pressedItem.id}`,
    });
    finalizer.addCallback(() => this.#markFailedDrop());
    for (const ghost of ghosts) {
      finalizer.addCallback(() => {
        if (!this.#isEnded() && ghost.ghostState) ghost.removeGhost();
      });
    }
    finalizer.addCallback(() => {
      if (this.#isEnded()) return;
      resetItemVisual(this);
      for (const ghost of ghosts) {
        if (!ghost.isDeleteRequested) ghost.destroy(false);
      }
      restoreActiveItems(this);
      reconcileRootTreeState(this.root);
      this.#clearSessionState();
      finalized = true;
    });
    if (!shouldFireDragEnd) return;
    finalizer.addCallback(() => {
      if (!finalized) return;
      this.#fireDragEnd(null);
    });
  }

  /** @internal Initialize placement feedback for the active input method. */
  async initializeTarget(): Promise<void> {
    if (this.input.inputType === "pointer") {
      await this.applyTarget(this.resolvePointerTarget(), true);
      return;
    }

    // The direct swap home candidate represents no prospective swap.
    if (this.strategy.mode === "swap") {
      return;
    }

    await this.applyTarget(this.input.currentCandidate?.target ?? null, false);
  }

  /** @internal Resolve the current real pointer through the active strategy. */
  resolvePointerTarget(): ResolvedDropTarget | null {
    const item = this.primaryItem;
    if (!this.root.hasDragSnapshotTree() || !item.dragSnapshot) return null;
    return this.strategy.dropTarget.resolve(item, this.root, this);
  }

  /** @internal Stage an existing target visual before structural mutation. */
  stageTargetVisual(): void {
    const ghost = this.ghostsByChannel.get("target");
    if (ghost) stageVisualRectBeforeMutation(ghost);
  }

  /** @internal Capture pre-mutation animation geometry for an exact target. */
  prepareTarget(target: ResolvedDropTarget | null): void {
    this.stageTargetVisual();

    this.#preparedFlowReorderAnimation = null;

    if (!this.strategy.lifecycle.placementOccupiesFlowSlots) {
      return;
    }

    const update = this.#dropTargetUpdateFor(target);

    if (!update.logicalChanged) {
      return;
    }

    const animationContainer =
      update.placement?.container ??
      update.previousPlacement?.container ??
      null;

    if (!animationContainer) {
      return;
    }

    this.#preparedFlowReorderAnimation = prepareReorderAnimation(
      this.primaryItem,
      animationContainer,
      this.items,
    );
  }

  /** @internal Apply one already-selected target through the shared lifecycle. */
  async applyTarget(
    target: ResolvedDropTarget | null,
    updatePointerHover: boolean,
  ): Promise<void> {
    await this.#applyDropTargetUpdate(
      this.#dropTargetUpdateFor(target),
      updatePointerHover,
    );
  }

  #dropTargetUpdateFor(target: ResolvedDropTarget | null): DropTargetUpdate {
    const lifecycle = this.strategy.lifecycle;
    const previousPlacement = lifecycle.currentPlacement(this);

    if (!target) {
      return {
        target: null,
        previousPlacement,
        placement: null,
        logicalChanged: previousPlacement !== null,
        presentationChanged: false,
        shouldClear: Boolean(previousPlacement || this.resolvedDropTarget),
      };
    }

    const placement = freezePlacement(
      target.container,
      lifecycle.placementIndexFor(this, target),
      target.insertion ?? null,
    );

    const logicalChanged =
      !previousPlacement ||
      placement.container !== previousPlacement.container ||
      placement.index !== previousPlacement.index;

    const previousInsertion = this.pendingPlacement?.insertion ?? null;

    const presentationChanged =
      previousInsertion === null || placement.insertion === null
        ? previousInsertion !== placement.insertion
        : !sameInsertionMarkerPresentation(
            previousInsertion,
            placement.insertion,
          );

    return {
      target,
      previousPlacement,
      placement,
      logicalChanged,
      presentationChanged,
      shouldClear: false,
    };
  }
  async #applyDropTargetUpdate(
    update: DropTargetUpdate,
    updatePointerHover = true,
  ): Promise<void> {
    const lifecycle = this.strategy.lifecycle;
    const { previousPlacement, placement } = update;
    if (!placement) {
      // No valid candidate anywhere (e.g. the pointer left every drop-eligible
      // container). The target ghost should not linger over a target that no
      // longer exists — clear it and report the loss, same as any other
      // drop-target change.
      if (update.shouldClear) {
        this.resolvedDropTarget = null;
        await lifecycle.clearPlacement(this);
        this.#invalidateVisualGeometry(
          previousPlacement ? [previousPlacement.container] : [],
          "ghost",
        );
        this.#fireDropTargetChange(previousPlacement, null);
      }
      if (updatePointerHover) {
        this.#updateHoveredItem(null);
      }
      return;
    }

    this.resolvedDropTarget = update.target;
    if (updatePointerHover) {
      this.#updateHoveredItem(placement.container);
    }
    if (update.logicalChanged || update.presentationChanged) {
      await lifecycle.syncPlacement(this, placement);
      this.#invalidateVisualGeometry(
        previousPlacement
          ? [previousPlacement.container, placement.container]
          : [placement.container],
        "ghost",
      );
      if (update.logicalChanged) {
        this.#fireDropTargetChange(previousPlacement, {
          container: placement.container,
          index: placement.index,
        });
      }
    }
    lifecycle.afterPlacementSync(this);
  }

  /** @internal Consume the READ_1 FLIP capture for this flow mutation. */
  consumePreparedFlowReorderAnimation(): PreparedReorderAnimation | null {
    const prepared = this.#preparedFlowReorderAnimation;
    this.#preparedFlowReorderAnimation = null;
    return prepared;
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

  #fireDropTargetChange(
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
   * Hit-test the pointer against `container`'s children and, when nested, the
   * destination Container itself for non-swap placement (or clear the hover
   * when `container` is null, e.g. no valid drop target). Swap hover preserves
   * its direct-child-only contract. Hover is semantically distinct from the
   * resolved slot/gap. Callbacks always dispatch through the hovered Item's
   * actual owner.
   */
  #updateHoveredItem(container: Container | null): void {
    const item = this.primaryItem;
    const nextHovered = container
      ? this.strategy.mode === "swap"
        ? findHoveredItem(item, container, this)
        : findPlacementHoveredItem(item, container, this)
      : null;
    const previousHovered = this.hoveredItem;

    if (previousHovered === nextHovered) {
      if (nextHovered) {
        fireDragItemMove(nextHovered.container, item, nextHovered, this);
      }
      return;
    }

    if (previousHovered?.parent) {
      fireDragItemLeave(previousHovered.container, item, previousHovered, this);
    }
    this.hoveredItem = nextHovered;
    if (nextHovered) {
      fireDragItemEnter(nextHovered.container, item, nextHovered, this);
    }
  }
}
