import type {
  InsertionMarkerRectOptions,
  InsertionMarkerNeighbor,
  InsertionMarkerState,
} from "@snap-engine/snapsort";

const markerThickness = 3;

type AxisBounds = { start: number; end: number };
type MarkerGeometry = Pick<InsertionMarkerState, "gap"> & {
  previous: Pick<InsertionMarkerNeighbor, "rect"> | null;
  next: Pick<InsertionMarkerNeighbor, "rect"> | null;
};

function gapBounds(marker: MarkerGeometry): AxisBounds {
  const start =
    marker.gap.orientation === "horizontal" ? marker.gap.x : marker.gap.y;
  return { start, end: start + marker.gap.length };
}

function neighborBounds(marker: MarkerGeometry): AxisBounds[] {
  return [marker.previous, marker.next].flatMap((neighbor) => {
    if (!neighbor) return [];
    const { rect } = neighbor;
    return marker.gap.orientation === "horizontal"
      ? [{ start: rect.x, end: rect.x + rect.width }]
      : [{ start: rect.y, end: rect.y + rect.height }];
  });
}

/** Fit a tree marker to the shared cross-axis span of its adjacent items. */
export function insertionTreeMarkerOptions(
  marker: MarkerGeometry,
): InsertionMarkerRectOptions {
  const gap = gapBounds(marker);
  const neighbors = neighborBounds(marker);
  if (neighbors.length === 0) {
    return { thickness: markerThickness, startInset: 0, endInset: 0 };
  }

  const start = Math.max(gap.start, ...neighbors.map((bounds) => bounds.start));
  const end = Math.min(gap.end, ...neighbors.map((bounds) => bounds.end));
  if (start >= end) {
    return { thickness: markerThickness, startInset: 0, endInset: 0 };
  }

  const startInset = Math.min(
    marker.gap.length,
    Math.max(0, start - gap.start),
  );
  const endInset = Math.min(
    marker.gap.length - startInset,
    Math.max(0, gap.end - end),
  );
  return {
    thickness: markerThickness,
    startInset,
    endInset,
  };
}
