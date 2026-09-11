// DOM-free SnapSort fixtures shared by the drop-resolution unit tests and
// the e2e suites: frozen boxes, item snapshots, and mock items/containers.
import { type ElementBox, type Rect } from "../../src/geometry";
import { type ItemSnapshot } from "../../assets/snapsort/src/snapshot";
import { rejectDrop } from "../../assets/snapsort/src/callbacks";
import { type DropPriorityEvent } from "../../assets/snapsort/src/events";
import { flowLayoutPositions } from "./layout-grid";

export type Box = ElementBox;

export type MockSnapSortItem = {
  id: string;
  itemId: string;
  metadata: Record<string, unknown>;
  direction: "row" | "column";
  mainAxisAlign: "start";
  locked: boolean;
  isGhost: boolean;
  parent?: MockSnapSortItem | null;
  callbacks?: {
    getDropPriority?: (event: DropPriorityEvent) => number | undefined;
  };
  dropPriority?: number;
  dragSnapshot: ItemSnapshot<MockSnapSortItem>;
  box: Box;
  itemOrderedList: MockSnapSortItem[];
  children: MockSnapSortItem[];
  worldTransform: { x: number; y: number; scaleX: number; scaleY: number };
  dragPositionX: number;
  dragPositionY: number;
  dragPointerPosition: { x: number; y: number } | null;
  depth: number;
  name?: string;
  config?: Record<string, unknown>;
  numberOfItems?: number;
  getIndexAndContainer?: () => {
    container: MockSnapSortItem | null | undefined;
    index: number;
  };
  addDebugRect: () => void;
  addDebugCircle: () => void;
  addDebugLine: () => void;
  addDebugText: () => void;
  clearDebugMarker: () => void;
};

export function center(rect: Rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function layoutBox(
  rect: Rect,
  margin: Partial<Box["margin"]> = {},
  padding: Partial<Box["padding"]> = {},
  border: Partial<Box["border"]> = {},
): Box {
  return {
    ...rect,
    screen: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
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

export function itemSnapshot<T>(
  value: T,
  box: Box,
  children: ItemSnapshot<T>[] = [],
  direction: "row" | "column" = "column",
): ItemSnapshot<T> {
  return {
    value,
    itemId: String(value),
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

export type SnapshotFixture<T> = Omit<
  ItemSnapshot<T>,
  | "itemId"
  | "metadata"
  | "mainAxisAlign"
  | "layoutModel"
  | "wrap"
  | "stretchItems"
  | "children"
> & {
  itemId?: string;
  metadata?: ItemSnapshot<T>["metadata"];
  mainAxisAlign?: ItemSnapshot<T>["mainAxisAlign"];
  layoutModel?: ItemSnapshot<T>["layoutModel"];
  wrap?: ItemSnapshot<T>["wrap"];
  stretchItems?: ItemSnapshot<T>["stretchItems"];
  children: SnapshotFixture<T>[];
};

export function snapshotFixture<T>(
  fixture: SnapshotFixture<T>,
): ItemSnapshot<T> {
  return {
    ...fixture,
    itemId: fixture.itemId ?? String(fixture.value),
    metadata: fixture.metadata ?? {},
    mainAxisAlign: fixture.mainAxisAlign ?? "start",
    layoutModel: fixture.layoutModel ?? "flow",
    wrap: fixture.wrap ?? "auto",
    stretchItems: fixture.stretchItems ?? false,
    children: fixture.children.map(snapshotFixture),
  };
}

export function mockSnapSortItem(
  id: string,
  rect: Rect,
  children: MockSnapSortItem[] = [],
  direction: "row" | "column" = "column",
): MockSnapSortItem {
  const box = layoutBox(rect);
  const item: MockSnapSortItem = {
    id,
    itemId: id,
    metadata: {},
    direction,
    mainAxisAlign: "start",
    locked: false,
    isGhost: false,
    parent: null,
    callbacks: undefined,
    dropPriority: 0,
    dragSnapshot: null as unknown as ItemSnapshot<MockSnapSortItem>,
    box,
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
  item.getIndexAndContainer = () => {
    const container = item.parent;
    return {
      container,
      index: container ? container.itemOrderedList.indexOf(item) : -1,
    };
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

export function mockSnapSortContainer(
  id: string,
  rect: Rect,
  children: MockSnapSortItem[],
  direction: "row" | "column",
): MockSnapSortItem {
  const item = mockSnapSortItem(id, rect, children, direction);
  item.config = {};
  item.name = id;
  item.numberOfItems = children.length;
  return item;
}

export function dropPriorityFixture() {
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
  root.callbacks = { getDropPriority: rejectDrop };
  return { dragged, source, near, far, root };
}

export function virtualInsertionPosition<T>(
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
  const rect = flowLayoutPositions(container, startX, startY, {
    exclude: (node) => node === dragged,
    insertions: [insertion],
  }).virtualRects.get(insertion);
  return rect ? { x: rect.x, y: rect.y } : null;
}
