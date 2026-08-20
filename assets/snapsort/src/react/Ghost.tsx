import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from "react";
import {
  insertionMarkerRect,
  stockInsertionMarkerRectOptions,
  toContainerLocalRect,
  type GhostState,
  type InsertionMarkerRectOptions,
} from "@snap-engine/snapsort";

export interface GhostProps extends HTMLAttributes<HTMLDivElement> {
  ghost: GhostState;
  insertionMarker?: InsertionMarkerRectOptions;
}

export const Ghost = forwardRef<HTMLDivElement, GhostProps>(function Ghost(
  {
    children,
    className = "",
    ghost,
    id = "spacer",
    insertionMarker,
    style,
    ...divProps
  },
  ref,
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const original =
    ghost.original.dragSnapshot?.box ?? ghost.original.currentDomProperty;
  const ghostItem = ghost.ghostItem;
  const rect =
    ghost.type === "insertion-marker"
      ? insertionMarkerRect(
          ghost,
          insertionMarker ?? stockInsertionMarkerRectOptions,
        )
      : ghost.type === "pointer-preview"
        ? toContainerLocalRect(ghost.rect, ghost.location.container)
        : ghost.rect;
  const overlay =
    ghost.type === "insertion-marker" || ghost.type === "pointer-preview";
  const marker = ghost.type === "insertion-marker";

  useImperativeHandle(ref, () => {
    const element = elementRef.current;
    if (!element) {
      throw new Error("SnapSort Ghost: the element is not mounted.");
    }
    return element;
  }, []);

  const bindGhostElement = useCallback(
    (element: HTMLDivElement | null) => {
      const previousElement = elementRef.current;
      elementRef.current = element;
      if (element) {
        ghostItem.element = element;
      } else if (previousElement) {
        ghostItem.detachElement(previousElement);
      }
    },
    [ghostItem],
  );

  return (
    <div
      {...divProps}
      id={id}
      className={`snapsort-ghost ${className}`.trim()}
      data-snapsort-ghost={
        ghost.type === "pointer-preview"
          ? "pointer"
          : marker
            ? "insertion"
            : undefined
      }
      data-snapsort-ghost-entry={ghost.type}
      data-snapsort-ghost-item-count={ghost.items.length}
      ref={bindGhostElement}
      style={{
        boxSizing: "border-box",
        background: marker ? "currentColor" : undefined,
        border: marker ? 0 : undefined,
        borderRadius: marker ? "999px" : undefined,
        color: marker ? "rgb(37, 99, 235)" : undefined,
        height: rect.height,
        left: overlay ? rect.x : undefined,
        margin: overlay
          ? 0
          : `${original.margin.top}px ${original.margin.right}px ${original.margin.bottom}px ${original.margin.left}px`,
        pointerEvents: overlay ? "none" : undefined,
        position: overlay ? "absolute" : undefined,
        top: overlay ? rect.y : undefined,
        width: rect.width,
        zIndex: overlay ? 1000 : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
});
