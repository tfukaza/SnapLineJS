import {
  GlobalStats,
  ObjectTypes,
  customCursorDownProp,
  ConnectorConfig,
} from "../types";
import { ComponentBase } from "./base";
import { NodeComponent } from "./node";
import { LineComponent } from "./line";
import { cursorState } from "../input";

enum ConnectorState {
  IDLE,
  DRAGGING,
}

/**
 * Connector components connect together nodes using lines.
 */
class ConnectorComponent extends ComponentBase {
  config: ConnectorConfig;
  name: string; // Name of the connector. This should describe the data associated with the connector
  connectorX: number; // Location of the connector on canvas
  connectorY: number;
  _connectorTotalOffsetX: number; // Location of the connector relative to the location of parent Node
  _connectorTotalOffsetY: number;
  prop: { [key: string]: any }; // Properties of the connector
  outgoingLines: LineComponent[];
  incomingLines: LineComponent[];
  _type: ObjectTypes = ObjectTypes.connector;
  dom: HTMLElement | null;
  _state: ConnectorState = ConnectorState.IDLE;

  connectorCursorDown: (currentIncomingLines: LineComponent[]) => void;
  hoverWhileDragging: (
    hover: HTMLElement,
    line: LineComponent,
    cursorX: number,
    cursorY: number,
  ) => [number, number] | void;
  endLineDrag: (
    target: HTMLElement | null,
    line: LineComponent | null,
    cursorX: number,
    cursorY: number,
  ) => void;

  // ==================== Private methods ====================

  // ==================== Hidden methods ====================

  _componentCursorDown(e: customCursorDownProp): void {
    console.debug(
      `ConnectorComponent _componentCursorDown event triggered on ${this.gid}, button: ${e.button}`,
    );
    const currentIncomingLines = this.incomingLines.filter(
      (i) => !i.requestDelete,
    );
    // Skip if it's not a left click
    if (e.button != 0) {
      return;
    }

    this.connectorCursorDown(currentIncomingLines);
  }

  _onConnectorCursorDown(currentIncomingLines: LineComponent[]): void {
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0]);
      return;
    }
    if (this.config.allowDragOut) {
      this.startDragOutLine();
    }
    // e.event.preventDefault();
    // e.event.stopPropagation();
  }

  _onDrag(): void {
    this.runDragOutLine();
  }

  _componentCursorUp(): void {
    if (this.parent == null) {
      return;
    }
    this.endDragOutLine();
    this.parent._renderNodeLines();
  }

  _updateDomProperties() {
    if (this.g == null || this.dom == null || this.parent == null) {
      return;
    }
    const this_rect = this.dom.getBoundingClientRect();
    if (!this.parent._dom) {
      console.error(`Parent DOM is null`);
      return;
    }
    const parent_rect = this.parent._dom.getBoundingClientRect();

    // getBoundingClientRect returns size shown on screen, so we need to convert it to world coordinates
    const [adjLeft, adjTop] = this.g.camera.getWorldDeltaFromCameraDelta(
      this_rect.left - parent_rect.left,
      this_rect.top - parent_rect.top,
    );
    const [adjWidth, adjHeight] = this.g.camera.getWorldDeltaFromCameraDelta(
      this_rect.width / 2, // Get the center of the connector
      this_rect.height / 2,
    );

    this._connectorTotalOffsetX = adjLeft + adjWidth;
    this._connectorTotalOffsetY = adjTop + adjHeight;

    this.connectorX = this.parent.positionX + this._connectorTotalOffsetX;
    this.connectorY = this.parent.positionY + this._connectorTotalOffsetY;
  }

  deleteLine(i: number): LineComponent | undefined {
    if (this.outgoingLines.length == 0) {
      // console.warn(`Error: Outgoing lines is empty`);
      return undefined;
    }

    const line = this.outgoingLines[i];
    line.requestDelete = true;

    return line;
  }

  deleteAllLines() {
    for (const line of this.outgoingLines) {
      line.requestDelete = true;
    }
  }

  _renderLinePosition(entry: LineComponent) {
    entry.renderLine();
  }

  /**
   * Updates the start and end positions of the line.
   * @param entry The line to update.
   */
  _setLinePosition(entry: LineComponent) {
    if (this.g == null) {
      return;
    }
    entry.setLineStartAtConnector();
    if (!entry.target) {
      const [adjustedX, adjustedY] = this.g.camera.getWorldFromCamera(
        this.g.mousedown_x + this.g.dx,
        this.g.mousedown_y + this.g.dy,
      );
      /* If entry.to is not set, then this line is currently being dragged */
      entry.setLineEnd(adjustedX, adjustedY);
    } else {
      entry.setLineEndAtConnector();
    }
  }

  /* Updates the position of all lines connected to this connector */
  _setAllLinePositions() {
    this._updateDomProperties();
    for (const line of this.outgoingLines) {
      this._setLinePosition(line);
    }
    for (const line of this.incomingLines) {
      line.start._setLinePosition(line);
    }
  }

  /** ==================== Public methods ==================== */
  constructor(
    // parent: NodeComponent,
    // outgoingLines: LineComponent[],
    // incomingLines: LineComponent[],
    dom: HTMLElement | null = null,
    globals: GlobalStats | null = null,
    config: ConnectorConfig = {},
  ) {
    super(null, globals);

    this.dom = dom;
    this.prop = {};
    this.outgoingLines = [];
    this.incomingLines = [];
    this.config = config;

    this.connectorX = 0;
    this.connectorY = 0;
    this._connectorTotalOffsetX = 0;
    this._connectorTotalOffsetY = 0;
    this._updateDomProperties();

    this.connectToConnector = this.connectToConnector.bind(this);
    this.disconnectFromConnector = this.disconnectFromConnector.bind(this);

    if (this.dom) {
      this.init(this.dom);
    }
    if (this.g) {
      this.updateGlobals(this.g);
    }

    this.name = config.name || this.gid || "";

    this.connectorCursorDown = this._onConnectorCursorDown.bind(this);
    this.hoverWhileDragging = this._hoverWhileDragging.bind(this);
    this.endLineDrag = this._endLineDrag.bind(this);
    console.log("Connector created", this, this.gid, this.name);
  }

  init(dom: HTMLElement) {
    this.dom = dom;
    this.bindFunction(this.dom);
    this.dom.setAttribute("data-snapline-gid", this.gid.toString());
    this.dom.setAttribute("data-snapline-type", "connector");
  }

  assignToNode(parent: NodeComponent) {
    this.parent = parent;
    this.parent._prop[this.name] = null;
    this.prop = parent._prop;
    this.parent._connectors[this.name] = this;
    this.parent._allOutgoingLines[this.name] = [];
    this.parent._allIncomingLines[this.name] = [];
    this.outgoingLines = parent._allOutgoingLines[this.name];
    this.incomingLines = parent._allIncomingLines[this.name];
    if (parent.g && this.g == null) {
      this.updateGlobals(parent.g);
    }
  }

  updateGlobals(globals: GlobalStats) {
    super.updateGlobals(globals);
    this.g!.globalNodeTable[this.gid] = this;
    if (this.dom) {
      this.init(this.dom);
    }
  }

  /**
   * Creates a new line extending from this connector.
   * @param dom The DOM element to create the line in.
   * @returns The line object that was created.
   */
  createLine(dom: HTMLElement | null): LineComponent {
    console.debug(`Creating line from connector ${this.gid}`);
    const line = new LineComponent(
      this.connectorX,
      this.connectorY,
      0,
      0,
      dom,
      this,
      this.g,
    );

    return line;
  }

  /**
   * Begins the line drag operation, which will create a temporary line
   * extending from the connector to the mouse cursor.
   */
  startDragOutLine(): void {
    console.debug(
      `Created line from connector ${this.gid} and started dragging`,
    );
    this.outgoingLines.unshift(this.createLine(null));
    this._setAllLinePositions();
    this.addCursorUpCallback(this.endDragOutLine);
    this._state = ConnectorState.DRAGGING;
  }

  /**
   * Called when the user drags the line extending from the connector.
   */
  runDragOutLine() {
    if (this.g == null) {
      return;
    }
    // Skip if there is no drag operation
    if (this._state != ConnectorState.DRAGGING) {
      return;
    }
    const hover: HTMLElement | null = this.g.hoverDOM as HTMLElement;

    if (this.outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }

    const [adjustedX, adjustedY] = this.g.camera.getWorldFromCamera(
      this.g.mousedown_x + this.g.dx,
      this.g.mousedown_y + this.g.dy,
    );

    let line = this.outgoingLines[0];

    if (hover) {
      const result = this._hoverWhileDragging(
        hover,
        line,
        adjustedX,
        adjustedY,
      );
      if (result) {
        line.setLineEnd(result[0], result[1]);
        return;
      }
    }
    // Update the line position to the current mouse cursor position
    line.setLineEnd(adjustedX, adjustedY);
  }

  _hoverWhileDragging(
    hover: HTMLElement,
    line: LineComponent,
    cursorX: number,
    cursorY: number,
  ): [number, number] | void {
    if (hover.getAttribute("data-snapline-type") != "connector") {
      return;
    }
    const targetConnector = this.getClassFromDOM(
      hover,
    ) as unknown as ConnectorComponent;
    if (targetConnector == null) {
      console.error(`Error: targetConnector is null`);
      return;
    }
    targetConnector._updateDomProperties();
    const connectorX = targetConnector.connectorX;
    const connectorY = targetConnector.connectorY;
    const distance = Math.sqrt(
      Math.pow(cursorX - connectorX, 2) + Math.pow(cursorY - connectorY, 2),
    );

    // Handle snapping to the input connector
    if (distance < 40) {
      return [connectorX, connectorY];
    } else {
      return [cursorX, cursorY];
    }
  }

  _endLineDrag(
    target: HTMLElement | null,
    line: LineComponent | null,
    cursorX: number,
    cursorY: number,
  ) {
    console.debug(
      `ConnectorComponent _endLineDrag event triggered on ${this.gid}, target: ${target}, cursorX: ${cursorX}, cursorY: ${cursorY}`,
    );
  }

  /**
   * Ends the line drag operation.
   * This will delete the temporary line created by startDragOutLine.
   * If the user is hovering over an input connector, then the line will be connected to the input connector.
   */
  endDragOutLine() {
    console.debug("Ending line drag operation");
    if (this.g == null) {
      return;
    }
    const hover: HTMLElement | null = this.g.hoverDOM as HTMLElement;
    if (hover && hover.getAttribute("data-snapline-type") == "connector") {
      const target = this.getClassFromDOM(
        hover,
      ) as unknown as ConnectorComponent;
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

      this.outgoingLines[0].setLineEnd(target.connectorX, target.connectorY);
    } else {
      // By convention, the first line is the one that is being dragged
      this.deleteLine(0);
    }
    if (this.parent) {
      this.parent._renderOutgoingLines(this.outgoingLines, this.name);
    }

    this._endLineDragCleanup();
  }

  _endLineDragCleanup() {
    if (this.g == null) {
      return;
    }
    this.deleteCursorUpCallback();
    this._state = ConnectorState.IDLE;
    this.endLineDrag(
      this.g.hoverDOM as HTMLElement,
      this.outgoingLines.length > 0 ? this.outgoingLines[0] : null,
      this.g.mousedown_x + this.g.dx,
      this.g.mousedown_y + this.g.dy,
    );
  }

  /**
   * Begins the process of dragging a line that is already connected to another connector.
   * @param line The line that is being dragged.
   */
  startPickUpLine(line: LineComponent) {
    if (this.g == null) {
      return;
    }
    // Hand over control to the peer output
    this.g.targetObject = line.start;

    // let [dx_offset, dy_offset] = this.g.camera.getCameraDeltaFromWorldDelta(
    //   this.connectorX - line.start.connectorX,
    //   this.connectorY - line.start.connectorY,
    // );
    // line.x1

    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    this.deleteLine(this.incomingLines.indexOf(line));
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
      line = this.createLine(null);
      this.outgoingLines.unshift(line);
    }

    this._updateDomProperties();
    line.target = connector;
    connector.incomingLines.push(line);

    console.log("Connected to connector", connector, line);

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
