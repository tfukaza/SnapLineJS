import type { Container } from "../container";

export interface MoveProjectionSource {
  readonly container: Container;
  readonly index: number;
}

export interface ItemRunMoveProjection {
  readonly adjustedIndex: number;
  readonly isCurrentPlacement: boolean;
}

/**
 * Project a raw, pre-removal insertion index into the destination's final
 * item space. Sources must be parallel to the ordered item run being moved.
 */
export function projectItemRunMove(
  destination: Container,
  rawIndex: number,
  sources: readonly MoveProjectionSource[],
): ItemRunMoveProjection {
  const removedBefore = sources.filter(
    (source) => source.container === destination && source.index < rawIndex,
  ).length;
  const adjustedIndex = rawIndex - removedBefore;
  const isCurrentPlacement =
    sources.length > 0 &&
    sources.every(
      (source, offset) =>
        source.container === destination &&
        source.index === adjustedIndex + offset,
    );

  return { adjustedIndex, isCurrentPlacement };
}
