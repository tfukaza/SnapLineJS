// Credits to Lean Rada for the collision detection algorithm article
// https://leanrada.com/

import { BaseObject, CoreObject } from "./object";
import { EventProxyFactory } from "./util";
import type { Engine } from "./engine";

type ColliderType = "rect" | "circle" | "point";

interface ColliderWorldBounds {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
  radius: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

interface CollisionEvent {
  onCollide: null | ((thisObject: Collider, otherObject: Collider) => void);
  onBeginContact:
    | null
    | ((thisObject: Collider, otherObject: Collider) => void);
  onEndContact: null | ((thisObject: Collider, otherObject: Collider) => void);
}

class EventCallback {
  #collider: CollisionEvent;

  collider: CollisionEvent;

  constructor(object: BaseObject) {
    this.#collider = {
      onCollide: null,
      onBeginContact: null,
      onEndContact: null,
    };
    this.collider = EventProxyFactory(object, this.#collider);
  }
}

const currentCollisionMap = new WeakMap<Collider, Set<Collider>>();
const iterationCollisionMap = new WeakMap<Collider, Set<Collider>>();

function currentCollisionsFor(collider: Collider): Set<Collider> {
  let collisions = currentCollisionMap.get(collider);
  if (!collisions) {
    collisions = new Set();
    currentCollisionMap.set(collider, collisions);
  }
  return collisions;
}

function iterationCollisionsFor(collider: Collider): Set<Collider> {
  let collisions = iterationCollisionMap.get(collider);
  if (!collisions) {
    collisions = new Set();
    iterationCollisionMap.set(collider, collisions);
  }
  return collisions;
}

function handleColliderCollision(thisObject: Collider, otherObject: Collider) {
  thisObject.event.collider.onCollide?.(thisObject, otherObject);
  const currentCollisions = currentCollisionsFor(thisObject);
  if (!currentCollisions.has(otherObject)) {
    thisObject.event.collider.onBeginContact?.(thisObject, otherObject);
    currentCollisions.add(otherObject);
  }
  iterationCollisionsFor(thisObject).add(otherObject);
}

function finishColliderCollisionIteration(collider: Collider) {
  const currentCollisions = currentCollisionsFor(collider);
  const iterationCollisions = iterationCollisionsFor(collider);
  for (const currentCollision of [...currentCollisions]) {
    if (!iterationCollisions.has(currentCollision)) {
      collider.event.collider.onEndContact?.(collider, currentCollision);
      currentCollisions.delete(currentCollision);
    }
  }
  iterationCollisions.clear();
}

function forgetColliderCollision(thisObject: Collider, otherObject: Collider) {
  currentCollisionsFor(thisObject).delete(otherObject);
  iterationCollisionsFor(thisObject).delete(otherObject);
}

/**
 * Base class for all collision shapes.
 *
 * Provides collision detection, event callbacks, and position tracking relative to parent objects.
 * Colliders are automatically registered with the global collision engine.
 *
 * Collision events:
 * - `onCollide`: Called every frame while colliding
 * - `onBeginContact`: Called once when collision starts
 * - `onEndContact`: Called once when collision ends
 */
class Collider extends CoreObject {
  #parent: BaseObject;
  #id: symbol;
  #width: number;
  #height: number;
  #event: EventCallback;
  #shapeVersion: number = 0;
  #cachedBoundsShapeVersion: number = -1;
  #cachedBoundsTransformEpoch: number = -1;
  #cachedBounds: ColliderWorldBounds = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    width: 0,
    height: 0,
    radius: 0,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    centerX: 0,
    centerY: 0,
  };

  type: ColliderType;

  constructor(
    engine: Engine,
    parent: BaseObject,
    type: ColliderType,
    localX: number,
    localY: number,
  ) {
    super(engine);
    this.#parent = parent;
    this.type = type;
    this.#id = Symbol();
    this.#width = 0;
    this.#height = 0;
    this.localTransform = { x: localX, y: localY };
    this.setTransformParent(parent, false);
    this.#event = new EventCallback(this.parent);
  }

  get id(): symbol {
    return this.#id;
  }

  get parent(): BaseObject {
    return this.#parent;
  }

  set parent(parent: BaseObject) {
    this.#parent = parent;
    this.setTransformParent(parent, false);
  }

  get event(): EventCallback {
    return this.#event;
  }

  get width(): number {
    return this.#width;
  }

  set width(width: number) {
    this.#width = width;
    this.#markShapeChange();
  }

  get height(): number {
    return this.#height;
  }

  set height(height: number) {
    this.#height = height;
    this.#markShapeChange();
  }

  getWorldBoundsSnapshot(): ColliderWorldBounds {
    if (
      this.#cachedBoundsShapeVersion === this.#shapeVersion &&
      this.#cachedBoundsTransformEpoch === this.getTransformEpoch()
    ) {
      return this.#cachedBounds;
    }

    const transform = this.getWorldTransform();
    const width = this.#width * Math.abs(transform.scaleX);
    const height = this.#height * Math.abs(transform.scaleY);
    const radius =
      this.localRadius *
      Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
    const rightEdge = transform.x + this.#width * transform.scaleX;
    const bottomEdge = transform.y + this.#height * transform.scaleY;
    const left =
      this.type === "circle"
        ? transform.x - radius
        : Math.min(transform.x, rightEdge);
    const right =
      this.type === "circle"
        ? transform.x + radius
        : Math.max(transform.x, rightEdge);
    const top =
      this.type === "circle"
        ? transform.y - radius
        : Math.min(transform.y, bottomEdge);
    const bottom =
      this.type === "circle"
        ? transform.y + radius
        : Math.max(transform.y, bottomEdge);

    this.#cachedBounds = {
      x: transform.x,
      y: transform.y,
      scaleX: transform.scaleX,
      scaleY: transform.scaleY,
      width,
      height,
      radius,
      left,
      right,
      top,
      bottom,
      centerX: this.type === "rect" ? left + width / 2 : transform.x,
      centerY: this.type === "rect" ? top + height / 2 : transform.y,
    };
    this.#cachedBoundsShapeVersion = this.#shapeVersion;
    this.#cachedBoundsTransformEpoch = this.getTransformEpoch();
    return this.#cachedBounds;
  }

  /**
   * Returns true if this collider is currently intersecting the given collider.
   * Updated every frame by the collision engine — no manual check needed.
   */
  isCollidingWith(other: Collider): boolean {
    return currentCollisionsFor(this).has(other);
  }

  /**
   * Returns a readonly set of all colliders currently intersecting this one.
   * Updated every frame by the collision engine.
   */
  get currentCollisions(): ReadonlySet<Collider> {
    return currentCollisionsFor(this);
  }

  get worldWidth(): number {
    return this.getWorldBoundsSnapshot().width;
  }

  get worldHeight(): number {
    return this.getWorldBoundsSnapshot().height;
  }

  get worldRadius(): number {
    return this.getWorldBoundsSnapshot().radius;
  }

  get worldLeft(): number {
    return this.getWorldBoundsSnapshot().left;
  }

  get worldRight(): number {
    return this.getWorldBoundsSnapshot().right;
  }

  get worldTop(): number {
    return this.getWorldBoundsSnapshot().top;
  }

  get worldBottom(): number {
    return this.getWorldBoundsSnapshot().bottom;
  }

  /**
   * Returns the number of colliders currently intersecting this one.
   * Updated every frame by the collision engine.
   */
  get collisionCount(): number {
    return currentCollisionsFor(this).size;
  }

  /**
   * Synchronous world-space point test against this collider's cached bounds.
   * Unlike currentCollisions/isCollidingWith it does NOT depend on the per-frame
   * collision sweep, so it is safe to call at pointerdown for a hitbox that was
   * just moved (e.g. a resize handle following its node).
   */
  containsWorldPoint(x: number, y: number): boolean {
    const bounds = this.getWorldBoundsSnapshot();
    if (this.type === "circle") {
      const dx = x - bounds.x;
      const dy = y - bounds.y;
      return Math.sqrt(dx * dx + dy * dy) <= bounds.radius;
    }
    return (
      x >= bounds.left &&
      x <= bounds.right &&
      y >= bounds.top &&
      y <= bounds.bottom
    );
  }

  destroy() {
    this.engine.collisionEngine?.removeObject(this.id);
    this.detachTransformParent(false);
    currentCollisionMap.delete(this);
    iterationCollisionMap.delete(this);
  }

  protected get localRadius(): number {
    return 0;
  }

  protected markShapeChange() {
    this.#markShapeChange();
  }

  #markShapeChange() {
    this.#shapeVersion++;
  }
}

/**
 * Rectangular collision shape.
 *
 * Defines an axis-aligned bounding box for collision detection.
 * Dimensions are specified by width and height.
 */
class RectCollider extends Collider {
  constructor(
    engine: Engine,
    parent: BaseObject,
    localX: number,
    localY: number,
    width: number,
    height: number,
  ) {
    super(engine, parent, "rect", localX, localY);
    this.width = width;
    this.height = height;
  }
}

/**
 * Circular collision shape.
 *
 * Defines a circle for collision detection. The circle is centered at the collider's position
 * with the specified radius.
 */
class CircleCollider extends Collider {
  #radius: number = 0;

  constructor(
    engine: Engine,
    parent: BaseObject,
    localX: number,
    localY: number,
    radius: number,
  ) {
    super(engine, parent, "circle", localX, localY);
    this.radius = radius;
  }

  get radius(): number {
    return this.#radius;
  }

  set radius(radius: number) {
    this.#radius = radius;
    this.markShapeChange();
  }

  protected get localRadius(): number {
    return this.#radius;
  }
}

/**
 * Point collision shape.
 *
 * Defines a single point for collision detection. Useful for precise hit detection
 * or checking if a position overlaps with other colliders.
 */
class PointCollider extends Collider {
  constructor(
    engine: Engine,
    parent: BaseObject,
    localX: number,
    localY: number,
  ) {
    super(engine, parent, "point", localX, localY);
  }
}

interface SortedEntry {
  collider: Collider;
  x: number;
  left: boolean;
}

/**
 * Manages collision detection for all colliders in the scene.
 *
 * Uses a sweep-and-prune algorithm for efficient broad-phase collision detection.
 * Supports multiple collision shapes (rectangle, circle, point) and triggers
 * appropriate callbacks when collisions are detected.
 *
 * The engine automatically:
 * - Tracks active collisions
 * - Triggers onBeginContact when collisions start
 * - Triggers onCollide every frame while colliding
 * - Triggers onEndContact when collisions end
 */
class CollisionEngine {
  #objectTable: Map<symbol, Collider> = new Map();
  #objectList: Collider[] = [];
  #sortedXCoordinates: SortedEntry[] = [];

  addObject(object: Collider) {
    if (this.#objectTable.has(object.id)) {
      return;
    }

    this.#objectTable.set(object.id, object);
    this.#objectList.push(object);
    const bounds = object.getWorldBoundsSnapshot();
    this.#sortedXCoordinates.push({
      collider: object,
      x: bounds.left,
      left: true,
    });
    this.#sortedXCoordinates.push({
      collider: object,
      x: bounds.right,
      left: false,
    });
  }

  removeObject(id: symbol) {
    const object = this.#objectTable.get(id);
    this.#objectTable.delete(id);
    this.#objectList = this.#objectList.filter((obj) => obj.id !== id);
    this.#sortedXCoordinates = this.#sortedXCoordinates.filter(
      (entry) => entry.collider.id !== id,
    );

    if (!object) {
      return;
    }

    for (const collider of this.#objectList) {
      forgetColliderCollision(collider, object);
    }
  }

  #updateXCoordinates() {
    for (const entry of this.#sortedXCoordinates) {
      const bounds = entry.collider.getWorldBoundsSnapshot();
      entry.x = entry.left ? bounds.left : bounds.right;
    }
  }

  #sortXCoordinates() {
    this.#sortedXCoordinates.sort((a, b) => {
      return a.x - b.x;
    });
  }

  #colliderCenterX(c: Collider): number {
    return c.getWorldBoundsSnapshot().centerX;
  }

  #colliderCenterY(c: Collider): number {
    return c.getWorldBoundsSnapshot().centerY;
  }

  detectCollisions() {
    this.#updateXCoordinates();
    this.#sortXCoordinates();
    const localCollisions: Set<Collider> = new Set();
    let collisionIdx = 0;
    // Sweep through the sorted X coordinates
    for (const entry of this.#sortedXCoordinates) {
      if (entry.left) {
        // Check if any objects in the local collisions set are intersecting with the current object
        for (const collider of localCollisions) {
          if (this.isIntersecting(entry.collider, collider)) {
            handleColliderCollision(entry.collider, collider);
            handleColliderCollision(collider, entry.collider);

            // Debug: draw line between colliding collider centers
            const ax = this.#colliderCenterX(entry.collider);
            const ay = this.#colliderCenterY(entry.collider);
            const bx = this.#colliderCenterX(collider);
            const by = this.#colliderCenterY(collider);
            entry.collider.parent.addDebugLine(
              ax,
              ay,
              bx,
              by,
              "rgba(255, 50, 50, 0.35)",
              false,
              `collision-${collisionIdx++}`,
              1,
              "collisions",
            );
          }
        }
        localCollisions.add(entry.collider);
      } else {
        localCollisions.delete(entry.collider);
      }
    }
    // Check if any collisions ended
    for (const entry of this.#sortedXCoordinates) {
      if (!entry.left) {
        continue;
      }
      finishColliderCollisionIteration(entry.collider);
    }
  }

  isIntersecting(a: Collider, b: Collider) {
    const colliderA = a;
    const colliderB = b;

    if (colliderA.type === "rect" && colliderB.type === "rect") {
      return this.#isRectIntersecting(colliderA, colliderB);
    } else if (colliderA.type === "circle" && colliderB.type === "circle") {
      return this.#isCircleIntersecting(
        colliderA as CircleCollider,
        colliderB as CircleCollider,
      );
    } else if (colliderA.type === "rect" && colliderB.type === "circle") {
      return this.#isRectCircleIntersecting(
        colliderA as RectCollider,
        colliderB as CircleCollider,
      );
    } else if (colliderA.type === "circle" && colliderB.type === "rect") {
      return this.#isRectCircleIntersecting(
        colliderB as RectCollider,
        colliderA as CircleCollider,
      );
    } else if (colliderA.type === "rect" && colliderB.type === "point") {
      return this.#isRectPointIntersecting(
        colliderA as RectCollider,
        colliderB as PointCollider,
      );
    } else if (colliderA.type === "point" && colliderB.type === "rect") {
      return this.#isRectPointIntersecting(
        colliderB as RectCollider,
        colliderA as PointCollider,
      );
    } else if (colliderA.type === "point" && colliderB.type === "circle") {
      return this.#isCirclePointIntersecting(
        colliderB as CircleCollider,
        colliderA as PointCollider,
      );
    } else if (colliderA.type === "circle" && colliderB.type === "point") {
      return this.#isCirclePointIntersecting(
        colliderA as CircleCollider,
        colliderB as PointCollider,
      );
    } else if (colliderA.type === "point" && colliderB.type === "point") {
      return this.#isPointPointIntersecting(
        colliderA as PointCollider,
        colliderB as PointCollider,
      );
    }

    return false;
  }

  #isRectIntersecting(a: Collider, b: Collider) {
    const boundsA = a.getWorldBoundsSnapshot();
    const boundsB = b.getWorldBoundsSnapshot();
    return (
      a.id !== b.id &&
      boundsA.left < boundsB.right &&
      boundsA.right > boundsB.left &&
      boundsA.top < boundsB.bottom &&
      boundsA.bottom > boundsB.top
    );
  }

  #isRectCircleIntersecting(rect: RectCollider, circle: CircleCollider) {
    const rectBounds = rect.getWorldBoundsSnapshot();
    const circleBounds = circle.getWorldBoundsSnapshot();
    let rectX = circleBounds.x;
    let rectY = circleBounds.y;
    if (circleBounds.x < rectBounds.left) {
      rectX = rectBounds.left;
    } else if (circleBounds.x > rectBounds.right) {
      rectX = rectBounds.right;
    }

    if (circleBounds.y < rectBounds.top) {
      rectY = rectBounds.top;
    } else if (circleBounds.y > rectBounds.bottom) {
      rectY = rectBounds.bottom;
    }

    const distanceX = circleBounds.x - rectX;
    const distanceY = circleBounds.y - rectY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= circleBounds.radius;
  }

  #isRectPointIntersecting(rect: RectCollider, point: PointCollider) {
    const rectBounds = rect.getWorldBoundsSnapshot();
    const pointBounds = point.getWorldBoundsSnapshot();
    return (
      pointBounds.x >= rectBounds.left &&
      pointBounds.x <= rectBounds.right &&
      pointBounds.y >= rectBounds.top &&
      pointBounds.y <= rectBounds.bottom
    );
  }

  #isCirclePointIntersecting(circle: CircleCollider, point: PointCollider) {
    const circleBounds = circle.getWorldBoundsSnapshot();
    const pointBounds = point.getWorldBoundsSnapshot();
    const distanceX = circleBounds.x - pointBounds.x;
    const distanceY = circleBounds.y - pointBounds.y;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= circleBounds.radius;
  }

  #isCircleIntersecting(circleA: CircleCollider, circleB: CircleCollider) {
    if (circleA.id === circleB.id) {
      return false;
    }
    const boundsA = circleA.getWorldBoundsSnapshot();
    const boundsB = circleB.getWorldBoundsSnapshot();
    const distanceX = boundsA.x - boundsB.x;
    const distanceY = boundsA.y - boundsB.y;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    return distance <= boundsA.radius + boundsB.radius;
  }

  #isPointPointIntersecting(pointA: PointCollider, pointB: PointCollider) {
    if (pointA.id === pointB.id) {
      return false;
    }
    const boundsA = pointA.getWorldBoundsSnapshot();
    const boundsB = pointB.getWorldBoundsSnapshot();
    return boundsA.x === boundsB.x && boundsA.y === boundsB.y;
  }
}

export {
  CollisionEngine,
  Collider,
  RectCollider,
  CircleCollider,
  PointCollider,
};
