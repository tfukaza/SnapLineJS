import type { Container } from "../container";
import type { Item } from "../item";
import {
  determineDropTarget,
  determineInsertionDropTarget,
  determineProgressiveDropTarget,
  determineSwapDropTarget,
  type DropCandidate,
} from "../algorithm";
import type { DragLifecycleStrategy } from "./lifecycle";
import type { DragSession } from "./session";
import { FlowGhostLifecycle } from "./flow-ghost";
import { InsertionMarkerLifecycle } from "./insertion-marker";
import { SwapLifecycle } from "./swap";

export type SortMode = "euclidean" | "progressive" | "insertion" | "swap";

/** Picks a drop candidate (container + index) given the dragged item's current position. */
export interface DropTargetStrategy {
  resolve(
    item: Item,
    root: Container,
    session: DragSession | null,
  ): DropCandidate | null;
}

/** The full pair of behaviors that make up a sort mode: how to resolve drop targets, and how to manage the drag/ghost lifecycle. */
export interface SortStrategy {
  readonly mode: SortMode;
  readonly dropTarget: DropTargetStrategy;
  readonly lifecycle: DragLifecycleStrategy;
}

export const euclideanDropTarget: DropTargetStrategy = {
  resolve: (item, root, session) => determineDropTarget(item, root, session),
};

export const progressiveDropTarget: DropTargetStrategy = {
  resolve: (item, root, session) =>
    determineProgressiveDropTarget(item, root, session),
};

export const insertionDropTarget: DropTargetStrategy = {
  resolve: (item, root, session) =>
    determineInsertionDropTarget(item, root, session),
};

export const swapDropTarget: DropTargetStrategy = {
  resolve: (item, root, session) => determineSwapDropTarget(item, root, session),
};

const flowGhostLifecycle = new FlowGhostLifecycle();
const insertionMarkerLifecycle = new InsertionMarkerLifecycle();
const swapLifecycle = new SwapLifecycle();

export const builtinStrategies: Record<SortMode, SortStrategy> = {
  euclidean: {
    mode: "euclidean",
    dropTarget: euclideanDropTarget,
    lifecycle: flowGhostLifecycle,
  },
  progressive: {
    mode: "progressive",
    dropTarget: progressiveDropTarget,
    lifecycle: flowGhostLifecycle,
  },
  insertion: {
    mode: "insertion",
    dropTarget: insertionDropTarget,
    lifecycle: insertionMarkerLifecycle,
  },
  swap: {
    mode: "swap",
    dropTarget: swapDropTarget,
    lifecycle: swapLifecycle,
  },
};

/**
 * Resolve the SortStrategy for a container. An explicit `strategy` (advanced,
 * for plugging custom drop-target/lifecycle behavior) always wins over `mode`.
 */
export function resolveSortStrategy(
  mode: SortMode | undefined,
  strategy: SortStrategy | undefined,
): SortStrategy {
  return strategy ?? builtinStrategies[mode ?? "euclidean"];
}
