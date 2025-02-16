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
  identifier: number;
};

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
  _sortedTouchArray: touchData[]; // List of touches for touch events, sorted by the times they are pressed
  _sortedTouchDict: { [key: number]: touchData }; // Dictionary of touches for touch events, indexed by the touch identifier

  constructor(dom: HTMLElement, document: Document) {
    dom.addEventListener("wheel", this.onWheel.bind(this));
    dom.addEventListener("keydown", this.onKeyDown.bind(this));

    dom.addEventListener("mousedown", this.onMouseDown.bind(this));
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

    this._sortedTouchArray = [];
    this._sortedTouchDict = {};
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
    e.preventDefault();
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
    e.preventDefault();
  }

  /**
   * Called when the user presses a key
   * @param e
   * @returns
   */
  onKeyDown(e: KeyboardEvent) {
    this._onKeyDown?.(e);
  }

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
      this._onCursorDown?.(
        e,
        this._sortedTouchArray[0].target as Element | null,
        cursorState.mouseLeft,
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y,
      );
      return;
    }

    if (this._sortedTouchArray.length === 2) {
      if (prevSortedTouchArrayLength === 1) {
        this._onCursorUp?.(
          e,
          this._sortedTouchArray[1].target as Element | null,
          cursorState.mouseLeft,
          this._sortedTouchArray[1].x,
          this._sortedTouchArray[1].y,
        );
      }
      const middleX =
        (this._sortedTouchArray[0].x + this._sortedTouchArray[1].x) / 2;
      const middleY =
        (this._sortedTouchArray[0].y + this._sortedTouchArray[1].y) / 2;
      this._onCursorDown?.(
        e,
        this._sortedTouchArray[0].target as Element | null,
        cursorState.mouseMiddle,
        middleX,
        middleY,
      );
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
      this._onCursorMove?.(
        e,
        this._sortedTouchArray[0].target,
        cursorState.mouseLeft,
        this._sortedTouchArray[0].x,
        this._sortedTouchArray[0].y,
      );
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

    this._onCursorMove?.(
      e,
      this._sortedTouchArray[0].target, // TODO: find element at middle of two touch points
      cursorState.mouseMiddle,
      middleX,
      middleY,
    );
    this._onScroll?.(
      e,
      this._sortedTouchArray[0].target,
      cursorState.mouseMiddle,
      middleX,
      middleY,
      deltaSpan,
    );
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
        this._onCursorUp?.(
          e,
          deletedTouchArray[0].target,
          cursorState.mouseLeft,
          deletedTouchArray[0].x,
          deletedTouchArray[0].y,
        );
        return;
      }

      if (prevSortedTouchArrayLength === 2) {
        this._onCursorUp?.(
          e,
          deletedTouchArray[0].target,
          cursorState.mouseMiddle,
          deletedTouchArray[0].x,
          deletedTouchArray[0].y,
        );
      }
    }
  }
}

export { InputControl };
