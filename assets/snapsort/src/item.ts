import type { Rect } from "@snap-engine/core/geometry";
import {
  ElementObject,
  type BaseObject,
  type Engine,
  type dragEndProp,
  type dragProp,
  type dragStartProp,
} from "@snap-engine/core";
import type { AnimationConfig, Container } from "./container";
import type { ItemId, ItemSnapshot, ItemMetadata } from "./snapshot";
import type {
  LayoutDirection,
  LayoutMainAxisAlign,
  LayoutModel,
  LayoutWrap,
} from "@snap-engine/core/layout";
import type {
  DragLocation,
  GhostState,
  GhostStatePlacement,
  VisualGeometryInvalidationReason,
} from "./events";
import {
  buildDragLocation,
  buildGhostState,
  buildItemLocation,
} from "./event-builders";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  assertCanFireItemInsert,
  assertCanFireItemMove,
  assertCanFireItemRemove,
  fireGhostInsert,
  fireGhostRemove,
  fireItemInsert,
  fireItemMove,
  fireItemRemove,
} from "./mutation";
import type {
  DragSession as PublicDragSession,
  DragSessionController as DragSession,
} from "./drag/session";
import { getDragSessionController } from "./drag/session-store";
import { beginDirectItemDrag, beginItemDrag } from "./drag/group";
import {
  assertCanPlaceItems,
  detachItem,
  elementAfterRun,
  itemLocation,
  placeItemAt,
  placeItemAtUnchecked,
  releaseItem,
} from "./internal/tree-mutation";
import { reconcileRootTreeState } from "./internal/tree-state";
import { projectItemRunMove } from "./internal/move-projection";
import {
  ancestorVisualOffset,
  animationConfigFor,
  clearVisualAnimationOffset,
  playDropAnimation,
  playElementRectAnimation,
  withMoveAnimation,
  withReorderAnimation,
  type ElementRectAnimationOptions,
} from "./internal/flip-animation";

export interface ItemOptions {
  readonly itemId: ItemId;
}

function validateItemId(engine: Engine, itemId: unknown): Engine {
  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new TypeError("SnapSort: itemId must be a non-empty string.");
  }
  return engine;
}

export class Item extends ElementObject {
  #rootContainer: Container | null = null;
  readonly #itemId: ItemId;
  #metadata: ItemMetadata = {};
  #locked: boolean = false;
  #selected: boolean = false;
  #dragSnapshot: ItemSnapshot<Item> | null = null;
  #itemOrderedList: Item[] = [];
  #isGhost = false;
  #ghostState: GhostState | null = null;
  #programmaticMutationPending = false;

  constructor(engine: Engine, parent: Container | null, options: ItemOptions) {
    super(validateItemId(engine, options?.itemId), parent);
    this.#itemId = options.itemId;
    this.event.input.dragStart = this.dragStart;
    this.event.input.drag = this.drag;
    this.event.input.dragEnd = this.dragEnd;
    this.event.dom.onAssignDom = () => {
      this.writeDom();
    };
    this.transformMode = "none";

    // If there is no parent container, assume this is the root container.
    this.rootContainer = parent
      ? parent.rootContainer
      : (this as unknown as Container);
  }

  /** Create a transient Item whose state is rendered by the root adapter. */
  createGhostItem(session: DragSession, placement: GhostStatePlacement): Item {
    const ghostItem = Item.#createGhostItem(
      this.engine,
      session.allocateGhostItemId(),
    );
    ghostItem.rootContainer = session.root;
    ghostItem.metadata = { ...this.metadata };
    const state = buildGhostState(session, placement, this, ghostItem);
    ghostItem.ghostState = state;
    return ghostItem;
  }

  static #createGhostItem(engine: Engine, itemId: ItemId): Item {
    const ghostItem = new Item(engine, null, { itemId });
    ghostItem.#isGhost = true;
    return ghostItem;
  }

  /**
   * Attach an item to the end of this container.
   *
   * @note The DOM element of the item must be set before calling this method.
   * @param item
   */
  attachItem(item: Item): void {
    if (
      this.children.includes(item) &&
      this.#itemOrderedList.find((i) => i === item)
    ) {
      throw new Error("Item is already a child of this container");
    }
    placeItemAt(
      this as unknown as Container,
      item,
      this.#itemOrderedList.length,
    );
    this.takeRootSnapshot();
  }

  /**
   * Remove an item from a container
   * @param itemId Item ID of the item to remove
   * @returns True when removal was accepted; false when missing, already
   * pending, or blocked by this root's drag session
   */
  removeItem(itemId: ItemId) {
    if (getDragSessionController(this.rootContainer)) return false;
    const item =
      this.#itemOrderedList.find(
        (item) => !item.isGhost && item.itemId === itemId,
      ) ??
      this.children.find(
        (item): item is Item =>
          item instanceof Item && !item.isGhost && item.itemId === itemId,
      );
    if (!item || item.#programmaticMutationPending) return false;

    const container = this as unknown as Container;
    assertCanFireItemRemove(container);
    this.#scheduleProgrammaticMutation(container, [item], () => {
      if (item.parent === container) {
        this.#commitItemRemoval(container, item);
      }
    });
    return true;
  }

  /**
   * Find an item by its item id within this container.
   *
   * @param itemId Stable item id from `itemId`.
   * @returns Matching item object, or null when the tree has no matching item.
   * @internal
   */
  findItemById(itemId: ItemId): Item | null {
    const directItem =
      this.#itemOrderedList.find(
        (item) => !item.isGhost && item.itemId === itemId,
      ) ??
      this.children.find(
        (item): item is Item =>
          item instanceof Item && !item.isGhost && item.itemId === itemId,
      );
    if (directItem) return directItem;

    for (const child of this.#itemOrderedList) {
      const found = child.findItemById(itemId);
      if (found) return found;
    }

    return null;
  }

  /** @internal True when this attached subtree has queued programmatic work. */
  #hasPendingProgrammaticMutation(): boolean {
    if (this.#programmaticMutationPending) return true;
    return this.children.some(
      (child) =>
        child instanceof Item && child.#hasPendingProgrammaticMutation(),
    );
  }

  /**
   * Move an item into a target container.
   *
   * This is the public API used by state-backed adapters. It accepts
   * an id instead of an `Item` so callers do not need to retain engine
   * object references.
   *
   * @param itemId Stable item id from `itemId`.
   * @param container Destination SnapSort container.
   * @param index Destination index in the target container.
   * @returns True when the move was accepted; false when missing, already
   * pending, or blocked by this root's drag session.
   */
  moveItem(itemId: ItemId, container: Container, index: number) {
    const rootContainer = this.rootContainer;
    if (getDragSessionController(rootContainer)) return false;
    const root = rootContainer as unknown as Item;
    const item = root.findItemById(itemId);
    if (!item || item.#programmaticMutationPending) return false;
    assertCanPlaceItems([{ container, item }]);
    this.takeRootSnapshot();
    this.#scheduleItemsToContainer(container, [item], index, null);
    return true;
  }

  /**
   * If true, it means this item or container cannot be moved.
   */
  get locked(): boolean {
    return this.#locked;
  }

  set locked(value: boolean) {
    this.#locked = value;
  }

  /**
   * Consumer-owned selection flag. When a drag starts on a selected item,
   * the whole set of currently-selected items in the tree is dragged
   * together (see `collectSelectedDragGroup`); dragging an unselected item
   * only ever drags that one item. SnapSort has no selection UX of its own
   * — the app is responsible for setting this (e.g. from click/cmd-click
   * handling) before a drag begins.
   */
  get selected(): boolean {
    return this.#selected;
  }

  set selected(value: boolean) {
    this.#selected = value;
  }

  /**
   * Returns the current container and the index within that container.
   * @returns
   */
  getIndexAndContainer(): { index: number; container: Container | null } {
    const location = itemLocation(this);
    return location
      ? { index: location.index, container: location.container }
      : { index: -1, container: null };
  }

  get metadata(): ItemMetadata {
    return this.#metadata;
  }

  set metadata(value: ItemMetadata) {
    this.#metadata = value;
  }

  get itemId(): ItemId {
    return this.#itemId;
  }

  get container(): Container {
    if (!this.parent) {
      console.warn("Item has no container set.");
      return null as any;
    }
    return this.parent as unknown as Container;
  }

  get rootContainer(): Container {
    return this.#rootContainer ?? (this as unknown as Container);
  }

  /**
   * Base implementation for items outside any container tree (for example a
   * ghost anchor mid-move, whose `rootContainer` getter falls back to the
   * item itself). Forwards to the owning container when one exists; there is
   * no consumer to notify otherwise. `Container` overrides this with the
   * accumulating implementation.
   * @internal
   */
  invalidateVisualGeometry(
    items: Iterable<Item>,
    reason: VisualGeometryInvalidationReason,
  ): void {
    const root = this.#rootContainer;
    if (root && root !== (this as unknown as Container)) {
      root.invalidateVisualGeometry(items, reason);
    }
  }

  set rootContainer(value: Container | null) {
    Item.#assignRootContainer(this, value);
  }

  static #assignRootContainer(
    object: BaseObject,
    value: Container | null,
  ): void {
    if (object instanceof Item) object.#rootContainer = value;
    for (const child of object.children) {
      Item.#assignRootContainer(child, value);
    }
  }

  get isGhost(): boolean {
    return this.#isGhost;
  }

  /** @internal Latest emitted state retained to build the next ghost transition. */
  get ghostState(): GhostState | null {
    return this.#ghostState;
  }

  /** @internal Replace a ghost's latest emitted state after relocation. */
  set ghostState(state: GhostState) {
    if (!this.#isGhost || state.ghostItem !== this) {
      throw new Error("SnapSort: invalid ghost state assignment.");
    }
    if (this.#ghostState && this.#ghostState.type !== state.type) {
      throw new Error("SnapSort: a ghost cannot change its state type.");
    }
    this.#ghostState = state;
  }

  get depth(): number {
    let depth = 0;
    let ancestor = this.parent;
    while (ancestor instanceof Item) {
      depth += 1;
      ancestor = ancestor.parent;
    }
    return depth;
  }

  /**
   * Returns the list of child items ordered by DOM position.
   */
  get itemOrderedList(): Item[] {
    return this.#itemOrderedList;
  }

  /**
   * Returns the frozen snapshot for this item,
   * containing information about bounding box geometry,
   * child items, etc.
   */
  get dragSnapshot(): ItemSnapshot<Item> | null {
    return this.#dragSnapshot;
  }

  /**
   * Returns the current drag pointer position in world coordinates.
   */
  get dragPointerPosition(): { x: number; y: number } | null {
    const session = getDragSessionController(this.rootContainer);
    if (!session || !this.#dragSnapshot) return null;
    return {
      x: session.pointer.x,
      y: session.pointer.y,
    };
  }

  /**
   * Returns the dragged item's top-left position in world coordinates.
   * @note This does not account for containers being animated.
   */
  get dragPositionX(): number {
    const session = getDragSessionController(this.rootContainer);
    if (!session || !this.#dragSnapshot) return this.worldTransform.x;
    if (session.input.inputType === "direct") {
      return (
        session.input.visualRectFor(this.#itemId)?.x ?? this.worldTransform.x
      );
    }
    const visualStart = session.dragVisualStart.get(this);
    return (
      (visualStart?.x ?? this.#dragSnapshot.box.x) +
      session.visualPointer.x -
      session.visualStart.x
    );
  }

  /**
   * Returns the dragged item's top-left position in world coordinates.
   * @note This does not account for containers being animated.
   */
  get dragPositionY(): number {
    const session = getDragSessionController(this.rootContainer);
    if (!session || !this.#dragSnapshot) return this.worldTransform.y;
    if (session.input.inputType === "direct") {
      return (
        session.input.visualRectFor(this.#itemId)?.y ?? this.worldTransform.y
      );
    }
    const visualStart = session.dragVisualStart.get(this);
    return (
      (visualStart?.y ?? this.#dragSnapshot.box.y) +
      session.visualPointer.y -
      session.visualStart.y
    );
  }

  cancelAnimations() {
    clearVisualAnimationOffset(this);
    super.cancelAnimations();
  }

  static #containerColors = new Map<string, string>();
  static #colorForContainer(id: string): string {
    let color = Item.#containerColors.get(id);
    if (!color) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
      }
      const hue = ((hash % 360) + 360) % 360;
      color = `hsl(${hue}, 80%, 55%)`;
      Item.#containerColors.set(id, color);
    }
    return color;
  }

  /**
   * Draw a debug circle at the center of every item in the hierarchy,
   * color-coded by parent container.
   */
  debugAllItems(node: Item = (this.#rootContainer as unknown as Item) ?? this) {
    const color = Item.#colorForContainer(node.id);
    for (const child of node.children) {
      if (!(child instanceof Item)) continue;
      const prop = child.dragSnapshot?.box ?? child.box;
      if (prop) {
        const cx = prop.x + prop.width / 2;
        const cy = prop.y + prop.height / 2;
        child.addDebugCircle(
          cx,
          cy,
          4,
          color,
          true,
          `center-read1-${child.id}`,
          "item-positions",
        );
      }
      // Recurse into children that act as containers
      if (child.children.length > 0) {
        this.debugAllItems(child);
      }
    }
  }

  /**
   * Trigger root container to take snapshot of the current state.
   * This initializes the SnapSort tree state and queues the initial DOM read
   * into **READ_1** stage.
   *
   * @note State-backed adapters should invoke this once after the
   * entire tree has been added to the DOM.
   */
  takeRootSnapshot() {
    const root = this.#rootContainer;
    if (!root) {
      throw new Error("Root container not found");
    }
    reconcileRootTreeState(root);
    root.queueReadTree("READ_1", `snapsort-read-root-${this.id}`);
  }

  /** @internal */
  queueReadTree(
    stage: "READ_1" | "READ_2" | "READ_3",
    queueId: string,
    config: { unapplyTransform?: boolean; saveWorldPosition?: boolean } = {},
  ) {
    this.schedule(
      async () => {
        this.#readDomTree(config);
      },
      { stage, queueId },
    );
  }

  #readDomTree(
    config: { unapplyTransform?: boolean; saveWorldPosition?: boolean } = {},
  ) {
    this.readDom({ unapplyTransform: config.unapplyTransform });
    if (config.saveWorldPosition ?? true) {
      const prop = this.box;
      this.worldTransform = { x: prop.x, y: prop.y };
    }
    for (const child of this.children) {
      if (child instanceof Item) {
        child.#readDomTree(config);
      }
    }
  }

  /** @internal Read stable layout geometry for a drag snapshot without replacing the visual positions used for pointer continuity. */
  readDragSnapshotTree(): void {
    this.#readDomTree({ unapplyTransform: true, saveWorldPosition: false });
  }

  #snapshotDirection(): LayoutDirection {
    const direction = "direction" in this ? this.direction : null;
    return direction === "row" ? "row" : "column";
  }

  #snapshotMainAxisAlign(): LayoutMainAxisAlign {
    return "mainAxisAlign" in this && this.mainAxisAlign === "center"
      ? "center"
      : "start";
  }

  #snapshotLayoutModel(): LayoutModel {
    return "layoutModel" in this && this.layoutModel === "slots"
      ? "slots"
      : "flow";
  }

  #snapshotWrap(): LayoutWrap {
    return "wrap" in this && this.wrap === "nowrap" ? "nowrap" : "auto";
  }

  #snapshotStretchItems(): boolean {
    return "stretchItems" in this && this.stretchItems === true;
  }

  #dragSnapshotItems(): Item[] {
    return this.#dragSnapshot?.children.map((snapshot) => snapshot.value) ?? [];
  }

  /**
   * Capture frozen DOM geometry and child order for this subtree.
   *
   * The drop algorithm reads this snapshot for the full drag so live ghost DOM
   * movement cannot perturb candidate prediction.
   *
   * @returns Nothing.
   * @internal
   */
  captureDragSnapshotTree(): ItemSnapshot<Item> {
    const snapshotItems = this.#itemOrderedList.slice();
    const snapshot: ItemSnapshot<Item> = {
      value: this,
      itemId: this.itemId,
      metadata: Object.freeze({ ...this.#metadata }),
      direction: this.#snapshotDirection(),
      mainAxisAlign: this.#snapshotMainAxisAlign(),
      layoutModel: this.#snapshotLayoutModel(),
      wrap: this.#snapshotWrap(),
      stretchItems: this.#snapshotStretchItems(),
      locked: this.#locked,
      box: this.box,
      children: [],
    };
    this.#dragSnapshot = snapshot;
    snapshot.children = snapshotItems.map((child) =>
      child.captureDragSnapshotTree(),
    );
    return snapshot;
  }

  /**
   * Clear frozen drag snapshots from this subtree after drag end.
   *
   * @param visited Items already cleared during this traversal.
   * @returns Nothing.
   * @internal
   */
  clearDragSnapshotTree(visited: Set<Item> = new Set()) {
    if (visited.has(this)) return;
    visited.add(this);

    const childrenToClear = new Set([
      ...this.#dragSnapshotItems(),
      ...this.#itemOrderedList,
    ]);
    this.#dragSnapshot = null;

    for (const child of childrenToClear) {
      child.clearDragSnapshotTree(visited);
    }
  }

  /**
   * Check whether every item in the frozen drag tree has a snapshot.
   *
   * A drag event can arrive before the drag-start READ phase has captured the
   * snapshot tree. Drop prediction should skip that frame instead of falling
   * back to live DOM geometry.
   *
   * @param visited Items already checked during this traversal.
   * @returns True when this item and all frozen descendants have snapshots.
   * @internal
   */
  hasDragSnapshotTree(visited: Set<Item> = new Set()): boolean {
    if (visited.has(this)) return true;
    visited.add(this);

    if (!this.#dragSnapshot) return false;

    return this.#dragSnapshotItems().every((child) =>
      child.hasDragSnapshotTree(visited),
    );
  }

  /**
   * Read the configured reorder animation for a container.
   *
   * @param container Container whose animation configuration should be used.
   * @returns Reorder animation config, or null when reorder animation is disabled.
   * @internal
   */
  reorderAnimationConfig(container: Container | null): AnimationConfig | null {
    return animationConfigFor(container, "reorder");
  }

  /** @internal */
  dropAnimationConfig(container: Container | null): AnimationConfig | null {
    return animationConfigFor(container, "drop");
  }

  /** @internal */
  playElementRectAnimation(
    item: Item,
    first: Rect | null,
    last: Rect | null,
    targetElement: HTMLElement | null,
    animationConfig: AnimationConfig | null,
    animationOwner: Item,
    options: ElementRectAnimationOptions = {},
  ) {
    return playElementRectAnimation(
      item,
      first,
      last,
      targetElement,
      animationConfig,
      animationOwner,
      options,
    );
  }

  /**
   * Play a drop animation for this item.
   * @internal
   */
  playDropAnimation(
    first: Rect | null,
    last: Rect | null,
    targetElement: HTMLElement | null,
    animationConfig: AnimationConfig | null,
    animationOwner: Item,
  ) {
    return playDropAnimation(
      this,
      first,
      last,
      targetElement,
      animationConfig,
      animationOwner,
    );
  }

  /**
   * Run a representation mutation with optional FLIP animation for affected items.
   *
   * @param container Container whose reorder animation config controls the mutation.
   * @param excludedItem Item(s) that should not be animated, usually the active drag group.
   * @param mutate Representation mutation to perform between first and last measurements.
   * @returns Nothing.
   */
  withReorderAnimation(
    container: Container | null,
    excludedItem: Item | readonly Item[] | null,
    mutate: () => void,
  ) {
    return withReorderAnimation(this, container, excludedItem, mutate);
  }

  /**
   * Renders the dragged item.
   *
   * @note This function is currently called in WRITE_1.
   * @internal
   */
  refreshDraggedItemPosition() {
    const session = getDragSessionController(this.rootContainer);
    const parentItem = session?.dragCoordinateParent.get(this) ?? null;
    if (!this.element || !parentItem?.element) return;

    this.transformMode = "direct";
    this.transformOrigin = null;
    this.style = {
      position: "absolute",
      zIndex: "1000",
      top: "0px",
      left: "0px",
    };
    this.writeDom();
    this.scheduleWriteDrag();
  }

  /**
   * Schedule the write of the dragged item's transform.
   * @internal
   */
  scheduleWriteDrag() {
    const session = getDragSessionController(this.rootContainer);
    if (!session || session.phase !== "active") return;
    const parentItem = session.dragCoordinateParent.get(this) ?? null;

    this.schedule(
      async () => {
        if (
          getDragSessionController(this.rootContainer) !== session ||
          session.phase !== "active"
        ) {
          return;
        }
        if (!this.element?.isConnected) return;
        if (!parentItem?.element?.isConnected) return;
        // Account for offsets if the container is being animated.
        const visual = parentItem.readDom();
        const ancestorOffset = ancestorVisualOffset(parentItem);
        session.dragLayoutPosition.set(this, {
          x: visual.x - ancestorOffset.x,
          y: visual.y - ancestorOffset.y,
        });
      },
      { stage: "READ_3", queueId: `dragged-read-${this.id}` },
    );
    this.schedule(
      () => {
        this.writeDraggedTransform(session);
      },
      { stage: "WRITE_3", queueId: `dragged-transform-${this.id}` },
    );
  }

  /**
   * Render the final position of the dragged item.
   * @internal
   */
  writeDraggedTransform(expectedSession: DragSession | null = null) {
    const session = getDragSessionController(this.rootContainer);
    if (
      !session ||
      session.phase !== "active" ||
      (expectedSession && session !== expectedSession)
    ) {
      return;
    }
    const parentItem = session.dragCoordinateParent.get(this) ?? null;
    const layoutPosition = session.dragLayoutPosition.get(this) ?? null;
    if (!layoutPosition) {
      if (parentItem) return;
      this.writeTransform();
      this.rootContainer.invalidateVisualGeometry([this], "drag");
      return;
    }

    // Account for offsets if the container is being animated.
    const ancestorOffset = ancestorVisualOffset(parentItem);
    const directRect =
      session.input.inputType === "direct"
        ? session.input.visualRectFor(this.#itemId)
        : null;

    if (directRect) {
      this.style = {
        width: `${directRect.width}px`,
        height: `${directRect.height}px`,
      };
      this.worldTransform.x =
        directRect.x - layoutPosition.x - ancestorOffset.x;
      this.worldTransform.y =
        directRect.y - layoutPosition.y - ancestorOffset.y;
      this.writeDom();
      this.writeTransform();
      this.rootContainer.invalidateVisualGeometry([this], "drag");
      return;
    }

    const groupOffset = session.groupVisualOffsets.get(this) ?? {
      x: 0,
      y: 0,
    };
    this.worldTransform.x =
      session.visualPointer.x -
      layoutPosition.x -
      ancestorOffset.x -
      session.visualOffset.x +
      groupOffset.x;

    this.worldTransform.y =
      session.visualPointer.y -
      layoutPosition.y -
      ancestorOffset.y -
      session.visualOffset.y +
      groupOffset.y;

    this.writeTransform();
    this.rootContainer.invalidateVisualGeometry([this], "drag");
  }

  /**
   * Move an item to a different container and index, updating the DOM and
   * internal state accordingly. Fires `onItemMove` (falling back to
   * `onItemInsert`) rather than `onItemInsert` directly, since this is
   * always a move relative to the item's current container/index.
   *
   * @internal
   */
  moveItemToContainer(
    container: Container,
    item: Item,
    index: number,
    session: DragSession | null,
  ) {
    this.moveItemsToContainer(container, [item], index, session);
  }

  /**
   * Move an ordered run of items to a different container/index in one
   * gesture, firing exactly one batch `onItemMove` (falling back to
   * `onItemInsert`). `items` may currently live under different source
   * containers (a disjoint multi-select collapses into one contiguous run
   * at the destination). `index` is target-container-live-space, as it was
   * *before* any of `items` were removed from it.
   *
   * @internal
   */
  moveItemsToContainer(
    container: Container,
    items: readonly Item[],
    index: number,
    session: DragSession | null,
  ) {
    const placements = items.map((item) => ({ container, item }));
    assertCanPlaceItems(placements);
    this.#scheduleItemsToContainer(container, items, index, session);
  }

  #scheduleItemsToContainer(
    container: Container,
    items: readonly Item[],
    index: number,
    session: DragSession | null,
  ): void {
    const projectionFor = (liveItems: readonly Item[]) => {
      const sources = liveItems.map((member) => {
        const location = buildItemLocation(member);
        if (!location) throw new Error("Item has no parent container");
        return location;
      });
      return projectItemRunMove(container, index, sources);
    };

    const move = () => {
      // The move is deferred to a later render stage; members may have been
      // detached in the meantime (e.g. destroyed).
      const liveItems = items.filter((member) => !!member.parent);
      if (liveItems.length === 0) return;

      const projection = projectionFor(liveItems);
      if (projection.isCurrentPlacement) return;

      assertCanPlaceItems(liveItems.map((item) => ({ container, item })));
      assertCanFireItemMove(container);

      const froms: DragLocation[] = liveItems.map((member) => {
        const location = buildItemLocation(member);
        if (!location) throw new Error("Item has no parent container");
        return location;
      });
      for (const member of liveItems) {
        detachItem(member.container, member);
      }
      this.#commitItemsAt(
        froms,
        container,
        liveItems,
        projection.adjustedIndex,
        session,
      );
    };

    if (projectionFor(items).isCurrentPlacement) {
      return;
    }

    if (session) {
      withReorderAnimation(this, container, items, move);
    } else {
      this.#scheduleProgrammaticMutation(container, items, move);
    }
  }

  #scheduleProgrammaticMutation(
    animationOwner: Container,
    items: readonly Item[],
    mutate: () => void,
  ): void {
    const setPending = (pending: boolean) => {
      for (const item of items) item.#programmaticMutationPending = pending;
    };
    setPending(true);
    try {
      withMoveAnimation(animationOwner, () => {
        try {
          mutate();
        } finally {
          setPending(false);
        }
      });
    } catch (error) {
      setPending(false);
      throw error;
    }
  }

  /**
   * Insert an item at a specific index in the engine tree, firing the
   * `onItemInsert` primitive. Used for insertion unrelated to a move (e.g.
   * programmatic attachment-adjacent flows); dragged items dropping into a
   * new position should go through `moveItemAt` instead.
   * @internal
   */
  insertItemAt(
    container: Container,
    item: Item,
    index: number,
    session: DragSession | null = null,
  ) {
    assertCanFireItemInsert(container);
    placeItemAt(container, item, index);
    const itemAfterIndex = elementAfterRun(container, index, 1);
    try {
      fireItemInsert(container, [item], index, itemAfterIndex, session);
    } finally {
      reconcileRootTreeState(container.rootContainer);
    }
  }

  /**
   * Attach an item at a specific index and fire the semantic `onItemMove`
   * event (falling back to `onItemInsert` when no `onItemMove` is registered).
   *
   * @note This function assumes the item is not in the target container.
   * Make sure to call `detachItemFromContainer` before calling this method.
   * @internal
   */
  moveItemAt(
    from: DragLocation,
    container: Container,
    item: Item,
    index: number,
    session: DragSession | null,
  ) {
    this.moveItemsAt([from], container, [item], index, session);
  }

  /**
   * Attach an ordered run at a specific index (in run order, starting at
   * `index`) and fire one semantic `onItemMove` event for the whole run
   * (falling back to `onItemInsert` when no `onItemMove` is registered).
   *
   * @note This function assumes none of the `items` are currently in the
   * target container. If they are, call
   * `detachItemFromContainer` on each first.
   * @internal
   */
  moveItemsAt(
    froms: readonly DragLocation[],
    container: Container,
    items: readonly Item[],
    index: number,
    session: DragSession | null,
  ) {
    assertCanPlaceItems(items.map((item) => ({ container, item })));
    assertCanFireItemMove(container);
    this.#commitItemsAt(froms, container, items, index, session);
  }

  #commitItemsAt(
    froms: readonly DragLocation[],
    container: Container,
    items: readonly Item[],
    index: number,
    session: DragSession | null,
  ): void {
    items.forEach((member, i) => {
      placeItemAtUnchecked(container, member, index + i);
    });
    const itemAfterIndex = elementAfterRun(container, index, items.length);
    const to = buildDragLocation(container, index);
    try {
      fireItemMove(froms, to, items, itemAfterIndex, session);
    } finally {
      reconcileRootTreeState(container.rootContainer);
    }
  }

  /** @internal Attach a slot ghost at the location owned by its state. */
  insertGhost(ghostItem: Item) {
    const state = ghostItem.ghostState;
    if (!state || state.location.type !== "slot") {
      throw new Error("SnapSort: an attached ghost requires a slot location.");
    }
    const { container, index } = state.location;
    assertCanFireGhostInsert(container);
    assertCanFireGhostRemove(container);
    placeItemAt(container, ghostItem, index);
    const itemAfterIndex = elementAfterRun(container, index, 1);
    try {
      fireGhostInsert(ghostItem, itemAfterIndex);
    } finally {
      reconcileRootTreeState(container.rootContainer);
    }
  }

  /**
   * Remove an item from the current container.
   * @param container
   * @param item
   */
  detachItemFromContainer(container: Container, item: Item) {
    detachItem(container, item);
  }

  /** Commit one previously validated programmatic removal. */
  #commitItemRemoval(container: Container, item: Item): void {
    assertCanFireItemRemove(container);
    const sourceRoot = container.rootContainer;
    releaseItem(item);
    try {
      fireItemRemove(container, [item], null);
    } finally {
      reconcileRootTreeState(sourceRoot);
    }
  }

  /** @internal Remove this ghost through the owner recorded in its state. */
  removeGhost(): void {
    const state = this.#ghostState;
    if (!this.#isGhost || !state || state.ghostItem !== this) {
      throw new Error("SnapSort: only a state-owned ghost can be removed.");
    }
    const stateOwner = state.location.container;
    const currentOwner = this.getIndexAndContainer().container;
    const sourceRoot = stateOwner.rootContainer;
    if (this.parent && !currentOwner) {
      throw new Error(
        "SnapSort: an attached ghost must belong to its owner's item order.",
      );
    }
    if (currentOwner && currentOwner !== stateOwner) {
      throw new Error(
        "SnapSort: a ghost's state owner must match its engine-tree owner.",
      );
    }
    assertCanFireGhostRemove(stateOwner);
    try {
      if (currentOwner) releaseItem(this);
      fireGhostRemove(this);
    } finally {
      this.#ghostState = null;
      reconcileRootTreeState(sourceRoot);
    }
  }

  /**
   * Begin a direct drag without creating a pointer gesture.
   *
   * Returns null when this item cannot safely start a drag.
   */
  beginDirectDrag(): PublicDragSession | null {
    const location = this.getIndexAndContainer();
    const container = location.container;

    if (!container || this.#locked || this.#isGhost || this.isDeleteRequested) {
      return null;
    }

    const rootContainer = container.rootContainer;
    const root = rootContainer as unknown as Item;

    if (
      getDragSessionController(rootContainer) ||
      root.#hasPendingProgrammaticMutation()
    ) {
      return null;
    }

    return beginDirectItemDrag(this);
  }

  /**
   * Called when a drag operation starts.
   * @param prop
   * @returns
   */
  dragStart(prop: dragStartProp) {
    if (prop.objectId !== this.id) return;
    const rootContainer = this.rootContainer;
    const root = rootContainer as unknown as Item;
    if (
      this.#locked ||
      getDragSessionController(rootContainer) ||
      root.#hasPendingProgrammaticMutation()
    ) {
      return;
    }
    beginItemDrag(this, prop);
  }

  /**
   * Handle drag movement updates.
   * @param prop Drag position property containing mouse coordinates.
   */
  drag(prop: dragProp) {
    if (prop.objectId !== this.id) return;
    const session = getDragSessionController(this.rootContainer);
    if (!session || session.phase !== "active") return;
    session.pointerInput?.move(prop);
  }

  dragEnd(prop: dragEndProp) {
    if (prop.objectId !== this.id) return;
    const session = getDragSessionController(this.rootContainer);
    if (!session) {
      // Defensive cleanup in case a veto or stale session left visual state
      // behind (e.g. onDragStart returned false after the dataset flag was
      // set on a previous, unrelated gesture).
      if (this.element) delete this.element.dataset.snapsortDragging;
      return;
    }
    session.pointerInput?.end(prop);
  }

  destroy(removeElement: boolean = true) {
    this.#ghostState = null;
    this.#programmaticMutationPending = false;
    releaseItem(this);
    super.destroy(removeElement);
  }
}
