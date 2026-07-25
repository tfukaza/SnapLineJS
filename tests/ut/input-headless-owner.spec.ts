import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { InputControl } from "../../src/input";
import { ElementObject } from "../../src/object";

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

test("an explicitly assigned headless object receives the full drag gesture", () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='engine'></div></body></html>",
  );
  const restoreGlobals = installDomGlobals(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>("#engine");
  if (!container) throw new Error("Missing test container");

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

    const domOwner = new ElementObject(engine);
    const headlessOwner = new ElementObject(engine);
    input.registerObjectElement(domOwner, container);

    const received: string[] = [];
    domOwner.event.input.pointerDown = ({ event }) => {
      input.setPointerDragOwner(event.pointerId, headlessOwner);
    };
    headlessOwner.event.input.dragStart = ({ objectId }) => {
      received.push(`start:${objectId}`);
    };
    headlessOwner.event.input.drag = ({ objectId }) => {
      received.push(`drag:${objectId}`);
    };
    headlessOwner.event.input.dragEnd = ({ objectId }) => {
      received.push(`end:${objectId}`);
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
        x: 20,
        y: 10,
        buttons: 1,
        pointerId: 7,
      }),
    );
    dom.window.document.dispatchEvent(
      pointerEvent(dom.window, "pointerup", {
        x: 20,
        y: 10,
        buttons: 0,
        pointerId: 7,
      }),
    );

    expect(received).toEqual([
      `start:${headlessOwner.id}`,
      `drag:${headlessOwner.id}`,
      `end:${headlessOwner.id}`,
    ]);
    input.destroy();
  } finally {
    restoreGlobals();
    dom.window.close();
  }
});
