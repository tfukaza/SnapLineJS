import { GlobalManager } from "./global";
import { EventProxyFactory } from "./util";

export enum cursorState {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
}

export interface eventPosition {
  x: number;
  y: number;
  cameraX: number;
  cameraY: number;
  screenX: number;
  screenY: number;
}

/**
 * Events common to mouse and touch
 */
export interface pointerDownProp {
  event: PointerEvent;
  gid: string | null;
  position: eventPosition;
}

export interface pointerMoveProp {
  event: PointerEvent | null;
  gid: string | null;
  position: eventPosition;
}

export interface pointerUpProp {
  event: PointerEvent;
  gid: string | null;
  position: eventPosition;
}

/** Mouse events */
export interface mouseWheelProp {
  event: WheelEvent;
  gid: string | null;
  position: eventPosition;
  delta: number;
}

export interface dragStartProp {
  gid: string | null; // Object that triggered the event
  pointerId: number;
  start: eventPosition;
}

export interface dragProp {
  gid: string | null;
  pointerId: number;
  start: eventPosition;
  position: eventPosition;
  delta: eventPosition;
}

export interface dragEndProp {
  gid: string | null;
  pointerId: number;
  start: eventPosition;
  end: eventPosition;
}

export interface pinchStartProp {
  gid: string | null;
  gestureID: string;
  start: {
    pointerList: eventPosition[];
    distance: number;
  };
}

/** Touch Event */
export interface pinchProp {
  gid: string | null;
  gestureID: string;
  start: {
    pointerList: eventPosition[];
    distance: number;
  };
  pointerList: eventPosition[];
  distance: number;
}

export interface pinchEndProp {
  gid: string | null;
  gestureID: string;
  start: {
    pointerList: eventPosition[];
    distance: number;
  };
  pointerList: eventPosition[];
  distance: number;
  end: {
    pointerList: eventPosition[];
    distance: number;
  };
}

export interface touchMultiMoveProp {
  gid: string | null;
  position: eventPosition;
  positionCount: number;
  positionList: eventPosition[];
}

export interface InputEventCallback {
  pointerDown: null | ((prop: pointerDownProp) => void);
  pointerMove: null | ((prop: pointerMoveProp) => void);
  pointerUp: null | ((prop: pointerUpProp) => void);
  mouseWheel: null | ((prop: mouseWheelProp) => void);

  dragStart: null | ((prop: dragStartProp) => void);
  drag: null | ((prop: dragProp) => void);
  dragEnd: null | ((prop: dragEndProp) => void);

  pinchStart: null | ((prop: pinchStartProp) => void);
  pinch: null | ((prop: pinchProp) => void);
  pinchEnd: null | ((prop: pinchEndProp) => void);
}

type InputEventRecord<T> = {
  [P in keyof T]: Record<string, (prop: T[P]) => void>;
};

type InputEventCallbackRecord = InputEventRecord<InputEventCallback>;

export type touchData = {
  x: number;
  y: number;
  target: Element | null;
  identifier: number;
};

export type pointerData = {
  id: number; // pointer id
  callerGID: string | null; // GID of the element that triggered the pointer event
  timestamp: number; // Timestamp of the pointer event
  x: number;
  y: number;
  startX: number;
  startY: number;
  prevX: number;
  prevY: number;
  endX: number | null;
  endY: number | null;
  moveCount: number; // Number of times the pointer has moved since the last pointer down event
};

const GLOBAL_GID = "global";

class InputControl {
  /**
   * Functions as a middleware that converts mouse and touch events into a unified event format.
   */
  _element: HTMLElement | null;
  global: GlobalManager | null;

  _sortedTouchArray: touchData[]; // List of touches for touch events, sorted by the times they are pressed
  _sortedTouchDict: { [key: number]: touchData }; // Dictionary of touches for touch events, indexed by the touch identifier

  _localPointerDict: { [key: number]: pointerData };

  _event: InputEventCallback;
  event: InputEventCallback;

  _isGlobal: boolean;

  _uuid: Symbol;

  _ownerGID: string | null;

  constructor(
    global: GlobalManager | null,
    isGlobal: boolean = true,
    ownerGID: string | null = null,
  ) {
    this.global = global;
    this._element = null;
    this._isGlobal = isGlobal;
    this._sortedTouchArray = [];
    this._sortedTouchDict = {};
    this._ownerGID = ownerGID;
    this._localPointerDict = {};

    this._event = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      dragStart: null,
      drag: null,
      dragEnd: null,
      pinchStart: null,
      pinch: null,
      pinchEnd: null,
    };
    this.event = EventProxyFactory<InputControl, InputEventCallback>(
      this,
      this._event,
      this._isGlobal ? null : this.globalInputEngine?._inputControl.event,
    );
    this._uuid = Symbol();
    // console.warn("this.event", this._event);
    // console.warn(
    //   "this.global?.inputEngine?.inputControl.event",
    //   this.global?.inputEngine?._inputControl.event,
    // );
    // console.trace();
  }

  get globalInputEngine() {
    return this.global?.inputEngine;
  }

  get globalPointerDict(): { [key: number]: pointerData } {
    if (this.globalInputEngine == null) {
      return {};
    }
    return this.globalInputEngine._pointerDict;
  }

  get globalGestureDict(): { [key: string]: dragGesture | pinchGesture } {
    if (this.globalInputEngine == null) {
      return {};
    }
    return this.globalInputEngine._gestureDict;
  }
  // convertMouseToCursorState(buttons: number): cursorState {
  //   switch (buttons) {
  //     case 1:
  //       return cursorState.mouseLeft;
  //     case 2:
  //       return cursorState.mouseRight;
  //     case 4:
  //       return cursorState.mouseMiddle;
  //     default:
  //       return cursorState.none;
  //   }
  // }

  getCoordinates(screenX: number, screenY: number) {
    if (this.global == null) {
      return {
        x: screenX,
        y: screenY,
        cameraX: screenX,
        cameraY: screenY,
        screenX,
        screenY,
      };
    }
    const [cameraX, cameraY] = this.global.camera!.getCameraFromScreen(
      screenX,
      screenY,
    );
    const [worldX, worldY] = this.global.camera!.getWorldFromCamera(
      cameraX,
      cameraY,
    );
    return {
      x: worldX,
      y: worldY,
      cameraX,
      cameraY,
      screenX,
      screenY,
    };
  }

  /**
   * Called when the user pressed the mouse button.
   * This and all other pointer/gesture events automatically propagate to global input engine as well.
   * @param e
   * @returns
   */
  onPointerDown(e: PointerEvent) {
    e.stopPropagation();
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    console.debug("onPointerDown", this, e.pointerId, coordinates);
    this.event.pointerDown?.({
      event: e,
      position: coordinates,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
    });
    const pointerData = {
      id: e.pointerId,
      callerGID: this._isGlobal ? GLOBAL_GID : this._ownerGID,
      timestamp: e.timeStamp,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      prevX: e.clientX,
      prevY: e.clientY,
      endX: null,
      endY: null,
      moveCount: 0,
    };
    this.globalPointerDict[e.pointerId] = pointerData;
    // if (!this._isGlobal) {
    //   this._localPointerDict[e.pointerId] = pointerData;
    // }
  }

  /**
   * Called when the user moves the mouse
   * @param e
   */
  onPointerMove(e: PointerEvent) {
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    console.debug("onPointerMove", e.pointerId, coordinates);
    this.event.pointerMove?.({
      event: e,
      position: coordinates,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
    });
    const id = e.pointerId;
    let pointerData = this.globalPointerDict[id]; // || this._localPointerDict[id];
    if (pointerData != null) {
      const updatedPointerData = {
        prevX: pointerData.x,
        prevY: pointerData.y,
        x: e.clientX,
        y: e.clientY,
        callerGID: this._isGlobal ? GLOBAL_GID : this._ownerGID,
      };
      Object.assign(pointerData, updatedPointerData);
      this.#handleMultiPointer();
    }
    e.stopPropagation();
    // e.preventDefault();
  }

  /**
   * Called when the user releases the mouse button
   * @param e
   */
  onPointerUp(e: PointerEvent) {
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    console.debug("onPointerUp", e.pointerId, coordinates);
    this.event.pointerUp?.({
      event: e,
      position: coordinates,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
    });
    let pointerData = this.globalPointerDict[e.pointerId];
    console.debug("onPointerUp", e.pointerId, pointerData);
    // this._localPointerDict[e.pointerId];
    if (pointerData != null) {
      const gesture = this.globalGestureDict[e.pointerId];
      console.debug("onPointerUp", e.pointerId, gesture);
      if (gesture != null) {
        gesture.state = "release";

        const start = this.getCoordinates(
          pointerData.startX,
          pointerData.startY,
        );
        for (const member of gesture.memberList) {
          member.event.dragEnd?.({
            gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
            pointerId: e.pointerId,
            start: start,
            end: coordinates,
          });
        }
        delete this.globalGestureDict[e.pointerId];
      }
      // delete this._localPointerDict[e.pointerId];
      delete this.globalPointerDict[e.pointerId];

      // Check if any pinch gesture uses this pointer
      for (const gestureKey of Object.keys(this.globalGestureDict)) {
        if (!gestureKey.includes("-")) {
          continue;
        }
        const [pointerId_0, pointerId_1] = gestureKey.split("-").map(Number);
        if (pointerId_0 == e.pointerId || pointerId_1 == e.pointerId) {
          const gesture = this.globalGestureDict[gestureKey] as pinchGesture;
          // const pointer0 = this.globalPointerDict[pointerId_0];
          // const pointer1 = this.globalPointerDict[pointerId_1];
          this.event.pinchEnd?.({
            gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
            gestureID: gestureKey,
            start: gesture.start,
            pointerList: gesture.pointerList,
            distance: gesture.distance,
            end: {
              pointerList: gesture.pointerList,
              distance: gesture.distance,
            },
          });
          console.warn("pinchEnd", gestureKey, this._ownerGID);
          delete this.globalGestureDict[gestureKey];
        }
      }
    }
    e.stopPropagation();
  }

  /**
   * Called when the user scrolls the mouse wheel
   * @param e
   */
  onWheel(e: WheelEvent) {
    const coordinates = this.getCoordinates(e.clientX, e.clientY);
    this.event.mouseWheel?.({
      event: e,
      position: coordinates,
      delta: e.deltaY,
      gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
    });
    console.debug("onWheel", coordinates);
    e.stopPropagation();
  }

  #handleMultiPointer() {
    // Only handle global pointer dict
    const numKeys = Object.keys(this.globalPointerDict).length;
    // Handle drag gestures of each pointer
    if (numKeys >= 1) {
      // console.info("handleDragGesture");
      for (const pointer of Object.values(this.globalPointerDict)) {
        const thisGID = this._isGlobal ? GLOBAL_GID : this._ownerGID;
        if (thisGID != pointer.callerGID) {
          continue;
        }
        // console.info("handleMultiPointer", pointer);
        const startPosition = this.getCoordinates(
          pointer.startX,
          pointer.startY,
        );
        const currentPosition = this.getCoordinates(pointer.x, pointer.y);
        const deltaCoordinates = {
          x: currentPosition.x - startPosition.x,
          y: currentPosition.y - startPosition.y,
          cameraX: currentPosition.cameraX - startPosition.cameraX,
          cameraY: currentPosition.cameraY - startPosition.cameraY,
          screenX: currentPosition.screenX - startPosition.screenX,
          screenY: currentPosition.screenY - startPosition.screenY,
        };
        // If this is the first move since the pointer down event, invoke the drag start event
        if (pointer.moveCount == 0) {
          this.event.dragStart?.({
            gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
            pointerId: pointer.id,
            start: startPosition,
          });
          console.debug("dragStart", startPosition);
          if (this.globalGestureDict[pointer.id]) {
            this.globalGestureDict[pointer.id].memberList.push(this);
          } else {
            this.globalGestureDict[pointer.id] = {
              type: "drag",
              state: "drag",
              memberList: [this],
              initiatorID: this._isGlobal ? GLOBAL_GID : this._ownerGID ?? "",
            };
          }
          // console.info(
          //   "drag gesture initial",
          //   this.globalGestureDict[pointer.id].memberList.map(
          //     (m) => m._ownerGID,
          //   ),
          // );
        }
        pointer.moveCount++;
        // Drag gestures are only handled by the global input engine
        // to avoid edge cases where the pointer leaves the DOM element while dragging,
        // which can happen if the user is dragging very quickly
        const gesture = this.globalGestureDict[pointer.id];
        // console.info("drag gesture", gesture.memberList, this._isGlobal);
        // NOTE: The for loop is needed for non-touch devices.
        // It seems like that on touch devices, the pointerMove event continues working even after the cursor has
        // left the DOM element, which is not the case for mouse events.
        // if (this._isGlobal) {
        // console.info(
        //   "drag gesture",
        //   gesture.memberList.map((m) => m._ownerGID),
        // );
        for (const member of gesture.memberList) {
          // if (member._ownerGID == gesture.initiatorID) {
          member.event.drag?.({
            gid: member._isGlobal ? GLOBAL_GID : member._ownerGID,
            pointerId: pointer.id,
            start: startPosition,
            position: currentPosition,
            delta: deltaCoordinates,
          });
          // }
        }
        // this.event.drag?.({
        //   gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
        //   pointerId: pointer.id,
        //   start: startPosition,
        //   position: currentPosition,
        //   delta: deltaCoordinates,
        // });
        // }
        console.debug("drag", startPosition, currentPosition, deltaCoordinates);
      }
    }
    // Handle pinch gestures.
    // Pinch gestures can only be handled by the global input engine
    if (numKeys >= 2 && this._isGlobal) {
      const pointerList = Object.values(this.globalPointerDict);
      // Sort the pointer list by the time they are pressed
      pointerList.sort((a, b) => a.timestamp - b.timestamp);
      // TODO: Only update gesture entries that are adjacent to the pointer event that triggered the pinch gesture

      // Every 2 pointers that are adjacent chronologically are considered to be a pinch gesture
      for (let i = 0; i < pointerList.length - 1; i++) {
        const pointer_0 = pointerList[i];
        const pointer_1 = pointerList[i + 1];

        const gestureKey = `${pointer_0.id}-${pointer_1.id}`;

        const startMiddleX = (pointer_0.startX + pointer_1.startX) / 2;
        const startMiddleY = (pointer_0.startY + pointer_1.startY) / 2;
        const startMiddle = this.getCoordinates(startMiddleX, startMiddleY);
        const startDistance = Math.sqrt(
          Math.pow(pointer_0.startX - pointer_1.startX, 2) +
            Math.pow(pointer_0.startY - pointer_1.startY, 2),
        );
        // const prevDistance = Math.sqrt(
        //   Math.pow(pointer_0.prevX - pointer_1.prevX, 2) +
        //     Math.pow(pointer_0.prevY - pointer_1.prevY, 2),
        // );
        // const currentMiddleX = (pointer_0.x + pointer_1.x) / 2;
        // const currentMiddleY = (pointer_0.y + pointer_1.y) / 2;
        // const currentMiddle = this.getCoordinates(
        //   currentMiddleX,
        //   currentMiddleY,
        // );
        const currentPointer0 = this.getCoordinates(pointer_0.x, pointer_0.y);
        const currentPointer1 = this.getCoordinates(pointer_1.x, pointer_1.y);
        const currentDistance = Math.sqrt(
          Math.pow(pointer_0.x - pointer_1.x, 2) +
            Math.pow(pointer_0.y - pointer_1.y, 2),
        );

        if (this.globalGestureDict[gestureKey] == null) {
          this.globalGestureDict[gestureKey] = {
            type: "pinch",
            state: "pinch",
            memberList: [this],
            start: {
              pointerList: [currentPointer0, currentPointer1],
              distance: startDistance,
            },
            pointerList: [currentPointer0, currentPointer1],
            distance: startDistance,
          };
          this.event.pinchStart?.({
            gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
            gestureID: gestureKey,
            start: {
              pointerList: [currentPointer0, currentPointer1],
              distance: startDistance,
            },
          });
          console.warn("pinchStart", startMiddle, this._ownerGID);
        } else {
          // this.globalGestureDict[gestureKey].memberList.push(this);
        }

        const pinchGesture = this.globalGestureDict[gestureKey] as pinchGesture;
        pinchGesture.pointerList = [currentPointer0, currentPointer1];
        pinchGesture.distance = currentDistance;
        this.event.pinch?.({
          gid: this._isGlobal ? GLOBAL_GID : this._ownerGID,
          gestureID: gestureKey,
          start: pinchGesture.start,
          pointerList: pinchGesture.pointerList,
          distance: pinchGesture.distance,
        });
        console.warn("pinch", currentPointer0, currentPointer1, this._ownerGID);
      }
    }
  }

  addListener<T extends keyof InputEventCallback>(
    dom: HTMLElement,
    event: any,
    callback: any,
  ) {
    dom.addEventListener(event, callback.bind(this));
  }

  addCursorEventListener(dom: HTMLElement) {
    this.addListener(dom, "pointerdown", this.onPointerDown);
    this.addListener(dom, "pointermove", this.onPointerMove);
    this.addListener(dom, "pointerup", this.onPointerUp);
    this.addListener(dom, "wheel", this.onWheel);

    // TODO: Add global event listener
  }
}

type gestureType = "drag" | "pinch";

interface dragGesture {
  type: gestureType;
  state: "idle" | "drag" | "release";
  initiatorID: string;
  memberList: InputControl[];
}

interface pinchGesture {
  type: gestureType;
  state: "idle" | "pinch" | "release";
  memberList: InputControl[];
  start: {
    pointerList: eventPosition[];
    distance: number;
  };
  pointerList: eventPosition[];
  distance: number;
  // end: {
  //   pointerList: eventPosition[];
  //   distance: number;
  // };
}

class GlobalInputControl {
  #document: Document;
  global: GlobalManager | null;

  _inputControl: InputControl;
  globalCallbacks: InputEventCallbackRecord;
  _pointerDict: { [key: number]: pointerData };
  _gestureDict: { [key: string]: dragGesture | pinchGesture };

  _event: InputEventCallback;
  event: InputEventCallback;

  constructor(global: GlobalManager | null = null) {
    this.global = global;
    this.#document = document;
    this._inputControl = new InputControl(this.global, true, null);
    this._inputControl.addCursorEventListener(
      this.#document as unknown as HTMLElement,
    );

    this.globalCallbacks = {
      pointerDown: {},
      pointerMove: {},
      pointerUp: {},
      mouseWheel: {},
      dragStart: {},
      drag: {},
      dragEnd: {},
      pinchStart: {},
      pinch: {},
      pinchEnd: {},
    };

    this._pointerDict = {}; // Dictionary of pointers for pointer events, indexed by the pointer identifier
    this._gestureDict = {}; // Dictionary of gestures for gesture events, indexed by the gesture identifier

    for (const [key, callbackRecord] of Object.entries(this.globalCallbacks)) {
      this._inputControl.event[key as keyof InputEventCallback] = (
        prop: any,
      ) => {
        // console.log("Global Input Event iteration", key, prop);
        // console.trace();
        // this.inputControl.event[key as keyof InputEventCallback]?.call(
        //   this.inputControl,
        //   prop,
        // );
        for (const callback of Object.values(
          this.globalCallbacks[key as keyof InputEventCallback],
        )) {
          callback(prop);
        }
      };
    }
    this._event = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      dragStart: null,
      drag: null,
      dragEnd: null,
      pinchStart: null,
      pinch: null,
      pinchEnd: null,
    };
    this.event = new Proxy(this._event, {
      set: (target, prop, value) => {
        if (value != null) {
          this.subscribeGlobalCursorEvent(
            prop as keyof InputEventCallback,
            GLOBAL_GID,
            value,
          );
        } else {
          this.unsubscribeGlobalCursorEvent(
            prop as keyof InputEventCallback,
            GLOBAL_GID,
          );
        }
        return true;
      },
    });
  }

  subscribeGlobalCursorEvent(
    event: keyof InputEventCallback,
    gid: string,
    callback: (prop: any) => void,
  ) {
    this.globalCallbacks[event][gid] = callback.bind(this);
  }

  unsubscribeGlobalCursorEvent(event: keyof InputEventCallback, gid: string) {
    delete this.globalCallbacks[event][gid];
  }
}

export { InputControl, GlobalInputControl, GLOBAL_GID };
