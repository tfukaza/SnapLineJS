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

  constructor(globals: GlobalManager) {
    super(globals, null);
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._state = "idle";
    // this._canvasElement = null;
    this.event.global.pointerDown = this.onCursorDown;
    this.event.global.pointerMove = this.onCursorMove;
    this.event.global.pointerUp = this.onCursorUp;
    this.event.global.mouseWheel = this.onZoom;
    this.transformMode = "direct";

    this.dom.style = {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "0px",
      height: "0px",
    };
    this.requestPostWrite();
  }

  onCursorDown(prop: pointerDownProp) {
    if (prop.event.button != 1) {
      return;
    }
    this._state = "panning";
    this._mouseDownX = prop.position.screenX;
    this._mouseDownY = prop.position.screenY;
    this.global.camera?.handlePanStart();
  }

  onCursorMove(prop: pointerMoveProp) {
    if (prop.event!.button != 1) {
      return;
    }
    if (this._state != "panning") {
      return;
    }
    const dx = prop.position.screenX - this._mouseDownX;
    const dy = prop.position.screenY - this._mouseDownY;
    this.global.camera?.handlePanDrag(dx, dy);
    // console.log("pan", this.global.camera?.canvasStyle);
    this.dom.style.transform = this.global.camera?.canvasStyle as string;
    this.requestPostWrite();
    // this.requestPostWrite().then(() => {
    //   this.renderCanvas();
    // });
  }

  onCursorUp(prop: pointerUpProp) {
    if (this._state != "panning") {
      return;
    }
    this._state = "idle";
    this.global.camera?.handlePanEnd();
    this.dom.style.transform = this.global.camera?.canvasStyle as string;
    this.requestPostWrite();
    // this.requestPostWrite().then(() => {
    //   this.renderCanvas();
    // });
  }

  onZoom(prop: mouseWheelProp) {
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
    // console.log("zoom", this.global.camera?.canvasStyle);
    this.dom.style.transform = this.global.camera?.canvasStyle as string;
    this.requestPostWrite();
    // this.requestPostWrite().then(() => {
    //   this.renderCanvas();
    // });
  }

  // renderCanvas() {
  //   // if (this._canvasElement) {
  //   //   setDomStyle(this._canvasElement, {
  //   //     transform: this.global.camera?.canvasStyle as string,
  //   //   });
  //   // }
  //   this.dom.style.transform = this.global.camera?.canvasStyle as string;
  //   this.requestPostWrite();
  // }
}

export { CameraControl };
