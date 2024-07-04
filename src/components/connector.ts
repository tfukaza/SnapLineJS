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
  connectorTotalOffsetY: number;
  prop: { [key: string]: any }; // Properties of the connector
  lineArray: lineObject[];
  type: ObjectTypes = ObjectTypes.connector;
  dom: HTMLElement;
  parent: NodeComponent;
  peerConnectors: ConnectorComponent[];

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
    this.connectorTotalOffsetY = 0;
    this.dom = dom;
    this.parent = parent;
    this.prop = parent.prop;
    this.lineArray = [];
    this.peerConnectors = [];
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
    this.lineArray.unshift({
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

    this.setAllLinePositions();
  }

  /**
   * Called when the user drags the line extending from the connector.
   */
  runDragOutLine() {
    // console.debug(`Dragging line from connector ${this.gid}`);

    let distance = 9999;
    let connectorX = 0;
    let connectorY = 0;
    const hover: HTMLElement | null = this.g.hoverDOM as HTMLElement;

    if (this.lineArray.length == 0) {
      console.warn(`Warning: svgLines is empty`);
      return;
    }

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
        Math.pow(this.connectorX + this.g.dx / this.g.zoom - connectorX, 2) +
          Math.pow(this.connectorY + this.g.dy / this.g.zoom - connectorY, 2),
      );

      // Handle snapping to the input connector
      if (distance < 40) {
        this.setLineXYPosition(
          this.lineArray[0],
          connectorX - this.connectorX,
          connectorY - this.connectorY,
        );
      } else {
        this.setLineXYPosition(
          this.lineArray[0],
          this.g.dx / this.g.zoom,
          this.g.dy / this.g.zoom,
        );
      }
    } else {
      // Update the line position to the current mouse cursor position
      this.setLineXYPosition(
        this.lineArray[0],
        this.g.dx / this.g.zoom,
        this.g.dy / this.g.zoom,
      );
    }
  }

  /**
   * Ends the line drag operation.
   * This will delete the temporary line created by startDragOutLine.
   * If the user is hovering over an input connector, then the line will be connected to the input connector.
   */
  endDragOutLine() {
    console.debug(`Ended dragging line from connector ${this.gid}`);

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
        this.deleteTmpLine();
        return;
      }

      target.prop[target.name] = this.prop[this.name]; // Logically connect the input to the output
      target.updateFunction(); // Update the input

      this.setLineXYPosition(
        this.lineArray[0],
        target.connectorX - this.connectorX,
        target.connectorY - this.connectorY,
      );
    } else {
      this.deleteTmpLine();
    }
  }

  startPickUpLine(line: lineObject) {
    console.debug(
      `Detached line from connector ${this.gid} and started dragging`,
    );
    console.debug(`Line: `, this.lineArray);

    // Hand over control to the peer output
    this.g.targetObject = line.start;

    this.g.dx_offset = (this.connectorX - line.start.connectorX) * this.g.zoom;
    this.g.dy_offset = (this.connectorY - line.start.connectorY) * this.g.zoom;
    this.g.dx = this.g.dx_offset;
    this.g.dy = this.g.dy_offset;
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    this.deleteLine(this.lineArray.indexOf(line));
    line.start.startDragOutLine();
  }

  connectToConnector(connector: ConnectorComponent): boolean {
    if (connector.peerConnectors.some((e) => e === this)) {
      console.debug("Already connected");
      return false;
    }

    if (connector.config.maxConnectors === connector.peerConnectors.length) {
      console.debug(
        `Connector ${connector} already has max number of connectors`,
      );
      return false;
    }

    console.debug("Connecting to: ", connector);
    connector.peerConnectors.push(this);
    this.peerConnectors.push(connector);
    this.updateConnectorPosition();

    this.lineArray[0].target = connector;
    //this.g.globalLines.push(this.lineArray[0]);
    connector.lineArray.push(this.lineArray[0]);

    return true;
  }

  disconnectFromConnector(connector: ConnectorComponent) {
    console.debug("Disconnecting from connector: ", connector);
    for (const svg of this.lineArray) {
      if (svg.target == connector) {
        svg.requestDelete = true;
        break;
      }
    }
    // Remove the input from the peerInputs array using gid as key
    this.peerConnectors = this.peerConnectors.filter(
      (i) => i.gid != connector.gid,
    );
  }

  updateConnectorPosition() {
    this.connectorX = this.parent.positionX + this.connectorTotalOffsetX;
    this.connectorY = this.parent.positionY + this.connectorTotalOffsetY;
  }

  setLineXYPosition(entry: lineObject, x: number, y: number) {
    entry.x2 = x;
    entry.y2 = y;
  }

  setLinePosition(entry: lineObject) {
    entry.connector_x = entry.start.connectorX;
    entry.connector_y = entry.start.connectorY;
    if (!entry.target) {
      /* If entry.to is not set, then this line is currently being dragged */
      this.setLineXYPosition(
        entry,
        this.g.dx / this.g.zoom,
        this.g.dy / this.g.zoom,
      );
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
    for (const line of this.lineArray) {
      this.setLinePosition(line);
    }
  }

  renderAllLines(lineArray: lineObject[]) {
    //console.debug(`Rendering all lines for ${this.gid}`, lineArray);
    for (const line of lineArray) {
      if (!line.svg) {
        const svgDom = this.createLineDOM();
        line.svg = svgDom;
      } else if (line.requestDelete && !line.completedDelete) {
        this.g.canvas.removeChild(line.svg as Node);
        line.completedDelete = true;
        continue;
      }
      line.connector_x = line.start.connectorX;
      line.connector_y = line.start.connectorY;
      if (line.target) {
        line.x2 = line.target.connectorX - line.start.connectorX;
        line.y2 = line.target.connectorY - line.start.connectorY;
      }
      line.svg.style.transform = `translate3d(${this.connectorX}px, ${this.connectorY}px, 0)`;
      this.renderLinePosition(line);
    }
    this.filterDeletedLines(lineArray);
  }

  setRenderLineCallback(callback: (svgLines: lineObject[]) => void) {
    this.renderAllLines = (svgLines: lineObject[]) => {
      this.filterDeletedLines(svgLines);
      callback(svgLines);
    };
  }

  pxToInt(px: string): number {
    return parseInt(px.substring(0, px.length - 2));
  }

  getComputed(element: HTMLElement, prop: string) {
    const s = window.getComputedStyle(element, null).getPropertyValue(prop);
    if (s.endsWith("px")) return this.pxToInt(s);
    else return parseInt(s);
  }

  updateDOMproperties() {
    const this_rect = this.dom.getBoundingClientRect();
    if (!this.parent.dom) {
      console.error(`Parent DOM is null`);
      return;
    }
    const parent_rect = this.parent.dom.getBoundingClientRect();
    this.connectorTotalOffsetX =
      (this_rect.left - parent_rect.left) / this.g.zoom +
      this_rect.width / 2 / this.g.zoom;
    this.connectorTotalOffsetY =
      (this_rect.top - parent_rect.top) / this.g.zoom +
      this_rect.height / 2 / this.g.zoom;
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

  filterDeletedLines(svgLines: lineObject[]) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i].requestDelete) {
        svgLines.splice(i, 1);
        i--;
      }
    }
  }

  deleteTmpLine(): void {
    this.deleteLine(0);
    this.renderAllLines(this.lineArray);
  }

  deleteLine(i: number): lineObject | undefined {
    if (this.lineArray.length == 0) {
      return undefined;
    }

    const svg = this.lineArray[i];
    svg.requestDelete = true;

    console.debug(`Deleting line: `, svg);
    console.debug(`Line array: `, this.lineArray, this.lineArray.length);
    return svg;
  }

  deleteAllLines() {
    for (const svg of this.lineArray) {
      svg.requestDelete = true;
    }
  }

  componentCursorDown(_: customCursorDownProp): void {
    console.debug(`Cursor down on connector ${this.gid}`, this.lineArray);
    const incomingLines = this.lineArray.filter(
      (e) => e.target === this && !e.requestDelete,
    );
    if (incomingLines.length > 0) {
      this.startPickUpLine(incomingLines[0]);
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
  }
}

export { ConnectorComponent };
