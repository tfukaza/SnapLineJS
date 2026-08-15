import type { ElementObject } from "@snap-engine/core";

/** @internal Immutable transformed rectangle in browser viewport coordinates. */
export type VisualRectSnapshot = Readonly<DOMRect> & {
  readonly coordinateSpace: "screen";
};

/** @internal Per-read-stage cache for repeated Item and parent measurements. */
export type VisualRectReadCache = Map<ElementObject, VisualRectSnapshot | null>;

const stagedBeforeMutationRects = new WeakMap<
  ElementObject,
  VisualRectSnapshot | null
>();

/**
 * Read and immediately clone an ElementObject's transformed visual rectangle.
 * Position and dimensions are both expressed in screen pixels. `readDom`
 * retains the browser rectangle's screen origin and visual dimensions even
 * when a Camera maps its world position.
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

  const property = object.readDom({ unapplyTransform: false });
  const rectangle = new DOMRect(
    property.screenX,
    property.screenY,
    property.width,
    property.height,
  ) as VisualRectSnapshot;
  Object.defineProperty(rectangle, "coordinateSpace", {
    configurable: false,
    enumerable: true,
    value: "screen",
    writable: false,
  });
  Object.freeze(rectangle);
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
