import { Container } from "./container";
import type { Item } from "./item";
import type {
  GhostInsertEvent,
  InsertionMarkerState,
  GhostLifecycleEvent,
  GhostMoveEvent,
  GhostRemoveEvent,
  GhostState,
  ItemMoveEvent,
  ItemRemoveEvent,
  ItemSwapEvent,
} from "./events";
import { sameInsertionMarkerPresentation } from "./insertion-geometry";
import { isFlowSpacerState } from "./internal/flow-slots";
import type { ItemId } from "./snapshot";

/** One framework-owned sortable collection under one independent root. */
export interface RenderTree<T> {
  readonly entries: readonly RenderEntry<T>[];
}

type OrdinaryRenderEntry<T> = {
  readonly isGhost: false;
  readonly itemId: ItemId;
  readonly value: T;
  readonly childTree: RenderTree<T> | null;
};

type GhostRenderEntry = {
  readonly isGhost: true;
  readonly itemId: ItemId;
  readonly ghost: GhostState;
};

/** One framework render entry. Nested Containers are ordinary entries. */
export type RenderEntry<T> = OrdinaryRenderEntry<T> | GhostRenderEntry;

type RenderTreeItemRemoveEvent = ItemRemoveEvent & {
  readonly index?: never;
};

/** Events whose application state transition is fully described by SnapSort. */
export type RenderTreeEvent =
  | GhostLifecycleEvent
  | ItemMoveEvent
  | ItemSwapEvent
  | RenderTreeItemRemoveEvent;

type FlowSpacerState = Extract<
  GhostState,
  { type: "source-spacer" | "target-spacer" }
>;

interface ItemRecord<T> {
  readonly entry: OrdinaryRenderEntry<T>;
  readonly tree: RenderTree<T>;
  readonly index: number;
}

interface GhostRecord<T> {
  readonly entry: GhostRenderEntry;
  readonly tree: RenderTree<T>;
}

interface GhostTransition<T> {
  readonly record: GhostRecord<T>;
  readonly next: GhostState;
}

interface TreeParent<T> {
  readonly tree: RenderTree<T>;
  readonly entry: OrdinaryRenderEntry<T>;
}

interface RenderTreeIndex<T> {
  readonly root: RenderTree<T>;
  readonly expectedRoot: Container | null;
  readonly childTreesByItemId: Map<ItemId, RenderTree<T>>;
  readonly itemsById: Map<ItemId, ItemRecord<T>>;
  readonly ghostsById: Map<ItemId, GhostRecord<T>[]>;
  readonly parentByTree: Map<RenderTree<T>, TreeParent<T> | null>;
}

function assertItemId(itemId: unknown): asserts itemId is ItemId {
  if (typeof itemId !== "string" || itemId.length === 0) {
    throw new TypeError("SnapSort: itemId must be a non-empty string.");
  }
}

/** Create one ordinary render entry. A non-null child tree renders a Container. */
export function createRenderEntry<T>(
  value: T,
  itemId: ItemId,
  childTree: RenderTree<T> | null = null,
): OrdinaryRenderEntry<T> {
  assertItemId(itemId);
  return {
    isGhost: false,
    itemId,
    value,
    childTree,
  };
}

/** Create ordinary leaf entries from one flat application collection. */
export function createRenderEntries<T>(
  values: readonly T[],
  getId: (value: T) => ItemId,
): OrdinaryRenderEntry<T>[] {
  const ids = new Set<ItemId>();
  return values.map((value) => {
    const entry = createRenderEntry(value, getId(value));
    if (ids.has(entry.itemId)) {
      throw new Error(`SnapSort: duplicate Item ID "${entry.itemId}".`);
    }
    ids.add(entry.itemId);
    return entry;
  });
}

/** Create one framework-owned render tree. */
export function createRenderTree<T = never>(
  entries: readonly OrdinaryRenderEntry<T>[] = [],
): RenderTree<T> {
  const tree: RenderTree<T> = {
    entries: [...entries],
  };
  indexRenderTree(tree, null, null);
  return tree;
}

function sameLocation(
  a: GhostState["location"],
  b: GhostState["location"],
): boolean {
  if (a.type !== b.type || a.container !== b.container) return false;
  return a.type === "overlay" || (b.type === "slot" && a.index === b.index);
}

function sameInsertionMarkerStatePresentation(
  a: InsertionMarkerState,
  b: InsertionMarkerState,
): boolean {
  return (
    sameLocation(a.location, b.location) &&
    sameInsertionMarkerPresentation(a, b)
  );
}

function assertGhostAtLocation(
  ghost: GhostState,
  location: GhostState["location"],
): void {
  if (!sameLocation(ghost.location, location)) {
    throw new Error(
      `SnapSort: ghost "${ghost.ghostItemId}" does not match its event location.`,
    );
  }
}

function assertSameGhost(
  previous: GhostState,
  next: GhostState,
  from: GhostState["location"],
): void {
  if (!sameLocation(previous.location, from)) {
    throw new Error(
      `SnapSort: ghost "${next.ghostItemId}" moved from a stale location.`,
    );
  }
  assertSameGhostIdentity(previous, next);
}

function assertSameGhostIdentity(previous: GhostState, next: GhostState): void {
  if (
    previous.type !== next.type ||
    previous.ghostItem !== next.ghostItem ||
    previous.session !== next.session
  ) {
    throw new Error(
      `SnapSort: ghost "${next.ghostItemId}" changed identity while moving.`,
    );
  }
}

function indexRenderTree<T>(
  root: RenderTree<T>,
  expectedRoot: Container | null,
  removableDuplicateGhostId: ItemId | null,
): RenderTreeIndex<T> {
  if (expectedRoot && expectedRoot.rootContainer !== expectedRoot) {
    throw new Error(
      "SnapSort: a RenderTree event root must be an independent root Container.",
    );
  }

  const childTreesByItemId = new Map<ItemId, RenderTree<T>>();
  const itemsById = new Map<ItemId, ItemRecord<T>>();
  const ghostsById = new Map<ItemId, GhostRecord<T>[]>();
  const parentByTree = new Map<RenderTree<T>, TreeParent<T> | null>();

  const visit = (tree: RenderTree<T>, parent: TreeParent<T> | null): void => {
    if (parentByTree.has(tree)) {
      throw new Error(
        "SnapSort: a RenderTree cannot be reused or contain a recursive cycle.",
      );
    }
    parentByTree.set(tree, parent);

    tree.entries.forEach((entry, index) => {
      assertItemId(entry.itemId);
      if (entry.isGhost) {
        if (entry.itemId !== entry.ghost.ghostItemId) {
          throw new Error(
            `SnapSort: ghost entry "${entry.itemId}" does not match its GhostState ID.`,
          );
        }
        if (itemsById.has(entry.itemId)) {
          throw new Error(
            `SnapSort: duplicate RenderEntry ID "${entry.itemId}".`,
          );
        }
        const records = ghostsById.get(entry.itemId) ?? [];
        records.push({ entry, tree });
        ghostsById.set(entry.itemId, records);
        return;
      }

      if (itemsById.has(entry.itemId) || ghostsById.has(entry.itemId)) {
        throw new Error(`SnapSort: duplicate Item ID "${entry.itemId}".`);
      }
      itemsById.set(entry.itemId, { entry, tree, index });
      if (entry.childTree) {
        childTreesByItemId.set(entry.itemId, entry.childTree);
        visit(entry.childTree, { tree, entry });
      }
    });
  };

  visit(root, null);

  if (
    expectedRoot &&
    (itemsById.has(expectedRoot.itemId) || ghostsById.has(expectedRoot.itemId))
  ) {
    throw new Error(
      `SnapSort: root Container Item ID "${expectedRoot.itemId}" collides with a RenderEntry ID.`,
    );
  }

  for (const [id, records] of ghostsById) {
    if (records.length <= 1 || id === removableDuplicateGhostId) continue;
    throw new Error(`SnapSort: ghost "${id}" appears more than once.`);
  }

  const index: RenderTreeIndex<T> = {
    root,
    expectedRoot,
    childTreesByItemId,
    itemsById,
    ghostsById,
    parentByTree,
  };

  if (expectedRoot) {
    for (const [id, records] of ghostsById) {
      if (id === removableDuplicateGhostId) continue;
      for (const record of records) {
        const owner = requireTreeForContainer(
          index,
          record.entry.ghost.location.container,
        );
        if (owner !== record.tree) {
          throw new Error(
            `SnapSort: ghost "${id}" belongs to a different Container.`,
          );
        }
      }
    }
  }

  return index;
}

function materializeFlowSpacers<T>(
  entries: readonly RenderEntry<T>[],
  ghosts: readonly FlowSpacerState[],
  draggedIds: ReadonlySet<ItemId>,
  renderGhost: (ghost: GhostState) => GhostRenderEntry,
): RenderEntry<T>[] {
  if (ghosts.length === 0) return [...entries];

  const slotsByIndex = new Map<number, FlowSpacerState>();
  for (const ghost of ghosts) {
    const index = ghost.location.index;
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(
        `SnapSort: ghost "${ghost.ghostItemId}" has invalid slot ${String(index)}.`,
      );
    }
    const previous = slotsByIndex.get(index);
    if (previous) {
      throw new Error(
        `SnapSort: ghosts "${previous.ghostItemId}" and "${ghost.ghostItemId}" share slot ${index}.`,
      );
    }
    slotsByIndex.set(index, ghost);
  }

  const result: RenderEntry<T>[] = [];
  let slotIndex = 0;
  const appendGhostsAtCurrentSlot = (): void => {
    let ghost = slotsByIndex.get(slotIndex);
    while (ghost) {
      slotsByIndex.delete(slotIndex);
      result.push(renderGhost(ghost));
      slotIndex += 1;
      ghost = slotsByIndex.get(slotIndex);
    }
  };

  for (const entry of entries) {
    const occupiesFlowSlot = entry.isGhost || !draggedIds.has(entry.itemId);
    if (!occupiesFlowSlot) {
      result.push(entry);
      continue;
    }
    appendGhostsAtCurrentSlot();
    result.push(entry);
    slotIndex += 1;
  }
  appendGhostsAtCurrentSlot();

  const unreachable = slotsByIndex.values().next().value;
  if (unreachable) {
    throw new Error(
      `SnapSort: ghost "${unreachable.ghostItemId}" has invalid slot ${String(unreachable.location.index)}.`,
    );
  }
  return result;
}

function createGhostRenderEntry(ghost: GhostState): GhostRenderEntry {
  return {
    isGhost: true,
    itemId: ghost.ghostItemId,
    ghost,
  };
}

function ordinaryEntries<T>(
  entries: readonly RenderEntry<T>[],
): OrdinaryRenderEntry<T>[] {
  return entries.filter(
    (entry): entry is OrdinaryRenderEntry<T> => !entry.isGhost,
  );
}

function ghostStates<T>(entries: readonly RenderEntry<T>[]): GhostState[] {
  return entries
    .filter((entry): entry is GhostRenderEntry => entry.isGhost)
    .map((entry) => entry.ghost);
}

function materializeEntries<T>(
  index: RenderTreeIndex<T>,
  tree: RenderTree<T>,
  items: readonly OrdinaryRenderEntry<T>[],
  ghosts: readonly GhostState[],
): RenderEntry<T>[] {
  for (const ghost of ghosts) {
    if (requireTreeForContainer(index, ghost.location.container) !== tree) {
      throw new Error(
        `SnapSort: ghost "${ghost.ghostItemId}" belongs to a different Container.`,
      );
    }
  }

  const slots = ghosts.filter(isFlowSpacerState);
  const existingGhosts = new Map<ItemId, GhostRenderEntry>();
  for (const entry of tree.entries) {
    if (entry.isGhost) existingGhosts.set(entry.itemId, entry);
  }
  const renderGhost = (ghost: GhostState): GhostRenderEntry => {
    const existing = existingGhosts.get(ghost.ghostItemId);
    return existing?.ghost === ghost ? existing : createGhostRenderEntry(ghost);
  };
  const draggedIds = new Set<ItemId>();
  const representedSessions = new Set<GhostState["session"]>();
  for (const ghost of slots) {
    if (representedSessions.has(ghost.session)) continue;
    representedSessions.add(ghost.session);
    for (const id of ghost.itemIds) draggedIds.add(id);
  }

  const sourceSpacers = slots.filter(
    (ghost): ghost is Extract<GhostState, { type: "source-spacer" }> =>
      ghost.type === "source-spacer",
  );
  const targetSpacers = slots.filter(
    (ghost): ghost is Extract<GhostState, { type: "target-spacer" }> =>
      ghost.type === "target-spacer",
  );
  let result = materializeFlowSpacers(
    items,
    sourceSpacers,
    draggedIds,
    renderGhost,
  );
  result = materializeFlowSpacers(
    result,
    targetSpacers,
    draggedIds,
    renderGhost,
  );

  for (const ghost of ghosts) {
    if (isFlowSpacerState(ghost)) continue;
    result.push(renderGhost(ghost));
  }
  return result;
}

function sameEntries<T>(
  a: readonly RenderEntry<T>[],
  b: readonly RenderEntry<T>[],
): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

function setTreeEntries<T>(
  updates: Map<RenderTree<T>, readonly RenderEntry<T>[]>,
  tree: RenderTree<T>,
  entries: readonly RenderEntry<T>[],
): void {
  if (sameEntries(tree.entries, entries)) {
    updates.delete(tree);
    return;
  }
  updates.set(tree, entries);
}

function applyTreeUpdates<T>(
  tree: RenderTree<T>,
  updates: ReadonlyMap<RenderTree<T>, readonly RenderEntry<T>[]>,
): RenderTree<T> {
  const directEntries = updates.get(tree) ?? tree.entries;
  let childChanged = false;
  const rebuiltEntries = directEntries.map((entry): RenderEntry<T> => {
    if (entry.isGhost || entry.childTree === null) return entry;
    const childTree = applyTreeUpdates(entry.childTree, updates);
    if (childTree === entry.childTree) return entry;
    childChanged = true;
    return { ...entry, childTree };
  });
  const nextEntries = childChanged ? rebuiltEntries : directEntries;

  if (nextEntries === tree.entries) return tree;
  return { entries: nextEntries };
}

function requireTreeForContainer<T>(
  index: RenderTreeIndex<T>,
  container: Container,
): RenderTree<T> {
  const expectedRoot = index.expectedRoot;
  if (expectedRoot === null) {
    throw new Error(
      "SnapSort: runtime Container routing requires an event root.",
    );
  }
  if (container === expectedRoot) return index.root;
  if (container.rootContainer !== expectedRoot) {
    throw new Error(
      `SnapSort: Container "${container.name}" belongs to a different independent root than this event.`,
    );
  }

  const itemId = container.itemId;
  const tree = index.childTreesByItemId.get(itemId);
  if (tree) return tree;
  if (index.itemsById.has(itemId)) {
    throw new Error(
      `SnapSort: Container "${container.name}" uses Item ID "${itemId}", but that entry has no child RenderTree.`,
    );
  }
  throw new Error(
    `SnapSort: Container "${container.name}" with Item ID "${itemId}" is not represented within this RenderTree.`,
  );
}

function assertNoGhosts<T>(tree: RenderTree<T>, operation: string): void {
  if (tree.entries.some((entry) => entry.isGhost)) {
    throw new Error(
      `SnapSort: cannot ${operation} while the involved Container still renders ghosts.`,
    );
  }
}

function assertSubtreeHasNoGhosts<T>(
  tree: RenderTree<T> | null,
  operation: string,
): void {
  if (tree === null) return;
  assertNoGhosts(tree, operation);
  for (const entry of tree.entries) {
    if (!entry.isGhost) assertSubtreeHasNoGhosts(entry.childTree, operation);
  }
}

function assertItemRun(
  event: ItemMoveEvent | ItemRemoveEvent,
  expectsSources: boolean,
): void {
  if (
    event.itemIds.length === 0 ||
    event.itemId !== event.itemIds[0] ||
    event.item !== event.items[0]
  ) {
    throw new Error(
      "SnapSort: an item event requires a non-empty ordered run.",
    );
  }
  if (
    event.items.length !== event.itemIds.length ||
    event.itemsMetadata.length !== event.itemIds.length
  ) {
    throw new Error("SnapSort: item event run fields must be parallel.");
  }
  if (expectsSources && "froms" in event) {
    if (
      event.froms.length !== event.itemIds.length ||
      event.from.container !== event.froms[0].container ||
      event.from.index !== event.froms[0].index
    ) {
      throw new Error(
        "SnapSort: ItemMoveEvent source fields must be parallel.",
      );
    }
  }

  const ids = new Set<ItemId>();
  event.itemIds.forEach((id, itemIndex) => {
    if (ids.has(id)) {
      throw new Error(`SnapSort: Item ID "${id}" appears twice in one event.`);
    }
    ids.add(id);
    if (event.items[itemIndex].itemId !== id) {
      throw new Error(
        `SnapSort: Item ID "${id}" does not match its event Item.`,
      );
    }
  });
}

function assertItemEventRoot(
  item: Item,
  expectedRoot: Container,
  allowDetached: boolean,
): void {
  const actualRoot = item.rootContainer;
  if (
    actualRoot === expectedRoot ||
    (allowDetached && item instanceof Container && actualRoot === item)
  ) {
    return;
  }
  throw new Error(
    `SnapSort: Item "${item.itemId}" belongs to a different independent root than this event.`,
  );
}

function assertEventItemRoots(
  event: RenderTreeEvent,
  expectedRoot: Container,
): void {
  if ("operation" in event) {
    for (const item of event.ghost.items) {
      assertItemEventRoot(item, expectedRoot, false);
    }
    assertItemEventRoot(event.ghost.original, expectedRoot, false);
    assertItemEventRoot(
      event.ghost.ghostItem,
      expectedRoot,
      event.operation === "remove",
    );
    return;
  }
  if ("a" in event) {
    assertItemEventRoot(event.a.item, expectedRoot, false);
    assertItemEventRoot(event.b.item, expectedRoot, false);
    return;
  }

  const allowDetached = !("froms" in event);
  assertItemEventRoot(event.item, expectedRoot, allowDetached);
  for (const item of event.items) {
    assertItemEventRoot(item, expectedRoot, allowDetached);
  }
}

function assertNoSelectedAncestor<T>(
  selectedIds: ReadonlySet<ItemId>,
  records: readonly ItemRecord<T>[],
  index: RenderTreeIndex<T>,
): void {
  for (const record of records) {
    let parent = index.parentByTree.get(record.tree) ?? null;
    while (parent) {
      if (selectedIds.has(parent.entry.itemId)) {
        throw new Error(
          "SnapSort: one item event cannot include both a container entry and its descendant.",
        );
      }
      parent = index.parentByTree.get(parent.tree) ?? null;
    }
  }
}

function assertDestinationOutsideSelection<T>(
  destination: RenderTree<T>,
  selectedIds: ReadonlySet<ItemId>,
  index: RenderTreeIndex<T>,
): void {
  let tree: RenderTree<T> | null = destination;
  while (tree) {
    const parent: TreeParent<T> | null = index.parentByTree.get(tree) ?? null;
    if (parent === null) return;
    if (selectedIds.has(parent.entry.itemId)) {
      throw new Error(
        "SnapSort: a container entry cannot move into its own child tree.",
      );
    }
    tree = parent.tree;
  }
}

function reduceGhostInsert<T>(
  tree: RenderTree<T>,
  index: RenderTreeIndex<T>,
  event: GhostInsertEvent,
): RenderTree<T> {
  assertGhostAtLocation(event.ghost, event.to);
  if (index.ghostsById.has(event.ghost.ghostItemId)) {
    throw new Error(
      `SnapSort: ghost "${event.ghost.ghostItemId}" is already present.`,
    );
  }
  if (index.itemsById.has(event.ghost.ghostItemId)) {
    throw new Error(
      `SnapSort: duplicate RenderEntry ID "${event.ghost.ghostItemId}".`,
    );
  }
  const destination = requireTreeForContainer(index, event.to.container);
  const ghosts = [...ghostStates(destination.entries), event.ghost];
  const updates = new Map<RenderTree<T>, readonly RenderEntry<T>[]>();
  setTreeEntries(
    updates,
    destination,
    materializeEntries(
      index,
      destination,
      ordinaryEntries(destination.entries),
      ghosts,
    ),
  );
  const next = applyTreeUpdates(tree, updates);
  indexRenderTree(next, index.expectedRoot, null);
  return next;
}

function reduceGhostMove<T>(
  tree: RenderTree<T>,
  index: RenderTreeIndex<T>,
  event: GhostMoveEvent,
): RenderTree<T> {
  assertGhostAtLocation(event.ghost, event.to);
  const source = requireTreeForContainer(index, event.from.container);
  requireTreeForContainer(index, event.to.container);
  const records = index.ghostsById.get(event.ghost.ghostItemId) ?? [];
  if (records.length === 0) {
    throw new Error(
      `SnapSort: cannot move absent ghost "${event.ghost.ghostItemId}".`,
    );
  }
  if (records.length !== 1) {
    throw new Error(
      `SnapSort: ghost "${event.ghost.ghostItemId}" appears more than once.`,
    );
  }

  const record = records[0];
  const liveState = record.entry.ghost.ghostItem.ghostState;
  if (
    record.entry.ghost.type === "insertion-marker" &&
    event.ghost.type === "insertion-marker" &&
    sameInsertionMarkerStatePresentation(record.entry.ghost, event.ghost)
  ) {
    assertSameGhostIdentity(record.entry.ghost, event.ghost);
    return tree;
  }
  if (
    record.entry.ghost.type !== "insertion-marker" &&
    (record.entry.ghost === event.ghost || liveState === event.ghost) &&
    sameLocation(record.entry.ghost.location, event.to)
  ) {
    assertSameGhostIdentity(record.entry.ghost, event.ghost);
    return tree;
  }

  assertSameGhost(record.entry.ghost, event.ghost, event.from);
  if (record.tree !== source) {
    throw new Error(
      `SnapSort: ghost "${event.ghost.ghostItemId}" moved from the wrong Container.`,
    );
  }

  const transitions: GhostTransition<T>[] = [];
  if (isFlowSpacerState(event.ghost)) {
    // Core commits every run member before firing its ordered move callbacks;
    // synchronize that live run now so no intermediate state duplicates a slot.
    for (const candidates of index.ghostsById.values()) {
      const candidate = candidates[0];
      const previous = candidate.entry.ghost;
      if (
        !isFlowSpacerState(previous) ||
        previous.type !== event.ghost.type ||
        previous.session !== event.ghost.session
      ) {
        continue;
      }

      if (candidate === record) {
        transitions.push({ record: candidate, next: event.ghost });
        continue;
      }

      const live = previous.ghostItem.ghostState;
      if (live === null) {
        throw new Error(
          `SnapSort: flow ghost "${previous.ghostItemId}" has no live state while synchronizing its run.`,
        );
      }
      assertSameGhostIdentity(previous, live);
      if (!isFlowSpacerState(live)) {
        throw new Error(
          `SnapSort: ghost "${live.ghostItemId}" changed identity while moving.`,
        );
      }
      transitions.push({ record: candidate, next: live });
    }
  } else {
    transitions.push({ record, next: event.ghost });
  }

  const transitioningIds = new Set(
    transitions.map(
      ({ record: transitionRecord }) =>
        transitionRecord.entry.ghost.ghostItemId,
    ),
  );
  const affectedTrees = new Set<RenderTree<T>>();
  const destinationByTransition = new Map<GhostTransition<T>, RenderTree<T>>();
  for (const transition of transitions) {
    const destination = requireTreeForContainer(
      index,
      transition.next.location.container,
    );
    affectedTrees.add(transition.record.tree);
    affectedTrees.add(destination);
    destinationByTransition.set(transition, destination);
  }

  const ghostsByTree = new Map<RenderTree<T>, GhostState[]>();
  for (const affected of affectedTrees) {
    ghostsByTree.set(
      affected,
      ghostStates(affected.entries).filter(
        (ghost) => !transitioningIds.has(ghost.ghostItemId),
      ),
    );
  }
  for (const transition of transitions) {
    const destination = destinationByTransition.get(transition);
    if (!destination) {
      throw new Error("SnapSort: ghost destination state is unavailable.");
    }
    const ghosts = ghostsByTree.get(destination);
    if (!ghosts) {
      throw new Error("SnapSort: ghost destination state is unavailable.");
    }
    ghosts.push(transition.next);
  }

  const updates = new Map<RenderTree<T>, readonly RenderEntry<T>[]>();
  for (const [affected, ghosts] of ghostsByTree) {
    setTreeEntries(
      updates,
      affected,
      materializeEntries(
        index,
        affected,
        ordinaryEntries(affected.entries),
        ghosts,
      ),
    );
  }

  const next = applyTreeUpdates(tree, updates);
  indexRenderTree(next, index.expectedRoot, null);
  return next;
}

function reduceGhostRemove<T>(
  tree: RenderTree<T>,
  event: GhostRemoveEvent,
  expectedRoot: Container,
): RenderTree<T> {
  assertGhostAtLocation(event.ghost, event.from);
  const index = indexRenderTree(tree, expectedRoot, event.ghost.ghostItemId);
  requireTreeForContainer(index, event.from.container);
  const records = index.ghostsById.get(event.ghost.ghostItemId) ?? [];
  if (records.length === 0) return tree;

  const removedIds = new Set<ItemId>([event.ghost.ghostItemId]);
  if (isFlowSpacerState(event.ghost)) {
    // Core tears down a flow run through ordered member callbacks. Remove the
    // represented run at once so a trailing member never keeps a stale slot.
    for (const [id, candidates] of index.ghostsById) {
      if (
        candidates.some(
          ({ entry }) =>
            isFlowSpacerState(entry.ghost) &&
            entry.ghost.type === event.ghost.type &&
            entry.ghost.session === event.ghost.session,
        )
      ) {
        removedIds.add(id);
      }
    }
  }

  const updates = new Map<RenderTree<T>, readonly RenderEntry<T>[]>();
  const affectedTrees = new Set(
    [...index.ghostsById]
      .filter(([id]) => removedIds.has(id))
      .flatMap(([, candidates]) =>
        candidates.map((candidate) => candidate.tree),
      ),
  );
  for (const affected of affectedTrees) {
    const remainingGhosts = ghostStates(affected.entries).filter(
      (ghost) => !removedIds.has(ghost.ghostItemId),
    );
    setTreeEntries(
      updates,
      affected,
      materializeEntries(
        index,
        affected,
        ordinaryEntries(affected.entries),
        remainingGhosts,
      ),
    );
  }
  const next = applyTreeUpdates(tree, updates);
  indexRenderTree(next, expectedRoot, null);
  return next;
}

function reduceItemMove<T>(
  tree: RenderTree<T>,
  index: RenderTreeIndex<T>,
  event: ItemMoveEvent,
): RenderTree<T> {
  assertItemRun(event, true);
  const selectedIds = new Set(event.itemIds);
  const records = event.itemIds.map((id) => {
    const record = index.itemsById.get(id);
    if (record) return record;
    throw new Error(`SnapSort: cannot move absent Item "${id}".`);
  });
  assertNoSelectedAncestor(selectedIds, records, index);

  records.forEach((record, itemIndex) => {
    const from = event.froms[itemIndex];
    const source = requireTreeForContainer(index, from.container);
    assertNoGhosts(source, "move items");
    if (record.tree !== source || record.index !== from.index) {
      throw new Error(
        `SnapSort: Item "${record.entry.itemId}" moved from a stale location.`,
      );
    }
    assertSubtreeHasNoGhosts(record.entry.childTree, "move items");
  });

  const destination = requireTreeForContainer(index, event.to.container);
  assertNoGhosts(destination, "move items");
  assertDestinationOutsideSelection(destination, selectedIds, index);

  const affectedTrees = new Set(records.map((record) => record.tree));
  affectedTrees.add(destination);
  const ordinaryByTree = new Map<RenderTree<T>, OrdinaryRenderEntry<T>[]>();
  for (const affected of affectedTrees) {
    ordinaryByTree.set(affected, ordinaryEntries(affected.entries));
  }
  for (const [affected, entries] of ordinaryByTree) {
    ordinaryByTree.set(
      affected,
      entries.filter((entry) => !selectedIds.has(entry.itemId)),
    );
  }

  const destinationEntries = ordinaryByTree.get(destination);
  if (!destinationEntries) {
    throw new Error("SnapSort: destination RenderTree state is unavailable.");
  }
  if (
    !Number.isInteger(event.to.index) ||
    event.to.index < 0 ||
    event.to.index > destinationEntries.length
  ) {
    throw new Error(
      `SnapSort: Item move has invalid destination index ${String(event.to.index)}.`,
    );
  }
  destinationEntries.splice(
    event.to.index,
    0,
    ...records.map((record) => record.entry),
  );

  const updates = new Map<RenderTree<T>, readonly RenderEntry<T>[]>();
  for (const [affected, entries] of ordinaryByTree) {
    setTreeEntries(updates, affected, entries);
  }
  const next = applyTreeUpdates(tree, updates);
  indexRenderTree(next, index.expectedRoot, null);
  return next;
}

function reduceItemSwap<T>(
  tree: RenderTree<T>,
  index: RenderTreeIndex<T>,
  event: ItemSwapEvent,
): RenderTree<T> {
  if (event.a.itemId === event.b.itemId) {
    throw new Error("SnapSort: ItemSwapEvent requires two different Items.");
  }
  const a = index.itemsById.get(event.a.itemId);
  const b = index.itemsById.get(event.b.itemId);
  if (!a || !b) {
    throw new Error("SnapSort: cannot swap an absent Item.");
  }
  if (
    event.a.item.itemId !== event.a.itemId ||
    event.b.item.itemId !== event.b.itemId
  ) {
    throw new Error("SnapSort: a swap participant does not match its Item ID.");
  }
  const aTree = requireTreeForContainer(index, event.a.container);
  const bTree = requireTreeForContainer(index, event.b.container);
  assertNoGhosts(aTree, "swap items");
  assertNoGhosts(bTree, "swap items");
  if (a.tree !== aTree || a.index !== event.a.index) {
    throw new Error(
      `SnapSort: Item "${a.entry.itemId}" has a stale swap location.`,
    );
  }
  if (b.tree !== bTree || b.index !== event.b.index) {
    throw new Error(
      `SnapSort: Item "${b.entry.itemId}" has a stale swap location.`,
    );
  }
  assertSubtreeHasNoGhosts(a.entry.childTree, "swap items");
  assertSubtreeHasNoGhosts(b.entry.childTree, "swap items");

  const selectedIds = new Set([a.entry.itemId, b.entry.itemId]);
  assertNoSelectedAncestor(selectedIds, [a, b], index);

  const updates = new Map<RenderTree<T>, readonly RenderEntry<T>[]>();
  if (aTree === bTree) {
    const entries = ordinaryEntries(aTree.entries);
    entries[a.index] = b.entry;
    entries[b.index] = a.entry;
    setTreeEntries(updates, aTree, entries);
  } else {
    const aEntries = ordinaryEntries(aTree.entries);
    const bEntries = ordinaryEntries(bTree.entries);
    aEntries[a.index] = b.entry;
    bEntries[b.index] = a.entry;
    setTreeEntries(updates, aTree, aEntries);
    setTreeEntries(updates, bTree, bEntries);
  }

  const next = applyTreeUpdates(tree, updates);
  indexRenderTree(next, index.expectedRoot, null);
  return next;
}

function reduceItemRemove<T>(
  tree: RenderTree<T>,
  index: RenderTreeIndex<T>,
  event: ItemRemoveEvent,
): RenderTree<T> {
  const source = requireTreeForContainer(index, event.container);
  const removedIds = new Set(event.itemIds);
  for (const id of event.itemIds) {
    const record = index.itemsById.get(id);
    if (!record)
      throw new Error(`SnapSort: cannot remove absent Item "${id}".`);
    if (record.tree !== source) {
      throw new Error(
        `SnapSort: Item "${id}" is not owned by the removal Container.`,
      );
    }
  }

  const entries = ordinaryEntries(source.entries).filter(
    (entry) => !removedIds.has(entry.itemId),
  );
  const updates = new Map<RenderTree<T>, readonly RenderEntry<T>[]>();
  setTreeEntries(
    updates,
    source,
    materializeEntries(index, source, entries, ghostStates(source.entries)),
  );
  const next = applyTreeUpdates(tree, updates);
  indexRenderTree(next, index.expectedRoot, null);
  return next;
}

function eventRoot(event: RenderTreeEvent): Container {
  if ("operation" in event) return event.ghost.session.root;
  if ("a" in event)
    return event.session?.root ?? event.a.container.rootContainer;
  if ("froms" in event) {
    return event.session?.root ?? event.to.container.rootContainer;
  }
  return event.session?.root ?? event.container.rootContainer;
}

/** Apply one explicit SnapSort state event to a flat or recursive render tree. */
export function reduceRenderTree<T>(
  tree: RenderTree<T>,
  event: RenderTreeEvent,
): RenderTree<T> {
  if ("index" in event) {
    throw new Error(
      "SnapSort: reduceRenderTree cannot materialize an ItemInsertEvent application value.",
    );
  }
  const expectedRoot = eventRoot(event);
  if (expectedRoot.rootContainer !== expectedRoot) {
    throw new Error(
      "SnapSort: a RenderTree event root must be an independent root Container.",
    );
  }
  assertEventItemRoots(event, expectedRoot);

  if ("operation" in event) {
    if (event.operation === "remove") {
      return reduceGhostRemove(tree, event, expectedRoot);
    }
    const index = indexRenderTree(tree, expectedRoot, null);
    if (event.operation === "insert") {
      return reduceGhostInsert(tree, index, event);
    }
    return reduceGhostMove(tree, index, event);
  }

  if ("a" in event) {
    return reduceItemSwap(
      tree,
      indexRenderTree(tree, expectedRoot, null),
      event,
    );
  }
  if ("froms" in event) {
    return reduceItemMove(
      tree,
      indexRenderTree(tree, expectedRoot, null),
      event,
    );
  }
  assertItemRun(event, false);
  const index = indexRenderTree(tree, expectedRoot, null);
  return reduceItemRemove(tree, index, event);
}
