import type {
  ContainerCallbacks,
  GhostCreateEvent,
  GhostInsertEvent,
  GhostMoveEvent,
  GhostState,
  GhostRemoveEvent,
  ItemInsertEvent,
  ItemRemoveEvent,
  ItemSwapEvent,
} from "./events";
import type { Container } from "./container";
import {
  insertionMarkerRect,
  stockInsertionMarkerRectOptions,
  toContainerLocalRect,
  type InsertionMarkerRectOptions,
} from "./insertion-geometry";

/** @internal Structural callbacks supported by a renderer adapter. */
export const STRUCTURAL_CALLBACKS = [
  "onItemMove",
  "onItemInsert",
  "onItemRemove",
  "onItemSwap",
  "onGhostInsert",
  "onGhostMove",
  "onGhostRemove",
] as const;

export type SnapSortAdapterCallbacks = Readonly<
  Pick<ContainerCallbacks, (typeof STRUCTURAL_CALLBACKS)[number]>
>;

/**
 * Renderer boundary shared by Vanilla, React, Svelte, and custom adapters.
 * `commit` must invoke its command exactly once before returning, finish the
 * corresponding projection synchronously, and let command errors propagate
 * unchanged. Scheduled commands reach the engine error boundary. The adapter
 * must not retain, retry, or swallow the command.
 */
export interface SnapSortAdapter {
  readonly callbacks: SnapSortAdapterCallbacks;
  readonly commit: (mutation: () => void) => void;
}

export interface CreateVanillaAdapterOptions {
  readonly createGhostElement?: (event: GhostCreateEvent) => HTMLElement;
  readonly insertionMarker?: InsertionMarkerRectOptions;
}

function insertionTarget(
  container: Container,
  beforeElement: HTMLElement | null,
  operation: string,
): HTMLElement {
  const containerElement = container.element;
  if (!containerElement) {
    throw new Error(
      `SnapSort: Vanilla ${operation} requires a bound element for container "${container.name}".`,
    );
  }
  if (beforeElement && beforeElement.parentNode !== containerElement) {
    throw new Error(
      `SnapSort: Vanilla ${operation} requires its beforeElement to belong to container "${container.name}".`,
    );
  }
  return containerElement;
}

function defaultGhostElement(ghost: GhostState): HTMLElement {
  const element = document.createElement("div");
  element.id = "spacer";
  element.style.boxSizing = "border-box";

  if (ghost.type === "source-spacer" || ghost.type === "target-spacer") {
    element.classList.add("ghost");
  } else {
    element.style.position = "absolute";
    element.style.margin = "0";
    element.style.pointerEvents = "none";
    element.style.zIndex = "1000";
    if (ghost.type === "insertion-marker") {
      element.dataset.snapsortGhost = "insertion";
      element.style.border = "0";
      element.style.borderRadius = "999px";
      element.style.background = "currentColor";
      element.style.color = "rgb(37, 99, 235)";
    } else {
      element.dataset.snapsortGhost = "pointer";
      element.style.border = "0";
      element.style.background = "transparent";
    }
  }
  return element;
}

function applyGhostState(
  ghost: GhostState,
  element: HTMLElement,
  insertionMarker: InsertionMarkerRectOptions,
): void {
  if (ghost.type === "insertion-marker") {
    const rect = insertionMarkerRect(ghost, insertionMarker);
    element.style.left = `${rect.x}px`;
    element.style.top = `${rect.y}px`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.zIndex = "999";
    return;
  }

  const rect = ghost.rect;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;

  if (ghost.type === "source-spacer" || ghost.type === "target-spacer") {
    const box =
      ghost.original.dragSnapshot?.box ?? ghost.original.currentDomProperty;
    element.style.margin = `${box.margin.top}px ${box.margin.right}px ${box.margin.bottom}px ${box.margin.left}px`;
    return;
  }

  const localRect = toContainerLocalRect(ghost.rect, ghost.location.container);
  element.style.left = `${localRect.x}px`;
  element.style.top = `${localRect.y}px`;
}

function createVanillaCallbacks(
  createGhostElement: (event: GhostCreateEvent) => HTMLElement,
  insertionMarker: InsertionMarkerRectOptions,
): SnapSortAdapterCallbacks {
  const ensureGhostElement = (ghost: GhostState): HTMLElement => {
    const existing = ghost.ghostItem.element;
    if (existing) return existing;
    const element = createGhostElement({
      operation: "create",
      ghost,
    });
    ghost.ghostItem.element = element;
    return element;
  };

  const insertGhost = (
    ghost: GhostState,
    beforeElement: HTMLElement | null,
  ): void => {
    const containerElement = insertionTarget(
      ghost.location.container,
      beforeElement,
      "ghost insertion",
    );
    const element = ensureGhostElement(ghost);
    applyGhostState(ghost, element, insertionMarker);
    containerElement.insertBefore(element, beforeElement);
  };

  return {
    onItemInsert: (event: ItemInsertEvent) => {
      const containerElement = insertionTarget(
        event.container,
        event.beforeElement,
        "item insertion",
      );
      const elements = event.items.map((item) => {
        const element = item.element;
        if (!element) {
          throw new Error(
            `SnapSort: Vanilla item insertion requires a bound element for item "${item.itemId}".`,
          );
        }
        return element;
      });
      for (const element of elements) {
        containerElement.insertBefore(element, event.beforeElement);
      }
    },
    onItemRemove: (event: ItemRemoveEvent) => {
      for (const item of event.items) item.element?.remove();
    },
    onItemSwap: (event: ItemSwapEvent) => {
      const a = event.a.item.element;
      const b = event.b.item.element;
      if (!a || !b) {
        throw new Error(
          `SnapSort: Vanilla swap requires bound elements for both items "${event.a.itemId}" and "${event.b.itemId}".`,
        );
      }
      if (!a.parentNode || !b.parentNode) {
        throw new Error(
          `SnapSort: Vanilla swap requires mounted parent nodes for both items "${event.a.itemId}" and "${event.b.itemId}".`,
        );
      }
      const aContainerElement = event.a.container.element;
      const bContainerElement = event.b.container.element;
      if (!aContainerElement || !bContainerElement) {
        throw new Error(
          `SnapSort: Vanilla swap requires bound elements for both containers "${event.a.container.name}" and "${event.b.container.name}".`,
        );
      }
      if (
        a.parentNode !== aContainerElement ||
        b.parentNode !== bContainerElement
      ) {
        throw new Error(
          `SnapSort: Vanilla swap requires each item to be mounted in its declared source container.`,
        );
      }
      const aSlot = document.createComment("snapsort-swap-a");
      const bSlot = document.createComment("snapsort-swap-b");
      a.replaceWith(aSlot);
      b.replaceWith(bSlot);
      aSlot.replaceWith(b);
      bSlot.replaceWith(a);
    },
    onGhostInsert: (event: GhostInsertEvent) => {
      insertGhost(event.ghost, event.beforeElement);
    },
    onGhostMove: (event: GhostMoveEvent) => {
      insertGhost(event.ghost, event.beforeElement);
    },
    onGhostRemove: (event: GhostRemoveEvent) => {
      event.ghost.ghostItem.element?.remove();
    },
  };
}

export function createVanillaAdapter(
  options: CreateVanillaAdapterOptions = {},
): SnapSortAdapter {
  const createGhostElement =
    options.createGhostElement ??
    ((event: GhostCreateEvent) => defaultGhostElement(event.ghost));
  const insertionMarker =
    options.insertionMarker ?? stockInsertionMarkerRectOptions;
  return {
    callbacks: createVanillaCallbacks(createGhostElement, insertionMarker),
    commit: (mutation) => mutation(),
  };
}
