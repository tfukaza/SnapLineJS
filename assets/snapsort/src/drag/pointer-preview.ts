import {
  boundingRect,
  freezeRect,
  projectRects,
  translateRect,
  type Rect,
} from "@snap-engine/core/geometry";
import { buildGhostOverlayLocation, updateGhostState } from "../event-builders";
import { toContainerLocalRect } from "../insertion-geometry";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  fireGhostInsert,
  settleMutation,
} from "../mutation";
import type { DragSessionController as DragSession } from "./session";
import { readVisualRect } from "../internal/visual-rect";

/** The dragged members' frozen start rectangles, as one bounding rect. */
function frozenGroupGeometry(session: DragSession): Rect {
  return (
    boundingRect(session.startMemberRects()) ?? {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }
  );
}

/** @internal Current world-space rectangle of the single group preview. */
export function pointerPreviewRect(session: DragSession): Rect {
  if (session.input.inputType === "direct") {
    const directRect = session.input.visualGroupRect;
    if (directRect) return freezeRect(directRect);
  }

  return translateRect(
    frozenGroupGeometry(session),
    session.visualPointer.x - session.visualStart.x,
    session.visualPointer.y - session.visualStart.y,
  );
}

/** @internal Validate the root-owned pointer-preview adapter contract. */
export function validatePointerPreview(session: DragSession): void {
  assertCanFireGhostInsert(session.root);
  assertCanFireGhostRemove(session.root);
}

/** @internal Create the one root-owned pointer Ghost for this session. */
export async function startPointerPreview(session: DragSession): Promise<void> {
  if (session.ghostsByChannel.has("pointer")) return;
  if (!session.root.element) {
    throw new Error(
      "SnapSort: the root must be mounted before creating a pointer preview.",
    );
  }
  validatePointerPreview(session);
  if (!session.root.dragSnapshot) {
    throw new Error(
      "SnapSort: pointer preview requires a captured root drag layout.",
    );
  }

  const rect = pointerPreviewRect(session);
  const ghost = session.primaryItem.createGhostItem(session, {
    type: "pointer-preview",
    location: buildGhostOverlayLocation(session.root),
    rect,
  });
  session.ghostsByChannel.set("pointer", ghost);
  fireGhostInsert(ghost, null);
  await settleMutation();
  updatePointerPreview(session);
}

/** @internal Move/upsert the root-owned pointer Ghost. */
export function updatePointerPreview(session: DragSession): void {
  const ghost = session.ghostsByChannel.get("pointer");
  const element = ghost?.element;
  if (!ghost || !element) return;

  const rect = pointerPreviewRect(session);
  const previous = ghost.ghostState;
  if (!previous || previous.type !== "pointer-preview") {
    throw new Error(
      "SnapSort: the pointer ghost must retain pointer-preview state.",
    );
  }
  const state = updateGhostState(previous, {
    type: "pointer-preview",
    location: previous.location,
    rect,
  });
  ghost.ghostState = state;

  // Pointer motion is engine-owned visual geometry, not a structural ghost
  // move. Keep it out of adapter commits and update the mounted visual only.
  const localRect = toContainerLocalRect(rect, session.root);
  element.style.left = `${localRect.x}px`;
  element.style.top = `${localRect.y}px`;
  element.style.width = `${localRect.width}px`;
  element.style.height = `${localRect.height}px`;
  session.root.invalidateVisualGeometry(session.items, "drag");
}

/** @internal Remove the root-owned pointer Ghost without touching app Items. */
export async function removePointerPreview(
  session: DragSession,
): Promise<void> {
  const ghost = session.ghostsByChannel.get("pointer");
  if (!ghost) return;
  ghost.removeGhost();
  await settleMutation();
  ghost.destroy(false);
  session.ghostsByChannel.delete("pointer");
}

/**
 * @internal Capture a first rectangle per dragged member from the one group
 * preview. The mapping preserves each member's frozen position and size.
 */
export function pointerPreviewMemberRects(
  session: DragSession,
): Array<Rect | null> {
  const previewItem = session.ghostsByChannel.get("pointer");
  const preview = previewItem ? readVisualRect(previewItem) : null;
  if (!preview) return session.items.map(() => null);

  const directGroup =
    session.input.inputType === "direct" ? session.input.visualGroupRect : null;
  const group = directGroup ?? frozenGroupGeometry(session);
  const startRects = session.startMemberRects();
  const memberRects = session.items.map(
    (item, index) =>
      (session.input.inputType === "direct"
        ? session.input.visualRectFor(item.itemId)
        : null) ?? startRects[index],
  );
  return projectRects(memberRects, group, preview);
}
