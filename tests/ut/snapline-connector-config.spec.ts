import { expect, test } from "@playwright/test";
import { CircleCollider } from "../../src/collision";
import {
  ConnectorMirror,
  LineMirror,
  NodeMirror,
  PlacementController,
  setGraphAuthority,
  type ConnectorSurfaceStrategy,
} from "../../assets/snapline/core/src";

import {
  createEngineHarness,
  installObserverStubs,
} from "../helpers/snapline-harness";

test("line geometry writers are imperative, replaceable, and separate from state", () => {
  const { engine } = createEngineHarness();
  const sourceNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    name: "source",
    rules: { maxIncoming: 0 },
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
  const node = new NodeMirror(engine, null);
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
  setGraphAuthority(engine, "uncontrolled");
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    name: "target",
    rules: { maxOutgoing: 0, maxIncoming: "unlimited" },
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);

  expect(source.connectToConnector({ target })).toBe(true);
  const existingLine = source.outgoingLines[0];

  class UpdatedLine extends LineMirror {}
  const strategy: ConnectorSurfaceStrategy = {
    sourceHitTest: ({ position }) => ({
      anchor: position,
      distance: 0,
    }),
  };
  const isValidConnection = () => true;
  const callbacks = {
    onDragStart: () => {},
  };
  const metadata = { domainId: "updated-source" };

  source.updateConfig({
    callbacks,
    rules: {
      maxOutgoing: "unlimited",
      maxIncoming: 4,
      reconnect: false,
      allowParallel: true,
      onFull: "replace-oldest",
      isValidConnection,
    },
    colliderRadius: 42,
    edgePan: false,
    lineClass: UpdatedLine,
    metadata,
    surfaceStrategies: [strategy],
  });

  expect(source.outgoingLines).toEqual([existingLine]);
  expect(existingLine.target).toBe(target);
  expect(source.callbacks).toBe(callbacks);
  expect(source.metadata).toBe(metadata);
  expect(source.rules).toEqual({
    maxOutgoing: Infinity,
    maxIncoming: 4,
    reconnect: false,
    allowParallel: true,
    onFull: "replace-oldest",
    isValidConnection,
  });
  expect(source.isSource).toBe(true);
  expect(source.isTarget).toBe(true);
  expect(source.config.edgePan).toBe(false);
  expect(source.config.lineClass).toBe(UpdatedLine);
  expect(source.colliderList[0]).toBeInstanceOf(CircleCollider);
  expect((source.colliderList[0] as CircleCollider).radius).toBe(42);
  expect(global.data.sourceSurfaces).toEqual([source]);
  const updatedLine = source.createLine();
  expect(updatedLine).toBeInstanceOf(UpdatedLine);
  updatedLine.destroy(false);

  source.updateConfig({
    callbacks: undefined,
    rules: { maxOutgoing: 0, maxIncoming: 2 },
    colliderRadius: undefined,
    edgePan: true,
    lineClass: undefined,
    metadata: undefined,
    surfaceStrategies: [],
  });

  expect(source.outgoingLines).toEqual([existingLine]);
  expect(source.callbacks).toEqual({});
  expect(source.metadata).toEqual({});
  expect(source.rules).toEqual({
    maxOutgoing: 0,
    maxIncoming: 2,
    reconnect: true,
    allowParallel: false,
    onFull: "reject",
    isValidConnection: null,
  });
  expect(source.isSource).toBe(false);
  expect(source.isTarget).toBe(true);
  expect((source.colliderList[0] as CircleCollider).radius).toBe(30);
  expect(global.data.sourceSurfaces).toEqual([]);
  const defaultLine = source.createLine();
  expect(defaultLine).toBeInstanceOf(LineMirror);
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
  setGraphAuthority(engine, "uncontrolled");
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    name: "target",
    rules: { maxOutgoing: 0 },
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
  setGraphAuthority(engine, "uncontrolled");
  const firstNode = new NodeMirror(engine, null);
  const secondNode = new NodeMirror(engine, null);
  const first = new ConnectorMirror(engine, firstNode, {
    name: "value",
    rules: {
      maxIncoming: "unlimited",
    },
  });
  const second = new ConnectorMirror(engine, secondNode, {
    name: "value",
    rules: {
      maxIncoming: "unlimited",
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
