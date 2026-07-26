import { BaseObject, ElementObject } from "@snap-engine/core";
import {
  ConnectorComponent,
  resolveConnectorSourceAtPoint,
} from "./connector";
import { LineComponent } from "./line";
import type {
  pointerUpProp,
  pointerDownProp,
  dragStartProp,
  dragProp,
  dragEndProp,
  eventPosition,
  pointerMoveProp,
} from "@snap-engine/core";
import { RectCollider } from "@snap-engine/core/collision";
import { getSelectList, getGroups, getNodeManager, getResizeHandles, snapData } from "./snapline-globals";
import type { SnapLineMetadata } from "./connector";

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

export const DEFAULT_RESIZE_CURSORS: Readonly<Record<ResizeHandle, string>> = {
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  nw: "nwse-resize",
};

export interface NodeConfig {
  lockPosition?: boolean;
  /** Enables resize handles. All four sides and corners are enabled by default. */
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  /**
   * Total thickness of each virtual edge/corner resize hitbox. Half of the
   * hitbox sits inside the node boundary and half outside.
   */
  resizeHandleThickness?: number;
  /** Enabled handles. `true` means all eight; an array enables only those handles. */
  resizeHandles?: true | readonly ResizeHandle[];
  /** Per-handle CSS cursor overrides. */
  resizeCursors?: Partial<Record<ResizeHandle, string>>;
  metadata?: SnapLineMetadata;
  callbacks?: NodeCallbacks;
  /** Allows this node gesture to use the engine's configured edge pan. */
  edgePan?: boolean;
}

/** Shared by core hitboxes and adapter resize-handle visuals. */
export const DEFAULT_RESIZE_HANDLE_THICKNESS = 14;

const DEFAULT_NODE_CONFIG: Required<NodeConfig> = {
  lockPosition: false,
  resizable: false,
  minWidth: 0,
  minHeight: 0,
  resizeHandleThickness: DEFAULT_RESIZE_HANDLE_THICKNESS,
  resizeHandles: true,
  resizeCursors: {},
  metadata: {},
  callbacks: {},
  edgePan: true,
};

/** Object-spread merge that ignores undefined values (adapters forward
 * possibly-undefined props, which must not shadow the defaults). */
export function mergeConfig<T extends object>(defaults: T, config: Partial<T>): T {
  const merged = { ...defaults };
  for (const key of Object.keys(config) as (keyof T)[]) {
    const value = config[key];
    if (value !== undefined) merged[key] = value as T[keyof T];
  }
  return merged;
}

/** Consumer policy and lifecycle surfaces. Callbacks receive event objects so
 * new context can be added without growing positional signatures. */
export interface NodePosition {
  node: NodeComponent;
  x: number;
  y: number;
}

export interface NodePointerEvent {
  node: NodeComponent;
  pointerId: number;
  position: eventPosition;
  originalEvent?: PointerEvent;
}

export interface NodeDragCommitEvent extends NodePointerEvent {
  nodes: NodePosition[];
}

export interface NodeDragPositionEvent {
  node: NodeComponent;
  x: number;
  y: number;
  startX: number;
  startY: number;
  position: eventPosition;
}

export interface ResolvedNodeDragPosition {
  x: number;
  y: number;
}

export interface NodeResizeEvent {
  node: NodeComponent;
  handle: ResizeHandle | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeResizeHandleEvent {
  node: NodeComponent;
  handle: ResizeHandle | null;
  cursor: string | null;
}

export interface NodeSelectionEvent {
  node: NodeComponent;
  selected: boolean;
  selection: readonly NodeComponent[];
}

export type SelectionMode = "replace" | "add" | "toggle";

export interface NodeSelectionModeEvent {
  node: NodeComponent;
  selected: boolean;
  selection: readonly NodeComponent[];
  originalEvent: PointerEvent;
}

export interface NodeLinesEvent {
  node: NodeComponent;
  lines: readonly LineComponent[];
}

export interface NodeCallbacks {
  canStartDrag?: (event: NodePointerEvent) => boolean;
  /** Resolves a proposed live node position before its world transform changes. */
  resolveDragPosition?: (
    event: NodeDragPositionEvent,
  ) => ResolvedNodeDragPosition;
  /** Consumer-defined pointer selection policy; SnapLine owns no modifier keys. */
  resolveSelectionMode?: (event: NodeSelectionModeEvent) => SelectionMode;
  onDragStart?: (event: NodePointerEvent) => void;
  onDrag?: (event: NodePointerEvent) => void;
  onDragCommit?: (event: NodeDragCommitEvent) => void;
  onSelectionChange?: (event: NodeSelectionEvent) => void;
  /** Observes live size updates; core writes the retained element geometry. */
  onSizeChange?: (event: NodeResizeEvent) => void;
  /** Final size at resize-drag end — the consumer persists it. */
  onResizeCommit?: (event: NodeResizeEvent) => void;
  /** The resize handle currently hovered, or null after leaving it. */
  onResizeHandleChange?: (event: NodeResizeHandleEvent) => void;
  /** The set of outgoing lines changed — the adapter re-renders its line list. */
  onLinesChanged?: (event: NodeLinesEvent) => void;
}

const CORNER_HANDLES = new Set<ResizeHandle>(["ne", "se", "sw", "nw"]);
class ResizeHandleCollider extends RectCollider {
  readonly handle: ResizeHandle;
  readonly cursor: string;

  constructor(
    engine: any,
    parent: NodeComponent,
    handle: ResizeHandle,
    cursor: string,
  ) {
    super(engine, parent, 0, 0, 0, 0);
    this.handle = handle;
    this.cursor = cursor;
  }
}

class ResizeHoverController extends BaseObject {
  #count = 0;
  #node: NodeComponent | null = null;
  #handle: ResizeHandleCollider | null = null;
  #target: HTMLElement | null = null;
  #previousNodeCursor = "";
  #previousContainerCursor = "";
  #previousTargetCursor = "";

  constructor(engine: any) {
    super(engine, null);
    this.event.global.pointerMove = this.#onPointerMove;
  }

  retain(): void {
    this.#count++;
  }

  release(node: NodeComponent): void {
    this.#count--;
    if (this.#node === node) this.clear();
    if (this.#count <= 0) {
      resizeHoverControllers.delete(this.engine);
      this.destroy();
    }
  }

  activate(handle: ResizeHandleCollider, target?: EventTarget | null): void {
    const node = handle.parent as NodeComponent;
    const element = target instanceof HTMLElement ? target : null;
    if (this.#handle === handle && this.#target === element) return;
    this.#restoreCss();
    const nodeElement = node.element;
    const container = this.engine.containerElement as HTMLElement | null;
    this.#node = node;
    this.#handle = handle;
    this.#target = element;
    this.#previousNodeCursor = nodeElement?.style.cursor ?? "";
    this.#previousContainerCursor = container?.style.cursor ?? "";
    this.#previousTargetCursor = element?.style.cursor ?? "";
    nodeElement?.setAttribute("data-snapline-resize-handle", handle.handle);
    if (nodeElement) nodeElement.style.cursor = handle.cursor;
    if (container) container.style.cursor = handle.cursor;
    if (element) element.style.cursor = handle.cursor;
    node.callbacks.onResizeHandleChange?.({
      node,
      handle: handle.handle,
      cursor: handle.cursor,
    });
  }

  clear(): void {
    if (!this.#node) return;
    const node = this.#node;
    this.#restoreCss();
    this.#node = null;
    this.#handle = null;
    this.#target = null;
    node.callbacks.onResizeHandleChange?.({ node, handle: null, cursor: null });
  }

  #restoreCss(): void {
    const nodeElement = this.#node?.element;
    const container = this.engine.containerElement as HTMLElement | null;
    nodeElement?.removeAttribute("data-snapline-resize-handle");
    if (nodeElement) nodeElement.style.cursor = this.#previousNodeCursor;
    if (container) container.style.cursor = this.#previousContainerCursor;
    if (this.#target) this.#target.style.cursor = this.#previousTargetCursor;
  }

  #onPointerMove(prop: pointerMoveProp): void {
    const handle = findResizeHandle(this.engine, prop.position);
    if (!handle) {
      this.clear();
      return;
    }
    this.activate(handle, prop.event?.target);
  }
}

const resizeHoverControllers = new WeakMap<object, ResizeHoverController>();

function hoverController(engine: any): ResizeHoverController {
  let controller = resizeHoverControllers.get(engine);
  if (!controller) {
    controller = new ResizeHoverController(engine);
    resizeHoverControllers.set(engine, controller);
  }
  return controller;
}

function findResizeHandle(
  engine: any,
  position: eventPosition,
  node?: NodeComponent,
): ResizeHandleCollider | null {
  let winner: ResizeHandleCollider | null = null;
  for (const collider of getResizeHandles(engine.global)) {
    if (!(collider instanceof ResizeHandleCollider) || collider.engine !== engine) continue;
    if (node && collider.parent !== node) continue;
    if (!collider.containsWorldPoint(position.x, position.y)) continue;
    if (!winner || CORNER_HANDLES.has(collider.handle) || !CORNER_HANDLES.has(winner.handle)) {
      winner = collider;
    }
  }
  return winner;
}

class NodeComponent extends ElementObject {
  #config: Required<NodeConfig>;
  _connectors: { [key: string]: ConnectorComponent };
  _components: { [key: string]: ElementObject };
  _dragStartX = 0;
  _dragStartY = 0;
  _prop: { [key: string]: any };
  _propSetCallback: { [key: string]: (value: any) => void };
  _nodeStyle: any;
  #hitBox: RectCollider;
  _selected: boolean;
  _mouseDownX: number;
  _mouseDownY: number;
  _hasMoved: boolean;
  #resizeHitBoxes = new Map<ResizeHandle, ResizeHandleCollider>();
  #resizeHandles: readonly ResizeHandle[];
  #resizeHandleThickness: number;
  #resizeHoverController: ResizeHoverController | null = null;
  #activeResizeHandle: ResizeHandle | null = null;
  /** Read by GroupNodeComponent to distinguish a resize from a move drag. */
  protected _resizing = false;
  #resizeArmed = false;
  #resizeStartW = 0;
  #resizeStartH = 0;
  #resizeStartX = 0;
  #resizeStartY = 0;
  #callbacks: NodeCallbacks;
  #edgePanPointerId: number | null = null;
  #dragHandles = new Set<HTMLElement>();
  #dragPointerId: number | null = null;
  #dragRoots: NodeComponent[] = [];
  #dragCommitNodes: NodeComponent[] = [];
  #lastDragPosition: eventPosition | null = null;
  #pointerSelectionMode: SelectionMode = "replace";
  #selectedAtPointerDown = false;

  constructor(engine: any, parent: BaseObject | null, config: NodeConfig = {}) {
    super(engine, parent);
    this.#config = mergeConfig(DEFAULT_NODE_CONFIG, config);
    this.#callbacks = this.#config.callbacks;
    getNodeManager(this.engine).registerNode(this);
    const resizeEnabled = config.resizable === true || config.resizeHandles !== undefined;
    this.#resizeHandles = !resizeEnabled
      ? []
      : config.resizeHandles !== undefined
        ? config.resizeHandles === true
          ? RESIZE_HANDLES
          : [...new Set(config.resizeHandles)]
        : RESIZE_HANDLES;
    this.#resizeHandleThickness =
      config.resizeHandleThickness ??
      DEFAULT_RESIZE_HANDLE_THICKNESS;

    this._connectors = {};
    this._components = {};
    this._dragStartX = this.worldTransform.x;
    this._dragStartY = this.worldTransform.y;
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._prop = {};
    this._propSetCallback = {};
    this.transformMode = "direct";

    this.event.input.pointerDown = this.onCursorDown;
    this.event.input.dragStart = this.onDragStart;
    this.event.input.drag = this.onDrag;
    this.event.input.dragEnd = this.onDragEnd;
    this.event.input.pointerUp = this.onUp;
    this.#hitBox = new RectCollider(this.engine, this, 0, 0, 0, 0);
    this.addCollider(this.#hitBox);

    // Resize surfaces are virtual colliders. Engine input resolves them before
    // DOM ownership, so handles can straddle the element and work for groups
    // whose body intentionally has pointer-events:none.
    if (this.#resizeHandles.length > 0) {
      this.#resizeHoverController = hoverController(this.engine);
      this.#resizeHoverController.retain();
      for (const handle of this.#resizeHandles) {
        const collider = new ResizeHandleCollider(
          this.engine,
          this,
          handle,
          this.#config.resizeCursors[handle] ?? DEFAULT_RESIZE_CURSORS[handle],
        );
        this.#resizeHitBoxes.set(handle, collider);
        this.addCollider(collider);
        getResizeHandles(this.global).push(collider);
      }
      this.#positionResizeHitBoxes(0, 0);
    }

    this._selected = false;
    this._hasMoved = false;

    // Whenever the DOM box changes size (ResizeObserver) re-measure + re-glue.
    this.event.dom.onResize = () => this.syncDomGeometry();

    // Base positioning styles are framework-owned: adapters must render the
    // element with `position: absolute; transform-origin: top left` (see the
    // ownership note in assets/snapline/AGENTS.md).

    // Initialize global select list if needed
    getSelectList(this.global);
  }

  get config(): Required<NodeConfig> {
    return this.#config;
  }

  get callbacks(): NodeCallbacks {
    return this.#callbacks;
  }

  set callbacks(callbacks: NodeCallbacks) {
    this.#callbacks = callbacks;
  }

  get metadata(): SnapLineMetadata {
    return this.#config.metadata;
  }

  get resizeHandles(): readonly ResizeHandle[] {
    return this.#resizeHandles;
  }

  get resizeHandleThickness(): number {
    return this.#resizeHandleThickness;
  }

  registerDragHandle(element: HTMLElement): () => void {
    this.#dragHandles.add(element);
    return () => this.#dragHandles.delete(element);
  }

  /** The node's collision footprint (world = worldTransform + width/height).
   * Read by groups for geometric membership. */
  get hitBox(): RectCollider {
    return this.#hitBox;
  }

  setStartPositions() {
    this._dragStartX = this.worldTransform.x;
    this._dragStartY = this.worldTransform.y;
  }

  setSelected(selected: boolean) {
    this._selected = selected;
    this.dataAttribute = {
      selected: String(selected),
      "snapline-state": selected ? "focus" : "idle",
    };
    const selectList = getSelectList(this.global);
    if (selected) {
      if (!selectList.includes(this)) {
        selectList.push(this);
      }
    } else {
      snapData(this.global).select = selectList.filter(
        (node) => node.id !== this.id,
      );
    }
    this.schedule(() => this.writeDom(), {
      stage: "WRITE_1",
      queueId: `${this.id}-selected`,
    });
    this.#callbacks.onSelectionChange?.({
      node: this,
      selected,
      selection: [...getSelectList(this.global)],
    });
  }

  _filterDeletedLines(svgLines: LineComponent[]) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i].isDeleteRequested) {
        svgLines.splice(i, 1);
        i--;
      }
    }
  }

  /** Schedules a WRITE_2 write for every line on every connector of this node. */
  scheduleLineWrites(): void {
    for (const connector of Object.values(this._connectors)) {
      connector.scheduleAllLineWrites();
    }
  }

  /** Synchronously writes every line on every connector (call inside a WRITE stage). */
  writeLinesNow(): void {
    const lines = new Set([
      ...this.getAllOutgoingLines(),
      ...this.getAllIncomingLines(),
    ]);
    for (const line of lines) {
      line.moveLineToConnectorTransform();
      line.writeTransform();
    }
  }

  #transformNodeTree(): NodeComponent[] {
    const nodes: NodeComponent[] = [];
    const visit = (node: NodeComponent) => {
      nodes.push(node);
      for (const child of node.transformChildren) {
        if (child instanceof NodeComponent) visit(child);
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
    for (const node of this.#transformNodeTree()) node.scheduleLineWrites();
  }

  // Re-measure the node box + each connector's local center (READ_1) and re-glue
  // every incoming/outgoing line (WRITE_2). This is the "same handling as a move
  // plus a size re-measure": moving a node keeps connector local centers valid,
  // but resizing invalidates them, so they must be re-read. Shared by the
  // ResizeObserver and the JS-driven setSize; stable queueIds collapse a
  // same-frame double-fire (idempotent when it runs twice across frames).
  syncDomGeometry(): void {
    if (!this.element) {
      throw new Error("Cannot sync node geometry before assigning its DOM element");
    }
    this.schedule(
      () => {
        const property = this.readDom({ unapplyTransform: false }, "READ_1");
        this.#hitBox.width = property.width;
        this.#hitBox.height = property.height;
        this.#positionResizeHitBoxes(property.width, property.height);
        for (const connector of Object.values(this._connectors)) {
          connector.measureLocalCenter("READ_1");
        }
      },
      { stage: "READ_1", queueId: `${this.id}-remeasure` },
    );
    this.scheduleLineWrites();
  }

  // State-only half of a size change: clamps to min and synchronously updates
  // the collision footprint + resize hitbox so hit testing and group
  // containment stay correct mid-drag. `setSize` adds the scheduled DOM write;
  // adapters can use this method alone when seeding external dimensions.
  setSizeState(width: number, height: number): void {
    const w = Math.max(this.#config.minWidth, width);
    const h = Math.max(this.#config.minHeight, height);
    this.#hitBox.width = w;
    this.#hitBox.height = h;
    this.#positionResizeHitBoxes(w, h);
  }

  // Drives live resize geometry directly. The framework observes and persists
  // the result, but it is not part of the pointer-move paint path.
  setSize(width: number, height: number, handle: ResizeHandle | null = null): void {
    this.setSizeState(width, height);
    this.#scheduleSizeGeometryWrite();
    this.#callbacks.onSizeChange?.({
      node: this,
      handle,
      x: this.worldTransform.x,
      y: this.worldTransform.y,
      width: this.#hitBox.width,
      height: this.#hitBox.height,
    });
  }

  #scheduleSizeGeometryWrite(): void {
    this.schedule(
      () => this.#writeSizeGeometry(),
      { stage: "WRITE_1", queueId: `${this.id}-size` },
    );
    this.schedule(
      () => {
        if (!this.element) return;
        const property = this.readDom({ unapplyTransform: false }, "READ_2");
        this.#hitBox.width = property.width;
        this.#hitBox.height = property.height;
        this.#positionResizeHitBoxes(property.width, property.height);
        for (const connector of Object.values(this._connectors)) {
          connector.measureLocalCenter("READ_2");
        }
      },
      { stage: "READ_2", queueId: `${this.id}-size-measure` },
    );
    this.scheduleLineWrites();
  }

  #writeSizeGeometry(): void {
    if (this.element) {
      this.element.style.width = `${this.#hitBox.width}px`;
      this.element.style.height = `${this.#hitBox.height}px`;
    }
    this.writeTransformRecursive();
  }

  #positionResizeHitBoxes(width: number, height: number): void {
    const t = Math.max(0, this.#resizeHandleThickness);
    const half = t / 2;
    const horizontalLength = Math.max(0, width - t);
    const verticalLength = Math.max(0, height - t);
    const geometry: Record<ResizeHandle, [number, number, number, number]> = {
      n: [half, -half, horizontalLength, t],
      ne: [width - half, -half, t, t],
      e: [width - half, half, t, verticalLength],
      se: [width - half, height - half, t, t],
      s: [half, height - half, horizontalLength, t],
      sw: [-half, height - half, t, t],
      w: [-half, half, t, verticalLength],
      nw: [-half, -half, t, t],
    };
    for (const [handle, collider] of this.#resizeHitBoxes) {
      const [x, y, colliderWidth, colliderHeight] = geometry[handle];
      collider.localTransform = { x, y };
      collider.width = colliderWidth;
      collider.height = colliderHeight;
    }
  }

  // Applies one side/corner resize while keeping the opposite edges fixed.
  #applyResizeDrag(dx: number, dy: number): void {
    const handle = this.#activeResizeHandle;
    if (!handle) return;
    const west = handle === "w" || handle === "nw" || handle === "sw";
    const east = handle === "e" || handle === "ne" || handle === "se";
    const north = handle === "n" || handle === "ne" || handle === "nw";
    const south = handle === "s" || handle === "se" || handle === "sw";
    const proposedWidth = west
      ? this.#resizeStartW - dx
      : east
        ? this.#resizeStartW + dx
        : this.#resizeStartW;
    const proposedHeight = north
      ? this.#resizeStartH - dy
      : south
        ? this.#resizeStartH + dy
        : this.#resizeStartH;
    const width = Math.max(this.#config.minWidth, proposedWidth);
    const height = Math.max(this.#config.minHeight, proposedHeight);
    const x = west
      ? this.#resizeStartX + (this.#resizeStartW - width)
      : this.#resizeStartX;
    const y = north
      ? this.#resizeStartY + (this.#resizeStartH - height)
      : this.#resizeStartY;
    this.worldTransform = { x, y };
    this.setSize(width, height, handle);
  }

  writeTransformAndLines(): void {
    this.writeTransform();
    this.writeLinesNow();
  }

  // Called when a parent (e.g. a group) cascades a transform write down the
  // transform graph: paint this node + recurse to its transform-children, then
  // re-glue this node's own lines (the pure-transform cascade can't, since a
  // line's two ends live on two different nodes).
  writeTransformRecursive(): void {
    super.writeTransformRecursive();
  }

  // Transform-only (re)parenting used by group carry: the public/DOM graph is
  // left alone, so members stay flat siblings in the adapter's node list.
  attachTransformToGroup(group: NodeComponent): void {
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
    // Authorization belongs to one pointer gesture. Clear any stale permission
    // before evaluating this pointerdown (including non-primary buttons).
    this.#dragPointerId = null;
    if (e.event.button != 0) {
      return;
    }

    // Resize is a separate primitive from node dragging and remains available
    // even when the consumer registered a narrow drag handle.
    const resizeHandle = findResizeHandle(this.engine, e.position, this);
    this.#resizeArmed = resizeHandle != null;
    this.#activeResizeHandle = resizeHandle?.handle ?? null;
    if (resizeHandle) {
      this.#resizeHoverController?.activate(resizeHandle, e.event.target);
    } else {
      const source = resolveConnectorSourceAtPoint(
        this.engine,
        e.position,
        this,
      );
      if (source) {
        this.engine.input.setPointerDragOwner(
          e.event.pointerId,
          source.candidate.connector,
        );
        source.candidate.connector.armSurfaceGesture(e, source);
        return;
      }
    }
    const target = e.event.target as Node | null;
    const dragAllowed =
      this.#resizeArmed ||
      ((this.#dragHandles.size === 0 ||
        [...this.#dragHandles].some((handle) => target && handle.contains(target))) &&
        this.#callbacks.canStartDrag?.({
          node: this,
          pointerId: e.event.pointerId,
          position: e.position,
          originalEvent: e.event,
        }) !== false);
    if (!dragAllowed) return;
    this.#dragPointerId = e.event.pointerId;

    // Claim the pointer from the very first pointer event: waiting for the
    // drag-start threshold would let the camera pan by one move event before
    // onDragStart runs. The claim auto-releases when the gesture ends, so no
    // paired release is needed anywhere.
    this.engine.input.claimPointer(e.event.pointerId);

    this._hasMoved = false;
    const selection = [...getSelectList(this.global)];
    this.#selectedAtPointerDown = selection.includes(this);
    this.#pointerSelectionMode =
      this.#callbacks.resolveSelectionMode?.({
        node: this,
        selected: this.#selectedAtPointerDown,
        selection,
        originalEvent: e.event,
      }) ?? "replace";

    if (this.#pointerSelectionMode === "replace" && !this.#selectedAtPointerDown) {
      for (const node of [...getSelectList(this.global)]) {
        node.setSelected(false);
      }
      this.setSelected(true);
    } else if (
      (this.#pointerSelectionMode === "add" ||
        this.#pointerSelectionMode === "toggle") &&
      !this.#selectedAtPointerDown
    ) {
      this.setSelected(true);
    }
  }

  onDragStart(prop: dragStartProp): void {
    if (this.#dragPointerId !== prop.pointerId) return;
    if (this.#resizeArmed) {
      this._resizing = true;
      this.#resizeStartW = this.#hitBox.width;
      this.#resizeStartH = this.#hitBox.height;
      this.#resizeStartX = this.worldTransform.x;
      this.#resizeStartY = this.worldTransform.y;
      this._mouseDownX = prop.start.x;
      this._mouseDownY = prop.start.y;
      this._hasMoved = true;
      // Guard so releasing a resize over another node doesn't click-select it.
      snapData(this.global).resizingNode = this;
      return;
    }
    if (!this.#config.lockPosition && this.#config.edgePan) {
      this.#edgePanPointerId = prop.pointerId;
      this.engine.edgePanController?.startEdgePan(
        prop.pointerId,
        prop.start,
        (position) => this.#moveSelectionToPointer(position),
      );
    }
    const selected = [...getSelectList(this.global)];
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
    this._hasMoved = true;
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
    if (this._resizing) {
      this.#applyResizeDrag(
        prop.position.x - this._mouseDownX,
        prop.position.y - this._mouseDownY,
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

  #moveSelectionToPointer(position: eventPosition): void {
    this.#lastDragPosition = position;
    for (const node of this.#dragRoots) {
      node.setDragPosition({ position } as dragProp);
    }
  }

  /** @internal Hook used to build one deduplicated multi-selection drag session. */
  beginSelectionDrag(position: eventPosition): void {
    this.setStartPositions();
    this._mouseDownX = position.x;
    this._mouseDownY = position.y;
  }

  /** @internal Whether this node's drag behavior already carries `node`. */
  containsSelectionDragNode(_node: NodeComponent): boolean {
    return false;
  }

  /** @internal Nodes whose final positions belong to this drag root's commit. */
  selectionDragNodes(): NodeComponent[] {
    return [this];
  }

  /** @internal Finalize any temporary carry state owned by this drag root. */
  finishSelectionDrag(): void {}

  setDragPosition(prop: dragProp) {
    const dx = prop.position.x - this._mouseDownX;
    const dy = prop.position.y - this._mouseDownY;
    const x = this._dragStartX + dx;
    const y = this._dragStartY + dy;
    const resolved = this.#callbacks.resolveDragPosition?.({
      node: this,
      x,
      y,
      startX: this._dragStartX,
      startY: this._dragStartY,
      position: prop.position,
    }) ?? { x, y };

    this.worldTransform = { x: resolved.x, y: resolved.y };
    this.scheduleTransformAndLines();
  }

  onDragEnd(prop: dragEndProp) {
    // A pointerdown rejected by a drag handle/predicate still becomes a generic
    // input drag gesture once it crosses the engine threshold. It must not
    // commit stale selection coordinates on release.
    if (this.#dragPointerId !== prop.pointerId) return;
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    if (this._resizing) {
      this.#applyResizeDrag(
        prop.end.x - this._mouseDownX,
        prop.end.y - this._mouseDownY,
      );
      // Pointer-up is a synchronization boundary for consumers that immediately
      // query the committed handle/box. Keep the coalesced frame write for the
      // hot path, but make the final retained geometry observable now.
      this.#writeSizeGeometry();
      this.#callbacks.onResizeCommit?.({
        node: this,
        handle: this.#activeResizeHandle,
        x: this.worldTransform.x,
        y: this.worldTransform.y,
        width: this.#hitBox.width,
        height: this.#hitBox.height,
      });
      this._resizing = false;
      this.#resizeArmed = false;
      this.#activeResizeHandle = null;
      snapData(this.global).resizingNode = null;
      this.#dragPointerId = null;
      this.#refreshResizeHover(prop.end);
      // A resized node's center may have moved into/out of a group.
      for (const group of getGroups(this.global)) {
        if ((group as unknown) !== this) group.refreshMembership(true);
      }
      return;
    }

    // The live position is authoritative. Recomputing from the raw pointer-up
    // coordinate would discard edge-pan compensation and can make the release
    // frame jump away from what the user was dragging.
    if (this.#lastDragPosition) {
      this.#moveSelectionToPointer(this.#lastDragPosition);
    }
    for (const node of this.#dragRoots) {
      node.finishSelectionDrag();
      node.scheduleTransformAndLines();
    }

    // A settled node may have entered or left a group; groups re-evaluate
    // membership on settle (never at group-drag-start), so the maintained set is
    // current before the next group drag. The structural GroupLike type keeps
    // node.ts free of any group import.
    for (const group of getGroups(this.global)) {
      group.refreshMembership(true);
    }
    this.emitDragCommit(prop);
    this.#dragRoots = [];
    this.#dragCommitNodes = [];
    this.#lastDragPosition = null;
    this.#dragPointerId = null;
  }

  protected emitDragCommit(prop: dragEndProp): void {
    this.#callbacks.onDragCommit?.({
      node: this,
      pointerId: prop.pointerId,
      position: prop.end,
      nodes: this.getDragCommitNodes().map((node) => ({
        node,
        x: node.worldTransform.x,
        y: node.worldTransform.y,
      })),
    });
  }

  protected getDragCommitNodes(): NodeComponent[] {
    return this.#dragCommitNodes.length
      ? [...this.#dragCommitNodes]
      : [...getSelectList(this.global)];
  }

  setUpPosition(prop: dragEndProp) {
    const [dx, dy] = [
      prop.end.x - this._mouseDownX,
      prop.end.y - this._mouseDownY,
    ];
    this.worldTransform = {
      x: this._dragStartX + dx,
      y: this._dragStartY + dy,
    };
    this.scheduleTransformAndLines();
  }

  onUp(prop: pointerUpProp) {
    if (this.#dragPointerId !== prop.event.pointerId) return;

    // pointerUp is dispatched to whatever is under the release point, which for a
    // resize may be a DIFFERENT node than the one being resized. Skip click-select
    // while any resize is settling so releasing a resize doesn't select this node.
    if (snapData(this.global).resizingNode) return;
    if (this.#resizeArmed) {
      this.#resizeArmed = false;
      this.#activeResizeHandle = null;
      this.#refreshResizeHover(prop.position, prop.event.target);
      return;
    }

    if (this._hasMoved == false) {
      if (this.#pointerSelectionMode === "replace") {
        for (const node of [...getSelectList(this.global)]) {
          if (node !== this) node.setSelected(false);
        }
        this.setSelected(true);
      } else if (this.#pointerSelectionMode === "add") {
        this.setSelected(true);
      } else {
        this.setSelected(!this.#selectedAtPointerDown);
      }
      this.#dragPointerId = null;
    }
    this._hasMoved = false;
  }

  getConnector(name: string): ConnectorComponent | null {
    if (!(name in this._connectors)) {
      console.error(`Connector ${name} does not exist in node ${this.id}`);
      return null;
    }
    return this._connectors[name];
  }

  addConnectorObject(connector: ConnectorComponent) {
    connector.assignToNode(this);
  }

  addSetPropCallback(callback: (value: any) => void, name: string) {
    this._propSetCallback[name] = callback;
  }

  getAllOutgoingLines(): LineComponent[] {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.outgoingLines,
    );
  }

  getAllIncomingLines(): LineComponent[] {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.incomingLines,
    );
  }

  getProp(name: string) {
    return this._prop[name];
  }

  setProp(name: string, value: any) {
    const pending: Array<{ node: NodeComponent; name: string }> = [
      { node: this, name },
    ];
    const visited = new Map<NodeComponent, Set<string>>();

    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) continue;

      let visitedNames = visited.get(current.node);
      if (!visitedNames) {
        visitedNames = new Set();
        visited.set(current.node, visitedNames);
      }
      if (visitedNames.has(current.name)) continue;
      visitedNames.add(current.name);

      if (current.name in current.node._propSetCallback) {
        current.node._propSetCallback[current.name](value);
      }
      current.node._prop[current.name] = value;

      const connector = current.node._connectors[current.name];
      if (!connector) continue;

      const peers = connector.outgoingLines
        .filter((line) => line.target && !line.isDeleteRequested)
        .map((line) => line.target);
      for (let index = peers.length - 1; index >= 0; index -= 1) {
        const peer = peers[index];
        if (!peer?.parent) continue;
        pending.push({
          node: peer.parent as NodeComponent,
          name: peer.name,
        });
      }
    }
  }

  propagateProp() {
    for (const connector of Object.values(this._connectors)) {
      this.setProp(connector.name, this.getProp(connector.name));
    }
  }

  #refreshResizeHover(position: eventPosition, target?: EventTarget | null): void {
    this.#resizeHoverController?.clear();
    const handle = findResizeHandle(this.engine, position);
    if (handle) this.#resizeHoverController?.activate(handle, target);
  }

  destroy(removeElement: boolean = true) {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    for (const connector of Object.values(this._connectors)) {
      // A node unmount is a teardown, not a deliberate programmatic
      // disconnect — keep the reason contract honest for intent consumers.
      connector.deleteAllLines("teardown");
    }
    getNodeManager(this.engine).unregisterNode(this);
    this.setSelected(false);
    if (this.#resizeHitBoxes.size > 0) {
      const ownedHandles = new Set(this.#resizeHitBoxes.values());
      snapData(this.global).resizeHandles = getResizeHandles(this.global).filter(
        (handle) => !ownedHandles.has(handle as ResizeHandleCollider),
      );
      this.#resizeHoverController?.release(this);
      this.#resizeHoverController = null;
      this.#resizeHitBoxes.clear();
    }
    this._connectors = {};
    super.destroy(removeElement);
  }
}

export { NodeComponent };
