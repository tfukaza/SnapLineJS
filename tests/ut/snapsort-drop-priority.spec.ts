import { expect, test } from "@playwright/test";
import { type Rect } from "../../src/geometry";
import {
  determineDropTarget,
  determineInsertionDropTarget,
  determineProgressiveDropTarget,
  determineSwapDropTarget,
} from "../../assets/snapsort/src/algorithm";
import { BaseObject } from "../../src/object";
import {
  prioritizeIntersectingContainer,
  prioritizeNearestContainerEdge,
  prioritizePointerContainer,
  prioritizeTreeDepth,
  rejectDrop,
} from "../../assets/snapsort/src/callbacks";
import {
  DROP_REJECT_PRIORITY,
  type DropPriorityEvent,
} from "../../assets/snapsort/src/events";
import {
  dropPriorityFixture,
  itemSnapshot,
  layoutBox,
  mockSnapSortContainer,
  mockSnapSortItem,
} from "../helpers/snapsort-fixtures";

test.describe("standard SnapSort drop callbacks", () => {
  const event = {
    pointer: { x: 15, y: 25 },
    dragRect: { x: 5, y: 5, width: 10, height: 10 },
    containerRect: { x: 10, y: 20, width: 30, height: 40 },
  } as DropPriorityEvent;

  test("pointer and drag intersection priorities share core collision semantics", () => {
    expect(prioritizePointerContainer(event)).toBe(1);
    expect(
      prioritizePointerContainer({
        ...event,
        pointer: { x: 9, y: 25 },
      }),
    ).toBeUndefined();
    expect(prioritizeIntersectingContainer(event)).toBeUndefined();
    expect(
      prioritizeIntersectingContainer({
        ...event,
        dragRect: { x: 5, y: 25, width: 10, height: 10 },
      }),
    ).toBe(1);
    expect(
      prioritizeIntersectingContainer({
        ...event,
        dragRect: { x: 0, y: 20, width: 10, height: 10 },
      }),
    ).toBeUndefined();
  });

  test("nearest-container scoring and unconditional rejection are reusable", () => {
    expect(prioritizeNearestContainerEdge(event)).toBe(1);
    expect(
      prioritizeNearestContainerEdge({
        ...event,
        pointer: { x: 7, y: 16 },
      }),
    ).toBeCloseTo(1 / 6);
    expect(
      prioritizeNearestContainerEdge({
        ...event,
        pointer: { x: 4, y: 12 },
      }),
    ).toBeLessThan(1 / 6);
    expect(DROP_REJECT_PRIORITY).toBe(-1);
    expect(rejectDrop({} as DropPriorityEvent)).toBe(DROP_REJECT_PRIORITY);
  });

  test("tree depth uses the virtual leading x edge and pointer y", () => {
    const treeEvent = {
      ...event,
      staticPriority: 0,
      depth: 3,
      containerRect: { x: 10, y: 20, width: 30, height: 40 },
      dragRect: { x: 10, y: 0, width: 80, height: 10 },
      pointer: { x: 100, y: 20 },
    } as DropPriorityEvent;

    expect(prioritizeTreeDepth(treeEvent)).toBe(4);
    expect(
      prioritizeTreeDepth({
        ...treeEvent,
        dragRect: { ...treeEvent.dragRect, x: 40 },
        pointer: { x: 0, y: 60 },
      }),
    ).toBe(4);
    expect(
      prioritizeTreeDepth({
        ...treeEvent,
        dragRect: { ...treeEvent.dragRect, x: 9 },
        pointer: { x: 15, y: 25 },
      }),
    ).toBe(0);
    expect(
      prioritizeTreeDepth({
        ...treeEvent,
        pointer: { x: 15, y: 61 },
      }),
    ).toBe(0);
  });
});

test("drop priority filters containers before each placement mode ranks slots", () => {
  const { dragged, near, far, root } = dropPriorityFixture();

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
  far.dropPriority = 1;

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(far);
  expect(
    determineProgressiveDropTarget(dragged as any, root as any)?.container,
  ).toBe(far);
  expect(
    determineInsertionDropTarget(dragged as any, root as any)?.container,
  ).toBe(far);

  far.callbacks = { getDropPriority: rejectDrop };
  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
  expect(
    determineProgressiveDropTarget(dragged as any, root as any)?.container,
  ).toBe(near);
  expect(
    determineInsertionDropTarget(dragged as any, root as any)?.container,
  ).toBe(near);
});

test("Euclidean priority resolves mismatched zones before ranking their slots", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 300,
    y: 170,
    width: 20,
    height: 20,
  });
  const largeZone = mockSnapSortContainer(
    "large-zone",
    { x: 0, y: 0, width: 400, height: 200 },
    [],
    "row",
  );
  const smallZone = mockSnapSortContainer(
    "small-zone",
    { x: 0, y: 200, width: 400, height: 40 },
    [],
    "column",
  );
  const root = mockSnapSortContainer(
    "root",
    { x: 0, y: 0, width: 400, height: 240 },
    [largeZone, smallZone],
    "column",
  );
  root.callbacks = { getDropPriority: rejectDrop };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    smallZone,
  );

  smallZone.callbacks = {
    getDropPriority: prioritizeIntersectingContainer,
  };
  largeZone.callbacks = {
    getDropPriority: prioritizeIntersectingContainer,
  };
  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    largeZone,
  );
});

test("priority -1 rejects a container", () => {
  const { dragged, near, far, root } = dropPriorityFixture();
  let priorityCalls = 0;
  far.dropPriority = 100;
  far.callbacks = {
    getDropPriority: (event) => {
      priorityCalls++;
      return rejectDrop(event);
    },
  };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
  expect(priorityCalls).toBe(1);
});

test("priority -1 can reject every destination and be overridden dynamically", () => {
  const { dragged, near, far, root } = dropPriorityFixture();
  near.dropPriority = DROP_REJECT_PRIORITY;
  far.dropPriority = DROP_REJECT_PRIORITY;

  expect(determineDropTarget(dragged as any, root as any)).toBeNull();

  near.callbacks = { getDropPriority: () => 0 };
  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
});

test("drop priority runs once for a container with multiple candidate slots", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 10,
    y: 10,
    width: 20,
    height: 20,
  });
  const first = mockSnapSortItem("first", {
    x: 0,
    y: 0,
    width: 100,
    height: 20,
  });
  const second = mockSnapSortItem("second", {
    x: 0,
    y: 20,
    width: 100,
    height: 20,
  });
  const target = mockSnapSortContainer(
    "target",
    { x: 0, y: 0, width: 100, height: 60 },
    [first, second],
    "column",
  );
  const root = mockSnapSortContainer(
    "root",
    { x: 0, y: 0, width: 100, height: 60 },
    [target],
    "column",
  );
  root.callbacks = { getDropPriority: rejectDrop };

  let priorityCalls = 0;
  target.callbacks = {
    getDropPriority: () => {
      priorityCalls++;
      return undefined;
    },
  };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    target,
  );
  expect(priorityCalls).toBe(1);
});

test("priority supports rejection, fallback, and nonnegative overrides", () => {
  const { dragged, near, far, root } = dropPriorityFixture();
  near.dropPriority = DROP_REJECT_PRIORITY;
  far.dropPriority = 0.5;
  near.callbacks = { getDropPriority: () => undefined };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(far);

  near.callbacks = { getDropPriority: () => 0.75 };
  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
});

test("drop policy events expose source, destination, metadata, and geometry", () => {
  const { dragged, source, near, far, root } = dropPriorityFixture();
  dragged.metadata = { kind: "card" };
  source.metadata = { dropGroup: "cards" };
  near.metadata = { dropGroup: "cards" };
  let priorityEvent: DropPriorityEvent | null = null;
  near.callbacks = {
    getDropPriority: (event) => {
      priorityEvent = event;
      return undefined;
    },
  };
  far.callbacks = { getDropPriority: rejectDrop };

  determineDropTarget(dragged as any, root as any);

  expect(priorityEvent).toMatchObject({
    itemId: "dragged",
    itemMetadata: { kind: "card" },
    source: {
      container: source,
      containerMetadata: { dropGroup: "cards" },
      index: 0,
    },
    sources: [
      {
        container: source,
        containerMetadata: { dropGroup: "cards" },
        index: 0,
      },
    ],
    container: near,
    containerMetadata: { dropGroup: "cards" },
    index: 0,
  });
  expect(priorityEvent).toMatchObject({
    staticPriority: 0,
    pointer: { x: 20, y: 20 },
    dragRect: { x: 10, y: 10, width: 20, height: 20 },
    containerRect: { x: 0, y: 0, width: 100, height: 50 },
    containerContentRect: { x: 0, y: 0, width: 100, height: 50 },
    depth: 1,
  });
});

test("applications can replace grouping with source and destination metadata", () => {
  const { dragged, source, near, far, root } = dropPriorityFixture();
  source.metadata = { dropGroup: "cards" };
  near.metadata = { dropGroup: "cards" };
  far.metadata = { dropGroup: "files" };
  far.dropPriority = 10;
  const prioritizeMatchingGroup = (event: DropPriorityEvent) =>
    event.source?.containerMetadata.dropGroup ===
    event.containerMetadata.dropGroup
      ? undefined
      : rejectDrop(event);
  near.callbacks = { getDropPriority: prioritizeMatchingGroup };
  far.callbacks = { getDropPriority: prioritizeMatchingGroup };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
});

test("drop policy events preserve every source in a multi-item drag", () => {
  const { dragged, source, near, far, root } = dropPriorityFixture();
  const companion = mockSnapSortItem("companion", {
    x: -80,
    y: 20,
    width: 20,
    height: 20,
  });
  const companionSource = mockSnapSortContainer(
    "companion-source",
    { x: -100, y: 0, width: 50, height: 50 },
    [companion],
    "column",
  );
  dragged.metadata = { order: 1 };
  companion.metadata = { order: 2 };
  source.metadata = { dropGroup: "cards" };
  companionSource.metadata = { dropGroup: "cards" };
  let event: DropPriorityEvent | null = null;
  near.callbacks = {
    getDropPriority: (nextEvent) => {
      event = nextEvent;
      return undefined;
    },
  };
  far.callbacks = { getDropPriority: rejectDrop };
  const session = {
    items: [dragged, companion],
    sources: [
      {
        container: source,
        containerMetadata: source.metadata,
        index: 0,
      },
      {
        container: companionSource,
        containerMetadata: companionSource.metadata,
        index: 0,
      },
    ],
    activeSources: [
      {
        container: source,
        containerMetadata: source.metadata,
        index: 0,
      },
      {
        container: companionSource,
        containerMetadata: companionSource.metadata,
        index: 0,
      },
    ],
    itemSet: new Set([dragged, companion]),
    snapshotItemSet: new Set([dragged, companion]),
    pointer: { x: 20, y: 20 },
  };

  determineInsertionDropTarget(dragged as any, root as any, session as any);

  expect(event?.items.map((item) => item.itemId)).toEqual([
    "dragged",
    "companion",
  ]);
  expect(event?.itemsMetadata).toEqual([{ order: 1 }, { order: 2 }]);
  expect(event?.source?.container).toBe(source);
  expect(event?.sources.map((location) => location?.container)).toEqual([
    source,
    companionSource,
  ]);
});

test("drop priority rejects malformed configured and callback values", () => {
  const configured = dropPriorityFixture();
  configured.far.dropPriority = Number.POSITIVE_INFINITY;
  expect(() =>
    determineDropTarget(configured.dragged as any, configured.root as any),
  ).toThrow(/dropPriority must be -1 or a finite nonnegative number/);

  for (const value of [-2, -0.5, Number.NEGATIVE_INFINITY, "1", null, {}]) {
    const malformed = dropPriorityFixture();
    malformed.far.dropPriority = value as never;
    expect(() =>
      determineDropTarget(malformed.dragged as any, malformed.root as any),
    ).toThrow(/dropPriority must be -1 or a finite nonnegative number/);
  }

  for (const value of [
    -2,
    -0.5,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NaN,
    "1",
    null,
    {},
  ]) {
    const callback = dropPriorityFixture();
    callback.far.callbacks = { getDropPriority: () => value as never };
    expect(() =>
      determineDropTarget(callback.dragged as any, callback.root as any),
    ).toThrow(/getDropPriority must be -1 or a finite nonnegative number/);
  }
});

test("a container priority does not propagate to nested containers", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 10,
    y: 10,
    width: 20,
    height: 20,
  });
  const child = mockSnapSortContainer(
    "child",
    { x: 0, y: 0, width: 50, height: 50 },
    [],
    "column",
  );
  const parent = mockSnapSortContainer(
    "parent",
    { x: 0, y: 0, width: 100, height: 100 },
    [child],
    "column",
  );
  const root = mockSnapSortContainer(
    "root",
    { x: 0, y: 0, width: 100, height: 100 },
    [parent],
    "column",
  );
  root.callbacks = { getDropPriority: rejectDrop };
  parent.dropPriority = 1;
  let childStaticPriority: number | null = null;
  child.callbacks = {
    getDropPriority: (event) => {
      childStaticPriority = event.staticPriority;
      return undefined;
    },
  };

  const target = determineDropTarget(dragged as any, root as any);
  expect(childStaticPriority).toBe(0);
  expect(target?.container).toBe(parent);
});

test("swap collects every hovered container before applying priority", () => {
  let nextId = 0;
  const engine = {
    global: {
      data: {},
      queue: {},
      createId: () => `swap-priority-${++nextId}`,
      registerObject: () => {},
      unregisterObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
    collisionEngine: null,
    animationList: [],
  };
  const makeItem = (
    itemId: string,
    rect: Rect,
    children: BaseObject[] = [],
    container = false,
  ) => {
    const item = new BaseObject(engine as never) as BaseObject &
      Record<string, any>;
    const box = layoutBox(rect);
    item.itemId = itemId;
    item.metadata = {};
    item.direction = "column";
    item.mainAxisAlign = "start";
    item.locked = false;
    item.isGhost = false;
    item.itemOrderedList = children;
    item.children = children;
    item.box = box;
    item.depth = 0;
    item.callbacks = undefined;
    item.dropPriority = 0;
    item.worldTransform = { x: rect.x, y: rect.y };
    Object.defineProperties(item, {
      dragPositionX: { get: () => item.worldTransform.x },
      dragPositionY: { get: () => item.worldTransform.y },
      dragPointerPosition: { get: () => null },
    });
    if (container) {
      item.config = {};
      item.name = itemId;
      item.numberOfItems = children.length;
    }
    item.dragSnapshot = itemSnapshot(
      item,
      box,
      children.map((child) => (child as any).dragSnapshot),
      "column",
    );
    return item;
  };

  const smallTarget = makeItem("small-target", {
    x: 0,
    y: 0,
    width: 20,
    height: 20,
  });
  const largeTarget = makeItem("large-target", {
    x: 0,
    y: 0,
    width: 60,
    height: 60,
  });
  const smallContainer = makeItem(
    "small-container",
    { x: 0, y: 0, width: 50, height: 50 },
    [smallTarget],
    true,
  );
  const preferredContainer = makeItem(
    "preferred-container",
    { x: 0, y: 0, width: 100, height: 100 },
    [largeTarget],
    true,
  );
  smallContainer.depth = 1;
  preferredContainer.depth = 1;
  preferredContainer.dropPriority = 1;
  let smallHitboxOwner: unknown = null;
  let preferredHitboxOwner: unknown = null;
  smallContainer.callbacks = {
    getItemHitbox: (event: any) => {
      smallHitboxOwner = event.container;
      return {
        shape: "rect",
        rect: { x: 80, y: 80, width: 10, height: 10 },
      };
    },
  };
  preferredContainer.callbacks = {
    getItemHitbox: (event: any) => {
      preferredHitboxOwner = event.container;
      return {
        shape: "circle",
        circle: { x: 10, y: 10, radius: 8 },
      };
    },
  };
  const root = makeItem(
    "root",
    { x: 0, y: 0, width: 120, height: 120 },
    [smallContainer, preferredContainer],
    true,
  );
  root.callbacks = { getDropPriority: rejectDrop };
  const dragged = makeItem("dragged", {
    x: 150,
    y: 150,
    width: 20,
    height: 20,
  });
  const session = {
    items: [dragged],
    sources: [null],
    itemSet: new Set([dragged]),
    pointer: { x: 10, y: 10 },
  };

  const target = determineSwapDropTarget(
    dragged as never,
    root as never,
    session as never,
  );
  expect(target?.container).toBe(preferredContainer);
  expect(target?.index).toBe(0);
  expect(smallHitboxOwner).toBe(smallContainer);
  expect(preferredHitboxOwner).toBe(preferredContainer);

  preferredContainer.callbacks = {
    ...preferredContainer.callbacks,
    getDropPriority: rejectDrop,
  };
  expect(
    determineSwapDropTarget(dragged as never, root as never, session as never),
  ).toBeNull();

  preferredContainer.callbacks = {
    getItemHitbox: () => ({
      shape: "rect",
      rect: { x: 0, y: 0, width: Number.NaN, height: 10 },
    }),
  };
  expect(() =>
    determineSwapDropTarget(dragged as never, root as never, session as never),
  ).toThrow(/getItemHitbox/);
});
