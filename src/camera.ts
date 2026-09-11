import { Engine } from "./engine";
import type { ContainerBounds } from "./engine";
import type { PointerPosition, Rect } from "./geometry";

export interface CameraConfig {
  enableZoom?: boolean;
  zoomBounds?: {
    min: number;
    max: number;
  };
  enablePan?: boolean;
  panBounds?: {
    top: number | null;
    left: number | null;
    right: number | null;
    bottom: number | null;
  };
  /**
   * A rectangle in world coordinates that the view must stay inside, so the camera
   * never reveals anything beyond it.
   *
   * Unlike {@link CameraConfig.panBounds}, which limits the raw camera position, this
   * accounts for how much world the view covers at the current zoom — the limits
   * loosen as you zoom in and tighten as you zoom out. If the content is smaller than
   * the view on an axis, it is centred on that axis instead.
   */
  contentBounds?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  } | null;
  handleResize?: boolean; // Whether to handle resize events and update camera properties
}

export interface CameraPinchUpdate {
  anchorWorldX: number;
  anchorWorldY: number;
  baseZoom: number;
  baseDistance: number;
  currentDistance: number;
  currentCameraX: number;
  currentCameraY: number;
}

export class Camera {
  /**
   * Represents a camera that can be used to pan and zoom the view of a DOM element.
   * The camera maintains 3 coordinate systems:
   * - Viewport coordinates: The x,y coordinates of the pointer on the browser viewport.
   *   (0,0) is the top left corner of the screen and the x,y coordinates increase as you move right and down.
   * - Camera coordinates: The x,y coordinates of the camera view.
   *   (0,0) is the top left corner of the camera view and the x,y coordinates increase as you move right and down.
   *   The position of the camera is the top left corner of the camera view.
   * - World coordinates: The x,y coordinates of the world that the camera is viewing.
   *   (0,0) is the center of the world and the x,y coordinates increase as you move right and down.
   */
  #containerDom: HTMLElement | null; // The DOM element that represents the camera view
  #containerOffsetX: number; // The x coordinate of the container DOM on the browser viewport
  #containerOffsetY: number; // The y coordinate of the container DOM on the browser viewport
  #cameraWidth: number; // The width of the camera view. This should be the same as the container width.
  #cameraHeight: number; // The height of the camera view. This should be the same as the container height.
  #cameraPositionX: number; // Position of the center of the camera
  #cameraPositionY: number;
  #cameraPanStartX: number; // Initial position of the camera when panning
  #cameraPanStartY: number;
  #zoom: number; // The zoom level of the camera, 1 means no zoom, smaller values zoom out, larger values zoom in
  #config: CameraConfig;
  #canvasStyle: string; // The CSS transform style that should be applied to the DOM element
  #engine: Engine;

  /**
   * Creates a new Camera instance for panning and zooming a DOM element.
   *
   * @param engine - The engine instance that manages the camera
   * @param config - Configuration options for camera behavior
   * @param config.enableZoom - Whether zoom functionality is enabled (default: true)
   * @param config.zoomBounds - Min/max zoom limits (default: {min: 0.2, max: 1})
   * @param config.enablePan - Whether pan functionality is enabled (default: true)
   * @param config.panBounds - Boundaries for panning (default: no bounds)
   * @param config.handleResize - Whether to handle window resize events (default: true)
   *
   * @example
   * ```typescript
   * const camera = new Camera(document.getElementById('canvas'), {
   *   enableZoom: true,
   *   zoomBounds: { min: 0.1, max: 2.0 },
   *   enablePan: true
   * });
   * ```
   */
  constructor(engine: Engine, config: CameraConfig = {}) {
    this.#engine = engine;
    // let containerRect = container.getBoundingClientRect();
    this.#containerDom = null;
    this.#containerOffsetX = 0;
    this.#containerOffsetY = 0;
    this.#cameraWidth = 0;
    this.#cameraHeight = 0;
    this.#cameraPositionX = 0;
    this.#cameraPositionY = 0;
    this.#cameraPanStartX = 0;
    this.#cameraPanStartY = 0;
    this.#zoom = 1;

    const defaultConfig = {
      enableZoom: true,
      zoomBounds: { min: 0.2, max: 1 },
      enablePan: true,
      panBounds: { top: null, left: null, right: null, bottom: null },
    };
    this.#config = { ...defaultConfig, ...config };

    this.#canvasStyle = "";
    this.updateCamera();
  }

  /**
   * Gets the current width of the camera viewport.
   * @returns The camera viewport width in pixels
   */
  get cameraWidth() {
    return this.#cameraWidth;
  }

  /**
   * Gets the current height of the camera viewport.
   * @returns The camera viewport height in pixels
   */
  get cameraHeight() {
    return this.#cameraHeight;
  }

  /**
   * Gets the current X position of the camera in world coordinates.
   * @returns The camera X position
   */
  get cameraPositionX() {
    return this.#cameraPositionX;
  }

  /**
   * Gets the current Y position of the camera in world coordinates.
   * @returns The camera Y position
   */
  get cameraPositionY() {
    return this.#cameraPositionY;
  }

  /**
   * Gets the current zoom level of the camera.
   * @returns The zoom level (1.0 = no zoom, <1 = zoomed out, >1 = zoomed in)
   */
  get zoom() {
    return this.#zoom;
  }

  /**
   * Gets the X offset of the container element relative to the viewport.
   * @returns The container X offset in pixels
   */
  get containerOffsetX() {
    return this.#containerOffsetX;
  }

  /**
   * Gets the Y offset of the container element relative to the viewport.
   * @returns The container Y offset in pixels
   */
  get containerOffsetY() {
    return this.#containerOffsetY;
  }

  /**
   * Gets the camera's current configuration.
   */
  get config(): CameraConfig {
    return this.#config;
  }

  /**
   * Merges new options into the camera's configuration.
   *
   * @param config - Partial configuration to merge over the current one
   *
   * @remarks
   * Useful for bounds that can only be computed after layout, or that change on
   * resize. Applying new pan bounds immediately clamps the current position so the
   * camera can never be left outside the new bounds.
   *
   * @example
   * ```typescript
   * camera.setConfig({ panBounds: { left: -500, right: 500, top: null, bottom: null } });
   * ```
   */
  setConfig(config: CameraConfig) {
    this.#config = { ...this.#config, ...config };
    this.#clampZoom();
    this.#clampCameraPosition();
    this.updateCamera();
  }

  /**
   * Clamps the camera position so the view stays within the configured pan bounds.
   * Bounds are expressed in world coordinates and applied to the camera position,
   * which is the top-left corner of the view.
   */
  #clampCameraPosition() {
    this.#clampToContentBounds();

    const bounds = this.#config.panBounds;
    if (!bounds) {
      return;
    }
    if (bounds.left !== null && this.#cameraPositionX < bounds.left) {
      this.#cameraPositionX = bounds.left;
    }
    if (bounds.right !== null && this.#cameraPositionX > bounds.right) {
      this.#cameraPositionX = bounds.right;
    }
    if (bounds.top !== null && this.#cameraPositionY < bounds.top) {
      this.#cameraPositionY = bounds.top;
    }
    if (bounds.bottom !== null && this.#cameraPositionY > bounds.bottom) {
      this.#cameraPositionY = bounds.bottom;
    }
  }

  /**
   * Keeps the view inside contentBounds, accounting for how much world is visible at
   * the current zoom. Recomputed per call, so the limits track the zoom level instead
   * of being fixed to one of them.
   */
  #clampToContentBounds() {
    const bounds = this.#config.contentBounds;
    if (!bounds || this.#zoom <= 0) {
      return;
    }

    const viewWidth = this.#cameraWidth / this.#zoom;
    const viewHeight = this.#cameraHeight / this.#zoom;
    const contentWidth = bounds.right - bounds.left;
    const contentHeight = bounds.bottom - bounds.top;

    // When the content no longer fills the view, centre it rather than pinning it to
    // an edge — otherwise the leftover space always lands on one side.
    this.#cameraPositionX =
      contentWidth <= viewWidth
        ? bounds.left - (viewWidth - contentWidth) / 2
        : Math.min(
            Math.max(this.#cameraPositionX, bounds.left),
            bounds.right - viewWidth,
          );

    this.#cameraPositionY =
      contentHeight <= viewHeight
        ? bounds.top - (viewHeight - contentHeight) / 2
        : Math.min(
            Math.max(this.#cameraPositionY, bounds.top),
            bounds.bottom - viewHeight,
          );
  }

  /**
   * Clamps the current zoom into the configured bounds.
   */
  #clampZoom() {
    const bounds = this.#config.zoomBounds;
    if (!bounds) {
      return;
    }
    if (this.#zoom < bounds.min) {
      this.#zoom = bounds.min;
    } else if (this.#zoom > bounds.max) {
      this.#zoom = bounds.max;
    }
  }

  set containerDom(element: HTMLElement | null) {
    this.#containerDom = element;
    this.updateCameraProperty();
    this.updateCamera();

    this.#engine.subscribeEvent('containerResized', 'camera', (props) => {
      this.updateCameraProperty(props.bounds);
      this.updateCamera();
    });
    this.#engine.subscribeEvent('containerMoved', 'camera', (props) => {
      this.updateCameraProperty(props.bounds);
      this.updateCamera();
    });
  }

  /**
   * Updates the camera's dimensional properties from the provided bounds or by reading from DOM.
   * This method is automatically called when the container is resized or moved.
   *
   * @param bounds - Optional pre-computed container bounds. If not provided, reads from DOM.
   */
  updateCameraProperty(bounds?: ContainerBounds) {
    if (!this.#containerDom) {
      return;
    }
    const rect = bounds ?? this.#containerDom.getBoundingClientRect();
    this.#containerOffsetX = rect.left;
    this.#containerOffsetY = rect.top;
    this.#cameraWidth = rect.width;
    this.#cameraHeight = rect.height;
  }

  /**
   * Generates a CSS 3D transformation matrix string for converting world coordinates to camera view.
   *
   * @param cameraX - The X coordinate of the camera position in world space
   * @param cameraY - The Y coordinate of the camera position in world space
   * @param zoom - The zoom level to apply to the transformation
   * @returns A CSS matrix3d string that can be applied to DOM elements
   *
   * @example
   * ```typescript
   * const matrix = camera.worldToCameraMatrix(100, 50, 1.5);
   * element.style.transform = `matrix3d(${matrix})`;
   * ```
   */
  worldToCameraMatrix(cameraX: number, cameraY: number, zoom: number): string {
    const s1 = zoom;
    const s2 = zoom;
    const t1 = -cameraX * zoom;
    const t2 = -cameraY * zoom;
    return `${s1},0,0,0,0,${s2},0,0,0,0,1,0,${t1},${t2},0,1`;
  }

  /**
   * Updates the camera's CSS transformation style based on current position and zoom.
   * This method should be called after any changes to camera position or zoom level.
   *
   * @remarks
   * The generated style can be retrieved via the `canvasStyle` getter and applied to DOM elements
   * to reflect the current camera view transformation.
   */
  updateCamera() {
    const matrix = this.worldToCameraMatrix(
      this.#cameraPositionX,
      this.#cameraPositionY,
      this.#zoom,
    );
    // Apply the transformation matrix, and translate the camera to the center of the container
    this.#canvasStyle = `matrix3d(${matrix})`;
  }

  /**
   * Gets the current CSS transformation style string for the camera.
   * @returns A CSS transform string that can be applied to DOM elements
   */
  get canvasStyle() {
    return this.#canvasStyle;
  }

  /**
   * Sets the camera position to specific world coordinates.
   *
   * @param x - The X coordinate in world space
   * @param y - The Y coordinate in world space
   *
   * @example
   * ```typescript
   * camera.setCameraPosition(100, 200); // Move camera to world position (100, 200)
   * ```
   */
  setCameraPosition(x: number, y: number) {
    this.#cameraPositionX = x;
    this.#cameraPositionY = y;
    this.updateCamera();
  }

  /**
   * Sets the camera position so that the specified world coordinates appear at the center of the viewport.
   *
   * @param x - The X coordinate in world space to center on
   * @param y - The Y coordinate in world space to center on
   *
   * @example
   * ```typescript
   * camera.setCameraCenterPosition(0, 0); // Center the camera on world origin
   * ```
   */
  setCameraCenterPosition(x: number, y: number) {
    // Set the camera position to the center of the camera view
    this.#cameraPositionX = x - this.#cameraWidth / 2;
    this.#cameraPositionY = y - this.#cameraHeight / 2;
    this.updateCamera();
  }

  /**
   * Gets the world coordinates of the current camera center point.
   *
   * @returns An object containing the world coordinates of the camera center
   * @returns returns.x - The X coordinate of the camera center in world space
   * @returns returns.y - The Y coordinate of the camera center in world space
   *
   * @example
   * ```typescript
   * const center = camera.getCameraCenterPosition();
   * console.log(`Camera centered at: ${center.x}, ${center.y}`);
   * ```
   */
  getCameraCenterPosition(): { x: number; y: number } {
    const centerX = this.#cameraPositionX + this.#cameraWidth / 2;
    const centerY = this.#cameraPositionY + this.#cameraHeight / 2;
    return { x: centerX, y: centerY };
  }

  /**
   * Handles zoom input by adjusting the camera zoom level and position.
   * The camera will zoom towards the specified point in camera coordinates.
   *
   * @param deltaZoom - The amount to change the zoom level (positive = zoom in, negative = zoom out)
   * @param cameraX - The X coordinate in camera space to zoom towards
   * @param cameraY - The Y coordinate in camera space to zoom towards
   *
   * @remarks
   * - Zoom is constrained by the configured zoom bounds
   * - If panning is enabled, the camera position is adjusted to zoom towards the specified point
   * - If panning is disabled, zoom occurs from the current camera center
   *
   * @example
   * ```typescript
   * // Zoom in by 0.1 towards the mouse position
   * camera.handleScroll(0.1, mouseX, mouseY);
   * ```
   */
  handleScroll(deltaZoom: number, cameraX: number, cameraY: number) {
    if (!this.#config.enableZoom) {
      return;
    }

    deltaZoom = this.#constrainDeltaZoom(deltaZoom);
    const zoomRatio = this.#zoom / (this.#zoom + deltaZoom); // Ratio of current zoom to new zoom
    // Move camera to zoom in on the mouse position
    if (this.#config.enablePan) {
      this.#cameraPositionX -=
        (this.#cameraWidth / this.#zoom) *
        (zoomRatio - 1) *
        (1 - (this.#cameraWidth - cameraX) / this.#cameraWidth);
      this.#cameraPositionY -=
        (this.#cameraHeight / this.#zoom) *
        (zoomRatio - 1) *
        (1 - (this.#cameraHeight - cameraY) / this.#cameraHeight);
    }
    this.#zoom += deltaZoom;
    this.#clampCameraPosition();

    this.updateCamera();
  }

  handlePinch(update: CameraPinchUpdate) {
    if (!this.#config.enableZoom && !this.#config.enablePan) {
      return;
    }

    let nextZoom = this.#zoom;

    if (
      this.#config.enableZoom &&
      update.baseDistance > 0 &&
      update.currentDistance > 0
    ) {
      nextZoom = this.#constrainTargetZoom(
        update.baseZoom * (update.currentDistance / update.baseDistance),
      );
    }

    if (this.#config.enablePan) {
      this.#cameraPositionX =
        update.anchorWorldX - update.currentCameraX / nextZoom;
      this.#cameraPositionY =
        update.anchorWorldY - update.currentCameraY / nextZoom;
    }

    this.#zoom = nextZoom;
    this.#clampCameraPosition();
    this.updateCamera();
  }

  #constrainDeltaZoom(deltaZoom: number) {
    // Clamp to the configured bounds rather than rejecting the gesture outright, so
    // a large step still moves the camera as far as it is allowed to go.
    const bounds = this.#config.zoomBounds ?? { min: 0.2, max: 1 };

    if (this.#zoom + deltaZoom < bounds.min) {
      deltaZoom = bounds.min - this.#zoom;
    } else if (this.#zoom + deltaZoom > bounds.max) {
      deltaZoom = bounds.max - this.#zoom;
    }

    return deltaZoom;
  }

  #constrainTargetZoom(targetZoom: number) {
    return this.#zoom + this.#constrainDeltaZoom(targetZoom - this.#zoom);
  }

  /**
   * Handles camera panning by applying a delta movement.
   *
   * @param deltaX - The change in X position (positive = pan right)
   * @param deltaY - The change in Y position (positive = pan down)
   *
   * @remarks
   * This is a simple pan method that applies movement directly. For more precise panning
   * that accounts for the exact mouse position, use the three-stage process:
   * handlePanStart() → handlePanDrag() → handlePanEnd()
   *
   * @example
   * ```typescript
   * // Pan the camera 10 pixels right and 5 pixels up
   * camera.handlePan(10, -5);
   * ```
   */
  handlePan(deltaX: number, deltaY: number) {
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPositionX += deltaX / this.#zoom;
    this.#cameraPositionY += deltaY / this.#zoom;
    this.#clampCameraPosition();

    this.updateCamera();
  }

  /**
   * Initiates a panning operation by recording the current camera position.
   * This is the first step in a three-stage panning process that provides more accurate
   * tracking of mouse movement during drag operations.
   *
   * @remarks
   * Call this method when a pan gesture begins (e.g., on mousedown or touchstart).
   * Follow with handlePanDrag() calls during movement and handlePanEnd() when complete.
   *
   * @example
   * ```typescript
   * element.addEventListener('mousedown', () => {
   *   camera.handlePanStart();
   * });
   * ```
   */
  handlePanStart() {
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPanStartX = this.#cameraPositionX;
    this.#cameraPanStartY = this.#cameraPositionY;
  }

  /**
   * Updates camera position during a panning operation based on cumulative movement
   * from the initial pan start position.
   *
   * @param deltaX - Total X movement since handlePanStart() was called
   * @param deltaY - Total Y movement since handlePanStart() was called
   *
   * @remarks
   * - This method should be called between handlePanStart() and handlePanEnd()
   * - Delta values are cumulative from the start position, not incremental
   * - Respects configured pan boundaries if set
   * - Movement is automatically adjusted for current zoom level
   *
   * @example
   * ```typescript
   * let startX, startY;
   *
   * element.addEventListener('mousedown', (e) => {
   *   camera.handlePanStart();
   *   startX = e.clientX;
   *   startY = e.clientY;
   * });
   *
   * element.addEventListener('mousemove', (e) => {
   *   const deltaX = e.clientX - startX;
   *   const deltaY = e.clientY - startY;
   *   camera.handlePanDrag(deltaX, deltaY);
   * });
   * ```
   */
  handlePanDrag(deltaX: number, deltaY: number) {
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPositionX = -deltaX / this.#zoom + this.#cameraPanStartX;
    this.#cameraPositionY = -deltaY / this.#zoom + this.#cameraPanStartY;
    this.#clampCameraPosition();
    this.updateCamera();
  }

  /**
   * Completes a panning operation by resetting the pan start coordinates.
   * This is the final step in the three-stage panning process.
   *
   * @remarks
   * Call this method when a pan gesture ends (e.g., on mouseup or touchend).
   * This cleans up the internal pan tracking state.
   *
   * @example
   * ```typescript
   * element.addEventListener('mouseup', () => {
   *   camera.handlePanEnd();
   * });
   * ```
   */
  handlePanEnd() {
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPanStartX = 0;
    this.#cameraPanStartY = 0;
  }

  /**
   * Converts world coordinates to camera viewport coordinates.
   *
   * @param worldX - The X coordinate in world space
   * @param worldY - The Y coordinate in world space
   * @returns A tuple [cameraX, cameraY] representing the point in camera coordinates
   *
   * @example
   * ```typescript
   * const [cameraX, cameraY] = camera.getCameraFromWorld(100, 200);
   * console.log(`World point (100, 200) appears at camera position (${cameraX}, ${cameraY})`);
   * ```
   */
  getCameraFromWorld(worldX: number, worldY: number): [number, number] {
    const c_x = (worldX - this.#cameraPositionX) * this.#zoom; // + this.#cameraWidth / 2;
    const c_y = (worldY - this.#cameraPositionY) * this.#zoom; // + this.#cameraHeight / 2;

    return [c_x, c_y];
  }

  /**
   * Converts camera viewport coordinates to screen/browser viewport coordinates.
   *
   * @param cameraX - The X coordinate in camera space
   * @param cameraY - The Y coordinate in camera space
   * @returns A tuple [screenX, screenY] representing the point in screen coordinates
   *
   * @example
   * ```typescript
   * const [screenX, screenY] = camera.getScreenFromCamera(50, 75);
   * // Use screenX, screenY for positioning absolute elements relative to the viewport
   * ```
   */
  getScreenFromCamera(cameraX: number, cameraY: number): [number, number] {
    const s_x = cameraX + this.#containerOffsetX;
    const s_y = cameraY + this.#containerOffsetY;

    return [s_x, s_y];
  }

  /**
   * Converts camera viewport coordinates to world coordinates.
   *
   * @param cameraX - The X coordinate in camera space
   * @param cameraY - The Y coordinate in camera space
   * @returns A tuple [worldX, worldY] representing the point in world coordinates
   *
   * @example
   * ```typescript
   * // Convert mouse position in camera to world coordinates
   * const [worldX, worldY] = camera.getWorldFromCamera(mouseX, mouseY);
   * console.log(`Mouse is over world position: ${worldX}, ${worldY}`);
   * ```
   */
  getWorldFromCamera(cameraX: number, cameraY: number): [number, number] {
    const w_x = cameraX / this.#zoom + this.#cameraPositionX;
    const w_y = cameraY / this.#zoom + this.#cameraPositionY;

    return [w_x, w_y];
  }

  /**
   * Converts screen/browser viewport coordinates to camera viewport coordinates.
   *
   * @param mouseX - The X coordinate in screen space (e.g., from mouse event)
   * @param mouseY - The Y coordinate in screen space (e.g., from mouse event)
   * @returns A tuple [cameraX, cameraY] representing the point in camera coordinates
   *
   * @example
   * ```typescript
   * element.addEventListener('click', (e) => {
   *   const [cameraX, cameraY] = camera.getCameraFromScreen(e.clientX, e.clientY);
   *   console.log(`Clicked at camera position: ${cameraX}, ${cameraY}`);
   * });
   * ```
   */
  getCameraFromScreen(mouseX: number, mouseY: number): [number, number] {
    mouseX = mouseX - this.#containerOffsetX;
    mouseY = mouseY - this.#containerOffsetY;
    return [mouseX, mouseY];
  }

  /**
   * Converts a movement delta in world coordinates to camera viewport coordinates.
   * Useful for transforming movement or size values between coordinate systems.
   *
   * @param worldDeltaX - The X component of movement/size in world space
   * @param worldDeltaY - The Y component of movement/size in world space
   * @returns A tuple [cameraDeltaX, cameraDeltaY] representing the delta in camera coordinates
   *
   * @example
   * ```typescript
   * // Convert a 10x10 world space rectangle to camera space
   * const [cameraWidth, cameraHeight] = camera.getCameraDeltaFromWorldDelta(10, 10);
   * ```
   */
  getCameraDeltaFromWorldDelta(
    worldDeltaX: number,
    worldDeltaY: number,
  ): [number, number] {
    const c_dx = worldDeltaX * this.#zoom;
    const c_dy = worldDeltaY * this.#zoom;

    return [c_dx, c_dy];
  }

  /**
   * Converts a movement delta in camera viewport coordinates to world coordinates.
   * Useful for transforming movement or size values between coordinate systems.
   *
   * @param cameraDeltaX - The X component of movement/size in camera space
   * @param cameraDeltaY - The Y component of movement/size in camera space
   * @returns A tuple [worldDeltaX, worldDeltaY] representing the delta in world coordinates
   *
   * @example
   * ```typescript
   * // Convert a 50px camera movement to world space movement
   * const [worldDeltaX, worldDeltaY] = camera.getWorldDeltaFromCameraDelta(50, 30);
   * // Use worldDeltaX, worldDeltaY to move objects in world space
   * ```
   */
  getWorldDeltaFromCameraDelta(
    cameraDeltaX: number,
    cameraDeltaY: number,
  ): [number, number] {
    const w_dx = cameraDeltaX / this.#zoom;
    const w_dy = cameraDeltaY / this.#zoom;

    return [w_dx, w_dy];
  }
}

/**
 * By default, every engine has a stationary camera that does not allow any user interaction.
 * Its main purpose is to convert coordinates between world, camera, and screen spaces.
 * It can be though of as a special variant of the Camera that that does not allow panning or zooming.
 */
export class StationaryCamera extends Camera {
  handleScroll(_: number, __: number, ___: number): void {
    // No zooming allowed
  }

  handlePan(_: number, __: number): void {
    // No panning allowed
  }

  handlePanStart(): void {
    // No panning allowed
  }

  handlePanDrag(_: number, __: number): void {
    // No panning allowed
  }

  handlePanEnd(): void {
    // No panning allowed
  }


}

/** The Camera conversions needed to resolve screen values into world space. */
export type ScreenToWorldMapper = Pick<
  Camera,
  "getCameraFromScreen" | "getWorldFromCamera" | "getWorldDeltaFromCameraDelta"
>;

/** The Camera conversions needed to resolve world values into screen space. */
export type WorldToScreenMapper = Pick<
  Camera,
  "getCameraFromWorld" | "getScreenFromCamera"
>;

/**
 * Resolve a viewport (client) point in world, camera, and screen space.
 * Without a camera, all three spaces coincide.
 */
export function pointerPositionFromScreen(
  camera: ScreenToWorldMapper | null,
  screenX: number,
  screenY: number,
): PointerPosition {
  const screen = { x: screenX, y: screenY };
  if (!camera) return { x: screenX, y: screenY, camera: screen, screen };
  const [cameraX, cameraY] = camera.getCameraFromScreen(screenX, screenY);
  const [worldX, worldY] = camera.getWorldFromCamera(cameraX, cameraY);
  return {
    x: worldX,
    y: worldY,
    camera: { x: cameraX, y: cameraY },
    screen,
  };
}

/**
 * Resolve a world point in world, camera, and screen space.
 * Without a camera, all three spaces coincide.
 */
export function pointerPositionFromWorld(
  camera: WorldToScreenMapper | null,
  worldX: number,
  worldY: number,
): PointerPosition {
  if (!camera) {
    const point = { x: worldX, y: worldY };
    return { x: worldX, y: worldY, camera: point, screen: point };
  }
  const [cameraX, cameraY] = camera.getCameraFromWorld(worldX, worldY);
  const [screenX, screenY] = camera.getScreenFromCamera(cameraX, cameraY);
  return {
    x: worldX,
    y: worldY,
    camera: { x: cameraX, y: cameraY },
    screen: { x: screenX, y: screenY },
  };
}

/**
 * Map a viewport (client) rectangle into world space: the origin through
 * the camera transform and the size by the camera zoom.
 */
export function worldRectFromScreenRect(
  camera: ScreenToWorldMapper | null,
  rect: Rect,
): Rect {
  if (!camera) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }
  const [cameraX, cameraY] = camera.getCameraFromScreen(rect.x, rect.y);
  const [x, y] = camera.getWorldFromCamera(cameraX, cameraY);
  const [width, height] = camera.getWorldDeltaFromCameraDelta(
    rect.width,
    rect.height,
  );
  return { x, y, width, height };
}
