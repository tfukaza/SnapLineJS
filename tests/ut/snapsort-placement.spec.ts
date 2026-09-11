import { expect, test } from "@playwright/test";
import { contentRect } from "../../src/geometry";
import {
  determineDropTarget,
  determineInsertionDropTarget,
  determineProgressiveDropTarget,
} from "../../assets/snapsort/src/algorithm";
import {
  layoutBox,
  mockSnapSortContainer,
  mockSnapSortItem,
  snapshotFixture,
  virtualInsertionPosition,
} from "../helpers/snapsort-fixtures";

test("progressive placement selects the ghost slot under the dragged center", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 50,
    height: 40,
  });
  const columnItems = [
    mockSnapSortItem("a", { x: 0, y: 0, width: 80, height: 40 }),
    mockSnapSortItem("b", { x: 0, y: 48, width: 80, height: 40 }),
    mockSnapSortItem("c", { x: 0, y: 96, width: 80, height: 40 }),
  ];
  const column = mockSnapSortContainer(
    "column",
    { x: 0, y: 0, width: 140, height: 180 },
    columnItems,
    "column",
  );
  dragged.worldTransform = { x: 15, y: 48, scaleX: 1, scaleY: 1 };

  expect(
    determineProgressiveDropTarget(dragged as any, column as any),
  ).toMatchObject({ container: column, index: 1 });

  const rowItems = [
    mockSnapSortItem("a", { x: 0, y: 0, width: 60, height: 40 }),
    mockSnapSortItem("b", { x: 68, y: 0, width: 60, height: 40 }),
    mockSnapSortItem("c", { x: 136, y: 0, width: 60, height: 40 }),
  ];
  const row = mockSnapSortContainer(
    "row",
    { x: 0, y: 0, width: 240, height: 80 },
    rowItems,
    "row",
  );
  dragged.worldTransform = { x: 73, y: 0, scaleX: 1, scaleY: 1 };

  expect(
    determineProgressiveDropTarget(dragged as any, row as any),
  ).toMatchObject({ container: row, index: 1 });
});

test("euclidean placement keeps parent slots reachable next to nested containers", () => {
  const before = mockSnapSortItem("before", {
    x: 0,
    y: 0,
    width: 80,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 4,
    y: 52,
    width: 50,
    height: 40,
  });
  const nestedItem = mockSnapSortItem("nested-item", {
    x: 4,
    y: 100,
    width: 50,
    height: 40,
  });
  const nested = mockSnapSortContainer(
    "nested",
    { x: 0, y: 48, width: 120, height: 96 },
    [dragged, nestedItem],
    "column",
  );
  const after = mockSnapSortItem("after", {
    x: 0,
    y: 152,
    width: 80,
    height: 40,
  });
  const root = mockSnapSortContainer(
    "root",
    { x: 0, y: 0, width: 160, height: 220 },
    [before, nested, after],
    "column",
  );
  dragged.worldTransform = { x: 1, y: 49, scaleX: 1, scaleY: 1 };

  const target = determineDropTarget(dragged as any, root as any);

  expect(target?.container).toBe(root);
  expect(target?.index).toBe(1);
});

test("insertion placement maps a downward same-container gap to the live index", () => {
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const itemC = mockSnapSortItem("c", {
    x: 0,
    y: 144,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 184 },
    [itemA, dragged, itemB, itemC],
    "column",
  );
  dragged.worldTransform = { x: 0, y: 120, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(3);
  expect(target?.insertion).toMatchObject({
    gap: { orientation: "horizontal", x: 0, y: 140, length: 120 },
    previous: { item: itemB },
    next: { item: itemC },
    isCurrentPlacement: false,
  });
});

test("insertion placement maps an upward same-container gap to the live index", () => {
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const itemC = mockSnapSortItem("c", {
    x: 0,
    y: 144,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 184 },
    [itemA, itemB, dragged, itemC],
    "column",
  );
  dragged.worldTransform = { x: 0, y: 32, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(1);
  expect(target?.insertion).toMatchObject({
    gap: { orientation: "horizontal", x: 0, y: 44, length: 120 },
    previous: { item: itemA },
    next: { item: itemB },
    isCurrentPlacement: false,
  });
});

test("insertion placement keeps the top boundary reachable when dragging the first item", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 136 },
    [dragged, itemA, itemB],
    "column",
  );
  dragged.worldTransform = { x: 0, y: -22, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(1);
  expect(target?.insertion).toMatchObject({
    gap: { orientation: "horizontal", x: 0, y: 0, length: 120 },
    previous: null,
    next: { item: dragged },
    isCurrentPlacement: true,
  });
});

test("insertion placement keeps the bottom boundary reachable when dragging the last item", () => {
  const itemA = mockSnapSortItem("a", {
    x: 0,
    y: 0,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 0,
    y: 48,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 96,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 0, y: 0, width: 120, height: 136 },
    [itemA, itemB, dragged],
    "column",
  );
  dragged.worldTransform = { x: 0, y: 132, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(3);
  expect(target?.insertion).toMatchObject({
    gap: { orientation: "horizontal", x: 0, y: 136, length: 120 },
    previous: { item: dragged },
    next: null,
    isCurrentPlacement: true,
  });
});

test("insertion placement spans the container content box on the marker cross axis", () => {
  const itemA = mockSnapSortItem("a", {
    x: 34,
    y: 40,
    width: 120,
    height: 40,
  });
  const dragged = mockSnapSortItem("dragged", {
    x: 34,
    y: 88,
    width: 120,
    height: 40,
  });
  const itemB = mockSnapSortItem("b", {
    x: 34,
    y: 136,
    width: 120,
    height: 40,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 10, y: 20, width: 220, height: 180 },
    [itemA, dragged, itemB],
    "column",
  );
  const containerBox = layoutBox(
    { x: 10, y: 20, width: 220, height: 180 },
    {},
    { top: 8, right: 12, bottom: 8, left: 20 },
    { top: 2, right: 2, bottom: 2, left: 2 },
  );
  container.dragSnapshot = {
    ...container.dragSnapshot,
    box: containerBox,
  };
  container.box = containerBox;
  dragged.worldTransform = { x: 34, y: 112, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.insertion?.gap).toEqual({
    orientation: "horizontal",
    x: 32,
    y: 132,
    length: 184,
  });
});

test("insertion placement shows a centered marker for an empty row container", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 60,
    height: 32,
  });
  const container = mockSnapSortContainer(
    "container",
    { x: 10, y: 20, width: 200, height: 80 },
    [],
    "row",
  );
  dragged.worldTransform = { x: 80, y: 44, scaleX: 1, scaleY: 1 };

  const target = determineInsertionDropTarget(dragged as any, container as any);

  expect(target?.container).toBe(container);
  expect(target?.index).toBe(0);
  expect(target?.insertion).toEqual({
    gap: { orientation: "vertical", x: 110, y: 20, length: 80 },
    previous: null,
    next: null,
    isCurrentPlacement: false,
  });
});

test("progressive placement uses the cross-axis line in wrapped rows", () => {
  const dragged = mockSnapSortItem("dragged", {
    x: 0,
    y: 0,
    width: 70,
    height: 40,
  });
  const rowItems = [
    dragged,
    mockSnapSortItem("a", { x: 80, y: 0, width: 70, height: 40 }),
    mockSnapSortItem("b", { x: 0, y: 48, width: 70, height: 40 }),
    mockSnapSortItem("c", { x: 80, y: 48, width: 70, height: 40 }),
  ];
  const row = mockSnapSortContainer(
    "wrapped-row",
    { x: 0, y: 0, width: 160, height: 96 },
    rowItems,
    "row",
  );
  dragged.worldTransform = { x: 4, y: 48, scaleX: 1, scaleY: 1 };

  expect(
    determineProgressiveDropTarget(dragged as any, row as any),
  ).toMatchObject({ container: row, index: 2 });
});

test("wraps a horizontal ghost when its trailing margin exceeds the content width", () => {
  const container = snapshotFixture<string>({
    value: "container",
    direction: "row",
    locked: false,
    box: layoutBox({ x: 0, y: 0, width: 313, height: 120 }),
    children: [
      {
        value: "item-1",
        direction: "column",
        locked: false,
        box: layoutBox(
          { x: 4, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
      {
        value: "item-2",
        direction: "column",
        locked: false,
        box: layoutBox(
          { x: 112, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
    ],
  });
  const dragged = snapshotFixture<string>({
    value: "dragged",
    direction: "column",
    locked: false,
    box: layoutBox(
      { x: 0, y: 0, width: 90, height: 40 },
      { left: 4, right: 4 },
    ),
    children: [],
  });

  const simulated = virtualInsertionPosition(
    container,
    dragged,
    0,
    0,
    2,
    dragged.box.width,
    dragged.box.height,
  );

  expect(simulated).toEqual({ x: 4, y: 40 });
});

test("wraps fractional horizontal overflow at browser flex precision", () => {
  const container = snapshotFixture<string>({
    value: "container",
    direction: "row",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox({ x: 0, y: 0, width: 317.2, height: 120 }),
    children: [
      {
        value: "item-1",
        direction: "column",
        mainAxisAlign: "start",
        locked: false,
        box: layoutBox(
          { x: 4, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
      {
        value: "item-2",
        direction: "column",
        mainAxisAlign: "start",
        locked: false,
        box: layoutBox(
          { x: 112, y: 0, width: 100, height: 40 },
          { left: 4, right: 4 },
        ),
        children: [],
      },
    ],
  });
  const dragged = snapshotFixture<string>({
    value: "dragged",
    direction: "column",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox(
      { x: 0, y: 0, width: 93.5, height: 40 },
      { left: 4, right: 4 },
    ),
    children: [],
  });

  const simulated = virtualInsertionPosition(
    container,
    dragged,
    0,
    0,
    2,
    dragged.box.width,
    dragged.box.height,
  );

  expect(simulated).toEqual({ x: 4, y: 40 });
});

test("places append ghost on the short second row in a wrapped row layout", () => {
  const container = snapshotFixture<string>({
    value: "answer",
    direction: "row",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox(
      { x: 0, y: 0, width: 1096, height: 244 },
      {},
      { top: 12, right: 12, bottom: 12, left: 12 },
      { top: 2, right: 2, bottom: 2, left: 2 },
    ),
    children: [
      ["彼", 104, 92, 14, 14],
      ["すぐ", 136, 92, 122, 14],
      ["経歴", 136, 92, 262, 14],
      ["に", 104, 92, 402, 14],
      ["少年", 136, 92, 510, 14],
      ["会社", 136, 92, 650, 14],
      ["問い合わせ", 240, 92, 14, 110],
      ["しまっ", 168, 92, 258, 110],
    ].map(([value, width, height, x, y]) => ({
      value: value as string,
      direction: "column" as const,
      mainAxisAlign: "start" as const,
      locked: false,
      box: layoutBox({
        x: x as number,
        y: y as number,
        width: width as number,
        height: height as number,
      }),
      children: [],
    })),
  });
  const dragged = snapshotFixture<string>({
    value: "を",
    direction: "column",
    mainAxisAlign: "start",
    locked: false,
    box: layoutBox({ x: 0, y: 0, width: 104, height: 92 }),
    children: [],
  });
  const origin = contentRect(container.box);
  const appendGhost = virtualInsertionPosition(
    container,
    dragged,
    origin.x,
    origin.y,
    container.children.length,
    dragged.box.width,
    dragged.box.height,
  );

  expect(appendGhost).toBeTruthy();
  expect(
    appendGhost!.y,
    "append slot should remain on the second visual row",
  ).toBeGreaterThan(container.children[0].box.y);
  expect(appendGhost!.y).toBe(container.children[6].box.y);
});

// Insertion ranks gaps by main-axis distance alone (see "Insertion geometry
// ownership" in assets/snapsort/AGENTS.md): in a wrapped row every line's
// gaps compete on pointer X, so a gap on another line can win. This pins
// that documented rule; applications that want line-aware wrapped
// insertion supply their own getDropPriority / layout.
test("ranks wrapped-row insertion gaps by main-axis distance across lines", () => {
  const items = [
    mockSnapSortItem("彼", { x: 14, y: 14, width: 53.6, height: 47.8 }),
    mockSnapSortItem("の", { x: 71.6, y: 14, width: 53.6, height: 47.8 }),
    mockSnapSortItem("経歴", {
      x: 129.2,
      y: 14,
      width: 71.2,
      height: 47.8,
    }),
    mockSnapSortItem("を", {
      x: 204.4,
      y: 14,
      width: 53.6,
      height: 47.8,
    }),
    mockSnapSortItem("会社", {
      x: 262,
      y: 14,
      width: 71.2,
      height: 47.8,
    }),
    mockSnapSortItem("に", {
      x: 337.2,
      y: 14,
      width: 53.6,
      height: 47.8,
    }),
    mockSnapSortItem("問い合わせ", {
      x: 14,
      y: 65.8,
      width: 124,
      height: 47.8,
    }),
    mockSnapSortItem("た", {
      x: 142,
      y: 65.8,
      width: 53.6,
      height: 47.8,
    }),
  ];
  const container = mockSnapSortContainer(
    "answer",
    { x: 0, y: 0, width: 488, height: 128 },
    items,
    "row",
  );
  const dragged = items[6];
  const source = {
    container,
    containerMetadata: container.metadata,
    index: 6,
  };
  const session = {
    items: [dragged],
    sources: [source],
    activeSources: [source],
    itemSet: new Set([dragged]),
    snapshotItemSet: new Set([dragged]),
    pointer: { x: 235.6, y: 89.7 },
  };

  // @ts-expect-error The fixture implements the resolver surface without Item's private fields.
  const target = determineInsertionDropTarget(dragged, container, session);

  // Pointer X 235.6 is 24.4 from the first line's を|会社 gap (x=260) but
  // 40 from the second line's append gap (x=195.6), so the first line wins.
  expect(target?.container).toBe(container);
  expect(target?.index).toBe(4);
  expect(target?.insertion).toMatchObject({
    gap: {
      orientation: "vertical",
      x: 260,
      y: 14,
      length: 47.8,
    },
    previous: { item: items[3] },
    next: { item: items[4] },
    isCurrentPlacement: false,
  });
});
