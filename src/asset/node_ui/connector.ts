import { ElementObject, frameStats, BaseObject } from "@/object";
import { NodeComponent } from "./node";
import { LineComponent } from "@/asset/node_ui/line";
import { cursorDownProp, cursorState, cursorMoveProp } from "@/input";
import { Collider } from "@/collision";
import { CircleCollider, PointCollider } from "@/collision";
import { GlobalManager } from "@/global";

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
    this.event.dom.onCursorDown = this.onCursorDown;

    this._hitCircle = new CircleCollider(global, this, 0, 0, 30);
    this.addCollider(this._hitCircle);

    this._mouseHitBox = new PointCollider(global, this, 0, 0);
    this.addCollider(this._mouseHitBox);

    this._targetConnector = null;
    this._mousedownX = 0;
    this._mousedownY = 0;
    this.elementPositionMode = "relative";
  }

  onCursorDown(prop: cursorDownProp): void {
    const currentIncomingLines = this.incomingLines.filter(
      (i) => !i._requestDelete,
    );
    // Skip if it's not a left click
    if (prop.button != cursorState.mouseLeft) {
      return;
    }
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0]);
      return;
    }
    if (this.config.allowDragOut) {
      console.debug("Starting drag out line");
      this.startDragOutLine();
    }
  }

  componentCursorUp(): void {
    if (this.parent == null) {
      return;
    }
    this.endDragOutLine();
  }

  deleteLine(i: number): LineComponent | null {
    if (this.outgoingLines.length == 0) {
      return null;
    }

    const line = this.outgoingLines[i];
    line.delete(this.getCurrentStats());
    this.outgoingLines.splice(i, 1);
    return line;
  }

  deleteAllLines() {
    let stats: frameStats = this.getCurrentStats();
    for (const line of this.outgoingLines) {
      line.delete(stats);
    }
  }

  updateAllLines() {
    this.calculateCache();

    for (const line of [...this.outgoingLines, ...this.incomingLines]) {
      line.target?.calculateCache();
      line.calculateCache();
      line.applyCache();
      line.requestPostWrite();
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

  startDragOutLine(): void {
    let newLine = this.createLine();

    this.outgoingLines.unshift(newLine);

    this.parent.updateNodeLines();
    this.parent.updateNodeLineList();

    this._state = ConnectorState.DRAGGING;
    this._targetConnector = null;

    this.event.global.onCursorMove = this.runDragOutLine;
    this.event.global.onCursorUp = this.endDragOutLine;

    this._mouseHitBox.event.collider.onCollide = (
      _: Collider,
      __: Collider,
    ) => {
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
  }

  findClosestConnector() {
    let connectorCollider: Array<Collider> = Array.from(
      this._mouseHitBox._currentCollisions,
    ).filter((c) => c.parent.constructor.name == "ConnectorComponent");
    let connectors: Array<ConnectorComponent> = connectorCollider
      .map((c) => c.parent as ConnectorComponent)
      .sort((a, b) => {
        let da = Math.sqrt(
          Math.pow(a.worldX - this._mouseHitBox.worldX, 2) +
            Math.pow(a.worldY - this._mouseHitBox.worldY, 2),
        );
        let db = Math.sqrt(
          Math.pow(b.worldX - this._mouseHitBox.worldX, 2) +
            Math.pow(b.worldY - this._mouseHitBox.worldY, 2),
        );
        return da - db;
      });
    if (connectors.length > 0) {
      this._targetConnector = connectors[0];
    } else {
      this._targetConnector = null;
    }
  }

  runDragOutLine(prop: cursorMoveProp) {
    if (this._state != ConnectorState.DRAGGING) {
      return;
    }

    if (this.outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    this._mouseHitBox.worldX = prop.worldX;
    this._mouseHitBox.worldY = prop.worldY;

    let line = this.outgoingLines[0];

    if (this._targetConnector) {
      const result = this.hoverWhileDragging(this._targetConnector);
      if (result) {
        line.setLineEnd(result[0], result[1]);
        line.setLineStartAtConnector();
        line.requestPostWrite();
        return;
      }
    }

    line.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
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
    targetConnector.calculateCache();
    const connectorX = targetConnector.worldX;
    const connectorY = targetConnector.worldY;

    return [connectorX, connectorY];
  }

  endDragOutLine() {
    if (
      this._targetConnector &&
      this._targetConnector instanceof ConnectorComponent
    ) {
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

      this.outgoingLines[0].setLineEnd(target.worldX, target.worldY);
    } else {
      this.deleteLine(0);
    }
    if (this.parent) {
      this.parent.updateNodeLines();
    }

    this._endLineDragCleanup();
  }

  _endLineDragCleanup() {
    this._state = ConnectorState.IDLE;
    this.event.global.onCursorMove = null;
    this.event.global.onCursorUp = null;
    this.parent.updateNodeLineList();
    this._targetConnector = null;
    this._mouseHitBox.event.collider.onBeginContact = null;
    this._mouseHitBox.event.collider.onEndContact = null;
    this._mouseHitBox.localX = 0;
    this._mouseHitBox.localY = 0;
  }

  startPickUpLine(line: LineComponent) {
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    line.start.deleteLine(line.start.outgoingLines.indexOf(line));
    line.start.startDragOutLine();
    this._state = ConnectorState.DRAGGING;
  }

  connectToConnector(
    connector: ConnectorComponent,
    line: LineComponent | null,
  ): boolean {
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

    this.calculateCache();
    line.target = connector;
    connector.incomingLines.push(line);

    return true;
  }

  disconnectFromConnector(connector: ConnectorComponent) {
    for (const line of this.outgoingLines) {
      if (line.target == connector) {
        line._requestDelete = true;
        break;
      }
    }
  }
}

export { ConnectorComponent };
