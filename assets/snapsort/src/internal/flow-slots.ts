import type { GhostState } from "../events";

export type FlowSpacerState = Extract<
  GhostState,
  { type: "source-spacer" | "target-spacer" }
>;

/** @internal True when a Ghost occupies one position in flow layout. */
export function isFlowSpacerState(
  state: GhostState | null | undefined,
): state is FlowSpacerState {
  return state?.type === "source-spacer" || state?.type === "target-spacer";
}

/**
 * @internal Count flow positions before one entry. A missing boundary denotes
 * the end, which lets stale snapshot boundaries clamp to the live list end.
 */
export function flowSlotBeforeEntry<Entry>(
  entries: readonly Entry[],
  beforeEntry: Entry | null,
  occupiesFlowSlot: (entry: Entry) => boolean,
): number {
  let slotIndex = 0;
  for (const entry of entries) {
    if (entry === beforeEntry) return slotIndex;
    if (occupiesFlowSlot(entry)) slotIndex += 1;
  }
  return slotIndex;
}

/**
 * @internal Translate a flow position into its raw iterable position in one pass.
 * Non-flow entries at the boundary stay before the insertion, preserving the
 * application order of dragged values that a framework keeps rendered.
 */
export function rawIndexForFlowSlot<Entry>(
  entries: Iterable<Entry>,
  slotIndex: number,
  occupiesFlowSlot: (entry: Entry) => boolean,
): number | null {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) return null;

  let currentSlot = 0;
  let rawIndex = 0;
  for (const entry of entries) {
    if (occupiesFlowSlot(entry)) {
      if (currentSlot === slotIndex) return rawIndex;
      currentSlot += 1;
    }
    rawIndex += 1;
  }
  return currentSlot === slotIndex ? rawIndex : null;
}
