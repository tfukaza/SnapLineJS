// Headless engine stand-in for SnapLine unit tests: a six-stage frame queue,
// an engine-scoped object table, and the input/collision surface the mirrors
// touch during construction. No DOM, no render loop.
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
    collisionEngine: {
      addObject() {},
      removeObject() {},
    },
    edgePanController: null,
    global: null,
    input: {
      claimPointer() {},
      registerObjectElement() {},
      setPointerDragOwner() {},
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
    collisionEngine: {
      addObject() {},
      removeObject() {},
    },
    edgePanController: null,
    global,
    input: {
      claimPointer() {},
      registerObjectElement() {},
      setPointerDragOwner() {},
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
