import { expect, test } from "@playwright/test";
import {
  ConnectorMirror,
  LineMirror,
  NodeMirror,
} from "../../assets/snapline/src";

import {
  armGesture,
  createControlledHarness,
  createEngineHarness,
  driveGestureDrop,
  eventPositionAt,
  installObserverStubs,
  nearTargetStrategy,
  startGestureDrag,
} from "../helpers/snapline-harness";

/** Tasks queued for one object at one stage, keyed by their queueId. */
function queuedIds(global: any, stage: string, objectId: string): string[] {
  const perObject = global.queue[stage].get(objectId);
  return perObject ? [...perObject.keys()] : [];
}

function mountPair() {
  const { engine, global } = createEngineHarness();
  const sourceNode = new NodeMirror(engine, null);
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "obs-out",
    name: "source",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "obs-in",
    name: "target",
    rules: { maxOutgoing: 0 },
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);
  return { engine, global, sourceNode, targetNode, source, target };
}

test("line geometry observers are multicast, and unsubscribing detaches only that one", () => {
  const { source } = mountPair();
  const line = new LineMirror(source.engine, source);
  const first: number[] = [];
  const second: number[] = [];

  const stopFirst = line.onGeometryInvalidated(() => first.push(1));
  line.onGeometryInvalidated(() => second.push(1));

  // No priming call: subscribing invalidates nothing.
  expect(first).toEqual([]);
  expect(second).toEqual([]);

  line.invalidateGeometry();
  expect(first).toEqual([1]);
  expect(second).toEqual([1]);

  stopFirst();
  line.invalidateGeometry();
  expect(first).toEqual([1]);
  expect(second).toEqual([1, 1]);

  line.destroy(false);
});

test("the line signal fires synchronously BEFORE the write task is queued", () => {
  const { global, source } = mountPair();
  const line = new LineMirror(source.engine, source);
  let queuedAtNotifyTime: string[] | null = null;

  line.onGeometryInvalidated(() => {
    queuedAtNotifyTime = queuedIds(global, "WRITE_2", line.id);
  });

  expect(queuedIds(global, "WRITE_2", line.id)).toEqual([]);
  line.invalidateGeometry();

  // The whole point of the design: the observer runs early enough to schedule
  // its own work into any stage, including one that runs before the line's.
  expect(queuedAtNotifyTime).toEqual([]);
  expect(queuedIds(global, "WRITE_2", line.id)).toEqual([
    `${line.id}-transform`,
  ]);

  line.destroy(false);
});

test("a throwing observer stops neither its peers nor the paint", () => {
  const { source } = mountPair();
  const line = new LineMirror(source.engine, source);
  const survived: number[] = [];
  const painted: number[] = [];
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(args);

  try {
    line.onGeometryInvalidated(() => {
      throw new Error("observer blew up");
    });
    line.onGeometryInvalidated(() => survived.push(1));
    line.bindGeometryWriter(() => painted.push(1));

    line.invalidateGeometryNow();
  } finally {
    console.error = originalError;
  }

  expect(survived).toEqual([1]);
  expect(errors).toHaveLength(1);
  // bindGeometryWriter primes once on bind, then paints once here.
  expect(painted).toEqual([1, 1]);

  line.destroy(false);
});

test("a node drag signals every node in the transform tree, not just the dragged one", () => {
  const restoreObservers = installObserverStubs();
  try {
    const { engine } = createEngineHarness();
    const parent = new NodeMirror(engine, null);
    const carried = new NodeMirror(engine, null);
    // Group carry and multi-select both move peers through the transform tree,
    // which is exactly what NodeCallbacks.onDrag fails to report.
    carried.attachTransformToGroup(parent);

    const parentHits: number[] = [];
    const carriedHits: number[] = [];
    parent.onGeometryInvalidated(() => parentHits.push(1));
    carried.onGeometryInvalidated(() => carriedHits.push(1));

    parent.scheduleTransformAndLines();

    expect(parentHits).toEqual([1]);
    expect(carriedHits).toEqual([1]);

    carried.destroy(false);
    parent.destroy(false);
  } finally {
    restoreObservers();
  }
});

test("a resize signals the node, and its snapshot reports authored size", () => {
  const restoreObservers = installObserverStubs();
  try {
    const { engine } = createEngineHarness();
    const node = new NodeMirror(engine, null, { minWidth: 40, minHeight: 20 });
    const seen: Array<{ width: number; height: number }> = [];

    node.worldTransform = { x: 7, y: 11 };
    node.onGeometryInvalidated((source) => {
      const geometry = source.geometrySnapshot();
      seen.push({ width: geometry.width, height: geometry.height });
    });

    node.setSize(120, 80);
    node.setSize(10, 5); // below the clamp

    // Authored size, read in the same tick it was authored — never the
    // previously rendered hitBox, which a READ_1 remeasure can overwrite
    // between authoring and paint.
    expect(seen).toEqual([
      { width: 120, height: 80 },
      { width: 40, height: 20 },
    ]);
    expect(node.geometrySnapshot()).toEqual({
      x: 7,
      y: 11,
      width: 40,
      height: 20,
    });

    node.destroy(false);
  } finally {
    restoreObservers();
  }
});

test("resolveNewLine seeds a genuinely new line and rides into the request", () => {
  const { engine, handle, requests, respondWith } = createControlledHarness();
  respondWith((request, current) => [...current, ...request.add]);
  const sourceNode = new NodeMirror(engine, null, {
    callbacks: {
      resolveNewLine: ({ connector }) => ({
        kind: `from:${connector.name}`,
      }),
    },
  });
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "seed-out",
    name: "source",
    rules: { maxIncoming: 0 },
    surfaceStrategies: [nearTargetStrategy],
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "seed-in",
    name: "target",
    rules: { maxOutgoing: 0 },
    surfaceStrategies: [nearTargetStrategy],
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);

  armGesture(source, 1);
  startGestureDrag(source, 1);
  const line = source.outgoingLines[0];
  // Seeded before any request exists — this is the only thing a preview
  // renderer can read mid-drag.
  expect(line.payload).toEqual({ kind: "from:source" });

  driveGestureDrop(source, 100, 1);
  expect(requests).toHaveLength(1);
  expect(requests[0].add[0].payload).toEqual({ kind: "from:source" });

  handle.flush();
  expect(target.incomingLines).toHaveLength(1);
});

test("a connector-level resolveNewLine overrides the node's", () => {
  const { engine } = createEngineHarness();
  const node = new NodeMirror(engine, null, {
    callbacks: { resolveNewLine: () => "from-node" },
  });
  const plain = new ConnectorMirror(engine, node, {
    name: "plain",
    rules: { maxIncoming: 0 },
  });
  const special = new ConnectorMirror(engine, node, {
    name: "special",
    rules: { maxIncoming: 0 },
    callbacks: { resolveNewLine: () => "from-connector" },
  });
  node.addConnectorObject(plain);
  node.addConnectorObject(special);

  armGesture(plain, 2);
  startGestureDrag(plain, 2);
  armGesture(special, 3);
  startGestureDrag(special, 3);
  expect(plain.outgoingLines[0].payload).toBe("from-node");
  expect(special.outgoingLines[0].payload).toBe("from-connector");
});

test("resolveNewLine reads the current callback at gesture start", () => {
  const { engine } = createEngineHarness();
  const node = new NodeMirror(engine, null, {
    callbacks: { resolveNewLine: () => "initial" },
  });
  const first = new ConnectorMirror(engine, node, {
    name: "first",
    rules: { maxIncoming: 0 },
  });
  const second = new ConnectorMirror(engine, node, {
    name: "second",
    rules: { maxIncoming: 0 },
  });
  node.addConnectorObject(first);
  node.addConnectorObject(second);

  armGesture(first, 4);
  startGestureDrag(first, 4);
  expect(first.outgoingLines[0].payload).toBe("initial");

  node.callbacks.resolveNewLine = () => "updated";
  armGesture(second, 5);
  startGestureDrag(second, 5);
  expect(second.outgoingLines[0].payload).toBe("updated");
});

test("a reconnect never re-seeds — the payload stays app-owned", () => {
  const { engine, handle, respondWith } = createControlledHarness();
  respondWith((request, current) => [...current, ...request.add]);
  let seeds = 0;
  const sourceNode = new NodeMirror(engine, null, {
    callbacks: { resolveNewLine: () => `seed-${++seeds}` },
  });
  const targetNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "rc-out",
    name: "source",
    rules: { maxIncoming: 0 },
    surfaceStrategies: [nearTargetStrategy],
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "rc-in",
    name: "target",
    rules: { maxOutgoing: 0, reconnect: true },
    surfaceStrategies: [nearTargetStrategy],
  });
  sourceNode.addConnectorObject(source);
  targetNode.addConnectorObject(target);

  armGesture(source, 4);
  startGestureDrag(source, 4);
  driveGestureDrop(source, 100, 4);
  handle.flush();
  const line = source.outgoingLines[0];
  expect(line.payload).toBe("seed-1");

  // Picking the settled line back up must not run the seeder again.
  target.armSurfaceGesture(
    {
      position: eventPositionAt(0, 0),
      event: { button: 0, pointerId: 5 },
    } as any,
    null,
  );
  driveGestureDrop(source, 100, 5);
  expect(seeds).toBe(1);
  expect(line.payload).toBe("seed-1");
});

test("empty-space vs refused drops are distinguishable, and spawn-on-drop works from app code", () => {
  const { engine, handle, respondWith } = createControlledHarness();
  respondWith((_request, current) => current); // reject: gestures never auto-commit
  const sourceNode = new NodeMirror(engine, null);
  const fullNode = new NodeMirror(engine, null);
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "spawn-out",
    name: "source",
    rules: { maxIncoming: 0 },
    surfaceStrategies: [nearTargetStrategy],
  });
  // A role-ineligible connector is filtered out during candidate resolution,
  // so dropping on one is genuinely a miss. A *refusal* is a connector that
  // resolves as a candidate and then declines at drop — which is what the
  // predicate's two-phase contract exists for.
  const refuser = new ConnectorMirror(engine, fullNode, {
    id: "spawn-refuse",
    name: "refuser",
    rules: {
      maxOutgoing: 0,
      maxIncoming: 1,
      isValidConnection: ({ phase }) => phase !== "drop",
    },
    surfaceStrategies: [nearTargetStrategy],
  });
  sourceNode.addConnectorObject(source);
  fullNode.addConnectorObject(refuser);

  const outcomes: string[] = [];
  source.updateConfig({
    callbacks: { onDragEnd: (event) => outcomes.push(event.outcome) },
  });

  // Drop far away — nearTargetStrategy misses beyond x=500.
  armGesture(source, 1);
  startGestureDrag(source, 1);
  driveGestureDrop(source, 900, 1);
  expect(outcomes).toEqual(["empty-space"]);

  // Drop on a connector that cannot accept: a refusal, not a miss.
  armGesture(source, 2);
  startGestureDrag(source, 2);
  driveGestureDrop(source, 100, 2);
  expect(outcomes).toEqual(["empty-space", "refused"]);

  // The spawn flow the "empty-space" branch enables: the app mounts the node
  // and pushes the line itself. The record is latent until the connector
  // registers, then converges with no extra wiring.
  handle.setCanonicalGraph({
    lines: [
      {
        id: "spawned",
        fromConnectorId: "spawn-out",
        toConnectorId: "spawned:input",
      },
    ],
  });
  handle.flush();
  expect(source.outgoingLines).toEqual([]); // latent — nothing to draw yet

  const spawnedNode = new NodeMirror(engine, null);
  const spawnedIn = new ConnectorMirror(engine, spawnedNode, {
    id: "spawned:input",
    name: "input",
    rules: { maxOutgoing: 0, maxIncoming: 1 },
  });
  spawnedNode.addConnectorObject(spawnedIn);
  handle.flush();

  expect(source.outgoingLines).toHaveLength(1);
  expect(source.outgoingLines[0].lineId).toBe("spawned");
  expect(spawnedIn.incomingLines).toHaveLength(1);
});
