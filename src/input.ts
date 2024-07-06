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

  _onCursorDown: null | callbackFunction;
  _onCursorMove: null | callbackFunction;
  _onCursorUp: null | callbackFunction;
  _onScroll: null | scrollCallbackFunction;
  // _onRotate: null | scrollCallbackFunction;
  _onKeyDown: null | keyCallbackFunction;

  _prevTouchList: TouchEvent["touches"] | null;
  _prevDoubleTouchDistance: number;
  _currentCursorState: cursorState;

  constructor(dom: HTMLElement) {
    this._dom = dom;

    dom.addEventListener("mouseup", this.onMouseUp.bind(this));
    dom.addEventListener("mousemove", this.onMouseMove.bind(this));
    dom.addEventListener("mousedown", this.onMouseDown.bind(this));
    dom.addEventListener("wheel", this.onWheel.bind(this));
    dom.addEventListener("keydown", this.onKeyDown.bind(this));
    dom.addEventListener("touchstart", this.onTouchStart.bind(this));
    dom.addEventListener("touchmove", this.onTouchMove.bind(this));
    dom.addEventListener("touchend", this.onTouchEnd.bind(this));

    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));

    this._onCursorDown = null;
    this._onCursorMove = null;
    this._onCursorUp = null;
    this._onScroll = null;
    this._onKeyDown = null;

    this._currentCursorState = cursorState.none;
    this._prevTouchList = null;
    this._prevDoubleTouchDistance = -1;
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

  convertMouseToCursorState(button: number): cursorState {
    switch (button) {
      case 0:
        return cursorState.mouseLeft;
      case 1:
        return cursorState.mouseMiddle;
      case 2:
        return cursorState.mouseRight;
      default:
        return cursorState.invalid;
    }
  }

  /**
   * Called when a new touch point is detected on the screen
   * @param e
   * @returns
   */
  onTouchStart(e: TouchEvent) {
    if (e.touches.length > 1) {
      // If there was only one touch previously, it means up until now it has been handled as a mouse press or drag.
      // Call the cursor up handler to reset the state
      if (this._prevTouchList && this._prevTouchList.length == 1) {
        this._onCursorUp?.(
          e,
          e.target instanceof Element ? e.target : null,
          cursorState.touchSingle,
          e.touches[0].clientX,
          e.touches[0].clientY,
        );
      }

      this._currentCursorState = cursorState.touchDouble;

      // If there are 3 or more touches, use the 2 most recent touches
      const touch1 = e.touches[e.touches.length - 2];
      const touch2 = e.touches[e.touches.length - 1];
      // Use the middle of the two touches as the mouse position.
      const middleX = (touch1.clientX + touch2.clientX) / 2;
      const middleY = (touch1.clientY + touch2.clientY) / 2;

      const element = document.elementFromPoint(middleX, middleY);

      this._onCursorDown?.(
        e,
        element,
        cursorState.touchDouble,
        middleX,
        middleY,
      );

      this._prevTouchList = e.touches;
      this._prevDoubleTouchDistance = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) +
          Math.pow(touch1.clientY - touch2.clientY, 2),
      );
      return;
    }

    // If there is only one touch, treat it as a left mouse button press.
    this._onCursorDown?.(
      e,
      e.target instanceof Element ? e.target : null,
      cursorState.touchSingle,
      e.touches[0].clientX,
      e.touches[0].clientY,
    );
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
   * Called when the user drags the touch point along the screen
   * @param e
   */
  onTouchMove(e: TouchEvent) {
    // Single touch move is same as mouse drag
    if (e.touches.length == 1) {
      const element = document.elementFromPoint(
        e.touches[0].clientX,
        e.touches[0].clientY,
      );

      this._onCursorMove?.(
        e,
        element,
        cursorState.touchSingle,
        e.touches[0].clientX,
        e.touches[0].clientY,
      );
      this._prevTouchList = e.touches;
      return;
    }

    if (this._prevTouchList == null) {
      this._prevTouchList = e.touches;
      return;
    }

    const curTouch1 = e.touches[e.touches.length - 2];
    const curTouch2 = e.touches[e.touches.length - 1];

    let prevTouch1 = null;
    let prevTouch2 = null;

    // Find the previous touch positions for each finger
    for (let i = 0; i < e.touches.length; i++) {
      if (curTouch1.identifier == this._prevTouchList[i].identifier) {
        prevTouch1 = this._prevTouchList[i];
      } else if (curTouch2.identifier == this._prevTouchList[i].identifier) {
        prevTouch2 = this._prevTouchList[i];
      }
    }

    if (prevTouch1 == null || prevTouch2 == null) {
      return;
    }

    const curDistance = Math.sqrt(
      Math.pow(curTouch1.clientX - curTouch2.clientX, 2) +
        Math.pow(curTouch1.clientY - curTouch2.clientY, 2),
    );

    const deltaZoom = curDistance - this._prevDoubleTouchDistance;

    const middleX = (curTouch1.clientX + curTouch2.clientX) / 2;
    const middleY = (curTouch1.clientY + curTouch2.clientY) / 2;

    const element = document.elementFromPoint(middleX, middleY);

    this._onCursorMove?.(e, element, cursorState.touchDouble, middleX, middleY);
    this._onScroll?.(
      e,
      element,
      cursorState.touchDouble,
      middleX,
      middleY,
      deltaZoom,
    );
    this._prevTouchList = e.touches;

    return;
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
   * Called when the user releases a touch point from the screen
   * @param e
   */
  onTouchEnd(e: TouchEvent) {
    // If we previously has 2 or more touches...
    if (this._prevTouchList && this._prevTouchList.length > 1) {
      // TODO: Use middle of the two touches as the mouse position
      this._onCursorUp?.(
        e,
        e.target instanceof Element ? e.target : null,
        cursorState.touchDouble,
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY,
      );
      if (e.touches.length == 1) {
        // if we now have only one touch, end the double touch and resume as a single touch
        this._prevTouchList = e.touches;
        this._onCursorDown?.(
          e,
          e.target instanceof Element ? e.target : null,
          cursorState.touchSingle,
          e.touches[0].clientX,
          e.touches[0].clientY,
        );
        return;
      } else if (e.touches.length == 0) {
        // If we now have no touches, end the double touch
        this._prevTouchList = null;
        return;
      }
    } else {
      this._onCursorUp?.(
        e,
        e.target instanceof Element ? e.target : null,
        cursorState.touchSingle,
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY,
      );
    }
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
      e.deltaY,
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
