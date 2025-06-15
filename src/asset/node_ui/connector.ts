import { ElementObject, frameStats, BaseObject } from "../../object";
import { NodeComponent } from "./node";
import { LineComponent } from "./line";
import { pointerDownProp, dragProp, dragEndProp } from "../../input";
import { Collider } from "../../collision";
import { CircleCollider, PointCollider } from "../../collision";
import { GlobalManager } from "../../global";

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

class ConnectorComponent extends ElementObject {
  declare parent: NodeComponent;
  config: ConnectorConfig;
  name: string;
  prop: { [key: string]: any };
  outgoingLines: LineComponent[];
  incomingLines: LineComponent[];
  _state: ConnectorState = ConnectorState.IDLE;

  _hitCircle: CircleCollider;
  _mouseHitBox: PointCollider;

  _targetConnector: ConnectorComponent | null = null;

  _mousedownX: number = 0;
  _mousedownY: number = 0;

  constructor(
    global: GlobalManager,
    parent: NodeComponent,
    config: ConnectorConfig = {},
  ) {
    super(global, parent as unknown as BaseObject);

    this.prop = {};
    this.outgoingLines = [];
    this.incomingLines = [];
    this.config = config;
    this.name = config.name || this.gid || "";
    this.event.input.pointerDown = this.onCursorDown;

    this._hitCircle = new CircleCollider(global, this, 0, 0, 30);
    this.addCollider(this._hitCircle);

    this._mouseHitBox = new PointCollider(global, this, 0, 0);
    this.addCollider(this._mouseHitBox);

    this._targetConnector = null;
    this._mousedownX = 0;
    this._mousedownY = 0;
    this.transformMode = "none";
  }

  onCursorDown(prop: pointerDownProp): void {
    const currentIncomingLines = this.incomingLines.filter(
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
    if (this.config.allowDragOut) {
      console.debug("Starting drag out line");
      this.startDragOutLine(prop);
    }
  }

  deleteLine(i: number): LineComponent | null {
    console.debug(`Deleting line ${this.gid} at index ${i}`);
    if (this.outgoingLines.length == 0) {
      return null;
    }

    const line = this.outgoingLines[i];
    line.destroy();
    this.outgoingLines.splice(i, 1);
    return line;
  }

  deleteAllLines() {
    for (const line of this.outgoingLines) {
      line.destroy();
    }
  }

  updateAllLines() {
    this.calculateTransformFromLocal();

    for (const line of [...this.outgoingLines, ...this.incomingLines]) {
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
    parent_ref._prop[this.name] = null;
    this.prop = parent_ref._prop;
    parent_ref._connectors[this.name] = this;
    this.outgoingLines = [];
    this.incomingLines = [];
    if (parent_ref.global && this.global == null) {
      this.global = parent_ref.global;
    }
  }

  createLine(): LineComponent {
    let line: LineComponent;
    if (this.config.lineClass) {
      line = new this.config.lineClass(this.global, this);
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

    this.outgoingLines.unshift(newLine);

    this.parent.updateNodeLines();
    this.parent.updateNodeLineList();

    this._state = ConnectorState.DRAGGING;
    this._targetConnector = null;
    // this.event.input.drag = null;
    this.event.input.drag = this.runDragOutLine;
    // this.globalInput.pointerUp = this.endDragOutLine;
    this.event.input.dragEnd = this.endDragOutLine;

    this._mouseHitBox.event.collider.onCollide = (
      _: Collider,
      __: Collider,
    ) => {
      // console.log("onCollide", this.gid);
      this.findClosestConnector();
    };
    this._mouseHitBox.event.collider.onEndContact = (
      _: Collider,
      otherObject: Collider,
    ) => {
      if (this._targetConnector?.gid == otherObject.parent.gid) {
        this._targetConnector = null;
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
      this._mouseHitBox._currentCollisions,
    ).filter((c) => c.parent instanceof ConnectorComponent);
    let connectors: Array<ConnectorComponent> = connectorCollider
      .map((c) => c.parent as ConnectorComponent)
      .sort((a, b) => {
        let da = Math.sqrt(
          Math.pow(a.transform.x - this._mouseHitBox.transform.x, 2) +
            Math.pow(a.transform.y - this._mouseHitBox.transform.y, 2),
        );
        let db = Math.sqrt(
          Math.pow(b.transform.x - this._mouseHitBox.transform.x, 2) +
            Math.pow(b.transform.y - this._mouseHitBox.transform.y, 2),
        );
        return da - db;
      });
    if (connectors.length > 0) {
      this._targetConnector = connectors[0];
    } else {
      this._targetConnector = null;
    }
  }

  runDragOutLine(prop: dragProp) {
    console.debug(`Running drag out line ${this.gid}`);
    if (this._state != ConnectorState.DRAGGING) {
      return;
    }

    if (this.outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    this._mouseHitBox.transform.x = prop.position.x - this.transform.x;
    this._mouseHitBox.transform.y = prop.position.y - this.transform.y;

    let line = this.outgoingLines[0];

    if (this._targetConnector) {
      const result = this.hoverWhileDragging(this._targetConnector);
      if (result) {
        line.setLineEnd(result[0], result[1]);
        line.setLineStartAtConnector();
        line.requestTransform("WRITE_2");
        return;
      }
    }
    // console.log(prop.position.x, prop.position.y);
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
    const connectorX = targetConnector.transform.x;
    const connectorY = targetConnector.transform.y;

    return [connectorX, connectorY];
  }

  endDragOutLine(_: dragEndProp) {
    console.debug(`Ending drag out line ${this.gid}`);
    this.inputEngine.resetDragMembers();
    if (
      this._targetConnector &&
      this._targetConnector instanceof ConnectorComponent
    ) {
      console.debug(`Connecting ${this.gid} to ${this._targetConnector.gid}`);
      const target = this._targetConnector;
      if (target == null) {
        console.error(`Error: target is null`);
        this._endLineDragCleanup();
        return;
      }
      if (this.connectToConnector(target, this.outgoingLines[0]) == false) {
        this._endLineDragCleanup();
        this.deleteLine(0);
        return;
      }

      target.prop[target.name] = this.prop[this.name];

      this.outgoingLines[0].setLineEnd(target.transform.x, target.transform.y);
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
    this._state = ConnectorState.IDLE;
    this.event.global.pointerMove = null;
    this.event.global.pointerUp = null;
    this.parent.updateNodeLineList();
    this._targetConnector = null;
    this._mouseHitBox.event.collider.onBeginContact = null;
    this._mouseHitBox.event.collider.onEndContact = null;
    this._mouseHitBox.transform.x = 0;
    this._mouseHitBox.transform.y = 0;
  }

  startPickUpLine(line: LineComponent, prop: pointerDownProp) {
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    line.start.deleteLine(line.start.outgoingLines.indexOf(line));
    this.inputEngine.resetDragMembers();
    this.inputEngine.addDragMember(line.start.inputEngine);
    line.start._targetConnector = this;
    line.start.startDragOutLine(prop);
    this._state = ConnectorState.DRAGGING;
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
      this.outgoingLines.unshift(line);
    }

    this.calculateLocalFromTransform();
    line.target = connector;
    connector.incomingLines.push(line);

    return true;
  }

  disconnectFromConnector(connector: ConnectorComponent) {
    console.debug(`Disconnecting ${this.gid} from connector ${connector.gid}`);
    for (const line of this.outgoingLines) {
      if (line.target == connector) {
        line._requestDelete = true;
        break;
      }
    }
  }
}

export { ConnectorComponent };
