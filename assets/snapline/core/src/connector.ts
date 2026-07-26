import { ElementObject, BaseObject } from "@snap-engine/core";
import type {
  dragEndProp,
  dragProp,
  dragStartProp,
  eventPosition,
  pointerDownProp,
  pointerUpProp,
} from "@snap-engine/core";
import { CircleCollider } from "@snap-engine/core/collision";
import type { NodeComponent } from "./node";
import { LineComponent } from "./line";
import { getNodeManager } from "./snapline-globals";
import { getSourceSurfaces } from "./snapline-globals";

export type SnapLineMetadata = Record<string, unknown>;
export type ConnectionOrigin = "gesture" | "programmatic" | "hydration";
export type DisconnectReason =
  | "gesture"
  | "replacement"
  | "programmatic"
  | "teardown";
export type ConnectorRole = "source" | "target";
export type ConnectorLinePhase =
  | "source-start"
  | "preview-free"
  | "preview-target"
  | "drop"
  | "connected";

export interface ConnectorPoint {
  x: number;
  y: number;
}

export interface ConnectorNormal {
  x: number;
  y: number;
}

export interface ConnectorAnchor extends ConnectorPoint {
  normal?: ConnectorNormal;
}

/** Cached world-space bounds derived from the parent node's collision box. */
export interface ConnectorGeometrySnapshot {
  connector: ConnectorComponent;
  node: NodeComponent;
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  center: ConnectorAnchor;
  scaleX: number;
  scaleY: number;
}

export interface ConnectorHit {
  anchor: ConnectorAnchor;
  distance: number;
  priority?: number;
  payload?: unknown;
}

export interface ConnectorCandidate {
  connector: ConnectorComponent;
  hit: ConnectorHit;
}

export interface ConnectorSurfaceHitTestEvent {
  connector: ConnectorComponent;
  position: eventPosition;
  geometry: ConnectorGeometrySnapshot;
  phase: ConnectorLinePhase;
}

export interface ConnectorAnchorEvent {
  connector: ConnectorComponent;
  peer: ConnectorComponent | null;
  line: LineComponent;
  role: ConnectorRole;
  phase: ConnectorLinePhase;
  position: ConnectorPoint;
  geometry: ConnectorGeometrySnapshot;
  peerGeometry: ConnectorGeometrySnapshot | null;
  hit: ConnectorHit | null;
}

export interface ConnectorSurfaceStrategy {
  sourceHitTest?: (
    event: ConnectorSurfaceHitTestEvent,
  ) => ConnectorHit | null | false | void;
  targetHitTest?: (
    event: ConnectorSurfaceHitTestEvent,
  ) => ConnectorHit | null | false | void;
  resolveAnchor?: (
    event: ConnectorAnchorEvent,
  ) => ConnectorAnchor | null | void;
}

export interface ConnectorCapabilities {
  source: boolean;
  target: boolean;
  maxIncoming: number;
  reconnect: boolean;
  allowParallel: boolean;
}

export interface ConnectorPairEvent {
  source: ConnectorComponent;
  target: ConnectorComponent;
}

export interface ConnectorCandidateEvent {
  source: ConnectorComponent;
  /** Legacy convenience reference. */
  candidate: ConnectorComponent | null;
  resolvedCandidate: ConnectorCandidate | null;
  line: LineComponent | null;
}

export interface ConnectorConnectionEvent extends ConnectorPairEvent {
  connector: ConnectorComponent;
  peer: ConnectorComponent;
  line: LineComponent;
  role: ConnectorRole;
  origin: ConnectionOrigin;
}

export interface ConnectorDisconnectionEvent
  extends Omit<ConnectorConnectionEvent, "origin"> {
  reason: DisconnectReason;
}

export interface ConnectorDragEvent {
  connector: ConnectorComponent;
  position: eventPosition;
  pointerId: number;
}

export interface ConnectorPointerEvent extends ConnectorDragEvent {
  originalEvent: PointerEvent;
}

export interface ConnectorConnectionRequestEvent extends ConnectorPairEvent {
  line: LineComponent;
  candidate: ConnectorCandidate;
  position: eventPosition;
}

export type ConnectorConnectionRequestResult =
  | false
  | void
  | { payload?: unknown };

export interface ConnectorCallbacks {
  canConnect?: (event: ConnectorPairEvent) => boolean;
  /** Gesture-only and source-only canonical-model creation seam. */
  onConnectionRequest?: (
    event: ConnectorConnectionRequestEvent,
  ) => ConnectorConnectionRequestResult;
  /** Fires when this connector claims a primary pointer, before drag threshold. */
  onPointerDown?: (event: ConnectorPointerEvent) => void;
  onDragStart?: (event: ConnectorDragEvent) => void;
  onCandidateChange?: (event: ConnectorCandidateEvent) => void;
  onConnect?: (event: ConnectorConnectionEvent) => void;
  onDisconnect?: (event: ConnectorDisconnectionEvent) => void;
  onDragEnd?: (event: ConnectorDragEvent & { connected: boolean }) => void;
}

enum ConnectorState {
  IDLE,
  ARMED,
  DRAGGING,
}

export interface ConnectorConfig {
  name?: string;
  /** @deprecated Prefer capabilities.maxIncoming. */
  maxConnectors?: number;
  /** @deprecated Prefer capabilities.source/target. */
  allowDragOut?: boolean;
  capabilities?: Partial<ConnectorCapabilities>;
  surfaceStrategies?: readonly ConnectorSurfaceStrategy[];
  lineClass?: typeof LineComponent;
  colliderRadius?: number;
  metadata?: SnapLineMetadata;
  callbacks?: ConnectorCallbacks;
  /** Allows this connector gesture to use the engine's configured edge pan. */
  edgePan?: boolean;
}

export type ConnectorConfigUpdate = Partial<Omit<ConnectorConfig, "name">>;

export interface ConnectorResolvedHit {
  candidate: ConnectorCandidate;
  strategy: ConnectorSurfaceStrategy | null;
  strategyIndex: number;
}

interface ArmedConnection {
  pointerId: number;
  sourceHit: ConnectorHit | null;
  sourceStrategy: ConnectorSurfaceStrategy | null;
  reconnectLine: LineComponent | null;
}

class ConnectorComponent extends ElementObject {
  #config: ConnectorConfig;
  #capabilities: Readonly<ConnectorCapabilities>;
  #name: string;
  #prop: { [key: string]: any };
  #outgoingLines: LineComponent[];
  #incomingLines: LineComponent[];
  #state: ConnectorState = ConnectorState.IDLE;

  #hitCircle: CircleCollider;
  #targetConnector: ConnectorComponent | null = null;
  #candidate: ConnectorResolvedHit | null = null;
  #dragLine: LineComponent | null = null;
  #edgePanPointerId: number | null = null;
  #localCenter: ConnectorPoint;
  #hasMeasuredCenter = false;
  #armed: ArmedConnection | null = null;
  #cancelledPointers = new Set<number>();
  #callbacks: ConnectorCallbacks;

  get parent(): NodeComponent {
    return super.parent as NodeComponent;
  }

  set parent(parent: BaseObject | null) {
    super.parent = parent;
  }

  constructor(
    engine: any,
    parent: NodeComponent,
    config: ConnectorConfig = {},
  ) {
    super(engine, parent as unknown as BaseObject);

    this.#prop = {};
    this.#outgoingLines = [];
    this.#incomingLines = [];
    this.#config = { ...config };
    this.#capabilities = Object.freeze(resolveCapabilities(this.#config));
    this.#name = config.name || this.id || "";
    this.#callbacks = config.callbacks ?? {};
    this.#localCenter = { x: 0, y: 0 };
    this.transformMode = "none";
    this.event.input.pointerDown = this.onCursorDown;
    this.event.input.pointerUp = this.#onPointerUp;
    this.event.input.dragStart = this.#onDragStart;
    this.event.input.drag = this.runDragOutLine;
    this.event.input.dragEnd = this.endDragOutLine;
    this.globalInput.pointerUp = this.#onPointerUp;

    this.#hitCircle = new CircleCollider(
      engine,
      this,
      0,
      0,
      this.#config.colliderRadius ?? 30,
    );
    this.addCollider(this.#hitCircle);
    this.#syncSourceSurfaceRegistration();
    getNodeManager(this.engine).registerConnector(this);

    this.event.dom.onAssignDom = () => {
      this.schedule(
        () => {
          this.measureLocalCenter("READ_1");
        },
        { stage: "READ_1" },
      );
      this.scheduleAllLineWrites();
    };
  }

  get name(): string {
    return this.#name;
  }

  get config(): ConnectorConfig {
    return this.#config;
  }

  get capabilities(): Readonly<ConnectorCapabilities> {
    return this.#capabilities;
  }

  get surfaceStrategies(): readonly ConnectorSurfaceStrategy[] {
    return this.#config.surfaceStrategies ?? [];
  }

  get prop(): { [key: string]: any } {
    return this.#prop;
  }

  get metadata(): SnapLineMetadata {
    return this.#config.metadata ?? {};
  }

  get callbacks(): ConnectorCallbacks {
    return this.#callbacks;
  }

  set callbacks(callbacks: ConnectorCallbacks) {
    this.updateConfig({ callbacks });
  }

  get outgoingLines(): LineComponent[] {
    return this.#outgoingLines;
  }

  get incomingLines(): LineComponent[] {
    return this.#incomingLines;
  }

  get targetConnector(): ConnectorComponent | null {
    return this.#targetConnector;
  }

  set targetConnector(value: ConnectorComponent | null) {
    const resolved = value
      ? {
          candidate: {
            connector: value,
            hit: {
              anchor: value.center,
              distance: 0,
            },
          },
          strategy: value.#defaultAnchorStrategy(),
          strategyIndex: -1,
        }
      : null;
    this.#setCandidate(resolved);
  }

  get numIncomingLines(): number {
    return this.#incomingLines.length;
  }

  get numOutgoingLines(): number {
    return this.#outgoingLines.length;
  }

  /**
   * Updates runtime connector policy without replacing the connector or its
   * existing topology. `name` remains construction-only because it keys the
   * connector in its parent node.
   */
  updateConfig(config: ConnectorConfigUpdate): void {
    this.#config = { ...this.#config, ...config };
    this.#callbacks = this.#config.callbacks ?? {};
    this.#capabilities = Object.freeze(resolveCapabilities(this.#config));
    this.#hitCircle.radius = this.#config.colliderRadius ?? 30;
    this.#syncSourceSurfaceRegistration();
    this.scheduleAllLineWrites();
  }

  /**
   * Attaches or detaches the optional visible port without destroying the
   * logical connector. Framework adapters use this for live `virtual` changes.
   */
  bindElement(element: HTMLElement | null): void {
    if (this.element === element) return;
    if (this.element) {
      this.destroyDom(false);
      this.#hasMeasuredCenter = false;
    }
    if (element) {
      this.element = element;
    } else {
      this.#hasMeasuredCenter = false;
      this.scheduleAllLineWrites();
    }
  }

  get geometry(): ConnectorGeometrySnapshot {
    const bounds = this.parent.hitBox.getWorldBoundsSnapshot();
    return {
      connector: this,
      node: this.parent,
      x: bounds.left,
      y: bounds.top,
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      center: { x: bounds.centerX, y: bounds.centerY },
      scaleX: bounds.scaleX,
      scaleY: bounds.scaleY,
    };
  }

  get center(): ConnectorAnchor {
    if (this.#hasMeasuredCenter && this.parent) {
      const parentTransform = this.parent.worldTransform;
      return {
        x: parentTransform.x + this.#localCenter.x * parentTransform.scaleX,
        y: parentTransform.y + this.#localCenter.y * parentTransform.scaleY,
      };
    }
    if (this.element) return this.measureDomCenter();
    return this.geometry.center;
  }

  measureDomCenter(): ConnectorAnchor {
    if (!this.element) return this.geometry.center;

    const rect = this.element.getBoundingClientRect();
    const screenX = rect.left + rect.width / 2;
    const screenY = rect.top + rect.height / 2;
    if (this.engine?.camera) {
      const [cameraX, cameraY] = this.engine.camera.getCameraFromScreen(
        screenX,
        screenY,
      );
      const [worldX, worldY] = this.engine.camera.getWorldFromCamera(
        cameraX,
        cameraY,
      );
      return { x: worldX, y: worldY };
    }

    return { x: screenX, y: screenY };
  }

  measureLocalCenter(
    stage: "READ_1" | "READ_2" | "READ_3" | null = null,
  ): void {
    if (!this.element || !this.parent) return;

    const prop = this.readDom({ unapplyTransform: false }, stage);
    const parentTransform = this.parent.worldTransform;
    const scaleX = parentTransform.scaleX === 0 ? 1 : parentTransform.scaleX;
    const scaleY = parentTransform.scaleY === 0 ? 1 : parentTransform.scaleY;
    const localLeft = (prop.x - parentTransform.x) / scaleX;
    const localTop = (prop.y - parentTransform.y) / scaleY;
    const localCenterX = (prop.x + prop.width / 2 - parentTransform.x) / scaleX;
    const localCenterY =
      (prop.y + prop.height / 2 - parentTransform.y) / scaleY;

    this.localTransform = { x: localLeft, y: localTop };
    this.#localCenter = { x: localCenterX, y: localCenterY };
    this.#hasMeasuredCenter = true;
    this.#hitCircle.localTransform = {
      x: localCenterX - localLeft,
      y: localCenterY - localTop,
    };
  }

  requestDomGeometrySync(): boolean {
    if (!this.element?.isConnected || !this.parent) return false;

    this.schedule(
      () => {
        if (!this.element?.isConnected || !this.parent) return;
        this.measureLocalCenter("READ_1");
      },
      {
        stage: "READ_1",
        queueId: `${this.id}-dom-geometry`,
      },
    );
    for (const line of [...this.#outgoingLines, ...this.#incomingLines]) {
      line.schedule(
        () => {
          line.moveLineToConnectorTransform();
          line.writeTransform();
        },
        {
          stage: "WRITE_1",
          queueId: `${line.id}-dom-geometry`,
        },
      );
    }
    return true;
  }

  onCursorDown(prop: pointerDownProp): void {
    if (prop.event.button !== 0) return;
    const sourceHit = this.#resolveOwnSourceHit(prop.position, "source-start");
    this.armSurfaceGesture(prop, sourceHit);
  }

  armSurfaceGesture(
    prop: pointerDownProp,
    sourceHit: ConnectorResolvedHit | null,
  ): void {
    if (prop.event.button !== 0) return;
    const currentIncomingLines = this.#liveIncomingLines();
    if (this.#capabilities.reconnect && currentIncomingLines.length > 0) {
      const line = currentIncomingLines[0];
      const source = line.start;
      this.engine.input.setPointerDragOwner(prop.event.pointerId, source);
      source.#arm(prop, {
        sourceHit: null,
        sourceStrategy: null,
        reconnectLine: line,
      });
      return;
    }

    if (!this.#capabilities.source) return;
    this.#arm(prop, {
      sourceHit: sourceHit?.candidate.hit ?? null,
      sourceStrategy: sourceHit?.strategy ?? this.#defaultAnchorStrategy(),
      reconnectLine: null,
    });
  }

  #arm(
    prop: pointerDownProp,
    options: Omit<ArmedConnection, "pointerId">,
  ): void {
    if (this.#state !== ConnectorState.IDLE) return;
    this.#state = ConnectorState.ARMED;
    this.#armed = {
      pointerId: prop.event.pointerId,
      ...options,
    };
    this.#cancelledPointers.delete(prop.event.pointerId);
    this.engine.input.claimPointer(prop.event.pointerId);
    this.#callbacks.onPointerDown?.({
      connector: this,
      position: prop.position,
      pointerId: prop.event.pointerId,
      originalEvent: prop.event,
    });
  }

  #onPointerUp(prop: pointerUpProp): void {
    const pointerId = prop.event.pointerId;
    if (this.#armed?.pointerId !== pointerId) return;
    if (prop.event.type === "pointercancel") {
      this.#cancelledPointers.add(pointerId);
    }
    if (this.#state === ConnectorState.ARMED) {
      this.#resetGesture();
    }
  }

  #onDragStart(prop: dragStartProp): void {
    if (
      this.#state !== ConnectorState.ARMED ||
      this.#armed?.pointerId !== prop.pointerId
    ) {
      return;
    }

    const armed = this.#armed;
    let line = armed.reconnectLine;
    if (line) {
      this.#detachLineForReconnect(line);
      line.clearTarget();
    } else {
      line = this.createLine();
      line.setSourceSurfaceContext(armed.sourceStrategy, armed.sourceHit);
      this.#outgoingLines.unshift(line);
    }

    this.#dragLine = line;
    this.#state = ConnectorState.DRAGGING;
    this.#setCandidate(null);
    line.setPhase("source-start");
    line.setPreviewPosition(prop.start);
    this.parent.updateNodeLineList();
    this.parent.scheduleLineWrites();
    this.#callbacks.onDragStart?.({
      connector: this,
      position: prop.start,
      pointerId: prop.pointerId,
    });
    line.setPhase("preview-free");
  }

  deleteLine(
    i: number,
    reason: DisconnectReason = "programmatic",
  ): LineComponent | null {
    if (this.#outgoingLines.length === 0 || i < 0) return null;
    const line = this.#outgoingLines[i];
    if (!line) return null;

    const target = line.target;
    if (target) {
      target.#incomingLines = target.#incomingLines.filter(
        (incomingLine) => incomingLine !== line,
      );
      this.#emitDisconnect(target, line, reason);
    }
    line.destroy(false);
    this.#outgoingLines.splice(i, 1);
    this.parent?.updateNodeLineList();
    return line;
  }

  deleteAllLines(reason: DisconnectReason = "programmatic"): void {
    for (const line of [...this.#outgoingLines]) {
      this.deleteLine(this.#outgoingLines.indexOf(line), reason);
    }
    for (const line of [...this.#incomingLines]) {
      line.start.deleteLine(line.start.outgoingLines.indexOf(line), reason);
    }
    this.#incomingLines = [];
  }

  scheduleAllLineWrites(): void {
    for (const line of [...this.#outgoingLines, ...this.#incomingLines]) {
      line.schedule(
        () => {
          line.moveLineToConnectorTransform();
          line.writeTransform();
        },
        {
          stage: "WRITE_2",
          queueId: `${line.id}-transform`,
        },
      );
    }
  }

  writeAllLinesNow(): void {
    for (const line of [...this.#outgoingLines, ...this.#incomingLines]) {
      line.moveLineToConnectorTransform();
      line.writeTransform();
    }
  }

  assignToNode(parent: NodeComponent): void {
    this.parent = parent;
    const parentRef = this.parent;
    parentRef._prop[this.#name] = null;
    this.#prop = parentRef._prop;
    parentRef._connectors[this.#name] = this;
    this.#outgoingLines = [];
    this.#incomingLines = [];
    if (parentRef.global && this.global == null) {
      this.global = parentRef.global;
    }
  }

  createLine(): LineComponent {
    const line = this.#config.lineClass
      ? new this.#config.lineClass(this.engine, this)
      : new LineComponent(this.engine, this);
    line.setSourceSurfaceContext(this.#defaultAnchorStrategy(), null);
    return line;
  }

  /** @deprecated Pointer-down now only arms; retained for source compatibility. */
  startDragOutLine(prop: pointerDownProp): void {
    this.armSurfaceGesture(
      prop,
      this.#resolveOwnSourceHit(prop.position, "source-start"),
    );
  }

  findClosestConnector(): void {
    if (!this.#dragLine) {
      this.#setCandidate(null);
      return;
    }
    const position = {
      ...this.#dragLine.endAnchor,
      cameraX: this.#dragLine.endAnchor.x,
      cameraY: this.#dragLine.endAnchor.y,
      screenX: this.#dragLine.endAnchor.x,
      screenY: this.#dragLine.endAnchor.y,
    };
    this.#setCandidate(this.#resolveTargetAtPoint(position, "preview-target"));
  }

  findClosestConnectorAtPoint(
    position: ConnectorPoint,
  ): ConnectorComponent | null {
    return this.findCandidateAtPoint(position)?.connector ?? null;
  }

  findCandidateAtPoint(
    position: ConnectorPoint,
    phase: "preview-target" | "drop" = "preview-target",
  ): ConnectorCandidate | null {
    return (
      this.#resolveTargetAtPoint(asEventPosition(position), phase)?.candidate ??
      null
    );
  }

  resolveSourceHit(position: eventPosition): ConnectorResolvedHit | null {
    return this.#resolveOwnSourceHit(position, "source-start");
  }

  canConnectToConnector(connector: ConnectorComponent): boolean {
    if (
      connector.id === this.id ||
      !this.#capabilities.source ||
      !connector.#capabilities.target ||
      connector.#capabilities.maxIncoming === 0
    ) {
      return false;
    }

    const hasParallel = connector
      .#liveIncomingLines()
      .some((line) => line.start === this);
    if (
      hasParallel &&
      !(
        this.#capabilities.allowParallel &&
        connector.#capabilities.allowParallel
      )
    ) {
      return false;
    }

    const event = { source: this, target: connector };
    return (
      this.#callbacks.canConnect?.(event) !== false &&
      connector.#callbacks.canConnect?.(event) !== false
    );
  }

  runDragOutLine(prop: dragProp): void {
    if (
      this.#state !== ConnectorState.DRAGGING ||
      this.#armed?.pointerId !== prop.pointerId
    ) {
      return;
    }

    if (this.#config.edgePan !== false) {
      const controller = this.engine.edgePanController;
      if (this.#edgePanPointerId == null) {
        this.#edgePanPointerId = prop.pointerId;
        controller?.startEdgePan(prop.pointerId, prop.position, (position) =>
          this.#moveDraggedLine(position),
        );
      } else {
        controller?.updateEdgePan(prop.pointerId, prop.position);
      }
    }

    this.#moveDraggedLine(prop.position);
  }

  #moveDraggedLine(position: eventPosition): void {
    if (this.#state !== ConnectorState.DRAGGING || !this.#dragLine) return;

    const candidate = this.#resolveTargetAtPoint(position, "preview-target");
    this.#setCandidate(candidate);
    this.#dragLine.setPhase(candidate ? "preview-target" : "preview-free");
    this.#dragLine.setPreviewPosition(position);
    this.#dragLine.schedule(() => this.#dragLine?.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.#dragLine.id}-transform`,
    });
  }

  hoverWhileDragging(
    targetConnector: ConnectorComponent,
  ): [number, number] | void {
    if (!(targetConnector instanceof ConnectorComponent) || !this.#dragLine) {
      return;
    }
    const anchor = targetConnector.resolveAnchor({
      line: this.#dragLine,
      role: "target",
      phase: "preview-target",
      peer: this,
      position: this.geometry.center,
      hit: this.#candidate?.candidate.hit ?? null,
      strategy: this.#candidate?.strategy ?? null,
    });
    return [anchor.x, anchor.y];
  }

  endDragOutLine(prop: dragEndProp): void {
    if (
      this.#state !== ConnectorState.DRAGGING ||
      this.#armed?.pointerId !== prop.pointerId
    ) {
      return;
    }
    const line = this.#dragLine;
    if (!line) {
      this.#resetGesture();
      return;
    }

    if (this.#cancelledPointers.has(prop.pointerId)) {
      this.#discardDraggedLine(line, prop, false);
      return;
    }

    const candidate = this.#resolveTargetAtPoint(prop.end, "drop");
    this.#setCandidate(candidate);
    line.setPhase("drop");
    line.setPreviewPosition(prop.end);

    let connected = false;
    if (candidate) {
      let request: ConnectorConnectionRequestResult;
      try {
        request = this.#callbacks.onConnectionRequest?.({
          source: this,
          target: candidate.candidate.connector,
          line,
          candidate: candidate.candidate,
          position: prop.end,
        });
      } catch (error) {
        this.#discardDraggedLine(line, prop, false);
        throw error;
      }
      if (request !== false) {
        const connectionOptions: Parameters<
          ConnectorComponent["connectToConnector"]
        >[0] = {
          target: candidate.candidate.connector,
          line,
          origin: "gesture",
          candidate,
        };
        if (
          request &&
          typeof request === "object" &&
          Object.prototype.hasOwnProperty.call(request, "payload")
        ) {
          connectionOptions.payload = request.payload;
        }
        connected = this.connectToConnector(connectionOptions);
      }
    }

    if (!connected) {
      this.#discardDraggedLine(line, prop, false);
      return;
    }

    candidate!.candidate.connector.#prop[candidate!.candidate.connector.#name] =
      this.#prop[this.#name];
    this.parent.scheduleLineWrites();
    this.#callbacks.onDragEnd?.({
      connector: this,
      position: prop.end,
      pointerId: prop.pointerId,
      connected: true,
    });
    this.#resetGesture();
  }

  _endLineDragCleanup(): void {
    this.#resetGesture();
  }

  startPickUpLine(line: LineComponent, prop: pointerDownProp): void {
    this.engine.input.setPointerDragOwner(prop.event.pointerId, line.start);
    line.start.#arm(prop, {
      sourceHit: null,
      sourceStrategy: null,
      reconnectLine: line,
    });
  }

  connectToConnector(options: {
    target: ConnectorComponent;
    line?: LineComponent | null;
    origin?: ConnectionOrigin;
    payload?: unknown;
    candidate?: ConnectorResolvedHit | null;
  }): boolean {
    const {
      target,
      line: requestedLine = null,
      origin = "programmatic",
      candidate = null,
    } = options;
    let line = requestedLine;
    const hasPayload = Object.prototype.hasOwnProperty.call(options, "payload");
    if (line && line.start !== this) return false;

    const alreadyConnected =
      line?.target === target &&
      this.#outgoingLines.includes(line) &&
      target.#incomingLines.includes(line);
    if (alreadyConnected && line) {
      if (hasPayload) line.setPayload(options.payload);
      line.connectTarget(
        target,
        candidate?.candidate ?? null,
        candidate?.strategy ?? target.#defaultAnchorStrategy(),
      );
      line.writeTransform();
      return true;
    }

    if (!this.canConnectToConnector(target)) return false;

    const maxIncoming = target.#capabilities.maxIncoming;
    if (maxIncoming > 0) {
      const currentIncomingLines = target.#liveIncomingLines();
      const removeCount = Math.max(
        0,
        currentIncomingLines.length - maxIncoming + 1,
      );
      for (const incomingLine of currentIncomingLines.slice(0, removeCount)) {
        incomingLine.start.deleteLine(
          incomingLine.start.outgoingLines.indexOf(incomingLine),
          "replacement",
        );
      }
    }

    if (line == null) {
      line = this.createLine();
      this.#outgoingLines.unshift(line);
    } else if (!this.#outgoingLines.includes(line)) {
      this.#outgoingLines.unshift(line);
    }

    const previousTarget = line.target;
    if (previousTarget) {
      previousTarget.#incomingLines = previousTarget.#incomingLines.filter(
        (incomingLine) => incomingLine !== line,
      );
      line.clearTarget();
      this.#emitDisconnect(previousTarget, line, "programmatic");
    }

    // Payload and anchors are authoritative before render/connect callbacks.
    if (hasPayload) line.setPayload(options.payload);
    line.connectTarget(
      target,
      candidate?.candidate ?? null,
      candidate?.strategy ?? target.#defaultAnchorStrategy(),
    );
    if (!target.#incomingLines.includes(line)) {
      target.#incomingLines.push(line);
    }
    line.writeTransform();

    this.parent.updateNodeLineList();
    this.#emitConnect(target, line, origin);
    this.parent.setProp(this.#name, this.#prop[this.#name]);
    return true;
  }

  disconnectFromConnector(
    connector: ConnectorComponent,
    reason: DisconnectReason = "programmatic",
  ): void {
    const lineIndex = this.#outgoingLines.findIndex(
      (line) => line.target === connector,
    );
    if (lineIndex !== -1) this.deleteLine(lineIndex, reason);
  }

  resolveAnchor({
    line,
    role,
    phase,
    peer,
    position,
    hit,
    strategy,
  }: {
    line: LineComponent;
    role: ConnectorRole;
    phase: ConnectorLinePhase;
    peer: ConnectorComponent | null;
    position: ConnectorPoint;
    hit: ConnectorHit | null;
    strategy: ConnectorSurfaceStrategy | null;
  }): ConnectorAnchor {
    const currentStrategy =
      strategy && this.surfaceStrategies.includes(strategy)
        ? strategy
        : this.#defaultAnchorStrategy();
    const resolved = currentStrategy?.resolveAnchor?.({
      connector: this,
      peer,
      line,
      role,
      phase,
      position,
      geometry: this.geometry,
      peerGeometry: peer?.geometry ?? null,
      hit,
    });
    if (resolved && isFinitePoint(resolved)) return cloneAnchor(resolved);
    if (
      hit &&
      (currentStrategy != null || phase !== "connected") &&
      isFinitePoint(hit.anchor)
    ) {
      return cloneAnchor(hit.anchor);
    }
    return cloneAnchor(this.center);
  }

  destroy(removeElement: boolean = true): void {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    this.#resetGesture();
    this.deleteAllLines("teardown");
    getNodeManager(this.engine).unregisterConnector(this);
    if (this.parent?._connectors[this.#name] === this) {
      delete this.parent._connectors[this.#name];
    }
    this.#removeSourceSurfaceRegistration();
    this.globalInput.pointerUp = null;
    super.destroy(removeElement);
  }

  #resolveOwnSourceHit(
    position: eventPosition,
    phase: ConnectorLinePhase,
  ): ConnectorResolvedHit | null {
    const hits: ConnectorResolvedHit[] = [];
    for (const [strategyIndex, strategy] of this.surfaceStrategies.entries()) {
      const hit = normalizeHit(
        strategy.sourceHitTest?.({
          connector: this,
          position,
          geometry: this.geometry,
          phase,
        }),
      );
      if (hit) {
        hits.push({
          candidate: { connector: this, hit },
          strategy,
          strategyIndex,
        });
      }
    }
    return pickResolvedHit(hits);
  }

  #resolveTargetAtPoint(
    position: eventPosition,
    phase: "preview-target" | "drop",
  ): ConnectorResolvedHit | null {
    const hits: ConnectorResolvedHit[] = [];
    for (const connector of registeredConnectors(this.engine)) {
      if (
        connector.engine !== this.engine ||
        !this.canConnectToConnector(connector)
      ) {
        continue;
      }

      for (const [
        strategyIndex,
        strategy,
      ] of connector.surfaceStrategies.entries()) {
        const hit = normalizeHit(
          strategy.targetHitTest?.({
            connector,
            position,
            geometry: connector.geometry,
            phase,
          }),
        );
        if (hit) {
          hits.push({
            candidate: { connector, hit },
            strategy,
            strategyIndex,
          });
        }
      }

      if (connector.#hasOrdinaryPortGeometry()) {
        const center = connector.center;
        const distance = Math.hypot(
          center.x - position.x,
          center.y - position.y,
        );
        if (distance <= (connector.#config.colliderRadius ?? 30)) {
          hits.push({
            candidate: {
              connector,
              hit: { anchor: center, distance },
            },
            strategy: connector.#defaultAnchorStrategy(),
            strategyIndex: Number.MAX_SAFE_INTEGER,
          });
        }
      }
    }
    return pickResolvedHit(hits);
  }

  #setCandidate(candidate: ConnectorResolvedHit | null): void {
    const previous = this.#candidate;
    if (
      previous?.candidate.connector === candidate?.candidate.connector &&
      previous?.strategy === candidate?.strategy &&
      previous?.candidate.hit.anchor.x === candidate?.candidate.hit.anchor.x &&
      previous?.candidate.hit.anchor.y === candidate?.candidate.hit.anchor.y &&
      previous?.candidate.hit.payload === candidate?.candidate.hit.payload &&
      previous?.candidate.hit.distance === candidate?.candidate.hit.distance &&
      previous?.candidate.hit.priority === candidate?.candidate.hit.priority
    ) {
      return;
    }
    this.#candidate = candidate;
    this.#targetConnector = candidate?.candidate.connector ?? null;
    this.#dragLine?.setCandidate(
      candidate?.candidate ?? null,
      candidate?.strategy ?? null,
    );
    this.#callbacks.onCandidateChange?.({
      source: this,
      candidate: candidate?.candidate.connector ?? null,
      resolvedCandidate: candidate?.candidate ?? null,
      line: this.#dragLine,
    });
  }

  #detachLineForReconnect(line: LineComponent): void {
    const target = line.target;
    if (!target) return;
    target.#incomingLines = target.#incomingLines.filter(
      (incomingLine) => incomingLine !== line,
    );
    line.target = null;
    this.#emitDisconnect(target, line, "gesture");
  }

  #discardDraggedLine(
    line: LineComponent,
    prop: dragEndProp,
    connected: boolean,
  ): void {
    const index = this.#outgoingLines.indexOf(line);
    if (index !== -1) this.deleteLine(index, "gesture");
    this.#callbacks.onDragEnd?.({
      connector: this,
      position: prop.end,
      pointerId: prop.pointerId,
      connected,
    });
    this.#resetGesture();
  }

  #resetGesture(): void {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    if (this.#armed) {
      this.#cancelledPointers.delete(this.#armed.pointerId);
    }
    this.#state = ConnectorState.IDLE;
    this.#armed = null;
    this.#dragLine = null;
    this.#setCandidate(null);
  }

  #defaultAnchorStrategy(): ConnectorSurfaceStrategy | null {
    return (
      this.surfaceStrategies.find(
        (strategy) => strategy.resolveAnchor != null,
      ) ?? null
    );
  }

  #syncSourceSurfaceRegistration(): void {
    const sourceSurfaces = getSourceSurfaces(this.global);
    const index = sourceSurfaces.indexOf(this);
    const shouldRegister =
      this.#capabilities.source &&
      this.surfaceStrategies.some((strategy) => strategy.sourceHitTest);
    if (shouldRegister && index === -1) {
      sourceSurfaces.push(this);
    } else if (!shouldRegister && index !== -1) {
      sourceSurfaces.splice(index, 1);
    }
  }

  #removeSourceSurfaceRegistration(): void {
    const sourceSurfaces = getSourceSurfaces(this.global);
    const index = sourceSurfaces.indexOf(this);
    if (index !== -1) sourceSurfaces.splice(index, 1);
  }

  #hasOrdinaryPortGeometry(): boolean {
    return this.element != null || this.#hasMeasuredCenter;
  }

  #liveIncomingLines(): LineComponent[] {
    return this.#incomingLines.filter((line) => !line.isDeleteRequested);
  }

  #emitConnect(
    target: ConnectorComponent,
    line: LineComponent,
    origin: ConnectionOrigin,
  ): void {
    this.#callbacks.onConnect?.({
      source: this,
      target,
      connector: this,
      peer: target,
      line,
      role: "source",
      origin,
    });
    target.#callbacks.onConnect?.({
      source: this,
      target,
      connector: target,
      peer: this,
      line,
      role: "target",
      origin,
    });
    getNodeManager(this.engine).edgeSync?.notifyConnect({
      source: this,
      target,
      connector: this,
      peer: target,
      line,
      role: "source",
      origin,
    });
  }

  #emitDisconnect(
    target: ConnectorComponent,
    line: LineComponent,
    reason: DisconnectReason,
  ): void {
    this.#callbacks.onDisconnect?.({
      source: this,
      target,
      connector: this,
      peer: target,
      line,
      role: "source",
      reason,
    });
    target.#callbacks.onDisconnect?.({
      source: this,
      target,
      connector: target,
      peer: this,
      line,
      role: "target",
      reason,
    });
    getNodeManager(this.engine).edgeSync?.notifyDisconnect({
      source: this,
      target,
      connector: this,
      peer: target,
      line,
      role: "source",
      reason,
    });
  }
}

function resolveCapabilities(config: ConnectorConfig): ConnectorCapabilities {
  const legacyMaxIncoming = config.maxConnectors ?? 1;
  const legacySource = config.allowDragOut ?? false;
  return {
    source: config.capabilities?.source ?? legacySource,
    target:
      config.capabilities?.target ?? (!legacySource && legacyMaxIncoming !== 0),
    maxIncoming: config.capabilities?.maxIncoming ?? legacyMaxIncoming,
    reconnect: config.capabilities?.reconnect ?? true,
    allowParallel: config.capabilities?.allowParallel ?? false,
  };
}

function normalizeHit(
  hit: ConnectorHit | null | false | void,
): ConnectorHit | null {
  if (!hit || !isFinitePoint(hit.anchor) || !Number.isFinite(hit.distance)) {
    return null;
  }
  return {
    ...hit,
    anchor: cloneAnchor(hit.anchor),
  };
}

function isFinitePoint(point: ConnectorPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function cloneAnchor(anchor: ConnectorAnchor): ConnectorAnchor {
  return {
    x: anchor.x,
    y: anchor.y,
    ...(anchor.normal
      ? { normal: { x: anchor.normal.x, y: anchor.normal.y } }
      : {}),
  };
}

function asEventPosition(position: ConnectorPoint): eventPosition {
  const value = position as Partial<eventPosition>;
  return {
    x: position.x,
    y: position.y,
    cameraX: value.cameraX ?? position.x,
    cameraY: value.cameraY ?? position.y,
    screenX: value.screenX ?? position.x,
    screenY: value.screenY ?? position.y,
  };
}

function compareResolvedHits(
  a: ConnectorResolvedHit,
  b: ConnectorResolvedHit,
): number {
  const priority =
    (b.candidate.hit.priority ?? 0) - (a.candidate.hit.priority ?? 0);
  if (priority !== 0) return priority;
  const distance = a.candidate.hit.distance - b.candidate.hit.distance;
  if (distance !== 0) return distance;
  const connectorOrder = a.candidate.connector.id.localeCompare(
    b.candidate.connector.id,
  );
  if (connectorOrder !== 0) return connectorOrder;
  return a.strategyIndex - b.strategyIndex;
}

function pickResolvedHit(
  hits: ConnectorResolvedHit[],
): ConnectorResolvedHit | null {
  hits.sort(compareResolvedHits);
  return hits[0] ?? null;
}

export function resolveConnectorSourceAtPoint(
  engine: any,
  position: eventPosition,
  node?: NodeComponent,
): ConnectorResolvedHit | null {
  const hits: ConnectorResolvedHit[] = [];
  for (const surface of getSourceSurfaces(engine.global)) {
    const connector = surface as ConnectorComponent;
    if (
      connector.engine !== engine ||
      (node && connector.parent !== node) ||
      !connector.capabilities.source
    ) {
      continue;
    }
    const resolved = connector.resolveSourceHit(position);
    if (resolved) hits.push(resolved);
  }
  return pickResolvedHit(hits);
}

function registeredConnectors(engine: any): ConnectorComponent[] {
  const objectTable = engine.global?.getEngineObjectTable?.(engine);
  if (!objectTable) return [];
  return Object.values(objectTable).filter(
    (object): object is ConnectorComponent =>
      object instanceof ConnectorComponent && !object.isDeleteRequested,
  );
}

export { ConnectorComponent };
