// import interact from "interactjs";

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

export type touchData = {
  x: number;
  y: number;
  target: Element | null;
}

class InputControl {
  /**
   * Functions as a middleware that converts mouse and touch events into a unified event format.
   */
  _dom: HTMLElement;
  _document: Document;

  _onCursorDown: null | callbackFunction;
  _onCursorMove: null | callbackFunction;
  _onCursorUp: null | callbackFunction;
  _onScroll: null | scrollCallbackFunction;
  _onRotate: null | scrollCallbackFunction;
  _onKeyDown: null | keyCallbackFunction;

  _pointerMode: "pointer" | "gesture" | "none";

  _currentCursorState: cursorState;
  _sortedTouchID: number[]; // List of touches for touch events, sorted by the times they are pressed
  _touch_0: touchData | null;
  _touch_1: touchData | null;

  constructor(dom: HTMLElement, document: Document) {

    dom.addEventListener("wheel", this.onWheel.bind(this));
    dom.addEventListener("keydown", this.onKeyDown.bind(this));

    document.addEventListener("mousedown", this.onMouseDown.bind(this));
    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));

    document.addEventListener("touchstart", this.onTouchStart.bind(this));
    document.addEventListener("touchmove", this.onTouchMove.bind(this));
    document.addEventListener("touchend", this.onTouchEnd.bind(this));

    this._onCursorDown = null;
    this._onCursorMove = null;
    this._onCursorUp = null;
    this._onScroll = null;
    this._onRotate = null;
    this._onKeyDown = null;

    this._currentCursorState = cursorState.none;

    this._pointerMode = "none";

    this._dom = dom;
    this._document = document;

    this._sortedTouchID = [];
    this._touch_0 = null; 
    this._touch_1 = null; 
  }

  private _callFuncWithCallbackParam(
    func: callbackFunction | null,
    e: PointerEvent,
  ) {
    func?.(
      e,
      e.target as Element | null,
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
      e.target as Element | null, 
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
      e.target as Element | null,   
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
    const element = this._document.elementFromPoint(e.clientX, e.clientY);

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
      e.target as Element | null,
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
      e.target as Element | null,
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

  updateTouch(identifier: number, touchList: TouchList, data: touchData | null): touchData | null {
    let touchMatched = null; 
    for (let i = 0; i < touchList.length; i++) {
      const touch = touchList[i];
      if (touch && touch.identifier === identifier) {
        touchMatched = touch;
        break;
      }
    }
    
    if (touchMatched && data) {
      data.x = touchMatched.clientX;
      data.y = touchMatched.clientY;
      data.target = touchMatched.target as Element | null;
      return data;
    } 

    return null;
  }

  onTouchStart(e: TouchEvent) {
    const newTouchList = e.changedTouches;
    // Add the touch to the touch list
    for (let i = 0; i < newTouchList.length; i++) {
      const touch = newTouchList[i];
      if (touch) {
        this._sortedTouchID.unshift(touch.identifier);
      }
    }

    if (this._sortedTouchID.length > 0) {
      this._touch_0 = {
        x: newTouchList[0].clientX,
        y: newTouchList[0].clientY,
        target: newTouchList[0].target as Element | null,
      }
    }
    if (this._sortedTouchID.length > 1) {
      this._touch_1 = {
        x: newTouchList[1].clientX,
        y: newTouchList[1].clientY,
        target: newTouchList[1].target as Element | null,
      }
    }

    if (this._touch_0) {
      this._onCursorDown?.(
        e,
        newTouchList[0].target as Element | null,
        cursorState.mouseLeft,
        this._touch_0.x,
        this._touch_0.y,
      );
    }
  }

  onTouchMove(e: TouchEvent) {
    const touchList = e.touches;
    const updatedTouches = [];
    const prevTouch_0 = this._touch_0 ? { ...this._touch_0 } : null;
    const prevTouch_1 = this._touch_1 ? { ...this._touch_1 } : null;

    if (this._touch_0) {      
      this._touch_0 = this.updateTouch(this._sortedTouchID[0], touchList, this._touch_0);
    }
    if (this._touch_1) {
      this._touch_1 = this.updateTouch(this._sortedTouchID[1], touchList, this._touch_1);
    }

    // If there is only one touch point, treat it as a mouse event
    if (this._touch_0 && !this._touch_1) {
      this._onCursorMove?.(
        e,
        this._touch_0.target,
        cursorState.mouseLeft,
        this._touch_0.x,
        this._touch_0.y,
      );
      return;
    }

    if (!(this._touch_0 && this._touch_1)) {
      return;
    }

    const middleX = (this._touch_0.x + this._touch_1.x) / 2;
    const middleY = (this._touch_0.y + this._touch_1.y) / 2;
    const span = Math.sqrt(Math.pow(this._touch_0.x - this._touch_1.x, 2) + Math.pow(this._touch_0.y - this._touch_1.y, 2));

    let deltaX = 0;
    let deltaY = 0;
    let deltaSpan = 0;
    
    if (prevTouch_0 && prevTouch_1) {    
      const prevMiddleX = (prevTouch_0.x + prevTouch_1.x) / 2;
      const prevMiddleY = (prevTouch_0.y + prevTouch_1.y) / 2;
      deltaX = middleX - prevMiddleX;
      deltaY = middleY - prevMiddleY;
      const prevSpan = Math.sqrt(Math.pow(prevTouch_0.x - prevTouch_1.x, 2) + Math.pow(prevTouch_0.y - prevTouch_1.y, 2));
      deltaSpan = span - prevSpan;
    }

    this._onCursorMove?.(
      e,
      this._touch_0.target, // TODO: find element at middle of two touch points
      cursorState.mouseMiddle,
      middleX,
      middleY,
    );
    this._onScroll?.(
      e,
      this._touch_0.target,
      cursorState.mouseMiddle,
      middleX,
      middleY,
      deltaSpan,
    );
    
  }

  onTouchEnd(e: TouchEvent) {

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches.item(i);
      for (const touchID of this._sortedTouchID) {
        if (touchID === touch.identifier) {
          this._sortedTouchID.splice(this._sortedTouchID.indexOf(touchID), 1);
          break;
        }
      }
    }

    this._touch_0 = this.updateTouch(this._sortedTouchID[0], this._touch_0);
    this._touch_1 = this.updateTouch(this._sortedTouchID[1], this._touch_1);

    if (this._touch_0) {
      this._onCursorUp?.(
        this._touch_0,
        this._touch_0.target,
        cursorState.mouseLeft,
        this._touch_0.x,
        this._touch_0.y,
      );
    } 
  }
  
}

export { InputControl };
