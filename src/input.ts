import { GlobalManager } from "./global";
export enum cursorState {
  none = 0,
  mouseLeft = 1,
  mouseMiddle = 2,
  mouseRight = 3,
  touchSingle = 4,
  touchDouble = 5,
  invalid = 4,
}

export interface cursorDownProp {
  event: MouseEvent | TouchEvent;
  element: HTMLElement | null;
  button: cursorState;
  clientX: number;
  clientY: number;
  worldX: number;
  worldY: number;
  cameraX: number;
  cameraY: number;
  screenX: number;
  screenY: number;
  gid: string | null;
}
export interface cursorMoveProp {
  event: MouseEvent | TouchEvent;
  element: HTMLElement | null;
  button: cursorState;
  clientX: number;
  clientY: number;
  worldX: number;
  worldY: number;
  cameraX: number;
  cameraY: number;
  screenX: number;
  screenY: number;
  gid: string | null;
}
export interface cursorUpProp {
  event: MouseEvent | TouchEvent;
  element: HTMLElement | null;
  button: cursorState;
  clientX: number;
  clientY: number;
  worldX: number;
  worldY: number;
  cameraX: number;
  cameraY: number;
  screenX: number;
  screenY: number;
  gid: string | null;
}

export interface cursorScrollProp {
  event: WheelEvent;
  element: HTMLElement | null;
  button: cursorState;
  clientX: number;
  clientY: number;
  worldX: number;
  worldY: number;
  cameraX: number;
  cameraY: number;
  screenX: number;
  screenY: number;
  delta: number;
  gid: string | null;
}

class InputEventCallback {
  _mouseDownCallback: null | ((prop: cursorDownProp) => void);
  _mouseMoveCallback: null | ((prop: cursorMoveProp) => void);
  _mouseUpCallback: null | ((prop: cursorUpProp) => void);
  _mouseWheelCallback: null | ((prop: cursorScrollProp) => void);
  _touchStartCallback: null | ((prop: cursorDownProp) => void);
  _touchMoveCallback: null | ((prop: cursorMoveProp) => void);
  _touchEndCallback: null | ((prop: cursorUpProp) => void);
  _touchPinchCallback: null | ((prop: cursorScrollProp) => void);

  constructor() {
    this._mouseDownCallback = null;
    this._mouseMoveCallback = null;
    this._mouseUpCallback = null;
    this._mouseWheelCallback = null;
    this._touchStartCallback = null;
    this._touchMoveCallback = null;
    this._touchEndCallback = null;
    this._touchPinchCallback = null;
  }

  set mouseDownCallback(callback: (prop: cursorDownProp) => void) {
    this._mouseDownCallback = callback;
  }

  get mouseDownCallback() {
    if (!this._mouseDownCallback) {
      return () => {};
    }
    return this._mouseDownCallback;
  }

  set mouseMoveCallback(callback: (prop: cursorMoveProp) => void) {
    this._mouseMoveCallback = callback;
  }

  get mouseMoveCallback() {
    if (!this._mouseMoveCallback) {
      return () => {};
    }
    return this._mouseMoveCallback;
  }

  set mouseUpCallback(callback: (prop: cursorUpProp) => void) {
    this._mouseUpCallback = callback;
  }

  get mouseUpCallback() {
    if (!this._mouseUpCallback) {
      return () => {};
    }
    return this._mouseUpCallback;
  }

  set mouseWheelCallback(callback: (prop: cursorScrollProp) => void) {
    this._mouseWheelCallback = callback;
  }

  get mouseWheelCallback() {
    if (!this._mouseWheelCallback) {
      return () => {};
    }
    return this._mouseWheelCallback;
  }

  set touchStartCallback(callback: (prop: cursorDownProp) => void) {
    this._touchStartCallback = callback;
  }

  get touchStartCallback() {
    if (!this._touchStartCallback) {
      return () => {};
    }
    return this._touchStartCallback;
  }

  set touchMoveCallback(callback: (prop: cursorMoveProp) => void) {
    this._touchMoveCallback = callback;
  }

  get touchMoveCallback() {
    if (!this._touchMoveCallback) {
      return () => {};
    }
    return this._touchMoveCallback;
  }

  set touchEndCallback(callback: (prop: cursorUpProp) => void) {
    this._touchEndCallback = callback;
  }

  get touchEndCallback() {
    if (!this._touchEndCallback) {
      return () => {};
    }
    return this._touchEndCallback;
  }

  set touchPinchCallback(callback: (prop: cursorScrollProp) => void) {
    this._touchPinchCallback = callback;
  }

  get touchPinchCallback() {
    if (!this._touchPinchCallback) {
      return () => {};
    }
    return this._touchPinchCallback;
  }
}

export type touchData = {
  x: number;
  y: number;
  target: Element | null;
  identifier: number;
};

class InputControl {
  /**
   * Functions as a middleware that converts mouse and touch events into a unified event format.
   */
  _domElement: HTMLElement | null;
  global: GlobalManager;
  _pointerMode: "pointer" | "gesture" | "none";

  _sortedTouchArray: touchData[]; // List of touches for touch events, sorted by the times they are pressed
  _sortedTouchDict: { [key: number]: touchData }; // Dictionary of touches for touch events, indexed by the touch identifier

  event: InputEventCallback;

  constructor(global: GlobalManager) {
    this.global = global;
    this._pointerMode = "none";
    this._domElement = null;

    this._sortedTouchArray = [];
    this._sortedTouchDict = {};

    this.event = new InputEventCallback();
  }

  convertMouseToCursorState(buttons: number): cursorState {
    switch (buttons) {
      case 1:
        return cursorState.mouseLeft;
      case 2:
        return cursorState.mouseRight;
      case 4:
        return cursorState.mouseMiddle;
      default:
        return cursorState.none;
    }
  }

  /**
   * Called when the user pressed the mouse button
   * @param e
   * @returns
   */
  onMouseDown(e: MouseEvent) {
    const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
      e.clientX,
      e.clientY,
    );
    const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
      cameraX,
      cameraY,
    );
    this.event.mouseDownCallback({
      event: e,
      element: e.target as HTMLElement | null,
      button: this.convertMouseToCursorState(e.buttons),
      clientX: e.clientX,
      clientY: e.clientY,
      worldX: worldX,
      worldY: worldY,
      cameraX: cameraX,
      cameraY: cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      gid: null,
    });
    e.stopPropagation();
  }

  /**
   * Called when the user moves the mouse
   * @param e
   */
  onMouseMove(e: MouseEvent) {
    const element = document?.elementFromPoint(e.clientX, e.clientY);
    const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
      e.clientX,
      e.clientY,
    );
    const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
      cameraX,
      cameraY,
    );
    this.event.mouseMoveCallback({
      event: e,
      element: element as HTMLElement | null,
      button: this.convertMouseToCursorState(e.buttons),
      clientX: e.clientX,
      clientY: e.clientY,
      worldX: worldX,
      worldY: worldY,
      cameraX: cameraX,
      cameraY: cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      gid: null,
    });
    e.stopPropagation();
  }

  /**
   * Called when the user releases the mouse button
   * @param e
   */
  onMouseUp(e: MouseEvent) {
    const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
      e.clientX,
      e.clientY,
    );
    const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
      cameraX,
      cameraY,
    );
    this.event.mouseUpCallback({
      event: e,
      element: e.target as HTMLElement | null,
      button: this.convertMouseToCursorState(e.buttons),
      clientX: e.clientX,
      clientY: e.clientY,
      worldX: worldX,
      worldY: worldY,
      cameraX: cameraX,
      cameraY: cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      gid: null,
    });
    e.stopPropagation();
  }

  /**
   * Called when the user scrolls the mouse wheel
   * @param e
   */
  onWheel(e: WheelEvent) {
    const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
      e.clientX,
      e.clientY,
    );
    const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
      cameraX,
      cameraY,
    );
    this.event.mouseWheelCallback({
      event: e,
      element: e.target as HTMLElement | null,
      button: cursorState.mouseMiddle,
      clientX: e.clientX,
      clientY: e.clientY,
      worldX: worldX,
      worldY: worldY,
      cameraX: cameraX,
      cameraY: cameraY,
      screenX: e.clientX,
      screenY: e.clientY,
      delta: e.deltaY,
      gid: null,
    });
  }

  /**
   * Called when the user presses a key
   * @param e
   * @returns
   */
  // onKeyDown(e: KeyboardEvent) {
  //   this._onKeyDown?.(e);
  // }

  onTouchStart(e: TouchEvent) {
    const newTouchList = e.changedTouches;
    const prevSortedTouchArrayLength = this._sortedTouchArray.length;
    // Add the touch to the touch list
    for (let i = 0; i < newTouchList.length; i++) {
      const touch = newTouchList[i];
      if (touch) {
        const data = {
          x: touch.clientX,
          y: touch.clientY,
          target: touch.target as Element | null,
          identifier: touch.identifier,
        };

        this._sortedTouchArray.unshift(data);
        this._sortedTouchDict[touch.identifier] = data;
      }
    }

    if (this._sortedTouchArray.length === 1) {
      let [clientX, clientY] = [
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y,
      ];
      const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
        clientX,
        clientY,
      );
      const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
        cameraX,
        cameraY,
      );
      this.event.touchStartCallback({
        event: e,
        element: this._sortedTouchArray[0].target as HTMLElement | null,
        button: cursorState.mouseLeft,
        clientX: clientX,
        clientY: clientY,
        worldX: worldX,
        worldY: worldY,
        cameraX: cameraX,
        cameraY: cameraY,
        screenX: clientX,
        screenY: clientY,
        gid: null,
      });
      return;
    }

    if (this._sortedTouchArray.length === 2) {
      if (prevSortedTouchArrayLength === 1) {
        let [clientX, clientY] = [
          this._sortedTouchArray[1].x,
          this._sortedTouchArray[1].y,
        ];
        const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
          clientX,
          clientY,
        );
        const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
          cameraX,
          cameraY,
        );
        this.event.touchStartCallback({
          event: e,
          element: this._sortedTouchArray[1].target as HTMLElement | null,
          button: cursorState.mouseLeft,
          clientX: clientX,
          clientY: clientY,
          worldX: worldX,
          worldY: worldY,
          cameraX: cameraX,
          cameraY: cameraY,
          screenX: clientX,
          screenY: clientY,
          gid: null,
        });
      }
      const middleX =
        (this._sortedTouchArray[0].x + this._sortedTouchArray[1].x) / 2;
      const middleY =
        (this._sortedTouchArray[0].y + this._sortedTouchArray[1].y) / 2;
      const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
        middleX,
        middleY,
      );
      const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
        cameraX,
        cameraY,
      );
      this.event.touchStartCallback({
        event: e,
        element: this._sortedTouchArray[0].target as HTMLElement | null,
        button: cursorState.mouseMiddle,
        clientX: middleX,
        clientY: middleY,
        worldX: worldX,
        worldY: worldY,
        cameraX: cameraX,
        cameraY: cameraY,
        screenX: middleX,
        screenY: middleY,
        gid: null,
      });
      return;
    }
  }

  onTouchMove(e: TouchEvent) {
    const updatedTouchArray = e.touches;
    const prevTouch_0 =
      this._sortedTouchArray.length > 0
        ? { ...this._sortedTouchArray[0] }
        : null;
    const prevTouch_1 =
      this._sortedTouchArray.length > 1
        ? { ...this._sortedTouchArray[1] }
        : null;

    for (let i = 0; i < updatedTouchArray.length; i++) {
      const touch = updatedTouchArray[i];
      if (touch) {
        const data = this._sortedTouchDict[touch.identifier];
        data.x = touch.clientX;
        data.y = touch.clientY;
        data.target = touch.target as Element | null;
      }
    }

    // If there is only one touch point, treat it as a mouse event
    if (this._sortedTouchArray.length === 1) {
      let [clientX, clientY] = [
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y,
      ];
      const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
        clientX,
        clientY,
      );
      const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
        cameraX,
        cameraY,
      );
      this.event.touchMoveCallback({
        event: e,
        element: this._sortedTouchArray[0].target as HTMLElement | null,
        button: cursorState.mouseLeft,
        clientX: clientX,
        clientY: clientY,
        worldX: worldX,
        worldY: worldY,
        cameraX: cameraX,
        cameraY: cameraY,
        screenX: clientX,
        screenY: clientY,
        gid: null,
      });
      return;
    }

    if (this._sortedTouchArray.length < 2) {
      return;
    }

    const middleX =
      (this._sortedTouchArray[0].x + this._sortedTouchArray[1].x) / 2;
    const middleY =
      (this._sortedTouchArray[0].y + this._sortedTouchArray[1].y) / 2;
    const span = Math.sqrt(
      Math.pow(this._sortedTouchArray[0].x - this._sortedTouchArray[1].x, 2) +
        Math.pow(this._sortedTouchArray[0].y - this._sortedTouchArray[1].y, 2),
    );

    let deltaSpan = 0;

    if (prevTouch_0 && prevTouch_1) {
      const prevSpan = Math.sqrt(
        Math.pow(prevTouch_0.x - prevTouch_1.x, 2) +
          Math.pow(prevTouch_0.y - prevTouch_1.y, 2),
      );
      deltaSpan = span - prevSpan;
    }

    const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
      middleX,
      middleY,
    );
    const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
      cameraX,
      cameraY,
    );

    this.event.touchMoveCallback({
      event: e,
      element: this._sortedTouchArray[0].target as HTMLElement | null, // TODO: find element at middle of two touch points
      button: cursorState.mouseMiddle,
      clientX: middleX,
      clientY: middleY,
      worldX: worldX,
      worldY: worldY,
      cameraX: cameraX,
      cameraY: cameraY,
      screenX: middleX,
      screenY: middleY,
      gid: null,
    });
    this.event.touchPinchCallback({
      event: e as unknown as WheelEvent,
      element: this._sortedTouchArray[0].target as HTMLElement | null,
      button: cursorState.mouseMiddle,
      clientX: middleX,
      clientY: middleY,
      worldX: worldX,
      worldY: worldY,
      cameraX: cameraX,
      cameraY: cameraY,
      screenX: middleX,
      screenY: middleY,
      delta: deltaSpan,
      gid: null,
    });
  }

  onTouchEnd(e: TouchEvent) {
    const endTouchIDs: number[] = [];
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch) {
        endTouchIDs.push(touch.identifier);
      }
    }
    const deletedTouchArray = this._sortedTouchArray.filter((touch) =>
      endTouchIDs.includes(touch.identifier),
    );
    const prevSortedTouchArrayLength = this._sortedTouchArray.length;
    this._sortedTouchArray = this._sortedTouchArray.filter(
      (touch) => !endTouchIDs.includes(touch.identifier),
    );
    for (let id of endTouchIDs) {
      delete this._sortedTouchDict[id];
    }

    if (deletedTouchArray.length > 0) {
      if (prevSortedTouchArrayLength === 1) {
        let [clientX, clientY] = [
          deletedTouchArray[0].x,
          deletedTouchArray[0].y,
        ];
        const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
          clientX,
          clientY,
        );
        const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
          cameraX,
          cameraY,
        );
        this.event.touchEndCallback({
          event: e,
          element: deletedTouchArray[0].target as HTMLElement | null,
          button: cursorState.mouseLeft,
          clientX: clientX,
          clientY: clientY,
          worldX: worldX,
          worldY: worldY,
          cameraX: cameraX,
          cameraY: cameraY,
          screenX: clientX,
          screenY: clientY,
          gid: null,
        });
        return;
      }

      if (prevSortedTouchArrayLength === 2) {
        let [clientX, clientY] = [
          deletedTouchArray[0].x,
          deletedTouchArray[0].y,
        ];
        const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
          clientX,
          clientY,
        );
        const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
          cameraX,
          cameraY,
        );
        this.event.touchEndCallback({
          event: e,
          element: deletedTouchArray[0].target as HTMLElement | null,
          button: cursorState.mouseLeft,
          clientX: clientX,
          clientY: clientY,
          worldX: worldX,
          worldY: worldY,
          cameraX: cameraX,
          cameraY: cameraY,
          screenX: clientX,
          screenY: clientY,
          gid: null,
        });
      }
    }
  }

  addCursorEventListener(dom: HTMLElement) {
    dom.addEventListener("mousedown", (e: MouseEvent) => {
      this.onMouseDown(e);
    });
    dom.addEventListener("mousemove", (e: MouseEvent) => {
      this.onMouseMove(e);
    });
    dom.addEventListener("mouseup", (e: MouseEvent) => {
      this.onMouseUp(e);
    });
    dom.addEventListener("wheel", (e: WheelEvent) => {
      this.onWheel(e);
    });
    dom.addEventListener("touchstart", (e: TouchEvent) => {
      this.onTouchStart(e);
      e.stopPropagation();
    });
    dom.addEventListener("touchmove", (e: TouchEvent) => {
      this.onTouchMove(e);
      e.stopPropagation();
    });
    dom.addEventListener("touchend", (e: TouchEvent) => {
      this.onTouchEnd(e);
    });
  }
}

export { InputControl };
