import { expect, test } from "@playwright/test";
import { CircleCollider } from "../../src/collision";
import {
  ConnectorComponent,
  LineComponent,
  NodeComponent,
  PlacementController,
  type ConnectorSurfaceStrategy,
} from "../../assets/snapline/core/src";

function createEngineHarness() {
  let nextId = 0;
  const objects: Record<string, unknown> = {};
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
    collisionEngine: {
      addObject() {},
      removeObject() {},
    },
    edgePanController: null,
    global: null,
    input: {
      claimPointer() {},
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
    createId: () => `${++nextId}`,
    getEngineObjectTable: (candidate: unknown) =>
      candidate === engine ? objects : {},
    registerObject: (object: { id: string }) => {
      objects[object.id] = object;
    },
    unregisterObject: (object: { id: string }) => {
      delete objects[object.id];
    },
  };
  engine.global = global;
  return { engine, global };
}

function installObserverStubs(): () => void {
  const resizeDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "ResizeObserver",
  );
  const mutationDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "MutationObserver",
  );
  class ObserverStub {
    observe() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ObserverStub,
  });
  Object.defineProperty(globalThis, "MutationObserver", {
    configurable: true,
    value: ObserverStub,
  });
  return () => {
    if (resizeDescriptor) {
      Object.defineProperty(globalThis, "ResizeObserver", resizeDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).ResizeObserver;
    }
    if (mutationDescriptor) {
      Object.defineProperty(globalThis, "MutationObserver", mutationDescriptor);
    } else {
      delete (globalThis as Record<string, unknown>).MutationObserver;
    }
  };
}

test("line geometry writers are imperative, replaceable, and separate from state", () => {
  const { engine } = createEngineHarness();
  const sourceNode = new NodeComponent(engine, null);
  const source = new ConnectorComponent(engine, sourceNode, {
    name: "source",
    capabilities: { source: true, target: false },
  });
  sourceNode.addConnectorObject(source);
  const line = source.createLine();
  const firstWrites: number[] = [];
  const secondWrites: number[] = [];
  const states: string[] = [];

  const unbindFirst = line.bindGeometryWriter((geometry) => {
    firstWrites.push(geometry.delta.x);
  });
  const unbindSecond = line.bindGeometryWriter((geometry) => {
    secondWrites.push(geometry.delta.x);
  });
  const unsubscribeState = line.onStateChange((state) => {
    states.push(state.phase);
  });

  // A stale framework cleanup must not detach the newer renderer.
  unbindFirst();
  line.setLinePosition(10, 20, 35, 45);
  expect(firstWrites).toEqual([0]);
  expect(secondWrites).toEqual([0]);
  expect(states).toEqual(["source-start"]);

  line.writeTransform();
  expect(secondWrites).toEqual([0, 25]);
  expect(states).toEqual(["source-start"]);

  line.setPhase("preview-free");
  expect(states).toEqual(["source-start", "preview-free"]);
  expect(secondWrites).toEqual([0, 25]);

  unbindSecond();
  unsubscribeState();
  line.destroy(false);
  source.destroy();
  sourceNode.destroy();
});

test("placement geometry writes do not require framework state updates", () => {
  const controller = new PlacementController<{ id: string }>({
    screenToWorld: ({ x, y }) => ({ x: x + 10, y: y + 20 }),
  });
  const firstWrites: Array<{ visible: boolean; x: number | null }> = [];
  const secondWrites: Array<{ visible: boolean; x: number | null }> = [];
  const states: boolean[] = [];

  const unbindFirst = controller.bindGeometryWriter((geometry) => {
    firstWrites.push({
      visible: geometry.visible,
      x: geometry.position?.x ?? null,
    });
  });
  const unbindSecond = controller.bindGeometryWriter((geometry) => {
    secondWrites.push({
      visible: geometry.visible,
      x: geometry.position?.x ?? null,
    });
  });
  const unsubscribeState = controller.onStateChange((snapshot) => {
    states.push(snapshot.active);
  });

  unbindFirst();
  controller.begin({ id: "new-node" }, { width: 20, height: 10 });
  controller.update({ x: 50, y: 40 });

  expect(firstWrites).toEqual([{ visible: false, x: null }]);
  expect(secondWrites).toEqual([
    { visible: false, x: null },
    { visible: false, x: null },
    { visible: true, x: 50 },
  ]);
  expect(states).toEqual([false, true, true]);

  unbindSecond();
  unsubscribeState();
});

test("framework cleanup detaches elements without removing owned DOM", () => {
  const restoreObservers = installObserverStubs();
  const { engine } = createEngineHarness();
  const node = new NodeComponent(engine, null);
  let firstRemovals = 0;
  let secondRemovals = 0;
  const firstElement = {
    remove: () => {
      firstRemovals++;
    },
  } as unknown as HTMLElement;
  const secondElement = {
    remove: () => {
      secondRemovals++;
    },
  } as unknown as HTMLElement;

  try {
    node.element = firstElement;
    node.element = secondElement;

    expect(node.detachElement(firstElement)).toBe(false);
    expect(node.element).toBe(secondElement);

    node.destroy(false);
    expect(node.element).toBeNull();
    expect(firstRemovals).toBe(0);
    expect(secondRemovals).toBe(0);
  } finally {
    restoreObservers();
  }
});

test("connector config updates stay live without replacing topology", () => {
  const { engine, global } = createEngineHarness();
  const sourceNode = new NodeComponent(engine, null);
  const targetNode = new NodeComponent(engine, null);
  const source = new ConnectorComponent(engine, sourceNode, {
    name: "source",
    capabilities: { source: true, target: false },
  });
  const target = new ConnectorComponent(engine, targetNode, {
    name: "target",
    capabilities: { source: false, target: true, maxIncoming: -1 },
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);

  expect(source.connectToConnector({ target })).toBe(true);
  const existingLine = source.outgoingLines[0];

  class UpdatedLine extends LineComponent {}
  const strategy: ConnectorSurfaceStrategy = {
    sourceHitTest: ({ position }) => ({
      anchor: position,
      distance: 0,
    }),
  };
  const callbacks = {
    canConnect: () => true,
  };
  const metadata = { domainId: "updated-source" };

  source.updateConfig({
    allowDragOut: true,
    callbacks,
    capabilities: {
      source: true,
      target: true,
      maxIncoming: 4,
      reconnect: false,
      allowParallel: true,
    },
    colliderRadius: 42,
    edgePan: false,
    lineClass: UpdatedLine,
    maxConnectors: 4,
    metadata,
    surfaceStrategies: [strategy],
  });

  expect(source.outgoingLines).toEqual([existingLine]);
  expect(existingLine.target).toBe(target);
  expect(source.callbacks).toBe(callbacks);
  expect(source.metadata).toBe(metadata);
  expect(source.capabilities).toEqual({
    source: true,
    target: true,
    maxIncoming: 4,
    reconnect: false,
    allowParallel: true,
  });
  expect(source.config.edgePan).toBe(false);
  expect(source.config.lineClass).toBe(UpdatedLine);
  expect(source.colliderList[0]).toBeInstanceOf(CircleCollider);
  expect((source.colliderList[0] as CircleCollider).radius).toBe(42);
  expect(global.data.sourceSurfaces).toEqual([source]);
  const updatedLine = source.createLine();
  expect(updatedLine).toBeInstanceOf(UpdatedLine);
  updatedLine.destroy(false);

  source.updateConfig({
    allowDragOut: false,
    callbacks: undefined,
    capabilities: undefined,
    colliderRadius: undefined,
    edgePan: true,
    lineClass: undefined,
    maxConnectors: 2,
    metadata: undefined,
    surfaceStrategies: [],
  });

  expect(source.outgoingLines).toEqual([existingLine]);
  expect(source.callbacks).toEqual({});
  expect(source.metadata).toEqual({});
  expect(source.capabilities).toEqual({
    source: false,
    target: true,
    maxIncoming: 2,
    reconnect: true,
    allowParallel: false,
  });
  expect((source.colliderList[0] as CircleCollider).radius).toBe(30);
  expect(global.data.sourceSurfaces).toEqual([]);
  const defaultLine = source.createLine();
  expect(defaultLine).toBeInstanceOf(LineComponent);
  expect(defaultLine).not.toBeInstanceOf(UpdatedLine);
  defaultLine.destroy(false);

  source.destroy();
  target.destroy();
  sourceNode.destroy();
  targetNode.destroy();
});

test("visible port binding can toggle while preserving connector lines", () => {
  const restoreObservers = installObserverStubs();
  const { engine } = createEngineHarness();
  const sourceNode = new NodeComponent(engine, null);
  const targetNode = new NodeComponent(engine, null);
  const source = new ConnectorComponent(engine, sourceNode, {
    name: "source",
    capabilities: { source: true, target: false },
  });
  const target = new ConnectorComponent(engine, targetNode, {
    name: "target",
    capabilities: { source: false, target: true },
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);
  expect(source.connectToConnector({ target })).toBe(true);
  const line = source.outgoingLines[0];
  const firstElement = {} as HTMLElement;
  const secondElement = {} as HTMLElement;

  try {
    source.bindElement(firstElement);
    expect(source.element).toBe(firstElement);

    source.bindElement(null);
    expect(source.element).toBeNull();
    expect(source.outgoingLines).toEqual([line]);
    expect(line.target).toBe(target);

    source.bindElement(secondElement);
    expect(source.element).toBe(secondElement);
    expect(source.outgoingLines).toEqual([line]);
    expect(line.target).toBe(target);
  } finally {
    source.bindElement(null);
    source.destroy();
    target.destroy();
    sourceNode.destroy();
    targetNode.destroy();
    restoreObservers();
  }
});

test("bidirectional connector graphs propagate props without recursing forever", () => {
  const { engine } = createEngineHarness();
  const firstNode = new NodeComponent(engine, null);
  const secondNode = new NodeComponent(engine, null);
  const first = new ConnectorComponent(engine, firstNode, {
    name: "value",
    capabilities: {
      source: true,
      target: true,
      maxIncoming: -1,
    },
  });
  const second = new ConnectorComponent(engine, secondNode, {
    name: "value",
    capabilities: {
      source: true,
      target: true,
      maxIncoming: -1,
    },
  });
  firstNode.addConnectorObject(first);
  secondNode.addConnectorObject(second);

  expect(first.connectToConnector({ target: second })).toBe(true);
  expect(second.connectToConnector({ target: first })).toBe(true);

  let firstUpdates = 0;
  let secondUpdates = 0;
  firstNode.addSetPropCallback(() => {
    firstUpdates += 1;
  }, "value");
  secondNode.addSetPropCallback(() => {
    secondUpdates += 1;
  }, "value");

  firstNode.setProp("value", "shared");

  expect(firstNode.getProp("value")).toBe("shared");
  expect(secondNode.getProp("value")).toBe("shared");
  expect(firstUpdates).toBe(1);
  expect(secondUpdates).toBe(1);

  first.destroy();
  second.destroy();
  firstNode.destroy();
  secondNode.destroy();
});
