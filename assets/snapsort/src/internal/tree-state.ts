import type { Container } from "../container";
import { Item } from "../item";

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
}
