import { expect, test } from "@playwright/test";
import { CircleCollider, CollisionEngine } from "../../src/collision";
import {
  ConnectorMirror,
  LineMirror,
  NodeMirror,
  PlacementController,
  type ConnectorSurfaceStrategy,
} from "../../assets/snapline/src";
import { getGraphRegistry } from "../../assets/snapline/src";

import {
  armGesture,
  createControlledHarness,
  createEngineHarness,
  installObserverStubs,
  startGestureDrag,
} from "../helpers/snapline-harness";

test("line geometry writers are imperative, replaceable, and separate from state", () => {
  const { engine } = createEngineHarness();
  const sourceNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    name: "source",
    rules: { maxIncoming: 0 },
  });
  sourceNode.addConnectorObject(source);
  const line = new LineMirror(engine, source);
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
  line.setLineStartAnchor({ x: 10, y: 20 });
  line.setLineEndAnchor({ x: 35, y: 45 });
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

test("destroying an older same-name connector preserves its replacement", () => {
  const { engine } = createEngineHarness();
  const node = new NodeMirror(engine, null);
  const first = new ConnectorMirror(engine, node, { name: "shared" });
  const replacement = new ConnectorMirror(engine, node, { name: "shared" });

  node.addConnectorObject(first);
  expect(node.getConnector("shared")).toBe(first);

  node.addConnectorObject(replacement);
  expect(node.getConnector("shared")).toBe(replacement);

  first.destroy(false);
  expect(node.getConnector("shared")).toBe(replacement);

  replacement.destroy(false);
  node.destroy(false);
});

test("connector config updates stay live without replacing topology", () => {
  const { engine, handle } = createControlledHarness();
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "cfg-out",
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "cfg-in",
    name: "target",
    rules: { maxOutgoing: 0, maxIncoming: "unlimited" },
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);

  handle.setCanonicalGraph({
    lines: [
      { id: "cfg-line", fromConnectorId: "cfg-out", toConnectorId: "cfg-in" },
    ],
  });
  handle.flush();
  const existingLine = getGraphRegistry(engine).line("cfg-line")!;
  expect(source.outgoingLines).toEqual([existingLine]);

  const strategy: ConnectorSurfaceStrategy = {
    targetHitTest: ({ position }) => ({
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
  expect(source.colliderList[0]).toBeInstanceOf(CircleCollider);
  expect((source.colliderList[0] as CircleCollider).radius).toBe(42);

  source.updateConfig({
    callbacks: undefined,
    rules: { maxOutgoing: 0, maxIncoming: 2 },
    colliderRadius: undefined,
    edgePan: true,
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

  source.destroy();
  target.destroy();
  sourceNode.destroy();
  targetNode.destroy();
});

test("visible port binding can toggle while preserving connector lines", () => {
  const restoreObservers = installObserverStubs();
  const { engine, handle } = createControlledHarness();
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "bind-out",
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "bind-in",
    name: "target",
    rules: { maxOutgoing: 0 },
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);
  handle.setCanonicalGraph({
    lines: [
      {
        id: "bind-line",
        fromConnectorId: "bind-out",
        toConnectorId: "bind-in",
      },
    ],
  });
  handle.flush();
  const line = source.outgoingLines[0];
  expect(line.target).toBe(target);
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

test("target discovery is narrowed by the collision point query", () => {
  const { engine } = createEngineHarness();
  engine.collisionEngine = new CollisionEngine();
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    name: "target",
    rules: { maxOutgoing: 0 },
    surfaceStrategies: [
      {
        targetHitTest: ({ position }) => ({
          anchor: position,
          distance: 0,
        }),
      },
    ],
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);
  target.localTransform = { x: 100, y: 0 };

  expect(source.findCandidateAtPoint({ x: 100, y: 0 })?.connector).toBe(target);
  expect(source.findCandidateAtPoint({ x: 200, y: 0 })).toBeNull();
  source.destroy();
  target.destroy();
  sourceNode.destroy();
  targetNode.destroy();
});

test("targetHitTest replaces the ordinary center fallback", () => {
  const restoreObservers = installObserverStubs();
  const { engine } = createEngineHarness();
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    name: "target",
    rules: { maxOutgoing: 0 },
    surfaceStrategies: [{ targetHitTest: () => null }],
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);

  try {
    target.bindElement({ remove() {} } as unknown as HTMLElement);
    expect(source.findCandidateAtPoint({ x: 0, y: 0 })).toBeNull();
  } finally {
    target.bindElement(null);
    source.destroy();
    target.destroy();
    sourceNode.destroy();
    targetNode.destroy();
    restoreObservers();
  }
});

test("a pre-threshold reconnect release disarms the delegated source", () => {
  const { engine, handle } = createControlledHarness();
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "reconnect-source",
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "reconnect-target",
    name: "target",
    rules: { maxOutgoing: 0 },
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);
  handle.setCanonicalGraph({
    lines: [
      {
        id: "existing",
        fromConnectorId: source.connectorId,
        toConnectorId: target.connectorId,
      },
    ],
  });
  handle.flush();

  const clickEvent = { button: 0, buttons: 0, pointerId: 4 } as PointerEvent;
  target.armSurfaceGesture(
    {
      event: clickEvent,
      position: {
        x: 0,
        y: 0,
        cameraX: 0,
        cameraY: 0,
        screenX: 0,
        screenY: 0,
      },
    } as any,
    null,
  );
  (target as any).event.input.pointerUp({
    event: clickEvent,
    cancelled: false,
  });

  armGesture(source, 5);
  startGestureDrag(source, 5);
  expect(source.outgoingLines).toHaveLength(2);

  source.destroy();
  target.destroy();
  sourceNode.destroy();
  targetNode.destroy();
});
