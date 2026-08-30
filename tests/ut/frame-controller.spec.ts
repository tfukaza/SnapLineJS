import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { BaseObject, Engine, GlobalManager } from "../../src";
import type { FrameCallback, FrameController, FrameInfo } from "../../src";

type InstalledGlobal = {
  key: "window" | "document";
  descriptor: PropertyDescriptor | undefined;
};

function createFrameHarness() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const installed: InstalledGlobal[] = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
  }) as Array<[InstalledGlobal["key"], unknown]>) {
    installed.push({
      key,
      descriptor: Object.getOwnPropertyDescriptor(globalThis, key),
    });
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  let nextFrameId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  Object.defineProperties(dom.window, {
    requestAnimationFrame: {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        const id = ++nextFrameId;
        frames.set(id, callback);
        return id;
      },
    },
    cancelAnimationFrame: {
      configurable: true,
      value: (id: number) => frames.delete(id),
    },
  });

  GlobalManager.resetInstance();
  const engines: Engine[] = [];

  return {
    createEngine() {
      const engine = new Engine();
      engines.push(engine);
      return engine;
    },
    runFrame(timestamp: number) {
      const next = frames.entries().next().value;
      if (!next) throw new Error("No animation frame is queued.");
      const [id, callback] = next;
      frames.delete(id);
      callback(timestamp);
    },
    async waitForNextFrame() {
      await expect.poll(() => frames.size).toBe(1);
    },
    cleanup() {
      for (const engine of engines.reverse()) {
        if (!engine.frameController.signal.aborted) engine.destroy();
      }
      GlobalManager.resetInstance();
      for (const { key, descriptor } of installed) {
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

test("frame controllers run before every engine READ_1 with the shared rAF timestamp", async () => {
  const harness = createFrameHarness();
  try {
    const firstEngine = harness.createEngine();
    const secondEngine = harness.createEngine();
    const firstObject = new BaseObject(firstEngine);
    const secondObject = new BaseObject(secondEngine);
    const order: string[] = [];
    const timestamps: number[] = [];
    const frames: FrameInfo[] = [];

    firstEngine.frameController.subscribe((frame) => {
      order.push(`frame:first:${firstEngine.global?.currentStage}`);
      timestamps.push(frame.timestamp);
      frames.push(frame);
      firstObject.schedule(() => order.push("read:first"), {
        stage: "READ_1",
      });
    });
    secondEngine.frameController.subscribe((frame) => {
      order.push(`frame:second:${secondEngine.global?.currentStage}`);
      timestamps.push(frame.timestamp);
      frames.push(frame);
      secondObject.schedule(() => order.push("read:second"), {
        stage: "READ_1",
      });
    });

    harness.runFrame(417.25);
    await harness.waitForNextFrame();

    expect(order).toEqual([
      "frame:first:IDLE",
      "frame:second:IDLE",
      "read:first",
      "read:second",
    ]);
    expect(timestamps).toEqual([417.25, 417.25]);
    expect(frames[0]).toBe(frames[1]);
    expect(Object.isFrozen(frames[0])).toBe(true);
  } finally {
    harness.cleanup();
  }
});

test("frame subscriptions are ordered, snapshotted, abortable, and error-isolated", async () => {
  const harness = createFrameHarness();
  const reported: unknown[] = [];
  const previousReportError = Object.getOwnPropertyDescriptor(
    globalThis,
    "reportError",
  );
  Object.defineProperty(globalThis, "reportError", {
    configurable: true,
    writable: true,
    value: (error: unknown) => reported.push(error),
  });

  try {
    const engine = harness.createEngine();
    const frameController: FrameController = engine.frameController;
    const calls: string[] = [];
    let addedLateSubscriber = false;
    let unsubscribeRemovedSubscriber = () => {};
    const first: FrameCallback = ({ timestamp }: FrameInfo) => {
      calls.push(`first:${timestamp}`);
      if (!addedLateSubscriber) {
        addedLateSubscriber = true;
        unsubscribeRemovedSubscriber();
        frameController.subscribe(({ timestamp }) => {
          calls.push(`late:${timestamp}`);
        });
        throw new Error("frame callback failed");
      }
    };
    frameController.subscribe(first);
    frameController.subscribe(async ({ timestamp }) => {
      calls.push(`async:${timestamp}`);
      if (timestamp === 10) throw new Error("async frame callback failed");
    });

    const abortedSubscription = new AbortController();
    frameController.subscribe(
      ({ timestamp }) => calls.push(`aborted:${timestamp}`),
      { signal: abortedSubscription.signal },
    );
    abortedSubscription.abort();

    frameController.subscribe(({ timestamp }) => {
      calls.push(`second:${timestamp}`);
    });
    unsubscribeRemovedSubscriber = frameController.subscribe(
      ({ timestamp }) => {
        calls.push(`removed:${timestamp}`);
      },
    );

    harness.runFrame(10);
    await harness.waitForNextFrame();
    await expect.poll(() => reported.length).toBe(2);
    expect(calls).toEqual(["first:10", "async:10", "second:10"]);

    harness.runFrame(26);
    await harness.waitForNextFrame();
    expect(calls).toEqual([
      "first:10",
      "async:10",
      "second:10",
      "first:26",
      "async:26",
      "second:26",
      "late:26",
    ]);
  } finally {
    if (previousReportError) {
      Object.defineProperty(globalThis, "reportError", previousReportError);
    } else {
      delete (globalThis as Record<string, unknown>).reportError;
    }
    harness.cleanup();
  }
});

test("engine destruction aborts frame work before input teardown", () => {
  const harness = createFrameHarness();
  try {
    const engine = harness.createEngine();
    const lifecycle: string[] = [];
    engine.frameController.signal.addEventListener("abort", () => {
      lifecycle.push("frame-abort");
    });
    const destroyInput = engine.input.destroy.bind(engine.input);
    engine.input.destroy = () => {
      lifecycle.push("input-destroy");
      destroyInput();
    };

    engine.destroy();

    expect(engine.frameController.signal.aborted).toBe(true);
    expect(lifecycle).toEqual(["frame-abort", "input-destroy"]);
    const unsubscribe = engine.frameController.subscribe(() => {
      lifecycle.push("late-frame");
    });
    unsubscribe();
  } finally {
    harness.cleanup();
  }
});
