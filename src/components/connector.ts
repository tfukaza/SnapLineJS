import {
  GlobalStats,
  ObjectTypes,
  customCursorDownProp,
  lineObject,
  ConnectorConfig,
} from "../types";
import { ComponentBase } from "./component";
import { NodeComponent } from "./node";
import { LineElement } from "../types";

/**
 * Connector components connect together nodes using lines.
 */
class ConnectorComponent extends ComponentBase {
  config: ConnectorConfig;
  name: string; // Name of the connector. This should describe the data associated with the connector
  connectorX: number; // Location of the connector on canvas
  connectorY: number;
  connectorTotalOffsetX: number; // Location of the connector relative to the location of parent Node
  _connectorTotalOffsetY: number;
  prop: { [key: string]: any }; // Properties of the connector
  outgoingLines: lineObject[];
  incomingLines: lineObject[];
  type: ObjectTypes = ObjectTypes.connector;
  dom: HTMLElement;
  parent: NodeComponent;

  updateFunction(): void {
    // Abstract function
  }

  constructor(
    dom: HTMLElement,
    config: ConnectorConfig,
    parent: NodeComponent,
    globals: GlobalStats,
  ) {
    super(config, parent, globals);

    this.connectorX = 0;
    this.connectorY = 0;
    this.connectorTotalOffsetX = 0;
    this._connectorTotalOffsetY = 0;
    this.dom = dom;
    this.parent = parent;
    this.prop = parent.prop;
    this.outgoingLines = [];
    this.incomingLines = [];
    this.config = config;
    globals.gid++;
    this.name = config.name || globals.gid.toString();
    this.g.globalNodeTable[this.gid] = this;
    this.dom.setAttribute("sl-gid", this.gid.toString());

    this.bindFunction(this.dom);
  }

  /**
   * Begins the line drag operation, which will create a temporary line
   * extending from the connector to the mouse cursor.
   */
  startDragOutLine() {
    console.debug(
      `Created line from connector ${this.gid} and started dragging`,
    );
    // Insert the temporary line into the svgLines array at index 0.
    // The 'start' field is set to this connector, and the 'target' field is set to null.
    this.outgoingLines.unshift({
      svg: null,
      target: null,
      start: this,
      connector_x: this.connectorX,
      connector_y: this.connectorY,
      x2: 0,
      y2: 0,
      connector: this,
      requestDelete: false,
      completedDelete: false,
    });
    this.parent.outgoingLines.push(this.outgoingLines[0]);

    this.setAllLinePositions();
  }

  /**
   * Called when the user drags the line extending from the connector.
   */
  runDragOutLine() {
    let distance = 9999;
    let connectorX = 0;
    let connectorY = 0;
    const hover: HTMLElement | null = this.g.hoverDOM as HTMLElement;

    if (this.outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }

    const [adjustedDeltaX, adjustedDeltaY] =
      this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);

    if (hover && hover.classList.contains("sl-connector")) {
      // If the node has a class of "sl-input-connector", then it is an input connector
      const gid = hover.getAttribute("sl-gid");
      if (!gid) return;
      const targetConnector: ConnectorComponent = this.g.globalNodeTable[
        gid
      ] as ConnectorComponent;
      targetConnector.updateConnectorPosition();
      connectorX = targetConnector.connectorX;
      connectorY = targetConnector.connectorY;
      distance = Math.sqrt(
        Math.pow(this.connectorX + adjustedDeltaX - connectorX, 2) +
          Math.pow(this.connectorY + adjustedDeltaY - connectorY, 2),
      );

      // Handle snapping to the input connector
      if (distance < 40) {
        this.setLineXYPosition(
          this.outgoingLines[0],
          connectorX - this.connectorX,
          connectorY - this.connectorY,
        );
      } else {
        this.setLineXYPosition(
          this.outgoingLines[0],
          adjustedDeltaX,
          adjustedDeltaY,
        );
      }
    } else {
      // Update the line position to the current mouse cursor position
      this.setLineXYPosition(
        this.outgoingLines[0],
        adjustedDeltaX,
        adjustedDeltaY,
      );
    }
  }

  /**
   * Ends the line drag operation.
   * This will delete the temporary line created by startDragOutLine.
   * If the user is hovering over an input connector, then the line will be connected to the input connector.
   */
  endDragOutLine() {
    const hover: HTMLElement | null = this.g.hoverDOM as HTMLElement;
    if (hover && hover.classList.contains("sl-connector")) {
      const gid = hover.getAttribute("sl-gid");
      console.debug("Connected to input connector: ", gid);
      if (!gid) {
        console.error(`Error: gid is null`);
        return;
      }
      const target = this.g.globalNodeTable[gid] as ConnectorComponent;
      if (this.connectToConnector(target) == false) {
        this.deleteLine(0);
        return;
      }

      target.prop[target.name] = this.prop[this.name]; // Logically connect the input to the output
      target.updateFunction(); // Update the input

      this.setLineXYPosition(
        this.outgoingLines[0],
        target.connectorX - this.connectorX,
        target.connectorY - this.connectorY,
      );
    } else {
      this.deleteLine(0);
    }
  }

  startPickUpLine(line: lineObject) {
    // Hand over control to the peer output
    this.g.targetObject = line.start;

    [this.g.dx_offset, this.g.dy_offset] =
      this.g.camera.getCameraDeltaFromWorldDelta(
        this.connectorX - line.start.connectorX,
        this.connectorY - line.start.connectorY,
      );
    this.g.dx = this.g.dx_offset;
    this.g.dy = this.g.dy_offset;

    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    this.deleteLine(this.incomingLines.indexOf(line));
    line.start.startDragOutLine();
  }

  connectToConnector(connector: ConnectorComponent): boolean {
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
        `Connector ${connector} already has max number of connectors`,
      );
      return false;
    }

    this.updateConnectorPosition();

    this.outgoingLines[0].target = connector;
    connector.incomingLines.push(this.outgoingLines[0]);
    connector.parent.incomingLines.push(this.outgoingLines[0]);

    return true;
  }

  disconnectFromConnector(connector: ConnectorComponent) {
    for (const line of this.outgoingLines) {
      if (line.target == connector) {
        line.requestDelete = true;
        break;
      }
    }
  }

  updateConnectorPosition() {
    this.connectorX = this.parent.positionX + this.connectorTotalOffsetX;
    this.connectorY = this.parent.positionY + this._connectorTotalOffsetY;
  }

  setLineXYPosition(entry: lineObject, x: number, y: number) {
    entry.x2 = x;
    entry.y2 = y;
  }

  renderLinePosition(entry: lineObject) {
    const svg: LineElement = entry.svg;
    if (!svg) {
      return;
    }
    this.setStyle(svg, {
      position: "absolute",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "transform",
      transform: `translate3d(${entry.connector_x}px, ${entry.connector_y}px, 0)`,
    });
    const line = svg.children[0] as SVGLineElement;
    line.setAttribute("x1", "" + 0);
    line.setAttribute("y1", "" + 0);
    line.setAttribute("x2", "" + entry.x2);
    line.setAttribute("y2", "" + entry.y2);
  }

  setLinePosition(entry: lineObject) {
    entry.connector_x = entry.start.connectorX;
    entry.connector_y = entry.start.connectorY;
    if (!entry.target) {
      const [adjustedDeltaX, adjustedDeltaY] =
        this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);
      /* If entry.to is not set, then this line is currently being dragged */
      this.setLineXYPosition(entry, adjustedDeltaX, adjustedDeltaY);
    } else {
      this.setLineXYPosition(
        entry,
        entry.target.connectorX - entry.start.connectorX,
        entry.target.connectorY - entry.start.connectorY,
      );
    }
  }

  /* Updates the position of all lines connected to this connector */
  setAllLinePositions() {
    this.updateConnectorPosition();
    for (const line of this.outgoingLines) {
      this.setLinePosition(line);
    }
    for (const line of this.incomingLines) {
      line.start.setLinePosition(line);
    }
  }

  updateDOMproperties() {
    const this_rect = this.dom.getBoundingClientRect();
    if (!this.parent.dom) {
      console.error(`Parent DOM is null`);
      return;
    }
    const parent_rect = this.parent.dom.getBoundingClientRect();
    const [adjLeft, adjTop] = this.g.camera.getWorldDeltaFromCameraDelta(
      this_rect.left - parent_rect.left,
      this_rect.top - parent_rect.top,
    );
    const [adjWidth, adjHeight] = this.g.camera.getWorldDeltaFromCameraDelta(
      this_rect.width / 2,
      this_rect.height / 2,
    );
    this.connectorTotalOffsetX = adjLeft + adjWidth;
    this._connectorTotalOffsetY = adjTop + adjHeight;
  }

  createLineDOM(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    svg.appendChild(line);
    svg.classList.add("sl-connector-svg");
    line.classList.add("sl-connector-line");
    line.setAttribute("stroke-width", "4");

    this.g.canvas!.appendChild(svg);

    return svg;
  }

  setStyle(dom: LineElement, style: any) {
    if (!dom) {
      return;
    }
    for (const key in style) {
      dom.style[key as any] = style[key];
    }
  }

  deleteLine(i: number): lineObject | undefined {
    if (this.outgoingLines.length == 0) {
      return undefined;
    }

    const svg = this.outgoingLines[i];
    svg.requestDelete = true;

    return svg;
  }

  deleteAllLines() {
    for (const svg of this.outgoingLines) {
      svg.requestDelete = true;
    }
  }

  componentCursorDown(_: customCursorDownProp): void {
    const currentIncomingLines = this.incomingLines.filter(
      (i) => !i.requestDelete,
    );
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0]);
      return;
    }
    if (this.config.allowDragOut) {
      this.startDragOutLine();
    }
  }

  onDrag(): void {
    this.runDragOutLine();
  }

  componentCursorUp(): void {
    this.endDragOutLine();
    this.parent._renderNodeLines();
  }
}

export { ConnectorComponent };
