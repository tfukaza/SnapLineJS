import { useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    const previousOnChange = controller.callbacks.onChange;
    const onChange = (next: PlacementSnapshot<T>) => {
      setSnapshot(next);
      previousOnChange?.(next);
    };
    setSnapshot(controller.snapshot);
    controller.callbacks.onChange = onChange;
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
      if (controller.callbacks.onChange === onChange) {
        controller.callbacks.onChange = previousOnChange;
      }
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

  return snapshot.active ? children?.(snapshot) : null;
}
