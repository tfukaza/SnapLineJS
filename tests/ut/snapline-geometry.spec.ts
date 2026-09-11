import { expect, test } from "@playwright/test";
import { NodeMirror } from "../../assets/snapline/src";
import { ZERO_EDGES, type ElementBox } from "../../src/geometry";
import {
  createEngineHarness,
  installObserverStubs,
} from "../helpers/snapline-harness";

// Position and size are painted by one task, so they must also come from one
// tick. The hazard is that the DOM re-measure scheduled by the ResizeObserver
// runs BETWEEN the tick that authored them and the write that paints them: it
// reports the previously rendered box, and if the write re-reads that state it
// paints last frame's size beside this frame's transform. On a north drag that
// is a visible one-frame jump of the bottom edge.

function drain(global: any, stage: string): void {
  global.currentStage = stage;
  const batch = global.queue[stage];
  global.queue[stage] = new Map();
  for (const entry of batch.values()) {
    for (const task of entry.values()) {
      for (const callback of task.callback ?? []) callback();
    }
  }
  global.currentStage = "IDLE";
}

/** A node whose DOM reads report a size we control, standing in for whatever
 *  the browser last rendered. */
class StubbedNode extends NodeMirror {
  measuredWidth = 0;
  measuredHeight = 0;

  readDom(_config?: unknown, _stage?: unknown): ElementBox {
    const rect = {
      x: 0,
      y: 0,
      width: this.measuredWidth,
      height: this.measuredHeight,
    };
    return {
      ...rect,
      screen: rect,
      margin: ZERO_EDGES,
      padding: ZERO_EDGES,
      border: ZERO_EDGES,
    };
  }
}

test("a size write paints the size its own tick authored, not a stale measurement", () => {
  const restoreObservers = installObserverStubs();
  const { engine, global } = createEngineHarness();
  const node = new StubbedNode(engine, null);
  const element = { style: {} as Record<string, string> };
  node.element = element as unknown as HTMLElement;

  // Frame N: author 180x100 at y=100 and paint it.
  node.worldTransform = { x: 0, y: 100 };
  node.setSize(180, 100);
  drain(global, "WRITE_1");
  expect(element.style.height).toBe("100px");

  // The paint changed the element's size, so the ResizeObserver fires and
  // queues a READ_1 for the next frame.
  node.measuredWidth = 180;
  node.measuredHeight = 100;
  node.remeasureDomGeometry();

  // Frame N+1, at IDLE: the gesture advances BOTH properties together — the
  // top edge moves up 20px and the box grows 20px, so the bottom edge is
  // unchanged at y + height = 200.
  node.worldTransform = { x: 0, y: 80 };
  node.setSize(180, 120);

  // ...but the queued READ_1 lands first, still reporting frame N's box.
  drain(global, "READ_1");
  drain(global, "WRITE_1");

  expect(element.style.height).toBe("120px");
  expect(node.worldTransform.y).toBe(80);
  // The invariant the user actually sees: the anchored edge does not move.
  expect(node.worldTransform.y + parseFloat(element.style.height)).toBe(200);

  node.destroy(false);
  restoreObservers();
});

test("outside a gesture, a measurement still reconciles the collision box", () => {
  const restoreObservers = installObserverStubs();
  const { engine, global } = createEngineHarness();
  const node = new StubbedNode(engine, null);
  const element = { style: {} as Record<string, string> };
  node.element = element as unknown as HTMLElement;

  node.setSizeState(180, 100);
  // The stylesheet refused the authored height and rendered 140 instead.
  node.measuredWidth = 180;
  node.measuredHeight = 140;
  node.remeasureDomGeometry();
  drain(global, "READ_1");

  expect(node.hitBox.height).toBe(140);

  node.destroy(false);
  restoreObservers();
});

test("a scaled node's collision box keeps its unscaled local size", () => {
  const restoreObservers = installObserverStubs();
  const { engine, global } = createEngineHarness();
  // A real DOM read: core measures the rendered rect and computed style.
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      getComputedStyle: () => ({ transformOrigin: "0px 0px" }),
    },
  });
  const node = new NodeMirror(engine, null);
  // 180x100 in CSS, rendered at 2x by the node's own transform.
  const element = {
    style: { transform: "translate3d(0px, 0px, 0px) scale(2, 2)" },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 200 }),
  };
  node.element = element as unknown as HTMLElement;
  node.worldTransform = { x: 0, y: 0, scaleX: 2, scaleY: 2 };

  node.remeasureDomGeometry();
  drain(global, "READ_1");

  // The collider scales with its node, so its local size must be unscaled.
  expect([node.hitBox.width, node.hitBox.height]).toEqual([180, 100]);
  expect([node.hitBox.worldWidth, node.hitBox.worldHeight]).toEqual([360, 200]);

  node.destroy(false);
  if (windowDescriptor) {
    Object.defineProperty(globalThis, "window", windowDescriptor);
  } else {
    delete (globalThis as Record<string, unknown>).window;
  }
  restoreObservers();
});
