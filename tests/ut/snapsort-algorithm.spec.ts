import { expect, test } from "@playwright/test";
import {
  determineDropTarget,
  determineInsertionDropTarget,
  findHoveredItem,
  type ResolvedDropTarget,
  virtualLayoutRecursive,
} from "../../assets/snapsort/src/algorithm";
import type { InsertionMarkerPresentation } from "../../assets/snapsort/src/events";
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
    direction?: "row" | "column";
    wrap?: "auto" | "nowrap";
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
    itemId: id,
    metadata: {},
    mainAxisAlign: "start",
    locked: options.locked ?? false,
    isGhost: false,
    parent: null,
    callbacks: undefined,
    dropPriority: 0,
    currentDomProperty: box,
    itemOrderedList: children,
    children,
    direction: options.direction ?? "column",
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
    itemId: id,
    metadata: {},
    direction: options.direction ?? "column",
    mainAxisAlign: "start",
    layoutModel: "flow",
    wrap: options.wrap ?? "auto",
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

interface MockDragLocation {
  container: MockItem;
  containerMetadata: Record<string, unknown>;
  index: number;
}

interface MockInsertionSession {
  items: MockItem[];
  sources: MockDragLocation[];
  activeSources: MockDragLocation[];
  itemSet: Set<MockItem>;
  snapshotItemSet: Set<MockItem>;
  pointer: { x: number; y: number };
}

function mockDragLocation(
  container: MockItem,
  index: number,
): MockDragLocation {
  return { container, containerMetadata: container.metadata, index };
}

function mockInsertionSession(
  items: MockItem[],
  sources: MockDragLocation[],
  pointer: { x: number; y: number },
  snapshotItems: MockItem[] = items,
): MockInsertionSession {
  return {
    items,
    sources,
    activeSources: sources,
    itemSet: new Set(items),
    snapshotItemSet: new Set(snapshotItems),
    pointer,
  };
}

function resolveMockInsertionTarget(
  dragged: MockItem,
  root: MockItem,
  session: MockInsertionSession | null = null,
): ResolvedDropTarget | null {
  // @ts-expect-error The fixture implements the resolver surface without Item's private fields.
  return determineInsertionDropTarget(dragged, root, session);
}

function requireInsertionTarget(
  target: ResolvedDropTarget | null,
): ResolvedDropTarget & { insertion: InsertionMarkerPresentation } {
  if (!target?.insertion) {
    throw new Error("Expected an insertion-marker drop target.");
  }
  return target;
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
    visits.set(snapshot.itemId, (visits.get(snapshot.itemId) ?? 0) + 1);
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

test("insertion keeps both outer edges of the current item on one logical target", () => {
  const a = mockItem("a", { x: 0, y: 0, width: 120, height: 40 });
  const dragged = mockItem("dragged", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const b = mockItem("b", { x: 0, y: 96, width: 120, height: 40 });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 136 },
    { children: [a, dragged, b], container: true },
  );
  const session = mockInsertionSession([dragged], [mockDragLocation(root, 1)], {
    x: 60,
    y: 60,
  });

  const leading = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(leading).toMatchObject({
    container: root,
    index: 2,
    insertion: {
      gap: { orientation: "horizontal", x: 0, y: 44, length: 120 },
      previous: { item: a, itemId: "a" },
      next: { item: dragged, itemId: "dragged" },
      isCurrentPlacement: true,
    },
  });
  expect(Object.isFrozen(leading.insertion)).toBe(true);
  expect(Object.isFrozen(leading.insertion.gap)).toBe(true);
  expect(Object.isFrozen(leading.insertion.previous)).toBe(true);
  expect(Object.isFrozen(leading.insertion.previous?.rect)).toBe(true);

  session.pointer = { x: 60, y: 76 };
  const trailing = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(trailing).toMatchObject({
    container: root,
    index: 2,
    insertion: {
      gap: { orientation: "horizontal", x: 0, y: 92, length: 120 },
      previous: { item: dragged, itemId: "dragged" },
      next: { item: b, itemId: "b" },
      isCurrentPlacement: true,
    },
  });

  session.pointer = { x: 60, y: 68 };
  const exactMidpoint = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(exactMidpoint.index).toBe(2);
  expect(exactMidpoint.insertion.gap.y).toBe(44);
});

test("row insertion keeps both outer edges of the current item on one logical target", () => {
  const a = mockItem("a", { x: 0, y: 0, width: 40, height: 40 });
  const dragged = mockItem("dragged", {
    x: 48,
    y: 0,
    width: 40,
    height: 40,
  });
  const b = mockItem("b", { x: 96, y: 0, width: 40, height: 40 });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 136, height: 40 },
    {
      children: [a, dragged, b],
      container: true,
      direction: "row",
      wrap: "nowrap",
    },
  );
  const session = mockInsertionSession([dragged], [mockDragLocation(root, 1)], {
    x: 60,
    y: 20,
  });

  const leading = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(leading).toMatchObject({
    container: root,
    index: 2,
    insertion: {
      gap: { orientation: "vertical", x: 44, y: 0, length: 40 },
      previous: { item: a },
      next: { item: dragged },
      isCurrentPlacement: true,
    },
  });

  session.pointer = { x: 76, y: 20 };
  const trailing = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(trailing).toMatchObject({
    container: root,
    index: 2,
    insertion: {
      gap: { orientation: "vertical", x: 92, y: 0, length: 40 },
      previous: { item: dragged },
      next: { item: b },
      isCurrentPlacement: true,
    },
  });
});

test("a one-item handoff retains both origin outer edges on one current target", () => {
  const a = mockItem("a", { x: 0, y: 0, width: 120, height: 40 });
  const original = mockItem("dragged", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const b = mockItem("b", { x: 0, y: 96, width: 120, height: 40 });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 136 },
    { children: [a, original, b], container: true },
  );
  const replacement = mockItem("dragged", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  replacement.parent = root;
  replacement.depth = 1;
  root.children = [a, replacement, b];
  root.itemOrderedList = root.children;
  const session = mockInsertionSession(
    [replacement],
    [mockDragLocation(root, 1)],
    { x: 60, y: 60 },
    [original],
  );

  const leading = requireInsertionTarget(
    resolveMockInsertionTarget(replacement, root, session),
  );
  expect(leading).toMatchObject({
    index: 2,
    insertion: {
      gap: { orientation: "horizontal", x: 0, y: 44, length: 120 },
      isCurrentPlacement: true,
    },
  });

  session.pointer = { x: 60, y: 76 };
  const trailing = requireInsertionTarget(
    resolveMockInsertionTarget(replacement, root, session),
  );
  expect(trailing).toMatchObject({
    index: 2,
    insertion: {
      gap: { orientation: "horizontal", x: 0, y: 92, length: 120 },
      isCurrentPlacement: true,
    },
  });
});

test("a contiguous handoff suppresses the internal origin-to-origin gap", () => {
  const a = mockItem("a", { x: 0, y: 0, width: 120, height: 40 });
  const originalB = mockItem("b", { x: 0, y: 48, width: 120, height: 40 });
  const originalC = mockItem("c", { x: 0, y: 96, width: 120, height: 40 });
  const d = mockItem("d", { x: 0, y: 144, width: 120, height: 40 });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 184 },
    { children: [a, originalB, originalC, d], container: true },
  );
  const replacementB = mockItem("b", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const replacementC = mockItem("c", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  replacementB.parent = root;
  replacementC.parent = root;
  replacementB.depth = 1;
  replacementC.depth = 1;
  root.children = [a, replacementB, replacementC, d];
  root.itemOrderedList = root.children;
  const session = mockInsertionSession(
    [replacementB, replacementC],
    [mockDragLocation(root, 1), mockDragLocation(root, 2)],
    { x: 60, y: 92 },
    [originalB, originalC],
  );

  const tiedOuterEdges = requireInsertionTarget(
    resolveMockInsertionTarget(replacementB, root, session),
  );
  expect(tiedOuterEdges.index).toBe(3);
  expect(tiedOuterEdges.insertion.gap).toEqual({
    orientation: "horizontal",
    x: 0,
    y: 44,
    length: 120,
  });
  expect(tiedOuterEdges.insertion.gap.y).not.toBe(92);
  expect(tiedOuterEdges.insertion.isCurrentPlacement).toBe(true);
});

test("insertion exposes only the two outer edges of a contiguous selected run", () => {
  const a = mockItem("a", { x: 0, y: 0, width: 120, height: 40 });
  const b = mockItem("b", { x: 0, y: 48, width: 120, height: 40 });
  const c = mockItem("c", { x: 0, y: 96, width: 120, height: 40 });
  const d = mockItem("d", { x: 0, y: 144, width: 120, height: 40 });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 184 },
    { children: [a, b, c, d], container: true },
  );
  const session = mockInsertionSession(
    [b, c],
    [mockDragLocation(root, 1), mockDragLocation(root, 2)],
    { x: 60, y: 60 },
  );

  const leading = requireInsertionTarget(
    resolveMockInsertionTarget(b, root, session),
  );
  expect(leading.index).toBe(3);
  expect(leading.insertion.gap.y).toBe(44);
  expect(leading.insertion.isCurrentPlacement).toBe(true);

  session.pointer = { x: 60, y: 124 };
  const trailing = requireInsertionTarget(
    resolveMockInsertionTarget(b, root, session),
  );
  expect(trailing.index).toBe(3);
  expect(trailing.insertion.gap.y).toBe(140);
  expect(trailing.insertion.isCurrentPlacement).toBe(true);

  session.pointer = { x: 60, y: 92 };
  const tiedOuterEdges = requireInsertionTarget(
    resolveMockInsertionTarget(b, root, session),
  );
  expect(tiedOuterEdges.index).toBe(3);
  expect(tiedOuterEdges.insertion.gap.y).toBe(44);
  expect(tiedOuterEdges.insertion.gap.y).not.toBe(92);
});

test("insertion reports disjoint selected items as a real placement change", () => {
  const a = mockItem("a", { x: 0, y: 0, width: 120, height: 40 });
  const b = mockItem("b", { x: 0, y: 48, width: 120, height: 40 });
  const c = mockItem("c", { x: 0, y: 96, width: 120, height: 40 });
  const d = mockItem("d", { x: 0, y: 144, width: 120, height: 40 });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 120, height: 184 },
    { children: [a, b, c, d], container: true },
  );
  const session = mockInsertionSession(
    [b, d],
    [mockDragLocation(root, 1), mockDragLocation(root, 3)],
    { x: 60, y: 60 },
  );

  const target = requireInsertionTarget(
    resolveMockInsertionTarget(b, root, session),
  );
  expect(target.index).toBe(2);
  expect(target.insertion.gap.y).toBe(44);
  expect(target.insertion.isCurrentPlacement).toBe(false);
});

test("insertion ranks nested and parent gaps strictly by gap-center distance", () => {
  const dragged = mockItem("dragged", {
    x: -40,
    y: 90,
    width: 20,
    height: 20,
  });
  const source = mockItem(
    "source",
    { x: -50, y: 80, width: 30, height: 40 },
    { children: [dragged], container: true },
  );
  const previous = mockItem("previous", {
    x: 0,
    y: 80,
    width: 300,
    height: 40,
  });
  const nested = mockItem(
    "nested",
    { x: 80, y: 80, width: 120, height: 40 },
    { children: [], container: true },
  );
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 300, height: 200 },
    { children: [previous, nested], container: true },
  );
  const session = mockInsertionSession(
    [dragged],
    [mockDragLocation(source, 0)],
    { x: 141, y: 100 },
  );

  const nestedTarget = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(nestedTarget.container).toBe(nested);
  expect(nestedTarget.insertion.gap).toEqual({
    orientation: "horizontal",
    x: 80,
    y: 100,
    length: 120,
  });

  session.pointer = { x: 147, y: 100 };
  const parentTarget = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(parentTarget.container).toBe(root);
  expect(parentTarget.index).toBe(1);
  expect(parentTarget.insertion.gap).toEqual({
    orientation: "horizontal",
    x: 0,
    y: 100,
    length: 300,
  });
});

test("identical insertion centers use adjacent item geometry as the tie-breaker", () => {
  const dragged = mockItem("dragged", {
    x: -40,
    y: 90,
    width: 20,
    height: 20,
  });
  const source = mockItem(
    "source",
    { x: -50, y: 80, width: 30, height: 40 },
    { children: [dragged], container: true },
  );
  const nearPrevious = mockItem("near-previous", {
    x: 100,
    y: 90,
    width: 100,
    height: 6,
  });
  const nearNext = mockItem("near-next", {
    x: 100,
    y: 104,
    width: 100,
    height: 6,
  });
  const nested = mockItem(
    "nested",
    { x: 100, y: 80, width: 100, height: 40 },
    { children: [nearPrevious, nearNext], container: true },
  );
  const farPrevious = mockItem("far-previous", {
    x: 0,
    y: 0,
    width: 300,
    height: 40,
  });
  const farNext = mockItem("far-next", {
    x: 0,
    y: 160,
    width: 300,
    height: 40,
  });
  const root = mockItem(
    "root",
    { x: 0, y: 0, width: 300, height: 200 },
    { children: [farPrevious, farNext, nested], container: true },
  );
  const session = mockInsertionSession(
    [dragged],
    [mockDragLocation(source, 0)],
    { x: 150, y: 100 },
  );

  const target = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, root, session),
  );
  expect(target.container).toBe(nested);
  expect(target.index).toBe(1);
  expect(target.insertion.gap).toEqual({
    orientation: "horizontal",
    x: 100,
    y: 100,
    length: 100,
  });
  expect(target.insertion.previous?.item).toBe(nearPrevious);
  expect(target.insertion.next?.item).toBe(nearNext);
});

test("empty rows expose one centered vertical insertion gap", () => {
  const dragged = mockItem("dragged", {
    x: -30,
    y: 50,
    width: 20,
    height: 20,
  });
  const source = mockItem(
    "source",
    { x: -40, y: 40, width: 30, height: 40 },
    { children: [dragged], container: true },
  );
  const row = mockItem(
    "row",
    { x: 10, y: 20, width: 200, height: 80 },
    { children: [], container: true, direction: "row" },
  );
  const session = mockInsertionSession(
    [dragged],
    [mockDragLocation(source, 0)],
    { x: 110, y: 60 },
  );

  const target = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, row, session),
  );
  expect(target.index).toBe(0);
  expect(target.insertion).toMatchObject({
    gap: { orientation: "vertical", x: 110, y: 20, length: 80 },
    previous: null,
    next: null,
    isCurrentPlacement: false,
  });
});

test("single-line auto rows use the measured band while nowrap uses full content", () => {
  const resolve = (wrap: "auto" | "nowrap") => {
    const dragged = mockItem("dragged", {
      x: -30,
      y: 40,
      width: 20,
      height: 20,
    });
    const source = mockItem(
      `source-${wrap}`,
      { x: -40, y: 30, width: 30, height: 40 },
      { children: [dragged], container: true },
    );
    const a = mockItem(`a-${wrap}`, {
      x: 0,
      y: 30,
      width: 40,
      height: 40,
    });
    const b = mockItem(`b-${wrap}`, {
      x: 48,
      y: 30,
      width: 40,
      height: 40,
    });
    const c = mockItem(`c-${wrap}`, {
      x: 96,
      y: 30,
      width: 40,
      height: 40,
    });
    const row = mockItem(
      `row-${wrap}`,
      { x: 0, y: 0, width: 136, height: 100 },
      {
        children: [a, b, c],
        container: true,
        direction: "row",
        wrap,
      },
    );
    const session = mockInsertionSession(
      [dragged],
      [mockDragLocation(source, 0)],
      { x: 44, y: 50 },
    );
    return requireInsertionTarget(
      resolveMockInsertionTarget(dragged, row, session),
    );
  };

  const auto = resolve("auto");
  expect(auto.index).toBe(1);
  expect(auto.insertion.gap).toEqual({
    orientation: "vertical",
    x: 44,
    y: 30,
    length: 40,
  });

  const nowrap = resolve("nowrap");
  expect(nowrap.index).toBe(1);
  expect(nowrap.insertion.gap).toEqual({
    orientation: "vertical",
    x: 44,
    y: 0,
    length: 100,
  });
});

test("wrapped-row insertion gaps use the selected visual line's measured band", () => {
  const dragged = mockItem("dragged", {
    x: -30,
    y: 58,
    width: 20,
    height: 20,
  });
  const source = mockItem(
    "source",
    { x: -40, y: 48, width: 30, height: 40 },
    { children: [dragged], container: true },
  );
  const a = mockItem("a", { x: 0, y: 0, width: 60, height: 40 });
  const b = mockItem("b", { x: 80, y: 0, width: 60, height: 40 });
  const c = mockItem("c", { x: 0, y: 48, width: 60, height: 40 });
  const d = mockItem("d", { x: 80, y: 48, width: 60, height: 40 });
  const row = mockItem(
    "row",
    { x: 0, y: 0, width: 160, height: 96 },
    {
      children: [a, b, c, d],
      container: true,
      direction: "row",
      wrap: "auto",
    },
  );
  const session = mockInsertionSession(
    [dragged],
    [mockDragLocation(source, 0)],
    { x: 70, y: 68 },
  );

  const target = requireInsertionTarget(
    resolveMockInsertionTarget(dragged, row, session),
  );
  expect(target.index).toBe(3);
  expect(target.insertion.gap).toEqual({
    orientation: "vertical",
    x: 70,
    y: 48,
    length: 40,
  });
  expect(target.insertion.previous?.item).toBe(c);
  expect(target.insertion.next?.item).toBe(d);
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
