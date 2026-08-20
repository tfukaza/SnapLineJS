import type { Container } from "../container";
import { Item } from "../item";
import type { ItemId } from "../snapshot";
import { getDragSessionController } from "../drag/session-store";

function logicalChildren(item: Item): Item[] {
  return item.children.filter((child): child is Item => child instanceof Item);
}

/** @internal Merge engine children with the sortable order without duplicates. */
export function normalizeLogicalChildren(item: Item): Item[] {
  const children = logicalChildren(item);
  const childSet = new Set(children);
  const seen = new Set<Item>();
  return [
    ...item.itemOrderedList.filter((child) => {
      if (!childSet.has(child) || seen.has(child)) return false;
      seen.add(child);
      return true;
    }),
    ...children.filter((child) => {
      if (seen.has(child)) return false;
      seen.add(child);
      return true;
    }),
  ];
}

function visitItemSubtree(
  item: Item,
  visited: Set<Item>,
  visitor: (item: Item) => void,
): void {
  if (visited.has(item)) return;
  visited.add(item);
  visitor(item);
  for (const child of normalizeLogicalChildren(item)) {
    visitItemSubtree(child, visited, visitor);
  }
}

function addUniqueItemId(itemsById: Map<ItemId, Item>, item: Item): void {
  const existing = itemsById.get(item.itemId);
  if (existing && existing !== item) {
    throw new Error(
      `SnapSort: itemId "${item.itemId}" must be unique within one root tree.`,
    );
  }
  itemsById.set(item.itemId, item);
}

function activeSessionItems(root: Container): Item[] {
  const session = getDragSessionController(root);
  if (!session) return [];
  return [
    ...session.items,
    ...session.flowGhostRun,
    ...session.sourceGhostRun,
    ...session.ghostsByChannel.values(),
  ].filter((item) => !item.isDeleteRequested);
}

function liveRootItems(root: Container): Item[] {
  const objectTable = root.global.getEngineObjectTable(root.engine);
  return Object.values(objectTable).filter(
    (object): object is Item =>
      object instanceof Item &&
      !object.isDeleteRequested &&
      object.rootContainer === root,
  );
}

function indexRootItemIds(
  root: Container,
  additionalItems: Iterable<Item> = [],
): Map<ItemId, Item> {
  const itemsById = new Map<ItemId, Item>();
  const visited = new Set<Item>();
  const addSubtree = (item: Item) =>
    visitItemSubtree(item, visited, (candidate) =>
      addUniqueItemId(itemsById, candidate),
    );

  addSubtree(root);
  for (const item of activeSessionItems(root)) addSubtree(item);
  for (const ghost of liveRootItems(root).filter((item) => item.isGhost)) {
    addSubtree(ghost);
  }
  for (const item of additionalItems) addSubtree(item);
  return itemsById;
}

/** @internal Assert the canonical item identity invariant for one root. */
export function assertRootItemIdsUnique(
  root: Container,
  additionalItems: Iterable<Item> = [],
): void {
  indexRootItemIds(root, additionalItems);
}

/** @internal Check an internally generated ID against all live root state. */
export function rootHasItemId(root: Container, itemId: ItemId): boolean {
  return liveRootItems(root).some((item) => item.itemId === itemId);
}

interface ItemPlacement {
  readonly container: Container;
  readonly item: Item;
}

/** @internal Validate IDs for complete placement batches before mutation. */
export function assertPlacementItemIdsUnique(
  placements: readonly ItemPlacement[],
): void {
  const itemsByRoot = new Map<Container, Map<ItemId, Item>>();
  const visitedByRoot = new Map<Container, Set<Item>>();

  for (const { container, item } of placements) {
    const root = container.rootContainer;
    let itemsById = itemsByRoot.get(root);
    let visited = visitedByRoot.get(root);
    if (!itemsById || !visited) {
      itemsById = indexRootItemIds(root);
      visited = new Set<Item>();
      itemsByRoot.set(root, itemsById);
      visitedByRoot.set(root, visited);
    }
    visitItemSubtree(item, visited, (candidate) =>
      addUniqueItemId(itemsById, candidate),
    );
  }
}

/** @internal Reorder connected children by committed DOM while retaining elementless slots. */
export function committedChildrenInDomOrder(item: Item): Item[] {
  const logicalOrder = normalizeLogicalChildren(item);
  const connectedChildren: Array<{ item: Item; element: HTMLElement }> = [];
  for (const child of logicalOrder) {
    const element = child.element;
    if (element?.isConnected) connectedChildren.push({ item: child, element });
  }
  connectedChildren.sort((a, b) => {
    const comparison = a.element.compareDocumentPosition(b.element);
    if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (comparison & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  const connectedItems = new Set(
    connectedChildren.map(({ item: child }) => child),
  );
  const domOrder = connectedChildren.values();
  return logicalOrder.map((child) => {
    if (!connectedItems.has(child)) return child;
    const next = domOrder.next();
    if (next.done) {
      throw new Error("SnapSort: connected child order became inconsistent.");
    }
    return next.value.item;
  });
}

function reconcileSubtreeOrder(item: Item): void {
  const ordered = committedChildrenInDomOrder(item);
  item.itemOrderedList.splice(0, item.itemOrderedList.length, ...ordered);
  for (const child of ordered) reconcileSubtreeOrder(child);
}

/** @internal Reconcile one subtree from its adapter-committed DOM. */
export function reconcileSubtreeState(item: Item, root: Container): void {
  item.rootContainer = root;
  reconcileSubtreeOrder(item);
}

/** @internal Reconcile a complete SnapSort root after a synchronous commit. */
export function reconcileRootTreeState(root: Container): void {
  reconcileSubtreeState(root, root);
  assertRootItemIdsUnique(root);
}
