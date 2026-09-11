import {
  distanceToRect,
  pointIntersectsRect,
  rectsIntersect,
} from "@snap-engine/core/geometry";
import { DROP_REJECT_PRIORITY, type DropPriorityEvent } from "./events";

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
 * Prefer the destination nearest to the pointer on a nonnegative scale.
 * Points inside score `1`; scores approach `0` as distance increases.
 */
export function prioritizeNearestContainerEdge(
  event: DropPriorityEvent,
): number {
  return 1 / (1 + distanceToRect(event.pointer, event.containerRect));
}

/**
 * Prefer the deepest vertical-tree destination containing the virtual dragged
 * item's leading x edge at the pointer's current y position.
 */
export function prioritizeTreeDepth(event: DropPriorityEvent): number {
  const virtualProbe = { x: event.dragRect.x, y: event.pointer.y };
  return pointIntersectsRect(virtualProbe, event.containerRect)
    ? event.depth + 1
    : event.staticPriority;
}

/** Reject every drag for a destination container. */
export function rejectDrop(
  _event: DropPriorityEvent,
): typeof DROP_REJECT_PRIORITY {
  return DROP_REJECT_PRIORITY;
}
