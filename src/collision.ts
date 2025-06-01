// Credits to Lean Rada for the collision detection algorithm article
// https://leanrada.com/

import { GlobalManager } from "./global";
import { BaseObject, DomEvent } from "./object";
import { getDomProperty } from "./util";
import { InputControl } from "./input";
import { EventProxyFactory } from "./util";

interface CollisionEvent {
  onCollide: null | ((thisObject: Collider, otherObject: Collider) => void);
  onBeginContact:
    | null
    | ((thisObject: Collider, otherObject: Collider) => void);
  onEndContact: null | ((thisObject: Collider, otherObject: Collider) => void);
}

interface ColliderProperty {
  x: number;
  y: number;
  width: number;
  height: number;
}

class EventCallback {
  _object: BaseObject;
  _collider: CollisionEvent;
  collider: CollisionEvent;
  // _dom: DomEvent;
  // dom: DomEvent;

  constructor(object: BaseObject) {
    this._object = object;
    this._collider = {
      onCollide: null,
      onBeginContact: null,
      onEndContact: null,
    };
    this.collider = EventProxyFactory(object, this._collider);
    // this._dom = {
    //   onCursorDown: null,
    //   onCursorMove: null,
    //   onCursorUp: null,
    //   onCursorScroll: null,
    //   onResize: null,
    // };
    // this.dom = EventProxyFactory(object, this._dom);
  }
}

class Collider {
  global: GlobalManager;
  parent: BaseObject;
  type: "rect" | "circle" | "line" | "point" | "svg";
  uuid: symbol;
  _element: HTMLElement | null;
  inputEngine: InputControl;

  transform: ColliderProperty;
  // local: ColliderProperty;

  event: EventCallback;

  _currentCollisions: Set<Collider>;
  _iterationCollisions: Set<Collider>;
  constructor(
    global: GlobalManager,
    parent: BaseObject,
    type: "rect" | "circle" | "line" | "point" | "svg",
    localX: number,
    localY: number,
  ) {
    this.global = global;
    this.parent = parent;
    this.type = type;
    this.uuid = Symbol();
    this._element = null;
    this.transform = {
      x: localX,
      y: localY,
      width: 0,
      height: 0,
    };
    // this.local = {
    //   x: localX,
    //   y: localY,
    //   width: 0,
    //   height: 0,
    // };
    this.event = new EventCallback(this.parent);
    this._iterationCollisions = new Set();
    this._currentCollisions = new Set();
    this.recalculate();
    this.inputEngine = new InputControl(this.global);
  }

  get worldPosition(): [number, number] {
    return [
      this.parent.transform.x + this.transform.x,
      this.parent.transform.y + this.transform.y,
    ];
  }

  set worldPosition([x, y]: [number, number]) {
    this.transform.x = x - this.parent.transform.x;
    this.transform.y = y - this.parent.transform.y;
  }

  // get localPosition(): [number, number] {
  //   return [this.local.x, this.local.y];
  // }

  // set localPosition([x, y]: [number, number]) {
  //   this.local.x = x;
  //   this.local.y = y;
  // }

  set element(element: HTMLElement) {
    this._element = element;
    // this.inputEngine?.addCursorEventListener(this._element);
    // if parent has the "dom" property, then submit fetch queue
    if (this.parent.hasOwnProperty("element")) {
      this.parent.requestRead();
    } else {
      this.recalculate();
    }
  }

  read() {
    if (!this.element) {
      return;
    }
    const property = getDomProperty(this.global, this.element);
    this.transform.x = property.x - this.parent.transform.x;
    this.transform.y = property.y - this.parent.transform.y;
    this.transform.width = property.width;
    this.transform.height = property.height;
  }

  recalculate() {}
}

class RectCollider extends Collider {
  constructor(
    global: GlobalManager,
    parent: BaseObject,
    localX: number,
    localY: number,
    width: number,
    height: number,
  ) {
    super(global, parent, "rect", localX, localY);
    this.transform.width = width;
    this.transform.height = height;
  }
}

class CircleCollider extends Collider {
  radius: number;
  constructor(
    global: GlobalManager,
    parent: BaseObject,
    localX: number,
    localY: number,
    radius: number,
  ) {
    super(global, parent, "circle", localX, localY);
    this.radius = radius;
  }
}

class PointCollider extends Collider {
  constructor(
    global: GlobalManager,
    parent: BaseObject,
    localX: number,
    localY: number,
  ) {
    super(global, parent, "point", localX, localY);
  }
}

interface SortedEntry {
  collider: Collider;
  x: number;
  left: boolean;
}

class CollisionEngine {
  objectTable: Record<symbol, Collider> = {};
  objectList: Collider[] = [];

  sortedXCoordinates: SortedEntry[] = [];

  constructor() {
    this.sortedXCoordinates = [];
  }

  addObject(object: Collider) {
    this.objectTable[object.uuid] = object;
    this.objectList.push(object);
    this.sortedXCoordinates.push({
      collider: object,
      x: object.worldPosition[0],
      left: true,
    });
    this.sortedXCoordinates.push({
      collider: object,
      x: object.worldPosition[0] + (object.transform.width ?? 0),
      left: false,
    });
  }

  removeObject(uuid: symbol) {
    delete this.objectTable[uuid];
    this.objectList = this.objectList.filter((obj) => obj.uuid !== uuid);
  }

  updateXCoordinates() {
    for (const entry of this.sortedXCoordinates) {
      if (entry.left) {
        if (entry.collider.type === "circle") {
          entry.x =
            entry.collider.worldPosition[0] -
            (entry.collider as CircleCollider).radius;
        } else if (entry.collider.type === "rect") {
          entry.x = entry.collider.worldPosition[0];
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldPosition[0];
        }
      } else {
        if (entry.collider.type === "circle") {
          entry.x =
            entry.collider.worldPosition[0] +
            (entry.collider as CircleCollider).radius;
        } else if (entry.collider.type === "rect") {
          entry.x =
            entry.collider.worldPosition[0] +
            (entry.collider as RectCollider).transform.width;
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldPosition[0];
        }
      }
    }
  }

  sortXCoordinates() {
    this.sortedXCoordinates.sort((a, b) => {
      return a.x - b.x;
    });
  }

  detectCollisions() {
    this.updateXCoordinates();
    this.sortXCoordinates();
    let localCollisions: Set<Collider> = new Set();
    // Sweep through the sorted X coordinates
    for (const entry of this.sortedXCoordinates) {
      if (entry.left) {
        // Check if any objects in the local collisions set are intersecting with the current object
        for (const collider of localCollisions) {
          if (this.isIntersecting(entry.collider, collider)) {
            this.onColliderCollide(entry.collider, collider);
            this.onColliderCollide(collider, entry.collider);
          }
        }
        localCollisions.add(entry.collider);
      } else {
        localCollisions.delete(entry.collider);
      }
    }
    // Check if any collisions ended
    for (const entry of this.sortedXCoordinates) {
      if (!entry.left) {
        continue;
      }
      for (const currentCollision of entry.collider._currentCollisions) {
        if (!entry.collider._iterationCollisions.has(currentCollision)) {
          entry.collider.event.collider.onEndContact?.(
            entry.collider,
            currentCollision,
          );
          entry.collider._currentCollisions.delete(currentCollision);
        }
      }
      entry.collider._iterationCollisions.clear();
    }
  }

  isIntersecting(a: Collider, b: Collider) {
    const colliderA = a;
    const colliderB = b;

    if (colliderA.type === "rect" && colliderB.type === "rect") {
      return this.isRectIntersecting(colliderA, colliderB);
    } else if (colliderA.type === "circle" && colliderB.type === "circle") {
      return this.isCircleIntersecting(
        colliderA as CircleCollider,
        colliderB as CircleCollider,
      );
    } else if (colliderA.type === "rect" && colliderB.type === "circle") {
      return this.isRectCircleIntersecting(
        colliderA as RectCollider,
        colliderB as CircleCollider,
      );
    } else if (colliderA.type === "circle" && colliderB.type === "rect") {
      return this.isRectCircleIntersecting(
        colliderB as RectCollider,
        colliderA as CircleCollider,
      );
    } else if (colliderA.type === "rect" && colliderB.type === "point") {
      return this.isRectPointIntersecting(
        colliderA as RectCollider,
        colliderB as PointCollider,
      );
    } else if (colliderA.type === "point" && colliderB.type === "rect") {
      return this.isRectPointIntersecting(
        colliderB as RectCollider,
        colliderA as PointCollider,
      );
    } else if (colliderA.type === "point" && colliderB.type === "circle") {
      return this.isCirclePointIntersecting(
        colliderB as CircleCollider,
        colliderA as PointCollider,
      );
    } else if (colliderA.type === "circle" && colliderB.type === "point") {
      return this.isCirclePointIntersecting(
        colliderA as CircleCollider,
        colliderB as PointCollider,
      );
    } else if (colliderA.type === "point" && colliderB.type === "point") {
      return this.isPointPointIntersecting(
        colliderA as PointCollider,
        colliderB as PointCollider,
      );
    }

    return false;
  }

  onColliderCollide(thisObject: Collider, otherObject: Collider) {
    if (thisObject.event.collider.onCollide) {
      thisObject.event.collider.onCollide(thisObject, otherObject);
    }
    if (thisObject._currentCollisions.has(otherObject)) {
    } else {
      // console.debug(`onColliderCollide, ${thisObject} and ${otherObject}`);
      thisObject.event.collider.onBeginContact?.(thisObject, otherObject);
      thisObject._currentCollisions.add(otherObject);
    }
    thisObject._iterationCollisions.add(otherObject);
  }

  isRectIntersecting(a: Collider, b: Collider) {
    return (
      a.uuid !== b.uuid &&
      a.worldPosition[1] <
        b.worldPosition[1] + (b as RectCollider).transform.height &&
      a.worldPosition[1] + (a as RectCollider).transform.height >
        b.worldPosition[1]
    );
  }

  isRectCircleIntersecting(rect: RectCollider, circle: CircleCollider) {
    let rectX = circle.worldPosition[0];
    let rectY = circle.worldPosition[1];
    if (circle.worldPosition[0] < rect.worldPosition[0]) {
      rectX = rect.worldPosition[0];
    } else if (
      circle.worldPosition[0] >
      rect.worldPosition[0] + rect.transform.width
    ) {
      rectX = rect.worldPosition[0] + rect.transform.width;
    }

    if (circle.worldPosition[1] < rect.worldPosition[1]) {
      rectY = rect.worldPosition[1];
    } else if (
      circle.worldPosition[1] >
      rect.worldPosition[1] + rect.transform.height
    ) {
      rectY = rect.worldPosition[1] + rect.transform.height;
    }

    let distanceX = circle.worldPosition[0] - rectX;
    let distanceY = circle.worldPosition[1] - rectY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }

  isRectPointIntersecting(rect: RectCollider, point: PointCollider) {
    return (
      point.worldPosition[0] >= rect.worldPosition[0] &&
      point.worldPosition[0] <= rect.worldPosition[0] + rect.transform.width &&
      point.worldPosition[1] >= rect.worldPosition[1] &&
      point.worldPosition[1] <= rect.worldPosition[1] + rect.transform.height
    );
  }

  isCirclePointIntersecting(circle: CircleCollider, point: PointCollider) {
    let distanceX = circle.worldPosition[0] - point.worldPosition[0];
    let distanceY = circle.worldPosition[1] - point.worldPosition[1];
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }

  isCircleIntersecting(circleA: CircleCollider, circleB: CircleCollider) {
    if (circleA.uuid === circleB.uuid) {
      return false;
    }
    let distanceX = circleA.worldPosition[0] - circleB.worldPosition[0];
    let distanceY = circleA.worldPosition[1] - circleB.worldPosition[1];
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circleA.radius ?? 0) + (circleB.radius ?? 0);
  }

  isPointPointIntersecting(pointA: PointCollider, pointB: PointCollider) {
    if (pointA.uuid === pointB.uuid) {
      return false;
    }
    return (
      pointA.worldPosition[0] === pointB.worldPosition[0] &&
      pointA.worldPosition[1] === pointB.worldPosition[1]
    );
  }
}

export {
  CollisionEngine,
  Collider,
  RectCollider,
  CircleCollider,
  PointCollider,
};
