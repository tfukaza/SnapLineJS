import { ElementObject, BaseObject } from "@snap-engine/core";
import { NodeComponent } from "./node";
import { LineComponent } from "./line";
import type { pointerDownProp, dragProp, dragEndProp } from "@snap-engine/core";
import type { eventPosition } from "@snap-engine/core";
import {
  Collider,
  CircleCollider,
  PointCollider,
} from "@snap-engine/core/collision";
export type SnapLineMetadata = Record<string, unknown>;
export type ConnectionOrigin = "gesture" | "programmatic";
export type DisconnectReason =
  | "gesture"
  | "replacement"
  | "programmatic"
  | "teardown";
export type ConnectorRole = "source" | "target";

export interface ConnectorPairEvent {
  source: ConnectorComponent;
  target: ConnectorComponent;
}

export interface ConnectorCandidateEvent {
  source: ConnectorComponent;
  candidate: ConnectorComponent | null;
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

export interface ConnectorCallbacks {
  canConnect?: (event: ConnectorPairEvent) => boolean;
  onDragStart?: (event: ConnectorDragEvent) => void;
  onCandidateChange?: (event: ConnectorCandidateEvent) => void;
  onConnect?: (event: ConnectorConnectionEvent) => void;
  onDisconnect?: (event: ConnectorDisconnectionEvent) => void;
  onDragEnd?: (event: ConnectorDragEvent & { connected: boolean }) => void;
}

enum ConnectorState {
  IDLE,
  DRAGGING,
}

export interface ConnectorConfig {
  name?: string;
  maxConnectors?: number;
  allowDragOut?: boolean;
  lineClass?: typeof LineComponent;
  colliderRadius?: number;
  metadata?: SnapLineMetadata;
  callbacks?: ConnectorCallbacks;
  /** Allows this connector gesture to use the engine's configured edge pan. */
  edgePan?: boolean;
}

class ConnectorComponent extends ElementObject {
  #config: ConnectorConfig;
  #name: string;
  #prop: { [key: string]: any };
  #outgoingLines: LineComponent[];
  #incomingLines: LineComponent[];
  #state: ConnectorState = ConnectorState.IDLE;

  #hitCircle: CircleCollider;
  #mouseHitBox: PointCollider;

  #targetConnector: ConnectorComponent | null = null;
  #edgePanPointerId: number | null = null;
  #localCenter: { x: number; y: number };
  #hasMeasuredCenter = false;

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
    this.#config = config;
    this.#name = config.name || this.id || "";
    this.event.input.pointerDown = this.onCursorDown;

    this.#hitCircle = new CircleCollider(
      engine,
      this,
      0,
      0,
      config.colliderRadius ?? 30,
    );
    this.addCollider(this.#hitCircle);

    this.#mouseHitBox = new PointCollider(engine, this, 0, 0);
    this.addCollider(this.#mouseHitBox);

    this.#targetConnector = null;
    this.#localCenter = { x: 0, y: 0 };
    this.transformMode = "none";

    // Center colliders on the connector element once DOM is assigned
    this.event.dom.onAssignDom = () => {
      this.schedule(
        () => {
          this.measureLocalCenter("READ_1");
        },
        { stage: "READ_1" },
      );
    };

    this.#callbacks = config.callbacks ?? {};
  }

  get name(): string {
    return this.#name;
  }

  get config(): ConnectorConfig {
    return this.#config;
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
    this.#callbacks = callbacks;
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
    this.setCandidate(value);
  }

  get numIncomingLines(): number {
    return this.#incomingLines.length;
  }

  get numOutgoingLines(): number {
    return this.#outgoingLines.length;
  }

  private setCandidate(candidate: ConnectorComponent | null): void {
    if (candidate === this.#targetConnector) return;
    this.#targetConnector = candidate;
    this.#callbacks.onCandidateChange?.({ source: this, candidate });
  }

  #emitConnect(
    target: ConnectorComponent,
    line: LineComponent,
    origin: ConnectionOrigin,
  ): void {
    this.#callbacks.onConnect?.({
      source: this, target, connector: this, peer: target, line,
      role: "source", origin,
    });
    target.#callbacks.onConnect?.({
      source: this, target, connector: target, peer: this, line,
      role: "target", origin,
    });
  }

  #emitDisconnect(
    target: ConnectorComponent,
    line: LineComponent,
    reason: DisconnectReason,
  ): void {
    this.#callbacks.onDisconnect?.({
      source: this, target, connector: this, peer: target, line,
      role: "source", reason,
    });
    target.#callbacks.onDisconnect?.({
      source: this, target, connector: target, peer: this, line,
      role: "target", reason,
    });
  }

  get center(): { x: number; y: number } {
    if (this.#hasMeasuredCenter && this.parent) {
      const parentTransform = this.parent.worldTransform;
      return {
        x: parentTransform.x + this.#localCenter.x * parentTransform.scaleX,
        y: parentTransform.y + this.#localCenter.y * parentTransform.scaleY,
      };
    }

    return this.measureDomCenter();
  }

  measureDomCenter(): { x: number; y: number } {
    if (!this.element) {
      const prop = this.getDomProperty("READ_1");
      return {
        x: prop.x + prop.width / 2,
        y: prop.y + prop.height / 2,
      };
    }

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

    return {
      x: screenX,
      y: screenY,
    };
  }

  measureLocalCenter(stage: "READ_1" | "READ_2" | "READ_3" | null = null) {
    if (!this.element || !this.parent) {
      return;
    }

    const prop = this.readDom({ unapplyTransform: false }, stage);
    const parentTransform = this.parent.worldTransform;
    const scaleX = parentTransform.scaleX === 0 ? 1 : parentTransform.scaleX;
    const scaleY = parentTransform.scaleY === 0 ? 1 : parentTransform.scaleY;
    const localLeft = (prop.x - parentTransform.x) / scaleX;
    const localTop = (prop.y - parentTransform.y) / scaleY;
    const localCenterX = (prop.x + prop.width / 2 - parentTransform.x) / scaleX;
    const localCenterY = (prop.y + prop.height / 2 - parentTransform.y) / scaleY;

    this.localTransform = { x: localLeft, y: localTop };
    this.#localCenter = { x: localCenterX, y: localCenterY };
    this.#hasMeasuredCenter = true;
    this.#hitCircle.localTransform = {
      x: localCenterX - localLeft,
      y: localCenterY - localTop,
    };
    this.#mouseHitBox.localTransform = {
      x: localCenterX - localLeft,
      y: localCenterY - localTop,
    };
  }

  /**
   * Request a deferred remeasurement after an external system changes this
   * connector's painted DOM position. Calls coalesce within the engine frame.
   */
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
    const currentIncomingLines = this.#incomingLines.filter(
      (i) => !i.isDeleteRequested,
    );
    // Skip if it's not a left click
    if (prop.event.button != 0) {
      return;
    }
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0], prop);
      return;
    }
    if (this.#config.allowDragOut) {
      this.startDragOutLine(prop);
    }
  }

  deleteLine(
    i: number,
    reason: DisconnectReason = "programmatic",
  ): LineComponent | null {
    if (this.#outgoingLines.length == 0 || i < 0) {
      return null;
    }

    const line = this.#outgoingLines[i];
    if (!line) {
      return null;
    }
    const target = line.target;
    if (target) {
      target.#incomingLines = target.#incomingLines.filter(
        (incomingLine) => incomingLine !== line,
      );
      this.#emitDisconnect(target, line, reason);
    }
    line.destroy();
    this.#outgoingLines.splice(i, 1);
    if (this.parent) {
      this.parent.updateNodeLineList();
    }
    return line;
  }

  deleteAllLines(reason: DisconnectReason = "programmatic") {
    for (const line of [...this.#outgoingLines]) {
      this.deleteLine(this.#outgoingLines.indexOf(line), reason);
    }
    for (const line of [...this.#incomingLines]) {
      line.start.deleteLine(line.start.outgoingLines.indexOf(line), reason);
    }
    this.#incomingLines = [];
  }

  /** Schedules a WRITE_2 write for every line on this connector. */
  scheduleAllLineWrites() {
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

  /** Synchronously writes every line on this connector (call inside a WRITE stage). */
  writeAllLinesNow() {
    for (const line of [...this.#outgoingLines, ...this.#incomingLines]) {
      line.moveLineToConnectorTransform();
      line.writeTransform();
    }
  }

  assignToNode(parent: NodeComponent) {
    this.parent = parent;
    let parent_ref = this.parent as NodeComponent;
    parent_ref._prop[this.#name] = null;
    this.#prop = parent_ref._prop;
    parent_ref._connectors[this.#name] = this;
    this.#outgoingLines = [];
    this.#incomingLines = [];
    if (parent_ref.global && this.global == null) {
      this.global = parent_ref.global;
    }
  }

  createLine(): LineComponent {
    let line: LineComponent;
    if (this.#config.lineClass) {
      line = new this.#config.lineClass(this.engine, this);
    } else {
      line = new LineComponent(this.engine, this);
    }
    return line;
  }

  startDragOutLine(prop: pointerDownProp): void {
    // Claim the pointer while dragging a connection, mirroring node drags:
    // without this, drawing a line under a Camera also pans the canvas. The
    // claim auto-releases when the gesture ends.
    this.engine.input.claimPointer(prop.event.pointerId);

    let newLine = this.createLine();
    newLine.setLineEnd(prop.position.x, prop.position.y);
    newLine.setLineStartAtConnector();

    this.#outgoingLines.unshift(newLine);

    this.parent.scheduleLineWrites();
    this.parent.updateNodeLineList();

    this.#state = ConnectorState.DRAGGING;
    this.setCandidate(null);
    // this.event.input.drag = null;
    this.event.input.drag = this.runDragOutLine;
    // this.globalInput.pointerUp = this.endDragOutLine;
    this.event.input.dragEnd = this.endDragOutLine;
    this.#callbacks.onDragStart?.({
      connector: this,
      position: prop.position,
      pointerId: prop.event.pointerId,
    });

    this.#mouseHitBox.event.collider.onCollide = (
      _: Collider,
      __: Collider,
    ) => {
      // console.log("onCollide", this.id);
      this.findClosestConnector();
    };
    this.#mouseHitBox.event.collider.onEndContact = (
      _: Collider,
      otherObject: Collider,
    ) => {
      if (this.#targetConnector?.id == otherObject.parent.id) {
        this.setCandidate(null);
      }
    };

    this.runDragOutLine({
      position: prop.position,
      start: {
        x: this.worldTransform.x,
        y: this.worldTransform.y,
      },
      delta: {
        x: prop.position.x - this.worldTransform.x,
        y: prop.position.y - this.worldTransform.y,
      },
    } as dragProp);
  }

  findClosestConnector() {
    let connectorCollider: Array<Collider> = Array.from(
      this.#mouseHitBox.currentCollisions,
    ).filter((c) => c.parent instanceof ConnectorComponent);
    let connectors: Array<ConnectorComponent> = connectorCollider
      .map((c) => c.parent as ConnectorComponent)
      .sort((a, b) => {
        const centerA = a.center;
        const centerB = b.center;
        const mouseWorld = this.#mouseHitBox.worldTransform;
        const [mouseX, mouseY] = [mouseWorld.x, mouseWorld.y];
        let da = Math.sqrt(
          Math.pow(centerA.x - mouseX, 2) + Math.pow(centerA.y - mouseY, 2),
        );
        let db = Math.sqrt(
          Math.pow(centerB.x - mouseX, 2) + Math.pow(centerB.y - mouseY, 2),
        );
        return da - db;
      });
    if (connectors.length > 0) {
      this.setCandidate(connectors[0] ?? null);
    } else {
      this.setCandidate(null);
    }
  }

  findClosestConnectorAtPoint(
    position: { x: number; y: number },
  ): ConnectorComponent | null {
    const objectTable = this.global.getEngineObjectTable(this.engine);
    const connectors = Object.values(objectTable)
      .filter((object): object is ConnectorComponent => {
        return object instanceof ConnectorComponent && object.id !== this.id;
      })
      .filter((connector) => this.canConnectToConnector(connector));

    let closestConnector: ConnectorComponent | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const connector of connectors) {
      const center = connector.center;
      const distance = Math.hypot(center.x - position.x, center.y - position.y);
      const hitRadius = connector.config.colliderRadius ?? 30;
      if (distance <= hitRadius && distance < closestDistance) {
        closestConnector = connector;
        closestDistance = distance;
      }
    }
    return closestConnector;
  }

  canConnectToConnector(connector: ConnectorComponent): boolean {
    if (connector.id === this.id || connector.config.allowDragOut) {
      return false;
    }

    const currentIncomingLines = connector.incomingLines.filter(
      (i) => !i.isDeleteRequested,
    );
    if (currentIncomingLines.some((i) => i.start == this)) {
      return false;
    }

    const maxConnectors = connector.config.maxConnectors ?? 1;
    if (maxConnectors === 0) return false;
    const event = { source: this, target: connector };
    return (
      this.#callbacks.canConnect?.(event) !== false &&
      connector.#callbacks.canConnect?.(event) !== false
    );
  }

  runDragOutLine(prop: dragProp) {
    if (this.#state != ConnectorState.DRAGGING) {
      return;
    }

    if (this.#outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    if (this.#config.edgePan !== false && typeof prop.pointerId === "number") {
      const controller = this.engine.edgePanController;
      if (this.#edgePanPointerId == null) {
        this.#edgePanPointerId = prop.pointerId;
        controller?.startEdgePan(
          prop.pointerId,
          prop.position,
          (position) => this.#moveDraggedLine(position),
        );
      } else {
        controller?.updateEdgePan(prop.pointerId, prop.position);
      }
    }

    this.#moveDraggedLine(prop.position);
  }

  #moveDraggedLine(position: eventPosition): void {
    if (
      this.#state != ConnectorState.DRAGGING ||
      this.#outgoingLines.length === 0
    ) {
      return;
    }

    this.#mouseHitBox.worldTransform = {
      x: position.x,
      y: position.y,
    };
    this.setCandidate(this.findClosestConnectorAtPoint(position));

    let line = this.#outgoingLines[0];

    if (this.#targetConnector) {
      const result = this.hoverWhileDragging(this.#targetConnector);
      if (result) {
        line.setLineEnd(result[0], result[1]);
        line.setLineStartAtConnector();
        line.schedule(() => line.writeTransform(), {
          stage: "WRITE_2",
          queueId: `${line.id}-transform`,
        });
        return;
      }
    }
    line.setLineEnd(position.x, position.y);
    line.setLineStartAtConnector();
    this.parent.scheduleLineWrites();
  }

  hoverWhileDragging(
    targetConnector: ConnectorComponent,
  ): [number, number] | void {
    if (!(targetConnector instanceof ConnectorComponent)) {
      return;
    }
    if (targetConnector == null) {
      return;
    }
    if (targetConnector.id == this.id) {
      return;
    }
    const connectorCenter = targetConnector.center;

    return [connectorCenter.x, connectorCenter.y];
  }

  endDragOutLine(prop: dragEndProp) {
    this.setCandidate(this.findClosestConnectorAtPoint(prop.end));
    let connected = false;
    if (
      this.#targetConnector &&
      this.#targetConnector instanceof ConnectorComponent
    ) {
      const target = this.#targetConnector;
      if (target == null) {
        console.error(`Error: target is null`);
        this._endLineDragCleanup();
        return;
      }
      if (
        this.connectToConnector({
          target,
          line: this.#outgoingLines[0],
          origin: "gesture",
        }) == false
      ) {
        this._endLineDragCleanup();
        this.deleteLine(0, "gesture");
        this.#callbacks.onDragEnd?.({
          connector: this,
          position: prop.end,
          pointerId: prop.pointerId,
          connected: false,
        });
        return;
      }

      target.#prop[target.#name] = this.#prop[this.#name];

      this.#outgoingLines[0].setLineEndAtConnector();
      connected = true;
    } else {
      this.deleteLine(0, "gesture");
    }
    if (this.parent) {
      this.parent.scheduleLineWrites();
    }

    this.#callbacks.onDragEnd?.({
      connector: this,
      position: prop.end,
      pointerId: prop.pointerId,
      connected,
    });
    this._endLineDragCleanup();
  }

  _endLineDragCleanup() {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    this.#state = ConnectorState.IDLE;
    this.event.input.drag = null;
    this.event.input.dragEnd = null;
    this.parent.updateNodeLineList();
    this.setCandidate(null);
    this.#mouseHitBox.event.collider.onCollide = null;
    this.#mouseHitBox.event.collider.onEndContact = null;
    this.#mouseHitBox.localTransform = { x: 0, y: 0 };
  }

  startPickUpLine(line: LineComponent, prop: pointerDownProp) {
    const startConnector = line.start;
    startConnector.disconnectFromConnector(this, "gesture");
    this.engine?.input.setPointerDragOwner(prop.event.pointerId, startConnector);
    startConnector.targetConnector = this;
    startConnector.startDragOutLine(prop);
    this.#state = ConnectorState.DRAGGING;
  }

  connectToConnector({
    target,
    line = null,
    origin = "programmatic",
  }: {
    target: ConnectorComponent;
    line?: LineComponent | null;
    origin?: ConnectionOrigin;
  }): boolean {
    if (!this.canConnectToConnector(target)) {
      return false;
    }

    const maxConnectors = target.config.maxConnectors ?? 1;
    if (maxConnectors > 0) {
      const currentIncomingLines = target.incomingLines.filter(
        (incomingLine) => !incomingLine.isDeleteRequested,
      );
      const removeCount = Math.max(
        0,
        currentIncomingLines.length - maxConnectors + 1,
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
    }

    line.target = target;
    if (!target.incomingLines.includes(line)) {
      target.incomingLines.push(line);
    }
    line.setLineStartAtConnector();
    line.setLineEndAtConnector();

    this.parent.updateNodeLineList();

    this.#emitConnect(target, line, origin);
    this.parent.setProp(this.#name, this.#prop[this.#name]);

    return true;
  }

  disconnectFromConnector(
    connector: ConnectorComponent,
    reason: DisconnectReason = "programmatic",
  ) {
    const lineIndex = this.#outgoingLines.findIndex(
      (line) => line.target == connector,
    );
    if (lineIndex !== -1) {
      this.deleteLine(lineIndex, reason);
    }
  }

  destroy() {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    this.deleteAllLines("teardown");
    if (this.parent?._connectors[this.#name] === this) {
      delete this.parent._connectors[this.#name];
    }
    super.destroy();
  }
}

export { ConnectorComponent };
