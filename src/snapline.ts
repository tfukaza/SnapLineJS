import Camera from "./camera";
import { CollisionEngine } from "./collision";
import { GlobalManager } from "./global";
import { BaseObject, ElementObject, frameStats } from "./object";
// import { CameraControl } from "@/asset/node_ui/cameraControl";
import { AnimationObject, SequenceObject } from "./animation";
import { EventProxyFactory } from "./util";

export interface SnapLineConfig {}

export interface engineCallback {
  containerElementAssigned: ((containerElement: HTMLElement) => void) | null;
}

class SnapLine {
  snaplineConfig: SnapLineConfig;
  _containerStyle: { [key: string]: string } = {};
  // _cameraControl: CameraControl | null = null;

  global: GlobalManager;

  _collisionEngine: CollisionEngine | null = null;

  _event: engineCallback;
  event: engineCallback;

  debug: boolean = false;
  debugWindow: HTMLCanvasElement | null = null;
  debugCtx: CanvasRenderingContext2D | null = null;

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

    this._containerStyle = {
      position: "relative",
      overflow: "hidden",
    };

    this.global.collisionEngine = new CollisionEngine();

    this._event = {
      containerElementAssigned: null,
    };
    this.event = EventProxyFactory(this, this._event);

    this.debug = true;
  }

  /**
   * Initialize global stats, dom elements, and event listeners for the library.
   * @param containerDom: The element that contains all other elements.
   */
  assignDom(containerDom: HTMLElement) {
    this.global.containerElement = containerDom;
    this.global.camera = new Camera(containerDom);
    this.event.containerElementAssigned?.(containerDom);

    if (this.debug) {
      this.debugWindow = document.createElement("canvas");
      this.debugWindow.style.position = "absolute";
      this.debugWindow.style.top = "0";
      this.debugWindow.style.left = "0";
      let containerRect = containerDom.getBoundingClientRect();
      this.debugWindow.width = containerRect.width;
      this.debugWindow.height = containerRect.height;
      this.debugWindow.style.zIndex = "1000";
      // Ignore all pointer events
      this.debugWindow.style.pointerEvents = "none";
      containerDom.appendChild(this.debugWindow);
      this.debugCtx = this.debugWindow.getContext("2d");
    }

    window.requestAnimationFrame(this.#step.bind(this));
  }

  debugObjectBoundingBox(object: BaseObject) {
    if (this.debugCtx == null) {
      return;
    }
    // Draw a small box at the object's world position, with the object's GID as the text
    this.debugCtx.beginPath();
    this.debugCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
    const [cameraX, cameraY] = this.global.camera?.getCameraFromWorld(
      ...object.worldPosition,
    ) ?? [0, 0];
    this.debugCtx.rect(cameraX, cameraY, 20, 20);
    this.debugCtx.fill();
    // text color is white
    this.debugCtx.fillStyle = "white";
    this.debugCtx.fillText(object.gid, cameraX, cameraY + 10);
    // If object has a dom, draw a rectangle around the object's width and height, with a 1px black border
    if (object.hasOwnProperty("_dom")) {
      let elementObject = object as ElementObject;
      // Draw a rectangle around the object's width and height, with a 1px black border
      this.debugCtx.beginPath();
      this.debugCtx.strokeStyle = "black";
      this.debugCtx.lineWidth = 1;
      this.debugCtx.rect(
        cameraX,
        cameraY,
        elementObject.dom.property.width,
        elementObject.dom.property.height,
      );
      this.debugCtx.stroke();
      // Draw a 1px blue box around the dom position and size
      this.debugCtx.beginPath();
      this.debugCtx.strokeStyle = "blue";
      this.debugCtx.lineWidth = 1;
      const [domCameraX, domCameraY] = this.global.camera?.getCameraFromWorld(
        elementObject.dom.property.x,
        elementObject.dom.property.y,
      ) ?? [0, 0];
      this.debugCtx.rect(
        domCameraX,
        domCameraY,
        elementObject.dom.property.width,
        elementObject.dom.property.height,
      );
      this.debugCtx.stroke();
    }
  }

  renderDebugFrame(stats: frameStats) {
    if (this.debugWindow == null) {
      return;
    }
    this.debugCtx?.clearRect(
      0,
      0,
      this.debugWindow.width,
      this.debugWindow.height,
    );

    for (const object of Object.values(this.global.objectTable)) {
      this.debugObjectBoundingBox(object);
    }

    if (this.debugCtx == null) {
      return;
    }
    for (const marker of Object.values(this.global.debugMarkerList)) {
      const [cameraX, cameraY] = this.global.camera?.getCameraFromWorld(
        marker.x,
        marker.y,
      ) ?? [0, 0];
      if (marker.type == "point") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.arc(marker.x, marker.y, 5, 0, 2 * Math.PI);
        this.debugCtx.fill();
      } else if (marker.type == "rect") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.rect(cameraX, cameraY, marker.width!, marker.height!);
        this.debugCtx.fill();
      } else if (marker.type == "circle") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.arc(cameraX, cameraY, marker.radius!, 0, 2 * Math.PI);
        this.debugCtx.fill();
      } else if (marker.type == "text") {
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.fillText(marker.text!, cameraX, cameraY);
      }
    }

    for (const id in this.global.debugMarkerList) {
      if (!this.global.debugMarkerList[id].persistent) {
        delete this.global.debugMarkerList[id];
      }
    }
  }

  // assignCameraControl(canvasElement: HTMLElement) {
  //   this._cameraControl = new CameraControl(this.global);
  //   this._cameraControl.assignCanvas(canvasElement);
  // }

  /**
   * Main loop for rendering the canvas.
   */
  #step(): void {
    this._renderFrame();
    window.requestAnimationFrame(this.#step.bind(this));
  }

  _renderFrame(): void {
    let timestamp = Date.now();

    let stats: frameStats = {
      timestamp: timestamp,
    };

    this.global.currentStage = "preRead";
    for (const entry of Object.values(this.global.preReadQueue)) {
      entry.object.preRead(stats, entry);
    }
    this.global.preReadQueue = {};

    this.global.currentStage = "write";
    for (const entry of Object.values(this.global.writeQueue)) {
      entry.object.write(stats, entry);
    }
    this.global.writeQueue = {};

    this.global.currentStage = "read";
    for (const entry of Object.values(this.global.readQueue)) {
      entry.object.read(stats, entry);
    }
    this.global.readQueue = {};

    this.global.currentStage = "adjust";
    let newAnimationList: (AnimationObject | SequenceObject)[] = [];
    for (const animation of this.global.animationList) {
      if (
        animation.calculateFrame(stats.timestamp) == false &&
        animation.requestDelete == false
      ) {
        newAnimationList.push(animation);
      }
    }
    this.global.animationList = newAnimationList;

    for (const entry of Object.values(this.global.postWriteQueue)) {
      entry.object.postWrite(stats, entry);
    }
    this.global.postWriteQueue = {};

    this.global.currentStage = "idle";

    this.global.collisionEngine?.detectCollisions();

    this.renderDebugFrame(stats);
  }

  addObject(object: BaseObject) {
    object.requestWrite();
  }
}

export { SnapLine };
