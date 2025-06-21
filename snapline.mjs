var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _containerDom, _containerOffsetX, _containerOffsetY, _cameraWidth, _cameraHeight, _cameraPositionX, _cameraPositionY, _cameraPanStartX, _cameraPanStartY, _zoom, _config, _canvasStyle, _cameraCenterX, _cameraCenterY, _resizeObserver, _variables, _animation, _varAnimation, _offset, _easing, _duration, _delay, _hasVariable, _deleteOnFinish, _debugObject, _dragMemberList, _InputControl_instances, handleMultiPointer_fn, _document, _containerStyle, _resizeObserver2, _SnapLine_instances, step_fn, processQueue_fn, _config2, _name, _prop, _outgoingLines, _incomingLines, _state, _hitCircle, _mouseHitBox, _targetConnector, _connectorCallback, _prevCenterX, _prevCenterY;
class Camera {
  constructor(container, config = {}) {
    /**
     * Represents a camera that can be used to pan and zoom the view of a DOM element.
     * This class maintains 3 coordinate systems:
     * - Viewport coordinates: The x,y coordinates of the pointer on the browser viewport.
     *   (0,0) is the top left corner of the screen and the x,y coordinates increase as you move right and down.
     * - Camera coordinates: The x,y coordinates of the camera view.
     *   (0,0) is the top left corner of the camera view and the x,y coordinates increase as you move right and down.
     *   The position of the camera is the top left corner of the camera view.
     * - World coordinates: The x,y coordinates of the world that the camera is viewing.
     *   (0,0) is the CENTER of the world and the x,y coordinates increase as you move right and down.
     */
    __privateAdd(this, _containerDom);
    // The DOM element that represents the camera view
    __privateAdd(this, _containerOffsetX);
    // The x coordinate of the container DOM on the browser viewport
    __privateAdd(this, _containerOffsetY);
    // The y coordinate of the container DOM on the browser viewport
    __privateAdd(this, _cameraWidth);
    // The width of the camera view. This should be the same as the container width.
    __privateAdd(this, _cameraHeight);
    // The height of the camera view. This should be the same as the container height.
    __privateAdd(this, _cameraPositionX);
    // Position of the center of the camera
    __privateAdd(this, _cameraPositionY);
    __privateAdd(this, _cameraPanStartX);
    // Initial position of the camera when panning
    __privateAdd(this, _cameraPanStartY);
    __privateAdd(this, _zoom);
    // The zoom level of the camera, 1 means no zoom, smaller values zoom out, larger values zoom in
    __privateAdd(this, _config);
    __privateAdd(this, _canvasStyle);
    // The CSS transform style that should be applied to the DOM element
    // #cameraCenterMode: "center" | "topLeft";
    __privateAdd(this, _cameraCenterX);
    __privateAdd(this, _cameraCenterY);
    __privateAdd(this, _resizeObserver);
    let containerRect = container.getBoundingClientRect();
    __privateSet(this, _containerDom, container);
    __privateSet(this, _containerOffsetX, containerRect.left);
    __privateSet(this, _containerOffsetY, containerRect.top);
    __privateSet(this, _cameraWidth, containerRect.width);
    __privateSet(this, _cameraHeight, containerRect.height);
    __privateSet(this, _cameraCenterX, __privateGet(this, _cameraWidth) / 2);
    __privateSet(this, _cameraCenterY, __privateGet(this, _cameraHeight) / 2);
    __privateSet(this, _cameraPositionX, 0);
    __privateSet(this, _cameraPositionY, 0);
    __privateSet(this, _cameraPanStartX, 0);
    __privateSet(this, _cameraPanStartY, 0);
    __privateSet(this, _zoom, 1);
    const defaultConfig = {
      enableZoom: true,
      zoomBounds: { min: 0.2, max: 1 },
      enablePan: true,
      panBounds: { top: null, left: null, right: null, bottom: null }
    };
    __privateSet(this, _config, { ...defaultConfig, ...config });
    __privateSet(this, _canvasStyle, "");
    this.updateCamera();
    if (__privateGet(this, _config).handleResize || true) {
      __privateSet(this, _resizeObserver, new ResizeObserver(() => {
        this.updateCameraProperty();
      }));
      __privateGet(this, _resizeObserver).observe(__privateGet(this, _containerDom));
      __privateGet(this, _resizeObserver).observe(window.document.body);
    }
    window.addEventListener("scroll", () => {
      this.updateCamera();
    });
  }
  get cameraWidth() {
    return __privateGet(this, _cameraWidth);
  }
  get cameraHeight() {
    return __privateGet(this, _cameraHeight);
  }
  get cameraPositionX() {
    return __privateGet(this, _cameraPositionX);
  }
  get cameraPositionY() {
    return __privateGet(this, _cameraPositionY);
  }
  get zoom() {
    return __privateGet(this, _zoom);
  }
  get containerOffsetX() {
    return __privateGet(this, _containerOffsetX);
  }
  get containerOffsetY() {
    return __privateGet(this, _containerOffsetY);
  }
  updateCameraProperty() {
    let containerRect = __privateGet(this, _containerDom).getBoundingClientRect();
    __privateSet(this, _containerOffsetX, containerRect.left);
    __privateSet(this, _containerOffsetY, containerRect.top);
    __privateSet(this, _cameraWidth, containerRect.width);
    __privateSet(this, _cameraHeight, containerRect.height);
    __privateSet(this, _cameraCenterX, __privateGet(this, _cameraWidth) / 2 + __privateGet(this, _cameraPositionX));
    __privateSet(this, _cameraCenterY, __privateGet(this, _cameraHeight) / 2 + __privateGet(this, _cameraPositionY));
  }
  // centerCamera(x: number, y: number) {
  //   let dx = this.#cameraPositionX - this.#cameraCenterX + x;
  //   let dy = this.#cameraPositionY - this.#cameraCenterY + y;
  //   this.#cameraPositionX = dx;
  //   this.#cameraPositionY = dy;
  //   this.updateCamera();
  // }
  /**
   * Given the x and y coordinates of the camera, the zoom level, and the width and height of the camera,
   * calculates the transformation matrix that converts a x,y coordinate of the DOM to
   * the x,y coordinate of the camera view.
   * @param cameraX   The x coordinate of the point in the world
   * @param cameraY   The y coordinate of the point in the world
   * @param zoom  The zoom level of the camera
   * @param #cameraWidth  The width of the camera view
   * @param #cameraHeight The height of the camera view
   * @returns A string representing the CSS transform matrix that should be applied to the DOM element
   */
  worldToCameraMatrix(cameraX, cameraY, zoom) {
    const s1 = zoom;
    const s2 = zoom;
    const t1 = -cameraX * zoom;
    const t2 = -cameraY * zoom;
    return `${s1},0,0,0,0,${s2},0,0,0,0,1,0,${t1},${t2},0,1`;
  }
  /**
   * Updates the camera view based on the current camera position and zoom level
   */
  updateCamera() {
    const matrix = this.worldToCameraMatrix(
      __privateGet(this, _cameraPositionX),
      __privateGet(this, _cameraPositionY),
      __privateGet(this, _zoom)
    );
    __privateSet(this, _canvasStyle, `matrix3d(${matrix})`);
  }
  get canvasStyle() {
    return __privateGet(this, _canvasStyle);
  }
  setCameraPosition(x, y) {
    __privateSet(this, _cameraPositionX, x);
    __privateSet(this, _cameraPositionY, y);
    this.updateCamera();
  }
  setCameraCenterPosition(x, y) {
    __privateSet(this, _cameraPositionX, x - __privateGet(this, _cameraWidth) / 2);
    __privateSet(this, _cameraPositionY, y - __privateGet(this, _cameraHeight) / 2);
    this.updateCamera();
  }
  getCameraCenterPosition() {
    const centerX = __privateGet(this, _cameraPositionX) + __privateGet(this, _cameraWidth) / 2;
    const centerY = __privateGet(this, _cameraPositionY) + __privateGet(this, _cameraHeight) / 2;
    return { x: centerX, y: centerY };
  }
  /**
   * Handle the scroll event to zoom in and out of the camera view
   * @param deltaZoom Amount of scroll
   * @param cameraX The x coordinate of the pointer in the camera view
   * @param cameraY The y coordinate of the pointer in the camera view
   */
  handleScroll(deltaZoom, cameraX, cameraY) {
    if (!__privateGet(this, _config).enableZoom) {
      return;
    }
    if (__privateGet(this, _zoom) + deltaZoom < 0.2) {
      deltaZoom = 0.2 - __privateGet(this, _zoom);
    } else if (__privateGet(this, _zoom) + deltaZoom > 1) {
      deltaZoom = 1 - __privateGet(this, _zoom);
    }
    if (__privateGet(this, _config).zoomBounds) {
      if (__privateGet(this, _zoom) + deltaZoom < __privateGet(this, _config).zoomBounds.min) {
        deltaZoom = 0;
      } else if (__privateGet(this, _zoom) + deltaZoom > __privateGet(this, _config).zoomBounds.max) {
        deltaZoom = 0;
      }
    }
    const zoomRatio = __privateGet(this, _zoom) / (__privateGet(this, _zoom) + deltaZoom);
    if (__privateGet(this, _config).enablePan) {
      __privateSet(this, _cameraPositionX, __privateGet(this, _cameraPositionX) - __privateGet(this, _cameraWidth) / __privateGet(this, _zoom) * (zoomRatio - 1) * (1 - (__privateGet(this, _cameraWidth) * 1.5 - cameraX) / __privateGet(this, _cameraWidth)));
      __privateSet(this, _cameraPositionY, __privateGet(this, _cameraPositionY) - __privateGet(this, _cameraHeight) / __privateGet(this, _zoom) * (zoomRatio - 1) * (1 - (__privateGet(this, _cameraHeight) * 1.5 - cameraY) / __privateGet(this, _cameraHeight)));
    }
    __privateSet(this, _zoom, __privateGet(this, _zoom) + deltaZoom);
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
    if (!__privateGet(this, _config).enablePan) {
      return;
    }
    __privateSet(this, _cameraPositionX, __privateGet(this, _cameraPositionX) + deltaX / __privateGet(this, _zoom));
    __privateSet(this, _cameraPositionY, __privateGet(this, _cameraPositionY) + deltaY / __privateGet(this, _zoom));
    this.updateCamera();
  }
  /**
   * Should be called when a user presses the pointer down to start panning the camera.
   * This function is the start of a 3-stage process to pan the camera:
   *    handlePanStart -> handlePanDrag -> handlePanEnd
   * This allows camera pans based on the absolute position of the pointer relative to when the pan started.
   */
  handlePanStart() {
    if (!__privateGet(this, _config).enablePan) {
      return;
    }
    __privateSet(this, _cameraPanStartX, __privateGet(this, _cameraPositionX));
    __privateSet(this, _cameraPanStartY, __privateGet(this, _cameraPositionY));
  }
  /**
   * Updates the camera position based on the change in mouse position, relative to the start of the pan.
   * This function should be called after handlePanStart and before handlePanEnd.
   * @param deltaX  Change in mouse position
   * @param deltaY  Change in mouse position
   */
  handlePanDrag(deltaX, deltaY) {
    if (!__privateGet(this, _config).enablePan) {
      return;
    }
    __privateSet(this, _cameraPositionX, -deltaX / __privateGet(this, _zoom) + __privateGet(this, _cameraPanStartX));
    __privateSet(this, _cameraPositionY, -deltaY / __privateGet(this, _zoom) + __privateGet(this, _cameraPanStartY));
    if (__privateGet(this, _config).panBounds) {
      if (__privateGet(this, _config).panBounds.left !== null && __privateGet(this, _cameraPositionX) < __privateGet(this, _config).panBounds.left) {
        __privateSet(this, _cameraPositionX, __privateGet(this, _config).panBounds.left + 1);
      }
      if (__privateGet(this, _config).panBounds.right !== null && __privateGet(this, _cameraPositionX) > __privateGet(this, _config).panBounds.right) {
        __privateSet(this, _cameraPositionX, __privateGet(this, _config).panBounds.right - 1);
      }
      if (__privateGet(this, _config).panBounds.top !== null && __privateGet(this, _cameraPositionY) < __privateGet(this, _config).panBounds.top) {
        __privateSet(this, _cameraPositionY, __privateGet(this, _config).panBounds.top - 1);
      }
      if (__privateGet(this, _config).panBounds.bottom !== null && __privateGet(this, _cameraPositionY) > __privateGet(this, _config).panBounds.bottom) {
        __privateSet(this, _cameraPositionY, __privateGet(this, _config).panBounds.bottom + 1);
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
    if (!__privateGet(this, _config).enablePan) {
      return;
    }
    __privateSet(this, _cameraPanStartX, 0);
    __privateSet(this, _cameraPanStartY, 0);
  }
  /**
   * Converts the x and y coordinates of the world to the x and y coordinates of the camera view.
   * @param worldX  The x coordinate of the point in the world
   * @param worldY  The y coordinate of the point in the world
   * @returns The x and y coordinates of the point in the camera view
   */
  getCameraFromWorld(worldX, worldY) {
    const c_x = (worldX - __privateGet(this, _cameraPositionX)) * __privateGet(this, _zoom);
    const c_y = (worldY - __privateGet(this, _cameraPositionY)) * __privateGet(this, _zoom);
    return [c_x, c_y];
  }
  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the browser viewport.
   * @param cameraX The x coordinate of the point in the camera view
   * @param cameraY The y coordinate of the point in the camera view
   * @returns
   */
  getScreenFromCamera(cameraX, cameraY) {
    const s_x = cameraX + __privateGet(this, _containerOffsetX);
    const s_y = cameraY + __privateGet(this, _containerOffsetY);
    return [s_x, s_y];
  }
  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the world.
   * @param mouseX
   * @param mouseY
   * @returns
   */
  getWorldFromCamera(cameraX, cameraY) {
    const w_x = cameraX / __privateGet(this, _zoom) + __privateGet(this, _cameraPositionX);
    const w_y = cameraY / __privateGet(this, _zoom) + __privateGet(this, _cameraPositionY);
    return [w_x, w_y];
  }
  getCameraFromScreen(mouseX, mouseY) {
    mouseX = mouseX - __privateGet(this, _containerOffsetX);
    mouseY = mouseY - __privateGet(this, _containerOffsetY);
    return [mouseX, mouseY];
  }
  /**
   * Converts the change in x and y coordinates of the world to the change in x and y coordinates of the camera view.
   * @param worldDeltaX
   * @param worldDeltaY
   * @returns
   */
  getCameraDeltaFromWorldDelta(worldDeltaX, worldDeltaY) {
    const c_dx = worldDeltaX * __privateGet(this, _zoom);
    const c_dy = worldDeltaY * __privateGet(this, _zoom);
    return [c_dx, c_dy];
  }
  /**
   * Converts the change in x and y coordinates of the camera view to the change in x and y coordinates of the world.
   * @param cameraDeltaX
   * @param cameraDeltaY
   * @returns
   */
  getWorldDeltaFromCameraDelta(cameraDeltaX, cameraDeltaY) {
    const w_dx = cameraDeltaX / __privateGet(this, _zoom);
    const w_dy = cameraDeltaY / __privateGet(this, _zoom);
    return [w_dx, w_dy];
  }
}
_containerDom = new WeakMap();
_containerOffsetX = new WeakMap();
_containerOffsetY = new WeakMap();
_cameraWidth = new WeakMap();
_cameraHeight = new WeakMap();
_cameraPositionX = new WeakMap();
_cameraPositionY = new WeakMap();
_cameraPanStartX = new WeakMap();
_cameraPanStartY = new WeakMap();
_zoom = new WeakMap();
_config = new WeakMap();
_canvasStyle = new WeakMap();
_cameraCenterX = new WeakMap();
_cameraCenterY = new WeakMap();
_resizeObserver = new WeakMap();
function getDomProperty(global, dom) {
  const rect = dom.getBoundingClientRect();
  if (global.camera == null) {
    return {
      height: rect.height,
      width: rect.width,
      x: rect.left,
      y: rect.top,
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
    x: worldX,
    y: worldY,
    cameraX,
    cameraY,
    screenX: rect.left,
    screenY: rect.top
  };
}
function generateTransformString(transform) {
  const string = `translate3d(${transform.x}px, ${transform.y}px, 0px) scale(${transform.scaleX}, ${transform.scaleY}) `;
  return string;
}
function parseTransformString(transform) {
  const transformValues = transform.split("(")[1].split(")")[0].split(",");
  return {
    x: parseFloat(transformValues[0]),
    y: parseFloat(transformValues[1]),
    scaleX: parseFloat(transformValues[3]) || 1,
    scaleY: parseFloat(transformValues[4]) || 1
  };
}
function setDomStyle(dom, style) {
  Object.assign(dom.style, style);
}
function EventProxyFactory(object, dict, secondary = null) {
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
        (_a = target[prop]) == null ? void 0 : _a.call(target, ...args);
        (_b = secondary == null ? void 0 : secondary[prop]) == null ? void 0 : _b.call(secondary, ...args);
      };
    }
  });
}
class AnimationObject {
  constructor(owner, keyframe, property) {
    __publicField(this, "owner");
    __publicField(this, "keyframe");
    __publicField(this, "property");
    __privateAdd(this, _variables);
    __privateAdd(this, _animation);
    __privateAdd(this, _varAnimation);
    __privateAdd(this, _offset);
    __privateAdd(this, _easing);
    __privateAdd(this, _duration);
    __privateAdd(this, _delay);
    __privateAdd(this, _hasVariable);
    __privateAdd(this, _deleteOnFinish);
    __publicField(this, "requestDelete");
    this.owner = owner;
    this.keyframe = keyframe;
    this.property = property;
    __privateSet(this, _animation, null);
    __privateSet(this, _deleteOnFinish, true);
    if (!this.property.duration) {
      this.property.duration = 1e3;
    }
    if (!this.property.delay) {
      this.property.delay = 0;
    }
    let numKeys = 0;
    for (const [key, value] of Object.entries(this.keyframe)) {
      const len = Array.isArray(value) ? value.length : 1;
      numKeys = Math.max(numKeys, len);
    }
    if (!this.property.offset) {
      __privateSet(this, _offset, []);
      for (let i = 0; i < numKeys; i++) {
        __privateGet(this, _offset).push(i / (numKeys - 1));
      }
    } else {
      __privateSet(this, _offset, this.property.offset);
    }
    if (!this.property.easing) {
      __privateSet(this, _easing, ["linear"]);
    } else {
      if (Array.isArray(this.property.easing)) {
        __privateSet(this, _easing, this.property.easing);
      } else {
        __privateSet(this, _easing, [this.property.easing]);
      }
    }
    if (!this.property.duration) {
      __privateSet(this, _duration, [this.property.duration]);
    } else {
      if (Array.isArray(this.property.duration)) {
        __privateSet(this, _duration, this.property.duration);
      } else {
        __privateSet(this, _duration, [this.property.duration]);
      }
    }
    if (!this.property.delay) {
      __privateSet(this, _delay, 0);
    } else {
      __privateSet(this, _delay, this.property.delay);
    }
    __privateSet(this, _variables, {});
    __privateSet(this, _varAnimation, []);
    __privateSet(this, _hasVariable, Object.keys(this.keyframe).filter((key) => {
      return key.startsWith("$");
    }).length > 0);
    let cssKeyframe = {};
    for (const [key, value] of Object.entries(this.keyframe)) {
      if (!key.startsWith("$")) {
        cssKeyframe[key] = value;
      } else {
        __privateGet(this, _variables)[key] = value;
      }
    }
    if (__privateGet(this, _hasVariable) && Object.keys(cssKeyframe).length == 0) {
      cssKeyframe = {};
    }
    if (this.property.offset) {
      cssKeyframe.offset = this.property.offset;
    }
    const target = this.owner instanceof ElementObject ? this.owner._dom.element : this.owner.global.animationFragment;
    const animationProperty = {
      delay: __privateGet(this, _delay),
      fill: "both"
    };
    if (__privateGet(this, _duration).length > 1) {
      cssKeyframe.duration = __privateGet(this, _duration);
    } else {
      animationProperty.duration = __privateGet(this, _duration)[0];
    }
    if (__privateGet(this, _easing).length > 1) {
      cssKeyframe.easing = __privateGet(this, _easing);
    } else {
      animationProperty.easing = __privateGet(this, _easing)[0];
    }
    __privateSet(this, _animation, new Animation(
      new KeyframeEffect(target, cssKeyframe, animationProperty)
    ));
    this.requestDelete = false;
    __privateGet(this, _animation).onfinish = () => {
      var _a, _b;
      (_b = (_a = this.property).finish) == null ? void 0 : _b.call(_a);
      this.finish();
      __privateGet(this, _animation).cancel();
      this.requestDelete = true;
      console.log("Animation finished");
    };
    __privateSet(this, _varAnimation, []);
    if (__privateGet(this, _hasVariable) && __privateGet(this, _easing).length > 1) {
      for (let i = 0; i < __privateGet(this, _offset).length - 1; i++) {
        const intervalKeys = {};
        for (const [key, value] of Object.entries(__privateGet(this, _variables))) {
          intervalKeys[key] = value.slice(i, i + 1);
        }
        const intervalDuration = (__privateGet(this, _offset)[i + 1] - __privateGet(this, _offset)[i]) * this.property.duration;
        const intervalDelay = __privateGet(this, _offset)[i] * this.property.duration + this.property.delay;
        const intervalEasing = __privateGet(this, _easing)[i];
        const animation = new Animation(
          new KeyframeEffect(target, intervalKeys, {
            duration: intervalDuration,
            delay: intervalDelay,
            easing: intervalEasing,
            fill: "both"
          })
        );
        animation.onfinish = () => {
          animation.cancel();
        };
        animation.persist();
        __privateGet(this, _varAnimation).push(animation);
      }
    }
  }
  pause() {
    __privateGet(this, _animation).pause();
    for (let i = 0; i < __privateGet(this, _varAnimation).length; i++) {
      __privateGet(this, _varAnimation)[i].pause();
    }
  }
  play() {
    __privateGet(this, _animation).play();
    for (let i = 0; i < __privateGet(this, _varAnimation).length; i++) {
      __privateGet(this, _varAnimation)[i].play();
    }
  }
  cancel() {
    __privateGet(this, _animation).cancel();
    for (let i = 0; i < __privateGet(this, _varAnimation).length; i++) {
      __privateGet(this, _varAnimation)[i].cancel();
    }
  }
  reverse() {
    __privateGet(this, _animation).reverse();
    for (let i = 0; i < __privateGet(this, _varAnimation).length; i++) {
      __privateGet(this, _varAnimation)[i].reverse();
    }
  }
  calculateFrame(currentTime) {
    var _a, _b, _c, _d;
    const alpha = __privateGet(this, _animation).effect.getComputedTiming().progress;
    if (alpha == null) {
      return false;
    }
    const alphaElapsedTime = this.property.duration * alpha + this.property.delay;
    if (__privateGet(this, _hasVariable)) {
      let currentKey = 0;
      for (let i = 0; i < __privateGet(this, _offset).length - 1; i++) {
        if (__privateGet(this, _offset)[i] <= alpha && alpha < __privateGet(this, _offset)[i + 1]) {
          currentKey = i;
          break;
        }
      }
      let localAlpha = alpha;
      if (__privateGet(this, _easing).length > 1) {
        const currentVarAnimation = __privateGet(this, _varAnimation)[currentKey];
        currentVarAnimation.currentTime = alphaElapsedTime;
        localAlpha = currentVarAnimation.effect.getComputedTiming().progress ?? 0;
      }
      const varValues = {};
      for (const [key, value] of Object.entries(__privateGet(this, _variables))) {
        const varFrom = value[currentKey];
        const varTo = value[currentKey + 1];
        const varValue = varFrom + (varTo - varFrom) * localAlpha;
        varValues[key] = varValue;
      }
      (_b = (_a = this.property).tick) == null ? void 0 : _b.call(_a, varValues);
    } else {
      (_d = (_c = this.property).tick) == null ? void 0 : _d.call(_c, {});
    }
    return false;
  }
  finish() {
    var _a;
    (_a = __privateGet(this, _animation)) == null ? void 0 : _a.commitStyles();
  }
  set currentTime(time) {
    __privateGet(this, _animation).currentTime = time;
    for (let i = 0; i < __privateGet(this, _varAnimation).length; i++) {
      __privateGet(this, _varAnimation)[i].currentTime = time;
    }
  }
  set progress(progress) {
    this.currentTime = (this.property.duration + this.property.delay) * progress;
  }
}
_variables = new WeakMap();
_animation = new WeakMap();
_varAnimation = new WeakMap();
_offset = new WeakMap();
_easing = new WeakMap();
_duration = new WeakMap();
_delay = new WeakMap();
_hasVariable = new WeakMap();
_deleteOnFinish = new WeakMap();
class SequenceObject {
  constructor() {
    __publicField(this, "animations");
    __publicField(this, "startTime");
    __publicField(this, "endTime");
    __publicField(this, "expired");
    __publicField(this, "requestDelete");
    this.animations = [];
    this.startTime = -1;
    this.endTime = -1;
    this.expired = false;
    this.requestDelete = false;
  }
  add(animation) {
    this.animations.push(animation);
  }
  play() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].play();
    }
  }
  pause() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].pause();
    }
  }
  cancel() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].cancel();
    }
  }
  reverse() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].reverse();
    }
  }
  calculateFrame(currentTime) {
    let result = false;
    for (let i = 0; i < this.animations.length; i++) {
      result = this.animations[i].calculateFrame(currentTime) || result;
    }
    return result;
  }
  set currentTime(time) {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].currentTime = time;
    }
  }
  set progress(progress) {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].progress = progress;
    }
  }
}
let EventCallback$1 = class EventCallback {
  constructor(object) {
    __publicField(this, "_object");
    __publicField(this, "_global");
    __publicField(this, "global");
    __publicField(this, "_input");
    __publicField(this, "input");
    __publicField(this, "_dom");
    __publicField(this, "dom");
    this._object = object;
    this._global = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      drag: null,
      pinch: null,
      dragStart: null,
      dragEnd: null,
      pinchStart: null,
      pinchEnd: null
    };
    this.global = new Proxy(this._global, {
      set: (_, prop, value) => {
        var _a, _b;
        if (value == null) {
          (_a = this._object.global.inputEngine) == null ? void 0 : _a.unsubscribeGlobalCursorEvent(
            prop,
            this._object.gid
          );
        } else {
          (_b = this._object.global.inputEngine) == null ? void 0 : _b.subscribeGlobalCursorEvent(
            prop,
            this._object.gid,
            value.bind(this._object)
          );
        }
        return true;
      }
    });
    this._input = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      dragStart: null,
      drag: null,
      dragEnd: null,
      pinchStart: null,
      pinch: null,
      pinchEnd: null
    };
    this.input = EventProxyFactory(
      this._object,
      this._input
    );
    this._dom = {
      onAssignDom: null,
      onResize: null
    };
    this.dom = EventProxyFactory(this._object, this._dom);
  }
};
class queueEntry {
  constructor(object, callback, uuid = null) {
    __publicField(this, "uuid");
    __publicField(this, "object");
    __publicField(this, "callback");
    this.uuid = uuid ?? object.global.getGlobalId();
    this.object = object;
    this.callback = callback ? [callback.bind(object)] : null;
  }
  addCallback(callback) {
    if (this.callback) {
      this.callback.push(callback.bind(this.object));
    } else {
      this.callback = [callback.bind(this.object)];
    }
  }
}
class BaseObject {
  constructor(global, parent) {
    __publicField(this, "global");
    __publicField(this, "gid");
    __publicField(this, "parent");
    __publicField(this, "children", []);
    __publicField(this, "transform");
    __publicField(this, "local");
    __publicField(this, "offset");
    __publicField(this, "event");
    __publicField(this, "_requestPreRead", false);
    __publicField(this, "_requestWrite", false);
    __publicField(this, "_requestRead", false);
    __publicField(this, "_requestDelete", false);
    __publicField(this, "_requestPostWrite", false);
    __publicField(this, "_colliderList", []);
    __publicField(this, "_animationList", []);
    __publicField(this, "_globalInput");
    __publicField(this, "globalInput");
    this.global = global;
    this.gid = global.getGlobalId();
    this.global.objectTable[this.gid] = this;
    this.parent = parent;
    this._colliderList = [];
    this.transform = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1
    };
    this.local = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1
    };
    this.offset = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1
    };
    this.event = new EventCallback$1(this);
    this._requestPreRead = false;
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
    this._globalInput = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      dragStart: null,
      drag: null,
      dragEnd: null,
      pinchStart: null,
      pinch: null,
      pinchEnd: null
    };
    this.globalInput = new Proxy(this._globalInput, {
      set: (_, prop, value) => {
        var _a, _b;
        if (value == null) {
          (_a = this.global.inputEngine) == null ? void 0 : _a.unsubscribeGlobalCursorEvent(prop, this.gid);
        } else {
          (_b = this.global.inputEngine) == null ? void 0 : _b.subscribeGlobalCursorEvent(
            prop,
            this.gid,
            value.bind(this)
          );
        }
        return true;
      }
    });
  }
  destroy() {
    delete this.global.objectTable[this.gid];
  }
  get worldPosition() {
    return [this.transform.x, this.transform.y];
  }
  set worldPosition(position) {
    this.transform.x = position[0];
    this.transform.y = position[1];
  }
  get cameraPosition() {
    var _a;
    return ((_a = this.global.camera) == null ? void 0 : _a.getCameraFromWorld(...this.worldPosition)) ?? [0, 0];
  }
  set cameraPosition(position) {
    var _a;
    this.worldPosition = ((_a = this.global.camera) == null ? void 0 : _a.getWorldFromCamera(
      ...position
    )) ?? [0, 0];
  }
  get screenPosition() {
    var _a;
    return ((_a = this.global.camera) == null ? void 0 : _a.getScreenFromCamera(...this.cameraPosition)) ?? [0, 0];
  }
  set screenPosition(position) {
    var _a;
    this.cameraPosition = ((_a = this.global.camera) == null ? void 0 : _a.getCameraFromScreen(
      ...position
    )) ?? [0, 0];
  }
  queueUpdate(stage = "READ_1", callback = null, queueID = null) {
    let request = new queueEntry(this, callback, queueID);
    let queue = this.global.read1Queue;
    switch (stage) {
      case "READ_1":
        queue = this.global.read1Queue;
        break;
      case "WRITE_1":
        queue = this.global.write1Queue;
        break;
      case "READ_2":
        queue = this.global.read2Queue;
        break;
      case "WRITE_2":
        queue = this.global.write2Queue;
        break;
      case "READ_3":
        queue = this.global.read3Queue;
        break;
      case "WRITE_3":
        queue = this.global.write3Queue;
        break;
    }
    if (!queue[this.gid]) {
      queue[this.gid] = /* @__PURE__ */ new Map();
    }
    queue[this.gid].set(request.uuid, request);
    return request;
  }
  /**
   * Read the DOM property of the object.
   */
  readDom(accountTransform = false) {
    for (const collider of this._colliderList) {
      collider.read();
    }
  }
  /**
   * Write all object properties to the DOM.
   */
  writeDom() {
  }
  /**
   * Write the CSS transform property of the object.
   * Unlike many other properties, the transform property does not trigger a DOM reflow and is thus more performant.
   * Whenever possible, use this method to write the transform property.
   */
  writeTransform() {
  }
  /**
   * Destroy the DOM element of the object.
   */
  destroyDom() {
  }
  /**
   * Calculate the transform properties of the object based on the saved transform properties of the parent
   * and the saved local and offset properties of the object.
   */
  calculateLocalFromTransform() {
    if (this.parent) {
      this.transform.x = this.parent.transform.x + this.local.x;
      this.transform.y = this.parent.transform.y + this.local.y;
    }
    for (const collider of this._colliderList) {
      collider.recalculate();
    }
  }
  // requestFLIP(
  //   callback: null | (() => void) = null,
  // ): [preReadEntry, writeEntry, readEntry, postWriteEntry] {
  //   return [
  //     this.requestPreRead(false, true),
  //     this.requestWrite(callback?.bind(this)),
  //     this.requestRead(true, false),
  //     this.requestPostWrite(),
  //   ];
  // }
  animate(keyframe, property) {
    let animation = new AnimationObject(this, keyframe, property);
    for (const animation2 of this._animationList) {
      animation2.cancel();
    }
    this._animationList = [];
    this._animationList.push(animation);
    this.global.animationList.push(animation);
    return animation;
  }
  get animation() {
    return this._animationList[0];
  }
  animateSequence(animations) {
    let sequence = new SequenceObject();
    for (const animation of animations) {
      sequence.add(animation);
    }
    this._animationList = [];
    this._animationList.push(sequence);
    this.global.animationList.push(sequence);
    return sequence;
  }
  getCurrentStats() {
    return {
      timestamp: Date.now()
    };
  }
  addCollider(collider) {
    var _a;
    this._colliderList.push(collider);
    (_a = this.global.collisionEngine) == null ? void 0 : _a.addObject(collider);
  }
  addDebugPoint(x, y, color = "red", persistent = false, id = "") {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      type: "point",
      color,
      x,
      y,
      persistent,
      id: `${this.gid}-${id}`
    };
  }
  addDebugRect(x, y, width, height, color = "red", persistent = false, id = "") {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      type: "rect",
      color,
      x,
      y,
      width,
      height,
      persistent,
      id: `${this.gid}-${id}`
    };
  }
  addDebugCircle(x, y, radius, color = "red", persistent = false, id = "") {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      type: "circle",
      color,
      x,
      y,
      radius,
      persistent,
      id: `${this.gid}-${id}`
    };
  }
  addDebugText(x, y, text, color = "red", persistent = false, id = "") {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      x,
      y,
      type: "text",
      color,
      text,
      persistent,
      id: `${this.gid}-${id}`
    };
  }
  clearDebugMarker(id) {
    delete this.global.debugMarkerList[`${this.gid}-${id}`];
  }
  clearAllDebugMarkers() {
    for (const marker of Object.values(this.global.debugMarkerList)) {
      if (marker.gid == this.gid) {
        delete this.global.debugMarkerList[marker.id];
      }
    }
  }
}
class DomElement {
  constructor(global, owner, dom = null, insertMode = {}, isFragment = false) {
    __publicField(this, "_uuid");
    __publicField(this, "_global");
    __publicField(this, "_owner");
    __publicField(this, "element");
    __publicField(this, "_pendingInsert");
    __publicField(this, "_requestWrite", false);
    __publicField(this, "_requestRead", false);
    __publicField(this, "_requestDelete", false);
    __publicField(this, "_requestPostWrite", false);
    __publicField(this, "_style");
    __publicField(this, "_classList");
    __publicField(this, "_dataAttribute");
    __publicField(this, "property");
    __publicField(this, "_transformApplied");
    __publicField(this, "insertMode");
    __publicField(this, "resizeObserver", null);
    __publicField(this, "mutationObserver", null);
    this._global = global;
    this.element = dom;
    this.property = {
      x: 0,
      y: 0,
      height: 0,
      width: 0,
      scaleX: 1,
      scaleY: 1,
      screenX: 0,
      screenY: 0
    };
    this._transformApplied = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1
    };
    this._pendingInsert = isFragment;
    this._owner = owner;
    this._uuid = (++global.gid).toString();
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
    this._style = {};
    this._dataAttribute = {};
    this._classList = [];
    this.insertMode = insertMode;
  }
  addElement(element) {
    this.element = element;
    this._owner.requestWrite();
    this._owner.requestRead();
    this.resizeObserver = new ResizeObserver(() => {
      var _a, _b;
      (_b = (_a = this._owner.event.dom).onResize) == null ? void 0 : _b.call(_a);
    });
    this.resizeObserver.observe(element);
    this.mutationObserver = new MutationObserver(() => {
      var _a, _b;
      (_b = (_a = this._owner.event.dom).onResize) == null ? void 0 : _b.call(_a);
    });
  }
  set style(style) {
    this._style = Object.assign(this._style, style);
  }
  get style() {
    return this._style;
  }
  set dataAttribute(dataAttribute) {
    this._dataAttribute = Object.assign(this._dataAttribute, dataAttribute);
  }
  get dataAttribute() {
    return this._dataAttribute;
  }
  set classList(classList) {
    this._classList = classList;
  }
  get classList() {
    return this._classList;
  }
  /**
   * Read the DOM property of the element.
   * @param accountTransform If true, the returned transform property will subtract any transform applied to the element.
   *      Note that transforms applied to the parent will not be accounted for.
   */
  readDom(accountTransform = false) {
    if (!this.element) {
      throw new Error("Element is not set");
    }
    const property = getDomProperty(this._global, this.element);
    const transform = this.element.style.transform;
    let transformApplied = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1
    };
    if (transform && transform != "none" && accountTransform) {
      transformApplied = parseTransformString(transform);
    }
    this.property.height = property.height / transformApplied.scaleY;
    this.property.width = property.width / transformApplied.scaleX;
    this.property.x = property.x - transformApplied.x;
    this.property.y = property.y - transformApplied.y;
    this.property.screenX = property.screenX;
    this.property.screenY = property.screenY;
  }
  /**
   * Write all properties of the element to the DOM, like style, class list, and data attributes.
   */
  writeDom() {
    if (!this.element) {
      console.warn("Element is not set, cannot write DOM properties");
      return;
    }
    setDomStyle(this.element, this._style);
    this.element.classList.forEach((className) => {
      this.element.classList.add(className);
    });
    for (const [key, value] of Object.entries(this._dataAttribute)) {
      this.element.setAttribute(`data-${key}`, value);
    }
    this.element.setAttribute("data-snapline-gid", this._owner.gid);
  }
  /**
   * Write the CSS transform property of the element.
   * Unlike many other properties, the transform property does not trigger a DOM reflow and is thus more performant.
   * Whenever possible, use this method instead of writeDom.
   * For example, if you are moving an element, instead of changing the left and top properties,
   * you should use this method to set the transform property.
   */
  writeTransform() {
    if (!this.element) {
      console.warn("Element is not set, cannot write transform properties");
      return;
    }
    let transformStyle = {
      transform: ""
    };
    if (this._owner.transformMode == "direct") {
      transformStyle = {
        transform: generateTransformString({
          x: this._owner.transform.x + this._owner.offset.x,
          y: this._owner.transform.y + this._owner.offset.y,
          scaleX: this._owner.transform.scaleX,
          scaleY: this._owner.transform.scaleY
        })
      };
    } else if (this._owner.transformMode == "relative") {
      let [newX, newY] = [
        this._owner.transform.x - this.property.x,
        this._owner.transform.y - this.property.y
      ];
      transformStyle = {
        transform: generateTransformString({
          x: newX + this._owner.offset.x,
          y: newY + this._owner.offset.y,
          scaleX: this._owner.transform.scaleX,
          scaleY: this._owner.transform.scaleY
        })
      };
    } else if (this._owner.transformMode == "none") {
      transformStyle = {
        transform: ""
      };
    } else if (this._owner.transformMode == "offset") {
      if (!this._owner.transformOrigin) {
        throw new Error("Transform origin is not set");
      }
      transformStyle = {
        transform: generateTransformString({
          x: this._owner.transform.x - this._owner.transformOrigin.transform.x,
          y: this._owner.transform.y - this._owner.transformOrigin.transform.y,
          scaleX: this._owner.transform.scaleX * this._owner.transformOrigin.transform.scaleX,
          scaleY: this._owner.transform.scaleY * this._owner.transformOrigin.transform.scaleY
        })
      };
    }
    if (this._style["transform"] != void 0 && this._style["transform"] != "" && transformStyle["transform"] != "") {
      transformStyle["transform"] = this._style["transform"];
    }
    setDomStyle(this.element, { ...this._style, ...transformStyle });
  }
  destroyDom() {
    var _a, _b;
    (_a = this.resizeObserver) == null ? void 0 : _a.disconnect();
    (_b = this.mutationObserver) == null ? void 0 : _b.disconnect();
    if (this.element) {
      this.element.remove();
    }
  }
}
class ElementObject extends BaseObject {
  constructor(global, parent) {
    super(global, parent);
    __publicField(this, "_dom");
    __publicField(this, "_requestWrite");
    __publicField(this, "_requestRead");
    __publicField(this, "_requestDelete");
    __publicField(this, "_requestPostWrite");
    __publicField(this, "_state", {});
    __publicField(this, "state");
    __publicField(this, "transformMode");
    __publicField(this, "transformOrigin");
    /**
     * direct: Applies the transform directly to the object.
     * relative: Perform calculations to apply the transform relative to the DOM element's
     *      current position. The current position must be read from the DOM explicitly beforehand.
     *      Only applicable if the object owns a DOM element.
     * offset: Apply the transform relative to the position of a parent object.
     * none: No transform is applied to the object.
     */
    // _parentElement: HTMLElement | null;
    // _elementIndex: number;
    __publicField(this, "_domProperty");
    __publicField(this, "inScene", false);
    __publicField(this, "_callback");
    __publicField(this, "callback");
    __publicField(this, "inputEngine");
    this._dom = new DomElement(global, this, null);
    this.inScene = false;
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
    this._domProperty = [
      {
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        scaleX: 1,
        scaleY: 1,
        screenX: 0,
        screenY: 0
      },
      {
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        scaleX: 1,
        scaleY: 1,
        screenX: 0,
        screenY: 0
      },
      {
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        scaleX: 1,
        scaleY: 1,
        screenX: 0,
        screenY: 0
      }
    ];
    this.transformMode = "direct";
    this.transformOrigin = null;
    this._callback = {
      afterRead1: null,
      afterRead2: null,
      afterRead3: null,
      afterWrite1: null,
      afterWrite2: null,
      afterWrite3: null
    };
    this.callback = EventProxyFactory(this, this._callback);
    this.state = new Proxy(this._state, {
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      }
    });
    this.inputEngine = new InputControl(this.global, false, this.gid);
  }
  destroy() {
    this._dom.destroyDom();
    super.destroy();
  }
  getDomProperty(stage = null) {
    const index = stage == "READ_1" ? 0 : stage == "READ_2" ? 1 : 2;
    return this._domProperty[index];
  }
  /**
   * Save the DOM property to the transform property.
   * Currently only saves the x and y properties.
   * This function assumes that the element position has already been read from the DOM.
   */
  saveDomPropertyToTransform(stage = null) {
    let currentStage = stage ?? this.global.currentStage;
    currentStage = currentStage == "IDLE" ? "READ_2" : currentStage;
    const property = this.getDomProperty(currentStage);
    this.worldPosition = [property.x, property.y];
  }
  /**
   * Calculate the local offsets relative to the parent.
   * This function assumes that the element position has already been read from the DOM
   * in both the parent and the current object.
   */
  calculateLocalFromTransform() {
    if (this.parent) {
      this.local.x = this.transform.x - this.parent.transform.x;
      this.local.y = this.transform.y - this.parent.transform.y;
    }
  }
  calculateLocalFromDom(stage = null) {
    if (this.parent) {
      const property = this.getDomProperty(stage);
      if (this.parent instanceof ElementObject) {
        this.local.x = property.x - this.parent.getDomProperty(stage).x;
        this.local.y = property.y - this.parent.getDomProperty(stage).y;
      } else {
        this.local.x = this.transform.x - this.parent.transform.x;
        this.local.y = this.transform.y - this.parent.transform.y;
      }
    }
  }
  calculateTransformFromLocal() {
    if (this.parent) {
      this.transform.x = this.parent.transform.x + this.local.x;
      this.transform.y = this.parent.transform.y + this.local.y;
    }
  }
  get style() {
    return this._dom.style;
  }
  set style(style) {
    this._dom.style = style;
  }
  get classList() {
    return this._dom.classList;
  }
  set classList(classList) {
    this._dom.classList = classList;
  }
  get dataAttribute() {
    return this._dom.dataAttribute;
  }
  set dataAttribute(dataAttribute) {
    this._dom.dataAttribute = dataAttribute;
  }
  get element() {
    return this._dom.element;
  }
  set element(element) {
    var _a, _b, _c, _d;
    if (!element) {
      console.error("Element is not set", this.gid);
      return;
    }
    this._dom.addElement(element);
    (_a = this.inputEngine) == null ? void 0 : _a.addCursorEventListener(element);
    const keys = Object.keys(this.inputEngine.event);
    for (const event of keys) {
      let callback = ((_b = this.event.input[event]) == null ? void 0 : _b.bind(this)) || null;
      this.inputEngine.event[event] = callback;
    }
    (_d = (_c = this.event.dom).onAssignDom) == null ? void 0 : _d.call(_c);
  }
  readDom(accountTransform = false, stage = null) {
    let currentStage = stage ?? this.global.currentStage;
    currentStage = currentStage == "IDLE" ? "READ_2" : currentStage;
    this._dom.readDom(accountTransform);
    super.readDom(accountTransform);
    if (currentStage == "READ_1") {
      Object.assign(this._domProperty[0], this._dom.property);
    } else if (currentStage == "READ_2") {
      Object.assign(this._domProperty[1], this._dom.property);
    } else if (currentStage == "READ_3") {
      Object.assign(this._domProperty[2], this._dom.property);
    }
  }
  writeDom() {
    this._dom.writeDom();
    super.writeDom();
  }
  writeTransform() {
    this._dom.writeTransform();
    super.writeTransform();
  }
  destroyDom() {
    this._dom.destroyDom();
    super.destroyDom();
  }
  /**
   * Common queue requests for element objects.
   */
  requestRead(accountTransform = false, saveTransform = true, stage = "READ_1") {
    let callback = () => {
      this.readDom(accountTransform);
      if (saveTransform) {
        this.saveDomPropertyToTransform(stage);
      }
    };
    return this.queueUpdate(stage, callback, stage);
  }
  requestWrite(mutate = true, writeCallback = null, stage = "WRITE_1") {
    let callback = () => {
      if (mutate) {
        this.writeDom();
      }
      writeCallback == null ? void 0 : writeCallback();
    };
    return this.queueUpdate(stage, callback, stage);
  }
  requestDestroy() {
    let callback = () => {
      this.destroyDom();
    };
    return this.queueUpdate("WRITE_2", callback, "destroy");
  }
  requestTransform(stage = "WRITE_2") {
    let callback = () => {
      this.writeTransform();
    };
    return this.queueUpdate(stage, callback, "transform");
  }
  requestFLIP(writeCallback, transformCallback) {
    this.requestRead(false, true, "READ_1");
    this.requestWrite(true, writeCallback, "WRITE_1");
    this.requestRead(false, true, "READ_2");
    this.requestWrite(false, transformCallback, "WRITE_2");
  }
}
const GLOBAL_GID = "global";
class InputControl {
  constructor(global, isGlobal = true, ownerGID = null) {
    __privateAdd(this, _InputControl_instances);
    /**
     * Functions as a middleware that converts mouse and touch events into a unified event format.
     */
    __publicField(this, "_element");
    __publicField(this, "global");
    __publicField(this, "_sortedTouchArray");
    // List of touches for touch events, sorted by the times they are pressed
    __publicField(this, "_sortedTouchDict");
    // Dictionary of touches for touch events, indexed by the touch identifier
    __publicField(this, "_localPointerDict");
    __publicField(this, "_event");
    __publicField(this, "event");
    __publicField(this, "_isGlobal");
    __publicField(this, "_uuid");
    __publicField(this, "_ownerGID");
    __privateAdd(this, _debugObject);
    __privateAdd(this, _dragMemberList);
    var _a;
    this.global = global;
    this._element = null;
    this._isGlobal = isGlobal;
    this._sortedTouchArray = [];
    this._sortedTouchDict = {};
    this._ownerGID = ownerGID;
    this._localPointerDict = {};
    __privateSet(this, _dragMemberList, []);
    this._event = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      dragStart: null,
      drag: null,
      dragEnd: null,
      pinchStart: null,
      pinch: null,
      pinchEnd: null
    };
    this.event = EventProxyFactory(
      this,
      this._event,
      this._isGlobal ? null : (_a = this.globalInputEngine) == null ? void 0 : _a._inputControl.event
    );
    this._uuid = Symbol();
    __privateSet(this, _debugObject, new BaseObject(this.global, null));
  }
  destroy() {
  }
  get globalInputEngine() {
    var _a;
    return (_a = this.global) == null ? void 0 : _a.inputEngine;
  }
  get globalPointerDict() {
    if (this.globalInputEngine == null) {
      return {};
    }
    return this.globalInputEngine._pointerDict;
  }
  get globalGestureDict() {
    if (this.globalInputEngine == null) {
      return {};
    }
    return this.globalInputEngine._gestureDict;
  }
  // convertMouseToCursorState(buttons: number): cursorState {
  //   switch (buttons) {
  //     case 1:
  //       return cursorState.mouseLeft;
  //     case 2:
  //       return cursorState.mouseRight;
  //     case 4:
  //       return cursorState.mouseMiddle;
  //     default:
  //       return cursorState.none;
  //   }
  // }
  getCoordinates(screenX, screenY) {
    if (this.global == null) {
      return {
        x: screenX,
        y: screenY,
        cameraX: screenX,
        cameraY: screenY,
        screenX,
        screenY
      };
    }
    const [cameraX, cameraY] = this.global.camera.getCameraFromScreen(
      screenX,
      screenY
    );
    const [worldX, worldY] = this.global.camera.getWorldFromCamera(
      cameraX,
      cameraY
    );
    return {
      x: worldX,
      y: worldY,
      cameraX,
      cameraY,
      screenX,
      screenY
    };
  }
  /**
   * Called when the user pressed the mouse button.
   * This and all other pointer/gesture events automatically propagate to global input engine as well.
   * @param e
   * @returns
   */
  onPointerDown(e) {
    var _a, _b, _c, _d;
    e.stopPropagation();
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    (_b = (_a = this.event).pointerDown) == null ? void 0 : _b.call(_a, {
      event: e,
      position: coordinates,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
      button: e.buttons
    });
    const pointerData = {
      id: e.pointerId,
      callerGID: this._isGlobal ? GLOBAL_GID : this._ownerGID,
      timestamp: e.timeStamp,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      prevX: e.clientX,
      prevY: e.clientY,
      endX: null,
      endY: null,
      moveCount: 0
    };
    this.globalPointerDict[e.pointerId] = pointerData;
    (_d = (_c = this.event).dragStart) == null ? void 0 : _d.call(_c, {
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
      pointerId: e.pointerId,
      start: coordinates,
      button: e.buttons
    });
    __privateGet(this, _debugObject).addDebugPoint(coordinates.x, coordinates.y, "red", true, "pointerDown");
    if (this.globalGestureDict[e.pointerId]) {
      this.globalGestureDict[e.pointerId].memberList.push(this);
    } else {
      this.globalGestureDict[e.pointerId] = {
        type: "drag",
        state: "drag",
        memberList: [this, ...__privateGet(this, _dragMemberList)],
        initiatorID: this._isGlobal ? GLOBAL_GID : this._ownerGID ?? ""
      };
    }
  }
  /**
   * Called when the user moves the mouse
   * @param e
   */
  onPointerMove(e) {
    var _a, _b;
    e.preventDefault();
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    (_b = (_a = this.event).pointerMove) == null ? void 0 : _b.call(_a, {
      event: e,
      position: coordinates,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
      button: e.buttons
    });
    const id = e.pointerId;
    let pointerData = this.globalPointerDict[id];
    if (pointerData != null) {
      const updatedPointerData = {
        prevX: pointerData.x,
        prevY: pointerData.y,
        x: e.clientX,
        y: e.clientY,
        callerGID: this._isGlobal ? GLOBAL_GID : this._ownerGID
      };
      Object.assign(pointerData, updatedPointerData);
      __privateMethod(this, _InputControl_instances, handleMultiPointer_fn).call(this, e);
    }
    e.stopPropagation();
  }
  /**
   * Called when the user releases the mouse button
   * @param e
   */
  onPointerUp(e) {
    var _a, _b, _c, _d, _e, _f;
    e.preventDefault();
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    console.debug("onPointerUp", e.pointerId, coordinates);
    (_b = (_a = this.event).pointerUp) == null ? void 0 : _b.call(_a, {
      event: e,
      position: coordinates,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
      button: e.buttons
    });
    let pointerData = this.globalPointerDict[e.pointerId];
    console.debug("onPointerUp", e.pointerId, pointerData);
    if (pointerData != null) {
      const gesture = this.globalGestureDict[e.pointerId];
      console.debug("onPointerUp gesture", e.pointerId, gesture);
      if (gesture != null) {
        gesture.state = "release";
        const start = this.getCoordinates(
          pointerData.startX,
          pointerData.startY
        );
        console.debug(
          "dragEnd",
          gesture.memberList.map((m) => m._ownerGID)
        );
        for (const member of gesture.memberList) {
          console.debug("dragEnd", e.pointerId, member._ownerGID);
          (_d = (_c = member.event).dragEnd) == null ? void 0 : _d.call(_c, {
            gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
            pointerId: e.pointerId,
            start,
            end: coordinates,
            button: e.buttons
          });
        }
        delete this.globalGestureDict[e.pointerId];
      }
      delete this.globalPointerDict[e.pointerId];
      for (const gestureKey of Object.keys(this.globalGestureDict)) {
        if (!gestureKey.includes("-")) {
          continue;
        }
        const [pointerId_0, pointerId_1] = gestureKey.split("-").map(Number);
        if (pointerId_0 == e.pointerId || pointerId_1 == e.pointerId) {
          const gesture2 = this.globalGestureDict[gestureKey];
          (_f = (_e = this.event).pinchEnd) == null ? void 0 : _f.call(_e, {
            gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
            gestureID: gestureKey,
            start: gesture2.start,
            pointerList: gesture2.pointerList,
            distance: gesture2.distance,
            end: {
              pointerList: gesture2.pointerList,
              distance: gesture2.distance
            }
          });
          console.warn("pinchEnd", gestureKey, this._ownerGID);
          delete this.globalGestureDict[gestureKey];
        }
      }
    }
    e.stopPropagation();
  }
  /**
   * Called when the user scrolls the mouse wheel
   * @param e
   */
  onWheel(e) {
    var _a, _b;
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    (_b = (_a = this.event).mouseWheel) == null ? void 0 : _b.call(_a, {
      event: e,
      position: coordinates,
      delta: e.deltaY,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID
    });
    console.debug("onWheel", coordinates);
    e.stopPropagation();
  }
  addListener(dom, event, callback) {
    dom.addEventListener(event, callback.bind(this));
  }
  addCursorEventListener(dom) {
    this.addListener(dom, "pointerdown", this.onPointerDown);
    this.addListener(dom, "pointermove", this.onPointerMove);
    this.addListener(dom, "pointerup", this.onPointerUp);
    this.addListener(dom, "wheel", this.onWheel);
  }
  addDragMember(member) {
    __privateGet(this, _dragMemberList).push(member);
  }
  resetDragMembers() {
    __privateSet(this, _dragMemberList, []);
  }
}
_debugObject = new WeakMap();
_dragMemberList = new WeakMap();
_InputControl_instances = new WeakSet();
handleMultiPointer_fn = function(e) {
  var _a, _b, _c, _d, _e, _f;
  const numKeys = Object.keys(this.globalPointerDict).length;
  if (numKeys >= 1) {
    for (const pointer of Object.values(this.globalPointerDict)) {
      const thisGID = this._isGlobal ? GLOBAL_GID : this._ownerGID;
      if (thisGID != pointer.callerGID) {
        continue;
      }
      const startPosition = this.getCoordinates(
        pointer.startX,
        pointer.startY
      );
      const currentPosition = this.getCoordinates(pointer.x, pointer.y);
      const deltaCoordinates = {
        x: currentPosition.x - startPosition.x,
        y: currentPosition.y - startPosition.y,
        cameraX: currentPosition.cameraX - startPosition.cameraX,
        cameraY: currentPosition.cameraY - startPosition.cameraY,
        screenX: currentPosition.screenX - startPosition.screenX,
        screenY: currentPosition.screenY - startPosition.screenY
      };
      if (pointer.moveCount == 0) ;
      pointer.moveCount++;
      const gesture = this.globalGestureDict[pointer.id];
      for (const member of gesture.memberList) {
        (_b = (_a = member.event).drag) == null ? void 0 : _b.call(_a, {
          gid: member._isGlobal ? GLOBAL_GID : member._ownerGID,
          pointerId: pointer.id,
          start: startPosition,
          position: currentPosition,
          delta: deltaCoordinates,
          button: e.buttons
        });
      }
    }
  }
  if (numKeys >= 2 && this._isGlobal) {
    const pointerList = Object.values(this.globalPointerDict);
    pointerList.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < pointerList.length - 1; i++) {
      const pointer_0 = pointerList[i];
      const pointer_1 = pointerList[i + 1];
      const gestureKey = `${pointer_0.id}-${pointer_1.id}`;
      const startMiddleX = (pointer_0.startX + pointer_1.startX) / 2;
      const startMiddleY = (pointer_0.startY + pointer_1.startY) / 2;
      const startMiddle = this.getCoordinates(startMiddleX, startMiddleY);
      const startDistance = Math.sqrt(
        Math.pow(pointer_0.startX - pointer_1.startX, 2) + Math.pow(pointer_0.startY - pointer_1.startY, 2)
      );
      const currentPointer0 = this.getCoordinates(pointer_0.x, pointer_0.y);
      const currentPointer1 = this.getCoordinates(pointer_1.x, pointer_1.y);
      const currentDistance = Math.sqrt(
        Math.pow(pointer_0.x - pointer_1.x, 2) + Math.pow(pointer_0.y - pointer_1.y, 2)
      );
      if (this.globalGestureDict[gestureKey] == null) {
        this.globalGestureDict[gestureKey] = {
          type: "pinch",
          state: "pinch",
          memberList: [this],
          start: {
            pointerList: [currentPointer0, currentPointer1],
            distance: startDistance
          },
          pointerList: [currentPointer0, currentPointer1],
          distance: startDistance
        };
        (_d = (_c = this.event).pinchStart) == null ? void 0 : _d.call(_c, {
          gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
          gestureID: gestureKey,
          start: {
            pointerList: [currentPointer0, currentPointer1],
            distance: startDistance
          }
        });
        console.warn("pinchStart", startMiddle, this._ownerGID);
      }
      const pinchGesture = this.globalGestureDict[gestureKey];
      pinchGesture.pointerList = [currentPointer0, currentPointer1];
      pinchGesture.distance = currentDistance;
      (_f = (_e = this.event).pinch) == null ? void 0 : _f.call(_e, {
        gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
        gestureID: gestureKey,
        start: pinchGesture.start,
        pointerList: pinchGesture.pointerList,
        distance: pinchGesture.distance
      });
      console.warn("pinch", currentPointer0, currentPointer1, this._ownerGID);
    }
  }
};
class GlobalInputControl {
  constructor(global = null) {
    __privateAdd(this, _document);
    __publicField(this, "global");
    __publicField(this, "_inputControl");
    __publicField(this, "globalCallbacks");
    __publicField(this, "_pointerDict");
    __publicField(this, "_gestureDict");
    __publicField(this, "_event");
    __publicField(this, "event");
    this.global = global;
    __privateSet(this, _document, document);
    this._inputControl = new InputControl(this.global, true, null);
    this._inputControl.addCursorEventListener(
      __privateGet(this, _document)
    );
    this.globalCallbacks = {
      pointerDown: {},
      pointerMove: {},
      pointerUp: {},
      mouseWheel: {},
      dragStart: {},
      drag: {},
      dragEnd: {},
      pinchStart: {},
      pinch: {},
      pinchEnd: {}
    };
    this._pointerDict = {};
    this._gestureDict = {};
    for (const [key, callbackRecord] of Object.entries(this.globalCallbacks)) {
      this._inputControl.event[key] = (prop) => {
        for (const callback of Object.values(
          this.globalCallbacks[key]
        )) {
          callback(prop);
        }
      };
    }
    this._event = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      dragStart: null,
      drag: null,
      dragEnd: null,
      pinchStart: null,
      pinch: null,
      pinchEnd: null
    };
    this.event = new Proxy(this._event, {
      set: (target, prop, value) => {
        if (value != null) {
          this.subscribeGlobalCursorEvent(
            prop,
            GLOBAL_GID,
            value.bind(this)
          );
        } else {
          this.unsubscribeGlobalCursorEvent(
            prop,
            GLOBAL_GID
          );
        }
        return true;
      }
    });
  }
  subscribeGlobalCursorEvent(event, gid, callback) {
    this.globalCallbacks[event][gid] = callback;
  }
  unsubscribeGlobalCursorEvent(event, gid) {
    delete this.globalCallbacks[event][gid];
  }
}
_document = new WeakMap();
class EventCallback2 {
  // _dom: DomEvent;
  // dom: DomEvent;
  constructor(object) {
    __publicField(this, "_object");
    __publicField(this, "_collider");
    __publicField(this, "collider");
    this._object = object;
    this._collider = {
      onCollide: null,
      onBeginContact: null,
      onEndContact: null
    };
    this.collider = EventProxyFactory(object, this._collider);
  }
}
class Collider {
  constructor(global, parent, type, localX, localY) {
    __publicField(this, "global");
    __publicField(this, "parent");
    __publicField(this, "type");
    __publicField(this, "uuid");
    __publicField(this, "_element");
    __publicField(this, "inputEngine");
    __publicField(this, "transform");
    // local: ColliderProperty;
    __publicField(this, "event");
    __publicField(this, "_currentCollisions");
    __publicField(this, "_iterationCollisions");
    this.global = global;
    this.parent = parent;
    this.type = type;
    this.uuid = Symbol();
    this._element = null;
    this.transform = {
      x: localX,
      y: localY,
      width: 0,
      height: 0
    };
    this.event = new EventCallback2(this.parent);
    this._iterationCollisions = /* @__PURE__ */ new Set();
    this._currentCollisions = /* @__PURE__ */ new Set();
    this.recalculate();
    this.inputEngine = new InputControl(this.global);
  }
  get worldPosition() {
    return [
      this.parent.transform.x + this.transform.x,
      this.parent.transform.y + this.transform.y
    ];
  }
  set worldPosition([x, y]) {
    this.transform.x = x - this.parent.transform.x;
    this.transform.y = y - this.parent.transform.y;
  }
  // get localPosition(): [number, number] {
  //   return [this.local.x, this.local.y];
  // }
  // set localPosition([x, y]: [number, number]) {
  //   this.local.x = x;
  //   this.local.y = y;
  // }
  set element(element) {
    this._element = element;
    if (this.parent.hasOwnProperty("element")) {
      this.parent.requestRead();
    } else {
      this.recalculate();
    }
  }
  read() {
    if (!this.element) {
      return;
    }
    const property = getDomProperty(this.global, this.element);
    this.transform.x = property.x - this.parent.transform.x;
    this.transform.y = property.y - this.parent.transform.y;
    this.transform.width = property.width;
    this.transform.height = property.height;
  }
  recalculate() {
  }
}
class RectCollider extends Collider {
  constructor(global, parent, localX, localY, width, height) {
    super(global, parent, "rect", localX, localY);
    this.transform.width = width;
    this.transform.height = height;
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
      x: object.worldPosition[0],
      left: true
    });
    this.sortedXCoordinates.push({
      collider: object,
      x: object.worldPosition[0] + (object.transform.width ?? 0),
      left: false
    });
  }
  removeObject(uuid) {
    delete this.objectTable[uuid];
    this.objectList = this.objectList.filter((obj) => obj.uuid !== uuid);
  }
  updateXCoordinates() {
    for (const entry of this.sortedXCoordinates) {
      if (entry.left) {
        if (entry.collider.type === "circle") {
          entry.x = entry.collider.worldPosition[0] - entry.collider.radius;
        } else if (entry.collider.type === "rect") {
          entry.x = entry.collider.worldPosition[0];
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldPosition[0];
        }
      } else {
        if (entry.collider.type === "circle") {
          entry.x = entry.collider.worldPosition[0] + entry.collider.radius;
        } else if (entry.collider.type === "rect") {
          entry.x = entry.collider.worldPosition[0] + entry.collider.transform.width;
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldPosition[0];
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
      (_b = (_a = thisObject.event.collider).onBeginContact) == null ? void 0 : _b.call(_a, thisObject, otherObject);
      thisObject._currentCollisions.add(otherObject);
    }
    thisObject._iterationCollisions.add(otherObject);
  }
  isRectIntersecting(a, b) {
    return a.uuid !== b.uuid && a.worldPosition[1] < b.worldPosition[1] + b.transform.height && a.worldPosition[1] + a.transform.height > b.worldPosition[1];
  }
  isRectCircleIntersecting(rect, circle) {
    let rectX = circle.worldPosition[0];
    let rectY = circle.worldPosition[1];
    if (circle.worldPosition[0] < rect.worldPosition[0]) {
      rectX = rect.worldPosition[0];
    } else if (circle.worldPosition[0] > rect.worldPosition[0] + rect.transform.width) {
      rectX = rect.worldPosition[0] + rect.transform.width;
    }
    if (circle.worldPosition[1] < rect.worldPosition[1]) {
      rectY = rect.worldPosition[1];
    } else if (circle.worldPosition[1] > rect.worldPosition[1] + rect.transform.height) {
      rectY = rect.worldPosition[1] + rect.transform.height;
    }
    let distanceX = circle.worldPosition[0] - rectX;
    let distanceY = circle.worldPosition[1] - rectY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }
  isRectPointIntersecting(rect, point) {
    return point.worldPosition[0] >= rect.worldPosition[0] && point.worldPosition[0] <= rect.worldPosition[0] + rect.transform.width && point.worldPosition[1] >= rect.worldPosition[1] && point.worldPosition[1] <= rect.worldPosition[1] + rect.transform.height;
  }
  isCirclePointIntersecting(circle, point) {
    let distanceX = circle.worldPosition[0] - point.worldPosition[0];
    let distanceY = circle.worldPosition[1] - point.worldPosition[1];
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }
  isCircleIntersecting(circleA, circleB) {
    if (circleA.uuid === circleB.uuid) {
      return false;
    }
    let distanceX = circleA.worldPosition[0] - circleB.worldPosition[0];
    let distanceY = circleA.worldPosition[1] - circleB.worldPosition[1];
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circleA.radius ?? 0) + (circleB.radius ?? 0);
  }
  isPointPointIntersecting(pointA, pointB) {
    if (pointA.uuid === pointB.uuid) {
      return false;
    }
    return pointA.worldPosition[0] === pointB.worldPosition[0] && pointA.worldPosition[1] === pointB.worldPosition[1];
  }
}
class GlobalManager {
  constructor() {
    __publicField(this, "containerElement");
    __publicField(this, "cursor");
    __publicField(this, "camera");
    __publicField(this, "inputEngine");
    __publicField(this, "collisionEngine");
    __publicField(this, "objectTable");
    __publicField(this, "currentStage");
    __publicField(this, "read1Queue");
    __publicField(this, "write1Queue");
    __publicField(this, "read2Queue");
    __publicField(this, "write2Queue");
    __publicField(this, "read3Queue");
    __publicField(this, "write3Queue");
    __publicField(this, "animationList", []);
    __publicField(this, "animationFragment");
    __publicField(this, "debugMarkerList", {});
    __publicField(this, "data");
    __publicField(this, "snapline");
    __publicField(this, "gid");
    this.containerElement = null;
    this.cursor = {
      worldX: 0,
      worldY: 0,
      cameraX: 0,
      cameraY: 0,
      screenX: 0,
      screenY: 0
    };
    this.camera = null;
    this.collisionEngine = null;
    this.objectTable = {};
    this.inputEngine = new GlobalInputControl(this);
    this.currentStage = "IDLE";
    this.read1Queue = {};
    this.write1Queue = {};
    this.read2Queue = {};
    this.write2Queue = {};
    this.read3Queue = {};
    this.write3Queue = {};
    this.animationList = [];
    this.animationFragment = document.createElement("div");
    document.body.appendChild(this.animationFragment);
    this.data = {};
    this.snapline = null;
    this.gid = 0;
  }
  getGlobalId() {
    this.gid++;
    return this.gid.toString();
  }
}
class SnapLine {
  constructor(config = {}) {
    __privateAdd(this, _SnapLine_instances);
    __publicField(this, "snaplineConfig");
    __privateAdd(this, _containerStyle, {});
    __publicField(this, "global");
    __publicField(this, "_collisionEngine", null);
    __publicField(this, "_event");
    __publicField(this, "event");
    __publicField(this, "debug", false);
    __publicField(this, "debugWindow", null);
    __publicField(this, "debugCtx", null);
    __privateAdd(this, _resizeObserver2, null);
    this.global = new GlobalManager();
    this.global.read1Queue = {};
    this.global.write1Queue = {};
    this.global.read2Queue = {};
    this.global.write2Queue = {};
    this.global.read3Queue = {};
    this.global.write3Queue = {};
    this.global.animationList = [];
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
    __privateSet(this, _containerStyle, {
      position: "relative",
      overflow: "hidden"
    });
    this.global.collisionEngine = new CollisionEngine();
    this._event = {
      containerElementAssigned: null
    };
    this.event = EventProxyFactory(this, this._event);
    this.debug = false;
    __privateSet(this, _resizeObserver2, new ResizeObserver(() => {
      if (this.debug) {
        let containerRect = this.global.containerElement.getBoundingClientRect();
        this.debugWindow.width = containerRect.width;
        this.debugWindow.height = containerRect.height;
      }
    }));
  }
  enableDebug() {
    if (this.global.containerElement == null) {
      return;
    }
    this.debug = true;
    this.debugWindow = document.createElement("canvas");
    this.debugWindow.style.position = "absolute";
    this.debugWindow.style.top = "0";
    this.debugWindow.style.left = "0";
    let containerRect = this.global.containerElement.getBoundingClientRect();
    this.debugWindow.width = containerRect.width;
    this.debugWindow.height = containerRect.height;
    this.debugWindow.style.zIndex = "1000";
    this.debugWindow.style.pointerEvents = "none";
    this.global.containerElement.appendChild(this.debugWindow);
    this.debugCtx = this.debugWindow.getContext("2d");
  }
  disableDebug() {
    this.debug = false;
    if (this.debugWindow) {
      this.debugWindow.remove();
      this.debugWindow = null;
      this.debugCtx = null;
    }
  }
  /**
   * Initialize global stats, dom elements, and event listeners for the library.
   * @param containerDom: The element that contains all other elements.
   */
  assignDom(containerDom) {
    var _a, _b, _c;
    this.global.containerElement = containerDom;
    this.global.camera = new Camera(containerDom);
    (_b = (_a = this.event).containerElementAssigned) == null ? void 0 : _b.call(_a, containerDom);
    (_c = __privateGet(this, _resizeObserver2)) == null ? void 0 : _c.observe(containerDom);
    window.requestAnimationFrame(__privateMethod(this, _SnapLine_instances, step_fn).bind(this));
  }
  debugObjectBoundingBox(object) {
    var _a, _b, _c;
    if (this.debugCtx == null) {
      return;
    }
    this.debugCtx.beginPath();
    this.debugCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
    const [cameraX, cameraY] = ((_a = this.global.camera) == null ? void 0 : _a.getCameraFromWorld(
      ...object.worldPosition
    )) ?? [0, 0];
    this.debugCtx.rect(cameraX, cameraY, 20, 20);
    this.debugCtx.fill();
    this.debugCtx.fillStyle = "white";
    this.debugCtx.fillText(object.gid, cameraX, cameraY + 10);
    if (object.hasOwnProperty("_dom")) {
      let elementObject = object;
      const colors = ["#FF0000A0", "#00FF00A0", "#0000FFA0"];
      const stages = ["READ_1", "READ_2", "READ_3"];
      for (let i = 0; i < 3; i++) {
        const property = elementObject.getDomProperty(stages[i]);
        this.debugCtx.stroke();
        this.debugCtx.beginPath();
        this.debugCtx.strokeStyle = colors[i];
        this.debugCtx.lineWidth = 1;
        const [domCameraX, domCameraY] = ((_b = this.global.camera) == null ? void 0 : _b.getCameraFromWorld(
          property.x,
          property.y
        )) ?? [0, 0];
        this.debugCtx.rect(
          domCameraX,
          domCameraY,
          property.width,
          property.height
        );
        this.debugCtx.stroke();
      }
      this.debugCtx.beginPath();
      this.debugCtx.strokeStyle = "black";
      this.debugCtx.lineWidth = 1;
      this.debugCtx.rect(
        cameraX,
        cameraY,
        elementObject._dom.property.width,
        elementObject._dom.property.height
      );
    }
    const COLLIDER_BLUE = "rgba(0, 0, 255, 0.5)";
    for (let collisionObject of object._colliderList) {
      this.debugCtx.beginPath();
      this.debugCtx.strokeStyle = COLLIDER_BLUE;
      this.debugCtx.lineWidth = 1;
      const [colliderCameraX, colliderCameraY] = ((_c = this.global.camera) == null ? void 0 : _c.getCameraFromWorld(
        object.transform.x + collisionObject.transform.x,
        object.transform.y + collisionObject.transform.y
      )) ?? [0, 0];
      if (collisionObject.type == "circle") {
        this.debugCtx.arc(
          colliderCameraX,
          colliderCameraY,
          collisionObject.radius,
          0,
          2 * Math.PI
        );
        this.debugCtx.stroke();
      } else if (collisionObject.type == "rect") {
        this.debugCtx.rect(
          colliderCameraX,
          colliderCameraY,
          collisionObject.transform.width,
          collisionObject.transform.height
        );
        this.debugCtx.stroke();
      } else if (collisionObject.type == "point") {
        this.debugCtx.arc(colliderCameraX, colliderCameraY, 2, 0, 2 * Math.PI);
        this.debugCtx.fillStyle = COLLIDER_BLUE;
        this.debugCtx.fill();
      }
    }
  }
  renderDebugGrid() {
    if (this.debugCtx == null) {
      return;
    }
    const gridSize = 100;
    const camera = this.global.camera;
    if (!camera) return;
    const [worldLeft, worldTop] = camera.getWorldFromCamera(0, 0);
    const [worldRight, worldBottom] = camera.getWorldFromCamera(
      this.debugWindow.width,
      this.debugWindow.height
    );
    const startX = Math.floor(worldLeft / gridSize) * gridSize;
    const endX = Math.ceil(worldRight / gridSize) * gridSize;
    const startY = Math.floor(worldTop / gridSize) * gridSize;
    const endY = Math.ceil(worldBottom / gridSize) * gridSize;
    this.debugCtx.beginPath();
    this.debugCtx.strokeStyle = "rgba(200, 200, 200, 0.3)";
    this.debugCtx.lineWidth = 1;
    for (let x = startX; x <= endX; x += gridSize) {
      const [screenX1, screenY1] = camera.getCameraFromWorld(x, worldTop);
      const [screenX2, screenY2] = camera.getCameraFromWorld(x, worldBottom);
      this.debugCtx.moveTo(screenX1, screenY1);
      this.debugCtx.lineTo(screenX2, screenY2);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      const [screenX1, screenY1] = camera.getCameraFromWorld(worldLeft, y);
      const [screenX2, screenY2] = camera.getCameraFromWorld(worldRight, y);
      this.debugCtx.moveTo(screenX1, screenY1);
      this.debugCtx.lineTo(screenX2, screenY2);
    }
    this.debugCtx.stroke();
    this.debugCtx.beginPath();
    this.debugCtx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    this.debugCtx.lineWidth = 2;
    const xAxisVisible = startY <= 0 && endY >= 0;
    const yAxisVisible = startX <= 0 && endX >= 0;
    if (xAxisVisible) {
      const [xAxisStartX, xAxisStartY] = camera.getCameraFromWorld(startX, 0);
      const [xAxisEndX, xAxisEndY] = camera.getCameraFromWorld(endX, 0);
      this.debugCtx.moveTo(xAxisStartX, xAxisStartY);
      this.debugCtx.lineTo(xAxisEndX, xAxisEndY);
    }
    if (yAxisVisible) {
      const [yAxisStartX, yAxisStartY] = camera.getCameraFromWorld(0, startY);
      const [yAxisEndX, yAxisEndY] = camera.getCameraFromWorld(0, endY);
      this.debugCtx.moveTo(yAxisStartX, yAxisStartY);
      this.debugCtx.lineTo(yAxisEndX, yAxisEndY);
    }
    this.debugCtx.stroke();
    this.debugCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.debugCtx.font = "12px Arial";
    this.debugCtx.textAlign = "center";
    for (let x = startX; x <= endX; x += gridSize) {
      if (x === 0) continue;
      const [screenX, screenY] = camera.getCameraFromWorld(x, 0);
      if (screenY >= 0 && screenY <= this.debugWindow.height) {
        this.debugCtx.fillText(x.toString(), screenX, screenY + 20);
      }
    }
    for (let y = startY; y <= endY; y += gridSize) {
      if (y === 0) continue;
      const [screenX, screenY] = camera.getCameraFromWorld(0, y);
      if (screenX >= 0 && screenX <= this.debugWindow.width) {
        this.debugCtx.fillText(y.toString(), screenX - 20, screenY + 4);
      }
    }
    const [originX, originY] = camera.getCameraFromWorld(0, 0);
    if (originX >= 0 && originX <= this.debugWindow.width && originY >= 0 && originY <= this.debugWindow.height) {
      this.debugCtx.fillText("(0,0)", originX + 20, originY - 10);
    }
  }
  renderDebugFrame(stats) {
    var _a, _b;
    if (this.debugWindow == null) {
      return;
    }
    (_a = this.debugCtx) == null ? void 0 : _a.clearRect(
      0,
      0,
      this.debugWindow.width,
      this.debugWindow.height
    );
    this.renderDebugGrid();
    for (const object of Object.values(this.global.objectTable)) {
      this.debugObjectBoundingBox(object);
    }
    if (this.debugCtx == null) {
      return;
    }
    for (const marker of Object.values(this.global.debugMarkerList)) {
      const [cameraX, cameraY] = ((_b = this.global.camera) == null ? void 0 : _b.getCameraFromWorld(
        marker.x,
        marker.y
      )) ?? [0, 0];
      if (marker.type == "point") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.arc(cameraX, cameraY, 5, 0, 2 * Math.PI);
        this.debugCtx.fill();
      } else if (marker.type == "rect") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.rect(cameraX, cameraY, marker.width, marker.height);
        this.debugCtx.fill();
      } else if (marker.type == "circle") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.arc(cameraX, cameraY, marker.radius, 0, 2 * Math.PI);
        this.debugCtx.fill();
      } else if (marker.type == "text") {
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.fillText(marker.text, cameraX, cameraY);
      }
    }
    for (const id in this.global.debugMarkerList) {
      if (!this.global.debugMarkerList[id].persistent) {
        delete this.global.debugMarkerList[id];
      }
    }
  }
  _renderFrame() {
    var _a;
    let timestamp = Date.now();
    let stats = {
      timestamp
    };
    this.global.currentStage = "READ_1";
    __privateMethod(this, _SnapLine_instances, processQueue_fn).call(this, "READ_1", this.global.read1Queue);
    this.global.read1Queue = {};
    this.global.currentStage = "WRITE_1";
    __privateMethod(this, _SnapLine_instances, processQueue_fn).call(this, "WRITE_1", this.global.write1Queue);
    this.global.write1Queue = {};
    this.global.currentStage = "READ_2";
    __privateMethod(this, _SnapLine_instances, processQueue_fn).call(this, "READ_2", this.global.read2Queue);
    this.global.read2Queue = {};
    this.global.currentStage = "WRITE_2";
    __privateMethod(this, _SnapLine_instances, processQueue_fn).call(this, "WRITE_2", this.global.write2Queue);
    this.global.write2Queue = {};
    let newAnimationList = [];
    for (const animation of this.global.animationList) {
      if (animation.calculateFrame(stats.timestamp) == false && animation.requestDelete == false) {
        newAnimationList.push(animation);
      }
    }
    this.global.animationList = newAnimationList;
    this.global.currentStage = "READ_3";
    __privateMethod(this, _SnapLine_instances, processQueue_fn).call(this, "READ_3", this.global.read3Queue);
    this.global.read3Queue = {};
    this.global.currentStage = "WRITE_3";
    __privateMethod(this, _SnapLine_instances, processQueue_fn).call(this, "WRITE_3", this.global.write3Queue);
    this.global.write3Queue = {};
    this.global.currentStage = "IDLE";
    (_a = this.global.collisionEngine) == null ? void 0 : _a.detectCollisions();
    this.renderDebugFrame(stats);
  }
}
_containerStyle = new WeakMap();
_resizeObserver2 = new WeakMap();
_SnapLine_instances = new WeakSet();
/**
 * Main loop for rendering the canvas.
 */
step_fn = function() {
  this._renderFrame();
  window.requestAnimationFrame(__privateMethod(this, _SnapLine_instances, step_fn).bind(this));
};
processQueue_fn = function(stage, queue) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  let processedObjects = /* @__PURE__ */ new Set();
  for (const queueEntry2 of Object.values(queue)) {
    for (const objectEntry of queueEntry2.values()) {
      if (!objectEntry.callback) {
        continue;
      }
      for (const callback of objectEntry.callback) {
        callback();
      }
      if (!processedObjects.has(objectEntry.object)) {
        processedObjects.add(objectEntry.object);
        if (objectEntry.object instanceof ElementObject) {
          if (stage == "READ_1") {
            (_b = (_a = objectEntry.object.callback).afterRead1) == null ? void 0 : _b.call(_a);
          } else if (stage == "READ_2") {
            (_d = (_c = objectEntry.object.callback).afterRead2) == null ? void 0 : _d.call(_c);
          } else if (stage == "READ_3") {
            (_f = (_e = objectEntry.object.callback).afterRead3) == null ? void 0 : _f.call(_e);
          } else if (stage == "WRITE_1") {
            (_h = (_g = objectEntry.object.callback).afterWrite1) == null ? void 0 : _h.call(_g);
          } else if (stage == "WRITE_2") {
            (_j = (_i = objectEntry.object.callback).afterWrite2) == null ? void 0 : _j.call(_i);
          } else if (stage == "WRITE_3") {
            (_l = (_k = objectEntry.object.callback).afterWrite3) == null ? void 0 : _l.call(_k);
          }
        }
      }
    }
  }
};
class LineComponent extends ElementObject {
  constructor(globals, parent) {
    super(globals, parent);
    __publicField(this, "endWorldX");
    __publicField(this, "endWorldY");
    __publicField(this, "start");
    __publicField(this, "target");
    this.endWorldX = 0;
    this.endWorldY = 0;
    this.start = parent;
    this.target = null;
    this.transformMode = "direct";
  }
  setLineStartAtConnector() {
    const center = this.start.center;
    this.setLineStart(center.x, center.y);
  }
  setLineEndAtConnector() {
    if (this.target) {
      const center = this.target.center;
      this.setLineEnd(center.x, center.y);
    }
  }
  setLineStart(startPositionX, startPositionY) {
    this.worldPosition = [startPositionX, startPositionY];
  }
  setLineEnd(endWorldX, endWorldY) {
    this.endWorldX = endWorldX;
    this.endWorldY = endWorldY;
  }
  setLinePosition(startWorldX, startWorldY, endWorldX, endWorldY) {
    this.setLineStart(startWorldX, startWorldY);
    this.setLineEnd(endWorldX, endWorldY);
  }
  moveLineToConnectorTransform() {
    this.setLineStartAtConnector();
    if (!this.target) ;
    else {
      this.setLineEndAtConnector();
    }
  }
}
const _ConnectorComponent = class _ConnectorComponent extends ElementObject {
  constructor(global, parent, config = {}) {
    super(global, parent);
    __privateAdd(this, _config2);
    __privateAdd(this, _name);
    __privateAdd(this, _prop);
    __privateAdd(this, _outgoingLines);
    __privateAdd(this, _incomingLines);
    __privateAdd(this, _state, 0);
    __privateAdd(this, _hitCircle);
    __privateAdd(this, _mouseHitBox);
    __privateAdd(this, _targetConnector, null);
    __privateAdd(this, _connectorCallback, null);
    __privateSet(this, _prop, {});
    __privateSet(this, _outgoingLines, []);
    __privateSet(this, _incomingLines, []);
    __privateSet(this, _config2, config);
    __privateSet(this, _name, config.name || this.gid || "");
    this.event.input.pointerDown = this.onCursorDown;
    __privateSet(this, _hitCircle, new CircleCollider(global, this, 0, 0, 30));
    this.addCollider(__privateGet(this, _hitCircle));
    __privateSet(this, _mouseHitBox, new PointCollider(global, this, 0, 0));
    this.addCollider(__privateGet(this, _mouseHitBox));
    __privateSet(this, _targetConnector, null);
    this.transformMode = "none";
    __privateSet(this, _connectorCallback, {
      onConnectOutgoing: null,
      onConnectIncoming: null,
      onDisconnectOutgoing: null,
      onDisconnectIncoming: null
    });
    __privateSet(this, _connectorCallback, EventProxyFactory(this, __privateGet(this, _connectorCallback)));
  }
  get name() {
    return __privateGet(this, _name);
  }
  get config() {
    return __privateGet(this, _config2);
  }
  get prop() {
    return __privateGet(this, _prop);
  }
  get outgoingLines() {
    return __privateGet(this, _outgoingLines);
  }
  get incomingLines() {
    return __privateGet(this, _incomingLines);
  }
  get targetConnector() {
    return __privateGet(this, _targetConnector);
  }
  set targetConnector(value) {
    __privateSet(this, _targetConnector, value);
  }
  get numIncomingLines() {
    return __privateGet(this, _incomingLines).length;
  }
  get numOutgoingLines() {
    return __privateGet(this, _outgoingLines).length;
  }
  get center() {
    const prop = this.getDomProperty("READ_1");
    return {
      x: this.transform.x + prop.width / 2,
      y: this.transform.y + prop.height / 2
    };
  }
  get connectorCallback() {
    return __privateGet(this, _connectorCallback);
  }
  onCursorDown(prop) {
    const currentIncomingLines = __privateGet(this, _incomingLines).filter(
      (i) => !i._requestDelete
    );
    if (prop.event.button != 0) {
      return;
    }
    this.inputEngine.resetDragMembers();
    if (currentIncomingLines.length > 0) {
      this.startPickUpLine(currentIncomingLines[0], prop);
      return;
    }
    if (__privateGet(this, _config2).allowDragOut) {
      console.debug("Starting drag out line");
      this.startDragOutLine(prop);
    }
  }
  deleteLine(i) {
    console.debug(`Deleting line ${this.gid} at index ${i}`);
    if (__privateGet(this, _outgoingLines).length == 0) {
      return null;
    }
    const line = __privateGet(this, _outgoingLines)[i];
    line.destroy();
    __privateGet(this, _outgoingLines).splice(i, 1);
    return line;
  }
  deleteAllLines() {
    for (const line of __privateGet(this, _outgoingLines)) {
      line.destroy();
    }
  }
  updateAllLines() {
    var _a;
    this.calculateTransformFromLocal();
    for (const line of [...__privateGet(this, _outgoingLines), ...__privateGet(this, _incomingLines)]) {
      (_a = line.target) == null ? void 0 : _a.calculateTransformFromLocal();
      line.calculateLocalFromTransform();
      line.moveLineToConnectorTransform();
      line.requestTransform("WRITE_2");
    }
  }
  assignToNode(parent) {
    this.parent = parent;
    parent.children.push(this);
    let parent_ref = this.parent;
    parent_ref._prop[__privateGet(this, _name)] = null;
    __privateSet(this, _prop, parent_ref._prop);
    parent_ref._connectors[__privateGet(this, _name)] = this;
    __privateSet(this, _outgoingLines, []);
    __privateSet(this, _incomingLines, []);
    if (parent_ref.global && this.global == null) {
      this.global = parent_ref.global;
    }
  }
  createLine() {
    let line;
    if (__privateGet(this, _config2).lineClass) {
      line = new (__privateGet(this, _config2)).lineClass(this.global, this);
    } else {
      line = new LineComponent(this.global, this);
    }
    this.children.push(line);
    return line;
  }
  startDragOutLine(prop) {
    let newLine = this.createLine();
    newLine.setLineEnd(prop.position.x, prop.position.y);
    newLine.setLineStartAtConnector();
    __privateGet(this, _outgoingLines).unshift(newLine);
    this.parent.updateNodeLines();
    this.parent.updateNodeLineList();
    __privateSet(this, _state, 1);
    __privateSet(this, _targetConnector, null);
    this.event.input.drag = this.runDragOutLine;
    this.event.input.dragEnd = this.endDragOutLine;
    __privateGet(this, _mouseHitBox).event.collider.onCollide = (_, __) => {
      this.findClosestConnector();
    };
    __privateGet(this, _mouseHitBox).event.collider.onEndContact = (_, otherObject) => {
      var _a;
      if (((_a = __privateGet(this, _targetConnector)) == null ? void 0 : _a.gid) == otherObject.parent.gid) {
        __privateSet(this, _targetConnector, null);
      }
    };
    this.runDragOutLine({
      position: prop.position,
      start: {
        x: this.transform.x,
        y: this.transform.y
      },
      delta: {
        x: prop.position.x - this.transform.x,
        y: prop.position.y - this.transform.y
      }
    });
  }
  findClosestConnector() {
    let connectorCollider = Array.from(
      __privateGet(this, _mouseHitBox)._currentCollisions
    ).filter((c) => c.parent instanceof _ConnectorComponent);
    let connectors = connectorCollider.map((c) => c.parent).sort((a, b) => {
      const centerA = a.center;
      const centerB = b.center;
      let da = Math.sqrt(
        Math.pow(centerA.x - __privateGet(this, _mouseHitBox).transform.x, 2) + Math.pow(centerA.y - __privateGet(this, _mouseHitBox).transform.y, 2)
      );
      let db = Math.sqrt(
        Math.pow(centerB.x - __privateGet(this, _mouseHitBox).transform.x, 2) + Math.pow(centerB.y - __privateGet(this, _mouseHitBox).transform.y, 2)
      );
      return da - db;
    });
    if (connectors.length > 0) {
      __privateSet(this, _targetConnector, connectors[0]);
    } else {
      __privateSet(this, _targetConnector, null);
    }
  }
  runDragOutLine(prop) {
    console.debug(`Running drag out line ${this.gid}`);
    if (__privateGet(this, _state) != 1) {
      return;
    }
    if (__privateGet(this, _outgoingLines).length == 0) {
      console.error(`Error: Outgoing lines is empty`);
      return;
    }
    __privateGet(this, _mouseHitBox).transform.x = prop.position.x - this.transform.x;
    __privateGet(this, _mouseHitBox).transform.y = prop.position.y - this.transform.y;
    let line = __privateGet(this, _outgoingLines)[0];
    if (__privateGet(this, _targetConnector)) {
      const result = this.hoverWhileDragging(__privateGet(this, _targetConnector));
      if (result) {
        line.setLineEnd(result[0], result[1]);
        line.setLineStartAtConnector();
        line.requestTransform("WRITE_2");
        return;
      }
    }
    line.setLineEnd(prop.position.x, prop.position.y);
    line.setLineStartAtConnector();
    this.parent.updateNodeLines();
  }
  hoverWhileDragging(targetConnector) {
    if (!(targetConnector instanceof _ConnectorComponent)) {
      return;
    }
    if (targetConnector == null) {
      console.debug(`Error: targetConnector is null`);
      return;
    }
    if (targetConnector.gid == this.gid) {
      return;
    }
    const connectorCenter = targetConnector.center;
    return [connectorCenter.x, connectorCenter.y];
  }
  endDragOutLine(_) {
    console.debug(`Ending drag out line ${this.gid}`);
    this.inputEngine.resetDragMembers();
    if (__privateGet(this, _targetConnector) && __privateGet(this, _targetConnector) instanceof _ConnectorComponent) {
      console.debug(`Connecting ${this.gid} to ${__privateGet(this, _targetConnector).gid}`);
      const target = __privateGet(this, _targetConnector);
      if (target == null) {
        console.error(`Error: target is null`);
        this._endLineDragCleanup();
        return;
      }
      if (this.connectToConnector(target, __privateGet(this, _outgoingLines)[0]) == false) {
        this._endLineDragCleanup();
        this.deleteLine(0);
        return;
      }
      __privateGet(target, _prop)[__privateGet(target, _name)] = __privateGet(this, _prop)[__privateGet(this, _name)];
      __privateGet(this, _outgoingLines)[0].setLineEnd(target.transform.x, target.transform.y);
    } else {
      console.debug(`Deleting line ${this.gid} at index 0`);
      this.deleteLine(0);
    }
    if (this.parent) {
      this.parent.updateNodeLines();
    }
    this._endLineDragCleanup();
  }
  _endLineDragCleanup() {
    __privateSet(this, _state, 0);
    this.event.global.pointerMove = null;
    this.event.global.pointerUp = null;
    this.parent.updateNodeLineList();
    __privateSet(this, _targetConnector, null);
    __privateGet(this, _mouseHitBox).event.collider.onBeginContact = null;
    __privateGet(this, _mouseHitBox).event.collider.onEndContact = null;
    __privateGet(this, _mouseHitBox).transform.x = 0;
    __privateGet(this, _mouseHitBox).transform.y = 0;
  }
  startPickUpLine(line, prop) {
    line.start.disconnectFromConnector(this);
    this.disconnectFromConnector(line.start);
    line.start.deleteLine(line.start.outgoingLines.indexOf(line));
    this.inputEngine.resetDragMembers();
    this.inputEngine.addDragMember(line.start.inputEngine);
    line.start.targetConnector = this;
    line.start.startDragOutLine(prop);
    __privateSet(this, _state, 1);
  }
  connectToConnector(connector, line) {
    var _a, _b, _c, _d;
    console.debug(`Connecting ${this.gid} to connector ${connector.gid}`);
    const currentIncomingLines = connector.incomingLines.filter(
      (i) => !i._requestDelete
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
      __privateGet(this, _outgoingLines).unshift(line);
    }
    this.calculateLocalFromTransform();
    line.target = connector;
    connector.incomingLines.push(line);
    this.parent.updateNodeLineList();
    (_b = (_a = __privateGet(this, _connectorCallback)) == null ? void 0 : _a.onConnectOutgoing) == null ? void 0 : _b.call(_a, connector);
    (_d = (_c = __privateGet(connector, _connectorCallback)) == null ? void 0 : _c.onConnectIncoming) == null ? void 0 : _d.call(_c, this);
    this.parent.setProp(__privateGet(this, _name), __privateGet(this, _prop)[__privateGet(this, _name)]);
    return true;
  }
  disconnectFromConnector(connector) {
    var _a, _b, _c, _d;
    console.debug(`Disconnecting ${this.gid} from connector ${connector.gid}`);
    for (const line of __privateGet(this, _outgoingLines)) {
      if (line.target == connector) {
        line._requestDelete = true;
        break;
      }
    }
    (_b = (_a = __privateGet(this, _connectorCallback)) == null ? void 0 : _a.onDisconnectOutgoing) == null ? void 0 : _b.call(_a, connector);
    (_d = (_c = __privateGet(connector, _connectorCallback)) == null ? void 0 : _c.onDisconnectIncoming) == null ? void 0 : _d.call(_c, this);
  }
};
_config2 = new WeakMap();
_name = new WeakMap();
_prop = new WeakMap();
_outgoingLines = new WeakMap();
_incomingLines = new WeakMap();
_state = new WeakMap();
_hitCircle = new WeakMap();
_mouseHitBox = new WeakMap();
_targetConnector = new WeakMap();
_connectorCallback = new WeakMap();
let ConnectorComponent = _ConnectorComponent;
class NodeComponent extends ElementObject {
  constructor(global, parent, config = {}) {
    super(global, parent);
    __publicField(this, "_config");
    __publicField(this, "_connectors");
    __publicField(this, "_components");
    __publicField(this, "_nodeWidth", 0);
    __publicField(this, "_nodeHeight", 0);
    __publicField(this, "_dragStartX", 0);
    __publicField(this, "_dragStartY", 0);
    __publicField(this, "_prop");
    __publicField(this, "_propSetCallback");
    __publicField(this, "_nodeStyle");
    __publicField(this, "_lineListCallback");
    __publicField(this, "_hitBox");
    __publicField(this, "_selected");
    __publicField(this, "_mouseDownX");
    __publicField(this, "_mouseDownY");
    __publicField(this, "_hasMoved");
    this._config = config;
    this._connectors = {};
    this._components = {};
    this._dragStartX = this.transform.x;
    this._dragStartY = this.transform.y;
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._prop = {};
    this._propSetCallback = {};
    this._lineListCallback = null;
    this.transformMode = "direct";
    this.event.input.pointerDown = this.onCursorDown;
    this.event.input.dragStart = this.onDragStart;
    this.event.input.drag = this.onDrag;
    this.event.input.dragEnd = this.onDragEnd;
    this.event.input.pointerUp = this.onUp;
    this._hitBox = new RectCollider(this.global, this, 0, 0, 0, 0);
    this.addCollider(this._hitBox);
    this._selected = false;
    this._hasMoved = false;
    this.event.dom.onResize = () => {
      this.queueUpdate("READ_1", () => {
        this.readDom(false, "READ_1");
        for (const connector of Object.values(this._connectors)) {
          connector.readDom(false, "READ_1");
          connector.calculateLocalFromDom("READ_1");
          connector.calculateTransformFromLocal();
        }
      });
      for (const line of [
        ...this.getAllOutgoingLines(),
        ...this.getAllIncomingLines()
      ]) {
        line.queueUpdate("WRITE_1", () => {
          line.moveLineToConnectorTransform();
          line.setLineEndAtConnector();
          line.writeDom();
          line.writeTransform();
        });
      }
    };
    this.style = {
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left"
    };
    this.event.dom.onAssignDom = () => {
      this._hitBox.element = this.element;
    };
  }
  setStartPositions() {
    this._dragStartX = this.transform.x;
    this._dragStartY = this.transform.y;
  }
  setSelected(selected) {
    this._selected = selected;
    this.dataAttribute = {
      selected
    };
    if (selected) {
      this.global.data.select.push(this);
    } else {
      this.classList = this.classList.filter(
        (className) => className !== "selected"
      );
      this.global.data.select = this.global.data.select.filter(
        (node) => node.gid !== this.gid
      );
    }
    this.requestWrite();
  }
  _filterDeletedLines(svgLines) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i]._requestDelete) {
        svgLines.splice(i, 1);
        i--;
      }
    }
  }
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
  setLineListCallback(callback) {
    this._lineListCallback = callback;
  }
  onCursorDown(e) {
    var _a;
    if (e.event.button != 0) {
      return;
    }
    if (((_a = this.global.data.select) == null ? void 0 : _a.includes(this)) == false) {
      for (const node of this.global.data.select) {
        node.setSelected(false);
      }
      this.setSelected(true);
    }
  }
  onDragStart(prop) {
    for (const node of this.global.data.select ?? []) {
      node.setStartPositions();
      node._mouseDownX = prop.start.x;
      node._mouseDownY = prop.start.y;
    }
    this._hasMoved = true;
  }
  onDrag(prop) {
    if (this.global == null) {
      console.error("Global stats is null");
      return;
    }
    if (this._config.lockPosition) return;
    for (const node of this.global.data.select ?? []) {
      node.setDragPosition(prop);
    }
  }
  setDragPosition(prop) {
    const dx = prop.position.x - this._mouseDownX;
    const dy = prop.position.y - this._mouseDownY;
    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    this.updateNodeLines();
    this.requestTransform("WRITE_2");
  }
  onDragEnd(prop) {
    for (const node of this.global.data.select ?? []) {
      node.setUpPosition(prop);
    }
  }
  setUpPosition(prop) {
    const [dx, dy] = [
      prop.end.x - this._mouseDownX,
      prop.end.y - this._mouseDownY
    ];
    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    this.updateNodeLines();
  }
  onUp(prop) {
    if (this._hasMoved == false) {
      for (const node of this.global.data.select ?? []) {
        node.setSelected(false);
      }
      this.setSelected(true);
      return;
    }
  }
  getConnector(name) {
    if (!(name in this._connectors)) {
      console.error(`Connector ${name} does not exist in node ${this.gid}`);
      return null;
    }
    return this._connectors[name];
  }
  addConnectorObject(connector) {
    connector.assignToNode(this);
  }
  addSetPropCallback(callback, name) {
    this._propSetCallback[name] = callback;
  }
  getAllOutgoingLines() {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.outgoingLines
    );
  }
  getAllIncomingLines() {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.incomingLines
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
    const peers = this._connectors[name].outgoingLines.filter((line) => line.target && !line._requestDelete).map((line) => line.target);
    if (!peers) {
      return;
    }
    for (const peer of peers) {
      if (!peer) continue;
      if (!peer.parent) continue;
      let parent = peer.parent;
      parent.setProp(peer.name, value);
    }
  }
  propagateProp() {
    for (const connector of Object.values(this._connectors)) {
      this.setProp(connector.name, this.getProp(connector.name));
    }
  }
}
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
    this.event.global.pointerDown = this.onGlobalCursorDown;
    this.event.global.pointerMove = this.onGlobalCursorMove;
    this.event.global.pointerUp = this.onGlobalCursorUp;
    this._selectHitBox = new RectCollider(globals, this, 0, 0, 0, 0);
    this._selectHitBox.transform.x = 0;
    this._selectHitBox.transform.y = 0;
    this._selectHitBox.event.collider.onCollide = this.onCollideNode;
    this.addCollider(this._selectHitBox);
    this.global.data.select = [];
    this.style = {
      width: "0px",
      height: "0px",
      transformOrigin: "top left",
      position: "absolute",
      left: "0px",
      top: "0px",
      pointerEvents: "none"
    };
    this.requestWrite();
  }
  onGlobalCursorDown(prop) {
    if (prop.event.button !== 0 || prop.event.target && prop.event.target.id !== "sl-background") {
      return;
    }
    for (let node of this.global.data.select) {
      node.setSelected(false);
    }
    this.global.data.select = [];
    this.worldPosition = [prop.position.x, prop.position.y];
    this._selectHitBox.recalculate();
    this._state = "dragging";
    this.style = {
      display: "block",
      width: "0px",
      height: "0px"
    };
    this._mouseDownX = prop.position.x;
    this._mouseDownY = prop.position.y;
    this._selectHitBox.event.collider.onBeginContact = (_, otherObject) => {
      if (otherObject.parent instanceof NodeComponent) {
        let node = otherObject.parent;
        node.setSelected(true);
      }
    };
    this._selectHitBox.event.collider.onEndContact = (thisObject, otherObject) => {
      console.debug("onEndContact", thisObject, otherObject);
      if (otherObject.parent instanceof NodeComponent) {
        let node = otherObject.parent;
        node.setSelected(false);
      }
    };
  }
  onGlobalCursorMove(prop) {
    if (this._state === "dragging") {
      let [boxOriginX, boxOriginY] = [
        Math.min(this._mouseDownX, prop.position.x),
        Math.min(this._mouseDownY, prop.position.y)
      ];
      let [boxWidth, boxHeight] = [
        Math.abs(prop.position.x - this._mouseDownX),
        Math.abs(prop.position.y - this._mouseDownY)
      ];
      this.style = {
        width: `${boxWidth}px`,
        height: `${boxHeight}px`
      };
      this.worldPosition = [boxOriginX, boxOriginY];
      this._selectHitBox.transform.x = this.transform.x - boxOriginX;
      this._selectHitBox.transform.y = this.transform.y - boxOriginY;
      this._selectHitBox.transform.width = boxWidth;
      this._selectHitBox.transform.height = boxHeight;
      this.requestTransform();
    }
  }
  onGlobalCursorUp(prop) {
    this.style = {
      display: "none"
    };
    this._state = "none";
    this._selectHitBox.event.collider.onBeginContact = null;
    this._selectHitBox.event.collider.onEndContact = null;
    this.requestTransform();
  }
  onCollideNode(hitBox, node) {
  }
}
class Background extends ElementObject {
  constructor(globals, parent) {
    super(globals, parent);
    __publicField(this, "_tileSize", 40);
    this.event.global.pointerMove = this.moveBackground;
    this.dom.style = {
      position: "absolute",
      top: "0",
      left: "0",
      backgroundSize: `${this._tileSize}px ${this._tileSize}px`
    };
    this.moveBackground();
  }
  moveBackground(_) {
    var _a, _b, _c, _d;
    let x = (_a = this.global.camera) == null ? void 0 : _a.cameraPositionX;
    let y = (_b = this.global.camera) == null ? void 0 : _b.cameraPositionY;
    let width = ((_c = this.global.camera) == null ? void 0 : _c.cameraWidth) * 5;
    let height = ((_d = this.global.camera) == null ? void 0 : _d.cameraHeight) * 5;
    this.worldPosition = [
      Math.floor(x / this._tileSize) * this._tileSize - width / 2,
      Math.floor(y / this._tileSize) * this._tileSize - height / 2
    ];
    this.dom.style = {
      width: `${width}px`,
      height: `${height}px`
    };
    this.requestPostWrite();
  }
}
class CameraControl extends ElementObject {
  constructor(globals, zoomLock = false, panLock = false) {
    super(globals, null);
    __publicField(this, "_state", "idle");
    __publicField(this, "_mouseDownX");
    __publicField(this, "_mouseDownY");
    // _canvasElement: HTMLElement | null = null;
    __publicField(this, "zoomLock");
    __publicField(this, "panLock");
    __publicField(this, "resizeObserver", null);
    __privateAdd(this, _prevCenterX, 0);
    __privateAdd(this, _prevCenterY, 0);
    this.zoomLock = zoomLock;
    this.panLock = panLock;
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._state = "idle";
    this.event.global.pointerDown = this.onCursorDown;
    this.event.global.pointerMove = this.onCursorMove;
    this.event.global.pointerUp = this.onCursorUp;
    this.event.global.mouseWheel = this.onZoom;
    this.transformMode = "direct";
    this.style = {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px"
    };
    this.requestTransform("WRITE_2");
    this.resizeObserver = null;
    __privateSet(this, _prevCenterX, 0);
    __privateSet(this, _prevCenterY, 0);
    this.global.snapline.event.containerElementAssigned = () => {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateCameraCenterPosition(__privateGet(this, _prevCenterX), __privateGet(this, _prevCenterY));
        this.paintCamera();
      });
      this.resizeObserver.observe(this.global.containerElement);
      this.resizeObserver.observe(window.document.body);
    };
  }
  paintCamera() {
    var _a, _b, _c;
    (_a = this.global.camera) == null ? void 0 : _a.updateCameraProperty();
    (_b = this.global.camera) == null ? void 0 : _b.updateCamera();
    this.style.transform = (_c = this.global.camera) == null ? void 0 : _c.canvasStyle;
    this.requestTransform("WRITE_2");
  }
  updateCameraCenterPosition(x = 0, y = 0) {
    var _a, _b;
    (_a = this.global.camera) == null ? void 0 : _a.setCameraCenterPosition(x, y);
    const prev = (_b = this.global.camera) == null ? void 0 : _b.getCameraCenterPosition();
    __privateSet(this, _prevCenterX, (prev == null ? void 0 : prev.x) || 0);
    __privateSet(this, _prevCenterY, (prev == null ? void 0 : prev.y) || 0);
    this.paintCamera();
  }
  setCameraPosition(x, y) {
    var _a;
    (_a = this.global.camera) == null ? void 0 : _a.setCameraPosition(x, y);
    this.paintCamera();
  }
  setCameraCenterPosition(x, y) {
    var _a;
    (_a = this.global.camera) == null ? void 0 : _a.setCameraCenterPosition(x, y);
    this.paintCamera();
  }
  getCameraCenterPosition() {
    var _a;
    return ((_a = this.global.camera) == null ? void 0 : _a.getCameraCenterPosition()) || { x: 0, y: 0 };
  }
  onCursorDown(prop) {
    var _a;
    if (prop.event.button != 1) {
      return;
    }
    if (this.panLock) {
      return;
    }
    this._state = "panning";
    this._mouseDownX = prop.position.screenX;
    this._mouseDownY = prop.position.screenY;
    (_a = this.global.camera) == null ? void 0 : _a.handlePanStart();
    prop.event.preventDefault();
  }
  onCursorMove(prop) {
    var _a, _b;
    if (this._state != "panning") {
      return;
    }
    const dx = prop.position.screenX - this._mouseDownX;
    const dy = prop.position.screenY - this._mouseDownY;
    (_a = this.global.camera) == null ? void 0 : _a.handlePanDrag(dx, dy);
    this.style.transform = (_b = this.global.camera) == null ? void 0 : _b.canvasStyle;
    this.requestTransform("WRITE_2");
  }
  onCursorUp(prop) {
    var _a, _b, _c;
    if (this._state != "panning") {
      return;
    }
    this._state = "idle";
    (_a = this.global.camera) == null ? void 0 : _a.handlePanEnd();
    this.style.transform = (_b = this.global.camera) == null ? void 0 : _b.canvasStyle;
    const prev = (_c = this.global.camera) == null ? void 0 : _c.getCameraCenterPosition();
    __privateSet(this, _prevCenterX, (prev == null ? void 0 : prev.x) || 0);
    __privateSet(this, _prevCenterY, (prev == null ? void 0 : prev.y) || 0);
    this.requestTransform("WRITE_2");
  }
  onZoom(prop) {
    var _a, _b;
    if (this.zoomLock) {
      return;
    }
    let camera = this.global.camera;
    if (prop.position.screenX < camera.containerOffsetX || prop.position.screenX > camera.containerOffsetX + camera.cameraWidth || prop.position.screenY < camera.containerOffsetY || prop.position.screenY > camera.containerOffsetY + camera.cameraHeight) {
      return;
    }
    (_a = this.global.camera) == null ? void 0 : _a.handleScroll(
      prop.delta / 2e3,
      prop.position.cameraX,
      prop.position.cameraY
    );
    this.style.transform = (_b = this.global.camera) == null ? void 0 : _b.canvasStyle;
    this.requestTransform("WRITE_2");
    prop.event.preventDefault();
  }
}
_prevCenterX = new WeakMap();
_prevCenterY = new WeakMap();
export {
  Background,
  BaseObject,
  CameraControl,
  ConnectorComponent,
  ElementObject,
  GlobalManager,
  LineComponent,
  NodeComponent,
  RectSelectComponent,
  SnapLine
};
