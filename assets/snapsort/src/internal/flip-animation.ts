import { AnimationObject } from "@snap-engine/core/animation";
import type { AnimationConfig, Container } from "../container";
import { Item } from "../item";
import { settleMutation } from "../mutation";
import type { ItemId } from "../snapshot";
import { getDragSessionController } from "../drag/session-store";
import { reconcileRootTreeState } from "./tree-state";
import {
  readVisualRect,
  type VisualRectReadCache,
  type VisualRectSnapshot,
} from "./visual-rect";

const MIN_FLIP_DISTANCE = 0.5;

interface TransformOffset {
  x: number;
  y: number;
}

export interface ElementRectAnimationOptions {
  coordinateParent?: Item | null;
  firstParent?: DOMRect | null;
  firstParentItem?: Item | null;
  lastParent?: DOMRect | null;
  lastParentItem?: Item | null;
  subtractAncestorOffset?: boolean;
  initialOffset?: TransformOffset;
}

interface FlipAnimationState {
  item: Item;
  itemId: ItemId;
  first: VisualRectSnapshot | null;
  firstParent: VisualRectSnapshot | null;
  firstParentItem: Item | null;
  last: VisualRectSnapshot | null;
  lastParent: VisualRectSnapshot | null;
  lastParentItem: Item | null;
  targetElement: HTMLElement | null;
}

interface MoveAnimationBatch {
  readonly mutations: Array<() => void>;
}

const visualAnimationOffsets = new WeakMap<Item, TransformOffset>();
const moveAnimationBatches = new WeakMap<Container, MoveAnimationBatch>();

export function animationConfigFor(
  container: Container | null,
  kind: "reorder" | "drop" | "move",
): AnimationConfig | null {
  if (!container || container.config.animation === null) return null;
  return container.config.animation?.[kind] ?? null;
}

function parentItem(item: Item): Item | null {
  return item.parent instanceof Item ? item.parent : null;
}

function visualAnimationOffset(item: Item): TransformOffset {
  return visualAnimationOffsets.get(item) ?? { x: 0, y: 0 };
}

export function clearVisualAnimationOffset(item: Item): void {
  visualAnimationOffsets.delete(item);
}

export function ancestorVisualOffset(parent: Item | null): TransformOffset {
  const offset = { x: 0, y: 0 };
  let current = parent;
  while (current) {
    const currentOffset = visualAnimationOffset(current);
    offset.x += currentOffset.x;
    offset.y += currentOffset.y;
    current = parentItem(current);
  }
  return offset;
}

function visitFlipItems(node: Item, visitor: (item: Item) => void): void {
  for (const child of node.itemOrderedList) {
    if (child.element) visitor(child);
    visitFlipItems(child, visitor);
  }
}

function duplicateFlipItemError(item: Item): Error {
  return new Error(
    `SnapSort: duplicate itemId "${item.itemId}" cannot participate in FLIP animation.`,
  );
}

function indexFlipItems(root: Container): Map<ItemId, Item> {
  const items = new Map<ItemId, Item>();
  visitFlipItems(root, (item) => {
    if (items.has(item.itemId)) throw duplicateFlipItemError(item);
    items.set(item.itemId, item);
  });
  return items;
}

function captureFlipSnapshot(
  root: Container,
  exclude: Set<Item> | null,
): FlipAnimationState[] {
  const itemIds = new Set<ItemId>();
  const cache: VisualRectReadCache = new Map();
  const snapshot: FlipAnimationState[] = [];
  visitFlipItems(root, (item) => {
    if (itemIds.has(item.itemId)) throw duplicateFlipItemError(item);
    itemIds.add(item.itemId);
    if (exclude?.has(item)) return;
    const parent = parentItem(item);
    snapshot.push({
      item,
      itemId: item.itemId,
      first: readVisualRect(item, cache),
      firstParent: parent ? readVisualRect(parent, cache) : null,
      firstParentItem: parent,
      last: null,
      lastParent: null,
      lastParentItem: null,
      targetElement: item.element,
    });
  });
  return snapshot;
}

function captureFlipLast(
  snapshot: FlipAnimationState[],
  root: Container,
): void {
  reconcileRootTreeState(root);
  const currentItems = indexFlipItems(root);
  const cache: VisualRectReadCache = new Map();
  for (const entry of snapshot) {
    const currentItem = currentItems.get(entry.itemId) ?? null;
    if (currentItem) {
      entry.item = currentItem;
      entry.targetElement = currentItem.element;
    } else {
      entry.targetElement = entry.item.element?.isConnected
        ? entry.item.element
        : null;
    }
    const parent = parentItem(entry.item);
    entry.lastParentItem = parent;
    entry.lastParent = parent ? readVisualRect(parent, cache) : null;
    entry.last = readVisualRect(entry.item, cache);
  }
}

function rectAnimationDelta(
  first: DOMRect,
  last: DOMRect,
  options: ElementRectAnimationOptions,
) {
  const { firstParent, lastParent } = options;
  if (
    firstParent &&
    lastParent &&
    options.firstParentItem === options.lastParentItem
  ) {
    return {
      dx: first.x - firstParent.x - (last.x - lastParent.x),
      dy: first.y - firstParent.y - (last.y - lastParent.y),
      useParentLocalDelta: true,
    };
  }
  return {
    dx: first.x - last.x,
    dy: first.y - last.y,
    useParentLocalDelta: false,
  };
}

function writeVisualAnimationTransform(
  item: Item,
  targetElement: HTMLElement,
  x: number,
  y: number,
): void {
  visualAnimationOffsets.set(item, { x, y });
  targetElement.style.transform = `translate3d(${x}px, ${y}px, 0px)`;
  item.rootContainer.invalidateVisualGeometry([item], "animation");
}

export function playElementRectAnimation(
  item: Item,
  first: DOMRect | null,
  last: DOMRect | null,
  targetElement: HTMLElement | null,
  animationConfig: AnimationConfig | null,
  animationOwner: Item,
  options: ElementRectAnimationOptions = {},
): void {
  if (!targetElement || !first || !last || !animationConfig) return;

  const { dx, dy, useParentLocalDelta } = rectAnimationDelta(
    first,
    last,
    options,
  );
  if (Math.abs(dx) < MIN_FLIP_DISTANCE && Math.abs(dy) < MIN_FLIP_DISTANCE) {
    return;
  }

  item.cancelAnimations();
  const duration = animationConfig.duration ?? 160;
  const easing = animationConfig.timing_function ?? "ease-out";
  const coordinateParent =
    options.coordinateParent === undefined
      ? parentItem(item)
      : options.coordinateParent;
  const subtractAncestorOffset =
    options.subtractAncestorOffset ?? !useParentLocalDelta;
  const writeTransformAt = (t: number) => {
    if (t === 0 && options.initialOffset) {
      writeVisualAnimationTransform(
        item,
        targetElement,
        options.initialOffset.x,
        options.initialOffset.y,
      );
      return;
    }
    let x = dx * (1 - t);
    let y = dy * (1 - t);
    if (subtractAncestorOffset) {
      const ancestorOffset = ancestorVisualOffset(coordinateParent);
      x -= ancestorOffset.x;
      y -= ancestorOffset.y;
    }
    writeVisualAnimationTransform(item, targetElement, x, y);
  };
  const animation = new AnimationObject(
    null,
    { $t: [0, 1] },
    {
      duration,
      easing,
      tick: (vars) => writeTransformAt(vars.$t),
      finish: () => {
        clearVisualAnimationOffset(item);
        targetElement.style.transform = "";
        item.rootContainer.invalidateVisualGeometry([item], "settle");
      },
    },
  );

  animationOwner.addAnimation(animation);
  writeTransformAt(0);
  animation.play();
}

function flipAnimationDepth(
  entry: FlipAnimationState,
  entriesByItem: ReadonlyMap<Item, FlipAnimationState>,
): number {
  let depth = 0;
  let parent = entry.lastParentItem;
  while (parent) {
    depth += 1;
    parent = entriesByItem.get(parent)?.lastParentItem ?? parentItem(parent);
  }
  return depth;
}

function isFlipAncestor(
  possibleAncestor: FlipAnimationState,
  descendant: FlipAnimationState,
  entriesByItem: ReadonlyMap<Item, FlipAnimationState>,
): boolean {
  let parent = descendant.lastParentItem;
  while (parent) {
    if (parent === possibleAncestor.item) return true;
    parent = entriesByItem.get(parent)?.lastParentItem ?? parentItem(parent);
  }
  return false;
}

function initialFlipOffsets(
  snapshot: readonly FlipAnimationState[],
  entriesByItem: ReadonlyMap<Item, FlipAnimationState>,
): Map<Item, TransformOffset> {
  const initialOffsets = new Map<Item, TransformOffset>();
  const ancestorOffsetFor = (parent: Item | null): TransformOffset => {
    const offset = { x: 0, y: 0 };
    let current = parent;
    while (current) {
      const entry = entriesByItem.get(current);
      if (entry && !initialOffsets.has(current)) compute(entry);
      const currentOffset =
        initialOffsets.get(current) ?? visualAnimationOffset(current);
      offset.x += currentOffset.x;
      offset.y += currentOffset.y;
      current = entry?.lastParentItem ?? parentItem(current);
    }
    return offset;
  };
  const compute = (entry: FlipAnimationState) => {
    const {
      item,
      first,
      firstParent,
      firstParentItem,
      last,
      lastParent,
      lastParentItem,
      targetElement,
    } = entry;
    if (initialOffsets.has(item) || !targetElement || !first || !last) return;
    const { dx, dy, useParentLocalDelta } = rectAnimationDelta(first, last, {
      firstParent,
      firstParentItem,
      lastParent,
      lastParentItem,
    });
    if (Math.abs(dx) < MIN_FLIP_DISTANCE && Math.abs(dy) < MIN_FLIP_DISTANCE) {
      return;
    }
    let x = dx;
    let y = dy;
    if (!useParentLocalDelta) {
      const offset = ancestorOffsetFor(lastParentItem);
      x -= offset.x;
      y -= offset.y;
    }
    initialOffsets.set(item, { x, y });
  };

  for (const entry of snapshot) compute(entry);
  return initialOffsets;
}

function playFlipAnimations(
  snapshot: FlipAnimationState[],
  animationConfig: AnimationConfig,
  animationOwner: Item,
  draggedItems: Item | readonly Item[] | null,
): void {
  const duration = animationConfig.duration ?? 160;
  const easing = animationConfig.timing_function ?? "ease-out";
  const entriesByItem = new Map<Item, FlipAnimationState>();
  for (const entry of snapshot) entriesByItem.set(entry.item, entry);
  const orderedSnapshot = snapshot.slice().sort((a, b) => {
    if (isFlipAncestor(a, b, entriesByItem)) return -1;
    if (isFlipAncestor(b, a, entriesByItem)) return 1;
    return (
      flipAnimationDepth(a, entriesByItem) -
      flipAnimationDepth(b, entriesByItem)
    );
  });
  const initialOffsets = initialFlipOffsets(orderedSnapshot, entriesByItem);

  for (const entry of orderedSnapshot) {
    if (!entry.targetElement || !entry.first || !entry.last) continue;
    playElementRectAnimation(
      entry.item,
      entry.first,
      entry.last,
      entry.targetElement,
      { duration, timing_function: easing },
      entry.targetElement === entry.item.element ? entry.item : animationOwner,
      {
        coordinateParent: entry.lastParentItem,
        firstParent: entry.firstParent,
        firstParentItem: entry.firstParentItem,
        lastParent: entry.lastParent,
        lastParentItem: entry.lastParentItem,
        initialOffset: initialOffsets.get(entry.item),
      },
    );
  }

  if (!draggedItems) return;
  const draggedItemList = Array.isArray(draggedItems)
    ? draggedItems
    : [draggedItems];
  const session = draggedItemList[0]
    ? getDragSessionController(draggedItemList[0].rootContainer)
    : null;
  if (!session) return;
  session.dragTransformSyncAnimation?.cancel();
  const resyncDraggedItems = () => {
    for (const draggedItem of draggedItemList) draggedItem.scheduleWriteDrag();
  };
  const animation = new AnimationObject(
    null,
    {},
    {
      duration,
      easing,
      tick: resyncDraggedItems,
      finish: () => {
        if (session.dragTransformSyncAnimation === animation) {
          session.dragTransformSyncAnimation = null;
        }
        resyncDraggedItems();
      },
    },
  );
  session.dragTransformSyncAnimation = animation;
  animationOwner.addAnimation(animation, { replaceExisting: false });
  animation.play();
}

export function playDropAnimation(
  item: Item,
  first: DOMRect | null,
  last: DOMRect | null,
  targetElement: HTMLElement | null,
  animationConfig: AnimationConfig | null,
  animationOwner: Item,
): void {
  playElementRectAnimation(
    item,
    first,
    last,
    targetElement,
    animationConfig,
    targetElement === item.element ? item : animationOwner,
  );
}

function withConfiguredAnimation(
  item: Item,
  container: Container | null,
  excludedItem: Item | readonly Item[] | null,
  kind: "reorder" | "move",
  mutate: () => void,
): void {
  const animationConfig = animationConfigFor(container, kind);
  const root = container?.rootContainer ?? item.rootContainer;
  const excludedSet = excludedItem
    ? new Set(Array.isArray(excludedItem) ? excludedItem : [excludedItem])
    : null;
  if (!animationConfig) {
    mutate();
    return;
  }

  let snapshot: FlipAnimationState[] | null = null;
  let mutationComplete = false;
  let lastCaptureComplete = false;
  const queuePrefix = `snapsort-flip-${root.id}-${kind}-${item.id}`;
  root.schedule(
    () => {
      snapshot = captureFlipSnapshot(root, excludedSet);
    },
    { stage: "READ_2", queueId: `${queuePrefix}-read-first` },
  );
  root.schedule(
    async () => {
      if (snapshot === null) return;
      for (const entry of snapshot) {
        entry.item.cancelAnimations();
        if (entry.item.element) entry.item.element.style.transform = "";
      }
      mutate();
      await settleMutation();
      mutationComplete = true;
    },
    { stage: "WRITE_2", queueId: `${queuePrefix}-mutate` },
  );
  root.schedule(
    () => {
      if (snapshot === null || !mutationComplete) return;
      captureFlipLast(snapshot, root);
      lastCaptureComplete = true;
    },
    {
      stage: "READ_3",
      queueId: `${queuePrefix}-read-last`,
    },
  );
  root.schedule(
    () => {
      if (snapshot === null || !lastCaptureComplete) return;
      playFlipAnimations(snapshot, animationConfig, root, excludedItem);
    },
    { stage: "WRITE_3", queueId: `${queuePrefix}-play` },
  );
}

/**
 * Queue one programmatic tree mutation through a Container's move animation
 * channel. Mutations with the same Container share one root snapshot and final
 * FLIP pass. Different Containers schedule independently; because each pass is
 * root-wide, a later pass may replace animations started by an earlier one.
 *
 * @internal
 */
export function withMoveAnimation(
  container: Container,
  mutate: () => void,
): void {
  const existingBatch = moveAnimationBatches.get(container);
  if (existingBatch) {
    existingBatch.mutations.push(mutate);
    return;
  }

  const batch: MoveAnimationBatch = { mutations: [mutate] };
  moveAnimationBatches.set(container, batch);
  const commitBatch = () => {
    const mutations = batch.mutations.splice(0);
    moveAnimationBatches.delete(container);
    let didFail = false;
    let firstError: unknown;
    for (const mutation of mutations) {
      try {
        mutation();
      } catch (error) {
        if (!didFail) {
          didFail = true;
          firstError = error;
        }
      }
    }
    if (didFail) throw firstError;
  };
  try {
    withConfiguredAnimation(container, container, null, "move", commitBatch);
  } catch (error) {
    moveAnimationBatches.delete(container);
    throw error;
  }
}

export function withReorderAnimation(
  item: Item,
  container: Container | null,
  excludedItem: Item | readonly Item[] | null,
  mutate: () => void,
): void {
  withConfiguredAnimation(item, container, excludedItem, "reorder", mutate);
}
