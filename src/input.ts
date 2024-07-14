import interact from "interactjs";

export enum cursorState {
  none = 0,
  mouseLeft = 1,
  mouseMiddle = 2,
  mouseRight = 3,
  touchSingle = 4,
  touchDouble = 5,
  invalid = 4,
}

export type callbackFunction = (
  event: Event,
  element: Element | null,
  cursorState: cursorState,
  x: number,
  y: number,
) => void;

export type scrollCallbackFunction = (
  event: Event,
  element: Element | null,
  cursorState: cursorState,
  x: number,
  y: number,
  delta: number,
) => void;

export type keyCallbackFunction = (event: KeyboardEvent) => void;

class InputControl {
  /**
   * Functions as a middleware that converts mouse and touch events into a unified event format.
   */
  _dom: HTMLElement;
  _touchControl: any;

  _onCursorDown: null | callbackFunction;
  _onCursorMove: null | callbackFunction;
  _onCursorUp: null | callbackFunction;
  _onScroll: null | scrollCallbackFunction;
  _onRotate: null | scrollCallbackFunction;
  _onKeyDown: null | keyCallbackFunction;

  _pointerMode: "pointer" | "gesture" | "none";

  _currentCursorState: cursorState;

  constructor(dom: HTMLElement) {
    // dom.addEventListener("mouseup", this.onMouseUp.bind(this));
    // dom.addEventListener("mousemove", this.onMouseMove.bind(this));
    // dom.addEventListener("mousedown", this.onMouseDown.bind(this));
    dom.addEventListener("wheel", this.onWheel.bind(this));
    dom.addEventListener("keydown", this.onKeyDown.bind(this));

    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));

    this._onCursorDown = null;
    this._onCursorMove = null;
    this._onCursorUp = null;
    this._onScroll = null;
    this._onRotate = null;
    this._onKeyDown = null;

    this._currentCursorState = cursorState.none;

    this._pointerMode = "none";

    this._dom = dom;
    this._touchControl = interact(dom);
    this._touchControl
      .on("down", (e: PointerEvent) => {
        console.log("Pointer down");
        this._callFuncWithCallbackParam(this._onCursorDown, e);
        this._pointerMode = "pointer";
      })
      .on("move", (e: PointerEvent) => {
        if (this._pointerMode === "gesture") {
          return;
        }
        console.log("Pointer move");
        this._callFuncWithCallbackParam(this._onCursorMove, e);
      })
      .on("up", (e: PointerEvent) => {
        console.log("Pointer up");
        this._callFuncWithCallbackParam(this._onCursorUp, e);
        this._pointerMode = "none";
      });

    this._touchControl.gesturable({
      onstart: (e: any) => {
        console.log("Gesture start");
        if (this._pointerMode === "pointer") {
          this._callFuncWithCallbackParam(this._onCursorUp, e);
        }
        e.button = 1; // Middle mouse button, indicating a camera pan
        this._callFuncWithCallbackParam(this._onCursorDown, e);
        this._pointerMode = "gesture";
      },
      onmove: (e: any) => {
        if (this._pointerMode !== "gesture") {
          this._pointerMode = "gesture";
        }

        console.log("Gesture move");
        e.button = 1; // Middle mouse button, indicating a camera pan
        this._callFuncWithCallbackParam(this._onCursorMove, e);
        this._callFuncWithScrollCallbackParam(this._onScroll, e, e.ds);
      },
      onend: (e: any) => {
        console.log("end");
        e.button = 1; // Middle mouse button, indicating a camera pan
        this._callFuncWithCallbackParam(this._onCursorUp, e);
        this._pointerMode = "none";
      },
    });
  }

  private _callFuncWithCallbackParam(
    func: callbackFunction | null,
    e: PointerEvent,
  ) {
    func?.(
      e,
      e.target instanceof Element ? e.target : null,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY,
    );
  }

  private _callFuncWithScrollCallbackParam(
    func: scrollCallbackFunction | null,
    e: PointerEvent,
    delta: number,
  ) {
    func?.(
      e,
      e.target instanceof Element ? e.target : null,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY,
      delta,
    );
  }

  setCursorDownCallback(callback: callbackFunction) {
    this._onCursorDown = callback;
  }

  setCursorMoveCallback(callback: callbackFunction) {
    this._onCursorMove = callback;
  }

  setCursorUpCallback(callback: callbackFunction) {
    this._onCursorUp = callback;
  }

  setScrollCallback(callback: scrollCallbackFunction) {
    this._onScroll = callback;
  }

  setRotateCallback(callback: scrollCallbackFunction) {
    this._onRotate = callback;
  }

  setKeyDownCallback(callback: keyCallbackFunction) {
    this._onKeyDown = callback;
  }

  convertMouseToCursorState(button: number): cursorState {
    switch (button) {
      case 0:
        return cursorState.mouseLeft;
      case 1:
        return cursorState.mouseMiddle;
      case 2:
        return cursorState.mouseRight;
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
    this._onCursorDown?.(
      e,
      e.target instanceof Element ? e.target : null,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY,
    );
  }

  /**
   * Called when the user moves the mouse
   * @param e
   */
  onMouseMove(e: MouseEvent) {
    const element = document.elementFromPoint(e.clientX, e.clientY);

    this._onCursorMove?.(
      e,
      element,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY,
    );
  }

  /**
   * Called when the user releases the mouse button
   * @param e
   */
  onMouseUp(e: MouseEvent) {
    this._onCursorUp?.(
      e,
      e.target instanceof Element ? e.target : null,
      this.convertMouseToCursorState(e.button),
      e.clientX,
      e.clientY,
    );
  }

  /**
   * Called when the user scrolls the mouse wheel
   * @param e
   */
  onWheel(e: WheelEvent) {
    this._onScroll?.(
      e,
      e.target instanceof Element ? e.target : null,
      cursorState.mouseMiddle,
      e.clientX,
      e.clientY,
      e.deltaY / 1000,
    );
  }

  /**
   * Called when the user presses a key
   * @param e
   * @returns
   */
  onKeyDown(e: KeyboardEvent) {
    this._onKeyDown?.(e);
  }
}

export { InputControl };
