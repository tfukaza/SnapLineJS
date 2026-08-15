import type { BaseObject, dragStartProp } from "@snap-engine/core";
import type { Container } from "../container";
import { buildDragLocation } from "../event-builders";
import type { DragLocation } from "../events";
import type { Item } from "../item";
import { resolveSortStrategy } from "./drop-strategy";
import { DragSession } from "./session";

/** @internal Gather the consumer-selected drag run in logical document order. */
export function collectSelectedDragGroup(root: Item, pressed: Item): Item[] {
  if (!pressed.selected) return [pressed];

  const group: Item[] = [];
  const visit = (node: Item) => {
    for (const child of node.itemOrderedList) {
      if (child.isGhost || child.locked) continue;
      if (child.selected) {
        group.push(child);
        continue;
      }
      visit(child);
    }
  };
  visit(root);
  return group.length > 0 ? group : [pressed];
}

/** @internal Find the nearest selected ancestor that should anchor the pointer. */
export function findGroupAnchor(group: Item[], pressed: Item): Item {
  let current: BaseObject | null = pressed;
  while (current) {
    const selected = group.find((item) => item === current);
    if (selected) return selected;
    current = current.parent;
  }
  return pressed;
}

function sourceFor(item: Item): DragLocation {
  const { container, index } = item.getIndexAndContainer();
  if (!container) throw new Error("Item has no parent container");
  return buildDragLocation(container, index);
}

/** @internal Build, install, and begin a DragSession for an Item gesture. */
export function beginItemDrag(item: Item, prop: dragStartProp): DragSession {
  item.takeRootSnapshot();
  const root = item.rootContainer;
  const group = collectSelectedDragGroup(root as unknown as Item, item);
  const pressedItem = findGroupAnchor(group, item);
  const strategy = resolveSortStrategy(root.config.mode);
  const sources = group.map(sourceFor);
  const session = new DragSession(
    root as Container,
    group,
    sources,
    strategy,
    prop,
    pressedItem,
  );
  root.dragSession = session;
  session.begin(prop);
  return session;
}
