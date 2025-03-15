import Camera from "../camera";
import { GlobalManager } from "../global";
import {
  cursorDownProp,
  cursorMoveProp,
  cursorScrollProp,
  cursorState,
  cursorUpProp,
} from "../input";
import { SnapLine } from "../snapline";
import { setDomStyle } from "../helper";
import { ElementObject } from "./object";
class CameraControl extends ElementObject {
  _state: "idle" | "panning" = "idle";
  _mouseDownX: number;
  _mouseDownY: number;
  _canvasElement: HTMLElement | null = null;

  constructor(globals: GlobalManager) {
    super(globals, null);
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._state = "idle";
    this._canvasElement = null;
    this.event.global.onCursorDown = this.onCursorDown;
    this.event.global.onCursorMove = this.onCursorMove;
    this.event.global.onCursorUp = this.onCursorUp;
    this.event.global.onCursorScroll = this.onZoom;
    console.debug("CameraControl constructor");

    this.callback.renderCallback = this.renderCanvas;
  }

  assignCanvas(canvas: HTMLElement) {
    this._canvasElement = canvas;
    setDomStyle(this._canvasElement, {
      position: "relative",
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px",
      transform: this.global.camera?.canvasStyle as string,
    });
  }

  onCursorDown(prop: cursorDownProp) {
    // Ignore if not middle mouse button
    if (prop.button != cursorState.mouseMiddle) {
      return;
    }
    console.log("Begin camera pan");
    this._state = "panning";
    this._mouseDownX = prop.screenX;
    this._mouseDownY = prop.screenY;
    this.global.camera?.handlePanStart();
  }

  onCursorMove(prop: cursorMoveProp) {
    if (prop.button != cursorState.mouseMiddle) {
      return;
    }
    if (this._state != "panning") {
      return;
    }
    const dx = prop.screenX - this._mouseDownX;
    const dy = prop.screenY - this._mouseDownY;
    // console.log("Camera panning", dx, dy);
    this.global.camera?.handlePanDrag(dx, dy);
    this.submitRenderQueue();
  }

  onCursorUp(prop: cursorUpProp) {
    if (this._state != "panning") {
      return;
    }
    console.log("Camera panning end");
    this._state = "idle";
    this.global.camera?.handlePanEnd();
    this.submitRenderQueue();
  }

  onZoom(prop: cursorScrollProp) {
    // console.log("Camera zooming", prop.delta);
    this.global.camera?.handleScroll(
      prop.delta / 2000,
      prop.cameraX,
      prop.cameraY,
    );
    this.submitRenderQueue();
  }

  renderCanvas() {
    // console.log("CameraControl render");
    if (this._canvasElement) {
      //   this._canvasElement.style.transform = this.global.camera
      //     ?.canvasStyle as string;
      setDomStyle(this._canvasElement, {
        transform: this.global.camera?.canvasStyle as string,
      });
    }
  }
}

export { CameraControl };
