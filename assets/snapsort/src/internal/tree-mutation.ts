import type { Container } from "../container";
import { buildDragLocation } from "../event-builders";
import type { DragLocation } from "../events";
import { Item } from "../item";

function removeFromOrder(container: Container, item: Item): void {
  const index = container.itemOrderedList.indexOf(item);
  if (index !== -1) container.itemOrderedList.splice(index, 1);
}

/** @internal Resolve an Item's current live sortable location. */
export function itemLocation(item: Item): DragLocation | null {
  if (!(item.parent instanceof Item)) return null;
  const container = item.parent as Container;
  const index = container.itemOrderedList.indexOf(item);
  return index === -1 ? null : buildDragLocation(container, index);
}

/** @internal Resolve the committed element following an inserted run. */
export function elementAfterRun(
  container: Container,
  index: number,
  length: number,
): HTMLElement | null {
  return container.itemOrderedList[index + length]?.element ?? null;
}

/** @internal Attach an Item in engine and sortable state without mutating DOM. */
export function placeItemAt(
  container: Container,
  item: Item,
  index: number,
): void {
  const currentParent = item.parent instanceof Item ? item.parent : null;
  container.appendChild(item);
  if (currentParent) removeFromOrder(currentParent as Container, item);
  removeFromOrder(container, item);
  item.rootContainer = container.rootContainer;
  const clampedIndex = Math.max(
    0,
    Math.min(index, container.itemOrderedList.length),
  );
  container.itemOrderedList.splice(clampedIndex, 0, item);
}

/** @internal Detach an Item from engine and sortable state without mutating DOM. */
export function detachItem(container: Container, item: Item): void {
  container.removeChild(item);
  removeFromOrder(container, item);
}
