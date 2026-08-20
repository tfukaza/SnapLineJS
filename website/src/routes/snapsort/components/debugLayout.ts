import type { DomProperty, Engine as SnapEngine } from "@snap-engine/core";
import type {
  Container as ContainerType,
  Item as ItemType,
  ItemSnapshot,
} from "@snap-engine/snapsort";

export type DebugRectKind = "snapshot" | "content" | "live";

export type DebugOverlayRect = {
  id: string;
  kind: DebugRectKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  isContainer: boolean;
};

function isFiniteRect(rect: Pick<DebugOverlayRect, "x" | "y" | "width" | "height">) {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function boxToViewportRect(box: DomProperty) {
  return {
    x: box.screenX,
    y: box.screenY,
    width: box.width,
    height: box.height,
  };
}

function contentViewportRect(box: DomProperty) {
  return {
    x: box.screenX + box.border.left + box.padding.left,
    y: box.screenY + box.border.top + box.padding.top,
    width: Math.max(
      0,
      box.width - box.border.left - box.border.right - box.padding.left - box.padding.right,
    ),
    height: Math.max(
      0,
      box.height - box.border.top - box.border.bottom - box.padding.top - box.padding.bottom,
    ),
  };
}

function liveViewportRect(element: HTMLElement | null) {
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function debugLabel(item: ItemType, snapshot: ItemSnapshot<ItemType> | null) {
  return snapshot?.itemId ?? item.itemId;
}

function addDebugRect(
  rects: DebugOverlayRect[],
  rect: Omit<DebugOverlayRect, "id">,
  id: string,
) {
  if (!isFiniteRect(rect)) return;
  rects.push({ ...rect, id });
}

function snapSortRootsFor(engine: SnapEngine | null) {
  const containers = engine?.global?.data?.dragAndDropContainers;
  if (!Array.isArray(containers)) return [];

  return containers.filter(
    (container): container is ContainerType =>
      container?.engine === engine &&
      container?.element instanceof HTMLElement &&
      container.rootContainer === container,
  );
}

export function collectDebugRects(
  entries: Array<{ engine: SnapEngine | null; id: string }>,
): DebugOverlayRect[] {
  const rects: DebugOverlayRect[] = [];
  const visited = new Set<ItemType>();

  for (const entry of entries) {
    for (const root of snapSortRootsFor(entry.engine)) {
      if (!root.dragSnapshot) continue;
      collectItemDebugRects(root, entry.id, rects, visited, 0);
    }
  }

  return rects;
}

function collectItemDebugRects(
  item: ItemType,
  engineId: string,
  rects: DebugOverlayRect[],
  visited: Set<ItemType>,
  depth: number,
) {
  if (visited.has(item)) return;
  visited.add(item);

  const snapshot = item.dragSnapshot;
  const isContainer = "config" in item;
  const label = debugLabel(item, snapshot);

  if (snapshot) {
    addDebugRect(
      rects,
      {
        ...boxToViewportRect(snapshot.box),
        kind: "snapshot",
        label,
        depth,
        isContainer,
      },
      `${engineId}-${item.id}-snapshot`,
    );

    if (isContainer) {
      addDebugRect(
        rects,
        {
          ...contentViewportRect(snapshot.box),
          kind: "content",
          label,
          depth,
          isContainer: true,
        },
        `${engineId}-${item.id}-content`,
      );
    }
  }

  const liveRect = liveViewportRect(item.element);
  if (liveRect) {
    addDebugRect(
      rects,
      {
        ...liveRect,
        kind: "live",
        label,
        depth,
        isContainer,
      },
      `${engineId}-${item.id}-live`,
    );
  }

  const children = snapshot?.children.map((child) => child.value) ?? item.itemOrderedList;
  for (const child of children) {
    collectItemDebugRects(child, engineId, rects, visited, depth + 1);
  }
}
