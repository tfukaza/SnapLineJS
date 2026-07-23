import type { AnimationInterface } from "./animation";
import type { Collider } from "./collision";
import type { Engine } from "./engine";
import type { InputEventCallback } from "./input";
import { GlobalManager } from "./global";
import {
  EventProxyFactory,
  generateTransformString,
  getDomProperty,
  parseTransformString,
  setDomStyle,
} from "./util";

export type FrameReadStages = "READ_1" | "READ_2" | "READ_3";
export type FrameWriteStages = "WRITE_1" | "WRITE_2" | "WRITE_3";
export type FrameStages = FrameReadStages | FrameWriteStages;
export type FrameTaskCallback = () => void | Promise<void>;
export type TransformSpace = "world" | "local";

export interface DomEvent {
  onAssignDom: null | (() => void);
  onResize: null | (() => void);
  onAfterReadDom: null | ((stage: FrameReadStages) => void);
}

export interface FrameStats {
  timestamp: number;
}

export interface TransformProperty {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

type ReadonlyTransformProperty = Readonly<TransformProperty>;

export interface DomProperty extends TransformProperty {
  height: number;
  width: number;
  screenX: number;
  screenY: number;
  margin: BoxSpacing;
  padding: BoxSpacing;
  border: BoxSpacing;
}

interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

let transformEpoch = 0;
const animationOwnerMap = new WeakMap<AnimationInterface, BaseObject>();

class EventCallback {
  #object: BaseObject;
  #global: InputEventCallback;
  #input: InputEventCallback;
  #dom: DomEvent;

  global: InputEventCallback;
  input: InputEventCallback;
  dom: DomEvent;

  constructor(object: BaseObject) {
    this.#object = object;
    this.#global = {
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
    this.global = new Proxy(this.#global, {
      set: (_, prop: any, value: CallableFunction | null) => {
        if (value == null) {
          this.#object.engine?.input.unsubscribeGlobalCursorEvent(
            prop,
            this.#object.id,
          );
        } else {
          this.#object.engine?.input.subscribeGlobalCursorEvent(
            prop,
            this.#object.id,
            (value as any).bind(this.#object),
            this.#object.engine,
          );
        }
        return true;
      },
    });
    this.#input = {
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
      this.#object,
      this.#input,
    );
    this.#dom = {
      onAssignDom: null,
      onResize: null,
      onAfterReadDom: null,
    };
    this.dom = EventProxyFactory<BaseObject, DomEvent>(this.#object, this.#dom);
  }
}

export class ObjectTransform {
  #owner: CoreObject;
  #parentTransform: ObjectTransform | null = null;
  #local: TransformProperty = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  };
  #cachedWorld: TransformProperty = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  };
  #cachedWorldEpoch: number = -1;

  constructor(owner: CoreObject) {
    this.#owner = owner;
  }

  getWorld(): ReadonlyTransformProperty {
    return this.#getCachedWorld();
  }

  setWorld(transform: TransformProperty) {
    this.#local = this.#worldToLocal(transform);
    this.#markLocalChange();
    this.#owner.notifyTransformChange();
  }

  getLocal(): TransformProperty {
    return this.#local;
  }

  setLocal(transform: TransformProperty) {
    this.#local = transform;
    this.#markLocalChange();
  }

  #getCachedWorld(): TransformProperty {
    if (this.#cachedWorldEpoch === transformEpoch) {
      return this.#cachedWorld;
    }

    const parentWorld = this.#parentTransform
      ? this.#parentTransform.#getCachedWorld()
      : null;
    if (parentWorld) {
      this.#cachedWorld.x = parentWorld.x + this.#local.x * parentWorld.scaleX;
      this.#cachedWorld.y = parentWorld.y + this.#local.y * parentWorld.scaleY;
      this.#cachedWorld.scaleX = parentWorld.scaleX * this.#local.scaleX;
      this.#cachedWorld.scaleY = parentWorld.scaleY * this.#local.scaleY;
    } else {
      this.#cachedWorld.x = this.#local.x;
      this.#cachedWorld.y = this.#local.y;
      this.#cachedWorld.scaleX = this.#local.scaleX;
      this.#cachedWorld.scaleY = this.#local.scaleY;
    }
    this.#cachedWorldEpoch = transformEpoch;
    return this.#cachedWorld;
  }

  #worldToLocal(transform: TransformProperty): TransformProperty {
    const parentTransform = this.#parentTransform
      ? this.#parentTransform.#getCachedWorld()
      : null;
    if (!parentTransform) {
      return { ...transform };
    }

    if (parentTransform.scaleX === 0 || parentTransform.scaleY === 0) {
      throw new Error("Cannot set world transform under a zero-scale parent.");
    }

    return {
      x: (transform.x - parentTransform.x) / parentTransform.scaleX,
      y: (transform.y - parentTransform.y) / parentTransform.scaleY,
      scaleX: transform.scaleX / parentTransform.scaleX,
      scaleY: transform.scaleY / parentTransform.scaleY,
    };
  }

  #markLocalChange() {
    transformEpoch++;
  }

  setParentTransform(parent: CoreObject | null) {
    this.#parentTransform = parent ? parent.transform ?? null : null;
    this.#markLocalChange();
  }
}

/**
 * Shared transform node for engine objects.
 *
 * CoreObject owns engine/global references and world/local transform
 * composition. Higher-level classes decide how much of the hierarchy is
 * exposed through their public APIs.
 */
export class CoreObject {
  #global!: GlobalManager;
  #engine!: Engine;
  #transform: ObjectTransform;
  #transformParent: CoreObject | null = null;
  #transformChildren: CoreObject[] = [];

  constructor(engine: Engine) {
    const global = engine.global;
    if (!global) {
      throw new Error("CoreObject requires an active Engine instance.");
    }
    this.#engine = engine;
    this.#global = global;
    this.#transform = new ObjectTransform(this);
  }

  get global(): GlobalManager {
    return this.#global;
  }

  set global(global: GlobalManager) {
    this.#global = global;
  }

  get engine(): Engine {
    return this.#engine;
  }

  set engine(engine: Engine) {
    this.#engine = engine;
  }

  get transformParent(): CoreObject | null {
    return this.#transformParent;
  }

  get transformChildren(): readonly CoreObject[] {
    return this.#transformChildren;
  }

  get transform(): ObjectTransform {
    return this.#transform;
  }

  get worldTransform(): TransformProperty {
    return this.#transform.getWorld();
  }

  set worldTransform(transform: {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
  }) {
    this.#transform.setWorld({
      x: transform.x ?? this.worldTransform.x,
      y: transform.y ?? this.worldTransform.y,
      scaleX: transform.scaleX ?? this.worldTransform.scaleX,
      scaleY: transform.scaleY ?? this.worldTransform.scaleY,
    });
  }

  get localTransform(): TransformProperty {
    return this.#transform.getLocal();
  }

  set localTransform(transform: {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
  }) {
    this.#transform.setLocal({
      x: transform.x ?? this.localTransform.x,
      y: transform.y ?? this.localTransform.y,
      scaleX: transform.scaleX ?? this.localTransform.scaleX,
      scaleY: transform.scaleY ?? this.localTransform.scaleY,
    });
  }

  // TODO: Factor in camera scaling
  get cameraPosition(): [number, number] {
    const world = this.worldTransform;
    return this.engine.camera?.getCameraFromWorld(world.x, world.y) ?? [0, 0];
  }

  set cameraPosition(position: [number, number]) {
    const world = this.engine?.camera?.getWorldFromCamera(...position) ?? [
      0, 0,
    ];
    this.worldTransform = { x: world[0], y: world[1] };
  }

  get screenPosition(): [number, number] {
    return (
      this.engine.camera?.getScreenFromCamera(...this.cameraPosition) ?? [0, 0]
    );
  }

  set screenPosition(position: [number, number]) {
    this.cameraPosition = this.engine?.camera?.getCameraFromScreen(
      ...position,
    ) ?? [0, 0];
  }

  notifyTransformChange() {
    this.onTransformChange();
  }

  protected onTransformChange() {}

  protected getWorldTransform(): TransformProperty {
    return this.#transform.getWorld();
  }

  protected getTransformEpoch(): number {
    return transformEpoch;
  }

  protected setWorldTransform(transform: TransformProperty) {
    this.#transform.setWorld(transform);
  }

  protected setTransformParent(
    parent: CoreObject | null,
    preserveWorld: boolean,
  ) {
    this.#validateNewTransformParent(parent);
    if (parent === this.#transformParent) {
      return;
    }

    const worldTransform = preserveWorld ? this.#transform.getWorld() : null;
    this.#detachTransformParent(false);
    this.#transformParent = parent;
    this.#transform.setParentTransform(parent);
    if (parent) {
      parent.#transformChildren.push(this);
    }

    if (worldTransform) {
      this.#transform.setWorld(worldTransform);
    } else {
      this.notifyTransformChange();
    }
  }

  protected detachTransformParent(preserveWorld: boolean) {
    this.#detachTransformParent(preserveWorld);
  }

  #detachTransformParent(preserveWorld: boolean) {
    if (!this.#transformParent) {
      return;
    }

    const worldTransform = preserveWorld ? this.#transform.getWorld() : null;
    const parent = this.#transformParent;
    parent.#transformChildren = parent.#transformChildren.filter(
      (child) => child !== this,
    );
    this.#transformParent = null;
    this.#transform.setParentTransform(null);

    if (worldTransform) {
      this.#transform.setWorld(worldTransform);
    } else {
      this.notifyTransformChange();
    }
  }

  #validateNewTransformParent(parent: CoreObject | null) {
    if (parent === null) {
      return;
    }

    if (parent === this) {
      throw new Error("An object cannot be parented to itself.");
    }

    let ancestor: CoreObject | null = parent;
    while (ancestor) {
      if (ancestor === this) {
        throw new Error("An object cannot be parented to one of its children.");
      }
      ancestor = ancestor.transformParent;
    }
  }
}

export class FrameTask {
  id: string;
  object: BaseObject;
  callback: null | Array<FrameTaskCallback>;

  constructor(
    object: BaseObject,
    callback: null | FrameTaskCallback,
    id: string | null = null,
  ) {
    this.id = id ?? object.global.createId();
    this.object = object;
    this.callback = callback ? [callback.bind(object)] : null;
  }

  addCallback(callback: FrameTaskCallback) {
    if (this.callback) {
      this.callback.push(callback.bind(this.object));
    } else {
      this.callback = [callback.bind(this.object)];
    }
  }

  cancel() {
    this.callback = null;
  }
}

/**
 * Base class for all objects in the engine.
 */
export class BaseObject extends CoreObject {
  #id!: string;
  #parent: BaseObject | null = null;
  #children: BaseObject[] = [];
  #colliderList: Collider[] = [];
  #animationList: AnimationInterface[] = [];
  #globalInput!: InputEventCallback;

  event: EventCallback;
  globalInput: InputEventCallback;
  isDeleteRequested = false;

  constructor(engine: Engine, parent: BaseObject | null = null) {
    super(engine);
    this.#id = this.global.createId();
    this.global.registerObject(this);

    this.#colliderList = [];
    this.event = new EventCallback(this);

    this.#globalInput = {
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
    this.globalInput = new Proxy(this.#globalInput, {
      set: (_, prop: any, value: CallableFunction | null) => {
        if (value == null) {
          this.engine?.input.unsubscribeGlobalCursorEvent(prop, this.id);
        } else {
          this.engine?.input.subscribeGlobalCursorEvent(
            prop,
            this.id,
            value.bind(this) as (prop: any) => void,
            this.engine,
          );
        }
        return true;
      },
    });

    if (parent) {
      parent.#attachChild(this, false);
    }
  }

  get id(): string {
    return this.#id;
  }

  set id(id: string) {
    this.#id = id;
  }

  get parent(): BaseObject | null {
    return this.#parent;
  }

  set parent(parent: BaseObject | null) {
    this.#setParent(parent, true);
  }

  get children(): BaseObject[] {
    return this.#children;
  }

  set children(children: BaseObject[]) {
    this.#children = children;
  }

  get colliderList(): Collider[] {
    return this.#colliderList;
  }

  set colliderList(colliderList: Collider[]) {
    this.#colliderList = colliderList;
  }

  get animationList(): AnimationInterface[] {
    return this.#animationList;
  }

  set animationList(animationList: AnimationInterface[]) {
    this.#animationList = animationList;
  }

  get animation() {
    if (this.animationList.length === 0) {
      return null;
    }
    return this.animationList[this.animationList.length - 1];
  }

  destroy() {
    this.isDeleteRequested = true;
    for (const collider of [...this.colliderList]) {
      collider.destroy();
    }
    this.colliderList = [];
    this.cancelAnimations();
    for (const queue of Object.values(this.global.queue)) {
      queue.delete(this.id);
    }
    if (this.#parent) {
      this.#parent.removeChild(this);
    }
    this.global.unregisterObject(this);
  }

  appendChild(child: BaseObject) {
    this.#attachChild(child, true);
  }

  removeChild(child: BaseObject) {
    if (child.#parent !== this) {
      return;
    }

    child.#detachFromParent(true);
  }

  /**
   * Queues an update callback to be executed during a specific stage of the render pipeline.
   * @param callback - Optional callback function to execute during the stage
   * @param config - Render stage and optional queue identifier
   * @returns The queue entry object
   */
  schedule(
    callback: FrameTaskCallback | null,
    config: {
      stage: FrameStages;
      queueId?: string;
    },
  ): FrameTask {
    const request = new FrameTask(this, callback, config.queueId);
    const queue = this.global.queue[config.stage];
    if (!queue.get(this.id)) {
      queue.set(this.id, new Map());
    }
    queue.get(this.id)!.set(request.id, request);
    return request;
  }

  requestDestroy(): FrameTask {
    return this.schedule(() => this.destroyDom(), {
      stage: "WRITE_2",
      queueId: "destroy",
    });
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

  addCollider(collider: Collider) {
    if (collider.parent !== this) {
      collider.parent = this;
    }
    if (!this.colliderList.includes(collider)) {
      this.colliderList.push(collider);
    }
    if (!this.engine) {
      return;
    }
    this.engine.collisionEngine?.addObject(collider);
  }

  addAnimation(
    animation: AnimationInterface,
    options: { replaceExisting?: boolean } = {},
  ) {
    this.engine?.enableAnimationEngine();

    const replaceExisting = options.replaceExisting ?? true;

    if (replaceExisting) {
      this.cancelAnimations();
    }

    this.animationList.push(animation);
    animationOwnerMap.set(animation, this);
    this.engine?.animationList.push(animation);
    return animation;
  }

  cancelAnimations() {
    for (const existingAnimation of [...this.animationList]) {
      existingAnimation.requestDelete = true;
      existingAnimation.cancel();
      this.removeAnimationReference(existingAnimation);
    }
  }

  removeAnimationReference(animation: AnimationInterface) {
    this.animationList = this.animationList.filter(
      (anim) => anim !== animation,
    );
    animationOwnerMap.delete(animation);
  }

  /**
   * Convenience method to create and add a sequence of animations to this object.
   *
   * @param animations - Array of AnimationInterface objects to play as a sequence
   * @returns The created sequence animation
   */
  async animateSequence(animations: AnimationInterface[]) {
    const { SequenceObject } = await import("./animation");
    const sequence = new SequenceObject();
    for (const animation of animations) {
      sequence.add(animation);
    }
    return this.addAnimation(sequence, { replaceExisting: true });
  }

  getCurrentStats(): FrameStats {
    return {
      timestamp: Date.now(),
    };
  }

  addDebugPoint(
    x: number,
    y: number,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
    tag?: string,
  ) {
    if (!this.engine) return;
    this.engine.debugMarkerList[`${this.id}-${id}`] = {
      objectId: this.id,
      type: "point",
      color: color,
      x,
      y,
      persistent,
      id: `${this.id}-${id}`,
      tag,
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
    filled: boolean = true,
    lineWidth: number = 1,
    tag?: string,
  ) {
    if (!this.engine) return;
    this.engine.debugMarkerList[`${this.id}-${id}`] = {
      objectId: this.id,
      type: "rect",
      color: color,
      x,
      y,
      width,
      height,
      persistent,
      id: `${this.id}-${id}`,
      filled,
      lineWidth,
      tag,
    };
  }

  addDebugLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
    lineWidth: number = 2,
    tag?: string,
    arrowEnd?: boolean,
    arrowStart?: boolean,
    arrowSize?: number,
  ) {
    if (!this.engine) return;
    this.engine.debugMarkerList[`${this.id}-${id}`] = {
      objectId: this.id,
      type: "line",
      color: color,
      x: x1,
      y: y1,
      x2,
      y2,
      persistent,
      id: `${this.id}-${id}`,
      lineWidth,
      tag,
      arrowEnd,
      arrowStart,
      arrowSize,
    };
  }

  addDebugCircle(
    x: number,
    y: number,
    radius: number,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
    tag?: string,
  ) {
    if (!this.engine) return;
    this.engine.debugMarkerList[`${this.id}-${id}`] = {
      objectId: this.id,
      type: "circle",
      color: color,
      x,
      y,
      radius,
      persistent,
      id: `${this.id}-${id}`,
      tag,
    };
  }

  addDebugText(
    x: number,
    y: number,
    text: string,
    color: string = "red",
    persistent: boolean = false,
    id: string = "",
    tag?: string,
  ) {
    if (!this.engine) return;
    this.engine.debugMarkerList[`${this.id}-${id}`] = {
      objectId: this.id,
      x,
      y,
      type: "text",
      color: color,
      text,
      persistent,
      id: `${this.id}-${id}`,
      tag,
    };
  }

  clearDebugMarker(id: string) {
    if (!this.engine) return;
    delete this.engine.debugMarkerList[`${this.id}-${id}`];
  }

  clearAllDebugMarkers() {
    if (!this.engine) return;
    for (const marker of Object.values(this.engine.debugMarkerList) as Array<{
      objectId: string;
      id: string;
      type: "point" | "rect" | "circle" | "text";
      persistent: boolean;
      color: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      radius?: number;
      text?: string;
    }>) {
      if (marker.objectId == this.id) {
        delete this.engine.debugMarkerList[marker.id];
      }
    }
  }

  #validateNewParent(parent: BaseObject | null) {
    if (parent === null) {
      return;
    }

    if (parent === this) {
      throw new Error("An object cannot be parented to itself.");
    }

    let ancestor: BaseObject | null = parent;
    while (ancestor) {
      if (ancestor === this) {
        throw new Error("An object cannot be parented to one of its children.");
      }
      ancestor = ancestor.parent;
    }
  }

  #detachFromParent(preserveWorld: boolean) {
    if (!this.#parent) {
      return;
    }

    const parent = this.#parent;
    parent.#children = parent.#children.filter((child) => child !== this);
    this.#parent = null;
    this.setTransformParent(null, preserveWorld);
  }

  #attachChild(child: BaseObject, preserveWorld: boolean) {
    child.#validateNewParent(this);
    if (child.#parent === this) {
      return;
    }

    child.#detachFromPublicParent();
    child.#parent = this;
    this.#children.push(child);
    child.setTransformParent(this, preserveWorld);
  }

  #setParent(parent: BaseObject | null, preserveWorld: boolean) {
    this.#validateNewParent(parent);
    if (parent === this.#parent) {
      return;
    }

    if (parent) {
      parent.#attachChild(this, preserveWorld);
    } else {
      this.#detachFromParent(preserveWorld);
    }
  }

  #detachFromPublicParent() {
    if (!this.#parent) {
      return;
    }

    const parent = this.#parent;
    parent.#children = parent.#children.filter((child) => child !== this);
    this.#parent = null;
  }
}

export function detachAnimationFromOwner(animation: AnimationInterface) {
  const owner = animationOwnerMap.get(animation);
  if (!owner) {
    return;
  }
  owner.removeAnimationReference(animation);
}

function createDomProperty(): DomProperty {
  return {
    x: 0,
    y: 0,
    height: 0,
    width: 0,
    scaleX: 1,
    scaleY: 1,
    screenX: 0,
    screenY: 0,
    margin: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    border: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  };
}

function copyDomPropertyValue(target: DomProperty, source: DomProperty) {
  Object.assign(target, {
    ...source,
    margin: { ...source.margin },
    padding: { ...source.padding },
    border: { ...source.border },
  });
}

export class ElementObject extends BaseObject {
  #element: HTMLElement | null = null;
  #style: Record<string, any> = {};
  #classList: string[] = [];
  #dataAttribute: Record<string, any> = {};
  #property: DomProperty;
  #domProperty: Array<DomProperty>;
  #resizeObserver: ResizeObserver | null = null;
  #mutationObserver: MutationObserver | null = null;
  #state: any = {};

  state: Record<string, any>;

  transformMode: "direct" | "relative" | "origin" | "none";
  transformOrigin: BaseObject | null;

  #inputAlias: HTMLElement | null = null;

  constructor(engine: Engine, parent: BaseObject | null = null) {
    super(engine, parent);
    this.#property = createDomProperty();
    this.#domProperty = [];
    for (let i = 0; i < 3; i++) {
      this.#domProperty.push(createDomProperty());
    }
    this.transformMode = "direct";
    this.transformOrigin = null;
    this.state = new Proxy(this.#state, {
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    });
  }

  get currentDomProperty(): DomProperty {
    return this.#property;
  }

  get style(): Record<string, any> {
    return this.#style;
  }

  set style(style: Record<string, any>) {
    this.#style = Object.assign(this.#style, style);
  }

  get classList(): string[] {
    return this.#classList;
  }

  set classList(classList: string[]) {
    this.#classList = classList;
  }

  get dataAttribute(): Record<string, any> {
    return this.#dataAttribute;
  }

  set dataAttribute(dataAttribute: Record<string, any>) {
    this.#dataAttribute = Object.assign(this.#dataAttribute, dataAttribute);
  }

  get element(): HTMLElement | null {
    return this.#element;
  }

  set element(element: HTMLElement | null | undefined) {
    if (!element) {
      return;
    }
    this.#assignElement(element);
    this.event.dom.onAssignDom?.();
  }

  addInputAlias(element: HTMLElement): void {
    if (this.#inputAlias === element) {
      return;
    }

    this.engine.input.unregisterObjectElement(this);
    this.#inputAlias = element;
    this.engine.input.registerObjectElement(this, element);
  }

  removeInputAlias(element: HTMLElement): void {
    if (this.#inputAlias !== element) {
      return;
    }

    this.engine.input.unregisterObjectElement(this, element);
    this.#inputAlias = null;
    if (this.#element) {
      this.engine.input.registerObjectElement(this, this.#element);
    }
  }

  destroy(removeElement: boolean = true) {
    this.destroyDom(removeElement);
    super.destroy();
  }

  getDomProperty(stage: FrameReadStages | null = null): DomProperty {
    let index = 0;
    if (stage == "READ_1") {
      index = 0;
    } else if (stage == "READ_2") {
      index = 1;
    } else if (stage == "READ_3" || stage == null) {
      index = 2;
    } else {
      throw new Error(`Invalid stage: ${stage}`);
    }
    return this.#domProperty[index];
  }

  copyDomProperty(fromStage: FrameReadStages, toStage: FrameReadStages): void {
    copyDomPropertyValue(
      this.getDomProperty(toStage),
      this.getDomProperty(fromStage),
    );
  }

  /**
   * Save the DOM property to the transform property.
   * Currently only saves the x and y properties.
   * This function assumes that the element position has already been read from the DOM.
   */
  saveDomProperety(stage: FrameReadStages | null = null): void {
    let currentStage = stage ?? this.global.currentStage;
    currentStage = currentStage == "IDLE" ? "READ_2" : currentStage;
    const property = this.getDomProperty(currentStage as FrameReadStages);
    this.worldTransform = { x: property.x, y: property.y };
  }

  readDom(
    config: { unapplyTransform?: boolean } = {},
    stage: FrameReadStages | null = null,
  ): DomProperty {
    const currentStage = stage ?? this.global.currentStage;

    if (!["READ_1", "READ_2", "READ_3", "IDLE"].includes(currentStage)) {
      throw new Error(
        `Reading DOM during ${currentStage} is prohibited. Only READ_1, READ_2, READ_3, and IDLE are allowed.`,
      );
    }

    if (currentStage === "IDLE") {
      console.warn(`Reading DOM during IDLE stage may cause layout thrashing`);
    }

    if (!this.#element) {
      throw new Error("Element is not set");
    }

    const property = getDomProperty(this.engine, this.#element);
    const transform = this.#element.style.transform;
    let transformApplied = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };

    if (transform && transform != "none" && config.unapplyTransform) {
      transformApplied = parseTransformString(transform);
    }

    this.#property.height = property.height / transformApplied.scaleY;
    this.#property.width = property.width / transformApplied.scaleX;
    this.#property.x = property.x - transformApplied.x;
    this.#property.y = property.y - transformApplied.y;
    this.#property.screenX = property.screenX;
    this.#property.screenY = property.screenY;
    this.#property.margin = property.margin;
    this.#property.padding = property.padding;
    this.#property.border = property.border;

    if (["READ_1", "READ_2", "READ_3"].includes(currentStage)) {
      copyDomPropertyValue(
        this.getDomProperty(currentStage as FrameReadStages),
        this.#property,
      );
    }

    return this.#property;
  }

  readDomRecursive(
    config: {
      unapplyTransform?: boolean;
      saveDomProperety?: boolean;
      saveWorldPosition?: boolean;
    } = {},
  ) {
    const stage = this.global.currentStage as FrameReadStages;
    if (!["READ_1", "READ_2", "READ_3"].includes(stage)) {
      throw new Error(`Invalid stage: ${stage}`);
    }

    this.readDom(config);
    if (config.saveDomProperety || config.saveWorldPosition) {
      this.saveDomProperety(stage);
    }

    for (const child of this.children) {
      if (child instanceof ElementObject) {
        child.readDomRecursive(config);
      }
    }
  }

  writeDom() {
    const currentStage = this.global.currentStage;

    if (!["WRITE_1", "WRITE_2", "WRITE_3", "IDLE"].includes(currentStage)) {
      throw new Error(
        `Writing DOM during ${currentStage} is prohibited. Only WRITE_1, WRITE_2, WRITE_3, and IDLE are allowed.`,
      );
    }

    if (!this.#element) {
      throw new Error("Element is not set");
    }

    setDomStyle(this.#element, this.#style);

    if (this.#classList.length > 0) {
      const nextClassList = new Set(this.#classList);
      this.#element.classList.forEach((className) => {
        if (!nextClassList.has(className)) {
          this.#element!.classList.remove(className);
        }
      });
      for (const className of nextClassList) {
        this.#element.classList.add(className);
      }
    }

    for (const [key, value] of Object.entries(this.#dataAttribute)) {
      this.#element.setAttribute(`data-${key}`, value);
    }
    this.#element.setAttribute("data-engine-id", this.id);

    super.writeDom();
  }

  writeTransform() {
    const currentStage = this.global.currentStage;

    if (!["WRITE_1", "WRITE_2", "WRITE_3", "IDLE"].includes(currentStage)) {
      throw new Error(
        `Writing transform during ${currentStage} is prohibited. Only WRITE_1, WRITE_2, WRITE_3, and IDLE are allowed.`,
      );
    }

    if (!this.#element) {
      throw new Error("Element is not set");
    }

    let transformStyle = {
      transform: "",
    };

    if (this.transformMode == "direct") {
      transformStyle = {
        transform: generateTransformString({
          x: this.worldTransform.x,
          y: this.worldTransform.y,
          scaleX: this.worldTransform.scaleX,
          scaleY: this.worldTransform.scaleY,
        }),
      };
    } else if (this.transformMode == "relative") {
      const [newX, newY] = [
        this.worldTransform.x - this.#property.x,
        this.worldTransform.y - this.#property.y,
      ];
      transformStyle = {
        transform: generateTransformString({
          x: newX,
          y: newY,
          scaleX: this.worldTransform.scaleX,
          scaleY: this.worldTransform.scaleY,
        }),
      };
    } else if (this.transformMode == "origin") {
      const origin = this.transformOrigin ?? this.parent;
      if (!origin) {
        const [newX, newY] = [
          this.worldTransform.x - this.#property.x,
          this.worldTransform.y - this.#property.y,
        ];
        transformStyle = {
          transform: generateTransformString({
            x: newX,
            y: newY,
            scaleX: this.worldTransform.scaleX,
            scaleY: this.worldTransform.scaleY,
          }),
        };
      } else {
        if (
          origin.worldTransform.scaleX === 0 ||
          origin.worldTransform.scaleY === 0
        ) {
          throw new Error(
            "Cannot write origin transform relative to a zero-scale origin.",
          );
        }
        transformStyle = {
          transform: generateTransformString({
            x:
              (this.worldTransform.x - origin.worldTransform.x) /
              origin.worldTransform.scaleX,
            y:
              (this.worldTransform.y - origin.worldTransform.y) /
              origin.worldTransform.scaleY,
            scaleX: this.worldTransform.scaleX / origin.worldTransform.scaleX,
            scaleY: this.worldTransform.scaleY / origin.worldTransform.scaleY,
          }),
        };
      }
    } else if (this.transformMode == "none") {
      transformStyle = {
        transform: "",
      };
    }

    // If transform is already defined in style, let it take precedence
    if (
      this.#style["transform"] != undefined &&
      this.#style["transform"] != "" &&
      transformStyle["transform"] != ""
    ) {
      transformStyle["transform"] = this.#style["transform"];
    }

    setDomStyle(this.#element, { ...this.#style, ...transformStyle });
    super.writeTransform();
  }

  // Write twin of readDomRecursive: cascades a transform WRITE down the graph the
  // same way readDomRecursive cascades a DOM READ. Synchronous polymorphic
  // recursion, no scheduling of its own — the caller schedules one WRITE-stage
  // callback that invokes this, exactly as a READ callback invokes
  // readDomRecursive. It walks transformChildren (world transforms compose along
  // the transform graph) where the read walks public children (DOM layout nests
  // publicly). No reparenting or position mutation: each descendant's world value
  // is already current via the epoch cache, so writeTransform just paints it.
  writeTransformRecursive() {
    const stage = this.global.currentStage as FrameWriteStages;
    if (!["WRITE_1", "WRITE_2", "WRITE_3"].includes(stage)) {
      throw new Error(`Invalid stage: ${stage}`);
    }

    this.writeTransform();

    for (const child of this.transformChildren) {
      // Skip transformMode "none" (connectors follow their node for free, and
      // this prunes their line subtree so world-space lines keep their own glue)
      // and non-ElementObject children (e.g. RectCollider hit boxes).
      if (child instanceof ElementObject && child.transformMode !== "none") {
        child.writeTransformRecursive();
      }
    }
  }

  destroyDom(removeElement: boolean = true) {
    this.#resizeObserver?.disconnect();
    this.#mutationObserver?.disconnect();
    if (this.#inputAlias) {
      this.engine?.input.unregisterObjectElement(this, this.#inputAlias);
      this.#inputAlias = null;
    }
    if (this.#element) {
      this.engine?.input.unregisterObjectElement(this, this.#element);
      if (removeElement) {
        this.#element.remove();
      }
    }
    this.#element = null;
    super.destroyDom();
  }

  #assignElement(element: HTMLElement) {
    if (this.#element) {
      this.destroyDom();
    }

    this.#element = element;
    if (this.#inputAlias == null) {
      this.engine.input.registerObjectElement(this, element);
    }

    this.#resizeObserver = new ResizeObserver(() => {
      this.event.dom.onResize?.();
    });
    this.#resizeObserver.observe(element);

    this.#mutationObserver = new MutationObserver(() => {
      this.event.dom.onResize?.();
    });
  }
}
