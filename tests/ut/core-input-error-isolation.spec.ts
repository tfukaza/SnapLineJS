import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { InputControl } from "../../src/input";
import { ElementObject } from "../../src/object";

// A consumer handler that throws must not unwind the input dispatch. The
// pointer record deleted at the end of #finishPointer is what releases the
// pointer's claim, and a claim that outlives its gesture suppresses every
// later global pointerMove for that pointer id — which is how a throwing
// dragEnd once left the resize cursor stuck until the next click.

type InstalledGlobal = {
  key: "window" | "document" | "HTMLElement" | "Node" | "AbortController";
  descriptor: PropertyDescriptor | undefined;
};

function installDomGlobals(window: JSDOM["window"]): () => void {
  const values = {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    AbortController: window.AbortController,
  };
  const installed: InstalledGlobal[] = [];

  for (const [key, value] of Object.entries(values) as Array<
    [InstalledGlobal["key"], unknown]
  >) {
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

  return () => {
    for (const { key, descriptor } of installed) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete (globalThis as Record<string, unknown>)[key];
      }
    }
  };
}

function pointerEvent(
  window: JSDOM["window"],
  type: string,
  {
    x,
    y,
    buttons,
    pointerId,
  }: { x: number; y: number; buttons: number; pointerId: number },
): Event {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    buttons,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
}

test("a throwing dragEnd handler does not strand the pointer's claim", () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='engine'></div></body></html>",
  );
  const restoreGlobals = installDomGlobals(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>("#engine");
  if (!container) throw new Error("Missing test container");

  // The engine reports consumer errors through globalThis.reportError; capture
  // it so a deliberately thrown error doesn't fail the run.
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

  let nextId = 0;
  const objectTable: Record<string, ElementObject> = {};
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
    containerBounds: null,
    global: null,
    input: null,
  };
  const global: any = {
    currentStage: "IDLE",
    data: {},
    queue,
    createId: () => `${++nextId}`,
    getEngineObjectTable: (candidate: unknown) => {
      if (candidate !== engine) throw new Error("Unexpected engine");
      return objectTable;
    },
    registerObject: (object: ElementObject) => {
      objectTable[object.id] = object;
    },
    unregisterObject: (object: ElementObject) => {
      delete objectTable[object.id];
    },
  };

  try {
    engine.global = global;
    const input = new InputControl(global, engine);
    engine.input = input;
    input.bindContainer(container);

    const owner = new ElementObject(engine);
    input.registerObjectElement(owner, container);

    owner.event.input.pointerDown = ({ event }) => {
      // Same shape as a resize gesture: claim from the first pointer event.
      input.claimPointer(event.pointerId);
    };
    owner.event.input.dragEnd = () => {
      throw new Error("consumer dragEnd failure");
    };

    container.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 7,
      }),
    );
    container.dispatchEvent(
      pointerEvent(dom.window, "pointermove", {
        x: 40,
        y: 10,
        buttons: 1,
        pointerId: 7,
      }),
    );
    dom.window.document.dispatchEvent(
      pointerEvent(dom.window, "pointerup", {
        x: 40,
        y: 10,
        buttons: 0,
        pointerId: 7,
      }),
    );

    expect(reported).toHaveLength(1);

    // The claim died with the gesture, so hover-style global dispatch resumes.
    // This is the channel ResizeHoverController listens on to recompute the
    // cursor, so a leaked claim is exactly what pins it.
    const globalMoves: number[] = [];
    input.subscribeGlobalCursorEvent(
      "pointerMove",
      "test-hover",
      () => {
        globalMoves.push(1);
      },
      engine,
    );
    container.dispatchEvent(
      pointerEvent(dom.window, "pointermove", {
        x: 55,
        y: 22,
        buttons: 0,
        pointerId: 7,
      }),
    );

    expect(globalMoves).toHaveLength(1);
    input.destroy();
  } finally {
    if (previousReportError) {
      Object.defineProperty(globalThis, "reportError", previousReportError);
    } else {
      delete (globalThis as Record<string, unknown>).reportError;
    }
    restoreGlobals();
    dom.window.close();
  }
});
