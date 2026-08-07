import type { GlobalManager } from "./global";
import { BaseObject, ElementObject } from "./object";
import type { DomElement } from "./object";
import { reportConsumerError } from "./errors";

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
  cancelled: boolean;
}

export interface GestureHandoffControl {
  handoffTo(objectOrId: ElementObject<DomElement> | string): void;
}

export interface mouseWheelProp {
  event: WheelEvent;
  objectId: string | null;
  position: eventPosition;
  delta: number;
}

export interface dragStartProp extends GestureHandoffControl {
  objectId: string | null;
  pointerId: number;
  start: eventPosition;
  button: number;
  isWithinEngine: boolean;
}

export interface dragProp extends GestureHandoffControl {
  objectId: string | null;
  pointerId: number;
  start: eventPosition;
  position: eventPosition;
  delta: eventPosition;
  button: number;
}

export interface dragEndProp {
  event: PointerEvent;
  objectId: string | null;
  pointerId: number;
  start: eventPosition;
  end: eventPosition;
  button: number;
  cancelled: boolean;
}

export interface PinchSnapshot {
  pointerList: eventPosition[];
  distance: number;
}

export interface pinchStartProp extends GestureHandoffControl {
  objectId: string | null;
  gestureID: string;
  start: PinchSnapshot;
}

export interface pinchProp extends GestureHandoffControl {
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
  cancelled: boolean;
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
  x: number; // Screen-space coordinates
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
const DRAG_START_THRESHOLD_PX = 0;

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
  dragState: "pending" | "drag";
  owner: ElementObject<DomElement> | null;
  currentOwner: ElementObject<DomElement> | null;
  captureElement: DomElement | null;
  originElement: DomElement | null;
  lastEvent: PointerEvent;
  finalizing: boolean;
  claimed: boolean;
};

interface PinchGesture {
  member: ElementObject<DomElement> | null;
  memberElement: DomElement | null;
  pointerId0: number;
  pointerId1: number;
  start: PinchSnapshot;
  current: PinchSnapshot;
}

type HandoffDestination = {
  object: ElementObject<DomElement>;
  element: DomElement;
};

type FinalizePointerOptions = {
  event: PointerEvent;
  cancelled: boolean;
  dispatchTerminal?: boolean;
};

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
  #elementByObjectId: Map<string, DomElement>;
  #engine: any;
  #objectByElement: WeakMap<DomElement, ElementObject<DomElement>>;
  #pinches: Map<string, PinchGesture>;
  #pointers: Map<number, TrackedPointer>;
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
    this.#objectByElement = new WeakMap();
    this.#pinches = new Map();
    this.#pointers = new Map();

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
    this.#finalizeAllPointers(false);
    this.#destroyListeners();
    this.#container = container;
    this.#pointers.clear();
    this.#pinches.clear();

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
    this.#document.addEventListener(
      "lostpointercapture",
      this.#onLostPointerCapture,
      {
        signal: this.#documentController.signal,
      },
    );
  }

  destroy() {
    this.#finalizeAllPointers(false); // Cancel all ongoing gestures
    this.#destroyListeners();
    this.globalCallbacks = this.#createGlobalCallbackRegistry();
    this.#container = null;
    this.#elementByObjectId.clear();
    this.#objectByElement = new WeakMap();
    this.#pinches.clear();
    this.#pointers.clear();
  }

  /**
   * Register an object so it can be tracked for input events.
   * @param object - The ElementObject to register.
   * @param element - The DOM element to associate with the object.
   */
  registerObjectElement(
    object: ElementObject<DomElement>,
    element: DomElement,
  ) {
    this.unregisterObjectElement(object);
    this.#objectByElement.set(element, object);
    this.#elementByObjectId.set(object.id, element);
  }

  /**
   * Unregister an object so it no longer receives input events
   * tracked by SnapEngine.
   * @param object - The ElementObject to unregister.
   * @param element - The DOM element to disassociate from the object.
   *                  Required if the element is not the same as the one
   *                  stored in object.element.
   */
  unregisterObjectElement(
    object: ElementObject<DomElement>,
    element?: DomElement,
  ) {
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

    const affectedPointers = new Set(
      [...this.#pointers.values()].filter(
        (pointer) =>
          pointer.owner === object ||
          pointer.currentOwner === object ||
          pointer.captureElement === registeredElement,
      ),
    );
    for (const gesture of this.#pinches.values()) {
      if (gesture.member !== object) continue;
      const pointer0 = this.#pointers.get(gesture.pointerId0);
      const pointer1 = this.#pointers.get(gesture.pointerId1);
      if (pointer0) affectedPointers.add(pointer0);
      if (pointer1) affectedPointers.add(pointer1);
    }
    for (const pointer of affectedPointers) {
      this.#finalizePointer(pointer, {
        event: pointer.lastEvent,
        cancelled: true,
      });
    }
  }

  /* Claims a pointer for its current gesture. */
  claimPointer(pointerId: number): void {
    const pointer = this.#pointers.get(pointerId);
    if (pointer) pointer.claimed = true;
  }

  /** Releases a claim early (rarely needed — claims auto-release on gesture end). */
  releasePointerClaim(pointerId: number): void {
    const pointer = this.#pointers.get(pointerId);
    if (pointer) pointer.claimed = false;
  }

  #isPointerClaimed(pointerId: number | undefined): boolean {
    if (pointerId === undefined) return false;
    return this.#pointers.get(pointerId)?.claimed === true;
  }

  #hasClaimedPointer(): boolean {
    for (const pointer of this.#pointers.values()) {
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

  #captureOn(pointer: TrackedPointer, element: DomElement): void {
    if (
      pointer.captureElement === element &&
      typeof element.hasPointerCapture === "function" &&
      element.hasPointerCapture(pointer.id)
    ) {
      return;
    }
    element.setPointerCapture(pointer.id);
    pointer.captureElement = element;
  }

  /**
   * Call setPointerCapture for the given element,
   * and update the pointer's captureElement
   */
  #capturePointer(
    pointer: TrackedPointer,
    element: DomElement | null,
  ): void {
    if (
      !element?.isConnected ||
      typeof element.setPointerCapture !== "function"
    ) {
      return;
    }
    try {
      this.#captureOn(pointer, element);
    } catch (error) {
      reportConsumerError(error);
    }
  }

  /**
   * Determine the object and the element to hand off
   * input controls to, given the object reference or ID.
   * @param objectOrId
   * @returns
   */
  #resolveHandoffDestination(
    objectOrId: ElementObject<DomElement> | string,
  ): HandoffDestination {
    const object =
      typeof objectOrId === "string"
        ? this.global?.getEngineObjectTable(this.#engine)?.[objectOrId]
        : objectOrId;
    if (!(object instanceof ElementObject)) {
      throw new Error(
        `InputControl.handoffTo: destination must resolve to an ElementObject in this engine.`,
      );
    }
    if (object.engine !== this.#engine || object.isDeleteRequested) {
      throw new Error(
        `InputControl.handoffTo: destination ${object.id} is not live in this engine.`,
      );
    }
    const element = this.#elementByObjectId.get(object.id) ?? null;
    if (
      !element ||
      this.#objectByElement.get(element) !== object ||
      !element.isConnected
    ) {
      throw new Error(
        `InputControl.handoffTo: destination ${object.id} has no connected input element.`,
      );
    }
    return { object, element };
  }

  #handoffDrag(
    pointerId: number,
    objectOrId: ElementObject<DomElement> | string,
  ): void {
    const pointer = this.#pointers.get(pointerId);
    if (
      !pointer ||
      pointer.finalizing ||
      pointer.dragState !== "drag"
    ) {
      throw new Error(
        `InputControl.handoffTo: drag gesture ${pointerId} is no longer active.`,
      );
    }
    const destination = this.#resolveHandoffDestination(objectOrId);
    if (typeof destination.element.setPointerCapture !== "function") {
      throw new Error(
        `InputControl.handoffTo: destination ${destination.object.id} does not support pointer capture.`,
      );
    }
    try {
      this.#captureOn(pointer, destination.element);
      pointer.owner = destination.object;
      pointer.currentOwner = destination.object;
      pointer.callerObjectId = destination.object.id;
    } catch (error) {
      this.#finalizePointer(pointer, {
        event: pointer.lastEvent,
        cancelled: true,
      });
      throw error;
    }
  }

  #handoffPinch(
    gestureKey: string,
    objectOrId: ElementObject<DomElement> | string,
  ): void {
    const gesture = this.#pinches.get(gestureKey);
    if (!gesture) {
      throw new Error(
        `InputControl.handoffTo: pinch gesture ${gestureKey} is no longer active.`,
      );
    }
    const pointer0 = this.#pointers.get(gesture.pointerId0);
    const pointer1 = this.#pointers.get(gesture.pointerId1);
    if (
      !pointer0 ||
      !pointer1 ||
      pointer0.finalizing ||
      pointer1.finalizing
    ) {
      throw new Error(
        `InputControl.handoffTo: pinch gesture ${gestureKey} is no longer active.`,
      );
    }

    const destination = this.#resolveHandoffDestination(objectOrId);
    gesture.member = destination.object;
    gesture.memberElement = destination.element;
  }

  #releasePointerCapture(pointer: TrackedPointer): void {
    const element = pointer.captureElement;
    pointer.captureElement = null;
    if (!element || typeof element.releasePointerCapture !== "function") {
      return;
    }
    try {
      if (
        typeof element.hasPointerCapture !== "function" ||
        element.hasPointerCapture(pointer.id)
      ) {
        element.releasePointerCapture(pointer.id);
      }
    } catch {
      // Release is best-effort after DOM removal or implicit browser release.
    }
  }

  /**
   * Common handling for a pointer that has just finished a
   * gesture, like recording end positions.
   * @param pointer
   * @param options.event - The event that triggered the finalization.
   * @param options.cancelled - Whether the gesture was cancelled.
   * @param options.dispatchTerminal - Whether to dispatch pointer up
   *                                   events (default: true).
   * @returns void
   */
  #finalizePointer(
    pointer: TrackedPointer,
    {
      event,
      cancelled,
      dispatchTerminal = true,
    }: FinalizePointerOptions,
  ): void {
    if (
      pointer.finalizing ||
      this.#pointers.get(pointer.id) !== pointer
    ) {
      return;
    }
    pointer.finalizing = true;
    pointer.lastEvent = event;
    pointer.endX = event.clientX;
    pointer.endY = event.clientY;

    try {
      if (dispatchTerminal) {
        const currentOwner =
          pointer.captureElement != null
            ? pointer.owner
            : this.#getTargetOwner(event);
        const pointerUp: pointerUpProp = {
          event,
          objectId: this.#getOwnerId(currentOwner),
          position: this.#getCoordinates(event.clientX, event.clientY),
          button: event.buttons,
          cancelled,
        };
        this.#dispatchObjectEvent(currentOwner, "pointerUp", pointerUp);
        this.#dispatchGlobalEvent("pointerUp", pointerUp);

        if (
          pointer.dragState === "drag" ||
          this.#isPastDragStartThreshold(pointer)
        ) {
          this.#fireDragEnd(pointer, pointer.button, event, cancelled);
        }
      }
    } finally {
      this.#endPinchGesturesForPointer(pointer.id, cancelled, dispatchTerminal);
      this.#releasePointerCapture(pointer);
      this.#pointers.delete(pointer.id);
    }
  }

  /**
   * Finalize all active pointers.
   * @param dispatchTerminal - Whether to dispatch pointer up events.
   */
  #finalizeAllPointers(dispatchTerminal: boolean): void {
    for (const pointer of [...this.#pointers.values()]) {
      this.#finalizePointer(pointer, {
        event: pointer.lastEvent,
        cancelled: true,
        dispatchTerminal,
      });
    }
  }

  #getActiveDragCount(): number {
    return [...this.#pointers.values()].filter(
      (pointer) => pointer.dragState === "drag",
    ).length;
  }

  #getActiveDragsSortedByTime(): TrackedPointer[] {
    return [...this.#pointers.values()]
      .filter((pointer) => pointer.dragState === "drag")
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  #cancelOldestDrag(): void {
    const drags = this.#getActiveDragsSortedByTime();
    if (drags.length === 0) return;

    const oldest = drags[0];
    this.#finalizePointer(oldest, {
      event: oldest.lastEvent,
      cancelled: true,
    });
  }

  #enforceMaxDragLimit(): void {
    const maxDrags = this.config.maxSimultaneousDrags;
    if (maxDrags <= 0 || maxDrags === Infinity) return;

    while (this.#getActiveDragCount() > maxDrags) {
      this.#cancelOldestDrag();
    }
  }

  // dispatchPointerDown(
  //   object: ElementObject<DomElement>,
  //   params?: { x?: number; y?: number; buttons?: number; pointerId?: number },
  // ) {
  //   const event = new PointerEvent("pointerdown", {
  //     clientX: params?.x ?? object.worldTransform.x,
  //     clientY: params?.y ?? object.worldTransform.y,
  //     buttons: params?.buttons ?? mouseButtonBitmap.LEFT,
  //     pointerId: params?.pointerId,
  //   });
  //   this.#onPointerDown(event, object);
  // }

  #onPointerDown = (
    event: PointerEvent,
    object: ElementObject<DomElement> | null = null,
  ) => {
    // TODO: Remove in favor of #isCoordinateWithinEngine?
    if (!this.#isEventInsideContainer(event)) {
      return;
    }

    const position = this.#getCoordinates(event.clientX, event.clientY);
    const domOwner = this.#getTargetOwner(event);
    const owner = object ?? domOwner;
    const isWithinEngine = this.#isCoordinateWithinEngine(
      event.clientX,
      event.clientY,
    );
    // TODO: Use persistentDeviceId if available
    const pointer: TrackedPointer = {
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
      dragState: "pending",
      owner,
      currentOwner: owner,
      captureElement: null,
      originElement: owner
        ? (this.#elementByObjectId.get(owner.id) ?? null)
        : null,
      lastEvent: event,
      finalizing: false,
      claimed: false,
    };
    this.#pointers.set(event.pointerId, pointer);

    const prop: pointerDownProp = {
      event,
      objectId: owner?.id ?? null,
      position,
      button: event.buttons,
      isWithinEngine,
    };

    this.#dispatchObjectEvent(owner, "pointerDown", prop);
    if (this.#pointers.get(event.pointerId) !== pointer) return;
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
    if (!this.#pointers.has(event.pointerId)) {
      return;
    }
    this.#handlePointerMove(event);
  };

  #handlePointerMove(event: PointerEvent) {
    const pointer = this.#pointers.get(event.pointerId) ?? null;
    const isInsideContainer = this.#isEventInsideContainer(event);
    if (!pointer && !isInsideContainer) {
      return;
    }

    const ownerElement = pointer?.owner
      ? this.#elementByObjectId.get(pointer.owner.id)
      : null;
    if (
      pointer &&
      ((pointer.captureElement && !pointer.captureElement.isConnected) ||
        (ownerElement && !ownerElement.isConnected))
    ) {
      this.#finalizePointer(pointer, { event, cancelled: true });
      return;
    }

    const currentOwner =
      pointer?.captureElement != null
        ? pointer.owner
        : isInsideContainer || pointer
          ? this.#getTargetOwner(event)
          : null;
    const position = this.#getCoordinates(event.clientX, event.clientY);
    const prop: pointerMoveProp = {
      event,
      objectId: currentOwner?.id ?? null,
      position,
      button: event.buttons,
    };

    this.#dispatchObjectEvent(currentOwner, "pointerMove", prop);
    if (pointer && this.#pointers.get(event.pointerId) !== pointer) return;
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
        lastEvent: event,
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
    this.#finishPointer(event, true);
  };

  #onLostPointerCapture = (event: PointerEvent) => {
    const pointer = this.#pointers.get(event.pointerId) ?? null;
    const captureElement = pointer?.captureElement ?? null;
    if (
      !pointer ||
      pointer.finalizing ||
      !captureElement ||
      event.target !== captureElement
    ) {
      return;
    }
    // Framework reconciliation may move a still-connected captured subtree.
    // Browsers can drop native capture during that DOM move even though the
    // gesture remains valid, so reacquire it while the pointer is still down.
    // A released pointer, disconnected element, or rejected recapture follows
    // the normal cancelled-terminal path below.
    if (event.buttons !== 0 && captureElement.isConnected) {
      try {
        this.#captureOn(pointer, captureElement);
        return;
      } catch (error) {
        reportConsumerError(error);
      }
    }
    this.#finalizePointer(pointer, { event, cancelled: true });
  };

  #finishPointer(event: PointerEvent, cancelled = false) {
    const pointer = this.#pointers.get(event.pointerId) ?? null;
    const isInsideContainer = this.#isEventInsideContainer(event);
    if (!pointer && !isInsideContainer) {
      return;
    }

    // If pointer was lost, treat as normal pointer up
    if (!pointer) {
      const currentOwner = isInsideContainer
        ? this.#getTargetOwner(event)
        : null;
      const prop: pointerUpProp = {
        event,
        objectId: currentOwner?.id ?? null,
        position: this.#getCoordinates(event.clientX, event.clientY),
        button: event.buttons,
        cancelled,
      };
      this.#dispatchObjectEvent(currentOwner, "pointerUp", prop);
      this.#dispatchGlobalEvent("pointerUp", prop);
      return;
    }

    this.#finalizePointer(pointer, { event, cancelled });
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
    if (pointer.dragState === "pending") {
      if (!this.#isPastDragStartThreshold(pointer)) {
        return;
      }
      this.#startDragGesture(pointer);
      if (this.#pointers.get(pointer.id) !== pointer) {
        return;
      }
    }

    if (pointer.dragState !== "drag") {
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

  #startDragGesture(pointer: TrackedPointer) {
    pointer.dragState = "drag";
    const ownerElement = pointer.owner
      ? (this.#elementByObjectId.get(pointer.owner.id) ?? null)
      : null;
    this.#capturePointer(pointer, ownerElement);
    this.#enforceMaxDragLimit();
    if (this.#pointers.get(pointer.id) !== pointer) {
      return;
    }

    const prop: dragStartProp = {
      objectId: this.#getOwnerId(pointer.owner),
      pointerId: pointer.id,
      start: this.#getCoordinates(pointer.startX, pointer.startY),
      button: pointer.button,
      isWithinEngine: pointer.isWithinEngine,
      handoffTo: (objectOrId) => this.#handoffDrag(pointer.id, objectOrId),
    };

    this.#dispatchObjectEvent(pointer.owner, "dragStart", prop);
    if (this.#pointers.get(pointer.id) !== pointer) return;
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
      handoffTo: (objectOrId) => this.#handoffDrag(pointer.id, objectOrId),
    };

    this.#dispatchObjectEvent(pointer.owner, "drag", prop);
    if (this.#pointers.get(pointer.id) !== pointer) return;
    if (!pointer.claimed) {
      this.#dispatchGlobalEvent("drag", prop);
    }
  }

  #fireDragEnd(
    pointer: TrackedPointer,
    button: number,
    event: PointerEvent,
    cancelled: boolean,
  ) {
    const prop: dragEndProp = {
      event,
      objectId: this.#getOwnerId(pointer.owner),
      pointerId: pointer.id,
      start: this.#getCoordinates(pointer.startX, pointer.startY),
      end: this.#getCoordinates(
        pointer.endX ?? pointer.x,
        pointer.endY ?? pointer.y,
      ),
      button,
      cancelled,
    };

    this.#dispatchObjectEvent(pointer.owner, "dragEnd", prop);
    this.#dispatchGlobalEvent("dragEnd", prop);
  }

  #handlePinchGestures() {
    const pointerList = [...this.#pointers.values()];
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

      let gesture = this.#pinches.get(gestureKey);
      if (!gesture) {
        this.#capturePointer(pointer0, pointer0.originElement);
        this.#capturePointer(pointer1, pointer1.originElement);
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
        gesture = {
          member: pointer0.owner,
          memberElement: pointer0.owner
            ? (this.#elementByObjectId.get(pointer0.owner.id) ?? null)
            : null,
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
        this.#pinches.set(gestureKey, gesture);

        const prop: pinchStartProp = {
          objectId: this.#getOwnerId(gesture.member),
          gestureID: gestureKey,
          start: gesture.start,
          handoffTo: (objectOrId) => this.#handoffPinch(gestureKey, objectOrId),
        };
        this.#dispatchObjectEvent(gesture.member, "pinchStart", prop);
        if (this.#pinches.get(gestureKey) !== gesture) {
          continue;
        }
        if (
          !this.#isPointerClaimed(gesture.pointerId0) &&
          !this.#isPointerClaimed(gesture.pointerId1)
        ) {
          this.#dispatchGlobalEvent("pinchStart", prop);
        }
      }

      if (gesture.memberElement && !gesture.memberElement.isConnected) {
        this.#cancelPinchPointers(gesture);
        continue;
      }

      gesture.current = {
        pointerList: [currentPointer0, currentPointer1],
        distance: currentDistance,
      };

      const prop: pinchProp = {
        objectId: this.#getOwnerId(gesture.member),
        gestureID: gestureKey,
        start: gesture.start,
        current: gesture.current,
        handoffTo: (objectOrId) => this.#handoffPinch(gestureKey, objectOrId),
      };
      this.#dispatchObjectEvent(gesture.member, "pinch", prop);
      if (this.#pinches.get(gestureKey) !== gesture) {
        continue;
      }
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

  #cancelPinchPointers(gesture: PinchGesture): void {
    for (const pointerId of [gesture.pointerId0, gesture.pointerId1]) {
      const pointer = this.#pointers.get(pointerId);
      if (!pointer) continue;
      this.#finalizePointer(pointer, {
        event: pointer.lastEvent,
        cancelled: true,
      });
    }
  }

  #endPinchGesturesForPointer(
    pointerId: number,
    cancelled: boolean,
    dispatchTerminal = true,
  ) {
    for (const [gestureKey, gesture] of [...this.#pinches.entries()]) {
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
        cancelled,
      };
      try {
        if (dispatchTerminal) {
          this.#dispatchObjectEvent(gesture.member, "pinchEnd", prop);
          this.#dispatchGlobalEvent("pinchEnd", prop);
        }
      } finally {
        this.#pinches.delete(gestureKey);
      }
    }
  }

  #dispatchObjectEvent<EventName extends keyof InputEventCallback>(
    owner: ElementObject<DomElement> | null,
    event: EventName,
    prop: InputEventPayloadMap[EventName],
  ) {
    if (!owner || !this.#isObjectRegistered(owner)) {
      return;
    }

    const path: BaseObject[] = [];
    let current: BaseObject | null = owner;
    while (current) {
      path.push(current);
      current = current.parent;
    }
    for (const target of path) {
      if (!this.#isObjectRegistered(target)) continue;
      try {
        target.event.input[event]?.(prop as any);
      } catch (error) {
        // Errors are isolated per target so later ancestors, global listeners,
        // and pointer-lifecycle cleanup still run.
        reportConsumerError(error);
      }
    }
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
      try {
        callback(prop);
      } catch (error) {
        // Per listener: one throwing subscriber must not starve the ones
        // registered after it (hover cursor, camera control, selection).
        reportConsumerError(error);
      }
    }
  }

  /* Determine the object that fired the event. */
  #getTargetOwner(event: Event): ElementObject<DomElement> | null {
    const ElementConstructor = this.#document.defaultView?.Element;
    if (!ElementConstructor) return null;
    for (const target of this.#getEventPath(event)) {
      if (!(target instanceof ElementConstructor)) {
        continue;
      }
      const owner = this.#objectByElement.get(target as DomElement);
      if (owner && this.#isObjectRegistered(owner)) {
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

  #getOwnerId(owner: ElementObject<DomElement> | null) {
    if (!owner || !this.#isObjectRegistered(owner)) {
      return null;
    }
    return owner.id;
  }

  #isObjectRegistered(owner: BaseObject) {
    if (owner.isDeleteRequested || !this.global || !this.#engine) {
      return false;
    }

    try {
      const objectTable = this.global.getEngineObjectTable(this.#engine);
      return objectTable[owner.id] === owner;
    } catch {
      // The engine may already have been unregistered during teardown.
      return false;
    }
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
