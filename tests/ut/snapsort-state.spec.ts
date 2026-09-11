import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { determineSwapDropTarget } from "../../assets/snapsort/src/algorithm";
import { createVanillaAdapter } from "../../assets/snapsort/src/adapter";
import {
  Container,
  type ContainerOptions,
} from "../../assets/snapsort/src/container";
import { builtinStrategies } from "../../assets/snapsort/src/drag/drop-strategy";
import { directCandidateGeometry } from "../../assets/snapsort/src/drag/direct-candidates";
import { DragSessionController as DragSession } from "../../assets/snapsort/src/drag/session";
import {
  getDragSessionController,
  installDragSession,
} from "../../assets/snapsort/src/drag/session-store";
import {
  removePointerPreview,
  startPointerPreview,
  updatePointerPreview,
} from "../../assets/snapsort/src/drag/pointer-preview";
import { buildGhostSlotLocation } from "../../assets/snapsort/src/event-builders";
import type { DropPriorityEvent } from "../../assets/snapsort/src/events";
import { Item } from "../../assets/snapsort/src/item";
import { KeyboardDragController } from "../../assets/snapsort/src/keyboard-controller";
import { readVisualRect } from "../../assets/snapsort/src/internal/visual-rect";
import { placeItemAt } from "../../assets/snapsort/src/internal/tree-mutation";

type DomGlobal =
  | "window"
  | "document"
  | "HTMLElement"
  | "Element"
  | "Node"
  | "DOMRect"
  | "ResizeObserver"
  | "MutationObserver";

interface StateHarness {
  document: Document;
  engine: any;
  global: any;
  cleanup(): void;
}

type TestContainerOptions = Omit<ContainerOptions, "itemId">;

function createStateHarness(): StateHarness {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const descriptors = new Map<DomGlobal, PropertyDescriptor | undefined>();
  class ObserverStub {
    observe() {}
    disconnect() {}
  }
  const globals: Record<DomGlobal, unknown> = {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    DOMRect: dom.window.DOMRect,
    ResizeObserver: ObserverStub,
    MutationObserver: ObserverStub,
  };
  for (const [key, value] of Object.entries(globals) as Array<
    [DomGlobal, unknown]
  >) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  let nextId = 0;
  const objectTable: Record<string, unknown> = {};
  const queue = {
    READ_1: new Map(),
    WRITE_1: new Map(),
    READ_2: new Map(),
    WRITE_2: new Map(),
    READ_3: new Map(),
    WRITE_3: new Map(),
  };
  const engine: any = {
    camera: null,
    collisionEngine: null,
    debugMarkerList: {},
    global: null,
    input: {
      registerObjectElement() {},
      subscribeGlobalCursorEvent() {},
      unregisterObjectElement() {},
      unsubscribeGlobalCursorEvent() {},
    },
  };
  const global: any = {
    currentStage: "IDLE",
    data: {},
    queue,
    createId: () => `snapsort-state-${++nextId}`,
    getEngineObjectTable: (candidate: unknown) =>
      candidate === engine ? objectTable : {},
    registerObject: (object: { id: string }) => {
      objectTable[object.id] = object;
    },
    unregisterObject: (object: { id: string }) => {
      delete objectTable[object.id];
    },
  };
  engine.global = global;

  return {
    document: dom.window.document,
    engine,
    global,
    cleanup() {
      for (const [key, descriptor] of descriptors) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          delete (globalThis as Record<string, unknown>)[key];
        }
      }
      dom.window.close();
    },
  };
}

function setRect(
  element: HTMLElement,
  {
    x,
    y,
    width,
    height,
  }: { x: number; y: number; width: number; height: number },
): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(x, y, width, height),
  });
}

function bindElement(
  harness: StateHarness,
  item: Item,
  parent: HTMLElement,
  id: string,
  rect = { x: 0, y: 0, width: 40, height: 40 },
): HTMLElement {
  const element = harness.document.createElement("div");
  element.dataset.testItem = id;
  setRect(element, rect);
  parent.append(element);
  item.element = element;
  return element;
}

function mountRoot(
  harness: StateHarness,
  id = "root",
  config: TestContainerOptions = {},
): Container {
  const root = new Container(harness.engine, null, { ...config, itemId: id });
  const element = harness.document.createElement("div");
  setRect(element, { x: 0, y: 0, width: 600, height: 600 });
  harness.document.body.append(element);
  root.element = element;
  return root;
}

function mountContainer(
  harness: StateHarness,
  parent: Container,
  id: string,
  rect = { x: 0, y: 0, width: 240, height: 240 },
  config: TestContainerOptions = {},
): Container {
  const container = new Container(harness.engine, parent, {
    ...config,
    itemId: id,
  });
  bindElement(harness, container, parent.element!, id, rect);
  parent.attachItem(container);
  return container;
}

function mountItem(
  harness: StateHarness,
  parent: Container,
  id: string,
  rect = { x: 0, y: 0, width: 40, height: 40 },
): Item {
  const item = new Item(harness.engine, null, { itemId: id });
  bindElement(harness, item, parent.element!, id, rect);
  parent.attachItem(item);
  return item;
}

function makeSession(
  root: Container,
  item: Item,
  pointerId = 1,
  mode: keyof typeof builtinStrategies = "euclidean",
): DragSession {
  const source = item.getIndexAndContainer();
  if (!source.container) throw new Error("Test item is not attached");
  return new DragSession(
    root,
    [item],
    [
      {
        container: source.container,
        containerMetadata: source.container.metadata,
        index: source.index,
      },
    ],
    builtinStrategies[mode],
    {
      inputType: "pointer",
      prop: {
        handoffTo() {},
        pointerId,
        start: { x: 20, y: 20 },
      } as never,
    },
    item,
  );
}

function attemptItemDrag(item: Item): void {
  item.dragStart({
    objectId: item.id,
    pointerId: 1,
    start: {
      x: 0,
      y: 0,
      cameraX: 0,
      cameraY: 0,
      screenX: 0,
      screenY: 0,
    },
    button: 0,
    isWithinEngine: true,
    handoffTo() {},
  });
}

function dispatchKeyboardCommand(
  root: Container,
  focusedItem: Item,
  key: string,
  options: KeyboardEventInit = {},
  target: EventTarget | null = focusedItem.inputElement,
): KeyboardEvent {
  const KeyboardEventConstructor =
    focusedItem.element!.ownerDocument.defaultView!.KeyboardEvent;
  const event = new KeyboardEventConstructor("keydown", {
    bubbles: true,
    cancelable: true,
    key,
    ...options,
  });
  Object.defineProperty(event, "target", {
    configurable: true,
    value: target,
  });
  root.event.global.keyDown?.({ event, focusedObject: focusedItem });
  return event;
}

async function drainFrames(global: any, maximumFrames = 5): Promise<void> {
  const stages = [
    "READ_1",
    "WRITE_1",
    "READ_2",
    "WRITE_2",
    "READ_3",
    "WRITE_3",
  ] as const;
  for (let frame = 0; frame < maximumFrames; frame += 1) {
    if (stages.every((stage) => global.queue[stage].size === 0)) break;
    for (const stage of stages) {
      global.currentStage = stage;
      const batch = global.queue[stage];
      global.queue[stage] = new Map();
      for (const ownerTasks of batch.values()) {
        for (const task of ownerTasks.values()) {
          for (const callback of task.callback ?? []) await callback();
        }
      }
    }
  }
  global.currentStage = "IDLE";
  if (stages.some((stage) => global.queue[stage].size > 0)) {
    throw new Error(
      `SnapSort state test exceeded ${maximumFrames} frames with queued work remaining.`,
    );
  }
}

function expectOrderedChildren(container: Container): void {
  const logicalChildren = container.children.filter(
    (child): child is Item => child instanceof Item,
  );
  expect(new Set(container.itemOrderedList).size).toBe(
    container.itemOrderedList.length,
  );
  expect(new Set(container.itemOrderedList)).toEqual(new Set(logicalChildren));
  for (const item of container.itemOrderedList) {
    expect(item.parent).toBe(container);
  }
}

test("visual rectangles are immutable screen-space snapshots and cache reads", () => {
  const harness = createStateHarness();
  try {
    harness.engine.camera = {
      getCameraFromScreen: (x: number, y: number) => [x, y],
      getWorldFromCamera: (x: number, y: number) => [x / 2, y / 2],
      getCameraDeltaFromWorldDelta: (x: number, y: number) => [x * 2, y * 2],
      getWorldDeltaFromCameraDelta: (x: number, y: number) => [x / 2, y / 2],
    };
    const root = mountRoot(harness);
    const item = mountItem(harness, root, "item", {
      x: 30,
      y: 45,
      width: 80,
      height: 50,
    });
    let reads = 0;
    const element = item.element!;
    Object.defineProperty(element, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        reads += 1;
        return new DOMRect(30, 45, 80, 50);
      },
    });
    const cache = new Map();

    harness.global.currentStage = "READ_1";
    const first = readVisualRect(item, cache);
    const repeated = readVisualRect(item, cache);
    harness.global.currentStage = "IDLE";

    expect(first).toBe(repeated);
    expect(reads).toBe(1);
    expect(first?.coordinateSpace).toBe("screen");
    expect([first?.x, first?.y, first?.width, first?.height]).toEqual([
      30, 45, 80, 50,
    ]);
    expect(Object.isFrozen(first)).toBe(true);

    setRect(element, { x: 90, y: 100, width: 20, height: 10 });
    expect([first?.x, first?.y, first?.width, first?.height]).toEqual([
      30, 45, 80, 50,
    ]);
  } finally {
    harness.cleanup();
  }
});

test("visual rectangle reads reject write stages", () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const item = mountItem(harness, root, "item");
    harness.global.currentStage = "WRITE_1";
    expect(() => readVisualRect(item)).toThrow("Reading DOM during WRITE_1");
  } finally {
    harness.cleanup();
  }
});

test("SnapSort production source has no direct layout rectangle reads", () => {
  const sourceRoot = join(process.cwd(), "assets/snapsort/src");
  const sourceFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(path)
        : /\.(ts|svelte)$/.test(entry.name)
          ? [path]
          : [];
    });
  const offenders = sourceFiles(sourceRoot).filter((path) =>
    /\.getBoundingClientRect\s*\(/.test(readFileSync(path, "utf8")),
  );
  expect(offenders).toEqual([]);
});

test("Container exposes live non-ghost children and logical tree depth", () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const section = mountContainer(harness, root, "section");
    const nested = mountContainer(harness, section, "nested");
    const leaf = mountItem(harness, nested, "leaf");
    const session = makeSession(root, leaf);
    const ghost = leaf.createGhostItem(session, {
      type: "target-spacer",
      location: buildGhostSlotLocation(nested, 0),
      rect: { x: 0, y: 0, width: 40, height: 40 },
    });
    const nestedElement = nested.element;
    if (!nestedElement)
      throw new Error("Expected the nested Container to be mounted.");
    bindElement(harness, ghost, nestedElement, "ghost:leaf");
    placeItemAt(nested, ghost, 0);

    expect(root.depth).toBe(0);
    expect(section.depth).toBe(1);
    expect(nested.depth).toBe(2);
    expect(leaf.depth).toBe(3);
    expect(root.itemList).toEqual([section]);
    expect(section.itemList).toEqual([nested]);
    expect(nested.itemOrderedList).toEqual([ghost, leaf]);
    expect(nested.itemList).toEqual([leaf]);
    expect(nested.numberOfItems).toBe(1);
  } finally {
    harness.cleanup();
  }
});

test("same-container insertion keeps one logical child and never points before itself", () => {
  const harness = createStateHarness();
  try {
    let beforeElement: HTMLElement | null = null;
    const root = mountRoot(harness, "root", {
      callbacks: {
        onItemInsert(event) {
          beforeElement = event.beforeElement;
          event.container.element?.insertBefore(
            event.item.element!,
            event.beforeElement,
          );
        },
      },
    });
    const first = mountItem(harness, root, "first");
    const nested = mountContainer(harness, root, "nested");
    const last = mountItem(harness, root, "last");

    root.insertItemAt(root, nested, 1);

    expect(root.itemOrderedList).toEqual([first, nested, last]);
    expect(root.itemOrderedList.filter((item) => item === nested)).toHaveLength(
      1,
    );
    expect(beforeElement).toBe(last.element);
    expect(beforeElement).not.toBe(nested.element);
    expectOrderedChildren(root);
  } finally {
    harness.cleanup();
  }
});

test("reconciliation preserves an elementless framework ghost's logical slot", () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness, "root", {
      adapter: { callbacks: {}, commit: (mutation) => mutation() },
      callbacks: {
        onGhostInsert() {},
        onGhostMove() {},
        onGhostRemove() {},
      },
    });
    const first = mountItem(harness, root, "first");
    const second = mountItem(harness, root, "second");
    const session = makeSession(root, first);
    const ghost = first.createGhostItem(session, {
      type: "target-spacer",
      location: buildGhostSlotLocation(root, 1),
      rect: { x: 0, y: 0, width: 40, height: 40 },
    });

    expect(ghost.element).toBeNull();
    root.insertGhost(ghost);

    expect(root.itemOrderedList).toEqual([first, ghost, second]);
    expect(root.itemList).toEqual([first, second]);
    expect(root.numberOfItems).toBe(2);

    root.element!.insertBefore(second.element!, first.element!);
    root.takeRootSnapshot();

    expect(root.itemOrderedList).toEqual([second, ghost, first]);
    expectOrderedChildren(root);
  } finally {
    harness.cleanup();
  }
});

test("attachItem rejects cross-root reparenting without changing either tree", () => {
  const harness = createStateHarness();
  try {
    const firstRoot = mountRoot(harness, "first-root");
    const secondRoot = mountRoot(harness, "second-root");
    const subtree = mountContainer(harness, firstRoot, "subtree");
    const leaf = mountItem(harness, subtree, "leaf");

    expect(() => secondRoot.attachItem(subtree)).toThrow(
      "Items cannot move between independent roots",
    );

    expect(firstRoot.itemList).toEqual([subtree]);
    expect(firstRoot.itemOrderedList).toEqual([subtree]);
    expect(firstRoot.children).toEqual([subtree]);
    expect(secondRoot.itemList).toEqual([]);
    expect(secondRoot.children).toEqual([]);
    expect(subtree.parent).toBe(firstRoot);
    expect(subtree.rootContainer).toBe(firstRoot);
    expect(subtree.depth).toBe(1);
    expect(leaf.rootContainer).toBe(firstRoot);
    expect(leaf.depth).toBe(2);
    expectOrderedChildren(firstRoot);
    expectOrderedChildren(secondRoot);
  } finally {
    harness.cleanup();
  }
});

test("itemId is required, non-empty, and immutable", () => {
  const harness = createStateHarness();
  try {
    expect(() => new Item(harness.engine, null, { itemId: "" })).toThrow(
      "itemId must be a non-empty string",
    );
    expect(() => new Container(harness.engine, null, { itemId: "" })).toThrow(
      "itemId must be a non-empty string",
    );

    const item = new Item(harness.engine, null, { itemId: "stable-item" });
    expect(item.itemId).toBe("stable-item");
    expect(Reflect.set(item, "itemId", "changed-item")).toBe(false);
    expect(item.itemId).toBe("stable-item");
  } finally {
    harness.cleanup();
  }
});

test("itemId uniqueness is scoped to one independent root", () => {
  const harness = createStateHarness();
  try {
    const firstRoot = mountRoot(harness, "shared-id");
    const conflictingItem = new Item(harness.engine, null, {
      itemId: "shared-id",
    });
    expect(() => placeItemAt(firstRoot, conflictingItem, 0)).toThrow(
      'itemId "shared-id" must be unique within one root tree',
    );

    const secondRoot = mountRoot(harness, "shared-id");
    const firstItem = mountItem(harness, firstRoot, "reusable-item-id");
    const secondItem = mountItem(harness, secondRoot, "reusable-item-id");
    expect(firstItem.itemId).toBe(secondItem.itemId);
    expect(firstItem.rootContainer).toBe(firstRoot);
    expect(secondItem.rootContainer).toBe(secondRoot);
  } finally {
    harness.cleanup();
  }
});

test("ghost identity is fresh, stable, and read-only", () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const item = mountItem(harness, root, "source");
    const session = makeSession(root, item);
    const ghost = item.createGhostItem(session, {
      type: "target-spacer",
      location: buildGhostSlotLocation(root, 0),
      rect: { x: 0, y: 0, width: 40, height: 40 },
    });
    const ghostId = ghost.itemId;

    expect(ghostId).not.toBe(item.itemId);
    expect(ghost.ghostState?.ghostItemId).toBe(ghostId);
    expect(Reflect.set(ghost, "itemId", "replacement")).toBe(false);
    expect(ghost.itemId).toBe(ghostId);
  } finally {
    harness.cleanup();
  }
});

test("ghost insert, relocation, and removal preserve one identity and one commit each", async () => {
  const harness = createStateHarness();
  try {
    const operations: string[] = [];
    const ghostIds: string[] = [];
    let commits = 0;
    const record = (
      operation: string,
      event: { ghost: { ghostItemId: string } },
    ) => {
      operations.push(operation);
      ghostIds.push(event.ghost.ghostItemId);
    };
    const vanilla = createVanillaAdapter();
    const adapter = {
      callbacks: {
        onGhostInsert(
          event: Parameters<
            NonNullable<typeof vanilla.callbacks.onGhostInsert>
          >[0],
        ) {
          record("insert", event);
          vanilla.callbacks.onGhostInsert?.(event);
        },
        onGhostMove(
          event: Parameters<
            NonNullable<typeof vanilla.callbacks.onGhostMove>
          >[0],
        ) {
          record("move", event);
          vanilla.callbacks.onGhostMove?.(event);
        },
        onGhostRemove(
          event: Parameters<
            NonNullable<typeof vanilla.callbacks.onGhostRemove>
          >[0],
        ) {
          record("remove", event);
          vanilla.callbacks.onGhostRemove?.(event);
        },
      },
      commit(mutation: () => void) {
        commits += 1;
        mutation();
      },
    };
    const root = mountRoot(harness, "root", {
      adapter,
    });
    const destination = mountContainer(harness, root, "destination");
    const item = mountItem(harness, root, "source");
    const session = makeSession(root, item);
    session.dropEffect = "none";
    root.readDragSnapshotTree();
    root.captureDragSnapshotTree();

    await session.strategy.lifecycle.syncPlacement(session, {
      container: root,
      index: 0,
      insertion: null,
    });
    const ghost = session.flowGhostRun[0];
    await session.strategy.lifecycle.syncPlacement(session, {
      container: destination,
      index: 0,
      insertion: null,
    });
    await drainFrames(harness.global);
    await session.strategy.lifecycle.clearPlacement(session);

    expect(operations).toEqual(["insert", "move", "remove"]);
    expect(new Set(ghostIds)).toEqual(new Set([ghost.itemId]));
    expect(commits).toBe(3);
    expect(ghost.parent).toBeNull();
  } finally {
    harness.cleanup();
  }
});

test("pointer preview motion reuses one mount without structural commits", async () => {
  const harness = createStateHarness();
  try {
    let commits = 0;
    let inserts = 0;
    let removals = 0;
    const root = mountRoot(harness, "root", {
      adapter: {
        callbacks: {},
        commit(mutation) {
          commits += 1;
          mutation();
        },
      },
    });
    root.callbacks = {
      onGhostInsert(event) {
        const rootElement = root.element;
        if (!rootElement) throw new Error("Test root is not mounted.");
        inserts += 1;
        bindElement(
          harness,
          event.ghost.ghostItem,
          rootElement,
          event.ghost.ghostItemId,
        );
      },
      onGhostRemove(event) {
        removals += 1;
        event.ghost.ghostItem.element?.remove();
      },
    };
    const item = mountItem(harness, root, "source");
    const session = makeSession(root, item);
    root.readDragSnapshotTree();
    root.captureDragSnapshotTree();
    session.dragVisualStart.set(item, { x: 0, y: 0 });

    await startPointerPreview(session);
    updatePointerPreview(session);
    updatePointerPreview(session);
    updatePointerPreview(session);
    await removePointerPreview(session);

    expect(inserts).toBe(1);
    expect(removals).toBe(1);
    expect(commits).toBe(2);
  } finally {
    harness.cleanup();
  }
});

test("framework adapters must commit synchronously and exactly once", () => {
  const harness = createStateHarness();
  try {
    const skipped = mountRoot(harness, "skipped", {
      adapter: { callbacks: {}, commit() {} },
    });
    expect(() => skipped.commitMutation(() => {})).toThrow("synchronously");

    const repeated = mountRoot(harness, "repeated", {
      adapter: {
        callbacks: {},
        commit(mutation) {
          mutation();
          mutation();
        },
      },
    });
    expect(() => repeated.commitMutation(() => {})).toThrow("exactly once");
  } finally {
    harness.cleanup();
  }
});

test("rejected cyclic attachment leaves both logical trees unchanged", () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const ancestor = mountContainer(harness, root, "ancestor");
    const descendant = mountContainer(harness, ancestor, "descendant");

    expect(() => descendant.attachItem(ancestor)).toThrow(
      "An object cannot be parented to one of its children.",
    );

    expect(root.itemOrderedList).toEqual([ancestor]);
    expect(root.children).toEqual([ancestor]);
    expect(ancestor.itemOrderedList).toEqual([descendant]);
    expect(ancestor.children).toEqual([descendant]);
    expect(ancestor.parent).toBe(root);
    expect(descendant.parent).toBe(ancestor);
    expect(ancestor.depth).toBe(1);
    expect(descendant.depth).toBe(2);
    expectOrderedChildren(root);
    expectOrderedChildren(ancestor);
  } finally {
    harness.cleanup();
  }
});

test("programmatic moves use the destination move animation channel", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const source = mountContainer(
      harness,
      root,
      "source",
      { x: 0, y: 0, width: 240, height: 240 },
      {
        animation: {
          move: { duration: 0 },
          reorder: null,
        },
      },
    );
    const destination = mountContainer(
      harness,
      root,
      "destination",
      { x: 260, y: 0, width: 240, height: 240 },
      {
        animation: {
          move: null,
          reorder: { duration: 0 },
        },
      },
    );
    const item = mountItem(harness, source, "item");

    expect(source.moveItem("item", destination, 0)).toBe(true);
    expect(item.parent).toBe(destination);

    expect(destination.moveItem("item", source, 0)).toBe(true);
    expect(item.parent).toBe(destination);

    await drainFrames(harness.global);
    expect(item.parent).toBe(source);
  } finally {
    harness.cleanup();
  }
});

test("same-destination programmatic moves share one animation transaction", async () => {
  const harness = createStateHarness();
  try {
    const movedIds: string[] = [];
    const root = mountRoot(harness, "root", {
      callbacks: {
        onItemMove(event) {
          movedIds.push(...event.itemIds);
          for (const item of event.items) {
            event.to.container.element?.insertBefore(
              item.element!,
              event.beforeElement,
            );
          }
        },
      },
    });
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(
      harness,
      root,
      "destination",
      undefined,
      { animation: { move: { duration: 100 } } },
    );
    const first = mountItem(harness, source, "first");
    const second = mountItem(harness, source, "second");

    expect(source.moveItem(first.itemId, destination, 0)).toBe(true);
    expect(source.moveItem(first.itemId, destination, 1)).toBe(false);
    expect(source.removeItem(first.itemId)).toBe(false);
    attemptItemDrag(first);
    expect(getDragSessionController(root)).toBeNull();
    expect(source.moveItem(second.itemId, destination, 1)).toBe(true);
    expect(movedIds).toEqual([]);
    expect(source.itemList).toEqual([first, second]);

    await drainFrames(harness.global);

    expect(movedIds).toEqual(["first", "second"]);
    expect(source.itemList).toEqual([]);
    expect(destination.itemList).toEqual([first, second]);

    expect(destination.moveItem(first.itemId, source, 0)).toBe(true);
    await drainFrames(harness.global);
    expect(movedIds).toEqual(["first", "second", "first"]);
    expect(source.itemList).toEqual([first]);
    expect(destination.itemList).toEqual([second]);
  } finally {
    harness.cleanup();
  }
});

test("programmatic transactions and drag sessions exclude each other within one root", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(
      harness,
      root,
      "destination",
      undefined,
      { animation: { move: { duration: 100 } } },
    );
    const queued = mountItem(harness, source, "queued");
    const dragged = mountItem(harness, source, "dragged");
    const blocked = mountItem(harness, source, "blocked");

    expect(source.moveItem(queued.itemId, destination, 0)).toBe(true);
    attemptItemDrag(dragged);
    expect(getDragSessionController(root)).toBeNull();

    const independentRoot = mountRoot(harness, "independent-root");
    const independentItem = mountItem(
      harness,
      independentRoot,
      "independent-item",
    );
    attemptItemDrag(independentItem);
    const independentSession = getDragSessionController(independentRoot);
    expect(independentSession).not.toBeNull();
    independentSession?.cancel();

    await drainFrames(harness.global);
    expect(source.itemList).toEqual([dragged, blocked]);
    expect(destination.itemList).toEqual([queued]);

    attemptItemDrag(dragged);
    const session = getDragSessionController(root);
    expect(session).not.toBeNull();
    expect(source.moveItem(blocked.itemId, destination, 1)).toBe(false);
    expect(source.removeItem(blocked.itemId)).toBe(false);
    expect(source.itemList).toEqual([dragged, blocked]);
    expect(destination.itemList).toEqual([queued]);

    session?.cancel();
    await drainFrames(harness.global);
    expect(source.moveItem(blocked.itemId, destination, 1)).toBe(true);
    await drainFrames(harness.global);

    expect(getDragSessionController(root)).toBeNull();
    expect(source.itemList).toEqual([dragged]);
    expect(destination.itemList).toEqual([queued, blocked]);
  } finally {
    harness.cleanup();
  }
});

test("programmatic placement and removal share their animation owner transaction", async () => {
  const harness = createStateHarness();
  try {
    const operations: string[] = [];
    const root = mountRoot(harness, "root", {
      callbacks: {
        onItemMove(event) {
          operations.push(`move:${event.itemId}`);
          event.to.container.element?.insertBefore(
            event.item.element!,
            event.beforeElement,
          );
        },
        onItemRemove(event) {
          operations.push(`remove:${event.itemId}`);
          event.item.element?.remove();
        },
      },
    });
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(
      harness,
      root,
      "destination",
      undefined,
      { animation: { move: { duration: 100 } } },
    );
    const moving = mountItem(harness, source, "moving");
    const removing = mountItem(harness, destination, "removing");
    const retained = mountItem(harness, destination, "retained");

    expect(source.moveItem(moving.itemId, destination, 2)).toBe(true);
    expect(destination.removeItem(removing.itemId)).toBe(true);
    expect(destination.removeItem(removing.itemId)).toBe(false);
    expect(destination.moveItem(removing.itemId, source, 0)).toBe(false);
    attemptItemDrag(removing);
    expect(getDragSessionController(root)).toBeNull();
    expect(operations).toEqual([]);
    await drainFrames(harness.global);

    expect(operations).toEqual(["move:moving", "remove:removing"]);
    expect(source.itemList).toEqual([]);
    expect(destination.itemList).toEqual([retained, moving]);
  } finally {
    harness.cleanup();
  }
});

test("programmatic removal stays synchronous when move animation is disabled", () => {
  const harness = createStateHarness();
  try {
    const removedIds: string[] = [];
    const root = mountRoot(harness, "root", {
      animation: { move: null },
      callbacks: {
        onItemRemove(event) {
          removedIds.push(...event.itemIds);
          event.item.element?.remove();
        },
      },
    });
    const item = mountItem(harness, root, "item");

    expect(root.removeItem(item.itemId)).toBe(true);
    expect(removedIds).toEqual(["item"]);
    expect(root.itemList).toEqual([]);
  } finally {
    harness.cleanup();
  }
});

test("different animation owners preserve all queued removals", async () => {
  const harness = createStateHarness();
  try {
    const removedIds: string[] = [];
    const root = mountRoot(harness, "root", {
      callbacks: {
        onItemRemove(event) {
          removedIds.push(...event.itemIds);
          event.item.element?.remove();
        },
      },
    });
    const firstSource = mountContainer(
      harness,
      root,
      "first-source",
      undefined,
      {
        animation: { move: { duration: 100 } },
      },
    );
    const secondSource = mountContainer(
      harness,
      root,
      "second-source",
      undefined,
      { animation: { move: { duration: 100 } } },
    );
    const first = mountItem(harness, firstSource, "first");
    const second = mountItem(harness, secondSource, "second");

    expect(firstSource.removeItem(first.itemId)).toBe(true);
    expect(secondSource.removeItem(second.itemId)).toBe(true);
    await drainFrames(harness.global);

    expect(removedIds).toEqual(["first", "second"]);
    expect(firstSource.itemList).toEqual([]);
    expect(secondSource.itemList).toEqual([]);
  } finally {
    harness.cleanup();
  }
});

test("animated removal validates its framework callback before scheduling", () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness, "root", {
      animation: { move: { duration: 100 } },
      adapter: { callbacks: {}, commit: (mutation) => mutation() },
    });
    const item = mountItem(harness, root, "item");

    expect(() => root.removeItem(item.itemId)).toThrow(
      /callbacks\.onItemRemove/,
    );
    expect(root.itemList).toEqual([item]);
  } finally {
    harness.cleanup();
  }
});

test("a failing animated removal does not skip later queued mutations", async () => {
  const harness = createStateHarness();
  try {
    const removedIds: string[] = [];
    const root = mountRoot(harness, "root", {
      animation: { move: { duration: 100 } },
      adapter: { callbacks: {}, commit: (mutation) => mutation() },
      callbacks: {
        onItemRemove(event) {
          removedIds.push(...event.itemIds);
          event.item.element?.remove();
          if (event.itemId === "first") {
            throw new Error("intentional removal failure");
          }
        },
      },
    });
    const first = mountItem(harness, root, "first");
    const second = mountItem(harness, root, "second");

    expect(root.removeItem(first.itemId)).toBe(true);
    expect(root.removeItem(second.itemId)).toBe(true);
    await expect(drainFrames(harness.global)).rejects.toThrow(
      "intentional removal failure",
    );
    expect(removedIds).toEqual(["first", "second"]);
    expect(root.itemList).toEqual([]);

    for (const queue of Object.values(harness.global.queue) as Map<
      string,
      unknown
    >[]) {
      queue.clear();
    }
    root.callbacks = {
      onItemRemove(event) {
        event.item.element?.remove();
      },
    };
    root.attachItem(first);
    expect(root.removeItem(first.itemId)).toBe(true);
    await drainFrames(harness.global);
    expect(root.itemList).toEqual([]);
  } finally {
    harness.cleanup();
  }
});

test("move, reorder, removal, and cancellation keep state live", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const source = mountContainer(harness, root, "source");
    const destinationParent = mountContainer(
      harness,
      root,
      "destination-parent",
    );
    const destination = mountContainer(
      harness,
      destinationParent,
      "destination",
    );
    const first = mountItem(harness, source, "first");
    const movable = mountContainer(harness, source, "movable");
    const descendant = mountItem(harness, movable, "descendant");
    const last = mountItem(harness, source, "last");

    source.moveItemToContainer(destination, movable, 0, null);
    expect(source.itemList).toEqual([first, last]);
    expect(destination.itemList).toEqual([movable]);
    expect(movable.parent).toBe(destination);
    expect(movable.rootContainer).toBe(root);
    expect(movable.depth).toBe(3);
    expect(descendant.depth).toBe(4);

    source.moveItemToContainer(source, last, 0, null);
    expect(source.itemList).toEqual([last, first]);
    expectOrderedChildren(source);

    expect(source.removeItem("first")).toBe(true);
    expect(source.itemList).toEqual([last]);
    expect(source.numberOfItems).toBe(1);
    expect(first.parent).toBeNull();
    expect(first.depth).toBe(0);

    harness.global.currentStage = "READ_1";
    root.readDragSnapshotTree();
    root.captureDragSnapshotTree();
    harness.global.currentStage = "IDLE";
    for (const queue of Object.values(harness.global.queue) as Map<
      string,
      unknown
    >[]) {
      queue.clear();
    }

    const session = makeSession(root, last);
    installDragSession(root, session);
    session.phase = "active";
    session.strategy.lifecycle.validateStart(session);
    await session.strategy.lifecycle.dragStart(session);

    expect(source.itemOrderedList).toHaveLength(1);
    expect(source.itemOrderedList[0].isGhost).toBe(true);
    expect(source.itemList).toEqual([]);
    expect(source.numberOfItems).toBe(0);

    session.cancel();
    await drainFrames(harness.global);

    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();
    expect(source.itemOrderedList.some((item) => item.isGhost)).toBe(false);
    expect(source.itemList).toEqual([last]);
    expect(source.numberOfItems).toBe(1);
    expect(last.depth).toBe(2);
    expectOrderedChildren(source);
  } finally {
    harness.cleanup();
  }
});

test("framework replacement reconciles the committed Item object and order", () => {
  const harness = createStateHarness();
  try {
    let replacement: Item | null = null;
    const root = mountRoot(harness, "root", {
      adapter: { callbacks: {}, commit: (mutation) => mutation() },
      callbacks: {
        onItemMove(event) {
          event.item.element?.remove();
          event.item.destroy(false);

          replacement = new Item(harness.engine, event.to.container, {
            itemId: event.itemId,
          });
          const element = harness.document.createElement("div");
          element.dataset.testItem = "replacement";
          setRect(element, { x: 0, y: 0, width: 40, height: 40 });
          event.to.container.element?.insertBefore(
            element,
            event.beforeElement,
          );
          replacement.element = element;
        },
      },
    });
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(harness, root, "destination");
    const moved = mountItem(harness, source, "moved");

    source.moveItemToContainer(destination, moved, 0, null);

    expect(replacement).not.toBeNull();
    expect(destination.itemList).toEqual([replacement]);
    expect(destination.itemOrderedList).toEqual([replacement]);
    expect(destination.children).toEqual([replacement]);
    expect(replacement!.parent).toBe(destination);
    expect(replacement!.rootContainer).toBe(root);
    expect(replacement!.depth).toBe(2);
    expect(source.numberOfItems).toBe(0);
    expect(root.findItemById("moved")).toBe(replacement);
  } finally {
    harness.cleanup();
  }
});

test("swap lifecycle reconciles same-container Vanilla adapter order", async () => {
  const harness = createStateHarness();
  try {
    const insertedIds: string[] = [];
    const root = mountRoot(harness, "root", {
      mode: "swap",
      callbacks: {
        onItemInsert(event) {
          insertedIds.push(event.itemId);
          event.container.element?.insertBefore(
            event.item.element!,
            event.beforeElement,
          );
        },
      },
    });
    const first = mountItem(harness, root, "first");
    const second = mountItem(harness, root, "second");
    const third = mountItem(harness, root, "third");
    const session = makeSession(root, first, 3, "swap");

    installDragSession(root, session);
    session.phase = "dropping";
    session.strategy.lifecycle.syncPlacement(session, {
      container: root,
      index: 1,
      insertion: null,
    });
    session.strategy.lifecycle.drop(session);
    await drainFrames(harness.global);

    expect(insertedIds).toEqual([]);
    expect(root.itemOrderedList).toEqual([second, first, third]);
    expect(root.itemList).toEqual([second, first, third]);
    expect(
      [...root.element!.children].map(
        (element) => (element as HTMLElement).dataset.testItem,
      ),
    ).toEqual(["second", "first", "third"]);
    expectOrderedChildren(root);
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();
  } finally {
    harness.cleanup();
  }
});

test("swap lifecycle reconciles framework-owned replacement Items", async () => {
  const harness = createStateHarness();
  try {
    let firstReplacement: Item | null = null;
    let secondReplacement: Item | null = null;
    let swapCount = 0;
    const adapter = {
      callbacks: {},
      commit: (mutation: () => void) => mutation(),
    };
    const root = mountRoot(harness, "root", {
      adapter,
      mode: "swap",
      callbacks: {
        onItemSwap(event) {
          swapCount += 1;
          event.a.item.element?.remove();
          event.b.item.element?.remove();
          event.a.item.destroy(false);
          event.b.item.destroy(false);

          firstReplacement = new Item(harness.engine, event.b.container, {
            itemId: event.a.itemId,
          });
          bindElement(
            harness,
            firstReplacement,
            event.b.container.element!,
            "first-replacement",
          );

          secondReplacement = new Item(harness.engine, event.a.container, {
            itemId: event.b.itemId,
          });
          bindElement(
            harness,
            secondReplacement,
            event.a.container.element!,
            "second-replacement",
          );
        },
      },
    });
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(harness, root, "destination");
    const first = mountItem(harness, source, "first");
    const second = mountItem(harness, destination, "second");
    const session = makeSession(root, first, 4, "swap");

    installDragSession(root, session);
    session.phase = "dropping";
    session.strategy.lifecycle.syncPlacement(session, {
      container: destination,
      index: 0,
      insertion: null,
    });
    session.strategy.lifecycle.drop(session);
    await drainFrames(harness.global);

    expect(swapCount).toBe(1);
    expect(source.itemList).toEqual([secondReplacement]);
    expect(destination.itemList).toEqual([firstReplacement]);
    expect(source.children).toEqual([secondReplacement]);
    expect(destination.children).toEqual([firstReplacement]);
    expect(secondReplacement!.parent).toBe(source);
    expect(firstReplacement!.parent).toBe(destination);
    expect(secondReplacement!.rootContainer).toBe(root);
    expect(firstReplacement!.rootContainer).toBe(root);
    expect(secondReplacement!.depth).toBe(2);
    expect(firstReplacement!.depth).toBe(2);
    expect(root.findItemById("first")).toBe(firstReplacement);
    expect(root.findItemById("second")).toBe(secondReplacement);
    expect(first.parent).toBeNull();
    expect(second.parent).toBeNull();
    expectOrderedChildren(source);
    expectOrderedChildren(destination);
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();
  } finally {
    harness.cleanup();
  }
});

test("DropPriorityEvent reports the real nested container depth", () => {
  const harness = createStateHarness();
  try {
    let priorityEvent: DropPriorityEvent | null = null;
    const root = mountRoot(harness, "root", { mode: "swap" });
    const dragged = mountItem(harness, root, "dragged", {
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    });
    const wrapper = mountContainer(harness, root, "wrapper", {
      x: 80,
      y: 80,
      width: 300,
      height: 300,
    });
    const nested = mountContainer(
      harness,
      wrapper,
      "nested",
      { x: 100, y: 100, width: 180, height: 180 },
      {
        dropPriority: 10,
        callbacks: {
          getDropPriority(event) {
            priorityEvent = event;
            return 10;
          },
        },
      },
    );
    const target = mountItem(harness, nested, "target", {
      x: 120,
      y: 120,
      width: 50,
      height: 50,
    });
    harness.global.currentStage = "READ_1";
    root.readDragSnapshotTree();
    root.captureDragSnapshotTree();
    harness.global.currentStage = "IDLE";

    const session = makeSession(root, dragged, 2);
    if (session.input.inputType !== "pointer") {
      throw new Error("Expected pointer input");
    }
    session.input.updatePointer({
      pointerId: 2,
      position: { x: 145, y: 145 },
    } as never);
    session.visualPointer = session.input.pointer;
    session.phase = "active";
    const candidate = determineSwapDropTarget(dragged, root, session);

    expect(candidate?.container).toBe(nested);
    expect(candidate?.index).toBe(nested.itemOrderedList.indexOf(target));
    expect(priorityEvent?.container).toBe(nested);
    expect(priorityEvent?.depth).toBe(2);
    expect(priorityEvent?.depth).toBe(nested.depth);
  } finally {
    harness.cleanup();
  }
});

test("KeyboardDragController owns and releases the root key callback", () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    root.event.global.keyDown = () => {};

    expect(() => new KeyboardDragController(root)).toThrow(
      /keyDown callback is already in use/,
    );

    root.event.global.keyDown = null;
    const controller = new KeyboardDragController(root);
    expect(root.event.hasGlobalCallback("keyDown")).toBe(true);

    controller.destroy();
    controller.destroy();
    expect(root.event.hasGlobalCallback("keyDown")).toBe(false);
  } finally {
    harness.cleanup();
  }
});

test("KeyboardDragController navigates a direct session and restores focus", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const first = mountItem(harness, root, "first", {
      x: 20,
      y: 20,
      width: 120,
      height: 40,
    });
    mountItem(harness, root, "second", {
      x: 20,
      y: 80,
      width: 120,
      height: 40,
    });
    first.element!.setAttribute("tabindex", "0");
    first.element!.focus();
    const controller = new KeyboardDragController(root);

    const lift = dispatchKeyboardCommand(root, first, "Enter");
    expect(lift.defaultPrevented).toBe(true);
    await drainFrames(harness.global, 10);

    const activeSession = getDragSessionController(root);
    expect(activeSession?.input.inputType).toBe("direct");
    expect(activeSession?.status).toBe("active");

    const move = dispatchKeyboardCommand(root, first, "ArrowDown");
    expect(move.defaultPrevented).toBe(true);
    await drainFrames(harness.global, 10);

    if (!activeSession || activeSession.input.inputType !== "direct") {
      throw new Error("Expected an active direct session");
    }
    expect(activeSession.input.currentTarget?.index).toBe(1);

    const cancel = dispatchKeyboardCommand(root, first, "Escape");
    expect(cancel.defaultPrevented).toBe(true);
    await drainFrames(harness.global, 10);

    expect(root.dragSession).toBeNull();
    expect(harness.document.activeElement).toBe(first.inputElement);
    controller.destroy();
  } finally {
    harness.cleanup();
  }
});

test("direct candidates retain destination-sized member rectangles", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness, "root", {
      direction: "row",
      wrap: "nowrap",
    });
    const source = mountContainer(
      harness,
      root,
      "source",
      { x: 20, y: 20, width: 220, height: 240 },
      { direction: "column", wrap: "nowrap", stretchItems: true },
    );
    const destination = mountContainer(
      harness,
      root,
      "destination",
      { x: 300, y: 20, width: 120, height: 240 },
      { direction: "column", wrap: "nowrap", stretchItems: true },
    );
    const dragged = mountItem(harness, source, "dragged", {
      x: 30,
      y: 30,
      width: 200,
      height: 44,
    });
    mountItem(harness, destination, "target", {
      x: 300,
      y: 20,
      width: 120,
      height: 36,
    });

    const publicSession = dragged.beginDirectDrag();
    expect(publicSession).not.toBeNull();
    await drainFrames(harness.global, 10);
    const session = getDragSessionController(root);
    if (!session || session.input.inputType !== "direct") {
      throw new Error("Expected an active direct session");
    }

    expect(session.input.moveTo(destination, 0)).toBe(true);
    const candidate = session.input.currentCandidate;
    if (!candidate) throw new Error("Expected a current direct candidate");
    const geometry = directCandidateGeometry(session, candidate);

    expect(candidate.memberRects).toHaveLength(1);
    expect(Object.isFrozen(candidate.memberRects)).toBe(true);
    expect(Object.isFrozen(candidate.memberRects[0])).toBe(true);
    expect(candidate.memberRects[0]).toMatchObject({
      x: 300,
      y: 20,
      width: 120,
      height: 44,
    });
    expect(geometry.dragRect).toEqual(candidate.memberRects[0]);
    expect(geometry.memberRects).toBe(candidate.memberRects);

    await drainFrames(harness.global, 10);
    expect(session.input.visualRectFor("dragged")).toEqual(
      candidate.memberRects[0],
    );
    expect(dragged.style.width).toBe("120px");
    expect(dragged.style.height).toBe("44px");
    expect(session.input.moveTo(source, 0)).toBe(true);

    session.input.cancel();
    await drainFrames(harness.global, 10);
  } finally {
    harness.cleanup();
  }
});

test("direct group candidates retain one projected rectangle per member", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness, "root", {
      direction: "row",
      wrap: "nowrap",
    });
    const first = mountItem(harness, root, "first", {
      x: 20,
      y: 20,
      width: 200,
      height: 40,
    });
    const second = mountItem(harness, root, "second", {
      x: 20,
      y: 70,
      width: 200,
      height: 50,
    });
    const destination = mountContainer(
      harness,
      root,
      "destination",
      { x: 300, y: 20, width: 120, height: 240 },
      { direction: "column", wrap: "nowrap", stretchItems: true },
    );
    mountItem(harness, destination, "anchor", {
      x: 300,
      y: 20,
      width: 120,
      height: 36,
    });
    first.selected = true;
    second.selected = true;

    expect(first.beginDirectDrag()).not.toBeNull();
    await drainFrames(harness.global, 10);
    const session = getDragSessionController(root);
    if (!session || session.input.inputType !== "direct") {
      throw new Error("Expected an active direct session");
    }

    expect(session.items.map((item) => item.itemId)).toEqual([
      "first",
      "second",
    ]);
    expect(session.input.moveTo(destination, 0)).toBe(true);
    const candidate = session.input.currentCandidate;
    if (!candidate) throw new Error("Expected a current direct candidate");

    expect(candidate.memberRects).toHaveLength(2);
    expect(candidate.memberRects[0]).toMatchObject({
      width: 120,
      height: 40,
    });
    expect(candidate.memberRects[1]).toMatchObject({
      width: 120,
      height: 50,
    });
    expect(candidate.memberRects[0].x).toBe(candidate.memberRects[1].x);
    expect(candidate.memberRects[1].y).toBeGreaterThanOrEqual(
      candidate.memberRects[0].y + candidate.memberRects[0].height,
    );

    session.input.cancel();
    await drainFrames(harness.global, 10);
  } finally {
    harness.cleanup();
  }
});

test("KeyboardDragController requires the exact input alias target", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const item = mountItem(harness, root, "item", {
      x: 20,
      y: 20,
      width: 120,
      height: 40,
    });
    const handle = harness.document.createElement("button");
    item.element!.append(handle);
    item.addInputAlias(handle);
    const controller = new KeyboardDragController(root);

    const wrongTarget = dispatchKeyboardCommand(
      root,
      item,
      "Enter",
      {},
      item.element,
    );
    expect(wrongTarget.defaultPrevented).toBe(false);
    expect(root.dragSession).toBeNull();

    const exactTarget = dispatchKeyboardCommand(root, item, "Enter");
    expect(exactTarget.defaultPrevented).toBe(true);
    await drainFrames(harness.global, 10);
    expect(root.dragSession?.input.inputType).toBe("direct");

    controller.destroy();
    await drainFrames(harness.global, 10);
    expect(root.dragSession).toBeNull();
  } finally {
    harness.cleanup();
  }
});

test("KeyboardDragController lets Tab cancellation keep native focus", async () => {
  const harness = createStateHarness();
  try {
    const root = mountRoot(harness);
    const item = mountItem(harness, root, "item", {
      x: 20,
      y: 20,
      width: 120,
      height: 40,
    });
    item.element!.setAttribute("tabindex", "0");
    const nextFocus = harness.document.createElement("button");
    harness.document.body.append(nextFocus);
    item.element!.focus();
    const controller = new KeyboardDragController(root);

    dispatchKeyboardCommand(root, item, "Enter");
    await drainFrames(harness.global, 10);

    const tab = dispatchKeyboardCommand(root, item, "Tab");
    nextFocus.focus();
    expect(tab.defaultPrevented).toBe(false);
    await drainFrames(harness.global, 10);

    expect(root.dragSession).toBeNull();
    expect(harness.document.activeElement).toBe(nextFocus);
    controller.destroy();
  } finally {
    harness.cleanup();
  }
});
