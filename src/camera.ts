class Camera {
  /**
   * Represents a camera that can be used to pan and zoom the view of a DOM element.
   */
  containerDom: HTMLElement; // The DOM that represents the camera view
  canvasDom: HTMLElement; // The dom that the camera is rendering
  cameraWidth: number; // The width of the camera view
  cameraHeight: number; // The height of the camera view
  cameraX: number; // Position of the center of the camera
  cameraY: number;
  cameraPanStartX: number; // Initial position of the camera when panning
  cameraPanStartY: number;
  zoom: number; // The zoom level of the camera, 1 means no zoom, smaller values zoom out, larger values zoom in

  canvasStyle: string; // The CSS transform style that should be applied to the DOM element

  constructor(container: HTMLElement, canvas: HTMLElement) {
    this.containerDom = container;
    this.canvasDom = canvas;
    this.cameraWidth = container.clientWidth;
    this.cameraHeight = container.clientHeight;
    this.cameraX = 0;
    this.cameraY = 0;
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

  updateCamera() {
    const matrix = this.worldToCameraMatrix(
      this.cameraX,
      this.cameraY,
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
   * @param mouseX Position of the mouse on the device screen
   * @param mouseY
   */
  handleScroll(deltaZoom: number, mouseX: number, mouseY: number) {
    // Mouse position should be relative to the container
    mouseX -= this.containerDom.offsetLeft;
    mouseY -= this.containerDom.offsetTop;

    // Limit zoom
    if (this.zoom + deltaZoom < 0.2) {
      deltaZoom = 0.2 - this.zoom;
    } else if (this.zoom + deltaZoom > 1) {
      deltaZoom = 1 - this.zoom;
    }

    // console.debug(
    //   `MouseX: ${mouseX}, MouseY: ${mouseY}, cameraWidth: ${this.cameraWidth}, cameraHeight: ${this.cameraHeight}`,
    // );

    const zoomRatio = this.zoom / (this.zoom + deltaZoom); // Ratio of current zoom to new zoom
    // Move camera to zoom in on the mouse position
    this.cameraX -=
      (this.cameraWidth / this.zoom) *
      (zoomRatio - 1) *
      (1 - (this.cameraWidth * 1.5 - mouseX) / this.cameraWidth);
    this.cameraY -=
      (this.cameraHeight / this.zoom) *
      (zoomRatio - 1) *
      (1 - (this.cameraHeight * 1.5 - mouseY) / this.cameraHeight);

    this.zoom += deltaZoom;

    // console.log(
    //   (this.cameraWidth / this.zoom) *
    //     (zoomRatio - 1) *
    //     (1 - (this.cameraWidth * 1.5 - mouseX) / this.cameraWidth),
    // );

    this.updateCamera();
  }

  handlePan(deltaX: number, deltaY: number) {
    this.cameraX += deltaX / this.zoom;
    this.cameraY += deltaY / this.zoom;
    this.updateCamera();
  }

  handlePanStart() {
    this.cameraPanStartX = this.cameraX;
    this.cameraPanStartY = this.cameraY;
  }

  handlePanDrag(deltaX: number, deltaY: number) {
    this.cameraX = -deltaX / this.zoom + this.cameraPanStartX;
    this.cameraY = -deltaY / this.zoom + this.cameraPanStartY;
    this.updateCamera();
  }

  handlePanEnd() {
    this.cameraPanStartX = 0;
    this.cameraPanStartY = 0;
  }

  getCameraFromWorld(worldX: number, worldY: number): [number, number] {
    const c_x = (worldX - this.cameraX) * this.zoom + this.cameraWidth / 2;
    const c_y = (worldY - this.cameraY) * this.zoom + this.cameraHeight / 2;

    return [c_x, c_y];
  }

  getWorldFromCamera(mouseX: number, mouseY: number): [number, number] {
    mouseX = mouseX - this.containerDom.offsetLeft;
    mouseY = mouseY - this.containerDom.offsetTop;
    const w_x = (mouseX - this.cameraWidth / 2) / this.zoom + this.cameraX;
    const w_y = (mouseY - this.cameraHeight / 2) / this.zoom + this.cameraY;

    return [w_x, w_y];
  }

  getCameraDeltaFromWorldDelta(
    worldDeltaX: number,
    worldDeltaY: number,
  ): [number, number] {
    const c_dx = worldDeltaX * this.zoom;
    const c_dy = worldDeltaY * this.zoom;

    return [c_dx, c_dy];
  }

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
