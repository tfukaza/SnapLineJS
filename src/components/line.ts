import { GlobalManager } from "../global";
import { ElementObject } from "./object";
import { ConnectorComponent } from "./connector";

/**
 * Connector components connect together nodes using lines.
 */
class LineComponent extends ElementObject {
  endWorldX: number;
  endWorldY: number;

  start: ConnectorComponent;
  target: ConnectorComponent | null;

  initialRender: boolean;

  requestDelete: boolean;

  constructor(globals: GlobalManager, parent: ConnectorComponent) {
    super(globals, parent);

    this.endWorldX = 0;
    this.endWorldY = 0;

    this.start = parent;
    this.target = null;

    this.initialRender = false;
    this.requestDelete = false;

    // console.debug(`Created line ${this.gid}`);
  }

  setLineStartAtConnector() {
    // console.debug(
    //   "Setting line start at connector",
    //   this.start.worldX,
    //   this.start.worldY,
    // );
    this.setLineStart(this.start.worldX, this.start.worldY);
  }

  setLineEndAtConnector() {
    // console.debug("Setting line end at connector", this.target?.positionX);
    if (this.target) {
      this.setLineEnd(this.target.worldX, this.target.worldY);
    }
  }

  setLineStart(startPositionX: number, startPositionY: number) {
    // console.debug("Setting line start", startPositionX, startPositionY);
    this.worldX = startPositionX;
    this.worldY = startPositionY;
  }

  setLineEnd(endWorldX: number, endWorldY: number) {
    this.endWorldX = endWorldX;
    this.endWorldY = endWorldY;
    // this.submitRender();
  }

  setLinePosition(
    startWorldX: number,
    startWorldY: number,
    endWorldX: number,
    endWorldY: number,
  ) {
    this.setLineStart(startWorldX, startWorldY);
    this.setLineEnd(endWorldX, endWorldY);
  }

  // createDefaultLine(): SVGSVGElement {
  //   // const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  //   // const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  //   // svg.appendChild(line);
  //   // svg.setAttribute("data-snapline-type", "connector-svg");
  //   // line.setAttribute("data-snapline-type", "connector-line");
  //   // line.setAttribute("stroke-width", "4");
  //   // console.debug(`Created line from connector ${this.gid}`);
  //   // return svg;
  // }
}

export { LineComponent };
