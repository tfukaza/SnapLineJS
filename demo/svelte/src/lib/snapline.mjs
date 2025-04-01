var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _SnapLine_instances, step_fn, _NodeComponent_instances, setStartPositions_fn;
class Camera {
  constructor(container, config = {}) {
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
    // canvasDom: HTMLElement; // The dom that the camera is rendering
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
    __publicField(this, "config");
    __publicField(this, "canvasStyle");
    // The CSS transform style that should be applied to the DOM element
    __publicField(this, "cameraCenterMode");
    __publicField(this, "resizeObserver");
    let containerRect = container.getBoundingClientRect();
    this.containerDom = container;
    this.containerOffsetX = containerRect.left;
    this.containerOffsetY = containerRect.top;
    this.cameraWidth = containerRect.width;
    this.cameraHeight = containerRect.height;
    this.cameraPositionX = 0;
    this.cameraPositionY = 0;
    this.cameraCenterMode = "topLeft";
    if (this.cameraCenterMode == "topLeft") {
      this.cameraPositionX = this.cameraWidth / 2;
      this.cameraPositionY = this.cameraHeight / 2;
    }
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
    this.zoom = 1;
    const defaultConfig = {
      enableZoom: true,
      zoomBounds: { min: 0.2, max: 1 },
      enablePan: true,
      panBounds: { top: null, left: null, right: null, bottom: null }
    };
    this.config = { ...defaultConfig, ...config };
    console.debug("Camera initialized", this);
    this.canvasStyle = "";
    this.updateCamera();
    const resizeObserver = new ResizeObserver(() => {
      console.debug("Camera resize", this);
      this.updateCameraProperty();
    });
    resizeObserver.observe(this.containerDom);
    this.resizeObserver = resizeObserver;
    window.addEventListener("scroll", () => {
      console.debug("Camera scroll", this);
      this.updateCameraProperty();
    });
  }
  updateCameraProperty() {
    let containerRect = this.containerDom.getBoundingClientRect();
    this.containerOffsetX = containerRect.left;
    this.containerOffsetY = containerRect.top;
    this.cameraWidth = containerRect.width;
    this.cameraHeight = containerRect.height;
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
    if (!this.config.enableZoom) {
      return;
    }
    if (this.zoom + deltaZoom < 0.2) {
      deltaZoom = 0.2 - this.zoom;
    } else if (this.zoom + deltaZoom > 1) {
      deltaZoom = 1 - this.zoom;
    }
    if (this.config.zoomBounds) {
      if (this.zoom + deltaZoom < this.config.zoomBounds.min) {
        deltaZoom = 0;
      } else if (this.zoom + deltaZoom > this.config.zoomBounds.max) {
        deltaZoom = 0;
      }
    }
    const zoomRatio = this.zoom / (this.zoom + deltaZoom);
    if (this.config.enablePan) {
      this.cameraPositionX -= this.cameraWidth / this.zoom * (zoomRatio - 1) * (1 - (this.cameraWidth * 1.5 - cameraX) / this.cameraWidth);
      this.cameraPositionY -= this.cameraHeight / this.zoom * (zoomRatio - 1) * (1 - (this.cameraHeight * 1.5 - cameraY) / this.cameraHeight);
    }
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
    if (!this.config.enablePan) {
      return;
    }
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
    if (!this.config.enablePan) {
      return;
    }
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
    if (!this.config.enablePan) {
      return;
    }
    this.cameraPositionX = -deltaX / this.zoom + this.cameraPanStartX;
    this.cameraPositionY = -deltaY / this.zoom + this.cameraPanStartY;
    if (this.config.panBounds) {
      if (this.config.panBounds.left !== null && this.cameraPositionX < this.config.panBounds.left) {
        this.cameraPositionX = this.config.panBounds.left + 1;
      }
      if (this.config.panBounds.right !== null && this.cameraPositionX > this.config.panBounds.right) {
        this.cameraPositionX = this.config.panBounds.right - 1;
      }
      if (this.config.panBounds.top !== null && this.cameraPositionY < this.config.panBounds.top) {
        this.cameraPositionY = this.config.panBounds.top - 1;
      }
      if (this.config.panBounds.bottom !== null && this.cameraPositionY > this.config.panBounds.bottom) {
        this.cameraPositionY = this.config.panBounds.bottom + 1;
      }
    }
    this.updateCamera();
  }
  /**
   * Should be called when a user releases the pointer to end panning the camera.
   * This function is the end of a 3-stage process to pan the camera:
   *    handlePanStart -> handlePanDrag -> handlePanEnd
   */
  handlePanEnd() {
    if (!this.config.enablePan) {
      return;
    }
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
class InputEventCallback {
  constructor() {
    __publicField(this, "_mouseDownCallback");
    __publicField(this, "_mouseMoveCallback");
    __publicField(this, "_mouseUpCallback");
    __publicField(this, "_mouseWheelCallback");
    __publicField(this, "_touchStartCallback");
    __publicField(this, "_touchMoveCallback");
    __publicField(this, "_touchEndCallback");
    __publicField(this, "_touchPinchCallback");
    this._mouseDownCallback = null;
    this._mouseMoveCallback = null;
    this._mouseUpCallback = null;
    this._mouseWheelCallback = null;
    this._touchStartCallback = null;
    this._touchMoveCallback = null;
    this._touchEndCallback = null;
    this._touchPinchCallback = null;
  }
  set mouseDownCallback(callback) {
    this._mouseDownCallback = callback;
  }
  get mouseDownCallback() {
    if (!this._mouseDownCallback) {
      return () => {
      };
    }
    return this._mouseDownCallback;
  }
  set mouseMoveCallback(callback) {
    this._mouseMoveCallback = callback;
  }
  get mouseMoveCallback() {
    if (!this._mouseMoveCallback) {
      return () => {
      };
    }
    return this._mouseMoveCallback;
  }
  set mouseUpCallback(callback) {
    this._mouseUpCallback = callback;
  }
  get mouseUpCallback() {
    if (!this._mouseUpCallback) {
      return () => {
      };
    }
    return this._mouseUpCallback;
  }
  set mouseWheelCallback(callback) {
    this._mouseWheelCallback = callback;
  }
  get mouseWheelCallback() {
    if (!this._mouseWheelCallback) {
      return () => {
      };
    }
    return this._mouseWheelCallback;
  }
  set touchStartCallback(callback) {
    this._touchStartCallback = callback;
  }
  get touchStartCallback() {
    if (!this._touchStartCallback) {
      return () => {
      };
    }
    return this._touchStartCallback;
  }
  set touchMoveCallback(callback) {
    this._touchMoveCallback = callback;
  }
  get touchMoveCallback() {
    if (!this._touchMoveCallback) {
      return () => {
      };
    }
    return this._touchMoveCallback;
  }
  set touchEndCallback(callback) {
    this._touchEndCallback = callback;
  }
  get touchEndCallback() {
    if (!this._touchEndCallback) {
      return () => {
      };
    }
    return this._touchEndCallback;
  }
  set touchPinchCallback(callback) {
    this._touchPinchCallback = callback;
  }
  get touchPinchCallback() {
    if (!this._touchPinchCallback) {
      return () => {
      };
    }
    return this._touchPinchCallback;
  }
}
class InputControl {
  constructor(global) {
    /**
     * Functions as a middleware that converts mouse and touch events into a unified event format.
     */
    __publicField(this, "_domElement");
    __publicField(this, "global");
    __publicField(this, "_pointerMode");
    __publicField(this, "_sortedTouchArray");
    // List of touches for touch events, sorted by the times they are pressed
    __publicField(this, "_sortedTouchDict");
    // Dictionary of touches for touch events, indexed by the touch identifier
    __publicField(this, "event");
    this.global = global;
    this._pointerMode = "none";
    this._domElement = null;
    this._sortedTouchArray = [];
    this._sortedTouchDict = {};
    this.event = new InputEventCallback();
  }
  convertMouseToCursorState(buttons) {
    switch (buttons) {
      case 1:
        return 1;
      case 2:
        return 3;
      case 4:
        return 2;
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
    const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
      e.clientX,
      e.clientY
    );
    const [worldX, worldY] = this.global.camera.getWorldFromCamera(
      cameraX,
      cameraY
    );
    this.event.mouseDownCallback({
      event: e,
      element: e.target,
      button: this.convertMouseToCursorState(e.buttons),
      clientX: e.clientX,
      clientY: e.clientY,
      worldX,
      worldY,
      cameraX,
      cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      gid: null
    });
    e.stopPropagation();
  }
  /**
   * Called when the user moves the mouse
   * @param e
   */
  onMouseMove(e) {
    const element = document == null ? void 0 : document.elementFromPoint(e.clientX, e.clientY);
    const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
      e.clientX,
      e.clientY
    );
    const [worldX, worldY] = this.global.camera.getWorldFromCamera(
      cameraX,
      cameraY
    );
    this.event.mouseMoveCallback({
      event: e,
      element,
      button: this.convertMouseToCursorState(e.buttons),
      clientX: e.clientX,
      clientY: e.clientY,
      worldX,
      worldY,
      cameraX,
      cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      gid: null
    });
    e.stopPropagation();
  }
  /**
   * Called when the user releases the mouse button
   * @param e
   */
  onMouseUp(e) {
    const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
      e.clientX,
      e.clientY
    );
    const [worldX, worldY] = this.global.camera.getWorldFromCamera(
      cameraX,
      cameraY
    );
    this.event.mouseUpCallback({
      event: e,
      element: e.target,
      button: this.convertMouseToCursorState(e.buttons),
      clientX: e.clientX,
      clientY: e.clientY,
      worldX,
      worldY,
      cameraX,
      cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      gid: null
    });
    e.stopPropagation();
  }
  /**
   * Called when the user scrolls the mouse wheel
   * @param e
   */
  onWheel(e) {
    const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
      e.clientX,
      e.clientY
    );
    const [worldX, worldY] = this.global.camera.getWorldFromCamera(
      cameraX,
      cameraY
    );
    this.event.mouseWheelCallback({
      event: e,
      element: e.target,
      button: 2,
      clientX: e.clientX,
      clientY: e.clientY,
      worldX,
      worldY,
      cameraX,
      cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      delta: e.deltaY,
      gid: null
    });
  }
  /**
   * Called when the user presses a key
   * @param e
   * @returns
   */
  // onKeyDown(e: KeyboardEvent) {
  //   this._onKeyDown?.(e);
  // }
  onTouchStart(e) {
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
      let [clientX, clientY] = [
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y
      ];
      const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
        clientX,
        clientY
      );
      const [worldX, worldY] = this.global.camera.getWorldFromCamera(
        cameraX,
        cameraY
      );
      this.event.touchStartCallback({
        event: e,
        element: this._sortedTouchArray[0].target,
        button: 1,
        clientX,
        clientY,
        worldX,
        worldY,
        cameraX,
        cameraY,
        screenX: clientX,
        screenY: clientY,
        gid: null
      });
      return;
    }
    if (this._sortedTouchArray.length === 2) {
      if (prevSortedTouchArrayLength === 1) {
        let [clientX, clientY] = [
          this._sortedTouchArray[1].x,
          this._sortedTouchArray[1].y
        ];
        const [cameraX2, cameraY2] = this.global.camera.getCameraFromScreen(
          clientX,
          clientY
        );
        const [worldX2, worldY2] = this.global.camera.getWorldFromCamera(
          cameraX2,
          cameraY2
        );
        this.event.touchStartCallback({
          event: e,
          element: this._sortedTouchArray[1].target,
          button: 1,
          clientX,
          clientY,
          worldX: worldX2,
          worldY: worldY2,
          cameraX: cameraX2,
          cameraY: cameraY2,
          screenX: clientX,
          screenY: clientY,
          gid: null
        });
      }
      const middleX = (this._sortedTouchArray[0].x + this._sortedTouchArray[1].x) / 2;
      const middleY = (this._sortedTouchArray[0].y + this._sortedTouchArray[1].y) / 2;
      const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
        middleX,
        middleY
      );
      const [worldX, worldY] = this.global.camera.getWorldFromCamera(
        cameraX,
        cameraY
      );
      this.event.touchStartCallback({
        event: e,
        element: this._sortedTouchArray[0].target,
        button: 2,
        clientX: middleX,
        clientY: middleY,
        worldX,
        worldY,
        cameraX,
        cameraY,
        screenX: middleX,
        screenY: middleY,
        gid: null
      });
      return;
    }
  }
  onTouchMove(e) {
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
      let [clientX, clientY] = [
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y
      ];
      const [cameraX2, cameraY2] = this.global.camera.getCameraFromScreen(
        clientX,
        clientY
      );
      const [worldX2, worldY2] = this.global.camera.getWorldFromCamera(
        cameraX2,
        cameraY2
      );
      this.event.touchMoveCallback({
        event: e,
        element: this._sortedTouchArray[0].target,
        button: 1,
        clientX,
        clientY,
        worldX: worldX2,
        worldY: worldY2,
        cameraX: cameraX2,
        cameraY: cameraY2,
        screenX: clientX,
        screenY: clientY,
        gid: null
      });
      return;
    }
    if (this._sortedTouchArray.length < 2) {
      return;
    }
    const middleX = (this._sortedTouchArray[0].x + this._sortedTouchArray[1].x) / 2;
    const middleY = (this._sortedTouchArray[0].y + this._sortedTouchArray[1].y) / 2;
    const span = Math.sqrt(
      Math.pow(this._sortedTouchArray[0].x - this._sortedTouchArray[1].x, 2) + Math.pow(this._sortedTouchArray[0].y - this._sortedTouchArray[1].y, 2)
    );
    let deltaSpan = 0;
    if (prevTouch_0 && prevTouch_1) {
      const prevSpan = Math.sqrt(
        Math.pow(prevTouch_0.x - prevTouch_1.x, 2) + Math.pow(prevTouch_0.y - prevTouch_1.y, 2)
      );
      deltaSpan = span - prevSpan;
    }
    const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
      middleX,
      middleY
    );
    const [worldX, worldY] = this.global.camera.getWorldFromCamera(
      cameraX,
      cameraY
    );
    this.event.touchMoveCallback({
      event: e,
      element: this._sortedTouchArray[0].target,
      // TODO: find element at middle of two touch points
      button: 2,
      clientX: middleX,
      clientY: middleY,
      worldX,
      worldY,
      cameraX,
      cameraY,
      screenX: middleX,
      screenY: middleY,
      gid: null
    });
    this.event.touchPinchCallback({
      event: e,
      element: this._sortedTouchArray[0].target,
      button: 2,
      clientX: middleX,
      clientY: middleY,
      worldX,
      worldY,
      cameraX,
      cameraY,
      screenX: middleX,
      screenY: middleY,
      delta: deltaSpan,
      gid: null
    });
  }
  onTouchEnd(e) {
    const endTouchIDs = [];
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch) {
        endTouchIDs.push(touch.identifier);
      }
    }
    const deletedTouchArray = this._sortedTouchArray.filter(
      (touch) => endTouchIDs.includes(touch.identifier)
    );
    const prevSortedTouchArrayLength = this._sortedTouchArray.length;
    this._sortedTouchArray = this._sortedTouchArray.filter(
      (touch) => !endTouchIDs.includes(touch.identifier)
    );
    for (let id of endTouchIDs) {
      delete this._sortedTouchDict[id];
    }
    if (deletedTouchArray.length > 0) {
      if (prevSortedTouchArrayLength === 1) {
        let [clientX, clientY] = [
          deletedTouchArray[0].x,
          deletedTouchArray[0].y
        ];
        const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
          clientX,
          clientY
        );
        const [worldX, worldY] = this.global.camera.getWorldFromCamera(
          cameraX,
          cameraY
        );
        this.event.touchEndCallback({
          event: e,
          element: deletedTouchArray[0].target,
          button: 1,
          clientX,
          clientY,
          worldX,
          worldY,
          cameraX,
          cameraY,
          screenX: clientX,
          screenY: clientY,
          gid: null
        });
        return;
      }
      if (prevSortedTouchArrayLength === 2) {
        let [clientX, clientY] = [
          deletedTouchArray[0].x,
          deletedTouchArray[0].y
        ];
        const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
          clientX,
          clientY
        );
        const [worldX, worldY] = this.global.camera.getWorldFromCamera(
          cameraX,
          cameraY
        );
        this.event.touchEndCallback({
          event: e,
          element: deletedTouchArray[0].target,
          button: 1,
          clientX,
          clientY,
          worldX,
          worldY,
          cameraX,
          cameraY,
          screenX: clientX,
          screenY: clientY,
          gid: null
        });
      }
    }
  }
  addCursorEventListener(dom) {
    dom.addEventListener("mousedown", (e) => {
      this.onMouseDown(e);
    });
    dom.addEventListener("mousemove", (e) => {
      this.onMouseMove(e);
    });
    dom.addEventListener("mouseup", (e) => {
      this.onMouseUp(e);
    });
    dom.addEventListener("wheel", (e) => {
      this.onWheel(e);
    });
    dom.addEventListener("touchstart", (e) => {
      this.onTouchStart(e);
      e.stopPropagation();
    });
    dom.addEventListener("touchmove", (e) => {
      this.onTouchMove(e);
      e.stopPropagation();
    });
    dom.addEventListener("touchend", (e) => {
      this.onTouchEnd(e);
    });
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
function getDomProperty(global, dom) {
  const rect = dom.getBoundingClientRect();
  if (global.camera == null) {
    return {
      height: rect.height,
      width: rect.width,
      worldX: rect.left,
      worldY: rect.top,
      cameraX: rect.left,
      cameraY: rect.top,
      screenX: rect.left,
      screenY: rect.top
    };
  }
  const [cameraX, cameraY] = global.camera.getCameraFromScreen(
    rect.left,
    rect.top
  );
  const [worldX, worldY] = global.camera.getWorldFromCamera(cameraX, cameraY);
  const [cameraWidth, cameraHeight] = global.camera.getCameraDeltaFromWorldDelta(rect.width, rect.height);
  const [worldWidth, worldHeight] = global.camera.getWorldDeltaFromCameraDelta(
    cameraWidth,
    cameraHeight
  );
  return {
    height: worldHeight,
    width: worldWidth,
    worldX,
    worldY,
    cameraX,
    cameraY,
    screenX: rect.left,
    screenY: rect.top
  };
}
function EventProxyFactory(object, dict, dict2 = null) {
  return new Proxy(dict, {
    set: (target, prop, value) => {
      if (value == null) {
        target[prop] = null;
      } else {
        target[prop] = value.bind(object);
      }
      return true;
    },
    get: (target, prop) => {
      return (...args) => {
        var _a, _b;
        args[0].gid = object.gid;
        (_a = dict2 == null ? void 0 : dict2[prop]) == null ? void 0 : _a.call(dict2, ...args);
        (_b = target[prop]) == null ? void 0 : _b.call(target, ...args);
      };
    }
  });
}
let EventCallback$1 = class EventCallback {
  constructor(object) {
    __publicField(this, "_object");
    __publicField(this, "_global");
    __publicField(this, "global");
    __publicField(this, "_dom");
    __publicField(this, "dom");
    this._object = object;
    this._global = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null
    };
    this.global = new Proxy(this._global, {
      set: (target, prop, value) => {
        var _a, _b;
        if (value == null) {
          (_a = this._object.global.snapline) == null ? void 0 : _a.unsubscribeGlobalCursorEvent(
            prop,
            this._object.gid
          );
        } else {
          (_b = this._object.global.snapline) == null ? void 0 : _b.subscribeGlobalCursorEvent(
            prop,
            this._object.gid,
            value.bind(this._object)
          );
        }
        return true;
      }
    });
    this._dom = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null
    };
    this.dom = EventProxyFactory(
      this._object,
      this._dom,
      this._object.global.snapline.event
    );
  }
};
class BaseObject {
  /* Colliders of the object */
  constructor(global, parent) {
    __publicField(this, "global");
    /* Reference to the global stats object */
    __publicField(this, "gid");
    /* Unique identifier for the object */
    __publicField(this, "parent");
    /* Parent of the object */
    __publicField(this, "children", []);
    /* Children of the object */
    __publicField(this, "position");
    __publicField(this, "positionMode");
    __publicField(this, "event");
    __publicField(this, "_colliderList", []);
    this.global = global;
    this.gid = global.getGlobalId();
    this.global.objectTable[this.gid] = this;
    this.parent = parent;
    this._colliderList = [];
    this.position = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0
    };
    this.positionMode = "absolute";
    this.event = new EventCallback$1(this);
  }
  get worldX() {
    return this.position.worldX;
  }
  set worldX(x) {
    this.position.worldX = x;
  }
  get worldY() {
    return this.position.worldY;
  }
  set worldY(y) {
    this.position.worldY = y;
  }
  get localX() {
    return this.position.localX;
  }
  set localX(x) {
    this.position.localX = x;
  }
  get localY() {
    return this.position.localY;
  }
  set localY(y) {
    this.position.localY = y;
  }
  set worldPosition(position) {
    if (this.parent) {
      console.warn(
        "Not recommended to directly set world position of a child object"
      );
    }
    this.worldX = position[0];
    this.worldY = position[1];
    if (this.parent) {
      this.localX = this.worldX - this.parent.worldX;
      this.localY = this.worldY - this.parent.worldY;
    }
    if (this.global.camera) ;
    if (this.children.length > 0) {
      for (const child of this.children) {
        child.updateProperty();
      }
    }
  }
  get worldPosition() {
    return [this.worldX, this.worldY];
  }
  set localPosition(position) {
    this.localX = position[0];
    this.localY = position[1];
    if (this.parent) {
      this.worldX = this.parent.worldX + this.localX;
      this.worldY = this.parent.worldY + this.localY;
    }
    if (this.global.camera) ;
    if (this.children.length > 0) {
      for (const child of this.children) {
        child.updateProperty();
      }
    }
  }
  addCollider(collider) {
    var _a;
    this._colliderList.push(collider);
    (_a = this.global.collisionEngine) == null ? void 0 : _a.addObject(collider);
  }
  submitRenderQueue() {
    this.global.domRenderQueue.push(this);
  }
  render() {
  }
  delete() {
  }
  fetchProperty() {
    for (const rigidBody of this._colliderList) {
      rigidBody.fetchProperty();
    }
    for (const child of this.children) {
      child.fetchProperty();
    }
  }
  paint() {
  }
  /**
   * Recalculates the property of the object, such as the position, size, etc.
   * based on current properties of the game object.
   * This function assumes the relative position (localX and Y) and sizes of
   * all parent and children objects are up to date.
   * If it is not, fetchProperty() should be called first.
   */
  updateProperty() {
    if (this.parent) {
      this.worldX = this.parent.worldX + this.localX;
      this.worldY = this.parent.worldY + this.localY;
    }
    if (this.global.camera) ;
    for (const rigidBody of this._colliderList) {
      rigidBody.updateProperty();
    }
    for (const child of this.children) {
      child.updateProperty();
    }
  }
  getClassFromGid(gid) {
    if (this.global == null) {
      return null;
    }
    return this.global.objectTable[gid];
  }
  getClassFromDOM(dom) {
    if (this.global == null) {
      return null;
    }
    const gid = dom.getAttribute("data-snapline-gid");
    if (!gid) {
      return null;
    }
    return this.getClassFromGid(gid);
  }
}
class ElementCallback {
  constructor(object) {
    __publicField(this, "_object");
    __publicField(this, "_renderCallback", null);
    this._object = object;
  }
  set renderCallback(callback) {
    this._renderCallback = callback.bind(this._object);
  }
  get renderCallback() {
    if (this._renderCallback) {
      this._renderCallback();
    }
    return () => {
    };
  }
}
class DomElement {
  constructor(global, parent, dom, insertMode = {}, isFragment = false) {
    __publicField(this, "_uuid");
    __publicField(this, "_global");
    __publicField(this, "_parent");
    __publicField(this, "_domElement");
    __publicField(this, "_domProperty");
    __publicField(this, "_pendingInsert");
    __publicField(this, "_requestRender", false);
    __publicField(this, "_requestFetch", false);
    __publicField(this, "_requestDelete", false);
    __publicField(this, "_style");
    __publicField(this, "_classList");
    __publicField(this, "_inputEngine");
    __publicField(this, "_event");
    __publicField(this, "event");
    __publicField(this, "callback");
    __publicField(this, "localX");
    __publicField(this, "localY");
    __publicField(this, "positionMode");
    __publicField(this, "_domPosition");
    __publicField(this, "_transformApplied");
    __publicField(this, "insertMode");
    __publicField(this, "resizeObserver");
    __publicField(this, "mutationObserver");
    var _a;
    this._global = global;
    this._domElement = dom;
    this._domProperty = {
      height: 0,
      width: 0
    };
    this._domPosition = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0
    };
    this._transformApplied = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0
    };
    this._pendingInsert = isFragment;
    this._parent = parent;
    this._uuid = (++global.gid).toString();
    this._requestRender = false;
    this._requestFetch = false;
    this._requestDelete = false;
    this._style = {};
    this.positionMode = "absolute";
    this._classList = [];
    this._event = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null
    };
    this.event = EventProxyFactory(parent, this._event);
    this.callback = new ElementCallback(parent);
    this._inputEngine = new InputControl(this._global);
    (_a = this._inputEngine) == null ? void 0 : _a.addCursorEventListener(this._domElement);
    this._inputEngine.event.mouseDownCallback = this._onCursorDown.bind(this);
    this._inputEngine.event.mouseMoveCallback = this._onCursorMove.bind(this);
    this._inputEngine.event.mouseUpCallback = this._onCursorUp.bind(this);
    this._inputEngine.event.mouseWheelCallback = this._onCursorScroll.bind(this);
    this.submitRenderQueue();
    this.submitFetchQueue();
    this.localX = 0;
    this.localY = 0;
    this.insertMode = insertMode;
    this.resizeObserver = new ResizeObserver(() => {
      this.submitFetchQueue();
    });
    this.resizeObserver.observe(this._domElement);
    this.mutationObserver = new MutationObserver(() => {
      this.submitFetchQueue();
    });
    this.mutationObserver.observe(this._domElement, {
      childList: true,
      subtree: true
    });
  }
  set localPosition(position) {
    this.localX = position[0];
    this.localY = position[1];
    this.submitRenderQueue();
  }
  get localPosition() {
    return [this.localX, this.localY];
  }
  get cameraPosition() {
    var _a;
    return ((_a = this._global.camera) == null ? void 0 : _a.getCameraFromWorld(this.localX, this.localY)) ?? [
      0,
      0
    ];
  }
  set cameraPosition(position) {
    throw new Error("cameraPosition is read only");
  }
  get screenPosition() {
    var _a;
    return ((_a = this._global.camera) == null ? void 0 : _a.getScreenFromCamera(...this.cameraPosition)) ?? [0, 0];
  }
  set screenPosition(position) {
    throw new Error("screenPosition is read only");
  }
  set style(style) {
    this._style = style;
    this.submitRenderQueue();
  }
  get style() {
    return this._style;
  }
  set classList(classList) {
    this._classList = classList;
    this.submitRenderQueue();
  }
  get classList() {
    return this._classList;
  }
  _onCursorDown(prop) {
    var _a, _b;
    (_b = (_a = this.event).onCursorDown) == null ? void 0 : _b.call(_a, prop);
  }
  _onCursorMove(prop) {
    var _a, _b;
    (_b = (_a = this.event).onCursorMove) == null ? void 0 : _b.call(_a, prop);
  }
  _onCursorUp(prop) {
    var _a, _b;
    (_b = (_a = this.event).onCursorUp) == null ? void 0 : _b.call(_a, prop);
  }
  _onCursorScroll(prop) {
    var _a, _b;
    (_b = (_a = this.event).onCursorScroll) == null ? void 0 : _b.call(_a, prop);
  }
  moveTo(mode) {
    this.insertMode = mode;
    this._pendingInsert = true;
    this.submitRenderQueue();
  }
  submitRenderQueue() {
    if (this._requestRender == false) {
      this._requestRender = true;
      this._global.domRenderQueue.push(this);
    }
  }
  render() {
    var _a;
    setDomStyle(this._domElement, this._style);
    this._domElement.classList.forEach((className) => {
      this._domElement.classList.add(className);
    });
    if (this._pendingInsert) {
      if (this.insertMode.appendChild) {
        this.insertMode.appendChild.appendChild(this._domElement);
      } else if (this.insertMode.insertBefore) {
        this.insertMode.insertBefore[0].insertBefore(
          this._domElement,
          this.insertMode.insertBefore[1]
        );
      } else if (this.insertMode.replaceChild) {
        this.insertMode.replaceChild.replaceChild(
          this._domElement,
          this.insertMode.replaceChild
        );
      } else {
        (_a = this._global.containerElement) == null ? void 0 : _a.appendChild(this._domElement);
      }
      this._pendingInsert = false;
    }
    this._requestRender = false;
    this.submitFetchQueue();
  }
  submitDeleteQueue() {
    if (this._requestDelete == false) {
      this._requestDelete = true;
      this._global.domDeleteQueue.push(this);
      this._global.domPaintQueue.push(this);
    }
  }
  delete() {
    var _a;
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    (_a = this._global.containerElement) == null ? void 0 : _a.removeChild(this._domElement);
  }
  submitFetchQueue() {
    if (this._requestFetch == false) {
      this._requestFetch = true;
      this._global.domFetchQueue.push(this);
    }
  }
  fetchProperty() {
    if (this._pendingInsert) {
      return;
    }
    const property = getDomProperty(this._global, this._domElement);
    this._domProperty.height = property.height;
    this._domProperty.width = property.width;
    this._domPosition.worldX = property.worldX - this._transformApplied.worldX;
    this._domPosition.worldY = property.worldY - this._transformApplied.worldY;
    this._requestFetch = false;
  }
  paint() {
    let transformStyle = {};
    if (this.positionMode == "relative") {
      transformStyle = {
        transform: `none`
      };
      [this._transformApplied.worldX, this._transformApplied.worldY] = [0, 0];
    } else if (this.positionMode == "fixed") {
      transformStyle = {
        transform: `translate3d(${this._parent.worldX + this.localX}px, ${this._parent.worldY + this.localY}px, 0px)`
      };
      [this._transformApplied.worldX, this._transformApplied.worldY] = [
        this._parent.worldX + this.localX,
        this._parent.worldY + this.localY
      ];
    } else {
      let [newX, newY] = [
        this._parent.worldX + this.localX - this._domPosition.worldX,
        this._parent.worldY + this.localY - this._domPosition.worldY
      ];
      transformStyle = {
        transform: `translate3d(${newX}px, ${newY}px, 0px)`
      };
      [this._transformApplied.worldX, this._transformApplied.worldY] = [
        newX,
        newY
      ];
    }
    setDomStyle(this._domElement, {
      ...this._style,
      ...transformStyle
    });
  }
}
class ElementObject extends BaseObject {
  constructor(global, parent) {
    super(global, parent);
    __publicField(this, "_domElementList", []);
    __publicField(this, "_requestRender");
    __publicField(this, "_requestFetch");
    __publicField(this, "_requestDelete");
    __publicField(this, "_requestPaint");
    __publicField(this, "_state", {});
    __publicField(this, "state");
    __publicField(this, "_parentElement");
    /* Parent element of the object */
    __publicField(this, "_elementIndex");
    /* Index of the element in the parent */
    __publicField(this, "inScene", false);
    /* Whether the object is in the scene */
    __publicField(this, "callback");
    this.inScene = false;
    this.callback = new ElementCallback(this);
    this._parentElement = null;
    this._elementIndex = -1;
    this._requestRender = false;
    this._requestFetch = false;
    this._requestDelete = false;
    this._requestPaint = false;
    let _this = this;
    this.state = new Proxy(this._state, {
      set: (target, prop, value) => {
        target[prop] = value;
        _this.submitRenderQueue();
        _this.submitFetchQueue();
        return true;
      }
    });
  }
  set worldPosition(position) {
    this.position.worldX = position[0];
    this.position.worldY = position[1];
    this.submitRenderQueue();
  }
  addDom(dom) {
    let domElement = new DomElement(this.global, this, dom);
    domElement.event.onCursorDown = this.event.dom.onCursorDown;
    domElement.event.onCursorMove = this.event.dom.onCursorMove;
    domElement.event.onCursorUp = this.event.dom.onCursorUp;
    domElement.event.onCursorScroll = this.event.dom.onCursorScroll;
    this._domElementList.push(domElement);
    return domElement;
  }
  get dom() {
    return this._domElementList[0];
  }
  submitRenderQueue() {
    if (this._requestRender == false) {
      this._requestRender = true;
      this.global.domRenderQueue.push(this);
      this.global.domPaintQueue.push(this);
    }
  }
  render() {
    for (const domElement of this._domElementList) {
      domElement.render();
    }
    this.callback.renderCallback();
    this._requestRender = false;
  }
  submitDeleteQueue() {
    if (this._requestDelete == false) {
      this._requestDelete = true;
      this.global.domDeleteQueue.push(this);
    }
  }
  delete() {
    for (const child of this.children) {
      child.delete();
    }
    for (const domElement of this._domElementList) {
      domElement.submitDeleteQueue();
    }
  }
  submitFetchQueue() {
    if (this._requestFetch == false) {
      this._requestFetch = true;
      this.global.domFetchQueue.push(this);
    }
  }
  fetchProperty() {
    for (const domElement of this._domElementList) {
      domElement.fetchProperty();
    }
  }
  submitPaintQueue() {
    if (this._requestPaint == false) {
      this._requestPaint = true;
      this.global.domPaintQueue.push(this);
    }
  }
  paint() {
    for (const domElement of this._domElementList) {
      domElement.paint();
    }
  }
}
class EventCallback2 {
  constructor(object) {
    __publicField(this, "_object");
    __publicField(this, "_collider");
    __publicField(this, "collider");
    __publicField(this, "_dom");
    __publicField(this, "dom");
    this._object = object;
    this._collider = {
      onCollide: null,
      onBeginContact: null,
      onEndContact: null
    };
    this.collider = EventProxyFactory(object, this._collider);
    this._dom = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null
    };
    this.dom = EventProxyFactory(object, this._dom);
  }
}
class Collider {
  constructor(global, parent, type, localX, localY) {
    __publicField(this, "global");
    __publicField(this, "parent");
    __publicField(this, "type");
    __publicField(this, "localX");
    __publicField(this, "localY");
    __publicField(this, "width");
    __publicField(this, "height");
    __publicField(this, "uuid");
    __publicField(this, "domElement");
    __publicField(this, "inputEngine");
    __publicField(this, "event");
    __publicField(this, "_currentCollisions");
    __publicField(this, "_iterationCollisions");
    this.global = global;
    this.parent = parent;
    this.type = type;
    this.uuid = Symbol();
    this.domElement = null;
    this.localX = localX;
    this.localY = localY;
    this.width = 0;
    this.height = 0;
    this.event = new EventCallback2(this.parent);
    this._iterationCollisions = /* @__PURE__ */ new Set();
    this._currentCollisions = /* @__PURE__ */ new Set();
    this.updateProperty();
    this.inputEngine = new InputControl(this.global);
  }
  get worldX() {
    return this.parent.position.worldX + this.localX;
  }
  get worldY() {
    return this.parent.position.worldY + this.localY;
  }
  set localPosition([x, y]) {
    this.localX = x;
    this.localY = y;
  }
  assignDom(domElement) {
    var _a;
    this.domElement = domElement;
    (_a = this.inputEngine) == null ? void 0 : _a.addCursorEventListener(this.domElement);
    this.updateProperty();
  }
  fetchProperty() {
    if (!this.domElement) {
      return;
    }
    const property = getDomProperty(this.global, this.domElement);
    this.localX = property.worldX - this.parent.position.worldX;
    this.localY = property.worldY - this.parent.position.worldY;
    this.width = property.width;
    this.height = property.height;
  }
  updateProperty() {
  }
}
class RectCollider extends Collider {
  constructor(global, parent, localX, localY, width, height) {
    super(global, parent, "rect", localX, localY);
    this.width = width;
    this.height = height;
  }
}
class CircleCollider extends Collider {
  constructor(global, parent, localX, localY, radius) {
    super(global, parent, "circle", localX, localY);
    __publicField(this, "radius");
    this.radius = radius;
  }
}
class PointCollider extends Collider {
  constructor(global, parent, localX, localY) {
    super(global, parent, "point", localX, localY);
  }
}
class CollisionEngine {
  constructor() {
    __publicField(this, "objectTable", {});
    __publicField(this, "objectList", []);
    __publicField(this, "sortedXCoordinates", []);
    this.sortedXCoordinates = [];
  }
  addObject(object) {
    this.objectTable[object.uuid] = object;
    this.objectList.push(object);
    this.sortedXCoordinates.push({
      collider: object,
      x: object.worldX,
      left: true
    });
    this.sortedXCoordinates.push({
      collider: object,
      x: object.worldX + (object.width ?? 0),
      left: false
    });
    if (object.type === "rect") {
      console.debug(
        `Added rect ${object.parent.gid} to collision engine. Position: ${object.worldX}, ${object.worldY}, height: ${object.height}, width: ${object.width}`
      );
    } else if (object.type === "circle") {
      console.debug(
        `Added circle ${object.parent.gid} to collision engine. Position: ${object.worldX}, ${object.worldY}, radius: ${object.radius}`
      );
    } else if (object.type === "point") {
      console.debug(
        `Added point ${object.parent.gid} to collision engine. Position: ${object.worldX}, ${object.worldY}`
      );
    }
  }
  removeObject(uuid) {
    delete this.objectTable[uuid];
    this.objectList = this.objectList.filter((obj) => obj.uuid !== uuid);
  }
  updateXCoordinates() {
    for (const entry of this.sortedXCoordinates) {
      if (entry.left) {
        if (entry.collider.type === "circle") {
          entry.x = entry.collider.worldX - entry.collider.radius;
        } else if (entry.collider.type === "rect") {
          entry.x = entry.collider.worldX;
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldX;
        }
      } else {
        if (entry.collider.type === "circle") {
          entry.x = entry.collider.worldX + entry.collider.radius;
        } else if (entry.collider.type === "rect") {
          entry.x = entry.collider.worldX + entry.collider.width;
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldX;
        }
      }
    }
  }
  sortXCoordinates() {
    this.sortedXCoordinates.sort((a, b) => {
      return a.x - b.x;
    });
  }
  detectCollisions() {
    var _a, _b;
    this.updateXCoordinates();
    this.sortXCoordinates();
    let localCollisions = /* @__PURE__ */ new Set();
    for (const entry of this.sortedXCoordinates) {
      if (entry.left) {
        for (const collider of localCollisions) {
          if (this.isIntersecting(entry.collider, collider)) {
            this.onColliderCollide(entry.collider, collider);
            this.onColliderCollide(collider, entry.collider);
          }
        }
        localCollisions.add(entry.collider);
      } else {
        localCollisions.delete(entry.collider);
      }
    }
    for (const entry of this.sortedXCoordinates) {
      if (!entry.left) {
        continue;
      }
      for (const currentCollision of entry.collider._currentCollisions) {
        if (!entry.collider._iterationCollisions.has(currentCollision)) {
          (_b = (_a = entry.collider.event.collider).onEndContact) == null ? void 0 : _b.call(
            _a,
            entry.collider,
            currentCollision
          );
          entry.collider._currentCollisions.delete(currentCollision);
        }
      }
      entry.collider._iterationCollisions.clear();
    }
  }
  isIntersecting(a, b) {
    const colliderA = a;
    const colliderB = b;
    if (colliderA.type === "rect" && colliderB.type === "rect") {
      return this.isRectIntersecting(colliderA, colliderB);
    } else if (colliderA.type === "circle" && colliderB.type === "circle") {
      return this.isCircleIntersecting(
        colliderA,
        colliderB
      );
    } else if (colliderA.type === "rect" && colliderB.type === "circle") {
      return this.isRectCircleIntersecting(
        colliderA,
        colliderB
      );
    } else if (colliderA.type === "circle" && colliderB.type === "rect") {
      return this.isRectCircleIntersecting(
        colliderB,
        colliderA
      );
    } else if (colliderA.type === "rect" && colliderB.type === "point") {
      return this.isRectPointIntersecting(
        colliderA,
        colliderB
      );
    } else if (colliderA.type === "point" && colliderB.type === "rect") {
      return this.isRectPointIntersecting(
        colliderB,
        colliderA
      );
    } else if (colliderA.type === "point" && colliderB.type === "circle") {
      return this.isCirclePointIntersecting(
        colliderB,
        colliderA
      );
    } else if (colliderA.type === "circle" && colliderB.type === "point") {
      return this.isCirclePointIntersecting(
        colliderA,
        colliderB
      );
    } else if (colliderA.type === "point" && colliderB.type === "point") {
      return this.isPointPointIntersecting(
        colliderA,
        colliderB
      );
    }
    return false;
  }
  onColliderCollide(thisObject, otherObject) {
    var _a, _b;
    if (thisObject.event.collider.onCollide) {
      thisObject.event.collider.onCollide(thisObject, otherObject);
    }
    if (thisObject._currentCollisions.has(otherObject)) ;
    else {
      console.debug(`onColliderCollide, ${thisObject} and ${otherObject}`);
      (_b = (_a = thisObject.event.collider).onBeginContact) == null ? void 0 : _b.call(_a, thisObject, otherObject);
      thisObject._currentCollisions.add(otherObject);
    }
    thisObject._iterationCollisions.add(otherObject);
  }
  isRectIntersecting(a, b) {
    return a.uuid !== b.uuid && a.worldY < b.worldY + b.height && a.worldY + a.height > b.worldY;
  }
  isRectCircleIntersecting(rect, circle) {
    let rectX = circle.worldX;
    let rectY = circle.worldY;
    if (circle.worldX < rect.worldX) {
      rectX = rect.worldX;
    } else if (circle.worldX > rect.worldX + rect.width) {
      rectX = rect.worldX + rect.width;
    }
    if (circle.worldY < rect.worldY) {
      rectY = rect.worldY;
    } else if (circle.worldY > rect.worldY + rect.height) {
      rectY = rect.worldY + rect.height;
    }
    let distanceX = circle.worldX - rectX;
    let distanceY = circle.worldY - rectY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }
  isRectPointIntersecting(rect, point) {
    return point.worldX >= rect.worldX && point.worldX <= rect.worldX + rect.width && point.worldY >= rect.worldY && point.worldY <= rect.worldY + rect.height;
  }
  isCirclePointIntersecting(circle, point) {
    let distanceX = circle.worldX - point.worldX;
    let distanceY = circle.worldY - point.worldY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }
  isCircleIntersecting(circleA, circleB) {
    if (circleA.uuid === circleB.uuid) {
      return false;
    }
    let distanceX = circleA.worldX - circleB.worldX;
    let distanceY = circleA.worldY - circleB.worldY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circleA.radius ?? 0) + (circleB.radius ?? 0);
  }
  isPointPointIntersecting(pointA, pointB) {
    if (pointA.uuid === pointB.uuid) {
      return false;
    }
    return pointA.worldX === pointB.worldX && pointA.worldY === pointB.worldY;
  }
}
class GlobalManager {
  constructor() {
    __publicField(this, "containerElement");
    __publicField(this, "currentCursor");
    __publicField(this, "cursor");
    __publicField(this, "camera");
    __publicField(this, "inputEngine");
    __publicField(this, "collisionEngine");
    __publicField(this, "objectTable");
    __publicField(this, "domRenderQueue");
    __publicField(this, "domDeleteQueue");
    __publicField(this, "domFetchQueue");
    __publicField(this, "domPaintQueue");
    __publicField(this, "fetchQueue");
    __publicField(this, "data");
    __publicField(this, "snapline");
    __publicField(this, "gid");
    this.containerElement = null;
    this.currentCursor = cursorState.none;
    this.cursor = {
      worldX: 0,
      worldY: 0,
      cameraX: 0,
      cameraY: 0,
      screenX: 0,
      screenY: 0
    };
    this.camera = null;
    this.inputEngine = null;
    this.collisionEngine = null;
    this.objectTable = {};
    this.domRenderQueue = [];
    this.domDeleteQueue = [];
    this.domFetchQueue = [];
    this.domPaintQueue = [];
    this.fetchQueue = [];
    this.data = {};
    this.snapline = null;
    this.gid = 0;
  }
  getGlobalId() {
    this.gid++;
    return this.gid.toString();
  }
}
class CameraControl extends ElementObject {
  constructor(globals) {
    super(globals, null);
    __publicField(this, "_state", "idle");
    __publicField(this, "_mouseDownX");
    __publicField(this, "_mouseDownY");
    __publicField(this, "_canvasElement", null);
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._state = "idle";
    this._canvasElement = null;
    this.event.global.onCursorDown = this.onCursorDown;
    this.event.global.onCursorMove = this.onCursorMove;
    this.event.global.onCursorUp = this.onCursorUp;
    this.event.global.onCursorScroll = this.onZoom;
    console.debug("CameraControl constructor");
    this.callback.renderCallback = this.renderCanvas;
  }
  assignCanvas(canvas) {
    var _a;
    this._canvasElement = canvas;
    setDomStyle(this._canvasElement, {
      position: "relative",
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px",
      transform: (_a = this.global.camera) == null ? void 0 : _a.canvasStyle
    });
  }
  onCursorDown(prop) {
    var _a;
    if (prop.button != cursorState.mouseMiddle) {
      return;
    }
    console.log("Begin camera pan");
    this._state = "panning";
    this._mouseDownX = prop.screenX;
    this._mouseDownY = prop.screenY;
    (_a = this.global.camera) == null ? void 0 : _a.handlePanStart();
  }
  onCursorMove(prop) {
    var _a;
    if (prop.button != cursorState.mouseMiddle) {
      return;
    }
    if (this._state != "panning") {
      return;
    }
    const dx = prop.screenX - this._mouseDownX;
    const dy = prop.screenY - this._mouseDownY;
    (_a = this.global.camera) == null ? void 0 : _a.handlePanDrag(dx, dy);
    this.submitRenderQueue();
  }
  onCursorUp(prop) {
    var _a;
    if (this._state != "panning") {
      return;
    }
    console.log("Camera panning end");
    this._state = "idle";
    (_a = this.global.camera) == null ? void 0 : _a.handlePanEnd();
    this.submitRenderQueue();
  }
  onZoom(prop) {
    var _a;
    (_a = this.global.camera) == null ? void 0 : _a.handleScroll(
      prop.delta / 2e3,
      prop.cameraX,
      prop.cameraY
    );
    this.submitRenderQueue();
  }
  renderCanvas() {
    var _a;
    if (this._canvasElement) {
      setDomStyle(this._canvasElement, {
        transform: (_a = this.global.camera) == null ? void 0 : _a.canvasStyle
      });
    }
  }
}
class SnapLine {
  /**
   * Constructor for SnapLine class.
   */
  constructor(config = {}) {
    __privateAdd(this, _SnapLine_instances);
    __publicField(this, "snaplineConfig");
    __publicField(this, "cameraConfig");
    __publicField(this, "_containerStyle", {});
    __publicField(this, "_cameraControl", null);
    __publicField(this, "global");
    __publicField(this, "_cursorDownCallbacks", {});
    __publicField(this, "_cursorMoveCallbacks", {});
    __publicField(this, "_cursorUpCallbacks", {});
    __publicField(this, "_cursorScrollCallbacks", {});
    __publicField(this, "_collisionEngine", null);
    __publicField(this, "event");
    this.global = new GlobalManager();
    this.global.snapline = this;
    let defaultConfig = {
      cameraConfig: {
        enableZoom: true,
        enablePan: true,
        panBounds: { top: null, left: null, right: null, bottom: null }
      }
    };
    this.snaplineConfig = {
      ...defaultConfig,
      ...config
    };
    this.cameraConfig = {
      ...defaultConfig.cameraConfig,
      ...config.cameraConfig
    };
    this._containerStyle = {
      position: "relative",
      overflow: "hidden"
    };
    this.event = {
      onCursorDown: this._onCursorDownGlobal.bind(this),
      onCursorMove: this._onCursorMoveGlobal.bind(this),
      onCursorUp: this._onCursorUpGlobal.bind(this),
      onCursorScroll: this._onZoomGlobal.bind(this)
    };
    this._cursorDownCallbacks = {};
    this._cursorMoveCallbacks = {};
    this._cursorUpCallbacks = {};
    this._cursorScrollCallbacks = {};
    this.global.collisionEngine = new CollisionEngine();
  }
  /**
   * Initialize global stats, dom elements, and event listeners for the library.
   * @param containerDom: The element that contains all other elements.
   */
  assignDom(containerDom) {
    this.global.containerElement = containerDom;
    this.global.camera = new Camera(containerDom, this.cameraConfig);
    this.global.inputEngine = new InputControl(this.global);
    this.global.inputEngine.addCursorEventListener(
      document
    );
    this.global.inputEngine.event.mouseDownCallback = this._onCursorDownGlobal.bind(this);
    this.global.inputEngine.event.mouseMoveCallback = this._onCursorMoveGlobal.bind(this);
    this.global.inputEngine.event.mouseUpCallback = this._onCursorUpGlobal.bind(this);
    this.global.inputEngine.event.mouseWheelCallback = this._onZoomGlobal.bind(this);
    window.requestAnimationFrame(__privateMethod(this, _SnapLine_instances, step_fn).bind(this));
  }
  assignCameraControl(canvasElement) {
    this._cameraControl = new CameraControl(this.global);
    this._cameraControl.assignCanvas(canvasElement);
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
  _onCursorDownGlobal(prop) {
    for (const [id, callback] of Object.entries(this._cursorDownCallbacks)) {
      callback(prop);
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
  _onCursorMoveGlobal(prop) {
    this.global.cursor = {
      worldX: prop.worldX,
      worldY: prop.worldY,
      cameraX: prop.cameraX,
      cameraY: prop.cameraY,
      screenX: prop.screenX,
      screenY: prop.screenY
    };
    for (const [id, callback] of Object.entries(this._cursorMoveCallbacks)) {
      callback(prop);
    }
    prop.event.preventDefault();
  }
  /**
   * Event handler when mouse or touchscreen is released.
   * @returns
   */
  _onCursorUpGlobal(prop) {
    for (const [id, callback] of Object.entries(this._cursorUpCallbacks)) {
      callback(prop);
    }
  }
  /**
   * Event handler for mouse scroll events.
   * @param deltaY: The amount the user scrolled.
   */
  _onZoomGlobal(prop) {
    for (const [id, callback] of Object.entries(this._cursorScrollCallbacks)) {
      if (prop.gid == id) {
        continue;
      }
      callback(prop);
    }
  }
  subscribeGlobalCursorEvent(event, gid, callback) {
    switch (event) {
      case "onCursorDown":
        this._cursorDownCallbacks[gid] = callback;
        break;
      case "onCursorMove":
        this._cursorMoveCallbacks[gid] = callback;
        break;
      case "onCursorUp":
        this._cursorUpCallbacks[gid] = callback;
        break;
      case "onCursorScroll":
        this._cursorScrollCallbacks[gid] = callback;
    }
    console.debug("subscribeGlobalCursorEvent", event);
  }
  unsubscribeGlobalCursorEvent(event, gid) {
    switch (event) {
      case "onCursorDown":
        delete this._cursorDownCallbacks[gid];
        break;
      case "onCursorMove":
        delete this._cursorMoveCallbacks[gid];
        break;
      case "onCursorUp":
        delete this._cursorUpCallbacks[gid];
        break;
      case "onCursorScroll":
        delete this._cursorScrollCallbacks[gid];
        break;
    }
  }
  unsubscribeOnCursorDown(id) {
    console.debug(`unsubscribeOnCursorDown on ${id}`);
    delete this._cursorDownCallbacks[id];
    console.debug(this._cursorDownCallbacks);
  }
  subscribeOnCursorMove(id, callback) {
    console.debug(`subscribeOnCursorMove on ${id}, callback: ${callback.name}`);
    this._cursorMoveCallbacks[id] = callback;
  }
  unsubscribeOnCursorMove(id) {
    console.debug(`unsubscribeOnCursorMove on ${id}`);
    delete this._cursorMoveCallbacks[id];
  }
  subscribeOnCursorUp(id, callback) {
    console.debug(`subscribeOnCursorUp on ${id}, callback: ${callback.name}`);
    this._cursorUpCallbacks[id] = callback;
  }
  unsubscribeOnCursorUp(id) {
    console.debug(`unsubscribeOnCursorUp on ${id}`);
    delete this._cursorUpCallbacks[id];
  }
  subscribeOnCursorScroll(id, callback) {
    this._cursorScrollCallbacks[id] = callback;
  }
  unsubscribeOnCursorScroll(id) {
    delete this._cursorScrollCallbacks[id];
  }
  /**
   * Renders elements currently in the canvas.
   * This function is used by Vanilla JS projects that do not have a reactive system to automatically update the DOM.
   */
  _renderElements() {
    var _a;
    for (const object of this.global.domRenderQueue) {
      object.render();
    }
    this.global.domRenderQueue = [];
    for (const object of this.global.domDeleteQueue) {
      object.delete();
    }
    this.global.domDeleteQueue = [];
    for (const object of this.global.domFetchQueue) {
      object.fetchProperty();
    }
    this.global.domFetchQueue = [];
    for (const object of this.global.domPaintQueue) {
      object.paint();
    }
    this.global.domPaintQueue = [];
    (_a = this.global.collisionEngine) == null ? void 0 : _a.detectCollisions();
  }
  addObject(object) {
    object.submitRenderQueue();
  }
}
_SnapLine_instances = new WeakSet();
// ============== Private functions ==============
/**
 * Main loop for rendering the canvas.
 */
step_fn = function() {
  this._renderElements();
  window.requestAnimationFrame(__privateMethod(this, _SnapLine_instances, step_fn).bind(this));
};
class LineComponent extends ElementObject {
  constructor(globals, parent) {
    super(globals, parent);
    __publicField(this, "endWorldX");
    __publicField(this, "endWorldY");
    __publicField(this, "start");
    __publicField(this, "target");
    __publicField(this, "initialRender");
    __publicField(this, "requestDelete");
    this.endWorldX = 0;
    this.endWorldY = 0;
    this.start = parent;
    this.target = null;
    this.initialRender = false;
    this.requestDelete = false;
  }
  setLineStartAtConnector() {
    this.setLineStart(this.start.worldX, this.start.worldY);
  }
  setLineEndAtConnector() {
    if (this.target) {
      this.setLineEnd(this.target.worldX, this.target.worldY);
    }
  }
  setLineStart(startPositionX, startPositionY) {
    this.worldX = startPositionX;
    this.worldY = startPositionY;
  }
  setLineEnd(endWorldX, endWorldY) {
    this.endWorldX = endWorldX;
    this.endWorldY = endWorldY;
  }
  setLinePosition(startWorldX, startWorldY, endWorldX, endWorldY) {
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
class ConnectorComponent extends ElementObject {
  constructor(global, parent, config = {}) {
    super(global, parent);
    __publicField(this, "config");
    __publicField(this, "name");
    // Name of the connector. This should describe the data associated with the connector
    __publicField(this, "prop");
    // Properties of the connector
    __publicField(this, "outgoingLines");
    __publicField(this, "incomingLines");
    __publicField(this, "_state", 0);
    __publicField(this, "_hitCircle");
    __publicField(this, "_mouseHitBox");
    __publicField(this, "_targetConnector", null);
    __publicField(this, "_mousedownX", 0);
    __publicField(this, "_mousedownY", 0);
    this.prop = {};
    this.outgoingLines = [];
    this.incomingLines = [];
    this.config = config;
    this.updateProperty();
    this.name = config.name || this.gid || "";
    this.event.dom.onCursorDown = this.onCursorDown;
    this._hitCircle = new CircleCollider(global, this, 0, 0, 30);
    this.addCollider(this._hitCircle);
    this._mouseHitBox = new PointCollider(global, this, 0, 0);
    this.addCollider(this._mouseHitBox);
    this._targetConnector = null;
    this._mousedownX = 0;
    this._mousedownY = 0;
  }
  // onGlobalCursorDown(e: cursorDownProp): void {
  //   this._dom?.classList.add("snap");
  // }
  // onGlobalCursorUp(e: cursorUpProp): void {
  //   this._dom?.classList.remove("snap");
  // }
  addDom(dom) {
    const domElement = super.addDom(dom);
    domElement.style = {
      position: "absolute",
      top: "0",
      left: "0"
    };
    this._hitCircle.position.worldX = this.worldX;
    this._hitCircle.position.worldY = this.worldY;
    return domElement;
  }
  assignRigidBodyDom(dom) {
  }
  // ==================== Private methods ====================
  // ==================== Hidden methods ====================
  onCursorDown(prop) {
    console.debug(
      `ConnectorComponent _componentCursorDown event triggered on ${this.gid}, button: ${prop.button}`
    );
    const currentIncomingLines = this.incomingLines.filter(
      (i) => !i.requestDelete
    );
    if (prop.button != cursorState.mouseLeft) {
      return;
    }
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0]);
      return;
    }
    if (this.config.allowDragOut) {
      this.startDragOutLine();
    }
  }
  // onDrag(): void {
  //   super.onDrag();
  //   this.runDragOutLine();
  // }
  componentCursorUp() {
    if (this.parent == null) {
      return;
    }
    this.endDragOutLine();
  }
  deleteLine(i) {
    if (this.outgoingLines.length == 0) {
      return null;
    }
    const line = this.outgoingLines[i];
    line.delete();
    this.outgoingLines.splice(i, 1);
    return line;
  }
  deleteAllLines() {
    for (const line of this.outgoingLines) {
      line.delete();
    }
  }
  _renderLinePosition(entry) {
  }
  /**
   * Updates the start and end positions of the line.
   * @param entry The line to update.
   */
  updateLine(entry) {
    entry.setLineStartAtConnector();
    if (!entry.target) {
      entry.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
    } else {
      entry.setLineEndAtConnector();
    }
    entry.submitRender();
  }
  /* Updates the position of all lines connected to this connector */
  updateAllLines() {
    for (const line of this.outgoingLines) {
      this.updateLine(line);
    }
    for (const line of this.incomingLines) {
      line.start.updateLine(line);
    }
  }
  /** ==================== Public methods ==================== */
  assignToNode(parent) {
    this.parent = parent;
    parent.children.push(this);
    let parent_ref = this.parent;
    parent_ref._prop[this.name] = null;
    this.prop = parent_ref._prop;
    parent_ref._connectors[this.name] = this;
    this.outgoingLines = [];
    this.incomingLines = [];
    if (parent_ref.global && this.global == null) {
      this.global = parent_ref.global;
    }
  }
  /**
   * Creates a new line extending from this connector.
   * @param dom The DOM element to create the line in.
   * @returns The line object that was created.
   */
  createLine() {
    let line;
    if (this.config.lineClass) {
      line = new this.config.lineClass(this.global, this);
    } else {
      line = new LineComponent(this.global, this);
    }
    this.children.push(line);
    return line;
  }
  /**
   * Begins the line drag operation, which will create a temporary line
   * extending from the connector to the mouse cursor.
   */
  startDragOutLine() {
    console.debug("Starting drag out line", this.worldX, this.worldY);
    let newLine = this.createLine();
    this.outgoingLines.unshift(newLine);
    this.parent.updateNodeLines();
    this.parent.updateNodeLineList();
    this._state = 1;
    this._targetConnector = null;
    this.event.global.onCursorMove = this.runDragOutLine;
    this.event.global.onCursorUp = this.endDragOutLine;
    this._mouseHitBox.event.collider.onBeginContact = (thisObject, otherObject) => {
      if (otherObject.parent instanceof ConnectorComponent) {
        this._targetConnector = otherObject.parent;
      }
    };
    this._mouseHitBox.event.collider.onEndContact = (thisObject, otherObject) => {
      if (otherObject.parent instanceof ConnectorComponent) {
        this._targetConnector = null;
      }
    };
  }
  /**
   * Called when the user drags the line extending from the connector.
   */
  runDragOutLine(prop) {
    if (this._state != 1) {
      return;
    }
    if (this.outgoingLines.length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    this._mouseHitBox.worldX = prop.worldX;
    this._mouseHitBox.worldY = prop.worldY;
    console.debug(
      "Mouse hit box",
      this.gid,
      this._mouseHitBox.worldX,
      this._mouseHitBox.worldY
    );
    let line = this.outgoingLines[0];
    if (this._targetConnector) {
      const result = this.hoverWhileDragging(this._targetConnector);
      if (result) {
        line.setLineEnd(result[0], result[1]);
        line.setLineStartAtConnector();
        line.submitRender();
        return;
      }
    }
    line.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
    line.setLineStartAtConnector();
    this.parent.updateNodeLines();
  }
  hoverWhileDragging(targetConnector) {
    if (!(targetConnector instanceof ConnectorComponent)) {
      return;
    }
    if (targetConnector == null) {
      console.debug(`Error: targetConnector is null`);
      return;
    }
    if (targetConnector.gid == this.gid) {
      return;
    }
    targetConnector.updateProperty();
    const connectorX = targetConnector.worldX;
    const connectorY = targetConnector.worldY;
    return [connectorX, connectorY];
  }
  /**
   * Ends the line drag operation.
   * This will delete the temporary line created by startDragOutLine.
   * If the user is hovering over an input connector, then the line will be connected to the input connector.
   */
  endDragOutLine() {
    console.debug("Ending line drag operation");
    if (this._targetConnector && this._targetConnector instanceof ConnectorComponent) {
      const target = this._targetConnector;
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
      target.prop[target.name] = this.prop[this.name];
      this.outgoingLines[0].setLineEnd(target.worldX, target.worldY);
    } else {
      this.deleteLine(0);
    }
    if (this.parent) {
      this.parent.updateNodeLines();
    }
    this._endLineDragCleanup();
  }
  _endLineDragCleanup() {
    this._state = 0;
    this.event.global.onCursorMove = null;
    this.event.global.onCursorUp = null;
    this.parent.updateNodeLineList();
    this._targetConnector = null;
    this._mouseHitBox.event.collider.onBeginContact = null;
    this._mouseHitBox.event.collider.onEndContact = null;
    this._mouseHitBox.position.worldX = 0;
    this._mouseHitBox.position.worldY = 0;
  }
  /**
   * Begins the process of dragging a line that is already connected to another connector.
   * @param line The line that is being dragged.
   */
  startPickUpLine(line) {
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    line.start.deleteLine(line.start.outgoingLines.indexOf(line));
    console.debug(
      "Starting pick out line",
      line.start.worldX,
      line.start.worldY
    );
    line.start.startDragOutLine();
    this._state = 1;
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
      line = this.createLine();
      this.outgoingLines.unshift(line);
    }
    this.updateProperty();
    line.target = connector;
    connector.incomingLines.push(line);
    console.log("Connected to connector", connector, line);
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
class InputForm extends ElementObject {
  // Properties of the component
  constructor(globals, parent, config = {}) {
    super(globals, parent);
    __publicField(this, "name");
    // Name of the component
    __publicField(this, "dom");
    // The DOM element of the component
    __publicField(this, "prop");
    this.name = config.name || "";
    this.prop = parent._prop;
    this.dom = null;
  }
  // bindFunction(_: HTMLElement): void {
  //   // Abstract function
  // }
  // addInputUpdateListener(event: string, func: (value: any) => void) {
  //   this.dom.addEventListener(event, func.bind(this));
  // }
}
class NodeComponent extends ElementObject {
  // _selected: boolean;
  // ================= Private functions =================
  constructor(global, parent, dom = null, config = {}) {
    super(global, parent);
    __privateAdd(this, _NodeComponent_instances);
    __publicField(this, "_config");
    __publicField(this, "_dom");
    __publicField(this, "_connectors");
    // Dictionary of all connectors in the node, using the name as the key
    __publicField(this, "_components");
    // Dictionary of all components in the node except connectors
    // _allOutgoingLines: { [key: string]: LineComponent[] }; // Dictionary of all lines going out of the node
    // _allIncomingLines: { [key: string]: LineComponent[] }; // Dictionary of all lines coming into the node
    __publicField(this, "_nodeWidth", 0);
    __publicField(this, "_nodeHeight", 0);
    __publicField(this, "_dragStartX", 0);
    __publicField(this, "_dragStartY", 0);
    __publicField(this, "_prop");
    // Properties of the node
    __publicField(this, "_propSetCallback");
    // Callbacks called when a property is set
    __publicField(this, "_nodeStyle");
    __publicField(this, "_lineListCallback");
    __publicField(this, "_hitBox");
    __publicField(this, "_selected");
    __publicField(this, "_mouseDownX");
    __publicField(this, "_mouseDownY");
    this._config = config;
    this._dom = dom;
    this._connectors = {};
    this._components = {};
    this._dragStartX = this.worldX;
    this._dragStartY = this.worldY;
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._prop = {};
    this._propSetCallback = {};
    this.position.worldX = 0;
    this.position.worldY = 0;
    this._lineListCallback = null;
    this.event.dom.onCursorDown = this.onCursorDown;
    this._hitBox = new RectCollider(this.global, this, 0, 0, 0, 0);
    this.addCollider(this._hitBox);
    this._selected = false;
  }
  // set position(position: [number, number]) {
  //   super.worldPosition = position;
  //   this.style = {
  //     transform: `translate3d(${position[0]}px, ${position[1]}px, 0)`,
  //   };
  // }
  addDom(dom) {
    let domElement = super.addDom(dom);
    domElement.style = {
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left"
      // transform: `translate3d(${this.worldX}px, ${this.worldY}px, 1px)`,
    };
    this._hitBox.assignDom(dom);
    return domElement;
  }
  /**
   *  Focuses on the object.
   */
  onFocus() {
    this._selected = true;
  }
  /**
   *  Removes focus from the object.
   */
  offFocus() {
    this._selected = false;
  }
  // ================= Hidden functions =================
  setSelected(selected) {
    var _a, _b;
    this._selected = selected;
    if (selected) {
      (_a = this._dom) == null ? void 0 : _a.classList.add("selected");
      this.global.data.select.push(this);
    } else {
      (_b = this._dom) == null ? void 0 : _b.classList.remove("selected");
      this.global.data.select = this.global.data.select.filter(
        (node) => node.gid !== this.gid
      );
    }
    this.submitRenderQueue();
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
  // _renderOutgoingLines(outgoingLines: LineComponent[], key?: string) {
  // for (const line of outgoingLines) {
  //   const connector = line.start;
  //   if (!line.requestDelete && !line.initialRender) {
  //     // line.createLine();
  //   } else if (line.requestDelete && !line.completedDelete) {
  //     line.delete();
  //     line.render();
  //     line.completedDelete = true;
  //     continue;
  //   }
  //   if (!line._dom) {
  //     continue;
  //   }
  //   line.positionX = connector.positionX;
  //   line.positionY = connector.positionY;
  //   if (line.target) {
  //     line.endPositionX = line.target.positionX;
  //     line.endPositionY = line.target.positionY;
  //   }
  //   line.render();
  // }
  // this._filterDeletedLines(outgoingLines);
  // }
  /**
   * Update the position of all lines connected to the node.
   */
  updateNodeLines() {
    for (const connector of Object.values(this._connectors)) {
      connector.updateAllLines();
    }
  }
  updateNodeLineList() {
    if (this._lineListCallback) {
      this._lineListCallback(this.getAllOutgoingLines());
    }
  }
  // render(): void {
  //   super.render();
  //   this._renderNodeLines();
  // }
  /**
   * Sets the callback function that is called when lines owned by the node (i.e. outgoing lines) are rendered.
   * @param
   */
  setLineListCallback(callback) {
    this._lineListCallback = callback;
  }
  // getRenderLinesCallback(): (lines: LineComponent[], name: string) => void {
  //   return this._renderOutgoingLines;
  // }
  onCursorDown(e) {
    var _a;
    console.debug("onCursorDown", this.gid, e.button);
    if (e.button != cursorState.mouseLeft) {
      return;
    }
    if (this.global.data.select.includes(this) == false) {
      this.setSelected(true);
    }
    for (const node of this.global.data.select) {
      __privateMethod(_a = node, _NodeComponent_instances, setStartPositions_fn).call(_a);
      node._mouseDownX = e.worldX;
      node._mouseDownY = e.worldY;
    }
    this.event.global.onCursorMove = this.onDrag;
    this.event.global.onCursorUp = this.onUp;
  }
  onDrag(prop) {
    if (this.global == null) {
      console.error("Global stats is null");
      return;
    }
    if (this._config.lockPosition) return;
    for (const node of this.global.data.select) {
      node.setDragPosition(prop);
    }
  }
  setDragPosition(prop) {
    const dx = prop.worldX - this._mouseDownX;
    const dy = prop.worldY - this._mouseDownY;
    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    console.debug("setDragPosition", this.worldPosition);
    this.updateProperty();
    this.updateNodeLines();
    this.submitRenderQueue();
  }
  onUp(prop) {
    console.debug("onCursorUp on Node", this.gid);
    this.event.global.onCursorMove = null;
    this.event.global.onCursorUp = null;
    for (const node of this.global.data.select) {
      node.setUpPosition(prop);
    }
  }
  setUpPosition(prop) {
    const [dx, dy] = [
      prop.worldX - this._mouseDownX,
      prop.worldY - this._mouseDownY
    ];
    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    console.debug("onCursorUp", this.gid, this.worldX, this.worldY);
    console.debug("onCursorUp", this.gid, this.worldX, this.worldY);
    this.updateProperty();
    this.updateNodeLines();
  }
  // nodeDragEnd() {}
  // ================= Public functions =================
  // /**
  //  * Assigns the DOM element to the node.
  //  * @param dom
  //  */
  // assignDom(dom: HTMLElement) {
  //   super.assignDom(dom);
  //   this._hitBox.assignDom(dom);
  //   dom.setAttribute("data-snapline-type", "node");
  //   dom.setAttribute("data-snapline-state", "idle");
  //   if (this._config?.nodeClass) {
  //     dom.setAttribute("data-snapline-class", this._config.nodeClass);
  //   }
  // }
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
  // addConnector(
  //   name: string,
  //   config: ConnectorConfig,
  //   connectorClass: typeof ConnectorComponent | null = null,
  // ) {
  //   this._allOutgoingLines[name] = [];
  //   this._allIncomingLines[name] = [];
  //   if (!connectorClass) {
  //     connectorClass = ConnectorComponent;
  //   }
  //   const connector = new connectorClass(this.g, this, config);
  //   this._connectors[name] = connector;
  //   this._prop[name] = null;
  //   this.children.push(connector);
  //   return connector;
  // }
  addConnectorObject(connector) {
    connector.assignToNode(this);
  }
  addInputForm(dom, name) {
    const input = new InputForm(this.global, this, { name });
    this._prop[name] = null;
    return input;
  }
  addSetPropCallback(callback, name) {
    this._propSetCallback[name] = callback;
  }
  // getLines(): { [key: string]: LineComponent[] } {
  //   return this._allOutgoingLines;
  // }
  getAllOutgoingLines() {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.outgoingLines
    );
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
      if (!peer.parent) continue;
      let parent = peer.parent;
      parent._prop[peer.name] = value;
      if (parent._propSetCallback[peer.name]) {
        parent._propSetCallback[peer.name](value);
      }
    }
  }
}
_NodeComponent_instances = new WeakSet();
/**
 * Sets the starting position of the node when it is dragged.
 */
setStartPositions_fn = function() {
  this._dragStartX = this.worldX;
  this._dragStartY = this.worldY;
};
class RectSelectComponent extends ElementObject {
  constructor(globals, parent) {
    super(globals, parent);
    __publicField(this, "_state");
    __publicField(this, "_mouseDownX");
    __publicField(this, "_mouseDownY");
    __publicField(this, "_selectHitBox");
    this._state = "none";
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this.event.global.onCursorDown = this.onGlobalCursorDown;
    this.event.global.onCursorMove = this.onGlobalCursorMove;
    this.event.global.onCursorUp = this.onGlobalCursorUp;
    this._selectHitBox = new RectCollider(globals, this, 0, 0, 0, 0);
    this._selectHitBox.localX = 0;
    this._selectHitBox.localY = 0;
    this._selectHitBox.event.collider.onCollide = this.onCollideNode;
    this.addCollider(this._selectHitBox);
    this.global.data.select = [];
  }
  addDom(dom) {
    let domElement = super.addDom(dom);
    domElement.style = {
      width: "0px",
      height: "0px",
      transformOrigin: "top left",
      position: "absolute",
      left: "0px",
      top: "0px",
      pointerEvents: "none"
      // opacity: "0",
    };
    return domElement;
  }
  onGlobalCursorDown(prop) {
    if (prop.button !== cursorState.mouseLeft || prop.element && prop.element.id !== "sl-background") {
      return;
    }
    console.debug(`onRectSelectDown at ${prop.worldX}, ${prop.worldY}`);
    this.worldPosition = [prop.worldX, prop.worldY];
    this._selectHitBox.updateProperty();
    this._state = "dragging";
    this.dom.style = {
      display: "block",
      // transform: `translate3d(${prop.worldX}px, ${prop.worldY}px, 0)`,
      width: "0px",
      height: "0px"
    };
    this._mouseDownX = prop.worldX;
    this._mouseDownY = prop.worldY;
    this._selectHitBox.event.collider.onBeginContact = (thisObject, otherObject) => {
      if (otherObject.parent instanceof NodeComponent) {
        otherObject.parent.setSelected(true);
      }
    };
    this._selectHitBox.event.collider.onEndContact = (thisObject, otherObject) => {
      console.debug(`onEndContact between ${thisObject} and ${otherObject}`);
      if (otherObject.parent instanceof NodeComponent) {
        otherObject.parent.setSelected(false);
      }
    };
  }
  onGlobalCursorMove(prop) {
    if (this._state === "dragging") {
      let [boxOriginX, boxOriginY] = [
        Math.min(this._mouseDownX, prop.worldX),
        Math.min(this._mouseDownY, prop.worldY)
      ];
      let [boxWidth, boxHeight] = [
        Math.abs(prop.worldX - this._mouseDownX),
        Math.abs(prop.worldY - this._mouseDownY)
      ];
      this.dom.style = {
        // transform: `translate3d(${boxOriginX}px, ${boxOriginY}px, 0)`,
        width: `${boxWidth}px`,
        height: `${boxHeight}px`
      };
      this.worldPosition = [boxOriginX, boxOriginY];
      this._selectHitBox.localX = this.position.worldX - boxOriginX;
      this._selectHitBox.localY = this.position.worldY - boxOriginY;
      this._selectHitBox.width = boxWidth;
      this._selectHitBox.height = boxHeight;
    }
  }
  onGlobalCursorUp(prop) {
    console.debug(`onRectSelectUp at ${prop.worldX}, ${prop.worldY}`);
    this.dom.style = {
      display: "none"
    };
    this._state = "none";
    this._selectHitBox.event.collider.onBeginContact = null;
    this._selectHitBox.event.collider.onEndContact = null;
  }
  onCollideNode(hitBox, node) {
  }
}
class Background extends ElementObject {
  constructor(globals, parent) {
    super(globals, parent);
    __publicField(this, "_tileSize", 40);
    this.event.global.onCursorMove = this.moveBackground;
  }
  addDom(dom) {
    const domElement = super.addDom(dom);
    domElement.style = {
      position: "absolute",
      top: "0",
      left: "0",
      width: `100px`,
      height: `100px`,
      backgroundSize: `${this._tileSize}px ${this._tileSize}px`,
      transform: "translate(0px, 0px)"
    };
    return domElement;
  }
  moveBackground(prop) {
    var _a, _b, _c, _d;
    let x = (_a = this.global.camera) == null ? void 0 : _a.cameraPositionX;
    let y = (_b = this.global.camera) == null ? void 0 : _b.cameraPositionY;
    let width = ((_c = this.global.camera) == null ? void 0 : _c.cameraWidth) * 5;
    let height = ((_d = this.global.camera) == null ? void 0 : _d.cameraHeight) * 5;
    this.worldX = Math.floor(x / this._tileSize) * this._tileSize;
    this.worldY = Math.floor(y / this._tileSize) * this._tileSize;
    this.dom.style = {
      transform: `translate(${this.worldX - width / 2}px, ${this.worldY - height / 2}px)`,
      width: `${width}px`,
      height: `${height}px`
    };
  }
  //   render() {
  //     let x = this.global.camera?.cameraPositionX;
  //     let y = this.global.camera?.cameraPositionY;
  //     setDomStyle(this._dom!, {
  //       transform: `translate(${x}px, ${y}px)`,
  //     });
  //     // super.render();
  //     // this.requestRender = false;
  //     // this.submitRender();
  //   }
}
export {
  Background,
  BaseObject,
  ConnectorComponent,
  ElementObject,
  GlobalManager,
  LineComponent,
  NodeComponent,
  RectSelectComponent,
  SnapLine
};
