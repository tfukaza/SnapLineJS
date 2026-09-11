import type { ElementObject } from "@snap-engine/core";
import type { Rect } from "@snap-engine/core/geometry";

/**
 * @internal Immutable transformed rectangle in world coordinates. Inside a
 * Camera layer, world units are the CSS pixels a `translate` is written in,
 * so deltas between these rects animate correctly at any zoom.
 */
export type VisualRectSnapshot = Rect & {
  readonly coordinateSpace: "world";
};

/** @internal Per-read-stage cache for repeated Item and parent measurements. */
export type VisualRectReadCache = Map<ElementObject, VisualRectSnapshot | null>;

const stagedBeforeMutationRects = new WeakMap<
  ElementObject,
  VisualRectSnapshot | null
>();

/**
 * Read an ElementObject's transformed visual rectangle in world space: the
 * element's current `readDom` box with its own transforms left applied.
 * @internal
 */
export function readVisualRect(
  object: ElementObject,
  cache?: VisualRectReadCache,
): VisualRectSnapshot | null {
  if (cache?.has(object)) return cache.get(object) ?? null;
  if (!object.element?.isConnected) {
    cache?.set(object, null);
    return null;
  }

  const box = object.readDom({ unapplyTransform: false });
  const rectangle: VisualRectSnapshot = Object.freeze({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    coordinateSpace: "world",
  });
  cache?.set(object, rectangle);
  return rectangle;
}

/** @internal Capture a visual rectangle for a later write-stage mutation. */
export function stageVisualRectBeforeMutation(object: ElementObject): void {
  stagedBeforeMutationRects.set(object, readVisualRect(object));
}

/** @internal Consume the rectangle captured before an object's mutation. */
export function consumeStagedVisualRect(
  object: ElementObject,
): VisualRectSnapshot | null {
  const rectangle = stagedBeforeMutationRects.get(object) ?? null;
  stagedBeforeMutationRects.delete(object);
  return rectangle;
}
