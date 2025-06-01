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
    // console.warn("this._object", this._object);
    // console.warn(
    //   "this.global.inputEngine!.globalCallbacks",
    //   this._object.global.inputEngine!.globalCallbacks,
    // );
    this._dom = {
      onAssignDom: null,
      onResize: null,
    };
    this.dom = EventProxyFactory<BaseObject, DomEvent>(this._object, this._dom);
  }
}

// export interface ObjectCoordinate {
//   worldX: number;
//   worldY: number;
//   localX: number;
//   localY: number;
//   scaleX: number;
//   scaleY: number;
// }

export interface TransformProperty {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

// export interface ObjectTransform {
//   world: TransformProperty;
//   local: TransformProperty;
// }

class queueEntry {
  object: BaseObject;
  beforeCallback: null | (() => void);
  afterCallback: null | (() => void);
  constructor(object: BaseObject) {
    this.object = object;
    this.beforeCallback = null;
    this.afterCallback = null;
  }

  before(callback: () => void): this {
    this.beforeCallback = callback;
    return this;
  }

  then(callback: () => void): this {
    this.afterCallback = callback;
    return this;
  }

  submit() {}
}

export class preReadEntry extends queueEntry {
  saveDomProperty?: boolean;
  noTransform?: boolean;
  constructor(
    object: BaseObject,
    saveDomProperty?: boolean,
    noTransform?: boolean,
  ) {
    super(object);
    this.saveDomProperty = saveDomProperty;
    this.noTransform = noTransform;
  }
}

export class writeEntry extends queueEntry {
  operation: null | (() => void);
  isDelete?: boolean;
  constructor(
    object: BaseObject,
    operation: null | (() => void),
    isDelete?: boolean,
  ) {
    super(object);
    this.operation = operation;
    this.isDelete = isDelete;
  }
}

export class readEntry extends queueEntry {
  saveDomProperty?: boolean;
  noTransform?: boolean;
  constructor(
    object: BaseObject,
    saveDomProperty?: boolean,
    noTransform?: boolean,
  ) {
    super(object);
    this.saveDomProperty = saveDomProperty;
    this.noTransform = noTransform;
  }
}

export class postWriteEntry extends queueEntry {
  constructor(object: BaseObject) {
    super(object);
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
  previousTransform: TransformProperty;

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
    // this.local = new Proxy(this.transform, {
    //   get: (target: TransformProperty, prop: keyof TransformProperty) => {
    //     if (this.parent) {
    //       return target[prop] - this.parent.transform[prop];
    //     }
    //     return target[prop];
    //   },
    //   set: (
    //     target: TransformProperty,
    //     prop: keyof TransformProperty,
    //     value: number,
    //   ) => {
    //     if (this.parent) {
    //       target[prop] = value + this.parent.transform[prop];
    //     } else {
    //       target[prop] = value;
    //     }
    //     return true;
    //   },
    // });
    this.offset = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this.previousTransform = {
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

  // get worldX(): number {
  //   return this.position.worldX;
  // }

  // set worldX(x: number) {
  //   this.position.worldX = x;
  // }

  // get worldY(): number {
  //   return this.position.worldY;
  // }

  // set worldY(y: number) {
  //   this.position.worldY = y;
  // }

  // get localX(): number {
  //   return this.position.localX;
  // }

  // set localX(x: number) {
  //   this.position.localX = x;
  // }

  // get localY(): number {
  //   return this.position.localY;
  // }

  // set localY(y: number) {
  //   this.position.localY = y;
  // }

  // set worldPosition(position: [number, number]) {
  //   if (this.parent) {
  //     console.warn(
  //       "Not recommended to directly set world position of a child object",
  //     );
  //   }
  //   this.worldX = position[0];
  //   this.worldY = position[1];
  //   if (this.parent) {
  //     this.localX = this.worldX - this.parent.worldX;
  //     this.localY = this.worldY - this.parent.worldY;
  //   }
  // }

  // get worldPosition(): [number, number] {
  //   return [this.worldX, this.worldY];
  // }

  // set localPosition(position: [number, number]) {
  //   this.localX = position[0];
  //   this.localY = position[1];
  //   if (this.parent) {
  //     this.worldX = this.parent.worldX + this.localX;
  //     this.worldY = this.parent.worldY + this.localY;
  //   }
  // }

  // get localPosition(): [number, number] {
  //   return [this.localX, this.localY];
  // }

  requestPreRead(
    saveDomProperty: boolean = false,
    noTransform: boolean = false,
  ) {
    let request = new preReadEntry(this, saveDomProperty, noTransform);
    this.global.preReadQueue[this.gid] = request;
    return request;
  }

  _preRead(_: frameStats, __: preReadEntry) {}

  preRead(stats: frameStats, options: preReadEntry) {
    options.beforeCallback?.();
    this._preRead(stats, options);
    options.afterCallback?.();
  }

  requestWrite(
    operation: null | (() => void) = null,
    isDelete: boolean = false,
  ) {
    let request = new writeEntry(this, operation, isDelete);
    this.global.writeQueue[this.gid] = request;
    return request;
  }

  _write(_: frameStats, options: writeEntry | null = null) {
    if (options?.isDelete) {
      if (this.parent) {
        this.parent.children = this.parent.children.filter(
          (child) => child !== this,
        );
      }
      delete this.global.objectTable[this.gid];
    } else {
      options?.operation?.bind(this)();
    }
  }

  write(stats: frameStats, options: writeEntry | null = null) {
    options?.beforeCallback?.();
    this._write(stats, options);
    options?.afterCallback?.();
  }

  requestDelete() {
    if (this.gid in this.global.writeQueue) {
      let request = this.global.writeQueue[this.gid];
      request.isDelete = true;
      return request;
    }

    let request = new writeEntry(this, null, true);
    this.global.writeQueue[this.gid] = request;
    return request;
  }

  /**
   * Request a read operation.
   * @param saveDomProperty - Whether to save the DOM property to the object.
   * @param noTransform - Whether to include the transform in the DOM property calculation.
   * @returns The read entry.
   */
  requestRead(
    saveDomProperty: boolean = false,
    noTransform: boolean = false,
  ): readEntry {
    // console.log("requestRead", this.gid);
    // console.trace();
    let request = new readEntry(this, saveDomProperty, noTransform);
    this.global.readQueue[this.gid] = request;
    return request;
  }

  _read(stats: frameStats, options: readEntry | null = null) {
    for (const collider of this._colliderList) {
      collider.read();
    }
  }

  read(stats: frameStats, options: readEntry | null = null) {
    options?.beforeCallback?.();
    this._read(stats, options);
    options?.afterCallback?.();
  }

  requestPostWrite() {
    let request = new postWriteEntry(this);
    this.global.postWriteQueue[this.gid] = request;
    return request;
  }

  _postWrite(stats: frameStats, options: postWriteEntry | null = null) {}

  postWrite(stats: frameStats, options: postWriteEntry | null = null) {
    options?.beforeCallback?.();
    this._postWrite(stats, options);
    options?.afterCallback?.();
  }

  generateCache(setWorldPosition: boolean = false) {
    this.calculateCache();
  }

  calculateCache() {
    // console.log("calculateCache", this.gid);
    if (this.parent) {
      // console.log(
      //   "Has parent",
      //   this.parent.transform,
      //   this.local.x,
      //   this.local.y,
      // );
      this.transform.x = this.parent.transform.x + this.local.x;
      this.transform.y = this.parent.transform.y + this.local.y;
      // console.log("Calculated", this.transform);
    }
    for (const collider of this._colliderList) {
      collider.recalculate();
    }
  }

  requestFLIP(
    callback: null | (() => void) = null,
  ): [preReadEntry, writeEntry, readEntry, postWriteEntry] {
    return [
      this.requestPreRead(false, true),
      this.requestWrite(callback?.bind(this)),
      this.requestRead(true, false),
      this.requestPostWrite(),
    ];
  }

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
  // _inputEngine: InputControl;
  // _event: DomEvent;
  // event: DomEvent;

  property: DomProperty;
  prevProperty: DomProperty;
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
    this.prevProperty = {
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
    // this._event = {
    //   onCursorDown: null,
    //   onCursorMove: null,
    //   onCursorUp: null,
    //   onCursorScroll: null,
    //   onResize: null,
    // };
    // this.event = EventProxyFactory(owner, this._event);
    // this._inputEngine = new InputControl(this._global);

    // this.localX = 0;
    // this.localY = 0;

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
  // set localPosition(position: [number, number]) {
  //   this.localX = position[0];
  //   this.localY = position[1];
  //   this._owner.requestPostWrite();
  // }

  // get localPosition(): [number, number] {
  //   return [this.localX, this.localY];
  // }

  // get worldPosition(): [number, number] {
  //   return [this._owner.transform.x, this._owner.transform.y];
  // }

  // get cameraPosition(): [number, number] {
  //   return (
  //     this._global.camera?.getCameraFromWorld(...this.worldPosition) ?? [0, 0]
  //   );
  // }

  // get screenPosition(): [number, number] {
  //   return (
  //     this._global.camera?.getScreenFromCamera(...this.cameraPosition) ?? [0, 0]
  //   );
  // }

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

  // _onCursorDown(prop: cursorDownProp): void {
  //   this.event.onCursorDown?.(prop);
  // }

  // _onCursorMove(prop: cursorMoveProp): void {
  //   this.event.onCursorMove?.(prop);
  // }

  // _onCursorUp(prop: cursorUpProp): void {
  //   this.event.onCursorUp?.(prop);
  // }

  // _onCursorScroll(prop: cursorScrollProp): void {
  //   this.event.onCursorScroll?.(prop);
  // }

  moveTo(mode: DomInsertMode) {
    this.insertMode = mode;
    this._pendingInsert = true;
    this._owner.requestWrite();
  }

  readDomProperty(noTransform: boolean = false) {
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

    if (transform && transform != "none" && !noTransform) {
      transformApplied = parseTransformString(transform);
    }

    /* getBoundingClientRect() returns the property after applying the transform,
     * so we need to account for any current transform applied to the element.
     * Note that this doesn't account for the transform applied to the parent.
     */
    // console.log("readDomProperty", transformApplied);
    this.property.height = property.height / transformApplied.scaleY;
    this.property.width = property.width / transformApplied.scaleX;
    this.property.x = property.x - transformApplied.x;
    this.property.y = property.y - transformApplied.y;
    this.property.screenX = property.screenX;
    this.property.screenY = property.screenY;
  }

  preRead(noTransform: boolean = false) {
    this.readDomProperty(noTransform);
    Object.assign(this.prevProperty, this.property);
  }

  write() {
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

    if (this._pendingInsert) {
      this._pendingInsert = false;
      if (this.insertMode.appendChild) {
        this.insertMode.appendChild.appendChild(this.element);
      } else if (this.insertMode.insertBefore) {
        this.insertMode.insertBefore[0].insertBefore(
          this.element,
          this.insertMode.insertBefore[1],
        );
      } else if (this.insertMode.replaceChild) {
        this.insertMode.replaceChild.replaceChild(
          this.element,
          this.insertMode.replaceChild,
        );
      } else {
        this._global.containerElement?.appendChild(this.element);
      }
    }
  }

  delete(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.element) {
      this.element.remove();
    }
  }

  read(noTransform: boolean = false) {
    this.readDomProperty(noTransform);
  }

  postWrite() {
    if (!this.element) {
      throw new Error("Element is not set");
    }
    let transformStyle = {
      transform: "",
    };
    if (this._owner.transformMode == "direct") {
      transformStyle = {
        transform: generateTransformString({
          x: this._owner.transform.x + this._owner.offset.x,
          y: this._owner.transform.y + this._owner.offset.y,
          scaleX: this._owner.transform.scaleX,
          scaleY: this._owner.transform.scaleY,
        }),
      };
    } else if (this._owner.transformMode == "relative") {
      let [newX, newY] = [
        this._owner.transform.x - this.property.x,
        this._owner.transform.y - this.property.y,
      ];
      // console.log("postWrite", this._owner.transform, this.property);
      transformStyle = {
        transform: generateTransformString({
          x: newX + this._owner.offset.x,
          y: newY + this._owner.offset.y,
          scaleX: this._owner.transform.scaleX,
          scaleY: this._owner.transform.scaleY,
        }),
      };
    } else if (this._owner.transformMode == "none") {
      transformStyle = {
        transform: "",
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
}

interface RenderCallback {
  beforePreRead: null | (() => void);
  afterPreRead: null | (() => void);
  beforeRead: null | (() => void);
  afterRead: null | (() => void);
  beforeWrite: null | (() => void);
  afterWrite: null | (() => void);
  beforePostWrite: null | (() => void);
  afterPostWrite: null | (() => void);
}

export class ElementObject extends BaseObject {
  _dom: DomElement;
  _requestWrite: boolean;
  _requestRead: boolean;
  _requestDelete: boolean;
  _requestPostWrite: boolean;
  _state: any = {};
  state: Record<string, any>;

  transformMode: "direct" | "relative" | "none";
  /**
   * direct: Applies the transform directly to the object.
   * relative: Perform calculations to apply the transform relative to the DOM element.
   *      Only applicable if the object owns a DOM element.
   * none: No transform is applied to the object.
   */

  // _parentElement: HTMLElement | null;
  // _elementIndex: number;

  inScene: boolean = false;
  _callback: RenderCallback;
  callback: RenderCallback;

  inputEngine: InputControl;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this._dom = new DomElement(global, this, null);
    this.inScene = false;
    // this._parentElement = null;
    // this._elementIndex = -1;
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
    this.transformMode = "direct";
    this._callback = {
      beforePreRead: null,
      afterPreRead: null,
      beforeRead: null,
      afterRead: null,
      beforeWrite: null,
      afterWrite: null,
      beforePostWrite: null,
      afterPostWrite: null,
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
    this.dom.delete();
    super.destroy();
  }

  // set worldPosition(position: [number, number]) {
  //   if (this.positionMode == "relative") {
  //     throw new Error("Cannot set world position in relative mode");
  //   }
  //   this.worldX = position[0];
  //   this.worldY = position[1];
  // }

  // get worldPosition(): [number, number] {
  //   return [this.worldX, this.worldY];
  // }

  generateCache(setWorldPosition: boolean = false) {
    if (setWorldPosition == true) {
      // Note that dom property is saved in world coordinates
      this.transform.x = this._dom.property.x;
      this.transform.y = this._dom.property.y;
    }
    if (this.parent) {
      this.local.x = this._dom.property.x - this.parent.transform.x;
      this.local.y = this._dom.property.y - this.parent.transform.y;
    }
  }

  // addDom(dom: HTMLElement): DomElement {
  //   this.elementList.push(new DomElement(this.global, this, dom));
  //   this.dom.event.onCursorDown = this.event.dom.onCursorDown;
  //   this.dom.event.onCursorMove = this.event.dom.onCursorMove;
  //   this.dom.event.onCursorUp = this.event.dom.onCursorUp;
  //   this.dom.event.onCursorScroll = this.event.dom.onCursorScroll;
  //   this.dom.event.onResize = this.event.dom.onResize;

  //   this.requestPreRead(true, true);

  //   return this._dom;
  // }

  get dom(): DomElement {
    return this._dom;
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

  // set elementPositionMode(mode: "absolute" | "relative" | "fixed") {
  //   this._positionMode = mode;
  //   // this.requestPostWrite();
  // }

  // get elementPositionMode(): "absolute" | "relative" | "fixed" {
  //   return this._positionMode;
  // }

  preRead(stats: frameStats, options: preReadEntry): void {
    this.callback.beforePreRead?.();
    options.beforeCallback?.();
    this._preRead(stats, options);
    this._dom.preRead(options.noTransform);
    if (options.saveDomProperty) {
      this.generateCache(true);
      Object.assign(this.previousTransform, this.transform);
    }
    this.callback.afterPreRead?.();
    options.afterCallback?.();
  }

  write(stats: frameStats, options: writeEntry | null = null): void {
    this.callback.beforeWrite?.();
    options?.beforeCallback?.();
    this._write(stats, options);
    if (options?.isDelete) {
      this._dom.delete();
    } else {
      this._dom.write();
    }
    this.callback.afterWrite?.();
    options?.afterCallback?.();
  }

  delete(stats: frameStats): void {
    this._write(stats, new writeEntry(this, null, true));
    this._dom.delete();
  }

  read(stats: frameStats, options: readEntry | null = null) {
    this.callback.beforeRead?.();
    options?.beforeCallback?.();
    this._dom.read(options?.noTransform);
    this._read(stats, options);
    if (options?.saveDomProperty) {
      this.generateCache(true);
    }
    this.callback.afterRead?.();
    options?.afterCallback?.();
  }

  postWrite(stats: frameStats, options: postWriteEntry | null = null): void {
    this.callback.beforePostWrite?.();
    options?.beforeCallback?.();
    this._postWrite(stats, options);
    this._dom.postWrite();
    options?.afterCallback?.();
    this.callback.afterPostWrite?.();
  }
}
