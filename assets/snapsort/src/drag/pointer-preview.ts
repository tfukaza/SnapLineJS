import { projectRect, type Rect } from "@snap-engine/core/geometry";
import type { GhostRect } from "../events";
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

interface GroupGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

function frozenGroupGeometry(session: DragSession): GroupGeometry {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const item of session.items) {
    const box = session.dragBoxFor(item);
    const start = session.dragVisualStart.get(item);
    if (!start) {
      throw new Error(
        `SnapSort: participant "${item.itemId}" has no captured visual start.`,
      );
    }
    left = Math.min(left, start.x);
    top = Math.min(top, start.y);
    right = Math.max(right, start.x + box.width);
    bottom = Math.max(bottom, start.y + box.height);
  }

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/** @internal Current world-space rectangle of the single group preview. */
export function pointerPreviewRect(session: DragSession): GhostRect {
  if (session.input.inputType === "direct") {
    const directRect = session.input.visualGroupRect;
    if (directRect) {
      return {
        x: directRect.x,
        y: directRect.y,
        width: directRect.width,
        height: directRect.height,
      };
    }
  }

  const group = frozenGroupGeometry(session);
  return {
    x: group.x + session.visualPointer.x - session.visualStart.x,
    y: group.y + session.visualPointer.y - session.visualStart.y,
    width: group.width,
    height: group.height,
  };
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
  return session.items.map((item) => {
    const directRect =
      session.input.inputType === "direct"
        ? session.input.visualRectFor(item.itemId)
        : null;
    const box = directRect ?? session.dragBoxFor(item);
    const start = directRect ?? session.dragVisualStart.get(item);
    if (!start) {
      throw new Error(
        `SnapSort: participant "${item.itemId}" has no captured visual start.`,
      );
    }
    return projectRect(
      { x: start.x, y: start.y, width: box.width, height: box.height },
      group,
      preview,
    );
  });
}
