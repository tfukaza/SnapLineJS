import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { Container } from "../../assets/snapsort/src/container";
import type { DragLifecycleStrategy } from "../../assets/snapsort/src/drag/lifecycle";
import { builtinStrategies } from "../../assets/snapsort/src/drag/drop-strategy";
import { DragSession } from "../../assets/snapsort/src/drag/session";
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
    domOwnership: "framework",
    mode,
    callbacks,
  });
  root.itemId = "root";
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
  callbacks: ContainerCallbacks,
): Container {
  const container = new Container(harness.engine, null, {
    domOwnership: "framework",
    callbacks,
  });
  container.itemId = id;
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
  const item = new Item(harness.engine, null);
  item.itemId = id;
  bindElement(harness, item, container.element!, id, x);
  container.attachItem(item);
  return item;
}

function location(item: Item) {
  const { container, index } = item.getIndexAndContainer();
  if (!container) throw new Error("Test item is not attached.");
  return { container, containerMetadata: container.metadata, index };
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
    flushMutation(mutation) {
      ledger.push(`flush:${owner}:start`);
      mutation();
      ledger.push(`flush:${owner}:end`);
    },
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
    onGhostRemove(event) {
      ledger.push(`ghost-remove:${owner}:${event.role}`);
      event.ghostItem.element?.remove();
    },
  };
}

test("activation and veto callbacks remain direct and preserve order", async () => {
  const harness = createHarness();
  try {
    const activationLedger: string[] = [];
    const lifecycle: DragLifecycleStrategy = {
      ghostKind: "flow",
      validateStart: () => activationLedger.push("validate"),
      dragStart: () => activationLedger.push("activate"),
      dragMove() {},
      currentGhostLocation: () => null,
      translateTargetIndex: (_session, target) => target.index,
      moveGhost() {},
      removeGhost() {},
      afterSyncDropTarget() {},
      drop() {},
    };
    const strategy = {
      dropTarget: { resolve: () => null },
      lifecycle,
      defaultDragVisual: "none" as const,
    };
    const root = mountRoot(harness, {
      flushMutation: () => activationLedger.push("unexpected-flush"),
      onDragStart: () => activationLedger.push("start"),
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
    root.dragSession = session;
    session.begin({ start: { x: 20, y: 20 } } as never);
    await drainFrames(harness.global);
    expect(activationLedger).toEqual(["start", "validate", "activate"]);

    session.status = "ended";
    root.dragSession = null;
    activationLedger.length = 0;
    root.config.callbacks!.onDragStart = () => {
      activationLedger.push("veto");
      return false;
    };
    const vetoed = new DragSession(
      root,
      [item],
      [location(item)],
      strategy,
      { handoffTo() {}, pointerId: 2, start: { x: 20, y: 20 } } as never,
      item,
    );
    root.dragSession = vetoed;
    vetoed.begin({ start: { x: 20, y: 20 } } as never);
    await drainFrames(harness.global);
    expect(activationLedger).toEqual(["veto"]);
    expect(vetoed.status).toBe("ended");
  } finally {
    harness.cleanup();
  }
});

test("movement and removal use the direct receiver's single commit", () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    const root = mountRoot(harness);
    const source = mountContainer(
      harness,
      root,
      "source",
      callbackLedger("source", ledger),
    );
    const destination = mountContainer(
      harness,
      root,
      "destination",
      callbackLedger("destination", ledger),
    );
    const first = mountItem(harness, source, "first");
    const second = mountItem(harness, source, "second", 50);

    first.moveItemsAt([location(first)], source, [first], 1, null);
    expect(ledger).toEqual([
      "flush:source:start",
      "move:source:source:0->source:1",
      "flush:source:end",
    ]);

    ledger.length = 0;
    first.moveItemsAt([location(first)], destination, [first], 0, null);
    expect(ledger).toEqual([
      "flush:destination:start",
      "move:destination:source:1->destination:0",
      "flush:destination:end",
    ]);

    ledger.length = 0;
    expect(source.removeItem(second.resolvedItemId)).toBe(true);
    expect(ledger).toEqual([
      "flush:source:start",
      "remove:source:second",
      "flush:source:end",
    ]);
  } finally {
    harness.cleanup();
  }
});

test("normal drop and outside cancellation preserve callback ledgers", async () => {
  const harness = createHarness();
  try {
    const ledger: string[] = [];
    const rootCallbacks = callbackLedger("root", ledger);
    rootCallbacks.onDragEnd = (event) =>
      ledger.push(
        `end:root:${event.destination?.container.itemId ?? "outside"}:${event.destination?.index ?? -1}`,
      );
    const root = mountRoot(harness, rootCallbacks);
    const source = mountContainer(
      harness,
      root,
      "source",
      callbackLedger("source", ledger),
    );
    const destination = mountContainer(
      harness,
      root,
      "destination",
      callbackLedger("destination", ledger),
    );
    const item = mountItem(harness, source, "item");
    const session = makeSession(root, item);
    session.dragVisual = "none";
    const ghost = item.createGhostItem(
      session,
      "flow",
      destination,
      null,
      "target",
    )!;
    bindElement(harness, ghost, destination.element!, "target-ghost");
    destination.attachItem(ghost);
    session.flowGhostRun.push(ghost);
    session.pendingGhostTarget = {
      ghostItem: ghost,
      container: destination,
      index: 0,
      ghostRect: null,
    };
    session.status = "dropping";
    root.dragSession = session;
    session.strategy.lifecycle.drop(session);
    await drainFrames(harness.global);

    expect(ledger).toEqual([
      "flush:destination:start",
      "ghost-remove:destination:target",
      "flush:destination:end",
      "flush:destination:start",
      "move:destination:source:0->destination:0",
      "flush:destination:end",
      "flush:root:start",
      "end:root:destination:0",
      "flush:root:end",
    ]);
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();
    expect(session.flowGhostRun).toHaveLength(0);
    expect(session.sourceGhostRun).toHaveLength(0);
    expect(session.ghosts.size).toBe(0);
    expect(session.pendingGhostTarget).toBeNull();
    expect(session.dropTarget).toBeNull();
    expect(session.hoveredItem).toBeNull();
    expect(session.dragCoordinateParent.size).toBe(0);
    expect(session.dragLayoutPosition.size).toBe(0);
    expect(session.dragVisualStart.size).toBe(0);
    expect(session.groupVisualOffsets.size).toBe(0);

    ledger.length = 0;
    const cancelItem = mountItem(harness, source, "cancel-item");
    const cancelled = makeSession(root, cancelItem);
    cancelled.dragVisual = "none";
    cancelled.status = "active";
    root.dragSession = cancelled;
    cancelled.cancel();
    await drainFrames(harness.global);
    expect(ledger).toEqual([
      "flush:root:start",
      "end:root:outside:-1",
      "flush:root:end",
    ]);
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
    root.dragSession = session;
    session.strategy.lifecycle.moveGhost(session, root, 1, null);
    session.strategy.lifecycle.drop(session);

    await drainFrames(harness.global, 6, reportedErrors);

    expect(reportedErrors).toEqual([sentinel]);
    expect(dragEndCount).toBe(1);
    expect(root.itemOrderedList).toEqual([first, second]);
    expect(root.dragSession).toBeNull();
    expect(session.status).toBe("ended");
    expect(session.pendingGhostTarget).toBeNull();
    expect(session.hoveredItem).toBeNull();
    expect(session.ghosts.size).toBe(0);

    const nextSession = makeSession(root, first, "swap");
    nextSession.dragVisual = "none";
    nextSession.status = "active";
    root.dragSession = nextSession;
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
      ghostKind: "flow",
      dragStart() {},
      dragMove() {},
      currentGhostLocation: () => null,
      translateTargetIndex: (_session, target) => target.index,
      moveGhost() {},
      removeGhost() {},
      afterSyncDropTarget() {},
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
    root.dragSession = session;
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
    root.dragSession = session;

    expect(() => session.handoff([first])).toThrow(
      "replacements must not include the current dragged items",
    );
    expect(session.items).toBe(originalItems);
    expect(session.activeSources).toBe(originalSources);
    expect(session.pressedItem).toBe(first);
    expect(root.dragSession).toBe(session);

    session.cancel();
    expect(session.status).toBe("ended");
    expect(root.dragSession).toBeNull();

    const nextSession = makeSession(root, first);
    nextSession.dragVisual = "none";
    nextSession.status = "active";
    root.dragSession = nextSession;
    nextSession.cancel();
    await drainFrames(harness.global);
    expect(nextSession.status).toBe("ended");
    expect(root.dragSession).toBeNull();
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
    root.dragSession = session;
    session.hoveredItem = second;
    session.strategy.lifecycle.moveGhost(session, root, 1, null);
    session.strategy.lifecycle.drop(session);
    await drainFrames(harness.global);
    expect(ledger).toEqual([
      "hover:leave",
      "flush:root:start",
      "swap:root:first:0<->second:1",
      "flush:root:end",
      "flush:root:start",
      "end:root",
      "flush:root:end",
    ]);

    ledger.length = 0;
    root.config.callbacks!.onDragEnd = undefined;
    const noEndCallback = makeSession(root, first, "swap");
    noEndCallback.dragVisual = "none";
    noEndCallback.status = "active";
    root.dragSession = noEndCallback;
    noEndCallback.cancel();
    await drainFrames(harness.global);
    expect(ledger).toEqual([]);

    (session as any).fireDropTargetChange(null, {
      container: root,
      index: 0,
    });
    expect(ledger).toEqual([]);

    root.config.callbacks!.onDropTargetChange = (event) =>
      ledger.push(`target:root:${event.current?.index}`);
    (session as any).fireDropTargetChange(null, {
      container: root,
      index: 0,
    });
    expect(ledger).toEqual([
      "flush:root:start",
      "target:root:0",
      "flush:root:end",
    ]);

    ledger.length = 0;
    root.config.callbacks!.onDragItemEnter = () => ledger.push("hover:enter");
    root.config.callbacks!.onDragItemMove = () => ledger.push("hover:move");
    root.config.callbacks!.onDragItemLeave = () => ledger.push("hover:leave");
    fireDragItemEnter(root, first, second, session);
    fireDragItemMove(root, first, second, session);
    fireDragItemLeave(root, first, second, session);
    expect(ledger).toEqual(["hover:enter", "hover:move", "hover:leave"]);
  } finally {
    harness.cleanup();
  }
});
