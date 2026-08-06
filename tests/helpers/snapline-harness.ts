import {
  ConnectorMirror,
  NodeMirror,
  attachControlledGraph,
  type ConnectorSurfaceStrategy,
  type ControlledGraphHandle,
  type LineChangeRequest,
  type LineRecord,
  type ReconciliationError,
} from "../../assets/snapline/core/src";

// Headless engine stand-in for SnapLine unit tests: a six-stage frame queue,
// an engine-scoped object table, and the input/collision surface the mirrors
// touch during construction. No DOM, no render loop.
function createCollisionHarness() {
  const colliders: any[] = [];
  return {
    addObject(collider: any) {
      if (!colliders.includes(collider)) colliders.push(collider);
    },
    removeObject(id: symbol) {
      const index = colliders.findIndex((collider) => collider.id === id);
      if (index !== -1) colliders.splice(index, 1);
    },
    queryPoint(_position: { x: number; y: number }) {
      // SnapLine's headless policy tests use targetHitTest as their narrow
      // phase. The real CollisionEngine point-query behavior is covered by
      // core collision tests.
      return [...colliders];
    },
  };
}

export function createEngineHarness() {
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
    collisionEngine: createCollisionHarness(),
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

/** A second engine sharing the first harness's GlobalManager, for
 * multi-engine isolation tests. */
export function createSiblingEngine(global: any) {
  const engine: any = {
    camera: null,
    collisionEngine: createCollisionHarness(),
    edgePanController: null,
    global,
    input: {
      claimPointer() {},
      registerObjectElement() {},
      subscribeGlobalCursorEvent() {},
      unregisterObjectElement() {},
      unsubscribeGlobalCursorEvent() {},
    },
  };
  return engine;
}

export function installObserverStubs(): () => void {
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

/**
 * Engine + attached controlled-graph bridge with request/diagnostic logs.
 *
 * Stands in for an application document: the handler must now return the next
 * line list synchronously, so the harness tracks one. The default answer is
 * rejection — return the document unchanged — and `respondWith` installs an
 * accept/normalize policy. Pushes through the returned handle update the
 * tracked document too, so a later gesture rejects against what the test
 * actually loaded rather than against an empty list.
 */
export function createControlledHarness() {
  const { engine, global } = createEngineHarness();
  const requests: LineChangeRequest[] = [];
  const diagnosticsLog: (readonly ReconciliationError[])[] = [];
  let doc: readonly LineRecord[] = [];
  let respond:
    | ((
        request: LineChangeRequest,
        current: readonly LineRecord[],
      ) => readonly LineRecord[])
    | null = null;

  const bridge = attachControlledGraph(engine, {
    onLineChangeRequest: (request) => {
      requests.push(request);
      if (respond) doc = respond(request, doc);
      return doc;
    },
    onDiagnosticsChanged: (diagnostics) => diagnosticsLog.push(diagnostics),
  });

  const handle: ControlledGraphHandle = {
    ...bridge,
    setCanonicalGraph: (snapshot) => {
      doc = snapshot.lines;
      bridge.setCanonicalGraph(snapshot);
    },
  };

  return {
    engine,
    global,
    handle,
    requests,
    diagnosticsLog,
    respondWith: (
      fn: (
        request: LineChangeRequest,
        current: readonly LineRecord[],
      ) => readonly LineRecord[],
    ) => {
      respond = fn;
    },
  };
}

export function eventPositionAt(x: number, y: number) {
  return { x, y, cameraX: x, cameraY: y, screenX: x, screenY: y };
}

/** targetHitTest accepting drops left of x=500 (far drops miss). */
export const nearTargetStrategy: ConnectorSurfaceStrategy = {
  targetHitTest: ({ position }) =>
    position.x < 500
      ? { anchor: { x: position.x, y: position.y }, distance: 0 }
      : null,
};

/** Arm a connection gesture on `connector` (pointer down at origin). */
export function armGesture(connector: ConnectorMirror, pointerId = 7): void {
  const event = { button: 0, pointerId } as any;
  connector.onCursorDown({ position: eventPositionAt(0, 0), event } as any);
}

/** Drive dragStart + dragEnd on the gesture owner, dropping at `dropX`. */
/** Cross the drag threshold without dropping, so the preview line exists. */
export function startGestureDrag(owner: ConnectorMirror, pointerId = 7): void {
  const event = { button: 0, pointerId } as any;
  (owner as any).event.input.dragStart({
    start: eventPositionAt(0, 0),
    pointerId,
    event,
  });
}

export function driveGestureDrop(
  owner: ConnectorMirror,
  dropX: number,
  pointerId = 7,
): void {
  const event = { button: 0, pointerId } as any;
  (owner as any).event.input.dragStart({
    start: eventPositionAt(0, 0),
    pointerId,
    event,
  });
  (owner as any).event.input.dragEnd({
    end: eventPositionAt(dropX, 10),
    pointerId,
    event,
  });
}

/** Source/target pair with stable ids for controlled-graph tests. */
export function mountConnectedPair(engine: any) {
  const sourceNode = new NodeMirror(engine, null, { id: "n-src" });
  const targetNode = new NodeMirror(engine, null, { id: "n-tgt" });
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "out-1",
    name: "out",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "in-1",
    name: "in",
    rules: { maxOutgoing: 0 },
    surfaceStrategies: [nearTargetStrategy],
  });
  return { sourceNode, targetNode, source, target };
}
