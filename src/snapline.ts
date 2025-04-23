import Camera from "./camera";
import { CollisionEngine } from "./collision";
import { GlobalManager } from "./global";
import { BaseObject, frameStats } from "./object";
// import { CameraControl } from "@/asset/node_ui/cameraControl";
import { AnimationObject, TimelineObject } from "./animation";

export interface SnapLineConfig {}

class SnapLine {
  snaplineConfig: SnapLineConfig;
  _containerStyle: { [key: string]: string } = {};
  // _cameraControl: CameraControl | null = null;

  global: GlobalManager;

  _collisionEngine: CollisionEngine | null = null;

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
  }

  /**
   * Initialize global stats, dom elements, and event listeners for the library.
   * @param containerDom: The element that contains all other elements.
   */
  assignDom(containerDom: HTMLElement) {
    this.global.containerElement = containerDom;
    this.global.camera = new Camera(containerDom);

    window.requestAnimationFrame(this.#step.bind(this));
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
    let newAnimationList: (AnimationObject | TimelineObject)[] = [];
    for (const animation of this.global.animationList) {
      if (animation.calculateFrame(stats.timestamp) == false) {
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
  }

  addObject(object: BaseObject) {
    object.requestWrite();
  }
}

export { SnapLine };
