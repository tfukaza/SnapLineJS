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
  handleResize?: boolean; // Whether to handle resize events and update camera properties
}

class Camera {
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
  #containerDom: HTMLElement; // The DOM element that represents the camera view
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
  // #cameraCenterMode: "center" | "topLeft";
  #cameraCenterX: number;
  #cameraCenterY: number;
  #resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, config: CameraConfig = {}) {
    let containerRect = container.getBoundingClientRect();
    this.#containerDom = container;
    this.#containerOffsetX = containerRect.left;
    this.#containerOffsetY = containerRect.top;
    this.#cameraWidth = containerRect.width;
    this.#cameraHeight = containerRect.height;
    this.#cameraCenterX = this.#cameraWidth / 2;
    this.#cameraCenterY = this.#cameraHeight / 2;
    this.#cameraPositionX = 0;
    this.#cameraPositionY = 0;
    // this.#cameraCenterMode = "topLeft";
    // if (this.#cameraCenterMode == "topLeft") {
    //   this.#cameraPositionX = this.#cameraWidth / 2;
    //   this.#cameraPositionY = this.#cameraHeight / 2;
    // }
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

    // For now, we always handle resize events.
    if (this.#config.handleResize || true) {
      this.#resizeObserver = new ResizeObserver(() => {
        this.updateCameraProperty();
      });
      this.#resizeObserver.observe(this.#containerDom);
      this.#resizeObserver.observe(window.document.body);
    }

    window.addEventListener("scroll", () => {
      this.updateCamera();
    });
  }

  get cameraWidth() {
    return this.#cameraWidth;
  }
  get cameraHeight() {
    return this.#cameraHeight;
  }
  get cameraPositionX() {
    return this.#cameraPositionX;
  }
  get cameraPositionY() {
    return this.#cameraPositionY;
  }
  get zoom() {
    return this.#zoom;
  }
  get containerOffsetX() {
    return this.#containerOffsetX;
  }
  get containerOffsetY() {
    return this.#containerOffsetY;
  }

  updateCameraProperty() {
    // TODO: Move this read operation to the READ queue
    let containerRect = this.#containerDom.getBoundingClientRect();
    this.#containerOffsetX = containerRect.left;
    this.#containerOffsetY = containerRect.top;
    this.#cameraWidth = containerRect.width;
    this.#cameraHeight = containerRect.height;
    this.#cameraCenterX = this.#cameraWidth / 2 + this.#cameraPositionX;
    this.#cameraCenterY = this.#cameraHeight / 2 + this.#cameraPositionY;
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
  worldToCameraMatrix(cameraX: number, cameraY: number, zoom: number): string {
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
      this.#cameraPositionX,
      this.#cameraPositionY,
      this.#zoom,
    );
    // Apply the transformation matrix, and translate the camera to the center of the container
    this.#canvasStyle = `matrix3d(${matrix})`;
  }

  get canvasStyle() {
    return this.#canvasStyle;
  }

  setCameraPosition(x: number, y: number) {
    this.#cameraPositionX = x;
    this.#cameraPositionY = y;
    this.updateCamera();
  }

  setCameraCenterPosition(x: number, y: number) {
    // Set the camera position to the center of the camera view
    this.#cameraPositionX = x - this.#cameraWidth / 2;
    this.#cameraPositionY = y - this.#cameraHeight / 2;
    this.updateCamera();
  }

  getCameraCenterPosition(): [number, number] {
    // Get the center position of the camera view
    const centerX = this.#cameraPositionX + this.#cameraWidth / 2;
    const centerY = this.#cameraPositionY + this.#cameraHeight / 2;
    return [centerX, centerY];
  }

  /**
   * Handle the scroll event to zoom in and out of the camera view
   * @param deltaZoom Amount of scroll
   * @param cameraX The x coordinate of the pointer in the camera view
   * @param cameraY The y coordinate of the pointer in the camera view
   */
  handleScroll(deltaZoom: number, cameraX: number, cameraY: number) {
    if (!this.#config.enableZoom) {
      return;
    }

    // Limit zoom
    if (this.#zoom + deltaZoom < 0.2) {
      deltaZoom = 0.2 - this.#zoom;
    } else if (this.#zoom + deltaZoom > 1) {
      deltaZoom = 1 - this.#zoom;
    }

    if (this.#config.zoomBounds) {
      if (this.#zoom + deltaZoom < this.#config.zoomBounds.min) {
        deltaZoom = 0;
      } else if (this.#zoom + deltaZoom > this.#config.zoomBounds.max) {
        deltaZoom = 0;
      }
    }

    const zoomRatio = this.#zoom / (this.#zoom + deltaZoom); // Ratio of current zoom to new zoom
    // Move camera to zoom in on the mouse position
    if (this.#config.enablePan) {
      this.#cameraPositionX -=
        (this.#cameraWidth / this.#zoom) *
        (zoomRatio - 1) *
        (1 - (this.#cameraWidth * 1.5 - cameraX) / this.#cameraWidth);
      this.#cameraPositionY -=
        (this.#cameraHeight / this.#zoom) *
        (zoomRatio - 1) *
        (1 - (this.#cameraHeight * 1.5 - cameraY) / this.#cameraHeight);
    }
    this.#zoom += deltaZoom;

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
  handlePan(deltaX: number, deltaY: number) {
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPositionX += deltaX / this.#zoom;
    this.#cameraPositionY += deltaY / this.#zoom;

    this.updateCamera();
  }

  /**
   * Should be called when a user presses the pointer down to start panning the camera.
   * This function is the start of a 3-stage process to pan the camera:
   *    handlePanStart -> handlePanDrag -> handlePanEnd
   * This allows camera pans based on the absolute position of the pointer relative to when the pan started.
   */
  handlePanStart() {
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPanStartX = this.#cameraPositionX;
    this.#cameraPanStartY = this.#cameraPositionY;
  }

  /**
   * Updates the camera position based on the change in mouse position, relative to the start of the pan.
   * This function should be called after handlePanStart and before handlePanEnd.
   * @param deltaX  Change in mouse position
   * @param deltaY  Change in mouse position
   */
  handlePanDrag(deltaX: number, deltaY: number) {
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPositionX = -deltaX / this.#zoom + this.#cameraPanStartX;
    this.#cameraPositionY = -deltaY / this.#zoom + this.#cameraPanStartY;
    if (this.#config.panBounds) {
      if (
        this.#config.panBounds.left !== null &&
        this.#cameraPositionX < this.#config.panBounds.left
      ) {
        this.#cameraPositionX = this.#config.panBounds.left + 1;
      }
      if (
        this.#config.panBounds.right !== null &&
        this.#cameraPositionX > this.#config.panBounds.right
      ) {
        this.#cameraPositionX = this.#config.panBounds.right - 1;
      }
      if (
        this.#config.panBounds.top !== null &&
        this.#cameraPositionY < this.#config.panBounds.top
      ) {
        this.#cameraPositionY = this.#config.panBounds.top - 1;
      }
      if (
        this.#config.panBounds.bottom !== null &&
        this.#cameraPositionY > this.#config.panBounds.bottom
      ) {
        this.#cameraPositionY = this.#config.panBounds.bottom + 1;
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
    if (!this.#config.enablePan) {
      return;
    }
    this.#cameraPanStartX = 0;
    this.#cameraPanStartY = 0;
  }

  /**
   * Converts the x and y coordinates of the world to the x and y coordinates of the camera view.
   * @param worldX  The x coordinate of the point in the world
   * @param worldY  The y coordinate of the point in the world
   * @returns The x and y coordinates of the point in the camera view
   */
  getCameraFromWorld(worldX: number, worldY: number): [number, number] {
    const c_x = (worldX - this.#cameraPositionX) * this.#zoom; // + this.#cameraWidth / 2;
    const c_y = (worldY - this.#cameraPositionY) * this.#zoom; // + this.#cameraHeight / 2;

    return [c_x, c_y];
  }

  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the browser viewport.
   * @param cameraX The x coordinate of the point in the camera view
   * @param cameraY The y coordinate of the point in the camera view
   * @returns
   */
  getScreenFromCamera(cameraX: number, cameraY: number): [number, number] {
    const s_x = cameraX + this.#containerOffsetX;
    const s_y = cameraY + this.#containerOffsetY;

    return [s_x, s_y];
  }

  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the world.
   * @param mouseX
   * @param mouseY
   * @returns
   */
  getWorldFromCamera(cameraX: number, cameraY: number): [number, number] {
    const w_x = cameraX / this.#zoom + this.#cameraPositionX;
    const w_y = cameraY / this.#zoom + this.#cameraPositionY;

    return [w_x, w_y];
  }

  getCameraFromScreen(mouseX: number, mouseY: number): [number, number] {
    mouseX = mouseX - this.#containerOffsetX;
    mouseY = mouseY - this.#containerOffsetY;
    return [mouseX, mouseY];
  }

  /**
   * Converts the change in x and y coordinates of the world to the change in x and y coordinates of the camera view.
   * @param worldDeltaX
   * @param worldDeltaY
   * @returns
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
   * Converts the change in x and y coordinates of the camera view to the change in x and y coordinates of the world.
   * @param cameraDeltaX
   * @param cameraDeltaY
   * @returns
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

export default Camera;
