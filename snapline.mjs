var O = Object.defineProperty;
var S = (i, n, t) => n in i ? O(i, n, { enumerable: !0, configurable: !0, writable: !0, value: t }) : i[n] = t;
var r = (i, n, t) => S(i, typeof n != "symbol" ? n + "" : n, t);
function C(i, n, t) {
  return i >= n && i <= t || i >= t && i <= n;
}
function _(i, n, t) {
  const o = t.zoom, e = t.zoom, s = -i * t.zoom + t.cameraWidth / 2, c = -n * t.zoom + t.cameraHeight / 2;
  return `${o},0,0,0,0,${e},0,0,0,0,1,0,${s},${c},0,1`;
}
var h = /* @__PURE__ */ ((i) => (i.none = "none", i.left = "left", i.middle = "middle", i.right = "right", i.invalid = "invalid", i))(h || {}), f = /* @__PURE__ */ ((i) => (i[i.node = 0] = "node", i[i.connector = 1] = "connector", i[i.line = 2] = "line", i[i.unspecified = 3] = "unspecified", i[i.inputConnector = 4] = "inputConnector", i[i.outputConnector = 5] = "outputConnector", i[i.invalid = 6] = "invalid", i))(f || {}), l = /* @__PURE__ */ ((i) => (i[i.container = 0] = "container", i[i.canvas = 1] = "canvas", i[i.background = 2] = "background", i[i.selectionBox = 3] = "selectionBox", i[i.invalid = 4] = "invalid", i))(l || {});
class x {
  /* Type of the object */
  constructor(n) {
    r(this, "g");
    /* Reference to the global stats object */
    r(this, "gid");
    /* Unique identifier for the object */
    r(this, "positionX");
    /* Position of the object in x-axis */
    r(this, "positionY");
    r(this, "type");
    this.g = n, this.gid = (++n.gid).toString(), this.positionX = 0, this.positionY = 0, this.type = f.unspecified;
  }
  /**
   * Binds the mousedown event to the given DOM element.
   * @param dom The DOM element to bind the function to
   */
  bindFunction(n) {
    n.onmousedown = this.domMouseDown.bind(this), n.ontouchstart = this.domTouchStart.bind(this);
  }
  domMouseDown(n) {
    this.domCursorDown({ button: n.button, clientX: n.clientX, clientY: n.clientY }), n.stopPropagation();
  }
  domTouchStart(n) {
    this.domCursorDown({ button: 0, clientX: n.touches[0].clientX, clientY: n.touches[0].clientY }), n.stopPropagation();
  }
  /**
   * Mouse down event common to all elements. 
   * Triggered when the dom of this object is clicked.
   * @param button: The mouse button that was clicked
   * @param clientX: The x-coordinate of the mouse click
   * @param clientY: The y-coordinate of the mouse click
   */
  domCursorDown(n) {
    let t = n.button, o = n.clientX, e = n.clientY;
    console.debug(`Base class mousedown event triggered on ${this.gid}!`), t == 0 ? this.g.currentMouseDown = h.left : t == 1 ? this.g.currentMouseDown = h.middle : t == 2 && (this.g.currentMouseDown = h.right), this.g.targetObject = this, this.g.mousedown_x = o, this.g.mousedown_y = e, this.g.dx = 0, this.g.dy = 0, this.g.dx_offset = 0, this.g.dy_offset = 0, this.componentCursorDown(n);
  }
  componentCursorDown(n) {
  }
  /**
   * Mouse up event common to all elements.
   * Triggered when the dom of this object is released.
   */
  domCursorUp() {
    console.debug(`Base class mouseup event triggered on ${this.gid}!`), this.componentCursorUp();
  }
  componentCursorUp() {
  }
  /**
   *  Focuses on the object.
   */
  onFocus() {
  }
  /**
   *  Removes focus from the object.
   */
  offFocus() {
  }
  /**
   *  Called for every frame when the object is being dragged.
   */
  onDrag() {
  }
  /**
   *  Called for every frame when the camera is being panned.
   */
  onPan() {
  }
  /**
   *  Called when the object is being deleted.
   */
  destroy() {
  }
}
class y extends x {
  constructor(t, o, e) {
    super(e);
    r(this, "parent");
    r(this, "config");
    r(this, "dom");
    this.config = t, this.parent = o, this.dom = null;
  }
}
class M extends y {
  /* Reference to the parent's prop object */
  constructor(t, o, e, s) {
    super(o, e, s);
    r(this, "name");
    /* Name of the component */
    r(this, "dom");
    /* The DOM element of the component */
    r(this, "prop");
    this.name = o.name, this.prop = e.prop, this.dom = t;
  }
  bindFunction(t) {
  }
  addInputUpdateListener(t, o) {
    this.dom.addEventListener(
      t,
      o.bind(this)
    );
  }
}
class w extends y {
  constructor(t, o, e, s) {
    super(o, e, s);
    r(this, "name");
    /* Name of the connector. This should describe the data associated with the connector */
    r(this, "connectorX");
    /* Location of the connector on canvas */
    r(this, "connectorY");
    r(this, "connectorTotalOffsetX");
    /* Location of the connector relative to the location of parent Node */
    r(this, "connectorTotalOffsetY");
    r(this, "prop");
    /* Reference to the parent's prop object */
    r(this, "svgLines");
    r(this, "type", f.connector);
    r(this, "dom");
    r(this, "parent");
    this.connectorX = 0, this.connectorY = 0, this.connectorTotalOffsetX = 0, this.connectorTotalOffsetY = 0, this.dom = t, this.parent = e, this.prop = e.prop, o.name ? this.name = o.name : (s.gid++, this.name = s.gid.toString()), this.g.globalNodeTable[this.gid] = this, this.dom.setAttribute("sl-gid", this.gid.toString()), this.svgLines = [], this.bindFunction(this.dom);
  }
  pxToInt(t) {
    return parseInt(t.substring(0, t.length - 2));
  }
  getComputed(t, o) {
    const e = window.getComputedStyle(t, null).getPropertyValue(o);
    return e.endsWith("px") ? this.pxToInt(e) : parseInt(e);
  }
  updateDOMproperties() {
    let o = this.dom.getBoundingClientRect(), e = this.parent.dom.getBoundingClientRect();
    this.connectorTotalOffsetX = (o.left - e.left) / this.g.zoom + o.width / 2 / this.g.zoom, this.connectorTotalOffsetY = (o.top - e.top) / this.g.zoom + o.height / 2 / this.g.zoom;
  }
  /* SVG line functions */
  createLineDOM() {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "svg"), o = document.createElementNS("http://www.w3.org/2000/svg", "line");
    return t.appendChild(o), t.classList.add("sl-connector-svg"), o.classList.add("sl-connector-line"), o.setAttribute("stroke-width", "4"), this.g.canvas.appendChild(t), t;
  }
  setStyle(t, o) {
    if (t)
      for (const e in o)
        t.style[e] = o[e];
  }
  renderLinePosition(t) {
    let o = t.svg;
    if (!o)
      return;
    this.setStyle(o, {
      position: "absolute",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "transform",
      transform: `translate3d(${t.connector_x}px, ${t.connector_y}px, 0)`
    });
    let e = o.children[0];
    e.setAttribute("x1", "0"), e.setAttribute("y1", "0"), e.setAttribute("x2", "" + t.x2), e.setAttribute("y2", "" + t.y2);
  }
  /* Deletes the line from the svgLines array */
  deleteLine(t) {
    if (this.svgLines.length > 0) {
      const o = this.svgLines[t];
      o.requestDelete = !0;
    }
  }
  deleteAllLines() {
    for (const t of this.svgLines)
      t.requestDelete = !0;
  }
}
class L extends w {
  constructor(t, o, e, s) {
    super(t, o, e, s);
    //inputDOM: HTMLElement | null;       // Reference to the UI element where the user enters the value
    // inter: InputInterface;
    r(this, "type", f.inputConnector);
    r(this, "peerOutput");
    r(this, "updateFunction", () => {
      console.debug("Update function not set for input connector");
    });
    this.peerOutput = null;
  }
  renderAllLines(t) {
    var o;
    (o = this.peerOutput) == null || o.renderAllLines(t);
  }
  /* Override the default domMouseDown and domTouchStart functions, 
   * so the event is not propagated to the parent node */
  // domTouchStart(e: TouchEvent): void {
  //     this.domCursorDown({ button: 0, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
  //     e.stopPropagation();
  // }
  // domMouseDown(e: MouseEvent): void {
  //     this.domCursorDown({ button: e.button, clientX: e.clientX, clientY: e.clientY });
  //     e.stopPropagation();
  // }
  domCursorDown(t) {
    console.debug(`ConnectorComponent mousedown event triggered on ${this.gid}!`);
    let o = t.button, e = t.clientX, s = t.clientY;
    this.peerOutput && (super.domCursorDown({ button: o, clientX: e, clientY: s }), this.g.targetObject = this.peerOutput, this.g.dx_offset = (this.connectorX - this.peerOutput.connectorX) * this.g.zoom, this.g.dy_offset = (this.connectorY - this.peerOutput.connectorY) * this.g.zoom, this.g.dx = this.g.dx_offset, this.g.dy = this.g.dy_offset, this.peerOutput.componentCursorDown({ button: o, clientX: e, clientY: s }), this.peerOutput.disconnectFromInput(this));
  }
  updateConnectorPosition() {
    this.connectorX = this.parent.positionX + this.connectorTotalOffsetX, this.connectorY = this.parent.positionY + this.connectorTotalOffsetY;
  }
  disconnectFromOutput() {
    this.peerOutput = null;
  }
  connectToOutput(t) {
    this.peerOutput = t;
  }
  nodeDrag() {
    this.updateConnectorPosition(), this.peerOutput && this.peerOutput.nodeDrag();
  }
  destroy() {
    this.peerOutput && this.peerOutput.disconnectFromInput(this);
  }
}
class N extends w {
  constructor(t, o, e, s) {
    super(t, o, e, s);
    r(this, "val");
    r(this, "peerInputs", []);
    r(this, "type", f.outputConnector);
    this.val = null, this.svgLines = [], this.dom = t, this.renderAllLines = this.renderAllLines.bind(this);
  }
  connectToInput(t) {
    if (console.debug("Connecting to input: ", t), this === t.peerOutput) {
      console.debug("Already connected");
      return;
    }
    t.peerOutput && (console.debug("Disconnecting from: ", t.peerOutput), t.peerOutput.disconnectFromInput(t), t.disconnectFromOutput()), console.debug("Now connecting to: ", t), t.connectToOutput(this), this.peerInputs.push(t), this.updateConnectorPosition(), this.svgLines[0].to = t, this.g.globalLines.push(this.svgLines[0]);
  }
  disconnectFromInput(t) {
    console.debug("Disconnecting from input: ", t);
    for (const o of this.svgLines)
      if (o.to == t) {
        o.requestDelete = !0;
        break;
      }
    t.disconnectFromOutput(), this.peerInputs = this.peerInputs.filter((o) => o.gid != t.gid);
  }
  updateConnectorPosition() {
    this.connectorX = this.parent.positionX + this.connectorTotalOffsetX, this.connectorY = this.parent.positionY + this.connectorTotalOffsetY;
  }
  setLineXYPosition(t, o, e) {
    t.x2 = o, t.y2 = e;
  }
  refreshLinePosition(t) {
    t.connector_x = this.connectorX, t.connector_y = this.connectorY, t.to ? this.setLineXYPosition(t, t.to.connectorX - this.connectorX, t.to.connectorY - this.connectorY) : this.setLineXYPosition(t, this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
  }
  /* Called when lines need to be updated */
  refreshAllLinePositions() {
    this.updateConnectorPosition();
    for (const t of this.svgLines)
      this.refreshLinePosition(t);
  }
  filterDeletedLines(t) {
    for (let o = 0; o < t.length; o++)
      t[o].requestDelete && (t.splice(o, 1), o--);
  }
  renderAllLines(t) {
    console.debug(`Rendering all lines for ${this.gid}`, t);
    for (const o of t) {
      if (o.svg) {
        if (o.requestDelete) {
          console.warn("Deleting line: ", o), this.g.canvas.removeChild(o.svg);
          continue;
        }
      } else {
        let e = this.createLineDOM();
        o.svg = e;
      }
      o.connector_x = this.connectorX, o.connector_y = this.connectorY, o.to && (o.x2 = o.to.connectorX - this.connectorX, o.y2 = o.to.connectorY - this.connectorY), o.svg.style.transform = `translate3d(${this.connectorX}px, ${this.connectorY}px, 0)`, this.renderLinePosition(o);
    }
    this.filterDeletedLines(t);
  }
  setRenderLineCallback(t) {
    this.renderAllLines = (o) => {
      this.filterDeletedLines(o), t(o);
    };
  }
  /** Called when a user clicks on the output connector
   * @param prop: The properties of the mouse event
   */
  componentCursorDown(t) {
    console.debug(`ConnectorComponent mousedown event triggered on ${this.gid}!`), this.svgLines.unshift({
      svg: null,
      to: null,
      from: this,
      connector_x: this.connectorX,
      connector_y: this.connectorY,
      x2: 0,
      y2: 0,
      connector: this,
      requestDelete: !1
    }), console.debug("svgLines: ", this.svgLines), this.refreshAllLinePositions();
  }
  /* Called when the user drags the lines extending from the output connector */
  onDrag() {
    let t = 9999, o = 0, e = 0;
    const s = this.g.hoverDOM;
    if (console.debug("connector onDrag", s), this.svgLines.length == 0) {
      console.error("Error: svgLines is empty");
      return;
    }
    if (s && s.classList.contains("sl-input-connector")) {
      const c = s.getAttribute("sl-gid");
      if (!c) return;
      console.debug("Hovering over input connector: ", c);
      const a = this.g.globalNodeTable[c];
      a.updateConnectorPosition(), o = a.connectorX, e = a.connectorY, t = Math.sqrt(Math.pow(this.connectorX + this.g.dx / this.g.zoom - o, 2) + Math.pow(this.connectorY + this.g.dy / this.g.zoom - e, 2)), t < 40 ? this.setLineXYPosition(this.svgLines[0], o - this.connectorX, e - this.connectorY) : this.setLineXYPosition(this.svgLines[0], this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
    } else
      this.setLineXYPosition(this.svgLines[0], this.g.dx / this.g.zoom, this.g.dy / this.g.zoom);
  }
  nodeDrag() {
    this.refreshAllLinePositions();
  }
  /* Called when the user releases the mouse button */
  componentCursorUp() {
    console.debug("connector domMouseUp");
    const t = this.g.hoverDOM;
    if (t && t.classList.contains("sl-input-connector")) {
      const o = t.getAttribute("sl-gid");
      if (console.debug("Connected to input connector: ", o), !o) {
        console.error("Error: gid is null");
        return;
      }
      const e = this.g.globalNodeTable[o];
      this.connectToInput(e), e.prop[e.name] = this.prop[this.name], e.updateFunction(), this.setLineXYPosition(this.svgLines[0], e.connectorX - this.connectorX, e.connectorY - this.connectorY);
    } else {
      let o = this.deleteLine(0);
      o && (o.requestDelete = !0), this.renderAllLines(this.svgLines);
    }
  }
  getValue() {
    return this.parent.exec(), this.val;
  }
  destroy() {
    for (const t of this.peerInputs)
      this.disconnectFromInput(t);
  }
}
class b extends x {
  /* CSS style of the node */
  constructor(t, o) {
    super(o);
    r(this, "type", f.node);
    r(this, "nodeType");
    /* Type of the node */
    r(this, "dom");
    /* The DOM element of the node */
    r(this, "inputConnectors");
    /* Dictionary of InputConnector classes for each input connector */
    r(this, "outputConnectors");
    /* Dictionary of OutputConnector classes for each output connector */
    r(this, "components");
    /* List iof all components in the node, except for connectors */
    r(this, "nodeWidth", 0);
    /* Size of the node */
    r(this, "nodeHeight", 0);
    r(this, "dragStartX", 0);
    /* Initial position of the node when dragging */
    r(this, "dragStartY", 0);
    r(this, "overlapping");
    /* Line that the node is overlapping with */
    r(this, "freeze");
    /* If true, the node cannot be moved */
    r(this, "prop");
    /* A dictionary of all data stored in the node */
    r(this, "propFunc");
    /* A dictionary of all functions stored in the node */
    r(this, "nodeStyle");
    this.nodeType = "", this.dom = t, this.inputConnectors = {}, this.outputConnectors = {}, this.components = {}, this.dragStartX = this.positionX, this.dragStartY = this.positionY, this.overlapping = null, this.freeze = !1, this.prop = {}, this.prop = new Proxy(this.prop, {
      set: (e, s, c) => {
        if (s = s.toString(), e[s] = c, s in this.outputConnectors) {
          console.debug(`Update all nodes connected to ${s}`);
          const a = this.outputConnectors[s].peerInputs;
          if (a)
            for (const u of a)
              u.parent.prop[u.name] = c;
        } else s in this.inputConnectors && (console.debug(`Call all functions connected to ${s}`), s in this.propFunc && this.propFunc[s](c));
        return !0;
      }
    }), this.propFunc = {}, this.setNodeStyle({
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left"
    }), this.g.globalNodeList.push(this), this.initNode = this.initNode.bind(this), this.addInputConnector = this.addInputConnector.bind(this), this.addOutputConnector = this.addOutputConnector.bind(this), this.addInputForm = this.addInputForm.bind(this), this.addPropSetFunction = this.addPropSetFunction.bind(this), this.setRenderNodeCallback = this.setRenderNodeCallback.bind(this);
  }
  initNode(t) {
    this.dom = t, this.dom.id = this.gid, this.renderNode(this.nodeStyle), this.bindFunction(this.dom), new ResizeObserver(() => {
      this.updateDOMproperties();
    }).observe(this.dom);
  }
  /**
   * Updates the DOM properties of the node, such as height, width, etc.
   * Also updates the DOM properties of all input and output connectors.
   * Called when the node is first created, and when the node is resized.
   * @returns
   */
  updateDOMproperties() {
    this.nodeHeight = this.dom.offsetHeight, this.nodeWidth = this.dom.offsetWidth;
    for (const t of Object.values(this.inputConnectors))
      t.updateDOMproperties();
    for (const t of Object.values(this.outputConnectors))
      t.updateDOMproperties();
  }
  setNodeStyle(t) {
    this.nodeStyle = Object.assign({}, this.nodeStyle, t);
  }
  renderNode(t) {
    for (const o in t)
      o[0] != "_" && (this.dom.style[o] = t[o]);
    t._focus ? this.dom.classList.add("focus") : this.dom.classList.remove("focus");
    for (const o of Object.values(this.outputConnectors))
      o.renderAllLines(o.svgLines);
    for (const o of Object.values(this.inputConnectors)) {
      let e = o.peerOutput;
      if (!e) continue;
      let s = e.parent.outputConnectors;
      for (const c of Object.values(s))
        c.renderAllLines(c.svgLines);
    }
  }
  setRenderNodeCallback(t) {
    this.renderNode = (o) => {
      t(o);
      for (const e of Object.values(this.outputConnectors))
        e.renderAllLines(e.svgLines);
      for (const e of Object.values(this.inputConnectors)) {
        let s = e.peerOutput;
        if (!s) continue;
        let c = s.parent.outputConnectors;
        for (const a of Object.values(c))
          a.renderAllLines(a.svgLines);
      }
    };
  }
  addNodeToCanvas(t, o) {
    this.positionX = t, this.positionY = o, this.nodeWidth = this.dom.offsetWidth, this.nodeHeight = this.dom.offsetHeight, this.setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
    }), this.renderNode(this.nodeStyle), this.updateDOMproperties(), this.g.canvas.appendChild(this.dom);
  }
  addOutputConnector(t, o) {
    const e = new N(t, { name: o }, this, this.g);
    return this.outputConnectors[o] = e, this.prop[o] = null, e;
  }
  addInputConnector(t, o) {
    const e = new L(t, { name: o }, this, this.g);
    return this.inputConnectors[o] = e, this.prop[o] = null, e;
  }
  addInputForm(t, o) {
    const e = new M(t, { name: o }, this, this.g);
    return this.prop[o] = null, e;
  }
  addPropSetFunction(t, o) {
    this.propFunc[o] = t;
  }
  findInput(t) {
    for (const o of Object.values(this.inputConnectors))
      if (o.name == t)
        return o;
    return null;
  }
  findOutput(t) {
    for (const o of Object.values(this.outputConnectors))
      if (o.name == t)
        return o;
    return null;
  }
  setStartPositions() {
    this.dragStartX = this.positionX, this.dragStartY = this.positionY;
  }
  componentCursorDown(t) {
    console.debug(`Node class mousedown event triggered on ${this.gid}!`);
    let o = !1;
    for (let e = 0; e < this.g.focusNodes.length; e++)
      if (this.g.focusNodes[e].gid == this.gid) {
        o = !0;
        break;
      }
    if (o)
      for (let e = 0; e < this.g.focusNodes.length; e++)
        this.g.focusNodes[e].setStartPositions();
    else {
      for (let e = 0; e < this.g.focusNodes.length; e++)
        this.g.focusNodes[e].offFocus();
      this.g.focusNodes = [this], this.onFocus();
    }
    this.setStartPositions();
  }
  componentCursorUp() {
    if (this.freeze) return;
    if (this.positionX = this.dragStartX + this.g.dx / this.g.zoom, this.positionY = this.dragStartY + this.g.dy / this.g.zoom, console.debug("Mouse has moved: " + this.g.mouseHasMoved), !this.g.mouseHasMoved && this.g.targetObject && this.g.targetObject.gid == this.gid) {
      console.debug("Mouse has not moved");
      for (let c = 0; c < this.g.focusNodes.length; c++)
        this.g.focusNodes[c].offFocus();
      this.g.focusNodes = [this], this.onFocus();
      return;
    }
    if (this.renderNode(this.nodeStyle), this.overlapping == null)
      return;
    const t = this.overlapping.from, o = this.overlapping.to, e = Object.values(this.inputConnectors)[0], s = Object.values(this.outputConnectors)[0];
    o && (t.disconnectFromInput(o), t.connectToInput(e), s.connectToInput(o));
  }
  /**
   * Fired every time requestAnimationFrame is called,
   * if this object is being dragged.
   * It reads the internal states like current mouse position,
   * and updates the DOM element accordingly.
   * @returns 
   */
  onDrag() {
    if (this.freeze) return;
    this.positionX = this.dragStartX + this.g.dx / this.g.zoom, this.positionY = this.dragStartY + this.g.dy / this.g.zoom, this.setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
    });
    for (const o of Object.values(this.inputConnectors))
      o.nodeDrag();
    for (const o of Object.values(this.outputConnectors))
      o.nodeDrag();
    if (this.overlapping = null, Object.keys(this.inputConnectors).length == 0 && Object.keys(this.outputConnectors).length == 0) return;
    let t = 9999;
    for (const o of this.g.globalLines)
      C(this.positionX + this.nodeWidth / 2, o.connector_x, o.connector_x + o.x2) && C(this.positionY + this.nodeHeight / 2, o.connector_y, o.connector_y + o.y2) && (o.y2 + o.connector_x) / 2 < t && (this.overlapping = o, t = (o.y2 + this.positionY) / 2);
    this.overlapping;
  }
  onFocus() {
    this.setNodeStyle({ _focus: !0 }), this.renderNode(this.nodeStyle);
  }
  offFocus() {
    this.setNodeStyle({ _focus: !1 }), this.renderNode(this.nodeStyle);
  }
  evaluate(t) {
    console.debug("Update all nodes connected to " + t);
    const o = this.outputConnectors[t];
    if (o)
      for (const e of o.peerInputs)
        console.debug(`Update input ${e.name} connected to ${t} with value ${this.prop[t]}`), e.prop[e.name] = this.prop[t], e.updateFunction();
  }
  exec() {
  }
  destroy() {
    var t;
    (t = this.g.canvas) == null || t.removeChild(this.dom);
    for (const o of Object.values(this.inputConnectors))
      o.destroy();
    for (const o of Object.values(this.outputConnectors))
      o.destroy();
  }
}
class X {
  // Style for the background element
  //requestLineRender: OutputConnector | null = null;   // If set to an OutputConnector, it will render all lines for that connector
  constructor() {
    r(this, "g");
    // Global state
    r(this, "containerStyle", {});
    // Style for the container element
    r(this, "canvasStyle", {});
    // Style for the canvas element
    r(this, "selectionBoxStyle", {});
    // Style for the selection box element
    r(this, "backgroundStyle", {});
    this.g = null, this.containerStyle = {
      position: "relative",
      overflow: "hidden"
    }, this.selectionBoxStyle = {
      position: "absolute",
      pointerEvents: "none"
    }, this.initSnapLine = this.initSnapLine.bind(this), this.setRenderCanvasCallback = this.setRenderCanvasCallback.bind(this), this.setRenderContainerCallback = this.setRenderContainerCallback.bind(this), this.setRenderBackgroundCallback = this.setRenderBackgroundCallback.bind(this), this.setRenderSelectionBoxCallback = this.setRenderSelectionBoxCallback.bind(this);
  }
  initSnapLine(n, t, o, e) {
    this.g = {
      canvas: t,
      canvasContainer: n,
      canvasBackground: o,
      selectionBox: e,
      currentMouseDown: h.none,
      mousedown_x: 0,
      mousedown_y: 0,
      mouse_x: 0,
      mouse_y: 0,
      mouse_x_world: 0,
      mouse_y_world: 0,
      camera_pan_start_x: 0,
      camera_pan_start_y: 0,
      dx: 0,
      dy: 0,
      dx_offset: 0,
      dy_offset: 0,
      overrideDrag: !1,
      camera_x: 0,
      camera_y: 0,
      zoom: 1,
      cameraWidth: 0,
      cameraHeight: 0,
      targetObject: null,
      focusNodes: [],
      hoverDOM: null,
      gid: 0,
      globalLines: [],
      globalNodeList: [],
      globalNodeTable: {},
      mouseHasMoved: !1,
      ignoreMouseUp: !1,
      prevTouches: null,
      prevSingleTouchTime: 0,
      snapline: this
    };
    const s = this.g;
    s.cameraWidth = s.canvasContainer.clientWidth, s.cameraHeight = s.canvasContainer.clientHeight, console.debug(`Canvas size: ${s.cameraWidth}x${s.cameraHeight}`), this.setCanvasElementStyle(l.canvas, {
      position: "relative",
      top: "0px",
      left: "0px",
      transform: `translate(${s.cameraWidth / 2}px, ${s.cameraHeight / 2}px)`,
      width: "0px",
      height: "0px"
    }), this.setCanvasElementStyle(l.background, {
      width: s.cameraWidth * 10 + "px",
      height: s.cameraHeight * 10 + "px",
      transform: `translate(${-s.cameraWidth * 5}px, ${-s.cameraHeight * 5}px)`,
      transformOrigin: "center",
      zIndex: "0",
      position: "absolute"
    }), this.renderContainer(this.containerStyle), this.renderCanvas(this.canvasStyle), this.renderBackground(this.backgroundStyle), this.renderSelectionBox(this.selectionBoxStyle), s.canvasContainer.addEventListener("mouseup", this.onMouseUp.bind(this)), s.canvasContainer.addEventListener("mousemove", this.onMouseMove.bind(this)), s.canvasContainer.addEventListener("mousedown", this.onMouseDown.bind(this)), s.canvasContainer.addEventListener("wheel", this.onWheel.bind(this)), s.canvasContainer.addEventListener("keydown", this.onKeyDown.bind(this)), document.addEventListener("mousemove", this.onMouseMove.bind(this)), document.addEventListener("mouseup", this.onMouseUp.bind(this)), s.canvasContainer.addEventListener("touchstart", this.onTouchStart.bind(this)), s.canvasContainer.addEventListener("touchmove", this.onTouchMove.bind(this)), s.canvasContainer.addEventListener("touchend", this.onTouchEnd.bind(this)), window.requestAnimationFrame(this.step.bind(this));
  }
  setCanvasElementStyle(n, t) {
    switch (n) {
      case l.canvas:
        this.canvasStyle = Object.assign({}, this.canvasStyle, t), this.canvasStyle._requestUpdate = "true";
        break;
      case l.container:
        this.containerStyle = Object.assign({}, this.containerStyle, t), this.containerStyle._requestUpdate = "true";
        break;
      case l.background:
        this.backgroundStyle = Object.assign({}, this.backgroundStyle, t), this.backgroundStyle._requestUpdate = "true";
        break;
      case l.selectionBox:
        this.selectionBoxStyle = Object.assign({}, this.selectionBoxStyle, t), this.selectionBoxStyle._requestUpdate = "true";
        break;
      default:
        console.error("Invalid dom type: " + n);
        return;
    }
  }
  renderContainer(n) {
    for (const t in n)
      this.g.canvasContainer.style[t] = n[t];
  }
  renderCanvas(n) {
    for (const t in n)
      this.g.canvas.style[t] = n[t];
  }
  renderBackground(n) {
    for (const t in n)
      this.g.canvasBackground.style[t] = n[t];
  }
  renderSelectionBox(n) {
    for (const t in n)
      this.g.selectionBox.style[t] = n[t];
  }
  setRenderContainerCallback(n) {
    this.renderContainer = n;
  }
  setRenderCanvasCallback(n) {
    this.renderCanvas = n;
  }
  setRenderBackgroundCallback(n) {
    this.renderBackground = n;
  }
  setRenderSelectionBoxCallback(n) {
    this.renderSelectionBox = n;
  }
  /* Event handlers */
  onTouchStart(n) {
    if (n.touches.length > 1) {
      this.g.prevTouches.length == 1 && this.onCursorUp(), this.g.currentMouseDown = h.middle;
      let t = (n.touches[0].clientX + n.touches[1].clientX) / 2, o = (n.touches[0].clientY + n.touches[1].clientY) / 2;
      this.onCursorDown(h.middle, t, o), this.g.prevTouches = n.touches;
      return;
    }
    this.onCursorDown(h.left, n.touches[0].clientX, n.touches[0].clientY);
  }
  onMouseDown(n) {
    let t = h.invalid;
    switch (n.button) {
      case 0:
        t = h.left;
        break;
      case 1:
        t = h.middle;
        break;
      default:
        return;
    }
    this.onCursorDown(t, n.clientX, n.clientY);
  }
  /**
   * Event handler when mouse or touchscreen is pressed.
   * Can be called by mousedown ot touch start.
   * Because most elements have stopPropagation on mousedown,
   * this will only be called if the user clicks on the canvas background.
   * 
   * Usually this means the user is performing a camera pan or selecting multiple nodes.
   * 
   * @param button: The mouse button that was pressed.
   * @param clientX: The x position of the cursor.
   * @param clientY: The y position of the cursor.
   * @returns 
   */
  onCursorDown(n, t, o) {
    this.g.currentMouseDown = n, console.debug("Cursor down: " + n), this.g.targetObject && this.g.targetObject.type == f.outputConnector && (console.debug("Cursor down with tmp line"), this.g.targetObject.domCursorUp());
    const e = this.g;
    if (!e.overrideDrag) {
      console.debug("Cursor ddown"), e.currentMouseDown != h.none && this.setCanvasElementStyle(l.selectionBox, {
        width: "0px",
        height: "0px",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        opacity: "0"
      }), e.focusNodes = [];
      for (const s of e.globalNodeList)
        s.offFocus();
      e.mousedown_x = t, e.mousedown_y = o, e.camera_pan_start_x = e.camera_x, e.camera_pan_start_y = e.camera_y;
    }
  }
  onTouchMove(n) {
    if (n.touches.length <= 0) {
      let m = document.elementFromPoint(n.touches[0].clientX, n.touches[0].clientY);
      this.onCursorMove(m, n.touches[0].clientX, n.touches[0].clientY), this.g.prevTouches = n.touches;
      return;
    }
    if (this.g.prevTouches == null || this.g.prevTouches.length != 2) {
      n.touches.length == 2 && (this.g.prevTouches = n.touches);
      return;
    }
    let t = n.touches[0], o = n.touches[1], e = null, s = null;
    for (let m = 0; m < n.touches.length; m++)
      t.identifier == this.g.prevTouches[m].identifier ? e = this.g.prevTouches[m] : o.identifier == this.g.prevTouches[m].identifier && (s = this.g.prevTouches[m]);
    let c = Math.sqrt(Math.pow(t.clientX - o.clientX, 2) + Math.pow(t.clientY - o.clientY, 2)), a = Math.sqrt(Math.pow(e.clientX - s.clientX, 2) + Math.pow(e.clientY - s.clientY, 2)), u = -2 * (c - a), v = (t.clientX + o.clientX) / 2, g = (t.clientY + o.clientY) / 2, p = v - this.g.canvasContainer.offsetLeft, d = g - this.g.canvasContainer.offsetTop;
    this.onCursorMove(document.elementFromPoint(p, d), p, d), this.g.mouse_x = p, this.g.mouse_y = d, this.onZoom(u), this.g.prevTouches = n.touches;
  }
  onMouseMove(n) {
    this.onCursorMove(n.target, n.clientX, n.clientY);
  }
  /**
   * Handle cursor move events.
   * This usually means the camera is panned or a selection box is being drawn.
   * 
   * @param target 
   * @param clientX 
   * @param clientY 
   * @returns 
   */
  onCursorMove(n, t, o) {
    const e = this.g;
    console.debug("Cursor move"), e.hoverDOM = n, e.mouse_x = t - e.canvasContainer.offsetLeft, e.mouse_y = o - e.canvasContainer.offsetTop;
    let s = (e.mouse_x - e.cameraWidth / 2) / e.zoom + e.camera_x, c = (e.mouse_y - e.cameraHeight / 2) / e.zoom + e.camera_y;
    if (e.mouse_x_world = s, e.mouse_y_world = c, e.dx = t - e.mousedown_x + e.dx_offset, e.dy = o - e.mousedown_y + e.dy_offset, !(e.currentMouseDown == h.none || e.overrideDrag))
      if ((e.dx !== 0 || e.dy !== 0) && (e.mouseHasMoved = !0), e.targetObject == null) {
        if (e.currentMouseDown == h.middle)
          e.camera_x = e.camera_pan_start_x - e.dx / e.zoom, e.camera_y = e.camera_pan_start_y - e.dy / e.zoom, this.setCanvasElementStyle(l.canvas, {
            transform: `matrix3d(${_(e.camera_x, e.camera_y, e)})`,
            cursor: "grabbing"
          }), this.setCanvasElementStyle(l.background, {
            transform: `translate(${e.camera_x + -e.cameraWidth * 5}px, ${e.camera_y + -e.cameraHeight * 5}px)`,
            backgroundPosition: `${-e.camera_x}px ${-e.camera_y}px`
          });
        else if (e.currentMouseDown == h.left) {
          this.setCanvasElementStyle(l.selectionBox, {
            width: Math.abs(e.dx) + "px",
            height: Math.abs(e.dy) + "px",
            left: Math.min(e.mousedown_x, e.mouse_x) + "px",
            top: Math.min(e.mousedown_y, e.mouse_y) + "px",
            opacity: "1"
          });
          let a = (Math.min(e.mousedown_x, e.mouse_x) - e.cameraWidth / 2) / e.zoom + e.camera_x, u = (Math.min(e.mousedown_y, e.mouse_y) - e.cameraHeight / 2) / e.zoom + e.camera_y, v = (Math.max(s, e.mousedown_x, e.mouse_x) - e.cameraWidth / 2) / e.zoom + e.camera_x, g = (Math.max(c, e.mousedown_y, e.mouse_y) - e.cameraHeight / 2) / e.zoom + e.camera_y, p = [];
          for (const d of e.globalNodeList)
            d.positionX + d.nodeWidth > a && d.positionX < v && d.positionY + d.nodeHeight > u && d.positionY < g ? (d.onFocus(), p.push(d)) : d.offFocus();
          e.focusNodes = p;
        }
      } else if (e.targetObject.type == f.node)
        for (const a of e.focusNodes)
          a.onDrag();
      else
        e.targetObject.onDrag();
  }
  onMouseUp(n) {
    this.onCursorUp();
  }
  onTouchEnd(n) {
    this.onCursorUp();
  }
  onCursorUp() {
    const n = this.g;
    if (console.debug("Cursor up"), n.ignoreMouseUp) {
      n.ignoreMouseUp = !1;
      return;
    }
    if (n.currentMouseDown == h.left)
      if (n.targetObject == null)
        this.setCanvasElementStyle(l.selectionBox, {
          width: "0px",
          height: "0px",
          left: "0px",
          top: "0px"
        });
      else if (n.targetObject.type == f.node)
        for (const t of n.focusNodes)
          console.debug("Mouse up with target node: " + t.gid), t.domCursorUp();
      else
        n.targetObject.domCursorUp();
    n.currentMouseDown = h.none, n.overrideDrag && this.setCanvasElementStyle(l.canvas, {
      cursor: "default"
    }), n.overrideDrag = !1, this.setCanvasElementStyle(l.background, {
      cursor: "default"
    }), n.targetObject = null, n.dx = 0, n.dy = 0, n.dx_offset = 0, n.dy_offset = 0, n.mouseHasMoved = !1;
  }
  onWheel(n) {
    this.onZoom(n.deltaY), n.preventDefault();
  }
  onZoom(n = 0) {
    const t = this.g;
    let o = 1 * t.zoom * (-n / 1e3);
    t.zoom + o < 0.2 ? o = 0.2 - t.zoom : t.zoom + o > 1 && (o = 1 - t.zoom);
    let e = t.zoom / (t.zoom + o), s = t.cameraWidth / t.zoom * (e - 1) * (1 - (t.cameraWidth * 1.5 - t.mouse_x) / t.cameraWidth), c = t.cameraHeight / t.zoom * (e - 1) * (1 - (t.cameraHeight * 1.5 - t.mouse_y) / t.cameraHeight);
    t.zoom += o, t.camera_x -= s, t.camera_y -= c, this.setCanvasElementStyle(l.canvas, {
      transform: `matrix3d(${_(t.camera_x, t.camera_y, t)})`
    });
  }
  onKeyDown(n) {
    var t;
    switch (console.debug("Keydown: " + n.key), n.key) {
      case "Backspace":
      case "Delete":
        if (((t = this.g.targetObject) == null ? void 0 : t.type) != f.node)
          return;
        if (this.g.focusNodes.length > 0)
          for (const o of this.g.focusNodes)
            console.debug("Deleting node: " + o.gid), this.deleteNode(o.gid);
        break;
    }
  }
  /**
   * Renders elements currently in the canvas.
   */
  renderElements() {
    const n = this.g.targetObject;
    if (n != null) {
      if (n.type == f.node)
        for (const t of this.g.focusNodes)
          t.renderNode(t.nodeStyle);
      else if (n.type == f.outputConnector) {
        let t = this.g.targetObject;
        t.renderAllLines(t.svgLines);
      }
    }
  }
  step() {
    this.renderElements(), this.renderContainer(this.containerStyle), this.renderCanvas(this.canvasStyle), this.renderBackground(this.backgroundStyle), this.renderSelectionBox(this.selectionBoxStyle), window.requestAnimationFrame(this.step.bind(this));
  }
  addNodeObject() {
    const n = new b(null, this.g);
    return this.g.globalNodeTable[n.gid] = n, [n, this.g.globalNodeTable];
  }
  createNode(n) {
    const t = new b(n, this.g);
    return this.g.globalNodeTable[t.gid] = t, t;
  }
  createNodeAuto(n) {
    const t = new b(n, this.g);
    this.g.globalNodeTable[t.gid] = t;
    const o = n.querySelectorAll(".sl-input");
    for (let c = 0; c < o.length; c++) {
      const a = o[c], u = a.getAttribute("sl-name"), v = t.addInputForm(a, u);
      for (let g = 0; g < a.attributes.length; g++) {
        const p = a.attributes[g];
        if (p.name.startsWith("sl-event:")) {
          const d = p.name.split(":")[1], m = window[p.value];
          console.debug("Adding event listener: " + d), v.addInputUpdateListener(d, m);
        }
      }
    }
    const e = n.querySelectorAll(".sl-input-connector");
    for (let c = 0; c < e.length; c++) {
      const a = e[c], u = a.getAttribute("sl-name"), v = t.addInputConnector(a, u), g = a.getAttribute("sl-update");
      if (console.debug("Update function: " + g), g != null || g != null) {
        console.debug("Update function: " + g, v);
        const p = window[g];
        v.updateFunction = p.bind(v);
      }
    }
    const s = n.querySelectorAll(".sl-output-connector");
    for (let c = 0; c < s.length; c++) {
      const a = s[c], u = a.getAttribute("sl-name");
      t.addOutputConnector(a, u);
    }
    for (let c = 0; c < n.attributes.length; c++) {
      const a = n.attributes[c];
      if (a.name.startsWith("sl-init")) {
        const u = window[a.value];
        console.debug("Calling init func: " + u), u.bind(t)();
      }
    }
    return t;
  }
  addNode(n, t, o) {
    n.addNodeToCanvas(t, o);
  }
  addNodeAtMouse(n, t) {
    this.g.ignoreMouseUp = !0;
    let o = this.g.mouse_x_world, e = this.g.mouse_y_world;
    console.debug("Adding node at " + o + ", " + e), this.addNode(n, o, e), n.setStartPositions(), this.g.currentMouseDown = h.left, this.g.mousedown_x = this.g.mouse_x, this.g.mousedown_y = this.g.mouse_y, this.g.camera_pan_start_x = this.g.camera_x, this.g.camera_pan_start_y = this.g.camera_y, this.g.focusNodes = [n], this.g.targetObject = n;
    for (const s of this.g.globalNodeList)
      s.offFocus();
    this.onMouseMove(t);
  }
  deleteNode(n) {
    return n in this.g.globalNodeTable ? (this.g.globalNodeTable[n].destroy(), delete this.g.globalNodeTable[n], n) : (console.error("Node not found: " + n), null);
  }
  focusNode(n) {
    return n in this.g.globalNodeTable ? (this.g.globalNodeTable[n].onFocus(), n) : null;
  }
  connectNodes(n, t, o, e) {
    const s = this.g.globalNodeTable[n], c = this.g.globalNodeTable[o];
    if (!s || !c || !(s instanceof b) || !(c instanceof b))
      return null;
    const a = s.findOutput(t), u = c.findInput(e);
    return !a || !u ? null : (a.connectToInput(u), 0);
  }
}
export {
  X as default
};
