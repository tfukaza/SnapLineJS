import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { Engine, GlobalManager } from "../../src/index";
import { createVanillaAdapter } from "../../assets/snapsort/src/adapter";
import { Container } from "../../assets/snapsort/src/container";
import {
  buildDragLocation,
  buildGhostInsertEvent,
  buildGhostMoveEvent,
  buildGhostOverlayLocation,
  buildGhostRemoveEvent,
  buildGhostSlotLocation,
} from "../../assets/snapsort/src/event-builders";
import type {
  DragSession,
  DragSessionController,
} from "../../assets/snapsort/src/drag/session";
import type {
  DragLocation,
  GhostState,
  InsertionGapSegment,
  InsertionMarkerNeighbor,
  ItemInsertEvent,
  ItemMoveEvent,
  ItemRemoveEvent,
  ItemSwapEvent,
} from "../../assets/snapsort/src/events";
import {
  insertionMarkerRect,
  stockInsertionMarkerRectOptions,
  toContainerLocalRect,
  type InsertionMarkerRectOptions,
} from "../../assets/snapsort/src/insertion-geometry";
import {
  placeItemAt,
  releaseItem,
} from "../../assets/snapsort/src/internal/tree-mutation";
import { Item } from "../../assets/snapsort/src/item";
import {
  createRenderEntries,
  createRenderEntry,
  createRenderTree,
  reduceRenderTree,
  type RenderEntry,
  type RenderTree,
} from "../../assets/snapsort/src/render-state";

type DomGlobal = "window" | "document" | "ResizeObserver" | "MutationObserver";

interface RenderTreeHarness {
  engine: Engine;
  root: Container;
  source: Container;
  destination: Container;
  unrelated: Container;
  items: Map<string, Item>;
  session: DragSession;
  ghostSession: DragSessionController;
  cleanup(): void;
}

interface BoardState {
  tree: RenderTree<string>;
  sourceTree: RenderTree<string>;
  destinationTree: RenderTree<string>;
  unrelatedTree: RenderTree<string>;
}

function createRenderTreeHarness(itemIds = ["dragged"]): RenderTreeHarness {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });
  class ObserverStub {
    observe() {}
    disconnect() {}
  }
  const descriptors = new Map<DomGlobal, PropertyDescriptor | undefined>();
  const globals = new Map<DomGlobal, unknown>([
    ["window", dom.window],
    ["document", dom.window.document],
    ["ResizeObserver", ObserverStub],
    ["MutationObserver", ObserverStub],
  ]);
  for (const [key, value] of globals) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  GlobalManager.resetInstance();
  const engine = new Engine();
  const root = new Container(engine, null, { itemId: "root" });
  const source = new Container(engine, root, { itemId: "source" });
  const destination = new Container(engine, root, { itemId: "destination" });
  const unrelated = new Container(engine, root, { itemId: "unrelated" });
  const items = new Map<string, Item>();
  for (const itemId of itemIds) {
    items.set(itemId, new Item(engine, source, { itemId }));
  }
  const originals = [...items.values()];
  const sources = originals.map((_, index) => buildDragLocation(source, index));
  const session: DragSession = {
    root,
    pointerId: 1,
    items: originals,
    sources,
    pressedItem: originals[0],
    primaryItem: originals[0],
    start: { x: 0, y: 0 },
    pointer: { x: 0, y: 0 },
    status: "active",
    dragVisual: "item",
    dropEffect: "move",
    handoff() {},
  };
  let nextGhostId = 0;
  const ghostSession = {
    root,
    items: originals,
    handle: session,
    allocateGhostItemId: () => `ghost-${++nextGhostId}`,
  } as unknown as DragSessionController;

  return {
    engine,
    root,
    source,
    destination,
    unrelated,
    items,
    session,
    ghostSession,
    cleanup() {
      engine.destroy();
      GlobalManager.resetInstance();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      }
      dom.window.close();
    },
  };
}

function requireItem(harness: RenderTreeHarness, itemId: string): Item {
  const existing = harness.items.get(itemId);
  if (existing) return existing;
  const item = new Item(harness.engine, harness.source, { itemId });
  harness.items.set(itemId, item);
  return item;
}

function createBoardState(
  sourceValues: readonly string[] = [],
  destinationValues: readonly string[] = [],
  unrelatedValues: readonly string[] = [],
): BoardState {
  const sourceTree = createRenderTree(
    createRenderEntries(sourceValues, (value) => value),
  );
  const destinationTree = createRenderTree(
    createRenderEntries(destinationValues, (value) => value),
  );
  const unrelatedTree = createRenderTree(
    createRenderEntries(unrelatedValues, (value) => value),
  );
  const tree = createRenderTree([
    createRenderEntry("Source", "source", sourceTree),
    createRenderEntry("Destination", "destination", destinationTree),
    createRenderEntry("Unrelated", "unrelated", unrelatedTree),
  ]);
  return { tree, sourceTree, destinationTree, unrelatedTree };
}

function ordinaryIds<T>(tree: RenderTree<T>): string[] {
  return tree.entries
    .filter((entry) => !entry.isGhost)
    .map((entry) => entry.itemId);
}

function childTree<T>(tree: RenderTree<T>, itemId: string): RenderTree<T> {
  const entry = tree.entries.find(
    (candidate) => !candidate.isGhost && candidate.itemId === itemId,
  );
  if (!entry || entry.isGhost || entry.childTree === null) {
    throw new Error(`Missing child RenderTree "${itemId}".`);
  }
  return entry.childTree;
}

function requireGhost<State extends GhostState["type"]>(
  ghostItem: Item,
  type: State,
): Extract<GhostState, { type: State }> {
  const state = ghostItem.ghostState;
  if (state === null || state.type !== type) {
    throw new Error(`Expected a ${type} GhostState.`);
  }
  return state as Extract<GhostState, { type: State }>;
}

function createSpacer(
  harness: RenderTreeHarness,
  container: Container,
  index: number,
  originalId = "dragged",
): Extract<GhostState, { type: "target-spacer" }> {
  const original = requireItem(harness, originalId);
  const ghostItem = original.createGhostItem(harness.ghostSession, {
    type: "target-spacer",
    location: buildGhostSlotLocation(container, index),
    rect: { x: 0, y: 0, width: 40, height: 40 },
  });
  return requireGhost(ghostItem, "target-spacer");
}

function createSourceSpacer(
  harness: RenderTreeHarness,
  container: Container,
  index: number,
  originalId = "dragged",
): Extract<GhostState, { type: "source-spacer" }> {
  const original = requireItem(harness, originalId);
  const ghostItem = original.createGhostItem(harness.ghostSession, {
    type: "source-spacer",
    location: buildGhostSlotLocation(container, index),
    rect: { x: 0, y: 0, width: 40, height: 40 },
  });
  return requireGhost(ghostItem, "source-spacer");
}

function moveSpacer(
  ghost: Extract<GhostState, { type: "target-spacer" }>,
  container: Container,
  index: number,
): Extract<GhostState, { type: "target-spacer" }> {
  return { ...ghost, location: buildGhostSlotLocation(container, index) };
}

function createPointerPreview(
  harness: RenderTreeHarness,
  container: Container,
): Extract<GhostState, { type: "pointer-preview" }> {
  const original = harness.session.primaryItem;
  const ghostItem = original.createGhostItem(harness.ghostSession, {
    type: "pointer-preview",
    location: buildGhostOverlayLocation(container),
    rect: { x: 8, y: 12, width: 40, height: 40 },
  });
  return requireGhost(ghostItem, "pointer-preview");
}

interface InsertionMarkerFixtureOptions {
  gap: InsertionGapSegment;
  previous?: InsertionMarkerNeighbor | null;
  next?: InsertionMarkerNeighbor | null;
  isCurrentPlacement?: boolean;
}

function createInsertionMarker(
  harness: RenderTreeHarness,
  container: Container,
  index: number,
  options: InsertionMarkerFixtureOptions,
): Extract<GhostState, { type: "insertion-marker" }> {
  const original = requireItem(harness, "dragged");
  const ghostItem = original.createGhostItem(harness.ghostSession, {
    type: "insertion-marker",
    location: buildGhostSlotLocation(container, index),
    gap: Object.freeze({ ...options.gap }),
    previous: options.previous ?? null,
    next: options.next ?? null,
    isCurrentPlacement: options.isCurrentPlacement ?? false,
  });
  return requireGhost(ghostItem, "insertion-marker");
}

function createMoveEvent(
  items: readonly Item[],
  froms: readonly DragLocation[],
  to: DragLocation,
): ItemMoveEvent {
  return {
    session: null,
    item: items[0],
    itemId: items[0].itemId,
    itemMetadata: items[0].metadata,
    items: [...items],
    itemIds: items.map((item) => item.itemId),
    itemsMetadata: items.map((item) => item.metadata),
    from: froms[0],
    froms: [...froms],
    to,
    beforeElement: null,
  };
}

function createRemoveEvent(
  container: Container,
  items: readonly Item[],
): ItemRemoveEvent {
  return {
    session: null,
    item: items[0],
    itemId: items[0].itemId,
    itemMetadata: items[0].metadata,
    items: [...items],
    itemIds: items.map((item) => item.itemId),
    itemsMetadata: items.map((item) => item.metadata),
    container,
    containerMetadata: container.metadata,
  };
}

function createInsertEvent(
  container: Container,
  items: readonly Item[],
  index: number,
): ItemInsertEvent {
  return {
    ...createRemoveEvent(container, items),
    index,
    beforeElement: null,
  };
}

function createSwapEvent(
  a: { item: Item; container: Container; index: number },
  b: { item: Item; container: Container; index: number },
): ItemSwapEvent {
  return {
    session: null,
    a: {
      item: a.item,
      itemId: a.item.itemId,
      itemMetadata: a.item.metadata,
      container: a.container,
      containerMetadata: a.container.metadata,
      index: a.index,
    },
    b: {
      item: b.item,
      itemId: b.item.itemId,
      itemMetadata: b.item.metadata,
      container: b.container,
      containerMetadata: b.container.metadata,
      index: b.index,
    },
  };
}

test("render factories create leaf and nested entries with raw IDs", () => {
  const leaves = createRenderEntries(
    [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    (value) => value.id,
  );
  const child = createRenderTree(leaves);
  const parent = createRenderEntry(
    { id: "group", label: "Group" },
    "group",
    child,
  );
  const root = createRenderTree([parent]);

  expect(leaves.map((entry) => entry.itemId)).toEqual(["a", "b"]);
  expect(parent.childTree).toBe(child);
  expect(root).toEqual({ entries: [parent] });
});

test("render factories reject duplicate IDs, reused subtrees, and cycles", () => {
  expect(() => createRenderEntry("empty", "")).toThrow(
    /itemId must be a non-empty string/,
  );
  expect(() => createRenderEntries([""], (value) => value)).toThrow(
    /itemId must be a non-empty string/,
  );
  expect(() =>
    createRenderEntries(["duplicate", "duplicate"], (value) => value),
  ).toThrow(/duplicate Item ID/);

  const duplicateChild = createRenderTree([
    createRenderEntry("duplicate", "duplicate"),
  ]);
  expect(() =>
    createRenderTree([
      createRenderEntry("parent", "parent", duplicateChild),
      createRenderEntry("duplicate", "duplicate"),
    ]),
  ).toThrow(/duplicate Item ID/);

  const child = createRenderTree<string>();
  expect(() =>
    createRenderTree([
      createRenderEntry("first", "first", child),
      createRenderEntry("second", "second", child),
    ]),
  ).toThrow(/reused or contain a recursive cycle/);

  const recursive = createRenderTree<string>();
  Object.defineProperty(recursive, "entries", {
    value: [createRenderEntry("recursive", "recursive", recursive)],
  });
  expect(() =>
    createRenderTree([createRenderEntry("parent", "parent", recursive)]),
  ).toThrow(/reused or contain a recursive cycle/);
});

test("ghost insert routes by logical Container ID and preserves unrelated branches", () => {
  const harness = createRenderTreeHarness();
  try {
    const board = createBoardState(["dragged"], ["remaining"]);
    const ghost = createSpacer(harness, harness.destination, 0);
    const next = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(ghost, null),
    );
    const nextDestination = childTree(next, "destination");

    expect(next).not.toBe(board.tree);
    expect(childTree(next, "source")).toBe(board.sourceTree);
    expect(childTree(next, "unrelated")).toBe(board.unrelatedTree);
    expect(nextDestination).not.toBe(board.destinationTree);
    expect(nextDestination.entries.map((entry) => entry.itemId)).toEqual([
      ghost.ghostItemId,
      "remaining",
    ]);
  } finally {
    harness.cleanup();
  }
});

test("ghost move relocates state across nested Containers and validates identity", () => {
  const harness = createRenderTreeHarness();
  try {
    const board = createBoardState([], ["remaining"]);
    const previous = createSpacer(harness, harness.source, 0);
    const inserted = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(previous, null),
    );
    const moved = moveSpacer(previous, harness.destination, 1);
    const next = reduceRenderTree(
      inserted,
      buildGhostMoveEvent(previous, moved, null),
    );

    expect(childTree(next, "source").entries).toEqual([]);
    expect(
      childTree(next, "destination").entries.map((entry) => entry.itemId),
    ).toEqual(["remaining", moved.ghostItemId]);

    const stale = moveSpacer(moved, harness.destination, 0);
    expect(() =>
      reduceRenderTree(
        next,
        buildGhostMoveEvent(stale, moveSpacer(stale, harness.source, 0), null),
      ),
    ).toThrow(/stale location/);
  } finally {
    harness.cleanup();
  }
});

test("same-location insertion marker moves update presentation and replay idempotently", () => {
  const harness = createRenderTreeHarness();
  try {
    const board = createBoardState([], ["remaining"]);
    const marker = createInsertionMarker(harness, harness.destination, 1, {
      gap: { orientation: "horizontal", x: 20, y: 44, length: 120 },
      isCurrentPlacement: true,
    });
    const inserted = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(marker, null),
    );
    const previous = Object.freeze({
      item: marker.original,
      itemId: marker.originalItemId,
      itemMetadata: marker.originalMetadata,
      rect: Object.freeze({ x: 20, y: 48, width: 120, height: 40 }),
    });
    const moved = Object.freeze({
      ...marker,
      gap: Object.freeze({
        orientation: "horizontal",
        x: 20,
        y: 92,
        length: 120,
      }),
      previous,
      isCurrentPlacement: false,
    });
    const event = buildGhostMoveEvent(marker, moved, null);
    const updated = reduceRenderTree(inserted, event);
    const rendered = childTree(updated, "destination").entries.find(
      (entry) => entry.itemId === marker.ghostItemId,
    );
    if (!rendered?.isGhost) {
      throw new Error("Expected the moved insertion marker entry.");
    }

    expect(updated).not.toBe(inserted);
    expect(rendered.ghost).toBe(moved);
    expect(rendered.ghost).toMatchObject({
      gap: { orientation: "horizontal", x: 20, y: 92, length: 120 },
      previous: { itemId: marker.originalItemId },
      next: null,
      isCurrentPlacement: false,
    });
    expect(rendered.ghost.previous?.item).toBe(marker.original);
    expect(reduceRenderTree(updated, event)).toBe(updated);

    const equivalent = Object.freeze({
      ...moved,
      gap: Object.freeze({ ...moved.gap }),
      previous: Object.freeze({
        ...previous,
        rect: Object.freeze({ ...previous.rect }),
      }),
    });
    expect(
      reduceRenderTree(updated, buildGhostMoveEvent(moved, equivalent, null)),
    ).toBe(updated);
  } finally {
    harness.cleanup();
  }
});

test("insertionMarkerRect projects through border and scroll with explicit validated options", () => {
  const harness = createRenderTreeHarness();
  try {
    const box = harness.destination.currentDomProperty;
    box.x = 100;
    box.y = 200;
    box.width = 240;
    box.height = 180;
    box.border.left = 4;
    box.border.top = 6;
    box.padding.left = 30;
    box.padding.top = 24;
    const element = document.createElement("div");
    Object.defineProperty(element, "scrollLeft", { value: 11 });
    Object.defineProperty(element, "scrollTop", { value: 13 });
    harness.destination.element = element;

    const marker = createInsertionMarker(harness, harness.destination, 0, {
      gap: {
        orientation: "horizontal",
        x: 130,
        y: 250,
        length: 100,
      },
    });
    const rect = insertionMarkerRect(marker, {
      thickness: 4,
      startInset: 10,
      endInset: 20,
    });

    expect(rect).toEqual({ x: 47, y: 55, width: 70, height: 4 });
    expect(Object.isFrozen(rect)).toBe(true);
    const projected = toContainerLocalRect(
      { x: 130, y: 250, width: 100, height: 50 },
      harness.destination,
    );
    expect(projected).toEqual({ x: 37, y: 57, width: 100, height: 50 });
    expect(Object.isFrozen(projected)).toBe(true);
    expect(stockInsertionMarkerRectOptions).toEqual({
      thickness: 3,
      startInset: 0,
      endInset: 0,
    });
    expect(Object.isFrozen(stockInsertionMarkerRectOptions)).toBe(true);
    expect(() =>
      insertionMarkerRect(marker, {
        thickness: 4,
        startInset: 80,
        endInset: 40,
      }),
    ).toThrow(/must not exceed marker\.gap\.length/);

    const invalidOptions: ReadonlyArray<{
      field: string;
      options: InsertionMarkerRectOptions;
    }> = [
      {
        field: "thickness",
        options: { thickness: -1, startInset: 0, endInset: 0 },
      },
      {
        field: "startInset",
        options: { thickness: 3, startInset: Number.NaN, endInset: 0 },
      },
      {
        field: "endInset",
        options: {
          thickness: 3,
          startInset: 0,
          endInset: Number.POSITIVE_INFINITY,
        },
      },
    ];
    for (const invalid of invalidOptions) {
      expect(() => insertionMarkerRect(marker, invalid.options)).toThrow(
        invalid.field,
      );
    }

    const unmountedMarker = Object.freeze({
      ...marker,
      location: buildGhostSlotLocation(harness.unrelated, 0),
    });
    expect(() =>
      insertionMarkerRect(unmountedMarker, stockInsertionMarkerRectOptions),
    ).toThrow(/mounted element/);
  } finally {
    harness.cleanup();
  }
});

test("Vanilla insertion markers honor explicit custom rectangle options", () => {
  const harness = createRenderTreeHarness();
  try {
    const box = harness.destination.currentDomProperty;
    box.x = 50;
    box.y = 80;
    box.width = 180;
    box.height = 140;
    box.border.left = 2;
    box.border.top = 4;
    const destinationElement = document.createElement("div");
    Object.defineProperty(destinationElement, "scrollLeft", { value: 7 });
    Object.defineProperty(destinationElement, "scrollTop", { value: 9 });
    document.body.append(destinationElement);
    harness.destination.element = destinationElement;
    const marker = createInsertionMarker(harness, harness.destination, 0, {
      gap: { orientation: "horizontal", x: 70, y: 120, length: 100 },
    });
    const adapter = createVanillaAdapter({
      insertionMarker: { thickness: 6, startInset: 10, endInset: 20 },
    });

    adapter.callbacks.onGhostInsert?.(buildGhostInsertEvent(marker, null));

    const markerElement = marker.ghostItem.element;
    if (!markerElement) {
      throw new Error("Expected Vanilla to create the insertion marker.");
    }
    expect(markerElement.dataset.snapsortGhost).toBe("insertion");
    expect(markerElement.style.left).toBe("35px");
    expect(markerElement.style.top).toBe("42px");
    expect(markerElement.style.width).toBe("70px");
    expect(markerElement.style.height).toBe("6px");

    adapter.callbacks.onGhostRemove?.(buildGhostRemoveEvent(marker));
    expect(markerElement.isConnected).toBe(false);
  } finally {
    harness.cleanup();
  }
});

test("one flow move atomically synchronizes a live multi-ghost run", () => {
  const harness = createRenderTreeHarness(["a", "b"]);
  try {
    const board = createBoardState(["a", "b"], ["tail"]);
    const first = createSpacer(harness, harness.destination, 0, "a");
    const second = createSpacer(harness, harness.destination, 1, "b");

    const withFirst = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(first, null),
    );
    const inserted = reduceRenderTree(
      withFirst,
      buildGhostInsertEvent(second, null),
    );
    const movedFirst = moveSpacer(first, harness.destination, 1);
    const movedSecond = moveSpacer(second, harness.destination, 2);
    first.ghostItem.ghostState = movedFirst;
    second.ghostItem.ghostState = movedSecond;

    const moved = reduceRenderTree(
      inserted,
      buildGhostMoveEvent(first, movedFirst, null),
    );
    expect(
      childTree(moved, "destination").entries.map((entry) => entry.itemId),
    ).toEqual(["tail", first.ghostItemId, second.ghostItemId]);
    const movedSecondEntry = childTree(moved, "destination").entries.find(
      (entry) => entry.itemId === second.ghostItemId,
    );
    if (!movedSecondEntry?.isGhost) {
      throw new Error("Expected the second synchronized ghost entry.");
    }
    Object.defineProperty(movedSecondEntry, "ghost", {
      value: { ...movedSecond, location: { ...movedSecond.location } },
    });
    expect(
      reduceRenderTree(moved, buildGhostMoveEvent(second, movedSecond, null)),
    ).toBe(moved);

    const crossFirst = moveSpacer(movedFirst, harness.source, 0);
    const crossSecond = moveSpacer(movedSecond, harness.source, 1);
    first.ghostItem.ghostState = crossFirst;
    second.ghostItem.ghostState = crossSecond;
    const crossed = reduceRenderTree(
      moved,
      buildGhostMoveEvent(movedFirst, crossFirst, null),
    );
    expect(
      childTree(crossed, "destination").entries.map((entry) => entry.itemId),
    ).toEqual(["tail"]);
    expect(
      childTree(crossed, "source").entries.map((entry) => entry.itemId),
    ).toEqual(["a", "b", first.ghostItemId, second.ghostItemId]);
    expect(
      reduceRenderTree(
        crossed,
        buildGhostMoveEvent(movedSecond, crossSecond, null),
      ),
    ).toBe(crossed);

    const removed = reduceRenderTree(
      crossed,
      buildGhostRemoveEvent(crossFirst),
    );
    expect(
      childTree(removed, "source").entries.map((entry) => entry.itemId),
    ).toEqual(["a", "b"]);
    expect(reduceRenderTree(removed, buildGhostRemoveEvent(crossSecond))).toBe(
      removed,
    );
  } finally {
    harness.cleanup();
  }
});

test("ghost removal globally and idempotently purges stale copies", () => {
  const harness = createRenderTreeHarness();
  try {
    const board = createBoardState();
    const ghost = createSpacer(harness, harness.source, 0);
    const inserted = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(ghost, null),
    );
    const source = childTree(inserted, "source");
    const destination = childTree(inserted, "destination");
    const unrelated = childTree(inserted, "unrelated");
    const ghostEntry = source.entries[0];
    if (!ghostEntry.isGhost) throw new Error("Expected a ghost entry.");
    const sourceCopy = {
      ...ghostEntry.ghost,
      location: buildGhostSlotLocation(harness.source, 0),
    };
    const misroutedCopy = {
      ...ghostEntry.ghost,
      location: buildGhostSlotLocation(harness.destination, 0),
    };
    Object.defineProperty(destination, "entries", {
      value: [{ ...ghostEntry, ghost: sourceCopy }],
    });
    Object.defineProperty(unrelated, "entries", {
      value: [{ ...ghostEntry, ghost: misroutedCopy }],
    });

    const removed = reduceRenderTree(inserted, buildGhostRemoveEvent(ghost));
    expect(childTree(removed, "source").entries).toEqual([]);
    expect(childTree(removed, "destination").entries).toEqual([]);
    expect(childTree(removed, "unrelated").entries).toEqual([]);
    expect(reduceRenderTree(removed, buildGhostRemoveEvent(ghost))).toBe(
      removed,
    );
  } finally {
    harness.cleanup();
  }
});

test("ghost materialization preserves source anchors and retained dragged entries", () => {
  const harness = createRenderTreeHarness(["B"]);
  try {
    const board = createBoardState(["A", "B", "C"]);
    const source = createSourceSpacer(harness, harness.source, 1, "B");
    const withSource = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(source, null),
    );
    const target = createSpacer(harness, harness.source, 0, "B");
    const withTarget = reduceRenderTree(
      withSource,
      buildGhostInsertEvent(target, null),
    );

    expect(
      childTree(withTarget, "source").entries.map((entry) => entry.itemId),
    ).toEqual([target.ghostItemId, "A", "B", source.ghostItemId, "C"]);
  } finally {
    harness.cleanup();
  }
});

test("ghost materialization appends overlays and rejects invalid slots", () => {
  const harness = createRenderTreeHarness(["a", "b"]);
  try {
    const board = createBoardState([], ["remaining"]);
    const preview = createPointerPreview(harness, harness.destination);
    const withPreview = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(preview, null),
    );
    expect(
      childTree(withPreview, "destination").entries.map(
        (entry) => entry.itemId,
      ),
    ).toEqual(["remaining", preview.ghostItemId]);

    const first = createSpacer(harness, harness.destination, 0, "a");
    const withFirst = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(first, null),
    );
    const collision = createSpacer(harness, harness.destination, 0, "b");
    expect(() =>
      reduceRenderTree(withFirst, buildGhostInsertEvent(collision, null)),
    ).toThrow(/share slot 0/);

    const unreachable = createSpacer(harness, harness.destination, 2, "a");
    expect(() =>
      reduceRenderTree(board.tree, buildGhostInsertEvent(unreachable, null)),
    ).toThrow(/invalid slot 2/);
  } finally {
    harness.cleanup();
  }
});

test("item move supports ordered multi-source runs and structural sharing", () => {
  const harness = createRenderTreeHarness(["a", "b", "c", "d"]);
  try {
    const board = createBoardState(["a", "b", "c"], ["d"]);
    const a = requireItem(harness, "a");
    const c = requireItem(harness, "c");
    const event = createMoveEvent(
      [a, c],
      [
        buildDragLocation(harness.source, 0),
        buildDragLocation(harness.source, 2),
      ],
      buildDragLocation(harness.destination, 1),
    );
    const next = reduceRenderTree(board.tree, event);

    expect(ordinaryIds(childTree(next, "source"))).toEqual(["b"]);
    expect(ordinaryIds(childTree(next, "destination"))).toEqual([
      "d",
      "a",
      "c",
    ]);
    expect(childTree(next, "source")).not.toBe(board.sourceTree);
    expect(childTree(next, "destination")).not.toBe(board.destinationTree);
    expect(childTree(next, "unrelated")).toBe(board.unrelatedTree);
  } finally {
    harness.cleanup();
  }
});

test("moving a nested Container entry carries its child tree across transient topology", () => {
  const harness = createRenderTreeHarness(["leaf"]);
  try {
    const board = createBoardState(["leaf"]);
    // Core commits before the framework callback. Runtime topology already
    // has the new parent while this RenderTree still describes the old one.
    placeItemAt(harness.unrelated, harness.source, 0);
    const event = createMoveEvent(
      [harness.source],
      [buildDragLocation(harness.root, 0)],
      buildDragLocation(harness.unrelated, 0),
    );
    const next = reduceRenderTree(board.tree, event);
    const unrelated = childTree(next, "unrelated");
    const movedEntry = unrelated.entries[0];

    expect(ordinaryIds(next)).toEqual(["destination", "unrelated"]);
    expect(movedEntry.isGhost).toBe(false);
    if (movedEntry.isGhost) throw new Error("Expected an ordinary entry.");
    expect(movedEntry.childTree).toBe(board.sourceTree);
    if (movedEntry.childTree === null) {
      throw new Error("Expected the moved entry to retain its child tree.");
    }
    expect(ordinaryIds(movedEntry.childTree)).toEqual(["leaf"]);
  } finally {
    harness.cleanup();
  }
});

test("logical routing rejects unknown IDs and entries without child trees", () => {
  const harness = createRenderTreeHarness(["a"]);
  try {
    const board = createBoardState(["a"]);
    const a = requireItem(harness, "a");
    const unknown = new Container(harness.engine, harness.root, {
      itemId: "missing",
    });
    expect(() =>
      reduceRenderTree(
        board.tree,
        createMoveEvent(
          [a],
          [buildDragLocation(harness.source, 0)],
          buildDragLocation(unknown, 0),
        ),
      ),
    ).toThrow(/not represented within this RenderTree/);

    const leaf = new Container(harness.engine, harness.root, { itemId: "a" });
    expect(() =>
      reduceRenderTree(
        board.tree,
        createMoveEvent(
          [a],
          [buildDragLocation(harness.source, 0)],
          buildDragLocation(leaf, 0),
        ),
      ),
    ).toThrow(/entry has no child RenderTree/);
  } finally {
    harness.cleanup();
  }
});

test("events reject mixed Container and Item roots", () => {
  const harness = createRenderTreeHarness(["a"]);
  try {
    const board = createBoardState(["a"]);
    const a = requireItem(harness, "a");
    const foreignRoot = new Container(harness.engine, null, {
      itemId: "foreign-root",
    });
    const foreignDestination = new Container(harness.engine, foreignRoot, {
      itemId: "destination",
    });
    expect(() =>
      reduceRenderTree(
        board.tree,
        createMoveEvent(
          [a],
          [buildDragLocation(harness.source, 0)],
          buildDragLocation(foreignDestination, 0),
        ),
      ),
    ).toThrow(/different independent root/);

    const foreignSource = new Container(harness.engine, foreignRoot, {
      itemId: "source",
    });
    expect(() =>
      reduceRenderTree(
        board.tree,
        createMoveEvent(
          [foreignSource],
          [buildDragLocation(harness.root, 0)],
          buildDragLocation(harness.unrelated, 0),
        ),
      ),
    ).toThrow(/Item "source" belongs to a different independent root/);

    const foreignA = new Item(harness.engine, foreignRoot, { itemId: "a" });
    expect(() =>
      reduceRenderTree(
        board.tree,
        createRemoveEvent(harness.source, [foreignA]),
      ),
    ).toThrow(/Item "a" belongs to a different independent root/);

    const ghost = createSpacer(harness, harness.source, 0, "a");
    const foreignGhostState = {
      ...ghost,
      original: foreignA,
      items: [foreignA],
    };
    expect(() =>
      reduceRenderTree(
        board.tree,
        buildGhostInsertEvent(foreignGhostState, null),
      ),
    ).toThrow(/Item "a" belongs to a different independent root/);
  } finally {
    harness.cleanup();
  }
});

test("logical routing trusts a self-consistent callback root", () => {
  const harness = createRenderTreeHarness();
  try {
    const board = createBoardState(["a"]);
    const callbackRoot = new Container(harness.engine, null, {
      itemId: "callback-root",
    });
    const callbackSource = new Container(harness.engine, callbackRoot, {
      itemId: "source",
    });
    const callbackDestination = new Container(harness.engine, callbackRoot, {
      itemId: "destination",
    });
    const callbackItem = new Item(harness.engine, callbackSource, {
      itemId: "a",
    });

    const next = reduceRenderTree(
      board.tree,
      createMoveEvent(
        [callbackItem],
        [buildDragLocation(callbackSource, 0)],
        buildDragLocation(callbackDestination, 0),
      ),
    );

    expect(ordinaryIds(childTree(next, "source"))).toEqual([]);
    expect(ordinaryIds(childTree(next, "destination"))).toEqual(["a"]);
  } finally {
    harness.cleanup();
  }
});

test("events reject a non-independent session root", () => {
  const harness = createRenderTreeHarness(["a"]);
  try {
    const board = createBoardState(["a"]);
    const a = requireItem(harness, "a");

    const nestedRootSession: DragSession = {
      ...harness.session,
      root: harness.source,
    };
    expect(() =>
      reduceRenderTree(board.tree, {
        ...createRemoveEvent(harness.source, [a]),
        session: nestedRootSession,
      }),
    ).toThrow(/event root must be an independent root/);
  } finally {
    harness.cleanup();
  }
});

test("RenderTree rejects a ghost stored under the wrong logical owner", () => {
  const harness = createRenderTreeHarness();
  try {
    const board = createBoardState(["dragged"]);
    const ghost = createSpacer(harness, harness.source, 0);
    const inserted = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(ghost, null),
    );
    const source = childTree(inserted, "source");
    Object.defineProperty(source, "entries", {
      value: source.entries.map((entry) =>
        entry.isGhost
          ? {
              ...entry,
              ghost: {
                ...entry.ghost,
                location: buildGhostSlotLocation(harness.destination, 0),
              },
            }
          : entry,
      ),
    });

    expect(() =>
      reduceRenderTree(
        inserted,
        createRemoveEvent(harness.source, [requireItem(harness, "dragged")]),
      ),
    ).toThrow(/belongs to a different Container/);
  } finally {
    harness.cleanup();
  }
});

test("item move rejects stale sources, active ghosts, and recursive destinations", () => {
  const harness = createRenderTreeHarness(["a"]);
  try {
    const board = createBoardState(["a"]);
    const a = requireItem(harness, "a");
    expect(() =>
      reduceRenderTree(
        board.tree,
        createMoveEvent(
          [a],
          [buildDragLocation(harness.source, 1)],
          buildDragLocation(harness.destination, 0),
        ),
      ),
    ).toThrow(/stale location/);

    const ghost = createSpacer(harness, harness.source, 0, "a");
    const withGhost = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(ghost, null),
    );
    expect(() =>
      reduceRenderTree(
        withGhost,
        createMoveEvent(
          [a],
          [buildDragLocation(harness.source, 0)],
          buildDragLocation(harness.destination, 0),
        ),
      ),
    ).toThrow(/still renders ghosts/);

    expect(() =>
      reduceRenderTree(
        board.tree,
        createMoveEvent(
          [harness.source],
          [buildDragLocation(harness.root, 0)],
          buildDragLocation(harness.source, 1),
        ),
      ),
    ).toThrow(/own child tree/);
  } finally {
    harness.cleanup();
  }
});

test("item event validation rejects non-parallel runs and mismatched identities", () => {
  const harness = createRenderTreeHarness(["a", "b"]);
  try {
    const board = createBoardState(["a", "b"]);
    const a = requireItem(harness, "a");
    const b = requireItem(harness, "b");
    const event = createMoveEvent(
      [a, b],
      [
        buildDragLocation(harness.source, 0),
        buildDragLocation(harness.source, 1),
      ],
      buildDragLocation(harness.destination, 0),
    );
    expect(() =>
      reduceRenderTree(board.tree, { ...event, froms: [event.from] }),
    ).toThrow(/source fields must be parallel/);
    expect(() =>
      reduceRenderTree(board.tree, {
        ...event,
        itemIds: ["a", "wrong"],
      }),
    ).toThrow(/does not match its event Item/);
  } finally {
    harness.cleanup();
  }
});

test("item swap exchanges complete entries atomically", () => {
  const harness = createRenderTreeHarness();
  try {
    const board = createBoardState(["a"], ["b"]);
    const event = createSwapEvent(
      { item: harness.source, container: harness.root, index: 0 },
      { item: harness.destination, container: harness.root, index: 1 },
    );
    const next = reduceRenderTree(board.tree, event);

    expect(ordinaryIds(next)).toEqual(["destination", "source", "unrelated"]);
    expect(childTree(next, "source")).toBe(board.sourceTree);
    expect(childTree(next, "destination")).toBe(board.destinationTree);
  } finally {
    harness.cleanup();
  }
});

test("detached item removal removes complete subtrees and preserves other branches", () => {
  const harness = createRenderTreeHarness();
  try {
    const nested = new Container(harness.engine, harness.source, {
      itemId: "nested",
    });
    const nestedTree = createRenderTree<string>();
    const sourceTree = createRenderTree([
      createRenderEntry("Nested", "nested", nestedTree),
    ]);
    const destinationTree = createRenderTree<string>();
    const unrelatedTree = createRenderTree<string>();
    const tree = createRenderTree([
      createRenderEntry("Source", "source", sourceTree),
      createRenderEntry("Destination", "destination", destinationTree),
      createRenderEntry("Unrelated", "unrelated", unrelatedTree),
    ]);

    // ItemRemove fires after core recursively releases runtime ownership.
    releaseItem(harness.source);
    expect(harness.source.rootContainer).toBe(harness.source);
    expect(nested.rootContainer).toBe(nested);
    const next = reduceRenderTree(
      tree,
      createRemoveEvent(harness.root, [harness.source]),
    );

    expect(ordinaryIds(next)).toEqual(["destination", "unrelated"]);
    expect(childTree(next, "destination")).toBe(destinationTree);
    expect(childTree(next, "unrelated")).toBe(unrelatedTree);
  } finally {
    harness.cleanup();
  }
});

test("render-tree reduction rejects ItemInsertEvent at the JavaScript boundary", () => {
  const harness = createRenderTreeHarness(["a"]);
  try {
    const board = createBoardState();
    const event = createInsertEvent(
      harness.destination,
      [requireItem(harness, "a")],
      0,
    );
    const reduceUnsupportedInsert = () =>
      // @ts-expect-error ItemInsertEvent cannot provide an application value.
      reduceRenderTree(board.tree, event);

    expect(reduceUnsupportedInsert).toThrow(
      /cannot materialize an ItemInsertEvent application value/,
    );
  } finally {
    harness.cleanup();
  }
});

test("item removal rematerializes ghosts around remaining ordinary entries", () => {
  const harness = createRenderTreeHarness(["a"]);
  try {
    const b = requireItem(harness, "b");
    const board = createBoardState(["a", "b"]);
    const ghost = createSpacer(harness, harness.source, 0, "a");
    const withGhost = reduceRenderTree(
      board.tree,
      buildGhostInsertEvent(ghost, null),
    );
    const ghostEntry = childTree(withGhost, "source").entries.find(
      (entry) => entry.isGhost,
    );
    const next = reduceRenderTree(
      withGhost,
      createRemoveEvent(harness.source, [b]),
    );

    expect(
      childTree(next, "source").entries.map((entry) => entry.itemId),
    ).toEqual(["a", ghost.ghostItemId]);
    expect(
      childTree(next, "source").entries.find((entry) => entry.isGhost),
    ).toBe(ghostEntry);
  } finally {
    harness.cleanup();
  }
});

test("RenderTree rejects Item and ghost collisions in the raw ID namespace", () => {
  const harness = createRenderTreeHarness();
  try {
    const ghost = createSpacer(harness, harness.destination, 0);
    const board = createBoardState([], [ghost.ghostItemId]);
    expect(() =>
      reduceRenderTree(board.tree, buildGhostInsertEvent(ghost, null)),
    ).toThrow(/duplicate RenderEntry ID/);
  } finally {
    harness.cleanup();
  }
});

test("RenderTree reserves the runtime root Item ID", () => {
  const harness = createRenderTreeHarness();
  try {
    const ordinaryCollision = createRenderTree([
      createRenderEntry("collision", harness.root.itemId),
    ]);
    const rootGhost = createSpacer(harness, harness.root, 0);
    expect(() =>
      reduceRenderTree(
        ordinaryCollision,
        buildGhostInsertEvent(rootGhost, null),
      ),
    ).toThrow(/root Container Item ID "root" collides/);

    Object.defineProperty(harness.ghostSession, "allocateGhostItemId", {
      value: () => harness.root.itemId,
    });
    const collidingGhost = createSpacer(harness, harness.root, 0);
    expect(() =>
      reduceRenderTree(
        createRenderTree(),
        buildGhostInsertEvent(collidingGhost, null),
      ),
    ).toThrow(/root Container Item ID "root" collides/);
  } finally {
    harness.cleanup();
  }
});

test("render state values remain immutable through reducer updates", () => {
  const harness = createRenderTreeHarness(["a"]);
  try {
    const value = { id: "a", label: "A" };
    const source = createRenderTree([createRenderEntry(value, value.id)]);
    const destination = createRenderTree<typeof value>();
    const tree = createRenderTree([
      createRenderEntry(value, "source", source),
      createRenderEntry(value, "destination", destination),
    ]);
    const originalEntry: RenderEntry<typeof value> = source.entries[0];
    const next = reduceRenderTree(
      tree,
      createMoveEvent(
        [requireItem(harness, "a")],
        [buildDragLocation(harness.source, 0)],
        buildDragLocation(harness.destination, 0),
      ),
    );

    expect(childTree(next, "destination").entries[0]).toBe(originalEntry);
    expect(value).toEqual({ id: "a", label: "A" });
  } finally {
    harness.cleanup();
  }
});
