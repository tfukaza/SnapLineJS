import { BaseObject, ElementObject, cloneDomProperty } from "@snap-engine/core";
import type { AnimationConfig, Container } from "./container";
import type { dragStartProp, dragProp, dragEndProp } from "@snap-engine/core";
import { AnimationObject } from "@snap-engine/core/animation";
import type {
  ItemId,
  ItemSnapshot,
  ItemMetadata,
  LayoutDirection,
  LayoutMainAxisAlign,
  LayoutModel,
  LayoutWrap,
} from "./snapshot";
import type {
  DragLocation,
  GhostCreateEvent,
  GhostKind,
  GhostRect,
  GhostRole,
  VisualGeometryInvalidationReason,
} from "./events";
import {
  buildDragLocation,
  buildGhostEvent,
  buildItemLocation,
} from "./event-builders";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  assertCanFireItemInsert,
  assertCanFireItemMove,
  assertCanFireItemRemove,
  fireCreateGhost,
  fireGhostInsert,
  fireGhostRemove,
  fireItemInsert,
  fireItemMove,
  fireItemRemove,
  settleMutation,
} from "./mutation";
import { resolveSortStrategy } from "./drag/drop-strategy";
import { DragSession } from "./drag/session";
import { reconcileTreeState } from "./tree-state";

// The minimum distance threshold for triggering FLIP animations
const MIN_FLIP_DISTANCE = 0.5;

interface FlipAnimationState {
  item: Item;
  key: string;
  first: DOMRect | null;
  firstParent: DOMRect | null;
  firstParentItem: Item | null;
  last: DOMRect | null;
  lastParent: DOMRect | null;
  lastParentItem: Item | null;
  targetElement: HTMLElement | null;
}

interface TransformOffset {
  x: number;
  y: number;
}

interface ElementRectAnimationOptions {
  coordinateParent?: Item | null;
  firstParent?: DOMRect | null;
  firstParentItem?: Item | null;
  lastParent?: DOMRect | null;
  lastParentItem?: Item | null;
  subtractAncestorOffset?: boolean;
  initialOffset?: TransformOffset;
}

/**
 * Gathers all selected items in the tree for a drag operation.
 */
function collectSelectedDragGroup(root: Item, pressed: Item): Item[] {
  if (!pressed.selected) return [pressed];

  const group: Item[] = [];
  const visit = (node: Item) => {
    for (const child of node.itemOrderedList) {
      if (child.isGhost || child.locked) continue;
      if (child.selected) {
        group.push(child);
        continue;
      }
      visit(child);
    }
  };
  visit(root);
  return group.length > 0 ? group : [pressed];
}

/**
 * Traverses the tree of selected items to identify
 * the nearest ancestor of `pressed` that is in the selection group.
 */
function findGroupAnchor(group: Item[], pressed: Item): Item {
  let current: BaseObject | null = pressed;
  while (current instanceof Item) {
    if (group.includes(current)) return current;
    current = current.parent;
  }
  return pressed;
}

export class Item extends ElementObject {
  #rootContainer: Container | null = null;
  #itemId: ItemId | null = null;
  #metadata: ItemMetadata = {};
  #locked: boolean = false;
  #selected: boolean = false;
  #dragSnapshot: ItemSnapshot<Item> | null = null;
  #itemOrderedList: Item[] = [];
  #isGhost: boolean = false;
  #visualAnimationOffset: TransformOffset = { x: 0, y: 0 };

  frameworkManagedGhostElement: boolean = false;

  constructor(engine: any, parent: Container | null, isGhost: boolean = false) {
    super(engine, parent);
    this.#isGhost = isGhost;
    this.event.input.dragStart = this.dragStart;
    this.event.input.drag = this.drag;
    this.event.input.dragEnd = this.dragEnd;
    this.event.dom.onAssignDom = () => {
      this.writeDom();
    };
    this.transformMode = "none";

    // If there is no parent element, assume this is the root container
    this.rootContainer = parent
      ? parent.rootContainer
      : (this as unknown as Container);
  }

  /**
   * Create and return a new instance of the ghost item for the given drag
   * session/lifecycle kind. This also invokes the `createGhost` callback,
   * which:
   * - In vanilla JS mode, is responsible for creating the DOM element.
   * - In a frontend framework, signals that the ghost element should be created by the framework.
   */
  createGhostItem(
    session: DragSession,
    kind: GhostKind,
    container: Container,
    ghostRect?: GhostRect | null,
    role: GhostRole = "target",
  ): Item | null {
    const ghostItem = new Item(this.engine, null, true);
    ghostItem.itemId = this.itemId;
    ghostItem.metadata = { ...this.metadata };
    const createEvent: GhostCreateEvent = buildGhostEvent(
      session,
      kind,
      role,
      this,
      ghostItem,
      container,
      ghostRect,
    );

    // If the items are NOT managed by a framework,
    // the callback should return an HTMLElement.
    // Otherwise, the callback returns null and the framework creates the DOM element.
    const ghostElement = fireCreateGhost(createEvent);
    if (ghostElement instanceof HTMLElement) {
      ghostItem.element = ghostElement;
      ghostItem.frameworkManagedGhostElement = false;
    } else {
      ghostItem.frameworkManagedGhostElement = true;
    }
    return ghostItem;
  }

  /**
   * Add an item to a container.
   *
   * @note The DOM element of the item must be set before calling this method.
   * @param item
   */
  addItem(item: Item) {
    if (
      this.children.includes(item) &&
      this.#itemOrderedList.find((i) => i === item)
    ) {
      throw new Error("Item is already a child of this container");
    }
    this.attachItemToContainer(
      this as unknown as Container,
      item,
      this.#itemOrderedList.length,
    );
    this.takeRootSnapshot();
  }

  /**
   * Remove an item from a container
   * @param id Item ID of the item to remove
   * @returns True if the item was found and removed, false otherwise
   */
  removeItem(id: ItemId) {
    const item =
      this.#itemOrderedList.find(
        (item) => !item.isGhost && this.itemKey(item) === id,
      ) ??
      this.children.find(
        (item): item is Item =>
          item instanceof Item && !item.isGhost && this.itemKey(item) === id,
      );
    if (!item) return false;

    this.removeItemFrom(this as unknown as Container, item);
    return true;
  }

  /**
   * Returns the unique identifier for an item.
   * If a stable itemId was not assigned to the item, it will fall back to
   * the item's engine's object ID.
   *
   * Ghost items are always prefixed with `ghost:` so they can never be
   * conflated with the original item they shadow, regardless of sort mode.
   *
   * @internal
   */
  itemKey(item: Item): string {
    const id = item.resolvedItemId;
    return item.isGhost ? `ghost:${id}` : id;
  }

  /**
   * Find an item by its item id within this container.
   *
   * @param id Stable item id from `itemId`.
   * @returns Matching item object, or null when the tree has no matching item.
   * @internal
   */
  findItemByKey(id: ItemId): Item | null {
    const directItem =
      this.#itemOrderedList.find((item) => this.itemKey(item) === id) ??
      this.children.find(
        (item): item is Item =>
          item instanceof Item && !item.isGhost && this.itemKey(item) === id,
      );
    if (directItem) return directItem;

    for (const child of this.#itemOrderedList) {
      const found = child.findItemByKey(id);
      if (found) return found;
    }

    return null;
  }

  /**
   * Move an item into a target container.
   *
   * This is the public API used by frameworks. It accepts
   * an id instead of an `Item` so callers do not need to retain engine
   * object references.
   *
   * @param id Stable item id from `itemId`.
   * @param container Destination SnapSort container.
   * @param index Destination index in the target container.
   * @returns True when a matching item was found and a move was requested.
   */
  moveItem(id: ItemId, container: Container, index: number) {
    this.takeRootSnapshot();
    const root = this.#rootContainer as unknown as Item;
    const item = root.findItemByKey(id);
    if (!item) return false;
    this.moveItemToContainer(container, item, index, null);
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
    if (!this.parent) {
      return { index: -1, container: null };
    }
    const parentContainer = this.parent as unknown as Container;
    const idx = parentContainer.itemOrderedList.indexOf(this);
    return { index: idx, container: parentContainer };
  }

  get metadata(): ItemMetadata {
    return this.#metadata;
  }

  set metadata(value: ItemMetadata) {
    this.#metadata = value;
  }

  get itemId(): ItemId | null {
    return this.#itemId;
  }

  set itemId(value: ItemId | null | undefined) {
    this.#itemId = value ?? null;
  }

  get resolvedItemId(): ItemId {
    return this.#itemId ?? this.id;
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
    this.#rootContainer = value;
    for (const child of this.children) {
      if (child instanceof Item) child.rootContainer = value;
    }
  }

  get isGhost(): boolean {
    return this.#isGhost;
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
    const session = this.rootContainer.dragSession;
    if (!session || !this.#dragSnapshot) return null;
    return { x: session.pointer.x, y: session.pointer.y };
  }

  /**
   * Returns the dragged item's top-left position in world coordinates.
   * @note This does not account for containers being animated.
   */
  get dragPositionX(): number {
    const session = this.rootContainer.dragSession;
    if (!session || !this.#dragSnapshot) return this.worldTransform.x;
    const visualStart = session.dragVisualStart.get(this);
    return (
      (visualStart?.x ?? this.#dragSnapshot.box.x) +
      session.pointer.x -
      session.start.x
    );
  }

  /**
   * Returns the dragged item's top-left position in world coordinates.
   * @note This does not account for containers being animated.
   */
  get dragPositionY(): number {
    const session = this.rootContainer.dragSession;
    if (!session || !this.#dragSnapshot) return this.worldTransform.y;
    const visualStart = session.dragVisualStart.get(this);
    return (
      (visualStart?.y ?? this.#dragSnapshot.box.y) +
      session.pointer.y -
      session.start.y
    );
  }

  cancelAnimations() {
    this.#visualAnimationOffset = { x: 0, y: 0 };
    super.cancelAnimations();
  }

  #parentItem(): Item | null {
    return this.parent instanceof Item ? this.parent : null;
  }

  /**
   * Calculate the aggregated visual offset of all parent containers
   * while they are being animated. In simple terms, this
   * function answers the question "How much has this item's container
   * drifted from its original position due to animations applied to it
   * or any of its ancestors?"
   *
   * @param parent The starting ancestor item.
   * @returns The aggregated visual offset as a TransformOffset object.
   */
  #ancestorVisualOffset(parent: Item | null): TransformOffset {
    const offset = { x: 0, y: 0 };
    let current: BaseObject | null = parent;
    while (current) {
      if (current instanceof Item) {
        const currentOffset = current.#visualAnimationOffset;
        offset.x += currentOffset.x;
        offset.y += currentOffset.y;
      }
      current = current.parent;
    }
    return offset;
  }

  #setVisualAnimationOffset(x: number, y: number) {
    this.#visualAnimationOffset = { x, y };
  }

  #clearVisualAnimationOffset() {
    this.#visualAnimationOffset = { x: 0, y: 0 };
  }

  /**
   * Return this item's children sorted by their DOM order.
   *
   * @returns Child objects ordered by their current element order in the DOM.
   */
  #childrenInDomOrder(): Item[] {
    const children = this.children.filter(
      (child): child is Item => child instanceof Item,
    );
    const childSet = new Set(children);
    const seen = new Set<Item>();
    const logicalOrder = [
      ...this.#itemOrderedList.filter((child) => {
        if (!childSet.has(child) || seen.has(child)) return false;
        seen.add(child);
        return true;
      }),
      ...children.filter((child) => {
        if (seen.has(child)) return false;
        seen.add(child);
        return true;
      }),
    ];
    const hasDomPosition = (item: Item) => item.element?.isConnected === true;
    const domOrdered = logicalOrder.filter(hasDomPosition).sort((a, b) => {
      const cmp = a.element!.compareDocumentPosition(b.element!);
      if (cmp & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (cmp & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    let domIndex = 0;
    return logicalOrder.map((item) =>
      hasDomPosition(item) ? domOrdered[domIndex++] : item,
    );
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
      const prop = child.dragSnapshot?.box ?? child.currentDomProperty;
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
   * @note Frontend frameworks should invoke this once after the
   * entire tree has been added to the DOM.
   */
  takeRootSnapshot() {
    const root = this.#rootContainer;
    if (!root) {
      throw new Error("Root container not found");
    }
    root[reconcileTreeState]();
    root.queueReadTree("READ_1", `snapsort-read-root-${this.id}`);
  }

  /**
   * Reconcile logical children with the DOM order after a synchronous
   * structural mutation has committed.
   * @internal
   */
  [reconcileTreeState](): void {
    const root = this.rootContainer;
    root.#updateState(root);
  }

  #updateState(root: Container) {
    this.#rootContainer = root;
    this.#itemOrderedList = this.#childrenInDomOrder();
    for (const child of this.#itemOrderedList) {
      child.#updateState(root);
    }
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
      const prop = this.currentDomProperty;
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
    return "direction" in this && typeof (this as any).direction === "string"
      ? (this as any).direction
      : "column";
  }

  #snapshotMainAxisAlign(): LayoutMainAxisAlign {
    return "mainAxisAlign" in this && (this as any).mainAxisAlign === "center"
      ? "center"
      : "start";
  }

  #snapshotLayoutModel(): LayoutModel {
    return "layoutModel" in this && (this as any).layoutModel === "slots"
      ? "slots"
      : "flow";
  }

  #snapshotWrap(): LayoutWrap {
    return "wrap" in this && (this as any).wrap === "nowrap"
      ? "nowrap"
      : "auto";
  }

  #snapshotStretchItems(): boolean {
    return "stretchItems" in this && (this as any).stretchItems === true;
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
      key: this.itemKey(this),
      itemId: this.resolvedItemId,
      metadata: Object.freeze({ ...this.#metadata }),
      direction: this.#snapshotDirection(),
      mainAxisAlign: this.#snapshotMainAxisAlign(),
      layoutModel: this.#snapshotLayoutModel(),
      wrap: this.#snapshotWrap(),
      stretchItems: this.#snapshotStretchItems(),
      locked: this.#locked,
      box: cloneDomProperty(this.currentDomProperty),
      children: [],
    };
    this.#dragSnapshot = snapshot;
    snapshot.children = snapshotItems.map((child) =>
      child.captureDragSnapshotTree(),
    );
    return snapshot;
  }

  /**
   * Give this item a frozen drag snapshot copied from another item's, keyed to
   * this item. Used by `DragSession.handoff` so a replacement preserves the
   * active gesture's drop prediction and pointer-follow geometry.
   *
   * @param source Item whose drag snapshot geometry to adopt.
   * @internal
   */
  adoptDragSnapshotFrom(source: Item): void {
    const src = source.#dragSnapshot;
    if (!src) return;
    this.#dragSnapshot = {
      value: this,
      key: this.itemKey(this),
      itemId: this.resolvedItemId,
      metadata: Object.freeze({ ...this.#metadata }),
      direction: src.direction,
      mainAxisAlign: src.mainAxisAlign,
      layoutModel: src.layoutModel,
      wrap: src.wrap,
      stretchItems: src.stretchItems,
      locked: this.#locked,
      box: cloneDomProperty(src.box),
      children: [],
    };
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
    if (!container) return null;
    const config = container.configuration;
    if (config.animation === null) return null;
    return config.animation?.reorder ?? null;
  }

  /** @internal */
  dropAnimationConfig(container: Container | null): AnimationConfig | null {
    if (!container) return null;
    const config = container.configuration;
    if (config.animation === null) return null;
    return config.animation?.drop ?? null;
  }

  /**
   * Collect all currently visible SnapSort items in this subtree.
   *
   * @param node Root of the subtree to collect.
   * @param exclude Item that should not be animated, usually the actively dragged item.
   * @param items Accumulator for collected items.
   * @returns Items that can participate in FLIP animation.
   */
  #collectFlipItems(
    node: Item,
    exclude: Set<Item> | null,
    items: Item[] = [],
  ): Item[] {
    for (const child of node.#itemOrderedList) {
      if (!exclude?.has(child) && child.element) {
        items.push(child);
      }
      this.#collectFlipItems(child, exclude, items);
    }
    return items;
  }

  /**
   * Capture the current visual position for all FLIP animation candidates.
   *
   * `getBoundingClientRect()` intentionally includes active transform
   * animations, so interrupted reorder animations restart from the element's
   * actual on-screen position instead of its previous layout destination.
   *
   * @param root Root of the SnapSort tree being mutated.
   * @param exclude Item that should not be animated.
   * @returns Items with current visual rectangles captured as first positions.
   */
  #captureFlipSnapshot(
    root: Item,
    exclude: Set<Item> | null,
  ): FlipAnimationState[] {
    return root.#collectFlipItems(root, exclude).map((item) => {
      const parentItem = item.#parentItem();
      return {
        item,
        key: this.itemKey(item),
        // TODO: These should be done via readDom
        first: item.element!.getBoundingClientRect(),
        firstParent: parentItem?.element?.getBoundingClientRect() ?? null,
        firstParentItem: parentItem,
        last: null,
        lastParent: null,
        lastParentItem: null,
        targetElement: item.element,
      };
    });
  }

  /**
   * Capture the final visual positions after the DOM mutation.
   *
   * @param snapshot Items whose final positions should be measured.
   * @param root Root of the SnapSort tree after the DOM mutation.
   * @returns Nothing.
   */
  #captureFlipLast(snapshot: FlipAnimationState[], root: Item) {
    root[reconcileTreeState]();
    const currentItems = new Map(
      root
        .#collectFlipItems(root, null)
        .map((item) => [this.itemKey(item), item]),
    );
    for (const entry of snapshot) {
      const currentItem = currentItems.get(entry.key) ?? null;
      if (currentItem) {
        entry.item = currentItem;
        entry.targetElement = currentItem.element;
      } else {
        entry.targetElement = entry.item.element?.isConnected
          ? entry.item.element
          : null;
      }
      const parentItem = entry.item.#parentItem();
      entry.lastParentItem = parentItem;
      entry.lastParent = parentItem?.element?.getBoundingClientRect() ?? null;
      entry.last = entry.targetElement?.getBoundingClientRect() ?? null;
    }
  }

  /**
   * Start FLIP animations from captured visual snapshots to the current layout.
   *
   * This method only writes transforms and starts SnapEngine animations. All
   * layout reads must have happened in earlier READ stages.
   *
   * @param snapshot Visual rectangles captured before and after the DOM mutation.
   * @param animationConfig Reorder animation configuration.
   * @param animationOwner Fallback object that owns animations for re-created DOM nodes.
   * @returns Nothing.
   */
  #playFlipAnimations(
    snapshot: FlipAnimationState[],
    animationConfig: AnimationConfig,
    animationOwner: Item,
    draggedItems: Item | Item[] | null = null,
  ) {
    const duration = animationConfig.duration ?? 160;
    const easing = animationConfig.timing_function ?? "ease-out";
    const entriesByItem = new Map(snapshot.map((entry) => [entry.item, entry]));

    // Account for offsets if the container is being animated.
    const orderedSnapshot = snapshot.slice().sort((a, b) => {
      if (this.#isFlipAncestor(a, b, entriesByItem)) return -1;
      if (this.#isFlipAncestor(b, a, entriesByItem)) return 1;
      return (
        this.#flipAnimationDepth(a, entriesByItem) -
        this.#flipAnimationDepth(b, entriesByItem)
      );
    });
    const initialOffsets = this.#initialFlipOffsets(orderedSnapshot);

    // Start the animations
    for (const {
      item,
      first,
      firstParent,
      firstParentItem,
      last,
      lastParent,
      lastParentItem,
      targetElement,
    } of orderedSnapshot) {
      if (!targetElement || !first || !last) continue;

      this.playElementRectAnimation(
        item,
        first,
        last,
        targetElement,
        { duration, timing_function: easing },
        targetElement === item.element ? item : animationOwner,
        {
          coordinateParent: lastParentItem,
          firstParent,
          firstParentItem,
          lastParent,
          lastParentItem,
          initialOffset: initialOffsets.get(item),
        },
      );
    }

    if (!draggedItems) {
      return;
    }
    const draggedItemList = Array.isArray(draggedItems)
      ? draggedItems
      : [draggedItems];
    if (draggedItemList.length === 0) return;

    // While the FLIP animations above move the dragged items' coordinate
    // parents, re-sync every dragged item's transform each frame so the
    // whole group stays correctly positioned relative to the pointer.
    const session = draggedItemList[0].rootContainer.dragSession;
    if (!session) return;

    session.dragTransformSyncAnimation?.cancel();

    const resyncDraggedItems = () => {
      for (const draggedItem of draggedItemList) {
        draggedItem.scheduleWriteDrag();
      }
    };

    const animation = new AnimationObject(
      null,
      {},
      {
        duration,
        easing,
        tick: () => {
          resyncDraggedItems();
        },
        finish: () => {
          if (session.dragTransformSyncAnimation === animation) {
            session.dragTransformSyncAnimation = null;
          }
          resyncDraggedItems();
        },
      },
    );

    session.dragTransformSyncAnimation = animation;
    animationOwner.addAnimation(animation, { replaceExisting: false });
    animation.play();
  }

  #flipAnimationDepth(
    entry: FlipAnimationState,
    entriesByItem: Map<Item, FlipAnimationState>,
  ) {
    let depth = 0;
    let parent = entry.lastParentItem;
    while (parent) {
      depth += 1;
      parent =
        entriesByItem.get(parent)?.lastParentItem ?? parent.#parentItem();
    }
    return depth;
  }

  #isFlipAncestor(
    possibleAncestor: FlipAnimationState,
    descendant: FlipAnimationState,
    entriesByItem: Map<Item, FlipAnimationState>,
  ) {
    let parent = descendant.lastParentItem;
    while (parent) {
      if (parent === possibleAncestor.item) return true;
      parent =
        entriesByItem.get(parent)?.lastParentItem ?? parent.#parentItem();
    }
    return false;
  }

  #initialFlipOffsets(snapshot: FlipAnimationState[]) {
    const initialOffsets = new Map<Item, TransformOffset>();
    const entriesByItem = new Map(snapshot.map((entry) => [entry.item, entry]));
    const ancestorOffsetFor = (parent: Item | null): TransformOffset => {
      const offset = { x: 0, y: 0 };
      let current = parent;
      while (current) {
        const entry = entriesByItem.get(current);
        if (entry && !initialOffsets.has(current)) {
          compute(entry);
        }
        const currentOffset =
          initialOffsets.get(current) ?? current.#visualAnimationOffset;
        offset.x += currentOffset.x;
        offset.y += currentOffset.y;
        current = entry?.lastParentItem ?? current.#parentItem();
      }
      return offset;
    };
    const compute = ({
      item,
      first,
      firstParent,
      firstParentItem,
      last,
      lastParent,
      lastParentItem,
      targetElement,
    }: FlipAnimationState) => {
      if (initialOffsets.has(item)) return;
      if (!targetElement || !first || !last) return;

      const { dx, dy, useParentLocalDelta } = this.#rectAnimationDelta(
        first,
        last,
        { firstParent, firstParentItem, lastParent, lastParentItem },
      );
      if (
        Math.abs(dx) < MIN_FLIP_DISTANCE &&
        Math.abs(dy) < MIN_FLIP_DISTANCE
      ) {
        return;
      }

      let x = dx;
      let y = dy;
      if (!useParentLocalDelta) {
        const ancestorOffset = ancestorOffsetFor(lastParentItem);
        x -= ancestorOffset.x;
        y -= ancestorOffset.y;
      }
      initialOffsets.set(item, { x, y });
    };

    for (const entry of snapshot) {
      compute(entry);
    }
    return initialOffsets;
  }

  /** @internal */
  playElementRectAnimation(
    item: Item,
    first: DOMRect | null,
    last: DOMRect | null,
    targetElement: HTMLElement | null,
    animationConfig: AnimationConfig | null,
    animationOwner: Item,
    options: ElementRectAnimationOptions = {},
  ) {
    if (!targetElement || !first || !last || !animationConfig) return;

    const { dx, dy, useParentLocalDelta } = this.#rectAnimationDelta(
      first,
      last,
      options,
    );
    if (Math.abs(dx) < MIN_FLIP_DISTANCE && Math.abs(dy) < MIN_FLIP_DISTANCE) {
      return;
    }

    item.cancelAnimations();
    const duration = animationConfig.duration ?? 160;
    const easing = animationConfig.timing_function ?? "ease-out";
    const coordinateParent =
      options.coordinateParent === undefined
        ? item.#parentItem()
        : options.coordinateParent;
    const subtractAncestorOffset =
      options.subtractAncestorOffset ?? !useParentLocalDelta;
    const writeTransformAt = (t: number) => {
      if (t === 0 && options.initialOffset) {
        item.#writeVisualAnimationTransform(
          targetElement,
          options.initialOffset.x,
          options.initialOffset.y,
        );
        return;
      }
      item.#writeRectAnimationTransform(
        targetElement,
        dx,
        dy,
        t,
        coordinateParent,
        subtractAncestorOffset,
      );
    };
    const animation = new AnimationObject(
      null,
      {
        $t: [0, 1],
      },
      {
        duration,
        easing,
        tick: (vars) => {
          writeTransformAt(vars.$t);
        },
        finish: () => {
          item.#clearVisualAnimationOffset();
          targetElement.style.transform = "";
          item.rootContainer.invalidateVisualGeometry([item], "settle");
        },
      },
    );

    animationOwner.addAnimation(animation);
    writeTransformAt(0);
    animation.play();
  }

  #rectAnimationDelta(
    first: DOMRect,
    last: DOMRect,
    options: ElementRectAnimationOptions,
  ) {
    const useParentLocalDelta =
      options.firstParent &&
      options.lastParent &&
      options.firstParentItem === options.lastParentItem;
    return {
      dx: useParentLocalDelta
        ? first.x - options.firstParent!.x - (last.x - options.lastParent!.x)
        : first.x - last.x,
      dy: useParentLocalDelta
        ? first.y - options.firstParent!.y - (last.y - options.lastParent!.y)
        : first.y - last.y,
      useParentLocalDelta,
    };
  }

  #writeRectAnimationTransform(
    targetElement: HTMLElement,
    dx: number,
    dy: number,
    t: number,
    coordinateParent: Item | null,
    subtractAncestorOffset: boolean,
  ) {
    let x = dx * (1 - t);
    let y = dy * (1 - t);
    if (subtractAncestorOffset) {
      const ancestorOffset = this.#ancestorVisualOffset(coordinateParent);
      x -= ancestorOffset.x;
      y -= ancestorOffset.y;
    }
    this.#writeVisualAnimationTransform(targetElement, x, y);
  }

  #writeVisualAnimationTransform(
    targetElement: HTMLElement,
    x: number,
    y: number,
  ) {
    this.#setVisualAnimationOffset(x, y);
    targetElement.style.transform = this.#translateTransform(x, y);
    this.rootContainer.invalidateVisualGeometry([this], "animation");
  }

  /**
   * @note This is used for animation purposes only.
   * To move items in the DOM, use `writeTransform`
   */
  #translateTransform(x: number, y: number) {
    return `translate3d(${x}px, ${y}px, 0px)`;
  }

  /**
   * Play a drop animation for this item.
   * @internal
   */
  playDropAnimation(
    first: DOMRect | null,
    last: DOMRect | null,
    targetElement: HTMLElement | null,
    animationConfig: AnimationConfig | null,
    animationOwner: Item,
  ) {
    this.playElementRectAnimation(
      this,
      first,
      last,
      targetElement,
      animationConfig,
      targetElement === this.element ? this : animationOwner,
    );
  }

  /**
   * Run a DOM mutation with optional FLIP animation for affected items.
   *
   * @param container Container whose reorder animation config controls the mutation.
   * @param excludedItem Item(s) that should not be animated, usually the active drag group.
   * @param mutate DOM mutation to perform between first and last measurements.
   * @returns Nothing.
   */
  withReorderAnimation(
    container: Container | null,
    excludedItem: Item | Item[] | null,
    mutate: () => void,
  ) {
    const animationConfig = this.reorderAnimationConfig(container);
    const targetRoot = container
      ? ((container as unknown as Item)
          .#rootContainer as unknown as Item | null)
      : null;
    const root = targetRoot ?? (this.#rootContainer as unknown as Item) ?? this;
    const excludedSet: Set<Item> | null = excludedItem
      ? new Set(Array.isArray(excludedItem) ? excludedItem : [excludedItem])
      : null;

    if (!animationConfig) {
      mutate();
      return;
    }

    let snapshot: FlipAnimationState[] = [];
    const queuePrefix = `snapsort-flip-${root.id}`;
    root.schedule(
      () => {
        snapshot = this.#captureFlipSnapshot(root, excludedSet);
      },
      { stage: "READ_2", queueId: `${queuePrefix}-read-first` },
    );

    root.schedule(
      async () => {
        for (const { item } of snapshot) {
          item.cancelAnimations();
          item.element!.style.transform = "";
        }
        mutate();
        await settleMutation();
      },
      { stage: "WRITE_2", queueId: `${queuePrefix}-mutate` },
    );

    root.schedule(
      () => {
        this.#captureFlipLast(snapshot, root);
      },
      { stage: "READ_3", queueId: `${queuePrefix}-read-last` },
    );

    root.schedule(
      () => {
        this.#playFlipAnimations(snapshot, animationConfig, root, excludedItem);
      },
      { stage: "WRITE_3", queueId: `${queuePrefix}-play` },
    );
  }

  /**
   * Renders the dragged item.
   *
   * @note This function is currently called in WRITE_1.
   * @internal
   */
  refreshDraggedItemPosition() {
    const session = this.rootContainer.dragSession;
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
    const session = this.rootContainer.dragSession;
    if (!session || session.status !== "active") return;
    const parentItem = session.dragCoordinateParent.get(this) ?? null;

    this.schedule(
      async () => {
        if (
          this.rootContainer.dragSession !== session ||
          session.status !== "active"
        ) {
          return;
        }
        if (!this.element?.isConnected) return;
        if (!parentItem?.element?.isConnected) return;
        // Account for offsets if the container is being animated.
        const visual = parentItem.readDom();
        const ancestorOffset = this.#ancestorVisualOffset(parentItem);
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
    const session = this.rootContainer.dragSession;
    if (
      !session ||
      session.status !== "active" ||
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
    const ancestorOffset = this.#ancestorVisualOffset(parentItem);
    const groupOffset = session.groupVisualOffsets.get(this) ?? {
      x: 0,
      y: 0,
    };
    this.worldTransform.x =
      session.pointer.x -
      layoutPosition.x -
      ancestorOffset.x -
      session.offset.x +
      groupOffset.x;
    this.worldTransform.y =
      session.pointer.y -
      layoutPosition.y -
      ancestorOffset.y -
      session.offset.y +
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
    items: Item[],
    index: number,
    session: DragSession | null,
  ) {
    // Adjust for members already living in the destination container: each
    // one that currently sits before `index` will vanish from in front of
    // the target slot once detached, shifting it left by one. Must be
    // computed from *live* (pre-detach) indices.
    const adjustedIndexFor = (liveItems: Item[]): number => {
      const removedBefore = liveItems.filter(
        (member) =>
          member.parent === container &&
          container.itemOrderedList.indexOf(member) < index,
      ).length;
      return index - removedBefore;
    };
    const isAlreadyInPlace = (
      liveItems: Item[],
      adjustedIndex: number,
    ): boolean =>
      liveItems.length > 0 &&
      liveItems.every(
        (member, i) =>
          member.parent === container &&
          container.itemOrderedList.indexOf(member) === adjustedIndex + i,
      );

    const move = () => {
      // The move is deferred to a later render stage; members may have been
      // detached in the meantime (e.g. destroyed).
      const liveItems = items.filter((member) => !!member.parent);
      if (liveItems.length === 0) return;

      const adjustedIndex = adjustedIndexFor(liveItems);
      if (isAlreadyInPlace(liveItems, adjustedIndex)) return;

      assertCanFireItemMove(container);

      const froms: DragLocation[] = liveItems.map((member) => {
        const location = buildItemLocation(member);
        if (!location) throw new Error("Item has no parent container");
        return location;
      });
      for (const member of liveItems) {
        this.detachItemFromContainer(member.container, member);
      }
      this.moveItemsAt(froms, container, liveItems, adjustedIndex, session);
    };

    if (isAlreadyInPlace(items, adjustedIndexFor(items))) {
      return;
    }

    this.withReorderAnimation(container, session ? items : null, move);
  }

  /**
   * Attach an item to a container at a specific index.
   * @internal
   */
  attachItemToContainer(container: Container, item: Item, index: number) {
    const destination = container as unknown as Item;
    const currentParent =
      item.parent instanceof Item ? (item.parent as Item) : null;
    destination.appendChild(item);
    if (currentParent) {
      currentParent.#itemOrderedList = currentParent.#itemOrderedList.filter(
        (entry) => entry !== item,
      );
    }
    destination.#itemOrderedList = destination.#itemOrderedList.filter(
      (entry) => entry !== item,
    );
    item.rootContainer = container.rootContainer;
    if (index >= container.itemOrderedList.length) {
      container.itemOrderedList.push(item);
    } else {
      container.itemOrderedList.splice(index, 0, item);
    }
  }

  #insertItemElement(
    container: Container,
    item: Item,
    index: number,
    session: DragSession | null,
  ) {
    const itemAfterIndex =
      index >= container.itemOrderedList.length - 1
        ? null
        : container.itemOrderedList[index + 1].element;
    try {
      fireItemInsert(container, [item], index, itemAfterIndex, session);
    } finally {
      container[reconcileTreeState]();
    }
  }

  #insertGhostElement(
    original: Item,
    container: Container,
    ghostItem: Item,
    index: number,
    ghostRect: GhostRect | null | undefined,
    session: DragSession,
    kind: GhostKind,
    role: GhostRole,
  ) {
    const itemAfterIndex =
      index >= container.itemOrderedList.length - 1
        ? null
        : container.itemOrderedList[index + 1].element;
    try {
      fireGhostInsert(
        container,
        original,
        ghostItem,
        index,
        itemAfterIndex,
        ghostRect,
        session,
        kind,
        role,
      );
    } finally {
      container[reconcileTreeState]();
    }
  }

  /**
   * Insert an item at a specific index in the item list and DOM, firing the
   * `onItemInsert` primitive. Used for insertion unrelated to a move (e.g.
   * programmatic `addItem`-adjacent flows); dragged items dropping into a
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
    this.attachItemToContainer(container, item, index);
    this.#insertItemElement(container, item, index, session);
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
    froms: DragLocation[],
    container: Container,
    items: Item[],
    index: number,
    session: DragSession | null,
  ) {
    assertCanFireItemMove(container);
    items.forEach((member, i) => {
      this.attachItemToContainer(container, member, index + i);
    });
    const runEndIndex = index + items.length;
    const itemAfterIndex =
      runEndIndex >= container.itemOrderedList.length
        ? null
        : container.itemOrderedList[runEndIndex].element;
    const to = buildDragLocation(container, index);
    try {
      fireItemMove(froms, to, items, itemAfterIndex, session);
    } finally {
      container[reconcileTreeState]();
    }
  }

  /** @internal */
  insertGhostAt(
    original: Item,
    container: Container,
    ghostItem: Item,
    index: number,
    ghostRect: GhostRect | null | undefined,
    session: DragSession,
    kind: GhostKind,
    role: GhostRole = "target",
  ) {
    assertCanFireGhostInsert(container);
    assertCanFireGhostRemove(container);
    this.attachItemToContainer(container, ghostItem, index);
    this.#insertGhostElement(
      original,
      container,
      ghostItem,
      index,
      ghostRect,
      session,
      kind,
      role,
    );
  }

  /**
   * Remove an item from the current container.
   * @param container
   * @param item
   */
  detachItemFromContainer(container: Container, item: Item) {
    container.removeChild(item);
    (container as unknown as Item).#itemOrderedList = (
      container as unknown as Item
    ).#itemOrderedList.filter((i) => i !== item);
  }

  /**
   * Remove an item from the item list and DOM.
   *
   * @param container Container that currently owns the item.
   * @param item The item to remove.
   * @param session Drag session this removal belongs to, or null for a programmatic removal.
   * @returns Nothing.
   */
  removeItemFrom(
    container: Container,
    item: Item,
    session: DragSession | null = null,
  ) {
    assertCanFireItemRemove(container);
    this.detachItemFromContainer(container, item);
    try {
      fireItemRemove(container, [item], session);
    } finally {
      container[reconcileTreeState]();
    }
  }

  /** @internal */
  removeGhostFrom(
    original: Item,
    container: Container,
    ghostItem: Item,
    session: DragSession,
    kind: GhostKind,
    role: GhostRole = "target",
  ) {
    assertCanFireGhostRemove(container);
    this.detachItemFromContainer(container, ghostItem);
    try {
      fireGhostRemove(container, original, ghostItem, session, kind, role);
    } finally {
      container[reconcileTreeState]();
    }
  }

  /**
   * Called when a drag operation starts.
   * @param prop
   * @returns
   */
  dragStart(prop: dragStartProp) {
    if (prop.objectId !== this.id) return;
    if (this.#locked) return;

    // Take a snapshot of the current state.
    // Any DOM read for this is queued into READ_1 stage.
    this.takeRootSnapshot();
    // Record the initial container and index of the item
    const { index: currentIndex, container: currentContainer } =
      this.getIndexAndContainer();
    if (!currentContainer) {
      throw new Error("Item has no parent container");
    }

    const root = this.rootContainer;
    const group = collectSelectedDragGroup(root as unknown as Item, this);
    const pressedItem = findGroupAnchor(group, this);
    const strategy = resolveSortStrategy(
      root.config.mode,
      root.config.strategy,
    );
    const sources: DragLocation[] = group.map((member) => {
      if (member === this) {
        return buildDragLocation(currentContainer, currentIndex);
      }
      const { index, container } = member.getIndexAndContainer();
      if (!container) {
        throw new Error("Item has no parent container");
      }
      return buildDragLocation(container, index);
    });
    const session = new DragSession(
      root,
      group,
      sources,
      strategy,
      prop,
      pressedItem,
    );
    root.dragSession = session;
    session.begin(prop);
  }

  /**
   * Handle drag movement updates.
   * @param prop Drag position property containing mouse coordinates.
   */
  drag(prop: dragProp) {
    if (prop.objectId !== this.id) return;
    const session = this.rootContainer.dragSession;
    if (!session || session.status !== "active") return;
    session.pointerMove(prop);
  }

  dragEnd(prop: dragEndProp) {
    if (prop.objectId !== this.id) return;
    const session = this.rootContainer.dragSession;
    if (!session) {
      // Defensive cleanup in case a veto or stale session left visual state
      // behind (e.g. onDragStart returned false after the dataset flag was
      // set on a previous, unrelated gesture).
      if (this.element) delete this.element.dataset.snapsortDragging;
      return;
    }
    if (prop.cancelled || session.status === "pending") {
      session.cancel();
      return;
    }
    if (session.status !== "active") return;
    session.status = "dropping";
    session.dragTransformSyncAnimation?.cancel();
    session.dragTransformSyncAnimation = null;
    session.strategy.lifecycle.drop(session);
    void prop;
  }

  destroy(removeElement: boolean = true) {
    if (this.parent) {
      this.detachItemFromContainer(this.parent as unknown as Container, this);
    }
    super.destroy(removeElement);
  }
}
