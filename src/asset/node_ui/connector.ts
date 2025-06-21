import { ElementObject, frameStats, BaseObject } from "../../object";
import { NodeComponent } from "./node";
import { LineComponent } from "./line";
import { pointerDownProp, dragProp, dragEndProp } from "../../input";
import { Collider } from "../../collision";
import { CircleCollider, PointCollider } from "../../collision";
import { GlobalManager } from "../../global";
import { EventProxyFactory } from "../../util";

enum ConnectorState {
  IDLE,
  DRAGGING,
}

export interface ConnectorConfig {
  name?: string;
  maxConnectors?: number;
  allowDragOut?: boolean;
  lineClass?: typeof LineComponent;
}

interface ConnectorCallback {
  onConnectOutgoing: null | ((connector: ConnectorComponent) => void);
  onConnectIncoming: null | ((connector: ConnectorComponent) => void);
  onDisconnectOutgoing: null | ((connector: ConnectorComponent) => void);
  onDisconnectIncoming: null | ((connector: ConnectorComponent) => void);
}

class ConnectorComponent extends ElementObject {
  declare parent: NodeComponent;
  #config: ConnectorConfig;
  #name: string;
  #prop: { [key: string]: any };
  #outgoingLines: LineComponent[];
  #incomingLines: LineComponent[];
  #state: ConnectorState = ConnectorState.IDLE;

  #hitCircle: CircleCollider;
  #mouseHitBox: PointCollider;

  #targetConnector: ConnectorComponent | null = null;

  #connectorCallback: ConnectorCallback | null = null;

  constructor(
    global: GlobalManager,
    parent: NodeComponent,
    config: ConnectorConfig = {},
  ) {
    super(global, parent as unknown as BaseObject);

    this.#prop = {};
    this.#outgoingLines = [];
    this.#incomingLines = [];
    this.#config = config;
    this.#name = config.name || this.gid || "";
    this.event.input.pointerDown = this.onCursorDown;

    this.#hitCircle = new CircleCollider(global, this, 0, 0, 30);
    this.addCollider(this.#hitCircle);

    this.#mouseHitBox = new PointCollider(global, this, 0, 0);
    this.addCollider(this.#mouseHitBox);

    this.#targetConnector = null;
    this.transformMode = "none";

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
    const prop = this.getDomProperty("READ_1");
    return {
      x: this.transform.x + prop.width / 2,
      y: this.transform.y + prop.height / 2,
    };
  }

  get connectorCallback(): ConnectorCallback {
    return this.#connectorCallback!;
  }

  onCursorDown(prop: pointerDownProp): void {
    const currentIncomingLines = this.#incomingLines.filter(
      (i) => !i._requestDelete,
    );
    // Skip if it's not a left click
    if (prop.event.button != 0) {
      return;
    }
    this.inputEngine.resetDragMembers();
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0], prop);
      return;
    }
    if (this.#config.allowDragOut) {
      console.debug("Starting drag out line");
      this.startDragOutLine(prop);
    }
  }

  deleteLine(i: number): LineComponent | null {
    console.debug(`Deleting line ${this.gid} at index ${i}`);
    if (this.#outgoingLines.length == 0) {
      return null;
    }

    const line = this.#outgoingLines[i];
    line.destroy();
    this.#outgoingLines.splice(i, 1);
    return line;
  }

  deleteAllLines() {
    for (const line of this.#outgoingLines) {
      line.destroy();
    }
  }

  updateAllLines() {
    this.calculateTransformFromLocal();

    for (const line of [...this.#outgoingLines, ...this.#incomingLines]) {
      line.target?.calculateTransformFromLocal();
      line.calculateLocalFromTransform();
      line.moveLineToConnectorTransform();
      line.requestTransform("WRITE_2");
    }
  }

  assignToNode(parent: NodeComponent) {
    this.parent = parent;
    parent.children.push(this);
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
      line = new this.#config.lineClass(this.global, this);
    } else {
      line = new LineComponent(this.global, this);
    }
    this.children.push(line);
    return line;
  }

  startDragOutLine(prop: pointerDownProp): void {
    let newLine = this.createLine();
    newLine.setLineEnd(prop.position.x, prop.position.y);
    newLine.setLineStartAtConnector();

    this.#outgoingLines.unshift(newLine);

    this.parent.updateNodeLines();
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
      // console.log("onCollide", this.gid);
      this.findClosestConnector();
    };
    this.#mouseHitBox.event.collider.onEndContact = (
      _: Collider,
      otherObject: Collider,
    ) => {
      if (this.#targetConnector?.gid == otherObject.parent.gid) {
        this.#targetConnector = null;
      }
    };

    this.runDragOutLine({
      position: prop.position,
      start: {
        x: this.transform.x,
        y: this.transform.y,
      },
      delta: {
        x: prop.position.x - this.transform.x,
        y: prop.position.y - this.transform.y,
      },
    } as dragProp);
  }

  findClosestConnector() {
    let connectorCollider: Array<Collider> = Array.from(
      this.#mouseHitBox._currentCollisions,
    ).filter((c) => c.parent instanceof ConnectorComponent);
    let connectors: Array<ConnectorComponent> = connectorCollider
      .map((c) => c.parent as ConnectorComponent)
      .sort((a, b) => {
        const centerA = a.center;
        const centerB = b.center;
        let da = Math.sqrt(
          Math.pow(centerA.x - this.#mouseHitBox.transform.x, 2) +
            Math.pow(centerA.y - this.#mouseHitBox.transform.y, 2),
        );
        let db = Math.sqrt(
          Math.pow(centerB.x - this.#mouseHitBox.transform.x, 2) +
            Math.pow(centerB.y - this.#mouseHitBox.transform.y, 2),
        );
        return da - db;
      });
    if (connectors.length > 0) {
      this.#targetConnector = connectors[0];
    } else {
      this.#targetConnector = null;
    }
  }

  runDragOutLine(prop: dragProp) {
    console.debug(`Running drag out line ${this.gid}`);
    if (this.#state != ConnectorState.DRAGGING) {
      return;
    }

    if (this.#outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    this.#mouseHitBox.transform.x = prop.position.x - this.transform.x;
    this.#mouseHitBox.transform.y = prop.position.y - this.transform.y;

    let line = this.#outgoingLines[0];

    if (this.#targetConnector) {
      const result = this.hoverWhileDragging(this.#targetConnector);
      if (result) {
        line.setLineEnd(result[0], result[1]);
        line.setLineStartAtConnector();
        line.requestTransform("WRITE_2");
        return;
      }
    }
    line.setLineEnd(prop.position.x, prop.position.y);
    line.setLineStartAtConnector();
    this.parent.updateNodeLines();
  }

  hoverWhileDragging(
    targetConnector: ConnectorComponent,
  ): [number, number] | void {
    if (!(targetConnector instanceof ConnectorComponent)) {
      return;
    }
    if (targetConnector == null) {
      console.debug(`Error: targetConnector is null`);
      return;
    }
    if (targetConnector.gid == this.gid) {
      return;
    }
    const connectorCenter = targetConnector.center;

    return [connectorCenter.x, connectorCenter.y];
  }

  endDragOutLine(_: dragEndProp) {
    console.debug(`Ending drag out line ${this.gid}`);
    this.inputEngine.resetDragMembers();
    if (
      this.#targetConnector &&
      this.#targetConnector instanceof ConnectorComponent
    ) {
      console.debug(`Connecting ${this.gid} to ${this.#targetConnector.gid}`);
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

      this.#outgoingLines[0].setLineEnd(target.transform.x, target.transform.y);
    } else {
      console.debug(`Deleting line ${this.gid} at index 0`);
      this.deleteLine(0);
    }
    if (this.parent) {
      this.parent.updateNodeLines();
    }

    this._endLineDragCleanup();
  }

  _endLineDragCleanup() {
    this.#state = ConnectorState.IDLE;
    this.event.global.pointerMove = null;
    this.event.global.pointerUp = null;
    this.parent.updateNodeLineList();
    this.#targetConnector = null;
    this.#mouseHitBox.event.collider.onBeginContact = null;
    this.#mouseHitBox.event.collider.onEndContact = null;
    this.#mouseHitBox.transform.x = 0;
    this.#mouseHitBox.transform.y = 0;
  }

  startPickUpLine(line: LineComponent, prop: pointerDownProp) {
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    line.start.deleteLine(line.start.outgoingLines.indexOf(line));
    this.inputEngine.resetDragMembers();
    this.inputEngine.addDragMember(line.start.inputEngine);
    line.start.targetConnector = this;
    line.start.startDragOutLine(prop);
    this.#state = ConnectorState.DRAGGING;
  }

  connectToConnector(
    connector: ConnectorComponent,
    line: LineComponent | null,
  ): boolean {
    console.debug(`Connecting ${this.gid} to connector ${connector.gid}`);
    const currentIncomingLines = connector.incomingLines.filter(
      (i) => !i._requestDelete,
    );

    if (currentIncomingLines.some((i) => i.start == this)) {
      console.warn(
        `Connector ${connector} already has a line connected to this connector`,
      );
      return false;
    }

    if (connector.config.maxConnectors === currentIncomingLines.length) {
      console.warn(
        `Connector ${connector.name} already has max number of connectors (${connector.config.maxConnectors}) connected`,
      );
      return false;
    }

    if (line == null) {
      line = this.createLine();
      this.#outgoingLines.unshift(line);
    }

    this.calculateLocalFromTransform();
    line.target = connector;
    connector.incomingLines.push(line);

    this.parent.updateNodeLineList();

    this.#connectorCallback?.onConnectOutgoing?.(connector);
    connector.#connectorCallback?.onConnectIncoming?.(this);
    this.parent.setProp(this.#name, this.#prop[this.#name]);

    return true;
  }

  disconnectFromConnector(connector: ConnectorComponent) {
    console.debug(`Disconnecting ${this.gid} from connector ${connector.gid}`);
    for (const line of this.#outgoingLines) {
      if (line.target == connector) {
        line._requestDelete = true;
        break;
      }
    }
    this.#connectorCallback?.onDisconnectOutgoing?.(connector);
    connector.#connectorCallback?.onDisconnectIncoming?.(this);
  }
}

export { ConnectorComponent };
