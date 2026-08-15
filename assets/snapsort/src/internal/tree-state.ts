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
  const hasDomPosition = (child: Item) => child.element?.isConnected === true;
  const domOrdered = logicalOrder.filter(hasDomPosition).sort((a, b) => {
    const comparison = a.element!.compareDocumentPosition(b.element!);
    if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (comparison & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  let domIndex = 0;
  return logicalOrder.map((child) =>
    hasDomPosition(child) ? domOrdered[domIndex++] : child,
  );
}

/** @internal Reconcile one subtree from its committed framework/Vanilla DOM. */
export function reconcileSubtreeState(item: Item, root: Container): void {
  item.rootContainer = root;
  const ordered = committedChildrenInDomOrder(item);
  item.itemOrderedList.splice(0, item.itemOrderedList.length, ...ordered);
  for (const child of ordered) reconcileSubtreeState(child, root);
}

/** @internal Reconcile a complete SnapSort root after a synchronous commit. */
export function reconcileRootTreeState(root: Container): void {
  reconcileSubtreeState(root, root);
}
