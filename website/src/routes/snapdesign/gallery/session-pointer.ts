import type { DragSession } from "@snap-engine/snapsort";

/**
 * The pointer driving a drag session, or null when there is no session or it
 * is driven by keyboard/direct input. Lets the autoplay demos tell their
 * virtual pointer's drags apart from a visitor taking over.
 */
export function sessionPointerId(
  session: DragSession | null | undefined,
): number | null {
  return session?.input.inputType === "pointer"
    ? session.input.pointerId
    : null;
}
