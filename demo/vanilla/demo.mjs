import {
  SnapLine,
  ConnectorComponent,
  LineComponent,
} from "./lib/snapline.mjs";

const sl = new SnapLine();

let addNodeMenu = null;

let container = null;
let canvas = null;
let background = null;
let selection = null;

let lineStyle = "black";

document.addEventListener("DOMContentLoaded", function () {
  addNodeMenu = document.getElementById("addNodeButton");

  // document
  //   .getElementById("addNodeButton")
  //   .addEventListener("click", (e) => toggleMenu(e, "addNodeMenu"));

  document
    .getElementById("mathButton")
    .addEventListener("mouseup", (e) => addNode("sl-node-math", 0, 0));
  document
    .getElementById("lerpButton")
    .addEventListener("mouseup", (e) => addNode("sl-node-lerp", 0, 0));
  document
    .getElementById("printButton")
    .addEventListener("mouseup", (e) => addNode("sl-node-print", 0, 0));
  document
    .getElementById("constantButton")
    .addEventListener("mouseup", (e) => addNode("sl-node-number", 0, 0));

  document.getElementById("enable-zoom").addEventListener("change", (e) => {
    sl.g.camera.config.enableZoom = e.target.checked;
  });

  document.getElementById("zoom-min").addEventListener("input", (e) => {
    sl.g.camera.config.zoomBounds.min = e.target.value;
  });

  document.getElementById("zoom-max").addEventListener("input", (e) => {
    sl.g.camera.config.zoomBounds.max = e.target.value;
  });

  document.getElementById("enable-pan").addEventListener("change", (e) => {
    sl.g.camera.config.enablePan = e.target.checked;
  });

  document.getElementById("pan-top").addEventListener("input", (e) => {
    sl.g.camera.config.panBounds.top = e.target.value;
  });

  document.getElementById("pan-left").addEventListener("input", (e) => {
    sl.g.camera.config.panBounds.left = e.target.value;
  });

  document.getElementById("pan-right").addEventListener("input", (e) => {
    sl.g.camera.config.panBounds.right = e.target.value;
  });

  document.getElementById("pan-bottom").addEventListener("input", (e) => {
    sl.g.camera.config.panBounds.bottom = e.target.value;
  });

  document.getElementById("line-style").addEventListener("change", (e) => {
    lineStyle = e.target.value;
  });

  document
    .getElementById("lock-position-button")
    .addEventListener("click", (e) => {
      sl.g.focusNodes.forEach((node) => {
        node._config.lockPosition = true;
      });
    });

  document
    .getElementById("unlock-position-button")
    .addEventListener("click", (e) => {
      sl.g.focusNodes.forEach((node) => {
        node._config.lockPosition = false;
      });
    });

  container = document.getElementById("sl-canvas-container");
  canvas = document.getElementById("sl-canvas");
  background = document.getElementById("sl-background");
  selection = document.getElementById("sl-selection");

  sl.init(container, canvas, background, selection);

  let node1 = addNode("sl-node-number", -250, -150);
  let node2 = addNode("sl-node-number", -250, 0);
  let node3 = addNode("sl-node-math", 0, -150);
  let node4 = addNode("sl-node-print", 250, -150);

  node1
    .getConnector("output")
    .connectToConnector(node3.getConnector("input_1"), null);
  node2
    .getConnector("output")
    .connectToConnector(node3.getConnector("input_2"), null);
  // node3
  //   .getConnector("result")
  //   .connectToConnector(node4.getConnector("input"), null);
});

function addNode(name, x, y) {
  let ele = document.createElement(name);
  let node = sl.createNode(ele, x, y, {
    nodeClass: name.split("-")[2],
  });
  ele.initComponent(node);

  canvas.appendChild(ele);

  return node;
}

class CustomConnector extends ConnectorComponent {
  createLine(dom) {
    let lineClass = null;
    if (lineStyle == "curved") {
      lineClass = CurvedLine;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      svg.appendChild(path);
      path.setAttribute("stroke-width", "4");
      path.setAttribute("fill", "none");
      dom = svg;
    } else if (lineStyle == "zigzag") {
      lineClass = ZigZagLine;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      svg.appendChild(path);
      path.setAttribute("stroke-width", "4");
      path.setAttribute("fill", "none");
      dom = svg;
    } else {
      lineClass = StraightLine;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      svg.appendChild(line);
      line.setAttribute("stroke-width", "4");
      dom = svg;
    }
    return new lineClass(
      this.connectorX,
      this.connectorY,
      0,
      0,
      dom,
      this,
      this.g,
    );
  }
}

class StraightLine extends LineComponent {
  renderLine() {
    const svg = this.dom;
    this.setDomStyle(svg, {
      position: "absolute",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "transform",
      transform: `translate3d(${this.x_start}px, ${this.y_start}px, 0)`,
    });
    const line = this.dom.children[0];
    line.setAttribute("x1", "" + 0);
    line.setAttribute("y1", "" + 0);
    line.setAttribute("x2", "" + (this.x_end - this.x_start));
    line.setAttribute("y2", "" + (this.y_end - this.y_start));
  }
}

class CurvedLine extends LineComponent {
  // createDefaultLine() {
  //   // path.setAttribute("d", "M 0 0 C 100, 100 200, 0 300, 100");
  //   return svg;
  // }

  renderLine() {
    const svg = this.dom;
    this.setDomStyle(svg, {
      position: "absolute",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "transform",
      transform: `translate3d(${this.x_start}px, ${this.y_start}px, 0)`,
    });
    const path = this.dom.children[0];
    let dx = this.x_end - this.x_start;
    let dy = this.y_end - this.y_start;
    let x1 = Math.abs(dx / 2);
    let y1 = 0;
    let x2 = dx - Math.abs(dx / 2);
    let y2 = dy;
    let x3 = dx;
    let y3 = dy;
    path.setAttribute("d", `M 0,0 C ${x1}, ${y1} ${x2}, ${y2} ${x3}, ${y3}`);
  }
}

class ZigZagLine extends LineComponent {
  renderLine() {
    const svg = this.dom;
    this.setDomStyle(svg, {
      position: "absolute",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "transform",
      transform: `translate3d(${this.x_start}px, ${this.y_start}px, 0)`,
    });
    const path = this.dom.children[0];
    let dx = this.x_end - this.x_start;
    let dy = this.y_end - this.y_start;
    if (dx > 0) {
      let x1 = dx / 2;
      let y1 = 0;
      let x2 = dx / 2;
      let y2 = dy;
      let x3 = dx;
      let y3 = dy;
      path.setAttribute(
        "d",
        `M 0,0 L ${x1}, ${y1} L ${x2}, ${y2} L ${x3}, ${y3}`,
      );
    } else {
      let offset = 10;
      path.setAttribute(
        "d",
        `M 0,0 L ${offset}, 0 L ${offset}, ${dy / 2} L ${dx - offset}, ${dy / 2} L ${dx - offset}, ${dy} L ${dx} ${dy}`,
      );
    }
  }
}

// function addNode(e, name) {
//   // Create a new Web Component element based on the node type
//   let ele = document.createElement(name);
//   let node = sl.createNode(ele);

//   ele.initComponent(node);

//   sl.addNodeAtMouse(node, e);

//   toggleMenu(e, "addNodeMenu");
// }

customElements.define(
  "sl-node-math",
  class extends HTMLElement {
    constructor() {
      super();

      const templateClone = document
        .getElementById("node-math")
        .content.cloneNode(true);
      this._node = templateClone;
      this._input_1 = templateClone.querySelector("#input_1");
      this._input_2 = templateClone.querySelector("#input_2");
      this._form_1 = templateClone.querySelector("#form_1");
      this._form_2 = templateClone.querySelector("#form_2");
      this._operation = templateClone.querySelector("#operation");
      this._result = templateClone.querySelector("#result");

      this.templateClone = templateClone;
    }

    connectedCallback() {
      this.append(this.templateClone);
    }

    initComponent(nodeRef) {
      this._nodeRef = nodeRef;

      nodeRef.addConnector(this._input_1, "input_1", 1, false, CustomConnector);
      nodeRef.addSetPropCallback(this.calculateMath.bind(this), "input_1");
      nodeRef.addConnector(this._input_2, "input_2", 1, false, CustomConnector);
      nodeRef.addSetPropCallback(this.calculateMath.bind(this), "input_2");
      nodeRef.addConnector(this._result, "result", 0, true, CustomConnector);

      this._form_1.addEventListener("input", this.updateText1.bind(this));
      this._form_2.addEventListener("input", this.updateText2.bind(this));
      this._operation.addEventListener(
        "change",
        this.updateOperation.bind(this),
      );
      this.initMath.call(this);
    }

    calculateMath(_) {
      let input1 = +this._nodeRef.getProp("input_1");
      let input2 = +this._nodeRef.getProp("input_2");
      let operation = this._nodeRef.getProp("operation");

      let result = 0;

      if (operation == "+") {
        result = input1 + input2;
      } else if (operation == "-") {
        result = input1 - input2;
      } else if (operation == "*") {
        result = input1 * input2;
      } else {
        result = input1 / input2;
      }

      this._nodeRef.setProp("result", result);
    }

    updateText1(_) {
      this._nodeRef.setProp("input_1", this._form_1.value);
    }

    updateText2(_) {
      this._nodeRef.setProp("input_2", this._form_2.value);
    }

    updateOperation(_) {
      this._nodeRef.setProp("operation", this._operation.value);
      this.calculateMath.call(this);
    }

    initMath() {
      this._nodeRef.setProp("input_1", 0);
      this._nodeRef.setProp("input_2", 0);
      this._nodeRef.setProp("operation", "+");
      this.calculateMath.call(this);
    }
  },
);

customElements.define(
  "sl-node-lerp",
  class extends HTMLElement {
    constructor() {
      super();

      const templateClone = document
        .getElementById("node-lerp")
        .content.cloneNode(true);

      this._node = templateClone;
      this._input_1 = templateClone.querySelector("#input_1");
      this._input_2 = templateClone.querySelector("#input_2");
      this._form_1 = templateClone.querySelector("#form_1");
      this._form_2 = templateClone.querySelector("#form_2");
      this._alpha = templateClone.querySelector("#alpha");
      this._result = templateClone.querySelector("#result");

      this.templateClone = templateClone;
    }

    connectedCallback() {
      this.append(this.templateClone);
    }

    initComponent(nodeRef) {
      this._nodeRef = nodeRef;

      nodeRef.addConnector(this._input_1, "input_1", 1, false, CustomConnector);
      nodeRef.addSetPropCallback(this.calculateMath.bind(this), "input_1");
      nodeRef.addConnector(this._input_2, "input_2", 1, false, CustomConnector);
      nodeRef.addSetPropCallback(this.calculateMath.bind(this), "input_2");
      nodeRef.addConnector(this._result, "result", 0, true);

      this._form_1.addEventListener("input", this.updateText1.bind(this));
      this._form_2.addEventListener("input", this.updateText2.bind(this));
      this._alpha.addEventListener("input", this.updateAlpha.bind(this));
      this._alpha.addEventListener("mousedown", (e) => e.stopPropagation());
      this.initMath.call(this);
    }

    calculateMath(_) {
      let input1 = +this._nodeRef.getProp("input_1");
      let input2 = +this._nodeRef.getProp("input_2");
      let alpha = +this._nodeRef.getProp("alpha");

      let result = input1 + ((input2 - input1) * alpha) / 100;

      this._nodeRef.setProp("result", result);
    }

    updateText1(e) {
      this._nodeRef.setProp("input_1", this._form_1.value);
    }

    updateText2(e) {
      this._nodeRef.setProp("input_2", this._form_2.value);
    }

    updateAlpha(e) {
      this._nodeRef.setProp("alpha", this._alpha.value);
      this.calculateMath.call(this);
      e.stopPropagation();
    }

    initMath() {
      this._nodeRef.setProp("input_1", 0);
      this._nodeRef.setProp("input_2", 100);
      this._nodeRef.setProp("alpha", 50);
      this.calculateMath.call(this);
    }
  },
);

customElements.define(
  "sl-node-print",
  class extends HTMLElement {
    constructor() {
      super();

      const templateClone = document
        .getElementById("node-print")
        .content.cloneNode(true);

      this._node = templateClone;
      this._input = templateClone.querySelector("#input");
      this._print = templateClone.querySelector("#print");

      this.templateClone = templateClone;
    }

    connectedCallback() {
      this.append(this.templateClone);
    }

    initComponent(nodeRef) {
      this._nodeRef = nodeRef;
      nodeRef.addConnector(this._input, "input", 1, false, CustomConnector);
      nodeRef.addSetPropCallback(this.printValue.bind(this), "input");
    }

    printValue(value) {
      this._print.innerHTML = value;
    }
  },
);

customElements.define(
  "sl-node-number",
  class extends HTMLElement {
    constructor() {
      super();

      const templateClone = document
        .getElementById("node-number")
        .content.cloneNode(true);
      this._node = templateClone;
      this._value = templateClone.querySelector("#value");
      this._output = templateClone.querySelector("#output");

      this.templateClone = templateClone;
    }

    connectedCallback() {
      this.append(this._node);
    }

    initComponent(nodeRef) {
      this._nodeRef = nodeRef;
      nodeRef.addConnector(this._output, "output", 1, true, CustomConnector);

      this._value.addEventListener("input", this.updateText.bind(this));
    }

    updateText(e) {
      this._nodeRef.setProp("output", this._value.value);
    }
  },
);
