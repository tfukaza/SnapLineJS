import type {
  pointerDownProp,
  pointerMoveProp,
  pointerUpProp,
  mouseWheelProp,
  pinchProp,
  PointerPosition,
  EdgePanController,
} from "@snap-engine/core";
import { ElementObject, pointerPositionFromScreen } from "@snap-engine/core";
import { Camera } from "@snap-engine/core";
import { pointIntersectsRect, type Point } from "@snap-engine/core/geometry";
import type { CameraConfig } from "@snap-engine/core";

/** What the mouse wheel / trackpad two-finger scroll does. */
export type CameraWheelConfig = {
  /**
   * What an unmodified wheel event does. "zoom" (default) zooms; "pan" is the
   * trackpad "map" convention — two-finger scroll pans while a ctrl/cmd wheel
   * (and trackpad pinch, which browsers report as a ctrl-wheel) still zooms.
   */
  action?: "zoom" | "pan";
  /**
   * Requires a modifier key for wheel zoom. With "ctrlOrMeta", an unmodified
   * wheel event is left alone so the page scrolls normally; trackpad pinch
   * still zooms, because browsers report it as a wheel event with ctrlKey set.
   */
  zoomModifier?: "none" | "ctrlOrMeta";
  /** Multiplies wheel-zoom speed (default 1). */
  zoomSensitivity?: number;
  /** Multiplies wheel-pan speed (default 1 = 1:1 screen pixels). */
  panSensitivity?: number;
  /**
   * Extra gain applied to trackpad pinch zoom (default 10). Chrome/Safari
   * deliver a pinch as a ctrl-wheel whose deltaY is roughly an order of
   * magnitude smaller than a mouse scroll notch; this brings it up to a
   * comparable rate so pinch doesn't feel dead.
   */
  pinchZoomGain?: number;
};

/** What pointer (mouse/touch drag) input does. */
export type CameraPointerConfig = {
  /**
   * Which mouse button starts a pointer pan. "left" (the default) preserves the
   * original behavior; "middle" frees the left button for other gestures (e.g.
   * rubber-band select) while the middle button pans; "both" pans on either.
   */
  panButton?: "left" | "middle" | "both";
  /**
   * Disables panning with a single pointer while leaving two-finger pinch
   * panning intact. Pass "touch" to restrict the lock to touch pointers.
   */
  panLock?: boolean | "touch";
};

export type CameraEdgePanConfig = {
  /** Enables edge-panning for consumers that explicitly request it. */
  enabled?: boolean;
  /** Screen-pixel width of the activation zone at each viewport edge. */
  edgeDistance?: number;
  /** Maximum camera speed in screen pixels per second. */
  maxSpeed?: number;
};

export type CameraControlConfig = {
  zoomLock?: boolean;
  panLock?: boolean;
  /** Wheel/trackpad behavior, grouped. Wins over the flat deprecated aliases. */
  wheel?: CameraWheelConfig;
  /** Pointer behavior, grouped. Wins over the flat deprecated aliases. */
  pointer?: CameraPointerConfig;
  /** Programmatic edge-pan behavior used by drag owners such as SnapLine. */
  edgePan?: CameraEdgePanConfig;
  /** @deprecated Use `pointer.panLock` instead. */
  pointerPanLock?: boolean | "touch";
  /** @deprecated Use `wheel.zoomModifier` instead. */
  wheelZoomModifier?: "none" | "ctrlOrMeta";
  /** @deprecated Use `wheel.action: "pan"` instead. */
  wheelPan?: boolean;
  /** @deprecated Use `wheel.zoomSensitivity` instead. */
  zoomSensitivity?: number;
  /** @deprecated Use `wheel.panSensitivity` instead. */
  wheelPanSensitivity?: number;
  /** @deprecated Use `pointer.panButton` instead. */
  panButton?: "left" | "middle" | "both";
  /** Options forwarded to the underlying Camera, e.g. zoomBounds and contentBounds. */
  camera?: CameraConfig;
};

const DEFAULT_CONFIG: CameraControlConfig = {
  zoomLock: false,
  panLock: false,
  pointerPanLock: false,
  wheelZoomModifier: "none",
  wheelPan: false,
  panButton: "left",
  zoomSensitivity: 1,
  wheelPanSensitivity: 1,
};

export interface ResolvedCameraOptions {
  wheelAction: "zoom" | "pan";
  wheelZoomModifier: "none" | "ctrlOrMeta";
  zoomSensitivity: number;
  wheelPanSensitivity: number;
  pinchZoomGain: number;
  panButton: "left" | "middle" | "both";
  pointerPanLock: boolean | "touch";
}

/**
 * Resolves the effective camera options at READ time: a grouped key, when
 * defined, wins over its flat deprecated alias; an undefined grouped key falls
 * back to the flat key, then to the default. Resolution happens per-read (not
 * at construction) because `config` is a public field that adapters reassign
 * wholesale when props change.
 */
export function resolveCameraOptions(
  config: CameraControlConfig,
): ResolvedCameraOptions {
  return {
    wheelAction: config.wheel?.action ?? (config.wheelPan ? "pan" : "zoom"),
    wheelZoomModifier:
      config.wheel?.zoomModifier ?? config.wheelZoomModifier ?? "none",
    zoomSensitivity: config.wheel?.zoomSensitivity ?? config.zoomSensitivity ?? 1,
    wheelPanSensitivity:
      config.wheel?.panSensitivity ?? config.wheelPanSensitivity ?? 1,
    pinchZoomGain: config.wheel?.pinchZoomGain ?? 10,
    panButton: config.pointer?.panButton ?? config.panButton ?? "left",
    pointerPanLock: config.pointer?.panLock ?? config.pointerPanLock ?? false,
  };
}

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
  #edgePanRequest: {
    pointerId: number;
    position: PointerPosition;
    onFrame: (position: PointerPosition) => void;
  } | null = null;
  #edgePanFrameId: number | null = null;
  #edgePanTimestamp: number | null = null;

  config: CameraControlConfig = {};

  camera: Camera | null = null;

  constructor(engine: any, config: CameraControlConfig = {}) {
    super(engine, null);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.#mouseDownX = 0;
    this.#mouseDownY = 0;
    this.#state = "idle";
    this.engine.edgePanController = this as EdgePanController;
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
    this.#commitCamera(() => this.camera?.setConfig(config));
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

  /**
   * Paint the camera transform. The paint happens in the same commit as the
   * camera state change whenever the stage allows a write: a DOM read later
   * in the frame must never see the new zoom against the old transform, or
   * it would convert the old on-screen size with the new zoom.
   */
  paintCamera() {
    this.engine.camera?.updateCamera();
    this.style.transform = this.engine.camera?.canvasStyle as string;
    if (this.element && this.#canWriteNow()) {
      this.writeTransform();
      return;
    }
    this.schedule(() => this.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.id}-transform`,
    });
  }

  #canWriteNow(): boolean {
    const stage = this.global.currentStage;
    return stage === "IDLE" || stage.startsWith("WRITE");
  }

  /**
   * Apply a programmatic camera change and paint it as one commit. Requested
   * during a read stage, both wait for the next write stage, so no read in
   * this frame observes a camera the DOM does not show yet.
   */
  #commitCamera(mutate: (camera: Camera) => void): void {
    const commit = () => {
      const camera = this.engine.camera;
      if (!camera) return;
      mutate(camera);
      this.paintCamera();
    };
    if (this.#canWriteNow()) {
      commit();
      return;
    }
    this.schedule(commit, { stage: "WRITE_2" });
  }

  // Camera Methods

  updateCameraCenterPosition(x: number = 0, y: number = 0) {
    this.#commitCamera((camera) => camera.setCameraCenterPosition(x, y));
  }

  setCameraPosition(x: number, y: number) {
    this.#commitCamera((camera) => camera.setCameraPosition(x, y));
  }

  setCameraCenterPosition(x: number, y: number) {
    this.#commitCamera((camera) => camera.setCameraCenterPosition(x, y));
  }

  getCameraCenterPosition() {
    return this.engine.camera?.getCameraCenterPosition() || { x: 0, y: 0 };
  }

  zoomBy(deltaZoom: number, originX?: number, originY?: number) {
    if (this.config.zoomLock) {
      return;
    }
    this.#commitCamera((camera) =>
      camera.handleScroll(
        deltaZoom,
        originX ?? camera.cameraWidth / 2,
        originY ?? camera.cameraHeight / 2,
      ),
    );
  }

  startEdgePan(
    pointerId: number,
    position: PointerPosition,
    onFrame: (position: PointerPosition) => void,
  ): void {
    if (!this.config.edgePan?.enabled) {
      return;
    }
    this.#edgePanRequest = { pointerId, position, onFrame };
    this.#edgePanTimestamp = null;
    this.#scheduleEdgePanFrame();
  }

  updateEdgePan(pointerId: number, position: PointerPosition): void {
    if (!this.config.edgePan?.enabled) {
      this.stopEdgePan(pointerId);
      return;
    }
    if (!this.#edgePanRequest) {
      return;
    }
    if (this.#edgePanRequest.pointerId !== pointerId) {
      return;
    }
    this.#edgePanRequest.position = position;
    this.#scheduleEdgePanFrame();
  }

  stopEdgePan(pointerId: number): void {
    if (
      this.#edgePanRequest &&
      this.#edgePanRequest.pointerId !== pointerId
    ) {
      return;
    }
    this.#edgePanRequest = null;
    this.#edgePanTimestamp = null;
    if (this.#edgePanFrameId != null) {
      cancelAnimationFrame(this.#edgePanFrameId);
      this.#edgePanFrameId = null;
    }
  }

  #scheduleEdgePanFrame(): void {
    if (this.#edgePanFrameId != null || !this.#edgePanRequest) {
      return;
    }
    this.#edgePanFrameId = requestAnimationFrame(this.#runEdgePanFrame);
  }

  #runEdgePanFrame = (timestamp: number): void => {
    this.#edgePanFrameId = null;
    const request = this.#edgePanRequest;
    const camera = this.engine.camera;
    const config = this.config.edgePan;
    if (!request || !camera || !config?.enabled) {
      this.#edgePanTimestamp = null;
      return;
    }

    const edgeDistance = Math.max(1, config.edgeDistance ?? 48);
    const maxSpeed = Math.max(0, config.maxSpeed ?? 600);
    const left = camera.containerOffsetX;
    const top = camera.containerOffsetY;
    const right = left + camera.cameraWidth;
    const bottom = top + camera.cameraHeight;
    const axisSpeed = (value: number, min: number, max: number): number => {
      if (value < min + edgeDistance) {
        return -Math.min(1, (min + edgeDistance - value) / edgeDistance);
      }
      if (value > max - edgeDistance) {
        return Math.min(1, (value - (max - edgeDistance)) / edgeDistance);
      }
      return 0;
    };
    const velocityX =
      axisSpeed(request.position.screen.x, left, right) * maxSpeed;
    const velocityY =
      axisSpeed(request.position.screen.y, top, bottom) * maxSpeed;
    const previousTimestamp = this.#edgePanTimestamp ?? timestamp;
    const elapsedSeconds =
      Math.min(32, Math.max(0, timestamp - previousTimestamp)) / 1000;
    this.#edgePanTimestamp = timestamp;

    if (
      !this.config.panLock &&
      (velocityX !== 0 || velocityY !== 0) &&
      elapsedSeconds > 0
    ) {
      camera.handlePan(
        velocityX * elapsedSeconds,
        velocityY * elapsedSeconds,
      );
      this.paintCamera();
      request.onFrame(
        this.#positionFromScreen(
          request.position.screen.x,
          request.position.screen.y,
        ),
      );
    }

    this.#scheduleEdgePanFrame();
  };

  #positionFromScreen(screenX: number, screenY: number): PointerPosition {
    return pointerPositionFromScreen(this.engine.camera, screenX, screenY);
  }

  /** Whether a viewport point lies inside the camera's container. */
  #isWithinCamera(camera: Camera, screen: Point): boolean {
    return pointIntersectsRect(screen, {
      x: camera.containerOffsetX,
      y: camera.containerOffsetY,
      width: camera.cameraWidth,
      height: camera.cameraHeight,
    });
  }


  // Event Handlers

  onCursorDown(prop: pointerDownProp) {
    const options = resolveCameraOptions(this.config);
    // Left button is 0, middle button is 1. The pan button is configurable so
    // consumers can reserve the left button for another gesture.
    const panButton = options.panButton;
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
    const pointerPanLock = options.pointerPanLock;
    if (
      pointerPanLock === true ||
      (pointerPanLock === "touch" && prop.event.pointerType === "touch")
    ) {
      return;
    }
    // Gesture owners block the camera at the input-dispatch layer (pointer
    // claims); this legacy boolean remains for third-party writers only.
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    if (prop.isWithinEngine === false) {
      return;
    }
    this.#state = "panning";
    this.#panPointerId = prop.event.pointerId;
    this.#mouseDownX = prop.position.screen.x;
    this.#mouseDownY = prop.position.screen.y;
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
    // Gesture owners block the camera at the input-dispatch layer (pointer
    // claims); this legacy boolean remains for third-party writers only.
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    const dx = prop.position.screen.x - this.#mouseDownX;
    const dy = prop.position.screen.y - this.#mouseDownY;
    this.engine.camera?.handlePanDrag(dx, dy);
    this.paintCamera();
  }

  onCursorUp(prop: pointerUpProp) {
    this.stopEdgePan(prop.event.pointerId);
    if (this.#state != "panning") {
      return;
    }
    if (prop.event.pointerId !== this.#panPointerId) {
      return;
    }
    this.#state = "idle";
    this.#panPointerId = null;
    this.engine.camera?.handlePanEnd();
    this.paintCamera();
  }

  onZoom(prop: mouseWheelProp) {
    const options = resolveCameraOptions(this.config);
    const event = prop.event as WheelEvent;
    const zoomIntent = event.ctrlKey || event.metaKey;
    // Trackpad two-finger scroll pans; a modifier (and trackpad pinch, reported as
    // a ctrl-wheel) falls through to zoom.
    if (options.wheelAction === "pan" && !zoomIntent) {
      this.panByWheel(prop, options.wheelPanSensitivity);
      return;
    }
    if (this.config.zoomLock) {
      return;
    }
    if (options.wheelZoomModifier === "ctrlOrMeta" && !zoomIntent) {
      // Return without preventDefault so the page keeps scrolling.
      return;
    }
    const camera = this.engine.camera!;
    if (!this.#isWithinCamera(camera, prop.position.screen)) {
      return;
    }
    // A trackpad pinch is a ctrl-wheel; Cmd+scroll is a meta-wheel with much larger
    // deltas, so only the pinch gets the extra gain. Negate so pinch-out / scroll-up
    // zooms in — the natural direction on every platform.
    const pinch = event.ctrlKey && !event.metaKey;
    const sensitivity =
      options.zoomSensitivity * (pinch ? options.pinchZoomGain : 1);
    this.zoomBy(
      (-prop.delta * sensitivity) / 2000,
      prop.position.camera.x,
      prop.position.camera.y,
    );
    prop.event.preventDefault();
  }

  private panByWheel(prop: mouseWheelProp, sensitivity: number) {
    if (this.config.panLock) {
      return;
    }
    // Gesture owners block the camera at the input-dispatch layer (pointer
    // claims); this legacy boolean remains for third-party writers only.
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    const camera = this.engine.camera;
    if (!camera) {
      return;
    }
    if (!this.#isWithinCamera(camera, prop.position.screen)) {
      return;
    }
    // Wheel deltas are screen pixels in the document-scroll sense (deltaY > 0 =
    // scroll down); handlePan reads them the same way (positive = pan down) and
    // divides by zoom, giving 1:1 screen-pixel panning like a pointer drag.
    const event = prop.event as WheelEvent;
    camera.handlePan(event.deltaX * sensitivity, event.deltaY * sensitivity);
    this.paintCamera();
    prop.event.preventDefault();
  }

  onPinchStart() {
    if (this.config.zoomLock && this.config.panLock) {
      return;
    }
    // Gesture owners block the camera at the input-dispatch layer (pointer
    // claims); this legacy boolean remains for third-party writers only.
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
    // Gesture owners block the camera at the input-dispatch layer (pointer
    // claims); this legacy boolean remains for third-party writers only.
    if (this.global.data.allowCameraControl === false) {
      return;
    }
    const [pointer0, pointer1] = prop.current.pointerList;
    const center = {
      x: (pointer0.camera.x + pointer1.camera.x) / 2,
      y: (pointer0.camera.y + pointer1.camera.y) / 2,
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

    this.paintCamera();
  }

  onPinchEnd() {
    if (this.#state === "pinching") {
      this.#state = "idle";
    }
    this.#panPointerId = null;
    this.#pinchAnchor = null;
  }

  destroy(removeDom: boolean = true) {
    if (this.#edgePanRequest) {
      this.stopEdgePan(this.#edgePanRequest.pointerId);
    }
    if (this.engine.edgePanController === this) {
      this.engine.edgePanController = null;
    }
    super.destroy(removeDom);
  }

  #createPinchAnchor(center: Point, distance: number) {
    const camera = this.engine.camera!;
    const [worldX, worldY] = camera.getWorldFromCamera(center.x, center.y);
    return {
      centerX: center.x,
      centerY: center.y,
      distance,
      worldX,
      worldY,
      zoom: camera.zoom,
    };
  }
}

export { CameraControl };
