import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from "react";
import type { GhostInsertEvent } from "@snap-engine/snapsort";

export interface GhostProps extends HTMLAttributes<HTMLDivElement> {
  event: GhostInsertEvent;
}

export const Ghost = forwardRef<HTMLDivElement, GhostProps>(function Ghost(
  { children, className = "", event, id = "spacer", style, ...divProps },
  ref,
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const original = event.original.dragSnapshot?.box ?? event.original.currentDomProperty;
  const ghostItem = event.ghostItem;
  const width = event.ghostRect?.width ?? original.width;
  const height = event.ghostRect?.height ?? original.height;
  const container =
    event.container.dragSnapshot?.box ?? event.container.currentDomProperty;
  const insetLeft = event.ghostRect?.insetLeft ?? 0;
  const insetRight = event.ghostRect?.insetRight ?? 0;
  const marker = event.kind === "marker";
  const left =
    (event.ghostRect?.x ?? original.x) -
    container.x +
    (event.role === "pointer" ? 0 : insetLeft);
  const top = (event.ghostRect?.y ?? original.y) - container.y;

  useImperativeHandle(ref, () => elementRef.current as HTMLDivElement, []);

  const bindGhostElement = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      if (element) {
        ghostItem.element = element;
      } else if (ghostItem.element) {
        ghostItem.destroyDom(false);
      }
    },
    [ghostItem],
  );

  return (
    <div
      {...divProps}
      id={id}
      className={className}
      data-snapsort-ghost={
        event.role === "pointer" ? "pointer" : marker ? "insertion" : undefined
      }
      data-snapsort-ghost-entry={event.kind}
      ref={bindGhostElement}
      style={{
        boxSizing: "border-box",
        background:
          marker && event.role !== "pointer" ? "currentColor" : undefined,
        borderRadius:
          marker && event.role !== "pointer" ? "999px" : undefined,
        borderTop:
          marker && event.role !== "pointer"
            ? "3px solid currentColor"
            : undefined,
        color:
          marker && event.role !== "pointer" ? "rgb(37, 99, 235)" : undefined,
        height: marker && event.role !== "pointer" ? 0 : height,
        left: marker ? left : undefined,
        margin: marker
          ? 0
          : `${original.margin.top}px ${original.margin.right}px ${original.margin.bottom}px ${original.margin.left}px`,
        pointerEvents: marker ? "none" : undefined,
        position: marker ? "absolute" : undefined,
        top: marker ? top : undefined,
        width: marker ? Math.max(0, width - insetLeft - insetRight) : width,
        zIndex: marker ? 1000 : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
});
