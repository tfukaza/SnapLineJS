import {
  cursorDownProp,
  cursorMoveProp,
  cursorUpProp,
  cursorScrollProp,
  InputControl,
} from "../input";
import { setDomStyle } from "../helper";
import { Collider } from "../collision";
import { getDomProperty } from "./util";
import { GlobalManager } from "../global";

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
}

export function EventProxyFactory<Interface extends Record<string, any | null>>(
  object: BaseObject,
  dict: Interface,
  dict2: Interface | null = null,
) {
  return new Proxy(dict, {
    set: (target, prop: string, value: CallableFunction | null) => {
      if (value == null) {
        target[prop as keyof Interface] = null as any;
      } else {
        target[prop as keyof Interface] = value.bind(object) as any;
      }
      return true;
    },
    get: (target, prop: string) => {
      return (...args: any[]) => {
        args[0].gid = object.gid;
        dict2?.[prop as keyof Interface]?.(...args);
        target[prop as keyof Interface]?.(...args);
      };
    },
  });
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
      set: (target, prop: string, value: CallableFunction | null) => {
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
    };
    this.dom = EventProxyFactory(
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
}

/**
 * Base class for all classes.
 * It contains attributes and methods that are common to all classes,
 * such as position, id, etc.
 */
export class BaseObject {
  global: GlobalManager; /* Reference to the global stats object */
  gid: string; /* Unique identifier for the object */
  parent: BaseObject | null; /* Parent of the object */
  children: BaseObject[] = []; /* Children of the object */
  position: ObjectCoordinate;
  positionMode: "absolute" | "relative" | "fixed";
  event: EventCallback;

  _colliderList: Collider[] = []; /* Colliders of the object */

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
    };
    this.positionMode = "absolute";
    this.event = new EventCallback(this);
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
    if (this.global.camera) {
    }
    if (this.children.length > 0) {
      for (const child of this.children) {
        child.updateProperty();
      }
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
    if (this.global.camera) {
    }

    if (this.children.length > 0) {
      for (const child of this.children) {
        child.updateProperty();
      }
    }
  }

  addCollider(collider: Collider) {
    this._colliderList.push(collider);
    this.global.collisionEngine?.addObject(collider);
  }

  submitRenderQueue() {
    this.global.domRenderQueue.push(this);
  }

  render() {}

  delete(): void {}

  fetchProperty() {
    for (const rigidBody of this._colliderList) {
      rigidBody.fetchProperty();
    }

    for (const child of this.children) {
      child.fetchProperty();
    }
  }

  paint() {}

  /**
   * Recalculates the property of the object, such as the position, size, etc.
   * based on current properties of the game object.
   * This function assumes the relative position (localX and Y) and sizes of
   * all parent and children objects are up to date.
   * If it is not, fetchProperty() should be called first.
   */
  updateProperty() {
    if (this.parent) {
      this.worldX = this.parent.worldX + this.localX;
      this.worldY = this.parent.worldY + this.localY;
    }

    if (this.global.camera) {
    }

    for (const rigidBody of this._colliderList) {
      rigidBody.updateProperty();
    }

    for (const child of this.children) {
      child.updateProperty();
    }
  }

  getClassFromGid(gid: string): BaseObject | null {
    if (this.global == null) {
      // console.error("Global stats is null");
      return null;
    }
    return this.global.objectTable[gid] as BaseObject;
  }

  getClassFromDOM(dom: HTMLElement): BaseObject | null {
    if (this.global == null) {
      // console.error("Global stats is null");
      return null;
    }
    const gid = dom.getAttribute("data-snapline-gid");
    if (!gid) {
      // console.error("GID is null");
      return null;
    }
    return this.getClassFromGid(gid);
  }
}

class ElementCallback {
  _object: ElementObject;
  _renderCallback: (() => void) | null = null;

  constructor(object: ElementObject) {
    this._object = object;
  }

  set renderCallback(callback: () => void) {
    this._renderCallback = callback.bind(this._object);
  }

  get renderCallback(): () => void {
    if (this._renderCallback) {
      this._renderCallback();
    }
    return () => {};
  }
}

type DomProperty = {
  height: number;
  width: number;
};

export interface DomInsertMode {
  appendChild?: HTMLElement | null;
  insertBefore?: [HTMLElement, HTMLElement] | null;
  replaceChild?: HTMLElement | null;
}

export class DomElement {
  _uuid: string;
  _global: GlobalManager;
  _parent: ElementObject;
  _domElement: HTMLElement;
  _domProperty: DomProperty;
  _pendingInsert: boolean;

  _requestRender: boolean = false;
  _requestFetch: boolean = false;
  _requestDelete: boolean = false;
  _style: Record<string, any>;
  _classList: string[];

  _inputEngine: InputControl;
  _event: DomEvent;
  event: DomEvent;
  callback: ElementCallback;

  localX: number;
  localY: number;

  positionMode: "absolute" | "relative" | "fixed";
  _domPosition: ObjectCoordinate;
  _transformApplied: ObjectCoordinate;
  insertMode: DomInsertMode;

  resizeObserver: ResizeObserver;
  mutationObserver: MutationObserver;

  constructor(
    global: GlobalManager,
    parent: ElementObject,
    dom: HTMLElement,
    insertMode: DomInsertMode = {},
    isFragment: boolean = false,
  ) {
    this._global = global;
    this._domElement = dom;
    this._domProperty = {
      height: 0,
      width: 0,
    };
    this._domPosition = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0,
    };
    this._transformApplied = {
      worldX: 0,
      worldY: 0,
      localX: 0,
      localY: 0,
    };
    this._pendingInsert = isFragment;
    this._parent = parent;
    // this._style = {};
    this._uuid = (++global.gid).toString();
    this._requestRender = false;
    this._requestFetch = false;
    this._requestDelete = false;
    this._style = {};
    this.positionMode = "absolute";

    this._classList = [];
    this._event = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null,
    };
    this.event = EventProxyFactory(parent, this._event);
    this.callback = new ElementCallback(parent);
    this._inputEngine = new InputControl(this._global);
    this._inputEngine?.addCursorEventListener(this._domElement);
    this._inputEngine!.event.mouseDownCallback = this._onCursorDown.bind(this);
    this._inputEngine!.event.mouseMoveCallback = this._onCursorMove.bind(this);
    this._inputEngine!.event.mouseUpCallback = this._onCursorUp.bind(this);
    this._inputEngine!.event.mouseWheelCallback =
      this._onCursorScroll.bind(this);

    this.submitRenderQueue();
    this.submitFetchQueue();

    this.localX = 0;
    this.localY = 0;

    this.insertMode = insertMode;

    this.resizeObserver = new ResizeObserver(() => {
      this.submitFetchQueue();
    });
    this.resizeObserver.observe(this._domElement);

    this.mutationObserver = new MutationObserver(() => {
      this.submitFetchQueue();
    });
    this.mutationObserver.observe(this._domElement, {
      childList: true,
      subtree: true,
    });
  }

  set localPosition(position: [number, number]) {
    this.localX = position[0];
    this.localY = position[1];
    this.submitRenderQueue();
  }

  get localPosition(): [number, number] {
    return [this.localX, this.localY];
  }

  get cameraPosition(): [number, number] {
    return (
      this._global.camera?.getCameraFromWorld(this.localX, this.localY) ?? [
        0, 0,
      ]
    );
  }

  set cameraPosition(position: [number, number]) {
    throw new Error("cameraPosition is read only");
  }

  get screenPosition(): [number, number] {
    return (
      this._global.camera?.getScreenFromCamera(...this.cameraPosition) ?? [0, 0]
    );
  }

  set screenPosition(position: [number, number]) {
    throw new Error("screenPosition is read only");
  }

  set style(style: Record<string, any>) {
    this._style = style;
    this.submitRenderQueue();
  }

  get style(): Record<string, any> {
    return this._style;
  }

  set classList(classList: string[]) {
    this._classList = classList;
    this.submitRenderQueue();
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
    this.submitRenderQueue();
  }

  submitRenderQueue() {
    if (this._requestRender == false) {
      this._requestRender = true;
      this._global.domRenderQueue.push(this);
    }
  }

  render() {
    setDomStyle(this._domElement, this._style);

    this._domElement.classList.forEach((className) => {
      this._domElement.classList.add(className);
    });
    if (this._pendingInsert) {
      if (this.insertMode.appendChild) {
        this.insertMode.appendChild.appendChild(this._domElement);
      } else if (this.insertMode.insertBefore) {
        this.insertMode.insertBefore[0].insertBefore(
          this._domElement,
          this.insertMode.insertBefore[1],
        );
      } else if (this.insertMode.replaceChild) {
        this.insertMode.replaceChild.replaceChild(
          this._domElement,
          this.insertMode.replaceChild,
        );
      } else {
        this._global.containerElement?.appendChild(this._domElement);
      }
      this._pendingInsert = false;
    }
    this._requestRender = false;
    this.submitFetchQueue();
  }

  submitDeleteQueue() {
    if (this._requestDelete == false) {
      this._requestDelete = true;
      this._global.domDeleteQueue.push(this);
      this._global.domPaintQueue.push(this);
    }
  }

  delete(): void {
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    this._global.containerElement?.removeChild(this._domElement);
  }

  submitFetchQueue() {
    if (this._requestFetch == false) {
      this._requestFetch = true;
      this._global.domFetchQueue.push(this);
    }
  }

  fetchProperty() {
    if (this._pendingInsert) {
      return;
    }
    const property = getDomProperty(this._global, this._domElement);
    this._domProperty.height = property.height;
    this._domProperty.width = property.width;
    this._domPosition.worldX = property.worldX - this._transformApplied.worldX;
    this._domPosition.worldY = property.worldY - this._transformApplied.worldY;
    this._requestFetch = false;
  }

  paint() {
    let transformStyle = {};
    if (this.positionMode == "relative") {
      transformStyle = {
        transform: `none`,
      };
      [this._transformApplied.worldX, this._transformApplied.worldY] = [0, 0];
    } else if (this.positionMode == "fixed") {
      transformStyle = {
        transform: `translate3d(${this._parent.worldX + this.localX}px, ${this._parent.worldY + this.localY}px, 0px)`,
      };
      [this._transformApplied.worldX, this._transformApplied.worldY] = [
        this._parent.worldX + this.localX,
        this._parent.worldY + this.localY,
      ];
    } else {
      // Calculate the new position of the dom element
      let [newX, newY] = [
        this._parent.worldX + this.localX - this._domPosition.worldX,
        this._parent.worldY + this.localY - this._domPosition.worldY,
      ];
      transformStyle = {
        transform: `translate3d(${newX}px, ${newY}px, 0px)`,
      };
      [this._transformApplied.worldX, this._transformApplied.worldY] = [
        newX,
        newY,
      ];
    }
    setDomStyle(this._domElement, {
      ...this._style,
      ...transformStyle,
    });
  }
}

/**
 * Components refer to any element that is part of a node.
 */
export class ElementObject extends BaseObject {
  _domElementList: DomElement[] = [];
  _requestRender: boolean;
  _requestFetch: boolean;
  _requestDelete: boolean;
  _requestPaint: boolean;
  _state: any = {};
  state: Record<string, any>;

  _parentElement: HTMLElement | null; /* Parent element of the object */
  _elementIndex: number; /* Index of the element in the parent */

  inScene: boolean = false; /* Whether the object is in the scene */
  callback: ElementCallback;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.inScene = false;
    this.callback = new ElementCallback(this);
    this._parentElement = null;
    this._elementIndex = -1;
    this._requestRender = false;
    this._requestFetch = false;
    this._requestDelete = false;
    this._requestPaint = false;
    let _this = this;
    this.state = new Proxy(this._state, {
      set: (target, prop, value) => {
        target[prop] = value;
        _this.submitRenderQueue();
        _this.submitFetchQueue();

        return true;
      },
    });
  }

  set worldPosition(position: [number, number]) {
    this.position.worldX = position[0];
    this.position.worldY = position[1];
    this.submitRenderQueue();
  }

  addDom(dom: HTMLElement): DomElement {
    let domElement = new DomElement(this.global, this, dom);
    domElement.event.onCursorDown = this.event.dom.onCursorDown;
    domElement.event.onCursorMove = this.event.dom.onCursorMove;
    domElement.event.onCursorUp = this.event.dom.onCursorUp;
    domElement.event.onCursorScroll = this.event.dom.onCursorScroll;
    this._domElementList.push(domElement);

    return domElement;
  }

  get dom(): DomElement {
    return this._domElementList[0];
  }

  submitRenderQueue() {
    if (this._requestRender == false) {
      this._requestRender = true;
      this.global.domRenderQueue.push(this);
      this.global.domPaintQueue.push(this);
    }
  }

  render(): void {
    for (const domElement of this._domElementList) {
      domElement.render();
    }
    this.callback.renderCallback();
    this._requestRender = false;
  }

  submitDeleteQueue() {
    if (this._requestDelete == false) {
      this._requestDelete = true;
      this.global.domDeleteQueue.push(this);
    }
  }

  delete(): void {
    for (const child of this.children) {
      child.delete();
    }
    for (const domElement of this._domElementList) {
      domElement.submitDeleteQueue();
    }
  }

  submitFetchQueue() {
    if (this._requestFetch == false) {
      this._requestFetch = true;
      this.global.domFetchQueue.push(this);
    }
  }

  fetchProperty() {
    for (const domElement of this._domElementList) {
      domElement.fetchProperty();
    }
  }

  submitPaintQueue() {
    if (this._requestPaint == false) {
      this._requestPaint = true;
      this.global.domPaintQueue.push(this);
    }
  }

  paint(): void {
    for (const domElement of this._domElementList) {
      domElement.paint();
    }
  }
}
