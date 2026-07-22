import type {
  pointerDownProp,
  pointerMoveProp,
  pointerUpProp,
  mouseWheelProp,
  pinchProp,
} from "@snap-engine/core";
import { ElementObject } from "@snap-engine/core";
import { Camera } from "@snap-engine/core";
import type { CameraConfig } from "@snap-engine/core";

export type CameraControlConfig = {
  zoomLock?: boolean;
  panLock?: boolean;
  /**
   * Disables panning with a single pointer while leaving two-finger pinch panning
   * intact. Use when the camera sits inside a scrollable page and a one-finger drag
   * should scroll the page instead of moving the camera.
   *
   * Pass "touch" to restrict the lock to touch pointers, so a mouse drag still pans —
   * on desktop a drag never scrolls the page, so it costs nothing to keep.
   */
  pointerPanLock?: boolean | "touch";
  /**
   * Requires a modifier key for wheel zoom. With "ctrlOrMeta", an unmodified wheel
   * event is left alone so the page scrolls normally; trackpad pinch still zooms,
   * because browsers report it as a wheel event with ctrlKey set.
   */
  wheelZoomModifier?: "none" | "ctrlOrMeta";
  /**
   * Which mouse button starts a pointer pan. "left" (the default) preserves the
   * original behavior; "middle" frees the left button for other gestures (e.g.
   * rubber-band select) while the middle button pans; "both" pans on either.
   */
  panButton?: "left" | "middle" | "both";
  /** Options forwarded to the underlying Camera, e.g. zoomBounds and contentBounds. */
  camera?: CameraConfig;
};

const DEFAULT_CONFIG: CameraControlConfig = {
  zoomLock: false,
  panLock: false,
  pointerPanLock: false,
  wheelZoomModifier: "none",
  panButton: "left",
};

type PinchAnchor = {
  centerX: number;
  centerY: number;
  distance: number;
  worldX: number;
  worldY: number;
  zoom: number;
};

class CameraControl extends ElementObject {
  #state: "idle" | "panning" | "pinching" = "idle";
  #mouseDownX: number;
  #mouseDownY: number;
  #panPointerId: number | null = null;
  #pinchAnchor: PinchAnchor | null = null;

  config: CameraControlConfig = {};

  camera: Camera | null = null;

  constructor(engine: any, config: CameraControlConfig = {}) {
    super(engine, null);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.#mouseDownX = 0;
    this.#mouseDownY = 0;
    this.#state = "idle";
    this.event.global.pointerDown = this.onCursorDown;
    this.event.global.pointerMove = this.onCursorMove;
    this.event.global.pointerUp = this.onCursorUp;
    this.event.global.mouseWheel = this.onZoom;
    this.event.global.pinchStart = this.onPinchStart;
    this.event.global.pinch = this.onPinch;
    this.event.global.pinchEnd = this.onPinchEnd;
    this.transformMode = "direct";

    this.style = {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px",
    };
    this.schedule(() => this.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  /**
   * Merges options into the underlying Camera's configuration, e.g. to apply pan or
   * zoom bounds that can only be computed once the container has been laid out.
   */
  setCameraConfig(config: CameraConfig) {
    this.config = { ...this.config, camera: { ...this.config.camera, ...config } };
    this.camera?.setConfig(config);
    this.paintCamera();
  }

  set element(_element: HTMLElement) {
    super.element = _element;
    this.camera = new Camera(this.engine, this.config.camera);
    this.engine.camera = this.camera;
    this.camera.containerDom =
      this.engine.containerElement ?? _element.parentElement ?? _element;
    // this.engine.subscribeEvent('containerResized', 'cameraControl', () => {
    //   this.setCameraPosition(this.#prevCameraX, this.#prevCameraY);
    //   this.paintCamera();
    // });
  }

  paintCamera() {
    // this.engine.camera?.updateCameraProperty();
    this.engine.camera?.updateCamera();
    this.style.transform = this.engine.camera?.canvasStyle as string;
    this.schedule(() => this.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  // Camera Methods

  updateCameraCenterPosition(x: number = 0, y: number = 0) {
    this.engine.camera?.setCameraCenterPosition(x, y);
    this.paintCamera();
  }

  setCameraPosition(x: number, y: number) {
    this.engine.camera?.setCameraPosition(x, y);
    this.paintCamera();
  }

  setCameraCenterPosition(x: number, y: number) {
    this.engine.camera?.setCameraCenterPosition(x, y);
    this.paintCamera();
  }

  getCameraCenterPosition() {
    return this.engine.camera?.getCameraCenterPosition() || { x: 0, y: 0 };
  }

  zoomBy(deltaZoom: number, originX?: number, originY?: number) {
    if (this.config.zoomLock) {
      return;
    }
    const camera = this.engine.camera;
    if (!camera) {
      return;
    }

    const targetX = originX ?? camera.cameraWidth / 2;
    const targetY = originY ?? camera.cameraHeight / 2;

    camera.handleScroll(deltaZoom, targetX, targetY);
    this.style.transform = camera.canvasStyle as string;
    this.schedule(() => this.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  // Event Handlers

  onCursorDown(prop: pointerDownProp) {
    // Left button is 0, middle button is 1. The pan button is configurable so
    // consumers can reserve the left button for another gesture.
    const panButton = this.config.panButton ?? "left";
    const buttonPans =
      (panButton === "left" || panButton === "both") && prop.event.button === 0
        ? true
        : (panButton === "middle" || panButton === "both") && prop.event.button === 1;
    if (!buttonPans) {
      return;
    }
    if (this.#state !== "idle") {
      return;
    }
    if (this.config.panLock) {
      return;
    }
    const pointerPanLock = this.config.pointerPanLock;
    if (
      pointerPanLock === true ||
      (pointerPanLock === "touch" && prop.event.pointerType === "touch")
    ) {
      return;
    }
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    if (prop.isWithinEngine === false) {
      return;
    }
    this.#state = "panning";
    this.#panPointerId = prop.event.pointerId;
    this.#mouseDownX = prop.position.screenX;
    this.#mouseDownY = prop.position.screenY;
    this.#pinchAnchor = null;
    this.engine.camera?.handlePanStart();
    prop.event.preventDefault();
  }

  onCursorMove(prop: pointerMoveProp) {
    if (this.#state != "panning") {
      return;
    }
    if (prop.event?.pointerId !== this.#panPointerId) {
      return;
    }
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    const dx = prop.position.screenX - this.#mouseDownX;
    const dy = prop.position.screenY - this.#mouseDownY;
    this.engine.camera?.handlePanDrag(dx, dy);
    this.style.transform = this.engine.camera?.canvasStyle as string;
    this.schedule(() => this.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  onCursorUp(prop: pointerUpProp) {
    if (this.#state != "panning") {
      return;
    }
    if (prop.event.pointerId !== this.#panPointerId) {
      return;
    }
    this.#state = "idle";
    this.#panPointerId = null;
    this.engine.camera?.handlePanEnd();
    this.style.transform = this.engine.camera?.canvasStyle as string;
    this.schedule(() => this.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  onZoom(prop: mouseWheelProp) {
    if (this.config.zoomLock) {
      return;
    }
    if (this.config.wheelZoomModifier === "ctrlOrMeta") {
      const event = prop.event as WheelEvent;
      if (!event.ctrlKey && !event.metaKey) {
        // Return without preventDefault so the page keeps scrolling.
        return;
      }
    }
    const camera = this.engine.camera!;
    if (
      prop.position.screenX < camera.containerOffsetX ||
      prop.position.screenX > camera.containerOffsetX + camera.cameraWidth ||
      prop.position.screenY < camera.containerOffsetY ||
      prop.position.screenY > camera.containerOffsetY + camera.cameraHeight
    ) {
      return;
    }
    this.zoomBy(
      prop.delta / 2000,
      prop.position.cameraX,
      prop.position.cameraY,
    );
    prop.event.preventDefault();
  }

  onPinchStart() {
    if (this.config.zoomLock && this.config.panLock) {
      return;
    }
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    this.#state = "pinching";
    this.#panPointerId = null;
    this.#pinchAnchor = null;
    this.engine.camera?.handlePanEnd();
  }

  onPinch(prop: pinchProp) {
    if (this.config.zoomLock && this.config.panLock) {
      return;
    }
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    const [pointer0, pointer1] = prop.current.pointerList;
    const center = {
      x: (pointer0.cameraX + pointer1.cameraX) / 2,
      y: (pointer0.cameraY + pointer1.cameraY) / 2,
    };
    const camera = this.engine.camera;
    if (!camera) {
      return;
    }

    if (this.#state !== "pinching") {
      this.#state = "pinching";
      this.#pinchAnchor = this.#createPinchAnchor(center, prop.current.distance);
      return;
    }
    if (this.#pinchAnchor == null || this.#pinchAnchor.distance === 0) {
      this.#pinchAnchor = this.#createPinchAnchor(center, prop.current.distance);
      return;
    }

    camera.handlePinch({
      anchorWorldX: this.#pinchAnchor.worldX,
      anchorWorldY: this.#pinchAnchor.worldY,
      baseZoom: this.#pinchAnchor.zoom,
      baseDistance: this.config.zoomLock
        ? prop.current.distance
        : this.#pinchAnchor.distance,
      currentDistance: prop.current.distance,
      currentCameraX: this.config.panLock
        ? this.#pinchAnchor.centerX
        : center.x,
      currentCameraY: this.config.panLock
        ? this.#pinchAnchor.centerY
        : center.y,
    });

    this.style.transform = camera.canvasStyle as string;
    this.schedule(() => this.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  onPinchEnd() {
    if (this.#state === "pinching") {
      this.#state = "idle";
    }
    this.#panPointerId = null;
    this.#pinchAnchor = null;
  }

  #createPinchAnchor(center: { x: number; y: number }, distance: number) {
    const camera = this.engine.camera!;
    return {
      centerX: center.x,
      centerY: center.y,
      distance,
      worldX: camera.cameraPositionX + center.x / camera.zoom,
      worldY: camera.cameraPositionY + center.y / camera.zoom,
      zoom: camera.zoom,
    };
  }
}

export { CameraControl };
