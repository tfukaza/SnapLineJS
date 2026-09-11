import { expect, test } from "@playwright/test";
import {
  Container as SnapSortContainer,
  defaultAnimations,
} from "../../assets/snapsort/src/container";
import { type DragVisual } from "../../assets/snapsort/src/index";
import { Item as SnapSortItem } from "../../assets/snapsort/src/item";
import { DragSessionController as DragSession } from "../../assets/snapsort/src/drag/session";
import {
  clearDragSession,
  installDragSession,
} from "../../assets/snapsort/src/drag/session-store";
import {
  builtinStrategies,
  type SortMode,
} from "../../assets/snapsort/src/drag/drop-strategy";
import {
  assertCanFireItemMove,
  assertCanFireItemSwap,
} from "../../assets/snapsort/src/mutation";

test("built-in modes choose composable drag visual defaults that can be overridden before activation", () => {
  let nextId = 0;
  const engine = {
    global: {
      data: {},
      queue: {},
      createId: () => `drag-visual-default-${++nextId}`,
      registerObject: () => {},
      unregisterObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
  };
  const expected = {
    euclidean: "item",
    progressive: "item",
    insertion: "none",
    swap: "preview",
  } as const satisfies Record<SortMode, DragVisual>;

  for (const mode of Object.keys(expected) as SortMode[]) {
    const root = new SnapSortContainer(engine, null, {
      itemId: `drag-visual-${mode}-root`,
      mode,
    });
    const item = new SnapSortItem(engine, root, {
      itemId: `drag-visual-${mode}-item`,
    });
    const source = {
      container: root,
      containerMetadata: root.metadata,
      index: 0,
    };
    const session = new DragSession(
      root,
      [item],
      [source],
      builtinStrategies[mode],
      {
        inputType: "pointer",
        prop: {
          handoffTo: () => {},
          pointerId: 1,
          start: { x: 10, y: 20 },
        } as never,
      },
    );
    installDragSession(root, session);
    const handle = root.dragSession!;
    const nested = new SnapSortContainer(engine, root, {
      itemId: `drag-visual-${mode}-nested`,
      mode,
    });

    expect(handle).toBe(session);
    expect(nested.dragSession).toBeNull();
    expect(Object.isFrozen(handle)).toBe(false);
    expect(Object.isFrozen(handle.input)).toBe(true);
    expect(Object.isFrozen(handle.items)).toBe(true);
    expect(Object.isFrozen(handle.sources)).toBe(true);
    expect(Object.isFrozen(handle.sources[0])).toBe(true);
    if (handle.input.inputType !== "pointer") {
      throw new Error("Expected pointer input");
    }
    expect(Object.isFrozen(handle.input.start)).toBe(true);
    expect(Object.isFrozen(handle.input.pointer)).toBe(true);
    expect("strategy" in handle).toBe(true);
    expect("ghosts" in handle).toBe(false);
    expect("cancel" in handle).toBe(true);
    expect(() => (handle.items as any[]).push(item)).toThrow();
    expect(() => ((handle.sources[0] as any).index = 2)).toThrow();
    expect(() => ((handle.input.pointer as any).x = 30)).toThrow();

    expect(handle.dragVisual).toBe(expected[mode]);
    expect(() => {
      (handle as any).dragVisual = "clone";
    }).toThrow(/DragSession\.dragVisual/);
    const override = expected[mode] === "preview" ? "none" : "preview";
    handle.dragVisual = override;
    expect(handle.dragVisual).toBe(override);
    handle.dropEffect = "none";
    expect(handle.dropEffect).toBe("none");
    session.phase = "active";
    expect(() => {
      handle.dragVisual = expected[mode];
    }).toThrow(/DragSession\.dragVisual/);
    handle.dropEffect = "move";
    expect(() => {
      (handle as any).dropEffect = "copy";
    }).toThrow(/DragSession\.dropEffect/);
    session.phase = "dropping";
    expect(() => {
      handle.dropEffect = "none";
    }).toThrow(/DragSession\.dropEffect/);
    session.phase = "ended";
    expect(() => {
      handle.dropEffect = "none";
    }).toThrow(/DragSession\.dropEffect/);
    expect(handle.dragVisual).toBe(override);

    clearDragSession(root, session);
    expect(root.dragSession).toBeNull();
    nested.destroy(false);
    item.destroy(false);
    root.destroy(false);
  }
});

test("container animations are opt-in and expose the standard preset", () => {
  let nextId = 0;
  const engine = {
    global: {
      data: {},
      queue: {},
      createId: () => `animation-config-test-${++nextId}`,
      registerObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
  };

  const immediate = new SnapSortContainer(engine, null, {
    itemId: "animation-immediate-root",
  });
  const animated = new SnapSortContainer(engine, null, {
    itemId: "animation-enabled-root",
    animation: defaultAnimations,
  });
  const partiallyDisabled = new SnapSortContainer(engine, null, {
    itemId: "animation-partially-disabled-root",
    animation: { reorder: null, drop: defaultAnimations.drop },
  });
  const disabled = new SnapSortContainer(engine, null, {
    itemId: "animation-disabled-root",
    animation: null,
  });

  expect(immediate.config.animation).toBeUndefined();
  expect(immediate.reorderAnimationConfig(immediate)).toBeNull();
  expect(immediate.dropAnimationConfig(immediate)).toBeNull();
  expect(defaultAnimations).toEqual({
    reorder: { duration: 100, timing_function: "ease-out" },
    drop: { duration: 100, timing_function: "ease-out" },
    move: { duration: 100, timing_function: "ease-out" },
  });
  expect(animated.reorderAnimationConfig(animated)).toBe(
    defaultAnimations.reorder,
  );
  expect(animated.dropAnimationConfig(animated)).toBe(defaultAnimations.drop);
  expect(
    partiallyDisabled.reorderAnimationConfig(partiallyDisabled),
  ).toBeNull();
  expect(partiallyDisabled.dropAnimationConfig(partiallyDisabled)).toBe(
    defaultAnimations.drop,
  );
  expect(disabled.reorderAnimationConfig(disabled)).toBeNull();
  expect(disabled.dropAnimationConfig(disabled)).toBeNull();
});

test("item drag snapshots freeze a shallow copy of current metadata", () => {
  let nextId = 0;
  const engine = {
    global: {
      data: {},
      queue: {},
      createId: () => `metadata-snapshot-${++nextId}`,
      registerObject: () => {},
      unregisterObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
  };
  const item = new SnapSortItem(engine as never, null, {
    itemId: "metadata-item",
  });
  const original = { version: 1 };
  item.metadata = original;

  const snapshot = item.captureDragSnapshotTree();
  item.metadata = { version: 2 };

  expect(snapshot.metadata).not.toBe(original);
  expect(snapshot.metadata.version).toBe(1);
  expect(Object.isFrozen(snapshot.metadata)).toBe(true);
  expect(item.metadata.version).toBe(2);
});

test("custom adapters never inherit Vanilla DOM callbacks", () => {
  let nextId = 0;
  const engine = {
    global: {
      data: {},
      queue: {},
      createId: () => `ownership-test-${++nextId}`,
      registerObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
  };
  const onItemMove = () => {};

  const vanilla = new SnapSortContainer(engine, null, {
    itemId: "ownership-vanilla-root",
  });
  const framework = new SnapSortContainer(engine, null, {
    itemId: "ownership-framework-root",
    adapter: { callbacks: {}, commit: (mutation) => mutation() },
    callbacks: { onItemMove },
  });
  const frameworkWithoutMutation = new SnapSortContainer(engine, null, {
    itemId: "ownership-framework-without-mutation-root",
    adapter: { callbacks: {}, commit: (mutation) => mutation() },
  });

  expect(vanilla.adapter.callbacks.onItemInsert).toBeDefined();
  expect(vanilla.adapter.callbacks.onGhostInsert).toBeDefined();
  expect(framework.callbacks.onItemMove).toBe(onItemMove);
  expect(framework.callbacks.onItemInsert).toBeUndefined();
  expect(framework.callbacks.onItemRemove).toBeUndefined();
  expect(framework.callbacks.onGhostInsert).toBeUndefined();
  expect(framework.callbacks.onGhostMove).toBeUndefined();
  expect(framework.callbacks.onGhostRemove).toBeUndefined();
  expect(() => assertCanFireItemMove(frameworkWithoutMutation)).toThrow(
    /requires callbacks\.onItemMove or callbacks\.onItemInsert/,
  );
  expect(() => assertCanFireItemSwap(framework)).toThrow(
    /requires callbacks\.onItemSwap/,
  );
  expect(() => assertCanFireItemSwap(vanilla)).not.toThrow();
});

test("visual geometry invalidations coalesce at the root container", async () => {
  let nextId = 0;
  const queue = {
    READ_1: new Map(),
    WRITE_1: new Map(),
    READ_2: new Map(),
    WRITE_2: new Map(),
    READ_3: new Map(),
    WRITE_3: new Map(),
  };
  const events: Array<{
    items: readonly unknown[];
    reasons: readonly string[];
  }> = [];
  const engine = {
    global: {
      data: {},
      queue,
      createId: () => `geometry-test-${++nextId}`,
      registerObject: () => {},
    },
    input: {
      subscribeGlobalCursorEvent: () => {},
      unsubscribeGlobalCursorEvent: () => {},
    },
  };
  const root = new SnapSortContainer(engine, null, {
    itemId: "visual-geometry-root",
    adapter: { callbacks: {}, commit: (mutation) => mutation() },
    callbacks: {
      onVisualGeometryInvalidated: (event) => {
        events.push(event);
        if (events.length === 1) {
          root.invalidateVisualGeometry([second], "settle");
        }
      },
    },
  });
  const child = new SnapSortContainer(engine, root, {
    itemId: "visual-geometry-child",
  });
  const first = { isGhost: false } as never;
  const second = { isGhost: false } as never;
  const ghost = { isGhost: true } as never;

  child.invalidateVisualGeometry([first, ghost], "drag");
  root.invalidateVisualGeometry([first, second], "animation");

  const rootQueue = queue.READ_1.get(root.id);
  expect(rootQueue?.size).toBe(1);
  const task = [...rootQueue!.values()][0]!;
  for (const callback of task.callback ?? []) await callback();

  expect(events).toHaveLength(1);
  expect(events[0]!.items).toEqual([first, second]);
  expect(events[0]!.reasons).toEqual(["drag", "animation"]);
  expect(queue.READ_1.get(root.id)?.size).toBe(1);

  const nextTask = [...queue.READ_1.get(root.id)!.values()][0]!;
  for (const callback of nextTask.callback ?? []) await callback();

  expect(events).toHaveLength(2);
  expect(events[1]!.items).toEqual([second]);
  expect(events[1]!.reasons).toEqual(["settle"]);
});
