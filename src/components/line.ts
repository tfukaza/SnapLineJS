import { GlobalStats } from "../types";
import { ComponentBase } from "./base";
import { ConnectorComponent } from "./connector";
import { setDomStyle } from "../helper";
import { NodeComponent } from "./node";

/**
 * Connector components connect together nodes using lines.
 */
class LineComponent extends ComponentBase {
  x_start: number;
  y_start: number;
  x_end: number;
  y_end: number;

  // domSource: HTMLElement | SVGSVGElement;
  dom: HTMLElement | null;

  start: ConnectorComponent;
  target: ConnectorComponent | null;

  initialRender: boolean;
  requestDelete: boolean;
  completedDelete: boolean;

  constructor(
    x_start: number,
    y_start: number,
    x_end: number,
    y_end: number,
    dom: HTMLElement | null,
    parent: ConnectorComponent,
    globals: GlobalStats | null = null,
  ) {
    super(parent as unknown as NodeComponent, globals);
    // if (!dom) {
    //   // this.domSource = this.createDefaultLine();
    // } else {
    //   this.domSource = dom;
    // }
    this.dom = null;
    if (dom) {
      this.init(dom);
    }
    this.x_start = x_start;
    this.y_start = y_start;
    this.x_end = x_end;
    this.y_end = y_end;
    this.start = parent;
    this.target = null;
    this.initialRender = false;
    this.requestDelete = false;
    this.completedDelete = false;
  }

  init(dom: HTMLElement) {
    this.dom = dom;
    this.dom.id = this.gid;
    this.dom.setAttribute("data-snapline-type", "connector-line");
  }

  setLineStartAtConnector() {
    this.setLineStart(this.start.connectorX, this.start.connectorY);
  }

  setLineEndAtConnector() {
    if (this.target) {
      this.setLineEnd(this.target.connectorX, this.target.connectorY);
    }
  }

  setLineStart(x_start: number, y_start: number) {
    this.x_start = x_start;
    this.y_start = y_start;
  }

  setLineEnd(x_end: number, y_end: number) {
    this.x_end = x_end;
    this.y_end = y_end;
  }

  setLinePosition(
    x_start: number,
    y_start: number,
    x_end: number,
    y_end: number,
  ) {
    this.setLineStart(x_start, y_start);
    this.setLineEnd(x_end, y_end);
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

  /**
   * Creates a DOM by cloning this.dom and adds it to canvas.
   * @param dom The DOM element to create the line in.
   */
  createLine() {
    if (this.g == null) {
      return;
    }
    // console.debug(`Creating line from connector ${this.start.gid}`);
    // if (this.domSource) {
    //   const newDom = this.domSource.cloneNode(true) as HTMLElement;
    if (this.dom) {
      console.debug(`Adding line to canvas`);
      this.g.canvas!.appendChild(this.dom);
    }
    this.initialRender = true;
    //   this.dom = newDom;
    // }
  }

  delete(): void {
    if (this.g == null) {
      return;
    }
    if (this.dom) {
      this.g.canvas!.removeChild(this.dom);
    }
  }

  setDomStyle(dom: HTMLElement, style: any) {
    setDomStyle(dom, style);
  }

  renderLine() {}
}

export { LineComponent };
