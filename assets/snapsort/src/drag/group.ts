import type { BaseObject, dragStartProp } from "@snap-engine/core";
import { buildDragLocation } from "../event-builders";
import type { DragLocation } from "../events";
import type { Item } from "../item";
import { resolveSortStrategy } from "./drop-strategy";
import { DragSessionController, type DragInputStart } from "./session";
import { installDragSession } from "./session-store";

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
function beginDragSession(
  item: Item,
  start: DragInputStart,
): DragSessionController {
  item.takeRootSnapshot();

  const root = item.rootContainer;
  const group = collectSelectedDragGroup(root as unknown as Item, item);
  const pressedItem = findGroupAnchor(group, item);
  const strategy = resolveSortStrategy(root.config.mode);
  const sources = group.map(sourceFor);

  const session = new DragSessionController(
    root,
    group,
    sources,
    strategy,
    start,
    pressedItem,
  );

  installDragSession(root, session);
  session.begin();

  return session;
}
/** @internal Build, install, and begin a DragSession for an Item gesture. */
export function beginItemDrag(
  item: Item,
  prop: dragStartProp,
): DragSessionController {
  return beginDragSession(item, {
    inputType: "pointer",
    prop,
  });
}

export function beginDirectItemDrag(item: Item): DragSessionController {
  return beginDragSession(item, {
    inputType: "direct",
    initiatingItemId: item.itemId,
  });
}
