import { GlobalManager } from "../global";
import {
  pointerDownProp,
  pointerMoveProp,
  pointerUpProp,
  mouseWheelProp,
} from "../input";
import { ElementObject } from "../object";

class CameraControl extends ElementObject {
  _state: "idle" | "panning" = "idle";
  _mouseDownX: number;
  _mouseDownY: number;
  // _canvasElement: HTMLElement | null = null;
  zoomLock: boolean;
  panLock: boolean;

  resizeObserver: ResizeObserver | null = null;

  #prevCenterX: number = 0;
  #prevCenterY: number = 0;

  constructor(
    globals: GlobalManager,
    zoomLock: boolean = false,
    panLock: boolean = false,
  ) {
    super(globals, null);
    this.zoomLock = zoomLock;
    this.panLock = panLock;
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._state = "idle";
    // this._canvasElement = null;
    this.event.global.pointerDown = this.onCursorDown;
    this.event.global.pointerMove = this.onCursorMove;
    this.event.global.pointerUp = this.onCursorUp;
    this.event.global.mouseWheel = this.onZoom;
    this.transformMode = "direct";

    this.style = {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px",
    };
    this.requestTransform("WRITE_2");

    this.resizeObserver = null;

    this.#prevCenterX = 0;
    this.#prevCenterY = 0;

    this.global.snapline!.event.containerElementAssigned = () => {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateCameraCenterPosition(this.#prevCenterX, this.#prevCenterY);
        this.paintCamera();
      });
      this.resizeObserver.observe(this.global.containerElement!);
      this.resizeObserver.observe(window.document.body);
    };
  }

  paintCamera() {
    this.global.camera?.updateCameraProperty();
    this.global.camera?.updateCamera();
    this.style.transform = this.global.camera?.canvasStyle as string;
    this.requestTransform("WRITE_2");
  }

  updateCameraCenterPosition(x: number = 0, y: number = 0) {
    this.global.camera?.setCameraCenterPosition(x, y);
    [this.#prevCenterX, this.#prevCenterY] =
      this.global.camera?.getCameraCenterPosition() || [0, 0];
    this.paintCamera();
  }

  setCameraPosition(x: number, y: number) {
    this.global.camera?.setCameraPosition(x, y);
    this.paintCamera();
  }

  setCameraCenterPosition(x: number, y: number) {
    this.global.camera?.setCameraCenterPosition(x, y);
    this.paintCamera();
  }

  getCameraCenterPosition() {
    return this.global.camera?.getCameraCenterPosition() || { x: 0, y: 0 };
  }

  onCursorDown(prop: pointerDownProp) {
    if (prop.event.button != 1) {
      return;
    }
    if (this.panLock) {
      return;
    }
    this._state = "panning";
    this._mouseDownX = prop.position.screenX;
    this._mouseDownY = prop.position.screenY;
    this.global.camera?.handlePanStart();
    prop.event.preventDefault();
  }

  onCursorMove(prop: pointerMoveProp) {
    if (this._state != "panning") {
      return;
    }
    const dx = prop.position.screenX - this._mouseDownX;
    const dy = prop.position.screenY - this._mouseDownY;
    this.global.camera?.handlePanDrag(dx, dy);
    this.style.transform = this.global.camera?.canvasStyle as string;
    this.requestTransform("WRITE_2");
  }

  onCursorUp(prop: pointerUpProp) {
    if (this._state != "panning") {
      return;
    }
    this._state = "idle";
    this.global.camera?.handlePanEnd();
    this.style.transform = this.global.camera?.canvasStyle as string;
    [this.#prevCenterX, this.#prevCenterY] =
      this.global.camera?.getCameraCenterPosition() || [0, 0];
    this.requestTransform("WRITE_2");
  }

  onZoom(prop: mouseWheelProp) {
    if (this.zoomLock) {
      return;
    }
    let camera = this.global.camera!;
    if (
      prop.position.screenX < camera.containerOffsetX ||
      prop.position.screenX > camera.containerOffsetX + camera.cameraWidth ||
      prop.position.screenY < camera.containerOffsetY ||
      prop.position.screenY > camera.containerOffsetY + camera.cameraHeight
    ) {
      return;
    }
    this.global.camera?.handleScroll(
      prop.delta / 2000,
      prop.position.cameraX,
      prop.position.cameraY,
    );
    this.style.transform = this.global.camera?.canvasStyle as string;
    this.requestTransform("WRITE_2");
    prop.event.preventDefault();
  }
}

export { CameraControl };
