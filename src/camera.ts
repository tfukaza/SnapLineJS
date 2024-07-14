class Camera {
  /**
   * Represents a camera that can be used to pan and zoom the view of a DOM element.
   * This class maintains 3 coordinate systems:
   * - Device coordinates: The x,y coordinates of the pointer on the device screen.
   *   (0,0) is the top left corner of the screen and the x,y coordinates increase as you move right and down.
   * - Camera coordinates: The x,y coordinates of the camera view.
   *   (0,0) is the top left corner of the camera view and the x,y coordinates increase as you move right and down.
   * - World coordinates: The x,y coordinates of the world that the camera is viewing.
   *   (0,0) is the CENTER of the world and the x,y coordinates increase as you move right and down.
   */
  containerDom: HTMLElement; // The DOM that represents the camera view
  containerOffsetX: number; // The x coordinate of the container DOM on the device screen
  containerOffsetY: number; // The y coordinate of the container DOM on the device screen
  canvasDom: HTMLElement; // The dom that the camera is rendering
  cameraWidth: number; // The width of the camera view. This should be the same as the container width.
  cameraHeight: number; // The height of the camera view. This should be the same as the container height.
  cameraPositionX: number; // Position of the center of the camera
  cameraPositionY: number;
  cameraPanStartX: number; // Initial position of the camera when panning
  cameraPanStartY: number;
  zoom: number; // The zoom level of the camera, 1 means no zoom, smaller values zoom out, larger values zoom in

  canvasStyle: string; // The CSS transform style that should be applied to the DOM element

  constructor(container: HTMLElement, canvas: HTMLElement) {
    this.containerDom = container;
    this.containerOffsetX = container.offsetLeft;
    this.containerOffsetY = container.offsetTop;
    this.canvasDom = canvas;
    this.cameraWidth = container.clientWidth;
    this.cameraHeight = container.clientHeight;
    this.cameraPositionX = 0;
    this.cameraPositionY = 0;
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
    this.zoom = 1;

    this.canvasStyle = "";
    this.updateCamera();
  }

  /**
   * Given the x and y coordinates of the camera, the zoom level, and the width and height of the camera,
   * calculates the transformation matrix that converts a x,y coordinate of the DOM to
   * the x,y coordinate of the camera view.
   * @param cameraX   The x coordinate of the point in the world
   * @param cameraY   The y coordinate of the point in the world
   * @param zoom  The zoom level of the camera
   * @param cameraWidth  The width of the camera view
   * @param cameraHeight The height of the camera view
   * @returns A string representing the CSS transform matrix that should be applied to the DOM element
   */
  worldToCameraMatrix(
    cameraX: number,
    cameraY: number,
    zoom: number,
    cameraWidth: number,
    cameraHeight: number,
  ): string {
    const s1 = zoom;
    const s2 = zoom;
    const t1 = -cameraX * zoom + cameraWidth / 2;
    const t2 = -cameraY * zoom + cameraHeight / 2;
    return `${s1},0,0,0,0,${s2},0,0,0,0,1,0,${t1},${t2},0,1`;
  }

  /**
   * Updates the camera view based on the current camera position and zoom level
   */
  updateCamera() {
    const matrix = this.worldToCameraMatrix(
      this.cameraPositionX,
      this.cameraPositionY,
      this.zoom,
      this.containerDom.clientWidth,
      this.containerDom.clientHeight,
    );
    // Apply the transformation matrix, and translate the camera to the center of the container
    this.canvasStyle = `matrix3d(${matrix})`;
  }

  /**
   * Handle the scroll event to zoom in and out of the camera view
   * @param deltaZoom Amount of scroll
   * @param cameraX The x coordinate of the pointer in the camera view
   * @param cameraY The y coordinate of the pointer in the camera view
   */
  handleScroll(deltaZoom: number, cameraX: number, cameraY: number) {
    // Limit zoom
    if (this.zoom + deltaZoom < 0.2) {
      deltaZoom = 0.2 - this.zoom;
    } else if (this.zoom + deltaZoom > 1) {
      deltaZoom = 1 - this.zoom;
    }

    const zoomRatio = this.zoom / (this.zoom + deltaZoom); // Ratio of current zoom to new zoom
    // Move camera to zoom in on the mouse position
    this.cameraPositionX -=
      (this.cameraWidth / this.zoom) *
      (zoomRatio - 1) *
      (1 - (this.cameraWidth * 1.5 - cameraX) / this.cameraWidth);
    this.cameraPositionY -=
      (this.cameraHeight / this.zoom) *
      (zoomRatio - 1) *
      (1 - (this.cameraHeight * 1.5 - cameraY) / this.cameraHeight);

    this.zoom += deltaZoom;

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
    this.cameraPositionX += deltaX / this.zoom;
    this.cameraPositionY += deltaY / this.zoom;
    this.updateCamera();
  }

  /**
   * Should be called when a user presses the pointer down to start panning the camera.
   * This function is the start of a 3-stage process to pan the camera:
   *    handlePanStart -> handlePanDrag -> handlePanEnd
   * This allows camera pans based on the absolute position of the pointer relative to when the pan started.
   */
  handlePanStart() {
    this.cameraPanStartX = this.cameraPositionX;
    this.cameraPanStartY = this.cameraPositionY;
  }

  /**
   * Updates the camera position based on the change in mouse position, relative to the start of the pan.
   * This function should be called after handlePanStart and before handlePanEnd.
   * @param deltaX  Change in mouse position
   * @param deltaY  Change in mouse position
   */
  handlePanDrag(deltaX: number, deltaY: number) {
    this.cameraPositionX = -deltaX / this.zoom + this.cameraPanStartX;
    this.cameraPositionY = -deltaY / this.zoom + this.cameraPanStartY;
    this.updateCamera();
  }

  /**
   * Should be called when a user releases the pointer to end panning the camera.
   * This function is the end of a 3-stage process to pan the camera:
   *    handlePanStart -> handlePanDrag -> handlePanEnd
   */
  handlePanEnd() {
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
  }

  /**
   * Converts the x and y coordinates of the world to the x and y coordinates of the camera view.
   * @param worldX  The x coordinate of the point in the world
   * @param worldY  The y coordinate of the point in the world
   * @returns The x and y coordinates of the point in the camera view
   */
  getCameraFromWorld(worldX: number, worldY: number): [number, number] {
    const c_x =
      (worldX - this.cameraPositionX) * this.zoom + this.cameraWidth / 2;
    const c_y =
      (worldY - this.cameraPositionY) * this.zoom + this.cameraHeight / 2;

    return [c_x, c_y];
  }

  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the device screen.
   * @param cameraX The x coordinate of the point in the camera view
   * @param cameraY The y coordinate of the point in the camera view
   * @returns
   */
  getScreenFromCamera(cameraX: number, cameraY: number): [number, number] {
    const s_x = cameraX + this.containerOffsetX;
    const s_y = cameraY + this.containerOffsetY;

    return [s_x, s_y];
  }

  /**
   * Converts the x and y coordinates of the camera view to the x and y coordinates of the world.
   * @param mouseX
   * @param mouseY
   * @returns
   */
  getWorldFromCamera(cameraX: number, cameraY: number): [number, number] {
    const w_x =
      (cameraX - this.cameraWidth / 2) / this.zoom + this.cameraPositionX;
    const w_y =
      (cameraY - this.cameraHeight / 2) / this.zoom + this.cameraPositionY;

    return [w_x, w_y];
  }

  getCameraFromScreen(mouseX: number, mouseY: number): [number, number] {
    mouseX = mouseX - this.containerOffsetX;
    mouseY = mouseY - this.containerOffsetY;
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
    const c_dx = worldDeltaX * this.zoom;
    const c_dy = worldDeltaY * this.zoom;

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
    const w_dx = cameraDeltaX / this.zoom;
    const w_dy = cameraDeltaY / this.zoom;

    return [w_dx, w_dy];
  }
}

export default Camera;
