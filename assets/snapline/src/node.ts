import { BaseObject, ElementObject, mergeDefined } from "@snap-engine/core";
import type { Point, Rect } from "@snap-engine/core/geometry";
import { ConnectorMirror } from "./connector";
import { LineMirror } from "./line";
import type {
  pointerUpProp,
  pointerDownProp,
  dragStartProp,
  dragProp,
  dragEndProp,
  PointerPosition,
} from "@snap-engine/core";
import { RectCollider } from "@snap-engine/core/collision";
import { getGraphRegistry } from "./internal/shared-data";
import { mintDomainId } from "./internal/graph-registry";
import type { NewLineResolver, SnapLineMetadata } from "./connector";
import type { GeometryInvalidationObserver } from "./types";

export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const RESIZE_HANDLES: readonly ResizeHandle[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

export interface NodeConfig {
  id?: string;
  lockPosition?: boolean;
  minWidth?: number;
  minHeight?: number;
  metadata?: SnapLineMetadata;
  callbacks?: NodeCallbacks;
  edgePan?: boolean;
}

/** Config with every defaultable field resolved. */
export type ResolvedNodeConfig = Required<Omit<NodeConfig, "id">>;

const DEFAULT_NODE_CONFIG: ResolvedNodeConfig = {
  lockPosition: false,
  minWidth: 0,
  minHeight: 0,
  metadata: {},
  callbacks: {},
  edgePan: true,
};

/**
 * Node geometry maintained by SnapLine during drag or resize.
 * After that, this is committed to the frontend framework.
 */
/** A node's world-space rectangle. */
export interface NodeGeometry extends Rect {
  readonly node: NodeMirror;
}

/** Batched geometry observation for group/multi-select drag. */
export interface GeometryChangeEvent {
  nodes: readonly NodeGeometry[];
}

export interface NodePointerEvent {
  node: NodeMirror;
  pointerId: number;
  position: PointerPosition;
  originalEvent?: PointerEvent;
}

export interface NodeDragPositionEvent {
  node: NodeMirror;
  x: number;
  y: number;
  startX: number;
  startY: number;
  position: PointerPosition;
}

/** A node's world-space rectangle during a resize gesture. */
export interface NodeResizeEvent extends Rect {
  readonly node: NodeMirror;
  readonly handle: ResizeHandle | null;
}

export interface NodeSelectionEvent {
  node: NodeMirror;
  selected: boolean;
  selection: readonly NodeMirror[];
}

export type SelectionMode = "replace" | "add" | "toggle";

export interface NodeSelectionModeEvent {
  node: NodeMirror;
  selected: boolean;
  selection: readonly NodeMirror[];
  originalEvent: PointerEvent;
}

export interface NodeLinesEvent {
  node: NodeMirror;
  lines: readonly LineMirror[];
}

export interface NodeCallbacks {
  /**
   * Seeds application data onto a line a drag from any of this node's
   * connectors creates. A connector-level resolver may override it.
   */
  resolveNewLine?: NewLineResolver;
  /** Determines if a drag gesture should start. */
  canStartDrag?: (event: NodePointerEvent) => boolean;
  /** Allow node position to be overridden during drag, e.g. to implement snap-to-grid. */
  resolveDragPosition?: (
    event: NodeDragPositionEvent,
  ) => Point;
  /** Override if and how nodes get selected or deselected. */
  resolveSelectionMode?: (event: NodeSelectionModeEvent) => SelectionMode;
  /** Called when selected status of a node changes. */
  onSelectionChange?: (event: NodeSelectionEvent) => void;
  onDragStart?: (event: NodePointerEvent) => void;
  onDrag?: (event: NodePointerEvent) => void;
  /** Observes live size updates; core writes the retained element geometry. */
  onSizeChange?: (event: NodeResizeEvent) => void;
  /**
   * Called when drag or resize finishes.
   * Frontend frameworks should read the committed geometry from the event
   * and update its state accordingly.
   */
  onGeometryCommit?: (event: GeometryChangeEvent) => void;
  /**
   * Called when a line was added, removed, or changed.
   * This differs from handleLineChangeRequest in that it can also be called
   * for temporary lines that are not committed to application state.
   */
  onLinesChanged?: (event: NodeLinesEvent) => void;
}

class NodeMirror extends ElementObject {

  readonly nodeId: string;
  #config: ResolvedNodeConfig;
  #connectors: { [key: string]: ConnectorMirror };
  #dragStartX = 0;
  #dragStartY = 0;
  #hitBox: RectCollider;
  #pointerReferenceX: number;
  #pointerReferenceY: number;
  #hasMoved: boolean;
  #resizeRegions = new Set<ResizeRegionMirror>();
  #activeResizeHandle: ResizeHandle | null = null;
  #isResizing = false;
  #geometryObservers = new Set<GeometryInvalidationObserver<NodeMirror>>();
  #authoredWidth = 0;
  #authoredHeight = 0;
  #hasAuthoredSize = false;
  #isResizeArmed = false;
  #resizeStartWidth = 0;
  #resizeStartHeight = 0;
  #resizeStartX = 0;
  #resizeStartY = 0;
  #callbacks: NodeCallbacks;
  #edgePanPointerId: number | null = null;
  #dragHandles = new Set<HTMLElement>();
  #dragPointerId: number | null = null;
  #dragRoots: NodeMirror[] = [];
  #dragCommitNodes: NodeMirror[] = [];
  #lastDragPosition: PointerPosition | null = null;
  #pointerSelectionMode: SelectionMode = "replace";
  #wasSelectedAtPointerDown = false;

  constructor(engine: any, parent: BaseObject | null, config: NodeConfig = {}) {
    super(engine, parent);
    this.#config = mergeDefined(DEFAULT_NODE_CONFIG, config);
    this.#callbacks = this.#config.callbacks;
    this.nodeId = config.id ?? mintDomainId("node", this.global);
    getGraphRegistry(this.engine).registerNode(this);

    this.#connectors = {};
    this.#dragStartX = this.worldTransform.x;
    this.#dragStartY = this.worldTransform.y;
    this.#pointerReferenceX = 0;
    this.#pointerReferenceY = 0;
    this.transformMode = "direct";

    this.event.input.pointerDown = this.onCursorDown;
    this.event.input.dragStart = this.onDragStart;
    this.event.input.drag = this.onDrag;
    this.event.input.dragEnd = this.onDragEnd;
    this.event.input.pointerUp = this.onUp;
    this.#hitBox = new RectCollider(this.engine, this, 0, 0, 0, 0);
    this.addCollider(this.#hitBox);

    this.#hasMoved = false;

    this.event.dom.onResize = () => this.remeasureDomGeometry();
  }

  get config(): ResolvedNodeConfig {
    return this.#config;
  }

  get callbacks(): NodeCallbacks {
    return this.#callbacks;
  }

  get metadata(): SnapLineMetadata {
    return this.#config.metadata;
  }

  /** The node's collision footprint (world = worldTransform + width/height). */
  get hitBox(): RectCollider {
    return this.#hitBox;
  }

  registerDragHandle(element: HTMLElement): () => void {
    this.#dragHandles.add(element);
    return () => this.#dragHandles.delete(element);
  }

  /** @internal Tracks resize-region children for deterministic node teardown. */
  attachResizeRegion(region: ResizeRegionMirror): void {
    this.#resizeRegions.add(region);
  }

  /** @internal Removes a resize-region child that is being destroyed. */
  detachResizeRegion(region: ResizeRegionMirror): void {
    this.#resizeRegions.delete(region);
  }

  setStartPositions() {
    this.#dragStartX = this.worldTransform.x;
    this.#dragStartY = this.worldTransform.y;
  }

  setSelected(selected: boolean) {
    this.dataAttribute = {
      selected: String(selected),
      "snapline-state": selected ? "focus" : "idle", // TODO: Not used?
    };
    const selectList = getGraphRegistry(this.engine).selection;
    if (selected) {
      if (!selectList.includes(this)) {
        selectList.push(this);
      }
    } else {
      const index = selectList.indexOf(this);
      if (index >= 0) selectList.splice(index, 1);
    }
    this.schedule(() => this.writeDom(), {
      stage: "WRITE_1",
      queueId: `${this.id}-selected`,
    });
    this.#callbacks.onSelectionChange?.({
      node: this,
      selected,
      selection: [...getGraphRegistry(this.engine).selection],
    });
  }

  /** Schedules a WRITE_2 for every line on every connector of this node. */
  scheduleLineWrites(): void {
    for (const connector of Object.values(this.#connectors)) {
      connector.scheduleAllLineWrites();
    }
  }

  /** Synchronously writes every line on every connector (call inside a WRITE stage). */
  // TODO: We should have some kind of guard for these typed of functions that
  // need to be called in specific stages.
  writeLinesNow(): void {
    const lines = new Set([
      ...this.getAllOutgoingLines(),
      ...this.getAllIncomingLines(),
    ]);
    for (const line of lines) {
      line.invalidateGeometryNow();
    }
  }

  #transformNodeTree(): NodeMirror[] {
    const nodes: NodeMirror[] = [];
    const visit = (node: NodeMirror) => {
      nodes.push(node);
      for (const child of node.transformChildren) {
        if (child instanceof NodeMirror) visit(child);
      }
    };
    visit(this);
    return nodes;
  }

  scheduleTransformAndLines(): void {
    this.schedule(() => this.writeTransformRecursive(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
    for (const node of this.#transformNodeTree()) {
      node.#notifyGeometryInvalidated();
      node.scheduleLineWrites();
    }
  }

  /**
   * Re-measure the node box + each connector's local center (READ_1) and re-glue
   * every incoming/outgoing line (WRITE_2).
   */
  remeasureDomGeometry(): void {
    if (!this.element) {
      throw new Error(
        "Cannot sync node geometry before assigning its DOM element",
      );
    }
    this.schedule(() => this.#syncMeasuredGeometry("READ_1"), {
      stage: "READ_1",
      queueId: `${this.id}-remeasure`,
    });
    this.scheduleLineWrites();
  }

  /* Reconciles state with what the browser actually rendered */
  #syncMeasuredGeometry(stage: "READ_1" | "READ_2"): void {
    if (!this.element) return;
    const property = this.readDom({ unapplyTransform: false }, stage);
    // During resize, setSizeState sets the correct dimensions.
    if (!this.#isResizing) {
      this.#hitBox.width = property.width;
      this.#hitBox.height = property.height;
    }
    for (const connector of Object.values(this.#connectors)) {
      connector.measureLocalCenter(stage);
    }
  }

  /**
   * Subscribe to "this node's geometry is about to change".
   * @returns an unsubscribe function.
   */
  // TODO: Unify semantics of subscribe/unsubscribe functions
  // (e.g. with global input callback)
  onGeometryInvalidated(
    observer: GeometryInvalidationObserver<NodeMirror>,
  ): () => void {
    this.#geometryObservers.add(observer);
    return () => this.#geometryObservers.delete(observer);
  }

  /** Fired by the scheduling entry points, before they queue. */
  #notifyGeometryInvalidated(): void {
    for (const observer of this.#geometryObservers) {
      try {
        observer(this);
      } catch (error) {
        console.error("SnapLine: a node geometry observer threw.", error);
      }
    }
  }

  geometrySnapshot(): Rect {
    return {
      x: this.worldTransform.x,
      y: this.worldTransform.y,
      width: this.#authoredWidth,
      height: this.#authoredHeight,
    };
  }

  setSizeState(width: number, height: number): void {
    const w = Math.max(this.#config.minWidth, width);
    const h = Math.max(this.#config.minHeight, height);
    this.#authoredWidth = w;
    this.#authoredHeight = h;
    this.#hasAuthoredSize = true;
    this.#hitBox.width = w;
    this.#hitBox.height = h;
  }

  /**
   * Set the size of a node, and request DOM update to
   * render the new size.
   */
  setSize(
    width: number,
    height: number,
    handle: ResizeHandle | null = null,
  ): void {
    this.setSizeState(width, height);
    this.scheduleGeometryWrite();
    this.#callbacks.onSizeChange?.({
      node: this,
      handle,
      x: this.worldTransform.x,
      y: this.worldTransform.y,
      width: this.#hitBox.width,
      height: this.#hitBox.height,
    });
  }

  /**
   * Schedules the task that paints size and transform together,
   * plus the re-measure and line re-glue.
   */
  scheduleGeometryWrite(): void {
    this.#notifyGeometryInvalidated();
    this.schedule(() => this.#writeSizeGeometry(), {
      stage: "WRITE_1",
      queueId: `${this.id}-size`,
    });
    this.schedule(() => this.#syncMeasuredGeometry("READ_2"), {
      stage: "READ_2",
      queueId: `${this.id}-size-measure`,
    });
    this.scheduleLineWrites();
  }

  #writeSizeGeometry(): void {
    if (this.element && this.#hasAuthoredSize) {
      this.element.style.width = `${this.#authoredWidth}px`;
      this.element.style.height = `${this.#authoredHeight}px`;
    }
    this.writeTransformRecursive();
  }

  #applyResizeDrag(dx: number, dy: number): void {
    const handle = this.#activeResizeHandle;
    if (!handle) return;
    const west = handle === "w" || handle === "nw" || handle === "sw";
    const east = handle === "e" || handle === "ne" || handle === "se";
    const north = handle === "n" || handle === "ne" || handle === "nw";
    const south = handle === "s" || handle === "se" || handle === "sw";
    const proposedWidth = west
      ? this.#resizeStartWidth - dx
      : east
        ? this.#resizeStartWidth + dx
        : this.#resizeStartWidth;
    const proposedHeight = north
      ? this.#resizeStartHeight - dy
      : south
        ? this.#resizeStartHeight + dy
        : this.#resizeStartHeight;
    const width = Math.max(this.#config.minWidth, proposedWidth);
    const height = Math.max(this.#config.minHeight, proposedHeight);
    const x = west
      ? this.#resizeStartX + (this.#resizeStartWidth - width)
      : this.#resizeStartX;
    const y = north
      ? this.#resizeStartY + (this.#resizeStartHeight - height)
      : this.#resizeStartY;
    this.worldTransform = { x, y };
    this.setSize(width, height, handle);
  }

  writeTransformAndLines(): void {
    this.writeTransform();
    this.writeLinesNow();
  }

  attachTransformToGroup(group: NodeMirror): void {
    this.setTransformParent(group, true);
  }

  detachTransformFromGroup(): void {
    this.detachTransformParent(true);
  }

  updateNodeLineList(): void {
    const lines = this.getAllOutgoingLines();
    this.#callbacks.onLinesChanged?.({ node: this, lines });
  }

  onCursorDown(e: pointerDownProp): void {
    // Child input bubbles. A connector or resize region owns its own
    // pointerdown and must not reset or start a node drag.
    // TODO: Prevent bubbling in child object
    if (e.objectId !== this.id) return;

    // Authorization belongs to one pointer gesture. Clear any stale permission
    // before evaluating this pointerdown (including non-primary buttons).
    this.#dragPointerId = null;
    if (e.event.button != 0) {
      return;
    }

    // TODO: Replace draghandle with inputAlias
    const target = e.event.target as Node | null;
    const dragAllowed =
      (this.#dragHandles.size === 0 ||
        [...this.#dragHandles].some(
          (handle) => target && handle.contains(target),
        )) &&
      this.#callbacks.canStartDrag?.({
        node: this,
        pointerId: e.event.pointerId,
        position: e.position,
        originalEvent: e.event,
      }) !== false;
    if (!dragAllowed) return;
    this.#authorizePointer(e);
  }

  /** @internal Called by a ResizeRegionMirror on pointer down. */
  armResize(e: pointerDownProp, handle: ResizeHandle): void {
    this.#dragPointerId = null;
    if (e.event.button !== 0) return;
    this.#isResizeArmed = true;
    this.#activeResizeHandle = handle;
    this.#authorizePointer(e);
  }

  #authorizePointer(e: pointerDownProp): void {
    this.#dragPointerId = e.event.pointerId;

    // Claim the pointer from the very first pointer event to
    // prevent camera pan.
    this.engine.input.claimPointer(e.event.pointerId);

    this.#hasMoved = false;
    const selection = [...getGraphRegistry(this.engine).selection];
    this.#wasSelectedAtPointerDown = selection.includes(this);
    this.#pointerSelectionMode =
      this.#callbacks.resolveSelectionMode?.({
        node: this,
        selected: this.#wasSelectedAtPointerDown,
        selection,
        originalEvent: e.event,
      }) ?? "replace";

    if (
      this.#pointerSelectionMode === "replace" &&
      !this.#wasSelectedAtPointerDown
    ) {
      for (const node of [...getGraphRegistry(this.engine).selection]) {
        node.setSelected(false);
      }
      this.setSelected(true);
    } else if (
      (this.#pointerSelectionMode === "add" ||
        this.#pointerSelectionMode === "toggle") &&
      !this.#wasSelectedAtPointerDown
    ) {
      this.setSelected(true);
    }
  }

  onDragStart(prop: dragStartProp): void {
    if (this.#dragPointerId !== prop.pointerId) return;
    if (this.#isResizeArmed) {
      this.#isResizing = true;
      this.#resizeStartWidth = this.#hitBox.width;
      this.#resizeStartHeight = this.#hitBox.height;
      this.#resizeStartX = this.worldTransform.x;
      this.#resizeStartY = this.worldTransform.y;
      this.#pointerReferenceX = prop.start.x;
      this.#pointerReferenceY = prop.start.y;
      this.#hasMoved = true;
      // Guard so releasing a resize over another node doesn't click-select it.
      // TODO: Not needed since input now captures pointer on original DOM?
      getGraphRegistry(this.engine).resizingNode = this;
      return;
    }
    if (!this.#config.lockPosition && this.#config.edgePan) {
      this.#edgePanPointerId = prop.pointerId;
      // TODO: edgePanController should be part of SnapZap
      this.engine.edgePanController?.startEdgePan(
        prop.pointerId,
        prop.start,
        (position) => this.#moveSelectionToPointer(position),
      );
    }
    const selected = [...getGraphRegistry(this.engine).selection];
    this.#dragRoots = selected.filter(
      (node) =>
        !selected.some(
          (candidate) =>
            candidate !== node && candidate.containsSelectionDragNode(node),
        ),
    );
    this.#lastDragPosition = prop.start;
    for (const node of this.#dragRoots) {
      node.beginSelectionDrag(prop.start);
    }
    this.#dragCommitNodes = [
      ...new Set(this.#dragRoots.flatMap((node) => node.selectionDragNodes())),
    ];
    this.#hasMoved = true;
    this.#callbacks.onDragStart?.({
      node: this,
      pointerId: prop.pointerId,
      position: prop.start,
    });
  }

  onDrag(prop: dragProp): void {
    if (this.#dragPointerId !== prop.pointerId) return;
    if (this.global == null) {
      console.error("Global stats is null");
      return;
    }
    if (this.#isResizing) {
      this.#applyResizeDrag(
        prop.position.x - this.#pointerReferenceX,
        prop.position.y - this.#pointerReferenceY,
      );
      return;
    }
    if (this.#config.lockPosition) return;
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.updateEdgePan(
        this.#edgePanPointerId,
        prop.position,
      );
    }
    this.#moveSelectionToPointer(prop.position);
    this.#callbacks.onDrag?.({
      node: this,
      pointerId: prop.pointerId,
      position: prop.position,
    });
  }

  #moveSelectionToPointer(position: PointerPosition): void {
    this.#lastDragPosition = position;
    for (const node of this.#dragRoots) {
      node.setDragPosition({ position } as dragProp);
    }
  }

  /** Hook used to build one deduplicated multi-selection drag session. */
  protected beginSelectionDrag(position: PointerPosition): void {
    this.setStartPositions();
    this.#pointerReferenceX = position.x;
    this.#pointerReferenceY = position.y;
  }

  /**
   * Whether this node's drag already carries another nodeId
   * within it. Needed when checking if a selected group also has a child
   * node that is selected, otherwise we may apply drag twice to the child.
  .*/
  protected containsSelectionDragNode(_node: NodeMirror): boolean {
    return false;
  }

  /** Nodes whose final positions belong to this drag root's commit. */
  protected selectionDragNodes(): NodeMirror[] {
    return [this];
  }

  /** Finalize any temporary carry state owned by this drag root. */
  protected finishSelectionDrag(): void {}

  setDragPosition(prop: dragProp) {
    const dx = prop.position.x - this.#pointerReferenceX;
    const dy = prop.position.y - this.#pointerReferenceY;
    const x = this.#dragStartX + dx;
    const y = this.#dragStartY + dy;
    const resolved = this.#callbacks.resolveDragPosition?.({
      node: this,
      x,
      y,
      startX: this.#dragStartX,
      startY: this.#dragStartY,
      position: prop.position,
    }) ?? { x, y };

    this.worldTransform = { x: resolved.x, y: resolved.y };
    this.scheduleTransformAndLines();
  }

  onDragEnd(prop: dragEndProp) {
    // this.#dragPointerId will be undefined if drag was canceled
    // earlier for any reason, in which case we should not proceed.
    if (this.#dragPointerId !== prop.pointerId) return;
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    if (this.#isResizing) {
      // The teardown runs in `finally` because everything above it calls out.
      try {
        this.#applyResizeDrag(
          prop.end.x - this.#pointerReferenceX,
          prop.end.y - this.#pointerReferenceY,
        );
        this.#writeSizeGeometry();
        this.#callbacks.onGeometryCommit?.({
          nodes: [this.#geometryOf(this)],
        });
      } finally {
        this.#isResizing = false;
        this.#isResizeArmed = false;
        this.#activeResizeHandle = null;
        getGraphRegistry(this.engine).resizingNode = null;
        this.#dragPointerId = null;
      }
      // Settle #hitBox against what actually rendered.
      this.remeasureDomGeometry();
      // A resized node's center may have moved into/out of a group.
      for (const group of getGraphRegistry(this.engine).groups) {
        if ((group as unknown) !== this) group.refreshMembership(true);
      }
      return;
    }

    if (this.#lastDragPosition) {
      this.#moveSelectionToPointer(this.#lastDragPosition);
    }
    for (const node of this.#dragRoots) {
      node.finishSelectionDrag();
      node.scheduleTransformAndLines();
    }

    // A settled node may have entered or left a group
    for (const group of getGraphRegistry(this.engine).groups) {
      group.refreshMembership(true);
    }
    this.emitGeometryChange();
    this.#dragRoots = [];
    this.#dragCommitNodes = [];
    this.#lastDragPosition = null;
    this.#dragPointerId = null;
  }

  protected emitGeometryChange(): void {
    this.#callbacks.onGeometryCommit?.({
      nodes: this.getDragCommitNodes().map((node) => this.#geometryOf(node)),
    });
  }

  #geometryOf(node: NodeMirror): NodeGeometry {
    return {
      node,
      x: node.worldTransform.x,
      y: node.worldTransform.y,
      width: node.hitBox.width,
      height: node.hitBox.height,
    };
  }

  protected getDragCommitNodes(): NodeMirror[] {
    return this.#dragCommitNodes.length
      ? [...this.#dragCommitNodes]
      : [...getGraphRegistry(this.engine).selection];
  }

  onUp(prop: pointerUpProp) {
    if (this.#dragPointerId !== prop.event.pointerId) return;

    // InputControl dispatches pointerUp before dragEnd. Keep active resize state
    // intact so onDragEnd can commit the geometry and perform teardown.
    // TODO: onUp should not fire if drag event fired?
    if (getGraphRegistry(this.engine).resizingNode) return;
    if (this.#isResizeArmed) {
      this.#isResizeArmed = false;
      this.#activeResizeHandle = null;
      this.#dragPointerId = null;
      return;
    }

    if (!this.#hasMoved) {
      if (this.#pointerSelectionMode === "replace") {
        for (const node of [...getGraphRegistry(this.engine).selection]) {
          if (node !== this) node.setSelected(false);
        }
        this.setSelected(true);
      } else if (this.#pointerSelectionMode === "add") {
        this.setSelected(true);
      } else {
        this.setSelected(!this.#wasSelectedAtPointerDown);
      }
      this.#dragPointerId = null;
    }
    this.#hasMoved = false;
  }

  getConnector(name: string): ConnectorMirror | null {
    if (!(name in this.#connectors)) {
      console.error(`Connector ${name} does not exist in node ${this.id}`);
      return null;
    }
    return this.#connectors[name];
  }

  addConnectorObject(connector: ConnectorMirror) {
    connector.assignToNode(this);
  }

  /** @internal Registers a connector assigned to this node. */
  attachConnector(connector: ConnectorMirror): void {
    this.#connectors[connector.name] = connector;
  }

  /** @internal Removes a connector only if it is still the registered value. */
  detachConnector(connector: ConnectorMirror): void {
    if (this.#connectors[connector.name] === connector) {
      delete this.#connectors[connector.name];
    }
  }

  getAllOutgoingLines(): LineMirror[] {
    return Object.values(this.#connectors).flatMap(
      (connector) => connector.outgoingLines,
    );
  }

  getAllIncomingLines(): LineMirror[] {
    return Object.values(this.#connectors).flatMap(
      (connector) => connector.incomingLines,
    );
  }

  destroy(removeElement: boolean = true) {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    for (const connector of Object.values(this.#connectors)) {
      // A node unmount is a teardown, not a deliberate programmatic
      // disconnect — keep the reason contract honest for intent consumers.
      connector.deleteAllLines("teardown");
    }
    getGraphRegistry(this.engine).unregisterNode(this);
    this.setSelected(false);
    for (const region of [...this.#resizeRegions]) region.destroy(false);
    this.#resizeRegions.clear();
    this.#connectors = {};
    super.destroy(removeElement);
  }
}

/**
 * A developer-owned DOM resize surface represented as a normal SnapEngine
 * child object. Assign its `element`; CSS and native hover behavior remain
 * entirely application-owned.
 */
class ResizeRegionMirror extends ElementObject {
  readonly handle: ResizeHandle;
  readonly node: NodeMirror;

  constructor(engine: any, node: NodeMirror, handle: ResizeHandle) {
    if (!RESIZE_HANDLES.includes(handle)) {
      throw new Error(`Unknown resize handle: ${handle}`);
    }
    super(engine, node);
    this.node = node;
    this.handle = handle;
    this.transformMode = "none";
    this.event.input.pointerDown = this.#onPointerDown;
    this.event.input.dragStart = this.#onDragStart;
    node.attachResizeRegion(this);
  }

  #onPointerDown(prop: pointerDownProp): void {
    if (prop.event.button !== 0) return;
    this.node.armResize(prop, this.handle);
  }

  #onDragStart(prop: dragStartProp): void {
    prop.handoffTo(this.node);
  }

  destroy(removeElement: boolean = true): void {
    if (this.isDeleteRequested) return;
    this.node.detachResizeRegion(this);
    super.destroy(removeElement);
  }
}

export { NodeMirror, ResizeRegionMirror };
