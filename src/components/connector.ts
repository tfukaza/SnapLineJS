import { ObjectTypes } from "../types";
import { ElementObject } from "./object";
import { NodeComponent } from "./node";
import { LineComponent } from "./line";
import {
  cursorDownProp,
  cursorState,
  cursorMoveProp,
  cursorUpProp,
} from "../input";
import { Collider } from "../collision";
// import { RectRigidBody } from "../collision";
import { CircleCollider, PointCollider } from "../collision";
import { GlobalManager } from "../global";
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

/**
 * Connector components connect together nodes using lines.
 */
class ConnectorComponent extends ElementObject {
  declare parent: NodeComponent;
  config: ConnectorConfig;
  name: string; // Name of the connector. This should describe the data associated with the connector
  prop: { [key: string]: any }; // Properties of the connector
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
    super(global, parent);

    this.prop = {};
    this.outgoingLines = [];
    this.incomingLines = [];
    this.config = config;

    this.updateProperty();

    // this.connectToConnector = this.connectToConnector.bind(this);
    // this.disconnectFromConnector = this.disconnectFromConnector.bind(this);

    this.name = config.name || this.gid || "";

    this.event.dom.onCursorDown = this.onCursorDown;

    // this.connectorCursorDown = this._onConnectorCursorDown.bind(this);
    // this.hoverWhileDragging = this._hoverWhileDragging.bind(this);
    // this.endLineDrag = this._endLineDrag.bind(this);

    // this.g.snapline.subscribeOnCursorDown(this.gid, () => {
    //   this._dom?.classList.add("snap");
    // });
    // this.g.snapline.subscribeOnCursorUp(this.gid, () => {
    //   this._dom?.classList.remove("snap");
    // });

    this._hitCircle = new CircleCollider(global, this, 0, 0, 30);
    this.addCollider(this._hitCircle);

    this._mouseHitBox = new PointCollider(global, this, 0, 0);
    this.addCollider(this._mouseHitBox);

    this._targetConnector = null;

    this._mousedownX = 0;
    this._mousedownY = 0;
  }

  // onGlobalCursorDown(e: cursorDownProp): void {
  //   this._dom?.classList.add("snap");
  // }

  // onGlobalCursorUp(e: cursorUpProp): void {
  //   this._dom?.classList.remove("snap");
  // }
  addDom(dom: HTMLElement) {
    const domElement = super.addDom(dom);
    domElement.style = {
      position: "absolute",
      top: "0",
      left: "0",
    };
    // console.assert(this._dom != null, "ConnectorComponent dom is null");
    // this._dom!.setAttribute("data-snapline-type", "connector");
    // this._hitCircle.assignDom(this._dom!);
    this._hitCircle.position.worldX = this.worldX;
    this._hitCircle.position.worldY = this.worldY;
    // this._hitCircle.event.rigid.onCollide = this.onCollide;
    return domElement;
  }

  assignRigidBodyDom(dom: HTMLElement) {
    // const rigidBody = new RectRigidBody(this.g, this, 0, 0, 0, 0);
    // rigidBody.assignDom(dom);
    // // rigidBody.event.dom.onCursorMove = this.onCursorMove;
    // this.addRigidBody(rigidBody);
  }

  // ==================== Private methods ====================

  // ==================== Hidden methods ====================

  onCursorDown(prop: cursorDownProp): void {
    // super.onCursorDown(e);
    console.debug(
      `ConnectorComponent _componentCursorDown event triggered on ${this.gid}, button: ${prop.button}`,
    );
    const currentIncomingLines = this.incomingLines.filter(
      (i) => !i.requestDelete,
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
      this.startDragOutLine();
    }
  }

  // onDrag(): void {
  //   super.onDrag();
  //   this.runDragOutLine();
  // }

  componentCursorUp(): void {
    if (this.parent == null) {
      return;
    }
    this.endDragOutLine();
    // (this.parent as NodeComponent)._renderNodeLines();
  }

  deleteLine(i: number): LineComponent | null {
    if (this.outgoingLines.length == 0) {
      return null;
    }

    const line = this.outgoingLines[i];
    line.delete();
    this.outgoingLines.splice(i, 1);
    return line;
  }

  deleteAllLines() {
    for (const line of this.outgoingLines) {
      line.delete();
    }
  }

  _renderLinePosition(entry: LineComponent) {
    // entry.renderLine();
  }

  /**
   * Updates the start and end positions of the line.
   * @param entry The line to update.
   */
  updateLine(entry: LineComponent) {
    // if (this.global == null) {
    //   console.error("Global stats is null");
    //   return;
    // }
    entry.setLineStartAtConnector();
    if (!entry.target) {
      // const [adjustedX, adjustedY] = this.global.camera!.getWorldFromCamera(
      //   this.global.cursor.screenX + this.global.dx,
      //   this.global.cursor.screenY + this.global.dy,
      // );
      /* If entry.to is not set, then this line is currently being dragged */
      entry.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
    } else {
      entry.setLineEndAtConnector();
    }
    entry.submitRender();
  }

  /* Updates the position of all lines connected to this connector */
  updateAllLines() {
    // this.updateProperty();
    for (const line of this.outgoingLines) {
      this.updateLine(line);
    }
    for (const line of this.incomingLines) {
      line.start.updateLine(line);
    }
  }

  /** ==================== Public methods ==================== */

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

  /**
   * Creates a new line extending from this connector.
   * @param dom The DOM element to create the line in.
   * @returns The line object that was created.
   */
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

  /**
   * Begins the line drag operation, which will create a temporary line
   * extending from the connector to the mouse cursor.
   */
  startDragOutLine(): void {
    console.debug("Starting drag out line", this.worldX, this.worldY);
    let newLine = this.createLine();

    // const [adjustedX, adjustedY] = this.g.camera.getWorldFromCamera(
    //   this.g.mousedown_x + this.g.dx,
    //   this.g.mousedown_y + this.g.dy,
    // );
    // newLine.setLineStartAtConnector();
    // newLine.setLineEnd(adjustedX, adjustedY);
    this.outgoingLines.unshift(newLine);
    // this.updateAllLines();

    // Invoke the render callback to update the line positions
    this.parent.updateNodeLines();
    this.parent.updateNodeLineList();

    // this.addCursorUpCallback(this.endDragOutLine);
    this._state = ConnectorState.DRAGGING;
    this._targetConnector = null;

    // this.g.snapline.subscribeOnCursorMove(
    //   this.gid,
    //   this.runDragOutLine.bind(this),
    // );
    // this.g.snapline.subscribeOnCursorUp(
    //   this.gid,
    //   this.endDragOutLine.bind(this),
    // );
    this.event.global.onCursorMove = this.runDragOutLine;
    this.event.global.onCursorUp = this.endDragOutLine;

    // this._mouseHitBox.event.rigid.onCollide = (
    //   thisObject: RigidBody,
    //   otherObject: RigidBody,
    // ) => {
    //   // console.debug("Collided with", otherObject.type);
    //   if (otherObject.parent instanceof ConnectorComponent) {
    //     this._targetConnector = otherObject.parent as ConnectorComponent;
    //   }
    // };
    this._mouseHitBox.event.collider.onBeginContact = (
      thisObject: Collider,
      otherObject: Collider,
    ) => {
      if (otherObject.parent instanceof ConnectorComponent) {
        this._targetConnector = otherObject.parent as ConnectorComponent;
      }
    };
    this._mouseHitBox.event.collider.onEndContact = (
      thisObject: Collider,
      otherObject: Collider,
    ) => {
      if (otherObject.parent instanceof ConnectorComponent) {
        this._targetConnector = null;
      }
    };
  }

  /**
   * Called when the user drags the line extending from the connector.
   */
  runDragOutLine(prop: cursorMoveProp) {
    // if (this.g == null) {
    //   return;
    // }

    // console.debug("Running drag out line", prop);

    // Skip if there is no drag operation
    if (this._state != ConnectorState.DRAGGING) {
      return;
    }

    if (this.outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    this._mouseHitBox.worldX = prop.worldX;
    this._mouseHitBox.worldY = prop.worldY;
    console.debug(
      "Mouse hit box",
      this.gid,
      this._mouseHitBox.worldX,
      this._mouseHitBox.worldY,
    );
    // const [adjustedX, adjustedY] = this.g.camera.getWorldFromCamera(
    //   this.g.mousedown_x + this.g.dx,
    //   this.g.mousedown_y + this.g.dy,
    // );

    let line = this.outgoingLines[0];
    // console.debug(prop);
    // console.debug(prop.clientX, prop.clientY);

    if (this._targetConnector) {
      // console.debug("Hovering over target connector", this._targetConnector);
      const result = this.hoverWhileDragging(this._targetConnector);
      if (result) {
        line.setLineEnd(result[0], result[1]);
        line.setLineStartAtConnector();
        line.submitRender();
        // this.parent.updateNodeLines();
        return;
      }
    }

    // console.debug(
    //   "Running drag out line",
    //   line.gid,
    //   line.endPositionX,
    //   line.endPositionY,
    // );

    // Update the line position to the current mouse cursor position
    line.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
    line.setLineStartAtConnector();
    // line.submitRender();

    // Invoke the render callback to update the line positions
    this.parent.updateNodeLines();

    // console.debug(
    //   `Line end set to ${adjustedX}, ${adjustedY}, line start is ${line.positionX}, ${line.positionY}`,
    // );
  }

  hoverWhileDragging(
    targetConnector: ConnectorComponent,
  ): [number, number] | void {
    // if (hoverDOM.getAttribute("data-snapline-type") != "connector") {
    //   return;
    // }
    if (!(targetConnector instanceof ConnectorComponent)) {
      // console.log(targetConnector);
      return;
    }
    if (targetConnector == null) {
      console.debug(`Error: targetConnector is null`);
      return;
    }
    if (targetConnector.gid == this.gid) {
      return;
    }
    targetConnector.updateProperty();
    const connectorX = targetConnector.worldX;
    const connectorY = targetConnector.worldY;
    // const distance = Math.sqrt(
    //   Math.pow(cursorX - connectorX, 2) + Math.pow(cursorY - connectorY, 2),
    // );

    // // Handle snapping to the input connector
    // if (distance < 40) {
    //   // console.debug("Snapping to connector", connectorX, connectorY);
    return [connectorX, connectorY];
    // } else {
    //   // console.debug("Not snapping to connector", connectorX, connectorY);
    //   return [cursorX, cursorY];
    // }
  }

  /**
   * Ends the line drag operation.
   * This will delete the temporary line created by startDragOutLine.
   * If the user is hovering over an input connector, then the line will be connected to the input connector.
   */
  endDragOutLine() {
    console.debug("Ending line drag operation");
    // if (this.g == null) {
    //   return;
    // }

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

      target.prop[target.name] = this.prop[this.name]; // Logically connect the input to the output
      // target.updateFunction(); // Update the input

      this.outgoingLines[0].setLineEnd(target.worldX, target.worldY);
    } else {
      // By convention, the first line is the one that is being dragged
      this.deleteLine(0);
    }
    if (this.parent) {
      this.parent.updateNodeLines();
    }

    this._endLineDragCleanup();
  }

  _endLineDragCleanup() {
    // if (this.g == null) {
    //   return;
    // }
    // this.deleteCursorUpCallback();
    this._state = ConnectorState.IDLE;
    // this.g.snapline.unsubscribeOnCursorMove(this.gid);
    // this.g.snapline.unsubscribeOnCursorUp(this.gid);
    this.event.global.onCursorMove = null;
    this.event.global.onCursorUp = null;
    this.parent.updateNodeLineList();
    // this._dom?.classList.remove("snap");
    this._targetConnector = null;
    this._mouseHitBox.event.collider.onBeginContact = null;
    this._mouseHitBox.event.collider.onEndContact = null;
    this._mouseHitBox.position.worldX = 0;
    this._mouseHitBox.position.worldY = 0;
  }

  /**
   * Begins the process of dragging a line that is already connected to another connector.
   * @param line The line that is being dragged.
   */
  startPickUpLine(line: LineComponent) {
    // if (this.g == null) {
    //   return;
    // }
    // Hand over control to the peer output
    // this.global.targetObject = line.start;

    // let [dx_offset, dy_offset] = this.g.camera.getCameraDeltaFromWorldDelta(
    //   this.connectorX - line.start.connectorX,
    //   this.connectorY - line.start.connectorY,
    // );
    // line.x1

    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    line.start.deleteLine(line.start.outgoingLines.indexOf(line));
    console.debug(
      "Starting pick out line",
      line.start.worldX,
      line.start.worldY,
    );
    line.start.startDragOutLine();
    this._state = ConnectorState.DRAGGING;
  }

  /**
   * Logically connects this connector to another connector.
   *
   * @param connector The connector to connect to.
   * @param line The line to connect to the connector. If null, a new line will be created.
   * @returns True if the connection was successful, false otherwise.
   */
  connectToConnector(
    connector: ConnectorComponent,
    line: LineComponent | null,
  ): boolean {
    const currentIncomingLines = connector.incomingLines.filter(
      (i) => !i.requestDelete,
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

    this.updateProperty();
    line.target = connector;
    connector.incomingLines.push(line);

    console.log("Connected to connector", connector, line);

    // this._mouseHitBox.localX = 0;
    // this._mouseHitBox.localY = 0;

    return true;
  }

  /**
   * Logically disconnects this connector from another connector.
   * @param connector The connector to disconnect from.
   */
  disconnectFromConnector(connector: ConnectorComponent) {
    for (const line of this.outgoingLines) {
      if (line.target == connector) {
        line.requestDelete = true;
        break;
      }
    }
  }
}

export { ConnectorComponent };
