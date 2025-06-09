import Camera from "./camera";
import { CollisionEngine } from "./collision";
import { GlobalManager } from "./global";
import { BaseObject, ElementObject, frameStats, queueEntry } from "./object";
// import { CameraControl } from "@/asset/node_ui/cameraControl";
import { AnimationObject, SequenceObject } from "./animation";
import { EventProxyFactory } from "./util";

export interface SnapLineConfig {}

export interface engineCallback {
  containerElementAssigned: ((containerElement: HTMLElement) => void) | null;
}

class SnapLine {
  snaplineConfig: SnapLineConfig;
  #containerStyle: { [key: string]: string } = {};
  global: GlobalManager;
  _collisionEngine: CollisionEngine | null = null;
  _event: engineCallback;
  event: engineCallback;
  debug: boolean = false;
  debugWindow: HTMLCanvasElement | null = null;
  debugCtx: CanvasRenderingContext2D | null = null;
  #resizeObserver: ResizeObserver | null = null;

  constructor(config: SnapLineConfig = {}) {
    this.global = new GlobalManager();
    this.global.read1Queue = {};
    this.global.write1Queue = {};
    this.global.read2Queue = {};
    this.global.write2Queue = {};
    this.global.read3Queue = {};
    this.global.write3Queue = {};
    this.global.animationList = [];
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

    this.#containerStyle = {
      position: "relative",
      overflow: "hidden",
    };

    this.global.collisionEngine = new CollisionEngine();

    this._event = {
      containerElementAssigned: null,
    };
    this.event = EventProxyFactory(this, this._event);

    this.debug = false;
    this.#resizeObserver = new ResizeObserver(() => {
      if (this.debug) {
        let containerRect =
          this.global.containerElement!.getBoundingClientRect();
        this.debugWindow!.width = containerRect.width;
        this.debugWindow!.height = containerRect.height;
      }
    });
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
    let containerRect = this.global.containerElement!.getBoundingClientRect();
    this.debugWindow.width = containerRect.width;
    this.debugWindow.height = containerRect.height;
    this.debugWindow.style.zIndex = "1000";
    this.debugWindow.style.pointerEvents = "none";
    this.global.containerElement!.appendChild(this.debugWindow);
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
  assignDom(containerDom: HTMLElement) {
    this.global.containerElement = containerDom;
    this.global.camera = new Camera(containerDom);
    this.event.containerElementAssigned?.(containerDom);
    this.#resizeObserver?.observe(containerDom);

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
    this.debugCtx.fillStyle = "white";
    this.debugCtx.fillText(object.gid, cameraX, cameraY + 10);

    // If object has a dom, draw a rectangle around the object's width and height, with a 1px black border
    if (object.hasOwnProperty("_dom")) {
      let elementObject = object as ElementObject;

      const colors = ["#FF0000A0", "#00FF00A0", "#0000FFA0"];
      const stages = ["READ_1", "READ_2", "READ_3"];
      for (let i = 0; i < 3; i++) {
        const property = elementObject.getDomProperty(stages[i] as any);
        this.debugCtx.stroke();
        this.debugCtx.beginPath();
        this.debugCtx.strokeStyle = colors[i];
        this.debugCtx.lineWidth = 1;
        const [domCameraX, domCameraY] = this.global.camera?.getCameraFromWorld(
          property.x,
          property.y,
        ) ?? [0, 0];
        this.debugCtx.rect(
          domCameraX,
          domCameraY,
          property.width,
          property.height,
        );
        this.debugCtx.stroke();
      }

      // Black rectangle represents the object's transform property
      this.debugCtx.beginPath();
      this.debugCtx.strokeStyle = "black";
      this.debugCtx.lineWidth = 1;
      this.debugCtx.rect(
        cameraX,
        cameraY,
        elementObject._dom.property.width,
        elementObject._dom.property.height,
      );
    }
  }

  renderDebugGrid() {
    if (this.debugCtx == null) {
      return;
    }

    const gridSize = 100; // Size of each grid cell in world coordinates
    const camera = this.global.camera;
    if (!camera) return;

    // Get the visible area in world coordinates
    const [worldLeft, worldTop] = camera.getWorldFromCamera(0, 0);
    const [worldRight, worldBottom] = camera.getWorldFromCamera(
      this.debugWindow!.width,
      this.debugWindow!.height,
    );

    // Calculate grid lines
    const startX = Math.floor(worldLeft / gridSize) * gridSize;
    const endX = Math.ceil(worldRight / gridSize) * gridSize;
    const startY = Math.floor(worldTop / gridSize) * gridSize;
    const endY = Math.ceil(worldBottom / gridSize) * gridSize;

    // Draw grid lines
    this.debugCtx.beginPath();
    this.debugCtx.strokeStyle = "rgba(200, 200, 200, 0.3)";
    this.debugCtx.lineWidth = 1;

    // Draw vertical grid lines
    for (let x = startX; x <= endX; x += gridSize) {
      const [screenX1, screenY1] = camera.getCameraFromWorld(x, worldTop);
      const [screenX2, screenY2] = camera.getCameraFromWorld(x, worldBottom);
      this.debugCtx.moveTo(screenX1, screenY1);
      this.debugCtx.lineTo(screenX2, screenY2);
    }

    // Draw horizontal grid lines
    for (let y = startY; y <= endY; y += gridSize) {
      const [screenX1, screenY1] = camera.getCameraFromWorld(worldLeft, y);
      const [screenX2, screenY2] = camera.getCameraFromWorld(worldRight, y);
      this.debugCtx.moveTo(screenX1, screenY1);
      this.debugCtx.lineTo(screenX2, screenY2);
    }

    this.debugCtx.stroke();

    // Draw X and Y axes
    this.debugCtx.beginPath();
    this.debugCtx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    this.debugCtx.lineWidth = 2;

    // Find the visible portion of the axes
    const xAxisVisible = startY <= 0 && endY >= 0;
    const yAxisVisible = startX <= 0 && endX >= 0;

    // X-axis
    if (xAxisVisible) {
      const [xAxisStartX, xAxisStartY] = camera.getCameraFromWorld(startX, 0);
      const [xAxisEndX, xAxisEndY] = camera.getCameraFromWorld(endX, 0);
      this.debugCtx.moveTo(xAxisStartX, xAxisStartY);
      this.debugCtx.lineTo(xAxisEndX, xAxisEndY);
    }

    // Y-axis
    if (yAxisVisible) {
      const [yAxisStartX, yAxisStartY] = camera.getCameraFromWorld(0, startY);
      const [yAxisEndX, yAxisEndY] = camera.getCameraFromWorld(0, endY);
      this.debugCtx.moveTo(yAxisStartX, yAxisStartY);
      this.debugCtx.lineTo(yAxisEndX, yAxisEndY);
    }

    this.debugCtx.stroke();

    // Draw coordinate labels
    this.debugCtx.fillStyle = "rgba(0, 0, 0, 0.8)";
    this.debugCtx.font = "12px Arial";
    this.debugCtx.textAlign = "center";

    // X-axis labels
    for (let x = startX; x <= endX; x += gridSize) {
      if (x === 0) continue; // Skip 0 as it's the origin
      const [screenX, screenY] = camera.getCameraFromWorld(x, 0);
      // Only draw label if it's within the visible area
      if (screenY >= 0 && screenY <= this.debugWindow!.height) {
        this.debugCtx.fillText(x.toString(), screenX, screenY + 20);
      }
    }

    // Y-axis labels
    for (let y = startY; y <= endY; y += gridSize) {
      if (y === 0) continue; // Skip 0 as it's the origin
      const [screenX, screenY] = camera.getCameraFromWorld(0, y);
      // Only draw label if it's within the visible area
      if (screenX >= 0 && screenX <= this.debugWindow!.width) {
        this.debugCtx.fillText(y.toString(), screenX - 20, screenY + 4);
      }
    }

    // Draw origin label if it's visible
    const [originX, originY] = camera.getCameraFromWorld(0, 0);
    if (
      originX >= 0 &&
      originX <= this.debugWindow!.width &&
      originY >= 0 &&
      originY <= this.debugWindow!.height
    ) {
      this.debugCtx.fillText("(0,0)", originX + 20, originY - 10);
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

    this.renderDebugGrid();

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

  /**
   * Main loop for rendering the canvas.
   */
  #step(): void {
    this._renderFrame();
    window.requestAnimationFrame(this.#step.bind(this));
  }

  #processQueue(stage: string, queue: Record<string, Map<string, queueEntry>>) {
    // Keep a set of all objects that have been processed
    let processedObjects: Set<BaseObject> = new Set();
    for (const queueEntry of Object.values(queue)) {
      for (const objectEntry of queueEntry.values()) {
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
              objectEntry.object.callback.afterRead1?.();
            } else if (stage == "READ_2") {
              objectEntry.object.callback.afterRead2?.();
            } else if (stage == "READ_3") {
              objectEntry.object.callback.afterRead3?.();
            } else if (stage == "WRITE_1") {
              objectEntry.object.callback.afterWrite1?.();
            } else if (stage == "WRITE_2") {
              objectEntry.object.callback.afterWrite2?.();
            } else if (stage == "WRITE_3") {
              objectEntry.object.callback.afterWrite3?.();
            }
          }
        }
      }
    }
  }

  _renderFrame(): void {
    let timestamp = Date.now();

    let stats: frameStats = {
      timestamp: timestamp,
    };

    this.global.currentStage = "READ_1";
    this.#processQueue("READ_1", this.global.read1Queue);
    this.global.read1Queue = {};

    this.global.currentStage = "WRITE_1";
    this.#processQueue("WRITE_1", this.global.write1Queue);
    this.global.write1Queue = {};

    this.global.currentStage = "READ_2";
    this.#processQueue("READ_2", this.global.read2Queue);
    this.global.read2Queue = {};

    this.global.currentStage = "WRITE_2";
    this.#processQueue("WRITE_2", this.global.write2Queue);
    this.global.write2Queue = {};

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

    this.global.currentStage = "READ_3";
    this.#processQueue("READ_3", this.global.read3Queue);
    this.global.read3Queue = {};

    this.global.currentStage = "WRITE_3";
    this.#processQueue("WRITE_3", this.global.write3Queue);
    this.global.write3Queue = {};

    this.global.currentStage = "IDLE";

    this.global.collisionEngine?.detectCollisions();

    this.renderDebugFrame(stats);
  }
}

export { SnapLine };
