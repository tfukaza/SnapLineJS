import type { BaseObject, Engine } from "@snap-engine/core";
import { Item, type ItemOptions } from "./item";
import type {
  ContainerCallbacks,
  VisualGeometryInvalidationReason,
} from "./events";
import type { LayoutMainAxisAlign } from "./layout";
import type { LayoutWrap } from "./snapshot";
import type { SortMode } from "./drag/drop-strategy";
import type { DragSession } from "./drag/session";
import { getDragSession } from "./drag/session-store";
import {
  createVanillaAdapter,
  STRUCTURAL_CALLBACKS,
  type SnapSortAdapter,
} from "./adapter";

export interface AnimationConfig {
  timing_function?: string;
  duration?: number;
}

export interface ContainerAnimations {
  reorder?: AnimationConfig | null;
  drop?: AnimationConfig | null;
  move?: AnimationConfig | null;
}

export const defaultAnimations: ContainerAnimations = {
  reorder: { duration: 100, timing_function: "ease-out" },
  drop: { duration: 100, timing_function: "ease-out" },
  move: { duration: 100, timing_function: "ease-out" },
};

export interface ContainerConfig {
  /** Which built-in drop-target/lifecycle strategy pair to use for this tree. Default `"euclidean"`. */
  mode?: SortMode;
  /** Main layout direction. Default `"column"`. */
  direction?: "column" | "row";
  mainAxisAlign?: LayoutMainAxisAlign;
  /** `"nowrap"`: this list never wraps, it just keeps growing along its main axis. Default `"auto"` (inferred from measurements). */
  wrap?: LayoutWrap;
  /** Entries fill this container's cross axis (width in column lists, height in row lists) minus their own margins — CSS `align-items: stretch` analogy. Keeps drop previews sized to THIS container when items are dragged in from larger/smaller ones. */
  stretchItems?: boolean;
  name?: string;
  animation?: ContainerAnimations | null;
  /** Base destination policy: `-1` rejects; nonnegative values rank candidates. Default `0`. */
  dropPriority?: number;
  /** Callbacks owned by this container instance. See `ContainerCallbacks` for dispatch ownership. */
  callbacks?: Readonly<ContainerCallbacks>;
}

/** Construction-only options, including the root-scoped renderer adapter. */
export interface ContainerOptions extends ContainerConfig, ItemOptions {
  readonly adapter?: SnapSortAdapter;
}

/** Live container configuration; callbacks use the controlled `callbacks` property instead. */
export type ContainerRuntimeConfig = Omit<ContainerConfig, "callbacks">;

const defaultConfig: ContainerRuntimeConfig = {
  mode: "euclidean",
  direction: "column",
  dropPriority: 0,
};

const ROOT_DISPATCHED_CALLBACKS = [
  ...STRUCTURAL_CALLBACKS,
  "onDragStart",
  "onDragEnd",
  "onDropTargetChange",
  "onVisualGeometryInvalidated",
] as const satisfies readonly (keyof ContainerCallbacks)[];

const EMPTY_CALLBACKS: Readonly<ContainerCallbacks> = Object.freeze({});

function assertNoRootDispatchedCallbacks(
  callbacks: Readonly<ContainerCallbacks>,
  containerName: string,
): void {
  for (const name of ROOT_DISPATCHED_CALLBACKS) {
    if (callbacks[name] !== undefined) {
      throw new Error(
        `SnapSort: callbacks.${name} is root-dispatched; register it on the root container, not on "${containerName}".`,
      );
    }
  }
}

function freezeCallbacks(
  callbacks: Readonly<ContainerCallbacks>,
): Readonly<ContainerCallbacks> {
  return Object.freeze({ ...callbacks });
}

type ResolvedContainerRuntimeConfig = ContainerRuntimeConfig & {
  name: string;
};

export class Container extends Item {
  #config: ResolvedContainerRuntimeConfig;
  #callbacks: Readonly<ContainerCallbacks> = EMPTY_CALLBACKS;
  readonly #adapter: SnapSortAdapter;
  #mutationDepth = 0;
  #visualInvalidationItems = new Set<Item>();
  #visualInvalidationReasons = new Set<VisualGeometryInvalidationReason>();

  /** The read-only public handle for this tree's in-progress drag, or null. Only meaningful on the root container. */
  get dragSession(): DragSession | null {
    return this.rootContainer === this ? getDragSession(this) : null;
  }

  constructor(
    engine: Engine,
    parent: Container | null,
    options: ContainerOptions,
  ) {
    const inheritedAdapter = parent?.adapter;
    if (
      inheritedAdapter &&
      options?.adapter &&
      options.adapter !== inheritedAdapter
    ) {
      throw new Error(
        "SnapSort: every Container in one root must share the same adapter object.",
      );
    }
    const callbacks = freezeCallbacks(options?.callbacks ?? EMPTY_CALLBACKS);
    if (parent) {
      assertNoRootDispatchedCallbacks(
        callbacks,
        options?.name ?? "a descendant container",
      );
    }

    super(engine, parent, { itemId: options?.itemId });
    this.locked = true;
    this.#adapter =
      inheritedAdapter ?? options?.adapter ?? createVanillaAdapter();

    let name = options?.name;
    if (!name) {
      if (!this.global.data["dragAndDropContainerCounter"]) {
        this.global.data["dragAndDropContainerCounter"] = 0;
      }
      name = `container-${this.global.data["dragAndDropContainerCounter"]++}`;
    }

    this.#config = {
      mode: options?.mode ?? defaultConfig.mode,
      direction: options?.direction ?? defaultConfig.direction,
      mainAxisAlign: options?.mainAxisAlign,
      wrap: options?.wrap,
      stretchItems: options?.stretchItems,
      name,
      animation: options?.animation,
      dropPriority: options?.dropPriority ?? defaultConfig.dropPriority,
    };
    Object.seal(this.#config);
    this.#callbacks = callbacks;

    this.style = {
      position: "relative",
    };

    if (!this.global.data["dragAndDropContainers"]) {
      this.global.data["dragAndDropContainers"] = [];
    }
    this.global.data["dragAndDropContainers"].push(this);
  }

  get adapter(): SnapSortAdapter {
    return this.#adapter;
  }

  /** @internal Validate root and adapter ownership before an Item is placed. */
  assertCanPlaceItem(item: Item): void {
    if (item.engine !== this.engine) {
      throw new Error("SnapSort: Items cannot move between Engines.");
    }

    if (item === this) {
      throw new Error("An object cannot be parented to itself.");
    }
    let ancestor: BaseObject | null = this.parent;
    while (ancestor) {
      if (ancestor === item) {
        throw new Error("An object cannot be parented to one of its children.");
      }
      ancestor = ancestor.parent;
    }

    const root = this.rootContainer;
    if (item.rootContainer !== item && item.rootContainer !== root) {
      throw new Error("SnapSort: Items cannot move between independent roots.");
    }
    this.#assertSubtreeOwnership(item, root.adapter);
  }

  #assertSubtreeOwnership(object: BaseObject, adapter: SnapSortAdapter): void {
    if (object.engine !== this.engine) {
      throw new Error("SnapSort: Items cannot move between Engines.");
    }
    if (object instanceof Container && object.adapter !== adapter) {
      throw new Error(
        "SnapSort: every Container in one root must share the same adapter object.",
      );
    }
    if (object instanceof Container) {
      assertNoRootDispatchedCallbacks(object.callbacks, object.name);
    }
    for (const child of object.children) {
      this.#assertSubtreeOwnership(child, adapter);
    }
  }

  /** @internal Run ordered representation work in this root's commit domain. */
  commitMutation(mutation: () => void): void {
    const root = this.rootContainer;
    if (root !== this) {
      root.commitMutation(mutation);
      return;
    }
    if (this.#mutationDepth > 0) {
      mutation();
      return;
    }
    let calls = 0;
    let acceptingMutation = true;
    try {
      this.#adapter.commit(() => {
        if (!acceptingMutation) {
          throw new Error(
            "SnapSort: an adapter cannot invoke a retained mutation after commit returns.",
          );
        }
        calls += 1;
        if (calls > 1) {
          throw new Error(
            "SnapSort: an adapter must invoke its mutation exactly once.",
          );
        }
        this.#mutationDepth += 1;
        try {
          mutation();
        } finally {
          this.#mutationDepth -= 1;
        }
      });
    } finally {
      acceptingMutation = false;
    }
    if (calls === 0) {
      throw new Error(
        "SnapSort: an adapter must invoke its mutation synchronously.",
      );
    }
    if (calls > 1) {
      throw new Error(
        "SnapSort: an adapter must invoke its mutation exactly once.",
      );
    }
  }

  get name(): string {
    return this.#config.name;
  }

  get direction() {
    return this.#config.direction || "column";
  }

  set direction(value: "column" | "row") {
    this.#config.direction = value;
  }

  get mainAxisAlign() {
    return this.#config.mainAxisAlign ?? "start";
  }

  set mainAxisAlign(value: LayoutMainAxisAlign) {
    this.#config.mainAxisAlign = value;
  }

  get wrap() {
    return this.#config.wrap ?? "auto";
  }

  set wrap(value: LayoutWrap) {
    this.#config.wrap = value;
  }

  get stretchItems() {
    return this.#config.stretchItems ?? false;
  }

  set stretchItems(value: boolean) {
    this.#config.stretchItems = value;
  }

  get dropPriority() {
    return this.#config.dropPriority ?? 0;
  }

  set dropPriority(value: number) {
    this.#config.dropPriority = value;
  }

  get mode(): SortMode {
    return this.#config.mode ?? "euclidean";
  }

  set mode(value: SortMode) {
    this.#config.mode = value;
  }

  get callbacks(): Readonly<ContainerCallbacks> {
    return this.#callbacks;
  }

  set callbacks(value: Readonly<ContainerCallbacks>) {
    const callbacks = freezeCallbacks(value);
    if (this.rootContainer !== this) {
      assertNoRootDispatchedCallbacks(callbacks, this.name);
    }
    this.#callbacks = callbacks;
  }

  /**
   * Queue one coalesced notification that rendered item geometry may have
   * changed. This is a low-level adapter seam, not a DOM mutation hook.
   * @internal
   */
  invalidateVisualGeometry(
    items: Iterable<Item>,
    reason: VisualGeometryInvalidationReason,
  ): void {
    const root = this.rootContainer;
    if (root !== this) {
      root.invalidateVisualGeometry(items, reason);
      return;
    }

    for (const item of items) {
      if (!item.isGhost) this.#visualInvalidationItems.add(item);
    }
    this.#visualInvalidationReasons.add(reason);
    // Always publish at the geometry-read-safe READ_1 adapter boundary.
    // Stage queues are swapped before draining, so work scheduled into the
    // active stage is retained for the next frame. The stable queueId keeps
    // repeated invalidations coalesced until that READ_1 delivery.
    this.schedule(
      () => {
        if (
          this.#visualInvalidationItems.size === 0 ||
          this.#visualInvalidationReasons.size === 0
        ) {
          return;
        }
        const event = {
          root: this,
          session: this.dragSession,
          items: [...this.#visualInvalidationItems],
          reasons: [...this.#visualInvalidationReasons],
        };
        this.#visualInvalidationItems.clear();
        this.#visualInvalidationReasons.clear();
        this.callbacks.onVisualGeometryInvalidated?.(event);
      },
      {
        stage: "READ_1",
        queueId: `${this.id}-visual-geometry-invalidated`,
      },
    );
  }

  get itemList() {
    return this.itemOrderedList.filter((item) => !item.isGhost);
  }

  get numberOfItems() {
    return this.itemList.length;
  }

  get config(): ContainerRuntimeConfig {
    return this.#config;
  }

  destroy(removeElement: boolean = true) {
    if (this.global.data["dragAndDropContainers"]) {
      this.global.data["dragAndDropContainers"] = this.global.data[
        "dragAndDropContainers"
      ].filter((c: Container) => c !== this);
    }
    super.destroy(removeElement);
  }
}
