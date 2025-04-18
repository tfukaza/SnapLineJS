import {
  cursorDownProp,
  cursorMoveProp,
  cursorUpProp,
  cursorScrollProp,
  InputControl,
} from "./input";
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
  AnimationProperty,
  TimelineObject,
} from "./animation";

export interface GlobalEvent {
  onCursorDown: null | ((prop: cursorDownProp) => void);
  onCursorMove: null | ((prop: cursorMoveProp) => void);
  onCursorUp: null | ((prop: cursorUpProp) => void);
  onCursorScroll: null | ((prop: cursorScrollProp) => void);
}

export interface DomEvent {
  onCursorDown: null | ((prop: cursorDownProp) => void);
  onCursorMove: null | ((prop: cursorMoveProp) => void);
  onCursorUp: null | ((prop: cursorUpProp) => void);
  onCursorScroll: null | ((prop: cursorScrollProp) => void);
  onResize: null | (() => void);
}

class EventCallback {
  _object: BaseObject;
  _global: GlobalEvent;
  global: GlobalEvent;
  _dom: DomEvent;
  dom: DomEvent;

  constructor(object: BaseObject) {
    this._object = object;
    this._global = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null,
    };
    this.global = new Proxy(this._global, {
      set: (_, prop: string, value: CallableFunction | null) => {
        if (value == null) {
          this._object.global.snapline?.unsubscribeGlobalCursorEvent(
            prop as
              | "onCursorDown"
              | "onCursorMove"
              | "onCursorUp"
              | "onCursorScroll",
            this._object.gid,
          );
        } else {
          this._object.global.snapline?.subscribeGlobalCursorEvent(
            prop as
              | "onCursorDown"
              | "onCursorMove"
              | "onCursorUp"
              | "onCursorScroll",
            this._object.gid,
            (value as any).bind(this._object),
          );
        }
        return true;
      },
    });
    this._dom = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null,
      onResize: null,
    };
    this.dom = EventProxyFactory<BaseObject, DomEvent>(
      this._object,
      this._dom,
      this._object.global.snapline!.event,
    );
  }
}

export interface ObjectCoordinate {
  worldX: number;
  worldY: number;
  localX: number;
  localY: number;
  scaleX: number;
  scaleY: number;
  // rotation: number;
}

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
  position: ObjectCoordinate;
  previousPosition: ObjectCoordinate;
  positionMode: "absolute" | "relative" | "fixed";
  event: EventCallback;

  _requestPreRead: boolean = false;
  _requestWrite: boolean = false;
  _requestRead: boolean = false;
  _requestDelete: boolean = false;
  _requestPostWrite: boolean = false;

  _colliderList: Collider[] = [];
  _animationList: (AnimationObject | TimelineObject)[] = [];

  constructor(global: GlobalManager, parent: BaseObject | null) {
    this.global = global;
    this.gid = global.getGlobalId();
    this.global.objectTable[this.gid] = this;
    this.parent = parent;

    this._colliderList = [];
    this.position = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this.previousPosition = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this.positionMode = "absolute";
    this.event = new EventCallback(this);

    this._requestPreRead = false;
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
  }

  get worldX(): number {
    return this.position.worldX;
  }

  set worldX(x: number) {
    this.position.worldX = x;
  }

  get worldY(): number {
    return this.position.worldY;
  }

  set worldY(y: number) {
    this.position.worldY = y;
  }

  get localX(): number {
    return this.position.localX;
  }

  set localX(x: number) {
    this.position.localX = x;
  }

  get localY(): number {
    return this.position.localY;
  }

  set localY(y: number) {
    this.position.localY = y;
  }

  set worldPosition(position: [number, number]) {
    if (this.parent) {
      console.warn(
        "Not recommended to directly set world position of a child object",
      );
    }
    this.worldX = position[0];
    this.worldY = position[1];
    if (this.parent) {
      this.localX = this.worldX - this.parent.worldX;
      this.localY = this.worldY - this.parent.worldY;
    }
  }

  get worldPosition(): [number, number] {
    return [this.worldX, this.worldY];
  }

  set localPosition(position: [number, number]) {
    this.localX = position[0];
    this.localY = position[1];
    if (this.parent) {
      this.worldX = this.parent.worldX + this.localX;
      this.worldY = this.parent.worldY + this.localY;
    }
  }

  get localPosition(): [number, number] {
    return [this.localX, this.localY];
  }

  addCollider(collider: Collider) {
    this._colliderList.push(collider);
    this.global.collisionEngine?.addObject(collider);
  }

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

  requestRead(
    saveDomProperty: boolean = false,
    noTransform: boolean = false,
  ): readEntry {
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
    if (this.parent) {
      this.worldX = this.parent.worldX + this.localX;
      this.worldY = this.parent.worldY + this.localY;
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

  animate(animationProperty: AnimationProperty) {
    let animation = new AnimationObject(this, animationProperty);
    animation.start();
    // return animation;
    // For now we only support one animation at a time
    if (this._animationList.length > 0) {
      this._animationList[0].cancel();
    }
    this._animationList = [];
    this._animationList.push(animation);
    this.global.animationList.push(animation);
    return animation;
  }

  animateTimeline(animationProperty: AnimationProperty[]) {
    let timeline = new TimelineObject();
    for (const property of animationProperty) {
      let animation = new AnimationObject(this, property);
      timeline.add(animation);
    }
    timeline.start();
    // for now we only support one timeline at a time
    if (this._animationList.length > 0) {
      this._animationList[0].cancel();
    }
    this._animationList = [];
    this._animationList.push(timeline);
    this.global.animationList.push(timeline);
    return timeline;
  }

  getCurrentStats(): frameStats {
    return {
      timestamp: Date.now(),
    };
  }
}

type DomProperty = {
  worldX: number;
  worldY: number;
  worldHeight: number;
  worldWidth: number;
};

export interface DomInsertMode {
  appendChild?: HTMLElement | null;
  insertBefore?: [HTMLElement, HTMLElement] | null;
  replaceChild?: HTMLElement | null;
}

export class DomElement {
  _uuid: string;
  _global: GlobalManager;
  _owner: ElementObject;
  element: HTMLElement;
  _pendingInsert: boolean;

  _requestWrite: boolean = false;
  _requestRead: boolean = false;
  _requestDelete: boolean = false;
  _requestPostWrite: boolean = false;
  _style: Record<string, any>;
  _classList: string[];
  _dataAttribute: Record<string, any>;
  _inputEngine: InputControl;
  _event: DomEvent;
  event: DomEvent;

  localX: number;
  localY: number;
  property: DomProperty;
  prevProperty: ObjectCoordinate;
  _transformApplied: ObjectCoordinate;
  insertMode: DomInsertMode;

  resizeObserver: ResizeObserver;
  mutationObserver: MutationObserver;

  constructor(
    global: GlobalManager,
    owner: ElementObject,
    dom: HTMLElement,
    insertMode: DomInsertMode = {},
    isFragment: boolean = false,
  ) {
    this._global = global;
    this.element = dom;
    this.property = {
      worldX: 0,
      worldY: 0,
      worldHeight: 0,
      worldWidth: 0,
    };
    this.prevProperty = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0,
      scaleX: 1,
      scaleY: 1,
    };
    this._transformApplied = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0,
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
    this._event = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null,
      onResize: null,
    };
    this.event = EventProxyFactory(owner, this._event);
    this._inputEngine = new InputControl(this._global);
    this._inputEngine?.addCursorEventListener(this.element);
    this._inputEngine!.event.mouseDownCallback = this._onCursorDown.bind(this);
    this._inputEngine!.event.mouseMoveCallback = this._onCursorMove.bind(this);
    this._inputEngine!.event.mouseUpCallback = this._onCursorUp.bind(this);
    this._inputEngine!.event.mouseWheelCallback =
      this._onCursorScroll.bind(this);

    this._owner.requestWrite();
    this._owner.requestRead();

    this.localX = 0;
    this.localY = 0;

    this.insertMode = insertMode;

    this.resizeObserver = new ResizeObserver(() => {
      this._event.onResize?.();
    });
    this.resizeObserver.observe(this.element);

    this.mutationObserver = new MutationObserver(() => {
      this._event.onResize?.();
    });
  }

  set localPosition(position: [number, number]) {
    this.localX = position[0];
    this.localY = position[1];
    this._owner.requestPostWrite();
  }

  get localPosition(): [number, number] {
    return [this.localX, this.localY];
  }

  get worldPosition(): [number, number] {
    return [this._owner.worldX + this.localX, this._owner.worldY + this.localY];
  }

  get cameraPosition(): [number, number] {
    return (
      this._global.camera?.getCameraFromWorld(...this.worldPosition) ?? [0, 0]
    );
  }

  get screenPosition(): [number, number] {
    return (
      this._global.camera?.getScreenFromCamera(...this.cameraPosition) ?? [0, 0]
    );
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

  _onCursorDown(prop: cursorDownProp): void {
    this.event.onCursorDown?.(prop);
  }

  _onCursorMove(prop: cursorMoveProp): void {
    this.event.onCursorMove?.(prop);
  }

  _onCursorUp(prop: cursorUpProp): void {
    this.event.onCursorUp?.(prop);
  }

  _onCursorScroll(prop: cursorScrollProp): void {
    this.event.onCursorScroll?.(prop);
  }

  moveTo(mode: DomInsertMode) {
    this.insertMode = mode;
    this._pendingInsert = true;
    this._owner.requestWrite();
  }

  readDomProperty(noTransform: boolean = false) {
    const property = getDomProperty(this._global, this.element);

    // Need to commit the styles to obtain current values of an animation
    let animation = this.element.getAnimations()[0];
    if (animation) {
      animation.commitStyles();
    }

    const transform = this.element.style.transform;
    let transformApplied = {
      worldX: 0,
      worldY: 0,
      scaleX: 1,
      scaleY: 1,
    };

    if (transform && !noTransform) {
      transformApplied = parseTransformString(transform);
    } else {
      transformApplied.worldX = 0;
      transformApplied.worldY = 0;
      transformApplied.scaleX = 1;
      transformApplied.scaleY = 1;
    }

    this.property.worldHeight = property.worldHeight;
    this.property.worldWidth = property.worldWidth;
    this.property.worldX = property.worldX - transformApplied.worldX;
    this.property.worldY = property.worldY - transformApplied.worldY;
  }

  preRead(noTransform: boolean = false) {
    this.readDomProperty(noTransform);
    Object.assign(this.prevProperty, this.property);
  }

  write() {
    setDomStyle(this.element, this._style);
    // TODO: See if we can batch the class list updates
    this.element.classList.forEach((className) => {
      this.element.classList.add(className);
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
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    if (this.element) {
      this.element.remove();
    }
  }

  read(noTransform: boolean = false) {
    this.readDomProperty(noTransform);
  }

  postWrite() {
    // console.log("postWrite", this._transformApplied);
    let transformStyle = {
      transform: "",
    };
    if (this._owner.elementPositionMode == "fixed") {
      transformStyle = {
        transform: generateTransformString({
          worldX: this.localX,
          worldY: this.localY,
          localX: 0,
          localY: 0,
          scaleX: this._owner.position.scaleX,
          scaleY: this._owner.position.scaleY,
        }),
      };
    } else if (this._owner.elementPositionMode == "relative") {
      transformStyle = {
        transform: generateTransformString(this._transformApplied),
      };
    } else {
      let [newX, newY] = [
        this._owner.worldX + this.localX - this.property.worldX,
        this._owner.worldY + this.localY - this.property.worldY,
      ];
      transformStyle = {
        transform: generateTransformString({
          worldX: newX,
          worldY: newY,
          localX: 0,
          localY: 0,
          scaleX: this._owner.position.scaleX,
          scaleY: this._owner.position.scaleY,
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
    // console.log(
    //   "transformStyle",
    //   transformStyle,
    //   this._owner.elementPositionMode,
    // );
    // console.log("style", { ...this._style, ...transformStyle });
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
  elementList: DomElement[] = [];
  _requestWrite: boolean;
  _requestRead: boolean;
  _requestDelete: boolean;
  _requestPostWrite: boolean;
  _state: any = {};
  state: Record<string, any>;
  _positionMode: "absolute" | "relative" | "fixed";

  _parentElement: HTMLElement | null;
  _elementIndex: number;

  inScene: boolean = false;
  _callback: RenderCallback;
  callback: RenderCallback;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.inScene = false;
    this._parentElement = null;
    this._elementIndex = -1;
    this._requestWrite = false;
    this._requestRead = false;
    this._requestDelete = false;
    this._requestPostWrite = false;
    this._positionMode = "absolute";
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
  }

  set worldPosition(position: [number, number]) {
    if (this.positionMode == "relative") {
      throw new Error("Cannot set world position in relative mode");
    }
    this.worldX = position[0];
    this.worldY = position[1];
  }

  get worldPosition(): [number, number] {
    return [this.worldX, this.worldY];
  }

  generateCache(setWorldPosition: boolean = false) {
    if (setWorldPosition == true) {
      this.worldX = this.dom.property.worldX;
      this.worldY = this.dom.property.worldY;
    }
    if (this.parent) {
      this.localX = this.dom.property.worldX - this.parent.worldX;
      this.localY = this.dom.property.worldY - this.parent.worldY;
    }
  }

  addDom(dom: HTMLElement): DomElement {
    this.elementList.push(new DomElement(this.global, this, dom));
    this.dom.event.onCursorDown = this.event.dom.onCursorDown;
    this.dom.event.onCursorMove = this.event.dom.onCursorMove;
    this.dom.event.onCursorUp = this.event.dom.onCursorUp;
    this.dom.event.onCursorScroll = this.event.dom.onCursorScroll;
    this.dom.event.onResize = this.event.dom.onResize;

    this.requestPreRead(true, true);

    return this.dom;
  }

  get dom(): DomElement {
    return this.elementList[0];
  }

  get element(): HTMLElement {
    return this.dom?.element;
  }

  set element(element: HTMLElement) {
    this.addDom(element);
  }

  set elementPositionMode(mode: "absolute" | "relative" | "fixed") {
    this._positionMode = mode;
    // this.requestPostWrite();
  }

  get elementPositionMode(): "absolute" | "relative" | "fixed" {
    return this._positionMode;
  }

  preRead(stats: frameStats, options: preReadEntry): void {
    this.callback.beforePreRead?.();
    options.beforeCallback?.();
    this._preRead(stats, options);
    this.dom?.preRead(options.noTransform);
    if (options.saveDomProperty) {
      this.generateCache(true);
      Object.assign(this.previousPosition, this.position);
    }
    this.callback.afterPreRead?.();
    options.afterCallback?.();
  }

  write(stats: frameStats, options: writeEntry | null = null): void {
    this.callback.beforeWrite?.();
    options?.beforeCallback?.();
    this._write(stats, options);
    if (options?.isDelete) {
      this.dom?.delete();
    } else {
      this.dom?.write();
    }
    this.callback.afterWrite?.();
    options?.afterCallback?.();
  }

  delete(stats: frameStats): void {
    this._write(stats, new writeEntry(this, null, true));
    this.dom?.delete();
  }

  read(stats: frameStats, options: readEntry | null = null) {
    this.callback.beforeRead?.();
    options?.beforeCallback?.();
    this.dom?.read(options?.noTransform);
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
    this.dom?.postWrite();
    options?.afterCallback?.();
    this.callback.afterPostWrite?.();
  }
}
