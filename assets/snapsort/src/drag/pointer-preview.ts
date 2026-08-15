import type { GhostRect } from "../events";
import {
  assertCanFireGhostInsert,
  assertCanFireGhostRemove,
  fireGhostInsert,
  fireGhostRemove,
  settleMutation,
} from "../mutation";
import type { DragSession } from "./session";
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
    const box = item.dragSnapshot?.box;
    if (!box) continue;
    const start = session.dragVisualStart.get(item) ?? {
      x: box.x,
      y: box.y,
    };
    left = Math.min(left, start.x);
    top = Math.min(top, start.y);
    right = Math.max(right, start.x + box.width);
    bottom = Math.max(bottom, start.y + box.height);
  }

  if (!Number.isFinite(left)) {
    const item = session.primaryItem;
    const box = item.dragSnapshot?.box ?? item.currentDomProperty;
    left = box.x;
    top = box.y;
    right = box.x + box.width;
    bottom = box.y + box.height;
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
  const group = frozenGroupGeometry(session);
  return {
    x: group.x + session.pointer.x - session.start.x,
    y: group.y + session.pointer.y - session.start.y,
    width: group.width,
    height: group.height,
  };
}

/** @internal Validate the root-owned pointer-preview integration. */
export function validatePointerPreview(session: DragSession): void {
  assertCanFireGhostInsert(session.root);
  assertCanFireGhostRemove(session.root);
}

/** @internal Create the one root-owned pointer Ghost for this session. */
export async function startPointerPreview(session: DragSession): Promise<void> {
  if (session.ghosts.has("pointer") || !session.root.element) return;
  validatePointerPreview(session);

  const rect = pointerPreviewRect(session);
  const ghost = session.primaryItem.createGhostItem(
    session,
    "marker",
    session.root,
    rect,
    "pointer",
  );
  if (!ghost) return;
  ghost.rootContainer = session.root;
  session.ghosts.set("pointer", ghost);
  fireGhostInsert(
    session.root,
    session.primaryItem,
    ghost,
    -1,
    null,
    rect,
    session,
    "marker",
    "pointer",
  );
  await settleMutation();
  updatePointerPreview(session);
}

/** @internal Move/upsert the root-owned pointer Ghost. */
export function updatePointerPreview(session: DragSession): void {
  const ghost = session.ghosts.get("pointer");
  const element = ghost?.element;
  if (!ghost || !element) return;

  const rect = pointerPreviewRect(session);
  if (ghost.frameworkManagedGhostElement) {
    fireGhostInsert(
      session.root,
      session.primaryItem,
      ghost,
      -1,
      null,
      rect,
      session,
      "marker",
      "pointer",
    );
    session.root.invalidateVisualGeometry(session.items, "drag");
    return;
  }

  // TODO: Needs to be a callback
  const rootBox =
    session.root.dragSnapshot?.box ?? session.root.currentDomProperty;
  element.dataset.snapsortGhost = "pointer";
  element.style.position = "absolute";
  element.style.left = `${rect.x - rootBox.x}px`;
  element.style.top = `${rect.y - rootBox.y}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
  element.style.margin = "0";
  element.style.border = "0";
  element.style.background = "transparent";
  element.style.pointerEvents = "none";
  element.style.zIndex = "1000";
  session.root.invalidateVisualGeometry(session.items, "drag");
}

/** @internal Remove the root-owned pointer Ghost without touching app Items. */
export async function removePointerPreview(
  session: DragSession,
): Promise<void> {
  const ghost = session.ghosts.get("pointer");
  if (!ghost) return;
  fireGhostRemove(
    session.root,
    session.primaryItem,
    ghost,
    session,
    "marker",
    "pointer",
  );
  await settleMutation();
  ghost.destroy(!ghost.frameworkManagedGhostElement);
  session.ghosts.delete("pointer");
}

/**
 * @internal Capture a first rectangle per dragged member from the one group
 * preview. The mapping preserves each member's frozen position and size.
 */
export function pointerPreviewMemberRects(
  session: DragSession,
): Array<DOMRect | null> {
  const previewItem = session.ghosts.get("pointer");
  const preview = previewItem ? readVisualRect(previewItem) : null;
  if (!preview) return session.items.map(() => null);

  const group = frozenGroupGeometry(session);
  const scaleX = group.width > 0 ? preview.width / group.width : 1;
  const scaleY = group.height > 0 ? preview.height / group.height : 1;
  return session.items.map((item) => {
    const box = item.dragSnapshot?.box;
    if (!box) return null;
    const start = session.dragVisualStart.get(item) ?? {
      x: box.x,
      y: box.y,
    };
    return new DOMRect(
      preview.left + (start.x - group.x) * scaleX,
      preview.top + (start.y - group.y) * scaleY,
      box.width * scaleX,
      box.height * scaleY,
    );
  });
}
