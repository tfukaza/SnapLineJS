import type { Container } from "../container";
import type { DragSession, DragSessionController } from "./session";

const controllers = new WeakMap<Container, DragSessionController>();

/** @internal */
export function getDragSessionController(
  root: Container,
): DragSessionController | null {
  return controllers.get(root) ?? null;
}

/** @internal */
export function getDragSession(root: Container): DragSession | null {
  return getDragSessionController(root)?.handle ?? null;
}

/** @internal */
export function installDragSession(
  root: Container,
  controller: DragSessionController,
): void {
  controllers.set(root, controller);
}

/** @internal */
export function clearDragSession(
  root: Container,
  controller: DragSessionController,
): void {
  if (controllers.get(root) === controller) controllers.delete(root);
}
