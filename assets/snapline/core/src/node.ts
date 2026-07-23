import { BaseObject, ElementObject, EventProxyFactory } from "@snap-engine/core";
import { ConnectorComponent } from "./connector";
import { LineComponent } from "./line";
import type {
  pointerUpProp,
  pointerDownProp,
  dragStartProp,
  dragProp,
  dragEndProp,
} from "@snap-engine/core";
import { RectCollider, CircleCollider } from "@snap-engine/core/collision";
import { getSelectList, getGroups, getResizeHandles, snapData } from "./snapline-globals";

export type ResizeAnchor = "tl" | "tr" | "bl" | "br";

export interface NodeConfig {
  lockPosition?: boolean;
  /** Enables a corner resize handle (a virtual collision hitbox). */
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** Radius of the circular resize hitbox; it straddles the anchor corner. */
  resizeHandleRadius?: number;
  /**
   * Which corner carries the resize handle (default "br"). The OPPOSITE corner
   * stays fixed: resizing from a top/left anchor shifts the node's origin while
   * the size changes, so e.g. a "tl" drag grows the box up-left.
   */
  resizeAnchor?: ResizeAnchor;
}

/** Local position of the resize handle's center for a given anchor + size. */
export function resizeAnchorOffset(
  anchor: ResizeAnchor,
  width: number,
  height: number,
): { x: number; y: number } {
  switch (anchor) {
    case "tl":
      return { x: 0, y: 0 };
    case "tr":
      return { x: width, y: 0 };
    case "bl":
      return { x: 0, y: height };
    default:
      return { x: width, y: height };
  }
}

/** Shared by core (hitbox radius) and adapters (visual handle size). */
export const DEFAULT_RESIZE_HANDLE_RADIUS = 14;

const DEFAULT_NODE_CONFIG: Required<NodeConfig> = {
  lockPosition: false,
  resizable: false,
  minWidth: 0,
  minHeight: 0,
  resizeHandleRadius: DEFAULT_RESIZE_HANDLE_RADIUS,
  resizeAnchor: "br",
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

/** Domain/lifecycle callbacks, assigned via `node.nodeCallback.onX = fn`
 * (the canonical EventProxyFactory pattern, mirroring connectorCallback). */
export interface NodeCallback {
  /** Live size updates during a resize drag — the adapter renders width/height. */
  onSizeChange: null | ((width: number, height: number) => void);
  /** Final size at resize-drag end — the consumer persists it. */
  onResizeCommit: null | ((width: number, height: number) => void);
  /** The set of outgoing lines changed — the adapter re-renders its line list. */
  onLinesChanged: null | ((lines: LineComponent[]) => void);
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
  _lineListCallback: ((lines: LineComponent[]) => void) | null;
  #hitBox: RectCollider;
  _selected: boolean;
  _mouseDownX: number;
  _mouseDownY: number;
  _hasMoved: boolean;
  #resizeHitBox: CircleCollider | null = null;
  /** Read by GroupNodeComponent to distinguish a resize from a move drag. */
  protected _resizing = false;
  #resizeArmed = false;
  #resizeStartW = 0;
  #resizeStartH = 0;
  #resizeStartX = 0;
  #resizeStartY = 0;
  #nodeCallback: NodeCallback;

  constructor(engine: any, parent: BaseObject | null, config: NodeConfig = {}) {
    super(engine, parent);
    this.#config = mergeConfig(DEFAULT_NODE_CONFIG, config);
    this.#nodeCallback = EventProxyFactory<NodeComponent, NodeCallback>(this, {
      onSizeChange: null,
      onResizeCommit: null,
      onLinesChanged: null,
    });

    this._connectors = {};
    this._components = {};
    this._dragStartX = this.worldTransform.x;
    this._dragStartY = this.worldTransform.y;
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._prop = {};
    this._propSetCallback = {};
    this._lineListCallback = null;
    this.transformMode = "direct";

    this.event.input.pointerDown = this.onCursorDown;
    this.event.input.dragStart = this.onDragStart;
    this.event.input.drag = this.onDrag;
    this.event.input.dragEnd = this.onDragEnd;
    this.event.input.pointerUp = this.onUp;
    this.#hitBox = new RectCollider(this.engine, this, 0, 0, 0, 0);
    this.addCollider(this.#hitBox);

    // The resize handle is a virtual CircleCollider parked at the BR corner (it
    // straddles the edge and can spread beyond it — no DOM element). It is
    // registered so input.ts can resolve a pointerdown over it to this node.
    if (this.#config.resizable) {
      this.#resizeHitBox = new CircleCollider(
        this.engine,
        this,
        0,
        0,
        this.#config.resizeHandleRadius,
      );
      this.addCollider(this.#resizeHitBox);
      getResizeHandles(this.global).push(this.#resizeHitBox);
    }

    this._selected = false;
    this._hasMoved = false;

    // Whenever the DOM box changes size (ResizeObserver) re-measure + re-glue.
    this.event.dom.onResize = () => this.resyncNodeGeometry();

    // Base positioning styles are framework-owned: adapters must render the
    // element with `position: absolute; transform-origin: top left` (see the
    // ownership note in assets/snapline/AGENTS.md).

    // Initialize global select list if needed
    getSelectList(this.global);
  }

  get config(): Required<NodeConfig> {
    return this.#config;
  }

  get nodeCallback(): NodeCallback {
    return this.#nodeCallback;
  }

  /** @deprecated Assign `nodeCallback.onResizeCommit` instead. */
  get _onResizeCommit(): NodeCallback["onResizeCommit"] {
    return this.#nodeCallback.onResizeCommit;
  }

  /** @deprecated Assign `nodeCallback.onResizeCommit` instead. */
  set _onResizeCommit(callback: NodeCallback["onResizeCommit"]) {
    this.#nodeCallback.onResizeCommit = callback;
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

  /** @deprecated Renamed: use `scheduleLineWrites` (schedules, does not write now). */
  updateNodeLines(): void {
    this.scheduleLineWrites();
  }

  /** Synchronously writes every line on every connector (call inside a WRITE stage). */
  writeLinesNow(): void {
    for (const connector of Object.values(this._connectors)) {
      connector.writeAllLinesNow();
    }
  }

  /** @deprecated Renamed: use `writeLinesNow`. */
  writeNodeLines(): void {
    this.writeLinesNow();
  }

  // Re-measure the node box + each connector's local center (READ_1) and re-glue
  // every incoming/outgoing line (WRITE_1). This is the "same handling as a move
  // plus a size re-measure": moving a node keeps connector local centers valid,
  // but resizing invalidates them, so they must be re-read. Shared by the
  // ResizeObserver and the JS-driven setSize; stable queueIds collapse a
  // same-frame double-fire (idempotent when it runs twice across frames).
  resyncNodeGeometry(): void {
    this.schedule(
      () => {
        const property = this.readDom({ unapplyTransform: false }, "READ_1");
        this.#hitBox.width = property.width;
        this.#hitBox.height = property.height;
        if (this.#resizeHitBox) {
          this.#resizeHitBox.localTransform = resizeAnchorOffset(
            this.#config.resizeAnchor,
            property.width,
            property.height,
          );
        }
        for (const connector of Object.values(this._connectors)) {
          connector.measureLocalCenter("READ_1");
        }
      },
      { stage: "READ_1", queueId: `${this.id}-remeasure` },
    );
    for (const line of [
      ...this.getAllOutgoingLines(),
      ...this.getAllIncomingLines(),
    ]) {
      line.schedule(
        () => {
          line.moveLineToConnectorTransform();
          line.setLineEndAtConnector();
          line.writeDom();
          line.writeTransform();
        },
        { stage: "WRITE_1", queueId: `${line.id}-reglue` },
      );
    }
  }

  /** @deprecated Renamed: use `resyncNodeGeometry`. */
  remeasureAndReglue(): void {
    this.resyncNodeGeometry();
  }

  // State-only half of a size change: clamps to min and synchronously updates
  // the collision footprint + resize hitbox so the hit test and group
  // containment stay correct mid-drag. Never touches the DOM — the element's
  // width/height are framework-owned (rendered by the adapter).
  setSizeState(width: number, height: number): void {
    const w = Math.max(this.#config.minWidth, width);
    const h = Math.max(this.#config.minHeight, height);
    this.#hitBox.width = w;
    this.#hitBox.height = h;
    if (this.#resizeHitBox) {
      this.#resizeHitBox.localTransform = resizeAnchorOffset(this.#config.resizeAnchor, w, h);
    }
  }

  // Drives the node's size from JS (resize handle): updates state, then asks the
  // framework to render the new width/height via onSizeChange. The connector/line
  // re-glue closes itself — the adapter's DOM write triggers the ResizeObserver,
  // which runs resyncNodeGeometry AFTER the browser reflows (no handshake needed:
  // the box repaint is not paint-atomic).
  setSize(width: number, height: number): void {
    this.setSizeState(width, height);
    this.#nodeCallback.onSizeChange?.(this.#hitBox.width, this.#hitBox.height);
  }

  // Applies a resize drag for the configured anchor: deltas are signed per
  // anchor edge (dragging a left/top anchor outward grows the box), and the
  // OPPOSITE corner stays fixed — for top/left anchors the origin shifts by the
  // clamped size change (computed from the clamped size, so at min size the
  // origin freezes with it). Transforms stay engine-written per the ownership
  // contract; the size flows to the framework via onSizeChange.
  #applyResizeDrag(dx: number, dy: number): void {
    const anchor = this.#config.resizeAnchor;
    const sx = anchor === "tr" || anchor === "br" ? 1 : -1;
    const sy = anchor === "bl" || anchor === "br" ? 1 : -1;
    this.setSize(this.#resizeStartW + sx * dx, this.#resizeStartH + sy * dy);
    const w = this.#hitBox.width;
    const h = this.#hitBox.height;
    if (anchor === "br") return;
    const x =
      anchor === "tl" || anchor === "bl"
        ? this.#resizeStartX + (this.#resizeStartW - w)
        : this.#resizeStartX;
    const y =
      anchor === "tl" || anchor === "tr"
        ? this.#resizeStartY + (this.#resizeStartH - h)
        : this.#resizeStartY;
    this.worldTransform = { x, y };
    this.schedule(() => this.writeTransformAndLines(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
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
    this.writeLinesNow();
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
    this.#nodeCallback.onLinesChanged?.(lines);
    // Legacy path during the deprecation window.
    this._lineListCallback?.(lines);
  }

  /** @deprecated Assign `nodeCallback.onLinesChanged` instead. */
  setLineListCallback(callback: (lines: LineComponent[]) => void) {
    this._lineListCallback = callback;
  }

  onCursorDown(e: pointerDownProp): void {
    if (e.event.button != 0) {
      return;
    }

    // Claim the pointer from the very first pointer event: waiting for the
    // drag-start threshold would let the camera pan by one move event before
    // onDragStart runs. The claim auto-releases when the gesture ends, so no
    // paired release is needed anywhere.
    this.engine.input.claimPointer(e.event.pointerId);

    this._hasMoved = false;
    // Synchronous point test against this node's own resize hitbox (no reliance
    // on the frame-delayed sweep) decides resize-vs-move for this gesture.
    this.#resizeArmed = !!this.#resizeHitBox?.containsWorldPoint(
      e.position.x,
      e.position.y,
    );
    if (!getSelectList(this.global).includes(this)) {
      for (const node of [...getSelectList(this.global)]) {
        node.setSelected(false);
      }
      this.setSelected(true);
    }
  }

  onDragStart(prop: dragStartProp): void {
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
    for (const node of getSelectList(this.global)) {
      node.setStartPositions();
      node._mouseDownX = prop.start.x;
      node._mouseDownY = prop.start.y;
    }
    this._hasMoved = true;
  }

  onDrag(prop: dragProp): void {
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
    for (const node of getSelectList(this.global)) {
      node.setDragPosition(prop);
    }
  }

  setDragPosition(prop: dragProp) {
    const dx = prop.position.x - this._mouseDownX;
    const dy = prop.position.y - this._mouseDownY;

    this.worldTransform = {
      x: this._dragStartX + dx,
      y: this._dragStartY + dy,
    };
    this.schedule(() => this.writeTransformAndLines(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  onDragEnd(prop: dragEndProp) {

    if (this._resizing) {
      this.#applyResizeDrag(
        prop.end.x - this._mouseDownX,
        prop.end.y - this._mouseDownY,
      );
      this.#nodeCallback.onResizeCommit?.(this.#hitBox.width, this.#hitBox.height);
      this._resizing = false;
      this.#resizeArmed = false;
      snapData(this.global).resizingNode = null;
      // A resized node's center may have moved into/out of a group.
      for (const group of getGroups(this.global)) {
        if ((group as unknown) !== this) group.refreshMembership(true);
      }
      return;
    }

    for (const node of getSelectList(this.global)) {
      node.setUpPosition(prop);
    }

    // A settled node may have entered or left a group; groups re-evaluate
    // membership on settle (never at group-drag-start), so the maintained set is
    // current before the next group drag. The structural GroupLike type keeps
    // node.ts free of any group import.
    for (const group of getGroups(this.global)) {
      if ((group as unknown) !== this) group.refreshMembership(true);
    }
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
    this.schedule(() => this.writeTransformAndLines(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  onUp(_prop: pointerUpProp) {

    // pointerUp is dispatched to whatever is under the release point, which for a
    // resize may be a DIFFERENT node than the one being resized. Skip click-select
    // while any resize is settling so releasing a resize doesn't select this node.
    if (snapData(this.global).resizingNode) return;
    if (this.#resizeArmed) {
      this.#resizeArmed = false;
      return;
    }

    if (this._hasMoved == false) {
      for (const node of [...getSelectList(this.global)]) {
        node.setSelected(false);
      }
      this.setSelected(true);
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
    if (name in this._propSetCallback) {
      this._propSetCallback[name](value);
    }
    this._prop[name] = value;

    if (!(name in this._connectors)) {
      return;
    }
    const peers = this._connectors[name].outgoingLines
      .filter((line) => line.target && !line.isDeleteRequested)
      .map((line) => line.target);
    if (!peers) {
      return;
    }
    for (const peer of peers) {
      if (!peer) continue;
      if (!peer.parent) continue;
      let parent = peer.parent as NodeComponent;
      parent.setProp(peer.name, value);
    }
  }

  propagateProp() {
    for (const connector of Object.values(this._connectors)) {
      this.setProp(connector.name, this.getProp(connector.name));
    }
  }

  destroy() {
    for (const connector of Object.values(this._connectors)) {
      connector.deleteAllLines();
    }
    this.setSelected(false);
    if (this.#resizeHitBox) {
      snapData(this.global).resizeHandles = getResizeHandles(this.global).filter(
        (handle) => handle !== this.#resizeHitBox,
      );
    }
    this._connectors = {};
    super.destroy();
  }
}

export { NodeComponent };
