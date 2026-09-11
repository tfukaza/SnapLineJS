/**
 * Shared geometry vocabulary and pure helpers.
 *
 * Every module in core and every asset package describes points, sizes,
 * rectangles, and CSS box models with these types. Nothing in this module
 * reads the DOM or depends on a Camera, so it is safe to use in any frame
 * stage and in Node-side tests.
 *
 * Coordinate spaces are a property of where a value came from, not of its
 * type: an `ElementBox` is world-space except for its explicit `screen` rect,
 * and helpers here never convert between spaces.
 */

/** A 2D point. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A 2D extent. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** An axis-aligned rectangle anchored at its top-left corner. */
export interface Rect extends Point, Size {}

/** A circle anchored at its center. */
export interface Circle extends Point {
  readonly radius: number;
}

/** Per-side thicknesses, matching CSS `margin`/`padding`/`border-width`. */
export interface Edges {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** A rectangle with its edge coordinates precomputed (DOMRect-compatible). */
export interface Bounds extends Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * A CSS box model. The rectangle is the border box; `margin`, `padding`, and
 * `border` are the CSS edge thicknesses around and inside it.
 */
export interface BoxModel extends Rect {
  readonly margin: Edges;
  readonly padding: Edges;
  readonly border: Edges;
}

/**
 * A measured element box.
 *
 * The border-box rectangle and edges are world-space (inside a Camera layer,
 * one world unit is one CSS pixel). `screen` is the element's transformed
 * viewport rectangle in CSS pixels, exactly as `getBoundingClientRect()`
 * reports it.
 */
export interface ElementBox extends BoxModel {
  readonly screen: Rect;
}

/** A pointer location resolved in world, camera, and screen space. */
export interface PointerPosition extends Point {
  readonly camera: Point;
  readonly screen: Point;
}

/** A rectangle axis name. */
export type Axis = "x" | "y";

/** A rectangle dimension name. */
export type Dimension = "width" | "height";

/** Zero thickness on every side. */
export const ZERO_EDGES: Edges = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

// ---------------------------------------------------------------------------
// Allocation-free scalar kernels shared with the collision engine.
// ---------------------------------------------------------------------------

/** @internal Edge-inclusive point containment against scalar bounds. */
export function pointIntersectsBounds(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): boolean {
  return x >= left && x <= right && y >= top && y <= bottom;
}

/** @internal Positive-overlap intersection of two scalar bounds. */
export function rectBoundsIntersect(
  aLeft: number,
  aTop: number,
  aRight: number,
  aBottom: number,
  bLeft: number,
  bTop: number,
  bRight: number,
  bBottom: number,
): boolean {
  return (
    aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop
  );
}

/** @internal Edge-inclusive point/circle containment on scalars. */
export function pointIntersectsCircleValues(
  pointX: number,
  pointY: number,
  circleX: number,
  circleY: number,
  radius: number,
): boolean {
  if (radius < 0) return false;
  const deltaX = pointX - circleX;
  const deltaY = pointY - circleY;
  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
}

/** @internal Edge-inclusive circle tangency on scalars. */
export function circlesIntersectValues(
  aX: number,
  aY: number,
  aRadius: number,
  bX: number,
  bY: number,
  bRadius: number,
): boolean {
  return pointIntersectsCircleValues(aX, aY, bX, bY, aRadius + bRadius);
}

/** @internal Edge-inclusive rectangle/circle tangency on scalars. */
export function rectBoundsIntersectCircle(
  left: number,
  top: number,
  right: number,
  bottom: number,
  circleX: number,
  circleY: number,
  radius: number,
): boolean {
  const nearestX = Math.max(left, Math.min(circleX, right));
  const nearestY = Math.max(top, Math.min(circleY, bottom));
  return pointIntersectsCircleValues(
    nearestX,
    nearestY,
    circleX,
    circleY,
    radius,
  );
}

// ---------------------------------------------------------------------------
// Predicates and measures.
// ---------------------------------------------------------------------------

/** Point/rectangle collision with edge-inclusive containment. */
export function pointIntersectsRect(point: Point, rect: Rect): boolean {
  return pointIntersectsBounds(
    point.x,
    point.y,
    rect.x,
    rect.y,
    rect.x + rect.width,
    rect.y + rect.height,
  );
}

/** Point/circle collision with edge-inclusive containment. */
export function pointIntersectsCircle(point: Point, circle: Circle): boolean {
  return pointIntersectsCircleValues(
    point.x,
    point.y,
    circle.x,
    circle.y,
    circle.radius,
  );
}

/** Circle collision with edge-inclusive tangency. */
export function circlesIntersect(a: Circle, b: Circle): boolean {
  return circlesIntersectValues(a.x, a.y, a.radius, b.x, b.y, b.radius);
}

/** Rectangle/circle collision with edge-inclusive tangency. */
export function rectIntersectsCircle(rect: Rect, circle: Circle): boolean {
  return rectBoundsIntersectCircle(
    rect.x,
    rect.y,
    rect.x + rect.width,
    rect.y + rect.height,
    circle.x,
    circle.y,
    circle.radius,
  );
}

/** Rectangle collision requiring positive overlap; touching edges do not collide. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return rectBoundsIntersect(
    a.x,
    a.y,
    a.x + a.width,
    a.y + a.height,
    b.x,
    b.y,
    b.x + b.width,
    b.y + b.height,
  );
}

/** Whether `inner` lies entirely inside `outer`, edges inclusive. */
export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Euclidean distance from a point to a rectangle; zero inside its bounds. */
export function distanceToRect(point: Point, rect: Rect): number {
  if (pointIntersectsRect(point, rect)) return 0;
  const x = Math.max(rect.x, Math.min(point.x, rect.x + rect.width));
  const y = Math.max(rect.y, Math.min(point.y, rect.y + rect.height));
  return Math.hypot(point.x - x, point.y - y);
}

/** The center point of a rectangle. */
export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** The area of a rectangle. */
export function rectArea(rect: Size): number {
  return rect.width * rect.height;
}

/**
 * Whether two rectangles match within `tolerance` on every component.
 * The default tolerance of zero requires exact equality.
 */
export function rectsEqual(a: Rect, b: Rect, tolerance = 0): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  );
}

// ---------------------------------------------------------------------------
// Construction and mapping.
// ---------------------------------------------------------------------------

/** A frozen copy holding only the rectangle fields of `rect`. */
export function freezeRect(rect: Rect): Rect {
  return Object.freeze({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
}

/** A frozen `Bounds` for `rect`, with edge coordinates precomputed. */
export function boundsOf(rect: Rect): Bounds {
  return Object.freeze({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
  });
}

/** The smallest rectangle containing every rectangle, or `null` when empty. */
export function boundingRect(rects: Iterable<Rect>): Rect | null {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  if (left === Infinity) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** `rect` moved by `(dx, dy)`. */
export function translateRect(rect: Rect, dx: number, dy: number): Rect {
  return {
    x: rect.x + dx,
    y: rect.y + dy,
    width: rect.width,
    height: rect.height,
  };
}

/** Linear interpolation between two rectangles; `t = 0` is `from`. */
export function lerpRect(from: Rect, to: Rect, t: number): Rect {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

/**
 * Map `rect` from the `from` frame into the `to` frame.
 *
 * The frames' size ratio scales position and size; a degenerate (zero-size)
 * `from` axis maps with scale 1 so the result stays finite.
 */
export function projectRect(rect: Rect, from: Rect, to: Rect): Rect {
  const scaleX = from.width > 0 ? to.width / from.width : 1;
  const scaleY = from.height > 0 ? to.height / from.height : 1;
  return {
    x: to.x + (rect.x - from.x) * scaleX,
    y: to.y + (rect.y - from.y) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

/** Map every rectangle from the `from` frame into the `to` frame. */
export function projectRects(
  rects: readonly Rect[],
  from: Rect,
  to: Rect,
): Rect[] {
  return rects.map((rect) => projectRect(rect, from, to));
}

// ---------------------------------------------------------------------------
// Box model.
// ---------------------------------------------------------------------------

/** The per-side sum of two edge sets. */
export function addEdges(a: Edges, b: Edges): Edges {
  return {
    top: a.top + b.top,
    right: a.right + b.right,
    bottom: a.bottom + b.bottom,
    left: a.left + b.left,
  };
}

/** `rect` shrunk by `edges`; the resulting size is clamped at zero. */
export function insetRect(rect: Rect, edges: Edges): Rect {
  return {
    x: rect.x + edges.left,
    y: rect.y + edges.top,
    width: Math.max(0, rect.width - edges.left - edges.right),
    height: Math.max(0, rect.height - edges.top - edges.bottom),
  };
}

/** `rect` grown by `edges`. */
export function outsetRect(rect: Rect, edges: Edges): Rect {
  return {
    x: rect.x - edges.left,
    y: rect.y - edges.top,
    width: rect.width + edges.left + edges.right,
    height: rect.height + edges.top + edges.bottom,
  };
}

/** Offset of the content box's top-left corner from the border box's. */
export function contentOffset(box: BoxModel): Point {
  return {
    x: box.border.left + box.padding.left,
    y: box.border.top + box.padding.top,
  };
}

/** The padding box: the border box inset by the border. */
export function paddingRect(box: BoxModel): Rect {
  return insetRect(box, box.border);
}

/** The content box: the border box inset by border and padding. */
export function contentRect(box: BoxModel): Rect {
  return insetRect(box, addEdges(box.border, box.padding));
}

/** The margin box: the border box grown by the margin. */
export function marginRect(box: BoxModel): Rect {
  return outsetRect(box, box.margin);
}

/** CSS shorthand (`"1px 2px 3px 4px"`) for an edge set. */
export function edgesToCss(edges: Edges): string {
  return `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`;
}
