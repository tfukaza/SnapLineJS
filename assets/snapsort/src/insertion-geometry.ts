import { rectsEqual, type Rect } from "@snap-engine/core/geometry";
import type { Container } from "./container";
import type {
  InsertionGapSegment,
  InsertionMarkerNeighbor,
  InsertionMarkerPresentation,
  InsertionMarkerState,
} from "./events";

/** Explicit presentation choices for turning an insertion gap into a line. */
export interface InsertionMarkerRectOptions {
  readonly thickness: number;
  readonly startInset: number;
  readonly endInset: number;
}

/**
 * SnapSort's explicit built-in marker visual contract. This is renderer
 * presentation, not insertion-algorithm geometry or an implicit helper default.
 */
export const stockInsertionMarkerRectOptions: InsertionMarkerRectOptions =
  Object.freeze({
    thickness: 3,
    startInset: 0,
    endInset: 0,
  });

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`SnapSort: ${name} must be finite.`);
  }
}

function assertFiniteNonnegative(name: string, value: number): void {
  assertFinite(name, value);
  if (value < 0) {
    throw new RangeError(`SnapSort: ${name} must be non-negative.`);
  }
}

function insetGap(
  gap: InsertionGapSegment,
  startInset: number,
  endInset: number,
): { readonly start: number; readonly length: number } {
  if (startInset + endInset > gap.length) {
    throw new RangeError(
      "SnapSort: startInset + endInset must not exceed marker.gap.length.",
    );
  }
  return { start: startInset, length: gap.length - startInset - endInset };
}

function sameInsertionNeighbor(
  a: InsertionMarkerNeighbor | null,
  b: InsertionMarkerNeighbor | null,
): boolean {
  if (a === b) return true;
  return (
    a !== null &&
    b !== null &&
    a.item === b.item &&
    a.itemId === b.itemId &&
    a.itemMetadata === b.itemMetadata &&
    rectsEqual(a.rect, b.rect)
  );
}

// Internal single source of truth for insertion-marker visual equality.
export function sameInsertionMarkerPresentation(
  a: InsertionMarkerPresentation,
  b: InsertionMarkerPresentation,
): boolean {
  return (
    a.gap.orientation === b.gap.orientation &&
    a.gap.x === b.gap.x &&
    a.gap.y === b.gap.y &&
    a.gap.length === b.gap.length &&
    a.isCurrentPlacement === b.isCurrentPlacement &&
    sameInsertionNeighbor(a.previous, b.previous) &&
    sameInsertionNeighbor(a.next, b.next)
  );
}

/**
 * Convert a world-space rectangle into a Container's positioned local space:
 * relative to its padding-box outer edge, including its scroll offset.
 */
export function toContainerLocalRect(
  worldRect: Rect,
  container: Container,
): Rect {
  const element = container.element;
  if (!element) {
    throw new Error(
      `SnapSort: toContainerLocalRect requires a mounted element for container "${container.name}".`,
    );
  }
  const containerBox =
    container.dragSnapshot?.box ?? container.box;

  return Object.freeze({
    x:
      worldRect.x -
      containerBox.x -
      containerBox.border.left +
      element.scrollLeft,
    y:
      worldRect.y -
      containerBox.y -
      containerBox.border.top +
      element.scrollTop,
    width: worldRect.width,
    height: worldRect.height,
  });
}

/**
 * Expand a marker's zero-thickness world-space gap into a rectangle positioned
 * relative to the marker's destination Container.
 */
export function insertionMarkerRect(
  marker: InsertionMarkerState,
  options: InsertionMarkerRectOptions,
): Rect {
  assertFiniteNonnegative("thickness", options.thickness);
  assertFiniteNonnegative("startInset", options.startInset);
  assertFiniteNonnegative("endInset", options.endInset);

  const gap = marker.gap;
  if (gap.orientation !== "horizontal" && gap.orientation !== "vertical") {
    throw new TypeError(
      'SnapSort: marker.gap.orientation must be "horizontal" or "vertical".',
    );
  }
  assertFinite("marker.gap.x", gap.x);
  assertFinite("marker.gap.y", gap.y);
  assertFiniteNonnegative("marker.gap.length", gap.length);

  const inset = insetGap(gap, options.startInset, options.endInset);
  const worldRect =
    gap.orientation === "horizontal"
      ? {
          x: gap.x + inset.start,
          y: gap.y - options.thickness / 2,
          width: inset.length,
          height: options.thickness,
        }
      : {
          x: gap.x - options.thickness / 2,
          y: gap.y + inset.start,
          width: options.thickness,
          height: inset.length,
        };

  return toContainerLocalRect(worldRect, marker.location.container);
}
