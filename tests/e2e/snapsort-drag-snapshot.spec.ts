import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  contentBoxOrigin,
  flowLayoutPositions,
  virtualEntrySizeFor,
} from "../../assets/snapsort/src/layout";
import type { ItemSnapshot } from "../../assets/snapsort/src/snapshot";
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
  rejectDrop,
} from "../../assets/snapsort/src/callbacks";
import { Container as SnapSortContainer } from "../../assets/snapsort/src/container";
import type {
  CanDropEvent,
  DropPriorityEvent,
} from "../../assets/snapsort/src/events";
import {
  assertCanFireItemMove,
  assertCanFireItemSwap,
} from "../../assets/snapsort/src/mutation";
import {
  makeContainerSnapshot,
  makeItemSnapshot,
  rowCounts,
  simulatedRowCounts,
} from "../helpers/layout-grid";

type Rect = { x: number; y: number; width: number; height: number };

test("framework container ownership never inherits Vanilla DOM callbacks", () => {
  let nextId = 0;
  const engine = {
    global: {
      data: {},
      queue: {},
      createId: () => `ownership-test-${++nextId}`,
      registerObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
  };
  const onItemMove = () => {};

  const vanilla = new SnapSortContainer(engine, null);
  const framework = new SnapSortContainer(engine, null, {
    domOwnership: "framework",
    callbacks: { onItemMove },
  });
  const frameworkWithoutMutation = new SnapSortContainer(engine, null, {
    domOwnership: "framework",
  });

  expect(vanilla.callbacks?.onItemInsert).toBeDefined();
  expect(vanilla.callbacks?.onGhostInsert).toBeDefined();
  expect(framework.callbacks?.onItemMove).toBe(onItemMove);
  expect(framework.callbacks?.onItemInsert).toBeUndefined();
  expect(framework.callbacks?.onItemRemove).toBeUndefined();
  expect(framework.callbacks?.createGhost).toBeUndefined();
  expect(framework.callbacks?.onGhostInsert).toBeUndefined();
  expect(framework.callbacks?.onGhostRemove).toBeUndefined();
  expect(() => assertCanFireItemMove(frameworkWithoutMutation)).toThrow(
    /framework-owned container.*callbacks\.onItemMove/,
  );
  expect(() => assertCanFireItemSwap(framework)).toThrow(
    /framework-owned container.*callbacks\.onItemSwap/,
  );
  expect(() => assertCanFireItemSwap(vanilla)).not.toThrow();
});

test("visual geometry invalidations coalesce at the root container", async () => {
  let nextId = 0;
  const queue = {
    READ_1: new Map(),
    WRITE_1: new Map(),
    READ_2: new Map(),
    WRITE_2: new Map(),
    READ_3: new Map(),
    WRITE_3: new Map(),
  };
  const events: Array<{
    items: readonly unknown[];
    reasons: readonly string[];
  }> = [];
  const engine = {
    global: {
      data: {},
      queue,
      createId: () => `geometry-test-${++nextId}`,
      registerObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
  };
  const root = new SnapSortContainer(engine, null, {
    domOwnership: "framework",
    callbacks: {
      onVisualGeometryInvalidated: (event) => events.push(event),
    },
  });
  const child = new SnapSortContainer(engine, root, {
    domOwnership: "framework",
  });
  const first = { isGhost: false } as never;
  const second = { isGhost: false } as never;
  const ghost = { isGhost: true } as never;

  child.invalidateVisualGeometry([first, ghost], "drag");
  root.invalidateVisualGeometry([first, second], "animation");

  const rootQueue = queue.READ_1.get(root.id);
  expect(rootQueue?.size).toBe(1);
  const task = [...rootQueue!.values()][0]!;
  for (const callback of task.callback ?? []) await callback();

  expect(events).toHaveLength(1);
  expect(events[0]!.items).toEqual([first, second]);
  expect(events[0]!.reasons).toEqual(["drag", "animation"]);
});
type Box = Rect & {
  scaleX: number;
  scaleY: number;
  screenX: number;
  screenY: number;
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
};

type LayoutCase = {
  name: string;
  width: number;
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  columnGap: number;
  rowGap: number;
  itemWidths: number[];
  itemHeights: number[];
  itemBorders: number[];
};

type BrowserLayoutCase = {
  name: string;
  container: Box;
  items: Array<{ id: string; box: Box }>;
  draggedId: string;
  ghost: { width: number; height: number };
  actualGhosts: Array<{ index: number; x: number; y: number }>;
};

type DragSample = {
  step: number;
  mouse: { x: number; y: number };
  spacerCount: number;
  spacer: Rect | null;
  spacerParentId: string | null;
  spacerParentKind: string | null;
  spacerParentText: string | null;
  spacerIndex: number | null;
  spacerPrevious: (Rect & { text: string }) | null;
  spacerNext: (Rect & { text: string }) | null;
  spacerDomPrevious: (Rect & { text: string }) | null;
  spacerDomNext: (Rect & { text: string }) | null;
  dragged: (Rect & { centerX: number; centerY: number }) | null;
  draggedCenterDelta: number | null;
  draggedSourceColumnZIndex?: string | null;
  draggedAttribute?: string | null;
  frameRects?: Array<{
    role: string;
    text: string;
    id: string | null;
    transform: string;
    rect: Rect;
  }>;
};

type DomTraceEntry = {
  type: string;
  target: string;
  parent?: string;
  before?: string | null;
  time: number;
};

type SnapSortLifecycleState = {
  spacerCount: number;
  draggingTexts: string[];
  draggingStyles: Array<{
    text: string;
    position: string;
    zIndex: string;
    transform: string;
  }>;
  nestedOuterChildren: Array<{
    id: string;
    classes: string[];
    text: string;
  }>;
};

type SelfInsertProbeState = {
  found: boolean;
  childIndex: number | null;
  duplicateCount: number | null;
  insertEvents: Array<{
    index: number;
    selfBefore: boolean;
    beforeText: string | null;
  }>;
  beforeOrder: string[];
  afterOrder: string[];
  domChildren: string[];
};

type MockSnapSortItem = {
  id: string;
  resolvedItemId: string;
  metadata: Record<string, unknown>;
  direction: "row" | "column";
  mainAxisAlign: "start";
  locked: boolean;
  isGhost: boolean;
  parent?: MockSnapSortItem | null;
  callbacks?: {
    canDrop?: (event: CanDropEvent) => boolean;
    getDropPriority?: (event: DropPriorityEvent) => number | undefined;
  };
  dropPriority?: number;
  dragSnapshot: ItemSnapshot<MockSnapSortItem>;
  currentDomProperty: Box;
  itemOrderedList: MockSnapSortItem[];
  children: MockSnapSortItem[];
  worldTransform: { x: number; y: number; scaleX: number; scaleY: number };
  dragPositionX: number;
  dragPositionY: number;
  dragPointerPosition: { x: number; y: number } | null;
  depth: number;
  name?: string;
  configuration?: Record<string, unknown>;
  numberOfItems?: number;
  addDebugRect: () => void;
  addDebugCircle: () => void;
  addDebugLine: () => void;
  addDebugText: () => void;
  clearDebugMarker: () => void;
};

async function installSnapsortTrace(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as {
      __snapsortTrace: {
        dom: DomTraceEntry[];
        mutations: Array<{
          type: string;
          target: string;
          attr: string | null;
          time: number;
        }>;
      };
      __snapsortActiveText?: string;
      __snapsortActiveIndex?: number;
      __snapsortActiveId?: string;
    };

    const trace = {
      dom: [] as DomTraceEntry[],
      mutations: [] as Array<{
        type: string;
        target: string;
        attr: string | null;
        time: number;
      }>,
    };
    win.__snapsortTrace = trace;

    const describe = (node: unknown) => {
      if (!(node instanceof Element)) return String(node);
      const text = node.textContent?.trim().replace(/\s+/g, " ").slice(0, 40);
      const id = node.id ? `#${node.id}` : "";
      const classes = [...node.classList].slice(0, 4).join(".");
      return `${node.tagName.toLowerCase()}${id}${classes ? `.${classes}` : ""}${text ? ` "${text}"` : ""}`;
    };

    const shouldTrace = (node: unknown) =>
      node instanceof Element &&
      (node.id === "spacer" ||
        node.classList.contains("snapsort-item") ||
        node.classList.contains("snapsort-item-wrapper") ||
        node.classList.contains("snapsort-container") ||
        node.closest?.(".snapsort-container") != null);

    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function <T extends Node>(child: T): T {
      if (shouldTrace(child) || shouldTrace(this)) {
        trace.dom.push({
          type: "appendChild",
          target: describe(child),
          parent: describe(this),
          time: performance.now(),
        });
      }
      return originalAppendChild.call(this, child) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(
      child: T,
      before: Node | null,
    ): T {
      if (shouldTrace(child) || shouldTrace(this)) {
        trace.dom.push({
          type: "insertBefore",
          target: describe(child),
          parent: describe(this),
          before: before ? describe(before) : null,
          time: performance.now(),
        });
      }
      return originalInsertBefore.call(this, child, before) as T;
    };

    const originalRemove = Element.prototype.remove;
    Element.prototype.remove = function () {
      if (shouldTrace(this)) {
        trace.dom.push({
          type: "remove",
          target: describe(this),
          parent: describe(this.parentElement),
          time: performance.now(),
        });
      }
      return originalRemove.call(this);
    };

    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (shouldTrace(mutation.target)) {
          trace.mutations.push({
            type: mutation.type,
            target: describe(mutation.target),
            attr: mutation.attributeName,
            time: performance.now(),
          });
        }
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-engine-id"],
      childList: true,
      subtree: true,
    });
  });
}

function center(rect: Rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function layoutBox(
  rect: Rect,
  margin: Partial<Box["margin"]> = {},
  padding: Partial<Box["padding"]> = {},
  border: Partial<Box["border"]> = {},
): Box {
  return {
    ...rect,
    scaleX: 1,
    scaleY: 1,
    screenX: rect.x,
    screenY: rect.y,
    margin: {
      top: margin.top ?? 0,
      right: margin.right ?? 0,
      bottom: margin.bottom ?? 0,
      left: margin.left ?? 0,
    },
    padding: {
      top: padding.top ?? 0,
      right: padding.right ?? 0,
      bottom: padding.bottom ?? 0,
      left: padding.left ?? 0,
    },
    border: {
      top: border.top ?? 0,
      right: border.right ?? 0,
      bottom: border.bottom ?? 0,
      left: border.left ?? 0,
    },
  };
}

function itemSnapshot<T>(
  value: T,
  box: Box,
  children: ItemSnapshot<T>[] = [],
  direction: "row" | "column" = "column",
): ItemSnapshot<T> {
  return {
    value,
    key: String(value),
    metadata: {},
    direction,
    mainAxisAlign: "start",
    layoutModel: "flow",
    wrap: "auto",
    stretchItems: false,
    locked: false,
    box,
    children,
  };
}

type SnapshotFixture<T> = Omit<
  ItemSnapshot<T>,
  | "key"
  | "metadata"
  | "mainAxisAlign"
  | "layoutModel"
  | "wrap"
  | "stretchItems"
  | "children"
> & {
  key?: string;
  metadata?: ItemSnapshot<T>["metadata"];
  mainAxisAlign?: ItemSnapshot<T>["mainAxisAlign"];
  layoutModel?: ItemSnapshot<T>["layoutModel"];
  wrap?: ItemSnapshot<T>["wrap"];
  stretchItems?: ItemSnapshot<T>["stretchItems"];
  children: SnapshotFixture<T>[];
};

function snapshotFixture<T>(fixture: SnapshotFixture<T>): ItemSnapshot<T> {
  return {
    ...fixture,
    key: fixture.key ?? String(fixture.value),
    metadata: fixture.metadata ?? {},
    mainAxisAlign: fixture.mainAxisAlign ?? "start",
    layoutModel: fixture.layoutModel ?? "flow",
    wrap: fixture.wrap ?? "auto",
    stretchItems: fixture.stretchItems ?? false,
    children: fixture.children.map(snapshotFixture),
  };
}

function mockSnapSortItem(
  id: string,
  rect: Rect,
  children: MockSnapSortItem[] = [],
  direction: "row" | "column" = "column",
): MockSnapSortItem {
  const box = layoutBox(rect);
  const item: MockSnapSortItem = {
    id,
    resolvedItemId: id,
    metadata: {},
    direction,
    mainAxisAlign: "start",
    locked: false,
    isGhost: false,
    parent: null,
    callbacks: undefined,
    dropPriority: 0,
    dragSnapshot: null as unknown as ItemSnapshot<MockSnapSortItem>,
    currentDomProperty: box,
    itemOrderedList: children,
    children,
    worldTransform: { x: rect.x, y: rect.y, scaleX: 1, scaleY: 1 },
    dragPositionX: rect.x,
    dragPositionY: rect.y,
    dragPointerPosition: null,
    depth: 0,
    addDebugRect: () => {},
    addDebugCircle: () => {},
    addDebugLine: () => {},
    addDebugText: () => {},
    clearDebugMarker: () => {},
  };
  Object.defineProperties(item, {
    dragPositionX: {
      get: () => item.worldTransform.x,
      configurable: true,
    },
    dragPositionY: {
      get: () => item.worldTransform.y,
      configurable: true,
    },
    dragPointerPosition: {
      get: () => null,
      configurable: true,
    },
  });
  item.dragSnapshot = itemSnapshot(
    item,
    box,
    children.map((child) => child.dragSnapshot),
    direction,
  );
  for (const child of children) {
    child.depth = item.depth + 1;
    child.parent = item;
  }
  return item;
}

function mockSnapSortContainer(
  id: string,
  rect: Rect,
  children: MockSnapSortItem[],
  direction: "row" | "column",
): MockSnapSortItem {
  const item = mockSnapSortItem(id, rect, children, direction);
  item.configuration = {};
  item.name = id;
  item.numberOfItems = children.length;
  return item;
}

function dropPriorityFixture() {
  const dragged = mockSnapSortItem("dragged", {
    x: 10,
    y: 10,
    width: 20,
    height: 20,
  });
  const source = mockSnapSortContainer(
    "source",
    { x: -100, y: 0, width: 50, height: 50 },
    [dragged],
    "column",
  );
  const near = mockSnapSortContainer(
    "near",
    { x: 0, y: 0, width: 100, height: 50 },
    [],
    "column",
  );
  const far = mockSnapSortContainer(
    "far",
    { x: 0, y: 65, width: 100, height: 50 },
    [],
    "column",
  );
  const root = mockSnapSortContainer(
    "root",
    { x: 0, y: 0, width: 100, height: 115 },
    [near, far],
    "column",
  );
  root.callbacks = { canDrop: rejectDrop };
  return { dragged, source, near, far, root };
}

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
    expect(
      prioritizeNearestContainerEdge({
        ...event,
        pointer: { x: 7, y: 16 },
      }),
    ).toBe(-5);
    expect(rejectDrop({} as CanDropEvent)).toBe(false);
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
  root.callbacks = { canDrop: rejectDrop };

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

test("canDrop rejects a container before its priority callback runs", () => {
  const { dragged, near, far, root } = dropPriorityFixture();
  let canDropCalls = 0;
  let priorityCalls = 0;
  far.dropPriority = 100;
  far.callbacks = {
    canDrop: () => {
      canDropCalls++;
      return false;
    },
    getDropPriority: () => {
      priorityCalls++;
      return 200;
    },
  };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
  expect(canDropCalls).toBe(1);
  expect(priorityCalls).toBe(0);
});

test("drop callbacks run once for a container with multiple candidate slots", () => {
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
  root.callbacks = { canDrop: rejectDrop };

  let canDropCalls = 0;
  let priorityCalls = 0;
  target.callbacks = {
    canDrop: () => {
      canDropCalls++;
      return true;
    },
    getDropPriority: () => {
      priorityCalls++;
      return undefined;
    },
  };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    target,
  );
  expect(canDropCalls).toBe(1);
  expect(priorityCalls).toBe(1);
});

test("priority supports fallback, absolute overrides, and signed fractions", () => {
  const { dragged, near, far, root } = dropPriorityFixture();
  near.dropPriority = -1;
  far.dropPriority = -0.5;
  near.callbacks = { getDropPriority: () => undefined };

  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(far);

  near.callbacks = { getDropPriority: () => 0.25 };
  expect(determineDropTarget(dragged as any, root as any)?.container).toBe(
    near,
  );
});

test("drop policy events expose source, destination, metadata, and geometry", () => {
  const { dragged, source, near, far, root } = dropPriorityFixture();
  dragged.metadata = { kind: "card" };
  source.metadata = { dropGroup: "cards" };
  near.metadata = { dropGroup: "cards" };
  let canDropEvent: CanDropEvent | null = null;
  let priorityEvent: DropPriorityEvent | null = null;
  near.callbacks = {
    canDrop: (event) => {
      canDropEvent = event;
      return true;
    },
    getDropPriority: (event) => {
      priorityEvent = event;
      return undefined;
    },
  };
  far.callbacks = { canDrop: rejectDrop };

  determineDropTarget(dragged as any, root as any);

  expect(canDropEvent).toMatchObject({
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
  const canDropInGroup = (event: CanDropEvent) =>
    event.source?.containerMetadata.dropGroup ===
    event.containerMetadata.dropGroup;
  near.callbacks = { canDrop: canDropInGroup };
  far.callbacks = { canDrop: canDropInGroup };

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
  let event: CanDropEvent | null = null;
  near.callbacks = {
    canDrop: (nextEvent) => {
      event = nextEvent;
      return true;
    },
  };
  far.callbacks = { canDrop: rejectDrop };
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
    itemSet: new Set([dragged, companion]),
    pointer: { x: 20, y: 20 },
  };

  determineInsertionDropTarget(dragged as any, root as any, session as any);

  expect(event?.items.map((item) => item.resolvedItemId)).toEqual([
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
  ).toThrow(/dropPriority must be a finite number/);

  for (const value of ["1", null, {}]) {
    const malformed = dropPriorityFixture();
    malformed.far.dropPriority = value as never;
    expect(() =>
      determineDropTarget(malformed.dragged as any, malformed.root as any),
    ).toThrow(/dropPriority must be a finite number/);
  }

  for (const value of [Number.NaN, "1", null, {}]) {
    const callback = dropPriorityFixture();
    callback.far.callbacks = { getDropPriority: () => value as never };
    expect(() =>
      determineDropTarget(callback.dragged as any, callback.root as any),
    ).toThrow(/getDropPriority must return a finite number or undefined/);
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
  root.callbacks = { canDrop: rejectDrop };
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
    item.resolvedItemId = itemId;
    item.metadata = {};
    item.direction = "column";
    item.mainAxisAlign = "start";
    item.locked = false;
    item.isGhost = false;
    item.itemOrderedList = children;
    item.children = children;
    item.currentDomProperty = box;
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
      item.configuration = {};
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
  const root = makeItem(
    "root",
    { x: 0, y: 0, width: 120, height: 120 },
    [smallContainer, preferredContainer],
    true,
  );
  root.callbacks = { canDrop: rejectDrop };
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
});

function virtualInsertionPosition<T>(
  container: ItemSnapshot<T>,
  dragged: ItemSnapshot<T>,
  startX: number,
  startY: number,
  index: number,
  width: number,
  height: number,
) {
  const insertion = {
    container,
    index,
    entry: {
      width,
      height,
      margin: dragged.box.margin,
    },
  };
  return (
    flowLayoutPositions(container, startX, startY, {
      filter: { excludeSnapshots: new Set([dragged]) },
      insertions: [insertion],
    }).virtualPositions.get(insertion) ?? null
  );
}

test("progressive placement selects the ghost slot under the dragged center", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 50,
    height: 40,
  });
  const columnItems = [
    mockSnapSortItem("a", { x: 0, y: 0, width: 80, height: 40 }),
    mockSnapSortItem("b", { x: 0, y: 48, width: 80, height: 40 }),
    mockSnapSortItem("c", { x: 0, y: 96, width: 80, height: 40 }),
  ];
  const column = mockSnapSortContainer(
    "column",
    { x: 0, y: 0, width: 140, height: 180 },
    columnItems,
    "column",
  );
  dragged.worldTransform = { x: 15, y: 48, scaleX: 1, scaleY: 1 };

  expect(
    determineProgressiveDropTarget(dragged as any, column as any),
  ).toMatchObject({ container: column, index: 1 });

  const rowItems = [
    mockSnapSortItem("a", { x: 0, y: 0, width: 60, height: 40 }),
    mockSnapSortItem("b", { x: 68, y: 0, width: 60, height: 40 }),
    mockSnapSortItem("c", { x: 136, y: 0, width: 60, height: 40 }),
  ];
  const row = mockSnapSortContainer(
    "row",
    { x: 0, y: 0, width: 240, height: 80 },
    rowItems,
    "row",
  );
  dragged.worldTransform = { x: 73, y: 0, scaleX: 1, scaleY: 1 };

  expect(
    determineProgressiveDropTarget(dragged as any, row as any),
  ).toMatchObject({ container: row, index: 1 });
});

test("euclidean placement keeps parent slots reachable next to nested containers", () => {
  const before = mockSnapSortItem("before", {
    x: 0,
    y: 0,
    width: 80,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 4,
    y: 52,
    width: 50,
    height: 40,
  });
  const nestedItem = mockSnapSortItem("nested-item", {
    x: 4,
    y: 100,
    width: 50,
    height: 40,
  });
  const nested = mockSnapSortContainer(
    "nested",
    { x: 0, y: 48, width: 120, height: 96 },
    [dragged, nestedItem],
    "column",
  );
  const after = mockSnapSortItem("after", {
    x: 0,
    y: 152,
    width: 80,
    height: 40,
  });
  const root = mockSnapSortContainer(
    "root",
    { x: 0, y: 0, width: 160, height: 220 },
    [before, nested, after],
    "column",
  );
  dragged.worldTransform = { x: 1, y: 49, scaleX: 1, scaleY: 1 };

  const target = determineDropTarget(dragged as any, root as any);

  expect(target?.container).toBe(root);
  expect(target?.index).toBe(1);
});

test("insertion placement maps a downward same-container gap to the live index", () => {
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const itemC = mockSnapSortItem("c", {
    x: 0,
    y: 144,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 184 },
    [itemA, dragged, itemB, itemC],
    "column",
  );
  dragged.worldTransform = { x: 0, y: 120, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(3);
  expect(target?.ghostRect).toEqual({
    x: 0,
    y: 138.5,
    width: 120,
    height: 3,
  });
});

test.describe("SnapSort insertion marker strategy", () => {
  test("keeps insertion marker absolute and does not displace siblings during hover", async ({
    page,
  }) => {
    await page.goto("/snapsort-insertion", { waitUntil: "networkidle" });

    const firstList = page.locator(".insertion-list").first();
    const firstCard = firstList.locator(".insertion-card").first();
    const secondCard = firstList.locator(".insertion-card").nth(1);

    const firstRect = await itemRect(firstCard);
    const secondBefore = await itemRect(secondCard);
    const start = center(firstRect);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + firstRect.height + 18);
    await page.waitForTimeout(120);

    const marker = page.locator('[data-snapsort-ghost="insertion"]').first();
    await expect(marker).toHaveCount(1);

    const markerState = await marker.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        position: style.position,
        inlineHeight: (element as HTMLElement).style.height,
        borderTopWidth: style.borderTopWidth,
        rectHeight: rect.height,
      };
    });
    expect(markerState.position).toBe("absolute");
    expect(markerState.inlineHeight).toBe("0px");
    expect(parseFloat(markerState.borderTopWidth)).toBeGreaterThan(0);
    expect(markerState.rectHeight).toBeLessThanOrEqual(
      parseFloat(markerState.borderTopWidth) + 2,
    );

    const secondDuring = await itemRect(secondCard);
    expect(Math.abs(secondDuring.x - secondBefore.x)).toBeLessThan(1);
    expect(Math.abs(secondDuring.y - secondBefore.y)).toBeLessThan(1);

    await page.mouse.up();
  });
});

test("insertion placement maps an upward same-container gap to the live index", () => {
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const itemC = mockSnapSortItem("c", {
    x: 0,
    y: 144,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 184 },
    [itemA, itemB, dragged, itemC],
    "column",
  );
  dragged.worldTransform = { x: 0, y: 32, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(1);
  expect(target?.ghostRect).toEqual({
    x: 0,
    y: 42.5,
    width: 120,
    height: 3,
  });
});

test("insertion placement keeps the top boundary reachable when dragging the first item", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 136 },
    [dragged, itemA, itemB],
    "column",
  );
  dragged.worldTransform = { x: 0, y: -22, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(1);
  expect(target?.ghostRect).toEqual({
    x: 0,
    y: -1.5,
    width: 120,
    height: 3,
  });
});

test("insertion placement keeps the bottom boundary reachable when dragging the last item", () => {
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 136 },
    [itemA, itemB, dragged],
    "column",
  );
  dragged.worldTransform = { x: 0, y: 132, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(3);
  expect(target?.ghostRect).toEqual({
    x: 0,
    y: 134.5,
    width: 120,
    height: 3,
  });
});

test("insertion placement spans the container content box on the marker cross axis", () => {
  const itemA = mockSnapSortItem("a", {
    x: 34,
    y: 40,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 34,
    y: 88,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 34,
    y: 136,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 10, y: 20, width: 220, height: 180 },
    [itemA, dragged, itemB],
    "column",
  );
  const containerBox = layoutBox(
    { x: 10, y: 20, width: 220, height: 180 },
    {},
    { top: 8, right: 12, bottom: 8, left: 20 },
    { top: 2, right: 2, bottom: 2, left: 2 },
  );
  container.dragSnapshot = {
    ...container.dragSnapshot,
    box: containerBox,
  };
  container.currentDomProperty = containerBox;
  dragged.worldTransform = { x: 34, y: 112, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.ghostRect?.x).toBe(32);
  expect(target?.ghostRect?.width).toBe(184);
});

test("insertion placement carries snapshot marker insets on the ghost rect", () => {
  const itemA = mockSnapSortItem("a", {
    x: 34,
    y: 40,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 34,
    y: 88,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 34,
    y: 136,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 10, y: 20, width: 220, height: 180 },
    [itemA, dragged, itemB],
    "column",
  );
  Object.defineProperty(container, "dragSnapshotInsertionMarkerInsets", {
    get: () => ({ left: 18, right: 6 }),
  });
  (container as any).metadata = {
    insertionMarkerInsetLeft: 2,
    insertionMarkerInsetRight: 2,
  };
  dragged.worldTransform = { x: 34, y: 112, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.ghostRect?.insetLeft).toBe(18);
  expect(target?.ghostRect?.insetRight).toBe(6);
  expect(target?.ghostRect?.width).toBe(220);
});

test("insertion placement shows a centered marker for an empty row container", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 60,
    height: 32,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 10, y: 20, width: 200, height: 80 },
    [],
    "row",
  );
  dragged.worldTransform = { x: 80, y: 44, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(0);
  expect(target?.ghostRect).toEqual({
    x: 108.5,
    y: 20,
    width: 3,
    height: 80,
  });
});

test("progressive placement uses the cross-axis line in wrapped rows", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 70,
    height: 40,
  });
  const rowItems = [
    dragged,
    mockSnapSortItem("a", { x: 80, y: 0, width: 70, height: 40 }),
    mockSnapSortItem("b", { x: 0, y: 48, width: 70, height: 40 }),
    mockSnapSortItem("c", { x: 80, y: 48, width: 70, height: 40 }),
  ];
  const row = mockSnapSortContainer(
    "wrapped-row",
    { x: 0, y: 0, width: 160, height: 96 },
    rowItems,
    "row",
  );
  dragged.worldTransform = { x: 4, y: 48, scaleX: 1, scaleY: 1 };

  expect(
    determineProgressiveDropTarget(dragged as any, row as any),
  ).toMatchObject({ container: row, index: 2 });
});

test("wraps a horizontal ghost when its trailing margin exceeds the content width", () => {
  const container = snapshotFixture<string>({
    value: "container",
    direction: "row",
    locked: false,
    box: layoutBox({ x: 0, y: 0, width: 313, height: 120 }),
    children: [
      {
        value: "item-1",
        direction: "column",
        locked: false,
        box: layoutBox(
          { x: 4, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
      {
        value: "item-2",
        direction: "column",
        locked: false,
        box: layoutBox(
          { x: 112, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
    ],
  });
  const dragged = snapshotFixture<string>({
    value: "dragged",
    direction: "column",
    locked: false,
    box: layoutBox(
      { x: 0, y: 0, width: 90, height: 40 },
      { left: 4, right: 4 },
    ),
    children: [],
  });

  const simulated = virtualInsertionPosition(
    container,
    dragged,
    0,
    0,
    2,
    dragged.box.width,
    dragged.box.height,
  );

  expect(simulated).toEqual({ x: 4, y: 40 });
});

test("wraps fractional horizontal overflow at browser flex precision", () => {
  const container = snapshotFixture<string>({
    value: "container",
    direction: "row",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox({ x: 0, y: 0, width: 317.2, height: 120 }),
    children: [
      {
        value: "item-1",
        direction: "column",
        mainAxisAlign: "start",
        locked: false,
        box: layoutBox(
          { x: 4, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
      {
        value: "item-2",
        direction: "column",
        mainAxisAlign: "start",
        locked: false,
        box: layoutBox(
          { x: 112, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
    ],
  });
  const dragged = snapshotFixture<string>({
    value: "dragged",
    direction: "column",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox(
      { x: 0, y: 0, width: 93.5, height: 40 },
      { left: 4, right: 4 },
    ),
    children: [],
  });

  const simulated = virtualInsertionPosition(
    container,
    dragged,
    0,
    0,
    2,
    dragged.box.width,
    dragged.box.height,
  );

  expect(simulated).toEqual({ x: 4, y: 40 });
});

test("places append ghost on the short second row in a wrapped row layout", () => {
  const container = snapshotFixture<string>({
    value: "answer",
    direction: "row",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox(
      { x: 0, y: 0, width: 1096, height: 244 },
      {},
      { top: 12, right: 12, bottom: 12, left: 12 },
      { top: 2, right: 2, bottom: 2, left: 2 },
    ),
    children: [
      ["彼", 104, 92, 14, 14],
      ["すぐ", 136, 92, 122, 14],
      ["経歴", 136, 92, 262, 14],
      ["に", 104, 92, 402, 14],
      ["少年", 136, 92, 510, 14],
      ["会社", 136, 92, 650, 14],
      ["問い合わせ", 240, 92, 14, 110],
      ["しまっ", 168, 92, 258, 110],
    ].map(([value, width, height, x, y]) => ({
      value: value as string,
      direction: "column" as const,
      mainAxisAlign: "start" as const,
      locked: false,
      box: layoutBox({
        x: x as number,
        y: y as number,
        width: width as number,
        height: height as number,
      }),
      children: [],
    })),
  });
  const dragged = snapshotFixture<string>({
    value: "を",
    direction: "column",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox({ x: 0, y: 0, width: 104, height: 92 }),
    children: [],
  });
  const origin = contentBoxOrigin(container.box);
  const appendGhost = virtualInsertionPosition(
    container,
    dragged,
    origin.x,
    origin.y,
    container.children.length,
    dragged.box.width,
    dragged.box.height,
  );

  expect(appendGhost).toBeTruthy();
  expect(
    appendGhost!.y,
    "append slot should remain on the second visual row",
  ).toBeGreaterThan(container.children[0].box.y);
  expect(appendGhost!.y).toBe(container.children[6].box.y);
});

test("reproduces same-container row drag where final ghost centers collapse", () => {
  const container = snapshotFixture<string>({
    value: "answer",
    direction: "row",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox(
      { x: 0, y: 0, width: 488, height: 128 },
      {},
      {
        top: 14,
        right: 14,
        bottom: 14,
        left: 14,
      },
    ),
    children: [
      ["彼", 53.6, 47.8, 14, 14],
      ["の", 53.6, 47.8, 71.6, 14],
      ["経歴", 71.2, 47.8, 129.2, 14],
      ["を", 53.6, 47.8, 204.4, 14],
      ["会社", 71.2, 47.8, 262, 14],
      ["に", 53.6, 47.8, 337.2, 14],
      ["問い合わせ", 124, 47.8, 14, 65.8],
      ["た", 53.6, 47.8, 142, 65.8],
    ].map(([value, width, height, x, y]) => ({
      value: value as string,
      direction: "column" as const,
      mainAxisAlign: "start" as const,
      locked: false,
      box: layoutBox({
        x: x as number,
        y: y as number,
        width: width as number,
        height: height as number,
      }),
      children: [],
    })),
  });
  const dragged = container.children[6];
  const origin = contentBoxOrigin(container.box);
  const beforeLower = virtualInsertionPosition(
    container,
    dragged,
    origin.x,
    origin.y,
    6,
    dragged.box.width,
    dragged.box.height,
  );
  const afterLower = virtualInsertionPosition(
    container,
    dragged,
    origin.x,
    origin.y,
    7,
    dragged.box.width,
    dragged.box.height,
  );

  expect(beforeLower).toEqual(afterLower);

  const dragCenter = { x: 235.6, y: 89.7 };
  const collapsedLowerGhostCenter = {
    x: afterLower!.x + dragged.box.width / 2,
    y: afterLower!.y + dragged.box.height / 2,
  };
  const topRowCandidateCenter = {
    x: container.children[3].box.x + dragged.box.width / 2,
    y: container.children[3].box.y + dragged.box.height / 2,
  };
  const frozenBoundaryAfterLastLowerRowItem = {
    x: container.children[7].box.x + container.children[7].box.width,
    y: container.children[7].box.y + dragged.box.height / 2,
  };

  const collapsedGhostDistance = Math.hypot(
    collapsedLowerGhostCenter.x - dragCenter.x,
    collapsedLowerGhostCenter.y - dragCenter.y,
  );
  const topRowDistance = Math.hypot(
    topRowCandidateCenter.x - dragCenter.x,
    topRowCandidateCenter.y - dragCenter.y,
  );
  const frozenBoundaryDistance = Math.hypot(
    frozenBoundaryAfterLastLowerRowItem.x - dragCenter.x,
    frozenBoundaryAfterLastLowerRowItem.y - dragCenter.y,
  );

  expect(
    topRowDistance,
    "current final-ghost-center scoring can prefer a top-row slot",
  ).toBeLessThan(collapsedGhostDistance);
  expect(
    frozenBoundaryDistance,
    "the lower-row visual insertion boundary is still the closer target",
  ).toBeLessThan(topRowDistance);
});

function horizontalDoubleRowLayoutCases(): LayoutCase[] {
  const cases: LayoutCase[] = [];
  for (let width = 236; width <= 356; width += 4) {
    const seed = width * 17;
    const count = 14 + (width % 5);
    const itemWidths = Array.from({ length: count }, (_, index) => {
      return 42 + ((seed + index * 13) % 42);
    });
    const itemHeights = Array.from({ length: count }, (_, index) => {
      return 30 + ((seed + index * 7) % 16);
    });
    const itemBorders = Array.from({ length: count }, (_, index) => {
      return (seed + index * 3) % 4;
    });
    cases.push({
      name: `w${width}`,
      width,
      padding: {
        top: (seed % 9) + 1,
        right: ((seed >> 1) % 13) + 2,
        bottom: ((seed >> 2) % 7) + 1,
        left: ((seed >> 3) % 11) + 2,
      },
      border: {
        top: seed % 5,
        right: (seed + 1) % 6,
        bottom: (seed + 2) % 5,
        left: (seed + 3) % 6,
      },
      columnGap: 4 + (seed % 8),
      rowGap: 3 + ((seed >> 2) % 9),
      itemWidths,
      itemHeights,
      itemBorders,
    });
  }
  return cases;
}

function layoutNodeFromBrowserCase(
  browserCase: BrowserLayoutCase,
): ItemSnapshot<string> {
  return snapshotFixture<string>({
    value: "container",
    direction: "row",
    locked: false,
    box: browserCase.container,
    children: browserCase.items.map((item) => ({
      value: item.id,
      direction: "column",
      locked: false,
      box: item.box,
      children: [],
    })),
  });
}

async function measureBrowserLayoutCases(
  page: Page,
  cases: LayoutCase[],
): Promise<BrowserLayoutCase[]> {
  await page.setContent('<main id="layout-fixture"></main>');
  return page.evaluate((layoutCases) => {
    type BrowserBox = Box;
    type BrowserCase = BrowserLayoutCase;
    const fixture = document.querySelector("#layout-fixture") as HTMLElement;
    const px = (value: number) => `${value}px`;
    const sideCss = (value: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }) =>
      `${px(value.top)} ${px(value.right)} ${px(value.bottom)} ${px(value.left)}`;
    const boxOf = (element: HTMLElement): BrowserBox => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const number = (value: string) => parseFloat(value) || 0;
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scaleX: 1,
        scaleY: 1,
        screenX: rect.x,
        screenY: rect.y,
        margin: {
          top: number(style.marginTop),
          right: number(style.marginRight),
          bottom: number(style.marginBottom),
          left: number(style.marginLeft),
        },
        padding: {
          top: number(style.paddingTop),
          right: number(style.paddingRight),
          bottom: number(style.paddingBottom),
          left: number(style.paddingLeft),
        },
        border: {
          top: number(style.borderTopWidth),
          right: number(style.borderRightWidth),
          bottom: number(style.borderBottomWidth),
          left: number(style.borderLeftWidth),
        },
      };
    };
    const makeItem = (
      id: string,
      width: number,
      height: number,
      border: number,
      isGhost = false,
    ) => {
      const item = document.createElement("div");
      item.dataset.itemId = id;
      item.textContent = id;
      item.style.boxSizing = "border-box";
      item.style.flex = "0 0 auto";
      item.style.width = px(width);
      item.style.height = px(height);
      item.style.border = `${px(border)} solid ${isGhost ? "#b45309" : "#2563eb"}`;
      item.style.padding = `${px((width + height) % 5)} ${px((width + border) % 7)}`;
      item.style.background = isGhost ? "#fef3c7" : "#dbeafe";
      return item;
    };
    const buildContainer = (entry: LayoutCase) => {
      fixture.innerHTML = "";
      const container = document.createElement("section");
      container.style.boxSizing = "border-box";
      container.style.display = "flex";
      container.style.flexDirection = "row";
      container.style.flexWrap = "wrap";
      container.style.alignItems = "flex-start";
      container.style.alignContent = "flex-start";
      container.style.width = px(entry.width);
      container.style.padding = sideCss(entry.padding);
      container.style.borderStyle = "solid";
      container.style.borderColor = "#111827";
      container.style.borderWidth = sideCss(entry.border);
      container.style.columnGap = px(entry.columnGap);
      container.style.rowGap = px(entry.rowGap);
      container.style.margin = "16px";
      fixture.appendChild(container);
      return container;
    };

    return layoutCases.map((entry) => {
      const draggedIndex = Math.min(3, entry.itemWidths.length - 1);
      const draggedId = `item-${draggedIndex}`;
      let container = buildContainer(entry);
      const itemElements = entry.itemWidths.map((width, index) => {
        const item = makeItem(
          `item-${index}`,
          width,
          entry.itemHeights[index],
          entry.itemBorders[index],
        );
        container.appendChild(item);
        return item;
      });
      const containerBox = boxOf(container);
      const items = itemElements.map((item) => ({
        id: item.dataset.itemId!,
        box: boxOf(item),
      }));
      const dragged = items[draggedIndex];
      const remaining = items.filter((item) => item.id !== draggedId);
      const actualGhosts: BrowserCase["actualGhosts"] = [];

      for (let index = 0; index <= remaining.length; index++) {
        container = buildContainer(entry);
        for (let i = 0; i <= remaining.length; i++) {
          if (i === index) {
            container.appendChild(
              makeItem(
                "ghost",
                dragged.box.width,
                dragged.box.height,
                entry.itemBorders[draggedIndex],
                true,
              ),
            );
          }
          const remainingItem = remaining[i];
          if (remainingItem) {
            const originalIndex = Number(remainingItem.id.replace("item-", ""));
            container.appendChild(
              makeItem(
                remainingItem.id,
                entry.itemWidths[originalIndex],
                entry.itemHeights[originalIndex],
                entry.itemBorders[originalIndex],
              ),
            );
          }
        }
        const ghost = container.querySelector(
          '[data-item-id="ghost"]',
        ) as HTMLElement;
        const rect = ghost.getBoundingClientRect();
        actualGhosts.push({ index, x: rect.x, y: rect.y });
      }

      return {
        name: entry.name,
        container: containerBox,
        items,
        draggedId,
        ghost: { width: dragged.box.width, height: dragged.box.height },
        actualGhosts,
      };
    });
  }, cases);
}

async function itemRect(item: Locator): Promise<Rect> {
  await item.scrollIntoViewIfNeeded();
  const box = await item.boundingBox();
  if (!box) throw new Error("Expected item to have a bounding box.");
  return box;
}

async function itemByText(page: Page, text: string, index = 0) {
  const locator = page
    .locator(".snapsort-item")
    .filter({ hasText: text })
    .nth(index);
  await expect(locator).toBeVisible();
  return locator;
}

async function demoBoxByHeading(page: Page, heading: string) {
  const box = page
    .locator(".demo-cell")
    .filter({ has: page.getByRole("heading", { name: heading }) });
  await expect(box).toBeVisible();
  return box;
}

async function websiteCoreDemo(page: Page, demo: string) {
  const box = page.locator(`[data-demo="${demo}"]`);
  await expect(box).toBeVisible();
  return box;
}

async function itemByTextIn(parent: Locator, text: string, index = 0) {
  const locator = parent
    .locator(".snapsort-item")
    .filter({ hasText: text })
    .nth(index);
  await expect(locator).toBeVisible();
  return locator;
}

async function componentArrayList(page: Page) {
  const list = page.locator(".array-list");
  await expect(list).toBeVisible();
  return list;
}

async function collectSample(
  page: Page,
  step: number,
  mouse: { x: number; y: number },
  options: { captureFrameRects?: boolean } = {},
): Promise<DragSample> {
  return page.evaluate(
    ({ step, mouse, captureFrameRects }) => {
      const win = window as unknown as {
        __snapsortActiveText?: string;
        __snapsortActiveIndex?: number;
        __snapsortActiveId?: string;
      };
      const rectOf = (element: Element | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      };
      const describedRectOf = (element: Element | null) => {
        const rect = rectOf(element);
        if (!rect) return null;
        return {
          ...rect,
          text: element?.textContent?.trim().replace(/\s+/g, " ") ?? "",
        };
      };
      const activeId = win.__snapsortActiveId ?? "";
      const draggedElement = document.querySelector(
        `[data-engine-id="${activeId}"]`,
      );
      const spacerElement = document.querySelector("#spacer");
      const spacerParent = spacerElement?.parentElement ?? null;
      const spacerSiblings = spacerParent
        ? [...spacerParent.children].filter(
            (child) =>
              child !== draggedElement &&
              (child.id === "spacer" ||
                child.classList.contains("snapsort-item") ||
                child.classList.contains("snapsort-container")),
          )
        : [];
      const spacerSiblingIndex = spacerElement
        ? spacerSiblings.indexOf(spacerElement)
        : -1;
      const directSiblingTexts = spacerParent
        ? [...spacerParent.children]
            .filter(
              (child) => child.id !== "spacer" && child !== draggedElement,
            )
            .map(
              (child) => child.textContent?.trim().replace(/\s+/g, " ") ?? "",
            )
        : [];
      const parentText = directSiblingTexts.join(" | ");
      const spacerParentKind =
        directSiblingTexts.length === 0
          ? null
          : directSiblingTexts.some((text) => /^Item [4-6]$/.test(text)) &&
              directSiblingTexts.every(
                (text) => text === "" || /^Item [4-6]$/.test(text),
              )
            ? "website-nested-inner"
            : directSiblingTexts.some((text) => /^Item [1-3]$/.test(text)) ||
                directSiblingTexts.some((text) =>
                  /Item 4 Item 5 Item 6/.test(text),
                )
              ? "website-nested-outer"
              : directSiblingTexts.every((text) => /^Sub A\d/.test(text))
                ? "nested-inner"
                : directSiblingTexts.some((text) =>
                      /Item 1\.5|Item 2|Item 3/.test(text),
                    )
                  ? "nested-outer"
                  : directSiblingTexts.some((text) =>
                        /Header|Card Grid|Footer/.test(text),
                      )
                    ? "layers-root"
                    : directSiblingTexts.some((text) =>
                          /Hero Section/.test(text),
                        )
                      ? "layers-hero"
                      : directSiblingTexts.some((text) =>
                            /Loose Item/.test(text),
                          )
                        ? "drag-root"
                        : directSiblingTexts.some((text) =>
                              /Group 1 -/.test(text),
                            )
                          ? "drag-group-1"
                          : directSiblingTexts.some((text) =>
                                /Group 2 -/.test(text),
                              )
                            ? "drag-group-2"
                            : "other";
      const draggedRect = rectOf(draggedElement);
      const dragged = draggedRect
        ? {
            ...draggedRect,
            centerX: draggedRect.x + draggedRect.width / 2,
            centerY: draggedRect.y + draggedRect.height / 2,
          }
        : null;
      const draggedSourceColumn = draggedElement?.closest(".basic-column");
      const frameRects = captureFrameRects
        ? [
            ...document.querySelectorAll(
              ".snapsort-item, .snapsort-container, #spacer",
            ),
          ].map((element) => {
            const htmlElement = element as HTMLElement;
            const role =
              element.id === "spacer"
                ? "ghost"
                : element.classList.contains("snapsort-container")
                  ? "container"
                  : "item";
            return {
              role,
              text: element.textContent?.trim().replace(/\s+/g, " ") ?? "",
              id: element.getAttribute("data-engine-id"),
              transform: htmlElement.style.transform,
              rect: rectOf(element)!,
            };
          })
        : undefined;
      return {
        step,
        mouse,
        spacerCount: document.querySelectorAll("#spacer").length,
        spacer: rectOf(spacerElement),
        spacerParentId: spacerParent?.getAttribute("data-engine-id") ?? null,
        spacerParentKind,
        spacerParentText: parentText || null,
        spacerIndex: spacerSiblingIndex === -1 ? null : spacerSiblingIndex,
        spacerPrevious:
          spacerSiblingIndex > 0
            ? describedRectOf(spacerSiblings[spacerSiblingIndex - 1])
            : null,
        spacerNext:
          spacerSiblingIndex >= 0 &&
          spacerSiblingIndex < spacerSiblings.length - 1
            ? describedRectOf(spacerSiblings[spacerSiblingIndex + 1])
            : null,
        spacerDomPrevious: describedRectOf(
          spacerElement?.previousElementSibling ?? null,
        ),
        spacerDomNext: describedRectOf(
          spacerElement?.nextElementSibling ?? null,
        ),
        dragged,
        draggedCenterDelta: dragged
          ? Math.hypot(dragged.centerX - mouse.x, dragged.centerY - mouse.y)
          : null,
        draggedSourceColumnZIndex: draggedSourceColumn
          ? getComputedStyle(draggedSourceColumn).zIndex
          : null,
        draggedAttribute:
          draggedElement instanceof HTMLElement
            ? draggedElement.dataset.snapsortDragging ?? null
            : null,
        frameRects,
      };
    },
    { step, mouse, captureFrameRects: options.captureFrameRects ?? false },
  );
}

async function dragBy(
  page: Page,
  source: Locator,
  text: string,
  index: number,
  delta: { x: number; y: number },
  options: {
    steps?: number;
    assertCenter?: boolean;
    start?: { x: number; y: number };
    captureFrameRects?: boolean;
  } = {},
): Promise<DragSample[]> {
  const sourceRect = options.start
    ? await source.boundingBox()
    : await itemRect(source);
  if (!sourceRect) {
    throw new Error("Expected source item to have a bounding box.");
  }
  const activeId = await source.getAttribute("data-engine-id");
  const start = options.start ?? center(sourceRect);
  const steps = options.steps ?? 160;
  await page.evaluate(
    ({ text, index, activeId }) => {
      const win = window as unknown as {
        __snapsortActiveText?: string;
        __snapsortActiveIndex?: number;
        __snapsortActiveId?: string;
      };
      win.__snapsortActiveText = text;
      win.__snapsortActiveIndex = index;
      win.__snapsortActiveId = activeId ?? "";
    },
    { text, index, activeId },
  );

  const samples: DragSample[] = [];
  let mouseIsDown = false;
  try {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    mouseIsDown = true;

    const dragDistance = Math.hypot(delta.x, delta.y);
    const activationRatio =
      dragDistance === 0 ? 0 : Math.min(4 / dragDistance, 1);
    if (activationRatio > 0) {
      await page.mouse.move(
        start.x + delta.x * activationRatio,
        start.y + delta.y * activationRatio,
      );
      await page.waitForTimeout(16);
    }

    for (let step = 1; step <= steps; step++) {
      const ratio = activationRatio + ((1 - activationRatio) * step) / steps;
      const mouse = {
        x: start.x + delta.x * ratio,
        y: start.y + delta.y * ratio,
      };
      await page.mouse.move(mouse.x, mouse.y);
      await page.waitForTimeout(8);
      samples.push(
        await collectSample(page, step, mouse, {
          captureFrameRects: options.captureFrameRects,
        }),
      );
    }
  } finally {
    if (mouseIsDown) {
      await page.mouse.up().catch(() => {});
    }
  }

  await page.waitForTimeout(100);
  return samples;
}

async function dragTo(
  page: Page,
  source: Locator,
  text: string,
  index: number,
  target: Locator,
  options: Parameters<typeof dragBy>[5] = {},
): Promise<DragSample[]> {
  const sourceCenter = center(await itemRect(source));
  const targetCenter = center(await itemRect(target));
  return dragBy(
    page,
    source,
    text,
    index,
    {
      x: targetCenter.x - sourceCenter.x,
      y: targetCenter.y - sourceCenter.y,
    },
    options,
  );
}

async function dragToItemFraction(
  page: Page,
  source: Locator,
  text: string,
  index: number,
  target: Locator,
  yRatio: number,
  options: Parameters<typeof dragBy>[5] = {},
): Promise<DragSample[]> {
  const sourceCenter = center(await itemRect(source));
  const targetRect = await itemRect(target);
  return dragBy(
    page,
    source,
    text,
    index,
    {
      x: targetRect.x + targetRect.width / 2 - sourceCenter.x,
      y: targetRect.y + targetRect.height * yRatio - sourceCenter.y,
    },
    options,
  );
}

async function directSnapSortItemTexts(locator: Locator): Promise<string[]> {
  return locator.evaluate((element) =>
    [...element.children]
      .filter((child) => child.classList.contains("snapsort-item"))
      .map((child) => child.textContent?.trim().replace(/\s+/g, " ") ?? ""),
  );
}

// A nested container's own textContent concatenates its children's text with
// no separator by default; hand-authored templates picked up an incidental
// space from template whitespace between sibling tags, which items-mode's
// internal {#each} doesn't reproduce. Expected strings below reflect the
// no-space (items-mode) DOM shape -- this is a DOM formatting detail, not a
// behavior difference (content and order are unaffected).
async function directSnapSortChildTexts(locator: Locator): Promise<string[]> {
  return locator.evaluate((element) =>
    [...element.children]
      .filter(
        (child) =>
          child.classList.contains("snapsort-item") ||
          child.classList.contains("snapsort-container"),
      )
      .map((child) => child.textContent?.trim().replace(/\s+/g, " ") ?? ""),
  );
}

async function nestedSnapSortLifecycleState(
  page: Page,
): Promise<SnapSortLifecycleState> {
  return page.evaluate(() => {
    const normalizeText = (element: Element | null) =>
      element?.textContent?.trim().replace(/\s+/g, " ") ?? "";
    const nestedCell = [...document.querySelectorAll(".demo-cell")].find(
      (cell) =>
        cell.querySelector("h2")?.textContent?.trim() === "Nested Container",
    );
    const outerContainer = nestedCell?.querySelector(".snapsort-container");
    const draggingElements = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-snapsort-dragging="true"]',
      ),
    ];

    return {
      spacerCount: document.querySelectorAll("#spacer").length,
      draggingTexts: draggingElements.map(normalizeText),
      draggingStyles: draggingElements.map((element) => ({
        text: normalizeText(element),
        position: element.style.position,
        zIndex: element.style.zIndex,
        transform: element.style.transform,
      })),
      nestedOuterChildren: [...(outerContainer?.children ?? [])].map(
        (child) => ({
          id: child.id,
          classes: [...child.classList],
          text: normalizeText(child),
        }),
      ),
    };
  });
}

async function releaseStartedDragNearOrigin(
  page: Page,
  nested: Locator,
  itemText: string,
  targetText: string,
  targetYRatio: number,
) {
  const item = await itemByTextIn(nested, itemText);
  const target = await itemByTextIn(nested, targetText);
  const start = center(await itemRect(item));
  const targetRect = await itemRect(target);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    targetRect.x + targetRect.width / 2,
    targetRect.y + targetRect.height * targetYRatio,
    { steps: 30 },
  );
  await page.waitForTimeout(80);
  await page.mouse.move(start.x + 1, start.y + 1, { steps: 20 });
  await page.waitForTimeout(20);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

async function dragLockedNestedContainerBackground(
  page: Page,
  nested: Locator,
) {
  const childContainer = nested.locator(".snapsort-container").nth(1);
  const rect = await itemRect(childContainer);
  const start = {
    x: rect.x + 4,
    y: rect.y + 4,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 80, { steps: 20 });
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(160);
}

async function nestedContainerSelfInsertProbe(
  page: Page,
): Promise<SelfInsertProbeState> {
  const coreImportPath = `/@fs${process.cwd()}/src/index.ts`;
  return page.evaluate(
    async ({ coreImportPath }) => {
      const { GlobalManager } = await import(coreImportPath);
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const nestedCell = [...document.querySelectorAll(".demo-cell")].find(
        (cell) =>
          cell.querySelector("h2")?.textContent?.trim() === "Nested Container",
      );
      const outerElement = nestedCell?.querySelector(".snapsort-container");
      const childElement = nestedCell?.querySelectorAll(
        ".snapsort-container",
      )[1];
      const outer = containers.find(
        (container: any) => container.element === outerElement,
      );
      const child = containers.find(
        (container: any) => container.element === childElement,
      );
      const normalizeText = (element: Element | null) =>
        element?.textContent?.trim().replace(/\s+/g, " ") ?? "";
      const itemText = (item: any) => normalizeText(item.element);

      if (!outer || !child) {
        return {
          found: false,
          childIndex: null,
          duplicateCount: null,
          insertEvents: [],
          beforeOrder: [],
          afterOrder: [],
          domChildren: [],
        };
      }

      const beforeOrder = outer.itemOrderedList.map(itemText);
      const childIndex = outer.itemOrderedList.indexOf(child);
      const insertEvents: SelfInsertProbeState["insertEvents"] = [];
      const originalInsert = outer.callbacks.onItemInsert;
      outer.config.callbacks.onItemInsert = (event: any) => {
        insertEvents.push({
          index: event.index,
          selfBefore: event.beforeElement === event.item.element,
          beforeText: normalizeText(event.beforeElement),
        });
        originalInsert(event);
      };

      outer.insertItemAt(outer, child, childIndex);
      outer.config.callbacks.onItemInsert = originalInsert;

      return {
        found: true,
        childIndex,
        duplicateCount: outer.itemOrderedList.filter(
          (item: any) => item === child,
        ).length,
        insertEvents,
        beforeOrder,
        afterOrder: outer.itemOrderedList.map(itemText),
        domChildren: [...outer.element.children].map((element) =>
          normalizeText(element),
        ),
      };
    },
    { coreImportPath },
  );
}

async function directLogoSliceOrder(locator: Locator): Promise<number[]> {
  return locator.evaluate((element) =>
    [...element.children]
      .filter((child) => child.classList.contains("snapsort-item"))
      .map((child) =>
        Number(child.querySelector<HTMLElement>(".logo-slice")?.dataset.slice),
      ),
  );
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function expectStableDrag(
  page: Page,
  samples: DragSample[],
  consoleMessages: string[],
  outputPath: string,
  options: { assertCenter?: boolean } = {},
) {
  const trace = await page.evaluate(() => {
    const win = window as unknown as {
      __snapsortTrace?: { dom: DomTraceEntry[]; mutations: unknown[] };
    };
    return win.__snapsortTrace;
  });
  await writeJson(outputPath, {
    samples,
    trace,
    layoutLogs: consoleMessages.filter((message) =>
      /\[updateDropTarget\]|\[updateGhostElement\]|\[insertItemAt\]|\[removeItemFrom\]|determineDropTarget|chosen|candidate/.test(
        message,
      ),
    ),
    errors: consoleMessages.filter((message) =>
      /error|Missing drag snapshot|Unhandled|TypeError/i.test(message),
    ),
  });

  expect(samples, "drag should produce frame samples").not.toHaveLength(0);
  expect(
    samples.filter((sample) => sample.spacerCount !== 1),
    "the spacer should not disappear or duplicate while dragging",
  ).toHaveLength(0);
  if (options.assertCenter !== false) {
    expect(
      Math.max(...samples.map((sample) => sample.draggedCenterDelta ?? 999)),
      "dragged item center should remain close to the pointer",
    ).toBeLessThan(12);
  }
  expect(
    consoleMessages.filter((message) =>
      /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(message),
    ),
  ).toHaveLength(0);
}

function expectNoSpacerBacktrack(samples: DragSample[], axis: "x" | "y") {
  const positions = samples
    .filter((sample) => sample.spacer)
    .map((sample) => ({
      step: sample.step,
      value: sample.spacer![axis],
    }));

  for (let i = 1; i < positions.length; i++) {
    expect(
      positions[i].value + 8,
      `spacer should not jump backward between steps ${positions[i - 1].step} and ${positions[i].step}`,
    ).toBeGreaterThanOrEqual(positions[i - 1].value);
  }
}

function expectNoParentReentry(
  samples: DragSample[],
  innerKind: string,
  outerKind: string,
  label: string,
) {
  const kinds = samples
    .map((sample) => sample.spacerParentKind)
    .filter((kind): kind is string => kind === innerKind || kind === outerKind);
  const firstInner = kinds.indexOf(innerKind);
  expect(
    firstInner,
    `drag should enter the ${label} nested sub-container`,
  ).toBeGreaterThanOrEqual(0);

  for (let i = firstInner + 1; i < kinds.length - 1; i++) {
    expect(
      !(kinds[i] === outerKind && kinds[i + 1] === innerKind),
      `spacer should not briefly leave and re-enter the ${label} nested container`,
    ).toBe(true);
  }
}

function expectNoNestedParentFlicker(samples: DragSample[]) {
  expectNoParentReentry(samples, "nested-inner", "nested-outer", "default");
}

function expectNoSpacerOscillation(samples: DragSample[]) {
  const keys = samples
    .filter((sample) => sample.spacer)
    .map(
      (sample) =>
        `${Math.round(sample.spacer!.x)}:${Math.round(sample.spacer!.y)}:${sample.spacerIndex}`,
    );

  for (let i = 2; i < keys.length; i++) {
    expect(
      !(keys[i] === keys[i - 2] && keys[i] !== keys[i - 1]),
      `spacer should not alternate between ${keys[i - 1]} and ${keys[i]} around sample ${i}`,
    ).toBe(true);
  }
}

function ghostInsertionTargets(consoleMessages: string[]) {
  return consoleMessages.flatMap((message) => {
    const match = message.match(
      /\[updateGhostElement\] inserting ghost at container=([^\s]+) index=(\d+)/,
    );
    return match ? [`${match[1]}[${match[2]}]`] : [];
  });
}

function expectGhostUpdatesStable(
  consoleMessages: string[],
  expectedMaxUpdates: number,
) {
  const targets = ghostInsertionTargets(consoleMessages);
  expect(
    targets.length,
    `ghost should update only at stable slot transitions; saw ${targets.join(" -> ")}`,
  ).toBeLessThanOrEqual(expectedMaxUpdates);

  for (let i = 2; i < targets.length; i++) {
    expect(
      !(targets[i] === targets[i - 2] && targets[i] !== targets[i - 1]),
      `ghost target should not oscillate: ${targets.join(" -> ")}`,
    ).toBe(true);
  }
}

function compressedSpacerStates(
  samples: DragSample[],
  kinds: string[] = ["nested-inner", "nested-outer"],
) {
  const states = samples
    .filter((sample) =>
      sample.spacerParentKind ? kinds.includes(sample.spacerParentKind) : false,
    )
    .map((sample) => `${sample.spacerParentKind}[${sample.spacerIndex}]`);

  return states.filter(
    (state, index) => index === 0 || state !== states[index - 1],
  );
}

function expectSpacerAlignedAfterPrevious(
  samples: DragSample[],
  parentKind: string,
  previousPattern: RegExp,
) {
  const sample = samples.find(
    (entry) =>
      entry.spacer &&
      entry.spacerParentKind === parentKind &&
      previousPattern.test(entry.spacerPrevious?.text ?? ""),
  );
  expect(
    sample,
    `expected spacer in ${parentKind} after ${previousPattern}`,
  ).toBeTruthy();

  const previous = sample!.spacerPrevious!;
  const delta = Math.abs(sample!.spacer!.y - (previous.y + previous.height));
  expect(
    delta,
    `spacer should align just below previous sibling; previous=${previous.text} delta=${delta}`,
  ).toBeLessThan(24);
}

function expectSpacerNearDragged(
  samples: DragSample[],
  parentKind: string,
  maxDistance: number,
) {
  const candidates = samples.filter(
    (sample) =>
      sample.spacer && sample.dragged && sample.spacerParentKind === parentKind,
  );
  expect(
    candidates,
    `expected spacer samples in ${parentKind}`,
  ).not.toHaveLength(0);

  const worst = candidates.reduce(
    (current, sample) => {
      const spacerCenterY = sample.spacer!.y + sample.spacer!.height / 2;
      const delta = Math.abs(spacerCenterY - sample.dragged!.centerY);
      return delta > current.delta ? { sample, delta } : current;
    },
    { sample: candidates[0], delta: -Infinity },
  );

  expect(
    worst.delta,
    `spacer center should track dragged item center in ${parentKind}; worst step=${worst.sample.step}`,
  ).toBeLessThan(maxDistance);
}

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("matches browser flex ghost positions for horizontal double-row fuzz cases", async ({
    page,
  }, testInfo) => {
    const cases = horizontalDoubleRowLayoutCases();
    const measuredCases = await measureBrowserLayoutCases(page, cases);
    const failures: Array<{
      name: string;
      index: number;
      expected: { x: number; y: number };
      actual: { x: number; y: number };
      delta: { x: number; y: number };
    }> = [];

    for (const measuredCase of measuredCases) {
      const root = layoutNodeFromBrowserCase(measuredCase);
      const dragged = root.children.find(
        (item) => item.value === measuredCase.draggedId,
      );
      expect(
        dragged,
        `dragged item should exist for ${measuredCase.name}`,
      ).toBeTruthy();

      const origin = contentBoxOrigin(measuredCase.container);
      for (const actual of measuredCase.actualGhosts) {
        const simulated = virtualInsertionPosition(
          root,
          dragged!,
          origin.x,
          origin.y,
          actual.index,
          measuredCase.ghost.width,
          measuredCase.ghost.height,
        );
        expect(
          simulated,
          `simulated ghost should exist for ${measuredCase.name}[${actual.index}]`,
        ).toBeTruthy();

        const delta = {
          x: Math.abs(simulated!.x - actual.x),
          y: Math.abs(simulated!.y - actual.y),
        };
        if (delta.x > 1.25 || delta.y > 1.25) {
          failures.push({
            name: measuredCase.name,
            index: actual.index,
            expected: { x: actual.x, y: actual.y },
            actual: simulated!,
            delta,
          });
        }
      }
    }

    await writeJson(
      testInfo.outputPath("horizontal-double-row-layout-fuzz.json"),
      {
        caseCount: measuredCases.length,
        slotCount: measuredCases.reduce(
          (count, measuredCase) => count + measuredCase.actualGhosts.length,
          0,
        ),
        failures,
      },
    );

    expect(
      failures.slice(0, 8),
      "layout engine ghost positions should match browser flex positions within 1.25px",
    ).toHaveLength(0);
  });

  test("keeps a zero-slack hero grid at 4 columns across sub-pixel container widths", async ({
    page,
  }, testInfo) => {
    // The landing-page hero pad grid is the worst case for wrap prediction:
    // 4 columns of calc((100% - 12px) / 4) with a 4px gap sum *exactly* to
    // the container width, leaving zero slack for measurement error. Each
    // browser quantizes layout differently (Blink/WebKit on a 1/64px grid;
    // Gecko in 1/60px app units whose getBoundingClientRect doubles carry
    // ~1e-5px conversion noise), which historically over-wrapped the 4th
    // column onto the 2nd row at fractional container widths. Sweep integer
    // width bases crossed with increasingly granular sub-pixel offsets and
    // assert the simulation keeps 4 items per row with a same-size ghost at
    // every insertion index.
    const bases = [356, 380, 397, 414, 430, 434, 443];
    const offsets = [
      0,
      0.5,
      0.25,
      0.75,
      0.33,
      0.67,
      1 / 3,
      2 / 3,
      0.1,
      0.2,
      0.4,
      0.6,
      0.8,
      0.9,
      0.125,
      0.375,
      0.625,
      0.875,
      0.0625,
      0.03125,
      0.015625,
      0.0078125,
    ];
    const widths = bases.flatMap((base) =>
      offsets.map((offset) => base + offset),
    );

    await page.setContent('<main id="hero-grid-fixture"></main>');
    const measuredGrids = await page.evaluate((caseWidths) => {
      const fixture = document.querySelector(
        "#hero-grid-fixture",
      ) as HTMLElement;
      const boxOf = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const number = (value: string) => parseFloat(value) || 0;
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scaleX: 1,
          scaleY: 1,
          screenX: rect.x,
          screenY: rect.y,
          margin: {
            top: number(style.marginTop),
            right: number(style.marginRight),
            bottom: number(style.marginBottom),
            left: number(style.marginLeft),
          },
          padding: {
            top: number(style.paddingTop),
            right: number(style.paddingRight),
            bottom: number(style.paddingBottom),
            left: number(style.paddingLeft),
          },
          border: {
            top: number(style.borderTopWidth),
            right: number(style.borderRightWidth),
            bottom: number(style.borderBottomWidth),
            left: number(style.borderLeftWidth),
          },
        };
      };
      return caseWidths.map((width) => {
        fixture.innerHTML = "";
        const container = document.createElement("section");
        container.style.cssText =
          "box-sizing:border-box;display:flex;flex-direction:row;flex-wrap:wrap;" +
          `align-items:flex-start;align-content:flex-start;gap:4px;width:${width}px;`;
        fixture.appendChild(container);
        for (let index = 0; index < 16; index++) {
          const item = document.createElement("div");
          item.style.cssText =
            "box-sizing:border-box;width:calc((100% - 12px) / 4);height:40px;" +
            "background:#dbeafe;";
          container.appendChild(item);
        }
        return {
          width,
          container: boxOf(container),
          items: [...container.children].map((element) =>
            boxOf(element as HTMLElement),
          ),
        };
      });
    }, widths);

    const failures: Array<{
      width: number;
      index: number | null;
      rows: number[];
    }> = [];
    for (const grid of measuredGrids) {
      const root = makeContainerSnapshot(
        grid.container as Box,
        grid.items.map((box, index) =>
          makeItemSnapshot(`item-${index}`, box as Box),
        ),
      );
      const rowStep = root.children[4].box.y - root.children[0].box.y;
      // Browser ground truth first: the real flex layout must show 4 rows
      // of 4 before the simulation is held to the same shape.
      const browserRows = rowCounts(
        root.children.map((child) => child.box.y),
        rowStep,
      );
      if (browserRows.join() !== "4,4,4,4") {
        failures.push({ width: grid.width, index: null, rows: browserRows });
        continue;
      }

      const dragged = root.children[0];
      for (let index = 0; index <= 15; index++) {
        const rows = simulatedRowCounts(root, {
          rowStep,
          insertion: {
            container: root,
            index,
            entry: {
              width: dragged.box.width,
              height: dragged.box.height,
              margin: dragged.box.margin,
            },
          },
          filter: { excludeSnapshots: new Set([dragged]) },
        });
        if (rows.join() !== "4,4,4,4") {
          failures.push({ width: grid.width, index, rows });
        }
      }
    }

    await writeJson(testInfo.outputPath("hero-grid-subpixel-matrix.json"), {
      widthCount: measuredGrids.length,
      insertionChecks: measuredGrids.length * 16,
      failures: failures.slice(0, 40),
    });
    expect(
      failures.slice(0, 8),
      "the 4th column must stay in the 4th column (not wrap to the 2nd row) at every sub-pixel width",
    ).toHaveLength(0);
  });

  test("matches browser grid placements across template variants (slot layout model)", async ({
    page,
  }, testInfo) => {
    // Ground truth for the slot layout model: for each grid template
    // variant, remove the dragged item from a real `display:grid` DOM,
    // insert a real spacer (with the dragged item's explicit size, as
    // flow-ghost does) at several indices, and require the slot simulation
    // to match the browser's placement of every entry within 1.25px. The
    // unequal-track, auto-flow-column, and auto-rows variants are exactly
    // the shapes the flow model cannot represent.
    const scenarios = [
      {
        name: "fixed equal tracks",
        container:
          "display:grid;grid-template-columns:repeat(4, 88px);gap:4px;width:380px;",
        itemHeight: () => 40,
      },
      {
        name: "fractional tracks",
        container:
          "display:grid;grid-template-columns:repeat(4, 1fr);gap:4px;width:380.33px;",
        itemHeight: () => 40,
      },
      {
        name: "unequal tracks",
        container:
          "display:grid;grid-template-columns:60px 140px 80px 88.33px;gap:4px;width:380.33px;",
        itemHeight: () => 40,
      },
      {
        name: "auto-fill minmax",
        container:
          "display:grid;grid-template-columns:repeat(auto-fill, minmax(80px, 1fr));gap:4px;width:380.33px;",
        itemHeight: () => 40,
      },
      {
        name: "auto-flow column",
        container:
          "display:grid;grid-auto-flow:column;grid-template-rows:repeat(4, 44px);gap:4px;width:max-content;",
        itemHeight: () => 40,
      },
      {
        name: "auto rows with mixed item heights",
        container:
          "display:grid;grid-template-columns:repeat(4, 88px);grid-auto-rows:auto;gap:4px;width:380px;align-items:start;",
        // item 0 (the dragged one) is tall: removing it shrinks its row in
        // the real layout, which only the content-sized row variant tracks.
        itemHeight: (index: number) => (index % 5 === 0 ? 80 : 40),
      },
    ];
    const spacerIndices = [0, 3, 7, 14];
    const draggedIndex = 0;

    await page.setContent('<main id="grid-slot-fixture"></main>');
    const measured = await page.evaluate(
      ({ cases, spacerIndices, draggedIndex }) => {
        const fixture = document.querySelector(
          "#grid-slot-fixture",
        ) as HTMLElement;
        const boxOf = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const number = (value: string) => parseFloat(value) || 0;
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            scaleX: 1,
            scaleY: 1,
            screenX: rect.x,
            screenY: rect.y,
            margin: {
              top: number(style.marginTop),
              right: number(style.marginRight),
              bottom: number(style.marginBottom),
              left: number(style.marginLeft),
            },
            padding: {
              top: number(style.paddingTop),
              right: number(style.paddingRight),
              bottom: number(style.paddingBottom),
              left: number(style.paddingLeft),
            },
            border: {
              top: number(style.borderTopWidth),
              right: number(style.borderRightWidth),
              bottom: number(style.borderBottomWidth),
              left: number(style.borderLeftWidth),
            },
          };
        };
        const build = (
          entry: { container: string; itemHeights: number[] },
          spacer: { index: number; width: number; height: number } | null,
        ) => {
          fixture.innerHTML = "";
          const container = document.createElement("section");
          container.style.cssText = "box-sizing:border-box;" + entry.container;
          fixture.appendChild(container);
          const nodes: HTMLElement[] = [];
          for (let i = 0; i < 16; i++) {
            if (spacer && i === draggedIndex) continue; // dragged item lifted
            const item = document.createElement("div");
            item.style.cssText = `box-sizing:border-box;background:#dbeafe;height:${entry.itemHeights[i]}px;`;
            item.dataset.i = String(i);
            nodes.push(item);
          }
          if (spacer) {
            const spacerEl = document.createElement("div");
            spacerEl.id = "spacer";
            spacerEl.style.cssText = `box-sizing:border-box;background:#fecaca;width:${spacer.width}px;height:${spacer.height}px;`;
            nodes.splice(Math.min(spacer.index, nodes.length), 0, spacerEl);
          }
          for (const node of nodes) container.appendChild(node);
          return container;
        };

        return cases.map((entry) => {
          const pristine = build(entry, null);
          const containerBox = boxOf(pristine);
          const itemBoxes = [...pristine.children].map((element) =>
            boxOf(element as HTMLElement),
          );
          const dragged = itemBoxes[draggedIndex];
          const truths = spacerIndices.map((index) => {
            const container = build(entry, {
              index,
              width: dragged.width,
              height: dragged.height,
            });
            let ghost: { x: number; y: number } | null = null;
            const items: Array<{ id: string; x: number; y: number }> = [];
            for (const element of container.children) {
              const rect = element.getBoundingClientRect();
              if (element.id === "spacer") {
                ghost = { x: rect.x, y: rect.y };
              } else {
                items.push({
                  id: (element as HTMLElement).dataset.i!,
                  x: rect.x,
                  y: rect.y,
                });
              }
            }
            return { spacerIndex: index, ghost, items };
          });
          return {
            name: entry.name,
            container: containerBox,
            itemBoxes,
            truths,
          };
        });
      },
      {
        cases: scenarios.map((scenario) => ({
          name: scenario.name,
          container: scenario.container,
          itemHeights: Array.from({ length: 16 }, (_, i) =>
            scenario.itemHeight(i),
          ),
        })),
        spacerIndices,
        draggedIndex,
      },
    );

    const failures: Array<{
      name: string;
      spacerIndex: number;
      entry: string;
      delta: number;
    }> = [];
    for (const grid of measured) {
      const root = makeContainerSnapshot(
        grid.container as Box,
        grid.itemBoxes.map((box, index) =>
          makeItemSnapshot(`${index}`, box as Box),
        ),
        "row",
        "start",
        "slots",
      );
      const dragged = root.children[draggedIndex];
      for (const truth of grid.truths) {
        const insertion = {
          container: root,
          index: truth.spacerIndex,
          entry: {
            width: dragged.box.width,
            height: dragged.box.height,
            margin: dragged.box.margin,
          },
        };
        const origin = contentBoxOrigin(root.box);
        const result = flowLayoutPositions(root, origin.x, origin.y, {
          filter: { excludeSnapshots: new Set([dragged]) },
          insertions: [insertion],
        });
        const actualById = new Map(truth.items.map((item) => [item.id, item]));
        for (const [snapshotItem, position] of result.itemPositions) {
          const actual = actualById.get(snapshotItem.value);
          if (!actual) continue;
          const delta = Math.max(
            Math.abs(position.x - actual.x),
            Math.abs(position.y - actual.y),
          );
          if (delta > 1.25) {
            failures.push({
              name: grid.name,
              spacerIndex: truth.spacerIndex,
              entry: `item-${snapshotItem.value}`,
              delta: +delta.toFixed(2),
            });
          }
        }
        const ghost = result.virtualPositions.get(insertion);
        expect(
          ghost,
          `ghost position for ${grid.name}[${truth.spacerIndex}]`,
        ).toBeTruthy();
        const ghostDelta = truth.ghost
          ? Math.max(
              Math.abs(ghost!.x - truth.ghost.x),
              Math.abs(ghost!.y - truth.ghost.y),
            )
          : Infinity;
        if (ghostDelta > 1.25) {
          failures.push({
            name: grid.name,
            spacerIndex: truth.spacerIndex,
            entry: "ghost",
            delta: +ghostDelta.toFixed(2),
          });
        }
      }
    }

    await writeJson(testInfo.outputPath("grid-slot-model-ground-truth.json"), {
      scenarioCount: measured.length,
      failures: failures.slice(0, 40),
    });
    expect(
      failures.slice(0, 8),
      "slot layout simulation should match browser grid placement within 1.25px",
    ).toHaveLength(0);
  });

  test("layout simulation invariants hold across randomized containers (property fuzz)", async ({
    page,
  }, testInfo) => {
    // Property-based ground truth: instead of hand-picked scenarios, build
    // seeded-random containers and assert invariants that must hold for ANY
    // layout the engine claims to support:
    //
    // - identity: simulating with no exclusions/insertions reproduces the
    //   browser's measured positions;
    // - away-and-back: excluding item k and inserting a same-size ghost at
    //   index k is a no-op — every other item stays put and the ghost lands
    //   on item k's measured rect;
    // - locality: a ghost at index k never moves an entry before index k
    //   (compared against the identity simulation, so the bound is exact).
    //
    // The generator stays inside the engine's stated envelope (uniform gaps,
    // no per-item margins, LTR, no spans); failures record their seed for
    // deterministic repro.
    const TOLERANCE = 1.25;
    const caseCount = 36;

    await page.setContent('<main id="property-fixture"></main>');
    const measured = await page.evaluate((caseCount) => {
      const fixture = document.querySelector(
        "#property-fixture",
      ) as HTMLElement;
      let seed = 20260708;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
      const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
      const boxOf = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const number = (value: string) => parseFloat(value) || 0;
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scaleX: 1,
          scaleY: 1,
          screenX: rect.x,
          screenY: rect.y,
          margin: {
            top: number(style.marginTop),
            right: number(style.marginRight),
            bottom: number(style.marginBottom),
            left: number(style.marginLeft),
          },
          padding: {
            top: number(style.paddingTop),
            right: number(style.paddingRight),
            bottom: number(style.paddingBottom),
            left: number(style.paddingLeft),
          },
          border: {
            top: number(style.borderTopWidth),
            right: number(style.borderRightWidth),
            bottom: number(style.borderBottomWidth),
            left: number(style.borderLeftWidth),
          },
        };
      };

      const cases = [];
      for (let index = 0; index < caseCount; index++) {
        const caseSeed = seed;
        const kind = rand() < 0.6 ? "flow" : "slots";
        const width = between(240, 520);
        const gap = int(2, 12);
        const pad = int(0, 12);
        const border = int(0, 3);
        const count = int(8, 16);

        fixture.innerHTML = "";
        const container = document.createElement("section");
        let containerCss =
          `box-sizing:border-box;width:${width}px;padding:${pad}px;` +
          `border:${border}px solid #111;`;
        if (kind === "flow") {
          containerCss +=
            "display:flex;flex-direction:row;flex-wrap:wrap;" +
            `align-items:flex-start;align-content:flex-start;gap:${gap}px;`;
        } else {
          const templates = [
            `repeat(${int(3, 5)}, 1fr)`,
            `repeat(auto-fill, minmax(${int(60, 90)}px, 1fr))`,
            Array.from({ length: int(3, 4) }, () => `${int(50, 120)}px`).join(
              " ",
            ),
          ];
          containerCss +=
            `display:grid;grid-template-columns:${templates[int(0, 2)]};` +
            `gap:${gap}px;`;
        }
        container.style.cssText = containerCss;
        fixture.appendChild(container);
        for (let i = 0; i < count; i++) {
          const item = document.createElement("div");
          let itemCss = `box-sizing:border-box;height:${int(24, 64)}px;background:#dbeafe;`;
          if (kind === "flow") itemCss += `width:${between(30, 110)}px;`;
          item.style.cssText = itemCss;
          container.appendChild(item);
        }
        cases.push({
          caseSeed,
          kind,
          container: boxOf(container),
          items: [...container.children].map((element) =>
            boxOf(element as HTMLElement),
          ),
        });
      }
      return cases;
    }, caseCount);

    const failures: Array<{
      caseSeed: number;
      kind: string;
      property: string;
      detail: string;
      delta: number;
    }> = [];
    const distance = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

    for (const propertyCase of measured) {
      const root = makeContainerSnapshot(
        propertyCase.container as Box,
        propertyCase.items.map((box, index) =>
          makeItemSnapshot(`${index}`, box as Box),
        ),
        "row",
        "start",
        propertyCase.kind as "flow" | "slots",
      );
      const origin = contentBoxOrigin(root.box);
      const record = (property: string, detail: string, delta: number) =>
        failures.push({
          caseSeed: propertyCase.caseSeed,
          kind: propertyCase.kind,
          property,
          detail,
          delta: +delta.toFixed(2),
        });

      // Identity: the simulation of the unmodified container must reproduce
      // the measured layout.
      const identity = flowLayoutPositions(root, origin.x, origin.y);
      for (const child of root.children) {
        const delta = distance(identity.itemPositions.get(child)!, child.box);
        if (delta > TOLERANCE) record("identity", `item-${child.value}`, delta);
      }

      const count = root.children.length;
      for (const k of [0, Math.floor(count / 2), count - 1]) {
        const target = root.children[k];

        // Away-and-back: excluding item k and inserting an identical ghost
        // at index k must be a no-op.
        const insertion = {
          container: root,
          index: k,
          entry: {
            width: target.box.width,
            height: target.box.height,
            margin: target.box.margin,
          },
        };
        const roundTrip = flowLayoutPositions(root, origin.x, origin.y, {
          filter: { excludeSnapshots: new Set([target]) },
          insertions: [insertion],
        });
        for (const child of root.children) {
          if (child === target) continue;
          const delta = distance(
            roundTrip.itemPositions.get(child)!,
            child.box,
          );
          if (delta > TOLERANCE) {
            record("away-and-back", `k=${k} item-${child.value}`, delta);
          }
        }
        const ghost = roundTrip.virtualPositions.get(insertion)!;
        const ghostDelta = distance(ghost, target.box);
        if (ghostDelta > TOLERANCE) {
          record("away-and-back", `k=${k} ghost`, ghostDelta);
        }

        // Locality: inserting at index k (no exclusion) must not move any
        // entry before k. Compared against the identity simulation, so this
        // bound is exact rather than tolerance-based.
        const inserted = flowLayoutPositions(root, origin.x, origin.y, {
          insertions: [
            {
              container: root,
              index: k,
              entry: {
                width: target.box.width,
                height: target.box.height,
                margin: target.box.margin,
              },
            },
          ],
        });
        for (let i = 0; i < k; i++) {
          const child = root.children[i];
          const delta = distance(
            inserted.itemPositions.get(child)!,
            identity.itemPositions.get(child)!,
          );
          if (delta > 0.01) record("locality", `k=${k} item-${i}`, delta);
        }
      }
    }

    await writeJson(testInfo.outputPath("layout-property-fuzz.json"), {
      caseCount: measured.length,
      failures: failures.slice(0, 40),
    });
    expect(
      failures.slice(0, 8),
      "identity / away-and-back / locality invariants should hold for every generated container",
    ).toHaveLength(0);
  });

  test("drops land where the drag preview predicted (drift oracle)", async ({
    page,
  }, testInfo) => {
    // The mid-drag preview IS the layout engine's prediction: displaced
    // items sit at simulated positions and the spacer marks the dragged
    // item's landing slot. After the drop, the framework re-renders and the
    // browser performs the real layout — the authoritative ground truth.
    // Comparing the settled DOM against the last preview turns any real
    // drag into a layout-engine oracle: drift means the simulation and the
    // browser disagreed about the committed arrangement.
    const TOLERANCE = 1.5;
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");

    const dragWithOracle = async (
      sourceText: string,
      target: { x: number; y: number },
      label: string,
    ) => {
      const source = await itemByTextIn(verticalColumn, sourceText);
      const start = center(await itemRect(source));
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      for (let step = 1; step <= 14; step++) {
        await page.mouse.move(
          start.x + ((target.x - start.x) * step) / 14,
          start.y + ((target.y - start.y) * step) / 14,
        );
        await page.waitForTimeout(16);
      }
      // Let the preview settle so captured rects are the engine's final
      // prediction, not a mid-animation frame.
      await page.waitForTimeout(350);

      const texts = (element: Element) =>
        element.textContent?.trim().replace(/\s+/g, " ") ?? "";
      const prediction = await verticalColumn.evaluate((box, dragged) => {
        const out: Record<string, { x: number; y: number }> = {};
        for (const element of box.querySelectorAll(".snapsort-item")) {
          const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
          if (element.id === "spacer" || text.includes(dragged)) continue;
          const rect = element.getBoundingClientRect();
          out[text] = { x: rect.x, y: rect.y };
        }
        const spacer = box.querySelector("#spacer");
        if (spacer) {
          const rect = spacer.getBoundingClientRect();
          out["__dragged__"] = { x: rect.x, y: rect.y };
        }
        return out;
      }, sourceText);

      await page.mouse.up();
      await page.waitForTimeout(500);

      const settled = await verticalColumn.evaluate((box, dragged) => {
        const out: Record<string, { x: number; y: number }> = {};
        for (const element of box.querySelectorAll(".snapsort-item")) {
          const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const rect = element.getBoundingClientRect();
          out[text.includes(dragged) ? "__dragged__" : text] = {
            x: rect.x,
            y: rect.y,
          };
        }
        return out;
      }, sourceText);

      const drifts: Array<{ label: string; entry: string; delta: number }> = [];
      let compared = 0;
      for (const [entry, predicted] of Object.entries(prediction)) {
        const actual = settled[entry];
        if (!actual) continue;
        compared++;
        const delta = Math.max(
          Math.abs(predicted.x - actual.x),
          Math.abs(predicted.y - actual.y),
        );
        if (delta > TOLERANCE)
          drifts.push({ label, entry, delta: +delta.toFixed(2) });
      }
      // Guard against a vacuous pass: the oracle must have compared the
      // dragged item's landing slot plus the displaced items.
      expect(
        compared,
        `oracle should compare several entries for ${label}`,
      ).toBeGreaterThanOrEqual(4);
      expect(
        prediction.__dragged__,
        `spacer prediction should exist for ${label}`,
      ).toBeTruthy();
      return drifts;
    };

    const item3 = await itemByTextIn(verticalColumn, "Item 3");
    const item3Center = center(await itemRect(item3));
    const item4 = await itemByTextIn(verticalColumn, "Item 4");
    const item4Rect = await itemRect(item4);

    const allDrifts = [
      // Reorder downward past two slots.
      ...(await dragWithOracle("Item 1", item3Center, "item1-to-item3")),
      // Reach the final slot (past the last item's bottom edge).
      ...(await dragWithOracle(
        "Item 2",
        {
          x: item4Rect.x + item4Rect.width / 2,
          y: item4Rect.y + item4Rect.height * 1.05,
        },
        "item2-to-final-slot",
      )),
    ];

    await writeJson(testInfo.outputPath("drop-drift-oracle.json"), {
      drifts: allDrifts,
    });
    expect(
      allDrifts,
      "settled post-drop positions should match the drag preview's prediction",
    ).toHaveLength(0);
  });

  test("keeps the spacer stable while dragging into a narrower nested container (stretch flicker regression)", async ({
    page,
  }, testInfo) => {
    // Before `stretchItems`, insertion entries kept the dragged item's
    // source-container size everywhere, so nested candidates' ghost rects
    // and centers were computed at parent width — candidate scoring
    // flip-flopped between parent and nested slots as the pointer moved and
    // the spacer visibly oscillated between containers. The Stretch Nested
    // demo cell's items are genuinely 100% width and its containers declare
    // `stretchItems`, so the spacer host must settle: at most a couple of
    // transitions on the way in, ending inside the nested sub-list, with
    // the drop committing there.
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const nested = await demoBoxByHeading(page, "Stretch Nested");
    const source = await itemByTextIn(nested, "Task 1");
    const target = await itemByTextIn(nested, "Sub task 2");
    const start = center(await itemRect(source));
    const end = center(await itemRect(target));

    const spacerHost = () =>
      nested.evaluate((box) => {
        const spacer = box.querySelector("#spacer");
        if (!spacer) return "none";
        const container = spacer.closest(".snapsort-container");
        if (!container) return "unknown";
        return container.classList.contains("stretch-sublist")
          ? "nested"
          : "parent";
      });

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    const hosts: string[] = [];
    const steps = 24;
    for (let step = 1; step <= steps; step++) {
      await page.mouse.move(
        start.x + ((end.x - start.x) * step) / steps,
        start.y + ((end.y - start.y) * step) / steps,
      );
      await page.waitForTimeout(16);
      hosts.push(await spacerHost());
    }
    await page.waitForTimeout(350);
    hosts.push(await spacerHost());

    // The core of the fix: once the spacer is hosted by the narrower
    // sublist, it must be re-sized to the sublist's content width (minus
    // its own margins) rather than keeping the parent-container width it
    // was measured at.
    const spacerSizing = await nested.evaluate((box) => {
      const spacer = box.querySelector("#spacer") as HTMLElement | null;
      const sublist = box.querySelector(
        ".stretch-sublist",
      ) as HTMLElement | null;
      if (!spacer || !sublist) return null;
      const spacerRect = spacer.getBoundingClientRect();
      const style = getComputedStyle(sublist);
      const spacerStyle = getComputedStyle(spacer);
      const number = (value: string) => parseFloat(value) || 0;
      const contentWidth =
        sublist.getBoundingClientRect().width -
        number(style.borderLeftWidth) -
        number(style.borderRightWidth) -
        number(style.paddingLeft) -
        number(style.paddingRight);
      const expected =
        contentWidth -
        number(spacerStyle.marginLeft) -
        number(spacerStyle.marginRight);
      return { spacerWidth: spacerRect.width, expected };
    });
    expect(spacerSizing, "spacer should be inside the sublist").toBeTruthy();
    expect(
      Math.abs(spacerSizing!.spacerWidth - spacerSizing!.expected),
      `spacer width ${spacerSizing!.spacerWidth} should match the sublist's content width ${spacerSizing!.expected}`,
    ).toBeLessThanOrEqual(1.5);

    // Drift oracle for the nested drop: preview rects just before release
    // vs the settled DOM afterward.
    const prediction = await nested.evaluate((box) => {
      const out: Record<string, { x: number; y: number }> = {};
      for (const element of box.querySelectorAll(".snapsort-item")) {
        const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
        if (element.id === "spacer" || text === "Task 1") continue;
        if (!/^Sub task \d$/.test(text)) continue;
        const rect = element.getBoundingClientRect();
        out[text] = { x: rect.x, y: rect.y };
      }
      const spacer = box.querySelector("#spacer");
      if (spacer) {
        const rect = spacer.getBoundingClientRect();
        out["__dragged__"] = { x: rect.x, y: rect.y };
      }
      return out;
    });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const settled = await nested.evaluate((box) => {
      const out: Record<string, { x: number; y: number }> = {};
      for (const element of box.querySelectorAll(".snapsort-item")) {
        const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
        const rect = element.getBoundingClientRect();
        if (text === "Task 1") out["__dragged__"] = { x: rect.x, y: rect.y };
        else if (/^Sub task \d$/.test(text))
          out[text] = { x: rect.x, y: rect.y };
      }
      return out;
    });
    const drifts: Array<{ entry: string; delta: number }> = [];
    for (const [entry, predicted] of Object.entries(prediction)) {
      const actual = settled[entry];
      if (!actual) continue;
      const delta = Math.max(
        Math.abs(predicted.x - actual.x),
        Math.abs(predicted.y - actual.y),
      );
      if (delta > 1.5) drifts.push({ entry, delta: +delta.toFixed(2) });
    }

    const transitions = hosts.filter(
      (host, index) => index > 0 && host !== hosts[index - 1],
    ).length;
    const subGroupTexts = await nested.evaluate((box) =>
      [...box.querySelectorAll(".stretch-sublist .snapsort-item")].map(
        (element) => element.textContent?.trim().replace(/\s+/g, " ") ?? "",
      ),
    );

    await writeJson(testInfo.outputPath("nested-stretch-flicker.json"), {
      hosts,
      transitions,
      drifts,
      subGroupTexts,
    });
    expect(
      hosts[hosts.length - 1],
      "spacer should end in the nested sub-list",
    ).toBe("nested");
    expect(
      transitions,
      "spacer host must not oscillate between parent and nested containers",
    ).toBeLessThanOrEqual(2);
    expect(
      drifts,
      "nested drop should land where the preview predicted",
    ).toHaveLength(0);
    expect(
      subGroupTexts.some((text) => text.includes("Task 1")),
      "the dragged item should commit into the nested sub-list",
    ).toBe(true);
  });

  test("stretch entry sizing matches a real width-100% spacer (ground truth)", async ({
    page,
  }) => {
    // A stretchItems container's simulated entry must match what the browser
    // does with an unsized (stretch) flex child: fill the content box minus
    // the entry's own margins — including fractional container widths,
    // padding, and borders.
    await page.setContent('<main id="stretch-fixture"></main>');
    const measured = await page.evaluate(() => {
      const fixture = document.querySelector("#stretch-fixture") as HTMLElement;
      const boxOf = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const number = (value: string) => parseFloat(value) || 0;
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scaleX: 1,
          scaleY: 1,
          screenX: rect.x,
          screenY: rect.y,
          margin: {
            top: number(style.marginTop),
            right: number(style.marginRight),
            bottom: number(style.marginBottom),
            left: number(style.marginLeft),
          },
          padding: {
            top: number(style.paddingTop),
            right: number(style.paddingRight),
            bottom: number(style.paddingBottom),
            left: number(style.paddingLeft),
          },
          border: {
            top: number(style.borderTopWidth),
            right: number(style.borderRightWidth),
            bottom: number(style.borderBottomWidth),
            left: number(style.borderLeftWidth),
          },
        };
      };
      const build = (withSpacer: boolean) => {
        fixture.innerHTML = "";
        const container = document.createElement("section");
        container.style.cssText =
          "box-sizing:border-box;display:flex;flex-direction:column;" +
          "width:222.33px;padding:9px;border:2px solid #111;gap:6px;";
        fixture.appendChild(container);
        for (let i = 0; i < 3; i++) {
          const item = document.createElement("div");
          item.style.cssText =
            "box-sizing:border-box;height:40px;background:#dbeafe;";
          item.dataset.i = String(i);
          container.appendChild(item);
          if (withSpacer && i === 0) {
            // Unsized stretch flex child with margins: the browser's own
            // notion of a "100% width" entry.
            const spacer = document.createElement("div");
            spacer.id = "spacer";
            spacer.style.cssText =
              "box-sizing:border-box;height:40px;margin:0 4px;background:#fecaca;";
            container.appendChild(spacer);
          }
        }
        return container;
      };
      const pristine = build(false);
      const containerBox = boxOf(pristine);
      const itemBoxes = [...pristine.children].map((element) =>
        boxOf(element as HTMLElement),
      );
      const truth = build(true);
      const spacer = truth.querySelector("#spacer") as HTMLElement;
      const spacerRect = spacer.getBoundingClientRect();
      return {
        container: containerBox,
        itemBoxes,
        spacer: {
          x: spacerRect.x,
          y: spacerRect.y,
          width: spacerRect.width,
          height: spacerRect.height,
        },
      };
    });

    const root = makeContainerSnapshot(
      measured.container as Box,
      measured.itemBoxes.map((box, index) =>
        makeItemSnapshot(`${index}`, box as Box),
      ),
      "column",
      "start",
      "flow",
      { wrap: "nowrap", stretchItems: true },
    );
    const margin = { top: 0, right: 4, bottom: 0, left: 4 };
    const insertion = {
      container: root,
      index: 1,
      entry: {
        // Deliberately oversized base: the source container was wider.
        ...virtualEntrySizeFor(root, { width: 500, height: 40, margin }),
        margin,
      },
    };
    const origin = contentBoxOrigin(root.box);
    const result = flowLayoutPositions(root, origin.x, origin.y, {
      insertions: [insertion],
    });
    const rect = result.virtualRects.get(insertion)!;
    expect(Math.abs(rect.width - measured.spacer.width)).toBeLessThanOrEqual(
      1.25,
    );
    expect(Math.abs(rect.y - measured.spacer.y)).toBeLessThanOrEqual(1.25);
  });

  // Documented-unsupported layout shapes, encoded as expected failures so
  // the boundary is visible in the test report and any accidental fix or
  // regression flips the result. Each builds a real DOM, inserts a real
  // spacer, and counts entries where the simulation misses the browser's
  // placement by more than 1.25px.
  async function unsupportedShapeMismatches(
    page: Page,
    config: {
      containerCss: string;
      itemCss: string[];
      itemInnerHeights?: number[];
      layoutModel: "flow" | "slots";
      spacerIndices: number[];
    },
  ): Promise<number> {
    await page.setContent('<main id="unsupported-fixture"></main>');
    const measured = await page.evaluate((cfg) => {
      const fixture = document.querySelector(
        "#unsupported-fixture",
      ) as HTMLElement;
      const boxOf = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const number = (value: string) => parseFloat(value) || 0;
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scaleX: 1,
          scaleY: 1,
          screenX: rect.x,
          screenY: rect.y,
          margin: {
            top: number(style.marginTop),
            right: number(style.marginRight),
            bottom: number(style.marginBottom),
            left: number(style.marginLeft),
          },
          padding: {
            top: number(style.paddingTop),
            right: number(style.paddingRight),
            bottom: number(style.paddingBottom),
            left: number(style.paddingLeft),
          },
          border: {
            top: number(style.borderTopWidth),
            right: number(style.borderRightWidth),
            bottom: number(style.borderBottomWidth),
            left: number(style.borderLeftWidth),
          },
        };
      };
      const build = (
        spacer: { index: number; width: number; height: number } | null,
      ) => {
        fixture.innerHTML = "";
        const container = document.createElement("section");
        container.style.cssText = "box-sizing:border-box;" + cfg.containerCss;
        fixture.appendChild(container);
        const nodes: HTMLElement[] = [];
        for (let i = 0; i < cfg.itemCss.length; i++) {
          if (spacer && i === 0) continue; // dragged item lifted
          const item = document.createElement("div");
          item.style.cssText =
            "box-sizing:border-box;background:#dbeafe;" + cfg.itemCss[i];
          item.dataset.i = String(i);
          const innerHeight = cfg.itemInnerHeights?.[i];
          if (innerHeight != null) {
            const inner = document.createElement("div");
            inner.style.cssText = `height:${innerHeight}px;`;
            item.appendChild(inner);
          }
          nodes.push(item);
        }
        if (spacer) {
          const spacerEl = document.createElement("div");
          spacerEl.id = "spacer";
          spacerEl.style.cssText = `box-sizing:border-box;background:#fecaca;width:${spacer.width}px;height:${spacer.height}px;`;
          nodes.splice(Math.min(spacer.index, nodes.length), 0, spacerEl);
        }
        for (const node of nodes) container.appendChild(node);
        return container;
      };

      const pristine = build(null);
      const containerBox = boxOf(pristine);
      const itemBoxes = [...pristine.children].map((element) =>
        boxOf(element as HTMLElement),
      );
      const dragged = itemBoxes[0];
      const truths = cfg.spacerIndices.map((index) => {
        const container = build({
          index,
          width: dragged.width,
          height: dragged.height,
        });
        let ghost: { x: number; y: number } | null = null;
        const items: Array<{ id: string; x: number; y: number }> = [];
        for (const element of container.children) {
          const rect = element.getBoundingClientRect();
          if (element.id === "spacer") ghost = { x: rect.x, y: rect.y };
          else {
            items.push({
              id: (element as HTMLElement).dataset.i!,
              x: rect.x,
              y: rect.y,
            });
          }
        }
        return { spacerIndex: index, ghost, items };
      });
      return { container: containerBox, itemBoxes, truths };
    }, config);

    const root = makeContainerSnapshot(
      measured.container as Box,
      measured.itemBoxes.map((box, index) =>
        makeItemSnapshot(`${index}`, box as Box),
      ),
      "row",
      "start",
      config.layoutModel,
    );
    const dragged = root.children[0];
    let mismatches = 0;
    for (const truth of measured.truths) {
      const insertion = {
        container: root,
        index: truth.spacerIndex,
        entry: {
          width: dragged.box.width,
          height: dragged.box.height,
          margin: dragged.box.margin,
        },
      };
      const origin = contentBoxOrigin(root.box);
      const result = flowLayoutPositions(root, origin.x, origin.y, {
        filter: { excludeSnapshots: new Set([dragged]) },
        insertions: [insertion],
      });
      const actualById = new Map(truth.items.map((item) => [item.id, item]));
      for (const [snapshotItem, position] of result.itemPositions) {
        const actual = actualById.get(snapshotItem.value);
        if (!actual) continue;
        if (
          Math.max(
            Math.abs(position.x - actual.x),
            Math.abs(position.y - actual.y),
          ) > 1.25
        ) {
          mismatches++;
        }
      }
      const ghost = result.virtualPositions.get(insertion);
      if (
        !ghost ||
        !truth.ghost ||
        Math.max(
          Math.abs(ghost.x - truth.ghost.x),
          Math.abs(ghost.y - truth.ghost.y),
        ) > 1.25
      ) {
        mismatches++;
      }
    }
    return mismatches;
  }

  test("documents unsupported: RTL flex containers", async ({ page }) => {
    test.fail(
      true,
      "The flow model assumes LTR main-axis growth: RTL offsets regress per item, so line detection and positions are mirrored. Slot mode covers RTL grids; RTL flex is out of scope.",
    );
    const mismatches = await unsupportedShapeMismatches(page, {
      containerCss:
        "display:flex;flex-wrap:wrap;direction:rtl;width:380.33px;gap:4px;" +
        "align-items:flex-start;align-content:flex-start;",
      itemCss: Array.from(
        { length: 16 },
        () => "width:calc((100% - 12px)/4);height:40px;",
      ),
      layoutModel: "flow",
      spacerIndices: [0, 3, 7],
    });
    expect(mismatches).toBe(0);
  });

  test("documents unsupported: grid items spanning multiple tracks", async ({
    page,
  }) => {
    test.fail(
      true,
      "Slot mode assumes one entry per slot: a span-2 item makes slot geometry depend on placement, which reordering invalidates.",
    );
    const mismatches = await unsupportedShapeMismatches(page, {
      containerCss:
        "display:grid;grid-template-columns:repeat(4, 88px);gap:4px;width:380px;",
      itemCss: Array.from({ length: 14 }, (_, i) =>
        i === 5 ? "height:40px;grid-column:span 2;" : "height:40px;",
      ),
      layoutModel: "slots",
      spacerIndices: [0, 3, 7],
    });
    expect(mismatches).toBe(0);
  });

  test("documents unsupported: stretch items with intrinsic heights across content-sized rows", async ({
    page,
  }) => {
    test.fail(
      true,
      "Items with align-self:stretch and no explicit height measure at their row's height, not their intrinsic height; when displaced across content-sized rows the simulation carries the stale stretched height. Predicting the true height would require intrinsic sizing per destination track.",
    );
    const mismatches = await unsupportedShapeMismatches(page, {
      containerCss:
        "display:grid;grid-template-columns:repeat(3, 110px);grid-auto-rows:auto;gap:4px;width:346px;",
      // No explicit item heights: each stretches to its row. Item 0's inner
      // content is 90px tall, making row 1's track 90 and stretching its
      // short siblings to 90 as measured. Removing item 0 shrinks row 1 to
      // 30 in the real layout; the simulation keeps the stale 90.
      itemCss: Array.from({ length: 9 }, () => ""),
      itemInnerHeights: Array.from({ length: 9 }, (_, i) =>
        i === 0 ? 90 : 30,
      ),
      layoutModel: "slots",
      spacerIndices: [8],
    });
    expect(mismatches).toBe(0);
  });

  test("does not crash when drag movement arrives before snapshot capture", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item = await itemByTextIn(verticalColumn, "Item 1");
    const itemCenter = center(await itemRect(item));

    await page.mouse.move(itemCenter.x, itemCenter.y);
    await page.mouse.down();
    for (let step = 1; step <= 24; step++) {
      await page.mouse.move(itemCenter.x, itemCenter.y + step * 4);
    }
    await page.mouse.up();
    await page.waitForTimeout(100);

    await writeJson(testInfo.outputPath("snapshot-readiness-trace.json"), {
      errors: consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
      snapshotWaits: consoleMessages.filter((message) =>
        /waiting for drag snapshot/.test(message),
      ),
    });

    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });

  test("cleans up drag state when a started drag releases back inside the threshold", async ({
    page,
  }, testInfo) => {
    // Regression: a drag that starts (crosses the threshold) and then returns
    // near its origin before release must still fire dragEnd and commit/clean
    // up. Previously dragEnd was gated on the pointer's final distance from
    // the start, so an away-and-back "drop it in the same place" gesture was
    // misclassified as a click and left the drag session uncommitted.
    // Fixed in src/input.ts #finishPointer by gating on the drag gesture state.
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    await releaseStartedDragNearOrigin(page, nested, "Item 1.5", "Sub A1", 0.2);
    const state = await nestedSnapSortLifecycleState(page);

    await writeJson(
      testInfo.outputPath("threshold-release-cleanup-repro.json"),
      {
        state,
        errors: [
          ...pageErrors,
          ...consoleMessages.filter((message) =>
            /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
              message,
            ),
          ),
        ],
      },
    );

    expect(state.spacerCount, "released drag should remove its ghost").toBe(0);
    expect(
      state.draggingTexts,
      "released drag should clear the dragging marker",
    ).toEqual([]);
  });

  test("does not let a locked container drag consume leaked root ghost state", async ({
    page,
  }, testInfo) => {
    test.fail(
      true,
      "Known repro: drag/dragEnd still run after locked dragStart returns, so a locked container can consume leaked root drag state.",
    );
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&lockNestedChild=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Nested Container");
    await releaseStartedDragNearOrigin(page, nested, "Item 1.5", "Sub A1", 0.2);
    const beforeLockedDrag = await nestedSnapSortLifecycleState(page);
    await dragLockedNestedContainerBackground(page, nested);
    const afterLockedDrag = await nestedSnapSortLifecycleState(page);

    await writeJson(
      testInfo.outputPath("locked-container-leak-adoption-repro.json"),
      {
        beforeLockedDrag,
        afterLockedDrag,
        adapterWarnings: consoleMessages.filter((message) =>
          /adapter did not place/.test(message),
        ),
        errors: [
          ...pageErrors,
          ...consoleMessages.filter((message) =>
            /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
              message,
            ),
          ),
        ],
      },
    );

    expect(
      beforeLockedDrag.spacerCount,
      "precondition should expose the leaked ghost",
    ).toBe(1);
    expect(
      afterLockedDrag.spacerCount,
      "a locked container drag should not consume another drag's leaked ghost",
    ).toBe(1);
  });

  test("does not self-reference beforeElement when reinserting an existing nested container", async ({
    page,
  }, testInfo) => {
    test.fail(
      true,
      "Known repro: #attachItemToContainer can duplicate an existing item, making beforeElement equal the item itself.",
    );
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const probe = await nestedContainerSelfInsertProbe(page);
    await writeJson(
      testInfo.outputPath("nested-container-self-insert-repro.json"),
      {
        probe,
      },
    );

    expect(probe.found, "expected to find the nested container objects").toBe(
      true,
    );
    expect(
      probe.insertEvents.some((event) => event.selfBefore),
      `adapter should never receive the dropped item as beforeElement; events=${JSON.stringify(probe.insertEvents)}`,
    ).toBe(false);
    expect(
      probe.duplicateCount,
      `re-inserting an existing child should not duplicate the itemOrderedList; order=${probe.afterOrder.join(" | ")}`,
    ).toBe(1);
  });

  test("does not throw when a leaked dragged item is grabbed again", async ({
    page,
    browserName,
  }, testInfo) => {
    test.fail(
      browserName !== "firefox",
      "Known repro: re-grabbing the leaked item reaches detachItemFromContainer with a null current container. Firefox's release-near-origin timing does not leak the item, so the repro (and the failure) is Blink/WebKit-only.",
    );
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    await releaseStartedDragNearOrigin(page, nested, "Item 1.5", "Sub A1", 0.2);
    const leakedItem = await itemByTextIn(nested, "Item 1.5");
    const leakedRect = await itemRect(leakedItem);
    const leakedCenter = center(leakedRect);

    await page.mouse.move(leakedCenter.x, leakedCenter.y);
    await page.mouse.down();
    await page.mouse.move(leakedCenter.x + 20, leakedCenter.y + 20, {
      steps: 10,
    });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const state = await nestedSnapSortLifecycleState(page);
    await writeJson(testInfo.outputPath("leaked-item-regrab-repro.json"), {
      state,
      pageErrors,
      consoleErrors: consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    });

    expect(pageErrors).toHaveLength(0);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
    expect(state.spacerCount).toBe(0);
    expect(state.draggingTexts).toEqual([]);
  });

  test("animates displaced items when the ghost reorders", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item1 = await itemByTextIn(verticalColumn, "Item 1");
    const item4 = await itemByTextIn(verticalColumn, "Item 4");
    const item1Center = center(await itemRect(item1));
    const item4Center = center(await itemRect(item4));

    await page.mouse.move(item1Center.x, item1Center.y);
    await page.mouse.down();

    // Arm a style-attribute observer before the reorder: polling for the
    // inline transform can miss a FLIP that starts and settles between polls
    // (WebKit clears the transform quickly on fast machines).
    await page.evaluate(() => {
      const win = window as unknown as {
        __sawDisplacedTransform?: boolean;
        __displacedObserver?: MutationObserver;
      };
      win.__sawDisplacedTransform = false;
      const isDisplaced = (element: Element) =>
        element.id !== "spacer" && !/Item 1/.test(element.textContent ?? "");
      const check = (element: Element) => {
        if (
          isDisplaced(element) &&
          /^translate3d\(/.test((element as HTMLElement).style.transform)
        ) {
          win.__sawDisplacedTransform = true;
        }
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) check(mutation.target as Element);
      });
      for (const element of document.querySelectorAll(".snapsort-item")) {
        observer.observe(element, {
          attributes: true,
          attributeFilter: ["style"],
        });
        check(element);
      }
      win.__displacedObserver = observer;
    });

    // Pace the moves like a human drag: a single burst of interpolated moves
    // can be delivered entirely before the drag session finishes activating
    // (observed on WebKit), leaving no post-activation pointermove and thus
    // no reorder to animate.
    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(
        item1Center.x,
        item1Center.y + ((item4Center.y - item1Center.y) * step) / 12,
      );
      await page.waitForTimeout(16);
    }

    const animated = await page.waitForFunction(
      () =>
        (window as unknown as { __sawDisplacedTransform?: boolean })
          .__sawDisplacedTransform === true,
    );
    await page.mouse.up();
    await page.waitForTimeout(120);

    await writeJson(testInfo.outputPath("reorder-animation-trace.json"), {
      animated: await animated.jsonValue(),
      errors: consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    });

    expect(await animated.jsonValue()).toBe(true);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });

  test("animates displaced items when the ghost reorders upward", async ({
    page,
  }, testInfo) => {
    // Mirror of the downward test above. Upward reorders place the ghost
    // BEFORE the displaced items in FLIP snapshot order, so a failure while
    // animating the ghost entry silently kills every displaced-item
    // animation — a class of bug the downward drag cannot catch.
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item1 = await itemByTextIn(verticalColumn, "Item 1");
    const item4 = await itemByTextIn(verticalColumn, "Item 4");
    const item1Center = center(await itemRect(item1));
    const item4Center = center(await itemRect(item4));

    await page.mouse.move(item4Center.x, item4Center.y);
    await page.mouse.down();

    await page.evaluate(() => {
      const win = window as unknown as {
        __sawDisplacedTransform?: boolean;
        __displacedObserver?: MutationObserver;
      };
      win.__sawDisplacedTransform = false;
      const isDisplaced = (element: Element) =>
        element.id !== "spacer" && !/Item 4/.test(element.textContent ?? "");
      const check = (element: Element) => {
        if (
          isDisplaced(element) &&
          /^translate3d\(/.test((element as HTMLElement).style.transform)
        ) {
          win.__sawDisplacedTransform = true;
        }
      };
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) check(mutation.target as Element);
      });
      for (const element of document.querySelectorAll(".snapsort-item")) {
        observer.observe(element, {
          attributes: true,
          attributeFilter: ["style"],
        });
        check(element);
      }
      win.__displacedObserver = observer;
    });

    for (let step = 1; step <= 12; step++) {
      await page.mouse.move(
        item4Center.x,
        item4Center.y + ((item1Center.y - item4Center.y) * step) / 12,
      );
      await page.waitForTimeout(16);
    }

    const animated = await page.waitForFunction(
      () =>
        (window as unknown as { __sawDisplacedTransform?: boolean })
          .__sawDisplacedTransform === true,
    );
    await page.mouse.up();
    await page.waitForTimeout(120);

    await writeJson(
      testInfo.outputPath("reorder-animation-upward-trace.json"),
      {
        animated: await animated.jsonValue(),
        errors: consoleMessages.filter((message) =>
          /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
            message,
          ),
        ),
      },
    );

    expect(await animated.jsonValue()).toBe(true);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });

  test("keeps the final slot reachable in a plain vertical list", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const container = verticalColumn.locator(".snapsort-container").first();
    const item = await itemByTextIn(verticalColumn, "Item 1");
    const target = await itemByTextIn(verticalColumn, "Item 4");

    await dragToItemFraction(page, item, "Item 1", 0, target, 1.05, {
      steps: 80,
    });

    await expect
      .poll(() => directSnapSortItemTexts(container))
      .toEqual(["Item 2", "Item 3", "Item 4", "Item 1"]);
  });

  test("reproduces website sideways list final-slot placement", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "sideways-list");
    const container = card.locator(".sideways-list");
    await expect
      .poll(() => directLogoSliceOrder(container))
      .toEqual([3, 0, 5, 1, 4, 2]);

    const source = container.locator(".snapsort-item").first();
    const last = container.locator(".snapsort-item").last();
    const sourceRect = await itemRect(source);
    const sourceCenter = center(sourceRect);
    const lastRect = await itemRect(last);
    const target = {
      x: lastRect.x + lastRect.width + sourceRect.width / 2 + 24,
      y: lastRect.y + lastRect.height / 2,
    };

    await dragBy(
      page,
      source,
      "TypeScript slice 3",
      0,
      {
        x: target.x - sourceCenter.x,
        y: target.y - sourceCenter.y,
      },
      { steps: 140 },
    );

    await expect
      .poll(() => directLogoSliceOrder(container))
      .toEqual([0, 5, 1, 4, 2, 3]);
  });

  test("reproduces website nested bottom-slot stability", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "nested-list");
    const source = await itemByTextIn(card, "Item 1");
    const target = await itemByTextIn(card, "Item 6");
    const handle = source.locator(".demo-row-handle").first();
    const start = center(await itemRect(handle));
    const targetRect = await itemRect(target);
    const targetPoint = {
      x: targetRect.x + targetRect.width / 2,
      y: targetRect.y + targetRect.height * 1.15,
    };
    const samples = await dragBy(
      page,
      source,
      "Item 1",
      0,
      {
        x: targetPoint.x - start.x,
        y: targetPoint.y - start.y,
      },
      {
        start,
        steps: 240,
      },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("website-nested-bottom-slot-trace.json"),
      { assertCenter: false },
    );
    expectNoParentReentry(
      samples,
      "website-nested-inner",
      "website-nested-outer",
      "website core",
    );

    const states = compressedSpacerStates(samples, [
      "website-nested-inner",
      "website-nested-outer",
    ]);
    await writeJson(
      testInfo.outputPath("website-nested-bottom-slot-states.json"),
      {
        states,
        ghostTargets: ghostInsertionTargets(consoleMessages),
      },
    );
    expect(
      states,
      `ghost should reach the bottom slot of the website nested list; observed ${states.join(" -> ")}`,
    ).toContain("website-nested-inner[3]");

    const innerContainer = card.locator(".nested-list");
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Item 4", "Item 5", "Item 6", "Item 1"]);
  });

  test("reproduces website 321px multi-container row layout parity", async ({
    page,
  }, testInfo) => {
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "multiple-containers");
    const board = card.locator(".multi-container-board");
    await expect(board).toBeVisible();

    const measured = await board.evaluate((element) => {
      const number = (value: string) => Number.parseFloat(value) || 0;
      const boxOf = (node: Element): Box => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scaleX: 1,
          scaleY: 1,
          screenX: rect.x,
          screenY: rect.y,
          margin: {
            top: number(style.marginTop),
            right: number(style.marginRight),
            bottom: number(style.marginBottom),
            left: number(style.marginLeft),
          },
          padding: {
            top: number(style.paddingTop),
            right: number(style.paddingRight),
            bottom: number(style.paddingBottom),
            left: number(style.paddingLeft),
          },
          border: {
            top: number(style.borderTopWidth),
            right: number(style.borderRightWidth),
            bottom: number(style.borderBottomWidth),
            left: number(style.borderLeftWidth),
          },
        };
      };
      const columns = [...element.children].filter((child) =>
        child.classList.contains("basic-column"),
      );
      const columnBoxes = columns.map((column, index) => ({
        id: `column-${index}`,
        box: boxOf(column),
      }));
      return {
        board: boxOf(element),
        columns: columnBoxes,
        domSameRow:
          columnBoxes.length === 2 &&
          Math.abs(columnBoxes[0].box.y - columnBoxes[1].box.y) < 1,
      };
    });

    expect(measured.columns).toHaveLength(2);
    expect(
      measured.domSameRow,
      "the browser DOM should keep both columns on one row",
    ).toBe(true);

    const boardSnapshot = snapshotFixture<string>({
      value: "website-multi-container-board",
      direction: "row",
      locked: true,
      box: measured.board,
      children: measured.columns.map((column) => ({
        value: column.id,
        direction: "column",
        locked: true,
        box: column.box,
        children: [],
      })),
    });
    const origin = contentBoxOrigin(measured.board);
    const layout = flowLayoutPositions(boardSnapshot, origin.x, origin.y);
    const simulated = boardSnapshot.children.map((child) => {
      const position = layout.itemPositions.get(child);
      if (!position) {
        throw new Error(`Missing simulated position for ${child.value}`);
      }
      return { id: child.value, ...position };
    });

    await writeJson(
      testInfo.outputPath("website-321px-multi-container-layout.json"),
      {
        measured,
        simulated,
      },
    );

    expect(
      Math.abs(simulated[0].y - simulated[1].y),
      `layout engine should not wrap the second 321px column when the DOM stays on one row; simulated=${JSON.stringify(simulated)}`,
    ).toBeLessThan(1);

    const source = await itemByTextIn(card, "Spec");
    const target = await itemByTextIn(card, "Ship");
    const sourceCenter = center(await itemRect(source));
    const targetRect = await itemRect(target);
    const samples = await dragBy(
      page,
      source,
      "Spec",
      0,
      {
        x: targetRect.x + targetRect.width / 2 - sourceCenter.x,
        y: targetRect.y + targetRect.height * 1.15 - sourceCenter.y,
      },
      {
        captureFrameRects: true,
        steps: 160,
      },
    );
    const wrappedFrames = samples.flatMap((sample) => {
      const columns =
        sample.frameRects?.filter(
          (entry) =>
            entry.role === "container" &&
            (/^Left\b/.test(entry.text) || /^Right\b/.test(entry.text)),
        ) ?? [];
      if (columns.length !== 2) return [];

      const deltaY = Math.abs(columns[0].rect.y - columns[1].rect.y);
      return deltaY > 1 ? [{ step: sample.step, deltaY, columns }] : [];
    });

    await writeJson(
      testInfo.outputPath("website-321px-multi-container-drag.json"),
      {
        wrappedFrames,
        samples,
      },
    );

    expect(
      wrappedFrames,
      "left and right containers should stay on one visual row during the 321px drag",
    ).toHaveLength(0);
  });

  test("keeps website multi-container dragged item above both columns", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_website_core", {
      waitUntil: "networkidle",
    });

    const card = await websiteCoreDemo(page, "multiple-containers");
    const source = await itemByTextIn(card, "Spec");
    const target = await itemByTextIn(card, "Ship");
    await target.scrollIntoViewIfNeeded();
    const sourceRect = await source.boundingBox();
    const targetRect = await target.boundingBox();
    if (!sourceRect || !targetRect) {
      throw new Error("Expected multi-container items to have bounding boxes.");
    }
    const startPoint = {
      x: sourceRect.x + sourceRect.width * 0.25,
      y: sourceRect.y + sourceRect.height / 2,
    };
    const hoverPoint = {
      x: targetRect.x + Math.min(48, targetRect.width / 2),
      y: targetRect.y + targetRect.height / 2,
    };

    const samples = await dragBy(
      page,
      source,
      "Spec",
      0,
      {
        x: hoverPoint.x - startPoint.x,
        y: hoverPoint.y - startPoint.y,
      },
      {
        start: startPoint,
        steps: 80,
      },
    );

    const overRightColumn = samples.filter(
      (sample) =>
        sample.mouse.x >= targetRect.x &&
        sample.mouse.x <= targetRect.x + targetRect.width &&
        sample.mouse.y >= targetRect.y &&
        sample.mouse.y <= targetRect.y + targetRect.height,
    );

    expect(
      overRightColumn,
      "drag should move over the right column",
    ).not.toHaveLength(0);
    const recentSamples = JSON.stringify(overRightColumn.slice(-4));
    expect(
      overRightColumn.some(
        (sample) =>
          sample.draggedAttribute === "true" &&
          sample.draggedSourceColumnZIndex === "2" &&
          !!sample.dragged &&
          sample.dragged.x < targetRect.x + targetRect.width &&
          sample.dragged.x + sample.dragged.width > targetRect.x &&
          sample.dragged.y < targetRect.y + targetRect.height &&
          sample.dragged.y + sample.dragged.height > targetRect.y,
      ),
      `dragged item should overlap the right column from an elevated source column; observed ${recentSamples}`,
    ).toBe(true);

    await expect
      .poll(() =>
        card
          .locator(".basic-column")
          .first()
          .evaluate((element) => (element as HTMLElement).style.zIndex),
      )
      .toBe("");
  });

  test("keeps dragged item aligned while entering a slowly animating nested container", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    const samples = await dragTo(page, item, "Item 1", 0, target, {
      captureFrameRects: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-slow-animation-drag-trace.json"),
    );
    expectNoNestedParentFlicker(samples);
    expectGhostUpdatesStable(consoleMessages, 6);
  });

  test("keeps the drop animation visible while a reorder animation is still active", async ({
    page,
  }, testInfo) => {
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const innerContainer = nested.locator(".snapsort-container").nth(1);
    const source = await itemByTextIn(innerContainer, "Sub A1");
    const target = await itemByTextIn(innerContainer, "Sub A3");
    const sourceRect = await itemRect(source);
    const targetRect = await itemRect(target);
    const start = center(sourceRect);
    const releasePoint = {
      x: targetRect.x + targetRect.width / 2 + 18,
      y: targetRect.y + targetRect.height * 0.85,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 5, start.y);
    await page.waitForTimeout(16);
    for (let step = 1; step <= 14; step++) {
      await page.mouse.move(
        start.x + ((releasePoint.x - start.x) * step) / 14,
        start.y + ((releasePoint.y - start.y) * step) / 14,
      );
      await page.waitForTimeout(12);
    }

    // Prove the release happens during the condition that caused the bug:
    // at least one displaced sibling still has a reorder FLIP transform.
    await expect
      .poll(
        () =>
          innerContainer
            .locator(".snapsort-item")
            .evaluateAll((nodes) =>
              nodes.some(
                (node) =>
                  !node.textContent?.includes("Sub A1") &&
                  (node as HTMLElement).style.transform !== "",
              ),
            ),
        { intervals: [10, 20, 40], timeout: 300 },
      )
      .toBe(true);

    const releaseRect = await itemRect(source);
    await page.evaluate(() => {
      type DropFrame = {
        time: number;
        rect: Rect;
        inlineTransform: string;
        computedTransform: string;
        dragging: boolean;
        displacedTransformCount: number;
      };
      type StyleMutation = {
        time: number;
        oldValue: string | null;
        currentValue: string;
      };
      const win = window as unknown as {
        __dropContinuityTrace?: {
          done: boolean;
          frames: DropFrame[];
          styleMutations: StyleMutation[];
        };
      };
      const trace = {
        done: false,
        frames: [] as DropFrame[],
        styleMutations: [] as StyleMutation[],
      };
      win.__dropContinuityTrace = trace;

      const nested = [...document.querySelectorAll(".demo-cell")].find(
        (element) =>
          element.querySelector("h2")?.textContent?.trim() ===
          "Nested Container",
      );
      if (!nested) throw new Error("Nested Container fixture was not found.");
      const itemText = (element: Element) =>
        element.querySelector(":scope > p")?.textContent?.trim() ?? "";
      const findDraggedItem = () =>
        [...nested.querySelectorAll(".snapsort-item")].find(
          (element) => itemText(element) === "Sub A1",
        ) as HTMLElement | undefined;
      const rectOf = (element: Element): Rect => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      };
      const startedAt = performance.now();
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.target instanceof Element &&
            mutation.target.classList.contains("snapsort-item") &&
            itemText(mutation.target) === "Sub A1"
          ) {
            trace.styleMutations.push({
              time: performance.now() - startedAt,
              oldValue: mutation.oldValue,
              currentValue:
                (mutation.target as HTMLElement).getAttribute("style") ?? "",
            });
          }
        }
      });
      observer.observe(nested, {
        attributes: true,
        attributeFilter: ["style"],
        attributeOldValue: true,
        subtree: true,
      });

      const sample = () => {
        const item = findDraggedItem();
        if (item) {
          trace.frames.push({
            time: performance.now() - startedAt,
            rect: rectOf(item),
            inlineTransform: item.style.transform,
            computedTransform: getComputedStyle(item).transform,
            dragging: item.dataset.snapsortDragging === "true",
            displacedTransformCount: [
              ...nested.querySelectorAll<HTMLElement>(".snapsort-item"),
            ].filter(
              (element) =>
                element !== item &&
                !element.id.includes("spacer") &&
                element.style.transform !== "",
            ).length,
          });
        }
        if (performance.now() - startedAt < 1_050) {
          requestAnimationFrame(sample);
          return;
        }
        observer.disconnect();
        trace.done = true;
      };
      requestAnimationFrame(sample);
    });

    await page.mouse.up();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (
                window as unknown as {
                  __dropContinuityTrace?: { done: boolean };
                }
              ).__dropContinuityTrace?.done ?? false,
          ),
        { timeout: 2_000 },
      )
      .toBe(true);

    const trace = await page.evaluate(
      () =>
        (
          window as unknown as {
            __dropContinuityTrace: {
              done: boolean;
              frames: Array<{
                time: number;
                rect: Rect;
                inlineTransform: string;
                computedTransform: string;
                dragging: boolean;
                displacedTransformCount: number;
              }>;
              styleMutations: Array<{
                time: number;
                oldValue: string | null;
                currentValue: string;
              }>;
            };
          }
        ).__dropContinuityTrace,
    );
    await writeJson(
      testInfo.outputPath("drop-animation-continuity-trace.json"),
      { releaseRect, ...trace },
    );

    const postDropFrames = trace.frames.filter((frame) => !frame.dragging);
    expect(postDropFrames.length).toBeGreaterThan(20);
    const finalFrame = postDropFrames.at(-1)!;
    const centerDistance = (a: Rect, b: Rect) => {
      const aCenter = center(a);
      const bCenter = center(b);
      return Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y);
    };
    const travel = centerDistance(releaseRect, finalFrame.rect);
    expect(travel).toBeGreaterThan(12);

    const firstPaintedDropFrame = postDropFrames[0];
    expect(
      centerDistance(firstPaintedDropFrame.rect, releaseRect),
      "the first painted drop frame should remain at the pointer release position",
    ).toBeLessThan(Math.max(4, travel * 0.15));
    expect(
      postDropFrames.some((frame) => frame.inlineTransform !== ""),
      "the drop FLIP transform should remain visible after release",
    ).toBe(true);

    const distancesToFinal = postDropFrames.map((frame) =>
      centerDistance(frame.rect, finalFrame.rect),
    );
    const firstSettledFrame = distancesToFinal.findIndex(
      (distance) => distance <= 1,
    );
    if (firstSettledFrame !== -1) {
      expect(
        Math.max(...distancesToFinal.slice(firstSettledFrame)),
        "the item must not reach its slot and then bounce away again",
      ).toBeLessThanOrEqual(2);
    }

    expect(finalFrame.inlineTransform).toBe("");
    await expect(source).not.toHaveAttribute("data-snapsort-dragging");
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A2", "Sub A3", "Sub A1"]);
  });

  test("keeps nested dragged item aligned while moving in and out of its container", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const innerContainer = nested.locator(".snapsort-container").nth(1);
    const item = await itemByTextIn(nested, "Sub A1");
    const activeId = await item.getAttribute("data-engine-id");
    const start = center(await itemRect(item));
    const innerRect = await itemRect(innerContainer);
    const leftOutside = {
      x: innerRect.x - 28,
      y: start.y,
    };
    const innerCenter = {
      x: innerRect.x + innerRect.width / 2,
      y: start.y,
    };
    const path = [leftOutside, innerCenter, leftOutside, innerCenter];
    const samples: DragSample[] = [];
    let previous = start;

    await page.evaluate(
      ({ activeId }) => {
        const win = window as unknown as {
          __snapsortActiveText?: string;
          __snapsortActiveIndex?: number;
          __snapsortActiveId?: string;
        };
        win.__snapsortActiveText = "Sub A1";
        win.__snapsortActiveIndex = 0;
        win.__snapsortActiveId = activeId ?? "";
      },
      { activeId },
    );
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y);
    await page.waitForTimeout(16);

    for (const point of path) {
      for (let step = 1; step <= 24; step++) {
        const ratio = step / 24;
        const mouse = {
          x: previous.x + (point.x - previous.x) * ratio,
          y: previous.y + (point.y - previous.y) * ratio,
        };
        await page.mouse.move(mouse.x, mouse.y);
        await page.waitForTimeout(8);
        samples.push(
          await collectSample(page, samples.length + 1, mouse, {
            captureFrameRects: true,
          }),
        );
      }
      previous = point;
    }

    await page.mouse.up();
    await page.waitForTimeout(100);

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-in-out-drag-trace.json"),
    );
  });

  test("drops at the pending nested index after a quick same-container slot change", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const subA1 = await itemByTextIn(nested, "Sub A1");
    const subA3 = await itemByTextIn(nested, "Sub A3");
    const itemCenter = center(await itemRect(item));
    const subA1Center = center(await itemRect(subA1));
    const subA3Rect = await itemRect(subA3);
    const subA3AfterPoint = {
      x: subA3Rect.x + subA3Rect.width / 2,
      y: subA3Rect.y + subA3Rect.height * 0.85,
    };

    await page.mouse.move(itemCenter.x, itemCenter.y);
    await page.mouse.down();
    await page.mouse.move(itemCenter.x, itemCenter.y + 6);
    await page.waitForTimeout(16);
    await page.mouse.move(subA1Center.x, subA1Center.y);
    await page.waitForTimeout(24);
    await page.mouse.move(subA3AfterPoint.x, subA3AfterPoint.y);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });

  test("commits the hovered nested slot without animation", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const subA1 = await itemByTextIn(nested, "Sub A1");
    const target = await itemByTextIn(nested, "Sub A3");
    const itemCenter = center(await itemRect(item));
    const subA1Center = center(await itemRect(subA1));

    await page.mouse.move(itemCenter.x, itemCenter.y);
    await page.mouse.down();
    await page.mouse.move(itemCenter.x, itemCenter.y + 6);
    await page.waitForTimeout(16);
    await page.mouse.move(subA1Center.x, subA1Center.y);
    await page.waitForTimeout(120);

    const movedTargetRect = await itemRect(target);
    await page.mouse.move(
      movedTargetRect.x + movedTargetRect.width / 2,
      movedTargetRect.y + movedTargetRect.height * 0.85,
    );
    await page.mouse.up();
    await page.waitForTimeout(200);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });

  test("commits the hovered slot in a compact nested list", async ({
    page,
  }) => {
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&compactNested=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Compact Nested List");
    const item = await itemByTextIn(nested, "Overview");
    const target = await itemByTextIn(nested, "Container");
    await dragToItemFraction(page, item, "Overview", 0, target, 0.5, {
      steps: 20,
    });

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Container", "Overview", "Item", "Handle"]);
  });

  test("moves a nested item to the parent slot above its nested container", async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const outerContainer = nested.locator(".snapsort-container").first();
    const innerContainer = nested.locator(".snapsort-container").nth(1);
    const item = await itemByTextIn(nested, "Sub A1");
    const itemCenter = center(await itemRect(item));
    const innerRect = await itemRect(innerContainer);
    const targetPoint = {
      x: itemCenter.x - 12,
      y: innerRect.y - 2,
    };
    await dragBy(
      page,
      item,
      "Sub A1",
      0,
      {
        x: targetPoint.x - itemCenter.x,
        y: targetPoint.y - itemCenter.y,
      },
      { steps: 120 },
    );

    await expect
      .poll(() => directSnapSortChildTexts(outerContainer))
      .toEqual([
        "Item 1",
        "Item 1.5",
        "Sub A1",
        "Sub A2Sub A3",
        "Item 2",
        "Item 3",
      ]);
    expect(
      consoleMessages.filter((message) =>
        /Missing drag snapshot|Unhandled|TypeError|ReferenceError/i.test(
          message,
        ),
      ),
    ).toHaveLength(0);
  });

  test("commits the hovered slot inside a locked nested container without animation", async ({
    page,
  }) => {
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&lockNestedChild=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    await dragToItemFraction(page, item, "Item 1", 0, target, 0.85);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });

  test("places an item below a projected locked nested container without entering it", async ({
    page,
  }) => {
    await page.goto(
      "/?demo=drop_snap_nested&disableNestedFlip=1&lockNestedChild=1",
      {
        waitUntil: "networkidle",
      },
    );

    const nested = await demoBoxByHeading(page, "Nested Container");
    const outerContainer = nested.locator(".snapsort-container").first();
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Item 2");
    await dragToItemFraction(page, item, "Item 1", 0, target, 0.5, {
      steps: 70,
    });

    await expect
      .poll(() => directSnapSortChildTexts(outerContainer))
      .toEqual([
        "Item 1.5",
        "Sub A1Sub A2Sub A3",
        "Item 2",
        "Item 1",
        "Item 3",
      ]);
  });

  test("commits the first nested item slot without animation", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&disableNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A1");
    await dragToItemFraction(page, item, "Item 1", 0, target, 1.05, {
      steps: 70,
    });

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Item 1", "Sub A2", "Sub A3"]);
  });

  test("commits the hovered nested slot while animation moves the container", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested&slowNestedFlip=1", {
      waitUntil: "networkidle",
    });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    await dragToItemFraction(page, item, "Item 1", 0, target, 0.85);

    const innerContainer = nested.locator(".snapsort-container").nth(1);
    await expect(innerContainer).toBeVisible();
    await expect
      .poll(() => directSnapSortItemTexts(innerContainer))
      .toEqual(["Sub A1", "Sub A2", "Sub A3", "Item 1"]);
  });

  test("updates framework state when SnapSort move callbacks reorder an array list", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components", {
      waitUntil: "networkidle",
    });

    const list = await componentArrayList(page);
    const kanbanPanel = page.locator(".kanban-panel");
    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );

    await kanbanPanel.getByRole("button", { name: "Add Item" }).click();
    await expect(page.locator(".demo-header p")).toHaveText(
      "7 Euclidean cards plus Progressive sentence demos",
    );
    await expect(list.locator(".task-card")).toHaveCount(5);

    const deleteButton = page.getByRole("button", { name: "Delete Task 7" });
    await deleteButton.click();
    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );
    await expect(list.locator(".task-card")).toHaveCount(4);

    const upwardItem = await itemByTextIn(list, "Search filters");
    const upwardItemRect = await itemRect(upwardItem);
    const upwardItemCenter = center(upwardItemRect);
    const upwardTarget = await itemByTextIn(list, "Invite flow");
    const upwardTargetCenter = center(await itemRect(upwardTarget));

    await dragBy(
      page,
      upwardItem,
      "Search filters",
      0,
      {
        x: 0,
        y: upwardTargetCenter.y - upwardItemCenter.y - 24,
      },
      {
        start: {
          x: upwardItemRect.x + 24,
          y: upwardItemCenter.y,
        },
      },
    );

    await expect(list.locator(".task-card .task-main strong")).toHaveText([
      "Profile fields",
      "Search filters",
      "Invite flow",
      "Audit log",
    ]);

    await kanbanPanel.getByRole("button", { name: "Reset" }).click();
    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );

    const item = await itemByTextIn(list, "Profile fields");
    const itemRectValue = await itemRect(item);
    const itemCenter = center(itemRectValue);
    const target = await itemByTextIn(list, "Search filters");
    const targetCenter = center(await itemRect(target));

    await dragBy(
      page,
      item,
      "Profile fields",
      0,
      {
        x: 0,
        y: targetCenter.y - itemCenter.y + 16,
      },
      {
        start: {
          x: itemRectValue.x + 24,
          y: itemCenter.y,
        },
      },
    );

    await expect(
      page.locator(".task-card").filter({ hasText: "Profile fields" }),
    ).toHaveCount(1);

    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );
    await expect(list.locator(".task-card .task-main strong")).toHaveText([
      "Invite flow",
      "Audit log",
      "Search filters",
      "Profile fields",
    ]);
  });

  test("animates a component card moving between columns with SnapEngine FLIP", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components", {
      waitUntil: "networkidle",
    });

    await page.evaluate(() => {
      const win = window as typeof window & {
        __snapsortMoveComponentItem?: (
          itemId: string,
          direction: -1 | 1,
        ) => void;
      };
      win.__snapsortMoveComponentItem?.("item-1", 1);
    });

    const animated = await page.evaluate(async () => {
      for (let frame = 0; frame < 10; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const animatedCard = [...document.querySelectorAll(".task-card")].find(
          (element) =>
            /^translate3d\(-?\d/.test((element as HTMLElement).style.transform),
        );
        if (animatedCard) {
          return true;
        }
      }
      return false;
    });

    expect(animated).toBe(true);

    const panels = page.locator(".list-panel");
    await expect(
      panels.nth(0).locator(".task-card .task-main strong"),
    ).toHaveText(["Invite flow", "Audit log", "Search filters"]);
    await expect(
      panels.nth(1).locator(".task-card .task-main strong"),
    ).toHaveText(["Profile fields", "Board polish"]);
  });

  test("resets pooled animation variables before a channel is reused", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components", {
      waitUntil: "networkidle",
    });

    const animationModuleUrl = `/@fs${process.cwd()}/src/animation.ts`;
    const result = await page.evaluate(async (moduleUrl) => {
      const { AnimationObject } = await import(/* @vite-ignore */ moduleUrl);
      const target = document.createElement("div");
      document.body.appendChild(target);

      const first = new AnimationObject(
        target,
        { $value: [0, 1] },
        { duration: 40 },
      );
      first.play();
      for (let frame = 0; frame < 20 && !first.requestDelete; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }

      const propertiesAfterFinish = Array.from(target.style).filter((name) =>
        name.startsWith("--snap-var-"),
      );
      const samples: number[] = [];
      const second = new AnimationObject(
        target,
        { $value: [0.25, 0.75] },
        {
          duration: 800,
          tick: (values: Record<string, number>) => samples.push(values.$value),
        },
      );
      const acquiredProperties = Array.from(target.style)
        .filter((name) => name.startsWith("--snap-var-"))
        .map((name) => target.style.getPropertyValue(name));
      second.play();
      second.progress = 0;
      second.calculateFrame(performance.now());
      second.cancel();
      target.remove();

      return {
        acquiredProperties,
        firstSample: samples[0] ?? null,
        propertiesAfterFinish,
      };
    }, animationModuleUrl);

    expect(result.propertiesAfterFinish).toEqual([]);
    expect(result.acquiredProperties).toHaveLength(1);
    expect(Number(result.acquiredProperties[0])).toBeCloseTo(0.25);
    expect(result.firstSample).toBeCloseTo(0.25);
  });

  test("installs the drop inverse before the first post-release paint", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components&slowFlip=1", {
      waitUntil: "networkidle",
    });

    const moveComponentItem = async (direction: -1 | 1) => {
      await page.evaluate((nextDirection) => {
        const win = window as typeof window & {
          __snapsortMoveComponentItem?: (
            itemId: string,
            direction: -1 | 1,
          ) => void;
        };
        win.__snapsortMoveComponentItem?.("item-1", nextDirection);
      }, direction);
    };
    await moveComponentItem(1);
    await page.waitForTimeout(900);
    await moveComponentItem(-1);
    await page.waitForTimeout(900);

    const card = page
      .locator(".task-card:not(.ghost)")
      .filter({ hasText: "Profile fields" });
    const target = page
      .locator(".task-card:not(.ghost)")
      .filter({ hasText: "Board polish" });
    const start = center(await itemRect(card.locator(".task-drag-handle")));
    const targetRect = await itemRect(target);
    const releasePoint = {
      x: targetRect.x + targetRect.width / 2,
      y: targetRect.y + targetRect.height * 0.8,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 5, start.y);
    await page.waitForTimeout(16);
    await page.mouse.move(releasePoint.x, releasePoint.y, { steps: 24 });
    await page.waitForTimeout(80);
    const releaseRect = await itemRect(card);

    await page.evaluate(() => {
      const win = window as typeof window & {
        __dropFlipSamples?: Array<{
          column: string;
          transform: string;
          x: number;
          y: number;
        }>;
      };
      win.__dropFlipSamples = [];
      window.addEventListener(
        "pointerup",
        () => {
          let frame = 0;
          const sample = () => {
            const card = [
              ...document.querySelectorAll<HTMLElement>(
                ".task-card:not(.ghost)",
              ),
            ].find((element) =>
              element.textContent?.includes("Profile fields"),
            );
            if (card) {
              const rect = card.getBoundingClientRect();
              win.__dropFlipSamples?.push({
                column:
                  card
                    .closest(".list-panel")
                    ?.querySelector("h2")
                    ?.textContent?.trim() ?? "",
                transform: card.style.transform,
                x: rect.x,
                y: rect.y,
              });
            }
            frame++;
            if (frame < 12) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        },
        { capture: true, once: true },
      );
    });

    await page.mouse.up();
    await page.waitForTimeout(250);
    const samples = await page.evaluate(() => {
      const win = window as typeof window & {
        __dropFlipSamples?: Array<{
          column: string;
          transform: string;
          x: number;
          y: number;
        }>;
      };
      return win.__dropFlipSamples ?? [];
    });
    await page.waitForTimeout(700);
    const finalRect = await itemRect(card);
    const activeSamples = samples.filter(
      (sample) => sample.column === "Active",
    );
    expect(activeSamples.length).toBeGreaterThan(1);
    expect(activeSamples[0].transform).toMatch(/^translate3d\(/);

    const distanceTo = (sample: { x: number; y: number }, rect: Rect) =>
      Math.hypot(sample.x - rect.x, sample.y - rect.y);
    expect(distanceTo(activeSamples[0], releaseRect)).toBeLessThan(8);
    expect(distanceTo(activeSamples[0], finalRect)).toBeGreaterThan(12);

    const distancesToFinal = activeSamples.map((sample) =>
      distanceTo(sample, finalRect),
    );
    for (let index = 1; index < distancesToFinal.length; index++) {
      expect(distancesToFinal[index]).toBeLessThanOrEqual(
        distancesToFinal[index - 1] + 3,
      );
    }
  });

  test("does not flicker the spacer backward while dragging down a vertical column", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const verticalColumn = await demoBoxByHeading(page, "Vertical Column");
    const item = await itemByTextIn(verticalColumn, "Item 1");
    const target = await itemByTextIn(verticalColumn, "Item 4");
    const itemCenter = center(await itemRect(item));
    const targetCenter = center(await itemRect(target));
    const samples = await dragBy(page, item, "Item 1", 0, {
      x: 0,
      y: targetCenter.y - itemCenter.y + 48,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("vertical-column-flicker-trace.json"),
    );
    expectNoSpacerBacktrack(samples, "y");
    expectNoSpacerOscillation(samples);
    expectGhostUpdatesStable(consoleMessages, 5);
  });

  test("does not flicker the spacer upward while dragging into a wrapped horizontal row", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const horizontalRow = await demoBoxByHeading(page, "Horizontal Row");
    const item = await itemByTextIn(horizontalRow, "Item 1");
    const target = await itemByTextIn(horizontalRow, "Item 4");
    const itemCenter = center(await itemRect(item));
    const targetCenter = center(await itemRect(target));
    const samples = await dragBy(page, item, "Item 1", 0, {
      x: 0,
      y: targetCenter.y - itemCenter.y,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("horizontal-row-wrap-flicker-trace.json"),
    );
    expectNoSpacerBacktrack(samples, "y");
    expectNoSpacerOscillation(samples);
    expectGhostUpdatesStable(consoleMessages, 3);
  });

  test("does not flicker out of a nested column after entering it", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const target = await itemByTextIn(nested, "Sub A3");
    const samples = await dragTo(page, item, "Item 1", 0, target);

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-container-flicker-trace.json"),
      { assertCenter: false },
    );
    expectNoNestedParentFlicker(samples);
    expectGhostUpdatesStable(consoleMessages, 6);
  });

  test("can reach nested column boundary slots while dragging root item downward", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const nested = await demoBoxByHeading(page, "Nested Container");
    const item = await itemByTextIn(nested, "Item 1");
    const item3 = await itemByTextIn(nested, "Item 3");
    const itemCenter = center(await itemRect(item));
    const item3Center = center(await itemRect(item3));
    const samples = await dragBy(
      page,
      item,
      "Item 1",
      0,
      {
        x: 0,
        y: item3Center.y - itemCenter.y + 96,
      },
      { steps: 240 },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-boundary-slots-trace.json"),
      { assertCenter: false },
    );

    const states = compressedSpacerStates(samples);
    const ghostTargets = ghostInsertionTargets(consoleMessages);
    await writeJson(testInfo.outputPath("nested-boundary-slots-states.json"), {
      states,
      ghostTargets,
    });

    expect(
      states,
      `ghost should visit nested container boundary slots; observed ${states.join(" -> ")}`,
    ).toEqual(expect.arrayContaining(["nested-inner[0]", "nested-inner[3]"]));
  });

  test("creates a spacer when dragging a sub-container as an item", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const cell = await demoBoxByHeading(page, "Draggable Sub-Containers");
    const source = cell
      .locator(".snapsort-container .snapsort-container")
      .filter({ hasText: "Group 1 - A" })
      .first();
    await expect(source).toBeVisible();
    const target = await itemByTextIn(cell, "Loose Item");
    const sourceRect = await itemRect(source);
    const targetCenter = center(await itemRect(target));
    const start = { x: sourceRect.x + 8, y: sourceRect.y + 8 };
    const samples = await dragBy(
      page,
      source,
      "Group 1",
      0,
      {
        x: targetCenter.x - start.x,
        y: targetCenter.y - start.y,
      },
      { start, assertCenter: false },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("drag-container-trace.json"),
      { assertCenter: false },
    );
    expect(
      samples.some((sample) => sample.spacerCount === 1 && sample.spacer),
      "dragging a sub-container should create and move a spacer",
    ).toBe(true);
  });

  test("keeps layer-panel ghost aligned below a labeled sub-container", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const layers = await demoBoxByHeading(page, "Layers Panel");
    const header = await itemByTextIn(layers, "Header");
    const hero = layers
      .locator(".snapsort-container")
      .filter({ hasText: "Hero Section" })
      .nth(1);
    await expect(hero).toBeVisible();
    const headerRect = await itemRect(header);
    const headerCenter = center(headerRect);
    const heroRect = await itemRect(hero);
    const targetCenterY =
      heroRect.y + heroRect.height + headerRect.height / 2 + 12;
    const samples = await dragBy(
      page,
      header,
      "Header",
      0,
      {
        x: 0,
        y: targetCenterY - headerCenter.y,
      },
      { steps: 240 },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("layers-panel-offset-trace.json"),
      { assertCenter: false },
    );
    expectSpacerAlignedAfterPrevious(samples, "layers-root", /Hero Section/);
    expectSpacerNearDragged(samples, "layers-root", 48);
  });

  test("keeps draggable sub-container ghost aligned after resized groups", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

    const cell = await demoBoxByHeading(page, "Draggable Sub-Containers");
    const group1B = await itemByTextIn(cell, "Group 1 - B");
    const group2 = cell
      .locator(".snapsort-container")
      .filter({ hasText: "Group 2 - A" })
      .nth(1);
    await expect(group2).toBeVisible();
    const group1BRect = await itemRect(group1B);
    const group1BCenter = center(group1BRect);
    const group2Rect = await itemRect(group2);
    const targetCenterY =
      group2Rect.y + group2Rect.height + group1BRect.height / 2 + 12;
    const samples = await dragBy(
      page,
      group1B,
      "Group 1 - B",
      0,
      {
        x: 0,
        y: targetCenterY - group1BCenter.y,
      },
      { steps: 240 },
    );

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("drag-subcontainer-offset-trace.json"),
      { assertCenter: false },
    );
    expectSpacerAlignedAfterPrevious(samples, "drag-root", /Group 2 - A/);
    expectSpacerNearDragged(samples, "drag-root", 48);
  });

  test("keeps one stable spacer while reordering a flat nested-items list", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    await page.screenshot({
      path: testInfo.outputPath("nested-flat-before.png"),
      fullPage: true,
    });

    const item = await itemByText(page, "Item B");
    const samples = await dragBy(page, item, "Item B", 0, { x: 0, y: 110 });
    await page.screenshot({
      path: testInfo.outputPath("nested-flat-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-flat-trace.json"),
    );
  });

  test("keeps nested container drop prediction stable for padded sub-items", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    await page.screenshot({
      path: testInfo.outputPath("nested-subitem-before.png"),
      fullPage: true,
    });

    const item = await itemByText(page, "Sub A2");
    const samples = await dragBy(page, item, "Sub A2", 0, { x: 0, y: 95 });
    await page.screenshot({
      path: testInfo.outputPath("nested-subitem-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("nested-subitem-trace.json"),
    );
  });

  test("resolves multiple-drop-area container conflicts without spacer flicker", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    await page.screenshot({
      path: testInfo.outputPath("multi-area-before.png"),
      fullPage: true,
    });

    const item = await itemByText(page, "Item B");
    const target = await itemByText(page, "Item Y");
    const samples = await dragTo(page, item, "Item B", 0, target);
    await page.screenshot({
      path: testInfo.outputPath("multi-area-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("multi-area-trace.json"),
    );
  });

  test("keeps wrapped row indices aligned beyond the first row", async ({
    page,
  }, testInfo) => {
    const consoleMessages: string[] = [];
    page.on("console", (message) => consoleMessages.push(message.text()));
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    const doubleRow = await demoBoxByHeading(page, "Horizontal Double Row");
    await page.screenshot({
      path: testInfo.outputPath("wrapped-row-before.png"),
      fullPage: true,
    });

    const item = await itemByTextIn(doubleRow, "Item 1");
    const target = await itemByTextIn(doubleRow, "Item 9");
    const samples = await dragTo(page, item, "Item 1", 0, target);
    await page.screenshot({
      path: testInfo.outputPath("wrapped-row-after.png"),
      fullPage: true,
    });

    await expectStableDrag(
      page,
      samples,
      consoleMessages,
      testInfo.outputPath("wrapped-row-trace.json"),
    );

    const order = await doubleRow
      .locator(".snapsort-item")
      .evaluateAll((elements) =>
        elements.map((element) => element.textContent?.trim()),
      );
    expect(order.slice(0, 10)).toEqual([
      "Item 2",
      "Item 3",
      "Item 4",
      "Item 5",
      "Item 6",
      "Item 7",
      "Item 8",
      "Item 9",
      "Item 1",
      "Item 10",
    ]);
  });

  test("renders one ghost per member (not a merged group ghost) during a multi-item drag", async ({
    page,
  }) => {
    await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });
    const column = await demoBoxByHeading(page, "Vertical Column");

    // Multi-select Item 2 + Item 3 (cmd/ctrl-click), then drag the pair down.
    const item2 = await itemByTextIn(column, "Item 2");
    const item3 = await itemByTextIn(column, "Item 3");
    await item2.click();
    await item3.click({ modifiers: ["Meta"] });

    const start = center(await itemRect(item2));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y + 4);
    await page.waitForTimeout(60);

    let ghostCountMidDrag = 0;
    for (let step = 1; step <= 14; step++) {
      await page.mouse.move(start.x, start.y + 120 * (step / 14));
      await page.waitForTimeout(20);
      ghostCountMidDrag = await page.evaluate(
        () => document.querySelectorAll("#spacer").length,
      );
    }

    // The two dragged members must each get their own ghost anchor — the core
    // no longer collapses the group into a single merged spacer.
    expect(ghostCountMidDrag).toBe(2);

    await page.mouse.up();
    await page.waitForTimeout(300);

    // Ghosts are cleaned up and the pair lands as a contiguous run.
    expect(
      await page.evaluate(() => document.querySelectorAll("#spacer").length),
    ).toBe(0);
    const order = await column
      .locator(".snapsort-item")
      .evaluateAll((elements) =>
        elements.map((element) => element.textContent?.trim()),
      );
    expect(order).toEqual(["Item 1", "Item 4", "Item 2", "Item 3"]);
  });
});
