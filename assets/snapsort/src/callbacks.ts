import {
  distanceToRect,
  pointIntersectsRect,
  rectsIntersect,
} from "@snap-engine/core/collision";
import type { CanDropEvent, DropPriorityEvent } from "./events";

/** Prefer the destination whose frozen border box contains the pointer. */
export function prioritizePointerContainer(
  event: DropPriorityEvent,
): number | undefined {
  return pointIntersectsRect(event.pointer, event.containerRect)
    ? 1
    : undefined;
}

/** Prefer destinations intersecting the primary dragged item's rectangle. */
export function prioritizeIntersectingContainer(
  event: DropPriorityEvent,
): number | undefined {
  return rectsIntersect(event.containerRect, event.dragRect) ? 1 : undefined;
}

/**
 * Prefer the destination nearest to the pointer. Points inside a destination
 * score `0`; outside points score the negative distance to its border box.
 */
export function prioritizeNearestContainerEdge(
  event: DropPriorityEvent,
): number {
  return -distanceToRect(event.pointer, event.containerRect);
}

/** Reject every drag for a destination container. */
export function rejectDrop(_event: CanDropEvent): false {
  return false;
}
