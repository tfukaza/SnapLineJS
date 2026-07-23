import type { GlobalManager } from "./global";
import type { ElementObject } from "./object";

export enum mouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
  BACK = 3,
  FORWARD = 4,
}

export enum mouseButtonBitmap {
  LEFT = 1,
  MIDDLE = 2,
  RIGHT = 4,
  BACK = 8,
  FORWARD = 16,
}

export interface eventPosition {
  x: number;
  y: number;
  cameraX: number;
  cameraY: number;
  screenX: number;
  screenY: number;
}

export interface pointerDownProp {
  event: PointerEvent;
  objectId: string | null;
  position: eventPosition;
  button: number;
  isWithinEngine: boolean;
}

export interface pointerMoveProp {
  event: PointerEvent | null;
  objectId: string | null;
  position: eventPosition;
  button: number;
}

export interface pointerUpProp {
  event: PointerEvent;
  objectId: string | null;
  position: eventPosition;
  button: number;
}

export interface mouseWheelProp {
  event: WheelEvent;
  objectId: string | null;
  position: eventPosition;
  delta: number;
}

export interface dragStartProp {
  objectId: string | null;
  pointerId: number;
  start: eventPosition;
  button: number;
  isWithinEngine: boolean;
}

export interface dragProp {
  objectId: string | null;
  pointerId: number;
  start: eventPosition;
  position: eventPosition;
  delta: eventPosition;
  button: number;
}

export interface dragEndProp {
  objectId: string | null;
  pointerId: number;
  start: eventPosition;
  end: eventPosition;
  button: number;
}

export interface PinchSnapshot {
  pointerList: eventPosition[];
  distance: number;
}

export interface pinchStartProp {
  objectId: string | null;
  gestureID: string;
  start: PinchSnapshot;
}

export interface pinchProp {
  objectId: string | null;
  gestureID: string;
  start: PinchSnapshot;
  current: PinchSnapshot;
}

export interface pinchEndProp {
  objectId: string | null;
  gestureID: string;
  start: PinchSnapshot;
  current: PinchSnapshot;
  end: PinchSnapshot;
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

/**
 * General input event data struct for both mouse and touch pointers.
 */
export type pointerData = {
  id: number; // pointer id
  callerObjectId: string | null; // ID of the object that triggered the pointer event
  timestamp: number; // Timestamp of the pointer event
  x: number; // Screen-space x coordinate
  y: number;
  startX: number;
  startY: number;
  prevX: number;
  prevY: number;
  endX: number | null;
  endY: number | null;
  moveCount: number; // Number of times the pointer has moved since the last pointer down event
  button: number;
  isWithinEngine: boolean;
};

const INPUT_CONTROL_EVENT_SUBSCRIPTION_ID = "__input_control_event__";
const DRAG_START_THRESHOLD_PX = 3;

type InputEventPayloadMap = {
  pointerDown: pointerDownProp;
  pointerMove: pointerMoveProp;
  pointerUp: pointerUpProp;
  mouseWheel: mouseWheelProp;
  dragStart: dragStartProp;
  drag: dragProp;
  dragEnd: dragEndProp;
  pinchStart: pinchStartProp;
  pinch: pinchProp;
  pinchEnd: pinchEndProp;
};

type InputEventPayload = InputEventPayloadMap[keyof InputEventPayloadMap];
type GlobalInputCallback = (prop: InputEventPayload) => void;

type GlobalCallbackRegistry = Record<
  keyof InputEventCallback,
  Record<string, { callback: GlobalInputCallback; engine: any | null }>
>;

type TrackedPointer = pointerData & {
  owner: ElementObject | null;
  currentOwner: ElementObject | null;
  /**
   * When true, GLOBAL listeners no longer receive this pointer's events
   * (pointerDown/Move, dragStart/drag; pinches involving it; and wheel while
   * any claim is held) — owner dispatch is unaffected, and end events
   * (pointerUp/dragEnd/pinchEnd) always deliver so an already-engaged global
   * listener can terminate cleanly. The claim dies with this entry (pointer
   * up/cancel), so it can never be stranded by a destroyed owner.
   */
  claimed: boolean;
};

interface dragGesture {
  type: "drag";
  state: "pending" | "drag" | "release";
  member: ElementObject | null;
  pointerId: number;
}

interface pinchGesture {
  type: "pinch";
  state: "idle" | "pinch" | "release";
  member: ElementObject | null;
  pointerId0: number;
  pointerId1: number;
  start: PinchSnapshot;
  current: PinchSnapshot;
}

/**
 * Configuration options for input handling.
 */
export interface InputControlConfig {
  /**
   * Maximum number of simultaneous drag gestures allowed.
   * When exceeded, the oldest drag gesture will be cancelled.
   * Set to 0 or Infinity for unlimited. Default is Infinity.
   */
  maxSimultaneousDrags: number;
}

const DEFAULT_INPUT_CONTROL_CONFIG: InputControlConfig = {
  maxSimultaneousDrags: Infinity,
};

const inputEventKeys: Array<keyof InputEventCallback> = [
  "pointerDown",
  "pointerMove",
  "pointerUp",
  "mouseWheel",
  "dragStart",
  "drag",
  "dragEnd",
  "pinchStart",
  "pinch",
  "pinchEnd",
];

/**
 * Input event manager for a single engine instance.
 *
 * Object DOM elements register ownership here. Native listeners stay centralized
 * on the engine container/document, and dispatch resolves the current owner from
 * the native event path.
 */
class InputControl {
  #container: HTMLElement | null = null;
  #containerController: AbortController | null = null;
  #document: Document;
  #documentController: AbortController | null = null;
  #elementByObjectId: Map<string, HTMLElement>;
  #engine: any;
  #gestureDict: { [key: string]: dragGesture | pinchGesture };
  #objectByElement: WeakMap<HTMLElement, ElementObject>;
  #pointerDict: { [key: number]: TrackedPointer };
  global: GlobalManager | null;
  globalCallbacks: GlobalCallbackRegistry;
  #event: InputEventCallback;
  event: InputEventCallback;

  /**
   * Configuration options for input handling.
   */
  config: InputControlConfig;

  constructor(
    global: GlobalManager,
    engine: any,
    config: Partial<InputControlConfig> = {},
  ) {
    this.global = global;
    this.#document = document;
    this.#engine = engine;
    this.config = { ...DEFAULT_INPUT_CONTROL_CONFIG, ...config };

    this.#elementByObjectId = new Map();
    this.#gestureDict = {};
    this.#objectByElement = new WeakMap();
    this.#pointerDict = {};

    this.globalCallbacks = this.#createGlobalCallbackRegistry();
    this.#event = this.#createInputEventCallback();
    this.event = new Proxy(this.#event, {
      set: (_target, prop, value) => {
        if (typeof prop !== "string" || !this.#isInputEventKey(prop)) {
          return true;
        }
        const event = prop as keyof InputEventCallback;
        this.#event[event] = value as any;
        if (value != null) {
          this.subscribeGlobalCursorEvent(
            event,
            INPUT_CONTROL_EVENT_SUBSCRIPTION_ID,
            (value as CallableFunction).bind(this) as any,
            this.#engine,
          );
        } else {
          this.unsubscribeGlobalCursorEvent(
            event,
            INPUT_CONTROL_EVENT_SUBSCRIPTION_ID,
          );
        }
        return true;
      },
    });
  }

  bindContainer(container: HTMLElement) {
    this.#destroyListeners();
    this.#container = container;
    this.#pointerDict = {};
    this.#gestureDict = {};

    this.#containerController = new AbortController();
    this.#documentController = new AbortController();

    container.addEventListener("pointerdown", this.#onPointerDown, {
      signal: this.#containerController.signal,
    });
    container.addEventListener("pointermove", this.#onContainerPointerMove, {
      signal: this.#containerController.signal,
    });
    container.addEventListener("wheel", this.#onWheel, {
      signal: this.#containerController.signal,
    });

    this.#document.addEventListener(
      "pointermove",
      this.#onDocumentPointerMove,
      {
        signal: this.#documentController.signal,
      },
    );
    this.#document.addEventListener("pointerup", this.#onPointerUp, {
      signal: this.#documentController.signal,
    });
    this.#document.addEventListener("pointercancel", this.#onPointerCancel, {
      signal: this.#documentController.signal,
    });
  }

  destroy() {
    this.#destroyListeners();
    this.globalCallbacks = this.#createGlobalCallbackRegistry();
    this.#container = null;
    this.#elementByObjectId.clear();
    this.#gestureDict = {};
    this.#objectByElement = new WeakMap();
    this.#pointerDict = {};
  }

  registerObjectElement(object: ElementObject, element: HTMLElement) {
    this.unregisterObjectElement(object);
    this.#objectByElement.set(element, object);
    this.#elementByObjectId.set(object.id, element);
  }

  unregisterObjectElement(object: ElementObject, element?: HTMLElement) {
    const registeredElement =
      element ?? this.#elementByObjectId.get(object.id) ?? null;
    if (
      registeredElement &&
      this.#objectByElement.get(registeredElement) === object
    ) {
      this.#objectByElement.delete(registeredElement);
    }

    if (
      !element ||
      this.#elementByObjectId.get(object.id) === registeredElement
    ) {
      this.#elementByObjectId.delete(object.id);
    }

    for (const pointer of Object.values(this.#pointerDict)) {
      if (pointer.owner === object) {
        pointer.owner = null;
        pointer.callerObjectId = null;
      }
      if (pointer.currentOwner === object) {
        pointer.currentOwner = null;
      }
    }

    for (const gesture of Object.values(this.#gestureDict)) {
      if (gesture.member === object) {
        gesture.member = null;
      }
    }
  }

  setPointerDragOwner(pointerId: number, owner: ElementObject | null) {
    const pointer = this.#pointerDict[pointerId];
    if (pointer) {
      pointer.owner = owner;
      pointer.callerObjectId = this.#getOwnerId(owner);
    }

    const gesture = this.#gestureDict[pointerId];
    if (gesture?.type === "drag") {
      gesture.member = owner;
    }
  }

  /**
   * Claims a pointer for its current gesture: GLOBAL listeners stop receiving
   * that pointer's events (down/move, dragStart/drag; pinches involving it;
   * wheel while any claim is held). Owner dispatch is unaffected, and end
   * events (pointerUp/dragEnd/pinchEnd) still deliver so an already-engaged
   * global listener can terminate cleanly. Call from a gesture owner's
   * pointerDown handler (claiming at dragStart is legal but the camera may
   * already have panned by the drag-start threshold).
   *
   * The claim is anchored to the input layer's pointer record and dies with it
   * on pointer up/cancel — it auto-releases and cannot be stranded, even if
   * the claiming object is destroyed mid-gesture.
   */
  claimPointer(pointerId: number): void {
    const pointer = this.#pointerDict[pointerId];
    if (pointer) pointer.claimed = true;
  }

  /** Releases a claim early (rarely needed — claims auto-release on gesture end). */
  releasePointerClaim(pointerId: number): void {
    const pointer = this.#pointerDict[pointerId];
    if (pointer) pointer.claimed = false;
  }

  #isPointerClaimed(pointerId: number | undefined): boolean {
    if (pointerId === undefined) return false;
    return this.#pointerDict[pointerId]?.claimed === true;
  }

  #hasClaimedPointer(): boolean {
    for (const pointer of Object.values(this.#pointerDict)) {
      if (pointer.claimed) return true;
    }
    return false;
  }

  subscribeGlobalCursorEvent<EventName extends keyof InputEventCallback>(
    event: EventName,
    id: string,
    callback: (prop: InputEventPayloadMap[EventName]) => void,
    engine: any | null,
  ) {
    const callbacks = this.globalCallbacks[event] as Record<
      string,
      { callback: GlobalInputCallback; engine: any | null }
    >;
    callbacks[id] = {
      callback: callback as GlobalInputCallback,
      engine,
    };
  }

  unsubscribeGlobalCursorEvent(event: keyof InputEventCallback, id: string) {
    delete this.globalCallbacks[event][id];
  }

  #destroyListeners() {
    this.#containerController?.abort();
    this.#documentController?.abort();
    this.#containerController = null;
    this.#documentController = null;
  }

  #getActiveDragCount(): number {
    return Object.values(this.#gestureDict).filter(
      (g) => g.type === "drag" && g.state === "drag",
    ).length;
  }

  #getActiveDragsSortedByTime(): {
    pointerId: number;
    gesture: dragGesture;
    timestamp: number;
  }[] {
    const drags: {
      pointerId: number;
      gesture: dragGesture;
      timestamp: number;
    }[] = [];

    for (const [key, gesture] of Object.entries(this.#gestureDict)) {
      if (gesture.type !== "drag" || gesture.state !== "drag") continue;
      const pointerId = parseInt(key, 10);
      const pointerData = this.#pointerDict[pointerId];
      if (pointerData) {
        drags.push({
          pointerId,
          gesture,
          timestamp: pointerData.timestamp,
        });
      }
    }

    return drags.sort((a, b) => a.timestamp - b.timestamp);
  }

  #cancelOldestDrag(): void {
    const drags = this.#getActiveDragsSortedByTime();
    if (drags.length === 0) return;

    const oldest = drags[0];
    const pointerData = this.#pointerDict[oldest.pointerId];
    if (!pointerData) return;

    this.#fireDragEnd(pointerData, 0);
    delete this.#gestureDict[oldest.pointerId];
    delete this.#pointerDict[oldest.pointerId];
  }

  #enforceMaxDragLimit(): void {
    const maxDrags = this.config.maxSimultaneousDrags;
    if (maxDrags <= 0 || maxDrags === Infinity) return;

    while (this.#getActiveDragCount() > maxDrags) {
      this.#cancelOldestDrag();
    }
  }

  dispatchPointerDown(
    object: ElementObject,
    params?: { x?: number; y?: number; buttons?: number; pointerId?: number },
  ) {
    const event = new PointerEvent("pointerdown", {
      clientX: params?.x ?? object.worldTransform.x,
      clientY: params?.y ?? object.worldTransform.y,
      buttons: params?.buttons ?? mouseButtonBitmap.LEFT,
      pointerId: params?.pointerId,
    });
    this.#onPointerDown(event, object);
  }

  #onPointerDown = (
    event: PointerEvent,
    object: ElementObject | null = null,
  ) => {
    if (!this.#isEventInsideContainer(event)) {
      return;
    }

    const position = this.#getCoordinates(event.clientX, event.clientY);
    // A resize-hitbox hit supersedes the DOM owner under it, and covers the case
    // where the pointer is inside the (virtual) hitbox but outside the node's DOM
    // box (so DOM routing would miss it). Explicit `object` still wins.
    const owner =
      object ?? this.#resolveResizeOwner(position) ?? this.#getTargetOwner(event);
    const isWithinEngine = this.#isCoordinateWithinEngine(
      event.clientX,
      event.clientY,
    );
    // TODO: Use persistentDeviceId if available
    this.#pointerDict[event.pointerId] = {
      id: event.pointerId,
      callerObjectId: owner?.id ?? null,
      timestamp: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY,
      endX: null,
      endY: null,
      moveCount: 0,
      button: event.buttons,
      isWithinEngine,
      owner,
      currentOwner: owner,
      claimed: false,
    };

    this.#gestureDict[event.pointerId] = {
      type: "drag",
      state: "pending",
      member: owner,
      pointerId: event.pointerId,
    };

    const prop: pointerDownProp = {
      event,
      objectId: owner?.id ?? null,
      position,
      button: event.buttons,
      isWithinEngine,
    };

    this.#dispatchObjectEvent(owner, "pointerDown", prop);
    // An owner's pointerDown handler may have claimed the pointer just above.
    if (!this.#isPointerClaimed(event.pointerId)) {
      this.#dispatchGlobalEvent("pointerDown", prop);
    }
  };

  #onContainerPointerMove = (event: PointerEvent) => {
    this.#handlePointerMove(event);
  };

  #onDocumentPointerMove = (event: PointerEvent) => {
    if (this.#isEventInsideContainer(event)) {
      return;
    }
    if (this.#pointerDict[event.pointerId] == null) {
      return;
    }
    this.#handlePointerMove(event);
  };

  #handlePointerMove(event: PointerEvent) {
    const pointer = this.#pointerDict[event.pointerId] ?? null;
    const isInsideContainer = this.#isEventInsideContainer(event);
    if (!pointer && !isInsideContainer) {
      return;
    }

    const currentOwner = isInsideContainer ? this.#getTargetOwner(event) : null;
    const position = this.#getCoordinates(event.clientX, event.clientY);
    const prop: pointerMoveProp = {
      event,
      objectId: currentOwner?.id ?? null,
      position,
      button: event.buttons,
    };

    this.#dispatchObjectEvent(currentOwner, "pointerMove", prop);
    if (!this.#isPointerClaimed(event.pointerId)) {
      this.#dispatchGlobalEvent("pointerMove", prop);
    }

    if (pointer) {
      Object.assign(pointer, {
        prevX: pointer.x,
        prevY: pointer.y,
        x: event.clientX,
        y: event.clientY,
        currentOwner,
      });
      pointer.moveCount++;
      this.#handleDrag(pointer);
      this.#handlePinchGestures();
    }
  }

  #onPointerUp = (event: PointerEvent) => {
    this.#finishPointer(event);
  };

  #onPointerCancel = (event: PointerEvent) => {
    this.#finishPointer(event);
  };

  #finishPointer(event: PointerEvent) {
    const pointer = this.#pointerDict[event.pointerId] ?? null;
    const isInsideContainer = this.#isEventInsideContainer(event);
    if (!pointer && !isInsideContainer) {
      return;
    }

    const currentOwner = isInsideContainer ? this.#getTargetOwner(event) : null;
    const position = this.#getCoordinates(event.clientX, event.clientY);
    const prop: pointerUpProp = {
      event,
      objectId: currentOwner?.id ?? null,
      position,
      button: event.buttons,
    };

    this.#dispatchObjectEvent(currentOwner, "pointerUp", prop);
    this.#dispatchGlobalEvent("pointerUp", prop);

    if (!pointer) {
      return;
    }

    pointer.endX = event.clientX;
    pointer.endY = event.clientY;

    const gesture = this.#gestureDict[event.pointerId];
    if (gesture?.type === "drag") {
      // Once a drag has actually started (dragStart was dispatched, so the
      // gesture is in the "drag" state), releasing must always fire dragEnd —
      // even if the pointer wandered back near its start point. Re-measuring
      // the distance at release would misclassify an away-and-back gesture
      // (e.g. dropping an item back in the same place) as a click and leave
      // the drag session uncommitted. Only a gesture still "pending" at
      // release (never crossed the start threshold) is a click.
      const dragStarted = gesture.state === "drag";
      gesture.state = "release";
      if (dragStarted || this.#isPastDragStartThreshold(pointer)) {
        this.#fireDragEnd(pointer, pointer.button);
      }
      delete this.#gestureDict[event.pointerId];
    }

    this.#endPinchGesturesForPointer(event.pointerId);
    delete this.#pointerDict[event.pointerId];
  }

  #onWheel = (event: WheelEvent) => {
    if (!this.#isEventInsideContainer(event)) {
      return;
    }

    const owner = this.#getTargetOwner(event);
    const prop: mouseWheelProp = {
      event,
      objectId: owner?.id ?? null,
      position: this.#getCoordinates(event.clientX, event.clientY),
      delta: event.deltaY,
    };

    this.#dispatchObjectEvent(owner, "mouseWheel", prop);
    // Wheel has no pointer identity; block it globally while any gesture holds
    // a claim (e.g. no camera wheel-pan mid node-drag).
    if (!this.#hasClaimedPointer()) {
      this.#dispatchGlobalEvent("mouseWheel", prop);
    }
  };

  #getCoordinates(screenX: number, screenY: number): eventPosition {
    if (this.#engine == null || this.#engine.camera == null) {
      return {
        x: screenX,
        y: screenY,
        cameraX: screenX,
        cameraY: screenY,
        screenX,
        screenY,
      };
    }
    const [cameraX, cameraY] = this.#engine.camera.getCameraFromScreen(
      screenX,
      screenY,
    );
    const [worldX, worldY] = this.#engine.camera.getWorldFromCamera(
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

  #handleDrag(pointer: TrackedPointer) {
    const gesture = this.#gestureDict[pointer.id];
    if (!gesture || gesture.type !== "drag") {
      return;
    }

    if (gesture.state === "pending") {
      if (!this.#isPastDragStartThreshold(pointer)) {
        return;
      }
      this.#startDragGesture(pointer, gesture);
      if (this.#gestureDict[pointer.id] !== gesture) {
        return;
      }
    }

    if (gesture.state !== "drag") {
      return;
    }

    this.#fireDrag(pointer);
  }

  #isPastDragStartThreshold(pointer: pointerData) {
    return (
      Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >=
      DRAG_START_THRESHOLD_PX
    );
  }

  #startDragGesture(pointer: TrackedPointer, gesture: dragGesture) {
    gesture.state = "drag";
    this.#enforceMaxDragLimit();
    if (this.#gestureDict[pointer.id] !== gesture) {
      return;
    }

    const prop: dragStartProp = {
      objectId: this.#getOwnerId(pointer.owner),
      pointerId: pointer.id,
      start: this.#getCoordinates(pointer.startX, pointer.startY),
      button: pointer.button,
      isWithinEngine: pointer.isWithinEngine,
    };

    this.#dispatchObjectEvent(pointer.owner, "dragStart", prop);
    if (!pointer.claimed) {
      this.#dispatchGlobalEvent("dragStart", prop);
    }
  }

  #fireDrag(pointer: TrackedPointer) {
    const start = this.#getCoordinates(pointer.startX, pointer.startY);
    const position = this.#getCoordinates(pointer.x, pointer.y);
    const prop: dragProp = {
      objectId: this.#getOwnerId(pointer.owner),
      pointerId: pointer.id,
      start,
      position,
      delta: {
        x: position.x - start.x,
        y: position.y - start.y,
        cameraX: position.cameraX - start.cameraX,
        cameraY: position.cameraY - start.cameraY,
        screenX: position.screenX - start.screenX,
        screenY: position.screenY - start.screenY,
      },
      button: pointer.button,
    };

    this.#dispatchObjectEvent(pointer.owner, "drag", prop);
    if (!pointer.claimed) {
      this.#dispatchGlobalEvent("drag", prop);
    }
  }

  #fireDragEnd(pointer: TrackedPointer, button: number) {
    const prop: dragEndProp = {
      objectId: this.#getOwnerId(pointer.owner),
      pointerId: pointer.id,
      start: this.#getCoordinates(pointer.startX, pointer.startY),
      end: this.#getCoordinates(
        pointer.endX ?? pointer.x,
        pointer.endY ?? pointer.y,
      ),
      button,
    };

    this.#dispatchObjectEvent(pointer.owner, "dragEnd", prop);
    this.#dispatchGlobalEvent("dragEnd", prop);
  }

  #handlePinchGestures() {
    const pointerList = Object.values(this.#pointerDict);
    if (pointerList.length < 2) return;

    pointerList.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < pointerList.length - 1; i++) {
      const pointer0 = pointerList[i];
      const pointer1 = pointerList[i + 1];
      const gestureKey = `${pointer0.id}-${pointer1.id}`;

      const currentPointer0 = this.#getCoordinates(pointer0.x, pointer0.y);
      const currentPointer1 = this.#getCoordinates(pointer1.x, pointer1.y);
      const currentDistance = Math.hypot(
        pointer0.x - pointer1.x,
        pointer0.y - pointer1.y,
      );

      if (this.#gestureDict[gestureKey] == null) {
        const startDistance = Math.hypot(
          pointer0.startX - pointer1.startX,
          pointer0.startY - pointer1.startY,
        );
        const startPointer0 = this.#getCoordinates(
          pointer0.startX,
          pointer0.startY,
        );
        const startPointer1 = this.#getCoordinates(
          pointer1.startX,
          pointer1.startY,
        );
        this.#gestureDict[gestureKey] = {
          type: "pinch",
          state: "pinch",
          member: pointer0.owner,
          pointerId0: pointer0.id,
          pointerId1: pointer1.id,
          start: {
            pointerList: [startPointer0, startPointer1],
            distance: startDistance,
          },
          current: {
            pointerList: [currentPointer0, currentPointer1],
            distance: currentDistance,
          },
        };

        const pinchStartGesture = this.#gestureDict[gestureKey] as pinchGesture;
        const prop: pinchStartProp = {
          objectId: this.#getOwnerId(pinchStartGesture.member),
          gestureID: gestureKey,
          start: pinchStartGesture.start,
        };
        this.#dispatchObjectEvent(pinchStartGesture.member, "pinchStart", prop);
        if (
          !this.#isPointerClaimed(pinchStartGesture.pointerId0) &&
          !this.#isPointerClaimed(pinchStartGesture.pointerId1)
        ) {
          this.#dispatchGlobalEvent("pinchStart", prop);
        }
      }

      const gesture = this.#gestureDict[gestureKey] as pinchGesture;
      gesture.current = {
        pointerList: [currentPointer0, currentPointer1],
        distance: currentDistance,
      };

      const prop: pinchProp = {
        objectId: this.#getOwnerId(gesture.member),
        gestureID: gestureKey,
        start: gesture.start,
        current: gesture.current,
      };
      this.#dispatchObjectEvent(gesture.member, "pinch", prop);
      // A pinch involving a claimed pointer is suppressed globally; pinchEnd
      // still delivers (end events always do) so engaged listeners clean up.
      if (
        !this.#isPointerClaimed(gesture.pointerId0) &&
        !this.#isPointerClaimed(gesture.pointerId1)
      ) {
        this.#dispatchGlobalEvent("pinch", prop);
      }
    }
  }

  #endPinchGesturesForPointer(pointerId: number) {
    for (const [gestureKey, gesture] of Object.entries(this.#gestureDict)) {
      if (gesture.type !== "pinch") {
        continue;
      }
      if (
        gesture.pointerId0 !== pointerId &&
        gesture.pointerId1 !== pointerId
      ) {
        continue;
      }

      const prop: pinchEndProp = {
        objectId: this.#getOwnerId(gesture.member),
        gestureID: gestureKey,
        start: gesture.start,
        current: gesture.current,
        end: gesture.current,
      };
      this.#dispatchObjectEvent(gesture.member, "pinchEnd", prop);
      this.#dispatchGlobalEvent("pinchEnd", prop);
      delete this.#gestureDict[gestureKey];
    }
  }

  #dispatchObjectEvent<EventName extends keyof InputEventCallback>(
    owner: ElementObject | null,
    event: EventName,
    prop: InputEventPayloadMap[EventName],
  ) {
    if (!owner || !this.#isOwnerRegistered(owner)) {
      return;
    }
    owner.event.input[event]?.(prop as any);
  }

  #dispatchGlobalEvent<EventName extends keyof InputEventCallback>(
    event: EventName,
    prop: InputEventPayloadMap[EventName],
  ) {
    for (const { callback, engine } of Object.values(
      this.globalCallbacks[event],
    )) {
      if (engine && engine !== this.#engine) {
        continue;
      }
      callback(prop);
    }
  }

  // Colliders never appear in composedPath, so a registered resize hitbox is
  // resolved geometrically: if the pointerdown is inside one, the owner is the
  // hitbox's object (collider.parent), so the whole gesture flows to it through
  // the normal owner dispatch. Synchronous point test — independent of the
  // frame-delayed collision sweep. The registry shape is declared in
  // snapline's snapline-globals.ts (engine core cannot import snapline, hence
  // the structural type here) — keep the two in sync.
  #resolveResizeOwner(position: eventPosition): ElementObject | null {
    const handles = this.global?.data?.resizeHandles as
      | Array<{
          engine: unknown;
          parent: unknown;
          containsWorldPoint(x: number, y: number): boolean;
        }>
      | undefined;
    if (!handles) return null;
    for (const collider of handles) {
      if (collider.engine !== this.#engine) continue;
      if (collider.containsWorldPoint(position.x, position.y)) {
        return collider.parent as ElementObject;
      }
    }
    return null;
  }

  #getTargetOwner(event: Event): ElementObject | null {
    for (const target of this.#getEventPath(event)) {
      if (!(target instanceof HTMLElement)) {
        continue;
      }
      const owner = this.#objectByElement.get(target);
      if (owner && this.#isOwnerRegistered(owner)) {
        return owner;
      }
    }
    return null;
  }

  #getEventPath(event: Event): EventTarget[] {
    if (typeof event.composedPath === "function") {
      return event.composedPath();
    }

    const path: EventTarget[] = [];
    let node = event.target;
    while (node) {
      path.push(node);
      node = (node as Node).parentNode;
    }
    return path;
  }

  #getOwnerId(owner: ElementObject | null) {
    if (!owner || !this.#isOwnerRegistered(owner)) {
      return null;
    }
    return owner.id;
  }

  #isOwnerRegistered(owner: ElementObject) {
    const element = this.#elementByObjectId.get(owner.id);
    return !!element && this.#objectByElement.get(element) === owner;
  }

  #isCoordinateWithinEngine(screenX: number, screenY: number) {
    const rect = this.#engine?.containerBounds;
    if (rect == null) {
      return true;
    }
    return (
      screenX >= rect.left &&
      screenX <= rect.right &&
      screenY >= rect.top &&
      screenY <= rect.bottom
    );
  }

  #isEventInsideContainer(event: Event) {
    if (!this.#container) {
      return false;
    }
    if (this.#getEventPath(event).includes(this.#container)) {
      return true;
    }
    return (
      event.target instanceof Node && this.#container.contains(event.target)
    );
  }

  #createInputEventCallback(): InputEventCallback {
    return {
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
  }

  #createGlobalCallbackRegistry(): GlobalCallbackRegistry {
    return inputEventKeys.reduce((registry, key) => {
      registry[key] = {};
      return registry;
    }, {} as GlobalCallbackRegistry);
  }

  #isInputEventKey(key: string): key is keyof InputEventCallback {
    return inputEventKeys.includes(key as keyof InputEventCallback);
  }
}

export { InputControl };
