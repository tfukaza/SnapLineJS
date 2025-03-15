import { CameraConfig, SnapLineConfig } from "./types";
import {
  cursorDownProp,
  cursorMoveProp,
  cursorScrollProp,
  cursorUpProp,
} from "./input";
import Camera from "./camera";
import { InputControl } from "./input";
import { CollisionEngine } from "./collision";
import { GlobalManager } from "./global";
import { BaseObject, DomEvent } from "./components/object";
// import "./theme/standard_light.scss";
import { CameraControl } from "./components/cameraControl";

/**
 * SnapLine class manages all the global states for the library.
 */
class SnapLine {
  snaplineConfig: SnapLineConfig;
  cameraConfig: CameraConfig;
  _containerStyle: { [key: string]: string } = {};
  _cameraControl: CameraControl | null = null;

  global: GlobalManager;

  _cursorDownCallbacks: Record<string, (prop: cursorDownProp) => void> = {};
  _cursorMoveCallbacks: Record<string, (prop: cursorMoveProp) => void> = {};
  _cursorUpCallbacks: Record<string, (prop: cursorUpProp) => void> = {};
  _cursorScrollCallbacks: Record<string, (prop: cursorScrollProp) => void> = {};

  _collisionEngine: CollisionEngine | null = null;

  event: DomEvent;

  /**
   * Constructor for SnapLine class.
   */
  constructor(config: SnapLineConfig = {}) {
    this.global = new GlobalManager();
    this.global.snapline = this;
    let defaultConfig: SnapLineConfig = {
      cameraConfig: {
        enableZoom: true,
        enablePan: true,
        panBounds: { top: null, left: null, right: null, bottom: null },
      },
    };
    this.snaplineConfig = {
      ...defaultConfig,
      ...config,
    };
    this.cameraConfig = {
      ...defaultConfig.cameraConfig,
      ...config.cameraConfig,
    };

    this._containerStyle = {
      position: "relative",
      overflow: "hidden",
    };
    this.event = {
      onCursorDown: this._onCursorDownGlobal.bind(this),
      onCursorMove: this._onCursorMoveGlobal.bind(this),
      onCursorUp: this._onCursorUpGlobal.bind(this),
      onCursorScroll: this._onZoomGlobal.bind(this),
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
  assignDom(containerDom: HTMLElement) {
    this.global.containerElement = containerDom;
    this.global.camera = new Camera(containerDom, this.cameraConfig);

    this.global.inputEngine = new InputControl(this.global);
    this.global.inputEngine.addCursorEventListener(
      document as unknown as HTMLElement,
    );
    this.global.inputEngine.event.mouseDownCallback =
      this._onCursorDownGlobal.bind(this);
    this.global.inputEngine.event.mouseMoveCallback =
      this._onCursorMoveGlobal.bind(this);
    this.global.inputEngine.event.mouseUpCallback =
      this._onCursorUpGlobal.bind(this);
    this.global.inputEngine.event.mouseWheelCallback =
      this._onZoomGlobal.bind(this);

    window.requestAnimationFrame(this.#step.bind(this));
  }
  assignCameraControl(canvasElement: HTMLElement) {
    this._cameraControl = new CameraControl(this.global);
    this._cameraControl.assignCanvas(canvasElement);
  }
  // ============== Private functions ==============

  /**
   * Main loop for rendering the canvas.
   */
  #step(): void {
    this._renderElements();
    window.requestAnimationFrame(this.#step.bind(this));
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
  _onCursorDownGlobal(prop: cursorDownProp) {
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
  _onCursorMoveGlobal(prop: cursorMoveProp) {
    this.global.cursor = {
      worldX: prop.worldX,
      worldY: prop.worldY,
      cameraX: prop.cameraX,
      cameraY: prop.cameraY,
      screenX: prop.screenX,
      screenY: prop.screenY,
    };
    for (const [id, callback] of Object.entries(this._cursorMoveCallbacks)) {
      // Don't call the callback if the element invoked the event
      // if (prop.gid == id) {
      //   continue;
      // }
      callback(prop);
    }
    prop.event.preventDefault();
  }

  /**
   * Event handler when mouse or touchscreen is released.
   * @returns
   */
  _onCursorUpGlobal(prop: cursorUpProp) {
    for (const [id, callback] of Object.entries(this._cursorUpCallbacks)) {
      callback(prop);
    }
  }

  /**
   * Event handler for mouse scroll events.
   * @param deltaY: The amount the user scrolled.
   */
  _onZoomGlobal(prop: cursorScrollProp) {
    for (const [id, callback] of Object.entries(this._cursorScrollCallbacks)) {
      // Don't call the callback if the element invoked the event
      if (prop.gid == id) {
        continue;
      }
      callback(prop);
    }
    // if (this.snaplineConfig?.cameraConfig?.enableZoom) {
    //   prop.event.preventDefault();
    // }
  }

  subscribeGlobalCursorEvent(
    event: "onCursorDown" | "onCursorMove" | "onCursorUp" | "onCursorScroll",
    gid: string,
    callback: (
      prop: cursorDownProp | cursorMoveProp | cursorUpProp | cursorScrollProp,
    ) => void,
  ) {
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

  unsubscribeGlobalCursorEvent(
    event: "onCursorDown" | "onCursorMove" | "onCursorUp" | "onCursorScroll",
    gid: string,
  ) {
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

  unsubscribeOnCursorDown(id: string) {
    console.debug(`unsubscribeOnCursorDown on ${id}`);
    delete this._cursorDownCallbacks[id];
    console.debug(this._cursorDownCallbacks);
  }

  subscribeOnCursorMove(id: string, callback: (prop: cursorMoveProp) => void) {
    console.debug(`subscribeOnCursorMove on ${id}, callback: ${callback.name}`);
    this._cursorMoveCallbacks[id] = callback;
  }

  unsubscribeOnCursorMove(id: string) {
    console.debug(`unsubscribeOnCursorMove on ${id}`);
    delete this._cursorMoveCallbacks[id];
  }

  subscribeOnCursorUp(id: string, callback: (prop: cursorUpProp) => void) {
    console.debug(`subscribeOnCursorUp on ${id}, callback: ${callback.name}`);
    this._cursorUpCallbacks[id] = callback;
  }

  unsubscribeOnCursorUp(id: string) {
    console.debug(`unsubscribeOnCursorUp on ${id}`);
    delete this._cursorUpCallbacks[id];
  }

  subscribeOnCursorScroll(
    id: string,
    callback: (prop: cursorScrollProp) => void,
  ) {
    this._cursorScrollCallbacks[id] = callback;
  }

  unsubscribeOnCursorScroll(id: string) {
    delete this._cursorScrollCallbacks[id];
  }

  /**
   * Renders elements currently in the canvas.
   * This function is used by Vanilla JS projects that do not have a reactive system to automatically update the DOM.
   */
  _renderElements(): void {
    // Render the elements
    for (const object of this.global.domRenderQueue) {
      object.render();
    }
    this.global.domRenderQueue = [];

    // Delete the elements
    for (const object of this.global.domDeleteQueue) {
      object.delete();
    }
    this.global.domDeleteQueue = [];

    // Get the results of the previous frame paint
    for (const object of this.global.domFetchQueue) {
      object.fetchProperty();
    }
    this.global.domFetchQueue = [];

    // Paint the elements
    for (const object of this.global.domPaintQueue) {
      object.paint();
    }
    this.global.domPaintQueue = [];

    // Detect collisions
    this.global.collisionEngine?.detectCollisions();
  }

  addObject(object: BaseObject) {
    object.submitRenderQueue();
  }
}

export { SnapLine };
