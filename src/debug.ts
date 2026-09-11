import type { Engine } from "./engine";
import { ElementObject } from "./object";
import type { BaseObject, FrameStats } from "./object";

export interface DebugRendererInterface {
  enable(engine: Engine): void;
  disable(): void;
  renderFrame(
    stats: FrameStats,
    engine: any,
    objectTable: Record<string, BaseObject>,
  ): void;
  updateSize(width: number, height: number): void;
}

export class DebugRenderer implements DebugRendererInterface {
  debugWindow: HTMLCanvasElement | null = null;
  debugCtx: CanvasRenderingContext2D | null = null;
  #engine: Engine | null = null;
  #subscriptionId = "debugRenderer";
  enabledTags: Set<string> | null = null; // null = show all, Set = only show these tags

  isTagEnabled(tag: string | undefined): boolean {
    if (this.enabledTags === null) return true;
    if (tag === undefined) return true; // untagged markers always show
    return this.enabledTags.has(tag);
  }

  enable(engine: Engine): void {
    if (this.debugWindow) {
      return; // Already enabled
    }

    const containerElement = engine.containerElement;
    if (!containerElement) {
      return;
    }

    this.#engine = engine;

    this.debugWindow = document.createElement("canvas");
    this.debugWindow.style.position = "absolute";
    this.debugWindow.style.top = "0";
    this.debugWindow.style.left = "0";
    const containerRect = containerElement.getBoundingClientRect();
    this.debugWindow.width = containerRect.width;
    this.debugWindow.height = containerRect.height;
    this.debugWindow.style.zIndex = "1000";
    this.debugWindow.style.pointerEvents = "none";
    containerElement.appendChild(this.debugWindow);
    this.debugCtx = this.debugWindow.getContext("2d");

    // Subscribe to container resize events
    engine.subscribeEvent("containerResized", this.#subscriptionId, (props) => {
      this.updateSize(props.bounds.width, props.bounds.height);
    });
  }

  disable(): void {
    if (this.debugWindow) {
      this.debugWindow.remove();
      this.debugWindow = null;
      this.debugCtx = null;
    }

    // Unsubscribe from resize events
    if (this.#engine) {
      this.#engine.unsubscribeEvent("containerResized", this.#subscriptionId);
      this.#engine = null;
    }
  }

  updateSize(width: number, height: number): void {
    if (this.debugWindow) {
      this.debugWindow.width = width;
      this.debugWindow.height = height;
    }
  }

  renderFrame(
    _stats: FrameStats,
    engine: Engine,
    objectTable: Record<string, BaseObject>,
  ): void {
    if (this.debugWindow == null) {
      return;
    }
    this.debugCtx?.clearRect(
      0,
      0,
      this.debugWindow.width,
      this.debugWindow.height,
    );

    if (this.isTagEnabled("grid")) {
      this.renderDebugGrid(engine);
    }

    for (const object of Object.values(objectTable)) {
      this.debugObjectBoundingBox(object, engine);
    }

    if (this.debugCtx == null) {
      return;
    }
    for (const marker of Object.values(engine.debugMarkerList)) {
      if (!this.isTagEnabled(marker.tag)) {
        continue;
      }
      const [cameraX, cameraY] = engine.camera?.getCameraFromWorld(
        marker.x,
        marker.y,
      ) ?? [0, 0];
      // console.debug("Debug Marker", marker.x, marker.y, cameraX, cameraY);
      if (marker.type == "point") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.arc(cameraX, cameraY, 5, 0, 2 * Math.PI);
        this.debugCtx.fill();
      } else if (marker.type == "rect") {
        this.debugCtx.beginPath();
        if (marker.filled !== false) {
          this.debugCtx.fillStyle = marker.color;
          this.debugCtx.rect(cameraX, cameraY, marker.width!, marker.height!);
          this.debugCtx.fill();
        } else {
          this.debugCtx.strokeStyle = marker.color;
          this.debugCtx.lineWidth = marker.lineWidth ?? 1;
          this.debugCtx.strokeRect(
            cameraX,
            cameraY,
            marker.width!,
            marker.height!,
          );
        }
      } else if (marker.type == "circle") {
        this.debugCtx.beginPath();
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.arc(cameraX, cameraY, marker.radius!, 0, 2 * Math.PI);
        this.debugCtx.fill();
      } else if (marker.type == "text") {
        this.debugCtx.fillStyle = marker.color;
        this.debugCtx.fillText(marker.text!, cameraX, cameraY);
      } else if (marker.type == "line") {
        const [cameraX2, cameraY2] = engine.camera?.getCameraFromWorld(
          marker.x2!,
          marker.y2!,
        ) ?? [0, 0];
        this.debugCtx.beginPath();
        this.debugCtx.strokeStyle = marker.color;
        this.debugCtx.lineWidth = marker.lineWidth ?? 2;
        this.debugCtx.moveTo(cameraX, cameraY);
        this.debugCtx.lineTo(cameraX2, cameraY2);
        this.debugCtx.stroke();

        // Draw arrowheads if requested
        const size = marker.arrowSize ?? 8;
        const angle = Math.atan2(cameraY2 - cameraY, cameraX2 - cameraX);
        if (marker.arrowEnd) {
          this.debugCtx.beginPath();
          this.debugCtx.fillStyle = marker.color;
          this.debugCtx.moveTo(cameraX2, cameraY2);
          this.debugCtx.lineTo(
            cameraX2 - size * Math.cos(angle - Math.PI / 6),
            cameraY2 - size * Math.sin(angle - Math.PI / 6),
          );
          this.debugCtx.lineTo(
            cameraX2 - size * Math.cos(angle + Math.PI / 6),
            cameraY2 - size * Math.sin(angle + Math.PI / 6),
          );
          this.debugCtx.closePath();
          this.debugCtx.fill();
        }
        if (marker.arrowStart) {
          const reverseAngle = angle + Math.PI;
          this.debugCtx.beginPath();
          this.debugCtx.fillStyle = marker.color;
          this.debugCtx.moveTo(cameraX, cameraY);
          this.debugCtx.lineTo(
            cameraX - size * Math.cos(reverseAngle - Math.PI / 6),
            cameraY - size * Math.sin(reverseAngle - Math.PI / 6),
          );
          this.debugCtx.lineTo(
            cameraX - size * Math.cos(reverseAngle + Math.PI / 6),
            cameraY - size * Math.sin(reverseAngle + Math.PI / 6),
          );
          this.debugCtx.closePath();
          this.debugCtx.fill();
        }
      }
    }

    for (const id in engine.debugMarkerList) {
      if (!engine.debugMarkerList[id].persistent) {
        delete engine.debugMarkerList[id];
      }
    }
  }

  private debugObjectBoundingBox(object: BaseObject, engine: any) {
    if (this.debugCtx == null) {
      return;
    }

    const objectWorld = object.worldTransform;
    const [cameraX, cameraY] = engine.camera?.getCameraFromWorld(
      objectWorld.x,
      objectWorld.y,
    ) ?? [0, 0];

    // If object has a dom, draw a rectangle around the object's width and height
    if (object instanceof ElementObject) {
      const elementObject = object;

      const colors = ["#FF0000A0", "#00FF00A0", "#0000FFA0"];
      const stages = ["READ_1", "READ_2", "READ_3"] as const;
      const tagNames = ["dom-read-1", "dom-read-2", "dom-read-3"];
      for (let i = 0; i < 3; i++) {
        if (!this.isTagEnabled(tagNames[i])) continue;
        const property = elementObject.getStageBox(stages[i]);
        this.debugCtx.stroke();
        this.debugCtx.beginPath();
        this.debugCtx.strokeStyle = colors[i];
        this.debugCtx.lineWidth = 1;
        const [domCameraX, domCameraY] = engine.camera?.getCameraFromWorld(
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
      if (
        this.isTagEnabled("dom-read-1") ||
        this.isTagEnabled("dom-read-2") ||
        this.isTagEnabled("dom-read-3")
      ) {
        this.debugCtx.beginPath();
        this.debugCtx.strokeStyle = "black";
        this.debugCtx.lineWidth = 1;
        this.debugCtx.rect(
          cameraX,
          cameraY,
          elementObject.box.width,
          elementObject.box.height,
        );
        this.debugCtx.stroke();
      }
    }

    if (!this.isTagEnabled("hitboxes")) return;

    const COLLIDER_BLUE = "rgba(0, 247, 255, 0.5)";

    for (const collisionObject of object.colliderList) {
      this.debugCtx.beginPath();
      this.debugCtx.strokeStyle = COLLIDER_BLUE;
      this.debugCtx.lineWidth = 1;
      const collisionWorld = collisionObject.worldTransform;
      const [colliderCameraX, colliderCameraY] =
        engine.camera?.getCameraFromWorld(
          collisionObject.type === "rect"
            ? collisionObject.worldLeft
            : collisionWorld.x,
          collisionObject.type === "rect"
            ? collisionObject.worldTop
            : collisionWorld.y,
        ) ?? [0, 0];
      if (collisionObject.type == "circle") {
        this.debugCtx.arc(
          colliderCameraX,
          colliderCameraY,
          collisionObject.worldRadius,
          0,
          2 * Math.PI,
        );
        this.debugCtx.stroke();
      } else if (collisionObject.type == "rect") {
        this.debugCtx.rect(
          colliderCameraX,
          colliderCameraY,
          collisionObject.worldWidth,
          collisionObject.worldHeight,
        );
        this.debugCtx.stroke();
      } else if (collisionObject.type == "point") {
        this.debugCtx.arc(colliderCameraX, colliderCameraY, 2, 0, 2 * Math.PI);
        this.debugCtx.fillStyle = COLLIDER_BLUE;
        this.debugCtx.fill();
      }
    }
  }

  private renderDebugGrid(engine: any) {
    if (this.debugCtx == null) {
      return;
    }

    const gridSize = 100; // Size of each grid cell in world coordinates
    const camera = engine.camera;
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
    const [originX, originY] = [0, 0]; //camera.getCameraFromWorld(0, 0);
    if (
      originX >= 0 &&
      originX <= this.debugWindow!.width &&
      originY >= 0 &&
      originY <= this.debugWindow!.height
    ) {
      this.debugCtx.fillText("(0,0)", originX + 20, originY - 10);
    }
  }
}
