import SnapLine from "./lib/snapline.mjs";

const sl = new SnapLine();

let addNodeMenu = null;

document.addEventListener("DOMContentLoaded", function () {
  addNodeMenu = document.getElementById("addNodeButton");

  document
    .getElementById("addNodeButton")
    .addEventListener("click", (e) => toggleMenu(e, "addNodeMenu"));

  document
    .getElementById("mathButton")
    .addEventListener("mouseup", (e) => addNode(e, "node-math"));
  document
    .getElementById("lerpButton")
    .addEventListener("mouseup", (e) => addNode(e, "node-lerp"));
  document
    .getElementById("printButton")
    .addEventListener("mouseup", (e) => addNode(e, "node-print"));
  document
    .getElementById("constantButton")
    .addEventListener("mouseup", (e) => addNode(e, "node-constant"));

  const canvasContainer = document.getElementById("sl-canvas-container");
  const canvas = document.getElementById("sl-canvas");
  const background = document.getElementById("sl-background");
  const selection = document.getElementById("sl-selection");

  console.debug("initSnapLine", canvasContainer, canvas, background, selection);

  sl.initSnapLine(canvasContainer, canvas, background, selection);

  addNodeAuto("node-constant", -250, -150);
  addNodeAuto("node-constant", -250, 0);
  addNodeAuto("node-math", 0, -150);
  addNodeAuto("node-print", 250, -150);
});

document.addEventListener("click", function (e) {
  addNodeMenu.classList.remove("show-menu");
});

function toggleMenu(e, id) {
  if (id === "addNodeMenu") {
    addNodeMenu.classList.add("show-menu");
  }

  e.stopPropagation();
}

function addNodeAuto(name, x, y) {
  let ele = document.createElement(name);
  let node = sl.createNode(ele);
  ele.initComponent(node);
  sl.addNode(node, x, y);
}

function addNode(e, name) {
  // Create a new Web Component element based on the node type
  let ele = document.createElement(name);
  let node = sl.createNode(ele);

  ele.initComponent(node);

  sl.addNodeAtMouse(node, e);

  toggleMenu(e, "addNodeMenu");
}

customElements.define(
  "node-math",
  class extends HTMLElement {
    constructor() {
      super();

      const template = document.getElementById("node-math").content;
      const templateClone = template.cloneNode(true);

      console.debug("node-math", templateClone);

      this._node = templateClone.querySelector(".sl-node");
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
      nodeRef.initNode(this._node);
      nodeRef.addConnector(this._input_1, "input_1", 1, false);
      nodeRef.addPropSetCallback(this.calculateMath.bind(this), "input_1");
      nodeRef.addConnector(this._input_2, "input_2", 1, false);
      nodeRef.addPropSetCallback(this.calculateMath.bind(this), "input_2");
      nodeRef.addConnector(this._result, "result", 0, true);

      this._form_1.addEventListener("input", this.updateText1.bind(this));
      this._form_2.addEventListener("input", this.updateText2.bind(this));
      this._operation.addEventListener(
        "change",
        this.updateOperation.bind(this),
      );
      this.initMath.call(this);
    }

    calculateMath(_) {
      let input1 = +this._nodeRef.prop.input_1;
      let input2 = +this._nodeRef.prop.input_2;
      let operation = this._nodeRef.prop.operation;

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

      this._nodeRef.prop.result = result;
    }

    updateText1(_) {
      this._nodeRef.prop.input_1 = this._form_1.value;
    }

    updateText2(_) {
      this._nodeRef.prop.input_2 = this._form_2.value;
    }

    updateOperation(_) {
      this._nodeRef.prop.operation = this._operation.value;
      this.calculateMath.call(this);
    }

    initMath() {
      this._nodeRef.prop.input_1 = 0;
      this._nodeRef.prop.input_2 = 0;
      this._nodeRef.prop.operation = "+";
      this.calculateMath.call(this);
    }
  },
);

customElements.define(
  "node-lerp",
  class extends HTMLElement {
    constructor() {
      super();

      const template = document.getElementById("node-lerp").content;
      const templateClone = template.cloneNode(true);

      console.debug("node-math", templateClone);

      this._node = templateClone.querySelector(".sl-node");
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
      nodeRef.initNode(this._node);
      nodeRef.addConnector(this._input_1, "input_1", 1, false);
      nodeRef.addPropSetCallback(this.calculateMath.bind(this), "input_1");
      nodeRef.addConnector(this._input_2, "input_2", 1, false);
      nodeRef.addPropSetCallback(this.calculateMath.bind(this), "input_2");
      nodeRef.addConnector(this._result, "result", 0, true);

      this._form_1.addEventListener("input", this.updateText1.bind(this));
      this._form_2.addEventListener("input", this.updateText2.bind(this));
      this._alpha.addEventListener("input", this.updateAlpha.bind(this));
      this._alpha.addEventListener("mousedown", (e) => e.stopPropagation());
      this.initMath.call(this);
    }

    calculateMath(_) {
      let input1 = +this._nodeRef.prop.input_1;
      let input2 = +this._nodeRef.prop.input_2;
      let alpha = this._nodeRef.prop.alpha;

      let result = input1 + ((input2 - input1) * alpha) / 100;

      this._nodeRef.prop.result = result;
    }

    updateText1(e) {
      this._nodeRef.prop.input_1 = this._form_1.value;
    }

    updateText2(e) {
      this._nodeRef.prop.input_2 = this._form_2.value;
    }

    updateAlpha(e) {
      this._nodeRef.prop.alpha = this._alpha.value;
      this.calculateMath.call(this);
      e.stopPropagation();
    }

    initMath() {
      this._nodeRef.prop.input_1 = 0;
      this._nodeRef.prop.input_2 = 0;
      this._nodeRef.prop.alpha = 50;
      this.calculateMath.call(this);
    }
  },
);

customElements.define(
  "node-print",
  class extends HTMLElement {
    constructor() {
      super();

      const template = document.getElementById("node-print").content;
      const templateClone = template.cloneNode(true);

      this._node = templateClone.querySelector(".sl-node");
      this._input = templateClone.querySelector("#input");
      this._print = templateClone.querySelector("#print");

      this.templateClone = templateClone;
    }

    connectedCallback() {
      this.append(this.templateClone);
    }

    initComponent(nodeRef) {
      this._nodeRef = nodeRef;
      nodeRef.initNode(this._node);
      nodeRef.addConnector(this._input, "input", 1, false);
      nodeRef.addPropSetCallback(this.printValue.bind(this), "input");
    }

    printValue(value) {
      this._print.innerHTML = value;
    }
  },
);

customElements.define(
  "node-constant",
  class extends HTMLElement {
    constructor() {
      super();

      const template = document.getElementById("node-constant").content;
      const templateClone = template.cloneNode(true);

      this._node = templateClone.querySelector(".sl-node");
      this._value = templateClone.querySelector("#value");
      this._output = templateClone.querySelector("#output");

      this.templateClone = templateClone;
    }

    connectedCallback() {
      this.append(this.templateClone);
    }

    initComponent(nodeRef) {
      this._nodeRef = nodeRef;
      nodeRef.initNode(this._node);
      nodeRef.addConnector(this._output, "output", 1, true);

      this._value.addEventListener("input", this.updateText.bind(this));
    }

    updateText(e) {
      this._nodeRef.prop.output = this._value.value;
    }
  },
);
