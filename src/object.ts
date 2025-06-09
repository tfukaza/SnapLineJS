import { InputControl, InputEventCallback } from "./input";
import {
  setDomStyle,
  EventProxyFactory,
  generateTransformString,
  parseTransformString,
} from "./util";
import { Collider } from "./collision";
import { getDomProperty } from "./util";
import { GlobalManager } from "./global";
import {
  AnimationObject,
  keyframeList,
  keyframeProperty,
  SequenceObject,
} from "./animation";
import { UUID } from "crypto";

export interface DomEvent {
  onAssignDom: null | (() => void);
  onResize: null | (() => void);
}

class EventCallback {
  _object: BaseObject;
  _global: InputEventCallback;
  global: InputEventCallback;
  _input: InputEventCallback;
  input: InputEventCallback;
  _dom: DomEvent;
  dom: DomEvent;

  constructor(object: BaseObject) {
    this._object = object;
    this._global = {
      pointerDown: null,
      pointerMove: null,
      pointerUp: null,
      mouseWheel: null,
      drag: null,
      pinch: null,
      dragStart: null,
      dragEnd: null,
      pinchStart: null,
      pinchEnd: null,
    };
    this.global = new Proxy(this._global, {
      set: (_, prop: any, value: CallableFunction | null) => {
        if (value == null) {
          this._object.global.inputEngine?.unsubscribeGlobalCursorEvent(
            prop,
            this._object.gid,
          );
        } else {
          this._object.global.inputEngine?.subscribeGlobalCursorEvent(
            prop,
            this._object.gid,
            (value as any).bind(this._object),
          );
        }
        return true;
      },
    });
    this._input = {
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
    this.input = EventProxyFactory<BaseObject, InputEventCallback>(
      this._object,
      this._input,
    );
    this._dom = {
      onAssignDom: null,
      onResize: null,
    };
    this.dom = EventProxyFactory<BaseObject, DomEvent>(this._object, this._dom);
  }
}

export interface TransformProperty {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export class queueEntry {
  uuid: UUID | string;
  object: BaseObject;
  callback: null | Array<() => void>;
  constructor(
    object: BaseObject,
    callback: null | (() => void),
    uuid: UUID | string | null = null,
  ) {
    this.uuid = uuid ?? crypto.randomUUID();
    this.object = object;
    this.callback = callback ? [callback.bind(object)] : null;
  }
  addCallback(callback: () => void) {
    if (this.callback) {
      this.callback.push(callback.bind(this.object));
    } else {
      this.callback = [callback.bind(this.object)];
    }
  }
}

export interface frameStats {
  timestamp: number;
}

export class BaseObject {
  global: GlobalManager;
  gid: string;
  parent: BaseObject | null;
  children: BaseObject[] = [];

  transform: TransformProperty;
  local: TransformProperty;
  offset: TransformProperty;

  event: EventCallback;

  _requestPreRead: boolean = false;
  _requestWrite: boolean = false;
  _requestRead: boolean = false;
  _requestDelete: boolean = false;
  _requestPostWrite: boolean = false;

  _colliderList: Collider[] = [];
  _animationList: (AnimationObject | SequenceObject)[] = [];

  _globalInput: InputEventCallback;
  globalInput: InputEventCallback;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    this.global = global;
    this.gid = global.getGlobalId();
    this.global.objectTable[this.gid] = this;
    this.parent = parent;

    this._colliderList = [];
    this.transform = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this.local = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this.offset = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this.event = new EventCallback(this);

    this._requestPreRead = false;
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;

    this._globalInput = {
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
    this.globalInput = new Proxy(this._globalInput, {
      set: (_, prop: any, value: CallableFunction | null) => {
        if (value == null) {
          this.global.inputEngine?.unsubscribeGlobalCursorEvent(prop, this.gid);
        } else {
          this.global.inputEngine?.subscribeGlobalCursorEvent(
            prop,
            this.gid,
            value.bind(this) as (prop: any) => void,
          );
        }
        return true;
      },
    });
  }

  destroy() {
    // TODO: Remove colliders
    delete this.global.objectTable[this.gid];
  }

  get worldPosition(): [number, number] {
    return [this.transform.x, this.transform.y];
  }

  set worldPosition(position: [number, number]) {
    // console.log("set worldPosition", position);
    this.transform.x = position[0];
    this.transform.y = position[1];
  }

  get cameraPosition(): [number, number] {
    return (
      this.global.camera?.getCameraFromWorld(...this.worldPosition) ?? [0, 0]
    );
  }

  set cameraPosition(position: [number, number]) {
    this.worldPosition = this.global.camera?.getWorldFromCamera(
      ...position,
    ) ?? [0, 0];
  }

  get screenPosition(): [number, number] {
    return (
      this.global.camera?.getScreenFromCamera(...this.cameraPosition) ?? [0, 0]
    );
  }

  set screenPosition(position: [number, number]) {
    this.cameraPosition = this.global.camera?.getCameraFromScreen(
      ...position,
    ) ?? [0, 0];
  }

  queueUpdate(
    stage:
      | "READ_1"
      | "WRITE_1"
      | "READ_2"
      | "WRITE_2"
      | "READ_3"
      | "WRITE_3" = "READ_1",
    callback: null | (() => void) = null,
    queueID: string | null = null,
  ): queueEntry {
    let request = new queueEntry(this, callback, queueID);
    let queue = this.global.read1Queue;
    switch (stage) {
      case "READ_1":
        queue = this.global.read1Queue;
        break;
      case "WRITE_1":
        queue = this.global.write1Queue;
        break;
      case "READ_2":
        queue = this.global.read2Queue;
        break;
      case "WRITE_2":
        queue = this.global.write2Queue;
        break;
      case "READ_3":
        queue = this.global.read3Queue;
        break;
      case "WRITE_3":
        queue = this.global.write3Queue;
        break;
    }
    if (!queue[this.gid]) {
      queue[this.gid] = new Map();
    }
    queue[this.gid].set(request.uuid, request);
    return request;
  }

  /**
   * Read the DOM property of the object.
   */
  readDom(accountTransform: boolean = false) {
    for (const collider of this._colliderList) {
      collider.read();
    }
  }

  /**
   * Write all object properties to the DOM.
   */
  writeDom() {}

  /**
   * Write the CSS transform property of the object.
   * Unlike many other properties, the transform property does not trigger a DOM reflow and is thus more performant.
   * Whenever possible, use this method to write the transform property.
   */
  writeTransform() {}

  /**
   * Destroy the DOM element of the object.
   */
  destroyDom() {}

  /**
   * Calculate the transform properties of the object based on the saved transform properties of the parent
   * and the saved local and offset properties of the object.
   */
  calculateLocalFromTransform() {
    if (this.parent) {
      this.transform.x = this.parent.transform.x + this.local.x;
      this.transform.y = this.parent.transform.y + this.local.y;
    }
    for (const collider of this._colliderList) {
      collider.recalculate();
    }
  }

  // requestFLIP(
  //   callback: null | (() => void) = null,
  // ): [preReadEntry, writeEntry, readEntry, postWriteEntry] {
  //   return [
  //     this.requestPreRead(false, true),
  //     this.requestWrite(callback?.bind(this)),
  //     this.requestRead(true, false),
  //     this.requestPostWrite(),
  //   ];
  // }

  animate(keyframe: keyframeList, property: keyframeProperty) {
    let animation = new AnimationObject(this, keyframe, property);
    for (const animation of this._animationList) {
      animation.cancel();
    }
    this._animationList = [];
    this._animationList.push(animation);
    this.global.animationList.push(animation);
    return animation;
  }

  get animation() {
    return this._animationList[0];
  }

  animateSequence(animations: AnimationObject[]) {
    let sequence = new SequenceObject();
    for (const animation of animations) {
      sequence.add(animation);
    }

    this._animationList = [];
    this._animationList.push(sequence);
    this.global.animationList.push(sequence);
    return sequence;
  }

  getCurrentStats(): frameStats {
    return {
      timestamp: Date.now(),
    };
  }

  addCollider(collider: Collider) {
    this._colliderList.push(collider);
    this.global.collisionEngine?.addObject(collider);
  }

  addDebugPoint(
    x: number,
    y: number,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
  ) {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      type: "point",
      color: color,
      x,
      y,
      persistent,
      id: `${this.gid}-${id}`,
    };
  }

  addDebugRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
  ) {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      type: "rect",
      color: color,
      x,
      y,
      width,
      height,
      persistent,
      id: `${this.gid}-${id}`,
    };
  }

  addDebugCircle(
    x: number,
    y: number,
    radius: number,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
  ) {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      type: "circle",
      color: color,
      x,
      y,
      radius,
      persistent,
      id: `${this.gid}-${id}`,
    };
  }

  addDebugText(
    x: number,
    y: number,
    text: string,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
  ) {
    this.global.debugMarkerList[`${this.gid}-${id}`] = {
      gid: this.gid,
      x,
      y,
      type: "text",
      color: color,
      text,
      persistent,
      id: `${this.gid}-${id}`,
    };
  }

  clearDebugMarker(id: string) {
    delete this.global.debugMarkerList[`${this.gid}-${id}`];
  }

  clearAllDebugMarkers() {
    for (const marker of Object.values(this.global.debugMarkerList)) {
      if (marker.gid == this.gid) {
        delete this.global.debugMarkerList[marker.id];
      }
    }
  }
}

interface DomProperty extends TransformProperty {
  height: number;
  width: number;
  screenX: number;
  screenY: number;
}

export interface DomInsertMode {
  appendChild?: HTMLElement | null;
  insertBefore?: [HTMLElement, HTMLElement | null] | null;
  replaceChild?: HTMLElement | null;
}

export class DomElement {
  _uuid: string;
  _global: GlobalManager;
  _owner: ElementObject;
  element: HTMLElement | null;
  _pendingInsert: boolean;

  _requestWrite: boolean = false;
  _requestRead: boolean = false;
  _requestDelete: boolean = false;
  _requestPostWrite: boolean = false;
  _style: Record<string, any>;
  _classList: string[];
  _dataAttribute: Record<string, any>;

  property: DomProperty;
  _transformApplied: TransformProperty;
  insertMode: DomInsertMode;

  resizeObserver: ResizeObserver | null = null;
  mutationObserver: MutationObserver | null = null;

  constructor(
    global: GlobalManager,
    owner: ElementObject,
    dom: HTMLElement | null = null,
    insertMode: DomInsertMode = {},
    isFragment: boolean = false,
  ) {
    this._global = global;
    this.element = dom;
    this.property = {
      x: 0,
      y: 0,
      height: 0,
      width: 0,
      scaleX: 1,
      scaleY: 1,
      screenX: 0,
      screenY: 0,
    };
    this._transformApplied = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this._pendingInsert = isFragment;
    this._owner = owner;
    this._uuid = (++global.gid).toString();
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
    this._style = {};
    this._dataAttribute = {};

    this._classList = [];
    this.insertMode = insertMode;
  }

  addElement(element: HTMLElement) {
    this.element = element;
    this._owner.requestWrite();
    this._owner.requestRead();

    this.resizeObserver = new ResizeObserver(() => {
      this._owner.event.dom.onResize?.();
    });
    this.resizeObserver.observe(element);

    this.mutationObserver = new MutationObserver(() => {
      this._owner.event.dom.onResize?.();
    });
  }

  set style(style: Record<string, any>) {
    this._style = Object.assign(this._style, style);
  }

  get style(): Record<string, any> {
    return this._style;
  }

  set dataAttribute(dataAttribute: Record<string, any>) {
    this._dataAttribute = Object.assign(this._dataAttribute, dataAttribute);
  }

  get dataAttribute(): Record<string, any> {
    return this._dataAttribute;
  }

  set classList(classList: string[]) {
    this._classList = classList;
  }

  get classList(): string[] {
    return this._classList;
  }

  /**
   * Read the DOM property of the element.
   * @param accountTransform If true, the returned transform property will subtract any transform applied to the element.
   *      Note that transforms applied to the parent will not be accounted for.
   */
  readDom(accountTransform: boolean = false) {
    if (!this.element) {
      throw new Error("Element is not set");
    }

    const property = getDomProperty(this._global, this.element);
    const transform = this.element.style.transform;
    let transformApplied = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };

    if (transform && transform != "none" && accountTransform) {
      transformApplied = parseTransformString(transform);
    }

    this.property.height = property.height / transformApplied.scaleY;
    this.property.width = property.width / transformApplied.scaleX;
    this.property.x = property.x - transformApplied.x;
    this.property.y = property.y - transformApplied.y;
    this.property.screenX = property.screenX;
    this.property.screenY = property.screenY;
  }

  /**
   * Write all properties of the element to the DOM, like style, class list, and data attributes.
   */
  writeDom() {
    if (!this.element) {
      throw new Error("Element is not set");
    }
    setDomStyle(this.element, this._style);
    // TODO: See if we can batch the class list updates
    this.element.classList.forEach((className) => {
      this.element!.classList.add(className);
    });
    // TODO: See if we can batch the data attribute updates
    for (const [key, value] of Object.entries(this._dataAttribute)) {
      this.element.setAttribute(`data-${key}`, value);
    }
    this.element.setAttribute("data-snapline-gid", this._owner.gid);
  }

  /**
   * Write the CSS transform property of the element.
   * Unlike many other properties, the transform property does not trigger a DOM reflow and is thus more performant.
   * Whenever possible, use this method instead of writeDom.
   * For example, if you are moving an element, instead of changing the left and top properties,
   * you should use this method to set the transform property.
   */
  writeTransform() {
    if (!this.element) {
      throw new Error("Element is not set");
    }
    let transformStyle = {
      transform: "",
    };
    if (this._owner.transformMode == "direct") {
      // If the transform mode is direct, the transform property is applied directly to the element,
      // ignoring the current position of the element.
      transformStyle = {
        transform: generateTransformString({
          x: this._owner.transform.x + this._owner.offset.x,
          y: this._owner.transform.y + this._owner.offset.y,
          scaleX: this._owner.transform.scaleX,
          scaleY: this._owner.transform.scaleY,
        }),
      };
    } else if (this._owner.transformMode == "relative") {
      // If the transform mode is relative, the final transform property is calculated taking into account
      // the current position of the element.
      let [newX, newY] = [
        this._owner.transform.x - this.property.x,
        this._owner.transform.y - this.property.y,
      ];
      transformStyle = {
        transform: generateTransformString({
          x: newX + this._owner.offset.x,
          y: newY + this._owner.offset.y,
          scaleX: this._owner.transform.scaleX,
          scaleY: this._owner.transform.scaleY,
        }),
      };
    } else if (this._owner.transformMode == "none") {
      // If the transform mode is none, no transform is applied to the element.
      transformStyle = {
        transform: "",
      };
    } else if (this._owner.transformMode == "offset") {
      if (!this._owner.transformOrigin) {
        throw new Error("Transform origin is not set");
      }
      // If the transform mode is offset, the transform is applied relative to the position of a parent object.
      transformStyle = {
        transform: generateTransformString({
          x: this._owner.transform.x - this._owner.transformOrigin.transform.x,
          y: this._owner.transform.y - this._owner.transformOrigin.transform.y,
          scaleX:
            this._owner.transform.scaleX *
            this._owner.transformOrigin.transform.scaleX,
          scaleY:
            this._owner.transform.scaleY *
            this._owner.transformOrigin.transform.scaleY,
        }),
      };
    }

    if (
      this._style["transform"] != undefined &&
      this._style["transform"] != "" &&
      transformStyle["transform"] != ""
    ) {
      transformStyle["transform"] = this._style["transform"];
    }

    setDomStyle(this.element, { ...this._style, ...transformStyle });
  }

  destroyDom(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.element) {
      this.element.remove();
    }
  }
}

interface RenderCallback {
  afterRead1: null | (() => void);
  afterRead2: null | (() => void);
  afterRead3: null | (() => void);
  afterWrite1: null | (() => void);
  afterWrite2: null | (() => void);
  afterWrite3: null | (() => void);
}

export class ElementObject extends BaseObject {
  _dom: DomElement;
  _requestWrite: boolean;
  _requestRead: boolean;
  _requestDelete: boolean;
  _requestPostWrite: boolean;
  _state: any = {};
  state: Record<string, any>;

  transformMode: "direct" | "relative" | "offset" | "none";
  transformOrigin: BaseObject | null;
  /**
   * direct: Applies the transform directly to the object.
   * relative: Perform calculations to apply the transform relative to the DOM element's
   *      current position. The current position must be read from the DOM explicitly beforehand.
   *      Only applicable if the object owns a DOM element.
   * offset: Apply the transform relative to the position of a parent object.
   * none: No transform is applied to the object.
   */

  // _parentElement: HTMLElement | null;
  // _elementIndex: number;
  _domProperty: Array<DomProperty>;

  inScene: boolean = false;
  _callback: RenderCallback;
  callback: RenderCallback;

  inputEngine: InputControl;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this._dom = new DomElement(global, this, null);
    this.inScene = false;
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
    this._domProperty = [
      {
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        scaleX: 1,
        scaleY: 1,
        screenX: 0,
        screenY: 0,
      },
      {
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        scaleX: 1,
        scaleY: 1,
        screenX: 0,
        screenY: 0,
      },
      {
        x: 0,
        y: 0,
        height: 0,
        width: 0,
        scaleX: 1,
        scaleY: 1,
        screenX: 0,
        screenY: 0,
      },
    ];
    this.transformMode = "direct";
    this.transformOrigin = null;
    this._callback = {
      afterRead1: null,
      afterRead2: null,
      afterRead3: null,
      afterWrite1: null,
      afterWrite2: null,
      afterWrite3: null,
    };
    this.callback = EventProxyFactory(this, this._callback);
    this.state = new Proxy(this._state, {
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    });

    this.inputEngine = new InputControl(this.global, false, this.gid);
  }

  destroy() {
    // this.inputEngine.destroy();
    this._dom.destroyDom();
    super.destroy();
  }

  getDomProperty(stage: "READ_1" | "READ_2" | "READ_3" | null = null) {
    const index = stage == "READ_1" ? 0 : stage == "READ_2" ? 1 : 2;
    return this._domProperty[index];
  }

  /**
   * Save the DOM property to the transform property.
   * Currently only saves the x and y properties.
   * This function assumes that the element position has already been read from the DOM.
   */
  saveDomPropertyToTransform(
    stage: "READ_1" | "READ_2" | "READ_3" | null = null,
  ) {
    let currentStage = stage ?? this.global.currentStage;
    currentStage = currentStage == "IDLE" ? "READ_2" : currentStage;

    const property = this.getDomProperty(currentStage as any);
    this.transform.x = property.x;
    this.transform.y = property.y;
  }

  /**
   * Calculate the local offsets relative to the parent.
   * This function assumes that the element position has already been read from the DOM
   * in both the parent and the current object.
   */
  calculateLocalFromTransform() {
    if (this.parent) {
      this.local.x = this.transform.x - this.parent.transform.x;
      this.local.y = this.transform.y - this.parent.transform.y;
    }
  }

  calculateLocalFromDom(stage: "READ_1" | "READ_2" | "READ_3" | null = null) {
    if (this.parent) {
      const property = this.getDomProperty(stage);
      if (this.parent instanceof ElementObject) {
        this.local.x = property.x - this.parent.getDomProperty(stage).x;
        this.local.y = property.y - this.parent.getDomProperty(stage).y;
      } else {
        this.local.x = this.transform.x - this.parent.transform.x;
        this.local.y = this.transform.y - this.parent.transform.y;
      }
    }
  }

  calculateTransformFromLocal() {
    if (this.parent) {
      this.transform.x = this.parent.transform.x + this.local.x;
      this.transform.y = this.parent.transform.y + this.local.y;
    }
  }

  get style(): Record<string, any> {
    return this._dom.style;
  }

  set style(style: Record<string, any>) {
    this._dom.style = style;
  }

  get classList(): string[] {
    return this._dom.classList;
  }

  set classList(classList: string[]) {
    this._dom.classList = classList;
  }

  get dataAttribute(): Record<string, any> {
    return this._dom.dataAttribute;
  }

  set dataAttribute(dataAttribute: Record<string, any>) {
    this._dom.dataAttribute = dataAttribute;
  }

  get element(): HTMLElement | null {
    return this._dom.element;
  }

  set element(element: HTMLElement) {
    if (!element) {
      console.error("Element is not set", this.gid);
      return;
    }
    this._dom.addElement(element);
    this.inputEngine?.addCursorEventListener(element);

    type Keys = keyof InputEventCallback;
    const keys = Object.keys(this.inputEngine.event) as Keys[];
    for (const event of keys) {
      let callback: InputEventCallback[typeof event] =
        this.event.input[event]?.bind(this) || null;
      this.inputEngine.event[event] = callback as any;
    }

    this.event.dom.onAssignDom?.();
  }

  readDom(
    accountTransform: boolean = false,
    stage: "READ_1" | "READ_2" | "READ_3" | null = null,
  ) {
    let currentStage = stage ?? this.global.currentStage;
    currentStage = currentStage == "IDLE" ? "READ_2" : currentStage;

    this._dom.readDom(accountTransform);
    super.readDom(accountTransform);
    if (currentStage == "READ_1") {
      Object.assign(this._domProperty[0], this._dom.property);
    } else if (currentStage == "READ_2") {
      Object.assign(this._domProperty[1], this._dom.property);
    } else if (currentStage == "READ_3") {
      Object.assign(this._domProperty[2], this._dom.property);
    }
  }

  writeDom() {
    this._dom.writeDom();
    super.writeDom();
  }

  writeTransform() {
    this._dom.writeTransform();
    super.writeTransform();
  }

  destroyDom() {
    this._dom.destroyDom();
    super.destroyDom();
  }

  /**
   * Common queue requests for element objects.
   */
  requestRead(
    accountTransform: boolean = false,
    saveTransform: boolean = true,
    stage: "READ_1" | "READ_2" | "READ_3" = "READ_1",
  ): queueEntry {
    let callback = () => {
      this.readDom(accountTransform);
      if (saveTransform) {
        this.saveDomPropertyToTransform(stage);
      }
    };
    return this.queueUpdate(stage, callback, stage);
  }

  requestWrite(
    mutate: boolean = true,
    writeCallback: null | (() => void) = null,
    stage: "WRITE_1" | "WRITE_2" | "WRITE_3" = "WRITE_1",
  ): queueEntry {
    let callback = () => {
      if (mutate) {
        this.writeDom();
      }
      writeCallback?.();
    };
    return this.queueUpdate(stage, callback, stage);
  }

  requestDestroy(): queueEntry {
    let callback = () => {
      this.destroyDom();
    };
    return this.queueUpdate("WRITE_2", callback, "destroy");
  }

  requestTransform(
    stage: "WRITE_1" | "WRITE_2" | "WRITE_3" = "WRITE_2",
  ): queueEntry {
    let callback = () => {
      this.writeTransform();
    };
    return this.queueUpdate(stage, callback, "transform");
  }

  requestFLIP(writeCallback: () => void, transformCallback: () => void): void {
    this.requestRead(false, true, "READ_1");
    this.requestWrite(true, writeCallback, "WRITE_1");
    this.requestRead(false, true, "READ_2");
    this.requestWrite(false, transformCallback, "WRITE_2");
  }
}
