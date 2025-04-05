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

class EventCallback {
  _object: BaseObject;
  _collider: CollisionEvent;
  collider: CollisionEvent;
  _dom: DomEvent;
  dom: DomEvent;

  constructor(object: BaseObject) {
    this._object = object;
    this._collider = {
      onCollide: null,
      onBeginContact: null,
      onEndContact: null,
    };
    this.collider = EventProxyFactory(object, this._collider);
    this._dom = {
      onCursorDown: null,
      onCursorMove: null,
      onCursorUp: null,
      onCursorScroll: null,
      onResize: null,
    };
    this.dom = EventProxyFactory(object, this._dom);
  }
}

class Collider {
  global: GlobalManager;
  parent: BaseObject;
  type: "rect" | "circle" | "line" | "point" | "svg";
  localX: number;
  localY: number;
  width: number;
  height: number;
  uuid: symbol;
  domElement: HTMLElement | null;
  inputEngine: InputControl;

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
    this.domElement = null;
    this.localX = localX;
    this.localY = localY;
    this.width = 0;
    this.height = 0;
    this.event = new EventCallback(this.parent);
    this._iterationCollisions = new Set();
    this._currentCollisions = new Set();
    this.recalculate();
    this.inputEngine = new InputControl(this.global);
  }

  get worldX(): number {
    return this.parent.worldX + this.localX;
  }

  set worldX(x: number) {
    this.localX = x - this.parent.worldX;
  }

  get worldY(): number {
    return this.parent.worldY + this.localY;
  }

  set worldY(y: number) {
    this.localY = y - this.parent.worldY;
  }

  set localPosition([x, y]: [number, number]) {
    this.localX = x;
    this.localY = y;
  }

  assignDom(domElement: HTMLElement) {
    this.domElement = domElement;
    this.inputEngine?.addCursorEventListener(this.domElement);
    // if parent has the "dom" property, then submit fetch queue
    if (this.parent.hasOwnProperty("_domElementList")) {
      this.parent.requestRead();
    } else {
      this.recalculate();
    }
  }

  read() {
    if (!this.domElement) {
      return;
    }
    const property = getDomProperty(this.global, this.domElement);
    this.localX = property.worldX - this.parent.position.worldX;
    this.localY = property.worldY - this.parent.position.worldY;
    this.width = property.width;
    this.height = property.height;
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
    this.width = width;
    this.height = height;
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
      x: object.worldX,
      left: true,
    });
    this.sortedXCoordinates.push({
      collider: object,
      x: object.worldX + (object.width ?? 0),
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
            entry.collider.worldX - (entry.collider as CircleCollider).radius;
        } else if (entry.collider.type === "rect") {
          entry.x = entry.collider.worldX;
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldX;
        }
      } else {
        if (entry.collider.type === "circle") {
          entry.x =
            entry.collider.worldX + (entry.collider as CircleCollider).radius;
        } else if (entry.collider.type === "rect") {
          entry.x =
            entry.collider.worldX + (entry.collider as RectCollider).width;
        } else if (entry.collider.type === "point") {
          entry.x = entry.collider.worldX;
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
      a.worldY < b.worldY + (b as RectCollider).height &&
      a.worldY + (a as RectCollider).height > b.worldY
    );
  }

  isRectCircleIntersecting(rect: RectCollider, circle: CircleCollider) {
    let rectX = circle.worldX;
    let rectY = circle.worldY;
    if (circle.worldX < rect.worldX) {
      rectX = rect.worldX;
    } else if (circle.worldX > rect.worldX + rect.width) {
      rectX = rect.worldX + rect.width;
    }

    if (circle.worldY < rect.worldY) {
      rectY = rect.worldY;
    } else if (circle.worldY > rect.worldY + rect.height) {
      rectY = rect.worldY + rect.height;
    }

    let distanceX = circle.worldX - rectX;
    let distanceY = circle.worldY - rectY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }

  isRectPointIntersecting(rect: RectCollider, point: PointCollider) {
    return (
      point.worldX >= rect.worldX &&
      point.worldX <= rect.worldX + rect.width &&
      point.worldY >= rect.worldY &&
      point.worldY <= rect.worldY + rect.height
    );
  }

  isCirclePointIntersecting(circle: CircleCollider, point: PointCollider) {
    let distanceX = circle.worldX - point.worldX;
    let distanceY = circle.worldY - point.worldY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circle.radius ?? 0);
  }

  isCircleIntersecting(circleA: CircleCollider, circleB: CircleCollider) {
    if (circleA.uuid === circleB.uuid) {
      return false;
    }
    let distanceX = circleA.worldX - circleB.worldX;
    let distanceY = circleA.worldY - circleB.worldY;
    let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= (circleA.radius ?? 0) + (circleB.radius ?? 0);
  }

  isPointPointIntersecting(pointA: PointCollider, pointB: PointCollider) {
    if (pointA.uuid === pointB.uuid) {
      return false;
    }
    return pointA.worldX === pointB.worldX && pointA.worldY === pointB.worldY;
  }
}

export {
  CollisionEngine,
  Collider,
  RectCollider,
  CircleCollider,
  PointCollider,
};
