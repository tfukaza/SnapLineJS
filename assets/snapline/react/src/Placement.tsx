import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type {
  PlacementController,
  PlacementSnapshot,
} from "@snap-engine/snapline";

export interface PlacementProps<T> {
  controller: PlacementController<T>;
  cancelOnOutside?: boolean;
  cancelOnSecondaryButton?: boolean;
  cancelOnEscape?: boolean;
  children?: (snapshot: PlacementSnapshot<T>) => ReactNode;
}

export function Placement<T>({
  controller,
  cancelOnOutside = true,
  cancelOnSecondaryButton = true,
  cancelOnEscape = true,
  children,
}: PlacementProps<T>) {
  const [snapshot, setSnapshot] = useState(controller.snapshot);
  const latestSnapshotRef = useRef(controller.snapshot);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return controller.onStateChange((next) => {
      const previous = latestSnapshotRef.current;
      latestSnapshotRef.current = next;
      const positionAvailabilityChanged =
        (previous.position === null) !== (next.position === null);
      if (
        previous.active !== next.active ||
        previous.payload !== next.payload ||
        previous.size !== next.size ||
        positionAvailabilityChanged
      ) {
        setSnapshot(next);
      }
    });
  }, [controller]);

  useLayoutEffect(() => {
    return controller.bindGeometryWriter((geometry) => {
      const element = previewRef.current;
      if (!element) return;
      const position = geometry.position;
      element.style.visibility = geometry.visible ? "visible" : "hidden";
      element.style.transform = position
        ? `translate3d(${position.x}px, ${position.y}px, 0)`
        : "translate3d(0px, 0px, 0)";
      if (geometry.size) {
        element.style.width = `${geometry.size.width}px`;
        element.style.height = `${geometry.size.height}px`;
      }
      element.dataset.allowed = String(geometry.allowed);
    });
  }, [controller, snapshot.active]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (controller.snapshot.active) {
        controller.update({ x: event.clientX, y: event.clientY }, event);
      }
    };
    const down = (event: PointerEvent) => {
      if (!controller.snapshot.active) return;
      if (event.button !== 0) {
        if (cancelOnSecondaryButton) {
          event.preventDefault();
          controller.cancel("secondary-button", event);
        }
        return;
      }
      controller.update({ x: event.clientX, y: event.clientY }, event);
      if (controller.commit(event)) {
        event.preventDefault();
        event.stopPropagation();
      } else if (cancelOnOutside) {
        controller.cancel("outside", event);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (cancelOnEscape && event.key === "Escape") {
        controller.cancel("escape", event);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [
    cancelOnEscape,
    cancelOnOutside,
    cancelOnSecondaryButton,
    controller,
  ]);

  return snapshot.active ? (
    <div
      ref={previewRef}
      data-snapline-type="placement-preview"
      data-allowed={String(snapshot.allowed)}
      style={{
        position: "absolute",
        pointerEvents: "none",
        transformOrigin: "top left",
        visibility: snapshot.position ? "visible" : "hidden",
        willChange: "transform",
      }}
    >
      {children?.(snapshot)}
    </div>
  ) : null;
}
