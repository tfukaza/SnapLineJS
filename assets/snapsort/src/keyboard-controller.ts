import type { keyDownProp } from "@snap-engine/core";
import type { Container } from "./container";
import { Item } from "./item";
import type { DragSessionController } from "./drag/session";
import type { DirectDragController } from "./drag/direct-controller";
import { getDragSessionController } from "./drag/session-store";

export interface KeyboardDragBindings {
  readonly liftDrop?: readonly string[];
  readonly cancel?: readonly string[];
  readonly previous?: Readonly<{
    column?: readonly string[];
    row?: readonly string[];
  }>;
  readonly next?: Readonly<{
    column?: readonly string[];
    row?: readonly string[];
  }>;
}

export interface KeyboardDragControllerOptions {
  readonly bindings?: KeyboardDragBindings;
}

interface ResolvedKeyboardDragBindings {
  readonly liftDrop: ReadonlySet<string>;
  readonly cancel: ReadonlySet<string>;
  readonly previous: Readonly<{
    column: ReadonlySet<string>;
    row: ReadonlySet<string>;
  }>;
  readonly next: Readonly<{
    column: ReadonlySet<string>;
    row: ReadonlySet<string>;
  }>;
}

const defaultBindings = Object.freeze({
  liftDrop: Object.freeze(["Enter"]),
  cancel: Object.freeze(["Escape"]),
  previous: Object.freeze({
    column: Object.freeze(["ArrowUp"]),
    row: Object.freeze(["ArrowLeft"]),
  }),
  next: Object.freeze({
    column: Object.freeze(["ArrowDown"]),
    row: Object.freeze(["ArrowRight"]),
  }),
});

function resolveBindings(
  bindings: KeyboardDragBindings | undefined,
): ResolvedKeyboardDragBindings {
  return Object.freeze({
    liftDrop: new Set(bindings?.liftDrop ?? defaultBindings.liftDrop),
    cancel: new Set(bindings?.cancel ?? defaultBindings.cancel),
    previous: Object.freeze({
      column: new Set(
        bindings?.previous?.column ?? defaultBindings.previous.column,
      ),
      row: new Set(bindings?.previous?.row ?? defaultBindings.previous.row),
    }),
    next: Object.freeze({
      column: new Set(bindings?.next?.column ?? defaultBindings.next.column),
      row: new Set(bindings?.next?.row ?? defaultBindings.next.row),
    }),
  });
}

function hasCommandModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

/** Adds conventional keyboard operation to direct SnapSort drag sessions. */
export class KeyboardDragController {
  readonly root: Container;
  readonly #bindings: ResolvedKeyboardDragBindings;

  #installedCallback: ((prop: keyDownProp) => void) | null = null;
  #startedSession: DragSessionController | null = null;
  #destroyed = false;

  constructor(root: Container, options: KeyboardDragControllerOptions = {}) {
    if (root.rootContainer !== root || root.isDeleteRequested) {
      throw new Error(
        "KeyboardDragController: root must be a live SnapSort root container.",
      );
    }
    if (root.event.hasGlobalCallback("keyDown")) {
      throw new Error(
        "KeyboardDragController: the root keyDown callback is already in use.",
      );
    }

    this.root = root;
    this.#bindings = resolveBindings(options.bindings);
    root.event.global.keyDown = this.#onKeyDown;
    this.#installedCallback = root.event.globalCallback("keyDown");
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;

    const session = getDragSessionController(this.root);
    if (
      session &&
      session === this.#startedSession &&
      session.input.inputType === "direct" &&
      session.phase !== "ended"
    ) {
      if (session.phase === "pending") {
        session.cancel();
      } else {
        session.input.cancel();
      }
    }

    if (
      this.#installedCallback &&
      this.root.event.globalCallback("keyDown") === this.#installedCallback
    ) {
      this.root.event.global.keyDown = null;
    }

    this.#installedCallback = null;
    this.#startedSession = null;
  }

  #focusedItem(prop: keyDownProp): Item | null {
    const focusedObject = prop.focusedObject;

    if (
      !(focusedObject instanceof Item) ||
      focusedObject.rootContainer !== this.root ||
      prop.event.target !== focusedObject.inputElement
    ) {
      return null;
    }

    return focusedObject;
  }

  #onKeyDown = (prop: keyDownProp): void => {
    if (
      this.#destroyed ||
      prop.event.defaultPrevented ||
      prop.event.isComposing
    ) {
      return;
    }

    const session = getDragSessionController(this.root);

    if (prop.event.key === "Tab" && session?.input.inputType === "direct") {
      session.input.suppressFocusRestoration();
      if (session.phase === "pending") {
        session.cancel();
      } else {
        session.input.cancel();
      }
      return;
    }

    if (hasCommandModifier(prop.event)) return;

    const focusedItem = this.#focusedItem(prop);
    if (!focusedItem) return;

    if (session) {
      if (session.input.inputType !== "direct") return;
      this.#handleActiveDirectSession(prop.event, session.input);
      return;
    }

    if (
      prop.event.repeat ||
      !this.#bindings.liftDrop.has(prop.event.key) ||
      focusedItem.locked
    ) {
      return;
    }

    const publicSession = focusedItem.beginDirectDrag();
    const startedSession = getDragSessionController(this.root);

    if (!publicSession || !startedSession) return;
    this.#startedSession = startedSession;
    prop.event.preventDefault();
  };

  #isMovementKey(key: string): boolean {
    const { previous, next } = this.#bindings;
    return (
      previous.column.has(key) ||
      previous.row.has(key) ||
      next.column.has(key) ||
      next.row.has(key)
    );
  }

  #handleActiveDirectSession(
    event: KeyboardEvent,
    input: DirectDragController,
  ): void {
    if (this.#bindings.liftDrop.has(event.key)) {
      if (!event.repeat && input.drop()) event.preventDefault();
      return;
    }

    if (this.#bindings.cancel.has(event.key)) {
      if (!event.repeat && input.cancel()) event.preventDefault();
      return;
    }

    const direction = input.currentTarget?.container.direction;
    if (!direction) {
      // The lift is still activating, so there is no target to move from
      // yet. Consume movement keys anyway: otherwise an arrow pressed right
      // after lifting falls through to the browser and scrolls the page.
      if (this.#isMovementKey(event.key)) event.preventDefault();
      return;
    }

    if (this.#bindings.previous[direction].has(event.key)) {
      input.movePrevious();
      event.preventDefault();
      return;
    }

    if (this.#bindings.next[direction].has(event.key)) {
      input.moveNext();
      event.preventDefault();
    }
  }
}
