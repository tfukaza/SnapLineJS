import type { Container } from "../container";
import { buildDragLocation } from "../event-builders";
import type { DragLocation } from "../events";
import { Item } from "../item";
import { assertPlacementItemIdsUnique } from "./tree-state";

function removeFromOrder(container: Item, item: Item): void {
  const index = container.itemOrderedList.indexOf(item);
  if (index !== -1) container.itemOrderedList.splice(index, 1);
}

/** One proposed Item placement, used to validate a complete mutation first. */
export interface ItemPlacement {
  readonly container: Container;
  readonly item: Item;
}

/** @internal Validate every proposed placement before any Item is mutated. */
export function assertCanPlaceItems(
  placements: readonly ItemPlacement[],
): void {
  for (const { container, item } of placements) {
    container.assertCanPlaceItem(item);
  }
  assertPlacementItemIdsUnique(placements);
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
  assertCanPlaceItems([{ container, item }]);
  placeItemAtUnchecked(container, item, index);
}

/** @internal Attach an Item after its complete placement batch was validated. */
export function placeItemAtUnchecked(
  container: Container,
  item: Item,
  index: number,
): void {
  const currentParent = item.parent instanceof Item ? item.parent : null;
  container.appendChild(item);
  if (currentParent) removeFromOrder(currentParent, item);
  removeFromOrder(container, item);
  item.rootContainer = container.rootContainer;
  const clampedIndex = Math.max(
    0,
    Math.min(index, container.itemOrderedList.length),
  );
  container.itemOrderedList.splice(clampedIndex, 0, item);
}

/** @internal Detach an Item from engine and sortable state without mutating DOM. */
export function detachItem(container: Item, item: Item): void {
  container.removeChild(item);
  removeFromOrder(container, item);
}

/** @internal Permanently unlink an Item and release its root ownership. */
export function releaseItem(item: Item): void {
  const parent = item.parent;
  if (parent instanceof Item) {
    detachItem(parent, item);
  } else if (parent) {
    parent.removeChild(item);
  }
  item.rootContainer = null;
}
