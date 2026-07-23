import { ElementObject, BaseObject } from "@snap-engine/core";
import { NodeComponent } from "./node";
import { LineComponent } from "./line";
import type { pointerDownProp, dragProp, dragEndProp } from "@snap-engine/core";
import {
  Collider,
  CircleCollider,
  PointCollider,
} from "@snap-engine/core/collision";
import { EventProxyFactory } from "@snap-engine/core";

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
}

interface ConnectorCallback {
  onConnectOutgoing: null | ((connector: ConnectorComponent) => void);
  onConnectIncoming: null | ((connector: ConnectorComponent) => void);
  onDisconnectOutgoing: null | ((connector: ConnectorComponent) => void);
  onDisconnectIncoming: null | ((connector: ConnectorComponent) => void);
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
  #localCenter: { x: number; y: number };
  #hasMeasuredCenter = false;

  #connectorCallback: ConnectorCallback | null = null;

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

    this.#connectorCallback = {
      onConnectOutgoing: null,
      onConnectIncoming: null,
      onDisconnectOutgoing: null,
      onDisconnectIncoming: null,
    };
    this.#connectorCallback = EventProxyFactory(this, this.#connectorCallback);
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
    this.#targetConnector = value;
  }

  get numIncomingLines(): number {
    return this.#incomingLines.length;
  }

  get numOutgoingLines(): number {
    return this.#outgoingLines.length;
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

  get connectorCallback(): ConnectorCallback {
    return this.#connectorCallback!;
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

  deleteLine(i: number): LineComponent | null {
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
      this.#connectorCallback?.onDisconnectOutgoing?.(target);
      target.#connectorCallback?.onDisconnectIncoming?.(this);
    }
    line.destroy();
    this.#outgoingLines.splice(i, 1);
    if (this.parent) {
      this.parent.updateNodeLineList();
    }
    return line;
  }

  deleteAllLines() {
    for (const line of [...this.#outgoingLines]) {
      this.deleteLine(this.#outgoingLines.indexOf(line));
    }
    for (const line of [...this.#incomingLines]) {
      line.start.deleteLine(line.start.outgoingLines.indexOf(line));
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

  /** @deprecated Renamed: use `scheduleAllLineWrites` (schedules, does not write now). */
  updateAllLines() {
    this.scheduleAllLineWrites();
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
    this.#targetConnector = null;
    // this.event.input.drag = null;
    this.event.input.drag = this.runDragOutLine;
    // this.globalInput.pointerUp = this.endDragOutLine;
    this.event.input.dragEnd = this.endDragOutLine;

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
        this.#targetConnector = null;
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
      this.#targetConnector = connectors[0];
    } else {
      this.#targetConnector = null;
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
    return maxConnectors < 0 || currentIncomingLines.length < maxConnectors;
  }

  runDragOutLine(prop: dragProp) {
    if (this.#state != ConnectorState.DRAGGING) {
      return;
    }

    if (this.#outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    this.#mouseHitBox.worldTransform = {
      x: prop.position.x,
      y: prop.position.y,
    };
    this.#targetConnector = this.findClosestConnectorAtPoint(prop.position);

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
    line.setLineEnd(prop.position.x, prop.position.y);
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
    this.#targetConnector = this.findClosestConnectorAtPoint(prop.end);
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
      if (this.connectToConnector(target, this.#outgoingLines[0]) == false) {
        this._endLineDragCleanup();
        this.deleteLine(0);
        return;
      }

      target.#prop[target.#name] = this.#prop[this.#name];

      this.#outgoingLines[0].setLineEndAtConnector();
    } else {
      this.deleteLine(0);
    }
    if (this.parent) {
      this.parent.scheduleLineWrites();
    }

    this._endLineDragCleanup();
  }

  _endLineDragCleanup() {
    this.#state = ConnectorState.IDLE;
    this.event.input.drag = null;
    this.event.input.dragEnd = null;
    this.parent.updateNodeLineList();
    this.#targetConnector = null;
    this.#mouseHitBox.event.collider.onCollide = null;
    this.#mouseHitBox.event.collider.onEndContact = null;
    this.#mouseHitBox.localTransform = { x: 0, y: 0 };
  }

  startPickUpLine(line: LineComponent, prop: pointerDownProp) {
    const startConnector = line.start;
    startConnector.disconnectFromConnector(this);
    this.engine?.input.setPointerDragOwner(prop.event.pointerId, startConnector);
    startConnector.targetConnector = this;
    startConnector.startDragOutLine(prop);
    this.#state = ConnectorState.DRAGGING;
  }

  connectToConnector(
    connector: ConnectorComponent,
    line: LineComponent | null,
  ): boolean {
    if (!this.canConnectToConnector(connector)) {
      return false;
    }

    if (line == null) {
      line = this.createLine();
      this.#outgoingLines.unshift(line);
    }

    line.target = connector;
    if (!connector.incomingLines.includes(line)) {
      connector.incomingLines.push(line);
    }
    line.setLineStartAtConnector();
    line.setLineEndAtConnector();

    this.parent.updateNodeLineList();

    this.#connectorCallback?.onConnectOutgoing?.(connector);
    connector.#connectorCallback?.onConnectIncoming?.(this);
    this.parent.setProp(this.#name, this.#prop[this.#name]);

    return true;
  }

  disconnectFromConnector(connector: ConnectorComponent) {
    const lineIndex = this.#outgoingLines.findIndex(
      (line) => line.target == connector,
    );
    if (lineIndex !== -1) {
      this.deleteLine(lineIndex);
    }
  }

  destroy() {
    this.deleteAllLines();
    if (this.parent?._connectors[this.#name] === this) {
      delete this.parent._connectors[this.#name];
    }
    super.destroy();
  }
}

export { ConnectorComponent };
