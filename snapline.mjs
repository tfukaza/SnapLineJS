var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _ConnectorComponent_instances, setLineXYPosition_fn, _NodeComponent_instances, updateDomProperties_fn, setStartPositions_fn, _SnapLine_instances, step_fn;
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
  // Dictionary of touches for touch events, indexed by the touch identifier
  constructor(dom, document2) {
    /**
     * Functions as a middleware that converts mouse and touch events into a unified event format.
     */
    __publicField(this, "_dom");
    __publicField(this, "_document");
    __publicField(this, "_onCursorDown");
    __publicField(this, "_onCursorMove");
    __publicField(this, "_onCursorUp");
    __publicField(this, "_onScroll");
    __publicField(this, "_onRotate");
    __publicField(this, "_onKeyDown");
    __publicField(this, "_pointerMode");
    __publicField(this, "_currentCursorState");
    __publicField(this, "_sortedTouchArray");
    // List of touches for touch events, sorted by the times they are pressed
    __publicField(this, "_sortedTouchDict");
    dom.addEventListener("wheel", this.onWheel.bind(this));
    dom.addEventListener("keydown", this.onKeyDown.bind(this));
    document2.addEventListener("mousedown", this.onMouseDown.bind(this));
    document2.addEventListener("mousemove", this.onMouseMove.bind(this));
    document2.addEventListener("mouseup", this.onMouseUp.bind(this));
    document2.addEventListener("touchstart", this.onTouchStart.bind(this));
    document2.addEventListener("touchmove", this.onTouchMove.bind(this));
    document2.addEventListener("touchend", this.onTouchEnd.bind(this));
    this._onCursorDown = null;
    this._onCursorMove = null;
    this._onCursorUp = null;
    this._onScroll = null;
    this._onRotate = null;
    this._onKeyDown = null;
    this._currentCursorState = 0;
    this._pointerMode = "none";
    this._dom = dom;
    this._document = document2;
    this._sortedTouchArray = [];
    this._sortedTouchDict = {};
  }
  _callFuncWithCallbackParam(func, e) {
    func == null ? void 0 : func(
      e,
      e.target,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY
    );
  }
  _callFuncWithScrollCallbackParam(func, e, delta) {
    func == null ? void 0 : func(
      e,
      e.target,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY,
      delta
    );
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
  setRotateCallback(callback) {
    this._onRotate = callback;
  }
  setKeyDownCallback(callback) {
    this._onKeyDown = callback;
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
        return 0;
    }
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
      e.target,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY
    );
  }
  /**
   * Called when the user moves the mouse
   * @param e
   */
  onMouseMove(e) {
    var _a;
    const element = this._document.elementFromPoint(e.clientX, e.clientY);
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
   * Called when the user releases the mouse button
   * @param e
   */
  onMouseUp(e) {
    var _a;
    (_a = this._onCursorUp) == null ? void 0 : _a.call(
      this,
      e,
      e.target,
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
      e.target,
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
  onTouchStart(e) {
    var _a, _b, _c;
    const newTouchList = e.changedTouches;
    const prevSortedTouchArrayLength = this._sortedTouchArray.length;
    for (let i = 0; i < newTouchList.length; i++) {
      const touch = newTouchList[i];
      if (touch) {
        const data = {
          x: touch.clientX,
          y: touch.clientY,
          target: touch.target,
          identifier: touch.identifier
        };
        this._sortedTouchArray.unshift(data);
        this._sortedTouchDict[touch.identifier] = data;
      }
    }
    if (this._sortedTouchArray.length === 1) {
      (_a = this._onCursorDown) == null ? void 0 : _a.call(
        this,
        e,
        this._sortedTouchArray[0].target,
        1,
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y
      );
      return;
    }
    if (this._sortedTouchArray.length === 2) {
      if (prevSortedTouchArrayLength === 1) {
        (_b = this._onCursorUp) == null ? void 0 : _b.call(
          this,
          e,
          this._sortedTouchArray[1].target,
          1,
          this._sortedTouchArray[1].x,
          this._sortedTouchArray[1].y
        );
      }
      const middleX = (this._sortedTouchArray[0].x + this._sortedTouchArray[1].x) / 2;
      const middleY = (this._sortedTouchArray[0].y + this._sortedTouchArray[1].y) / 2;
      (_c = this._onCursorDown) == null ? void 0 : _c.call(
        this,
        e,
        this._sortedTouchArray[0].target,
        2,
        middleX,
        middleY
      );
      return;
    }
  }
  onTouchMove(e) {
    var _a, _b, _c;
    const updatedTouchArray = e.touches;
    const prevTouch_0 = this._sortedTouchArray.length > 0 ? { ...this._sortedTouchArray[0] } : null;
    const prevTouch_1 = this._sortedTouchArray.length > 1 ? { ...this._sortedTouchArray[1] } : null;
    for (let i = 0; i < updatedTouchArray.length; i++) {
      const touch = updatedTouchArray[i];
      if (touch) {
        const data = this._sortedTouchDict[touch.identifier];
        data.x = touch.clientX;
        data.y = touch.clientY;
        data.target = touch.target;
      }
    }
    if (this._sortedTouchArray.length === 1) {
      (_a = this._onCursorMove) == null ? void 0 : _a.call(
        this,
        e,
        this._sortedTouchArray[0].target,
        1,
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y
      );
      return;
    }
    if (this._sortedTouchArray.length < 2) {
      return;
    }
    const middleX = (this._sortedTouchArray[0].x + this._sortedTouchArray[1].x) / 2;
    const middleY = (this._sortedTouchArray[0].y + this._sortedTouchArray[1].y) / 2;
    const span = Math.sqrt(Math.pow(this._sortedTouchArray[0].x - this._sortedTouchArray[1].x, 2) + Math.pow(this._sortedTouchArray[0].y - this._sortedTouchArray[1].y, 2));
    let deltaSpan = 0;
    if (prevTouch_0 && prevTouch_1) {
      const prevSpan = Math.sqrt(Math.pow(prevTouch_0.x - prevTouch_1.x, 2) + Math.pow(prevTouch_0.y - prevTouch_1.y, 2));
      deltaSpan = span - prevSpan;
    }
    (_b = this._onCursorMove) == null ? void 0 : _b.call(
      this,
      e,
      this._sortedTouchArray[0].target,
      // TODO: find element at middle of two touch points
      2,
      middleX,
      middleY
    );
    (_c = this._onScroll) == null ? void 0 : _c.call(
      this,
      e,
      this._sortedTouchArray[0].target,
      2,
      middleX,
      middleY,
      deltaSpan
    );
  }
  onTouchEnd(e) {
    var _a, _b;
    const endTouchIDs = [];
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch) {
        endTouchIDs.push(touch.identifier);
      }
    }
    const deletedTouchArray = this._sortedTouchArray.filter((touch) => endTouchIDs.includes(touch.identifier));
    const prevSortedTouchArrayLength = this._sortedTouchArray.length;
    this._sortedTouchArray = this._sortedTouchArray.filter((touch) => !endTouchIDs.includes(touch.identifier));
    for (let id of endTouchIDs) {
      delete this._sortedTouchDict[id];
    }
    if (deletedTouchArray.length > 0) {
      if (prevSortedTouchArrayLength === 1) {
        (_a = this._onCursorUp) == null ? void 0 : _a.call(
          this,
          e,
          deletedTouchArray[0].target,
          1,
          deletedTouchArray[0].x,
          deletedTouchArray[0].y
        );
        return;
      }
      if (prevSortedTouchArrayLength === 2) {
        (_b = this._onCursorUp) == null ? void 0 : _b.call(
          this,
          e,
          deletedTouchArray[0].target,
          2,
          deletedTouchArray[0].x,
          deletedTouchArray[0].y
        );
      }
    }
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
    __publicField(this, "_type");
    this.g = globals;
    this.gid = (++globals.gid).toString();
    this.positionX = 0;
    this.positionY = 0;
    this._type = ObjectTypes.unspecified;
  }
  /**
   * Binds the mousedown event to the given DOM element.
   * @param dom The DOM element to bind the function to
   */
  bindFunction(dom) {
    dom.ontouchstart = this.domTouchStart.bind(this);
    dom.onmousedown = this.domMouseDown.bind(this);
  }
  domMouseDown(e) {
    console.debug(`Mouse down event triggered on ${this.gid}`);
    this.domCursorDown({
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY
    });
    e.stopPropagation();
  }
  domTouchStart(e) {
    var _a;
    console.debug(`Touch start event triggered on ${this.gid}`);
    this.domCursorDown({
      button: 0,
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY
    });
    (_a = this.g.snapline._inputControl) == null ? void 0 : _a.onTouchStart(e);
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
    [this.g.mousedown_x, this.g.mousedown_y] = this.g.camera.getCameraFromScreen(clientX, clientY);
    this.g.dx = 0;
    this.g.dy = 0;
    this.g.dx_offset = 0;
    this.g.dy_offset = 0;
    this._componentCursorDown(prop);
  }
  _componentCursorDown(_) {
    console.debug(
      `Base class componentCursorDown event triggered on ${this.gid} with prop ${JSON.stringify(_)}`
    );
  }
  /**
   * Mouse up event common to all elements.
   * Triggered when the dom of this object is released.
   */
  domCursorUp() {
    this._componentCursorUp();
  }
  _componentCursorUp() {
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
  _onDrag() {
  }
  /**
   *  Called for every frame when the camera is being panned.
   */
  onPan() {
  }
  /**
   *  Called when the object is being deleted.
   */
  delete() {
  }
}
class ComponentBase extends Base {
  constructor(parent, globals) {
    super(globals);
    __publicField(this, "parent");
    __publicField(this, "dom");
    this.parent = parent;
    this.dom = null;
  }
}
function returnUpdatedDict(currentDict, newDict) {
  const updatedDict = Object.assign({}, currentDict, newDict);
  updatedDict._requestUpdate = "true";
  return updatedDict;
}
function iterateDict(dict, callback, bind, includeKey = false) {
  for (const key in dict) {
    if (includeKey) {
      callback.bind(bind)(dict[key], key);
    } else {
      callback.bind(bind)(dict[key]);
    }
  }
}
function setDomStyle(dom, newStyle) {
  for (const key in newStyle) {
    if (key[0] == "_") {
      continue;
    }
    dom.style[key] = newStyle[key];
  }
}
class ConnectorComponent extends ComponentBase {
  /** ==================== Public methods ==================== */
  constructor(dom, config, parent, globals, outgoingLines, incomingLines) {
    super(parent, globals);
    __privateAdd(this, _ConnectorComponent_instances);
    __publicField(this, "config");
    __publicField(this, "name");
    // Name of the connector. This should describe the data associated with the connector
    __publicField(this, "connectorX");
    // Location of the connector on canvas
    __publicField(this, "connectorY");
    __publicField(this, "_connectorTotalOffsetX");
    // Location of the connector relative to the location of parent Node
    __publicField(this, "_connectorTotalOffsetY");
    __publicField(this, "prop");
    // Properties of the connector
    __publicField(this, "outgoingLines");
    __publicField(this, "incomingLines");
    __publicField(this, "_type", ObjectTypes.connector);
    __publicField(this, "dom");
    __publicField(this, "parent");
    this.dom = dom;
    this.parent = parent;
    this.prop = parent._prop;
    this.outgoingLines = outgoingLines;
    this.incomingLines = incomingLines;
    this.config = config;
    globals.gid++;
    this.name = config.name || globals.gid.toString();
    this.g.globalNodeTable[this.gid] = this;
    this.dom.setAttribute("data-snapline-gid", this.gid.toString());
    this.dom.setAttribute("data-snapline-type", "connector");
    this.connectorX = 0;
    this.connectorY = 0;
    this._connectorTotalOffsetX = 0;
    this._connectorTotalOffsetY = 0;
    this._updateDomProperties();
    this.bindFunction(this.dom);
    this.connectToConnector = this.connectToConnector.bind(this);
    this.disconnectFromConnector = this.disconnectFromConnector.bind(this);
  }
  updateFunction() {
  }
  // ==================== Hidden methods ====================
  _componentCursorDown(_) {
    const currentIncomingLines = this.incomingLines.filter(
      (i) => !i.requestDelete
    );
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0]);
      return;
    }
    if (this.config.allowDragOut) {
      this.startDragOutLine();
    }
  }
  _onDrag() {
    this.runDragOutLine();
  }
  _componentCursorUp() {
    this.endDragOutLine();
    this.parent._renderNodeLines();
  }
  _createLineDOM() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    svg.appendChild(line);
    svg.setAttribute("data-snapline-type", "connector-svg");
    line.setAttribute("data-snapline-type", "connector-line");
    line.setAttribute("stroke-width", "4");
    console.debug(`Created line from connector ${this.gid}`);
    this.g.canvas.appendChild(svg);
    return svg;
  }
  _updateDomProperties() {
    const this_rect = this.dom.getBoundingClientRect();
    if (!this.parent._dom) {
      console.error(`Parent DOM is null`);
      return;
    }
    const parent_rect = this.parent._dom.getBoundingClientRect();
    const [adjLeft, adjTop] = this.g.camera.getWorldDeltaFromCameraDelta(
      this_rect.left - parent_rect.left,
      this_rect.top - parent_rect.top
    );
    const [adjWidth, adjHeight] = this.g.camera.getWorldDeltaFromCameraDelta(
      this_rect.width / 2,
      // Get the center of the connector
      this_rect.height / 2
    );
    this._connectorTotalOffsetX = adjLeft + adjWidth;
    this._connectorTotalOffsetY = adjTop + adjHeight;
    this.connectorX = this.parent.positionX + this._connectorTotalOffsetX;
    this.connectorY = this.parent.positionY + this._connectorTotalOffsetY;
  }
  deleteLine(i) {
    if (this.outgoingLines.length == 0) {
      console.warn(`Error: Outgoing lines is empty`);
      return void 0;
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
  _renderLinePosition(entry) {
    const svg = entry.svg;
    if (!svg) {
      return;
    }
    setDomStyle(svg, {
      position: "absolute",
      overflow: "visible",
      pointerEvents: "none",
      willChange: "transform",
      transform: `translate3d(${entry.x1}px, ${entry.y1}px, 0)`
    });
    const line = svg.children[0];
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "" + (entry.x2 - entry.x1));
    line.setAttribute("y2", "" + (entry.y2 - entry.y1));
  }
  /**
   * Updates the start and end positions of the line.
   * @param entry The line to update.
   */
  _setLinePosition(entry) {
    entry.x1 = entry.start.connectorX;
    entry.y1 = entry.start.connectorY;
    if (!entry.target) {
      const [adjustedX, adjustedY] = this.g.camera.getWorldFromCamera(this.g.mousedown_x + this.g.dx, this.g.mousedown_y + this.g.dy);
      __privateMethod(this, _ConnectorComponent_instances, setLineXYPosition_fn).call(this, entry, adjustedX, adjustedY);
    } else {
      __privateMethod(this, _ConnectorComponent_instances, setLineXYPosition_fn).call(this, entry, entry.target.connectorX, entry.target.connectorY);
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
  /**
   * Creates a new line extending from this connector.
   * @param svg The SVG element to create the line in.
   * @returns The line object that was created.
   */
  createLine(svg) {
    const line = {
      svg,
      target: null,
      start: this,
      x1: this.connectorX,
      y1: this.connectorY,
      x2: 0,
      y2: 0,
      connector: this,
      requestDelete: false,
      completedDelete: false
    };
    return line;
  }
  /**
   * Begins the line drag operation, which will create a temporary line
   * extending from the connector to the mouse cursor.
   */
  startDragOutLine() {
    console.debug(
      `Created line from connector ${this.gid} and started dragging`
    );
    this.outgoingLines.unshift(this.createLine(null));
    this._setAllLinePositions();
  }
  /**
   * Called when the user drags the line extending from the connector.
   */
  runDragOutLine() {
    let distance = 9999;
    let connectorX = 0;
    let connectorY = 0;
    const hover = this.g.hoverDOM;
    if (this.outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    const [adjustedX, adjustedY] = this.g.camera.getWorldFromCamera(this.g.mousedown_x + this.g.dx, this.g.mousedown_y + this.g.dy);
    if (hover && hover.getAttribute("data-snapline-type") == "connector") {
      const gid = hover.getAttribute("data-snapline-gid");
      if (!gid) return;
      const targetConnector = this.g.globalNodeTable[gid];
      console.debug("Hovering over input connector", targetConnector);
      targetConnector._updateDomProperties();
      connectorX = targetConnector.connectorX;
      connectorY = targetConnector.connectorY;
      distance = Math.sqrt(
        Math.pow(this.connectorX + adjustedX - connectorX, 2) + Math.pow(this.connectorY + adjustedY - connectorY, 2)
      );
      if (distance < 40) {
        __privateMethod(this, _ConnectorComponent_instances, setLineXYPosition_fn).call(this, this.outgoingLines[0], connectorX, connectorY);
      } else {
        __privateMethod(this, _ConnectorComponent_instances, setLineXYPosition_fn).call(this, this.outgoingLines[0], adjustedX, adjustedY);
      }
    } else {
      __privateMethod(this, _ConnectorComponent_instances, setLineXYPosition_fn).call(this, this.outgoingLines[0], adjustedX, adjustedY);
    }
  }
  /**
   * Ends the line drag operation.
   * This will delete the temporary line created by startDragOutLine.
   * If the user is hovering over an input connector, then the line will be connected to the input connector.
   */
  endDragOutLine() {
    const hover = this.g.hoverDOM;
    if (hover && hover.getAttribute("data-snapline-type") == "connector") {
      const gid = hover.getAttribute("data-snapline-gid");
      console.debug("Connected to input connector: ", gid);
      if (!gid) {
        console.error(`Error: gid is null`);
        return;
      }
      const target = this.g.globalNodeTable[gid];
      if (this.connectToConnector(target, this.outgoingLines[0]) == false) {
        this.deleteLine(0);
        return;
      }
      target.prop[target.name] = this.prop[this.name];
      target.updateFunction();
      __privateMethod(this, _ConnectorComponent_instances, setLineXYPosition_fn).call(this, this.outgoingLines[0], target.connectorX, target.connectorY);
    } else {
      this.deleteLine(0);
    }
    this.parent._renderOutgoingLines(this.outgoingLines, this.name);
  }
  /**
   * Begins the process of dragging a line that is already connected to another connector.
   * @param line The line that is being dragged.
   */
  startPickUpLine(line) {
    this.g.targetObject = line.start;
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    this.deleteLine(this.incomingLines.indexOf(line));
    line.start.startDragOutLine();
  }
  /**
   * Logically connects this connector to another connector.
   *
   * @param connector The connector to connect to.
   * @param line The line to connect to the connector. If null, a new line will be created.
   * @returns True if the connection was successful, false otherwise.
   */
  connectToConnector(connector, line) {
    const currentIncomingLines = connector.incomingLines.filter(
      (i) => !i.requestDelete
    );
    if (currentIncomingLines.some((i) => i.start == this)) {
      console.warn(
        `Connector ${connector} already has a line connected to this connector`
      );
      return false;
    }
    if (connector.config.maxConnectors === currentIncomingLines.length) {
      console.warn(
        `Connector ${connector.name} already has max number of connectors (${connector.config.maxConnectors}) connected`
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
    return true;
  }
  /**
   * Logically disconnects this connector from another connector.
   * @param connector The connector to disconnect from.
   */
  disconnectFromConnector(connector) {
    for (const line of this.outgoingLines) {
      if (line.target == connector) {
        line.requestDelete = true;
        break;
      }
    }
  }
}
_ConnectorComponent_instances = new WeakSet();
// ==================== Private methods ====================
setLineXYPosition_fn = function(entry, x, y) {
  entry.x2 = x;
  entry.y2 = y;
};
class InputForm extends ComponentBase {
  // Properties of the component
  constructor(dom, parent, globals, config = {}) {
    super(parent, globals);
    __publicField(this, "name");
    // Name of the component
    __publicField(this, "dom");
    // The DOM element of the component
    __publicField(this, "prop");
    this.name = config.name || "";
    this.prop = parent._prop;
    this.dom = dom;
  }
  bindFunction(_) {
  }
  addInputUpdateListener(event, func) {
    this.dom.addEventListener(event, func.bind(this));
  }
}
class NodeComponent extends Base {
  // ================= Public functions =================
  constructor(dom, x, y, globals, config = {}) {
    super(globals);
    __privateAdd(this, _NodeComponent_instances);
    __publicField(this, "_type", ObjectTypes.node);
    __publicField(this, "_config");
    __publicField(this, "_dom");
    __publicField(this, "_connectors");
    // Dictionary of all connectors in the node, using the name as the key
    __publicField(this, "_components");
    // Dictionary of all components in the node except connectors
    __publicField(this, "_allOutgoingLines");
    // Dictionary of all lines going out of the node
    __publicField(this, "_allIncomingLines");
    // Dictionary of all lines coming into the node
    __publicField(this, "_nodeWidth", 0);
    __publicField(this, "_nodeHeight", 0);
    __publicField(this, "_dragStartX", 0);
    __publicField(this, "_dragStartY", 0);
    __publicField(this, "_freeze");
    // If true, the node cannot be moved
    __publicField(this, "_prop");
    // Properties of the node
    __publicField(this, "_propSetCallback");
    // Callbacks called when a property is set
    __publicField(this, "_nodeStyle");
    this._config = config;
    this._dom = dom;
    this._connectors = {};
    this._components = {};
    this._allOutgoingLines = {};
    this._allIncomingLines = {};
    this.positionX = x;
    this.positionY = y;
    this._dragStartX = this.positionX;
    this._dragStartY = this.positionY;
    this._freeze = false;
    this._prop = {};
    this._propSetCallback = {};
    this._setNodeStyle({
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left"
    });
    this.g.globalNodeList.push(this);
    this.init = this.init.bind(this);
    this.addConnector = this.addConnector.bind(this);
    this.addInputForm = this.addInputForm.bind(this);
    this.addSetPropCallback = this.addSetPropCallback.bind(this);
    this.delete = this.delete.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.offFocus = this.offFocus.bind(this);
    this.getConnector = this.getConnector.bind(this);
    this.getLines = this.getLines.bind(this);
    this.getNodeStyle = this.getNodeStyle.bind(this);
    this.getProp = this.getProp.bind(this);
    this.setProp = this.setProp.bind(this);
    this.setRenderNodeCallback = this.setRenderNodeCallback.bind(this);
    this.setRenderLinesCallback = this.setRenderLinesCallback.bind(this);
    this._setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
    });
    if (this._dom) {
      this.init(this._dom);
    }
  }
  // ================= Hidden functions =================
  /**
   * Sets the CSS style of the node.
   * Some styles are not CSS properties but internal properties, which are prefixed with an underscore.
   * @param style CSS style object
   */
  _setNodeStyle(style) {
    this._nodeStyle = returnUpdatedDict(this._nodeStyle, style);
  }
  /**
   * Filters out lines that have been requested to be deleted.
   * @param svgLines Array of all lines outgoing from the node or connector
   */
  _filterDeletedLines(svgLines) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i].requestDelete) {
        svgLines.splice(i, 1);
        i--;
      }
    }
  }
  /**
   * Renders the specified outgoing lines.
   * This function can be called by the node or a connector.on the node.
   * @param outgoingLines Array of all lines outgoing from the node or connector
   */
  _renderOutgoingLines(outgoingLines, key) {
    for (const line of outgoingLines) {
      const connector = line.start;
      if (!line.svg && !line.requestDelete) {
        line.svg = connector._createLineDOM();
      } else if (line.requestDelete && !line.completedDelete && line.svg) {
        this.g.canvas.removeChild(line.svg);
        line.completedDelete = true;
        continue;
      }
      if (!line.svg) {
        continue;
      }
      line.x1 = connector.connectorX;
      line.y1 = connector.connectorY;
      if (line.target) {
        line.x2 = line.target.connectorX;
        line.y2 = line.target.connectorY;
      }
      line.svg.style.transform = `translate3d(${connector.connectorX}px, ${connector.connectorY}px, 0)`;
      connector._renderLinePosition(line);
    }
    this._filterDeletedLines(outgoingLines);
  }
  /**
   * Renders all lines connected to the node.
   */
  _renderNodeLines() {
    iterateDict(this._allOutgoingLines, this._renderOutgoingLines, this);
    iterateDict(
      this._allIncomingLines,
      (lines) => {
        for (const line of lines) {
          const peerNode = line.start.parent;
          iterateDict(
            peerNode._allOutgoingLines,
            peerNode._renderOutgoingLines,
            peerNode
          );
        }
      },
      this
    );
  }
  /**
   * Renders the node with the specified style.
   * @param style CSS style object
   */
  _renderNode(style) {
    if (!this._dom) return;
    setDomStyle(this._dom, style);
    if (style._focus) {
      this._dom.setAttribute("data-snapline-state", "focus");
    } else {
      this._dom.setAttribute("data-snapline-state", "idle");
    }
    this._renderNodeLines();
  }
  _componentCursorDown(_) {
    var _a;
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
        __privateMethod(_a = this.g.focusNodes[i], _NodeComponent_instances, setStartPositions_fn).call(_a);
      }
    }
    __privateMethod(this, _NodeComponent_instances, setStartPositions_fn).call(this);
  }
  _componentCursorUp() {
    if (this._freeze) return;
    const [dx, dy] = this.g.camera.getWorldDeltaFromCameraDelta(
      this.g.dx,
      this.g.dy
    );
    this.positionX = this._dragStartX + dx;
    this.positionY = this._dragStartY + dy;
    if (!this.g.mouseHasMoved && this.g.targetObject && this.g.targetObject.gid == this.gid) {
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].offFocus();
      }
      this.g.focusNodes = [this];
      this.onFocus();
      return;
    }
    this._renderNode(this._nodeStyle);
  }
  /**
   * Fired every time requestAnimationFrame is called if this object is being dragged.
   * It reads the internal states like current mouse position,
   * and updates the DOM element accordingly.
   */
  _onDrag() {
    if (this._freeze) return;
    const [adjustedDeltaX, adjustedDeltaY] = this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);
    this.positionX = this._dragStartX + adjustedDeltaX;
    this.positionY = this._dragStartY + adjustedDeltaY;
    this._setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`
    });
    for (const connector of Object.values(this._connectors)) {
      connector._setAllLinePositions();
    }
    if (Object.keys(this._connectors).length == 0) return;
  }
  /**
   * Assigns the DOM element to the node.
   * @param dom
   */
  init(dom) {
    var _a;
    this._dom = dom;
    this._dom.id = this.gid;
    dom.setAttribute("data-snapline-type", "node");
    dom.setAttribute("data-snapline-state", "idle");
    if ((_a = this._config) == null ? void 0 : _a.nodeClass) {
      dom.setAttribute("data-snapline-class", this._config.nodeClass);
    }
    this._renderNode(this._nodeStyle);
    this.bindFunction(this._dom);
    new ResizeObserver(() => {
      __privateMethod(this, _NodeComponent_instances, updateDomProperties_fn).call(this);
      this._renderNode(this._nodeStyle);
    }).observe(this._dom);
  }
  /**
   * Sets the callback function that is called when the node is rendered.
   * @param callback
   */
  setRenderNodeCallback(callback) {
    this._renderNode = (style) => {
      callback(style);
      this._renderNodeLines();
    };
  }
  /**
   * Sets the callback function that is called when lines owned by the node (i.e. outgoing lines) are rendered.
   * @param
   */
  setRenderLinesCallback(callback) {
    this._renderOutgoingLines = (svgLines, name) => {
      this._filterDeletedLines(svgLines);
      callback(svgLines, name);
    };
  }
  /**
   * Returns the connector with the specified name.
   * @param name
   */
  getConnector(name) {
    if (!(name in this._connectors)) {
      console.error(`Connector ${name} does not exist in node ${this.gid}`);
      return null;
    }
    return this._connectors[name];
  }
  onFocus() {
    this._setNodeStyle({ _focus: true });
    this._renderNode(this._nodeStyle);
  }
  offFocus() {
    this._setNodeStyle({ _focus: false });
    this._renderNode(this._nodeStyle);
  }
  addConnector(dom, name, maxConnectors = 1, allowDragOut = true) {
    this._allOutgoingLines[name] = [];
    this._allIncomingLines[name] = [];
    const connector = new ConnectorComponent(
      dom,
      { name, maxConnectors, allowDragOut },
      this,
      this.g,
      this._allOutgoingLines[name],
      this._allIncomingLines[name]
    );
    this._connectors[name] = connector;
    this._prop[name] = null;
    return connector;
  }
  addInputForm(dom, name) {
    const input = new InputForm(dom, this, this.g, { name });
    this._prop[name] = null;
    return input;
  }
  addSetPropCallback(callback, name) {
    this._propSetCallback[name] = callback;
  }
  delete() {
    var _a;
    (_a = this.g.canvas) == null ? void 0 : _a.removeChild(this._dom);
    for (const connector of Object.values(this._connectors)) {
      connector.delete();
    }
  }
  getLines() {
    return this._allOutgoingLines;
  }
  getNodeStyle() {
    return this._nodeStyle;
  }
  getProp(name) {
    return this._prop[name];
  }
  setProp(name, value) {
    if (name in this._propSetCallback) {
      this._propSetCallback[name](value);
    }
    this._prop[name] = value;
    if (!(name in this._connectors)) {
      return;
    }
    const peers = this._connectors[name].outgoingLines.filter((line) => line.target && !line.requestDelete).map((line) => line.target);
    if (!peers) {
      return;
    }
    for (const peer of peers) {
      if (!peer) continue;
      peer.parent._prop[peer.name] = value;
      if (peer.parent._propSetCallback[peer.name]) {
        peer.parent._propSetCallback[peer.name](value);
      }
    }
  }
}
_NodeComponent_instances = new WeakSet();
// ================= Private functions =================
/**
 * Updates the DOM properties of the node, such as height, width, etc.
 * Also updates the DOM properties of all connectors.
 * Called when the node is first created, and when the node is resized.
 * @returns
 */
updateDomProperties_fn = function() {
  if (!this._dom) return;
  this._nodeHeight = this._dom.offsetHeight;
  this._nodeWidth = this._dom.offsetWidth;
  for (const connector of Object.values(this._connectors)) {
    connector._updateDomProperties();
  }
};
/**
 * Sets the starting position of the node when it is dragged.
 */
setStartPositions_fn = function() {
  this._dragStartX = this.positionX;
  this._dragStartY = this.positionY;
};
class Camera {
  // The CSS transform style that should be applied to the DOM element
  constructor(container, canvas) {
    /**
     * Represents a camera that can be used to pan and zoom the view of a DOM element.
     * This class maintains 3 coordinate systems:
     * - Device coordinates: The x,y coordinates of the pointer on the device screen.
     *   (0,0) is the top left corner of the screen and the x,y coordinates increase as you move right and down.
     * - Camera coordinates: The x,y coordinates of the camera view.
     *   (0,0) is the top left corner of the camera view and the x,y coordinates increase as you move right and down.
     * - World coordinates: The x,y coordinates of the world that the camera is viewing.
     *   (0,0) is the CENTER of the world and the x,y coordinates increase as you move right and down.
     */
    __publicField(this, "containerDom");
    // The DOM that represents the camera view
    __publicField(this, "containerOffsetX");
    // The x coordinate of the container DOM on the device screen
    __publicField(this, "containerOffsetY");
    // The y coordinate of the container DOM on the device screen
    __publicField(this, "canvasDom");
    // The dom that the camera is rendering
    __publicField(this, "cameraWidth");
    // The width of the camera view. This should be the same as the container width.
    __publicField(this, "cameraHeight");
    // The height of the camera view. This should be the same as the container height.
    __publicField(this, "cameraPositionX");
    // Position of the center of the camera
    __publicField(this, "cameraPositionY");
    __publicField(this, "cameraPanStartX");
    // Initial position of the camera when panning
    __publicField(this, "cameraPanStartY");
    __publicField(this, "zoom");
    // The zoom level of the camera, 1 means no zoom, smaller values zoom out, larger values zoom in
    __publicField(this, "canvasStyle");
    let containerRect = container.getBoundingClientRect();
    this.containerDom = container;
    this.containerOffsetX = containerRect.left;
    this.containerOffsetY = containerRect.top;
    this.canvasDom = canvas;
    this.cameraWidth = containerRect.width;
    this.cameraHeight = containerRect.height;
    this.cameraPositionX = 0;
    this.cameraPositionY = 0;
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
    this.zoom = 1;
    console.debug("Camera initialized", this);
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
  /**
   * Updates the camera view based on the current camera position and zoom level
   */
  updateCamera() {
    const matrix = this.worldToCameraMatrix(
      this.cameraPositionX,
      this.cameraPositionY,
      this.zoom,
      this.containerDom.clientWidth,
      this.containerDom.clientHeight
    );
    this.canvasStyle = `matrix3d(${matrix})`;
  }
  /**
   * Handle the scroll event to zoom in and out of the camera view
   * @param deltaZoom Amount of scroll
   * @param cameraX The x coordinate of the pointer in the camera view
   * @param cameraY The y coordinate of the pointer in the camera view
   */
  handleScroll(deltaZoom, cameraX, cameraY) {
    if (this.zoom + deltaZoom < 0.2) {
      deltaZoom = 0.2 - this.zoom;
    } else if (this.zoom + deltaZoom > 1) {
      deltaZoom = 1 - this.zoom;
    }
    const zoomRatio = this.zoom / (this.zoom + deltaZoom);
    this.cameraPositionX -= this.cameraWidth / this.zoom * (zoomRatio - 1) * (1 - (this.cameraWidth * 1.5 - cameraX) / this.cameraWidth);
    this.cameraPositionY -= this.cameraHeight / this.zoom * (zoomRatio - 1) * (1 - (this.cameraHeight * 1.5 - cameraY) / this.cameraHeight);
    this.zoom += deltaZoom;
    this.updateCamera();
  }
  /**
   * Updates the camera position based on the change in mouse position.
   * Compared to the 3 stage process of handlePanStart, handlePanDrag, and handlePanEnd functions,
   * using this functions may cause a slight deviance between mouse movement and camera movement
   * as the camera position is updated based on the change in mouse position.
   * @param deltaX  Change in mouse position
   * @param deltaY  Change in mouse position
   */
  handlePan(deltaX, deltaY) {
    this.cameraPositionX += deltaX / this.zoom;
    this.cameraPositionY += deltaY / this.zoom;
    this.updateCamera();
  }
  /**
   * Should be called when a user presses the pointer down to start panning the camera.
   * This function is the start of a 3-stage process to pan the camera:
   *    handlePanStart -> handlePanDrag -> handlePanEnd
   * This allows camera pans based on the absolute position of the pointer relative to when the pan started.
   */
  handlePanStart() {
    this.cameraPanStartX = this.cameraPositionX;
    this.cameraPanStartY = this.cameraPositionY;
  }
  /**
   * Updates the camera position based on the change in mouse position, relative to the start of the pan.
   * This function should be called after handlePanStart and before handlePanEnd.
   * @param deltaX  Change in mouse position
   * @param deltaY  Change in mouse position
   */
  handlePanDrag(deltaX, deltaY) {
    this.cameraPositionX = -deltaX / this.zoom + this.cameraPanStartX;
    this.cameraPositionY = -deltaY / this.zoom + this.cameraPanStartY;
    this.updateCamera();
  }
  /**
   * Should be called when a user releases the pointer to end panning the camera.
   * This function is the end of a 3-stage process to pan the camera:
   *    handlePanStart -> handlePanDrag -> handlePanEnd
   */
  handlePanEnd() {
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
  }
  /**
   * Converts the x and y coordinates of the world to the x and y coordinates of the camera view.
   * @param worldX  The x coordinate of the point in the world
   * @param worldY  The y coordinate of the point in the world
   * @returns The x and y coordinates of the point in the camera view
   */
  getCameraFromWorld(worldX, worldY) {
    const c_x = (worldX - this.cameraPositionX) * this.zoom + this.cameraWidth / 2;
    const c_y = (worldY - this.cameraPositionY) * this.zoom + this.cameraHeight / 2;
    return [c_x, c_y];
  }
  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the device screen.
   * @param cameraX The x coordinate of the point in the camera view
   * @param cameraY The y coordinate of the point in the camera view
   * @returns
   */
  getScreenFromCamera(cameraX, cameraY) {
    const s_x = cameraX + this.containerOffsetX;
    const s_y = cameraY + this.containerOffsetY;
    return [s_x, s_y];
  }
  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the world.
   * @param mouseX
   * @param mouseY
   * @returns
   */
  getWorldFromCamera(cameraX, cameraY) {
    const w_x = (cameraX - this.cameraWidth / 2) / this.zoom + this.cameraPositionX;
    const w_y = (cameraY - this.cameraHeight / 2) / this.zoom + this.cameraPositionY;
    return [w_x, w_y];
  }
  getCameraFromScreen(mouseX, mouseY) {
    mouseX = mouseX - this.containerOffsetX;
    mouseY = mouseY - this.containerOffsetY;
    return [mouseX, mouseY];
  }
  /**
   * Converts the change in x and y coordinates of the world to the change in x and y coordinates of the camera view.
   * @param worldDeltaX
   * @param worldDeltaY
   * @returns
   */
  getCameraDeltaFromWorldDelta(worldDeltaX, worldDeltaY) {
    const c_dx = worldDeltaX * this.zoom;
    const c_dy = worldDeltaY * this.zoom;
    return [c_dx, c_dy];
  }
  /**
   * Converts the change in x and y coordinates of the camera view to the change in x and y coordinates of the world.
   * @param cameraDeltaX
   * @param cameraDeltaY
   * @returns
   */
  getWorldDeltaFromCameraDelta(cameraDeltaX, cameraDeltaY) {
    const w_dx = cameraDeltaX / this.zoom;
    const w_dy = cameraDeltaY / this.zoom;
    return [w_dx, w_dy];
  }
}
class SnapLine {
  // ============== Public functions ==============
  /**
   * Constructor for SnapLine class.
   */
  constructor() {
    __privateAdd(this, _SnapLine_instances);
    __publicField(this, "g");
    __publicField(this, "_containerStyle", {});
    __publicField(this, "_canvasStyle", {});
    __publicField(this, "_selectionBoxStyle", {});
    __publicField(this, "_backgroundStyle", {});
    __publicField(this, "_inputControl", null);
    this.g = {};
    this._containerStyle = {
      position: "relative",
      overflow: "hidden"
    };
    this._selectionBoxStyle = {
      position: "absolute",
      pointerEvents: "none"
    };
    this.init = this.init.bind(this);
    this.setRenderCanvasCallback = this.setRenderCanvasCallback.bind(this);
    this.setRenderBackgroundCallback = this.setRenderBackgroundCallback.bind(this);
    this.setRenderSelectionBoxCallback = this.setRenderSelectionBoxCallback.bind(this);
  }
  // ============== Hidden functions ==============
  /**
   * Update the dictionary containing the CSS style for the canvas.
   * @param newStyle The new style to be added to the canvas.
   */
  _setCanvasStyle(newStyle) {
    this._canvasStyle = returnUpdatedDict(this._canvasStyle, newStyle);
  }
  /**
   * Update the dictionary containing the CSS style for the background.
   * @param newStyle The new style to be added to the background.
   */
  _setBackgroundStyle(newStyle) {
    this._backgroundStyle = returnUpdatedDict(this._backgroundStyle, newStyle);
  }
  /**
   * Update the dictionary containing the CSS style for the selection box.
   * @param newStyle The new style to be added to the selection box.
   */
  _setSelectionBoxStyle(newStyle) {
    this._selectionBoxStyle = returnUpdatedDict(
      this._selectionBoxStyle,
      newStyle
    );
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
  _onCursorDown(_, element, button, clientX, clientY) {
    if (element !== this.g.canvasContainer && element !== this.g.canvasBackground) {
      console.debug("Ignoring cursor down event");
      return;
    }
    this.g._currentMouseDown = button;
    if (this.g.targetObject && this.g.targetObject._type == ObjectTypes.connector) {
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
    [g.mousedown_x, g.mousedown_y] = this.g.camera.getCameraFromScreen(
      clientX,
      clientY
    );
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
  _onCursorMove(_, ___, __, clientX, clientY) {
    const g = this.g;
    g.hoverDOM = document.elementFromPoint(clientX, clientY);
    [g.mouseCameraX, g.mouseCameraY] = this.g.camera.getCameraFromScreen(
      clientX,
      clientY
    );
    [g.mouseWorldX, g.mouseWorldY] = this.g.camera.getWorldFromCamera(
      g.mouseCameraX,
      g.mouseCameraY
    );
    g.dx = g.mouseCameraX - g.mousedown_x;
    g.dy = g.mouseCameraY - g.mousedown_y;
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
          transform: `translate(${this.g.camera.cameraPositionX + -this.g.camera.cameraWidth * 5}px, ${this.g.camera.cameraPositionY + -this.g.camera.cameraHeight * 5}px)`,
          backgroundPosition: `${-this.g.camera.cameraPositionX}px ${-this.g.camera.cameraPositionY}px`
        });
      } else if (g._currentMouseDown == cursorState.mouseLeft || g._currentMouseDown == cursorState.touchSingle) {
        let [left, top] = [
          Math.min(g.mousedown_x, g.mouseCameraX),
          Math.min(g.mousedown_y, g.mouseCameraY)
        ];
        this._setSelectionBoxStyle({
          width: Math.abs(g.dx) + "px",
          height: Math.abs(g.dy) + "px",
          left: left + "px",
          top: top + "px",
          opacity: "1",
          position: "absolute"
        });
        const [adjStartX, adjStartY] = this.g.camera.getWorldFromCamera(
          left,
          top
        );
        const [adjEndX, adjEndY] = this.g.camera.getWorldFromCamera(
          Math.max(g.mousedown_x, g.mouseCameraX),
          Math.max(g.mousedown_y, g.mouseCameraY)
        );
        const selectedNodes = [];
        for (const node of g.globalNodeList) {
          if (node.positionX + node._nodeWidth > adjStartX && node.positionX < adjEndX && node.positionY + node._nodeHeight > adjStartY && node.positionY < adjEndY) {
            node.onFocus();
            selectedNodes.push(node);
          } else {
            node.offFocus();
          }
        }
        g.focusNodes = selectedNodes;
      }
    } else {
      if (g.targetObject._type == ObjectTypes.node) {
        for (const node of g.focusNodes) {
          node._onDrag();
        }
      } else {
        g.targetObject._onDrag();
      }
    }
  }
  /**
   * Event handler when mouse or touchscreen is released.
   * @returns
   */
  _onCursorUp(_, __, ___, ____, _____) {
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
      } else if (g.targetObject._type == ObjectTypes.node) {
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
    console.debug("targetObject set to null");
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
  _onZoom(_, __, ______, ____, _____, deltaY) {
    this.g.camera.handleScroll(
      deltaY / 1e3,
      this.g.mouseCameraX,
      this.g.mouseCameraY
    );
    this._setCanvasStyle({
      transform: this.g.camera.canvasStyle
    });
  }
  /**
   * Applies the canvas CSS styles to the canvas DOM element.
   * This function is typically used in vanilla JS projects which does not have a reactive system to automatically update the DOM.
   * @param style Dictionary of CSS styles to be applied to the canvas.
   */
  _renderCanvas(style) {
    setDomStyle(this.g.canvas, style);
  }
  /**
   * Applies the background CSS styles to the background DOM element.
   * This function is typically used in vanilla JS projects which does not have a reactive system to automatically update the DOM.
   * @param style Dictionary of CSS styles to be applied to the background.
   */
  _renderBackground(style) {
    setDomStyle(this.g.canvasBackground, style);
  }
  /**
   * Applies the selection box CSS styles to the selection box DOM element.
   * This function is typically used in vanilla JS projects which does not have a reactive system to automatically update the DOM.
   * @param style Dictionary of CSS styles to be applied to the selection box.
   */
  _renderSelectionBox(style) {
    setDomStyle(this.g.selectionBox, style);
  }
  /**
   * Renders elements currently in the canvas.
   * This function is used by Vanilla JS projects that do not have a reactive system to automatically update the DOM.
   */
  _renderElements() {
    const target = this.g.targetObject;
    if (target == null) {
      return;
    }
    if (target._type == ObjectTypes.node) {
      for (const node of this.g.focusNodes) {
        node._renderNode(node._nodeStyle);
      }
    } else if (target._type == ObjectTypes.connector) {
      const target2 = this.g.targetObject;
      target2.parent._renderNodeLines();
    }
  }
  /**
   * Initialize global stats, dom elements, and event listeners for the library.
   * @param containerDom: The element that will be used to render the canvas and it's nodes.
   * @param canvasDom: The canvas element that will contain the nodes and all other components. It should be a direct child of the containerDom.
   * @param backgroundDom: The background element that will be used to render the background of the canvas. It should be a direct child of the containerDom.
   * @param selectionBoxDom: The element that will be used as the selection box. It should be a direct child of the containerDom.
   */
  init(containerDom, canvasDom, backgroundDom, selectionBoxDom) {
    this.g = {
      canvas: canvasDom,
      canvasContainer: containerDom,
      canvasBackground: backgroundDom,
      selectionBox: selectionBoxDom,
      _currentMouseDown: cursorState.none,
      mousedown_x: 0,
      mousedown_y: 0,
      mouseCameraX: 0,
      mouseCameraY: 0,
      mouseWorldX: 0,
      mouseWorldY: 0,
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
      position: "absolute"
    });
    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);
    this._inputControl = new InputControl(containerDom, document);
    this._inputControl.setCursorDownCallback(this._onCursorDown.bind(this));
    this._inputControl.setCursorMoveCallback(this._onCursorMove.bind(this));
    this._inputControl.setCursorUpCallback(this._onCursorUp.bind(this));
    this._inputControl.setScrollCallback(this._onZoom.bind(this));
    window.requestAnimationFrame(__privateMethod(this, _SnapLine_instances, step_fn).bind(this));
  }
  /**
   * Creates an instance of a node.
   * Note that this function will not add the DOM to the canvas.
   * The caller must manually add the DOM using document.appendChild() or use a framework that will automatically add the DOM.
   *
   * @param dom: The DOM element that will be used as the node. If null, NodeComponent.init() must be called later to specify the DOM element.
   * @param x: The x position of the node.
   * @param y: The y position of the node.
   * @returns A reference to the node.
   */
  createNode(dom = null, x = 0, y = 0, config) {
    const node = new NodeComponent(dom, x, y, this.g, config);
    this.g.globalNodeTable[node.gid] = node;
    return node;
  }
  // addNodeAtMouse(node: NodeComponent, e: MouseEvent) {
  //   this.g.ignoreMouseUp = true;
  //   const x = this.g.mouseWorldX;
  //   const y = this.g.mouseWorldY;
  //   console.debug("Adding node at " + x + ", " + y);
  //   this.addNode(node, x, y);
  //   node.setStartPositions();
  //   this.g._currentMouseDown = cursorState.mouseLeft;
  //   this.g.mousedown_x = this.g.mouseCameraX;
  //   this.g.mousedown_y = this.g.mouseCameraY;
  //   this.g.focusNodes = [node];
  //   this.g.targetObject = node;
  //   for (const node of this.g.globalNodeList) {
  //     node.offFocus();
  //   }
  //   this._onCursorMove(e, null, this.g._currentMouseDown, e.clientX, e.clientY);
  // }
  /**
   * Deletes a node from the canvas.
   * Note that this function will not remove the DOM from the canvas - the caller
   * must manually remove the DOM using document.removeChild() or use a framework that will automatically remove the DOM.
   * @param gid The global id of the node to be deleted.
   * @returns True if the node was successfully deleted, false otherwise.
   */
  deleteNode(gid) {
    if (!(gid in this.g.globalNodeTable)) {
      console.error("Node not found: " + gid);
      return false;
    }
    this.g.globalNodeTable[gid].delete();
    const { [gid]: _, ...rest } = this.g.globalNodeTable;
    this.g.globalNodeTable = rest;
    return true;
  }
  /**
   * Focus on a node with the given global id.
   * @param gid The global id of the node to be focused.
   * @returns True if the node was successfully focused, false otherwise.
   */
  focusNode(gid) {
    if (!(gid in this.g.globalNodeTable)) return false;
    const node = this.g.globalNodeTable[gid];
    node.onFocus();
    return true;
  }
  /**
   * Set the canvas render function to the given callback.
   * @param gid The global id of the node to be unfocused.
   * @returns True if the node was successfully unfocused, false otherwise.
   */
  setRenderCanvasCallback(callback) {
    this._renderCanvas = callback;
  }
  setRenderBackgroundCallback(callback) {
    this._renderBackground = callback;
  }
  setRenderSelectionBoxCallback(callback) {
    this._renderSelectionBox = callback;
  }
}
_SnapLine_instances = new WeakSet();
// ============== Private functions ==============
/**
 * Main loop for rendering the canvas.
 */
step_fn = function() {
  this._renderElements();
  this._renderCanvas(this._canvasStyle);
  this._renderBackground(this._backgroundStyle);
  this._renderSelectionBox(this._selectionBoxStyle);
  window.requestAnimationFrame(__privateMethod(this, _SnapLine_instances, step_fn).bind(this));
};
export {
  SnapLine as default
};
