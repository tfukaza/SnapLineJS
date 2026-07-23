import { expect, test } from "@playwright/test";
import { BaseObject, CoreObject, ElementObject } from "../../src/object";
import {
  CircleCollider,
  CollisionEngine,
  PointCollider,
  RectCollider,
} from "../../src/collision";

function createEngine() {
  let nextId = 0;
  const queue = {
    READ_1: new Map(),
    WRITE_1: new Map(),
    READ_2: new Map(),
    WRITE_2: new Map(),
    READ_3: new Map(),
    WRITE_3: new Map(),
  };

  return {
    global: {
      currentStage: "IDLE",
      queue,
      createId: () => `${++nextId}`,
      registerObject: () => {},
      unregisterObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
    camera: null,
    collisionEngine: null,
    animationList: [],
    debugMarkerList: {},
  } as any;
}

class TransformCounterObject extends BaseObject {
  transformChangeCount = 0;

  protected onTransformChange() {
    this.transformChangeCount++;
  }
}

function positionOf(transform: { x: number; y: number }) {
  return [transform.x, transform.y];
}

test.describe("BaseObject transforms", () => {
  test("keeps CoreObject root world and local transforms in sync", () => {
    const engine = createEngine();
    const object = new CoreObject(engine);

    object.worldTransform = { x: 12, y: 24, scaleX: 2, scaleY: 3 };

    expect(positionOf(object.localTransform)).toEqual([12, 24]);
    expect(object.localTransform.scaleX).toBe(2);
    expect(object.localTransform.scaleY).toBe(3);
    expect(object.transform.getWorld()).toBe(object.worldTransform);
  });

  test("keeps root world and local transforms in sync", () => {
    const engine = createEngine();
    const object = new BaseObject(engine);

    object.worldTransform = { x: 10, y: 20, scaleX: 2, scaleY: 3 };

    expect(object.localTransform.x).toBe(10);
    expect(object.localTransform.y).toBe(20);
    expect(object.localTransform.scaleX).toBe(2);
    expect(object.localTransform.scaleY).toBe(3);

    object.localTransform = { x: 30, y: 40 };
    expect(positionOf(object.worldTransform)).toEqual([30, 40]);
  });

  test("composes child transforms through parent position and scale", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    parent.worldTransform = { x: 100, y: 200, scaleX: 2, scaleY: 4 };

    const child = new BaseObject(engine, parent);
    child.localTransform = { x: 10, y: 20, scaleX: 3, scaleY: 5 };

    expect(positionOf(child.worldTransform)).toEqual([120, 280]);
    expect(child.worldTransform.scaleX).toBe(6);
    expect(child.worldTransform.scaleY).toBe(20);
  });

  test("sets child local transform through world transform writes", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    parent.worldTransform = { x: 100, y: 200, scaleX: 2, scaleY: 4 };

    const child = new BaseObject(engine, parent);
    child.worldTransform = { x: 140, y: 260, scaleX: 10, scaleY: 12 };

    expect(positionOf(child.localTransform)).toEqual([20, 15]);
    expect(child.localTransform.scaleX).toBe(5);
    expect(child.localTransform.scaleY).toBe(3);
  });

  test("preserves world transform on reparent", () => {
    const engine = createEngine();
    const parentA = new BaseObject(engine);
    parentA.worldTransform = { x: 100, y: 100, scaleX: 2, scaleY: 2 };

    const parentB = new BaseObject(engine);
    parentB.worldTransform = { x: -10, y: 20, scaleX: 5, scaleY: 10 };

    const child = new BaseObject(engine, parentA);
    child.localTransform = { x: 10, y: 20, scaleX: 3, scaleY: 4 };

    const worldBefore = positionOf(child.worldTransform);
    const scaleBefore = [
      child.worldTransform.scaleX,
      child.worldTransform.scaleY,
    ];

    parentB.appendChild(child);

    expect(positionOf(child.worldTransform)).toEqual(worldBefore);
    expect(child.worldTransform.scaleX).toBe(scaleBefore[0]);
    expect(child.worldTransform.scaleY).toBe(scaleBefore[1]);
    expect(parentA.children).not.toContain(child);
    expect(parentB.children).toEqual([child]);
  });

  test("rejects cyclic parent relationships and duplicate appends", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    const child = new BaseObject(engine, parent);

    parent.appendChild(child);
    parent.appendChild(child);

    expect(parent.children).toEqual([child]);
    expect(() => {
      child.appendChild(parent);
    }).toThrow("An object cannot be parented to one of its children.");
  });

  test("throws when world writes require a zero-scale inverse", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    parent.worldTransform = { scaleX: 0 };

    const child = new BaseObject(engine, parent);

    expect(() => {
      child.worldTransform = { x: 10 };
    }).toThrow("Cannot set world transform under a zero-scale parent.");
  });

  test("updates descendant world transforms lazily when an ancestor moves", () => {
    const engine = createEngine();
    const grandparent = new BaseObject(engine);
    const parent = new BaseObject(engine, grandparent);
    const child = new BaseObject(engine, parent);

    grandparent.worldTransform = { x: 10, y: 20, scaleX: 2, scaleY: 3 };
    parent.localTransform = { x: 5, y: 7, scaleX: 4, scaleY: 5 };
    child.localTransform = { x: 11, y: 13 };

    expect(positionOf(child.worldTransform)).toEqual([108, 236]);

    grandparent.worldTransform = { x: 100, y: 200 };

    expect(positionOf(parent.worldTransform)).toEqual([110, 221]);
    expect(positionOf(child.worldTransform)).toEqual([198, 416]);
  });

  test("does not recursively notify transform children on parent changes", () => {
    const engine = createEngine();
    const parent = new TransformCounterObject(engine);
    const child = new TransformCounterObject(engine, parent);

    parent.transformChangeCount = 0;
    child.transformChangeCount = 0;

    parent.worldTransform = { x: 10, y: 20 };

    expect(parent.transformChangeCount).toBe(1);
    expect(child.transformChangeCount).toBe(0);
    expect(positionOf(child.worldTransform)).toEqual([10, 20]);
  });
});

test.describe("Collider transforms", () => {
  test("uses the shared transform graph without entering public children", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    parent.worldTransform = { x: 100, y: 200, scaleX: 2, scaleY: 3 };

    const collider = new RectCollider(engine, parent, 10, 20, 30, 40);
    parent.addCollider(collider);

    expect(parent.children).toEqual([]);
    expect(parent.transformChildren).toContain(collider);
    expect(positionOf(collider.worldTransform)).toEqual([120, 260]);
    expect(collider.worldWidth).toBe(60);
    expect(collider.worldHeight).toBe(120);

    parent.worldTransform = { x: 150, y: 250 };

    expect(positionOf(collider.worldTransform)).toEqual([170, 310]);
  });

  test("keeps local collider mutations and world position writes compatible", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    parent.worldTransform = { x: 100, y: 200, scaleX: 2, scaleY: 4 };

    const collider = new RectCollider(engine, parent, 10, 20, 30, 40);

    collider.localTransform = { x: 15, y: 25 };

    expect(positionOf(collider.localTransform)).toEqual([15, 25]);
    expect(positionOf(collider.worldTransform)).toEqual([130, 300]);

    collider.worldTransform = { x: 160, y: 360 };

    expect(positionOf(collider.localTransform)).toEqual([30, 40]);
  });

  test("reparenting colliders preserves local offsets", () => {
    const engine = createEngine();
    const parentA = new BaseObject(engine);
    parentA.worldTransform = { x: 100, y: 100, scaleX: 2, scaleY: 2 };

    const parentB = new BaseObject(engine);
    parentB.worldTransform = { x: -10, y: 20, scaleX: 5, scaleY: 10 };

    const collider = new RectCollider(engine, parentA, 10, 20, 30, 40);

    collider.parent = parentB;

    expect(collider.parent).toBe(parentB);
    expect(positionOf(collider.localTransform)).toEqual([10, 20]);
    expect(positionOf(collider.worldTransform)).toEqual([40, 220]);
    expect(parentA.transformChildren).not.toContain(collider);
    expect(parentB.transformChildren).toContain(collider);
  });

  test("detects collisions across collider shapes after parent transforms", () => {
    const engine = createEngine();
    const collisionEngine = new CollisionEngine();
    const rectParent = new BaseObject(engine);
    const circleParent = new BaseObject(engine);
    const pointParent = new BaseObject(engine);

    rectParent.worldTransform = { x: 10, y: 10 };
    circleParent.worldTransform = { x: 40, y: 40 };
    pointParent.worldTransform = { x: 20, y: 20 };

    const rect = new RectCollider(engine, rectParent, 0, 0, 40, 40);
    const circle = new CircleCollider(engine, circleParent, 0, 0, 15);
    const point = new PointCollider(engine, pointParent, 0, 0);

    expect(collisionEngine.isIntersecting(rect, circle)).toBe(true);
    expect(collisionEngine.isIntersecting(rect, point)).toBe(true);
    expect(collisionEngine.isIntersecting(circle, point)).toBe(false);
  });

  test("emits begin, collide, and end callbacks after transform updates", () => {
    const engine = createEngine();
    const collisionEngine = new CollisionEngine();
    const parentA = new BaseObject(engine);
    const parentB = new BaseObject(engine);
    const rectA = new RectCollider(engine, parentA, 0, 0, 50, 50);
    const rectB = new RectCollider(engine, parentB, 25, 25, 50, 50);
    let beginCount = 0;
    let collideCount = 0;
    let endCount = 0;

    rectA.event.collider.onBeginContact = () => {
      beginCount++;
    };
    rectA.event.collider.onCollide = () => {
      collideCount++;
    };
    rectA.event.collider.onEndContact = () => {
      endCount++;
    };

    collisionEngine.addObject(rectA);
    collisionEngine.addObject(rectB);

    collisionEngine.detectCollisions();
    collisionEngine.detectCollisions();
    rectB.worldTransform = { x: 100, y: 100 };
    collisionEngine.detectCollisions();

    expect(beginCount).toBe(1);
    expect(collideCount).toBe(2);
    expect(endCount).toBe(1);
    expect(rectA.collisionCount).toBe(0);
  });

  test("updates collider bounds after parent and local transform changes", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    const collider = new RectCollider(engine, parent, 10, 20, 30, 40);

    parent.worldTransform = { x: 100, y: 200, scaleX: 2, scaleY: 3 };

    expect(collider.worldLeft).toBe(120);
    expect(collider.worldRight).toBe(180);
    expect(collider.worldTop).toBe(260);
    expect(collider.worldBottom).toBe(380);

    parent.worldTransform = { x: 150, y: 250 };
    collider.localTransform = { x: 20, y: 30 };
    collider.width = 50;
    collider.height = 60;

    expect(collider.worldLeft).toBe(190);
    expect(collider.worldRight).toBe(290);
    expect(collider.worldTop).toBe(340);
    expect(collider.worldBottom).toBe(520);
  });

  test("updates circle radius bounds after radius and parent scale changes", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    const collider = new CircleCollider(engine, parent, 10, 20, 15);

    parent.worldTransform = { x: 100, y: 200, scaleX: 2, scaleY: 3 };

    expect(positionOf(collider.worldTransform)).toEqual([120, 260]);
    expect(collider.worldRadius).toBe(45);
    expect(collider.worldLeft).toBe(75);
    expect(collider.worldRight).toBe(165);

    collider.radius = 10;
    parent.worldTransform = { scaleY: 4 };

    expect(positionOf(collider.worldTransform)).toEqual([120, 280]);
    expect(collider.worldRadius).toBe(40);
    expect(collider.worldTop).toBe(240);
    expect(collider.worldBottom).toBe(320);
  });
});

// Spies writeTransform so the cascade can be tested without a real DOM element
// (writeTransform throws when #element is unset).
class WriteSpyObject extends ElementObject {
  writeCount = 0;
  writeTransform() {
    this.writeCount++;
  }
}

test.describe("ElementObject writeTransformRecursive", () => {
  test("cascades the write to direct-mode children, skipping none-mode and colliders", () => {
    const engine = createEngine();
    const parent = new WriteSpyObject(engine);
    const directChild = new WriteSpyObject(engine);
    const noneChild = new WriteSpyObject(engine);
    parent.appendChild(directChild);
    parent.appendChild(noneChild);
    noneChild.transformMode = "none";
    const collider = new RectCollider(engine, parent, 0, 0, 10, 10);
    parent.addCollider(collider);

    expect(parent.transformChildren).toContain(directChild);
    expect(parent.transformChildren).toContain(noneChild);
    expect(parent.transformChildren).toContain(collider);

    engine.global.currentStage = "WRITE_2";
    parent.writeTransformRecursive();

    expect(parent.writeCount).toBe(1);
    expect(directChild.writeCount).toBe(1);
    expect(noneChild.writeCount).toBe(0); // none-mode pruned (with its subtree)
  });

  test("recurses through nested direct-mode children", () => {
    const engine = createEngine();
    const parent = new WriteSpyObject(engine);
    const child = new WriteSpyObject(engine);
    const grandchild = new WriteSpyObject(engine);
    parent.appendChild(child);
    child.appendChild(grandchild);

    engine.global.currentStage = "WRITE_2";
    parent.writeTransformRecursive();

    expect(parent.writeCount).toBe(1);
    expect(child.writeCount).toBe(1);
    expect(grandchild.writeCount).toBe(1);
  });

  test("throws when invoked outside a write stage", () => {
    const engine = createEngine();
    const parent = new WriteSpyObject(engine);
    engine.global.currentStage = "READ_1";
    expect(() => parent.writeTransformRecursive()).toThrow(/Invalid stage/);
  });
});

test.describe("Collider.containsWorldPoint", () => {
  test("circle: tests distance to the world center, and follows its parent", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    parent.worldTransform = { x: 100, y: 200 };
    const circle = new CircleCollider(engine, parent, 0, 0, 15);
    parent.addCollider(circle);

    expect(circle.containsWorldPoint(100, 200)).toBe(true); // center
    expect(circle.containsWorldPoint(110, 200)).toBe(true); // dist 10 <= 15
    expect(circle.containsWorldPoint(120, 200)).toBe(false); // dist 20 > 15

    // No collision sweep has run; moving the parent still updates the test
    // synchronously (epoch-invalidated bounds).
    parent.worldTransform = { x: 300, y: 300 };
    expect(circle.containsWorldPoint(300, 300)).toBe(true);
    expect(circle.containsWorldPoint(100, 200)).toBe(false);
  });

  test("rect: tests the world bounds box", () => {
    const engine = createEngine();
    const parent = new BaseObject(engine);
    parent.worldTransform = { x: 100, y: 200 };
    const rect = new RectCollider(engine, parent, 10, 20, 30, 40);
    parent.addCollider(rect);
    // World box: left 110, top 220, right 140, bottom 260.
    expect(rect.containsWorldPoint(120, 240)).toBe(true);
    expect(rect.containsWorldPoint(110, 220)).toBe(true); // corner inclusive
    expect(rect.containsWorldPoint(200, 240)).toBe(false);
    expect(rect.containsWorldPoint(120, 300)).toBe(false);
  });
});
