import { Item } from "./item";
import type {
  ContainerCallbacks,
  VisualGeometryInvalidationReason,
} from "./events";
import { defaultCallbacks } from "./mutation";
import type { LayoutMainAxisAlign } from "./layout";
import type { LayoutWrap } from "./snapshot";
import type { SortMode, SortStrategy } from "./drag/drop-strategy";
import type { DragSession } from "./drag/session";

export interface AnimationConfig {
  timing_function?: string;
  duration?: number;
}

export interface ContainerAnimations {
  reorder?: AnimationConfig | null;
  drop?: AnimationConfig | null;
  clickMove?: AnimationConfig | null;
}

export interface ContainerConfig {
  /**
   * @internal DOM structure is owned either by the core Vanilla defaults or
   * by a framework adapter. Framework adapters set this unconditionally so
   * omitted callbacks can never fall through to direct DOM mutation.
   */
  domOwnership?: "core" | "framework";
  /** Which built-in drop-target/lifecycle strategy pair to use for this tree. Default `"euclidean"`. */
  mode?: SortMode;
  /** Advanced: a custom strategy pair, overriding `mode`. Lets consumers plug in their own drop-target resolution and/or drag lifecycle. */
  strategy?: SortStrategy;
  groupID?: string;
  /** Main layout direction. Default `"column"`. */
  direction?: "column" | "row";
  mainAxisAlign?: LayoutMainAxisAlign;
  /** `"nowrap"`: this list never wraps, it just keeps growing along its main axis. Default `"auto"` (inferred from measurements). */
  wrap?: LayoutWrap;
  /** Entries fill this container's cross axis (width in column lists, height in row lists) minus their own margins — CSS `align-items: stretch` analogy. Keeps drop previews sized to THIS container when items are dragged in from larger/smaller ones. */
  stretchItems?: boolean;
  name?: string;
  animation?: ContainerAnimations | null;
  disableFlip?: boolean;
  noDrop?: boolean;
  dropArea?: boolean;
  callbacks?: ContainerCallbacks;
}

const defaultConfig: ContainerConfig = {
  domOwnership: "core",
  mode: "euclidean",
  groupID: "default-group",
  direction: "column",
  animation: {
    reorder: { duration: 100, timing_function: "ease-out" },
    drop: { duration: 100, timing_function: "ease-out" },
    clickMove: { duration: 100, timing_function: "ease-out" },
  },
  noDrop: false,
  callbacks: defaultCallbacks,
};

export class Container extends Item {
  #config: ContainerConfig;
  #depth: number = 0;
  #itemList: Item[] = [];
  #visualInvalidationItems = new Set<Item>();
  #visualInvalidationReasons = new Set<VisualGeometryInvalidationReason>();

  /** The in-progress drag session for this tree, or null when nothing is being dragged. Only meaningful on the root container. */
  dragSession: DragSession | null = null;

  constructor(engine: any, parent: Container | null, config?: ContainerConfig) {
    super(engine, parent);
    this.locked = true;
    const domOwnership = config?.domOwnership ?? defaultConfig.domOwnership;
    this.#config = {
      ...defaultConfig,
      ...(config || {}),
      domOwnership,
      callbacks:
        domOwnership === "framework"
          ? { ...(config?.callbacks || {}) }
          : {
              ...defaultConfig.callbacks,
              ...(config?.callbacks || {}),
            },
    };

    if (!this.#config.name) {
      if (!this.global.data["dragAndDropContainerCounter"]) {
        this.global.data["dragAndDropContainerCounter"] = 0;
      }
      this.#config.name = `container-${this.global.data["dragAndDropContainerCounter"]++}`;
    }

    this.style = {
      position: "relative",
    };

    if (!this.global.data["dragAndDropContainers"]) {
      this.global.data["dragAndDropContainers"] = [];
    }
    this.global.data["dragAndDropContainers"].push(this);
  }

  get groupID() {
    return this.#config.groupID;
  }

  /** @internal */
  get domOwnership() {
    return this.#config.domOwnership ?? "core";
  }

  get name() {
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

  get dropArea() {
    return this.#config.dropArea ?? false;
  }

  set dropArea(value: boolean) {
    this.#config.dropArea = value;
  }

  get mode(): SortMode {
    return this.#config.mode ?? "euclidean";
  }

  set mode(value: SortMode) {
    this.#config.mode = value;
  }

  get configuration() {
    return this.#config;
  }

  get callbacks() {
    return this.#config.callbacks;
  }

  /**
   * Queue one coalesced notification that rendered item geometry may have
   * changed. This is a low-level integration seam, not a DOM mutation hook.
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
    // Always publish in the next read phase. Most invalidations originate in
    // WRITE_3; enqueueing another WRITE_3 task from inside that stage can
    // replace a task whose slot was already visited and lose the final visual
    // position. READ_1 also gives integrations a safe point to enqueue their
    // own geometry reads for the same frame.
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
        this.callbacks?.onVisualGeometryInvalidated?.(event);
      },
      {
        stage: "READ_1",
        queueId: `${this.id}-visual-geometry-invalidated`,
      },
    );
  }

  get itemList() {
    return this.#itemList;
  }

  get numberOfItems() {
    return this.#itemList.length;
  }

  get depth() {
    return this.#depth;
  }

  get config() {
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
