import type { Point, Size } from "@snap-engine/core/geometry";
import type { GeometryWriter } from "./types";

export interface PlacementSnapshot<T> {
  active: boolean;
  payload: T | null;
  screen: Point | null;
  world: Point | null;
  position: Point | null;
  size: Size | null;
  anchor: Point;
  allowed: boolean;
}

export interface PlacementGeometrySnapshot {
  readonly active: boolean;
  readonly visible: boolean;
  readonly screen: Point | null;
  readonly world: Point | null;
  readonly position: Point | null;
  readonly size: Size | null;
  readonly allowed: boolean;
}

export interface PlacementEvent<T> extends PlacementSnapshot<T> {
  payload: T;
  screen: Point;
  world: Point;
  position: Point;
  size: Size;
  originalEvent?: PointerEvent | KeyboardEvent;
}

export interface PlacementCancelEvent<T> {
  controller: PlacementController<T>;
  payload: T;
  reason: "cancel" | "escape" | "secondary-button" | "outside";
  originalEvent?: PointerEvent | KeyboardEvent;
}

export interface PlacementCallbacks<T> {
  canPlace?: (event: PlacementEvent<T>) => boolean;
  onPreview?: (event: PlacementEvent<T>) => void;
  onCommit?: (event: PlacementEvent<T>) => void;
  onCancel?: (event: PlacementCancelEvent<T>) => void;
  onChange?: (snapshot: PlacementSnapshot<T>) => void;
}

export interface PlacementConfig<T> {
  screenToWorld: (screen: Point) => Point | null;
  callbacks?: PlacementCallbacks<T>;
  anchor?: Point;
}

/**
 * Framework-agnostic placement state machine. It neither creates nodes nor
 * listens to the DOM: adapters feed it pointer positions and consumers decide
 * whether a surface is valid and what a committed payload means.
 */
export class PlacementController<T> {
  #config: PlacementConfig<T>;
  #callbacks: PlacementCallbacks<T>;
  #snapshot: PlacementSnapshot<T>;
  #geometryWriter: GeometryWriter<PlacementGeometrySnapshot> | null = null;
  #stateCallbacks = new Set<(snapshot: PlacementSnapshot<T>) => void>();

  constructor(config: PlacementConfig<T>) {
    this.#config = config;
    this.#callbacks = config.callbacks ?? {};
    this.#snapshot = {
      active: false,
      payload: null,
      screen: null,
      world: null,
      position: null,
      size: null,
      anchor: config.anchor ?? { x: 0.5, y: 0.5 },
      allowed: false,
    };
  }

  get snapshot(): PlacementSnapshot<T> {
    return this.#snapshot;
  }

  get callbacks(): PlacementCallbacks<T> {
    return this.#callbacks;
  }

  bindGeometryWriter(
    writer: GeometryWriter<PlacementGeometrySnapshot>,
  ): () => void {
    this.#geometryWriter = writer;
    writer(this.#geometrySnapshot());
    return () => {
      if (this.#geometryWriter === writer) this.#geometryWriter = null;
    };
  }

  onStateChange(
    callback: (snapshot: PlacementSnapshot<T>) => void,
  ): () => void {
    this.#stateCallbacks.add(callback);
    callback(this.#snapshot);
    return () => this.#stateCallbacks.delete(callback);
  }

  begin(
    payload: T,
    size: Size,
    options: { anchor?: Point; screen?: Point } = {},
  ): void {
    this.#snapshot = {
      active: true,
      payload,
      screen: null,
      world: null,
      position: null,
      size,
      anchor: options.anchor ?? this.#config.anchor ?? { x: 0.5, y: 0.5 },
      allowed: false,
    };
    this.#emitChange();
    if (options.screen) this.update(options.screen);
  }

  update(screen: Point, originalEvent?: PointerEvent): boolean {
    const current = this.#snapshot;
    if (!current.active || current.payload == null || current.size == null) {
      return false;
    }
    const world = this.#config.screenToWorld(screen);
    if (!world) return false;
    const position = {
      x: world.x - current.size.width * current.anchor.x,
      y: world.y - current.size.height * current.anchor.y,
    };
    const base = {
      ...current,
      screen,
      world,
      position,
      allowed: true,
    };
    const event = this.#event(base, originalEvent);
    const allowed = this.callbacks.canPlace?.(event) !== false;
    this.#snapshot = { ...base, allowed };
    const finalEvent = this.#event(this.#snapshot, originalEvent);
    this.callbacks.onPreview?.(finalEvent);
    this.#emitChange();
    return allowed;
  }

  commit(originalEvent?: PointerEvent): boolean {
    const current = this.#snapshot;
    if (
      !current.active ||
      !current.allowed ||
      current.payload == null ||
      current.screen == null ||
      current.world == null ||
      current.position == null ||
      current.size == null
    ) {
      return false;
    }
    const event = this.#event(current, originalEvent);
    this.#snapshot = { ...current, active: false };
    this.callbacks.onCommit?.(event);
    this.#emitChange();
    return true;
  }

  cancel(
    reason: PlacementCancelEvent<T>["reason"] = "cancel",
    originalEvent?: PointerEvent | KeyboardEvent,
  ): boolean {
    if (!this.#snapshot.active || this.#snapshot.payload == null) return false;
    const payload = this.#snapshot.payload;
    this.#snapshot = { ...this.#snapshot, active: false, allowed: false };
    this.callbacks.onCancel?.({
      controller: this,
      payload,
      reason,
      ...(originalEvent ? { originalEvent } : {}),
    });
    this.#emitChange();
    return true;
  }

  #event(
    snapshot: PlacementSnapshot<T>,
    originalEvent?: PointerEvent,
  ): PlacementEvent<T> {
    return {
      ...snapshot,
      payload: snapshot.payload!,
      screen: snapshot.screen!,
      world: snapshot.world!,
      position: snapshot.position!,
      size: snapshot.size!,
      ...(originalEvent ? { originalEvent } : {}),
    };
  }

  #emitChange(): void {
    this.callbacks.onChange?.(this.#snapshot);
    for (const callback of this.#stateCallbacks) callback(this.#snapshot);
    this.#geometryWriter?.(this.#geometrySnapshot());
  }

  #geometrySnapshot(): PlacementGeometrySnapshot {
    const snapshot = this.#snapshot;
    return {
      active: snapshot.active,
      visible: snapshot.active && snapshot.position !== null,
      screen: snapshot.screen ? { ...snapshot.screen } : null,
      world: snapshot.world ? { ...snapshot.world } : null,
      position: snapshot.position ? { ...snapshot.position } : null,
      size: snapshot.size ? { ...snapshot.size } : null,
      allowed: snapshot.allowed,
    };
  }
}
