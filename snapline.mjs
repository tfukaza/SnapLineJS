var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var ObjectTypes = /* @__PURE__ */ ((ObjectTypes2) => {
  ObjectTypes2[ObjectTypes2["node"] = 0] = "node";
  ObjectTypes2[ObjectTypes2["connector"] = 1] = "connector";
  ObjectTypes2[ObjectTypes2["line"] = 2] = "line";
  ObjectTypes2[ObjectTypes2["unspecified"] = 3] = "unspecified";
  ObjectTypes2[ObjectTypes2["inputConnector"] = 4] = "inputConnector";
  ObjectTypes2[ObjectTypes2["outputConnector"] = 5] = "outputConnector";
  ObjectTypes2[ObjectTypes2["invalid"] = 6] = "invalid";
  return ObjectTypes2;
})(ObjectTypes || {});
var cursorState = /* @__PURE__ */ ((cursorState2) => {
  cursorState2[cursorState2["none"] = 0] = "none";
  cursorState2[cursorState2["mouseLeft"] = 1] = "mouseLeft";
  cursorState2[cursorState2["mouseMiddle"] = 2] = "mouseMiddle";
  cursorState2[cursorState2["mouseRight"] = 3] = "mouseRight";
  cursorState2[cursorState2["touchSingle"] = 4] = "touchSingle";
  cursorState2[cursorState2["touchDouble"] = 5] = "touchDouble";
  cursorState2[cursorState2["invalid"] = 4] = "invalid";
  return cursorState2;
})(cursorState || {});
class InputControl {
  constructor(dom) {
    /**
     * Functions as a middleware that converts mouse and touch events into a unified event format.
     */
    __publicField(this, "_dom");
    __publicField(this, "_onCursorDown");
    __publicField(this, "_onCursorMove");
    __publicField(this, "_onCursorUp");
    __publicField(this, "_onScroll");
    // _onRotate: null | scrollCallbackFunction;
    __publicField(this, "_onKeyDown");
    __publicField(this, "_prevTouchList");
    __publicField(this, "_prevDoubleTouchDistance");
    __publicField(this, "_currentCursorState");
    this._dom = dom;
    dom.addEventListener("mouseup", this.onMouseUp.bind(this));
    dom.addEventListener("mousemove", this.onMouseMove.bind(this));
    dom.addEventListener("mousedown", this.onMouseDown.bind(this));
    dom.addEventListener("wheel", this.onWheel.bind(this));
    dom.addEventListener("keydown", this.onKeyDown.bind(this));
    dom.addEventListener("touchstart", this.onTouchStart.bind(this));
    dom.addEventListener("touchmove", this.onTouchMove.bind(this));
    dom.addEventListener("touchend", this.onTouchEnd.bind(this));
    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));
    this._onCursorDown = null;
    this._onCursorMove = null;
    this._onCursorUp = null;
    this._onScroll = null;
    this._onKeyDown = null;
    this._currentCursorState = 0;
    this._prevTouchList = null;
    this._prevDoubleTouchDistance = -1;
  }
  setCursorDownCallback(callback) {
    this._onCursorDown = callback;
  }
  setCursorMoveCallback(callback) {
    this._onCursorMove = callback;
  }
  setCursorUpCallback(callback) {
    this._onCursorUp = callback;
  }
  setScrollCallback(callback) {
    this._onScroll = callback;
  }
  convertMouseToCursorState(button) {
    switch (button) {
      case 0:
        return 1;
      case 1:
        return 2;
      case 2:
        return 3;
      default:
        return 4;
    }
  }
  /**
   * Called when a new touch point is detected on the screen
   * @param e
   * @returns
   */
  onTouchStart(e) {
    var _a, _b, _c;
    if (e.touches.length > 1) {
      if (this._prevTouchList && this._prevTouchList.length == 1) {
        (_a = this._onCursorUp) == null ? void 0 : _a.call(
          this,
          e,
          e.target instanceof Element ? e.target : null,
          4,
          e.touches[0].clientX,
          e.touches[0].clientY
        );
      }
      this._currentCursorState = 5;
      const touch1 = e.touches[e.touches.length - 2];
      const touch2 = e.touches[e.touches.length - 1];
      const middleX = (touch1.clientX + touch2.clientX) / 2;
      const middleY = (touch1.clientY + touch2.clientY) / 2;
      const element = document.elementFromPoint(middleX, middleY);
      (_b = this._onCursorDown) == null ? void 0 : _b.call(
        this,
        e,
        element,
        5,
        middleX,
        middleY
      );
      this._prevTouchList = e.touches;
      this._prevDoubleTouchDistance = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) + Math.pow(touch1.clientY - touch2.clientY, 2)
      );
      return;
    }
    (_c = this._onCursorDown) == null ? void 0 : _c.call(
      this,
      e,
      e.target instanceof Element ? e.target : null,
      4,
      e.touches[0].clientX,
      e.touches[0].clientY
    );
  }
  /**
   * Called when the user pressed the mouse button
   * @param e
   * @returns
   */
  onMouseDown(e) {
    var _a;
    (_a = this._onCursorDown) == null ? void 0 : _a.call(
      this,
      e,
      e.target instanceof Element ? e.target : null,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY
    );
  }
  /**
   * Called when the user drags the touch point along the screen
   * @param e
   */
  onTouchMove(e) {
    var _a, _b, _c;
    if (e.touches.length == 1) {
      const element2 = document.elementFromPoint(
        e.touches[0].clientX,
        e.touches[0].clientY
      );
      (_a = this._onCursorMove) == null ? void 0 : _a.call(
        this,
        e,
        element2,
        4,
        e.touches[0].clientX,
        e.touches[0].clientY
      );
      this._prevTouchList = e.touches;
      return;
    }
    if (this._prevTouchList == null) {
      this._prevTouchList = e.touches;
      return;
    }
    const curTouch1 = e.touches[e.touches.length - 2];
    const curTouch2 = e.touches[e.touches.length - 1];
    let prevTouch1 = null;
    let prevTouch2 = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (curTouch1.identifier == this._prevTouchList[i].identifier) {
        prevTouch1 = this._prevTouchList[i];
      } else if (curTouch2.identifier == this._prevTouchList[i].identifier) {
        prevTouch2 = this._prevTouchList[i];
      }
    }
    if (prevTouch1 == null || prevTouch2 == null) {
      return;
    }
    const curDistance = Math.sqrt(
      Math.pow(curTouch1.clientX - curTouch2.clientX, 2) + Math.pow(curTouch1.clientY - curTouch2.clientY, 2)
    );
    const deltaZoom = curDistance - this._prevDoubleTouchDistance;
    const middleX = (curTouch1.clientX + curTouch2.clientX) / 2;
    const middleY = (curTouch1.clientY + curTouch2.clientY) / 2;
    const element = document.elementFromPoint(middleX, middleY);
    (_b = this._onCursorMove) == null ? void 0 : _b.call(this, e, element, 5, middleX, middleY);
    (_c = this._onScroll) == null ? void 0 : _c.call(
      this,
      e,
      element,
      5,
      middleX,
      middleY,
      deltaZoom
    );
    this._prevTouchList = e.touches;
    return;
  }
  /**
   * Called when the user moves the mouse
   * @param e
   */
  onMouseMove(e) {
    var _a;
    const element = document.elementFromPoint(e.clientX, e.clientY);
    (_a = this._onCursorMove) == null ? void 0 : _a.call(
      this,
      e,
      element,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY
    );
  }
  /**
   * Called when the user releases a touch point from the screen
   * @param e
   */
  onTouchEnd(e) {
    var _a, _b, _c;
    if (this._prevTouchList && this._prevTouchList.length > 1) {
      (_a = this._onCursorUp) == null ? void 0 : _a.call(
        this,
        e,
        e.target instanceof Element ? e.target : null,
        5,
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY
      );
      if (e.touches.length == 1) {
        this._prevTouchList = e.touches;
        (_b = this._onCursorDown) == null ? void 0 : _b.call(
          this,
          e,
          e.target instanceof Element ? e.target : null,
          4,
          e.touches[0].clientX,
          e.touches[0].clientY
        );
        return;
      } else if (e.touches.length == 0) {
        this._prevTouchList = null;
        return;
      }
    } else {
      (_c = this._onCursorUp) == null ? void 0 : _c.call(
        this,
        e,
        e.target instanceof Element ? e.target : null,
        4,
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY
      );
    }
  }
  /**
   * Called when the user releases the mouse button
   * @param e
   */
  onMouseUp(e) {
    var _a;
    (_a = this._onCursorUp) == null ? void 0 : _a.call(
      this,
      e,
      e.target instanceof Element ? e.target : null,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY
    );
  }
  /**
   * Called when the user scrolls the mouse wheel
   * @param e
   */
  onWheel(e) {
    var _a;
    (_a = this._onScroll) == null ? void 0 : _a.call(
      this,
      e,
      e.target instanceof Element ? e.target : null,
      2,
      e.clientX,
      e.clientY,
      e.deltaY
    );
  }
  /**
   * Called when the user presses a key
   * @param e
   * @returns
   */
  onKeyDown(e) {
    var _a;
    (_a = this._onKeyDown) == null ? void 0 : _a.call(this, e);
  }
}
class Base {
  /* Type of the object */
  constructor(globals) {
    __publicField(this, "g");
    /* Reference to the global stats object */
    __publicField(this, "gid");
    /* Unique identifier for the object */
    __publicField(this, "positionX");
    /* Position of the object in x-axis */
    __publicField(this, "positionY");
    __publicField(this, "type");
    this.g = globals;
    this.gid = (++globals.gid).toString();
    this.positionX = 0;
    this.positionY = 0;
    this.type = ObjectTypes.unspecified;
  }
  /**
   * Binds the mousedown event to the given DOM element.
   * @param dom The DOM element to bind the function to
   */
  bindFunction(dom) {
    dom.onmousedown = this.domMouseDown.bind(this);
    dom.ontouchstart = this.domTouchStart.bind(this);
  }
  domMouseDown(e) {
    this.domCursorDown({
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY
    });
    e.stopPropagation();
  }
  domTouchStart(e) {
    this.domCursorDown({
      button: 0,
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY
    });
    e.stopPropagation();
  }
  /**
   * Mouse down event common to all elements.
   * Triggered when the dom of this object is clicked.
   * @param button: The mouse button that was clicked
   * @param clientX: The x-coordinate of the mouse click
   * @param clientY: The y-coordinate of the mouse click
   */
  domCursorDown(prop) {
    const button = prop.button;
    const clientX = prop.clientX;
    const clientY = prop.clientY;
    if (button == 0) {
      this.g._currentMouseDown = cursorState.mouseLeft;
    } else if (button == 1) {
      this.g._currentMouseDown = cursorState.mouseMiddle;
    } else if (button == 2) {
      this.g._currentMouseDown = cursorState.mouseRight;
    }
    console.debug(
      `Base class mousedown event triggered on ${this.gid}, button: ${button}, clientX: ${clientX}, clientY: ${clientY}`
    );
    this.g.targetObject = this;
    this.g.mousedown_x = clientX;
    this.g.mousedown_y = clientY;
    this.g.dx = 0;
    this.g.dy = 0;
    this.g.dx_offset = 0;
    this.g.dy_offset = 0;
    this.componentCursorDown(prop);
  }
  componentCursorDown(_) {
    console.debug(
      `Base class componentCursorDown event triggered on ${this.gid} with prop ${JSON.stringify(_)}`
    );
  }
  /**
   * Mouse up event common to all elements.
   * Triggered when the dom of this object is released.
   */
  domCursorUp() {
    this.componentCursorUp();
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
class ComponentBase extends Base {
  constructor(config, parent, globals) {
    super(globals);
    __publicField(this, "parent");
    __publicField(this, "config");
    __publicField(this, "dom");
    this.config = config;
    this.parent = parent;
    this.dom = null;
  }
}
class InputForm extends ComponentBase {
  // Properties of the component
  constructor(dom, config, parent, globals) {
    super(config, parent, globals);
    __publicField(this, "name");
    // Name of the component
    __publicField(this, "dom");
    // The DOM element of the component
    __publicField(this, "prop");
    this.name = config.name;
    this.prop = parent.prop;
    this.dom = dom;
  }
  bindFunction(_) {
  }
  addInputUpdateListener(event, func) {
    this.dom.addEventListener(event, func.bind(this));
  }
}
class ConnectorComponent extends ComponentBase {
  constructor(dom, config, parent, globals) {
    super(config, parent, globals);
    __publicField(this, "config");
    __publicField(this, "name");
    // Name of the connector. This should describe the data associated with the connector
    __publicField(this, "connectorX");
    // Location of the connector on canvas
    __publicField(this, "connectorY");
    __publicField(this, "connectorTotalOffsetX");
    // Location of the connector relative to the location of parent Node
    __publicField(this, "_connectorTotalOffsetY");
    __publicField(this, "prop");
    // Properties of the connector
    __publicField(this, "lineArray");
    __publicField(this, "type", ObjectTypes.connector);
    __publicField(this, "dom");
    __publicField(this, "parent");
    __publicField(this, "peerConnectors");
    this.connectorX = 0;
    this.connectorY = 0;
    this.connectorTotalOffsetX = 0;
    this._connectorTotalOffsetY = 0;
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
  updateFunction() {
  }
  /**
   * Begins the line drag operation, which will create a temporary line
   * extending from the connector to the mouse cursor.
   */
  startDragOutLine() {
    console.debug(
      `Created line from connector ${this.gid} and started dragging`
    );
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
      completedDelete: false
    });
    this.setAllLinePositions();
  }
  /**
   * Called when the user drags the line extending from the connector.
   */
  runDragOutLine() {
    let distance = 9999;
    let connectorX = 0;
    let connectorY = 0;
    const hover = this.g.hoverDOM;
    if (this.lineArray.length == 0) {
      console.warn(`Warning: svgLines is empty`);
      return;
    }
    const [adjustedDeltaX, adjustedDeltaY] = this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);
    if (hover && hover.classList.contains("sl-connector")) {
      const gid = hover.getAttribute("sl-gid");
      if (!gid) return;
      const targetConnector = this.g.globalNodeTable[gid];
      targetConnector.updateConnectorPosition();
      connectorX = targetConnector.connectorX;
      connectorY = targetConnector.connectorY;
      distance = Math.sqrt(
        Math.pow(this.connectorX + adjustedDeltaX - connectorX, 2) + Math.pow(this.connectorY + adjustedDeltaY - connectorY, 2)
      );
      if (distance < 40) {
        this.setLineXYPosition(
          this.lineArray[0],
          connectorX - this.connectorX,
          connectorY - this.connectorY
        );
      } else {
        this.setLineXYPosition(
          this.lineArray[0],
          adjustedDeltaX,
          adjustedDeltaY
        );
      }
    } else {
      this.setLineXYPosition(this.lineArray[0], adjustedDeltaX, adjustedDeltaY);
    }
  }
  /**
   * Ends the line drag operation.
   * This will delete the temporary line created by startDragOutLine.
   * If the user is hovering over an input connector, then the line will be connected to the input connector.
   */
  endDragOutLine() {
    console.debug(`Ended dragging line from connector ${this.gid}`);
    const hover = this.g.hoverDOM;
    if (hover && hover.classList.contains("sl-connector")) {
      const gid = hover.getAttribute("sl-gid");
      console.debug("Connected to input connector: ", gid);
      if (!gid) {
        console.error(`Error: gid is null`);
        return;
      }
      const target = this.g.globalNodeTable[gid];
      if (this.connectToConnector(target) == false) {
        this.deleteTmpLine();
        return;
      }
      target.prop[target.name] = this.prop[this.name];
      target.updateFunction();
      this.setLineXYPosition(
        this.lineArray[0],
        target.connectorX - this.connectorX,
        target.connectorY - this.connectorY
      );
    } else {
      this.deleteTmpLine();
    }
  }
  startPickUpLine(line) {
    console.debug(
      `Detached line from connector ${this.gid} and started dragging`
    );
    console.debug(`Line: `, this.lineArray);
    this.g.targetObject = line.start;
    [this.g.dx_offset, this.g.dy_offset] = this.g.camera.getCameraDeltaFromWorldDelta(
      this.connectorX - line.start.connectorX,
      this.connectorY - line.start.connectorY
    );
    this.g.dx = this.g.dx_offset;
    this.g.dy = this.g.dy_offset;
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    this.deleteLine(this.lineArray.indexOf(line));
    line.start.startDragOutLine();
  }
  connectToConnector(connector) {
    if (connector.peerConnectors.some((e) => e === this)) {
      console.debug("Already connected");
      return false;
    }
    if (connector.config.maxConnectors === connector.peerConnectors.length) {
      console.debug(
        `Connector ${connector} already has max number of connectors`
      );
      return false;
    }
    console.debug("Connecting to: ", connector);
    connector.peerConnectors.push(this);
    this.peerConnectors.push(connector);
    this.updateConnectorPosition();
    this.lineArray[0].target = connector;
    connector.lineArray.push(this.lineArray[0]);
    return true;
  }
  disconnectFromConnector(connector) {
    console.debug("Disconnecting from connector: ", connector);
    for (const svg of this.lineArray) {
      if (svg.target == connector) {
        svg.requestDelete = true;
        break;
      }
    }
    this.peerConnectors = this.peerConnectors.filter(
      (i) => i.gid != connector.gid
    );
  }
  updateConnectorPosition() {
    this.connectorX = this.parent.positionX + this.connectorTotalOffsetX;
    this.connectorY = this.parent.positionY + this._connectorTotalOffsetY;
  }
  setLineXYPosition(entry, x, y) {
    entry.x2 = x;
    entry.y2 = y;
  }
  setLinePosition(entry) {
    entry.connector_x = entry.start.connectorX;
    entry.connector_y = entry.start.connectorY;
    if (!entry.target) {
      const [adjustedDeltaX, adjustedDeltaY] = this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);
      this.setLineXYPosition(entry, adjustedDeltaX, adjustedDeltaY);
    } else {
      this.setLineXYPosition(
        entry,
        entry.target.connectorX - entry.start.connectorX,
        entry.target.connectorY - entry.start.connectorY
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
  renderAllLines(lineArray) {
    for (const line of lineArray) {
      if (!line.svg) {
        const svgDom = this.createLineDOM();
        line.svg = svgDom;
      } else if (line.requestDelete && !line.completedDelete) {
        this.g.canvas.removeChild(line.svg);
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
  setRenderLineCallback(callback) {
    this.renderAllLines = (svgLines) => {
      this.filterDeletedLines(svgLines);
      callback(svgLines);
    };
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
      this_rect.top - parent_rect.top
    );
    const [adjWidth, adjHeight] = this.g.camera.getWorldDeltaFromCameraDelta(
      this_rect.width / 2,
      this_rect.height / 2
    );
    this.connectorTotalOffsetX = adjLeft + adjWidth;
    this._connectorTotalOffsetY = adjTop + adjHeight;
  }
  createLineDOM() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    svg.appendChild(line);
    svg.classList.add("sl-connector-svg");
    line.classList.add("sl-connector-line");
    line.setAttribute("stroke-width", "4");
    this.g.canvas.appendChild(svg);
    return svg;
  }
  setStyle(dom, style) {
    if (!dom) {
      return;
    }
    for (const key in style) {
      dom.style[key] = style[key];
    }
  }
  renderLinePosition(entry) {
    const svg = entry.svg;
    if (!svg) {
      return;
    }
    this.setStyle(svg, {
      position: "absolute",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "transform",
      transform: `translate3d(${entry.connector_x}px, ${entry.connector_y}px, 0)`
    });
    const line = svg.children[0];
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "" + entry.x2);
    line.setAttribute("y2", "" + entry.y2);
  }
  filterDeletedLines(svgLines) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i].requestDelete) {
        svgLines.splice(i, 1);
        i--;
      }
    }
  }
  deleteTmpLine() {
    this.deleteLine(0);
    this.renderAllLines(this.lineArray);
  }
  deleteLine(i) {
    if (this.lineArray.length == 0) {
      return void 0;
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
  componentCursorDown(_) {
    console.debug(`Cursor down on connector ${this.gid}`, this.lineArray);
    const incomingLines = this.lineArray.filter(
      (e) => e.target === this && !e.requestDelete
    );
    if (incomingLines.length > 0) {
      this.startPickUpLine(incomingLines[0]);
      return;
    }
    if (this.config.allowDragOut) {
      this.startDragOutLine();
    }
  }
  onDrag() {
    this.runDragOutLine();
  }
  componentCursorUp() {
    this.endDragOutLine();
  }
}
class NodeComponent extends Base {
  // Style of the node
  constructor(dom, globals) {
    super(globals);
    __publicField(this, "type", ObjectTypes.node);
    __publicField(this, "nodeType");
    /* Type of the node */
    __publicField(this, "dom");
    /* The DOM element of the node */
    __publicField(this, "connectors");
    // Dictionary of all connectors in the node, using the name as the key
    __publicField(this, "components");
    // Dictionary of all components in the node except connectors
    __publicField(this, "nodeWidth", 0);
    __publicField(this, "nodeHeight", 0);
    __publicField(this, "dragStartX", 0);
    __publicField(this, "dragStartY", 0);
    //overlapping: lineObject | null; // Line that the node is overlapping with
    __publicField(this, "freeze");
    /* If true, the node cannot be moved */
    __publicField(this, "prop");
    // Properties of the node
    __publicField(this, "propSetCallback");
    // Callbacks called when a property is set
    __publicField(this, "nodeStyle");
    this.nodeType = "";
    this.dom = dom;
    this.connectors = {};
    this.components = {};
    this.dragStartX = this.positionX;
    this.dragStartY = this.positionY;
    this.freeze = false;
    this.prop = {};
    this.prop = new Proxy(this.prop, {
      set: (target, prop, value) => {
        prop = prop.toString();
        target[prop] = value;
        if (this.propSetCallback[prop]) {
          this.propSetCallback[prop](value);
        }
        if (prop in this.connectors) {
          const peers = this.connectors[prop].lineArray.filter(
            (line) => line.start == this.connectors[prop] && line.target && !line.requestDelete
          ).map((line) => line.target);
          if (peers) {
            for (const peer of peers) {
              if (!peer) continue;
              peer.parent.prop[peer.name] = value;
              if (peer.parent.propSetCallback[peer.name]) {
                peer.parent.propSetCallback[peer.name](value);
              }
            }
          }
        }
        return true;
      }
    });
    this.propSetCallback = {};
    this.setNodeStyle({
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left"
    });
    this.g.globalNodeList.push(this);
    this.initNode = this.initNode.bind(this);
    this.addConnector = this.addConnector.bind(this);
    this.addInputForm = this.addInputForm.bind(this);
    this.addPropSetCallback = this.addPropSetCallback.bind(this);
    this.setRenderNodeCallback = this.setRenderNodeCallback.bind(this);
  }
  initNode(dom) {
    this.dom = dom;
    this.dom.id = this.gid;
    this.renderNode(this.nodeStyle);
    this.bindFunction(this.dom);
    new ResizeObserver(() => {
      this.updateDOMproperties();
    }).observe(this.dom);
  }
  /**
   * Updates the DOM properties of the node, such as height, width, etc.
   * Also updates the DOM properties of all connectors.
   * Called when the node is first created, and when the node is resized.
   * @returns
   */
  updateDOMproperties() {
    if (!this.dom) return;
    this.nodeHeight = this.dom.offsetHeight;
    this.nodeWidth = this.dom.offsetWidth;
    for (const connector of Object.values(this.connectors)) {
      connector.updateDOMproperties();
    }
  }
  setNodeStyle(style) {
    this.nodeStyle = Object.assign({}, this.nodeStyle, style);
  }
  renderNode(style) {
    if (!this.dom) return;
    for (const key in style) {
      if (key[0] == "_") continue;
      this.dom.style[key] = style[key];
    }
    if (style._focus) {
      this.dom.classList.add("focus");
    } else {
      this.dom.classList.remove("focus");
    }
    for (const connector of Object.values(this.connectors)) {
      connector.renderAllLines(connector.lineArray);
    }
  }
  setRenderNodeCallback(callback) {
    this.renderNode = (style) => {
      callback(style);
      for (const connector of Object.values(this.connectors)) {
        const lines = connector.lineArray.filter(
          (line) => line.start == connector
        );
        connector.renderAllLines(lines);
      }
    };
  }
  addNodeToCanvas(x, y) {
    this.positionX = x;
    this.positionY = y;
    this.nodeWidth = this.dom.offsetWidth;
    this.nodeHeight = this.dom.offsetHeight;
    this.setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
    });
    this.renderNode(this.nodeStyle);
    this.updateDOMproperties();
    this.g.canvas.appendChild(this.dom);
  }
  addConnector(dom, name, maxConnectors = 1, allowDragOut = true) {
    const connector = new ConnectorComponent(
      dom,
      { name, maxConnectors, allowDragOut },
      this,
      this.g
    );
    this.connectors[name] = connector;
    this.prop[name] = null;
    return connector;
  }
  addInputForm(dom, name) {
    const input = new InputForm(dom, { name }, this, this.g);
    this.prop[name] = null;
    return input;
  }
  addPropSetCallback(callback, name) {
    this.propSetCallback[name] = callback;
  }
  // findInput(id: string): InputConnector | null {
  //   for (const input of Object.values(this.inputConnectors)) {
  //     if (input.name == id) {
  //       return input;
  //     }
  //   }
  //   return null;
  // }
  // findOutput(id: string): OutputConnector | null {
  //   for (const output of Object.values(this.outputConnectors)) {
  //     if (output.name == id) {
  //       return output;
  //     }
  //   }
  //   return null;
  // }
  setStartPositions() {
    this.dragStartX = this.positionX;
    this.dragStartY = this.positionY;
  }
  componentCursorDown(_) {
    console.debug(`Node class mousedown event triggered on ${this.gid}!`);
    let isInFocusNodes = false;
    for (let i = 0; i < this.g.focusNodes.length; i++) {
      if (this.g.focusNodes[i].gid == this.gid) {
        isInFocusNodes = true;
        break;
      }
    }
    if (!isInFocusNodes) {
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].offFocus();
      }
      this.g.focusNodes = [this];
      this.onFocus();
    } else {
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].setStartPositions();
      }
    }
    this.setStartPositions();
  }
  componentCursorUp() {
    if (this.freeze) return;
    const [dx, dy] = this.g.camera.getWorldDeltaFromCameraDelta(
      this.g.dx,
      this.g.dy
    );
    this.positionX = this.dragStartX + dx;
    this.positionY = this.dragStartY + dy;
    console.debug("Mouse has moved: " + this.g.mouseHasMoved);
    if (!this.g.mouseHasMoved && this.g.targetObject && this.g.targetObject.gid == this.gid) {
      console.debug("Mouse has not moved");
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].offFocus();
      }
      this.g.focusNodes = [this];
      this.onFocus();
      return;
    }
    this.renderNode(this.nodeStyle);
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
    const [adjustedDeltaX, adjustedDeltaY] = this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);
    this.positionX = this.dragStartX + adjustedDeltaX;
    this.positionY = this.dragStartY + adjustedDeltaY;
    this.setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
    });
    for (const connector of Object.values(this.connectors)) {
      connector.setAllLinePositions();
    }
    if (Object.keys(this.connectors).length == 0) return;
  }
  onFocus() {
    this.setNodeStyle({ _focus: true });
    this.renderNode(this.nodeStyle);
  }
  offFocus() {
    this.setNodeStyle({ _focus: false });
    this.renderNode(this.nodeStyle);
  }
  evaluate(varName) {
    console.debug("Update all nodes connected to " + varName);
    const connector = this.connectors[varName];
    if (!connector) return;
    for (const peer of connector.peerConnectors) {
      console.debug(
        `Update input ${peer.name} connected to ${varName} with value ${this.prop[varName]}`
      );
      peer.parent.prop[peer.name] = this.prop[varName];
      peer.updateFunction();
    }
  }
  exec() {
  }
  destroy() {
    var _a;
    (_a = this.g.canvas) == null ? void 0 : _a.removeChild(this.dom);
    for (const connector of Object.values(this.connectors)) {
      connector.destroy();
    }
  }
}
class Camera {
  // The CSS transform style that should be applied to the DOM element
  constructor(container, canvas) {
    /**
     * Represents a camera that can be used to pan and zoom the view of a DOM element.
     */
    __publicField(this, "containerDom");
    // The DOM that represents the camera view
    __publicField(this, "canvasDom");
    // The dom that the camera is rendering
    __publicField(this, "cameraWidth");
    // The width of the camera view
    __publicField(this, "cameraHeight");
    // The height of the camera view
    __publicField(this, "cameraX");
    // Position of the center of the camera
    __publicField(this, "cameraY");
    __publicField(this, "cameraPanStartX");
    // Initial position of the camera when panning
    __publicField(this, "cameraPanStartY");
    __publicField(this, "zoom");
    // The zoom level of the camera, 1 means no zoom, smaller values zoom out, larger values zoom in
    __publicField(this, "canvasStyle");
    this.containerDom = container;
    this.canvasDom = canvas;
    this.cameraWidth = container.clientWidth;
    this.cameraHeight = container.clientHeight;
    this.cameraX = 0;
    this.cameraY = 0;
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
    this.zoom = 1;
    this.canvasStyle = "";
    this.updateCamera();
  }
  /**
   * Given the x and y coordinates of the camera, the zoom level, and the width and height of the camera,
   * calculates the transformation matrix that converts a x,y coordinate of the DOM to
   * the x,y coordinate of the camera view.
   * @param cameraX   The x coordinate of the point in the world
   * @param cameraY   The y coordinate of the point in the world
   * @param zoom  The zoom level of the camera
   * @param cameraWidth  The width of the camera view
   * @param cameraHeight The height of the camera view
   * @returns A string representing the CSS transform matrix that should be applied to the DOM element
   */
  worldToCameraMatrix(cameraX, cameraY, zoom, cameraWidth, cameraHeight) {
    const s1 = zoom;
    const s2 = zoom;
    const t1 = -cameraX * zoom + cameraWidth / 2;
    const t2 = -cameraY * zoom + cameraHeight / 2;
    return `${s1},0,0,0,0,${s2},0,0,0,0,1,0,${t1},${t2},0,1`;
  }
  updateCamera() {
    const matrix = this.worldToCameraMatrix(
      this.cameraX,
      this.cameraY,
      this.zoom,
      this.containerDom.clientWidth,
      this.containerDom.clientHeight
    );
    this.canvasStyle = `matrix3d(${matrix})`;
  }
  /**
   * Handle the scroll event to zoom in and out of the camera view
   * @param deltaScroll Amount of scroll
   * @param mouseX Position of the mouse on the device screen
   * @param mouseY
   */
  handleScroll(deltaScroll, mouseX, mouseY) {
    mouseX -= this.containerDom.offsetLeft;
    mouseY -= this.containerDom.offsetTop;
    let deltaZoom = 1 * this.zoom * (-deltaScroll / 1e3);
    if (this.zoom + deltaZoom < 0.2) {
      deltaZoom = 0.2 - this.zoom;
    } else if (this.zoom + deltaZoom > 1) {
      deltaZoom = 1 - this.zoom;
    }
    const zoomRatio = this.zoom / (this.zoom + deltaZoom);
    this.cameraX -= this.cameraWidth / this.zoom * (zoomRatio - 1) * (1 - (this.cameraWidth * 1.5 - mouseX) / this.cameraWidth);
    this.cameraY -= this.cameraHeight / this.zoom * (zoomRatio - 1) * (1 - (this.cameraHeight * 1.5 - mouseY) / this.cameraHeight);
    this.zoom += deltaZoom;
    this.updateCamera();
  }
  handlePan(deltaX, deltaY) {
    this.cameraX += deltaX / this.zoom;
    this.cameraY += deltaY / this.zoom;
    this.updateCamera();
  }
  handlePanStart() {
    this.cameraPanStartX = this.cameraX;
    this.cameraPanStartY = this.cameraY;
  }
  handlePanDrag(deltaX, deltaY) {
    this.cameraX = -deltaX / this.zoom + this.cameraPanStartX;
    this.cameraY = -deltaY / this.zoom + this.cameraPanStartY;
    this.updateCamera();
  }
  handlePanEnd() {
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
  }
  getCameraFromWorld(worldX, worldY) {
    const c_x = (worldX - this.cameraX) * this.zoom + this.cameraWidth / 2;
    const c_y = (worldY - this.cameraY) * this.zoom + this.cameraHeight / 2;
    return [c_x, c_y];
  }
  getWorldFromCamera(mouseX, mouseY) {
    mouseX = mouseX - this.containerDom.offsetLeft;
    mouseY = mouseY - this.containerDom.offsetTop;
    const w_x = (mouseX - this.cameraWidth / 2) / this.zoom + this.cameraX;
    const w_y = (mouseY - this.cameraHeight / 2) / this.zoom + this.cameraY;
    return [w_x, w_y];
  }
  getCameraDeltaFromWorldDelta(worldDeltaX, worldDeltaY) {
    const c_dx = worldDeltaX * this.zoom;
    const c_dy = worldDeltaY * this.zoom;
    return [c_dx, c_dy];
  }
  getWorldDeltaFromCameraDelta(cameraDeltaX, cameraDeltaY) {
    const w_dx = cameraDeltaX / this.zoom;
    const w_dy = cameraDeltaY / this.zoom;
    return [w_dx, w_dy];
  }
}
class SnapLine {
  constructor() {
    __publicField(this, "g");
    // Global state
    __publicField(this, "_containerStyle", {});
    __publicField(this, "_canvasStyle", {});
    __publicField(this, "_selectionBoxStyle", {});
    __publicField(this, "_backgroundStyle", {});
    __publicField(this, "_inputControl", null);
    this.g = null;
    this._containerStyle = {
      position: "relative",
      overflow: "hidden"
    };
    this._selectionBoxStyle = {
      position: "absolute",
      pointerEvents: "none"
    };
    this.initSnapLine = this.initSnapLine.bind(this);
    this.setRenderCanvasCallback = this.setRenderCanvasCallback.bind(this);
    this.setRenderBackgroundCallback = this.setRenderBackgroundCallback.bind(this);
    this.setRenderSelectionBoxCallback = this.setRenderSelectionBoxCallback.bind(this);
  }
  initSnapLine(containerDom, canvasDom, backgroundDom, selectionBoxDom) {
    this.g = {
      canvas: canvasDom,
      canvasContainer: containerDom,
      canvasBackground: backgroundDom,
      selectionBox: selectionBoxDom,
      _currentMouseDown: cursorState.none,
      mousedown_x: 0,
      mousedown_y: 0,
      mouse_x: 0,
      mouse_y: 0,
      mouse_x_world: 0,
      mouse_y_world: 0,
      dx: 0,
      dy: 0,
      dx_offset: 0,
      dy_offset: 0,
      camera: new Camera(containerDom, canvasDom),
      overrideDrag: false,
      targetObject: null,
      focusNodes: [],
      hoverDOM: null,
      gid: 0,
      globalNodeList: [],
      globalNodeTable: {},
      mouseHasMoved: false,
      ignoreMouseUp: false,
      prevTouches: null,
      prevSingleTouchTime: 0,
      snapline: this
    };
    this._setCanvasStyle({
      position: "relative",
      top: "0px",
      left: "0px",
      width: "0px",
      height: "0px",
      transform: this.g.camera.canvasStyle
    });
    this._setBackgroundStyle({
      width: this.g.camera.cameraWidth * 10 + "px",
      height: this.g.camera.cameraHeight * 10 + "px",
      transform: `translate(${-this.g.camera.cameraWidth * 5}px, ${-this.g.camera.cameraHeight * 5}px)`,
      transformOrigin: "center",
      zIndex: "0",
      position: "absolute"
    });
    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);
    this._inputControl = new InputControl(containerDom);
    this._inputControl.setCursorDownCallback(this.onCursorDown.bind(this));
    this._inputControl.setCursorMoveCallback(this.onCursorMove.bind(this));
    this._inputControl.setCursorUpCallback(this.onCursorUp.bind(this));
    this._inputControl.setScrollCallback(this.onZoom.bind(this));
    window.requestAnimationFrame(this.step.bind(this));
  }
  _setCanvasStyle(newStyle) {
    this._canvasStyle = Object.assign({}, this._canvasStyle, newStyle);
    this._canvasStyle._requestUpdate = "true";
  }
  _setBackgroundStyle(newStyle) {
    this._backgroundStyle = Object.assign({}, this._backgroundStyle, newStyle);
    this._backgroundStyle._requestUpdate = "true";
  }
  _setSelectionBoxStyle(newStyle) {
    this._selectionBoxStyle = Object.assign(
      {},
      this._selectionBoxStyle,
      newStyle
    );
    this._selectionBoxStyle._requestUpdate = "true";
  }
  _renderCanvas(style) {
    for (const key in style) {
      this.g.canvas.style[key] = style[key];
    }
  }
  _renderBackground(style) {
    for (const key in style) {
      this.g.canvasBackground.style[key] = style[key];
    }
  }
  _renderSelectionBox(style) {
    for (const key in style) {
      this.g.selectionBox.style[key] = style[key];
    }
  }
  setRenderCanvasCallback(callback) {
    this._renderCanvas = callback;
  }
  setRenderBackgroundCallback(callback) {
    this._renderBackground = callback;
  }
  setRenderSelectionBoxCallback(callback) {
    this._renderSelectionBox = callback;
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
  onCursorDown(_, __, button, clientX, clientY) {
    this.g._currentMouseDown = button;
    if (this.g.targetObject && this.g.targetObject.type == ObjectTypes.connector) {
      const connector = this.g.targetObject;
      connector.domCursorUp();
    }
    const g = this.g;
    if (g.overrideDrag) {
      return;
    }
    if (g._currentMouseDown != cursorState.none) {
      this._setSelectionBoxStyle({
        width: "0px",
        height: "0px",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        opacity: "0"
      });
    }
    g.focusNodes = [];
    for (const node of g.globalNodeList) {
      node.offFocus();
    }
    g.mousedown_x = clientX;
    g.mousedown_y = clientY;
    if (button == cursorState.mouseMiddle || button == cursorState.touchDouble) {
      this.g.camera.handlePanStart();
    }
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
  onCursorMove(_, element, button, clientX, clientY) {
    const g = this.g;
    g.hoverDOM = element;
    g.mouse_x = clientX - g.canvasContainer.offsetLeft;
    g.mouse_y = clientY - g.canvasContainer.offsetTop;
    [g.mouse_x_world, g.mouse_y_world] = this.g.camera.getWorldFromCamera(
      g.mouse_x,
      g.mouse_y
    );
    g.dx = clientX - g.mousedown_x + g.dx_offset;
    g.dy = clientY - g.mousedown_y + g.dy_offset;
    if (button == cursorState.none) {
      return;
    }
    if (g.dx !== 0 || g.dy !== 0) {
      g.mouseHasMoved = true;
    }
    if (g.targetObject == null) {
      if (g._currentMouseDown == cursorState.mouseMiddle || g._currentMouseDown == cursorState.touchDouble) {
        this.g.camera.handlePanDrag(g.dx, g.dy);
        this._setCanvasStyle({
          transform: this.g.camera.canvasStyle,
          cursor: "grabbing"
        });
        this._setBackgroundStyle({
          transform: `translate(${this.g.camera.cameraX + -this.g.camera.cameraWidth * 5}px, ${this.g.camera.cameraY + -this.g.camera.cameraHeight * 5}px)`,
          backgroundPosition: `${-this.g.camera.cameraX}px ${-this.g.camera.cameraY}px`
        });
      } else if (g._currentMouseDown == cursorState.mouseLeft || g._currentMouseDown == cursorState.touchSingle) {
        this._setSelectionBoxStyle({
          width: Math.abs(g.dx) + "px",
          height: Math.abs(g.dy) + "px",
          left: Math.min(g.mousedown_x, g.mouse_x) + "px",
          top: Math.min(g.mousedown_y, g.mouse_y) + "px",
          opacity: "1"
        });
        const [adjStartX, adjStartY] = this.g.camera.getWorldFromCamera(
          Math.min(g.mousedown_x, g.mouse_x),
          Math.min(g.mousedown_y, g.mouse_y)
        );
        const [adjEndX, adjEndY] = this.g.camera.getWorldFromCamera(
          Math.max(g.mousedown_x, g.mouse_x),
          Math.max(g.mousedown_y, g.mouse_y)
        );
        const selectedNodes = [];
        for (const node of g.globalNodeList) {
          if (node.positionX + node.nodeWidth > adjStartX && node.positionX < adjEndX && node.positionY + node.nodeHeight > adjStartY && node.positionY < adjEndY) {
            node.onFocus();
            selectedNodes.push(node);
          } else {
            node.offFocus();
          }
        }
        g.focusNodes = selectedNodes;
      }
    } else {
      if (g.targetObject.type == ObjectTypes.node) {
        for (const node of g.focusNodes) {
          node.onDrag();
        }
      } else {
        g.targetObject.onDrag();
      }
    }
  }
  /**
   * Event handler when mouse or touchscreen is released.
   * @returns
   */
  onCursorUp(_, __, ___, ____, _____) {
    const g = this.g;
    if (g.ignoreMouseUp) {
      g.ignoreMouseUp = false;
      return;
    }
    if (g._currentMouseDown == cursorState.mouseLeft || g._currentMouseDown == cursorState.touchSingle) {
      if (g.targetObject == null) {
        this._setSelectionBoxStyle({
          width: "0px",
          height: "0px",
          left: "0px",
          top: "0px"
        });
      } else if (g.targetObject.type == ObjectTypes.node) {
        for (const node of g.focusNodes) {
          node.domCursorUp();
        }
      } else {
        g.targetObject.domCursorUp();
      }
    } else if (g._currentMouseDown == cursorState.mouseMiddle || g._currentMouseDown == cursorState.touchDouble) {
      this.g.camera.handlePanEnd();
    }
    g._currentMouseDown = cursorState.none;
    if (g.overrideDrag) {
      this._setCanvasStyle({
        cursor: "default"
      });
    }
    g.overrideDrag = false;
    this._setCanvasStyle({
      cursor: "default"
    });
    g.targetObject = null;
    g.dx = 0;
    g.dy = 0;
    g.dx_offset = 0;
    g.dy_offset = 0;
    g.mouseHasMoved = false;
  }
  /**
   * Event handler for mouse scroll events.
   * @param deltaY: The amount the user scrolled.
   */
  onZoom(_, __, button, ____, _____, deltaY) {
    if (button === cursorState.mouseMiddle) {
      deltaY = deltaY;
    } else if (button === cursorState.touchDouble) {
      deltaY = deltaY;
    }
    this.g.camera.handleScroll(deltaY, this.g.mouse_x, this.g.mouse_y);
    this._setCanvasStyle({
      transform: this.g.camera.canvasStyle
    });
  }
  /**
   * Renders elements currently in the canvas.
   */
  _renderElements() {
    const target = this.g.targetObject;
    if (target == null) {
      return;
    }
    if (target.type == ObjectTypes.node) {
      for (const node of this.g.focusNodes) {
        node.renderNode(node.nodeStyle);
      }
    } else if (target.type == ObjectTypes.connector) {
      const target2 = this.g.targetObject;
      target2.renderAllLines(target2.lineArray);
    }
  }
  step() {
    this._renderElements();
    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);
    window.requestAnimationFrame(this.step.bind(this));
  }
  addNodeObject() {
    const n = new NodeComponent(null, this.g);
    this.g.globalNodeTable[n.gid] = n;
    return [n, this.g.globalNodeTable];
  }
  createNode(dom) {
    const n = new NodeComponent(dom, this.g);
    this.g.globalNodeTable[n.gid] = n;
    return n;
  }
  addNode(node, x, y) {
    node.addNodeToCanvas(x, y);
  }
  addNodeAtMouse(node, e) {
    this.g.ignoreMouseUp = true;
    const x = this.g.mouse_x_world;
    const y = this.g.mouse_y_world;
    console.debug("Adding node at " + x + ", " + y);
    this.addNode(node, x, y);
    node.setStartPositions();
    this.g._currentMouseDown = cursorState.mouseLeft;
    this.g.mousedown_x = this.g.mouse_x;
    this.g.mousedown_y = this.g.mouse_y;
    this.g.focusNodes = [node];
    this.g.targetObject = node;
    for (const node2 of this.g.globalNodeList) {
      node2.offFocus();
    }
    this.onCursorMove(e, null, this.g._currentMouseDown, e.clientX, e.clientY);
  }
  deleteNode(id) {
    if (!(id in this.g.globalNodeTable)) {
      console.error("Node not found: " + id);
      return null;
    }
    this.g.globalNodeTable[id].destroy();
    const { [id]: _, ...rest } = this.g.globalNodeTable;
    this.g.globalNodeTable = rest;
    return id;
  }
  focusNode(id) {
    if (!(id in this.g.globalNodeTable)) return null;
    const node = this.g.globalNodeTable[id];
    node.onFocus();
    return id;
  }
}
export {
  SnapLine as default
};
