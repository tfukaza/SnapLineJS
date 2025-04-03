import { GlobalManager } from "../global";
import {
  cursorDownProp,
  cursorMoveProp,
  cursorScrollProp,
  cursorState,
  cursorUpProp,
} from "../input";
import { setDomStyle } from "../util";
import { ElementObject } from "../object";

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
    if (prop.button != cursorState.mouseMiddle) {
      return;
    }
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
    this.global.camera?.handlePanDrag(dx, dy);
    this.requestPostWrite().then(() => {
      this.renderCanvas();
    });
  }

  onCursorUp(prop: cursorUpProp) {
    if (this._state != "panning") {
      return;
    }
    this._state = "idle";
    this.global.camera?.handlePanEnd();
    this.requestPostWrite().then(() => {
      this.renderCanvas();
    });
  }

  onZoom(prop: cursorScrollProp) {
    let camera = this.global.camera!;
    if (
      prop.screenX < camera.containerOffsetX ||
      prop.screenX > camera.containerOffsetX + camera.cameraWidth ||
      prop.screenY < camera.containerOffsetY ||
      prop.screenY > camera.containerOffsetY + camera.cameraHeight
    ) {
      return;
    }
    this.global.camera?.handleScroll(
      prop.delta / 2000,
      prop.cameraX,
      prop.cameraY,
    );
    this.requestPostWrite().then(() => {
      this.renderCanvas();
    });
  }

  renderCanvas() {
    if (this._canvasElement) {
      setDomStyle(this._canvasElement, {
        transform: this.global.camera?.canvasStyle as string,
      });
    }
  }
}

export { CameraControl };
