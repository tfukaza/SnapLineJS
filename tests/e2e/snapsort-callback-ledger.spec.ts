import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import type { dragProp, dragStartProp } from "@snap-engine/core";
import { Container } from "../../assets/snapsort/src/container";
import { buildGhostSlotLocation } from "../../assets/snapsort/src/event-builders";
import type { DragLifecycleStrategy } from "../../assets/snapsort/src/drag/lifecycle";
import {
  builtinStrategies,
  type SortStrategy,
} from "../../assets/snapsort/src/drag/drop-strategy";
import { DragSessionController as DragSession } from "../../assets/snapsort/src/drag/session";
import {
  clearDragSession,
  installDragSession,
} from "../../assets/snapsort/src/drag/session-store";
import type { ContainerCallbacks } from "../../assets/snapsort/src/events";
import { Item } from "../../assets/snapsort/src/item";
import {
  fireDragItemEnter,
  fireDragItemLeave,
  fireDragItemMove,
} from "../../assets/snapsort/src/mutation";

type DomGlobal =
  | "window"
  | "document"
  | "HTMLElement"
  | "Element"
  | "Node"
  | "DOMRect"
  | "ResizeObserver"
  | "MutationObserver";

function createHarness() {
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
    createId: () => `callback-ledger-${++nextId}`,
    getEngineObjectTable: () => objectTable,
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
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
      dom.window.close();
    },
  };
}

function bindElement(
  harness: ReturnType<typeof createHarness>,
  item: Item,
  parent: HTMLElement,
  id: string,
  x = 0,
): HTMLElement {
  const element = harness.document.createElement("div");
  element.dataset.ledgerItem = id;
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(x, 0, 40, 40),
  });
  parent.append(element);
  item.element = element;
  return element;
}

function mountRoot(
  harness: ReturnType<typeof createHarness>,
  callbacks: ContainerCallbacks = {},
  mode: "euclidean" | "swap" = "euclidean",
): Container {
  const root = new Container(harness.engine, null, {
    itemId: "root",
    adapter: { callbacks: {}, commit: (mutation) => mutation() },
    mode,
    callbacks,
  });
  const element = harness.document.createElement("div");
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 400, 400),
  });
  harness.document.body.append(element);
  root.element = element;
  return root;
}

function mountContainer(
  harness: ReturnType<typeof createHarness>,
  root: Container,
  id: string,
  callbacks: ContainerCallbacks = {},
): Container {
  const container = new Container(harness.engine, root, {
    callbacks,
    itemId: id,
  });
  bindElement(harness, container, root.element!, id);
  root.attachItem(container);
  return container;
}

function mountItem(
  harness: ReturnType<typeof createHarness>,
  container: Container,
  id: string,
  x = 0,
): Item {
  const item = new Item(harness.engine, null, { itemId: id });
  bindElement(harness, item, container.element!, id, x);
  container.attachItem(item);
  return item;
}

function location(item: Item) {
  const { container, index } = item.getIndexAndContainer();
  if (!container) throw new Error("Test item is not attached.");
  return { container, containerMetadata: container.metadata, index };
}

function dragStartFor(item: Item, pointerId = 1): dragStartProp {
  return {
    objectId: item.id,
    pointerId,
    start: { x: 20, y: 20 },
    button: 0,
    isWithinEngine: true,
    handoffTo() {},
  };
}

function dragMoveFor(item: Item, x: number, y: number): dragProp {
  return {
    objectId: item.id,
    pointerId: 1,
    start: { x: 20, y: 20 },
    position: { x, y },
    delta: { x: x - 20, y: y - 20 },
    button: 0,
    handoffTo() {},
  };
}

function makeSession(
  root: Container,
  item: Item,
  mode: keyof typeof builtinStrategies = "euclidean",
): DragSession {
  return new DragSession(
    root,
    [item],
    [location(item)],
    builtinStrategies[mode],
    {
      handoffTo() {},
      pointerId: 1,
      start: { x: 20, y: 20 },
    } as never,
    item,
  );
}

async function drainFrames(
  global: any,
  maximumFrames = 6,
  reportedErrors?: unknown[],
): Promise<void> {
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
          for (const callback of task.callback ?? []) {
            try {
              await callback();
            } catch (error) {
              if (!reportedErrors) throw error;
              reportedErrors.push(error);
            }
          }
        }
      }
    }
  }
  global.currentStage = "IDLE";
}

function callbackLedger(owner: string, ledger: string[]): ContainerCallbacks {
  return {
    onItemMove(event) {
      ledger.push(
        `move:${owner}:${event.from.container.itemId}:${event.from.index}->${event.to.container.itemId}:${event.to.index}`,
      );
      for (const item of event.items) {
        event.to.container.element?.insertBefore(
          item.element!,
          event.beforeElement,
        );
      }
    },
    onItemRemove(event) {
      ledger.push(`remove:${owner}:${event.itemId}`);
      event.item.element?.remove();
    },
    onGhostInsert() {},
    onGhostMove() {},
    onGhostRemove(event) {
      ledger.push(`ghost-remove:${owner}:${event.ghost.type}`);
      event.ghost.ghostItem.element?.remove();
    },
  };
}

test("activation and veto callbacks remain direct and preserve order", async () => {
  const harness = createHarness();
  try {
    const activationLedger: string[] = [];
    let observedHandle: unknown = null;
    const lifecycle: DragLifecycleStrategy = {
      placementOccupiesFlowSlots: true,
      validateStart: () => activationLedger.push("validate"),
      dragStart: () => activationLedger.push("activate"),
      dragMove() {},
      currentPlacement: () => null,
      placementIndexFor: (_session, target) => target.index,
      syncPlacement() {},
      clearPlacement() {},
      afterPlacementSync() {},
      drop() {},
    };
    const strategy = {
      dropTarget: { resolve: () => null },
      lifecycle,
      defaultDragVisual: "none" as const,
    };
    const root = mountRoot(harness, {
      onDragStart: (event) => {
        activationLedger.push("start");
        observedHandle = event.session;
      },
    });
    const item = mountItem(harness, root, "item");
    const session = new DragSession(
      root,
      [item],
      [location(item)],
      strategy,
      { handoffTo() {}, pointerId: 1, start: { x: 20, y: 20 } } as never,
      item,
    );
    installDragSession(root, session);
    session.begin({ start: { x: 20, y: 20 } } as never);
    await drainFrames(harness.global);
    expect(activationLedger).toEqual(["start", "validate", "activate"]);
    expect(observedHandle).toBe(session.handle);
    expect(root.dragSession).toBe(session.handle);

    session.status = "ended";
    clearDragSession(root, session);
    activationLedger.length = 0;
    root.callbacks = {
      ...root.callbacks,
      onDragStart: () => {
        activationLedger.push("veto");
        return false;
      },
    };
    const vetoed = new DragSession(
      root,
      [item],
      [location(item)],
      strategy,
      { handoffTo() {}, pointerId: 2, start: { x: 20, y: 20 } } as never,
      item,
    );
    installDragSession(root, vetoed);
    vetoed.begin({ start: { x: 20, y: 20 } } as never);
    await drainFrames(harness.global);
    expect(activationLedger).toEqual(["veto"]);
    expect(vetoed.status).toBe("ended");
  } finally {
    harness.cleanup();
  }
});

test("a queued final move stays publicly active while internal drop ownership remains closed", async () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    const publicStatuses: string[] = [];
    const internalStatuses: string[] = [];
    let dragEndCount = 0;
    const callbacks = callbackLedger("root", ledger);
    const root = mountRoot(harness, callbacks);
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(harness, root, "destination");
    const item = mountItem(harness, source, "item");
    const strategy: SortStrategy = {
      mode: "insertion",
      dropTarget: {
        resolve: () => ({
          container: destination,
          index: 0,
          insertion: {
            gap: {
              orientation: "horizontal",
              x: 0,
              y: 0,
              length: 40,
            },
            previous: null,
            next: null,
            isCurrentPlacement: false,
          },
        }),
      },
      lifecycle: builtinStrategies.insertion.lifecycle,
    };
    const session = new DragSession(
      root,
      [item],
      [location(item)],
      strategy,
      dragStartFor(item),
      item,
    );
    root.callbacks = {
      ...callbacks,
      onDropTargetChange: (event) => {
        publicStatuses.push(event.session.status);
        internalStatuses.push(session.status);
        session.cancel();
        event.session.dropEffect = "move";
      },
      onDragEnd: () => {
        dragEndCount += 1;
      },
    };
    session.dropEffect = "none";
    session.status = "active";
    installDragSession(root, session);
    root.readDragSnapshotTree();
    root.captureDragSnapshotTree();

    session.pointerMove(dragMoveFor(item, 200, 20));
    session.status = "dropping";
    session.strategy.lifecycle.drop(session);
    expect(session.status).toBe("dropping");

    await drainFrames(harness.global);

    expect(publicStatuses).toEqual(["active"]);
    expect(internalStatuses).toEqual(["dropping"]);
    expect(session.cancelled).toBe(false);
    expect(session.dropEffect).toBe("move");
    expect(dragEndCount).toBe(1);
    expect(item.parent).toBe(destination);
    expect(destination.itemOrderedList).toContain(item);
    expect(ledger).toContain("move:root:source:0->destination:0");
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();
  } finally {
    harness.cleanup();
  }
});

test("movement and removal use the root receiver's single commit", () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    const root = mountRoot(harness, callbackLedger("root", ledger));
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(harness, root, "destination");
    const first = mountItem(harness, source, "first");
    const second = mountItem(harness, source, "second", 50);

    first.moveItemsAt([location(first)], source, [first], 1, null);
    expect(ledger).toEqual(["move:root:source:0->source:1"]);

    ledger.length = 0;
    first.moveItemsAt([location(first)], destination, [first], 0, null);
    expect(ledger).toEqual(["move:root:source:1->destination:0"]);

    ledger.length = 0;
    expect(source.removeItem(second.itemId)).toBe(true);
    expect(ledger).toEqual(["remove:root:second"]);
  } finally {
    harness.cleanup();
  }
});

test("normal drop and outside cancellation preserve callback ledgers", async () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    let endedHandle: unknown = null;
    let expectedEndHandle: unknown = null;
    const rootCallbacks = callbackLedger("root", ledger);
    rootCallbacks.onDragEnd = (event) => {
      endedHandle = event.session;
      expect(event.session.status).toBe("ended");
      expect(event.session).toBe(expectedEndHandle);
      expect(root.dragSession).toBeNull();
      ledger.push(
        `end:root:${event.destination?.container.itemId ?? "outside"}:${event.destination?.index ?? -1}`,
      );
    };
    const root = mountRoot(harness, rootCallbacks);
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(harness, root, "destination");
    const item = mountItem(harness, source, "item");
    const session = makeSession(root, item);
    expectedEndHandle = session.handle;
    session.dragVisual = "none";
    const ghost = item.createGhostItem(session, {
      type: "target-spacer",
      location: buildGhostSlotLocation(destination, 0),
      rect: { x: 0, y: 0, width: 40, height: 40 },
    });
    bindElement(harness, ghost, destination.element!, "target-ghost");
    destination.attachItem(ghost);
    session.flowGhostRun.push(ghost);
    session.pendingPlacement = {
      container: destination,
      index: 0,
      insertion: null,
    };
    session.status = "dropping";
    installDragSession(root, session);
    session.strategy.lifecycle.drop(session);
    await drainFrames(harness.global);

    expect(ledger).toEqual([
      "ghost-remove:root:target-spacer",
      "move:root:source:0->destination:0",
      "end:root:destination:0",
    ]);
    expect(session.status).toBe("ended");
    expect(endedHandle).toBe(session.handle);
    expect(root.dragSession).toBeNull();
    expect(session.flowGhostRun).toHaveLength(0);
    expect(session.sourceGhostRun).toHaveLength(0);
    expect(session.ghostsByChannel.size).toBe(0);
    expect(session.pendingPlacement).toBeNull();
    expect(session.resolvedDropTarget).toBeNull();
    expect(session.hoveredItem).toBeNull();
    expect(session.dragCoordinateParent.size).toBe(0);
    expect(session.dragLayoutPosition.size).toBe(0);
    expect(session.dragVisualStart.size).toBe(0);
    expect(session.groupVisualOffsets.size).toBe(0);

    ledger.length = 0;
    const cancelItem = mountItem(harness, source, "cancel-item");
    const cancelled = makeSession(root, cancelItem);
    expectedEndHandle = cancelled.handle;
    cancelled.dragVisual = "none";
    cancelled.status = "active";
    installDragSession(root, cancelled);
    cancelled.cancel();
    await drainFrames(harness.global);
    expect(ledger).toEqual(["end:root:outside:-1"]);
  } finally {
    harness.cleanup();
  }
});

test("throwing swap callbacks reconcile and finalize before reporting the same error once", async () => {
  const harness = createHarness();
  try {
    const sentinel = new Error("swap sentinel");
    const reportedErrors: unknown[] = [];
    let dragEndCount = 0;
    const rootCallbacks = callbackLedger("root", []);
    rootCallbacks.onItemSwap = () => {
      throw sentinel;
    };
    rootCallbacks.onDragEnd = () => {
      dragEndCount += 1;
    };
    const root = mountRoot(harness, rootCallbacks, "swap");
    const first = mountItem(harness, root, "first");
    const second = mountItem(harness, root, "second", 50);
    const session = makeSession(root, first, "swap");
    session.dragVisual = "none";
    session.status = "dropping";
    installDragSession(root, session);
    session.strategy.lifecycle.syncPlacement(session, {
      container: root,
      index: 1,
      insertion: null,
    });
    session.strategy.lifecycle.drop(session);

    await drainFrames(harness.global, 6, reportedErrors);

    expect(reportedErrors).toEqual([sentinel]);
    expect(dragEndCount).toBe(1);
    expect(root.itemOrderedList).toEqual([first, second]);
    expect(root.dragSession).toBeNull();
    expect(session.status).toBe("ended");
    expect(session.pendingPlacement).toBeNull();
    expect(session.hoveredItem).toBeNull();
    expect(session.ghostsByChannel.size).toBe(0);

    const nextSession = makeSession(root, first, "swap");
    nextSession.dragVisual = "none";
    nextSession.status = "active";
    installDragSession(root, nextSession);
    nextSession.cancel();
    await drainFrames(harness.global, 6, reportedErrors);
    expect(nextSession.status).toBe("ended");
    expect(root.dragSession).toBeNull();
    expect(reportedErrors).toEqual([sentinel]);
  } finally {
    harness.cleanup();
  }
});

test("error finalization skips DOM writes for disconnected participants", async () => {
  const harness = createHarness();
  try {
    const sentinel = new Error("drop sentinel");
    const reportedErrors: unknown[] = [];
    const root = mountRoot(harness);
    const item = mountItem(harness, root, "item");
    const lifecycle: DragLifecycleStrategy = {
      placementOccupiesFlowSlots: true,
      validateStart() {},
      dragStart() {},
      dragMove() {},
      currentPlacement: () => null,
      placementIndexFor: (_session, target) => target.index,
      syncPlacement() {},
      clearPlacement() {},
      afterPlacementSync() {},
      drop(session) {
        session.scheduleDropFinalizer();
        item.schedule(
          () => {
            throw sentinel;
          },
          { stage: "WRITE_1" },
        );
      },
    };
    const session = new DragSession(
      root,
      [item],
      [location(item)],
      {
        dropTarget: { resolve: () => null },
        lifecycle,
        defaultDragVisual: "item",
      },
      { handoffTo() {}, pointerId: 1, start: { x: 20, y: 20 } } as never,
      item,
    );
    session.status = "active";
    installDragSession(root, session);
    item.element!.remove();

    session.cancel();
    await drainFrames(harness.global, 6, reportedErrors);

    expect(reportedErrors).toEqual([sentinel]);
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();
    expect(item.style.position).toBe("relative");
    expect(item.transformMode).toBe("none");
  } finally {
    harness.cleanup();
  }
});

test("failed handoff stays atomic and does not block the next session", async () => {
  const harness = createHarness();
  try {
    const root = mountRoot(harness);
    const first = mountItem(harness, root, "first");
    mountItem(harness, root, "second", 50);
    const session = makeSession(root, first);
    const originalItems = session.items;
    const originalSources = session.activeSources;
    session.status = "pending";
    installDragSession(root, session);

    expect(() => session.handoff([first])).toThrow(
      "replacements must not include the current dragged items",
    );
    expect(session.items).toBe(originalItems);
    expect(session.activeSources).toBe(originalSources);
    expect(session.pressedItem).toBe(first);
    expect(root.dragSession).toBe(session.handle);

    session.cancel();
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();

    const nextSession = makeSession(root, first);
    nextSession.dragVisual = "none";
    nextSession.status = "active";
    installDragSession(root, nextSession);
    nextSession.cancel();
    await drainFrames(harness.global);
    expect(nextSession.status).toBe("ended");
    expect(root.dragSession).toBeNull();
  } finally {
    harness.cleanup();
  }
});

test("failed ghost teardown reports once and does not block the next session", async () => {
  const harness = createHarness();
  try {
    const sentinel = new Error("ghost remove sentinel");
    const reportedErrors: unknown[] = [];
    const renderedGhosts = new Set<string>();
    let removeAttempts = 0;
    const callbacks = callbackLedger("root", []);
    const root = mountRoot(harness, callbacks);
    root.callbacks = {
      ...callbacks,
      onGhostInsert: (event) => {
        const rootElement = root.element;
        if (!rootElement) throw new Error("Test root is not mounted.");
        renderedGhosts.add(event.ghost.ghostItemId);
        bindElement(
          harness,
          event.ghost.ghostItem,
          rootElement,
          event.ghost.ghostItemId,
        );
      },
      onGhostRemove: (event) => {
        removeAttempts += 1;
        renderedGhosts.delete(event.ghost.ghostItemId);
        if (removeAttempts === 1) throw sentinel;
      },
    };
    const item = mountItem(harness, root, "first");
    const session = makeSession(root, item);
    session.dragVisual = "none";
    session.status = "active";
    installDragSession(root, session);
    const ghost = item.createGhostItem(session, {
      type: "target-spacer",
      location: buildGhostSlotLocation(root, 0),
      rect: { x: 0, y: 0, width: 40, height: 40 },
    });
    session.flowGhostRun.push(ghost);
    root.insertGhost(ghost);

    session.cancel();
    await drainFrames(harness.global, 6, reportedErrors);

    expect(reportedErrors).toEqual([sentinel]);
    expect(removeAttempts).toBe(1);
    expect(renderedGhosts).toEqual(new Set());
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();

    const nextSession = makeSession(root, item);
    nextSession.dragVisual = "none";
    nextSession.status = "active";
    installDragSession(root, nextSession);
    nextSession.cancel();
    await drainFrames(harness.global, 6, reportedErrors);
    expect(nextSession.status).toBe("ended");
    expect(root.dragSession).toBeNull();
    expect(reportedErrors).toEqual([sentinel]);
  } finally {
    harness.cleanup();
  }
});

test("swap, hover, and absent optional callbacks keep their boundaries", async () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    const rootCallbacks = callbackLedger("root", ledger);
    rootCallbacks.onDragEnd = () => ledger.push("end:root");
    rootCallbacks.onDragItemLeave = () => ledger.push("hover:leave");
    rootCallbacks.onItemSwap = (event) => {
      ledger.push(
        `swap:root:${event.a.itemId}:${event.a.index}<->${event.b.itemId}:${event.b.index}`,
      );
      event.a.container.element?.insertBefore(
        event.b.item.element!,
        event.a.item.element!,
      );
    };
    const root = mountRoot(harness, rootCallbacks, "swap");
    const first = mountItem(harness, root, "first");
    const second = mountItem(harness, root, "second", 50);
    const session = makeSession(root, first, "swap");
    session.dragVisual = "none";
    session.status = "dropping";
    installDragSession(root, session);
    session.hoveredItem = second;
    session.strategy.lifecycle.syncPlacement(session, {
      container: root,
      index: 1,
      insertion: null,
    });
    session.strategy.lifecycle.drop(session);
    await drainFrames(harness.global);
    expect(ledger).toEqual([
      "hover:leave",
      "swap:root:first:0<->second:1",
      "end:root",
    ]);

    ledger.length = 0;
    root.callbacks = { ...root.callbacks, onDragEnd: undefined };
    const noEndCallback = makeSession(root, first, "swap");
    noEndCallback.dragVisual = "none";
    noEndCallback.status = "active";
    installDragSession(root, noEndCallback);
    noEndCallback.cancel();
    await drainFrames(harness.global);
    expect(ledger).toEqual([]);

    root.callbacks = {
      ...root.callbacks,
      onDragItemEnter: () => ledger.push("hover:enter"),
      onDragItemMove: () => ledger.push("hover:move"),
      onDragItemLeave: () => ledger.push("hover:leave"),
    };
    fireDragItemEnter(root, first, second, session);
    fireDragItemMove(root, first, second, session);
    fireDragItemLeave(root, first, second, session);
    expect(ledger).toEqual(["hover:enter", "hover:move", "hover:leave"]);
  } finally {
    harness.cleanup();
  }
});

test("placement hover routes a nested destination through its actual owner", async () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    const root = mountRoot(harness, {
      getItemHitbox: (event) => {
        ledger.push(`hitbox:${event.container.itemId}:${event.overItemId}`);
        return { shape: "rect", rect: event.defaultRect };
      },
      onDragItemEnter: (event) => {
        ledger.push(`enter:${event.container.itemId}:${event.overItemId}`);
      },
      onDragItemMove: (event) => {
        ledger.push(`move:${event.container.itemId}:${event.overItemId}`);
      },
      onDragItemLeave: (event) => {
        ledger.push(`leave:${event.container.itemId}:${event.overItemId}`);
      },
    });
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(harness, root, "destination", {
      getItemHitbox: () => {
        ledger.push("wrong-owner:hitbox");
        return {
          shape: "rect",
          rect: { x: 0, y: 0, width: 40, height: 40 },
        };
      },
      onDragItemEnter: () => ledger.push("wrong-owner:enter"),
      onDragItemMove: () => ledger.push("wrong-owner:move"),
      onDragItemLeave: () => ledger.push("wrong-owner:leave"),
    });
    const item = mountItem(harness, source, "item");
    const lifecycle: DragLifecycleStrategy = {
      placementOccupiesFlowSlots: false,
      validateStart() {},
      dragStart() {},
      dragMove() {},
      currentPlacement: (activeSession) => activeSession.pendingPlacement,
      placementIndexFor: (_activeSession, target) => target.index,
      syncPlacement: (activeSession, placement) => {
        activeSession.pendingPlacement = placement;
      },
      clearPlacement: (activeSession) => {
        activeSession.pendingPlacement = null;
      },
      afterPlacementSync() {},
      drop() {},
    };
    const strategy: SortStrategy = {
      mode: "insertion",
      dropTarget: {
        resolve: () => ({ container: destination, index: 0 }),
      },
      lifecycle,
    };
    const session = new DragSession(
      root,
      [item],
      [location(item)],
      strategy,
      dragStartFor(item),
      item,
    );
    session.status = "active";
    root.readDragSnapshotTree();
    root.captureDragSnapshotTree();

    await session.updateDropTarget();
    await session.updateDropTarget();
    session.clearHoveredItem();

    expect(ledger).toEqual([
      "hitbox:root:destination",
      "enter:root:destination",
      "hitbox:root:destination",
      "move:root:destination",
      "leave:root:destination",
    ]);
  } finally {
    harness.cleanup();
  }
});

test("swap hover remains scoped to the resolved container's direct children", async () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    const root = mountRoot(harness, {
      getItemHitbox: () => {
        ledger.push("wrong-self-hitbox");
        return {
          shape: "rect",
          rect: { x: 15, y: 15, width: 10, height: 10 },
        };
      },
      onDragItemEnter: () => ledger.push("wrong-self-enter"),
    });
    const source = mountContainer(harness, root, "source");
    const destination = mountContainer(harness, root, "destination", {
      getItemHitbox: (event) => {
        ledger.push(`hitbox:destination:${event.overItemId}`);
        return { shape: "rect", rect: event.defaultRect };
      },
      onDragItemEnter: (event) => {
        ledger.push(`enter:destination:${event.overItemId}`);
      },
    });
    const item = mountItem(harness, source, "item");
    mountItem(harness, destination, "swap-child");
    const lifecycle: DragLifecycleStrategy = {
      placementOccupiesFlowSlots: false,
      validateStart() {},
      dragStart() {},
      dragMove() {},
      currentPlacement: (activeSession) => activeSession.pendingPlacement,
      placementIndexFor: (_activeSession, target) => target.index,
      syncPlacement: (activeSession, placement) => {
        activeSession.pendingPlacement = placement;
      },
      clearPlacement: (activeSession) => {
        activeSession.pendingPlacement = null;
      },
      afterPlacementSync() {},
      drop() {},
    };
    const strategy: SortStrategy = {
      mode: "swap",
      dropTarget: {
        resolve: () => ({ container: destination, index: 0 }),
      },
      lifecycle,
    };
    const session = new DragSession(
      root,
      [item],
      [location(item)],
      strategy,
      dragStartFor(item),
      item,
    );
    session.status = "active";
    root.readDragSnapshotTree();
    root.captureDragSnapshotTree();

    await session.updateDropTarget();

    expect(ledger).toEqual([
      "hitbox:destination:swap-child",
      "enter:destination:swap-child",
    ]);
  } finally {
    harness.cleanup();
  }
});
