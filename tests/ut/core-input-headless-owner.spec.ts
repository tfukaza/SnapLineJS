import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { InputControl } from "../../src/input";
import {
  BaseObject,
  ElementObject,
  type DomElement,
} from "../../src/object";

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
    timestamp,
  }: {
    x: number;
    y: number;
    buttons: number;
    pointerId: number;
    timestamp?: number;
  },
): Event {
  const event = new window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    buttons,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  if (timestamp !== undefined) {
    Object.defineProperty(event, "timeStamp", { value: timestamp });
  }
  return event;
}

function createInputHarness(
  markup: string,
  config: { maxSimultaneousDrags?: number } = {},
) {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="engine">${markup}</div></body></html>`,
  );
  const restoreGlobals = installDomGlobals(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>("#engine");
  if (!container) throw new Error("Missing test container");

  let nextId = 0;
  const objectTable: Record<string, BaseObject> = {};
  const engine: any = {
    camera: null,
    containerBounds: null,
    global: null,
    input: null,
  };
  const global: any = {
    currentStage: "IDLE",
    data: {},
    queue: {
      READ_1: new Map(),
      WRITE_1: new Map(),
      READ_2: new Map(),
      WRITE_2: new Map(),
      READ_3: new Map(),
      WRITE_3: new Map(),
    },
    createId: () => `${++nextId}`,
    getEngineObjectTable: () => objectTable,
    registerObject: (object: BaseObject) => {
      objectTable[object.id] = object;
    },
    unregisterObject: (object: BaseObject) => {
      delete objectTable[object.id];
    },
  };
  engine.global = global;
  const input = new InputControl(global, engine, config);
  engine.input = input;
  input.bindContainer(container);

  return {
    dom,
    container,
    engine,
    input,
    cleanup() {
      input.destroy();
      restoreGlobals();
      dom.window.close();
    },
  };
}

function trackPointerCapture(
  elements: Element[],
  failCapture?: (element: Element, pointerId: number) => boolean,
) {
  const captures = new Map<number, Element>();
  const releases: number[] = [];
  for (const element of elements) {
    Object.defineProperties(element, {
      setPointerCapture: {
        value: (pointerId: number) => {
          if (failCapture?.(element, pointerId)) {
            throw new Error(`capture failed for ${pointerId}`);
          }
          captures.set(pointerId, element);
        },
      },
      hasPointerCapture: {
        value: (pointerId: number) => captures.get(pointerId) === element,
      },
      releasePointerCapture: {
        value: (pointerId: number) => {
          releases.push(pointerId);
          if (captures.get(pointerId) === element) captures.delete(pointerId);
        },
      },
    });
  }
  return { captures, releases };
}

test("ignores sub-threshold pointer jitter before starting a drag", () => {
  const harness = createInputHarness("<div id='owner'></div>");
  const ownerElement =
    harness.dom.window.document.querySelector<HTMLElement>("#owner");
  if (!ownerElement) throw new Error("Missing owner element");
  const { captures } = trackPointerCapture([ownerElement]);

  try {
    const owner = new ElementObject(harness.engine);
    harness.input.registerObjectElement(owner, ownerElement);
    const received: string[] = [];
    owner.event.input.dragStart = () => received.push("start");
    owner.event.input.drag = () => received.push("drag");
    owner.event.input.dragEnd = () => received.push("end");

    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 1,
      }),
    );
    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 11,
        y: 11,
        buttons: 1,
        pointerId: 1,
      }),
    );
    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerup", {
        x: 11,
        y: 11,
        buttons: 0,
        pointerId: 1,
      }),
    );

    expect(received).toEqual([]);
    expect(captures.size).toBe(0);

    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 2,
      }),
    );
    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 13,
        y: 10,
        buttons: 1,
        pointerId: 2,
      }),
    );
    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerup", {
        x: 13,
        y: 10,
        buttons: 0,
        pointerId: 2,
      }),
    );

    expect(received).toEqual(["start", "drag", "end"]);
    expect(captures.size).toBe(0);
  } finally {
    harness.cleanup();
  }
});

test("dragStart handoff transfers capture and later delivery to a DOM-backed object", () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='engine'><div id='source'></div><div id='destination'></div></div></body></html>",
  );
  const restoreGlobals = installDomGlobals(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>("#engine");
  const sourceElement =
    dom.window.document.querySelector<HTMLElement>("#source");
  const destinationElement =
    dom.window.document.querySelector<HTMLElement>("#destination");
  if (!container || !sourceElement || !destinationElement) {
    throw new Error("Missing test elements");
  }
  const captures = new Map<number, Element>();
  for (const element of [sourceElement, destinationElement]) {
    Object.defineProperties(element, {
      setPointerCapture: {
        value: (pointerId: number) => captures.set(pointerId, element),
      },
      hasPointerCapture: {
        value: (pointerId: number) => captures.get(pointerId) === element,
      },
      releasePointerCapture: {
        value: (pointerId: number) => {
          if (captures.get(pointerId) === element) captures.delete(pointerId);
        },
      },
    });
  }

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

    const source = new ElementObject(engine);
    const destination = new ElementObject(engine);
    input.registerObjectElement(source, sourceElement);
    input.registerObjectElement(destination, destinationElement);

    const received: string[] = [];
    source.event.input.dragStart = ({ objectId, handoffTo }) => {
      received.push(`start:${objectId}`);
      handoffTo(destination);
    };
    destination.event.input.drag = ({ objectId }) => {
      received.push(`drag:${objectId}`);
    };
    destination.event.input.pointerUp = ({ objectId, event, cancelled }) => {
      received.push(`up:${objectId}:${event.type}:${cancelled}`);
    };
    destination.event.input.dragEnd = ({ objectId, event, cancelled }) => {
      received.push(`end:${objectId}:${event.type}:${cancelled}`);
    };

    sourceElement.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 7,
      }),
    );
    sourceElement.dispatchEvent(
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
      `start:${source.id}`,
      `drag:${destination.id}`,
      `up:${destination.id}:pointerup:false`,
      `end:${destination.id}:pointerup:false`,
    ]);
    expect(captures.has(7)).toBe(false);

    received.length = 0;
    sourceElement.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 8,
      }),
    );
    sourceElement.dispatchEvent(
      pointerEvent(dom.window, "pointermove", {
        x: 20,
        y: 10,
        buttons: 1,
        pointerId: 8,
      }),
    );
    captures.delete(8);
    destinationElement.dispatchEvent(
      pointerEvent(dom.window, "lostpointercapture", {
        x: 20,
        y: 10,
        buttons: 1,
        pointerId: 8,
      }),
    );
    dom.window.document.dispatchEvent(
      pointerEvent(dom.window, "pointerup", {
        x: 20,
        y: 10,
        buttons: 0,
        pointerId: 8,
      }),
    );
    expect(received).toEqual([
      `start:${source.id}`,
      `drag:${destination.id}`,
      `up:${destination.id}:pointerup:false`,
      `end:${destination.id}:pointerup:false`,
    ]);
    expect(captures.has(8)).toBe(false);

    received.length = 0;
    sourceElement.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 9,
      }),
    );
    sourceElement.dispatchEvent(
      pointerEvent(dom.window, "pointermove", {
        x: 20,
        y: 10,
        buttons: 1,
        pointerId: 9,
      }),
    );
    captures.delete(9);
    destinationElement.dispatchEvent(
      pointerEvent(dom.window, "lostpointercapture", {
        x: 20,
        y: 10,
        buttons: 0,
        pointerId: 9,
      }),
    );
    expect(received).toEqual([`start:${source.id}`, `drag:${destination.id}`]);
    expect(captures.get(9)).toBe(destinationElement);
    dom.window.document.dispatchEvent(
      pointerEvent(dom.window, "pointerup", {
        x: 20,
        y: 10,
        buttons: 0,
        pointerId: 9,
      }),
    );
    expect(received).toEqual([
      `start:${source.id}`,
      `drag:${destination.id}`,
      `up:${destination.id}:pointerup:false`,
      `end:${destination.id}:pointerup:false`,
    ]);
    expect(captures.has(9)).toBe(false);
    input.destroy();
  } finally {
    restoreGlobals();
    dom.window.close();
  }
});

test("untrusted NotFoundError uses logical capture through drag handoff", () => {
  const harness = createInputHarness(
    "<div id='source'></div><div id='destination'></div>",
  );
  const sourceElement =
    harness.dom.window.document.querySelector<HTMLElement>("#source");
  const destinationElement =
    harness.dom.window.document.querySelector<HTMLElement>("#destination");
  if (!sourceElement || !destinationElement) {
    throw new Error("Missing logical capture elements");
  }

  const captureAttempts: string[] = [];
  for (const element of [sourceElement, destinationElement]) {
    Object.defineProperties(element, {
      setPointerCapture: {
        value: (pointerId: number) => {
          captureAttempts.push(`${element.id}:${pointerId}`);
          const error = new Error("Synthetic pointer is not active");
          error.name = "NotFoundError";
          throw error;
        },
      },
      hasPointerCapture: {
        value: () => false,
      },
      releasePointerCapture: {
        value: () => {
          throw new Error("Logical capture must not attempt native release");
        },
      },
    });
  }

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
    const source = new ElementObject(harness.engine);
    const destination = new ElementObject(harness.engine);
    harness.input.registerObjectElement(source, sourceElement);
    harness.input.registerObjectElement(destination, destinationElement);

    const received: string[] = [];
    source.event.input.dragStart = ({ handoffTo }) => {
      received.push("start:source");
      handoffTo(destination);
    };
    destination.event.input.pointerMove = ({ objectId }) => {
      received.push(`move:${objectId}`);
    };
    destination.event.input.drag = ({ objectId }) => {
      received.push(`drag:${objectId}`);
    };
    destination.event.input.dragEnd = ({ objectId, cancelled }) => {
      received.push(`end:${objectId}:${cancelled}`);
    };

    sourceElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 23,
      }),
    );
    sourceElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 30,
        y: 10,
        buttons: 1,
        pointerId: 23,
      }),
    );
    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 60,
        y: 20,
        buttons: 1,
        pointerId: 23,
      }),
    );
    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerup", {
        x: 60,
        y: 20,
        buttons: 0,
        pointerId: 23,
      }),
    );

    expect(captureAttempts).toEqual(["source:23", "destination:23"]);
    expect(received).toEqual([
      "start:source",
      `drag:${destination.id}`,
      `move:${destination.id}`,
      `drag:${destination.id}`,
      `end:${destination.id}:false`,
    ]);
    expect(reported).toEqual([]);
  } finally {
    if (previousReportError) {
      Object.defineProperty(globalThis, "reportError", previousReportError);
    } else {
      delete (globalThis as Record<string, unknown>).reportError;
    }
    harness.cleanup();
  }
});

test("failed drag handoff capture leaves the original pointer stream active", () => {
  const harness = createInputHarness(
    "<div id='source'></div><div id='destination'></div>",
  );
  const sourceElement =
    harness.dom.window.document.querySelector<HTMLElement>("#source");
  const destinationElement =
    harness.dom.window.document.querySelector<HTMLElement>("#destination");
  if (!sourceElement || !destinationElement) {
    throw new Error("Missing handoff failure elements");
  }
  const capture = trackPointerCapture(
    [sourceElement, destinationElement],
    (element) => element === destinationElement,
  );

  try {
    const source = new ElementObject(harness.engine);
    const destination = new ElementObject(harness.engine);
    harness.input.registerObjectElement(source, sourceElement);
    harness.input.registerObjectElement(destination, destinationElement);

    const received: string[] = [];
    let sourceCapturedWhenRejected = false;
    source.event.input.dragStart = ({ objectId, pointerId, handoffTo }) => {
      received.push(`start:${objectId}`);
      try {
        handoffTo(destination);
      } catch (error) {
        received.push(`rejected:${(error as Error).message}`);
        sourceCapturedWhenRejected =
          capture.captures.get(pointerId) === sourceElement;
      }
    };
    source.event.input.drag = ({ objectId }) => {
      received.push(`drag:${objectId}`);
    };
    source.event.input.pointerUp = ({ objectId, event, cancelled }) => {
      received.push(`up:${objectId}:${event.type}:${cancelled}`);
    };
    source.event.input.dragEnd = ({ objectId, event, cancelled }) => {
      received.push(`end:${objectId}:${event.type}:${cancelled}`);
    };
    destination.event.input.drag = ({ objectId }) => {
      received.push(`destination-drag:${objectId}`);
    };
    destination.event.input.pointerUp = ({ objectId, cancelled }) => {
      received.push(`destination-up:${objectId}:${cancelled}`);
    };
    destination.event.input.dragEnd = ({ objectId, cancelled }) => {
      received.push(`destination-end:${objectId}:${cancelled}`);
    };

    sourceElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 10,
        y: 10,
        buttons: 1,
        pointerId: 17,
      }),
    );
    sourceElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 30,
        y: 10,
        buttons: 1,
        pointerId: 17,
      }),
    );

    expect(sourceCapturedWhenRejected).toBe(true);
    expect(capture.captures.get(17)).toBe(sourceElement);
    expect(capture.releases).toEqual([]);

    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerup", {
        x: 30,
        y: 10,
        buttons: 0,
        pointerId: 17,
      }),
    );

    expect(received).toEqual([
      `start:${source.id}`,
      "rejected:capture failed for 17",
      `drag:${source.id}`,
      `up:${source.id}:pointerup:false`,
      `end:${source.id}:pointerup:false`,
    ]);
    expect(capture.captures.has(17)).toBe(false);
    expect(capture.releases).toEqual([17]);
  } finally {
    harness.cleanup();
  }
});

test("handoff rejects BaseObject and headless destinations synchronously", () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='engine'><div id='source'></div></div></body></html>",
  );
  const restoreGlobals = installDomGlobals(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>("#engine");
  const sourceElement =
    dom.window.document.querySelector<HTMLElement>("#source");
  if (!container || !sourceElement) throw new Error("Missing test elements");
  Object.defineProperty(sourceElement, "setPointerCapture", {
    value: () => {},
  });

  let nextId = 0;
  const objectTable: Record<string, BaseObject> = {};
  const engine: any = {
    camera: null,
    containerBounds: null,
    global: null,
    input: null,
  };
  const global: any = {
    currentStage: "IDLE",
    data: {},
    queue: {
      READ_1: new Map(),
      WRITE_1: new Map(),
      READ_2: new Map(),
      WRITE_2: new Map(),
      READ_3: new Map(),
      WRITE_3: new Map(),
    },
    createId: () => `${++nextId}`,
    getEngineObjectTable: () => objectTable,
    registerObject: (object: BaseObject) => {
      objectTable[object.id] = object;
    },
    unregisterObject: (object: BaseObject) => {
      delete objectTable[object.id];
    },
  };

  try {
    engine.global = global;
    const input = new InputControl(global, engine);
    engine.input = input;
    input.bindContainer(container);
    const source = new ElementObject(engine);
    const baseDestination = new BaseObject(engine);
    const headlessDestination = new ElementObject(engine);
    input.registerObjectElement(source, sourceElement);
    const errors: string[] = [];
    source.event.input.dragStart = ({ handoffTo }) => {
      for (const destination of [baseDestination, headlessDestination]) {
        try {
          handoffTo(destination as ElementObject);
        } catch (error) {
          errors.push((error as Error).message);
        }
      }
    };

    sourceElement.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 9,
      }),
    );
    sourceElement.dispatchEvent(
      pointerEvent(dom.window, "pointermove", {
        x: 10,
        y: 0,
        buttons: 1,
        pointerId: 9,
      }),
    );

    expect(errors[0]).toContain("must resolve to an ElementObject");
    expect(errors[1]).toContain("has no connected input element");
    input.destroy();
  } finally {
    restoreGlobals();
    dom.window.close();
  }
});

test("pinch handoff keeps each pointer captured and owned by its origin", () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='engine'><div id='source-0'></div><div id='source-1'></div><svg><path id='destination'></path></svg></div></body></html>",
  );
  const restoreGlobals = installDomGlobals(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>("#engine");
  const sourceElement0 =
    dom.window.document.querySelector<HTMLElement>("#source-0");
  const sourceElement1 =
    dom.window.document.querySelector<HTMLElement>("#source-1");
  const destinationElement =
    dom.window.document.querySelector<SVGPathElement>("#destination");
  if (!container || !sourceElement0 || !sourceElement1 || !destinationElement) {
    throw new Error("Missing test elements");
  }
  const captures = new Map<number, Element>();
  const captureLog: string[] = [];
  for (const element of [sourceElement0, sourceElement1, destinationElement]) {
    Object.defineProperties(element, {
      setPointerCapture: {
        value: (pointerId: number) => {
          captures.set(pointerId, element);
          captureLog.push(`${element.id}:${pointerId}`);
        },
      },
      hasPointerCapture: {
        value: (pointerId: number) => captures.get(pointerId) === element,
      },
      releasePointerCapture: {
        value: (pointerId: number) => {
          if (captures.get(pointerId) === element) captures.delete(pointerId);
        },
      },
    });
  }

  let nextId = 0;
  const objectTable: Record<
    string,
    ElementObject<HTMLElement | SVGElement>
  > = {};
  const engine: any = {
    camera: null,
    containerBounds: null,
    global: null,
    input: null,
  };
  const global: any = {
    currentStage: "IDLE",
    data: {},
    queue: {
      READ_1: new Map(),
      WRITE_1: new Map(),
      READ_2: new Map(),
      WRITE_2: new Map(),
      READ_3: new Map(),
      WRITE_3: new Map(),
    },
    createId: () => `${++nextId}`,
    getEngineObjectTable: () => objectTable,
    registerObject: (object: ElementObject<HTMLElement | SVGElement>) => {
      objectTable[object.id] = object;
    },
    unregisterObject: (object: ElementObject<HTMLElement | SVGElement>) => {
      delete objectTable[object.id];
    },
  };

  try {
    engine.global = global;
    const input = new InputControl(global, engine);
    engine.input = input;
    input.bindContainer(container);
    const source0 = new ElementObject(engine);
    const source1 = new ElementObject(engine);
    const destination = new ElementObject<SVGElement>(engine);
    input.registerObjectElement(source0, sourceElement0);
    input.registerObjectElement(source1, sourceElement1);
    input.registerObjectElement(destination, destinationElement);
    const received: string[] = [];
    source0.event.input.pinchStart = ({ objectId, handoffTo }) => {
      received.push(`start:${objectId}`);
      handoffTo(destination);
    };
    source0.event.input.pointerUp = ({ objectId }) => {
      received.push(`up:${objectId}`);
    };
    source0.event.input.dragEnd = ({ objectId }) => {
      received.push(`dragEnd:${objectId}`);
    };
    destination.event.input.pinch = ({ objectId }) => {
      received.push(`pinch:${objectId}`);
    };
    destination.event.input.pinchEnd = ({ objectId, cancelled }) => {
      received.push(`end:${objectId}:${cancelled}`);
    };

    sourceElement0.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 1,
      }),
    );
    sourceElement1.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 20,
        y: 0,
        buttons: 1,
        pointerId: 2,
      }),
    );
    sourceElement0.dispatchEvent(
      pointerEvent(dom.window, "pointermove", {
        x: 5,
        y: 0,
        buttons: 1,
        pointerId: 1,
      }),
    );
    dom.window.document.dispatchEvent(
      pointerEvent(dom.window, "pointerup", {
        x: 5,
        y: 0,
        buttons: 0,
        pointerId: 1,
      }),
    );

    expect(received).toEqual([
      `start:${source0.id}`,
      `pinch:${destination.id}`,
      `up:${source0.id}`,
      `dragEnd:${source0.id}`,
      `end:${destination.id}:false`,
    ]);
    expect(captureLog).toEqual(["source-0:1", "source-1:2"]);
    expect(captures.get(2)).toBe(sourceElement1);
    input.destroy();
    expect(captures.size).toBe(0);
  } finally {
    restoreGlobals();
    dom.window.close();
  }
});

test("targeted input bubbles leaf-to-root before global fan-out", () => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id='engine'><button id='leaf'></button></div></body></html>",
  );
  const restoreGlobals = installDomGlobals(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>("#engine");
  const leafElement = dom.window.document.querySelector<HTMLElement>("#leaf");
  if (!container || !leafElement) throw new Error("Missing test elements");

  let nextId = 0;
  const objectTable: Record<string, BaseObject> = {};
  const engine: any = {
    camera: null,
    containerBounds: null,
    global: null,
    input: null,
  };
  const global: any = {
    currentStage: "IDLE",
    data: {},
    queue: {
      READ_1: new Map(),
      WRITE_1: new Map(),
      READ_2: new Map(),
      WRITE_2: new Map(),
      READ_3: new Map(),
      WRITE_3: new Map(),
    },
    createId: () => `${++nextId}`,
    getEngineObjectTable: () => objectTable,
    registerObject: (object: BaseObject) => {
      objectTable[object.id] = object;
    },
    unregisterObject: (object: BaseObject) => {
      delete objectTable[object.id];
    },
  };

  try {
    engine.global = global;
    const input = new InputControl(global, engine);
    engine.input = input;
    input.bindContainer(container);
    const root = new BaseObject(engine);
    const parent = new BaseObject(engine, root);
    const leaf = new ElementObject(engine, parent);
    input.registerObjectElement(leaf, leafElement);
    const order: string[] = [];
    leaf.event.input.pointerDown = (prop) => {
      order.push(`leaf:${prop.objectId}`);
    };
    parent.event.input.pointerDown = (prop) => {
      order.push(`parent:${prop.objectId}`);
    };
    root.event.input.pointerDown = (prop) => {
      order.push(`root:${prop.objectId}`);
    };
    input.subscribeGlobalCursorEvent(
      "pointerDown",
      "global",
      (prop) => order.push(`global:${prop.objectId}`),
      engine,
    );

    leafElement.dispatchEvent(
      pointerEvent(dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 3,
      }),
    );

    expect(order).toEqual([
      `leaf:${leaf.id}`,
      `parent:${leaf.id}`,
      `root:${leaf.id}`,
      `global:${leaf.id}`,
    ]);
    input.destroy();
  } finally {
    restoreGlobals();
    dom.window.close();
  }
});

test("pointercancel emits one cancelled terminal sequence", () => {
  const harness = createInputHarness("<div id='owner'></div>");
  const ownerElement =
    harness.dom.window.document.querySelector<HTMLElement>("#owner");
  if (!ownerElement) throw new Error("Missing owner element");
  const { captures, releases } = trackPointerCapture([ownerElement]);

  try {
    const owner = new ElementObject(harness.engine);
    harness.input.registerObjectElement(owner, ownerElement);
    const terminal: string[] = [];
    owner.event.input.pointerUp = ({ event, cancelled }) => {
      terminal.push(`up:${event.type}:${cancelled}`);
    };
    owner.event.input.dragEnd = ({ event, cancelled }) => {
      terminal.push(`drag:${event.type}:${cancelled}`);
    };

    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 1,
      }),
    );
    expect(captures.size).toBe(0);
    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 10,
        y: 0,
        buttons: 1,
        pointerId: 1,
      }),
    );
    expect(captures.get(1)).toBe(ownerElement);
    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointercancel", {
        x: 10,
        y: 0,
        buttons: 0,
        pointerId: 1,
      }),
    );
    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerup", {
        x: 10,
        y: 0,
        buttons: 0,
        pointerId: 1,
      }),
    );

    expect(terminal).toEqual([
      "up:pointercancel:true",
      "drag:pointercancel:true",
    ]);
    expect(captures.size).toBe(0);
    expect(releases).toEqual([1]);
  } finally {
    harness.cleanup();
  }
});

test("owner unregistration finalizes and releases capture once", () => {
  const harness = createInputHarness("<div id='owner'></div>");
  const ownerElement =
    harness.dom.window.document.querySelector<HTMLElement>("#owner");
  if (!ownerElement) throw new Error("Missing owner element");
  const { captures, releases } = trackPointerCapture([ownerElement]);

  try {
    const owner = new ElementObject(harness.engine);
    harness.input.registerObjectElement(owner, ownerElement);
    const terminal: string[] = [];
    owner.event.input.pointerUp = ({ event, cancelled }) => {
      terminal.push(`up:${event.type}:${cancelled}`);
    };
    owner.event.input.dragEnd = ({ event, cancelled }) => {
      terminal.push(`drag:${event.type}:${cancelled}`);
    };

    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 2,
      }),
    );
    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 10,
        y: 0,
        buttons: 1,
        pointerId: 2,
      }),
    );
    harness.input.unregisterObjectElement(owner);
    harness.input.unregisterObjectElement(owner);

    expect(terminal).toEqual(["up:pointermove:true", "drag:pointermove:true"]);
    expect(captures.size).toBe(0);
    expect(releases).toEqual([2]);
  } finally {
    harness.cleanup();
  }
});

test("pinch destination removal cancels both origin-captured pointers", () => {
  const harness = createInputHarness(
    "<div id='source-0'></div><div id='source-1'></div><div id='destination'></div>",
  );
  const sourceElement0 =
    harness.dom.window.document.querySelector<HTMLElement>("#source-0");
  const sourceElement1 =
    harness.dom.window.document.querySelector<HTMLElement>("#source-1");
  const destinationElement =
    harness.dom.window.document.querySelector<HTMLElement>("#destination");
  if (!sourceElement0 || !sourceElement1 || !destinationElement) {
    throw new Error("Missing handoff elements");
  }
  let destinationCaptureAttempts = 0;
  const { captures, releases } = trackPointerCapture(
    [sourceElement0, sourceElement1, destinationElement],
    (element) => {
      if (element !== destinationElement) return false;
      destinationCaptureAttempts++;
      return true;
    },
  );

  try {
    const source0 = new ElementObject(harness.engine);
    const source1 = new ElementObject(harness.engine);
    const destination = new ElementObject(harness.engine);
    harness.input.registerObjectElement(source0, sourceElement0);
    harness.input.registerObjectElement(source1, sourceElement1);
    harness.input.registerObjectElement(destination, destinationElement);
    const terminal: string[] = [];

    source0.event.input.pinchStart = ({ handoffTo }) => handoffTo(destination);
    source0.event.input.pointerUp = ({ event, cancelled }) => {
      terminal.push(`up-0:${event.pointerId}:${cancelled}`);
    };
    source0.event.input.dragEnd = ({ pointerId, cancelled }) => {
      terminal.push(`drag-0:${pointerId}:${cancelled}`);
    };
    source1.event.input.pointerUp = ({ event, cancelled }) => {
      terminal.push(`up-1:${event.pointerId}:${cancelled}`);
    };
    destination.event.input.pinchEnd = ({ cancelled }) => {
      terminal.push(`pinch:${cancelled}`);
    };

    sourceElement0.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 1,
      }),
    );
    sourceElement1.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 20,
        y: 0,
        buttons: 1,
        pointerId: 2,
      }),
    );
    sourceElement0.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 5,
        y: 0,
        buttons: 1,
        pointerId: 1,
      }),
    );

    expect(captures.get(1)).toBe(sourceElement0);
    expect(captures.get(2)).toBe(sourceElement1);
    expect(destinationCaptureAttempts).toBe(0);

    harness.input.unregisterObjectElement(destination);

    expect(terminal).toEqual([
      "up-0:1:true",
      "drag-0:1:true",
      "pinch:true",
      "up-1:2:true",
    ]);
    expect(captures.size).toBe(0);
    expect(releases).toEqual([1, 2]);
  } finally {
    harness.cleanup();
  }
});

test("engine teardown releases capture without terminal callbacks", () => {
  const harness = createInputHarness("<div id='owner'></div>");
  const ownerElement =
    harness.dom.window.document.querySelector<HTMLElement>("#owner");
  if (!ownerElement) throw new Error("Missing owner element");
  const { captures, releases } = trackPointerCapture([ownerElement]);

  try {
    const owner = new ElementObject(harness.engine);
    harness.input.registerObjectElement(owner, ownerElement);
    const terminal: string[] = [];
    owner.event.input.pointerUp = () => terminal.push("up");
    owner.event.input.dragEnd = () => terminal.push("drag");

    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 3,
      }),
    );
    ownerElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 10,
        y: 0,
        buttons: 1,
        pointerId: 3,
      }),
    );
    harness.input.destroy();

    expect(terminal).toEqual([]);
    expect(captures.size).toBe(0);
    expect(releases).toEqual([3]);
  } finally {
    harness.cleanup();
  }
});

test("drag limit cancels the oldest active pointer", () => {
  const harness = createInputHarness(
    "<div id='first'></div><div id='second'></div>",
    { maxSimultaneousDrags: 1 },
  );
  const firstElement =
    harness.dom.window.document.querySelector<HTMLElement>("#first");
  const secondElement =
    harness.dom.window.document.querySelector<HTMLElement>("#second");
  if (!firstElement || !secondElement) {
    throw new Error("Missing drag elements");
  }
  trackPointerCapture([firstElement, secondElement]);

  try {
    const first = new ElementObject(harness.engine);
    const second = new ElementObject(harness.engine);
    harness.input.registerObjectElement(first, firstElement);
    harness.input.registerObjectElement(second, secondElement);
    const ended: string[] = [];
    first.event.input.dragEnd = ({ pointerId, cancelled }) => {
      ended.push(`first:${pointerId}:${cancelled}`);
    };
    second.event.input.dragEnd = ({ pointerId, cancelled }) => {
      ended.push(`second:${pointerId}:${cancelled}`);
    };

    firstElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 0,
        y: 0,
        buttons: 1,
        pointerId: 1,
        timestamp: 1,
      }),
    );
    firstElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 10,
        y: 0,
        buttons: 1,
        pointerId: 1,
      }),
    );
    secondElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerdown", {
        x: 20,
        y: 0,
        buttons: 1,
        pointerId: 2,
        timestamp: 2,
      }),
    );
    secondElement.dispatchEvent(
      pointerEvent(harness.dom.window, "pointermove", {
        x: 30,
        y: 0,
        buttons: 1,
        pointerId: 2,
      }),
    );

    expect(ended).toEqual(["first:1:true"]);

    harness.dom.window.document.dispatchEvent(
      pointerEvent(harness.dom.window, "pointerup", {
        x: 30,
        y: 0,
        buttons: 0,
        pointerId: 2,
      }),
    );
    expect(ended).toEqual(["first:1:true", "second:2:false"]);
  } finally {
    harness.cleanup();
  }
});

test("keydown exposes the focused input-alias owner through targeted bubbling and global dispatch", () => {
  const harness = createInputHarness(
    '<div id="item"><div id="handle"><button id="focus">Focus</button></div></div>',
  );
  const handleElement =
    harness.dom.window.document.querySelector<HTMLElement>("#handle");
  const focusElement =
    harness.dom.window.document.querySelector<HTMLButtonElement>("#focus");
  if (!handleElement || !focusElement) {
    throw new Error("Missing keyboard input elements");
  }

  try {
    const root = new BaseObject(harness.engine);
    const parent = new BaseObject(harness.engine, root);
    const focusedObject = new ElementObject(harness.engine, parent);
    focusedObject.addInputAlias(handleElement);

    const deliveries: Array<{
      scope: string;
      focusedObject: ElementObject<DomElement> | null;
      event: KeyboardEvent;
    }> = [];
    focusedObject.event.input.keyDown = (prop) => {
      deliveries.push({ scope: "leaf", ...prop });
    };
    parent.event.input.keyDown = (prop) => {
      deliveries.push({ scope: "parent", ...prop });
    };
    root.event.input.keyDown = (prop) => {
      deliveries.push({ scope: "root", ...prop });
    };
    harness.input.subscribeGlobalCursorEvent(
      "keyDown",
      "keyboard-global",
      (prop) => deliveries.push({ scope: "global", ...prop }),
      harness.engine,
    );

    focusElement.focus();
    const event = new harness.dom.window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: "Enter",
    });
    focusElement.dispatchEvent(event);

    expect(harness.dom.window.document.activeElement).toBe(focusElement);
    expect(deliveries.map(({ scope }) => scope)).toEqual([
      "leaf",
      "parent",
      "root",
      "global",
    ]);
    for (const delivery of deliveries) {
      expect(delivery.focusedObject).toBe(focusedObject);
      expect(delivery.event).toBe(event);
      expect(delivery.event.key).toBe("Enter");
    }

    harness.input.destroy();
    focusElement.dispatchEvent(
      new harness.dom.window.KeyboardEvent("keydown", {
        bubbles: true,
        key: "Escape",
      }),
    );
    expect(deliveries).toHaveLength(4);
  } finally {
    harness.cleanup();
  }
});

test("global keydown receives null when the focused element has no registered owner", () => {
  const harness = createInputHarness('<button id="focus">Focus</button>');
  const focusElement =
    harness.dom.window.document.querySelector<HTMLButtonElement>("#focus");
  if (!focusElement) throw new Error("Missing keyboard input element");

  try {
    const deliveries: Array<ElementObject<DomElement> | null> = [];
    harness.input.event.keyDown = ({ focusedObject }) => {
      deliveries.push(focusedObject);
    };

    focusElement.focus();
    focusElement.dispatchEvent(
      new harness.dom.window.KeyboardEvent("keydown", {
        bubbles: true,
        key: "Enter",
      }),
    );

    expect(deliveries).toEqual([null]);
  } finally {
    harness.cleanup();
  }
});

// A consumer handler that throws must not unwind the input dispatch. The
// pointer record deleted at the end of #finishPointer is what releases the
// pointer's claim, and a claim that outlives its gesture suppresses every
// later global pointerMove for that pointer id — which is how a throwing
// dragEnd once left the resize cursor stuck until the next click.
test("a throwing dragEnd handler does not strand the pointer's claim", () => {
  const harness = createInputHarness("");
  const { container, dom, engine, input } = harness;

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

  try {
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
  } finally {
    if (previousReportError) {
      Object.defineProperty(globalThis, "reportError", previousReportError);
    } else {
      delete (globalThis as Record<string, unknown>).reportError;
    }
    harness.cleanup();
  }
});
