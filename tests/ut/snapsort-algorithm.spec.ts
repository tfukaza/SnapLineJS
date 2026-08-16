import { expect, test } from "@playwright/test";
import {
  determineDropTarget,
  findHoveredItem,
  virtualLayoutRecursive,
} from "../../assets/snapsort/src/algorithm";
import type { ItemSnapshot } from "../../assets/snapsort/src/snapshot";
import { makeBox } from "../helpers/layout-grid";

type Rect = { x: number; y: number; width: number; height: number };
type MockItem = Record<string, any>;

function mockItem(
  id: string,
  rect: Rect,
  options: {
    children?: MockItem[];
    container?: boolean;
    locked?: boolean;
    engine?: Record<string, unknown>;
  } = {},
): MockItem {
  const children = options.children ?? [];
  const box = makeBox(rect);
  const counters = {
    addDebugCircle: 0,
    addDebugLine: 0,
    addDebugRect: 0,
    addDebugText: 0,
    clearDebugMarker: 0,
  };
  const item: MockItem = {
    id,
    resolvedItemId: id,
    metadata: {},
    direction: "column",
    mainAxisAlign: "start",
    locked: options.locked ?? false,
    isGhost: false,
    parent: null,
    callbacks: undefined,
    dropPriority: 0,
    currentDomProperty: box,
    itemOrderedList: children,
    children,
    worldTransform: { x: rect.x, y: rect.y, scaleX: 1, scaleY: 1 },
    dragPositionX: rect.x,
    dragPositionY: rect.y,
    dragPointerPosition: null,
    depth: 0,
    engine: options.engine ?? {},
    debugCounters: counters,
    addDebugCircle: () => counters.addDebugCircle++,
    addDebugLine: () => counters.addDebugLine++,
    addDebugRect: () => counters.addDebugRect++,
    addDebugText: () => counters.addDebugText++,
    clearDebugMarker: () => counters.clearDebugMarker++,
  };
  if (options.container) {
    item.config = {};
    item.name = id;
    item.numberOfItems = children.length;
  }
  item.getIndexAndContainer = () => ({
    container: item.parent,
    index: item.parent ? item.parent.itemOrderedList.indexOf(item) : -1,
  });
  item.dragSnapshot = {
    value: item,
    key: id,
    metadata: {},
    direction: "column",
    mainAxisAlign: "start",
    layoutModel: "flow",
    wrap: "auto",
    stretchItems: false,
    locked: item.locked,
    box,
    children: children.map(
      (child) => child.dragSnapshot as ItemSnapshot<MockItem>,
    ),
  } satisfies ItemSnapshot<MockItem>;
  for (const child of children) {
    child.parent = item;
    child.depth = item.depth + 1;
  }
  return item;
}

function flowTargets(
  root: MockItem,
  dragged: MockItem,
  onSnapshotVisit?: (snapshot: ItemSnapshot<MockItem>) => void,
) {
  return virtualLayoutRecursive(
    root as never,
    root.dragSnapshot.box.x,
    root.dragSnapshot.box.y,
    dragged as never,
    dragged.dragSnapshot.box.width,
    dragged.dragSnapshot.box.height,
    dragged.dragPositionX + dragged.dragSnapshot.box.width / 2,
    dragged.dragPositionY + dragged.dragSnapshot.box.height / 2,
    null,
    false,
    onSnapshotVisit ? { onSnapshotVisit } : undefined,
  ).candidates.map((candidate) => candidate.target);
}

test("flow candidates simulate each eligible flat gap exactly once", () => {
  const dragged = mockItem("dragged", { x: 20, y: 20, width: 20, height: 20 });
  const children = Array.from({ length: 4 }, (_, index) =>
    mockItem(`item-${index}`, {
      x: 0,
      y: index * 30,
      width: 100,
      height: 20,
    }),
  );
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 160 },
    { children, container: true },
  );

  const visits = new Map<string, number>();
  const targets = flowTargets(root, dragged, (snapshot) => {
    visits.set(snapshot.key, (visits.get(snapshot.key) ?? 0) + 1);
  }).filter((target) => target.container === root);
  expect(targets.map((target) => target.index)).toEqual([0, 1, 2, 3, 4]);
  expect(new Set(targets.map((target) => target.index)).size).toBe(5);
  expect([...visits.values()]).toEqual([1, 1, 1, 1, 1]);
});

test("flow gap eligibility preserves locked-neighbor and container rules", () => {
  const dragged = mockItem("dragged", { x: 10, y: 10, width: 10, height: 10 });
  const locked = mockItem(
    "locked",
    { x: 0, y: 0, width: 100, height: 20 },
    { locked: true },
  );
  const unlocked = mockItem("unlocked", {
    x: 0,
    y: 30,
    width: 100,
    height: 20,
  });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 80 },
    { children: [locked, unlocked], container: true },
  );
  expect(
    flowTargets(root, dragged)
      .filter((target) => target.container === root)
      .map((target) => target.index),
  ).toEqual([1, 2]);

  const lockedContainer = mockItem(
    "locked-container",
    { x: 0, y: 0, width: 100, height: 40 },
    { children: [], container: true, locked: true },
  );
  const containerRoot = mockItem(
    "container-root",
    { x: 0, y: 0, width: 120, height: 60 },
    { children: [lockedContainer], container: true },
  );
  expect(
    flowTargets(containerRoot, dragged)
      .filter((target) => target.container === containerRoot)
      .map((target) => target.index),
  ).toEqual([0, 1]);
});

test("drop resolution performs no debug work until a renderer is enabled", () => {
  const disabledEngine = { debugRenderer: null };
  const disabledChild = mockItem(
    "disabled-child",
    { x: 0, y: 0, width: 100, height: 20 },
    { engine: disabledEngine },
  );
  const disabledRoot = mockItem(
    "disabled-root",
    { x: 0, y: 0, width: 120, height: 60 },
    { children: [disabledChild], container: true, engine: disabledEngine },
  );
  const dragged = mockItem(
    "dragged",
    { x: 0, y: 30, width: 20, height: 20 },
    { engine: disabledEngine },
  );
  determineDropTarget(dragged as never, disabledRoot as never);
  expect(disabledRoot.debugCounters).toEqual({
    addDebugCircle: 0,
    addDebugLine: 0,
    addDebugRect: 0,
    addDebugText: 0,
    clearDebugMarker: 0,
  });
  expect(disabledChild.debugCounters.addDebugRect).toBe(0);

  const enabledEngine = { debugRenderer: {} };
  disabledRoot.engine = enabledEngine;
  disabledChild.engine = enabledEngine;
  dragged.engine = enabledEngine;
  determineDropTarget(dragged as never, disabledRoot as never);
  expect(disabledRoot.debugCounters.addDebugCircle).toBeGreaterThan(0);
  expect(disabledRoot.debugCounters.clearDebugMarker).toBeGreaterThan(0);
  expect(disabledChild.debugCounters.addDebugRect).toBeGreaterThan(0);
});

test("drop policy keeps one eligibility-then-priority callback per container", () => {
  const calls: string[] = [];
  let eligibilityEvent: MockItem | null = null;
  let priorityEvent: MockItem | null = null;
  const child = mockItem("child", { x: 0, y: 0, width: 100, height: 20 });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 60 },
    { children: [child], container: true },
  );
  root.callbacks = {
    canDrop: (event: MockItem) => {
      calls.push("canDrop");
      eligibilityEvent = event;
      return true;
    },
    getDropPriority: (event: MockItem) => {
      calls.push("getDropPriority");
      priorityEvent = event;
      return undefined;
    },
  };
  const dragged = mockItem("dragged", {
    x: 0,
    y: 30,
    width: 20,
    height: 20,
  });

  determineDropTarget(dragged as never, root as never);

  expect(calls).toEqual(["canDrop", "getDropPriority"]);
  expect(eligibilityEvent!.containerRect).toBe(priorityEvent!.containerRect);
  expect(eligibilityEvent!.containerContentRect).toBe(
    priorityEvent!.containerContentRect,
  );
  expect(Object.isFrozen(priorityEvent!.containerRect)).toBe(true);
  expect(Object.isFrozen(priorityEvent!.dragRect)).toBe(true);
});

test("hover rectangle and circle boundaries remain edge-inclusive", () => {
  const dragged = mockItem("dragged", { x: 30, y: 30, width: 10, height: 10 });
  const target = mockItem("target", { x: 0, y: 0, width: 10, height: 10 });
  const container = mockItem(
    "container",
    { x: 0, y: 0, width: 40, height: 40 },
    { children: [target], container: true },
  );
  const session: MockItem = {
    handle: {},
    itemSet: new Set([dragged]),
    pointer: { x: 10, y: 10 },
  };
  expect(
    findHoveredItem(dragged as never, container as never, session as never),
  ).toBe(target);
  session.pointer = { x: 10.001, y: 10 };
  expect(
    findHoveredItem(dragged as never, container as never, session as never),
  ).toBeNull();

  container.callbacks = {
    getItemHitbox: () => ({
      shape: "circle",
      center: { x: 5, y: 5 },
      radius: 5,
    }),
  };
  session.pointer = { x: 10, y: 5 };
  expect(
    findHoveredItem(dragged as never, container as never, session as never),
  ).toBe(target);
  session.pointer = { x: 10.001, y: 5 };
  expect(
    findHoveredItem(dragged as never, container as never, session as never),
  ).toBeNull();
});

test("hover overlap prefers the smallest area and keeps first-match ties", () => {
  const dragged = mockItem("dragged", { x: 50, y: 50, width: 10, height: 10 });
  const first = mockItem("first", { x: 0, y: 0, width: 20, height: 20 });
  const smaller = mockItem("smaller", { x: 5, y: 5, width: 5, height: 5 });
  const tied = mockItem("tied", { x: 5, y: 5, width: 5, height: 5 });
  const container = mockItem(
    "container",
    { x: 0, y: 0, width: 60, height: 60 },
    { children: [first, smaller, tied], container: true },
  );
  const session = {
    handle: {},
    itemSet: new Set([dragged]),
    pointer: { x: 7, y: 7 },
  };
  expect(
    findHoveredItem(dragged as never, container as never, session as never),
  ).toBe(smaller);
});
