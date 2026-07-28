import { BaseObject, ElementObject } from "@snap-engine/core";
import { ConnectorMirror, resolveConnectorSourceAtPoint } from "./connector";
import { LineMirror } from "./line";
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
import {
  getGraphRegistry,
  getResizeHandles,
  snapData,
} from "./internal/shared-data";
import { mintDomainId } from "./internal/graph-registry";
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
  /**
   * Stable application-facing identity (graph-global). Minted by SnapLine
   * when omitted; supply one for any graph that outlives this mirror
   * (persistence, remounts, cross-session reloads).
   */
  id?: string;
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

// `id` is identity, not configuration — read once in the constructor, never
// defaulted or merged.
const DEFAULT_NODE_CONFIG: Required<Omit<NodeConfig, "id">> = {
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
export function mergeConfig<T extends object>(
  defaults: T,
  config: Partial<T>,
): T {
  const merged = { ...defaults };
  for (const key of Object.keys(config) as (keyof T)[]) {
    const value = config[key];
    if (value !== undefined) merged[key] = value as T[keyof T];
  }
  return merged;
}

/** Consumer policy and lifecycle surfaces. Callbacks receive event objects so
 * new context can be added without growing positional signatures. */
/** One node's settled geometry — the app persists what it wants. */
export interface NodeGeometry {
  node: NodeMirror;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Batched geometry observation: a group/multi-select drag stays one event
 * (every moved node in `nodes`); a resize reports a single entry. */
export interface GeometryChangeEvent {
  nodes: readonly NodeGeometry[];
}

export interface NodePointerEvent {
  node: NodeMirror;
  pointerId: number;
  position: eventPosition;
  originalEvent?: PointerEvent;
}

export interface NodeDragPositionEvent {
  node: NodeMirror;
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
  node: NodeMirror;
  handle: ResizeHandle | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeResizeHandleEvent {
  node: NodeMirror;
  handle: ResizeHandle | null;
  cursor: string | null;
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
  canStartDrag?: (event: NodePointerEvent) => boolean;
  /** Resolves a proposed live node position before its world transform changes. */
  resolveDragPosition?: (
    event: NodeDragPositionEvent,
  ) => ResolvedNodeDragPosition;
  /** Consumer-defined pointer selection policy; SnapLine owns no modifier keys. */
  resolveSelectionMode?: (event: NodeSelectionModeEvent) => SelectionMode;
  onDragStart?: (event: NodePointerEvent) => void;
  onDrag?: (event: NodePointerEvent) => void;
  /** Settled geometry after a drag or resize — SnapLine owns live and
   * settled position/size; the consumer may persist this observation, and
   * ignoring it does not revert the mirror. */
  onGeometryChanged?: (event: GeometryChangeEvent) => void;
  onSelectionChange?: (event: NodeSelectionEvent) => void;
  /** Observes live size updates; core writes the retained element geometry. */
  onSizeChange?: (event: NodeResizeEvent) => void;
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
    parent: NodeMirror,
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
  #node: NodeMirror | null = null;
  #handle: ResizeHandleCollider | null = null;
  #target: HTMLElement | null = null;
  #previousNodeCursor = "";
  #previousContainerCursor = "";
  #previousTargetCursor = "";
  // Whether this controller currently owns the cursor it wrote. Restoration is
  // gated on it so clear() is idempotent and never clobbers a cursor the
  // application set on the container itself.
  #applied = false;

  constructor(engine: any) {
    super(engine, null);
    this.event.global.pointerMove = this.#onPointerMove;
  }

  retain(): void {
    this.#count++;
  }

  release(node: NodeMirror): void {
    this.#count--;
    if (this.#node === node) this.clear();
    if (this.#count <= 0) {
      resizeHoverControllers.delete(this.engine);
      // destroy() clears, so a cursor written for some other node cannot be
      // stranded on the container when the last node releases.
      this.destroy();
    }
  }

  activate(handle: ResizeHandleCollider, target?: EventTarget | null): void {
    const node = handle.parent as NodeMirror;
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
    this.#applied = true;
    node.callbacks.onResizeHandleChange?.({
      node,
      handle: handle.handle,
      cursor: handle.cursor,
    });
  }

  clear(): void {
    const node = this.#node;
    // Not gated on `node`: the container cursor outlives any single node, so
    // restoring it must not depend on one still being tracked.
    this.#restoreCss();
    this.#node = null;
    this.#handle = null;
    this.#target = null;
    node?.callbacks.onResizeHandleChange?.({
      node,
      handle: null,
      cursor: null,
    });
  }

  #restoreCss(): void {
    if (!this.#applied) return;
    this.#applied = false;
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

  destroy(): void {
    // BaseObject.destroy does not unsubscribe global callbacks. Left attached,
    // a destroyed controller keeps handling pointerMove, so a remount (HMR,
    // React StrictMode) leaves two controllers writing the cursor — and the
    // second captures the first's write as its "previous" value, permanently
    // poisoning restoration.
    this.event.global.pointerMove = null;
    this.clear();
    super.destroy();
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
  node?: NodeMirror,
): ResizeHandleCollider | null {
  let winner: ResizeHandleCollider | null = null;
  for (const collider of getResizeHandles(engine.global)) {
    if (
      !(collider instanceof ResizeHandleCollider) ||
      collider.engine !== engine
    )
      continue;
    if (node && collider.parent !== node) continue;
    if (!collider.containsWorldPoint(position.x, position.y)) continue;
    if (
      !winner ||
      CORNER_HANDLES.has(collider.handle) ||
      !CORNER_HANDLES.has(winner.handle)
    ) {
      winner = collider;
    }
  }
  return winner;
}

class NodeMirror extends ElementObject {
  /** Stable domain identity — supplied via `NodeConfig.id` or minted. Never
   * the engine-internal `BaseObject.id`. */
  readonly nodeId: string;
  #config: Required<Omit<NodeConfig, "id">>;
  /** @internal Name-keyed live connectors; written by ConnectorMirror's
   * assignToNode/destroy — the one deliberate cross-class field. */
  _connectors: { [key: string]: ConnectorMirror };
  #dragStartX = 0;
  #dragStartY = 0;
  _nodeStyle: any;
  #hitBox: RectCollider;
  #mouseDownX: number;
  #mouseDownY: number;
  _hasMoved: boolean;
  #resizeHitBoxes = new Map<ResizeHandle, ResizeHandleCollider>();
  #resizeHandles: readonly ResizeHandle[];
  #resizeHandleThickness: number;
  #resizeHoverController: ResizeHoverController | null = null;
  #activeResizeHandle: ResizeHandle | null = null;
  /** Read by GroupNodeMirror to distinguish a resize from a move drag. */
  #resizing = false;
  // The size last authored through setSizeState, kept apart from #hitBox (which
  // tracks what the browser actually rendered) so a write always paints the
  // value its own tick authored.
  #authoredWidth = 0;
  #authoredHeight = 0;
  #hasAuthoredSize = false;
  #resizeArmed = false;
  #resizeStartW = 0;
  #resizeStartH = 0;
  #resizeStartX = 0;
  #resizeStartY = 0;
  #callbacks: NodeCallbacks;
  #edgePanPointerId: number | null = null;
  #dragHandles = new Set<HTMLElement>();
  #dragPointerId: number | null = null;
  #dragRoots: NodeMirror[] = [];
  #dragCommitNodes: NodeMirror[] = [];
  #lastDragPosition: eventPosition | null = null;
  #pointerSelectionMode: SelectionMode = "replace";
  #selectedAtPointerDown = false;

  constructor(engine: any, parent: BaseObject | null, config: NodeConfig = {}) {
    super(engine, parent);
    this.#config = mergeConfig(DEFAULT_NODE_CONFIG, config);
    this.#callbacks = this.#config.callbacks;
    this.nodeId = config.id ?? mintDomainId("node", this.global);
    getGraphRegistry(this.engine).registerNode(this);
    const resizeEnabled =
      config.resizable === true || config.resizeHandles !== undefined;
    this.#resizeHandles = !resizeEnabled
      ? []
      : config.resizeHandles !== undefined
        ? config.resizeHandles === true
          ? RESIZE_HANDLES
          : [...new Set(config.resizeHandles)]
        : RESIZE_HANDLES;
    this.#resizeHandleThickness =
      config.resizeHandleThickness ?? DEFAULT_RESIZE_HANDLE_THICKNESS;

    this._connectors = {};
    this.#dragStartX = this.worldTransform.x;
    this.#dragStartY = this.worldTransform.y;
    this.#mouseDownX = 0;
    this.#mouseDownY = 0;
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

    this._hasMoved = false;

    // Whenever the DOM box changes size (ResizeObserver) re-measure + re-glue.
    this.event.dom.onResize = () => this.remeasureDomGeometry();

    // Base positioning styles are framework-owned: adapters must render the
    // element with `position: absolute; transform-origin: top left` (see the
    // ownership note in assets/snapline/AGENTS.md).
  }

  get config(): Required<Omit<NodeConfig, "id">> {
    return this.#config;
  }

  get callbacks(): NodeCallbacks {
    return this.#callbacks;
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
    this.#dragStartX = this.worldTransform.x;
    this.#dragStartY = this.worldTransform.y;
  }

  setSelected(selected: boolean) {
    this.dataAttribute = {
      selected: String(selected),
      "snapline-state": selected ? "focus" : "idle",
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
      line.updateAnchors();
      line.writeTransform();
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
    for (const node of this.#transformNodeTree()) node.scheduleLineWrites();
  }

  // Re-measure the node box + each connector's local center (READ_1) and re-glue
  // every incoming/outgoing line (WRITE_2). This is the "same handling as a move
  // plus a size re-measure": moving a node keeps connector local centers valid,
  // but resizing invalidates them, so they must be re-read. Shared by the
  // ResizeObserver and the JS-driven setSize; stable queueIds collapse a
  // same-frame double-fire (idempotent when it runs twice across frames).
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

  // Reconciles state with what the browser actually rendered: the node box, the
  // resize hitboxes derived from it, and each connector's local center. Shared
  // by the ResizeObserver (READ_1) and the post-write re-measure (READ_2) so the
  // two cannot drift apart.
  #syncMeasuredGeometry(stage: "READ_1" | "READ_2"): void {
    if (!this.element) return;
    const property = this.readDom({ unapplyTransform: false }, stage);
    // While a gesture is authoring the size, the authored box is the truth and
    // the rendered box is one frame behind: the ResizeObserver fires for frame
    // N's paint, so this read lands in frame N+1 AFTER that frame's pointermove
    // already advanced both the size and worldTransform. Adopting it here would
    // make the WRITE_1 paint a stale height beside a fresh transform — a
    // one-frame jump of the anchored edge on every north/west drag.
    if (!this.#resizing) {
      this.#hitBox.width = property.width;
      this.#hitBox.height = property.height;
      this.#positionResizeHitBoxes(property.width, property.height);
    }
    for (const connector of Object.values(this._connectors)) {
      connector.measureLocalCenter(stage);
    }
  }

  // State-only half of a size change: clamps to min and synchronously updates
  // the collision footprint + resize hitbox so hit testing and group
  // containment stay correct mid-drag. `setSize` adds the scheduled DOM write;
  // adapters can use this method alone when seeding external dimensions.
  setSizeState(width: number, height: number): void {
    const w = Math.max(this.#config.minWidth, width);
    const h = Math.max(this.#config.minHeight, height);
    // The authored size is captured here and painted verbatim, so whatever
    // reconciles #hitBox with the DOM in between cannot desynchronize the size
    // from the worldTransform authored in the same tick.
    this.#authoredWidth = w;
    this.#authoredHeight = h;
    this.#hasAuthoredSize = true;
    this.#hitBox.width = w;
    this.#hitBox.height = h;
    this.#positionResizeHitBoxes(w, h);
  }

  // Drives live resize geometry directly. The framework observes and persists
  // the result, but it is not part of the pointer-move paint path.
  setSize(
    width: number,
    height: number,
    handle: ResizeHandle | null = null,
  ): void {
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

  /**
   * Schedules the one task that paints size and transform together, plus the
   * re-measure and line re-glue. Adapters mutate `worldTransform` and
   * `setSizeState(...)` and then call this, so a prop-driven position+size
   * change lands in one frame, in one stage-legal task. Unlike `setSize` it
   * emits no `onSizeChange`, which would echo a controlled app's own value
   * back at it.
   */
  scheduleGeometryWrite(): void {
    this.#scheduleSizeGeometryWrite();
  }

  #scheduleSizeGeometryWrite(): void {
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

  // The single atomic geometry commit: size and transform are painted in one
  // synchronous block, in one task, in one stage — and from values authored in
  // the same tick, never re-read from state that a later measurement may have
  // moved underneath them.
  #writeSizeGeometry(): void {
    if (this.element && this.#hasAuthoredSize) {
      this.element.style.width = `${this.#authoredWidth}px`;
      this.element.style.height = `${this.#authoredHeight}px`;
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

  // Transform-only (re)parenting used by group carry: the public/DOM graph is
  // left alone, so members stay flat siblings in the adapter's node list.
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
        [...this.#dragHandles].some(
          (handle) => target && handle.contains(target),
        )) &&
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
    const selection = [...getGraphRegistry(this.engine).selection];
    this.#selectedAtPointerDown = selection.includes(this);
    this.#pointerSelectionMode =
      this.#callbacks.resolveSelectionMode?.({
        node: this,
        selected: this.#selectedAtPointerDown,
        selection,
        originalEvent: e.event,
      }) ?? "replace";

    if (
      this.#pointerSelectionMode === "replace" &&
      !this.#selectedAtPointerDown
    ) {
      for (const node of [...getGraphRegistry(this.engine).selection]) {
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
      this.#resizing = true;
      this.#resizeStartW = this.#hitBox.width;
      this.#resizeStartH = this.#hitBox.height;
      this.#resizeStartX = this.worldTransform.x;
      this.#resizeStartY = this.worldTransform.y;
      this.#mouseDownX = prop.start.x;
      this.#mouseDownY = prop.start.y;
      this._hasMoved = true;
      // Guard so releasing a resize over another node doesn't click-select it.
      getGraphRegistry(this.engine).resizingNode = this;
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
    if (this.#resizing) {
      this.#applyResizeDrag(
        prop.position.x - this.#mouseDownX,
        prop.position.y - this.#mouseDownY,
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
    this.#mouseDownX = position.x;
    this.#mouseDownY = position.y;
  }

  /** @internal Whether this node's drag behavior already carries `node`. */
  containsSelectionDragNode(_node: NodeMirror): boolean {
    return false;
  }

  /** @internal Nodes whose final positions belong to this drag root's commit. */
  selectionDragNodes(): NodeMirror[] {
    return [this];
  }

  /** @internal Finalize any temporary carry state owned by this drag root. */
  finishSelectionDrag(): void {}

  setDragPosition(prop: dragProp) {
    const dx = prop.position.x - this.#mouseDownX;
    const dy = prop.position.y - this.#mouseDownY;
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
    // A pointerdown rejected by a drag handle/predicate still becomes a generic
    // input drag gesture once it crosses the engine threshold. It must not
    // commit stale selection coordinates on release.
    if (this.#dragPointerId !== prop.pointerId) return;
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    if (this.#resizing) {
      // The teardown runs in `finally` because everything above it calls out:
      // #writeSizeGeometry touches the DOM and onGeometryChanged is consumer
      // code. A throw that skipped these resets would strand `resizingNode`,
      // which permanently disables click-selection (see onUp), and would leave
      // the resize cursor pinned with no path back to a hover recompute.
      try {
        this.#applyResizeDrag(
          prop.end.x - this.#mouseDownX,
          prop.end.y - this.#mouseDownY,
        );
        // Pointer-up is a synchronization boundary for consumers that immediately
        // query the committed handle/box. Keep the coalesced frame write for the
        // hot path, but make the final retained geometry observable now.
        this.#writeSizeGeometry();
        this.#callbacks.onGeometryChanged?.({
          nodes: [this.#geometryOf(this)],
        });
      } finally {
        this.#resizing = false;
        this.#resizeArmed = false;
        this.#activeResizeHandle = null;
        getGraphRegistry(this.engine).resizingNode = null;
        this.#dragPointerId = null;
        // No target element: dragEndProp carries no originating event. activate()
        // still writes the node and container cursors, and the next pointermove
        // re-activates with a target because #target differs.
        this.#refreshResizeHover(prop.end);
      }
      // Settle #hitBox against what actually rendered. The gesture suppressed
      // that reconciliation, and the release write often authors the previous
      // frame's values, so no ResizeObserver would fire to trigger it — without
      // this an authored size the stylesheet refused would stick.
      this.remeasureDomGeometry();
      // A resized node's center may have moved into/out of a group.
      for (const group of getGraphRegistry(this.engine).groups) {
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
    // current before the next group drag. The graph mirror's type-only group
    // reference keeps node.ts free of any group value import.
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
    this.#callbacks.onGeometryChanged?.({
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

    // pointerUp is dispatched to whatever is under the release point, which for a
    // resize may be a DIFFERENT node than the one being resized. Skip click-select
    // while any resize is settling so releasing a resize doesn't select this node.
    if (getGraphRegistry(this.engine).resizingNode) return;
    if (this.#resizeArmed) {
      this.#resizeArmed = false;
      this.#activeResizeHandle = null;
      this.#refreshResizeHover(prop.position, prop.event.target);
      return;
    }

    if (this._hasMoved == false) {
      if (this.#pointerSelectionMode === "replace") {
        for (const node of [...getGraphRegistry(this.engine).selection]) {
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

  getConnector(name: string): ConnectorMirror | null {
    if (!(name in this._connectors)) {
      console.error(`Connector ${name} does not exist in node ${this.id}`);
      return null;
    }
    return this._connectors[name];
  }

  addConnectorObject(connector: ConnectorMirror) {
    connector.assignToNode(this);
  }

  getAllOutgoingLines(): LineMirror[] {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.outgoingLines,
    );
  }

  getAllIncomingLines(): LineMirror[] {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.incomingLines,
    );
  }

  #refreshResizeHover(
    position: eventPosition,
    target?: EventTarget | null,
  ): void {
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
    getGraphRegistry(this.engine).unregisterNode(this);
    this.setSelected(false);
    if (this.#resizeHitBoxes.size > 0) {
      const ownedHandles = new Set(this.#resizeHitBoxes.values());
      snapData(this.global).resizeHandles = getResizeHandles(
        this.global,
      ).filter((handle) => !ownedHandles.has(handle as ResizeHandleCollider));
      this.#resizeHoverController?.release(this);
      this.#resizeHoverController = null;
      this.#resizeHitBoxes.clear();
    }
    this._connectors = {};
    super.destroy(removeElement);
  }
}

export { NodeMirror };
